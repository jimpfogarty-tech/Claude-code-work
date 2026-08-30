from datetime import datetime, timedelta, timezone

import pytest

from warmup.authcheck import AuthResult
from warmup.placement import Placement
from warmup.store import Store

AUTH = AuthResult(spf="pass", dkim="pass", dmarc="pass", sending_ip="198.51.100.1")


@pytest.fixture()
def store(tmp_path):
    with Store(tmp_path / "test.db") as s:
        yield s


def test_upsert_reports_new_only_once(store):
    assert store.upsert_message("<a@x>", "brand", "n@brand.com", "Hi", None) is True
    assert store.upsert_message("<a@x>", "brand", "n@brand.com", "Hi", None) is False


def test_latest_observation_wins(store):
    store.upsert_message("<a@x>", "brand", "n@brand.com", "Hi", None)
    store.record_observation("<a@x>", Placement.SPAM, AUTH, observed_at="2026-08-01T00:00:00+00:00")
    store.record_observation(
        "<a@x>", Placement.INBOX_PRIMARY, AUTH, observed_at="2026-08-02T00:00:00+00:00"
    )

    rows = store.latest_observations("2000-01-01T00:00:00+00:00")
    assert len(rows) == 1
    assert rows[0]["placement"] == Placement.INBOX_PRIMARY.value


def test_reobserving_at_same_timestamp_updates_in_place(store):
    store.upsert_message("<a@x>", "brand", "n@brand.com", "Hi", None)
    stamp = "2026-08-01T00:00:00+00:00"
    store.record_observation("<a@x>", Placement.SPAM, AUTH, observed_at=stamp)
    store.record_observation("<a@x>", Placement.INBOX_PRIMARY, AUTH, observed_at=stamp)

    rows = store.latest_observations("2000-01-01T00:00:00+00:00")
    assert len(rows) == 1
    assert rows[0]["placement"] == Placement.INBOX_PRIMARY.value


def test_observations_window_filters_by_first_seen(store):
    old = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(timespec="seconds")
    store.upsert_message("<old@x>", "brand", "n@brand.com", "Old", old)
    store.record_observation("<old@x>", Placement.INBOX_PRIMARY, AUTH)

    recent_cutoff = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(timespec="seconds")
    assert store.latest_observations(recent_cutoff) == []


def test_messages_without_engagement_excludes_successful_ones(store):
    store.upsert_message("<a@x>", "brand", "n@brand.com", "A", None)
    store.upsert_message("<b@x>", "brand", "n@brand.com", "B", None)
    store.record_engagement("<a@x>", "https://brand.com", 45000, 2, True)

    pending = {r["message_id"] for r in store.messages_without_engagement("2000-01-01T00:00:00+00:00")}
    assert pending == {"<b@x>"}


def test_failed_engagement_leaves_message_pending(store):
    # A failed attempt should be retried on the next run, not treated as done.
    store.upsert_message("<a@x>", "brand", "n@brand.com", "A", None)
    store.record_engagement("<a@x>", None, 0, 0, False, "timeout")

    pending = {r["message_id"] for r in store.messages_without_engagement("2000-01-01T00:00:00+00:00")}
    assert pending == {"<a@x>"}


def test_subscription_status_transitions(store):
    store.record_subscription("brand", "Brand", "https://brand.com", "pending", "submitted")
    store.mark_confirmed("brand")
    row = store.subscriptions()[0]
    assert row["status"] == "confirmed"
    assert row["confirmed_at"] is not None


def test_subscription_upsert_does_not_duplicate(store):
    store.record_subscription("brand", "Brand", "https://brand.com", "pending", "one")
    store.record_subscription("brand", "Brand", "https://brand.com", "failed", "two")
    rows = store.subscriptions()
    assert len(rows) == 1
    assert rows[0]["status"] == "failed"
