# Train style & techniques — T1: style and progression — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach every catalog exercise what it is (equipment, stable or free, safe in the stretch), let a block carry
a training style that stamps rep range / sets / reserve / rest onto its exercises, and make load progression
rep-range aware, effort-ramped across a styled block, and aware of muscles that stopped moving. No techniques (T2).

**Architecture:** Three pure units decide (`StyleTable` + `StyleStamper`, `EffortRamp`, `MuscleStallDetector`) and
`ProgressionDecider` gains a range conversion; thin services persist the style on the template document and the run
rows, snapshot the trained range on each logged set, and hand a `StyleContext` to `SetRecommendationService`.
**A block without `trainingStyle` is prescribed exactly as today**; the one change everyone gets is the
rep-range-aware reference (a bug fix, scoped so that it only fires where the old judgement was wrong).

**Tech Stack:** Java 21, Spring Boot, JPA/Hibernate, Liquibase (`1.1.0/`), PostgreSQL, JUnit 5 + Testcontainers;
contract-first OpenAPI (`api/feature/train/train.yml` → `api/openapi.yml` → generated DTOs + `frontend/src/data/_client/api.gen.ts`).

**Spec:** `docs/superpowers/specs/2026-11-17-train-style-and-techniques-design.md` §6.1, §6.2, §6.7, §7 slice T1, and
§11 (resolutions 1 *sets part only*, 3, 5 *detection only*; the range-snapshot and carry-over corrections). bd
`mezo-r36n9.79`, epic `mezo-r36n9`. Plan 5 of 8 in the programme (hand-over
`docs/superpowers/plans/2026-11-18-volume-engine-programme-handover.md`). Runs in parallel with S2
(`mezo-r36n9.77`); S3 waits for this slice.

## Decisions this plan makes (spec §10 "left to the builder")

| Question | Decision |
|---|---|
| Classification of the 166 master rows | Explicit per-slug list in `content/exercise-catalog.json` — 57 `stable`, 23 `lengthened_friendly`; table reviewed by the owner before it lands (Task 2). Borderline rule: standing free-weight work (DB laterals, standing curls, single-arm DB row) is `free`; seated / chest-supported / preacher work is `stable`. |
| `overrides` representation | jsonb `List<String>` on the exercise row and the template json; values `repRange`, `workingSets`, `targetRir`, `restSec`. |
| Who declares an override | The client (`overrides[]` on `GymExerciseInput`). The server stamps every non-overridden field of a styled exercise on every save. A web save of a styled block (the web never sends a style) carries the style fields over from the stored exercise (§11 correction), so its row values are re-stamped — documented trap, the web is frozen. |
| "Legs" in *Kiegyensúlyozott* reserve 3 | Compound exercises whose coarse group is quad, ham or glute. |
| Effort ramp thirds | Loading weeks `L` = weeks whose phase is not `Deload`; position `p` = 1-based index of the current week among them. `p ≤ ⌈L/3⌉` → base; `p < L` → base − 1; `p = L` → max(0, base − 2); a deload week → base + 2. Floors: never below 0; never below 1 on a `free` exercise. Examples: 6-week block with one deload (L = 5): 2,2,1,1,0,+4 for base 2. |
| Rep-range-aware reference (§6.7.1) — when to convert | Reference = newest completed instance of the identity **whose trained range equals the current one**, if it is at most `same-range-max-age-days` (56) old; else the newest instance overall. A different-range reference is **converted** only when its top set's reps lie **inside its own range and outside the current one** (the case the old judgement got wrong); otherwise it is judged as today. Trained range = the set's snapshot (`target_rep_min/max`), else the range of the exercise row the set was logged on. |
| Conversion target | The current range's floor at the effective reserve: wanted kg = e1RM(ref) / (1 + (repMin + rir)/30), nearest real weight (ever-logged ∪ plate grid − known gaps, the reference weight included), reps by equal effort clamped to the range. |
| Per-style overshoot (`repOverflow`) | balanced 3 · volume 4 · heavy 2 · allout 2 (unstyled stays `mezo.hypertrophy.rep-overflow` = 3). |
| Grind when the ramped reserve is 0–1 (§11.3) | Styled blocks only: grind = logged reps ≤ the set's prescribed reps (`target_reps` snapshot) − 2; slack otherwise max(0, loggedRIR − target). Unstyled: unchanged. |
| Stall detection (§6.7.4, §11.5) | Detection only in T1: pure `MuscleStallDetector` + `MuscleProgressReader` (styled runs only). The offers (technique / range change / one-week reduction) are T3. Surfacing as a weekly-proposal audit reason `stalled` is Task 9b **only if the S2 session agrees** to the `WeekProposalService` touch; otherwise T3 wires it. |
| Mid-run style change | Not in T1 (no endpoint). The run inherits the template's style at start; a run day edit re-stamps under the run's style. |
| Free exercise under *Két sorozat bukásig* | Stamped as *Nagyobb súly* with reserve 1; the response's read-only `effectiveTrainingStyle` = `heavy` lets the client show why. |

