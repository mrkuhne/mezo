# Karakter — MINDENT be, 1. kör: Edzés & test (mezo-1gim.15, round 1)

**Date:** 2026-08-31 · **Driving bd:** mezo-1gim.15 (epic mezo-1gim) · **Status:** approved by Daniel

The first of the four MINDENT-be rounds widens the Karakter detector pipeline's input corpus
to the training-and-body domain. The Gépterem inventory (`frontend/src/features/character/inventory.ts`,
round 1 "Edzés & test") is the contract this round fulfils: its six rows become real reads and
real detectors, plus three bonus detectors that fall out of the same entity reads for free
(Daniel: "ennél szerintem többet is bele tudunk"). Everything stays inside the epic's honesty
frame: code detects (numbers computed deterministically), the LLM expert interprets.

## 1. Scope

**In:** the six round-1 inventory rows wired for real, as eight detectors + the read widening
that feeds them. **Out:** the remaining spec §5 detectors (mezo-1gim.12 — later rounds), rounds
2–4, any contract (OpenAPI) change, any new persistence, pump/workload as standalone detectors
(they enrich `rir-calibration`/`niggle-map` summaries only — volume response is already
`VolumeProgressionService`'s job at the train level).

## 2. Data sources (real fields, verified in code)

| Source | Entity | Fields used |
|---|---|---|
| Gym szettek | `ExerciseSetEntity` | weightKg, reps, rir, skipped, kind, targetWeightKg, targetReps, exerciseId, workoutSessionId |
| Gym feedback | `ExerciseFeedbackEntity` | pump (1–4), jointPain (1–3), workload (1–3), exerciseId |
| Röplabda / sport | `SportSessionEntity` | date, sport, rpe, shoulderStrain (1–10), jumpCount, intensity |
| Futás | `RunSessionLogEntity` | date, rpeActual (1–10), hrRecoverySec, completedRounds |
| Alvás | `SleepLogEntity` | date, quality (1–10), durationH, awakenings |
| Mezociklus-ív | `MesocycleEntity` (+ instance `WorkoutSessionEntity` dates) | status=active, currentWeek, weeks, phaseCurve, weekly plan days; done instance dates |

Discovery recorded during brainstorm: **"niggle report" is not an entity** — niggle truth is
scattered across `ExerciseFeedbackEntity.jointPain`, `SportSessionEntity.shoulderStrain`, and
free-text notes; `niggle-map` composes from the two numeric fields (notes stay out — no
LLM-side text mining in a detector).

## 3. Architecture — read layer

`CharacterSignalReads` remains the single cross-feature read composer (ContextSnapshotAssembler
pattern; read-only repository access, no new ArchUnit edges — verify `character → train` is a
new one-way edge and does not close a cycle before merging). `DetectorInput` widens on two
levels (brainstorm decision "A, kétablakos"):

- **14-day detailed slice** (every detector): per-day workout presence + per-exercise set
  aggregates (avg rir, reps-vs-target delta, weight-vs-target delta, skipped count, worst
  jointPain, pump/workload), sport sessions, run logs, sleep points, and the active mesocycle
  context (currentWeek/weeks/phaseCurve/planned week days + done instance dates).
- **8-week thinned trend series** (trend detectors only): weekly HR-recovery averages and
  weekly RIR-miss averages. Weeks with no data are absent entries, never zeros.

The existing five detectors and their 14-day inputs are untouched. Catch-up honesty: like the
existing weight read, every new read is bounded above by the observed `day` — data logged after
`day` must not leak into a catch-up run's window.

## 4. The eight detectors

All pure-code `CharacterDetector` implementations discovered by `DetectorRegistry`; each emits
`DetectorSignal(detectorKey, expertKey, summary, salience)` with numbers computed in code.

| Key | Expert | Fires when (sketch — exact thresholds fixed in the plan, tests pin them) |
|---|---|---|
| `rir-calibration` | edzo | estimated RIR systematically disagrees with performance (direction + magnitude of under/over-estimation across the window); pump/workload enrich the summary |
| `niggle-map` | edzo | jointPain ≥ 2 repeats on the same exercise, or a shoulderStrain ≥ 6 run — summary carries the body-area map |
| `sport-interference` | edzo | a high-strain/high-jump sport day is followed by measurable gym decline (target shortfall, RIR worsening) |
| `hr-recovery-trend` | doki | the 8-week weekly-average series changes band (improving / flat / worsening) |
| `sleep-performance-chain` | szomnologus | poor-sleep night (low quality / short) → next-day RPE/performance decline pairs repeat |
| `meso-adherence` | edzo | missed training days against the active mesocycle's weekly plan; **deload weeks (phaseCurve) suppress the false alarm** — reduced load in a deload week is plan-conform |
| `progression-adherence` | edzo | actual vs target weight/reps shows systematic under- or overshoot |
| `avoidance-pattern` | drill | skipped sets/exercises cluster on the same exercise or muscle group |

Expert routing rationale: the catalog already names "RIR-kalibráció" and "niggle-mintázatok"
on edzo's watch list; hr-recovery is a doki health signal; the sleep chain is szomnologus's
"regenerációs jelek"; skipping clusters are drill's "kihagyások". Edzo — until now the only
domain expert with zero detectors — gains four.

## 5. Overfiring protection (stateless change-gating)

Brainstorm decision "A": a sliding window recomputed nightly must not re-announce an unchanged
state. Rule, with **no new state or table**:

- Every detector fires only if **new relevant data arrived on the observed day** (a workout /
  sport / run / sleep log dated `day` for its source family). No new data → silence, even if
  the window still shows the condition.
- Trend detectors (`hr-recovery-trend`, `rir-calibration`'s trend clause) additionally require
  a **band change**: recompute the trend as of `day - 1` and as of `day`; fire only when the
  bands differ. Double computation, deterministic, stateless.
- Fast detectors (niggle, sport-interference, sleep chain, adherence pair, avoidance) rely on
  the new-data gate alone.

Quiet nights therefore stay genuinely quiet, and the Gépterem run page can honestly say why a
signal fired ("új futás érkezett") versus a real zero row.

## 6. Gépterem + FE

- `inventory.ts`: round-1 rows are **deleted from `rounds`**; the wired sources join `reads`
  with window chips ("14 nap" / "8 hét") — per the file's own header contract.
- `DetektorokPage`: the eight new detectors listed with their true owners and "mit néz / mikor
  tüzel" copy — 13 total.
- Mocks: new detector keys appear in the feed/run mocks with the established
  derived-not-hardcoded discipline (counts derived from mock data, mock timing mirrors
  production timing).
- **No OpenAPI change**: detector keys are free strings in the signal envelope already.

## 7. Testing

- Per-detector unit tests on synthetic `DetectorInput`: fires / does not fire / cooldown
  silence (same state, no new data → empty list) / deload suppression (`meso-adherence`) /
  band-change gate (`hr-recovery-trend`).
- `CharacterSignalReads` IT (Testcontainers): the widened gather against a real DB, including
  the catch-up bound (post-`day` rows do not leak — the existing weight pattern extended to
  every new source).
- FE tests in both modes for inventory + DetektorokPage; run/feed mocks stay consistent
  (navigation real-mode suite must stay green).

## 8. Ship

House flow: this branch (`feat/character-s10-edzes-test`) → self-PR → CI green → local
`--no-ff` merge → push main → bd close. `docs/features/character.md` §detector catalog and
CODEMAP refresh ride in the same change.
