---
title: Goal-Type Taxonomies
type: concept
updated: 2026-09-06
tags: [goals, me, technique]
related:
  - ../entities/exist-io.md
  - goal-pursuit-evidence.md
  - trend-arrows-and-baselines.md
  - ../../features/lifegoal.md
sources:
  - raw/articles/2026-09-06-lifegoal-prior-art-research.md
confidence: medium
contradictions: []
---

# Goal-Type Taxonomies

How a goal-tracking product carves up "what kind of goal is this" into a small set of trackable
shapes. mezo's life-goal pillar model (`docs/features/lifegoal.md`) ships **five** pillar kinds
(`habit | average | target | baseline | linked`); four of those correspond to **Strides**' four
tracker archetypes, and the fifth (`baseline`) is Exist.io's rolling-median idea, not Strides' — see
[Exist.io](../entities/exist-io.md). The page also rejects three competing shapes outright, and
corrects a naming error the project's own design spec made about the Strides source.

## Strides' four tracker archetypes

Per Strides' help/FAQ (read in full), the app documents four goal/habit archetypes:

- **Target** — numeric entry against a set value, with a **Pace** line (see below) showing ahead/behind schedule.
- **Average** — numeric entry judged against a running average rather than a fixed target.
- **Habit** — binary yes/no; tapping the checkbox logs "No," swiping left logs "Yes."
- **Milestone** — supports attaching notes on each log.

## Correction: the fourth type is Milestone, not "Project"

`docs/superpowers/specs/2026-09-02-lifegoal-system-design.md` §2 (decision **D10**) names the four
Strides archetypes as "Habit / Target / Average / **Project**." The source does not contain a
"Project" tracker anywhere — its fourth type is **Milestone**. This page records the correct name;
it does not reopen D10's actual substitution, which mapped Strides' fourth slot onto mezo's own
**`kapcsolt`** ("linked") pillar kind — the pillar type driven by the weight-goal engine's own
judgement rather than by a user-entered number or checkbox. That substitution is unaffected by the
naming slip: mezo never had a "Project" pillar to rename, so nothing about the shipped taxonomy
changes — only the label attached to what Strides itself calls its fourth archetype.

Four of mezo's five pillar kinds line up with Strides' four archetypes: habit ↔ habit,
cél-érték-ütemvonallal ↔ Target, átlag ↔ Average, and kapcsolt ↔ Milestone (substituted, not
copied — mezo's `kapcsolt` pillar reads its state from the weight-goal engine, not from a
user-attached note). mezo's fifth kind, **`baseline`** (a 28-day rolling median with a
minimum-14-data-day gate), has no Strides counterpart at all — it is Exist.io's rolling-median
baseline idea, adopted separately; see [Exist.io](../entities/exist-io.md) and
[Trend Arrows and Baselines](trend-arrows-and-baselines.md). Do not read this as a five-way
correspondence with Strides — only four of the five kinds map onto it.

## Two Strides mechanics mezo did not harvest

### Bad Habit (inverted habit bar)

Strides documents a **"Bad Habit"** variant of the habit tracker: the progress bar starts **100%
full and green**, and *shrinks* as the user logs occurrences, with the limit shown in **red** instead
of green. This is specifically a **rendering** idea — "count down from full" rather than "count up
from empty" — that mezo's habit pillar does not currently offer. It is not a gap in the underlying
rule semantics: mezo's habit rule already carries a `comparator` (`{threshold, comparator,
daysPerWeek}`, e.g. an `ACWR ≤` guard), so inverted-direction habit logic exists today — only the
"start full, shrink toward the limit" progress-bar treatment is un-harvested. Recorded here as an
un-harvested rendering idea, not as a rejected one: nothing in the design specs considered and
declined it.

### Pace (expected-rate flagging)

Strides' **Pace** system computes an expected progress rate from a goal's **start/end dates and
target value**, and uses it to flag whether the user is running ahead of or behind schedule. The
source describes Pace generally, without scoping it to one tracker archetype. mezo's own ahead/behind
signal (the 7-vs-21-day trend arrow, see
[Trend Arrows and Baselines](trend-arrows-and-baselines.md)) is built on rolling-window comparison,
not on a start/end/target pace line. Pace is a genuinely different mechanism — schedule math rather
than trend comparison — and mezo has not harvested it. Worth flagging for any future pillar that has
a hard deadline rather than an open-ended baseline.

The source gives no exact day-window or streak-length constants for any of this — the FAQ text is
qualitative on frequency/scheduling mechanics ("every X days," specific-weekday selection, skipped
days excluded from streaks) and states no numeric constants of its own to borrow.

## Rejected alternatives

Three competing shapes were considered and explicitly rejected — a rejection is knowledge in its
own right, not a gap in the taxonomy:

- **Gyroscope's single "life score"** — one opaque composite number (marketed as "the most important
  number in your life") blending sleep, heart metrics, activity, nutrition, body composition, and
  mood into a single vendor-weighted figure. Rejected because a black-box blend cannot support an
  if-then plan or a specific recorded metric — it obscures exactly which behavior moved the number,
  which is the opposite of what the progress-monitoring evidence favors (see
  [`goal-pursuit-evidence.md`](goal-pursuit-evidence.md)).
- **Manual check-in-only goals** — goals whose only progress signal is the user typing in a status.
  Rejected in favor of pillars that read existing activity-ledger/chat signals; mezo's own design
  principle is "self-logging is the enemy" (per the system-design spec's D3 rationale).
- **An arrow with no minimum-data gate** — a trend indicator that renders regardless of how much
  history exists behind it. Rejected because an ungated arrow can flip on a single noisy data point;
  mezo's own arrow requires a minimum data-day count before it renders (see
  [Exist.io](../entities/exist-io.md) and
  [Trend Arrows and Baselines](trend-arrows-and-baselines.md) for the specific gates mezo chose).

## See also

- [Exist.io](../entities/exist-io.md) — the other adopted prior-art product, for the baseline-as-pillar mechanism Strides' taxonomy sits alongside.
- [`lifegoal.md`](../../features/lifegoal.md) — the shipped pillar kinds these archetypes map onto.
