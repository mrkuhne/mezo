---
title: PERMA and Wellbeing Taxonomies
type: concept
updated: 2026-09-06
tags: [goals, me]
related:
  - goal-pursuit-evidence.md
  - goal-type-taxonomies.md
  - ../../features/lifegoal.md
sources:
  - raw/articles/2026-09-06-lifegoal-prior-art-research.md
confidence: low
contradictions: []
---

# PERMA and Wellbeing Taxonomies

Three competing academic/vendor wellbeing taxonomies were surveyed for mezo's visible life-area
model. One was adopted; two were explicitly rejected — **as visible UI taxonomies**, not as
science. This page keeps that distinction sharp, because it is easy to misread a rejection here as
a verdict on validity when it is really a verdict on fitness for a fitness-app label.

## Adopted: PERMA-Profiler (Butler & Kern 2016)

**Citation:** Butler & Kern (2016), "The PERMA-Profiler: A brief multidimensional measure of
flourishing," *International Journal of Wellbeing*, 6(3), 1–48.

**The five factors** (decision **D2** of `docs/superpowers/specs/2026-09-02-lifegoal-system-design.md`
adopts these as mezo's PERMAH life-area split, with an added H for skills/practice):

- **P**ositive emotion
- **E**ngagement
- **R**elationships
- **M**eaning
- **A**ccomplishment

**Instrument structure:** a **23-item** measure — **15 core items** (3 per PERMA domain) plus **8
filler items** covering overall wellbeing, negative emotion, loneliness, and physical health.

**Validation Ns:** development/refinement across three initial studies totaling **N = 7,188**,
followed by eight further validation studies totaling **N = 31,966**, reporting acceptable model fit
and convergent/divergent validity for the five-factor structure.

### Honesty note: this is a secondary reading

The raw research report could **not** read the PERMA-Profiler primary PDF as text — both the
author's own hosted copy and the journal's PDF returned only binary/stream data on WebFetch, twice.
The 23-item structure and the N = 7,188 / N = 31,966 figures above come from **search-engine-surfaced
summaries** of the paper (ResearchGate/Semantic Scholar listings), not from a direct read of the
primary text. No Cronbach's alpha or CFA fit-index (CFI/RMSEA) numbers could be extracted at all —
they are omitted here rather than guessed. This is why this page's `confidence` is `low`: mezo's
single most load-bearing wellbeing taxonomy rests on a secondary citation of its own foundational
paper.

## Rejected as a visible taxonomy: Gallup Wellbeing 5

Gallup's "Five Essential Elements of Wellbeing" (Rath & Harter, 2010; restated on Gallup's workplace
site): **Career, Social, Financial, Physical, Community**. Derived from a study spanning **150+
countries**, reaching over 98% of the world's population per Gallup's own framing; headline stat:
**66%** of people are doing well in at least one of the five elements, but only **7%** are thriving
in all five simultaneously.

**Why rejected as a visible taxonomy — not as science:** Gallup Wellbeing 5 is a **licensed vendor
construct** (Gallup sells assessments and consulting on it) aimed at **population-level
benchmarking**, not at an individual app's day-to-day goal model. Two of its five elements — Career
and Financial — are out of scope for what mezo tracks, and a third (Community) has no natural
in-app signal either. Its evidence base is about correlational population wellbeing, not about
mechanics for setting or tracking a personal goal. None of that touches whether Gallup's model is
scientifically sound — it is a rejection of fit, not of validity.

## Rejected as a visible taxonomy: Ryff's six dimensions

Carol Ryff's Scales of Psychological Well-Being (1989) — a eudaimonic (as distinct from PERMA's more
hedonic/mixed) wellbeing measure. **Six dimensions:** Autonomy, Environmental Mastery, Personal
Growth, Positive Relations with Others, Purpose in Life, Self-Acceptance. Available in **84-item**
(long), **42-item** (medium), and **18-item** (short) forms, with reported internal-consistency
reliabilities around **α ≈ .86–.93** across versions/subscales.

**Why rejected as a visible taxonomy — not as science:** Ryff's scales are an abstract,
clinically/academically oriented research instrument with **no natural numeric proxy** for most of
its dimensions the way "steps" or "1RM" gives a fitness app one — "Purpose in Life" or "Autonomy"
have nothing analogous to log against. It was designed and validated as a research/clinical
assessment tool, not as an end-user goal-setting framework. Again: a mismatch of instrument to UI
surface, not a challenge to the underlying eudaimonic-wellbeing science.

### Honesty note: Ryff's numbers are secondary too

The 84/42/18-item structure and the α ≈ .86–.93 figures come from a **practitioner secondary
source** (positivepsychology.com) summarizing the literature, not from Ryff's own 1989 primary
paper, which the raw research did not reach. Treat these as secondary-sourced, same caveat as
PERMA-Profiler above.

## Why `confidence: low`

Both the adopted taxonomy (PERMA-Profiler) and one of the two rejected comparators (Ryff) rest on
secondary summaries rather than a direct read of their primary texts — the two PERMA-Profiler PDFs
and Ryff's 1989 original were all unreachable in this research pass. Gallup's own workplace page was
read in full and is primary for its own numbers, but it is one of three taxonomies on this page, not
the load-bearing one. The page-level rating reflects the weakest link that matters most: the
taxonomy mezo actually shipped is the one resting on secondary sourcing.

## See also

- [`goal-type-taxonomies.md`](goal-type-taxonomies.md) — the sibling taxonomy page for pillar *kinds* rather than life-area *dimensions*.
- [`lifegoal.md`](../../features/lifegoal.md) — the shipped PERMAH life-area split (D2).
