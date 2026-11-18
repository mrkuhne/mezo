# Train style & techniques — T2: the technique model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a planned exercise carry an intensity technique (the owner's rest-drop, a drop set, a myo set, lengthened
partials) or be the day's challenge; prescribe the technique set step by step in the daily workout; log what was
actually done as "legs" under the set; and keep every existing reader honest (records, progression, weekly set count,
caps, grind, tonnage). The owner sets techniques by hand through the API — no automatic placement (T3), no AI (T4).

**Architecture:** Approach A of the spec: `exercise_set.kind` stays `warmup|working`; a working set may carry
`technique`, and what follows its main part is stored in a new child table `exercise_set_leg`. Every existing reader
keeps seeing one working set — its first, full-effort part. On the plan side three nullable fields ride the T1 plumbing
(template json + run row). The prescription is a **read-time overlay** applied in `getToday` after
`SetRecommendationService.prescribe` (a pure `TechniquePrescriber`), so the S3-held load logic is not edited. Everything
is gated by `techniques_enabled` on the block (default false): a block without it — every web block and the owner's
run in flight — is planned, prescribed and logged exactly as today.

**Tech Stack:** Java 21, Spring Boot, JPA/Hibernate + MapStruct, Liquibase (`1.1.0/`), PostgreSQL, JUnit 5 +
Testcontainers; contract-first OpenAPI (`api/feature/train/train.yml` → `api/openapi.yml` → generated DTOs +
`frontend/src/data/_client/api.gen.ts`).

**Spec:** `docs/superpowers/specs/2026-11-17-train-style-and-techniques-design.md` §6.3, §6.4, §6.6 (the record and the
prescription of the challenge only — placement is T3), §6.8 (the T2 fields), §6.9, §7 slice T2, and §11 (Q2 set-swap
semantics, Q4 owner picks, Q6 challenge wins, the `SetUpdateRequest` legs and carry-over corrections). bd
`mezo-r36n9.80`, epic `mezo-r36n9`. Builds on T1 (`2026-11-18-train-style-t1-style-and-progression.md`). Runs in
parallel with S3 (`mezo-r36n9.78`).

## Decisions this plan makes

