"""The daily placement sweep: find today's mail and record where it landed."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .authcheck import AuthResult, parse_auth_results
from .config import Site
from .mailbox import FetchedMessage, Mailbox
from .placement import Placement, buckets_for
from .store import Store


@dataclass
class SweepRecord:
    message_id: str
    site: Site | None
    sender: str
    subject: str
    sent_at: str | None
    placement: Placement
    auth: AuthResult
    folder: str
    uid: str
    is_new: bool = False


@dataclass
class SweepResult:
    records: list[SweepRecord] = field(default_factory=list)
    silent_sites: list[Site] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def new_records(self) -> list[SweepRecord]:
        return [r for r in self.records if r.is_new]


def _match_site(sender: str, sites: list[Site]) -> Site | None:
    for site in sites:
        if site.matches_sender(sender):
            return site
    return None


def run_sweep(
    mailbox: Mailbox, store: Store, sites: list[Site], settings: dict[str, Any]
) -> SweepResult:
    """Walk every placement bucket and record the current location of each message.

    Buckets are visited in resolution order and the first one containing a given
    message wins, so a Promotions message is not also counted as generic inbox.
    """
    mail_cfg = settings.get("mailbox", {})
    lookback = int(mail_cfg.get("lookback_days", 3))
    folders = mail_cfg.get("folders", {})
    use_categories = bool(mail_cfg.get("use_gmail_categories", True))

    result = SweepResult()
    claimed: set[str] = set()

    for bucket in buckets_for(folders, use_categories):
        try:
            uids = mailbox.search(bucket.folder, bucket.raw_query, lookback)
            fetched = mailbox.fetch_headers(bucket.folder, uids)
        except Exception as exc:  # noqa: BLE001 - one bad folder must not kill the sweep
            result.errors.append(f"{bucket.placement.value} ({bucket.folder}): {exc}")
            continue

        for item in fetched:
            record = _build_record(item, bucket.placement, bucket.folder, sites, claimed)
            if record is None:
                continue
            claimed.add(record.message_id)
            record.is_new = store.upsert_message(
                record.message_id,
                record.site.key if record.site else None,
                record.sender,
                record.subject,
                record.sent_at,
            )
            store.record_observation(record.message_id, record.placement, record.auth)
            result.records.append(record)

    seen_keys = {r.site.key for r in result.records if r.site}
    result.silent_sites = [s for s in sites if s.key not in seen_keys]
    return result


def _build_record(
    item: FetchedMessage,
    placement: Placement,
    folder: str,
    sites: list[Site],
    claimed: set[str],
) -> SweepRecord | None:
    message_id = item.message_id
    if message_id in claimed:
        return None

    site = _match_site(item.sender, sites)
    if site is None:
        # Mail from outside the tracked programs is ignored rather than stored.
        # The seed mailbox will accumulate unrelated traffic and it should not
        # dilute the placement statistics.
        return None

    return SweepRecord(
        message_id=message_id,
        site=site,
        sender=item.sender,
        subject=item.subject,
        sent_at=item.sent_at,
        placement=placement,
        auth=parse_auth_results(item.message),
        folder=folder,
        uid=item.uid,
    )
