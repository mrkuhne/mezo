---
title: Idempotent Daily Recompute
type: concept
updated: 2026-09-06
tags: [goals, backend, technique]
related:
  - trend-arrows-and-baselines.md
  - ../entities/exist-io.md
  - ../../features/goal-engine.md
sources:
  - raw/articles/2026-09-06-lifegoal-engine-prior-art-research.md
confidence: medium
contradictions: []
---

# Idempotent Daily Recompute

The recompute job's shape: one raw daily fact, derived values recomputed from it, and a job that is
safe to re-run. Two of this page's four sources were reached only through substitutes for
unreachable assigned URLs — both gaps are named plainly below rather than smoothed over.

## Loop Habit Tracker (uhabits) — documented mechanism, inferred principle

**Reached in full:** GitHub Discussion #689 (FAQ) and Discussion #1112 (a maintainer explaining the
score-smoothing constants). A direct fetch of the `Score.java` source file 404'd; the formula below
is a maintainer's quoted statement, not a direct code read.

**What is documented:** uhabits' habit "Score" is an exponential smoothing over the full checkmark
history — a weighted average where recent repetitions count more than old ones. The exact
multiplier, quoted verbatim by a maintainer: `multiplier = pow(0.5, frequency / 13.0)`. For a daily
habit (`frequency = 1`) this simplifies to **≈0.95 per day** — the running score keeps 95% of its
prior value on each update, with the day's new checkmark contributing the remainder. This is a
single-pole exponential moving average, and it produces a documented decay curve: a daily habit's
score reaches **80% of max after one month, 96% after two months, 99% after three months**.

**What is an inference, not a documented fact:** the claim that "the raw daily checkmark is the
truth and every derived value (score, streak, trend) is a pure recomputation from it" is **not
stated** anywhere in either thread — it is the natural reading of an exponential-smoothing FAQ, but
the FAQ itself never asserts a single-source-of-truth architecture. **Retroactive-edit behavior is
undocumented in both threads read:** neither the FAQ nor the constants discussion says what happens
computationally when a past checkmark is edited — full recompute, partial-window recompute, or
cache invalidation are all consistent with the text and none is confirmed.

mezo adopted the **principle** (raw `pillar_day` facts are the source of truth; the arrow and
heatmap are read-time derivations recomputed on demand), but it cannot claim uhabits **validates**
that architecture — uhabits' own docs stop at describing the smoothing formula and never confirm
the retroactive-recompute behavior mezo actually relies on.

## Habitica cron — the failure mode, from a substitute source

**The assigned URL was unreachable:** `https://habitica.fandom.com/wiki/Cron` returned **HTTP 402
Payment Required** on two separate attempts. What follows instead is drawn from GitHub issue
**#8665** ("Double cron run in a single day"), a primary report of the real failure this page is
about — plus a search-engine snippet (not the page itself) for what Cron generally does.

Habitica's "Cron" is a daily job evaluating all of a user's Dailies at a configured day-start time,
or on the user's next login after that time, applying damage for incomplete Dailies and progressing
streaks and quest state. Issue #8665 documents a concrete double-run: a custom day-start time
interacting with a timezone change across the user's devices caused **both** trigger paths — "run
at day-start" and "run on first login after day-start" — to fire independently for the same
calendar day, because neither path consistently checked a durable done-for-today guard across the
timezone shift. The reporter lost levels and progress; repair required manual intervention via
Habitica's support tooling, with no confirmed code-level idempotency fix visible in the thread.

This is the exact failure mode behind mezo's non-negotiable decision **D-1** of the motor spec: a
recompute keyed by **`(pillar, day)`** as an upsert, plus a **uniquely-keyed XP ledger**, so that two
trigger paths firing for the same day cannot double-apply either the pillar's daily state or its
reward. A day-boundary job driven by both a schedule and a client-visit fallback — exactly
Habitica's shape — is precisely the case this guard exists for.

## Exist.io's rolling re-sync window — the misattributed one

`docs/superpowers/specs/2026-09-03-lifegoal-slice2-motor-design.md` §2 cites
`kb.exist.io/article/55` for a rolling re-sync window ("every run rewrites the last N days, so late
data backfills itself"). That article was reached **in full**, and it is about something else
entirely: **lag-1 cross-day correlations** — whether one attribute today correlates with another
tomorrow — with no sync-window, backfill, or write-side recompute content anywhere in it. The
citation does not support the claim it was attached to; this is recorded on the entity page as well,
so the misattribution is not silently repeated across the wiki. See [Exist.io](../entities/exist-io.md).

mezo's **3-day resync window** is real engineering and is not being reopened here — it just needs
its justification to come from the idempotent partition-overwrite pattern below, which actually
supports it, rather than from Exist, which was never about this question.

## Idempotent partition-overwrite / backfilling — also a substitute source

**The assigned URL was unreachable:** `https://www.ml4devs.com/what-is/backfilling-data/` returned
**HTTP 403 Forbidden** on two separate attempts. A substitute source documenting the same named
pattern in the same terminology was read instead: a dev.to article on idempotent pipelines.

**The mechanism:** rather than appending rows, a pipeline **replaces the whole time-partition**
being processed — delete-then-insert, or an `INSERT OVERWRITE`/`replaceWhere`-style operation
scoped to the exact partition being recomputed — so a rerun deletes and recreates the same
partition and yields identical data. For non-partitioned tables, the equivalent is an **upsert/MERGE
keyed by business key**: running the same merge twice against the same staging data produces the
same result. Side-effecting events (notifications and the like) need a **separate dedup** mechanism,
since neither partition-overwrite nor upsert-by-key covers an action that fires rather than a row
that's written.

**The principle, quoted directly:** *"Idempotency is not about preventing retries. It's about
making retries safe."*

**Honesty note — a gap in the wiki's own framing, not the source's.** The phrasings "bounded
recomputation window" and "side-effect ledger" that appear in mezo's own motor spec were **not
found verbatim** in either the assigned or the substitute source. The substitute's dedup discussion
is the closest analogue to a side-effect ledger, but no source read in this pass names that concept
directly — that framing is mezo's own synthesis on top of the partition-overwrite pattern, not a
claim traceable to either source.

## Why `confidence: medium`

Two of the four legs here (uhabits, Habitica) rest on inference or a substitute source rather than a
fully-confirmed primary read of the assigned material, and two assigned URLs (Habitica's wiki,
ml4devs) were outright unreachable. Against that, the core mechanism mezo actually leans on — the
partition-overwrite pattern and its `(pillar, day)`-keyed upsert — is confirmed, quoted, and
directly applicable from a source that was read in full, even if it wasn't the originally assigned
one. That balance of solid substitute sourcing against real unreachable gaps lands at `medium`.

## See also

- [Trend Arrows and Baselines](trend-arrows-and-baselines.md) — the windows computed over the daily values this recompute job produces.
- [Exist.io](../entities/exist-io.md) — records the same `kb.exist.io/article/55` misattribution from the entity side.
- [`goal-engine.md`](../../features/goal-engine.md) — the shipped engine implementing the `(pillar, day)` upsert and the resync window.
