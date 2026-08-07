from datetime import date

from warmup.rampplan import build_plan, render_markdown

CFG = {
    "start_volume": 200,
    "growth_factor": 1.6,
    "days_per_step": 2,
    "max_daily": 250000,
    "engagement_tiers": [
        {"name": "30-day engaged", "recency_days": 30},
        {"name": "90-day engaged", "recency_days": 90},
        {"name": "365-day active", "recency_days": 365},
    ],
    "gates": {"complaint_rate_max": 0.001},
}


def test_ramp_starts_small_and_ends_at_list_size():
    plan = build_plan(50_000, CFG, start_date=date(2026, 8, 10))
    assert plan.days[0].volume == 200
    assert plan.days[-1].volume == 50_000
    assert plan.steady_state_volume == 50_000


def test_volume_never_decreases():
    plan = build_plan(50_000, CFG, start_date=date(2026, 8, 10))
    volumes = [d.volume for d in plan.days]
    assert volumes == sorted(volumes)


def test_each_step_lasts_days_per_step():
    plan = build_plan(50_000, CFG, start_date=date(2026, 8, 10))
    for step in {d.step for d in plan.days}:
        assert sum(1 for d in plan.days if d.step == step) == CFG["days_per_step"]


def test_days_are_consecutive():
    plan = build_plan(10_000, CFG, start_date=date(2026, 8, 10))
    assert plan.days[0].send_date == date(2026, 8, 10)
    for earlier, later in zip(plan.days, plan.days[1:]):
        assert (later.send_date - earlier.send_date).days == 1
        assert later.day == earlier.day + 1


def test_audience_widens_over_the_ramp():
    plan = build_plan(50_000, CFG, start_date=date(2026, 8, 10))
    recency = [d.recency_days for d in plan.days]
    assert recency == sorted(recency)
    assert recency[0] == 30
    assert recency[-1] == 365


def test_max_daily_caps_the_ramp():
    plan = build_plan(1_000_000, {**CFG, "max_daily": 5_000}, start_date=date(2026, 8, 10))
    assert max(d.volume for d in plan.days) == 5_000
    assert plan.steady_state_volume == 5_000


def test_list_smaller_than_start_volume_is_a_single_step():
    plan = build_plan(50, CFG, start_date=date(2026, 8, 10))
    assert {d.volume for d in plan.days} == {50}


def test_non_growing_factor_still_terminates():
    # A misconfigured growth factor of 1.0 would loop forever without the guard.
    plan = build_plan(205, {**CFG, "growth_factor": 1.0}, start_date=date(2026, 8, 10))
    assert plan.days[-1].volume == 205


def test_markdown_contains_the_key_sections():
    text = render_markdown(build_plan(50_000, CFG, start_date=date(2026, 8, 10)))
    for heading in (
        "# Sending-domain warm-up ramp",
        "## Daily schedule",
        "## Advancement gates",
        "## Authentication, before day 1",
        "## DMARC enforcement progression",
        "## List hygiene",
    ):
        assert heading in text
