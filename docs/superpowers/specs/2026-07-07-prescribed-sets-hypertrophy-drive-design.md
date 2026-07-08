# Prescribed Sets + Hypertrophy Drive (design spec)

- **Date:** 2026-07-07 · **bd:** `mezo-dhdr` · **Domain:** Train (Gym sub-model)
- **Living doc to update on ship:** [`docs/features/train.md`](../../features/train.md) §2/§4/§9
- **Design references (mandatory):** `spring_patterns.md` · `liquibase_conventions.md` · `api_contract_conventions.md` · `configuration_conventions.md` · `testing_standards.md` · `integration_test_framework.md`
- **UI preview (reviewed & approved):** design-faithful mockup Artifact — active-workout before/after, builder recipe editor, day-card summary, plyo + records. Fonts approximated (CSP), tokens/layout/components verbatim from `prototype.css`.

## 1. Goal

Replace **ad-hoc, one-at-a-time set logging** with **pre-populated prescribed sets**. At plan time the user
defines a *recipe* per exercise — how many **warmup** and **working** sets, the rep range, the target RIR.
At workout start every set is already there, each filled with a **dynamically computed** target weight & reps
(the *Hypertrophy Drive*): 6–8 reps, 2–3 hard working sets to failure (RIR 0), the load auto-progressed from
history via **double progression**. Adding a set mid-session stays possible but becomes the exception, not the base.

This folds **P3** (per-set warmup/working structure + pre-population UX) and **P4** (the recommendation engine)
into one slice, because the auto-computation *is* the point — a manual-entry P3 alone has no reason to exist.

