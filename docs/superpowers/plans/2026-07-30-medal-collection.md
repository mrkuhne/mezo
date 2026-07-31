# Medal Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every logged working set is evaluated live against the lifter's own history and against the Progresszió-prescribed target; broken records celebrate, target hits stay quiet, and a Train-side medal cabinet shows the whole dated history.

**Architecture:** Medals are **derived, never stored** — a pure `MedalEvaluator` replays `exercise_set` rows chronologically per exercise identity. The one new persisted fact is the prescribed target on the set row (`target_weight_kg`, `target_reps`), without which `TARGET_HIT` is underivable. Medal XP folds into the **existing** GYM award (`ProgressionService.applyGym`) via two new `GymSignal` counters — no new progression source, no coins.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven / Postgres / Liquibase / MapStruct / Lombok · React 19 / Vite / TypeScript / TanStack Query / Tailwind v4 · OpenAPI 3.0.3 contract-first.

Driving spec: [`2026-07-30-medal-collection-design.md`](../specs/2026-07-30-medal-collection-design.md). Driving bd issue: **mezo-wp6n**.

## Global Constraints

- Base package `io.mrkuhne.mezo`; primary keys are **UUID**; ownership via `created_by` set server-side from `CurrentUserId`, never from the client.
- **Contract-first**: edit `api/feature/train/train.yml` BEFORE any Java/TS, then `cd api/generate && npm run generate:api` and `cd frontend && pnpm generate:api`. Both generated outputs (`api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`) are committed. Never hand-write boundary DTOs.
- Controllers implement the generated `<Tag>Api` interface — **no** `@RequestMapping`/`@PostMapping`/`@Valid` on the implementation.
- Spring: constructor injection via `@RequiredArgsConstructor` (never field injection); `@Transactional` on methods only.
- Backend tests: extend `AbstractIntegrationTest` (service-level, `@Transactional`) or `ApiIntegrationTest` (HTTP-level, no `@Transactional`). **AssertJ only.** Naming `test{Method}_should{Result}_when{Condition}`. Test data via `*Populator` factories, never inline entity setup and never SQL.
- **The owner in an `ApiIntegrationTest`:** `ApiIntegrationTest` carries `@ActiveProfiles("demodata")`, so the seeded owner exists and `ownerAuthHeaders()` works. Resolve its id exactly as `WorkoutFinishLevelUpApiIT` does — `databasePopulator.populateUser(ownerProperties.ownerEmail())` — because the HTTP calls authenticate as that owner and rows created under a different user would be invisible to them. The "create the user via `UserPopulator`" rule applies only to test classes that add their own `@TestPropertySource` (which forks a second Spring context with an unseeded DB); **none of the tests in this plan do that**, so do not add one.
- **Do NOT run the full backend suite** (`./mvnw clean test` with no `-Dtest`) — this machine OOMs on it; CI is the authoritative gate. Always run backend tests as `cd backend && ./mvnw clean test -Dtest='<YourClasses>,ArchitectureTest'` with `clean` (Lombok+MapStruct incremental compile is flaky), as a **foreground** Bash call with an explicit `timeout: 600000`.
- Frontend: four layers (`app/` · `features/` · `shared/` · `data/`); features import hooks from **`@/data/hooks` only**; deep absolute `@/*` imports, no relative `../`, no barrels besides `data/hooks.ts`; colocated tests; colors via `var(--token)` only, no raw hex.
- **New dual-mode reads use `useDualQuery`** — it lives at `@/data/useDualQuery` (NOT under `_client/`). Note `trainHooks.ts` predates it and uses the raw `useQuery` + `initialData` pattern throughout; **do not refactor it**, but any hook this plan adds must use `useDualQuery`. `frontend/src/data/dualMode.guard.test.ts` fails the build on the leaky `const { data = mockSeed } = useQuery(...)` form.
- Frontend gate: `cd frontend && pnpm test <pattern>` **and** `VITE_USE_MOCK=true pnpm test <pattern>` **and** `pnpm build`. Both modes must be green. Run each as its own foreground call with `timeout: 600000`.
- **Never run `pnpm test:visual` and never regenerate Playwright goldens** — baselines are per-platform and the coordinator handles them at ship time.
- Hungarian UI copy; English code, comments and commit messages. Conventional commit subjects carrying the bd id: `feat(train): … (mezo-wp6n)`.
- Commit with explicit `git add <paths>` + `git commit --no-verify` — **never `git add -A`** (the beads pre-commit hook force-stages a stray gitignored root `issues.jsonl`).

---

## File Structure

**Backend (create)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MedalEvaluator.java` — pure medal rules, no Spring, no DB.
- `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MedalService.java` — replay + the three read shapes.
- `backend/src/main/resources/db/changelog/1.0.0/script/202607301900_mezo-wp6n_exercise_set_target.sql`
- `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MedalEvaluatorTest.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java`

**Backend (modify)**
- `api/feature/train/train.yml` — `Medal`, `MedalListResponse`, `GET /api/train/medals`, three schema extensions.
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — one changeSet entry.
- `feature/train/entity/ExerciseSetEntity.java` — two columns.
- `feature/train/service/WorkoutService.java` — persist targets in `logSet`; attach medals in `logSet` + `finishWorkout`.
- `feature/train/controller/TrainController.java` — `getMedals()`.
- `feature/train/signal/GymSignalCalculator.java` — count the session's medals.
- `feature/progression/gym/GymSignal.java` — two counters.
- `feature/progression/service/ProgressionService.java` — real PR bonus + target-medal XP.
- `feature/progression/config/ProgressionProperties.java` + `application.yml` — two new Gym properties.

**Frontend (create)**
- `frontend/src/data/train/medalTypes.ts` · `medalApi.ts` · `medalEvaluator.ts` · `medalMock.ts` · `medalHooks.ts` (+ `medalEvaluator.test.ts`)
- `frontend/src/features/train/components/MedalToast.tsx` (+ test) · `MedalChip.tsx`
- `frontend/src/features/train/pages/MedalsPage.tsx` (+ test)

**Frontend (modify)**
- `frontend/src/data/hooks.ts` · `data/train/trainApi.ts` · `data/train/trainHooks.ts`
- `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (+ test) · `pages/tabs.ts` · `pages/train.nav.test.tsx` · `app/router.tsx`
- `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java` (one `@Mapping(target = "medals", ignore = true)`)
- `frontend/src/features/train/components/WorkoutSummary.tsx` (+ test)
- `frontend/src/test/msw/handlers.ts`
- **Delete:** `frontend/src/features/train/components/PRToast.tsx`

**Docs (modify/create)**
- `docs/features/train.md` · `docs/features/growth.md` · `docs/decisions/0015-medals-derived-not-materialized.md`

---

## Task 1: Contract — medal schemas + endpoint

**Files:**
- Modify: `api/feature/train/train.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: generated Java DTOs `io.mrkuhne.mezo.api.dto.Medal` (with `Medal.TypeEnum`, `Medal.UnitEnum`, `Medal.TierEnum`) and `MedalListResponse`; generated `TrainApi.getMedals()`; extended `SetLogRequest.getTargetWeightKg()/getTargetReps()`, `ExerciseSetResponse.setMedals(List<Medal>)`, `WorkoutInstanceResponse.setMedals(List<Medal>)`. Frontend type `components['schemas']['Medal']`.

- [ ] **Step 1: Add the `Medal` + `MedalListResponse` schemas**

In `api/feature/train/train.yml`, under `components.schemas`, next to `ExerciseRecordResponse`, add:

```yaml
    Medal:
      type: object
      required: [type, tier, exerciseName, date, value, unit]
      properties:
        type:
          type: string
          enum: [WEIGHT, REPS_AT_WEIGHT, E1RM, SESSION_VOLUME, TARGET_HIT]
        tier:
          type: string
          enum: [RECORD, TARGET]
        exerciseName:
          type: string
        catalogId:
          type: string
          format: uuid
          nullable: true
        muscle:
          type: string
          nullable: true
        date:
          type: string
          format: date
        workoutSessionId:
          type: string
          format: uuid
          nullable: true
        setIndex:
          type: integer
          nullable: true
        value:
          type: number
          description: kg for WEIGHT/E1RM/SESSION_VOLUME, reps for REPS_AT_WEIGHT/TARGET_HIT
        unit:
          type: string
          enum: [KG, REPS]
        weightKg:
          type: number
          nullable: true
          description: the achieving set's load
        reps:
          type: integer
          nullable: true
        previousValue:
          type: number
          nullable: true
          description: what was beaten; always null for TARGET_HIT
        previousDate:
          type: string
          format: date
          nullable: true
    MedalListResponse:
      type: object
      required: [medals]
      properties:
        medals:
          type: array
          items:
            $ref: '#/components/schemas/Medal'
