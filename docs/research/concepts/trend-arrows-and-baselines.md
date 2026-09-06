---
title: Trend Arrows and Baselines
type: concept
updated: 2026-09-06
tags: [goals, me, technique]
related:
  - ../entities/exist-io.md
  - idempotent-daily-recompute.md
  - ../../features/goal-engine.md
sources:
  - raw/articles/2026-09-06-lifegoal-prior-art-research.md
  - raw/articles/2026-09-06-lifegoal-engine-prior-art-research.md
confidence: medium
contradictions: []
---

# Trend Arrows and Baselines

Four products turn heterogeneous daily signals into a single honest direction. All four converge on
the same load-bearing rule, and mezo's own trend arrow (`LifeGoalScorer.arrow`, see
[`lifegoal.md`](../../features/lifegoal.md)) both borrows from them and deliberately departs from
one of them.

## Apple Fitness Trends — mezo shortened the window, it did not mirror it

Per the source (a MacStories iOS 13 writeup), Apple's Trends feature compares a **90-day average**
against a **365-day average** for the same metric, surfacing an up/down arrow depending on whether
the recent window beats the yearly baseline. It requires **six months** of accumulated history for
a metric before Trends will recommend anything off of it.

`docs/superpowers/specs/2026-09-02-lifegoal-system-design.md` §2 describes this only as "short vs
long window" — true as far as it goes, but it drops the actual numbers, and dropping them hides the
interesting part. mezo's trend arrow compares the trailing **7 days** against the trailing **21
days before that**, gated at a **minimum of 5 data-days** in each window
(`docs/features/lifegoal.md`, `LifeGoalScorer.arrow`). That is not a scaled-down copy of Apple's
90-vs-365/6-month shape — it is roughly an order of magnitude shorter on every axis. The reason is
product-shaped, not evidential: a life-goal pillar needs to say something within the first couple of
weeks of a user setting it up, where Apple's Trends is explicitly built for year-scale health
metrics with months to spare before it says anything at all. The contrast is the point — mezo's
7-vs-21/min-5 gate is a deliberate shortening of Apple's idea, not an attempt to be Apple at a
smaller scale.

## Exist.io's 60-day rolling median baseline

Exist computes a weekly-recomputed personal baseline — a day-of-week median over a **60-day**
lookback — and treats a day's value as good or bad relative to that baseline rather than to an
externally set target. mezo adopted the shape (a rolling personal baseline stands in for an
authored goal) but changed the window to **28 days** with a **minimum-14-data-day** gate, and did
not take Exist's day-of-week bucketing. The full account, including which numbers are confirmed and
which mezo declined, lives on the entity page rather than being repeated here: see
[Exist.io](../entities/exist-io.md).

## Oura Readiness — normalize per-signal, but do not hide the weights

Per Oura's own support article, Readiness combines **nine named contributors** (Resting Heart Rate,
HRV Balance, Body Temperature, Recovery Index, Sleep, Sleep Balance, Sleep Regularity, Previous Day
Activity, Activity Balance), each independently normalized onto a common **0–100 scale** with
published bands — **85–100 Optimal, 70–84 Good, 60–69 Fair, 0–59 Pay Attention** — personalized
against the user's own averages, needing **up to two weeks** to learn a baseline before contributor
scores mean anything.

The article is explicit that the **weighting/combination formula is not disclosed**: Oura documents
what each contributor measures and why, but gives no formula, weights, or aggregation method for
turning nine 0–100 numbers into one Readiness Score. mezo adopted the **normalize-then-combine**
shape — each pillar's daily status folds into a single weighted point (`LifeGoalScorer.dailyPoint`)
— but **rejected the opaque weighting**: a pillar's `weight` is an integer **1..3**, set by the user
and visible on the goal, not a hidden proprietary constant. Oura's documented opacity is precisely
what justifies that choice — mezo can point to Oura for how to normalize a heterogeneous signal
before combining it, but not for how to hide the combination step, because Oura itself treats that
as the one part of the mechanism it will not show.

## WHOOP Journal — deferred to Phase 2

WHOOP's Journal/Behaviors feature compares "yes days" (a logged behavior/tag occurred) against "no
days" for the same tag, reporting how the user's Recovery score differs between the two conditions.
It requires a **minimum of 5 logged responses per tag** before surfacing any feedback for that tag,
and discloses no statistical method behind the comparison. This yes-day/no-day attribution shape is
**deferred to Phase 2** in mezo's own design — envisioned as a weekly-retrospective attribution card
("did skipping X actually move Y this week"), not something the shipped life-goal feature builds
today.

## The shared load-bearing rule: no arrow without a minimum-data gate

Every one of the four sources gates its output on having *enough* history before it will render a
direction at all: Apple's six-month minimum, Exist's weekly-recomputed baseline (implicitly assuming
enough days behind it to compute a stable median), Oura's up-to-two-week baseline-learning period,
and WHOOP's 5-response-per-tag floor. None of them will assert a direction from too little data.

mezo's own arrow encodes the same rule as an explicit state rather than a fuzzy degradation: below
the 5-data-day gate in either the 7-day or 21-day window, `LifeGoalScorer.arrow` returns
**`insufficient`**, never a guessed `up`/`down`/`flat`. The Én-hub's trend trio (`EnHubPage`)
deliberately excludes `insufficient` from all three buckets it renders — too little data must never
masquerade as a direction, on the render side as much as the compute side.

## See also

- [Exist.io](../entities/exist-io.md) — the rolling-median baseline mechanism, including the day-of-week bucketing mezo did not take.
- [Idempotent Daily Recompute](idempotent-daily-recompute.md) — the recompute job that produces the daily values these windows are drawn over.
- [`goal-engine.md`](../../features/goal-engine.md) — the shipped engine computing these arrows and gates.