| Question | Decision |
|---|---|
| "A technique replaces one straight set" for an owner pick | The technique sits on the **last existing working set**; the set count is not changed and no extra set is added. (The planner's "sets − 1" of §11 Q2 is T3's job when it places a technique itself.) With a single working set, that set is the technique set. |
| Where the technique applies in time | Owner picks run in **every loading week, weeks 1–2 included, never in a deload week** (§11 Q4). The challenge too (§6.6: from week 1, not in the deload). On a deload week the exercise is prescribed as plain sets. |
| Who may carry one | Server **rejects** (400) a technique or a challenge on a non-`stable` exercise, and `partials` or a challenge on a non-`lengthened_friendly` one — on template save, on run day edits and on the mid-run PUT. An exercise without a catalog id counts as `free`. The check reads catalog attributes **independently of style** (T1 loads stability only for styled blocks). |
| Challenge vs technique on one row (§11 Q6) | The challenge wins: `challenge = true` forces `technique = none` on that row; the prescription gives it `partials`. A save/PUT that sends both a technique and `challenge = true` → 400. At most one challenge per training day: template save with two → 400; the PUT setting a challenge clears it from the day's other rows. |
| Block flag | `techniques_enabled` on `meso_template` + `mesocycle`, default false, copied to the run at start; template PUT keeps the stored value when the field is absent (web saves). No mid-run toggle in T2 (the Boop builder slice sets it on the template). The mid-run technique PUT on a run without the flag → 409 `TRAIN_TECHNIQUES_DISABLED`. A disabled block may *store* technique fields (validated) but never prescribes them and never weights caps with them. |
| `technique_source` | `owner` for everything T2 writes (the only writer); `planner` / `ai` are reserved for T3/T4 and accepted on the wire only as read values. |
| Technique set shape (all config, `mezo.train.technique`) | `rest_drop`: main part reserve 0 → leg `drop` {weight = snap(w × 0.70), reps = the main set's prescribed reps, restBefore 30 s}. `drop`: reserve 0 → leg `drop` {snap(w × 0.80), toFailure, restBefore 0}. `myo`: activation reserve 1 → 4 legs `mini` {weight w, reps 5, minReps 3, restBefore 20 s} (stop when a mini-set falls below `minReps`). `partials` (and the challenge): reserve 0 → leg `partials` {toFailure, restBefore 0}. Each drop leg also carries `dropPercent` so the player can recompute from the weight actually lifted when the prescription has no weight. |
| Drop weight snapping | Nearest real weight **at or below** the target from the same candidate set T1's conversion uses (ever-logged ∪ plate grid − known gaps); none → `weightKg` null. |
| Rest | Leg `restBeforeSec` comes from technique config (unstyled blocks have no set rest, T1). Set-level `restSec` stays T1's (styled blocks only). |
| Progression reference (§6.4 "reserve 0 expected") | `ExerciseHistoryResolver.reference` drops technique sets from an instance's set list when the instance has at least one straight working set, so a deliberate failure set never becomes the top set or a grind. (Small deviation from "the parent row is the reference": the honest reference is the effort-controlled straight sets; `SetRecommendationService` — S3's hot spot — is not edited.) |
| Grind signal (weekly proposal) | `WeeklySignalReader` takes the newest **non-technique** working set per exercise (today it takes the last set, which is exactly the technique set). |
| Caps weight 2 | `SetSlots.Slot` gains `capWeight` (= sets + 1 for a row carrying a technique or the challenge in a techniques-enabled block; the 3-arg constructor keeps `capWeight = sets`). `pickUp` and the day total use `capWeight` against the exercise cap (5) and session cap (8); band totals keep plain sets. Builders: `PlanEvaluator`, `VolumePath`, `RecoveryReturnService`, `WeekProposalService` (one line — agreed with S3 on bd), plus `PlanEvaluator`'s per-day cap warnings. |
| Tonnage / `SESSION_VOLUME` | Parent + `drop` and `mini` legs (weight × reps), never `partials`: `MedalService.sessionVolume`, `ExerciseRecordService` (best session volume and total volume), `GymSignalCalculator.volumeByMuscle`. One batched leg read (`ExerciseSetLegRepository.findByExerciseSetIdIn`) through a small `SetTonnage` helper. The companion's two displays (`TrainTools`, `MetricSeriesService`) are left as is → follow-up bd issue (AI context text, no record or medal depends on them). |
| `PARTIALS_BEST` | Derived, never stored (ADR 0016): best `partials` leg reps per exercise identity per parent weight, over live parents. Exposed as `challengeBest` on `TodayExercise` (the best at the challenge set's prescribed weight; null when no weight or no record) and as `partialsBest[]` ({weightKg, reps}) on `ExerciseRecordResponse`. **Not** a new `Medal.type` value (would break the frozen web's exhaustive label map and strict iOS enums). |
| Proactive "depth" challenge | `ChallengeOutcomeEvaluator` scores from the last **non-technique** set (a deliberate failure set would win it for free). |
| Log validation | `SetLogRequest.technique` optional; `legs[]` only with a technique; leg kinds must fit it (`drop` for `drop`/`rest_drop`, `mini` for `myo`, `partials` for `partials`); ≤ 6 legs; reps ≥ 0, weight ≥ 0, restSec 0–600. Logged regardless of the block flag (log what he did). `technique` immutable after create like `kind`. `SetUpdateRequest.legs`: **absent = untouched**, `[]` = clear, list = replace. Legs are written **before** the medal replay. Soft-deleting a set leaves its legs; every reader reaches legs only through live parents. |
| Swap / add mid-workout | A swap keeps the technique/challenge only when the new movement satisfies the same rules; otherwise both are cleared. |