**Current model (what changes).** Today a template `exercise` carries a single `sets` count + one `target_reps`
string ("8-12") + `target_rir`; concrete sets are inserted one-by-one during a live instance via `POST
/workouts/{id}/sets` (`WorkoutService.logSet`), with no warmup/working distinction and only a static UI hint
(`ActiveWorkoutPage.tsx:729`, "+2.5–5 kg ma logikus"). There is **no** recommendation service — the nearest
assets are the Epley e1RM aggregation (`ExerciseRecordService`) and the top-set `lastWeekRefs`
(`WorkoutService`). This slice builds the engine net-new.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Where do target numbers live? | **Recipe on the template + numbers computed on-the-fly** (Approach A). The `exercise` row stores the *structure*; the engine computes concrete per-set weight/reps at `GET /workouts/today`. **No `prescribed_set` table** — a stored per-set target would duplicate a value that is a pure function of history and drift out of sync. Trade-off accepted: "what was recommended" is not an audited snapshot, but it is deterministically re-derivable. |
| D2 | Progression model | **Double progression on the top working set** (weight-based; rep-based fallback when weightless). Matches the user's mental model ("6-8 to failure, then add load"), runs on data already captured, and needs no Phase-3 volume engine. e1RM-% (noisy from high-rep failure sets) and RP feedback-autoregulation (couples to the seed-only MEV→MRV system) **rejected for v0**. |
| D3 | Recipe shape | On `exercise`: `warmup_sets` (int≥0), `working_sets` (int≥1, ex-`sets`), `rep_min`/`rep_max` (int, ex-`target_reps`), `target_rir` (int, **kept**), `anchor_weight_kg` (numeric nullable). Replaces the `sets`/`target_reps` pair. Scalars, not jsonb — 5 flat queryable fields. |
| D4 | Set classification | `exercise_set.kind ∈ {warmup, working}` (default `working`). **All** working-only readers filter on it: `ExerciseRecordService` (e1RM/best-set/volume), `WorkoutService.lastWeekRefs`, `GymSignalCalculator` (progression XP), and the engine's own history read. Warmups are logged for completeness but never pollute records or drive progression. |
| D5 | Warmup numbers | `%`-ramp of the computed working weight `B` (config table, default `[50%×rep_max, 75%×⌈rep_max/2⌉]` for 2 warmups; rounded to the plate step). Purely derived — never user-typed. When `B` is null (weightless / no basis), warmups are null too (typically `warmup_sets=0` for plyo). |
| D6 | First session (no history) | Optional `anchor_weight_kg` seed on the recipe → used as `B` for the first session. No anchor → `B = null` → the logger prefills blank and the user types the actual once; every subsequent session is auto-computed from that logged history. |
| D7 | Plyo / bodyweight | **Weightless when no weight basis** (`B` resolves null): `targetWeightKg = null`, reps-only prescription, box height goes in the exercise `note`. The rule keys on *whether a weight basis exists* (history/anchor), so weighted plyo (DB jump) still progresses load; unweighted plyo (box/depth jump, single-leg plate hops) runs reps-only. No structured box-height field in v0. |
| D8 | When computed & switch-off | Computed in `WorkoutService.getToday`, per exercise, from **completed-instance history only** → stable within a live session (resume-safe; the open instance isn't yet completed). Feature switch **off** → `prescribedSets = null` → the UI falls back to today's ad-hoc logger unchanged. |
| D9 | Increment & RIR gate | `increment` by exercise `type` from config (compound **5 kg**, isolation **2.5 kg**), rounded to the plate step (2.5). The **rep count is the progression signal** (target RIR = 0, i.e. failure); `rir` is stored and used only as an informational refinement (a set logged with high RIR wasn't truly to failure — a v1 gate can suppress load progression there; v0 progresses on reps ≥ `rep_max`). |
| D10 | Feature switch & config | `mezo.feature.hypertrophy-drive.enabled` + `FeaturesConfiguration.HYPERTROPHY_DRIVE` constant + a `@ConditionalOnProperty` `HypertrophyDriveGate` bean injected via `ObjectProvider` (mirrors the existing `ProgressionGate`). Tunables under **`mezo.hypertrophy.*`** → `@Validated HypertrophyProperties` record. Never `@Value`. |
| D11 | Migration | One changeset: `exercise` rename `sets`→`working_sets`, add `warmup_sets`/`rep_min`/`rep_max`/`anchor_weight_kg`, parse `target_reps`→`rep_min`/`rep_max`, drop `target_reps`; `exercise_set` add `kind` (default `working`, CHECK). **No new tables** → `ResetDatabase` TRUNCATE list unchanged. |
| D12 | Out of scope (deferred) | Weekly volume ramp (RP MEV→MRV auto set-count progression); pump/joint/workload feedback feeding the load calc; structured box-height; rep auto-progression for weightless exercises; the deprecated static UI hint is removed, not kept. |

## 3. The recommendation engine (`SetRecommendationService`)

New service in `feature/train/service/`, gated by `HypertrophyDriveGate`. Per template exercise it returns
`List<PrescribedSet>` for the upcoming session. Pure read; no `@Transactional`.

**Inputs**
- Recipe: `warmupSets W`, `workingSets K`, `repMin`, `repMax`, `targetRir` (default 0), `anchorWeightKg A?`.
- History: the most-recent **completed** instance of this exercise identity (by `catalog_id` else `name`, reusing
  `ExerciseRepository.findIdentityRowsIncludingDeleted` + the `lastWeekRefs` path), its **working** sets only
  (`kind='working'`, `skipped=false`). Reference set = top working set (max weight; tie → max reps): `(Wp, Rp)`.

**Working weight `B`**
```
if history exists:
    if   Rp >= repMax        B = Wp + inc(type)     # reached top of range → add load
    elif Rp <  repMin        B = Wp − inc(type)     # missed bottom → shed load
    else                     B = Wp                 # in range → hold, chase +1 rep
elif A != null:              B = A                   # first session seed
else:                        B = null                # first session, no seed → blank prefill
B = clamp(roundToStep(B, step), 0, 999)             # step = mezo.hypertrophy.plate-step (2.5)
inc(type): mezo.hypertrophy.increment[type]  (compound 5.0 · isolation 2.5)
```

**Warmup sets** (`i = 1..W`), from `B`:
```
weight_i = roundToStep(B × ramp[i].pct, step)     reps_i = ramp[i].reps
ramp default (config): [{pct:.50, reps:repMax}, {pct:.75, reps:⌈repMax/2⌉}]
if B == null → no warmup targets (weightless)      # plyo typically W=0
```

**Working sets** (`j = 1..K`): `weight = B` (nullable), `targetReps = repMax` (the aim; UI shows the
`repMin–repMax` range from the recipe), `targetRir = targetRir`. All working sets identical.

**Weightless branch** (`B == null`, e.g. unweighted plyo): every set `targetWeightKg = null`; working `targetReps
= repMax`; progression is rep-based hold at `repMax` (auto rep-bump deferred, D12).

**Output** `PrescribedSet { kind, targetWeightKg?, targetReps, targetRir }[]` + a short `rationale` per exercise
(e.g. `"Múlt hét 8 × 77.5 kg → +2.5 kg"`) surfaced on `TodayExercise` to replace the static hint.

## 4. Data model & migration

Changeset `{YYYYMMDDHHMM}_mezo-dhdr_prescribed_sets.sql` (explicit `ck_`/`idx_` names, per conventions):

**`exercise`** (`ExerciseEntity`)
- rename `sets` → `working_sets` (INT NOT NULL)
- add `warmup_sets` INT NOT NULL DEFAULT 0
- add `rep_min` INT, `rep_max` INT — backfill by parsing `target_reps` (`"a-b"`→a,b; `"a"`→a,a; null→8,12), then NOT NULL
- add `anchor_weight_kg` NUMERIC(6,2) NULL
- keep `target_rir` (already NOT-null-able as today)
- drop `target_reps`
- (type CHECK already includes `plyo` — unchanged)

**`exercise_set`** (`ExerciseSetEntity`)
- add `kind` VARCHAR(7) NOT NULL DEFAULT 'working' + `ck_exercise_set_kind` CHECK (`kind IN ('warmup','working')`); existing rows adopt the default.

No new tables. `ResetDatabase` unchanged. `TrainSeedData` (`demofixtures`), `TrainPopulator`, and any
`MesocycleCreateRequest` test fixtures updated to the new recipe fields. `exercise-catalog.json` untouched
(the recipe lives on the meso-day exercise, not the catalog).

## 5. API contract (`api/feature/train/train.yml`, contract-first)

- **`GymExercise` / `GymExerciseInput`:** drop `sets`, `targetReps`; add `warmupSets` (int≥0), `workingSets`
  (int≥1), `repMin` (int), `repMax` (int), `anchorWeightKg` (number, nullable). `targetRir` kept.
- **new `PrescribedSet`** `{ kind: enum[warmup,working], targetWeightKg?: number(0–999), targetReps: int(1–100), targetRir: int(0–5) }`.
- **`TodayExercise`:** carry the recipe fields (`warmupSets/workingSets/repMin/repMax/targetRir/anchorWeightKg`)
  + `prescribedSets: PrescribedSet[]?` (null when switch off) + `rationale: string?`.
- **`SetLogRequest`:** add `kind: enum[warmup,working]` (default `working`).
- **`ExerciseSetResponse`:** add `kind`.
- **`MesocycleCreateRequest.days[].exercises[]`** uses the new `GymExerciseInput`.

Regenerate: `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api` → BE `generate-sources`.
Errors reuse the Train `SystemMessage` codes; validation bounds mirror the existing `logSet` clamps.

## 6. UI (frontend, dual-mode + both test modes)

**Plan time — set-structure editor** (`features/train/components/`, consumed by `MesoExercises` /
`ExerciseEditRow` expand + `ExercisePickerSheet` add-flow): replace the single sets/reps input with steppers for
**warmup** & **working** counts, a rep-range picker (default 6–8), target RIR (default 0), and an optional
**anchor** weight (`auto` placeholder). Collapsed rows + planner "Áttekintés" show the recipe summary
(`"2+3 · 6-8 · RIR 0"`).

**Active workout — pre-population** (`ActiveWorkoutPage.tsx` + `logic/workoutState.ts`): seed the session from
`TodayExercise.prescribedSets` instead of an empty list. Render **all** sets up front — warmups (amber `kind`
chip, muted) then working (teal) — with each row pre-filled to its target; the current set expands to the
`CompactStepper` (prefilled to the recommendation) + RIR row + "Set kész", logging with `kind`. Set-dots gain
warmup styling; the dashed extra-set dot + `addExtraSet` (default `working`) stay. The static hint
(`ActiveWorkoutPage.tsx:729`) is replaced by `rationale`. `workoutState.ts`'s `planned` count becomes a typed
prescribed-set list; `seedFromOpen` overlays logged actuals by `setIndex`.

**Records** (`ExerciseRecordService` + FE record sheet): working-only filtering; a small note that warmups are
excluded from e1RM.

## 7. Config (`application.yml`, `mezo.` root)

```
mezo:
  feature:
    hypertrophy-drive:
      enabled: true            # FeaturesConfiguration.HYPERTROPHY_DRIVE + @ConditionalOnProperty gate
  hypertrophy:
    plate-step: 2.5
    increment: { compound: 5.0, isolation: 2.5 }
    warmup-ramp:
      - { pct: 0.50, repsFrom: max }        # → repMax
      - { pct: 0.75, repsFrom: half }       # → ⌈repMax/2⌉
    default-warmup-sets: 2
```
`@Validated HypertrophyProperties` record in `feature/train/config`. No hardcoded tunables; never `@Value`.

## 8. Testing

**Backend (integration-first, Postgres, AssertJ, populators):**
- `SetRecommendationServiceIT` — double-progression branches (Rp≥max → +inc; <min → −inc; in-range → hold),
  weightless/plyo (null weight, reps-only), first-session anchor vs blank, warmup ramp %, switch-off passthrough.
- `WorkoutServiceIT` / `WorkoutContractIT` — `prescribedSets` + `rationale` in `GET /workouts/today`; `logSet`
  persists `kind`; resume stability.
- `ExerciseRecordServiceIT` — warmup sets excluded from e1RM/best-set/volume.
- `TrainServiceIT` — meso create/day-edit round-trips the new recipe fields.

**Frontend (vitest, both `VITE_USE_MOCK` modes green + `pnpm build`):** active-workout pre-population from
`prescribedSets`, set-structure editor, warmup/working rendering + `kind` on logSet, mock fixtures updated to the
recipe shape. Plus Playwright parity.

## 9. Out of scope / follow-ups

Weekly RP volume ramp (MEV→MRV auto set-count), feedback-driven load autoregulation, structured box-height,
weightless rep auto-progression, and a stored per-session prescription snapshot (D1 trade-off) are deferred —
file as bd follow-ups if wanted.
