"""Render placement results as a Markdown report."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import Site
from .placement import Placement, inbox_rate, spam_rate
from .store import Store


def _pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def build_report(store: Store, sites: list[Site], settings: dict[str, Any]) -> str:
    cfg = settings.get("report", {})
    trailing_days = int(cfg.get("trailing_days", 30))
    warn_at = float(cfg.get("spam_rate_warn", 0.10))

    since = (datetime.now(timezone.utc) - timedelta(days=trailing_days)).isoformat(timespec="seconds")
    rows = store.latest_observations(since)
    names = {s.key: s.name for s in sites}

    lines: list[str] = []
    lines.append("# Inbox placement report\n")
    lines.append(
        f"Window: trailing **{trailing_days} days** · "
        f"generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n"
    )

    if not rows:
        lines.append(
            "No tracked messages observed yet. If signups are confirmed, this usually "
            "means the `senders` entries in `config/sites.yml` do not match the actual "
            "From: addresses — check a received message and add the real sending domain.\n"
        )
        return "\n".join(lines)

    placements = [Placement(r["placement"]) for r in rows]
    lines.append("## Overall\n")
    lines.append(f"- Messages observed: **{len(rows)}**")
    lines.append(f"- Inbox rate: **{_pct(inbox_rate(placements))}**")
    lines.append(f"- Spam rate: **{_pct(spam_rate(placements))}**")
    lines.append("")

    # -- per site ------------------------------------------------------
    by_site: dict[str | None, list[Any]] = defaultdict(list)
    for row in rows:
        by_site[row["site_key"]].append(row)

    lines.append("## By program\n")
    lines.append("| Program | Msgs | Inbox | Promotions | Spam | Spam rate | Auth |")
    lines.append("|---------|-----:|------:|-----------:|-----:|----------:|------|")
    for site_key, site_rows in sorted(by_site.items(), key=lambda kv: str(kv[0])):
        site_placements = [Placement(r["placement"]) for r in site_rows]
        inbox_n = sum(1 for p in site_placements if p.is_inbox)
        promo_n = sum(1 for p in site_placements if p is Placement.INBOX_PROMOTIONS)
        spam_n = sum(1 for p in site_placements if p is Placement.SPAM)
        rate = spam_rate(site_placements)
        flag = " ⚠️" if rate > warn_at else ""
        auth = _auth_summary(site_rows)
        label = names.get(str(site_key), str(site_key))
        lines.append(
            f"| {label} | {len(site_rows)} | {inbox_n} | {promo_n} | {spam_n} | "
            f"{_pct(rate)}{flag} | {auth} |"
        )
    lines.append("")

    # -- authentication failures ---------------------------------------
    failures = [
        r
        for r in rows
        if any(
            (r[field] or "").lower() not in ("pass", "bestguesspass")
            for field in ("spf", "dkim", "dmarc")
        )
    ]
    if failures:
        lines.append("## Authentication failures\n")
        lines.append(
            "These are the receiving provider's own verdicts. Any non-pass here is a "
            "direct cap on deliverability and should be fixed before anything else.\n"
        )
        lines.append("| Date | Program | Subject | SPF | DKIM | DMARC | Sending IP |")
        lines.append("|------|---------|---------|-----|------|-------|------------|")
        for r in failures[:40]:
            sent = (r["sent_at"] or "")[:10]
            subject = (r["subject"] or "")[:50]
            label = names.get(str(r["site_key"]), str(r["site_key"]))
            lines.append(
                f"| {sent} | {label} | {subject} | {r['spf'] or '—'} | "
                f"{r['dkim'] or '—'} | {r['dmarc'] or '—'} | {r['sending_ip'] or '—'} |"
            )
        lines.append("")
    else:
        lines.append("## Authentication\n")
        lines.append("SPF, DKIM, and DMARC passed on every observed message.\n")

    # -- spam detail ---------------------------------------------------
    spammed = [r for r in rows if r["placement"] == Placement.SPAM.value]
    if spammed:
        lines.append("## Messages that landed in spam\n")
        lines.append("| Date | Program | Subject |")
        lines.append("|------|---------|---------|")
        for r in spammed[:40]:
            sent = (r["sent_at"] or "")[:10]
            label = names.get(str(r["site_key"]), str(r["site_key"]))
            lines.append(f"| {sent} | {label} | {(r['subject'] or '')[:70]} |")
        lines.append("")

    # -- silence -------------------------------------------------------
    seen_keys = {str(r["site_key"]) for r in rows}
    silent = [s for s in sites if s.key not in seen_keys]
    if silent:
        lines.append("## No mail observed\n")
        lines.append(
            "Either the subscription never completed, or the program is not currently "
            "sending, or the sender addresses in config do not match.\n"
        )
        for site in silent:
            lines.append(f"- {site.name} (`{site.key}`)")
        lines.append("")

    return "\n".join(lines)


def _auth_summary(rows: list[Any]) -> str:
    total = len(rows)
    passing = sum(
        1
        for r in rows
        if all(
            (r[field] or "").lower() in ("pass", "bestguesspass")
            for field in ("spf", "dkim", "dmarc")
        )
    )
    if passing == total:
        return "all pass"
    return f"{passing}/{total} pass"
