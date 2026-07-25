# Progressive Overload — mesocycle-aware, performance-driven, in-workout signal (design spec)

- **Date:** 2026-07-25 · **bd:** `mezo-5pfe` · **Domain:** Train (Gym sub-model)
- **Living docs to update on ship:** [`docs/features/train.md`](../../features/train.md) §2/§3/§4/§9 · [`docs/features/proactive.md`](../../features/proactive.md) (challenge tie-in) · [`docs/milestones/roadmap.md`](../../milestones/roadmap.md)
- **Design references (mandatory):** `spring_patterns.md` · `configuration_conventions.md` · `api_contract_conventions.md` · `liquibase_conventions.md` · `testing_standards.md` · `integration_test_framework.md` · `frontend_conventions.md`
- **Builds directly on:** [`2026-07-07-prescribed-sets-hypertrophy-drive-design.md`](2026-07-07-prescribed-sets-hypertrophy-drive-design.md) (`mezo-dhdr`). This spec is the **v1 evolution that spec explicitly deferred**: its **D9** parked the RIR gate ("v1 gate can suppress load progression … v0 progresses on reps ≥ rep_max") and its **D2** rejected volume auto-regulation ("couples to the seed-only MEV→MRV system") for v0. We now build both.
- **UI preview (reviewed & approved 2026-07-25):** design-faithful browser mockups (visual-companion session) — active set-card `Progresszió` banner (3 states), prep-card delta chip + PrepHero day-summary, and the `Mezociklus áttekintő` volume-arc page + Mai/Gym entry chips. Tokens/layout approximated from `prototype.css`; coral Train vocabulary.

---

## 1. Goal

Make **progressive overload** a first-class, **mesocycle-aware, performance-driven** concept, and **signal the recommended value in-workout** on the set/exercise cards.

Progressive overload = *it gets harder week over week*, where "harder" is **+weight OR +reps** (both count; the engine picks the lever automatically) and, across the block, **+sets** (volume). The decision is **dynamic and driven by measured performance** — the athlete's actual logged weight, reps, and **RIR** vs the prescribed target — not a fixed pre-planned curve.

Three delivery pillars:

1. **Intensity engine** — evolve the existing double-progression (`SetRecommendationService`) to be **RIR-aware** (the lever — weight vs rep — is chosen from where the last set landed in the rep range *and* how much was left in the tank) and **phase-aware** (a deload/back-off week regresses instead of pushing).
2. **Volume engine** — **activate** the seed-only per-muscle `MEV/MAV/MRV` landmarks + `phaseCurve` so the **weekly working-set count actually ramps toward MRV per muscle** and backs off on deload — decided from last week's performance, **bounded by [MEV, MRV]**, with a **hybrid deload** (planned deload week is the baseline; the engine may pull it earlier when signals warrant).
3. **Surfacing** — a merged **`Progresszió` banner** on the active set card, a compact **delta chip + PrepHero day-summary** on the prep card, and a dedicated read-only **`Mezociklus áttekintő`** surface (progress header + volume-arc timeline) reachable from **Mai** and **Gym**.

Plus a **lightweight daily-challenge tie-in**: one deterministic "overload" challenge derived from the day's biggest recommended jump, fed into the existing proactive challenge flow.

---

## 2. Background — what exists today