## Global Constraints

- Contract changes are **additive and optional only**; no existing enum gains a value. The web client sends none of
  the new fields and must keep working with zero frontend code change (only `api.gen.ts` regenerates).
- ADR 0027: every new exercise field reaches `GymExerciseJson`, `TrainService.toExerciseEntity`, `stampRun`, the rerun
  materialisation (`MesoTemplateService` + `TrainMapper.toExercisesJson`), `TrainService.replaceDayExercises`,
  `WorkoutExerciseChangeService`, `ExerciseStyler.carry` (its `sentNone` rule widens to the technique fields), and the
  response mappers. Wire enums go through `@Named` converters (MapStruct `valueOf` breaks on `rest_drop`).
- Tunables in a new `@Validated` record `TrainTechniqueProperties` (`mezo.train.technique`), never literals. No change to
  `VolumeProperties` / `mezo.volume`.
- Hot spots (bd agreement with S3 on `mezo-r36n9.78`/`.80`): `train.yml`/`openapi.yml`, the `1.1.0` master,
  `ResetDatabase`, one line of `WeekProposalService`. Edited in late isolated commits; first to merge wins, the other
  rebases and regenerates `openapi.yml`, `api.gen.ts`, `CODEMAP.md`. `SetRecommendationService` and
  `ProgressionDecider` are **not** edited.
- The golden test `unstyled-today.json` must stay byte-identical or change only by added null fields that are
  explicitly reviewed; an unflagged block's prescription must be identical.
- ArchUnit: no raw generic exceptions outside techcore (`SystemRuntimeErrorException` with `SystemMessage`), layer
  subpackages enforced, controllers implement the generated `*Api`.
