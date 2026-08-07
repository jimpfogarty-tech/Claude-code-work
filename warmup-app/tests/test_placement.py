from warmup.placement import Placement, buckets_for, inbox_rate, resolve, spam_rate


def test_spam_wins_over_inbox():
    assert resolve({Placement.SPAM, Placement.INBOX_PRIMARY}) is Placement.SPAM


def test_promotions_wins_over_primary():
    # A Promotions message also satisfies a bare in:inbox search, so the more
    # specific bucket must take precedence.
    assert resolve({Placement.INBOX_PROMOTIONS, Placement.INBOX_PRIMARY}) is Placement.INBOX_PROMOTIONS


def test_empty_is_missing():
    assert resolve(set()) is Placement.MISSING


def test_is_inbox_flags():
    assert Placement.INBOX_PROMOTIONS.is_inbox
    assert Placement.INBOX_PRIMARY.is_inbox
    assert not Placement.SPAM.is_inbox
    assert not Placement.ARCHIVED.is_inbox


def test_buckets_check_spam_first():
    order = [b.placement for b in buckets_for({})]
    assert order[0] is Placement.SPAM
    assert order.index(Placement.INBOX_PROMOTIONS) < order.index(Placement.INBOX_PRIMARY)


def test_buckets_without_categories_are_simple():
    order = [b.placement for b in buckets_for({}, use_categories=False)]
    assert Placement.INBOX_PROMOTIONS not in order
    assert Placement.INBOX_PRIMARY in order


def test_rates_exclude_missing():
    placements = [
        Placement.INBOX_PRIMARY,
        Placement.INBOX_PROMOTIONS,
        Placement.SPAM,
        Placement.MISSING,
    ]
    # 3 delivered: 2 inbox, 1 spam. The MISSING message is a separate failure and
    # must not dilute either rate.
    assert spam_rate(placements) == 1 / 3
    assert inbox_rate(placements) == 2 / 3


def test_rates_with_no_delivered_mail():
    assert spam_rate([Placement.MISSING]) == 0.0
    assert inbox_rate([]) == 0.0