- **Intensity (exists, v0).** `SetRecommendationService.prescribe()` (`backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SetRecommendationService.java`) runs **double progression** off the top working set of the most-recent completed session (`referenceWorkingSet`): `reps ≥ repMax → +increment kg`; `reps < repMin → −increment`; else *hold weight, cue +1 rep*. Emits `Prescription(List<PrescribedSet>, rationale)`. **It ignores the logged RIR and the mesocycle phase.** Tunables in `HypertrophyProperties` (`mezo.hypertrophy.*`): `plateStep` 2.5, `defaultIncrement` 2.5, `increment` per type (compound 5.0 / isolation 2.5), `warmupRamp`, `defaultWarmupSets`. Gated by `mezo.feature.hypertrophy-drive.enabled` via `HypertrophyDriveGate`.
- **Signals (exist).** The `.aistrip` rationale banner (below the excard), the prep `↑ {kg} kg-ról indul` starting-weight pill, and the `SetStepper` pre-fill all already surface the v0 target. `ActiveWorkoutPage.tsx` (`prep`/`active` phases), `PrepExerciseCard.tsx`, `PrepHero.tsx`, `logic/prepBriefing.ts`.
- **Volume (planned only, seed-only).** `MesocycleEntity` carries `startDate`, `endDate`, `weeks`, **`currentWeek`** (0-indexed, already present), `phaseCurve` (`List<String>` `text[]`, e.g. `[MEV,MEV,MAV,MAV,MRV,Deload]`), `status`. `MuscleGroupVolumeLogEntity` holds per-meso-per-muscle `mev`/`mav`/`mrv`/`currentSets` + a `ProvenanceEnvelope source` (jsonb). Per `train.md` these are **provenance/seed-only** — the Builder shows them (`PhaseDots`, `Volumen` view, `MuscleWeekSheet`) but **nothing ramps the weekly set count at runtime and deload doesn't regress live**. A template day's `exercise` row carries a single `workingSets` count (`ExerciseEntity.workingSets`, plus `warmupSets`, `repMin`, `repMax`, `targetRir`, `anchorWeightKg`, `muscle`).
- **Challenges (exist).** Proactive-owned, LLM-generated per day (PR/Depth/Volume): `feature/proactive/service/{ChallengeGenerator,ChallengeOutcomeEvaluator,ProactiveChallengeService,ChallengeJob}.java`; FE `data/train/challengeHooks.ts` + `ChallengesCarousel`/`ChallengeCard`. `ChallengeOutcomeEvaluator` already judges hit/miss from logged `exercise_set` rows.

---

## 3. Scope & non-goals

**In scope (this slice):** RIR-aware + phase-aware intensity engine; performance-driven weekly volume ramp bounded by MEV/MRV with hybrid deload; week-rollover recompute; the three surfacing changes; the lightweight challenge tie-in; API + FE wiring; feature-switched rollout.

**Non-goals (deferred, documented):**
- **Recovery auto-regulation** (sleep-anchor, `niggle`, pump/fatigue feedback into the volume decision) — Phase-3 signals; the engine is built so they can be added as extra inputs later. The volume decision here uses **only** completion + RIR (live-loggable today).
- **User-facing weight-vs-rep choice** — rejected in brainstorming; the lever is chosen automatically by the engine (§4). No config field, no in-workout toggle.
- **Full challenge integration** (systematically deriving all Volume/PR challenges from the plan) — only the single lightweight overload challenge here.
- **Rewriting the mesocycle Builder** into the new overview; the overview is a **read-only** surface that may share components with the Builder's `Áttekintés`/`Volumen` views but does not replace the editor.

---