- Liquibase: plain SQL, one changeset per file, appended at the end of `1.1.0_master.yml`; no bare `?` in jsonb SQL.
- Backend test command per task: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=<Class>`. One
  Maven process per working tree. Before merge: `-Dtest=ArchitectureTest`, codemap, lint-docs, the full suite with the flag.
- Conventional commits carrying `(mezo-r36n9.80)`.

## Review Focus

1. **The owner's run and every web block are untouched** — flag false ⇒ prescription, caps, logging identical. →
   Task 6 `disabledBlockPrescribesAsBefore`, golden test; Task 9 production query.
2. **No leg ever reaches records, e1RM, the reference or the weekly set count; partials never reach tonnage.** →
   Task 8 tests.
3. **A deliberate failure set is not a grind** — neither in the weekly proposal nor in the progression decider. →
   Task 8 `techniqueSetIsNotAGrind`, `referenceSkipsTechniqueSet`.
4. **A web edit of a set or a template never wipes legs or techniques.** → Task 4 `webSaveCarriesTechniqueOver`,
   Task 7 `updateWithoutLegsKeepsThem`.
5. **No technique on an unsafe lift from any path.** → Task 4/5 rejection tests.

## File structure

Created under `backend/src/main/java/io/mrkuhne/mezo/feature/train/`:

| File | Responsibility |
|---|---|
| `config/TrainTechniqueProperties.java` | `mezo.train.technique`: per-technique reserve, drop %, rests, myo bounds, cap weight |
| `entity/ExerciseSetLegEntity.java` | one leg row |
| `repository/ExerciseSetLegRepository.java` | `findByExerciseSetIdIn`, `deleteByExerciseSetId` |
| `service/Technique.java` | enum `NONE, REST_DROP, DROP, MYO, PARTIALS` + wire values; `LegKind` enum `DROP, MINI, PARTIALS` |
| `service/TechniqueRules.java` | pure: may this exercise carry technique X / the challenge (stability, lengthened); leg kinds allowed per technique; cap weight |
| `service/TechniquePrescriber.java` | pure: overlay a `Prescription` with the technique set (last working set, reserve, legs, snapped drop weight) |
| `service/PartialsBest.java` | read-only: best partials reps per identity per weight |
| `service/SetLegService.java` | write + batched read of legs; tonnage helper `SetTonnage` |
| `service/ExerciseTechniqueService.java` | the mid-run PUT |

Created elsewhere: `db/changelog/1.1.0/script/202611181600_mezo-r36n9.80_techniques.sql`.

---

### Task 1: Contract (hot spot — hold it briefly)

**Files:** `api/feature/train/train.yml`; regenerate `api/openapi.yml` (`cd api/generate && npm run generate:api`) and
`frontend/src/data/_client/api.gen.ts`.

**Interfaces (all optional):**
- New schemas: `Technique` `[none, rest_drop, drop, myo, partials]`; `TechniqueSource` `[owner, planner, ai]`;
  `SetLegKind` `[drop, mini, partials]`; `PrescribedLeg` {kind, weightKg?, reps?, minReps?, toFailure, restBeforeSec,
  dropPercent?}; `SetLeg` {legIndex, kind, weightKg?, reps?, restSec?}; `SetLegInput` {kind, weightKg?, reps?,
  restSec?}; `PartialsBestEntry` {weightKg, reps}; `ExerciseTechniqueUpdateRequest` {technique, challenge} (both
  required).
- `MesoTemplateUpsertRequest`, `MesoTemplateResponse`, `MesocycleResponse`: `techniquesEnabled`.
- `GymExerciseInput`, `GymExercise`, `TodayExercise`: `technique`, `techniqueSource`, `challenge`; `TodayExercise`
  also `challengeBest` (int, nullable).
- `PrescribedSet`: `technique`, `legs[]` (`PrescribedLeg`).
- `SetLogRequest`: `technique`, `legs[]` (`SetLegInput`); `SetUpdateRequest`: `legs[]` (absent = untouched);
  `ExerciseSetResponse`: `technique`, `legs[]` (`SetLeg`).
- `ExerciseRecordResponse`: `partialsBest[]`.
- `PUT /api/train/mesocycles/{id}/exercises/{exerciseId}/technique` → `GymExercise`; 400 / 404 / 409.

- [ ] **Step 1:** Edit `train.yml`; run the api merge and the frontend client generation.
- [ ] **Step 2:** `cd backend && ./mvnw -q -DskipTests compile` and `cd frontend && CI=true pnpm typecheck`. Expected:
  green with no hand edits (a controller stub for the new operation returning 501 is allowed until Task 5).
- [ ] **Step 3:** Commit `feat(api): technique model, additive (mezo-r36n9.80)`; bd comment on `.78` that the
  contract hot spot is released.

### Task 2: Schema, entities, legs repository

**Files:**
- Create `db/changelog/1.1.0/script/202611181600_mezo-r36n9.80_techniques.sql` (one changeset; append its entry at the
  end of the master):
  ```sql
  ALTER TABLE meso_template ADD COLUMN techniques_enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE mesocycle ADD COLUMN techniques_enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE exercise
    ADD COLUMN technique text NULL
      CONSTRAINT ck_exercise_technique CHECK (technique IN ('none','rest_drop','drop','myo','partials')),
    ADD COLUMN technique_source text NULL
      CONSTRAINT ck_exercise_technique_source CHECK (technique_source IN ('owner','planner','ai')),
    ADD COLUMN challenge boolean NOT NULL DEFAULT false;
  ALTER TABLE exercise_set ADD COLUMN technique text NULL
    CONSTRAINT ck_exercise_set_technique CHECK (technique IN ('rest_drop','drop','myo','partials'));
  CREATE TABLE exercise_set_leg (
    id uuid PRIMARY KEY,
    exercise_set_id uuid NOT NULL REFERENCES exercise_set(id) ON DELETE CASCADE,
    leg_index integer NOT NULL CHECK (leg_index >= 0),
    kind text NOT NULL CONSTRAINT ck_exercise_set_leg_kind CHECK (kind IN ('drop','mini','partials')),
    weight_kg numeric(6,2) NULL CHECK (weight_kg >= 0),
    reps integer NULL CHECK (reps >= 0),
    rest_sec integer NULL CHECK (rest_sec BETWEEN 0 AND 600),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_exercise_set_leg UNIQUE (exercise_set_id, leg_index)
  );
  CREATE INDEX ix_exercise_set_leg_set ON exercise_set_leg (exercise_set_id);
  ```
  (Follow the repo's audit-column convention if `exercise_set`'s siblings use one.)
- Modify `ExerciseSetEntity` (+`technique`, `updatable = false`), `ExerciseEntity` (+3), `MesoTemplateEntity`,
  `MesocycleEntity` (+`techniquesEnabled`), `entity/json/GymExerciseJson.java` (+`technique`, `techniqueSource`,
  `challenge` — nullable; old documents read as null; fix every `new GymExerciseJson(` call site, main and test).
- Create `ExerciseSetLegEntity`, `ExerciseSetLegRepository`; add `exercise_set_leg` to `ResetDatabase` (hot spot).
- Test: `ExerciseSetLegRepositoryIT` (`legsCascadeOnHardDelete`, `uniqueLegIndex`, `findByExerciseSetIdIn`).

- [ ] **Step 1:** failing IT → **Step 2:** implement → pass. Commit `feat(train): technique columns and set legs table (mezo-r36n9.80)`.

### Task 3: Config and the pure units

**Files:** create `config/TrainTechniqueProperties.java`, `service/{Technique,TechniqueRules,TechniquePrescriber}.java`;
`application.yml` new `mezo.train.technique` block; tests `TechniqueRulesTest`, `TechniquePrescriberTest`, the
properties binding test.

**Interfaces:**
- `mezo.train.technique`: `rest-drop {main-reserve 0, drop-percent 30, rest-sec 30}`, `drop {main-reserve 0,
  drop-percent 20, rest-sec 0}`, `myo {main-reserve 1, mini-reps 5, mini-min-reps 3, mini-rest-sec 20, max-minis 4}`,
  `partials {main-reserve 0}`, `cap-weight 2`.
- `TechniqueRules.check(Technique t, boolean challenge, CatalogAttributes.Attrs a) → Optional<String errorCode>`
  (`TRAIN_TECHNIQUE_NOT_STABLE`, `TRAIN_TECHNIQUE_NOT_LENGTHENED`, `TRAIN_TECHNIQUE_ON_CHALLENGE`);
  `allowedLegKinds(Technique)`; `capWeight(int sets, Technique t, boolean challenge, boolean enabled, int capWeightCfg)`.
- `TechniquePrescriber.apply(Prescription p, Technique t, boolean challenge, boolean deloadWeek, Set<BigDecimal> realWeights,
  TrainTechniqueProperties cfg) → Prescription`: no-op when `t == NONE && !challenge` or deload; else the last
  working set gets `technique` (challenge ⇒ `partials`), its `targetRir` = the technique's main reserve, and `legs`
  per the decisions table; other sets untouched.

- [ ] **Step 1: Failing tests**, e.g. `restDropIsThirtyPercentLighterSameReps` (40 kg × 10 → drop leg 27.5 kg × 10,
  rest 30), `dropSnapsDownToARealWeight`, `noWeightGivesNullWeightAndPercent`, `myoHasFourMiniSets`,
  `challengeWinsAndIsPartials`, `deloadIsPlain`, `singleSetIsTheTechniqueSet`, `freeExerciseRejected`,
  `partialsNeedsLengthened`, `challengeWithTechniqueRejected`, `capWeightOnlyWhenEnabled`.
- [ ] **Step 2:** Implement → pass. Commit `feat(train): technique rules and prescriber (mezo-r36n9.80)`.

### Task 4: The plan fields — template and run

**Files:** `service/{MesoTemplateService,TrainService,ExerciseStyler,WorkoutExerciseChangeService}.java`,
`mapper/TrainMapper.java` (+`@Named` technique/source converters), `service/CatalogAttributes.java` (a lookup that
works without a style); tests `MesoTemplateTechniqueIT`, extend `WorkoutExerciseChangeServiceIT`.

**Behaviour:**
- `applyUpsert`: `techniquesEnabled` absent ⇒ keep stored; validate every exercise with `TechniqueRules` (400 with the
  error code and the exercise name); two challenges on one day ⇒ 400; `technique_source = owner` on any row whose
  technique/challenge the request sets; carry over `technique`/`techniqueSource`/`challenge` from the stored exercise
  (T1's `carry`, same day, catalog id else name) when the request omits all of them.
- `stampRun` copies `techniquesEnabled`; `toExerciseEntity`, the rerun materialisation, `daysOf`, the response mappers
  carry the three fields; `replaceDayExercises` carries over + validates like the template.
- Swap: keep technique/challenge only if the new movement passes `TechniqueRules`, else clear both.

- [ ] **Step 1: Failing ITs:** `techniqueRoundTripsOnTemplate`, `webSaveCarriesTechniqueOver` (resave without the
  fields and without `techniquesEnabled` → unchanged), `freeExerciseTechniqueRejected`, `noCatalogIdIsFree`,
  `partialsOnNonLengthenedRejected`, `twoChallengesOnADayRejected`, `runInheritsFlagAndTechniques`,
  `rerunKeepsTechniques`, `runDayEditValidatesAndCarries`, `swapToFreeMovementClearsTechnique`,
  `unflaggedTemplateIsUntouched` (full fixture round-trip equality).
- [ ] **Step 2:** Implement; run the new ITs plus T1's `MesoTemplateStyleIT`, `ExerciseStylerCarryTest` and the
  template/train service ITs → pass. Commit `feat(train): technique on template and run (mezo-r36n9.80)`.

### Task 5: The mid-run technique PUT

**Files:** create `service/ExerciseTechniqueService.java`; `controller/TrainController.java`; test
`ExerciseTechniqueApiIT`.

**Behaviour:** owned run (404 otherwise), the exercise belongs to the run (404), run flag on (409
`TRAIN_TECHNIQUES_DISABLED`), `TechniqueRules` (400), `technique = none ∧ challenge = false` clears; `challenge = true`
clears the challenge from the day's other rows of the same template session; source `owner`. Returns the row.

- [ ] **Step 1: Failing ITs:** `setsTechniqueOnStableExercise`, `rejectsFreeExercise`, `rejectsWhenDisabled`,
  `challengeMovesWithinTheDay`, `clearRemovesBoth`, `otherUsersRunIs404`.
- [ ] **Step 2:** Implement → pass. Commit `feat(train): set a technique mid-run (mezo-r36n9.80)`.

### Task 6: The prescription overlay and the challenge's number to beat

**Files:** `service/WorkoutService.java` (`getToday` mapping), create `service/PartialsBest.java`; tests
`WorkoutTodayTechniqueIT`, `PartialsBestIT`.

**Behaviour:** for a flagged run only: after `prescribe`, `TechniquePrescriber.apply(…)` with the run's deload flag
for the current week and the real-weight candidate set; `TodayExercise` gets `technique`, `techniqueSource`,
`challenge`, and `challengeBest` = `PartialsBest.at(identity, the challenge set's prescribed weight)`. Unflagged: the
fields map as stored (`technique` null/none, `challenge` false), prescription untouched, no extra queries beyond
one cheap flag check.

- [ ] **Step 1: Failing ITs:** `disabledBlockPrescribesAsBefore` (full `getToday` JSON equality on an existing
  fixture), `restDropOnLastSet`, `challengeCarriesBestAtWeight`, `deloadWeekIsPlain`, `noHistoryLegHasNoWeight`;
  `PartialsBestIT`: `bestPerWeight`, `deletedParentIgnored`, `otherIdentityIgnored`.
- [ ] **Step 2:** Implement; also run `WorkoutTodayStyleIT`, `WorkoutTodayPrescriptionIT`, the golden test → pass.
  Commit `feat(train): prescribe the technique set and the challenge (mezo-r36n9.80)`.

### Task 7: Logging legs

**Files:** create `service/SetLegService.java`; `service/WorkoutService.java` (`logSet`, `updateSet`, the set
response mappings — batched per instance), `mapper/TrainMapper.java`; test `SetLegLogIT`.

- [ ] **Step 1: Failing ITs:** `logsTechniqueWithLegs`, `legsWithoutTechniqueRejected`, `wrongLegKindRejected`,
  `updateWithoutLegsKeepsThem`, `updateWithEmptyLegsClears`, `updateReplacesLegs`, `techniqueImmutableOnUpdate`,
  `instanceResponseCarriesLegs` (one leg query per instance), `deletedSetHidesLegs`, `sessionVolumeMedalSeesDropLegs`
  (legs saved before the replay).
- [ ] **Step 2:** Implement → pass. Commit `feat(train): log technique legs (mezo-r36n9.80)`.

### Task 8: Every reader of the §6.4 table

**Files:** `service/{MedalService,ExerciseRecordService,ExerciseHistoryResolver,WeeklySignalReader,SetSlots,
PlanEvaluator,VolumePath,RecoveryReturnService,WeekProposalService}.java`, `signal/GymSignalCalculator.java`,
`feature/proactive/service/ChallengeOutcomeEvaluator.java`; tests extend `MedalEvaluatorTest`/`MedalServiceIT`,
`ExerciseRecordServiceIT`, `SetSlotsTest`, `WeeklySignalReaderIT` (or the proposal IT that covers grind),
`SetRecommendationServiceIT`, `WarmupExclusionIT`-style `TechniqueExclusionIT`.

- [ ] **Step 1: Failing tests:** `legsNeverEnterRecordsOrE1rm`, `partialsNeverEnterTonnage`,
  `dropAndMiniLegsEnterSessionVolume`, `techniqueSetCountsAsOneWeeklySet`, `techniqueSetIsNotAGrind`,
  `referenceSkipsTechniqueSet`, `onlyTechniqueSetsStillGiveAReference`, `capWeightTwoBlocksTheExtraSet`,
  `unflaggedCapsUnchanged`, `partialsBestOnRecords`, `depthChallengeIgnoresTechniqueSet`.
- [ ] **Step 2:** Implement (the `WeekProposalService` Slot line in its own late commit, announced on bd `.78`) → pass;
  rerun `ProgressionDeciderTest`, `SetRecommendationServiceIT`, `WeekProposalAutoIT`, `PlanEvaluatorTest`,
  `RecoveryReturnServiceIT`. Commit `feat(train): technique sets in records, tonnage, grind and caps (mezo-r36n9.80)`.
- [ ] **Step 3:** File the follow-up bd issue (companion `TrainTools` / `MetricSeriesService` tonnage with legs) under
  the epic, priority 3.

### Task 9: Docs, gates, ship

**Files:** `docs/features/train.md` (§4 technique model, legs, reader table; §9 traps: legs only through live parents,
absent legs = untouched, web never sets the flag; §10 key files; fix the duplicated "Volume engine v2" heading),
`docs/features/README.md` row, `docs/milestones/roadmap.md`, a new handbook page
`docs/boop-handbook/07-edzes/15-technikak.md` (+ touch `04-progresszio-motor.md`, `14-edzesstilus.md` links),
`_jegyek.json`, `_dontesek.json`, `_kiadasok.json`, `docs/CODEMAP.md` (generated), the spec's status line.

- [ ] **Step 1:** Production baseline before deploy (reads only): the active run's id, `training_style`, its plan rows
  (id, working_sets, rep range, target_rir) hashed.
- [ ] **Step 2:** `cd backend && ./mvnw -q clean test -Dmezo.test.use-testcontainers=true` → BUILD SUCCESS (known flake
  `mezo-r36n9.86`: rerun alone); `ArchitectureTest` green. Frontend: `CI=true pnpm test` with `VITE_USE_MOCK` unset and
  `=false`, `pnpm build` — green with only `api.gen.ts` changed.
- [ ] **Step 3:** Docs; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors / 0 stale.
- [ ] **Step 4:** Fetch, rebase onto `origin/main` (S3 may have landed: re-run api merge + client gen + codemap; keep the
  changeset after S3's), merge `--no-ff` on a detached `origin/main`, `git push origin HEAD:main`; watch `ci` and
  `deploy` to green; the pod's image tag = the release.
- [ ] **Step 5: Production check** (reads only):
  ```sql
  select techniques_enabled from mesocycle where status = 'active' and not is_deleted;            -- false
  select count(*) from exercise where technique is not null or challenge;                          -- 0
  select count(*) from exercise_set_leg;                                                           -- 0
  ```
  plus the baseline hash of Step 1 unchanged — the owner's run prescribes exactly as before.
- [ ] **Step 6:** Announce on bd `.78`, fetch + rebase, `node scripts/boop-notion-sync.mjs plan` → apply → `check` exits
  0; `node scripts/check-beads-backup.mjs --fix`; close `mezo-r36n9.80`; commit; push; Hungarian report.

## Kész, ha…

- Egy blokk gyakorlatához beállítható egy technika (pihenős drop, drop set, myo set, félismétlések) vagy a napi
  kihívás; csak stabil gyakorlatra, a félismétlés és a kihívás csak nyújtott helyzetben biztonságos gyakorlatra — minden
  más esetben a szerver elutasítja, akár a sablon mentésénél, akár a futó blokkban.
- A technika a meglévő utolsó sorozatot váltja ki (nem jön plusz sorozat), a terhelő hetekben él, a könnyített héten
  nem; a kihívás nyer, ha egy gyakorlaton technika és kihívás is lenne; naponta legfeljebb egy kihívás.
- A napi edzés az utolsó sorozatnál lépésenként előírja, mit kell csinálni (pl. „bukásig → 30 mp pihenő → 27,5 kg,
  ugyanannyi ismétlés”), valós súlyra kerekítve; a kihívásnál ott a megdöntendő szám.
- A naplóban a technika részei („lábai”) rögzíthetők, javíthatók; egy webes szerkesztés nem törli őket.
- A technika részei nem kerülnek a rekordokba, a becsült maximumba, a következő edzés alapjába és a heti
  sorozatszámba; a félismétlés a megmozgatott összsúlyba sem; a szándékos bukás nem számít „túl nehéz” jelnek; a
  technikás sorozat kettőnek számít a napi és gyakorlatonkénti felső korlátnál.
- Ahol a blokkban nincs bekapcsolva a technika (minden webes blokk és a tulaj futó blokkja), minden pontosan úgy
  működik, mint eddig — teszttel és éles lekérdezéssel igazolva.
- A webes app változatlanul működik: a frontend tesztek mindkét módban zöldek, csak a generált kliens változott.
- A teljes backend tesztkészlet zöld; `ArchitectureTest`, kódtérkép és dokumentum-ellenőrzés hibátlan.
- Élesítve: a `deploy` zöld, a pod az új verziót futtatja, az éles lekérdezések a várt értékeket adják.
- `train.md`, a kézikönyv új technika-oldala, a döntésnapló, a mérföldkő-napló és a Notion tükör a kiadott állapotot írja le.
