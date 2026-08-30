"""Extract authentication results and sending IP from message headers.

SPF/DKIM/DMARC verdicts are the receiving provider's own judgement, recorded in
the `Authentication-Results` header it stamps on delivery. That makes them the
most trustworthy deliverability signal available from a seed mailbox: they are
what the provider concluded, not what we hope it concluded.
"""

from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass
from email.message import Message

# "spf=pass", "dkim = fail", "dmarc=bestguesspass" etc. The method name must be
# preceded by a delimiter so "arc=pass" is not read as a dmarc/spf verdict.
_METHOD_RE = r"(?:^|[;,\s])%s\s*=\s*([a-z]+)"

_RECEIVED_IP_RE = re.compile(r"[\[(]\s*(?:IPv6:)?([0-9a-fA-F:.]+)\s*[\])]")

_PASS_VALUES = {"pass", "bestguesspass"}


@dataclass(frozen=True)
class AuthResult:
    spf: str | None = None
    dkim: str | None = None
    dmarc: str | None = None
    sending_ip: str | None = None

    @property
    def all_pass(self) -> bool:
        return all(
            v in _PASS_VALUES
            for v in (self.spf, self.dkim, self.dmarc)
            if v is not None
        ) and None not in (self.spf, self.dkim, self.dmarc)

    def failures(self) -> list[str]:
        """Names of the mechanisms that did not pass. Missing counts as failing."""
        out = []
        for name, value in (("spf", self.spf), ("dkim", self.dkim), ("dmarc", self.dmarc)):
            if value is None or value not in _PASS_VALUES:
                out.append(name)
        return out


def _find_verdict(text: str, method: str) -> str | None:
    match = re.search(_METHOD_RE % method, text, re.IGNORECASE)
    return match.group(1).lower() if match else None


def parse_auth_results(message: Message) -> AuthResult:
    """Read SPF/DKIM/DMARC verdicts and the originating IP off a message.

    A message can carry several `Authentication-Results` headers (each relay adds
    its own, newest first). Python's `get_all` returns them in header order, so
    the first is the one stamped by the final receiving provider -- the verdict
    that actually decided placement.
    """
    headers = message.get_all("Authentication-Results") or []
    primary = headers[0] if headers else ""

    spf = _find_verdict(primary, "spf")
    dkim = _find_verdict(primary, "dkim")
    dmarc = _find_verdict(primary, "dmarc")

    # Some providers omit SPF from Authentication-Results but still send
    # Received-SPF. Fall back to it rather than reporting an unknown.
    if spf is None:
        received_spf = message.get("Received-SPF")
        if received_spf:
            first_word = received_spf.strip().split(None, 1)
            if first_word:
                spf = first_word[0].strip().lower()

    return AuthResult(spf=spf, dkim=dkim, dmarc=dmarc, sending_ip=extract_sending_ip(message))


def extract_sending_ip(message: Message) -> str | None:
    """Best-effort originating IP, taken from the earliest usable Received hop.

    Received headers are prepended, so the *last* one is the first hop -- closest
    to the true sender. Loopback, private, and reserved ranges are skipped: they
    identify internal relays, never real sending infrastructure. Note that
    `is_private` also covers the documentation ranges (192.0.2.0/24 and friends),
    which is what we want here.
    """
    received = message.get_all("Received") or []
    for header in reversed(received):
        for candidate in _RECEIVED_IP_RE.findall(header):
            try:
                ip = ipaddress.ip_address(candidate)
            except ValueError:
                continue
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_unspecified:
                continue
            return str(ip)
    return None
