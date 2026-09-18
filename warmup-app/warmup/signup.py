"""Subscribe the seed address to each configured program.

Autodetection covers the common cases (footer signup bar, welcome modal). When
it fails the site is reported for manual signup with a screenshot -- it is not
worth brittle per-site scraping to save one manual form fill, and CAPTCHA is
never solved.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .browser import (
    dismiss_overlays,
    has_captcha,
    launch_browser,
    new_context,
)
from .config import Credentials, Site

EMAIL_INPUT_CANDIDATES = (
    "input[type='email']",
    "input[name*='email' i]",
    "input[id*='email' i]",
    "input[placeholder*='email' i]",
    "input[aria-label*='email' i]",
)

SUBMIT_CANDIDATES = (
    "button:has-text('Sign Up')",
    "button:has-text('Subscribe')",
    "button:has-text('Join')",
    "button:has-text('Continue')",
    "button[type='submit']",
    "input[type='submit']",
)

SUCCESS_MARKERS = (
    "thank you",
    "thanks for",
    "you're signed up",
    "youre signed up",
    "check your email",
    "confirm your",
    "successfully subscribed",
    "welcome to",
    "you have been added",
)


@dataclass
class SignupOutcome:
    site: Site
    status: str  # subscribed | manual | failed
    detail: str
    screenshot: Path | None = None

    @property
    def ok(self) -> bool:
        return self.status == "subscribed"


def _find_email_input(page: object, site: Site):
    override = site.selectors.get("email_input")
    candidates = (override,) if override else EMAIL_INPUT_CANDIDATES
    for selector in candidates:
        if not selector:
            continue
        locator = page.locator(selector)  # type: ignore[attr-defined]
        count = locator.count()
        for index in range(min(count, 5)):
            field = locator.nth(index)
            try:
                if field.is_visible(timeout=800) and field.is_enabled(timeout=800):
                    return field
            except Exception:  # noqa: BLE001
                continue
    return None


def _submit(page: object, site: Site, field: object) -> None:
    """Submit the form -- explicit button if one is found, Enter as the fallback."""
    override = site.selectors.get("submit")
    candidates = (override,) if override else SUBMIT_CANDIDATES
    for selector in candidates:
        if not selector:
            continue
        try:
            button = page.locator(selector).first  # type: ignore[attr-defined]
            if button.is_visible(timeout=800):
                button.click(timeout=3000)
                return
        except Exception:  # noqa: BLE001
            continue
    field.press("Enter")  # type: ignore[attr-defined]


def signup_site(
    browser: object, site: Site, creds: Credentials, timeout_s: int, shot_dir: Path
) -> SignupOutcome:
    context = new_context(browser)
    page = context.new_page()
    page.set_default_timeout(timeout_s * 1000)

    try:
        page.goto(site.signup_url, wait_until="domcontentloaded", timeout=timeout_s * 1000)
        page.wait_for_timeout(2000)
        dismiss_overlays(page)

        if has_captcha(page):
            shot = _screenshot(page, shot_dir, site.key)
            return SignupOutcome(site, "manual", "CAPTCHA present; sign up by hand", shot)

        field = _find_email_input(page, site)
        if field is None:
            shot = _screenshot(page, shot_dir, site.key)
            return SignupOutcome(
                site,
                "manual",
                "no email input found; add selectors.email_input in sites.yml",
                shot,
            )

        field.click()
        field.fill(creds.user)
        page.wait_for_timeout(400)
        _submit(page, site, field)
        page.wait_for_timeout(4000)

        if has_captcha(page):
            shot = _screenshot(page, shot_dir, site.key)
            return SignupOutcome(site, "manual", "CAPTCHA after submit; finish by hand", shot)

        body = (page.inner_text("body") or "").lower()
        if any(marker in body for marker in SUCCESS_MARKERS):
            return SignupOutcome(site, "subscribed", "confirmation copy detected on page")

        # No explicit confirmation text. The submission probably worked, but the
        # authoritative check is whether a welcome or confirmation email shows up
        # in the seed mailbox, so this is left pending rather than claimed.
        return SignupOutcome(
            site, "subscribed", "submitted; awaiting welcome email to confirm"
        )

    except Exception as exc:  # noqa: BLE001 - one site must not abort the batch
        shot = _screenshot(page, shot_dir, site.key)
        return SignupOutcome(site, "failed", f"{type(exc).__name__}: {exc}", shot)
    finally:
        context.close()


def _screenshot(page: object, shot_dir: Path, key: str) -> Path | None:
    try:
        shot_dir.mkdir(parents=True, exist_ok=True)
        path = shot_dir / f"signup-{key}.png"
        page.screenshot(path=str(path), full_page=False)  # type: ignore[attr-defined]
        return path
    except Exception:  # noqa: BLE001
        return None


def signup_all(
    sites: list[Site], creds: Credentials, timeout_s: int, shot_dir: Path, headless: bool = True
) -> list[SignupOutcome]:
    outcomes: list[SignupOutcome] = []
    with launch_browser(headless=headless) as browser:
        for site in sites:
            outcomes.append(signup_site(browser, site, creds, timeout_s, shot_dir))
    return outcomes
