---
title: Morning Routine (Ethier six recs)
type: concept
updated: 2026-07-24
tags: [sleep, technique]
related:
  - ../entities/jeremy-ethier.md
  - ../entities/matthew-walker.md
  - ../../features/habit.md
sources:
  - raw/transcripts/2026-07-23-ethier-morning-routine.md
confidence: medium
contradictions: []
---

# Morning Routine (Ethier six recs)

The **morning half** of mezo's day, distilled from **[Jeremy Ethier](../entities/jeremy-ethier.md)**'s
_"Perfect Morning Routine to Build Muscle."_ Where **[Matthew Walker](../entities/matthew-walker.md)**
owns the sleep/evening science, this video owns the wake-up sequence. Its six recommendations were the
seed of the **habit engine** ([`habit.md`](../../features/habit.md)).

## The six recs → the mezo habit each became

| # | Ethier rec | Rationale (as claimed) | Became in mezo |
|---|---|---|---|
| 1 | **Circadian-aligned wake** | steady wake anchor stabilizes the day | the **wake anchor** (sleep goal / `SleepAnchorPort`) the routine hangs off |
| 2 | **Morning sunlight** | sets the clock, boosts alertness, earlier melatonin that night | the **`morning_sunlight`** habit |
| 3 | **Morning weigh-in** | most consistent condition → least-noisy trend | the **morning weigh-in** habit + biometrics trend |
| 4 | **Caffeine timing / cutoff** | delay ~60–90 min post-wake; cut off so it clears by bed | the **caffeine cutoff** (14:00 default; the `no_stim_after` metric) |
| 5 | **Morning training** | reinforces the wake anchor, aids adherence + night sleep | the **morning-training** window (an anchor consumer) |
| 6 | **Protein-rich breakfast** | supports MPS after the overnight fast; satiety | the **protein breakfast** habit |

Each row is a morning habit in the routine chain; see the habit engine for how completion + XP work
([`habit.md`](../../features/habit.md)).

## Division of labor with Walker (why two sources)

This video deliberately covers what **Walker does not**:

- **Caffeine numbers** — Walker gives no cutoff hours or half-life; the 14:00 cutoff comes from here /
  app config, not from him.
- **Morning light** — Walker's light guidance is **evening-only**; all morning-light content is
  Ethier's.
- (Walker also discusses **no naps**.)

So the two sources partition cleanly: **Ethier = morning** (wake, light, caffeine, training,
breakfast), **[Walker](../entities/matthew-walker.md) = sleep/evening** (regularity, wind-down, the
night layer). Neither overlaps the other, which is why both are kept as distinct raw sources.