## Global Constraints

- Direct sets only (ADR 0021). A template is a jsonb document; only a run has exercise rows (ADR 0027). A new exercise
  field reaches `GymExerciseJson`, `TrainService.toExerciseEntity`, the rerun materialisation (`TrainMapper` run rows →
  recipe), `WorkoutExerciseChangeService`, and the response mappers.
- Contract changes are **additive and optional only**. Every existing request/response stays valid; the web client
  sends none of the new fields and must keep working with zero frontend code change (only `api.gen.ts` regenerates).
- Tunables live in a new `@Validated` record `TrainStyleProperties` (`mezo.train.style`), never literals. **No change to
  `VolumeProperties` / `mezo.volume`, `ResetDatabase` or `WeekProposalService`** (hot spots — see the S2 agreement on
  bd `mezo-r36n9.77`/`.79`), except Task 9b if agreed.
- Everything about style (stamping, ramp, rest, per-style overflow, ramped grind, stall detection) is a no-op when the
  block's `trainingStyle` is null. The rep-range-aware reference is the only behaviour change for unstyled blocks.
- The engine stays behind `HypertrophyDriveGate`; switch off ⇒ no prescription at all, as today.
- History is by identity (catalog id, else exact name), never by row id; a day edit re-mints exercise UUIDs.
- ArchUnit: no raw generic exceptions outside techcore (exhaustive switch / `SystemRuntimeErrorException`); layer
  subpackages enforced (pure units in `service/`, config in `config/`).