## 4. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| **D1** | Progression is dynamic & performance-based | The engine reads **actual logged performance** (weight, reps, **RIR**) and prescribes a harder target next time. No fixed deterministic curve for intensity. Confirmed in brainstorming ("mindenképpen dinamikusan … számol teljesítmény alapján"). |
| **D2** | Performance signal | **Completion + RIR** — the signals logged **today** (`exercise_set.reps` + `exercise_set.rir` + `kind=working`). No Phase-3 recovery inputs in v1. |
| **D3** | Intensity lever chosen automatically | **Double progression, RIR-aware.** Reps within the range build first (weight holds), weight bumps at the top of the range; a set that was **easy** (RIR above target) accelerates, a **grind** (RIR at/below target, or missed reps) consolidates/backs off. No user choice (rejected). See the matrix in §5.1. |
| **D4** | Volume mechanism | **Performance-driven ramp** of the weekly working-set count per muscle, **bounded by [MEV, MRV]** landmarks. Not a static planned curve. `phaseCurve` becomes the *scaffold/expectation*, not a hard schedule. |
| **D5** | Ceiling & deload | **Hybrid.** Per-muscle **MRV is the ceiling**. The `phaseCurve` **Deload** week is the planned baseline, **but** the engine may **pull the deload earlier** when signals warrant (MRV reached **and** grind across ≥2 muscles, **or** ≥2 weeks of no productive progression). A pulled-early deload marks the current week as deload (~50% volume) **without** restructuring `phaseCurve`; the ramp resumes one step below the pre-deload level afterward. |
| **D6** | Where weekly targets live | **Compute, don't store per-set** (mirrors `mezo-dhdr` D1). Per-muscle **`MuscleGroupVolumeLog.currentSets`** is updated at week rollover to the resolved target for the current week (activating the seed-only field), with `source` provenance. The per-exercise **effective working-set count for the week is derived** at `GET /workouts/today` (never mutates the template `workingSets`). The **arc's** past/current bars = **aggregated logged working sets** per muscle per meso-week; future bars = the **scaffold projection**. No new table. |
| **D7** | Week advancement | A **`currentWeek` rollover** step advances the meso when the ISO Mon–Sun week passes the tracked week (checked lazily in `getToday`; idempotent). On rollover the **volume recompute** runs (reads last week's per-muscle performance → resolves each muscle's new `currentSets` within [MEV,MRV] → writes provenance) and the **deload trigger** is evaluated. Reuse any existing `currentWeek` write path if present. |
| **D8** | Set-card signal | **Merged `Progresszió` banner** (approved B2+C): label `⚡ Progresszió` + a delta chip (`+2,5 kg ↑` coral / `+1 rep ↑` green / `tartás` amber back-off), a two-cell **`Múlt hét → Ma a cél`** comparison, and a one-line **why**. Absorbs the current `.aistrip` rationale. Three states = weight-up / rep-up / hold-or-backoff. |
| **D9** | Prep-card signal | **Treatment A** (approved): per-exercise, next to the existing `↑ {kg} kg` starting-weight pill, a compact **delta chip** (`+2,5 kg` / `+1 rep`); **PrepHero** gains a **day-level overload summary** chip (`⚡ Túlterhelés: 3× +súly · 1× +rep`). |
| **D10** | Mesocycle overview surface | A **dedicated read-only** `Mezociklus áttekintő` page (approved): **progress header** (name · `W{n}/{weeks}` · phase · segmented progress bar · start / weeks-remaining / end meta) + the **volume-arc timeline** (per-muscle switch, actual-solid vs planned-dashed bars, deload drop, current week highlighted, MRV caption). **Entry chips** from **Mai** (a `🗓 … W3/6 →` card) and **Gym** (a `📈 Mezociklus W3/6 →` header chip). |
| **D11** | Challenge tie-in | **Lightweight** (approved). At prep, derive **one** deterministic `overload` challenge from the day's **biggest recommended jump** (largest `+kg`, else a meaningful `+rep`), targeting that exercise; feed it into the existing proactive challenge accept/decide + `ChallengeOutcomeEvaluator` flow. Deterministic (not LLM) → honest/grounded. |
| **D12** | Feature switch | Reuse the existing **`mezo.feature.hypertrophy-drive.enabled`** gate for the RIR-aware intensity change (it already guards `prescribedSets`). Add **`mezo.feature.volume-progression.enabled`** (`FeaturesConfiguration` constant + `@ConditionalOnProperty` gate, mirroring `HypertrophyDriveGate`) for the volume ramp + rollover + overview data, so intensity and volume can ship/toggle independently. New tunables under `mezo.hypertrophy.*` (increments already there) and a new `mezo.volume.*` block for the ramp step + deload fraction + trigger thresholds. Never `@Value`. |
| **D13** | Mock parity | Every new write (rollover recompute, challenge decide) **no-ops in mock**; every new read serves a static fixture so mock mode stays byte-identical (house rule). The overview page, banner, and chips render from fixtures in mock. |

