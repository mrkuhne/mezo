---
title: Exist.io
type: entity
updated: 2026-09-06
tags: [goals, me, technique]
related:
  - ../concepts/trend-arrows-and-baselines.md
  - ../concepts/idempotent-daily-recompute.md
  - ../../features/lifegoal.md
sources:
  - raw/articles/2026-09-06-lifegoal-prior-art-research.md
  - raw/articles/2026-09-06-lifegoal-engine-prior-art-research.md
confidence: medium
contradictions: []
---

# Exist.io

**Exist.io** is a personal-analytics aggregator: it pulls in attributes from other trackers (sleep,
steps, mood, weather, and so on) and layers analysis on top. It gets the **only entity page** in this
ingest because it is the sole product cited in **both** of mezo's life-goal design specs (system-design
§2 and the engine spec's §2), and because those two citations pull in **three separable positions** —
one mezo adopted faithfully, one the specs misattribute outright, and one mezo deliberately left on
the table. A single page, not a mention inside a concept page, is the only way to keep those three
straight (SDD's anti-stub rule in [`SCHEMA.md`](../SCHEMA.md) §2 permits this because Exist is
central to the goal-engine research, not a passing reference).

## The structural idea: no goal object at all

Exist's core data model (per its API reference) has **Attributes** — one value per day, per metric —
and derived **Correlations** on top. There is no user-set target/goal entity anywhere in that model.
Instead, Exist computes a weekly **Average** per attribute, explicitly described in its own docs as
technically a **median**, and states plainly that this *"is the basis of our goal system"*: a day's
value is judged against the user's own recent typical behavior for that weekday, not against an
externally authored target.

## Position 1 — Adopted: baseline-as-pillar

This is the one claim from mezo's design specs that **fully survives contact with the source**.
Exist's median baseline is computed over the **last 60 days** of data, **recomputed weekly**, and
broken down **by day-of-week** — so Monday-you is judged against past Mondays, not against Tuesday's
number. mezo took the core idea (a rolling personal baseline stands in for a goal) but changed the
shape twice:

- **Window:** 60 days → mezo's **28-day** window.
- **Data-sufficiency gate:** Exist's docs don't state a minimum; mezo added an explicit
  **minimum-14-data-day** gate before a baseline is trusted.
- **What mezo did NOT take:** the **day-of-week breakdown**. mezo's baseline is a flat rolling window,
  not bucketed by weekday. That's a real simplification, not an oversight to paper over — see
  [`trend-arrows-and-baselines.md`](../concepts/trend-arrows-and-baselines.md) for how the 28/14
  window and the flat (non-weekday-bucketed) baseline actually work in mezo's trend arrows.

## Position 2 — Misattributed: the "rolling re-sync window" citation

This is the important one, and the wiki records it plainly rather than smoothing it over. The
engine-design spec's §2 claims Exist runs a rolling re-sync window — paraphrased there as *"every run
rewrites the last N days, so late data backfills itself"* — and cites `kb.exist.io/article/55` for it.

The research reached that article **in full**. It is about **cross-day correlations**: Exist checks
whether one attribute on day N correlates with another on day N+1 (its own example: does today's
alcohol affect tomorrow's sleep quality), and it recommends logging data on the day it happens so that
lag-1 check works. **The article contains no sync-window or backfill content whatsoever** — no
mention of rewriting recent days, no mention of a recompute window on the write side. The citation
does not support the claim it was attached to.

This does not mean mezo's design is wrong. The **3-day resync window** mezo actually built is still a
sound piece of engineering — it just needs to stand on its real foundation (the idempotent-batch /
partition-overwrite pattern documented elsewhere in the ingest) instead of on Exist, which was never
about this at all. See [`idempotent-daily-recompute.md`](../concepts/idempotent-daily-recompute.md)
for where that justification actually lives.

**Practical note for future ingests:** Exist's public docs do confirm the median baseline is
*"generated weekly"*, but say nothing about the cadence or mechanics of the recompute itself beyond
that. Don't extend the "no sync-window content" finding into "Exist definitely doesn't backfill
anywhere" — that's a stronger claim than the source supports either way. What's established is
narrower: this specific article, cited for this specific claim, doesn't back it.

## Position 3 — Deferred: cross-attribute correlations

Exist's other analysis layer — and the one mezo did not build — is its **correlation engine**:
pairwise relationships between attributes, scored **−1..+1** with an attached **p-value**, computed
**weekly**, and presented to users explicitly as *correlation, not causation*. The discovery process
first checks same-day correlation between two attributes, and if none is found, checks the lag-1
cross-day case (attribute A today vs. attribute B tomorrow). mezo's life-goal feature stops at the
attribute + baseline layer; a correlation layer of this kind is future scope, not something silently
dropped — it was never in the shipped design to begin with.

## Why `confidence: medium`

The Position-1 baseline numbers (60-day/weekly/median/day-of-week) come from Exist's own object-types
reference, read in full — that part alone would support `high`. But Position 2 turned up a source
that flatly does not say what it was cited for, and the correlation article is silent on baseline
recompute mechanics beyond "weekly" — two real gaps against one primary doc, hence `medium` rather
than `high` for the page as a whole.

## See also

- [Trend arrows & baselines](../concepts/trend-arrows-and-baselines.md) — mezo's 28-day/min-14 window
  and how it renders as a trend arrow.
- [Idempotent daily recompute](../concepts/idempotent-daily-recompute.md) — the partition-overwrite
  pattern that actually justifies mezo's 3-day resync window.
- [`lifegoal.md`](../../features/lifegoal.md) — the shipped feature these positions feed.
