"""Shared browser helpers.

Deliberately plain: a stock Chromium with a normal user agent. No fingerprint
spoofing, no proxy rotation, no CAPTCHA solving. Anti-detection measures would
be both fragile and dishonest about what this traffic is -- and since every
target is a property you own, there is nothing to hide from.
"""

from __future__ import annotations

import os
import random
import time
from contextlib import contextmanager
from typing import Iterator
from urllib.parse import urlparse

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

VIEWPORT = {"width": 1440, "height": 900}

COOKIE_DISMISS_SELECTORS = (
    "#onetrust-accept-btn-handler",
    "button#truste-consent-button",
    "button[aria-label*='accept' i]",
    "button:has-text('Accept All')",
    "button:has-text('Accept Cookies')",
    "button:has-text('I Accept')",
)

MODAL_DISMISS_SELECTORS = (
    "button[aria-label*='close' i]",
    "button[title*='close' i]",
    "[class*='modal'] button[class*='close' i]",
    "[id*='popup'] button[class*='close' i]",
)

CAPTCHA_SELECTORS = (
    "iframe[src*='recaptcha']",
    "iframe[src*='hcaptcha']",
    "iframe[src*='challenges.cloudflare.com']",
    "div.g-recaptcha",
    "div.h-captcha",
    "div.cf-turnstile",
)


@contextmanager
def launch_browser(headless: bool = True) -> Iterator["object"]:
    """Yield a Playwright browser, importing lazily so CLI help works without it.

    Set WARMUP_CHROMIUM_PATH to use a browser the environment already provides
    instead of one Playwright downloaded. Needed wherever the available Chromium
    build does not match the installed Playwright version -- common on
    self-hosted runners and prebuilt container images.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:  # pragma: no cover - depends on install state
        raise RuntimeError(
            "Playwright is not installed. Run:\n"
            "  pip install -r requirements.txt && playwright install chromium"
        ) from exc

    executable = os.environ.get("WARMUP_CHROMIUM_PATH", "").strip() or None
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless, executable_path=executable)
        try:
            yield browser
        finally:
            browser.close()


def new_context(browser: object):
    return browser.new_context(  # type: ignore[attr-defined]
        user_agent=USER_AGENT,
        viewport=VIEWPORT,
        locale="en-US",
        timezone_id="America/New_York",
    )


def host_allowed(url: str, allowed_domains: list[str]) -> bool:
    """True if `url`'s host is an allowed domain or a subdomain of one.

    Default-deny: an empty allowlist permits nothing. Suffix matching is done on
    a leading-dot boundary so `notfullbeauty.com` cannot pass as `fullbeauty.com`.
    """
    if not allowed_domains:
        return False
    try:
        host = (urlparse(url).hostname or "").lower().rstrip(".")
    except ValueError:
        return False
    if not host:
        return False
    for domain in allowed_domains:
        d = domain.lower().strip().lstrip(".").rstrip(".")
        if not d:
            continue
        if host == d or host.endswith("." + d):
            return True
    return False


def dismiss_overlays(page: object) -> None:
    """Best-effort dismissal of cookie banners and welcome modals."""
    for selector in COOKIE_DISMISS_SELECTORS + MODAL_DISMISS_SELECTORS:
        try:
            locator = page.locator(selector).first  # type: ignore[attr-defined]
            if locator.is_visible(timeout=800):
                locator.click(timeout=1500)
                page.wait_for_timeout(300)  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001 - overlays are optional by nature
            continue


def has_captcha(page: object) -> bool:
    for selector in CAPTCHA_SELECTORS:
        try:
            if page.locator(selector).first.is_visible(timeout=500):  # type: ignore[attr-defined]
                return True
        except Exception:  # noqa: BLE001
            continue
    return False


def human_scroll(page: object, seconds: float) -> None:
    """Scroll down in irregular steps for roughly `seconds`, pausing as it goes."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            page.mouse.wheel(0, random.randint(250, 700))  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            return
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        page.wait_for_timeout(int(min(random.uniform(0.8, 2.4), remaining) * 1000))  # type: ignore[attr-defined]