---

## 5. Engine design

### 5.1 Intensity — RIR-aware double progression (`SetRecommendationService`)

Extend `prescribe()`. The reference is still the top working set of the most recent completed session, now read **with its `rir`**. Let `rp` = its reps, `rir` = its logged RIR, `target` = `ex.targetRir`, `slack = rir − target` (positive ⇒ easier than intended), `inc` = the type increment.

| Last set landed… | RIR slack | Lever | Rationale line (HU) |
|---|---|---|---|
| `rp ≥ repMax` | any | **+weight** `+inc`, reps reset toward `repMin` | „Múlt hét {rp}×{w} kg a tartomány tetején → +{inc} kg" |
| `repMin ≤ rp < repMax` | `slack ≥ 1` (könnyű) | **+rep** → target `rp+1` (weight holds) | „Múlt hét könnyen ment (RIR {rir}) → +1 rep" |
| `repMin ≤ rp < repMax` | `slack ≤ 0` (célon/grind) | **hold** weight & reps (consolidate) | „Múlt hét RIR {rir} a célon → tartás, konszolidálás" |
| `rp < repMin` | `slack < 0` (grind) | **−weight** `−inc` | „Múlt hét {rp} rep a cél alatt, grind → −{inc} kg" |
| `rp < repMin` | `slack ≥ 0` | **hold** | „Súly tart, cél a tartomány alja" |
| weightless history (plyo/bw) | — | **+rep** (as today) | „Testsúlyos — ismétlésre progresszálunk" |
| no history, has anchor | — | anchor as base | „Kezdő súly (anchor)" |

**Phase awareness:** when the current meso week resolves to **Deload/back-off** (§5.2), the intensity prescription **regresses**: working weight = `~0.9 × base` (or holds) and target reps drop to `repMin`, rationale „Deload hét — visszaveszünk". This is the third banner state.

The service returns, in addition to the existing `Prescription`, a structured **`ProgressionSignal`** per exercise (so the FE never re-derives): `{ lever: weight|rep|hold|deload, deltaKg?, deltaReps?, previous:{weightKg,reps,rir}|null, targetWeightKg, targetReps, rationale }`.

### 5.2 Volume — performance-driven weekly ramp (`VolumeProgressionService`, net-new)

New `@Service VolumeProgressionService` (+ `@ConditionalOnProperty` gate). Runs at **week rollover** (D7). For each muscle `m` in the active meso:

- **Inputs:** landmarks `mev/mav/mrv` (`MuscleGroupVolumeLog`), `phaseCurve[currentWeek]`, and **last week's performance** = the muscle's completed working sets and whether they were **productive** (reps hit at/above target with `rir ≥ target` on most sets) vs **grind** (`rir < target` / missed reps on most sets).
- **Ramp rule (bounded):**
  - Week 1 → start at `mev`.
  - Productive last week & below `mrv` → `currentSets += volumeStep` (default **+2**, `mezo.volume.step`), clamped to `mrv`.
  - Grind, or already at `mrv` → **hold**.
  - `phaseCurve[currentWeek] == "Deload"` **or** the early-deload trigger (D5) → `currentSets = round(deloadFraction × currentSets)` (default **0.5**, `mezo.volume.deload-fraction`).
- **Early-deload trigger:** `MRV reached on ≥ deloadMuscleThreshold muscles AND grind on those` **OR** `stagnationWeeks ≥ 2` (no productive progression). Thresholds under `mezo.volume.*`.
- **Persist:** write the resolved `currentSets` + a `ProvenanceEnvelope source` (what drove the change — landmark baseline + performance adjustment) to `MuscleGroupVolumeLog`. This is the seed-only field going **live**.

