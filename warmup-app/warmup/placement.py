"""Where a message landed: spam, which inbox tab, archived, or never arrived.

Gmail's tabs (Primary/Promotions/Updates/Social/Forums) are not IMAP folders --
they are search-time categories. So placement is resolved by running a set of
Gmail search queries via the X-GM-RAW IMAP extension and seeing which bucket the
message turns up in, rather than by walking folders.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Placement(str, Enum):
    INBOX_PRIMARY = "inbox_primary"
    INBOX_PROMOTIONS = "inbox_promotions"
    INBOX_UPDATES = "inbox_updates"
    INBOX_SOCIAL = "inbox_social"
    INBOX_FORUMS = "inbox_forums"
    SPAM = "spam"
    TRASH = "trash"
    ARCHIVED = "archived"
    MISSING = "missing"

    @property
    def is_inbox(self) -> bool:
        return self.value.startswith("inbox_")

    @property
    def label(self) -> str:
        return _LABELS[self]


_LABELS = {
    Placement.INBOX_PRIMARY: "Inbox / Primary",
    Placement.INBOX_PROMOTIONS: "Inbox / Promotions",
    Placement.INBOX_UPDATES: "Inbox / Updates",
    Placement.INBOX_SOCIAL: "Inbox / Social",
    Placement.INBOX_FORUMS: "Inbox / Forums",
    Placement.SPAM: "Spam",
    Placement.TRASH: "Trash",
    Placement.ARCHIVED: "Archived (no inbox)",
    Placement.MISSING: "Never arrived",
}


@dataclass(frozen=True)
class Bucket:
    """One searchable location, and how to search it."""

    placement: Placement
    folder: str
    # Gmail search expression for X-GM-RAW, or None for a plain folder listing.
    raw_query: str | None


# Resolution order matters. A message can satisfy more than one query -- a
# Promotions message also matches a bare in:inbox search -- so the first bucket
# that contains it wins. Spam and Trash are checked first because they are the
# outcomes that matter most and are unambiguous.
def buckets_for(folders: dict[str, str], use_categories: bool = True) -> list[Bucket]:
    inbox = folders.get("inbox", "INBOX")
    spam = folders.get("spam", "[Gmail]/Spam")
    trash = folders.get("trash", "[Gmail]/Trash")
    all_mail = folders.get("all_mail", "[Gmail]/All Mail")

    ordered: list[Bucket] = [
        Bucket(Placement.SPAM, spam, None),
        Bucket(Placement.TRASH, trash, None),
    ]

    if use_categories:
        ordered += [
            Bucket(Placement.INBOX_PROMOTIONS, inbox, "category:promotions"),
            Bucket(Placement.INBOX_UPDATES, inbox, "category:updates"),
            Bucket(Placement.INBOX_SOCIAL, inbox, "category:social"),
            Bucket(Placement.INBOX_FORUMS, inbox, "category:forums"),
            # Anything still in the inbox after the named tabs is Primary. Gmail
            # only reports category:primary when tabs are enabled, so this is
            # resolved by elimination instead.
            Bucket(Placement.INBOX_PRIMARY, inbox, None),
            Bucket(Placement.ARCHIVED, all_mail, "-in:inbox -in:spam -in:trash"),
        ]
    else:
        ordered += [
            Bucket(Placement.INBOX_PRIMARY, inbox, None),
            Bucket(Placement.ARCHIVED, all_mail, None),
        ]

    return ordered


def resolve(found_in: set[Placement]) -> Placement:
    """Collapse every bucket a message appeared in down to a single placement."""
    if not found_in:
        return Placement.MISSING
    for bucket in buckets_for({}):
        if bucket.placement in found_in:
            return bucket.placement
    return Placement.MISSING


def spam_rate(placements: list[Placement]) -> float:
    """Share of delivered messages that landed in spam.

    Messages that never arrived are excluded: they are a separate failure
    (blocked or suppressed), and folding them in would understate the spam rate
    among mail that actually got through.
    """
    delivered = [p for p in placements if p is not Placement.MISSING]
    if not delivered:
        return 0.0
    return sum(1 for p in delivered if p is Placement.SPAM) / len(delivered)


def inbox_rate(placements: list[Placement]) -> float:
    delivered = [p for p in placements if p is not Placement.MISSING]
    if not delivered:
        return 0.0
    return sum(1 for p in delivered if p.is_inbox) / len(delivered)