- Liquibase: plain SQL, one changeset per file, registered at the end of `1.1.0_master.yml`; no bare `?` in jsonb SQL.
- Backend test command, per task: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=<Class>`.
  One Maven process per working tree. Before merge: `-Dtest=ArchitectureTest` and the full suite with the flag.
- Conventional commits carrying `(mezo-r36n9.79)`.

## Review Focus

1. **The owner's active run is unchanged.** It has no style; its six exercises whose last trained range differs from
   today's either sit inside today's range or were already outside their own range, and the two older same-range
   instances are older than 56 days. → Task 5 tests `inRangeDifferentRangeReferenceIsJudgedAsToday`,
   `outOfOwnRangeReferenceIsNotConverted`, `staleSameRangeInstanceIsIgnored`; Task 10 production query.
2. **Monday 6–10 / Thursday 12–15 of one lift** each progress from their own last session. → Task 5
   `twiceAWeekDifferentRangesUseTheirOwnReference`.
3. **A web save of a styled template** keeps the style fields (carry-over) and does not wipe overrides. → Task 4
   `webSaveCarriesStyleFieldsOver`.
4. **An all-out block with a free exercise**: stamped heavy + reserve 1, never reserve 0, never below 1 when ramped.
   → Task 3 `alloutOnFreeFallsBackToHeavy`, Task 7 `freeNeverBelowOne`.
5. **A legacy set with no snapshot** resolves its range from its own (possibly soft-deleted) exercise row. → Task 5
   `legacySetUsesItsRowRange`.

## File structure

Created under `backend/src/main/java/io/mrkuhne/mezo/feature/train/`:

| File | Responsibility |
|---|---|
| `config/TrainStyleProperties.java` | `mezo.train.style`: the style table, ramp deltas, same-range max age, stall weeks |
| `service/TrainingStyle.java` | enum `BALANCED, VOLUME, HEAVY, ALLOUT` + wire values |
| `service/ExerciseClass.java` | enum `COMPOUND_STABLE, COMPOUND_FREE, ISOLATION` from `type` + `stability` (plyo → none) |
| `service/StyleTable.java` | pure: (style, class, legs) → `Stamp(repMin, repMax, workingSets?, reserve, restSec, repOverflow, effectiveStyle)` |
| `service/StyleStamper.java` | pure: stamp a `GymExerciseJson` under a block style, keeping `overrides` |
| `service/EffortRamp.java` | pure: effective reserve for (base, week, phaseCurve, free) |
| `service/StyleContext.java` | record handed to `SetRecommendationService` |
| `service/MuscleStallDetector.java` | pure: per-muscle stalled flag from weekly top-set series |
| `service/MuscleProgressReader.java` | read-only: per coarse group, per exercise identity, the logged top set per run week |
| `service/CatalogAttributes.java` | small read helper: catalog id → (equipment, stability, lengthenedFriendly), default `other/free/false` |

Created elsewhere: `db/changelog/1.1.0/script/202611181200_mezo-r36n9.79_train_style.sql`.

Modified: `api/feature/train/train.yml`, `api/openapi.yml` (generated), `frontend/src/data/_client/api.gen.ts`
(generated), `content/exercise-catalog.json`, `ExerciseCatalogLoader`, `entity/{ExerciseCatalogEntity,
MesoTemplateEntity,MesocycleEntity,ExerciseEntity,ExerciseSetEntity}.java`, `entity/json/GymExerciseJson.java`,
`service/{ExerciseCatalogService,MesoTemplateService,TrainService,WorkoutService,WorkoutExerciseChangeService,
SetRecommendationService,ProgressionDecider,ExerciseHistoryResolver}.java`, `mapper/TrainMapper.java`,
`repository/{ExerciseRepository,ExerciseSetRepository}.java`, `application.yml` (new `mezo.train.style` block only),
`db/changelog/1.1.0/1.1.0_master.yml` (one appended entry).

---

### Task 1: Contract (hot spot — hold it briefly)

**Files:** `api/feature/train/train.yml`; regenerate `api/openapi.yml` (`cd api/generate && npm run generate:api`) and
`frontend/src/data/_client/api.gen.ts` (the frontend's generate script, as `ci.yml` line ~89 checks).

**Interfaces (all optional, nullable where noted):**
- New schemas: `TrainingStyle` enum `[balanced, volume, heavy, allout]`; `Equipment` enum
  `[machine, cable, dumbbell, barbell, bodyweight, kettlebell, other]`; `Stability` enum `[stable, free]`;
  `StyleOverride` enum `[repRange, workingSets, targetRir, restSec]`.
- `ExerciseCatalogItem`: `equipment`, `stability`, `lengthenedFriendly` (required in the response — every row has them).
  `CatalogExerciseCreateRequest` / update request: the same three, optional (absent on create → `other/free/false`;
  absent on update → unchanged).
- `MesoTemplateUpsertRequest`, `MesoTemplateResponse`, `MesocycleResponse`: `trainingStyle` (nullable).
- `GymExerciseInput`: `trainingStyle` (nullable = inherit), `restSec` (30–600, nullable), `overrides[]`.
  `GymExercise` (response): the same plus read-only `effectiveTrainingStyle` (nullable).
- `TodayExercise`: `trainingStyle`, `effectiveTrainingStyle`, `restSec`, `overrides[]`.
- `PrescribedSet`: `restSec` (nullable; set only on styled blocks).

- [ ] **Step 1:** Edit `train.yml`; run the api merge and the frontend client generation.
- [ ] **Step 2:** `cd backend && ./mvnw -q -DskipTests compile` (DTOs regenerate) and `cd frontend && CI=true pnpm
  typecheck` (or `pnpm build`). Expected: green with no hand edits.
- [ ] **Step 3:** Commit `feat(api): training style and catalog attributes, additive (mezo-r36n9.79)`; post a bd comment
  on `mezo-r36n9.77` that the contract hot spot is released.

### Task 2: Catalog attributes and the classification

**Files:**
- Create: `db/changelog/1.1.0/script/202611181200_mezo-r36n9.79_train_style.sql` (all T1 columns, one changeset):
  ```sql
  ALTER TABLE exercise_catalog
    ADD COLUMN equipment text NOT NULL DEFAULT 'other'
      CONSTRAINT ck_exercise_catalog_equipment CHECK (equipment IN ('machine','cable','dumbbell','barbell','bodyweight','kettlebell','other')),
    ADD COLUMN stability text NOT NULL DEFAULT 'free'
      CONSTRAINT ck_exercise_catalog_stability CHECK (stability IN ('stable','free')),
    ADD COLUMN lengthened_friendly boolean NOT NULL DEFAULT false;
  ALTER TABLE meso_template ADD COLUMN training_style text NULL
    CONSTRAINT ck_meso_template_training_style CHECK (training_style IN ('balanced','volume','heavy','allout'));
  ALTER TABLE mesocycle ADD COLUMN training_style text NULL
    CONSTRAINT ck_mesocycle_training_style CHECK (training_style IN ('balanced','volume','heavy','allout'));
  ALTER TABLE exercise
    ADD COLUMN training_style text NULL
      CONSTRAINT ck_exercise_training_style CHECK (training_style IN ('balanced','volume','heavy','allout')),
    ADD COLUMN rest_sec integer NULL CONSTRAINT ck_exercise_rest_sec CHECK (rest_sec BETWEEN 30 AND 600),
    ADD COLUMN overrides jsonb NULL;
  ALTER TABLE exercise_set ADD COLUMN target_rep_min integer NULL, ADD COLUMN target_rep_max integer NULL;
  ```
  and its entry at the end of `1.1.0_master.yml` (id `1.1.0:202611181200_mezo-r36n9.79_train_style`).
- Modify: `ExerciseCatalogEntity` (+3 fields), `ExerciseCatalogLoader` (`CatalogJsonItem` +3 fields; **required** for
  master rows — `validate` fails startup on a missing/unknown value; always overwritten from the file),
  `content/exercise-catalog.json` (+3 keys on all 166 rows, the owner-approved list), `ExerciseCatalogService` +
  mapper (create defaults, update keeps absent fields).
- Test: extend `ExerciseCatalogLoaderIT` (`everyMasterRowIsClassified`, `missingStabilityFailsFast`,
  `drift is healed`), catalog API IT (`userRowDefaultsToOtherFreeFalse`, `userCanMarkOwnExerciseStable`,
  `masterRowStillReadOnly`), and a pure JSON test `ExerciseCatalogClassificationTest` pinning the counts
  (57 stable, 23 lengthened) and that every `lengthenedFriendly` row except `single-leg-calf-raise` is `stable`.

- [ ] **Step 1: Owner gate** — the classification table was shown to the owner (grouped: stable list, lengthened
  list, borderline items) and approved; record the decision in `docs/boop-handbook/_dontesek.json`.
- [ ] **Step 2:** Write the failing tests; run → fail.
- [ ] **Step 3:** Changeset, entity, loader, JSON, service. Run the tests → pass.
- [ ] **Step 4:** Commit `feat(train): catalog equipment, stability, lengthened-friendly (mezo-r36n9.79)`.

### Task 3: The style table and the stamper (pure)

**Files:** create `config/TrainStyleProperties.java`, `service/{TrainingStyle,ExerciseClass,StyleTable,StyleStamper}.java`;
`application.yml` new block; tests `StyleTableTest`, `StyleStamperTest`, extend the properties binding IT.

**Interfaces:**
- `mezo.train.style.styles.<balanced|volume|heavy|allout>` = `{compound-rep-min, compound-rep-max, isolation-rep-min,
  isolation-rep-max, working-sets (null = plan), reserve, leg-reserve (null = reserve), compound-rest-sec,
  isolation-rest-sec, rep-overflow}` with the spec §6.2 values: balanced 6–10 / 10–15, sets plan, 2 (legs 3),
  150/90, overflow 3 · volume 10–15 / 15–25, plan, 2, 120/75, 4 · heavy 5–8 / 8–12, plan, 2, 180/120, 2 · allout
  6–10 / 8–12, **2**, **0**, 180/120, 2. `mezo.train.style.allout-free-reserve: 1`.
- `StyleTable.stamp(TrainingStyle, ExerciseClass, boolean legs, TrainStyleProperties) → Stamp`; `ALLOUT` on
  `COMPOUND_FREE` or a free isolation → the `HEAVY` row with reserve `allout-free-reserve`, `effectiveStyle = HEAVY`.
- `StyleStamper.stamp(GymExerciseJson ex, TrainingStyle blockStyle, CatalogAttributes.Attrs attrs, TrainStyleProperties)
  → GymExerciseJson`: effective = `ex.trainingStyle ?? blockStyle`; null or `plyo` → unchanged; else every field not
  in `ex.overrides` takes the stamp (`repMin`+`repMax` together as `repRange`; `workingSets` only when the stamp has a
  number; `targetRir`; `restSec`).

- [ ] **Step 1: Failing tests**, e.g.
  ```java
  @Test void balancedLegCompound() { assertThat(StyleTable.stamp(BALANCED, COMPOUND_FREE, true, P))
      .isEqualTo(new Stamp(6, 10, null, 3, 150, 3, BALANCED)); }
  @Test void alloutOnFreeFallsBackToHeavy() { assertThat(StyleTable.stamp(ALLOUT, COMPOUND_FREE, false, P))
      .isEqualTo(new Stamp(5, 8, null, 1, 180, 2, HEAVY)); }
  @Test void alloutStableIsTwoSetsToFailure() { assertThat(StyleTable.stamp(ALLOUT, ISOLATION_STABLE…)) … sets 2, reserve 0 }
  @Test void overridesAreKept() { /* overrides [repRange] → repMin/repMax untouched, targetRir stamped */ }
  @Test void unstyledIsUntouched() { assertThat(StyleStamper.stamp(ex, null, attrs, P)).isSameAs(ex); }
  @Test void exerciseStyleBeatsBlockStyle() { … }
  ```
  (`ExerciseClass` for isolation keeps the stability so the all-out fallback can apply to a free isolation.)
- [ ] **Step 2:** Implement; run → pass. Commit `feat(train): training style table and stamper (mezo-r36n9.79)`.

### Task 4: Style on the template and the run

**Files:** `entity/{MesoTemplateEntity,MesocycleEntity,ExerciseEntity}.java`, `entity/json/GymExerciseJson.java`
(`trainingStyle`, `restSec`, `overrides` — nullable; old documents read as null), `service/{MesoTemplateService,
TrainService,WorkoutExerciseChangeService}.java`, `mapper/TrainMapper.java`, `service/CatalogAttributes.java`;
test `MesoTemplateStyleIT`, extend `WorkoutExerciseChangeServiceIT`.

**Behaviour:**
- `applyUpsert`: store `trainingStyle`; **carry over** `trainingStyle`/`restSec`/`overrides` per exercise from the stored
  document (same day index, same catalog id else exact name, first unmatched) when the request omits them; then stamp
  every exercise with `StyleStamper` under the template style.
- `start` / `stampRun` (`StampSource` + `trainingStyle`) copies the style to the run; `toExerciseEntity` copies the three
  fields; the rerun materialisation and `MesoTemplateService.daysOf` read them back; responses carry them plus
  `effectiveTrainingStyle` (computed with `StyleTable`, null when unstyled).
- A run day edit (`TrainService` replace-day paths) carries over from the old rows of that day the same way and stamps
  under the run's style; `WorkoutExerciseChangeService` copies the three fields onto a swapped/added row (a swap to a
  different catalog id keeps the style, drops the overrides, and re-stamps).
- Unstyled template/run: bytes in = bytes out (only nulls added).

- [ ] **Step 1: Failing ITs:** `styledTemplateStampsExercises`, `ownerOverrideSurvivesSave`,
  `webSaveCarriesStyleFieldsOver` (resave the response's days without the three fields → unchanged rows),
  `unstyledTemplateIsUntouched` (round-trip equality of a full existing fixture), `runInheritsStyleOnStart`,
  `rerunKeepsStyleFields`, `runDayEditRestampsUnderRunStyle`, `swapKeepsStyleDropsOverrides`.
- [ ] **Step 2:** Implement; run the new ITs plus `MesoTemplateServiceIT`, `TrainServiceIT`, `MesoRerunIT` (whatever
  exists under those names) → pass. Commit `feat(train): training style on template and run (mezo-r36n9.79)`.

### Task 5: The trained range and the rep-range-aware reference

**Files:** `entity/ExerciseSetEntity.java` (+`targetRepMin`, `targetRepMax`), `service/WorkoutService.java` (`logSet`
stamps both from the set's own exercise row at create; update never changes them),
`repository/ExerciseRepository.java` (`ExerciseIdentityRow` + `getRepMin`/`getRepMax`),
`repository/ExerciseSetRepository.java` (history query exposes the instance date), `service/ExerciseHistoryResolver.java`;
tests `ExerciseHistoryResolverRangeIT`, extend `SetRecommendationServiceIT`.

**Interfaces:**
- `ExerciseHistoryResolver.reference(UUID createdBy, ExerciseEntity ex, LocalDate today, int sameRangeMaxAgeDays)
  → Reference(List<ExerciseSetEntity> sets, int refRepMin, int refRepMax, boolean sameRange)` (empty sets = no history).
  `latestCompletedWorkingSets` stays as is for its other readers (`lastWeek`, companion).

- [ ] **Step 1: Failing ITs:** `logSetSnapshotsTheRowRange`, `twiceAWeekDifferentRangesUseTheirOwnReference`,
  `staleSameRangeInstanceIsIgnored` (57 days old → newest overall), `legacySetUsesItsRowRange` (null snapshot,
  soft-deleted row), `noHistoryIsEmpty`.
- [ ] **Step 2:** Implement; run → pass. Commit `feat(train): trained range snapshot and range-aware history (mezo-r36n9.79)`.

### Task 6: `ProgressionDecider` — conversion, per-style overshoot, ramped grind

**Files:** `service/ProgressionDecider.java`; test `ProgressionDeciderTest` (the existing 24 stay untouched and green).

**Interfaces:**
- `static Decision convert(RefSet ref, int repMin, int repMax, int targetRir, StepPolicy policy, Set<BigDecimal> used,
  Set<BigDecimal> gaps)` — lever `WEIGHT` (delta ≠ 0) or `HOLD`; rationale
  `Új tartomány (12–15): a 8×80 kg alapján → 62,5 kg × 12`. Candidates include the reference weight itself.
- `decide(…)` gains an overload with `Integer refTargetReps, boolean rampedGrind`: when `rampedGrind && targetRir ≤ 1 &&
  refTargetReps != null`, slack = (ref.reps ≤ refTargetReps − 2) ? −1 : max(0, rir − targetRir). The old signature
  delegates with `(null, false)`.
- The per-style `repOverflow` arrives through the existing `StepPolicy` (no decider change).

- [ ] **Step 1: Failing tests:** `convertHigherRangeGoesLighter` (80×8 @6–10 → 12–15), `convertLowerRangeGoesHeavier`,
  `convertKeepsWeightWhenItFits`, `convertRespectsGaps`, `rampedGrindTwoBelowPrescribedHolds`,
  `rampedGrindOffKeepsOldRule`, `heavyOverflowTwoForcesEarlier`.
- [ ] **Step 2:** Implement; run → pass. Commit `feat(train): range conversion and ramped grind in the decider (mezo-r36n9.79)`.

### Task 7: The effort ramp (pure)

**Files:** create `service/EffortRamp.java`; test `EffortRampTest`.

**Interface:** `static int effectiveReserve(int base, int week, List<String> phaseCurve, boolean free, TrainStyleProperties.Ramp cfg)`
with `mezo.train.style.ramp = {middle-delta 1, last-week-delta 2, deload-delta 2, free-floor 1}`; week outside the
curve → base.

- [ ] **Step 1: Failing tests:** the table for blocks of 4, 5, 6 and 8 weeks with one trailing deload (base 2 and 3),
  `freeNeverBelowOne`, `alloutStaysZero` (base 0 stable), `deloadAddsTwo`, `noDeloadInCurve`, `weekOutsideCurveIsBase`.
- [ ] **Step 2:** Implement; run → pass. Commit `feat(train): effort ramp across the block (mezo-r36n9.79)`.

### Task 8: Prescription wiring

**Files:** create `service/StyleContext.java`; modify `service/SetRecommendationService.java`,
`service/WorkoutService.java` (`getToday`, the `TodayExercise` mapping); tests `WorkoutTodayStyleIT`, extend
`SetRecommendationServiceIT`.

**Interfaces:**
- `record StyleContext(TrainingStyle effectiveStyle, int effectiveReserve, Integer restSec, int repOverflow)`;
  `StyleContext.NONE` for unstyled.
- `SetRecommendationService.prescribe(UUID, ExerciseEntity, PrescribeOptions)` with
  `record PrescribeOptions(boolean deloadWeek, int effectiveWorkingSets, boolean holdOnly, BigDecimal loadFactor,
  int rirFloor, StyleContext style, LocalDate today)`; the five existing overloads delegate (`StyleContext.NONE`).
- Reference via `historyResolver.reference(…)`: same range or reps in the current range → `decide`; reps inside the
  reference's own range and outside the current one → `convert` (then the deload ×0.9 on a deload week).
- Styled: `targetRir` = `effectiveReserve` in the decider and on every working `PrescribedSet` (the `rirFloor` still
  applies on top); `restSec` on every set; `StepPolicy.repOverflow` = the style's; `rampedGrind = true`.
  `TodayExercise`: `trainingStyle`, `effectiveTrainingStyle`, `restSec`, `overrides`, and `targetRIR` = the effective
  reserve. Unstyled: `restSec` on sets null, `targetRIR` the row's value — byte-identical prescription.
- `getToday` builds the `StyleContext` from the active run (`trainingStyle`, `currentWeek`, `phaseCurve`), the
  exercise's style override and `CatalogAttributes` stability.

- [ ] **Step 1: Failing ITs:** `unstyledRunPrescribesAsBefore` (snapshot the full `getToday` JSON of an existing
  fixture before the change and compare), `styledRunRampsReserve` (week 1 vs last loading week), `styledRunCarriesRest`,
  `alloutRunPrescribesTwoSetsAtZero`, `freeExerciseInStyledRunNeverBelowOne`, `convertedReferenceAfterRangeChange`,
  `inRangeDifferentRangeReferenceIsJudgedAsToday`, `outOfOwnRangeReferenceIsNotConverted`.
- [ ] **Step 2:** Implement; run the new ITs plus `SetRecommendationServiceIT`, `WorkoutTodayProgressionIT`,
  `WorkoutTodayPrescriptionIT`, `WorkoutWeightGapIT`, `WarmupExclusionIT` → pass.
- [ ] **Step 3:** Commit `feat(train): styled prescription — ramp, rest, overshoot (mezo-r36n9.79)`.

### Task 9: Per-muscle stall detection

**Files:** create `service/{MuscleStallDetector,MuscleProgressReader}.java`; tests `MuscleStallDetectorTest`,
`MuscleProgressReaderIT`.

**Interfaces:**
- `MuscleStallDetector.stalled(Map<String, List<TopSet>> seriesByExercise, int weeks) → boolean` where `TopSet(week,
  weightKg, reps)` per exercise, newest last; moved = weight up, or same weight and reps up; stalled = every exercise
  with data held in each of the last `weeks` (2, `mezo.train.style.stall-weeks`) week-on-week comparisons, and at least
  one exercise has `weeks + 1` weeks of data. Missing weeks are not a hold (one bad / absent week is not a stall).
- `MuscleProgressReader.stalledGroups(UUID createdBy, MesocycleEntity run, int uptoWeek) → Set<MuscleGroup>` — empty for
  an unstyled run; per coarse group over the run's completed instances, start-date-anchored weeks (`MesoWeeks`),
  counting working sets only, identity-keyed.

- [ ] **Step 1: Failing tests:** `everyExerciseHeldTwoWeeksIsStalled`, `oneExerciseMovedIsNotStalled`,
  `weightDownRepsUpIsNotMoved…` (define: a lighter top set is a hold), `absentWeekIsNotAHold`, `tooLittleDataIsNotStalled`,
  reader `unstyledRunHasNoStalls`, `stalledGroupFromLoggedSets`.
- [ ] **Step 2:** Implement; run → pass. Commit `feat(train): per-muscle stall detection (mezo-r36n9.79)`.
- [ ] **Step 3 (9b, only with the S2 session's OK on bd):** in `WeekProposalService.build`, for a styled run, add the
  audit reason `stalled` to each stalled group's audit entry (no line, no amount change); test
  `WeekProposalAutoIT.stalledGroupIsAudited`. Without the OK: file the wiring as a note on `mezo-r36n9.81` (T3).

### Task 10: Docs, gates, ship

**Files:** `docs/features/train.md` (§4 set-recommendation engine: range-aware reference, style, ramp, rest; exercise
catalog attributes; §9 traps: web save of a styled block, legacy range fallback; §10 key files),
`docs/features/README.md` row, `docs/milestones/roadmap.md` (dated entry),
`docs/boop-handbook/07-edzes/04-progresszio-motor.md` (+ a new page `docs/boop-handbook/07-edzes/NN-edzesstilus.md`),
`docs/boop-handbook/_jegyek.json`, `_dontesek.json`, `_kiadasok.json`, `docs/CODEMAP.md` (generated), the spec's
status line.

- [ ] **Step 1:** Before deploy, capture the production baseline (Step 5 queries).
- [ ] **Step 2:** `cd backend && ./mvnw -q clean test -Dmezo.test.use-testcontainers=true` → BUILD SUCCESS (if
  `MealCoachApiIT` flakes, cross-check `mezo-r36n9.86` and re-run it alone). `-Dtest=ArchitectureTest` green.
  Frontend: `CI=true pnpm test` with `VITE_USE_MOCK` unset and `=false`, `pnpm build` — green with only `api.gen.ts`
  changed.
- [ ] **Step 3:** Docs; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors / 0 stale.
- [ ] **Step 4:** `git pull --rebase` main (S2 may have landed: re-run the api merge, client gen, codemap, re-append the
  changeset after S2's), merge `--no-ff` on a detached `origin/main`, `git push origin HEAD:main`; watch `ci` and
  `deploy` to green; the pod's image tag = the release.
- [ ] **Step 5: Production check** (reads only):
  ```sql
  select training_style from mesocycle where status = 'active' and not is_deleted;          -- null
  select stability, lengthened_friendly, count(*) from exercise_catalog
   where created_by is null and not is_deleted group by 1, 2;                                -- stable 57, lengthened 23
  select count(*) from exercise_catalog where created_by is not null and equipment = 'other'
   and stability = 'free' and not lengthened_friendly and not is_deleted;                    -- every user row (8 today)
  select count(*) from exercise_set where created_at > now() - interval '1 day'
   and target_rep_min is null and kind = 'working';                                           -- 0 after the next workout
  ```
  plus the range query of this plan's Review Focus 1 (the six exercises: each top set inside today's range or outside
  its own range; same-range instances older than 56 days) — proving the owner's run prescribes exactly as before.
- [ ] **Step 6:** `node scripts/boop-notion-sync.mjs plan` → apply → `check` exits 0; `node scripts/check-beads-backup.mjs
  --fix`; close `mezo-r36n9.79`; commit; push; Hungarian report.

## Kész, ha…

- A katalógus mind a 166 gyakorlatánál ott van az eszköz, a stabil/szabad jelölés és a „nyújtott helyzetben biztonságos”
  jelölés, a tulaj által jóváhagyott lista szerint; a saját gyakorlatok alapból „egyéb / szabad / nem”, és átírhatók.
- Egy stílussal mentett blokk gyakorlatai megkapják a stílus ismétléstartományát, tartalékát és pihenőjét; amit a tulaj
  kézzel beírt, az megmarad; a „Két sorozat bukásig” egy szabad gyakorlatnál „Nagyobb súly, 1 tartalék” lesz.
- Stílusos blokkban a tartalék a blokk végére csökken, a könnyített héten nő, szabad gyakorlatnál sosem megy 1 alá, és
  minden sorozat kap pihenőidőt.
- Ugyanaz a gyakorlat két különböző tartománnyal (hétfő 6–10, csütörtök 12–15) mindkét napon a saját múltjából halad;
  tartományváltáskor a súly átszámolódik, nem a régi tartományhoz mérjük.
- Stílusos blokkban felismerjük azt az izmot, amelynek egyik gyakorlata sem mozdult két hete (a javaslatok a T3-ban jönnek).
- A tulaj futó blokkja (stílus nélkül) pontosan ugyanazt írja elő, mint előtte — lekérdezéssel igazolva.
- A webes app változatlanul működik: a frontend tesztek mindkét módban zöldek, csak a generált kliens változott.
- A teljes backend tesztkészlet zöld; `ArchitectureTest`, kódtérkép és dokumentum-ellenőrzés hibátlan.
- Élesítve: a `deploy` zöld, a pod az új verziót futtatja, a katalógus lekérdezése az új jelöléseket mutatja.
- `train.md`, a kézikönyv oldalai, a döntésnapló, a mérföldkő-napló és a Notion tükör a kiadott állapotot írja le.