**Distribution to exercises (derived at `getToday`, D6):** the week's per-muscle `currentSets` target is distributed across that muscle's working exercises in the day template — proportional to their template `workingSets` baseline, remainder added to the largest — yielding an **effective working-set count** per exercise for the current week. The template is **not** mutated; `makeSession`/prescription consume the effective count. (Deload weeks naturally shrink it.)

### 5.3 The volume arc data (`GET .../volume-arc`)

Per muscle, for the arc: `weeks[w] = { weekIndex, phase: phaseCurve[w], planned, actual, isCurrent }` where
- `actual` (past+current weeks) = **aggregated logged working sets** for that muscle in meso-week `w` (join `exercise_set kind=working` → `exercise.muscle`, → instance date → meso-week bucket);
- `planned` (future weeks) = the **scaffold projection** (`mev` at week 1 ramping by `step` toward `mrv`, deload week = `deloadFraction`), clamped to `mrv`;
- plus `mrv` (ceiling) and the meso progress meta already on `MesocycleEntity` (`currentWeek`, `weeks`, `startDate`, `endDate`, `status`, phase).

---

## 6. Data model & migration

**No new tables.** Reused: `MesocycleEntity.currentWeek/phaseCurve/startDate/endDate/weeks`, `MuscleGroupVolumeLogEntity.currentSets/source`, `ExerciseSetEntity.rir/kind`, `ExerciseEntity.*`.

- `MuscleGroupVolumeLog.currentSets` transitions from **seed-only** to **engine-written** (per week, with provenance). No column change; a Liquibase changeset is only needed if we add the `mezo.volume.*`-derived defaults as seed adjustments — otherwise **none**. Confirm during implementation; if a changeset is required it follows `liquibase_conventions.md` naming `{YYYYMMDDHHMM}_mezo-5pfe_{desc}.sql`, immutability rules, and `ResetDatabase`/populator updates only if a table is added (not expected).
- `exercise_set.rir` must be reliably present on **working** sets for the reference read — it is (logged in `active`, absent only on warmups by design). The engine reads the latest completed working set's `rir`; null RIR (older rows) → treat as `slack = 0` (neutral).

---

## 7. API contract changes (`api/feature/train/train.yml`, contract-first)

1. **`GET /workouts/today`** — per exercise, add **`progression: ProgressionSignal`** (§5.1 shape) alongside the existing `prescribedSets` + `rationale` (rationale becomes `progression.rationale`; keep the top-level field for one release for FE compat, then remove). Day-level: add **`overloadSummary: { weightUp, repUp, hold }`**.
2. **New `GET /train/mesocycles/{id}/volume-arc`** → `{ meso: {id,title,currentWeek,weeks,startDate,endDate,status,phase}, muscles: [{ muscle, mrv, weeks: [{weekIndex,phase,planned,actual,isCurrent}] }] }`. Read-only, ownership-filtered.
3. **Challenge** — the lightweight overload challenge reuses the existing proactive challenge DTO/flow (a new `source`/`type` discriminator value `overload`); see `proactive.md`. No new endpoint.

Regenerate: `api/generate` → `frontend pnpm generate:api` (FE types); backend Java types regenerate in `generate-sources`. FE request/response typed from `src/data/_client/api.gen.ts` (`satisfies`), never hand-written.

---

## 8. Frontend

All Train reads/writes stay behind `@/data/hooks`; dual-mode via `useDualQuery`; no signature changes to existing hooks where avoidable. Read `frontend_conventions.md` first.

