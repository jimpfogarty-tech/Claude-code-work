"""Open a message, follow one of its links, and browse for a while.

Scope guard: a link is followed only when its host is on
`engagement.allowed_domains`, and the *final* URL after redirects is re-checked
before any interaction. ESP click-tracking links redirect off-domain by design,
so verifying only the href would let the crawler wander onto third-party
destinations embedded in an email.
"""

from __future__ import annotations

import random
import re
import time
from dataclasses import dataclass
from email.message import Message
from typing import Any

from .browser import dismiss_overlays, host_allowed, human_scroll, new_context

_HREF_RE = re.compile(r"""href\s*=\s*["']([^"']+)["']""", re.IGNORECASE)


@dataclass
class EngagementResult:
    url: str | None
    final_url: str | None
    dwell_ms: int
    pages: int
    ok: bool
    error: str = ""


def extract_links(message: Message) -> list[str]:
    """Every http(s) link in the message's HTML part, in document order, deduped."""
    html = _html_part(message)
    if not html:
        return []

    hrefs: list[str] = []
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "lxml")
        hrefs = [a["href"] for a in soup.find_all("a", href=True)]
    except Exception:  # noqa: BLE001 - fall back to regex if bs4/lxml is unavailable
        hrefs = _HREF_RE.findall(html)

    seen: set[str] = set()
    out: list[str] = []
    for href in hrefs:
        href = href.strip()
        if not href.lower().startswith(("http://", "https://")):
            continue
        if href in seen:
            continue
        seen.add(href)
        out.append(href)
    return out


def _html_part(message: Message) -> str:
    for part in message.walk():
        if part.get_content_type() != "text/html":
            continue
        payload = part.get_payload(decode=True)
        if payload is None:
            continue
        charset = part.get_content_charset() or "utf-8"
        try:
            return payload.decode(charset, "replace")
        except LookupError:
            return payload.decode("utf-8", "replace")
    return ""


def choose_link(links: list[str], skip_patterns: list[str], allowed: list[str]) -> str | None:
    """Pick a link worth clicking: on-domain, not an unsubscribe or preferences link.

    Chosen at random among the candidates so repeated runs do not hammer the same
    hero link every day.
    """
    lowered = [p.lower() for p in skip_patterns]
    candidates = [
        link
        for link in links
        if host_allowed(link, allowed) and not any(p in link.lower() for p in lowered)
    ]
    if not candidates:
        return None
    return random.choice(candidates)


def engage_url(browser: object, url: str, settings: dict[str, Any]) -> EngagementResult:
    cfg = settings.get("engagement", {})
    allowed = list(cfg.get("allowed_domains") or [])
    dwell_total = random.uniform(
        float(cfg.get("dwell_seconds_min", 45)), float(cfg.get("dwell_seconds_max", 75))
    )
    extra_clicks = random.randint(
        int(cfg.get("extra_clicks_min", 1)), int(cfg.get("extra_clicks_max", 3))
    )
    skip_patterns = [p.lower() for p in (cfg.get("skip_link_patterns") or [])]

    started = time.monotonic()
    # The budget is wall-clock time on site, so page loads count against it.
    # Slots are rebalanced against the deadline after each navigation, which
    # keeps the total near the configured window on slow and fast sites alike.
    deadline = started + dwell_total
    context = new_context(browser)
    page = context.new_page()
    page.set_default_timeout(20000)
    pages_visited = 0

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        pages_visited = 1

        final_url = page.url
        if not host_allowed(final_url, allowed):
            return EngagementResult(
                url=url,
                final_url=final_url,
                dwell_ms=int((time.monotonic() - started) * 1000),
                pages=pages_visited,
                ok=False,
                error=f"redirect left the allowlist ({final_url}); stopped without interacting",
            )

        dismiss_overlays(page)

        slots = extra_clicks + 1

        def slot_budget(index: int) -> float:
            """Even share of whatever time is left, across the slots still to come."""
            return max(0.0, (deadline - time.monotonic()) / max(1, slots - index))

        human_scroll(page, slot_budget(0))

        for i in range(extra_clicks):
            next_url = _pick_internal_link(page, allowed, skip_patterns)
            if next_url is None:
                human_scroll(page, slot_budget(i + 1))
                continue
            try:
                page.goto(next_url, wait_until="domcontentloaded", timeout=20000)
                pages_visited += 1
                dismiss_overlays(page)
            except Exception:  # noqa: BLE001 - a dead internal link is not a run failure
                pass
            human_scroll(page, slot_budget(i + 1))

        return EngagementResult(
            url=url,
            final_url=page.url,
            dwell_ms=int((time.monotonic() - started) * 1000),
            pages=pages_visited,
            ok=True,
        )

    except Exception as exc:  # noqa: BLE001
        return EngagementResult(
            url=url,
            final_url=None,
            dwell_ms=int((time.monotonic() - started) * 1000),
            pages=pages_visited,
            ok=False,
            error=f"{type(exc).__name__}: {exc}",
        )
    finally:
        context.close()


def _pick_internal_link(page: object, allowed: list[str], skip_patterns: list[str]) -> str | None:
    try:
        hrefs = page.eval_on_selector_all(  # type: ignore[attr-defined]
            "a[href]", "els => els.map(e => e.href)"
        )
    except Exception:  # noqa: BLE001
        return None

    candidates = [
        href
        for href in hrefs
        if isinstance(href, str)
        and href.startswith(("http://", "https://"))
        and host_allowed(href, allowed)
        and not any(p in href.lower() for p in skip_patterns)
        and href.rstrip("/") != page.url.rstrip("/")  # type: ignore[attr-defined]
    ]
    return random.choice(candidates) if candidates else None
