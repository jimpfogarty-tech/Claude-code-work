import email

import pytest

from warmup.config import Site
from warmup.mailbox import FetchedMessage
from warmup.placement import Placement
from warmup.store import Store
from warmup.sweep import run_sweep

SETTINGS = {
    "mailbox": {
        "lookback_days": 3,
        "folders": {
            "inbox": "INBOX",
            "spam": "[Gmail]/Spam",
            "trash": "[Gmail]/Trash",
            "all_mail": "[Gmail]/All Mail",
        },
        "use_gmail_categories": True,
    }
}

SITES = [
    Site(key="brand", name="Brand", signup_url="https://brand.com", senders=("@email.brand.com",)),
    Site(key="other", name="Other", signup_url="https://other.com", senders=("@email.other.com",)),
]


def make_message(message_id: str, sender: str, subject: str, spf: str = "pass"):
    raw = (
        f"Message-ID: {message_id}\n"
        f"From: Brand <{sender}>\n"
        f"Subject: {subject}\n"
        "Date: Tue, 04 Aug 2026 09:00:00 -0400\n"
        f"Authentication-Results: mx.google.com; spf={spf}; dkim=pass; dmarc=pass\n"
        "\nbody\n"
    )
    return email.message_from_string(raw)


class FakeMailbox:
    """Returns canned results keyed by (folder, raw_query)."""

    def __init__(self, contents):
        self.contents = contents
        self.marked_read = []

    def search(self, folder, raw_query, since_days):
        return [uid for uid, _ in self.contents.get((folder, raw_query), [])]

    def fetch_headers(self, folder, uids):
        wanted = set(uids)
        out = []
        for (f, _), items in self.contents.items():
            if f != folder:
                continue
            for uid, msg in items:
                if uid in wanted:
                    out.append(FetchedMessage(uid=uid, folder=folder, message=msg))
        return out

    def fetch_full(self, folder, uids):
        return self.fetch_headers(folder, uids)

    def mark_read(self, folder, uid):
        self.marked_read.append((folder, uid))
        return True


@pytest.fixture()
def store(tmp_path):
    with Store(tmp_path / "sweep.db") as s:
        yield s


def test_records_placement_per_bucket(store):
    mailbox = FakeMailbox(
        {
            ("[Gmail]/Spam", None): [("1", make_message("<s@x>", "news@email.brand.com", "Spammed"))],
            ("INBOX", "category:promotions"): [
                ("2", make_message("<p@x>", "news@email.brand.com", "Promo"))
            ],
        }
    )
    result = run_sweep(mailbox, store, SITES, SETTINGS)

    by_id = {r.message_id: r.placement for r in result.records}
    assert by_id["<s@x>"] is Placement.SPAM
    assert by_id["<p@x>"] is Placement.INBOX_PROMOTIONS


def test_first_bucket_wins_for_a_duplicated_message(store):
    # A Promotions message also matches the bare in:inbox query used for Primary.
    msg = make_message("<p@x>", "news@email.brand.com", "Promo")
    mailbox = FakeMailbox(
        {
            ("INBOX", "category:promotions"): [("2", msg)],
            ("INBOX", None): [("2", msg)],
        }
    )
    result = run_sweep(mailbox, store, SITES, SETTINGS)

    assert len(result.records) == 1
    assert result.records[0].placement is Placement.INBOX_PROMOTIONS


def test_untracked_senders_are_ignored(store):
    mailbox = FakeMailbox(
        {("INBOX", None): [("9", make_message("<n@x>", "friend@gmail.com", "Lunch?"))]}
    )
    result = run_sweep(mailbox, store, SITES, SETTINGS)
    assert result.records == []


def test_silent_sites_are_reported(store):
    mailbox = FakeMailbox(
        {("INBOX", None): [("1", make_message("<a@x>", "news@email.brand.com", "Hi"))]}
    )
    result = run_sweep(mailbox, store, SITES, SETTINGS)
    assert [s.key for s in result.silent_sites] == ["other"]


def test_new_flag_only_set_on_first_sighting(store):
    mailbox = FakeMailbox(
        {("INBOX", None): [("1", make_message("<a@x>", "news@email.brand.com", "Hi"))]}
    )
    assert len(run_sweep(mailbox, store, SITES, SETTINGS).new_records) == 1
    assert len(run_sweep(mailbox, store, SITES, SETTINGS).new_records) == 0


def test_auth_failure_is_captured(store):
    mailbox = FakeMailbox(
        {("INBOX", None): [("1", make_message("<a@x>", "news@email.brand.com", "Hi", spf="fail"))]}
    )
    record = run_sweep(mailbox, store, SITES, SETTINGS).records[0]
    assert not record.auth.all_pass
    assert record.auth.failures() == ["spf"]


def test_folder_error_does_not_abort_the_sweep(store):
    class Exploding(FakeMailbox):
        def search(self, folder, raw_query, since_days):
            if folder == "[Gmail]/Spam":
                raise RuntimeError("folder missing")
            return super().search(folder, raw_query, since_days)

    mailbox = Exploding(
        {("INBOX", None): [("1", make_message("<a@x>", "news@email.brand.com", "Hi"))]}
    )
    result = run_sweep(mailbox, store, SITES, SETTINGS)
    assert len(result.records) == 1
    assert len(result.errors) == 1
    assert "folder missing" in result.errors[0]
