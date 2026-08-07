"""Generate a sending-domain warm-up ramp.

This is the module that actually improves sender reputation. Mailbox providers
build reputation from the behaviour of the *sending* domain and IP: volume
consistency, bounce rate, complaint rate, authentication, and how recipients
react. None of that is influenced by a seed mailbox opening its own mail.

The ramp works by starting with the audience most likely to engage positively
and widening only while the quality gates hold.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any


@dataclass(frozen=True)
class RampDay:
    day: int
    send_date: date
    volume: int
    tier_name: str
    recency_days: int
    step: int


@dataclass(frozen=True)
class RampPlan:
    days: list[RampDay]
    list_size: int
    gates: dict[str, float]
    steady_state_volume: int

    @property
    def total_days(self) -> int:
        return len(self.days)

    @property
    def total_sends(self) -> int:
        return sum(d.volume for d in self.days)


def _step_volumes(start: int, growth: float, target: int) -> list[int]:
    """Volume for each step of the ramp, ending exactly on `target`."""
    if target <= start:
        return [target]
    volumes: list[int] = []
    v = start
    while v < target:
        volumes.append(v)
        nxt = math.ceil(v * growth)
        # A growth factor at or below 1.0 would never converge.
        v = nxt if nxt > v else v + 1
    volumes.append(target)
    return volumes


def build_plan(
    list_size: int, cfg: dict[str, Any], start_date: date | None = None
) -> RampPlan:
    start_volume = int(cfg.get("start_volume", 200))
    growth = float(cfg.get("growth_factor", 1.6))
    days_per_step = max(1, int(cfg.get("days_per_step", 2)))
    max_daily = int(cfg.get("max_daily", 250_000))
    tiers = list(cfg.get("engagement_tiers") or [{"name": "all", "recency_days": 365}])
    gates = dict(cfg.get("gates") or {})
    start_date = start_date or date.today()

    target = max(1, min(max_daily, list_size))
    volumes = _step_volumes(min(start_volume, target), growth, target)

    days: list[RampDay] = []
    day_number = 1
    for step_index, volume in enumerate(volumes):
        # Widen the audience in step with ramp progress: the earliest steps go
        # only to the most recently engaged, the last steps reach everyone active.
        tier_index = min(len(tiers) - 1, int(step_index / len(volumes) * len(tiers)))
        tier = tiers[tier_index]
        for _ in range(days_per_step):
            days.append(
                RampDay(
                    day=day_number,
                    send_date=start_date + timedelta(days=day_number - 1),
                    volume=volume,
                    tier_name=str(tier.get("name", "unknown")),
                    recency_days=int(tier.get("recency_days", 365)),
                    step=step_index + 1,
                )
            )
            day_number += 1

    return RampPlan(days=days, list_size=list_size, gates=gates, steady_state_volume=target)


def render_markdown(plan: RampPlan) -> str:
    g = plan.gates
    lines: list[str] = []
    lines.append("# Sending-domain warm-up ramp\n")
    lines.append(
        f"List size **{plan.list_size:,}** · ramp length **{plan.total_days} days** · "
        f"steady state **{plan.steady_state_volume:,}/day**\n"
    )

    lines.append("## Why this and not seed-mailbox clicking\n")
    lines.append(
        "Reputation is scored against the sending domain and IP, not the recipient "
        "account. Providers weigh volume consistency, bounce rate, complaint rate, "
        "authentication, and aggregate recipient behaviour across their whole user "
        "base. A seed mailbox opening its own mail contributes one data point to a "
        "population of millions, and engagement originating from a datacenter IP is "
        "routinely filtered as non-human before it reaches those models. The ramp "
        "below is the mechanism that moves reputation.\n"
    )

    lines.append("## Daily schedule\n")
    lines.append("| Day | Date | Volume | Audience |")
    lines.append("|----:|------|-------:|----------|")
    for d in plan.days:
        lines.append(
            f"| {d.day} | {d.send_date.isoformat()} | {d.volume:,} | "
            f"{d.tier_name} (opened/clicked within {d.recency_days}d) |"
        )
    lines.append("")

    lines.append("## Advancement gates\n")
    lines.append(
        "Check these before every step up. If any gate is breached, **hold volume "
        "flat** until it recovers — never step up through a breach, and drop back "
        "one step if it persists for two consecutive sends.\n"
    )
    lines.append("| Metric | Threshold |")
    lines.append("|--------|-----------|")
    lines.append(f"| Hard bounce rate | below {g.get('hard_bounce_rate_max', 0.01):.2%} |")
    lines.append(f"| Total bounce rate | below {g.get('total_bounce_rate_max', 0.02):.2%} |")
    lines.append(f"| Complaint rate | below {g.get('complaint_rate_max', 0.001):.3%} |")
    lines.append(f"| Delivery rate | above {g.get('delivery_rate_min', 0.95):.2%} |")
    lines.append("")
    lines.append(
        "Gmail's published limit for bulk senders is a 0.30% spam rate, with 0.10% "
        "as the level to stay under day to day. The 0.10% gate above is deliberately "
        "tighter so a bad send is caught before it reaches the level that triggers "
        "throttling.\n"
    )

    lines.append("## Authentication, before day 1\n")
    lines.append(
        "Bulk senders to Gmail and Yahoo must have all of this in place. Missing any "
        "of it caps reputation no matter how clean the ramp is.\n"
    )
    lines.append("- **SPF** record published, and the sending source included in it.")
    lines.append("- **DKIM** signing enabled, 2048-bit, on a domain aligned with the From header.")
    lines.append("- **DMARC** record published — start at `p=none` with `rua` reporting on.")
    lines.append("- **Forward and reverse DNS (PTR)** matching for every sending IP.")
    lines.append("- **TLS** on outbound connections.")
    lines.append(
        "- **One-click unsubscribe**: `List-Unsubscribe` plus `List-Unsubscribe-Post` "
        "headers, honoured within two days."
    )
    lines.append("")

    lines.append("## DMARC enforcement progression\n")
    lines.append(
        "Tighten only after `rua` aggregate reports show all legitimate sources "
        "passing, otherwise enforcement will start discarding real mail.\n"
    )
    third = max(1, plan.total_days // 3)
    lines.append("| From | Policy |")
    lines.append("|------|--------|")
    lines.append("| Day 1 | `p=none; rua=mailto:dmarc@yourdomain` |")
    lines.append(f"| Day {third} | `p=quarantine; pct=25` |")
    lines.append(f"| Day {third * 2} | `p=quarantine; pct=100` |")
    lines.append(f"| Day {plan.total_days} + 30 | `p=reject` |")
    lines.append("")

    lines.append("## Monitoring\n")
    lines.append(
        "- **Google Postmaster Tools** — the only direct read on Gmail's view of your "
        "domain reputation, spam rate, and authentication. Verify the domain before day 1 "
        "so the ramp has baseline data."
    )
    lines.append(
        "- **Microsoft SNDS and JMRP** — IP-level complaint and trap data for Outlook/Hotmail."
    )
    lines.append("- **DMARC aggregate reports** — catches unauthenticated sources you forgot about.")
    lines.append(
        "- **`warmup sweep` in this repo** — independent placement evidence from a seed "
        "mailbox, which is what Postmaster Tools cannot give you at the per-campaign level."
    )
    lines.append("")

    lines.append("## List hygiene, which matters more than the ramp\n")
    lines.append(
        "- Suppress anyone with no open or click in 365 days before you start. "
        "Unengaged recipients are the single largest source of spam-folder placement."
    )
    lines.append("- Remove hard bounces immediately and permanently.")
    lines.append("- Never send to a purchased or appended list — spam traps end the ramp outright.")
    lines.append(
        "- Keep cadence steady. Providers read volume spikes and long gaps as compromise "
        "signals, so an even daily volume beats a larger but erratic one."
    )
    lines.append("")

    return "\n".join(lines)
