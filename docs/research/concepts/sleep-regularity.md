---
title: Sleep Regularity
type: concept
updated: 2026-07-24
tags: [sleep]
related:
  - qqrt.md
  - ../entities/matthew-walker.md
  - ../../features/me.md
sources:
  - raw/transcripts/2026-07-23-walker-doac-sleep-interview.md
confidence: medium
contradictions: []
---

# Sleep Regularity

**Sleep regularity** = going to bed and waking at **consistent clock times** day to day (including
weekends). It is the **R** of **[QQRT](qqrt.md)** and, per **[Matthew Walker](../entities/matthew-walker.md)**,
the single highest-leverage sleep variable — *"regularity is king."*

## The evidence (why it leads)

From a **UK Biobank** analysis (~**60,000** participants), most-regular vs least-regular sleepers:

| Outcome | Reduction (most- vs least-regular) |
|---|---|
| All-cause mortality | **−49%** |
| Cardiometabolic disease | **−57%** |
| Cancer mortality | **−39%** |

The load-bearing finding: **regularity beat quantity** as a predictor of mortality — *when* you sleep
consistently mattered more than raw hours. That inverts the usual "just get 8 hours" advice and is the
reason mezo scores consistency first.

## How mezo consumes it

The **Sleep goal + day-anchor** (slice A, see [`me.md`](../../features/me.md)) turns this into a
first-class metric:

- The user sets a duration target + a **fixed wake or bed** time; the anchor derives the other end.
- A **regularity score** rewards landing within a **±15-minute band** around those anchor times — a
  deliberately narrow tolerance chosen to operationalize "same time every day." The band is a *score*
  input, not a hard gate; missing it lowers the ring, it does not block logging.
- The score surfaces on the SleepPage as a **regularity ring** alongside the efficiency ring.

Because the whole day's timing (meal slots, wind-down, caffeine cutoff) cascades from that single
anchor, regularity is not just a sleep metric — it is the spine the rest of the app's day plan hangs
off. The other three QQRT legs (quantity, quality, timing) are covered on the [QQRT page](qqrt.md).
