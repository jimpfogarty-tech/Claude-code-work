"""Command line entry point."""

from __future__ import annotations

import argparse
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from . import __version__
from .browser import launch_browser
from .config import ConfigError, load_credentials, load_settings, load_sites
from .confirm import confirm_subscriptions
from .engage import choose_link, engage_url, extract_links
from .mailbox import Mailbox, MailboxError
from .placement import Placement
from .rampplan import build_plan, render_markdown
from .report import build_report
from .signup import signup_all
from .store import Store
from .sweep import SweepRecord, run_sweep

APP_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = APP_ROOT / "data" / "warmup.db"
REPORT_DIR = APP_ROOT / "reports"
SHOT_DIR = APP_ROOT / "screenshots"


def load_dotenv(path: Path) -> None:
    """Populate os.environ from a .env file, without overriding real env vars."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


# ----------------------------------------------------------------------
# commands
# ----------------------------------------------------------------------


def cmd_doctor(args: argparse.Namespace) -> int:
    settings = load_settings(args.settings)
    print(f"warmup {__version__}")

    try:
        sites = load_sites(args.sites)
        print(f"✓ sites: {len(sites)} configured")
        for site in sites:
            senders = ", ".join(site.senders) or "(none — sweep cannot match this program)"
            print(f"    - {site.key}: {senders}")
    except ConfigError as exc:
        print(f"✗ sites: {exc}")
        return 1

    allowed = settings.get("engagement", {}).get("allowed_domains") or []
    if settings.get("engagement", {}).get("enabled") and not allowed:
        print("! engagement enabled but allowed_domains is empty — no links will be followed")
    else:
        print(f"✓ engagement allowlist: {', '.join(allowed) or 'disabled'}")

    try:
        creds = load_credentials()
    except ConfigError as exc:
        print(f"✗ credentials: {exc}")
        return 1
    print(f"✓ credentials: {creds.user} @ {creds.host}:{creds.port}")

    try:
        with Mailbox(creds.host, creds.port, creds.user, creds.password) as mb:
            folders = mb.list_folders()
            print(f"✓ IMAP connected — {len(folders)} folders")
            wanted = settings.get("mailbox", {}).get("folders", {})
            for label, name in wanted.items():
                mark = "✓" if name in folders else "✗"
                print(f"    {mark} {label}: {name}")
    except MailboxError as exc:
        print(f"✗ IMAP: {exc}")
        return 1
    return 0


def cmd_signup(args: argparse.Namespace) -> int:
    settings = load_settings(args.settings)
    sites = load_sites(args.sites)
    creds = load_credentials()
    timeout = int(settings.get("signup", {}).get("form_timeout_s", 15))

    outcomes = signup_all(sites, creds, timeout, SHOT_DIR, headless=not args.headed)
    with Store(args.db) as store:
        for outcome in outcomes:
            store.record_subscription(
                outcome.site.key,
                outcome.site.name,
                outcome.site.signup_url,
                "pending" if outcome.ok else outcome.status,
                outcome.detail,
            )

    manual = [o for o in outcomes if o.status != "subscribed"]
    for outcome in outcomes:
        mark = "✓" if outcome.ok else "!"
        print(f"{mark} {outcome.site.name}: {outcome.detail}")
        if outcome.screenshot:
            print(f"    screenshot: {outcome.screenshot}")

    if manual:
        print(f"\n{len(manual)} site(s) need manual signup with {creds.user}.")
    print("\nNext: run `warmup confirm` once the confirmation emails arrive.")
    return 0


def cmd_confirm(args: argparse.Namespace) -> int:
    settings = load_settings(args.settings)
    sites = load_sites(args.sites)
    creds = load_credentials()
    mail_cfg = settings.get("mailbox", {})
    allowed = list(settings.get("engagement", {}).get("allowed_domains") or [])

    with Mailbox(creds.host, creds.port, creds.user, creds.password) as mb, Store(args.db) as store:
        outcomes = confirm_subscriptions(
            mb,
            sites,
            allowed,
            mail_cfg.get("folders", {}),
            int(args.lookback or mail_cfg.get("lookback_days", 3)),
            headless=not args.headed,
        )
        for outcome in outcomes:
            if outcome.status == "confirmed":
                store.mark_confirmed(outcome.site.key)
            mark = {"confirmed": "✓", "not_found": "·", "failed": "✗"}[outcome.status]
            print(f"{mark} {outcome.site.name}: {outcome.detail}")
    return 0


def cmd_sweep(args: argparse.Namespace) -> int:
    settings = load_settings(args.settings)
    sites = load_sites(args.sites)
    creds = load_credentials()

    with Mailbox(creds.host, creds.port, creds.user, creds.password) as mb, Store(args.db) as store:
        result = run_sweep(mb, store, sites, settings)
        _print_sweep(result)
    return 1 if result.errors else 0


def cmd_engage(args: argparse.Namespace) -> int:
    settings = load_settings(args.settings)
    sites = load_sites(args.sites)
    creds = load_credentials()

    with Mailbox(creds.host, creds.port, creds.user, creds.password) as mb, Store(args.db) as store:
        result = run_sweep(mb, store, sites, settings)
        _print_sweep(result)
        run_engagement(mb, store, result.records, settings)
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    settings = load_settings(args.settings)
    sites = load_sites(args.sites)
    with Store(args.db) as store:
        text = build_report(store, sites, settings)
    _emit(text, args.out, REPORT_DIR / "placement.md")
    return 0


def cmd_rampplan(args: argparse.Namespace) -> int:
    settings = load_settings(args.settings)
    cfg = dict(settings.get("rampplan", {}))
    if args.start_volume:
        cfg["start_volume"] = args.start_volume
    if args.growth:
        cfg["growth_factor"] = args.growth
    plan = build_plan(args.list_size, cfg, start_date=date.today())
    _emit(render_markdown(plan), args.out, REPORT_DIR / "rampplan.md")
    return 0


def cmd_daily(args: argparse.Namespace) -> int:
    """Sweep, engage, and report — the scheduled CI entry point."""
    settings = load_settings(args.settings)
    sites = load_sites(args.sites)
    creds = load_credentials()

    with Mailbox(creds.host, creds.port, creds.user, creds.password) as mb, Store(args.db) as store:
        result = run_sweep(mb, store, sites, settings)
        _print_sweep(result)
        if args.no_engage:
            print("engagement: skipped (--no-engage)")
        elif settings.get("engagement", {}).get("enabled"):
            run_engagement(mb, store, result.records, settings)
        text = build_report(store, sites, settings)

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    _emit(text, args.out, REPORT_DIR / f"placement-{stamp}.md")
    return 1 if result.errors else 0


# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------


def run_engagement(
    mailbox: Mailbox, store: Store, records: list[SweepRecord], settings: dict[str, Any]
) -> None:
    """Open, click, and browse for each message not yet successfully engaged."""
    cfg = settings.get("engagement", {})
    if not cfg.get("enabled"):
        return

    allowed = list(cfg.get("allowed_domains") or [])
    if not allowed:
        print("engagement: allowlist empty, skipping (nothing is permitted to be clicked)")
        return

    lookback = int(settings.get("mailbox", {}).get("lookback_days", 3))
    since = (datetime.now(timezone.utc) - timedelta(days=lookback)).isoformat(timespec="seconds")
    pending_ids = {row["message_id"] for row in store.messages_without_engagement(since)}
    todo = [r for r in records if r.message_id in pending_ids and r.placement is not Placement.TRASH]

    if not todo:
        print("engagement: nothing pending")
        return

    skip_patterns = list(cfg.get("skip_link_patterns") or [])
    # Random order so the same program is not always engaged first.
    random.shuffle(todo)

    with launch_browser(headless=True) as browser:
        for record in todo:
            fetched = mailbox.fetch_full(record.folder, [record.uid])
            if not fetched:
                store.record_engagement(record.message_id, None, 0, 0, False, "could not refetch")
                continue

            message = fetched[0].message
            link = choose_link(extract_links(message), skip_patterns, allowed)
            if link is None:
                store.record_engagement(
                    record.message_id, None, 0, 0, False, "no clickable link on an allowed domain"
                )
                print(f"· {record.subject[:60]}: no allowed link")
                continue

            # Opening precedes clicking, same as a person reading their mail.
            mailbox.mark_read(record.folder, record.uid)

            outcome = engage_url(browser, link, settings)
            store.record_engagement(
                record.message_id,
                outcome.final_url or link,
                outcome.dwell_ms,
                outcome.pages,
                outcome.ok,
                outcome.error,
            )
            mark = "✓" if outcome.ok else "✗"
            detail = (
                f"{outcome.pages} page(s), {outcome.dwell_ms / 1000:.0f}s"
                if outcome.ok
                else outcome.error
            )
            print(f"{mark} {record.subject[:60]}: {detail}")


def _print_sweep(result: Any) -> None:
    print(f"sweep: {len(result.records)} message(s), {len(result.new_records)} new")
    for record in result.records:
        site = record.site.name if record.site else "?"
        auth = "auth ok" if record.auth.all_pass else f"auth fail: {','.join(record.auth.failures())}"
        print(f"  [{record.placement.label}] {site} — {record.subject[:55]} ({auth})")
    for site in result.silent_sites:
        print(f"  (no mail) {site.name}")
    for error in result.errors:
        print(f"  ! {error}", file=sys.stderr)


def _emit(text: str, out: str | None, default: Path) -> None:
    if out == "-":
        print(text)
        return
    path = Path(out) if out else default
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    print(f"wrote {path}")


# ----------------------------------------------------------------------
# parser
# ----------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="warmup",
        description="Seed-mailbox deliverability monitor and sending-reputation ramp planner.",
    )
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("--settings", type=Path, default=None, help="path to settings.yml")
    parser.add_argument("--sites", type=Path, default=None, help="path to sites.yml")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="path to the SQLite database")

    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("doctor", help="check config, credentials, and IMAP connectivity")
    p.set_defaults(func=cmd_doctor)

    p = sub.add_parser("signup", help="subscribe the seed address at each configured site")
    p.add_argument("--headed", action="store_true", help="show the browser window")
    p.set_defaults(func=cmd_signup)

    p = sub.add_parser("confirm", help="complete double opt-in confirmations")
    p.add_argument("--headed", action="store_true")
    p.add_argument("--lookback", type=int, default=None, help="days of mail to search")
    p.set_defaults(func=cmd_confirm)

    p = sub.add_parser("sweep", help="record where today's mail landed")
    p.set_defaults(func=cmd_sweep)

    p = sub.add_parser("engage", help="sweep, then open and click through new mail")
    p.set_defaults(func=cmd_engage)

    p = sub.add_parser("report", help="render the placement report")
    p.add_argument("--out", default=None, help="output path, or - for stdout")
    p.set_defaults(func=cmd_report)

    p = sub.add_parser("rampplan", help="generate a sending-domain warm-up ramp")
    p.add_argument("list_size", type=int, help="size of the mailable list")
    p.add_argument("--start-volume", type=int, default=None)
    p.add_argument("--growth", type=float, default=None)
    p.add_argument("--out", default=None, help="output path, or - for stdout")
    p.set_defaults(func=cmd_rampplan)

    p = sub.add_parser("daily", help="sweep + engage + report (scheduled entry point)")
    p.add_argument("--out", default=None, help="output path, or - for stdout")
    p.add_argument(
        "--no-engage",
        action="store_true",
        help="measure placement only; skip opening and clicking",
    )
    p.set_defaults(func=cmd_daily)

    return parser


def main(argv: list[str] | None = None) -> int:
    load_dotenv(APP_ROOT / ".env")
    args = build_parser().parse_args(argv)
    try:
        return int(args.func(args) or 0)
    except (ConfigError, MailboxError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
