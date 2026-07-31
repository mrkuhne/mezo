# 0015 — The hypnogram is display-only provenance

- **Status:** Accepted
- **Date:** 2026-07-31
- **Driver:** `mezo-fk9a`

## Context

The sleep-depth-stats slice (design spec
[`docs/superpowers/specs/2026-07-30-sleep-depth-stats-design.md`](../superpowers/specs/2026-07-30-sleep-depth-stats-design.md))
adds a tenth extraction field to `SleepShotService.SYSTEM_PROMPT`: a **hypnogram** — one letter
per 15 minutes of the Sleep Cycle screenshot's "Sleep stages" graph, decided by the **colour** of
the curve at each slot (white=Awake, magenta=Dream, light cyan=Light, dark teal=Deep), not by its
height. Colour is categorical, which turns a measurement problem the vision model is bad at into a
recognition problem it is good at — but the underlying graph is still a **smoothed continuous
curve with no sharp segment boundaries**. Quantising it to 15-minute buckets is a lossy
approximation of an approximation, cross-checked only by three loose consistency gates
(`SleepShotDraftValidator.acceptedHypnogram` — V1 alphabet, V2 length vs. the clock span, V3
composition vs. the exact minute totals, tolerance `max(30 min, 35%)`).

The **per-phase minute totals** (`Deep 1h 40m`, `REM 2h 20m`, …) are a different kind of data
entirely: they are printed as *text* on the same screenshot, the LLM transcribes them as plain
numbers (`deepMin`/`lightMin`/`remMin`/`awakeMin`), and the pre-existing `SleepShotDraftValidator.score`
already cross-checks their sum against `inBedMin` (§SleepShotService, unchanged by this slice).
They are trustworthy in a way the hypnogram is not.

Both numbers describe the same night. Nothing in the code stops a future card from computing "deep
%" by counting `D` characters in the hypnogram instead of reading `deepMin` — the two would usually
agree, closely enough that the bug would sit unnoticed until a borderline night made them disagree
visibly, at which point the exact, cross-checked number would be the one that looks wrong.

## Decision

**The hypnogram is display-only provenance.** It earns exactly two jobs, both implemented in
`frontend/src/features/me/logic/sleepPhases.ts`:

1. **The drawing** — `NightArcCard` (`frontend/src/features/me/components/NightArcCard.tsx`), the
   hanging depth silhouette. A bucket being one step off is invisible here.
2. **The first-half/second-half split** — `halfNightSplit` and `deepFrontLoadPct`. This is a
   **ratio between two halves of the same noisy series**, so the quantisation error largely
   cancels, and it is reported in coarse, rounded language ("a mélyed 72%-a az első félbe esett"),
   never to the minute.

**Every phase percentage, average, and trend value derives from the exact per-phase minute
totals** (`deepMin`/`lightMin`/`remMin`/`awakeMin`) via `phaseBreakdown`/`phasePct`/
`averageBreakdown` — never from counting hypnogram letters. If the hypnogram is missing or fails
validation, the arc card and the front-load sentence are simply absent; every other card on the
page is unaffected, because none of them read the hypnogram.

**Storage: `jsonb` on `sleep_log`, not a child table.** The column
(`202607301200_mezo-fk9a_add_sleep_log_hypnogram.sql`, mapped through the typed embedded record
`SleepHypnogram(Integer bucketMin, String stages)` via `@JdbcTypeCode(SqlTypes.JSON)`) is never
queried independently, never aggregated in SQL, and never joined — it is always fetched with its
parent row and consumed whole by one component. A `sleep_stage_segment` child table would buy
normalisation with no use: an extra join, an N+1 risk on the list endpoint, a new `*Populator`, and
a new `ResetDatabase` TRUNCATE entry, in exchange for nothing this slice needs. `bucketMin` is
stored alongside `stages` (rather than assumed to be 15) so a future finer-resolution extraction
needs no migration or data fix-up — the renderer already reads the bucket width from the data
(`NightArcCard.tsx` uses `entry.hypnogram?.bucketMin ?? 15`). The entity-side type is named
`SleepHypnogram`, distinct from the generated API model `io.mrkuhne.mezo.api.dto.Hypnogram`, so the
two can never be silently confused at a call site.

**The accept/reject verdict is independent of `confidence`/`needsReview`.** `SleepShotDraftValidator`
runs two separate methods over the same `Extracted` record — `score` (unchanged by this slice) and
the new `acceptedHypnogram` — and neither reads the other's result. `confidence`/`needsReview`
describe the numbers the user is about to save; a rejected hypnogram says nothing about them.
Coupling the two would either scare the user away from good numeric data because the drawing failed,
or hide a bad drawing behind an unrelated good confidence score. They fail separately because they
mean different things.

## Consequences

- **A bad extraction costs one card, never a wrong number.** `NightArcCard` and the front-load
  sentence simply don't render (`parseHypnogram` returns `null`); the hero phase rail, the average
  composition card, the phase-stacked trend, and the REM-vs-duration card all read the minute
  totals directly and are completely unaffected. The design spec calls this "the feature degrades
  to 80% of itself, silently and correctly" — this ADR is what makes that degradation safe rather
  than accidental.
- **No backfill path for old nights.** Rows logged before this slice (and any hypnogram that fails
  V1–V3) keep a `null` hypnogram forever; there is no re-extraction job. This is accepted, not an
  oversight — see the design spec §1 "out of scope."
- **A future finer resolution needs no migration.** Because `bucketMin` travels with the row instead
  of being hardcoded, dropping the extraction prompt's bucket width to (say) 5 minutes is a
  prompt-only change; every reader of the column already treats the width as data.
- **Nobody may compute a phase percentage from hypnogram bucket counts.** The exact minute totals
  are already on the row and are already cross-checked (`SleepShotDraftValidator.score`); recomputing
  "deep %" by counting `D` characters would silently introduce quantisation error into a number that
  doesn't need it, and — because the two would usually agree — the bug would only surface as a
  confusing discrepancy on some future borderline night. `sleepPhases.ts`'s two hypnogram-consuming
  functions (`halfNightSplit`, `deepFrontLoadPct`) are the only sanctioned uses; any new function that
  wants a phase share must take `PhaseBreakdown`/the minute fields, not `Stage[]`.

## Alternatives considered

- **Feed the hypnogram into phase-percentage/average/trend statistics** (e.g. `deep% = count('D') ×
  bucketMin / totalMin`) — rejected: it is an LLM's 15-minute quantisation of a smoothed curve with
  no sharp segment boundaries, layered on top of numbers that are already exact and already
  validated. Using it would trade a trustworthy figure for a noisier one for no gain.
- **A `sleep_stage_segment` child table** (one row per contiguous stage run) — rejected: the data is
  never queried independently, aggregated in SQL, or joined; normalising it buys nothing and costs a
  join, an N+1 risk, and new test/reset-database plumbing.
- **Couple the hypnogram verdict to `confidence`/`needsReview`** (reject the whole draft, or fold the
  hypnogram checks into the existing `score`) — rejected: they describe different things. A user
  should be able to save a high-confidence night whose drawing didn't parse, and a low-confidence
  night should not get a free pass on the drawing just because it happens to render.
- **Partial-credit rendering** (draw the hypnogram with the misread segment flagged or omitted) —
  rejected: there is no honest way to show "this part might be wrong" in a silhouette; a hypnogram
  with one stage misread is a wrong picture, not a partially-right one, so the verdict is
  all-or-nothing (`acceptedHypnogram` returns the full sequence or `null`).