- **Set card `Progresszió` banner** (`ActiveWorkoutPage.tsx` active phase). New presentational **`ProgressionBanner`** in `features/train/components/` rendering the `progression` signal (three states). It **replaces the `.aistrip`** rationale strip in the excard. Pure view over `useTrain().workoutToday[ex].progression`. New CSS family `.pobanner`/`.cmp-cells` in `prototype.css` (design-system doc §3/§7).
- **Prep card** (`PrepExerciseCard.tsx`) — add the delta chip next to the start-weight pill from `progression.delta*`. **PrepHero** (`PrepHero.tsx` / `logic/prepBriefing.ts`) — add the day-level `overloadSummary` chip.
- **`Mezociklus áttekintő`** — new read-only page `features/train/pages/MesoOverviewPage.tsx` at a full-screen sibling route (e.g. `/train/mesocycles/:id/overview`, no sub-nav), composed of `MesoProgressHeader` + `VolumeArcChart` (per-muscle switch) components in `features/train/components/`. New hook `useMesocycleVolumeArc(id)` (`data/train/`), dual-mode. May share small pieces with the Builder's `Volumen` view but is not the editor.
- **Entry chips** — `TrainTodayPage.tsx` (a `MesoProgressChip` card in the Mai composition) and `GymPage.tsx` (a header chip beside `Időpontok`/`+ Saját`), both navigating to the overview route; both show `W{n}/{weeks}` at a glance. Ghost when no active meso.
- **Challenge** — the overload challenge renders through the existing `ChallengesCarousel`/`ChallengeCard` unchanged (it is just another challenge in the list).

---

## 9. Testing

- **Backend (integration-first, `testing_standards.md` + `integration_test_framework.md`):** `SetRecommendationServiceIT` — one test per row of the §5.1 matrix (`testPrescribe_shouldAddWeight_whenRepsAtTopAndRirSlack`, `…shouldHold_whenGrind`, `…shouldRegress_whenDeloadWeek`, etc.) via `*Populator` history. `VolumeProgressionServiceIT` — ramp `+step` on a productive week, hold at MRV, planned deload, **early-deload trigger**, MEV floor, week-1 start; assert `currentSets` + provenance with AssertJ. `WorkoutServiceIT` — `getToday` carries `progression` + `overloadSummary` + the effective per-exercise working-set count for the current week; switch-off → null. Week-rollover idempotency. Volume-arc endpoint (`ApiIntegrationTest` verb helpers, `ownerAuthHeaders()`): actual/planned split, current-week flag. No mocks/H2.
- **Frontend (both modes green):** `ProgressionBanner` render tests for the 3 states; `PrepExerciseCard`/`PrepHero` delta + summary; `MesoOverviewPage` progress header + arc (actual solid / planned dashed / deload / current). Gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Challenge:** `ChallengeOutcomeEvaluatorIT` covers the `overload` challenge hit/miss from logged sets; generator emits exactly one, from the biggest jump.

---

## 10. Rollout & docs

- Ship behind switches (D12): intensity change under the existing `hypertrophy-drive`, volume + overview + rollover under new `volume-progression`. Demo fixtures (`demodata`/`demofixtures`) show a meso mid-ramp (e.g. W3/6 MAV) so the overview + banners have real-looking data.
- On ship, update **`train.md`** (§2 set-card/prep/overview surfaces + Mai/Gym entry, §3 the two engine services, §4 the new fields/endpoint, §9 the RIR/volume behavior — remove the "seed-only" caveat on `MuscleGroupVolumeLog`/volume-recompute), **`proactive.md`** (overload challenge), **`roadmap.md`**. Run `node scripts/lint-docs.mjs`.

## 11. Open questions / implementation-time confirmations

1. **`currentWeek` write path** — confirm whether any code already advances it (planner/lifecycle) to reuse vs. add the rollover in `getToday`. (D7 assumes lazy-in-`getToday`.)
2. **Meso-week bucketing** — define week `w` boundary precisely (from `startDate`, Mon–Sun aligned vs. `startDate`-anchored 7-day blocks) and reuse the same helper for `actual` aggregation and rollover.
3. **Effective-set distribution rounding** — when a muscle's target isn't divisible across its exercises, confirm the "remainder to the largest" rule reads acceptably in the Builder/overview.
4. **Deload resume level** (D5) — confirm "resume one step below pre-deload" vs. "resume at pre-deload" after a pulled-early deload.