```

- [ ] **Step 2: Add the cabinet endpoint**

Under `paths`, immediately after the `/api/train/exercise-records` block, add:

```yaml
  /api/train/medals:
    get:
      tags: [Train]
      operationId: getMedals
      summary: The owner's full medal history, newest first (derived from logged sets)
      responses:
        '200':
          description: Medals
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MedalListResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '../../common/common-schemas.yml#/components/schemas/SystemMessageList'
```

Copy the `$ref` path for `SystemMessageList` verbatim from the neighbouring `/api/train/exercise-records` block — if it differs there, match that file's form exactly.

- [ ] **Step 3: Extend the three existing schemas**

In `SetLogRequest.properties` (currently ends after `kind`), add:

```yaml
        targetWeightKg:
          type: number
          minimum: 0
          maximum: 999
          nullable: true
          description: The Progresszió-prescribed load for this set, snapshotted at log time
        targetReps:
          type: integer
          minimum: 1
          maximum: 100
          nullable: true
          description: The Progresszió-prescribed reps for this set, snapshotted at log time
```

In `ExerciseSetResponse.properties`, add:

```yaml
        medals:
          type: array
          items:
            $ref: '#/components/schemas/Medal'
          description: Medals this set earned (empty when none)
```

In `WorkoutInstanceResponse.properties`, after `levelUp`, add the same `medals` array block (description: `Medals earned across the session, including SESSION_VOLUME`).

- [ ] **Step 4: Merge and regenerate both sides**

Run each as its own foreground call:

```bash
cd api/generate && npm run generate:api
```

```bash
cd frontend && pnpm generate:api
```

Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` both change.

- [ ] **Step 5: Silence MapStruct for the new unmapped target**

`ExerciseSetResponse` is produced by MapStruct (`TrainMapper.toSetResponse`, `TrainMapper.java:65-66`) and `ExerciseSetEntity` has no `medals` property — an unmapped target. Add the ignore next to the existing `kind` mapping, matching the `@Mapping(target = "editable", ignore = true)` idiom already in that file:

```java
    @Mapping(target = "kind", expression = "java(ExerciseSetResponse.KindEnum.fromValue(entity.getKind()))")
    @Mapping(target = "medals", ignore = true)
    ExerciseSetResponse toSetResponse(ExerciseSetEntity entity);
```

`WorkoutInstanceResponse` needs no equivalent — it is hand-built with the generated Lombok builder in `WorkoutService.toInstanceResponse` (`:619-629`), not mapped.

- [ ] **Step 6: Verify the generated types exist**

```bash
grep -n "MedalListResponse\|REPS_AT_WEIGHT" api/openapi.yml | head
grep -n "Medal:" frontend/src/data/_client/api.gen.ts | head
```

Expected: both grep results are non-empty.

- [ ] **Step 7: Commit**

```bash
git add api/feature/train/train.yml api/openapi.yml frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java
git commit --no-verify -m "feat(api): medal contract — Medal schema, GET /api/train/medals, set target snapshot (mezo-wp6n)"
```

---

## Task 2: Persist the prescribed target on the set row

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607301900_mezo-wp6n_exercise_set_target.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseSetEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java:479-503`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java` (created here, grows in Tasks 4–5)

**Interfaces:**
- Consumes: Task 1's `SetLogRequest.getTargetWeightKg()/getTargetReps()`.
- Produces: `ExerciseSetEntity.getTargetWeightKg(): BigDecimal` and `getTargetReps(): Integer` (both nullable), populated by `WorkoutService.logSet`.

- [ ] **Step 1: Write the migration**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202607301900_mezo-wp6n_exercise_set_target.sql`:

```sql
-- Medal collection (bd mezo-wp6n): snapshot the Progresszió-prescribed target onto the logged
-- set. Without it TARGET_HIT is underivable — ProgressionSignal is recomputed from the LATEST
-- history on every read, so a past set's prescription cannot be reconstructed. Both nullable:
-- null = no prescription was in force (first session, switch off, or a pre-mezo-wp6n row).
alter table exercise_set add column target_weight_kg numeric(6, 2);
alter table exercise_set add column target_reps integer;
```

- [ ] **Step 2: Register the changeSet**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (keep the file's exact indentation — copy the shape of the last existing entry):

```yaml
  - changeSet:
      id: "1.0.0:202607301900_mezo-wp6n_exercise_set_target"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607301900_mezo-wp6n_exercise_set_target.sql
```

- [ ] **Step 3: Add the entity fields**

In `ExerciseSetEntity.java`, after the `doneAt` field (`:74-75`):

```java
    /** The Progresszió-prescribed load for this set, snapshotted at log time (null = none). */
    @Column(name = "target_weight_kg", precision = 6, scale = 2)
    private BigDecimal targetWeightKg;

    /** The Progresszió-prescribed reps for this set, snapshotted at log time (null = none). */
    @Column(name = "target_reps")
    private Integer targetReps;
```

- [ ] **Step 4: Persist them in `logSet`**

In `WorkoutService.logSet` (`:490-502`), after `set.setDoneAt(Instant.now());` and before the `return`:

```java
        set.setTargetWeightKg(req.getTargetWeightKg());
        set.setTargetReps(req.getTargetReps());
```

- [ ] **Step 5: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java`, modelled on `WorkoutFinishLevelUpApiIT` in the same package. **This is the fixture vocabulary every later task reuses — get it right here:**

```java
class MedalApiIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseSetRepository exerciseSetRepository;
    @Autowired private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }
}
```

The populator API (verified — do not invent other names):
`trainPopulator.createMesocycle(owner, "Hyp 04", "active")` ·
`trainPopulator.createWorkoutSession(owner, mesoId, "Hétfő", "push", 0, "planned")` (the template row) ·
`trainPopulator.createWorkoutInstance(owner, template, LocalDate, "active"|"completed")` ·
`trainPopulator.createExercise(owner, templateId, "Fekvenyomás", 0)` ·
`trainPopulator.createExerciseSetFull(owner, exerciseId, instanceId, setIndex, new BigDecimal("100.00"), 10, false)`.

Note `finishWorkout`/`logSet` only accept **instance** rows (`templateSessionId != null`), so every fixture needs the template → instance pair.

The first test:

```java
    @Test
    void testLogSet_shouldPersistTheTargetSnapshot_whenTheRequestCarriesOne() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "active");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);

        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(bench.getId()).setIndex(0)
            .weightKg(new BigDecimal("100.00")).reps(8).rir(2).kind(SetLogRequest.KindEnum.WORKING)
            .targetWeightKg(new BigDecimal("100.00")).targetReps(8)
            .build();
        ExerciseSetResponse body = postForBody(
            "/api/train/workouts/" + instance.getId() + "/sets", req,
            ownerAuthHeaders(), HttpStatus.CREATED, ExerciseSetResponse.class);

        ExerciseSetEntity reloaded = exerciseSetRepository.findById(body.getId()).orElseThrow();
        assertThat(reloaded.getTargetWeightKg()).isEqualByComparingTo("100.00");
        assertThat(reloaded.getTargetReps()).isEqualTo(8);
    }
```

