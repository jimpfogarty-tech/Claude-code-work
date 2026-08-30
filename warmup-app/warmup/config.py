"""Configuration loading for settings.yml, sites.yml, and mailbox credentials."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SETTINGS = REPO_ROOT / "config" / "settings.yml"
DEFAULT_SITES = REPO_ROOT / "config" / "sites.yml"


class ConfigError(RuntimeError):
    """Raised when configuration is missing or malformed."""


@dataclass(frozen=True)
class Site:
    key: str
    name: str
    signup_url: str
    senders: tuple[str, ...] = ()
    selectors: dict[str, str] = field(default_factory=dict)

    def matches_sender(self, from_header: str) -> bool:
        """True if `from_header` came from one of this site's sending identities.

        Each entry in `senders` is either a full address or an "@domain" suffix.
        """
        haystack = from_header.lower()
        return any(s.lower() in haystack for s in self.senders)


@dataclass(frozen=True)
class Credentials:
    host: str
    port: int
    user: str
    password: str
    first_name: str = "Seed"
    last_name: str = "Monitor"
    zip_code: str = "10001"


def load_settings(path: Path | None = None) -> dict[str, Any]:
    path = path or DEFAULT_SETTINGS
    if not path.exists():
        raise ConfigError(f"settings file not found: {path}")
    with path.open() as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        raise ConfigError(f"{path} must contain a YAML mapping")
    return data


def load_sites(path: Path | None = None) -> list[Site]:
    path = path or DEFAULT_SITES
    if not path.exists():
        raise ConfigError(
            f"sites file not found: {path}\n"
            "Copy config/sites.example.yml to config/sites.yml and fill it in."
        )
    with path.open() as fh:
        data = yaml.safe_load(fh) or {}

    raw_sites = data.get("sites") or []
    if not raw_sites:
        raise ConfigError(f"{path} defines no sites")

    sites: list[Site] = []
    seen: set[str] = set()
    for entry in raw_sites:
        missing = [k for k in ("key", "name", "signup_url") if not entry.get(k)]
        if missing:
            raise ConfigError(f"site entry {entry!r} is missing: {', '.join(missing)}")
        key = str(entry["key"])
        if key in seen:
            raise ConfigError(f"duplicate site key: {key}")
        seen.add(key)
        sites.append(
            Site(
                key=key,
                name=str(entry["name"]),
                signup_url=str(entry["signup_url"]),
                senders=tuple(entry.get("senders") or ()),
                selectors=dict(entry.get("selectors") or {}),
            )
        )
    return sites


def load_credentials() -> Credentials:
    """Read mailbox credentials from the environment.

    Credentials never live in config files -- locally they come from .env
    (exported by the caller), in CI from GitHub Secrets.
    """
    user = os.environ.get("WARMUP_IMAP_USER", "").strip()
    password = os.environ.get("WARMUP_IMAP_PASSWORD", "").strip()
    if not user or not password:
        raise ConfigError(
            "WARMUP_IMAP_USER and WARMUP_IMAP_PASSWORD must be set. "
            "See .env.example."
        )
    return Credentials(
        host=os.environ.get("WARMUP_IMAP_HOST", "imap.gmail.com").strip(),
        port=int(os.environ.get("WARMUP_IMAP_PORT", "993")),
        user=user,
        password=password,
        first_name=os.environ.get("WARMUP_SIGNUP_FIRST_NAME", "Seed").strip(),
        last_name=os.environ.get("WARMUP_SIGNUP_LAST_NAME", "Monitor").strip(),
        zip_code=os.environ.get("WARMUP_SIGNUP_ZIP", "10001").strip(),
    )
