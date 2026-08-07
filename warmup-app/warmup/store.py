"""SQLite persistence.

One row per message, many observations per message. Placement is re-observed on
every sweep because it changes: Gmail moves mail between tabs, and a message
that first landed in spam can be reclassified later.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from .authcheck import AuthResult
from .placement import Placement

SCHEMA = """
CREATE TABLE IF NOT EXISTS subscriptions (
    site_key      TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    signup_url    TEXT NOT NULL,
    status        TEXT NOT NULL,           -- pending | confirmed | failed | manual
    detail        TEXT,
    attempted_at  TEXT NOT NULL,
    confirmed_at  TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id    TEXT NOT NULL UNIQUE,
    site_key      TEXT,
    sender        TEXT,
    subject       TEXT,
    sent_at       TEXT,
    first_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_site ON messages(site_key);

CREATE TABLE IF NOT EXISTS observations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id  TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    placement   TEXT NOT NULL,
    spf         TEXT,
    dkim        TEXT,
    dmarc       TEXT,
    sending_ip  TEXT,
    UNIQUE(message_id, observed_at)
);
CREATE INDEX IF NOT EXISTS idx_obs_message ON observations(message_id);

CREATE TABLE IF NOT EXISTS engagements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    acted_at   TEXT NOT NULL,
    url        TEXT,
    dwell_ms   INTEGER,
    pages      INTEGER,
    ok         INTEGER NOT NULL,
    error      TEXT
);
CREATE INDEX IF NOT EXISTS idx_eng_message ON engagements(message_id);
"""


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> "Store":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- subscriptions -------------------------------------------------

    def record_subscription(
        self, site_key: str, name: str, signup_url: str, status: str, detail: str = ""
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO subscriptions (site_key, name, signup_url, status, detail, attempted_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(site_key) DO UPDATE SET
                status = excluded.status,
                detail = excluded.detail,
                attempted_at = excluded.attempted_at
            """,
            (site_key, name, signup_url, status, detail, utcnow()),
        )
        self.conn.commit()

    def mark_confirmed(self, site_key: str) -> None:
        self.conn.execute(
            "UPDATE subscriptions SET status = 'confirmed', confirmed_at = ? WHERE site_key = ?",
            (utcnow(), site_key),
        )
        self.conn.commit()

    def subscriptions(self) -> list[sqlite3.Row]:
        return list(self.conn.execute("SELECT * FROM subscriptions ORDER BY site_key"))

    # -- messages and observations -------------------------------------

    def upsert_message(
        self,
        message_id: str,
        site_key: str | None,
        sender: str,
        subject: str,
        sent_at: str | None,
    ) -> bool:
        """Insert a message if new. Returns True when it had not been seen before."""
        cur = self.conn.execute(
            """
            INSERT INTO messages (message_id, site_key, sender, subject, sent_at, first_seen_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(message_id) DO NOTHING
            """,
            (message_id, site_key, sender, subject, sent_at, utcnow()),
        )
        self.conn.commit()
        return cur.rowcount > 0

    def record_observation(
        self, message_id: str, placement: Placement, auth: AuthResult, observed_at: str | None = None
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO observations
                (message_id, observed_at, placement, spf, dkim, dmarc, sending_ip)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(message_id, observed_at) DO UPDATE SET
                placement = excluded.placement
            """,
            (
                message_id,
                observed_at or utcnow(),
                placement.value,
                auth.spf,
                auth.dkim,
                auth.dmarc,
                auth.sending_ip,
            ),
        )
        self.conn.commit()

    def latest_observations(self, since_iso: str) -> list[sqlite3.Row]:
        """Most recent observation per message, for messages first seen since `since_iso`."""
        return list(
            self.conn.execute(
                """
                SELECT m.message_id, m.site_key, m.sender, m.subject, m.sent_at,
                       m.first_seen_at, o.placement, o.spf, o.dkim, o.dmarc, o.sending_ip,
                       o.observed_at
                FROM messages m
                JOIN observations o ON o.message_id = m.message_id
                WHERE m.first_seen_at >= ?
                  AND o.observed_at = (
                      SELECT MAX(observed_at) FROM observations WHERE message_id = m.message_id
                  )
                ORDER BY m.sent_at DESC, m.first_seen_at DESC
                """,
                (since_iso,),
            )
        )

    def messages_without_engagement(self, since_iso: str) -> list[sqlite3.Row]:
        return list(
            self.conn.execute(
                """
                SELECT m.* FROM messages m
                LEFT JOIN engagements e ON e.message_id = m.message_id AND e.ok = 1
                WHERE m.first_seen_at >= ? AND e.id IS NULL
                ORDER BY m.first_seen_at
                """,
                (since_iso,),
            )
        )

    # -- engagement ----------------------------------------------------

    def record_engagement(
        self,
        message_id: str,
        url: str | None,
        dwell_ms: int,
        pages: int,
        ok: bool,
        error: str = "",
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO engagements (message_id, acted_at, url, dwell_ms, pages, ok, error)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (message_id, utcnow(), url, dwell_ms, pages, 1 if ok else 0, error),
        )
        self.conn.commit()


@contextmanager
def open_store(path: Path | str) -> Iterator[Store]:
    store = Store(path)
    try:
        yield store
    finally:
        store.close()