If the generated `SetLogRequest` builder or `KindEnum` differs, use whatever `target/generated-sources/openapi/.../SetLogRequest.java` actually exposes.

- [ ] **Step 6: Run the test**

```bash
cd backend && ./mvnw clean test -Dtest='MedalApiIT,ArchitectureTest'
```

(Foreground, `timeout: 600000`.) Expected: PASS. If the DB is stale, `docker compose up -d` first; Liquibase applies the new changeset on context boot.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseSetEntity.java backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java
git commit --no-verify -m "feat(train): snapshot the prescribed target onto exercise_set (mezo-wp6n)"
```

---

## Task 3: `MedalEvaluator` — the pure rules

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MedalEvaluator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MedalEvaluatorTest.java`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `MedalEvaluator.Candidate(BigDecimal weightKg, int reps, BigDecimal targetWeightKg, Integer targetReps)` — a record.
  - `MedalEvaluator.Prior(BigDecimal weightKg, int reps)` — a record.
  - `MedalEvaluator.Award(MedalKind kind, BigDecimal value, BigDecimal previousValue)` — a record; `previousValue` null on `TARGET_HIT`.
  - `enum MedalKind { WEIGHT, REPS_AT_WEIGHT, E1RM, SESSION_VOLUME, TARGET_HIT }`
  - `static List<Award> forSet(Candidate candidate, List<Prior> priors)`
  - `static Award sessionVolume(BigDecimal sessionVolume, BigDecimal bestPriorSessionVolume)` — returns null when it does not qualify.
  - `static BigDecimal epley(BigDecimal weightKg, int reps)`

- [ ] **Step 1: Write the failing test**

