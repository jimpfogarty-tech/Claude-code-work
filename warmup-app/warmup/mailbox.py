"""IMAP access to the seed mailbox.

Gmail notes that shape this module:
  * Tabs are not folders. Promotions/Updates/Social/Forums are only reachable
    through the X-GM-RAW search extension, which accepts Gmail query syntax.
  * `[Gmail]/All Mail` excludes Spam and Trash, so those are selected directly.
  * Every fetch uses BODY.PEEK so a sweep never marks mail as read. Marking read
    is a deliberate action performed by the engagement step, not a side effect
    of measuring placement.
"""

from __future__ import annotations

import email
import imaplib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from email.message import Message
from email.utils import parsedate_to_datetime
from typing import Iterable

# Gmail caps a single IMAP command; fetching thousands of UIDs at once can trip
# it. Sweeps are small, but batch anyway so a busy mailbox cannot wedge a run.
_FETCH_BATCH = 100


class MailboxError(RuntimeError):
    """Raised when the IMAP server rejects a command."""


@dataclass
class FetchedMessage:
    uid: str
    folder: str
    message: Message

    @property
    def message_id(self) -> str:
        raw = (self.message.get("Message-ID") or "").strip()
        return raw or f"<no-message-id:{self.folder}:{self.uid}>"

    @property
    def sender(self) -> str:
        return decode_mime(self.message.get("From") or "")

    @property
    def subject(self) -> str:
        return decode_mime(self.message.get("Subject") or "")

    @property
    def sent_at(self) -> str | None:
        raw = self.message.get("Date")
        if not raw:
            return None
        try:
            return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat(timespec="seconds")
        except (TypeError, ValueError):
            return None


def decode_mime(value: str) -> str:
    """Decode an RFC 2047 encoded header into plain text."""
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except (UnicodeDecodeError, LookupError, ValueError):
        return value


def _quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


class Mailbox:
    def __init__(self, host: str, port: int, user: str, password: str):
        self._host, self._port = host, port
        self._user, self._password = user, password
        self.imap: imaplib.IMAP4_SSL | None = None
        self._selected: tuple[str, bool] | None = None

    # -- lifecycle -----------------------------------------------------

    def connect(self) -> None:
        self.imap = imaplib.IMAP4_SSL(self._host, self._port)
        try:
            self.imap.login(self._user, self._password)
        except imaplib.IMAP4.error as exc:
            raise MailboxError(
                f"IMAP login failed for {self._user}: {exc}. "
                "For Gmail this needs 2FA plus an App Password, and IMAP enabled "
                "in Settings > Forwarding and POP/IMAP."
            ) from exc

    def close(self) -> None:
        if self.imap is None:
            return
        try:
            if self._selected is not None:
                self.imap.close()
            self.imap.logout()
        except (imaplib.IMAP4.error, OSError):
            pass
        finally:
            self.imap, self._selected = None, None

    def __enter__(self) -> "Mailbox":
        self.connect()
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _require(self) -> imaplib.IMAP4_SSL:
        if self.imap is None:
            raise MailboxError("mailbox is not connected")
        return self.imap

    # -- folders -------------------------------------------------------

    def list_folders(self) -> list[str]:
        imap = self._require()
        typ, data = imap.list()
        if typ != "OK":
            raise MailboxError(f"LIST failed: {typ}")
        names = []
        for raw in data:
            if not raw:
                continue
            line = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else str(raw)
            match = re.search(r'"?([^"]+)"?$', line.strip())
            if match:
                names.append(match.group(1))
        return names

    def select(self, folder: str, readonly: bool = True) -> bool:
        """Select a folder. Returns False if it does not exist on this server."""
        imap = self._require()
        if self._selected == (folder, readonly):
            return True
        if self._selected is not None:
            try:
                imap.close()
            except imaplib.IMAP4.error:
                pass
            self._selected = None
        typ, _ = imap.select(_quote(folder), readonly=readonly)
        if typ != "OK":
            return False
        self._selected = (folder, readonly)
        return True

    # -- search and fetch ----------------------------------------------

    def search(self, folder: str, raw_query: str | None, since_days: int) -> list[str]:
        """UIDs in `folder` matching `raw_query`, limited to the last `since_days`.

        With a raw query the date limit is expressed in Gmail syntax so the whole
        thing evaluates server-side as one expression; without one it falls back
        to the standard IMAP SINCE criterion.
        """
        imap = self._require()
        if not self.select(folder, readonly=True):
            return []

        if raw_query is not None:
            query = f"{raw_query} newer_than:{since_days}d".strip()
            typ, data = imap.uid("SEARCH", None, "X-GM-RAW", _quote(query))
        else:
            since = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%d-%b-%Y")
            typ, data = imap.uid("SEARCH", None, "SINCE", since)

        if typ != "OK" or not data or data[0] is None:
            return []
        return data[0].decode().split()

    def fetch_headers(self, folder: str, uids: Iterable[str]) -> list[FetchedMessage]:
        return self._fetch(folder, uids, "(BODY.PEEK[HEADER])")

    def fetch_full(self, folder: str, uids: Iterable[str]) -> list[FetchedMessage]:
        return self._fetch(folder, uids, "(BODY.PEEK[])")

    def _fetch(self, folder: str, uids: Iterable[str], spec: str) -> list[FetchedMessage]:
        imap = self._require()
        uid_list = list(uids)
        if not uid_list or not self.select(folder, readonly=True):
            return []

        out: list[FetchedMessage] = []
        for start in range(0, len(uid_list), _FETCH_BATCH):
            batch = uid_list[start : start + _FETCH_BATCH]
            typ, data = imap.uid("FETCH", ",".join(batch), spec)
            if typ != "OK" or not data:
                continue
            # Responses interleave metadata tuples with literal payloads; only the
            # tuples carry the message bytes, and their order matches the request.
            payloads = [part[1] for part in data if isinstance(part, tuple) and len(part) > 1]
            for uid, payload in zip(batch, payloads):
                if not payload:
                    continue
                out.append(
                    FetchedMessage(
                        uid=uid,
                        folder=folder,
                        message=email.message_from_bytes(payload),
                    )
                )
        return out

    def mark_read(self, folder: str, uid: str) -> bool:
        """Set \\Seen on a message -- the mailbox-level meaning of 'opened'."""
        imap = self._require()
        if not self.select(folder, readonly=False):
            return False
        typ, _ = imap.uid("STORE", uid, "+FLAGS", "(\\Seen)")
        return typ == "OK"
