"""Complete double opt-in by finding and visiting confirmation links.

Most retail programs are confirmed opt-in: the signup only counts once the link
in the confirmation email is clicked. Until then the seed address receives
nothing and placement data stays empty, so this runs right after `signup`.
"""

from __future__ import annotations

from dataclasses import dataclass

from .browser import host_allowed, launch_browser, new_context
from .config import Site
from .engage import extract_links
from .mailbox import Mailbox

SUBJECT_MARKERS = (
    "confirm",
    "verify",
    "activate",
    "opt-in",
    "opt in",
    "complete your",
    "almost there",
    "one more step",
)

LINK_MARKERS = (
    "confirm",
    "verify",
    "activate",
    "optin",
    "opt-in",
    "subscribe",
)


@dataclass
class ConfirmOutcome:
    site: Site
    status: str  # confirmed | not_found | failed
    detail: str


def _looks_like_confirmation(subject: str) -> bool:
    lowered = subject.lower()
    return any(marker in lowered for marker in SUBJECT_MARKERS)


def _pick_confirm_link(links: list[str], allowed: list[str]) -> str | None:
    """Prefer a link whose URL names the action; fall back to the first on-domain one."""
    on_domain = [link for link in links if host_allowed(link, allowed)]
    for link in on_domain:
        if any(marker in link.lower() for marker in LINK_MARKERS):
            return link
    return on_domain[0] if on_domain else None


def confirm_subscriptions(
    mailbox: Mailbox,
    sites: list[Site],
    allowed_domains: list[str],
    folders: dict[str, str],
    lookback_days: int,
    headless: bool = True,
) -> list[ConfirmOutcome]:
    all_mail = folders.get("all_mail", "[Gmail]/All Mail")
    spam = folders.get("spam", "[Gmail]/Spam")

    # Confirmation mail lands in spam often enough that checking only the inbox
    # would silently strand subscriptions.
    candidates: list[tuple[str, str]] = []
    for folder in (all_mail, spam):
        try:
            for uid in mailbox.search(folder, None, lookback_days):
                candidates.append((folder, uid))
        except Exception:  # noqa: BLE001
            continue

    by_folder: dict[str, list[str]] = {}
    for folder, uid in candidates:
        by_folder.setdefault(folder, []).append(uid)

    fetched = []
    for folder, uids in by_folder.items():
        fetched.extend(mailbox.fetch_full(folder, uids))

    outcomes: list[ConfirmOutcome] = []
    with launch_browser(headless=headless) as browser:
        for site in sites:
            match = next(
                (
                    item
                    for item in fetched
                    if site.matches_sender(item.sender) and _looks_like_confirmation(item.subject)
                ),
                None,
            )
            if match is None:
                outcomes.append(
                    ConfirmOutcome(site, "not_found", "no confirmation email seen")
                )
                continue

            link = _pick_confirm_link(extract_links(match.message), allowed_domains)
            if link is None:
                outcomes.append(
                    ConfirmOutcome(
                        site,
                        "failed",
                        "confirmation email found but no link on an allowed domain; "
                        "add the ESP click-tracking domain to engagement.allowed_domains",
                    )
                )
                continue

            outcomes.append(_visit(browser, site, link))
    return outcomes


def _visit(browser: object, site: Site, link: str) -> ConfirmOutcome:
    context = new_context(browser)
    page = context.new_page()
    try:
        page.goto(link, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)
        return ConfirmOutcome(site, "confirmed", f"visited {page.url}")
    except Exception as exc:  # noqa: BLE001
        return ConfirmOutcome(site, "failed", f"{type(exc).__name__}: {exc}")
    finally:
        context.close()