Create `MedalEvaluatorTest.java` (plain JUnit 5 + AssertJ, no Spring — the `ProgressionDeciderTest` idiom):

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.MedalEvaluator.Candidate;
import io.mrkuhne.mezo.feature.train.service.MedalEvaluator.MedalKind;
import io.mrkuhne.mezo.feature.train.service.MedalEvaluator.Prior;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class MedalEvaluatorTest {

    private static Prior prior(String kg, int reps) {
        return new Prior(new BigDecimal(kg), reps);
    }

    private static Candidate set(String kg, int reps) {
        return new Candidate(new BigDecimal(kg), reps, null, null);
    }

    private static Candidate set(String kg, int reps, String targetKg, Integer targetReps) {
        return new Candidate(new BigDecimal(kg), reps,
            targetKg == null ? null : new BigDecimal(targetKg), targetReps);
    }

    private static List<MedalKind> kinds(List<MedalEvaluator.Award> awards) {
        return awards.stream().map(MedalEvaluator.Award::kind).toList();
    }

    @Test
    void testForSet_shouldAwardNothing_whenThereIsNoPriorHistory() {
        assertThat(MedalEvaluator.forSet(set("100", 8), List.of())).isEmpty();
    }

    @Test
    void testForSet_shouldAwardWeightAndE1rm_whenTheLoadBeatsEveryPrior() {
        var awards = MedalEvaluator.forSet(set("102.5", 8), List.of(prior("100", 8)));
        assertThat(kinds(awards)).containsExactlyInAnyOrder(MedalKind.WEIGHT, MedalKind.E1RM);
        assertThat(awards.stream().filter(a -> a.kind() == MedalKind.WEIGHT).findFirst().orElseThrow()
            .previousValue()).isEqualByComparingTo("100");
    }

    @Test
    void testForSet_shouldAwardRepsAtWeight_whenMoreRepsAtAWeightAlreadyLifted() {
        var awards = MedalEvaluator.forSet(set("100", 9), List.of(prior("100", 8)));
        assertThat(kinds(awards)).contains(MedalKind.REPS_AT_WEIGHT);
        assertThat(awards.stream().filter(a -> a.kind() == MedalKind.REPS_AT_WEIGHT).findFirst()
            .orElseThrow().previousValue()).isEqualByComparingTo("8");
    }

    @Test
    void testForSet_shouldNotAwardRepsAtWeight_whenThatWeightWasNeverLiftedBefore() {
        var awards = MedalEvaluator.forSet(set("97.5", 12), List.of(prior("100", 8)));
        assertThat(kinds(awards)).doesNotContain(MedalKind.REPS_AT_WEIGHT);
    }

    @Test
    void testForSet_shouldAwardNothing_whenTheSetOnlyTiesTheRecord() {
        assertThat(MedalEvaluator.forSet(set("100", 8), List.of(prior("100", 8)))).isEmpty();
    }

    @Test
    void testForSet_shouldAwardTargetHit_whenBothPrescribedValuesAreMet() {
        var awards = MedalEvaluator.forSet(set("100", 8, "100", 8), List.of(prior("100", 8)));
        assertThat(kinds(awards)).containsExactly(MedalKind.TARGET_HIT);
        assertThat(awards.getFirst().previousValue()).isNull();
        assertThat(awards.getFirst().value()).isEqualByComparingTo("8");
    }

    @Test
    void testForSet_shouldAwardTargetHit_whenThereIsNoPriorHistoryAtAll() {
        var awards = MedalEvaluator.forSet(set("60", 10, "60", 10), List.of());
        assertThat(kinds(awards)).containsExactly(MedalKind.TARGET_HIT);
    }

    @Test
    void testForSet_shouldNotAwardTargetHit_whenTheRepsFallShort() {
        assertThat(MedalEvaluator.forSet(set("100", 7, "100", 8), List.of(prior("100", 8))))
            .noneMatch(a -> a.kind() == MedalKind.TARGET_HIT);
    }

    @Test
    void testForSet_shouldNotAwardTargetHit_whenNoTargetWasPrescribed() {
        assertThat(MedalEvaluator.forSet(set("100", 8, null, null), List.of()))
            .noneMatch(a -> a.kind() == MedalKind.TARGET_HIT);
    }

    @Test
    void testForSet_shouldAwardE1rmAlone_whenMoreRepsAtALighterLoadBeatTheEstimate() {
        // 95 × 12 → e1RM 133.0 beats 100 × 8 → e1RM 126.67, but the load itself is lower.
        var awards = MedalEvaluator.forSet(set("95", 12), List.of(prior("100", 8)));
        assertThat(kinds(awards)).containsExactly(MedalKind.E1RM);
    }

    @Test
    void testSessionVolume_shouldAward_whenThisSessionBeatsEveryPriorSession() {
        var award = MedalEvaluator.sessionVolume(new BigDecimal("2400"), new BigDecimal("2200"));
        assertThat(award).isNotNull();
        assertThat(award.value()).isEqualByComparingTo("2400");
        assertThat(award.previousValue()).isEqualByComparingTo("2200");
    }

    @Test
    void testSessionVolume_shouldAwardNothing_whenThereIsNoPriorSession() {
        assertThat(MedalEvaluator.sessionVolume(new BigDecimal("2400"), null)).isNull();
    }

    @Test
    void testEpley_shouldMatchTheRecordServiceFormula_whenGivenAWeightedSet() {
        assertThat(MedalEvaluator.epley(new BigDecimal("100"), 8)).isEqualByComparingTo("126.6667");
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='MedalEvaluatorTest'
```

Expected: compilation failure — `MedalEvaluator` does not exist.

- [ ] **Step 3: Implement `MedalEvaluator`**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MedalEvaluator.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure medal rules (spec 2026-07-30-medal-collection-design.md §6). No Spring, no DB — given one
 * candidate set and every comparable set logged strictly before it (same exercise identity,
 * working, reps present), decides which medals that set earns.
 *
 * <p>Medals are DERIVED, never stored: this class is replayed over the set history rather than
 * consulted once and persisted, so editing a past set silently corrects the whole medal history.
 *
 * <p>Invariants: strict {@code >} (a tie earns nothing); a candidate with no comparable prior
 * earns no RECORD medal (the baseline is established silently); {@code TARGET_HIT} is
 * history-independent and compares only against the set's own snapshotted prescription.
 */
public final class MedalEvaluator {

    private static final BigDecimal THIRTY = new BigDecimal("30");

    private MedalEvaluator() {}

    public enum MedalKind { WEIGHT, REPS_AT_WEIGHT, E1RM, SESSION_VOLUME, TARGET_HIT }

    /** One comparable set already logged before the candidate. */
    public record Prior(BigDecimal weightKg, int reps) {}

    /** The set being judged. {@code targetWeightKg}/{@code targetReps} are null when unprescribed. */
    public record Candidate(BigDecimal weightKg, int reps, BigDecimal targetWeightKg, Integer targetReps) {}

    /** An earned medal. {@code previousValue} is null when nothing was beaten (TARGET_HIT). */
    public record Award(MedalKind kind, BigDecimal value, BigDecimal previousValue) {}

    public static List<Award> forSet(Candidate candidate, List<Prior> priors) {
        List<Award> awards = new ArrayList<>();
        BigDecimal w = candidate.weightKg();

        if (w != null) {
            BigDecimal bestWeight = priors.stream().map(Prior::weightKg)
                .filter(java.util.Objects::nonNull).max(BigDecimal::compareTo).orElse(null);
            if (bestWeight != null && w.compareTo(bestWeight) > 0) {
                awards.add(new Award(MedalKind.WEIGHT, w, bestWeight));
            }

            Integer bestRepsAtWeight = priors.stream()
                .filter(p -> p.weightKg() != null && p.weightKg().compareTo(w) == 0)
                .map(Prior::reps).max(Integer::compareTo).orElse(null);
            if (bestRepsAtWeight != null && candidate.reps() > bestRepsAtWeight) {
                awards.add(new Award(MedalKind.REPS_AT_WEIGHT,
                    BigDecimal.valueOf(candidate.reps()), BigDecimal.valueOf(bestRepsAtWeight)));
            }

            BigDecimal e1rm = epley(w, candidate.reps());
            BigDecimal bestE1rm = priors.stream()
                .filter(p -> p.weightKg() != null)
                .map(p -> epley(p.weightKg(), p.reps())).max(BigDecimal::compareTo).orElse(null);
            if (bestE1rm != null && e1rm.compareTo(bestE1rm) > 0) {
                awards.add(new Award(MedalKind.E1RM,
                    e1rm.setScale(1, RoundingMode.HALF_UP), bestE1rm.setScale(1, RoundingMode.HALF_UP)));
            }
        }

        if (candidate.targetWeightKg() != null && candidate.targetReps() != null
            && w != null && w.compareTo(candidate.targetWeightKg()) >= 0
            && candidate.reps() >= candidate.targetReps()) {
            awards.add(new Award(MedalKind.TARGET_HIT, BigDecimal.valueOf(candidate.reps()), null));
        }
        return awards;
    }

    /** Session-scoped: null when there is no prior session or this one does not beat it. */
    public static Award sessionVolume(BigDecimal sessionVolume, BigDecimal bestPriorSessionVolume) {
        if (sessionVolume == null || bestPriorSessionVolume == null
            || sessionVolume.compareTo(bestPriorSessionVolume) <= 0) {
            return null;
        }
        return new Award(MedalKind.SESSION_VOLUME, sessionVolume, bestPriorSessionVolume);
    }

    /** Epley e1RM: weight × (30 + reps) / 30, scale 4 HALF_UP (matches ExerciseRecordService). */
    public static BigDecimal epley(BigDecimal weightKg, int reps) {
        return weightKg.multiply(BigDecimal.valueOf(30L + reps)).divide(THIRTY, 4, RoundingMode.HALF_UP);
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dtest='MedalEvaluatorTest,ArchitectureTest'
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MedalEvaluator.java backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MedalEvaluatorTest.java
git commit --no-verify -m "feat(train): pure MedalEvaluator — record + target-hit rules (mezo-wp6n)"
```

---

## Task 4: `MedalService` + the cabinet endpoint

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MedalService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java` (extend)

**Interfaces:**
- Consumes: `MedalEvaluator` (Task 3); `ExerciseSetEntity.getTargetWeightKg()/getTargetReps()` (Task 2); generated `Medal`/`MedalListResponse` (Task 1).
- Produces:
  - `MedalService.list(UUID createdBy): List<Medal>` — newest first.
  - `MedalService.forSet(UUID createdBy, UUID setId): List<Medal>`
  - `MedalService.forSession(UUID createdBy, UUID workoutSessionId): List<Medal>`

- [ ] **Step 1: Implement `MedalService`**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MedalService.java`. Mirror `ExerciseRecordService` exactly for the identity resolution and the set load — read that file first (`ExerciseRecordService.java:47-82`) and reuse the same three repositories, the same `"c:" + catalogId` / `"n:" + name` key, the same `findIdentityRowsIncludingDeleted`, and the same `setInstant` (`doneAt` else `createdAt`) / `setDate` helpers.

Shape:

```java
@Service
@RequiredArgsConstructor
public class MedalService {

    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;

    /** Every medal the owner has ever earned, newest first. Replayed — never stored. */
    public List<Medal> list(UUID createdBy) { return replay(createdBy).stream()
        .sorted(Comparator.comparing(Medal::getDate).reversed()).toList(); }

    public List<Medal> forSet(UUID createdBy, UUID setId) { ... }

    public List<Medal> forSession(UUID createdBy, UUID workoutSessionId) { ... }
}
```

The single private `replay(createdBy)` does the work:

1. Load `exerciseSetRepository.findByCreatedByAndRepsNotNullAndKind(createdBy, "working")`.
2. Drop rows where `isSkipped()`.
3. Resolve each set's identity via `exerciseRepository.findIdentityRowsIncludingDeleted(createdBy)`; skip sets whose exercise row is missing.
4. Group by identity key; within each group sort ascending by `setInstant`.
5. Walk the group in order, keeping a growing `List<Prior>`; for each set call `MedalEvaluator.forSet(...)` with the priors accumulated **so far**, then append the set to the priors. Convert each `Award` to a `Medal` (below), then move on.
6. Per identity, also group the sets by `workoutSessionId` (null → fall back to `exerciseId`, as `ExerciseRecordService.java:99-101` does), compute each session's Σ(weight × reps) rounded whole via `setScale(0, HALF_UP)`, walk the sessions in date order, and call `MedalEvaluator.sessionVolume(thisVolume, bestSoFar)` — appending a `SESSION_VOLUME` medal when non-null, then raising `bestSoFar`.

Award → `Medal` mapping (a private helper; the catalog name/muscle resolution copies `ExerciseRecordService.toRecord`'s first lines):

```java
    private Medal toMedal(MedalEvaluator.Award award, ExerciseIdentityRow display,
        ExerciseCatalogEntity cat, ExerciseSetEntity set, LocalDate date) {
        boolean reps = award.kind() == MedalKind.REPS_AT_WEIGHT
            || award.kind() == MedalKind.TARGET_HIT;
        return Medal.builder()
            .type(Medal.TypeEnum.fromValue(award.kind().name()))
            .tier(award.kind() == MedalKind.TARGET_HIT ? Medal.TierEnum.TARGET : Medal.TierEnum.RECORD)
            .exerciseName(cat != null ? cat.getName() : display.getName())
            .catalogId(display.getCatalogId())
            .muscle(cat != null ? cat.getMuscle() : display.getMuscle())
            .date(date)
            .workoutSessionId(set != null ? set.getWorkoutSessionId() : null)
            .setIndex(set != null ? set.getSetIndex() : null)
            .value(award.value())
            .unit(reps ? Medal.UnitEnum.REPS : Medal.UnitEnum.KG)
            .weightKg(set != null ? set.getWeightKg() : null)
            .reps(set != null ? set.getReps() : null)
            .previousValue(award.previousValue())
            .previousDate(/* the date of the set or session that held the record */)
            .build();
    }
```

For `previousDate`, track the date alongside each running best while walking (a small mutable holder per record type per identity) and pass it in. For a `SESSION_VOLUME` medal, `set` is the session's top set (max weight, then reps) so the row still names a concrete lift; `date` is the session date.

`forSet` and `forSession` both run the same `replay` and filter the result — `forSet` matches on `workoutSessionId` + `setIndex` of the target set (load it by id, owner-checked), `forSession` on `workoutSessionId`. Simplicity beats micro-optimisation here; the replay is the same in-memory pass `ExerciseRecordService` already does on every records read.

If the generated builder's enum accessor names differ from the guesses above, use whatever `target/generated-sources/openapi/.../Medal.java` actually exposes — do not fight the generator.

- [ ] **Step 2: Wire the controller**

In `TrainController.java`, add `private final MedalService medalService;` to the injected fields (constructor injection via the existing `@RequiredArgsConstructor` — do not add a constructor) and:

```java
    @Override
    public MedalListResponse getMedals() {
        return MedalListResponse.builder().medals(medalService.list(currentUserId.get())).build();
    }
```

Match the `currentUserId` accessor to whatever `getExerciseRecords()` uses in the same class.

- [ ] **Step 3: Write the failing tests**

Extend `MedalApiIT` with:

```java
    @Test
    void testGetMedals_shouldReturnEmpty_whenTheOwnerHasNoSets() { /* GET, expect medals empty */ }

    @Test
    void testGetMedals_shouldNotAwardAnything_whenOnlyOneSessionWasEverLogged() {
        // A single completed session establishes the baseline silently.
    }

    @Test
    void testGetMedals_shouldAwardWeightAndE1rm_whenASecondSessionBeatsTheFirst() {
        // session 1: 100 kg × 8. session 2: 102.5 kg × 8.
        // Expect a WEIGHT medal (value 102.5, previousValue 100) and an E1RM medal,
        // both dated on session 2's date.
    }

    @Test
    void testGetMedals_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/medals", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
```

Build the two sessions with the Task-2 fixture vocabulary (`createWorkoutInstance(..., "completed")` for the historic session; the two instances need **different dates** so the replay orders them). Assert with AssertJ on the deserialized `MedalListResponse`.

Note the replay orders sets by `doneAt` else `createdAt`; `createExerciseSetFull` does not set `doneAt`, so rows created in sequence order correctly by `createdAt` — but if two fixture sets land in the same clock tick, set `doneAt` explicitly on the entity and `saveAndFlush` it before asserting.

- [ ] **Step 4: Run**

```bash
cd backend && ./mvnw clean test -Dtest='MedalApiIT,MedalEvaluatorTest,ArchitectureTest'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MedalService.java backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java
git commit --no-verify -m "feat(train): MedalService replay + GET /api/train/medals cabinet (mezo-wp6n)"
```

---

## Task 5: Live medals on set-log and finish

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java:479-503` and `:594-610`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java` (extend)

**Interfaces:**
- Consumes: `MedalService.forSet` / `forSession` (Task 4).
- Produces: `ExerciseSetResponse.medals` populated on every `POST /workouts/{id}/sets`; `WorkoutInstanceResponse.medals` populated on `POST /workouts/{id}/finish`.

- [ ] **Step 1: Inject `MedalService` into `WorkoutService`**

Add `private final MedalService medalService;` alongside the existing injected fields.

- [ ] **Step 2: Attach medals in `logSet`**

Replace the final line of `logSet` (`return mapper.toSetResponse(exerciseSetRepository.save(set));`) with:

```java
        ExerciseSetEntity saved = exerciseSetRepository.save(set);
        exerciseSetRepository.flush(); // the replay reads through the repository — the row must be visible
        ExerciseSetResponse response = mapper.toSetResponse(saved);
        response.setMedals(medalService.forSet(createdBy, saved.getId()));
        return response;
```

- [ ] **Step 3: Attach medals in `finishWorkout`**

In `finishWorkout`, after the `progressionGate` block and before `return base;`:

```java
        base.setMedals(medalService.forSession(createdBy, instance.getId()));
```

- [ ] **Step 4: Write the failing tests**

Extend `MedalApiIT`:

```java
    @Test
    void testLogSet_shouldReturnAWeightMedal_whenTheSetBeatsAPriorSession() {
        // Prior completed session at 100 kg × 8, then an active instance;
        // log 102.5 kg × 8 → the response's medals contain WEIGHT with previousValue 100.
    }

    @Test
    void testLogSet_shouldReturnATargetHitMedal_whenThePrescribedValuesAreMet() {
        // log 100 kg × 8 with targetWeightKg 100 / targetReps 8 → medals contain TARGET_HIT,
        // and that medal's previousValue is null.
    }

    @Test
    void testLogSet_shouldReturnNoMedals_whenTheSetTiesTheRecordWithNoTarget() { }

    @Test
    void testFinishWorkout_shouldReturnSessionMedals_whenTheSessionBeatsAPriorVolume() {
        // Two completed sessions where the second has the higher Σ(w×reps) →
        // the finish response's medals contain SESSION_VOLUME.
    }
```

- [ ] **Step 5: Run**

```bash
cd backend && ./mvnw clean test -Dtest='MedalApiIT,ArchitectureTest'
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java
git commit --no-verify -m "feat(train): live medals on the set-log and finish responses (mezo-wp6n)"
```

---

## Task 6: Medal XP — revive `prBonusXp`, add the target bonus

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/gym/GymSignal.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/signal/GymSignalCalculator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java:86-96`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java` (the `Gym` record)
- Modify: `backend/src/main/resources/application.yml` (`mezo.progression.gym`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java` (extend)

**Interfaces:**
- Consumes: `MedalService.forSession` (Task 4).
- Produces: `GymSignal` gains `int recordMedalCount` and `int targetMedalCount` as its 6th and 7th components — **every existing `new GymSignal(...)` call site must be updated** (`GymSignalCalculator` is the only production one; grep the tests too).

- [ ] **Step 1: Extend `GymSignal`**

```java
public record GymSignal(
    UUID instanceId,
    Map<String, Long> volumeByMuscle,
    BigDecimal bestE1rm,
    int workSetCount,
    int bodyweightRepCount,
    /** RECORD-tier medals earned in this session — each pays prBonusXp into max_strength. */
    int recordMedalCount,
    /** TARGET_HIT medals earned in this session — capped, pays into strength_endurance. */
    int targetMedalCount
) {}
```

Update the javadoc's field list to mention both.

- [ ] **Step 2: Count them in `GymSignalCalculator`**

Inject `MedalService`, then replace the final `return`:

```java
        List<Medal> medals = medalService.forSession(createdBy, instanceId);
        int recordMedals = (int) medals.stream()
            .filter(m -> m.getTier() == Medal.TierEnum.RECORD).count();
        int targetMedals = (int) medals.stream()
            .filter(m -> m.getTier() == Medal.TierEnum.TARGET).count();
        return new GymSignal(instanceId, volumeByMuscle, bestE1rm, workSetCount,
            bodyweightRepCount, recordMedals, targetMedals);
```

- [ ] **Step 3: Add the two properties**

In `ProgressionProperties.Gym`, after `prBonusXp`:

```java
        @NotNull @PositiveOrZero Integer targetMedalXp,       // 5 (per TARGET_HIT medal)
        @NotNull @PositiveOrZero Integer targetMedalCap,      // 12 (max paid TARGET_HIT medals/workout)
```

Update `prBonusXp`'s trailing comment to `// 40 (per RECORD-tier medal — a genuinely broken record)`.

In `application.yml` under `mezo.progression.gym`, add `target-medal-xp: 5` and `target-medal-cap: 12` next to the existing `pr-bonus-xp` (match the file's existing kebab-case key style).

- [ ] **Step 4: Fix the award in `ProgressionService.applyGym`**

Replace the `bestE1rm` block (`:86-96`) with:

```java
        // best e1RM → max_strength XP. The PR bonus now pays per genuinely broken RECORD-tier
        // medal (mezo-wp6n); before this it fired on the first-ever weighted session only —
        // a v1 stand-in for the record detection that did not exist yet.
        if (signal.bestE1rm() != null) {
            long xp = (long) signal.bestE1rm().intValue() * g.e1rmXpPerKg()
                + (long) signal.recordMedalCount() * g.prBonusXp();
            deltas.merge("max_strength", xp, Long::sum);
            kinds.put("max_strength", "ATHLETIC");
        }
```

Then extend the endurance block:

```java
        long enduranceXp = (long) signal.workSetCount() * g.strengthEnduranceXpPerSet()
            + (long) signal.bodyweightRepCount() * g.bodyweightXpPerRep()
            + (long) Math.min(signal.targetMedalCount(), g.targetMedalCap()) * g.targetMedalXp();
```

Delete the now-unused `firstEver` local and, if `skillProgressRepository` becomes unused in this method, leave the field alone (other methods use it) — but remove the `findByCreatedByAndSkillKey` call.

- [ ] **Step 5: Write the failing test**

Extend `MedalApiIT`:

```java
    @Test
    void testFinishWorkout_shouldPayThePrBonusPerRecordMedal_whenRecordsWereBroken() {
        // Prior session 100 kg × 8; this session 102.5 kg × 8 (2 RECORD medals: WEIGHT + E1RM).
        // Assert the finish response's levelUp gains for max_strength exceed the plain
        // e1rmXpPerKg component by exactly 2 × prBonusXp.
    }

    @Test
    void testFinishWorkout_shouldStayIdempotent_whenFinishedTwice() {
        // A second POST /finish returns the same levelUp payload and awards no further XP.
    }
```

Read the actual `prBonusXp` / `e1rmXpPerKg` values from the injected `ProgressionProperties` rather than hardcoding them.

- [ ] **Step 6: Run**

```bash
cd backend && ./mvnw clean test -Dtest='MedalApiIT,MedalEvaluatorTest,ArchitectureTest'
```

Expected: PASS. If any other test constructs a `GymSignal`, fix its call site too and add that class to `-Dtest`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/train/MedalApiIT.java
git commit --no-verify -m "feat(progression): medal XP — prBonusXp per real record + capped target bonus (mezo-wp6n)"
```

---

## Task 7: Frontend data layer

**Files:**
- Create: `frontend/src/data/train/medalTypes.ts`, `medalApi.ts`, `medalMock.ts`, `medalEvaluator.ts`, `medalHooks.ts`
- Create: `frontend/src/data/train/medalEvaluator.test.ts`
- Modify: `frontend/src/data/hooks.ts`, `frontend/src/data/train/trainHooks.ts`, `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Consumes: Task 1's `components['schemas']['Medal']`.
- Produces:
  - `type Medal = components['schemas']['Medal']` (from `medalTypes.ts`)
  - `useMedals(): { data: Medal[]; isPending: boolean }` — exported through `@/data/hooks`
  - `useTrain().logSet(workoutId, set, opts?: { onSuccess?: (r?: ExerciseSetResponse) => void })` — **signature change**; the response carries `medals` in BOTH modes.
  - `evaluateMockSetMedals(req, exerciseName): Medal[]` (from `medalEvaluator.ts`) — used only by `trainHooks`' mock branch.

- [ ] **Step 1: Types + API client**

`medalTypes.ts`:

```ts
import type { components } from '@/data/_client/api.gen'

export type Medal = components['schemas']['Medal']
export type MedalType = NonNullable<Medal['type']>
export type MedalTier = NonNullable<Medal['tier']>
```

`medalApi.ts` — copy the fetch idiom from `trainApi.ts:111-112` (`exerciseRecords`) exactly, including the shared `apiFetch` import:

```ts
export const medalApi = {
  list: (): Promise<Medal[]> =>
    apiFetch<MedalListResponse>('/api/train/medals').then((r) => r.medals ?? []),
}
```

- [ ] **Step 2: The mock evaluator**

`medalEvaluator.ts` ports §6 of the spec and holds the mock baseline. It keeps a module-level running history per exercise name, lazily seeded from the mock plan's `lastWeek` (import the mock workout plan from `@/data/train/train.ts` — data-layer-internal, allowed):

```ts
const history = new Map<string, { weight: number; reps: number }[]>()

/** Reset between tests — the mock history is module state. */
export function resetMockMedalHistory(): void { history.clear() }

function priors(name: string, lastWeek: { weight: number; reps: number } | null) {
  if (!history.has(name)) history.set(name, lastWeek ? [{ ...lastWeek }] : [])
  return history.get(name)!
}
```

`evaluateMockSetMedals({ exerciseName, lastWeek, weightKg, reps, targetWeightKg, targetReps, date, setIndex })` applies the same five rules as `MedalEvaluator.forSet` (strict `>`, no-prior-earns-nothing, `REPS_AT_WEIGHT` needs a prior set at that exact weight, Epley `w × (30 + reps) / 30`, `TARGET_HIT` is history-independent), pushes the set onto the history, and returns `Medal[]`. `SESSION_VOLUME` is **not** evaluated in mock mode (it is a finish-time concern and the mock finish is a no-op) — state that in a comment.

- [ ] **Step 3: Write the failing evaluator test**

`medalEvaluator.test.ts` mirrors `MedalEvaluatorTest` case-for-case (this deliberate duplication is what keeps the two engines honest — §13 of the spec). Call `resetMockMedalHistory()` in `beforeEach`. Minimum cases: no prior → nothing; higher load → `WEIGHT` + `E1RM`; more reps at the same load → `REPS_AT_WEIGHT`; a tie → nothing; target met → `TARGET_HIT` with `previousValue` null; target met with no history → still `TARGET_HIT`; reps short → no `TARGET_HIT`; no target prescribed → no `TARGET_HIT`.

- [ ] **Step 4: Run it (expect failure, then pass)**

```bash
cd frontend && pnpm test medalEvaluator
```

Expected: FAIL (module not found) → after Step 2 is complete, PASS.

- [ ] **Step 5: `medalMock.ts` + `useMedals`**

`medalMock.ts` exports `medalsMock: Medal[]` — 6–8 plausible dated entries across 3 exercises spanning ~6 weeks, mixing all five types, so the offline cabinet has content. Hungarian exercise names matching the mock plan.

`medalHooks.ts`:

```ts
export function useMedals(): { data: Medal[]; isPending: boolean } {
  return useDualQuery<Medal[]>({
    queryKey: ['train', 'medals'],
    mockData: medalsMock,
    realFetch: () => medalApi.list(),
    realEmpty: [],
  })
}
```

Re-export `useMedals` from `frontend/src/data/hooks.ts` next to the other train hooks.

- [ ] **Step 6: Return medals from `logSet` in both modes**

In `trainHooks.ts`:

- Change the `TrainData` interface (`:257`) to
  `logSet: (workoutId: string, set: SetLogRequest, opts?: { onSuccess?: (r?: ExerciseSetResponse) => void }) => void`.
- In `logSetMutation` (`:381-386`), make the **mock** branch return a synthetic response instead of `undefined`:

```ts
  const logSetMutation = useMutation({
    mutationFn: mock
      ? async (args: { workoutId: string; set: SetLogRequest; ctx: MockMedalContext }) =>
          ({ medals: evaluateMockSetMedals(args.set, args.ctx) } as ExerciseSetResponse)
      : (args: { workoutId: string; set: SetLogRequest }) => trainApi.logSet(args.workoutId, args.set),
    onSuccess: invalidateToday,
  })
```

- Update the `logSet` callback (`:525-527`) to forward `opts?.onSuccess` through `mutate`'s own `onSuccess` option, matching how `finishWorkout` (`:541`) already threads `opts`.
- `MockMedalContext` (`{ exerciseName: string; lastWeek: { weight: number; reps: number } | null; date: string }`) is supplied by the caller in Task 8; in real mode it is ignored.

- [ ] **Step 7: MSW handlers**

In `frontend/src/test/msw/handlers.ts` (one flat exported array, train block at `:461`–`:711`):

1. Add a `GET ${API_BASE}/api/train/medals` handler returning `{ medals: [...] }` with 2–3 entries, following the shape of the neighbouring train GET handlers verbatim.
2. **Extend the existing `POST ${API_BASE}/api/train/workouts/:id/sets` handler** (`:571-576`) — it currently returns a bare set with no `medals`, which would make every real-mode medal assertion silently pass on `undefined`. Add `medals: []` to its response body, and add a second, path-or-body-discriminated variant only if a test needs a populated one.
3. Extend the `POST .../finish` handler (`:579-583`) response with `medals: []` for the same reason.

- [ ] **Step 8: Gate**

```bash
cd frontend && pnpm test medalEvaluator
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test medalEvaluator
```
```bash
cd frontend && pnpm build
```

All three must pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data frontend/src/test/msw/handlers.ts
git commit --no-verify -m "feat(train): frontend medal data layer + mock evaluator (mezo-wp6n)"
```

---

## Task 8: In-workout medal UI

**Files:**
- Create: `frontend/src/features/train/components/MedalToast.tsx`, `MedalToast.test.tsx`, `MedalChip.tsx`
- Delete: `frontend/src/features/train/components/PRToast.tsx`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx`, `ActiveWorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `Medal` (Task 7), `useTrain().logSet(..., opts)` (Task 7).
- Produces: `<MedalToast medal={m} extraCount={n} />`, `<MedalChip medal={m} />`.

- [ ] **Step 1: `MedalChip`**

A tiny presentational component. RECORD tier → a gold disc (`background: var(--amber)`, warm-ink text) carrying 🏅. TARGET tier → renders **nothing** (the row's existing done-tick carries it, Step 4). `aria-label` names the medal in Hungarian: `Súly-rekord`, `Rep-rekord`, `1RM-rekord`, `Volumen-rekord`. Colors via `var(--token)` only.

- [ ] **Step 2: `MedalToast` + its test**

Replaces `PRToast`. Same amber celebration surface as the mockup, but every value real:

```tsx
export function MedalToast({ medal, extraCount = 0 }: { medal: Medal; extraCount?: number }) {
```

Copy rules (Hungarian): eyebrow `ÚJ REKORD · {SÚLY|REP|1RM|VOLUMEN}`, headline the achieving set (`102,5 kg × 8`), body naming what fell and when — `Eddigi legjobbad {previousValue} {unit} volt — {previousDate} óta állt.` When `previousDate` is null, drop that clause rather than inventing one. When `extraCount > 0`, append `+{extraCount} további medál`. Numbers via `toLocaleString('hu-HU')`.

Test: renders the previous value and its date; renders the extra count only when > 0; renders no date clause when `previousDate` is null.

- [ ] **Step 3: Delete the demo path**

In `ActiveWorkoutPage.tsx` remove: the `PRToast` import (`:49`), `PR_DEMO_THRESHOLD_KG` (`:73`), `PR_TOAST_MS` (`:74`), the `showPR` state (`:212`), the auto-hide effect (`:239-244`), the demo block (`:403-412`), the `{showPR && <PRToast … />}` mount (`:764`), and `hadPrFromSignal` (`:216`, set at `:445-460`, used at `:684`). Then `git rm frontend/src/features/train/components/PRToast.tsx`.

- [ ] **Step 4: Wire the real medals**

- Add `const [sessionMedals, setSessionMedals] = useState<Medal[]>([])` and `const [toastMedal, setToastMedal] = useState<{ medal: Medal; extra: number } | null>(null)`, plus a `const [medalsBySet, setMedalsBySet] = useState<Record<string, Medal[]>>({})` keyed `` `${exerciseId}:${setIndex}` ``.
- In `completeSet`, always call `logSet` (drop the `if (workoutId)` guard around the medal path — pass `workoutId ?? 'mock'` exactly as `finishAndCelebrate` already does at `:447`), supplying the mock context `{ exerciseName: finishing.name, lastWeek: finishing.lastWeek, date: <today> }` and an `onSuccess`:

```tsx
      onSuccess: (r) => {
        const medals = r?.medals ?? []
        if (!medals.length) return
        setMedalsBySet((m) => ({ ...m, [`${finishing.id}:${wasSetIdx}`]: medals }))
        setSessionMedals((s) => [...s, ...medals])
        const records = medals.filter((m) => m.tier === 'RECORD')
        if (records.length) {
          const order = ['WEIGHT', 'E1RM', 'REPS_AT_WEIGHT', 'SESSION_VOLUME']
          const top = [...records].sort((a, b) => order.indexOf(a.type!) - order.indexOf(b.type!))[0]
          setToastMedal({ medal: top, extra: medals.length - 1 })
        }
      },
```

- Re-add a 4500 ms auto-hide effect, this time keyed on `toastMedal` (leak-safe: `clearTimeout` on unmount / re-trigger), and mount `{toastMedal && <MedalToast medal={toastMedal.medal} extraCount={toastMedal.extra} />}` where `PRToast` used to sit.
- In the read-only prescribed-set rows (`:1071-1118`), for a done row look up `medalsBySet[`${current.id}:${i}`]`, render a `<MedalChip>` per RECORD medal before the done-tick, and — **the double-tick fix** — colour the existing done-tick `var(--sage-deep)` instead of `var(--coral)` when that set earned a `TARGET_HIT`. No second glyph.
- Pass `medals={sessionMedals}` to `WorkoutSummary` (Task 9) in place of `hadPR`.
- In `finishAndCelebrate`'s `onSuccess`, merge the finish response's `r?.medals` into `sessionMedals` (that is where `SESSION_VOLUME` arrives) — dedupe by `type + exerciseName + setIndex`.

- [ ] **Step 5: Fix the existing tests**

`ActiveWorkoutPage.test.tsx:397-407` asserts the 105 kg demo toast. Replace it with a test that logs a set beating the mock `lastWeek` and asserts the medal toast's real copy appears; and one that logs a target-meeting set and asserts **no** toast (TARGET tier is quiet).

- [ ] **Step 6: Gate**

```bash
cd frontend && pnpm test ActiveWorkoutPage MedalToast
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test ActiveWorkoutPage MedalToast
```
```bash
cd frontend && pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/train frontend/src/data
git commit --no-verify -m "feat(train): real medal toast + set-row chips, delete the scripted PR demo (mezo-wp6n)"
```

---

## Task 9: Medals in the workout summary

**Files:**
- Modify: `frontend/src/features/train/components/WorkoutSummary.tsx`, `WorkoutSummary.test.tsx`
- Modify: `frontend/src/features/train/pages/WorkoutReviewPage.tsx` (only if it passes `hadPR`)

**Interfaces:**
- Consumes: `Medal` (Task 7), `sessionMedals` (Task 8).
- Produces: `WorkoutSummary` prop `medals?: Medal[]` replacing `hadPR?: boolean`.

- [ ] **Step 1: Swap the prop**

In `WorkoutSummary.tsx`: replace `hadPR = false` in the destructuring (`:46`) and `hadPR?: boolean` in the props type (`:54`) with `medals = []` / `medals?: Medal[]`. Replace the title suffix (`:75`):

```tsx
          {title}{medals.length ? ` · ${medals.length} medál` : ''}
```

- [ ] **Step 2: Add the medal block**

Between the `Mai mérleg` block (`:80-87`) and `Kihívások` (`:90`), render — only when `medals.length > 0` — an eyebrow `Medálok` over one `.card` row per medal: a 🏅 (RECORD) or ✓ (TARGET) glyph, the exercise name + a Hungarian type label (`Súly-rekord` / `Rep-rekord` / `1RM-rekord` / `Volumen-rekord` / `Cél teljesítve`), and the achieving value on the right. Copy the visual idiom of the neighbouring `Kihívások` rows (`:97-105`) exactly — same `.card row gap-sm`, same `label-mono` sizes, same `var(--token)` colors (RECORD → `var(--amber-deep)`, TARGET → `var(--sage-deep)`).

- [ ] **Step 3: Update the tests**

`WorkoutSummary.test.tsx:11` builds a challenge fixture; add a `medals` fixture and assert: the `· 3 medál` suffix appears; each medal row renders its exercise name and label; with `medals={[]}` neither the suffix nor the block renders.

- [ ] **Step 4: Fix remaining `hadPR` call sites**

```bash
grep -rn "hadPR" frontend/src
```

Expected after the fix: no results. Update `WorkoutReviewPage` if it appears.

- [ ] **Step 5: Gate**

```bash
cd frontend && pnpm test WorkoutSummary ActiveWorkoutPage
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test WorkoutSummary ActiveWorkoutPage
```
```bash
cd frontend && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train
git commit --no-verify -m "feat(train): workout summary lists the session's medals (mezo-wp6n)"
```

---

## Task 10: The medal cabinet page

**Files:**
- Create: `frontend/src/features/train/pages/MedalsPage.tsx`, `MedalsPage.test.tsx`
- Modify: `frontend/src/features/train/pages/tabs.ts`, `frontend/src/features/train/pages/train.nav.test.tsx`, `frontend/src/app/router.tsx`

**Interfaces:**
- Consumes: `useMedals()` from `@/data/hooks` (Task 7).
- Produces: the `/train/medals` route.

- [ ] **Step 1: Write the failing test**

`MedalsPage.test.tsx` — follow the existing train page test idiom (`ExercisesPage.test.tsx`) for the render helper and providers. Assert: the header renders; with seeded medals the exercise names and type labels appear grouped under their dates; with an empty list an honest Hungarian empty line renders (no ghost rows, no invented content).

- [ ] **Step 2: Implement the page**

```tsx
export function MedalsPage() {
  const { data: medals, isPending } = useMedals()
  ...
}
```

Structure: a `.pghead-np` header (copy the shape used by a sibling train page), a counter chip (`{medals.length} medál`), then medals grouped by `date` descending — a `label-mono` date heading per group over `.card` rows reusing the Task 9 row idiom. Add one honest line explaining the backfill (spec §13): the history was reconstructed from logged sets, so medals predate the feature. Empty state: a single line, e.g. `Még nincs medálod — az első megdöntött rekord ide kerül.` Loading: `isPending` → a simple skeleton, not the seed.

- [ ] **Step 3: Register the route + tab**

In `frontend/src/app/router.tsx`, import `MedalsPage` alongside the other train pages and add to the `train` children array (`:60-67`), after `exercises`:

```tsx
          { path: 'medals', element: <MedalsPage /> },
```

In `frontend/src/features/train/pages/tabs.ts`, add to `TRAIN_TABS` after the `exercises` entry:

```ts
  { id: 'medals', to: '/train/medals', label: 'Medálok' },
```

**`frontend/src/features/train/pages/train.nav.test.tsx` asserts the sub-nav contents** — update it for the new entry, or the suite goes red.

- [ ] **Step 4: Gate**

```bash
cd frontend && pnpm test MedalsPage
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test MedalsPage
```
```bash
cd frontend && pnpm build
```

- [ ] **Step 5: Full frontend suite**

`tabs.ts` and `router.tsx` are shared files, so the whole suite is the evidence here. Run each as its own foreground call with `timeout: 600000`:

```bash
cd frontend && pnpm test
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test
```

Both must be fully green. **Do not run `pnpm test:visual`.**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train frontend/src/app/router.tsx
git commit --no-verify -m "feat(train): Medálok cabinet page + sub-nav entry (mezo-wp6n)"
```

---

## Task 11: Documentation

**Files:**
- Modify: `docs/features/train.md`
- Modify: `docs/features/growth.md`
- Create: `docs/decisions/0015-medals-derived-not-materialized.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: ADR 0015**

Create `docs/decisions/0015-medals-derived-not-materialized.md` following the format of `0014-llm-call-audit-log.md` (`# 0015 — …`, then `- **Status:** Accepted`, `- **Date:** 2026-07-30`, `- **Driver:** mezo-wp6n`, then `## Context` / `## Decision` / `## Consequences`). Content: the four record types and `TARGET_HIT` are replayed from `exercise_set` rather than stored; this reverses the YAGNI call in `docs/superpowers/specs/2026-06-12-exercise-records-design.md:123` which deferred live PR detection "until a materialized record table" — none turned out to be needed. Record the accepted costs verbatim from spec §4: recompute-on-read, and **no "unseen medal" state is possible**. Record the one persisted fact (the target snapshot) and why it is unavoidable.

- [ ] **Step 2: Update `docs/features/train.md`**

- `:35` — remove `PR detection (the current toast is a scripted demo), ` from the Phase-3-planned list.
- `:395` — remove `PR detection (current toast is a scripted demo, threshold-gated); ` from the Deferred list.
- `:87` — replace the `hadPrFromSignal` sentence with the real behavior: RECORD-tier medals fire `MedalToast`; `TARGET_HIT` recolors the set's done-tick; the summary lists the session's medals.
- §2 — add a `### Medálok — the medal cabinet (pages/MedalsPage.tsx)` subsection after the `Gyakorlatok` one.
- §4 `Exercise catalog + records` — add the `GET /api/train/medals` endpoint, the two new `exercise_set` columns and the migration filename, and a line on `MedalEvaluator`/`MedalService` mirroring the existing `ExerciseRecordService.list` line.
- §10 Key files — add the five new backend/frontend paths.

- [ ] **Step 3: Update `docs/features/growth.md`**

In the `Account progression` section's GYM award description, note that `prBonusXp` now pays per RECORD-tier medal (it previously fired once, on the first-ever weighted session) and that `TARGET_HIT` medals add capped `strength_endurance` XP — no coins, no new progression source.

- [ ] **Step 4: Lint**

```bash
node scripts/lint-docs.mjs
```

Expected: clean, with no staleness flag on `train.md` or `growth.md`.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit --no-verify -m "docs(train): medal collection — feature docs + ADR 0015 derived-not-materialized (mezo-wp6n)"
```

---

## Self-review notes

- **Spec coverage:** §4 storage → Tasks 3–4 · §5.1 target columns → Task 2 · §6 taxonomy → Task 3 (+ Task 7 mirror) · §7.1–7.2 backend units/wiring → Tasks 4–5 · §7.3 XP → Task 6 · §8 contract → Task 1 · §9.1 data layer → Task 7 · §9.2 components → Tasks 8–9 · §9.3 routing → Task 10 · §10 testing → distributed per task · §11 docs → Task 11.
- **Known signature changes that ripple:** `GymSignal`'s two new components (Task 6 — grep every constructor call), `WorkoutSummary`'s `hadPR` → `medals` (Task 9 — grep), `useTrain().logSet`'s new third parameter (Task 7 → consumed in Task 8).
- **Visual goldens** for `train-session` will legitimately move once medal chips render. Regeneration is the **coordinator's** job at ship time — no task regenerates them.
