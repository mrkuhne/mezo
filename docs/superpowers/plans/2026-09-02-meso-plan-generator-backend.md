# Mesocycle plan generator (backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /api/train/meso-plans/generate` — a deterministic hypertrophy skeleton (split from day count, week-1 sets and ceilings from the RP landmark table + priority tiers) filled with catalog exercises, optionally refined by Gemini through a train-owned port, returning a `MesoTemplateUpsertRequest`-compatible proposal the existing template-first save path accepts unchanged.

**Architecture:** Three pure, Spring-free classes in `feature/train/service` (`MesoPlanSkeleton` → frames, `MesoPlanFiller` → exercises, `MesoPlanMerger` → validates/merges an LLM suggestion into the frames) wrapped by one `MesoPlanGeneratorService` that loads the catalog and calls the train-owned `MesoPlanLlm` port via `ObjectProvider` (absent or failing → deterministic result). The companion slice owns the Gemini adapter (`MesoPlanLlmAdapter`) + a fake branch, exactly like `HabitSuggestLlmAdapter` (ADR 0012, companion→train is the sanctioned dependency direction). The start path becomes tier-aware so an EMPHASIZE muscle's volume log starts at MEV+2, matching the generated program.

**Tech Stack:** Spring Boot 4 / Java 21 records, contract-first OpenAPI (`api/feature/train/train.yml` → generated `TrainApi` + `api.dto`), Jackson 3 (`tools.jackson.databind.ObjectMapper`), JUnit 5 + AssertJ, `ApiIntegrationTest` (TestRestTemplate + Postgres), `companion-fake` profile.

## Global Constraints

- Contract-first: edit `api/feature/train/train.yml` BEFORE any code; regenerate `api/openapi.yml` (`cd api/generate && npm run generate:api`) and `frontend/src/data/_client/api.gen.ts` (`cd frontend && pnpm generate:api`); commit both (CI `contract-drift` gate).
- One tag = one controller: the new operation is under tag `Train` and is implemented on `TrainController` (`skipDefaultInterface`).
- `feature.train` must NEVER import `feature.companion` (ArchUnit `feature_slices_are_cycle_free`, frozen). The port lives in train, the adapter in companion.
- No `@Value`; tunables in `application.yml` under `mezo:` via `@Validated` properties records. Feature switches: constant in `FeaturesConfiguration` + explicit `mezo.feature.<x>.enabled` entry (no `matchIfMissing`).
- `@Service` classes only under `..service..`, no class-level `@Transactional`, no field injection, no raw generic exceptions outside techcore.
- Muscle vocabulary: priorities/baselines use the 9 coarse keys `chest, back, shoulder, biceps, triceps, quad, ham, glute, calf`; exercises use 21 zone tokens; `MuscleGroup.of(zone)` is the only bridge; `core`/`traps` have no baseline and must never get fabricated frames.
- Priority map values are lowercase `emphasize|maintain` (`grow` omitted) when written into `musclePriorities` (`PriorityTier.normalize`).
- Landmarks: only `mev/mav/mrv` exist. Week-1 start: EMPHASIZE = min(mev+2, mrv), GROW = mev, MAINTAIN = mev. Ceilings via `PriorityTier.ceiling`.
- Day tokens: `Hét, Kedd, Sze, Csü, Pén, Szo, Vas`; rest days are emitted with `type: "Rest"`, `muscle: ""`, `note: "Pihenőnap"`, no exercises (the FE `planner.ts` convention).
- Tests: backend full suite `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true`; focused: `./mvnw test -Dtest=ClassName -Dmezo.test.use-testcontainers=true`. Naming `test{Method}_should{Result}_when{Condition}` for ITs; plain JUnit + AssertJ for pure classes.
- Same-change obligations: `docs/features/train.md` (§4 Mesocycles, §7, §8, §10), `docs/features/companion.md` adapter list, `node scripts/gen-codemap.mjs` (CODEMAP gate), `node scripts/lint-docs.mjs`.
- Conventional commits carry the bd id of this slice (create it in Task 0): `feat(api): … (mezo-XXXX)`.

---

### Task 0: bd issue + branch

**Files:** none (tracking only)

- [ ] **Step 1: Create the bd issue under the design 2.0 epic and claim it**

```bash
bd create --title "Meso plan generator backend: POST /api/train/meso-plans/generate (skeleton + Gemini port + tier-aware seed)" --type feature --priority 1 --parent mezo-d20.7 --description "Spec: docs/superpowers/specs/2026-09-01-mesocycle-wizard-redesign-design.md §Backend. Plan: docs/superpowers/plans/2026-09-02-meso-plan-generator-backend.md"
bd update <new-id> --claim
```

Record the id; use it in every commit subject below as `(mezo-<id>)`.

- [ ] **Step 2: Branch from main**

```bash
git checkout main && git pull --rebase
git checkout -b feat/meso-plan-generator
```

---

### Task 1: Contract — `POST /api/train/meso-plans/generate`

**Files:**
- Modify: `api/feature/train/train.yml` (paths block near `/api/train/meso-templates` at ~line 317; schemas block near `MesoTemplateUpsertRequest` at ~line 2086)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest` (`getDaysOfWeek(): List<String>`, `getWeeks(): Integer`, `getPriorities(): Map<String,String>`, `getGoalText(): String`), `MesoPlanGenerateResponse` (`getTemplate(): MesoTemplateUpsertRequest`, `getRationale(): String`, `getLlmUsed(): Boolean`), and `TrainApi.generateMesoPlan(MesoPlanGenerateRequest)`.

- [ ] **Step 1: Add the path (insert directly BEFORE the `/api/train/meso-templates:` path entry)**

```yaml
  /api/train/meso-plans/generate:
    post:
      tags: [Train]
      operationId: generateMesoPlan
      summary: Generate a hypertrophy mesocycle proposal (deterministic skeleton + optional LLM exercise pick); returns a MesoTemplateUpsertRequest-compatible template
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MesoPlanGenerateRequest'
      responses:
        '200':
          description: Generated proposal — not persisted; save it via POST /api/train/meso-templates
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MesoPlanGenerateResponse'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

- [ ] **Step 2: Add the schemas (insert directly BEFORE `MesoTemplateUpsertRequest:` under `components.schemas`)**

```yaml
    MesoPlanGenerateRequest:
      type: object
      required: [daysOfWeek, weeks]
      properties:
        daysOfWeek:
          type: array
          minItems: 2
          maxItems: 6
          uniqueItems: true
          description: Training days, FE day tokens; any weekday incl. weekend
          items:
            type: string
            pattern: '^(Hét|Kedd|Sze|Csü|Pén|Szo|Vas)$'
        weeks:
          type: integer
          minimum: 4
          maximum: 8
          description: Total length incl. the terminal deload week
        priorities:
          type: object
          nullable: true
          description: Sparse per-muscle tier map over the 9 coarse groups (chest, back, shoulder, biceps, triceps, quad, ham, glute, calf); absent = grow
          additionalProperties:
            type: string
            pattern: '^(emphasize|grow|maintain)$'
        goalText:
          type: string
          nullable: true
          maxLength: 400
          description: Free-text goal steering exercise choice (e.g. "röplabda mellett, vállra figyelve")
    MesoPlanGenerateResponse:
      type: object
      required: [template, rationale, llmUsed]
      properties:
        template:
          $ref: '#/components/schemas/MesoTemplateUpsertRequest'
        rationale:
          type: string
          description: One Hungarian sentence on what was chosen and why (LLM or deterministic)
        llmUsed:
          type: boolean
          description: false when the LLM port was absent, failed, or answered unusably — the deterministic filler produced the plan
```

- [ ] **Step 3: Regenerate both artifacts and verify no drift remains**

```bash
cd api/generate && npm run generate:api && cd ../..
cd frontend && pnpm generate:api && cd ..
git status --short api/openapi.yml frontend/src/data/_client/api.gen.ts
```
Expected: both files modified; `grep -n 'MesoPlanGenerateResponse' frontend/src/data/_client/api.gen.ts` prints matches.

- [ ] **Step 4: Confirm the backend compiles against the new interface (it will fail on the missing controller method — that is the expected red)**

```bash
cd backend && ./mvnw -q compile 2>&1 | tail -5
```
Expected: compile error `TrainController is not abstract and does not override abstract method generateMesoPlan(MesoPlanGenerateRequest)`.

- [ ] **Step 5: Commit the contract**

```bash
git add api/feature/train/train.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): meso-plans/generate contract — MesoPlanGenerateRequest/Response (mezo-<id>)"
```

---

### Task 2: Feature switch + tunables

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/MesoPlanProperties.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.feature:` block ~line 149; add a `mezo.meso-plan:` block next to `mezo.volume:` ~line 1471)
- Modify: `backend/src/test/resources/application.properties` (nothing required — the switch defaults on; the switch-off IT overrides per-class)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/config/MesoPlanPropertiesBindingIT.java`

**Interfaces:**
- Produces: `FeaturesConfiguration.MESO_PLAN_AI_SWITCH = "mezo.feature.meso-plan-ai.enabled"`; `MesoPlanProperties(int sessionCap, int minFrequency, int maxExercisesPerGroupPerDay, int compoundRepMin, int compoundRepMax, int isolationRepMin, int isolationRepMax, int targetRir, int compoundWarmup, int isolationWarmup)`.

- [ ] **Step 1: Write the failing binding IT**

```java
package io.mrkuhne.mezo.feature.train.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class MesoPlanPropertiesBindingIT extends AbstractIntegrationTest {

    @Autowired
    private MesoPlanProperties props;

    @Test
    void testBinding_shouldExposeDefaults_whenYmlLoaded() {
        assertThat(props.sessionCap()).isEqualTo(8);
        assertThat(props.minFrequency()).isEqualTo(2);
        assertThat(props.maxExercisesPerGroupPerDay()).isEqualTo(2);
        assertThat(props.compoundRepMin()).isEqualTo(8);
        assertThat(props.compoundRepMax()).isEqualTo(10);
        assertThat(props.isolationRepMin()).isEqualTo(12);
        assertThat(props.isolationRepMax()).isEqualTo(15);
        assertThat(props.targetRir()).isEqualTo(1);
        assertThat(props.compoundWarmup()).isEqualTo(2);
        assertThat(props.isolationWarmup()).isEqualTo(1);
    }
}
```

- [ ] **Step 2: Run it to see it fail**

```bash
cd backend && ./mvnw test -Dtest=MesoPlanPropertiesBindingIT -Dmezo.test.use-testcontainers=true 2>&1 | grep -E 'Tests run|ERROR|cannot find' | head
```
Expected: compile error (`MesoPlanProperties` missing).

- [ ] **Step 3: Add the switch constant to `FeaturesConfiguration` (next to `MESO_REVIEW_SWITCH`)**

```java
    /** Meso plan generator — Gemini exercise pick on POST /api/train/meso-plans/generate. Off → deterministic filler only. */
    public static final String MESO_PLAN_AI_SWITCH = "mezo.feature.meso-plan-ai.enabled";
```

- [ ] **Step 4: Create `MesoPlanProperties`**

```java
package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Tunables of the hypertrophy plan generator (mezo-meso-plan). Bound from {@code mezo.meso-plan}.
 * sessionCap = max productive sets per muscle per session (RP ~8); minFrequency = every trained
 * group appears at least this many times a week (guaranteed by the split table, asserted in tests).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.meso-plan")
public record MesoPlanProperties(
    @Min(4) @Max(12) int sessionCap,
    @Min(1) @Max(3) int minFrequency,
    @Min(1) @Max(4) int maxExercisesPerGroupPerDay,
    @Min(1) @Max(30) int compoundRepMin,
    @Min(1) @Max(30) int compoundRepMax,
    @Min(1) @Max(30) int isolationRepMin,
    @Min(1) @Max(30) int isolationRepMax,
    @Min(0) @Max(5) int targetRir,
    @Min(0) @Max(5) int compoundWarmup,
    @Min(0) @Max(5) int isolationWarmup) {}
```

Register it the way `VolumeProperties` is registered: find where `VolumeProperties.class` appears in an `@EnableConfigurationProperties` (run `grep -rn 'VolumeProperties.class' backend/src/main/java`) and add `MesoPlanProperties.class` to the same annotation.

- [ ] **Step 5: Add yml entries**

Under `mezo.feature:` (keep alphabetical-ish placement after `meso-review`):
```yaml
    # Meso plan generator AI half (mesocycle wizard redesign) — Gemini exercise pick inside the
    # deterministic frames; needs the companion switch too. Off -> deterministic filler, llmUsed=false.
    meso-plan-ai:
      enabled: true
```
Next to the `mezo.volume:` block:
```yaml
  # Hypertrophy plan generator frames (POST /api/train/meso-plans/generate).
  meso-plan:
    session-cap: 8
    min-frequency: 2
    max-exercises-per-group-per-day: 2
    compound-rep-min: 8
    compound-rep-max: 10
    isolation-rep-min: 12
    isolation-rep-max: 15
    target-rir: 1
    compound-warmup: 2
    isolation-warmup: 1
```

- [ ] **Step 6: Run the IT green**

```bash
cd backend && ./mvnw test -Dtest=MesoPlanPropertiesBindingIT -Dmezo.test.use-testcontainers=true 2>&1 | grep -E 'Tests run' | tail -1
```
Expected: `Tests run: 1, Failures: 0, Errors: 0`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/main/java/io/mrkuhne/mezo/feature/train/config/MesoPlanProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/train/config/MesoPlanPropertiesBindingIT.java
git commit -m "feat(train): meso-plan tunables + meso-plan-ai switch (mezo-<id>)"
```

---

### Task 3: `PriorityTier.weekOneStart` + tier-aware volume seeding

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/PriorityTier.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java` (`seedPlanBaselines` ~line 445, calls at ~264-265, ~276)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeProgressionService.java` (`seedBaselines` ~line 79)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/PriorityTierTest.java` (extend), `backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoStartTierSeedIT.java` (new)

**Interfaces:**
- Produces: `int PriorityTier.weekOneStart(int mev, int mav, int mrv)`; `VolumeProgressionService.seedBaselines(UUID createdBy, UUID mesoId, Map<String,String> priorities)` (old 2-arg overload removed — update both callers).

- [ ] **Step 1: Extend `PriorityTierTest` with the failing unit tests**

```java
    @Test
    void weekOneStart_shouldBeMevPlusTwoCappedAtMrv_whenEmphasize() {
        assertThat(PriorityTier.EMPHASIZE.weekOneStart(10, 16, 22)).isEqualTo(12);
        assertThat(PriorityTier.EMPHASIZE.weekOneStart(21, 21, 22)).isEqualTo(22);
    }

    @Test
    void weekOneStart_shouldBeMev_whenGrowOrMaintain() {
        assertThat(PriorityTier.GROW.weekOneStart(10, 16, 22)).isEqualTo(10);
        assertThat(PriorityTier.MAINTAIN.weekOneStart(10, 16, 22)).isEqualTo(10);
    }
```

- [ ] **Step 2: Run to see them fail**

```bash
cd backend && ./mvnw test -Dtest=PriorityTierTest 2>&1 | grep -E 'Tests run|cannot find' | head -3
```
Expected: compile error `cannot find symbol: method weekOneStart`.

- [ ] **Step 3: Implement in `PriorityTier`**

```java
    /** Week-1 start of the ramp (mesocycle wizard redesign): EMPHASIZE begins two sets above MEV
     *  (never above MRV), GROW and MAINTAIN begin at MEV. Pairs with {@link #ceiling}. */
    public int weekOneStart(int mev, int mav, int mrv) {
        return this == EMPHASIZE ? Math.min(mev + 2, mrv) : mev;
    }
```

- [ ] **Step 4: Write the failing seed IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** Tier-aware week-1 seed (mesocycle wizard redesign): an EMPHASIZE group starts at MEV+2. */
class MesoStartTierSeedIT extends ApiIntegrationTest {

    @Autowired
    private MuscleGroupVolumeLogRepository volumeLogRepository;

    @Test
    void testStartTemplate_shouldSeedEmphasizeAtMevPlusTwo_whenPriorityIsEmphasize() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse tpl = postForBody("/api/train/meso-templates", request(), auth,
            HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody("/api/train/meso-templates/" + tpl.getId() + "/start",
            MesoTemplateStartRequest.builder().startDate(LocalDate.now()).status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);

        List<MuscleGroupVolumeLogEntity> rows = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(ownerId(), List.of(run.getId()));

        assertThat(rows).extracting(MuscleGroupVolumeLogEntity::getMuscle).contains("back", "chest");
        assertThat(rows).filteredOn(r -> r.getMuscle().equals("back")).extracting(MuscleGroupVolumeLogEntity::getCurrentSets).containsExactly(12);
        assertThat(rows).filteredOn(r -> r.getMuscle().equals("chest")).extracting(MuscleGroupVolumeLogEntity::getCurrentSets).containsExactly(8);
    }

    private static MesoTemplateUpsertRequest request() {
        return MesoTemplateUpsertRequest.builder()
            .title("Tier seed teszt").weeks(6).goalPreset("hypertrophy")
            .musclePriorities(Map.of("back", "emphasize"))
            .phaseCurve(List.of(MesoTemplateUpsertRequest.PhaseCurveEnum.MEV, MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .days(List.of(
                MesoDayInput.builder().day("Hét").type("Upper").muscle("back").exercises(List.of(
                    ex("Row", "back-mid", GymExerciseInput.TypeEnum.COMPOUND),
                    ex("Bench", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND))).build(),
                MesoDayInput.builder().day("Csü").type("Upper").muscle("back").exercises(List.of(
                    ex("Pulldown", "back-wide", GymExerciseInput.TypeEnum.COMPOUND),
                    ex("Fly", "chest-mid", GymExerciseInput.TypeEnum.ISOLATION))).build()))
            .build();
    }

    private static GymExerciseInput ex(String name, String muscle, GymExerciseInput.TypeEnum type) {
        return GymExerciseInput.builder().name(name).muscle(muscle).warmupSets(1).workingSets(3)
            .repMin(8).repMax(10).targetRIR(1).type(type).build();
    }
}
```
`ownerId()` — use whatever `ApiIntegrationTest` exposes for the demodata owner's UUID (run `grep -n 'ownerId\|OWNER' backend/src/test/java/io/mrkuhne/mezo/support/ApiIntegrationTest.java`); if only the email/login is exposed, resolve the id through the same repository the other train ITs use (see `MesoTemplateIT` for the idiom) and adapt this line — do not add a new helper to the base class.

- [ ] **Step 5: Run it to see it fail (back seeded at 10)**

```bash
cd backend && ./mvnw test -Dtest=MesoStartTierSeedIT -Dmezo.test.use-testcontainers=true 2>&1 | grep -E 'Tests run|expected|Expecting' | head -5
```
Expected: 1 failure — back `currentSets` is `10`, expected `12`.

- [ ] **Step 6: Make seeding tier-aware**

In `TrainService.seedPlanBaselines` change the signature to `seedPlanBaselines(UUID createdBy, UUID mesoId, Map<String, VolumeBaseline> baselines, Map<String, String> priorities)` and replace `row.setCurrentSets(b.getMev());` with:
```java
            row.setCurrentSets(PriorityTier.of(priorities, muscle).weekOneStart(b.getMev(), b.getMav(), b.getMrv()));
```
Update the call at ~line 264 to `seedPlanBaselines(createdBy, saved.getId(), src.volumePerMuscle(), src.musclePriorities());` and the two `volumeProgressionService.seedBaselines(...)` calls (~265 and ~276) to pass the priorities: at 265 `src.musclePriorities()`, at 276 the entity's map (`meso.getMusclePriorities()` on the `MesocycleEntity` being activated — check the local variable name at that call site).

In `VolumeProgressionService.seedBaselines` change the signature to `seedBaselines(UUID createdBy, UUID mesoId, Map<String, String> priorities)` and replace `row.setCurrentSets(b.mev());` with:
```java
            row.setCurrentSets(PriorityTier.of(priorities, group).weekOneStart(b.mev(), b.mav(), b.mrv()));
```
Update the javadoc sentence "currentSets = MEV" in both methods to "currentSets = the tier's week-1 start (EMPHASIZE MEV+2, else MEV)". Fix any other compile-time callers (`grep -rn 'seedBaselines(' backend/src`).

- [ ] **Step 7: Run the seed IT + the existing volume ITs green**

```bash
cd backend && ./mvnw test -Dtest='MesoStartTierSeedIT,PriorityTierTest,TrainServiceIT,MesoTemplateIT' -Dmezo.test.use-testcontainers=true 2>&1 | grep -E 'Tests run:' | tail -4
```
Expected: all `Failures: 0, Errors: 0`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/PriorityTier.java backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeProgressionService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/service/PriorityTierTest.java backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoStartTierSeedIT.java
git commit -m "feat(train): tier-aware week-1 volume seed — EMPHASIZE starts at MEV+2 (mezo-<id>)"
```

---

### Task 4: `MesoPlanSkeleton` — pure split + frame derivation

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanSkeleton.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MesoPlanSkeletonTest.java`

**Interfaces:**
- Consumes: `VolumeProperties.Baseline(mev, mav, mrv)` map, `PriorityTier`.
- Produces:
```java
public final class MesoPlanSkeleton {
  public static final List<String> DAY_ORDER = List.of("Hét","Kedd","Sze","Csü","Pén","Szo","Vas");
  public record MuscleFrame(String group, int sets) {}
  public record DayFrame(String day, String type, List<MuscleFrame> muscles) {}   // type: Full|Upper|Lower|Push|Pull|Legs|Rest
  public record Skeleton(String splitLabel, List<DayFrame> days /* always 7, DAY_ORDER */, Map<String,Integer> weekOneSets, Map<String,Integer> ceilings, List<String> phaseCurve) {}
  public static Skeleton build(List<String> daysOfWeek, int weeks, Map<String,String> priorities, Map<String, VolumeProperties.Baseline> baselines);
  public static List<String> phaseCurve(int weeks);
  public static int frequencyOf(Skeleton s, String group);
}
```

- [ ] **Step 1: Write the failing unit test**

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MesoPlanSkeletonTest {

    static final Map<String, VolumeProperties.Baseline> RP = Map.of(
        "chest", new VolumeProperties.Baseline(8, 14, 20),
        "back", new VolumeProperties.Baseline(10, 16, 22),
        "shoulder", new VolumeProperties.Baseline(8, 12, 18),
        "biceps", new VolumeProperties.Baseline(6, 10, 14),
        "triceps", new VolumeProperties.Baseline(6, 10, 14),
        "quad", new VolumeProperties.Baseline(8, 12, 18),
        "ham", new VolumeProperties.Baseline(6, 10, 14),
        "glute", new VolumeProperties.Baseline(8, 12, 18),
        "calf", new VolumeProperties.Baseline(6, 10, 16));

    @Test
    void build_shouldDeriveUpperLower_whenFourDays() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of(), RP);
        assertThat(s.splitLabel()).isEqualTo("Upper / Lower · 4×/hét");
        assertThat(s.days()).hasSize(7);
        assertThat(s.days()).extracting(MesoPlanSkeleton.DayFrame::type)
            .containsExactly("Upper", "Rest", "Lower", "Rest", "Upper", "Lower", "Rest");
    }

    @Test
    void build_shouldDeriveSplitByDayCount_whenTwoToSixDays() {
        assertThat(MesoPlanSkeleton.build(List.of("Hét", "Csü"), 6, Map.of(), RP).splitLabel()).isEqualTo("Full body · 2×/hét");
        assertThat(MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén"), 6, Map.of(), RP).splitLabel()).isEqualTo("Full body · 3×/hét");
        assertThat(MesoPlanSkeleton.build(List.of("Hét", "Kedd", "Sze", "Pén", "Szo"), 6, Map.of(), RP).splitLabel()).isEqualTo("Upper / Lower / Push / Pull / Legs · 5×/hét");
        assertThat(MesoPlanSkeleton.build(List.of("Hét", "Kedd", "Sze", "Pén", "Szo", "Vas"), 6, Map.of(), RP).splitLabel()).isEqualTo("Push / Pull / Legs ×2 · 6×/hét");
    }

    @Test
    void build_shouldStartEmphasizeAtMevPlusTwoAndCeilAtMrv_whenPrioritiesGiven() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6,
            Map.of("back", "emphasize", "calf", "maintain"), RP);
        assertThat(s.weekOneSets()).containsEntry("back", 12).containsEntry("chest", 8).containsEntry("calf", 6);
        assertThat(s.ceilings()).containsEntry("back", 22).containsEntry("chest", 14).containsEntry("calf", 6);
    }

    @Test
    void build_shouldSpreadWeeklySetsAcrossDays_withRemainderOnEarliestDay() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of("back", "emphasize"), RP);
        var upperDays = s.days().stream().filter(d -> d.type().equals("Upper")).toList();
        assertThat(upperDays).hasSize(2);
        assertThat(setsOf(upperDays.get(0), "back") + setsOf(upperDays.get(1), "back")).isEqualTo(12);
        // shoulder 8 / 2 = 4 each; biceps 6 / 2 = 3 each
        assertThat(setsOf(upperDays.get(0), "shoulder")).isEqualTo(4);
        assertThat(setsOf(upperDays.get(0), "biceps")).isEqualTo(3);
    }

    @Test
    void build_shouldTrainEveryGroupAtLeastTwiceAWeek_forEveryDayCount() {
        for (int n = 2; n <= 6; n++) {
            var s = MesoPlanSkeleton.build(MesoPlanSkeleton.DAY_ORDER.subList(0, n), 6, Map.of(), RP);
            for (String g : RP.keySet()) {
                assertThat(MesoPlanSkeleton.frequencyOf(s, g)).as("%d days, %s", n, g).isGreaterThanOrEqualTo(2);
            }
        }
    }

    @Test
    void build_shouldKeepEveryFrameUnderSessionCapOfEight_forEveryDayCount() {
        for (int n = 2; n <= 6; n++) {
            var s = MesoPlanSkeleton.build(MesoPlanSkeleton.DAY_ORDER.subList(0, n), 6,
                Map.of("back", "emphasize", "quad", "emphasize"), RP);
            s.days().forEach(d -> d.muscles().forEach(m -> assertThat(m.sets()).isBetween(1, 8)));
        }
    }

    @Test
    void phaseCurve_shouldRampThenDeload() {
        assertThat(MesoPlanSkeleton.phaseCurve(6)).containsExactly("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");
        assertThat(MesoPlanSkeleton.phaseCurve(4)).containsExactly("MEV", "MAV", "MRV", "Deload");
        assertThat(MesoPlanSkeleton.phaseCurve(8)).containsExactly("MEV", "MEV", "MAV", "MAV", "MAV", "MAV", "MRV", "Deload");
    }

    @Test
    void build_shouldIgnoreUnknownGroupsInPriorities() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Csü"), 6, Map.of("core", "emphasize"), RP);
        assertThat(s.weekOneSets()).doesNotContainKey("core");
    }

    private static int setsOf(MesoPlanSkeleton.DayFrame d, String group) {
        return d.muscles().stream().filter(m -> m.group().equals(group)).mapToInt(MesoPlanSkeleton.MuscleFrame::sets).sum();
    }
}
```

- [ ] **Step 2: Run to see it fail**

```bash
cd backend && ./mvnw test -Dtest=MesoPlanSkeletonTest 2>&1 | grep -E 'cannot find|Tests run' | head -3
```
Expected: compile error (class missing).

- [ ] **Step 3: Implement `MesoPlanSkeleton`**

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Deterministic core of the hypertrophy plan generator (mesocycle wizard redesign, spec §The
 * training model). Pure: day tokens + weeks + sparse priorities + the RP landmark table in,
 * a 7-day frame out. Split is derived from the day COUNT only (2–3 Full · 4 Upper/Lower ·
 * 5 Upper/Lower/Push/Pull/Legs · 6 PPL×2), which by construction trains every coarse group
 * ≥2×/week. Week-1 sets per group come from {@link PriorityTier#weekOneStart}, ceilings from
 * {@link PriorityTier#ceiling}; the weekly amount is spread over the days that contain the
 * group, remainder on the earliest day. Groups absent from the landmark table (core, traps)
 * are never framed (DA5).
 */
public final class MesoPlanSkeleton {

    private MesoPlanSkeleton() {}

    public static final List<String> DAY_ORDER = List.of("Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas");

    public record MuscleFrame(String group, int sets) {}

    public record DayFrame(String day, String type, List<MuscleFrame> muscles) {}

    public record Skeleton(String splitLabel, List<DayFrame> days, Map<String, Integer> weekOneSets,
                           Map<String, Integer> ceilings, List<String> phaseCurve) {}

    private static final Map<Integer, List<String>> SPLIT_DAYS = Map.of(
        2, List.of("Full", "Full"),
        3, List.of("Full", "Full", "Full"),
        4, List.of("Upper", "Lower", "Upper", "Lower"),
        5, List.of("Upper", "Lower", "Push", "Pull", "Legs"),
        6, List.of("Push", "Pull", "Legs", "Push", "Pull", "Legs"));

    private static final Map<Integer, String> SPLIT_LABEL = Map.of(
        2, "Full body", 3, "Full body", 4, "Upper / Lower",
        5, "Upper / Lower / Push / Pull / Legs", 6, "Push / Pull / Legs ×2");

    /** Group order inside a day = the order exercises will be emitted (big movers first). */
    private static final Map<String, List<String>> TYPE_GROUPS = Map.of(
        "Full", List.of("quad", "chest", "back", "ham", "shoulder", "glute", "biceps", "triceps", "calf"),
        "Upper", List.of("chest", "back", "shoulder", "biceps", "triceps"),
        "Lower", List.of("quad", "ham", "glute", "calf"),
        "Push", List.of("chest", "shoulder", "triceps"),
        "Pull", List.of("back", "biceps"),
        "Legs", List.of("quad", "ham", "glute", "calf"));

    public static Skeleton build(List<String> daysOfWeek, int weeks, Map<String, String> priorities,
                                 Map<String, VolumeProperties.Baseline> baselines) {
        List<String> training = daysOfWeek.stream().sorted((a, b) -> DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).toList();
        int n = Math.max(2, Math.min(6, training.size()));
        List<String> types = SPLIT_DAYS.get(n);

        Map<String, Integer> weekOne = new LinkedHashMap<>();
        Map<String, Integer> ceilings = new LinkedHashMap<>();
        baselines.forEach((group, b) -> {
            PriorityTier tier = PriorityTier.of(priorities, group);
            weekOne.put(group, tier.weekOneStart(b.mev(), b.mav(), b.mrv()));
            ceilings.put(group, tier.ceiling(b.mev(), b.mav(), b.mrv()));
        });

        // frequency per group over the chosen split
        Map<String, Integer> freq = new LinkedHashMap<>();
        for (String t : types) {
            for (String g : TYPE_GROUPS.get(t)) {
                if (baselines.containsKey(g)) freq.merge(g, 1, Integer::sum);
            }
        }
        Map<String, Integer> handed = new LinkedHashMap<>();

        List<DayFrame> days = new ArrayList<>(7);
        for (String day : DAY_ORDER) {
            int idx = training.indexOf(day);
            if (idx < 0) {
                days.add(new DayFrame(day, "Rest", List.of()));
                continue;
            }
            String type = types.get(idx);
            List<MuscleFrame> muscles = new ArrayList<>();
            for (String g : TYPE_GROUPS.get(type)) {
                if (!baselines.containsKey(g)) continue;
                int total = weekOne.get(g);
                int f = freq.get(g);
                int base = total / f;
                int remainder = total % f;
                int done = handed.getOrDefault(g, 0);
                int sets = base + (done < remainder ? 1 : 0);
                handed.put(g, done + 1);
                if (sets > 0) muscles.add(new MuscleFrame(g, sets));
            }
            days.add(new DayFrame(day, type, List.copyOf(muscles)));
        }
        return new Skeleton(SPLIT_LABEL.get(n) + " · " + training.size() + "×/hét",
            List.copyOf(days), weekOne, ceilings, phaseCurve(weeks));
    }

    /** weeks-1 ramp weeks then a Deload: first two MEV, last ramp week MRV, the middle MAV. */
    public static List<String> phaseCurve(int weeks) {
        int ramp = Math.max(1, weeks - 1);
        List<String> out = new ArrayList<>(weeks);
        for (int i = 0; i < ramp; i++) {
            if (i == ramp - 1 && ramp > 1) out.add("MRV");
            else if (i < 2 && ramp > 2) out.add("MEV");
            else out.add(i == 0 ? "MEV" : "MAV");
        }
        out.add("Deload");
        return List.copyOf(out);
    }

    public static int frequencyOf(Skeleton s, String group) {
        return (int) s.days().stream().filter(d -> d.muscles().stream().anyMatch(m -> m.group().equals(group))).count();
    }
}
```
Check `phaseCurve(4)`: ramp=3 → i0: not last, i<2 && ramp>2 → MEV; i1: i<2 → MEV … but the test expects `MEV, MAV, MRV, Deload` for 4 weeks. Adjust the rule so it satisfies all three expectations: for `ramp == 3` use `MEV, MAV, MRV`; for `ramp >= 4` use `MEV, MEV, MAV…, MRV`. Implement it explicitly:
```java
    public static List<String> phaseCurve(int weeks) {
        int ramp = Math.max(1, weeks - 1);
        List<String> out = new ArrayList<>(weeks);
        int mevWeeks = ramp >= 4 ? 2 : 1;
        for (int i = 0; i < ramp; i++) {
            if (i == ramp - 1 && ramp > 1) out.add("MRV");
            else if (i < mevWeeks) out.add("MEV");
            else out.add("MAV");
        }
        out.add("Deload");
        return List.copyOf(out);
    }
```
(This replaces the first draft above — keep only this version.)

- [ ] **Step 4: Run green**

```bash
cd backend && ./mvnw test -Dtest=MesoPlanSkeletonTest 2>&1 | grep -E 'Tests run:' | tail -1
```
Expected: `Tests run: 8, Failures: 0, Errors: 0`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanSkeleton.java backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MesoPlanSkeletonTest.java
git commit -m "feat(train): MesoPlanSkeleton — split/frames/ceilings/phase curve from day count + tiers (mezo-<id>)"
```

---

### Task 5: `MesoPlanFiller` — deterministic exercise fill

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanFiller.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MesoPlanFillerTest.java`

**Interfaces:**
- Consumes: `MesoPlanSkeleton.Skeleton`, `MesoPlanProperties`.
- Produces:
```java
public final class MesoPlanFiller {
  public record Candidate(UUID id, String name, String muscle /* zone token */, String group /* coarse */, String type /* compound|isolation|plyo */, double stim, double fatigue) {}
  public record Pick(Candidate candidate, int workingSets) {}
  public record FilledDay(String day, String type, List<Pick> picks) {}
  public static List<FilledDay> fill(MesoPlanSkeleton.Skeleton skeleton, List<Candidate> candidates, MesoPlanProperties props);
  public static List<Pick> fillGroup(String group, int sets, List<Candidate> candidates, int rotation, MesoPlanProperties props);
}
```
Rules: per (day, group) pick up to `props.maxExercisesPerGroupPerDay()` exercises — 2 when `sets >= 6`, else 1; candidates of that group ordered compound-first then `stim` desc then name; `rotation` = the group's occurrence index in the week (0 for its first day, 1 for its second…) shifts the start offset by `rotation * count` so the second day of the week uses different exercises when the catalog has enough; sets split evenly, remainder to the first pick; a group with no candidates yields no picks (never fabricated).

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MesoPlanFillerTest {

    static final MesoPlanProperties PROPS = new MesoPlanProperties(8, 2, 2, 8, 10, 12, 15, 1, 2, 1);
    static final Map<String, VolumeProperties.Baseline> RP = MesoPlanSkeletonTest.RP;

    static MesoPlanFiller.Candidate c(String name, String zone, String type, double stim) {
        return new MesoPlanFiller.Candidate(UUID.randomUUID(), name, zone, MuscleGroup.of(zone), type, stim, 0.5);
    }

    static final List<MesoPlanFiller.Candidate> CATALOG = List.of(
        c("Row", "back-mid", "compound", 0.9), c("Pulldown", "back-wide", "compound", 0.8),
        c("Pullover", "back-wide", "isolation", 0.6), c("Shrug", "traps", "isolation", 0.4),
        c("Bench", "chest-mid", "compound", 0.9), c("Fly", "chest-mid", "isolation", 0.6),
        c("OHP", "shoulder-front", "compound", 0.8), c("Lateral raise", "shoulder-side", "isolation", 0.7),
        c("Curl", "biceps-short", "isolation", 0.6), c("Pushdown", "triceps-lateral", "isolation", 0.6),
        c("Squat", "quad", "compound", 0.9), c("Leg press", "quad", "compound", 0.8),
        c("RDL", "ham", "compound", 0.8), c("Hip thrust", "glute", "compound", 0.8),
        c("Calf raise", "calf", "isolation", 0.6));

    @Test
    void fillGroup_shouldPickTwoCompoundFirst_whenSixOrMoreSets() {
        var picks = MesoPlanFiller.fillGroup("back", 6, CATALOG, 0, PROPS);
        assertThat(picks).extracting(p -> p.candidate().name()).containsExactly("Row", "Pulldown");
        assertThat(picks).extracting(MesoPlanFiller.Pick::workingSets).containsExactly(3, 3);
    }

    @Test
    void fillGroup_shouldPickOne_whenFewerThanSixSets() {
        var picks = MesoPlanFiller.fillGroup("chest", 4, CATALOG, 0, PROPS);
        assertThat(picks).hasSize(1);
        assertThat(picks.get(0).candidate().name()).isEqualTo("Bench");
        assertThat(picks.get(0).workingSets()).isEqualTo(4);
    }

    @Test
    void fillGroup_shouldRotateOnSecondOccurrence_whenCatalogIsDeepEnough() {
        var second = MesoPlanFiller.fillGroup("back", 6, CATALOG, 1, PROPS);
        assertThat(second).extracting(p -> p.candidate().name()).containsExactly("Pullover", "Shrug");
    }

    @Test
    void fillGroup_shouldGiveRemainderToFirstPick_whenOdd() {
        var picks = MesoPlanFiller.fillGroup("back", 7, CATALOG, 0, PROPS);
        assertThat(picks).extracting(MesoPlanFiller.Pick::workingSets).containsExactly(4, 3);
    }

    @Test
    void fillGroup_shouldReturnEmpty_whenNoCandidateForGroup() {
        assertThat(MesoPlanFiller.fillGroup("calf", 3, List.of(), 0, PROPS)).isEmpty();
    }

    @Test
    void fill_shouldCoverEveryFrameSetExactly_whenCatalogCoversAllGroups() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of("back", "emphasize"), RP);
        var days = MesoPlanFiller.fill(s, CATALOG, PROPS);
        assertThat(days).hasSize(7);
        for (int i = 0; i < 7; i++) {
            var frame = s.days().get(i);
            var filled = days.get(i);
            assertThat(filled.day()).isEqualTo(frame.day());
            for (var m : frame.muscles()) {
                int got = filled.picks().stream().filter(p -> p.candidate().group().equals(m.group()))
                    .mapToInt(MesoPlanFiller.Pick::workingSets).sum();
                assertThat(got).as("%s %s", frame.day(), m.group()).isEqualTo(m.sets());
            }
        }
        assertThat(days.get(1).picks()).isEmpty(); // Kedd = Rest
    }
}
```

- [ ] **Step 2: Run to see it fail**

```bash
cd backend && ./mvnw test -Dtest=MesoPlanFillerTest 2>&1 | grep -E 'cannot find|Tests run' | head -3
```
Expected: compile error (class missing). Note: make `MesoPlanSkeletonTest.RP` package-visible (`static final`, no `private`) as written in Task 4.

- [ ] **Step 3: Implement `MesoPlanFiller`**

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Deterministic exercise fill of a {@link MesoPlanSkeleton.Skeleton}: the fallback the generator
 * ALWAYS has (LLM absent / failed / partial). Pure — catalog rows come in as {@link Candidate}s.
 * Per (day, group): 2 exercises when the frame has ≥6 sets else 1, compound-first, stim-desc,
 * rotating the start offset on the group's later occurrences in the week so Upper A ≠ Upper B
 * when the catalog is deep enough. Never fabricates: a group with no candidate yields nothing.
 */
public final class MesoPlanFiller {

    private MesoPlanFiller() {}

    public record Candidate(UUID id, String name, String muscle, String group, String type, double stim, double fatigue) {}

    public record Pick(Candidate candidate, int workingSets) {}

    public record FilledDay(String day, String type, List<Pick> picks) {}

    private static final Comparator<Candidate> ORDER = Comparator
        .comparing((Candidate c) -> "compound".equals(c.type()) ? 0 : 1)
        .thenComparing(Comparator.comparingDouble(Candidate::stim).reversed())
        .thenComparing(Candidate::name);

    public static List<FilledDay> fill(MesoPlanSkeleton.Skeleton skeleton, List<Candidate> candidates,
                                       MesoPlanProperties props) {
        Map<String, Integer> occurrence = new HashMap<>();
        List<FilledDay> out = new ArrayList<>(skeleton.days().size());
        for (MesoPlanSkeleton.DayFrame day : skeleton.days()) {
            List<Pick> picks = new ArrayList<>();
            for (MesoPlanSkeleton.MuscleFrame m : day.muscles()) {
                int rotation = occurrence.merge(m.group(), 1, Integer::sum) - 1;
                picks.addAll(fillGroup(m.group(), m.sets(), candidates, rotation, props));
            }
            out.add(new FilledDay(day.day(), day.type(), List.copyOf(picks)));
        }
        return List.copyOf(out);
    }

    public static List<Pick> fillGroup(String group, int sets, List<Candidate> candidates, int rotation,
                                       MesoPlanProperties props) {
        List<Candidate> pool = candidates.stream().filter(c -> group.equals(c.group())).sorted(ORDER).toList();
        if (pool.isEmpty() || sets <= 0) {
            return List.of();
        }
        int count = Math.min(pool.size(), sets >= 6 ? Math.min(2, props.maxExercisesPerGroupPerDay()) : 1);
        int offset = (rotation * count) % pool.size();
        List<Pick> picks = new ArrayList<>(count);
        int base = sets / count;
        int remainder = sets % count;
        for (int i = 0; i < count; i++) {
            Candidate c = pool.get((offset + i) % pool.size());
            picks.add(new Pick(c, base + (i < remainder ? 1 : 0)));
        }
        return List.copyOf(picks);
    }
}
```

- [ ] **Step 4: Run green**

```bash
cd backend && ./mvnw test -Dtest=MesoPlanFillerTest 2>&1 | grep -E 'Tests run:' | tail -1
```
Expected: `Tests run: 6, Failures: 0, Errors: 0`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanFiller.java backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MesoPlanFillerTest.java
git commit -m "feat(train): MesoPlanFiller — deterministic exercise fill of the skeleton frames (mezo-<id>)"
```

---

### Task 6: `MesoPlanLlm` port + `MesoPlanMerger` (validate/merge an LLM suggestion)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanLlm.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanMerger.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MesoPlanMergerTest.java`

**Interfaces:**
- Produces (the port, owned by train — the companion adapter implements it in Task 7):
```java
public interface MesoPlanLlm {
  record FramedDay(String day, String type, Map<String,Integer> setsByGroup) {}
  record Request(List<FramedDay> days, List<MesoPlanFiller.Candidate> candidates, Map<String,String> tiers, String goalText) {}
  record ExercisePick(UUID catalogId, Integer workingSets) {}
  record DayPick(String day, List<ExercisePick> exercises) {}
  record Suggestion(String rationale, List<DayPick> days) {}
  Optional<Suggestion> propose(Request request);   // empty = unusable/failed (caller falls back)
}
```
- `MesoPlanMerger.merge(Skeleton, List<FilledDay> deterministic, Suggestion, List<Candidate>, MesoPlanProperties) -> List<FilledDay>`: for each (day, group) frame, take the suggestion's picks whose `catalogId` is a known candidate of THAT group; if any, redistribute the frame's sets over them (even split, remainder first; ignore the LLM's set counts except as ordering) capped at `maxExercisesPerGroupPerDay` (extra picks dropped); if none, keep the deterministic picks for that (day, group). Unknown ids, wrong-group ids, unknown days, picks on Rest days → ignored.

- [ ] **Step 1: Write the failing merger test**

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MesoPlanMergerTest {

    static final List<MesoPlanFiller.Candidate> CATALOG = MesoPlanFillerTest.CATALOG;
    static final var PROPS = MesoPlanFillerTest.PROPS;

    static MesoPlanFiller.Candidate byName(String n) {
        return CATALOG.stream().filter(c -> c.name().equals(n)).findFirst().orElseThrow();
    }

    @Test
    void merge_shouldHonorLlmPickInsideFrame_andRenormalizeSets() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of("back", "emphasize"), MesoPlanSkeletonTest.RP);
        var det = MesoPlanFiller.fill(s, CATALOG, PROPS);
        var sug = new MesoPlanLlm.Suggestion("teszt", List.of(
            new MesoPlanLlm.DayPick("Hét", List.of(new MesoPlanLlm.ExercisePick(byName("Pullover").id(), 99)))));

        var merged = MesoPlanMerger.merge(s, det, sug, CATALOG, PROPS);

        var monBack = merged.get(0).picks().stream().filter(p -> p.candidate().group().equals("back")).toList();
        assertThat(monBack).extracting(p -> p.candidate().name()).containsExactly("Pullover");
        assertThat(monBack.get(0).workingSets()).isEqualTo(6); // the frame's 6, not the LLM's 99
        // other groups on Hét untouched (deterministic)
        assertThat(merged.get(0).picks().stream().filter(p -> p.candidate().group().equals("chest")).toList())
            .extracting(p -> p.candidate().name()).containsExactly("Bench");
    }

    @Test
    void merge_shouldIgnoreUnknownIdsWrongGroupsAndRestDays() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of(), MesoPlanSkeletonTest.RP);
        var det = MesoPlanFiller.fill(s, CATALOG, PROPS);
        var sug = new MesoPlanLlm.Suggestion("x", List.of(
            new MesoPlanLlm.DayPick("Hét", List.of(new MesoPlanLlm.ExercisePick(UUID.randomUUID(), 3))),
            new MesoPlanLlm.DayPick("Kedd", List.of(new MesoPlanLlm.ExercisePick(byName("Bench").id(), 3))),
            new MesoPlanLlm.DayPick("Sze", List.of(new MesoPlanLlm.ExercisePick(byName("Bench").id(), 3)))));

        var merged = MesoPlanMerger.merge(s, det, sug, CATALOG, PROPS);

        assertThat(merged).isEqualTo(det);
    }

    @Test
    void merge_shouldCapPicksPerGroup_whenLlmSendsTooMany() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of("back", "emphasize"), MesoPlanSkeletonTest.RP);
        var det = MesoPlanFiller.fill(s, CATALOG, PROPS);
        var sug = new MesoPlanLlm.Suggestion("x", List.of(new MesoPlanLlm.DayPick("Hét", List.of(
            new MesoPlanLlm.ExercisePick(byName("Row").id(), 2),
            new MesoPlanLlm.ExercisePick(byName("Pulldown").id(), 2),
            new MesoPlanLlm.ExercisePick(byName("Pullover").id(), 2)))));

        var merged = MesoPlanMerger.merge(s, det, sug, CATALOG, PROPS);

        var monBack = merged.get(0).picks().stream().filter(p -> p.candidate().group().equals("back")).toList();
        assertThat(monBack).hasSize(2);
        assertThat(monBack).extracting(MesoPlanFiller.Pick::workingSets).containsExactly(3, 3);
    }
}
```

- [ ] **Step 2: Run to see it fail**

```bash
cd backend && ./mvnw test -Dtest=MesoPlanMergerTest 2>&1 | grep -E 'cannot find|Tests run' | head -3
```
Expected: compile error.

- [ ] **Step 3: Create the port**

```java
package io.mrkuhne.mezo.feature.train.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Train-owned LLM port of the plan generator (ADR 0012 consumer-owned port; the Gemini adapter
 * lives in {@code feature.companion.llm.MesoPlanLlmAdapter} — companion→train is the sanctioned
 * dependency direction, never the reverse). The model only PICKS exercises into frames the
 * deterministic skeleton already fixed; {@link MesoPlanMerger} validates every pick against the
 * candidate list and the frame, so a hallucinated id or an off-frame set count never reaches
 * the client. Empty = unusable answer; the caller keeps the deterministic fill.
 */
public interface MesoPlanLlm {

    record FramedDay(String day, String type, Map<String, Integer> setsByGroup) {}

    record Request(List<FramedDay> days, List<MesoPlanFiller.Candidate> candidates,
                   Map<String, String> tiers, String goalText) {}

    record ExercisePick(UUID catalogId, Integer workingSets) {}

    record DayPick(String day, List<ExercisePick> exercises) {}

    record Suggestion(String rationale, List<DayPick> days) {}

    Optional<Suggestion> propose(Request request);
}
```

- [ ] **Step 4: Implement `MesoPlanMerger`**

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Validates an LLM {@link MesoPlanLlm.Suggestion} against the frames and merges it over the
 *  deterministic fill. Pure. The LLM decides WHICH exercises; the frame decides HOW MANY sets. */
public final class MesoPlanMerger {

    private MesoPlanMerger() {}

    public static List<MesoPlanFiller.FilledDay> merge(MesoPlanSkeleton.Skeleton skeleton,
                                                       List<MesoPlanFiller.FilledDay> deterministic,
                                                       MesoPlanLlm.Suggestion suggestion,
                                                       List<MesoPlanFiller.Candidate> candidates,
                                                       MesoPlanProperties props) {
        if (suggestion == null || suggestion.days() == null || suggestion.days().isEmpty()) {
            return deterministic;
        }
        Map<UUID, MesoPlanFiller.Candidate> byId = candidates.stream()
            .collect(Collectors.toMap(MesoPlanFiller.Candidate::id, c -> c, (a, b) -> a));
        Map<String, List<MesoPlanLlm.ExercisePick>> picksByDay = new LinkedHashMap<>();
        for (MesoPlanLlm.DayPick d : suggestion.days()) {
            if (d == null || d.day() == null || d.exercises() == null) continue;
            picksByDay.merge(d.day(), new ArrayList<>(d.exercises()), (a, b) -> { a.addAll(b); return a; });
        }

        List<MesoPlanFiller.FilledDay> out = new ArrayList<>(deterministic.size());
        for (int i = 0; i < skeleton.days().size(); i++) {
            MesoPlanSkeleton.DayFrame frame = skeleton.days().get(i);
            MesoPlanFiller.FilledDay det = deterministic.get(i);
            List<MesoPlanLlm.ExercisePick> llm = picksByDay.getOrDefault(frame.day(), List.of());
            if (llm.isEmpty() || frame.muscles().isEmpty()) {
                out.add(det);
                continue;
            }
            List<MesoPlanFiller.Pick> picks = new ArrayList<>();
            for (MesoPlanSkeleton.MuscleFrame m : frame.muscles()) {
                List<MesoPlanFiller.Candidate> chosen = new ArrayList<>();
                for (MesoPlanLlm.ExercisePick p : llm) {
                    MesoPlanFiller.Candidate c = p == null || p.catalogId() == null ? null : byId.get(p.catalogId());
                    if (c != null && m.group().equals(c.group()) && !chosen.contains(c)) {
                        chosen.add(c);
                    }
                }
                if (chosen.isEmpty()) {
                    picks.addAll(det.picks().stream().filter(p -> p.candidate().group().equals(m.group())).toList());
                    continue;
                }
                int count = Math.min(chosen.size(), Math.min(props.maxExercisesPerGroupPerDay(), Math.max(1, m.sets())));
                int base = m.sets() / count;
                int remainder = m.sets() % count;
                for (int k = 0; k < count; k++) {
                    picks.add(new MesoPlanFiller.Pick(chosen.get(k), base + (k < remainder ? 1 : 0)));
                }
            }
            out.add(new MesoPlanFiller.FilledDay(frame.day(), frame.type(), List.copyOf(picks)));
        }
        return List.copyOf(out);
    }
}
```

- [ ] **Step 5: Run green**

```bash
cd backend && ./mvnw test -Dtest='MesoPlanMergerTest,MesoPlanFillerTest' 2>&1 | grep -E 'Tests run:' | tail -2
```
Expected: both `Failures: 0, Errors: 0`. (If `static final var` does not compile in the test, declare it as `static final MesoPlanProperties PROPS = MesoPlanFillerTest.PROPS;`.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanLlm.java backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanMerger.java backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MesoPlanMergerTest.java
git commit -m "feat(train): MesoPlanLlm port + MesoPlanMerger (validated LLM pick merge) (mezo-<id>)"
```

---

### Task 7: `MesoPlanGeneratorService` + controller method + contract IT (deterministic path)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanGeneratorService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java` (add the `@Override` next to `createMesoTemplate` ~line 139)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoPlanGenerateContractIT.java`

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces: `MesoPlanGenerateResponse generate(UUID user, MesoPlanGenerateRequest req)`; `TrainController.generateMesoPlan`.

- [ ] **Step 1: Write the failing contract IT (no fake profile — the companion adapter, if present, degrades; assert only deterministic guarantees)**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.SystemMessageList;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** Deterministic half of the plan generator (AI switch OFF in this context). */
@TestPropertySource(properties = "mezo.feature.meso-plan-ai.enabled=false")
class MesoPlanGenerateContractIT extends ApiIntegrationTest {

    private static final String GENERATE = "/api/train/meso-plans/generate";

    @Test
    void testGenerateMesoPlan_shouldReturnSevenDayTemplateWithFrames_whenFourDays() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(List.of("Hét", "Sze", "Pén", "Szo")).weeks(6)
            .priorities(Map.of("back", "emphasize", "calf", "maintain")).build(),
            auth, HttpStatus.OK, MesoPlanGenerateResponse.class);

        assertThat(res.getLlmUsed()).isFalse();
        assertThat(res.getRationale()).isNotBlank();
        MesoTemplateUpsertRequest t = res.getTemplate();
        assertThat(t.getGoalPreset()).isEqualTo("hypertrophy");
        assertThat(t.getWeeks()).isEqualTo(6);
        assertThat(t.getSplit()).isEqualTo("Upper / Lower · 4×/hét");
        assertThat(t.getPhaseCurve()).extracting(Enum::name).containsExactly("MEV", "MEV", "MAV", "MAV", "MRV", "DELOAD");
        assertThat(t.getMusclePriorities()).containsEntry("back", "emphasize").containsEntry("calf", "maintain").doesNotContainKey("chest");
        assertThat(t.getDays()).hasSize(7);
        assertThat(t.getDays()).extracting(MesoDayInput::getType).containsExactly("Upper", "Rest", "Lower", "Rest", "Upper", "Lower", "Rest");
        assertThat(t.getVolumePerMuscle()).containsKeys("chest", "back", "shoulder", "biceps", "triceps", "quad", "ham", "glute", "calf");
        assertThat(t.getVolumePerMuscle().get("back").getMev()).isEqualTo(10);

        int backSets = t.getDays().stream().flatMap(d -> d.getExercises().stream())
            .filter(e -> "back".equals(io.mrkuhne.mezo.feature.train.service.MuscleGroup.of(e.getMuscle())))
            .mapToInt(GymExerciseInput::getWorkingSets).sum();
        assertThat(backSets).isEqualTo(12);
        assertThat(t.getDays().stream().flatMap(d -> d.getExercises().stream()))
            .allSatisfy(e -> {
                assertThat(e.getCatalogId()).isNotNull();
                assertThat(e.getWorkingSets()).isBetween(1, 8);
                assertThat(e.getTargetRIR()).isEqualTo(1);
            });
    }

    @Test
    void testGenerateMesoPlan_shouldBeSaveableAsTemplate_whenPostedBack() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(List.of("Hét", "Csü")).weeks(4).build(), auth, HttpStatus.OK, MesoPlanGenerateResponse.class);

        MesoTemplateResponse saved = postForBody("/api/train/meso-templates", res.getTemplate(), auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getDays()).hasSize(7);
    }

    @Test
    void testGenerateMesoPlan_shouldReturn400_whenDayTokenInvalid() {
        HttpHeaders auth = ownerAuthHeaders();
        SystemMessageList err = postForBody(GENERATE, Map.of("daysOfWeek", List.of("Mon", "Tue"), "weeks", 6),
            auth, HttpStatus.BAD_REQUEST, SystemMessageList.class);
        assertHasFieldError(err, "daysOfWeek[0]");
    }

    @Test
    void testGenerateMesoPlan_shouldReturn400_whenPriorityValueUnknown() {
        HttpHeaders auth = ownerAuthHeaders();
        SystemMessageList err = postForBody(GENERATE, Map.of("daysOfWeek", List.of("Hét", "Csü"), "weeks", 6,
            "priorities", Map.of("back", "max")), auth, HttpStatus.BAD_REQUEST, SystemMessageList.class);
        assertHasFieldError(err, "priorities[back]");
    }
}
```
If `assertHasFieldError`'s field-path format differs (check `grep -n 'assertHasFieldError' backend/src/test/java/io/mrkuhne/mezo/support/ApiIntegrationTest.java` and an existing usage on an array/map field), adapt the expected path string to the project's format rather than the assertion helper.

- [ ] **Step 2: Run to see it fail**

```bash
cd backend && ./mvnw test -Dtest=MesoPlanGenerateContractIT -Dmezo.test.use-testcontainers=true 2>&1 | grep -E 'cannot find|does not override|Tests run' | head -3
```
Expected: compile error on `TrainController` (abstract method not implemented).

- [ ] **Step 3: Implement `MesoPlanGeneratorService`**

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * POST /api/train/meso-plans/generate — the single Hypertrophy model of the wizard redesign.
 * Skeleton (pure) → deterministic fill (pure) → optional LLM pick through the train-owned
 * {@link MesoPlanLlm} port (absent when the AI/companion switch is off) → merge (pure) → a
 * {@code MesoTemplateUpsertRequest} the FE posts back to {@code createMesoTemplate} unchanged.
 * Nothing is persisted here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MesoPlanGeneratorService {

    static final String GOAL_PRESET = "hypertrophy";
    static final String RATIONALE_DETERMINISTIC =
        "Determinisztikus kiosztás: a split a napszámból, a szettek a MEV/MAV/MRV sávokból — bármit cserélhetsz.";

    private final ExerciseCatalogRepository catalogRepository;
    private final VolumeProperties volumeProperties;
    private final MesoPlanProperties props;
    private final ObjectProvider<MesoPlanLlm> llm;

    @Transactional(readOnly = true)
    public MesoPlanGenerateResponse generate(UUID user, MesoPlanGenerateRequest req) {
        Map<String, String> priorities = PriorityTier.normalize(req.getPriorities());
        MesoPlanSkeleton.Skeleton skeleton = MesoPlanSkeleton.build(
            req.getDaysOfWeek(), req.getWeeks(), priorities, volumeProperties.baselines());
        List<MesoPlanFiller.Candidate> candidates = candidates(user);
        List<MesoPlanFiller.FilledDay> days = MesoPlanFiller.fill(skeleton, candidates, props);

        boolean llmUsed = false;
        String rationale = RATIONALE_DETERMINISTIC;
        MesoPlanLlm port = llm.getIfAvailable();
        if (port != null) {
            Optional<MesoPlanLlm.Suggestion> s = port.propose(toRequest(skeleton, candidates, priorities, req.getGoalText()));
            if (s.isPresent()) {
                days = MesoPlanMerger.merge(skeleton, days, s.get(), candidates, props);
                llmUsed = true;
                if (s.get().rationale() != null && !s.get().rationale().isBlank()) {
                    rationale = s.get().rationale().strip();
                }
            }
        }
        return MesoPlanGenerateResponse.builder()
            .template(toTemplate(skeleton, days, priorities, req))
            .rationale(rationale)
            .llmUsed(llmUsed)
            .build();
    }

    /** Master rows + this user's own catalog rows; soft-deleted rows are already filtered by the entity. */
    private List<MesoPlanFiller.Candidate> candidates(UUID user) {
        List<MesoPlanFiller.Candidate> out = new ArrayList<>();
        for (ExerciseCatalogEntity e : catalogRepository.findAllByOrderByMuscleAscNameAsc()) {
            if (e.getCreatedBy() != null && !user.equals(e.getCreatedBy())) continue;
            if ("plyo".equals(e.getType())) continue;
            String group = MuscleGroup.of(e.getMuscle());
            if (!volumeProperties.baselines().containsKey(group)) continue;
            out.add(new MesoPlanFiller.Candidate(e.getId(), e.getName(), e.getMuscle(), group, e.getType(),
                e.getStim() == null ? 0.5 : e.getStim().doubleValue(),
                e.getFatigue() == null ? 0.5 : e.getFatigue().doubleValue()));
        }
        return List.copyOf(out);
    }

    private static MesoPlanLlm.Request toRequest(MesoPlanSkeleton.Skeleton s, List<MesoPlanFiller.Candidate> candidates,
                                                 Map<String, String> priorities, String goalText) {
        List<MesoPlanLlm.FramedDay> framed = s.days().stream()
            .filter(d -> !d.muscles().isEmpty())
            .map(d -> {
                Map<String, Integer> by = new LinkedHashMap<>();
                d.muscles().forEach(m -> by.put(m.group(), m.sets()));
                return new MesoPlanLlm.FramedDay(d.day(), d.type(), by);
            }).toList();
        return new MesoPlanLlm.Request(framed, candidates, priorities, goalText == null ? "" : goalText.strip());
    }

    private MesoTemplateUpsertRequest toTemplate(MesoPlanSkeleton.Skeleton s, List<MesoPlanFiller.FilledDay> days,
                                                 Map<String, String> priorities, MesoPlanGenerateRequest req) {
        Map<String, VolumeBaseline> baselines = new LinkedHashMap<>();
        volumeProperties.baselines().forEach((g, b) -> baselines.put(g, VolumeBaseline.builder()
            .name("RP guidelines · intermediate").mev(b.mev()).mav(b.mav()).mrv(b.mrv()).build()));
        List<MesoDayInput> dayInputs = new ArrayList<>(7);
        for (int i = 0; i < s.days().size(); i++) {
            MesoPlanSkeleton.DayFrame frame = s.days().get(i);
            MesoPlanFiller.FilledDay filled = days.get(i);
            if ("Rest".equals(frame.type())) {
                dayInputs.add(MesoDayInput.builder().day(frame.day()).type("Rest").muscle("").note("Pihenőnap").exercises(List.of()).build());
                continue;
            }
            String accent = frame.muscles().isEmpty() ? "" : frame.muscles().get(0).group();
            dayInputs.add(MesoDayInput.builder().day(frame.day()).type(frame.type()).muscle(accent)
                .exercises(filled.picks().stream().map(this::toExercise).toList()).build());
        }
        String title = "Hypertrophy · " + season(LocalDate.now());
        return MesoTemplateUpsertRequest.builder()
            .title(title).shortTitle("Hypertrophy").goal("Izomtömeg építés").goalPreset(GOAL_PRESET)
            .musclePriorities(priorities.isEmpty() ? null : priorities)
            .weeks(req.getWeeks()).split(s.splitLabel()).style("RP · " + req.getWeeks() + " hét")
            .phaseCurve(s.phaseCurve().stream().map(MesoTemplateUpsertRequest.PhaseCurveEnum::fromValue).toList())
            .notes(req.getGoalText() == null || req.getGoalText().isBlank() ? null : req.getGoalText().strip())
            .volumePerMuscle(baselines)
            .days(dayInputs)
            .build();
    }

    private GymExerciseInput toExercise(MesoPlanFiller.Pick p) {
        boolean compound = "compound".equals(p.candidate().type());
        return GymExerciseInput.builder()
            .name(p.candidate().name()).muscle(p.candidate().muscle()).catalogId(p.candidate().id())
            .warmupSets(compound ? props.compoundWarmup() : props.isolationWarmup())
            .workingSets(Math.max(1, Math.min(10, p.workingSets())))
            .repMin(compound ? props.compoundRepMin() : props.isolationRepMin())
            .repMax(compound ? props.compoundRepMax() : props.isolationRepMax())
            .targetRIR(props.targetRir())
            .type(GymExerciseInput.TypeEnum.fromValue(p.candidate().type()))
            .countsTowardVolume(true)
            .build();
    }

    static String season(LocalDate d) {
        return switch (d.getMonthValue()) {
            case 12, 1, 2 -> "Tél";
            case 3, 4, 5 -> "Tavasz";
            case 6, 7, 8 -> "Nyár";
            default -> "Ősz";
        };
    }
}
```
`PhaseCurveEnum.fromValue("Deload")` must match the contract enum value `Deload` — verify the generated constant's `getValue()` with `grep -n 'DELOAD' backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/MesoTemplateUpsertRequest.java` after a compile.

- [ ] **Step 4: Add the controller method (next to `createMesoTemplate`)**

```java
    private final MesoPlanGeneratorService mesoPlanGeneratorService;   // add to the existing final fields

    @Override
    public MesoPlanGenerateResponse generateMesoPlan(MesoPlanGenerateRequest mesoPlanGenerateRequest) {
        return mesoPlanGeneratorService.generate(currentUserId.get(), mesoPlanGenerateRequest);
    }
```

- [ ] **Step 5: Run the IT + ArchUnit green**

```bash
cd backend && ./mvnw test -Dtest='MesoPlanGenerateContractIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true 2>&1 | grep -E 'Tests run:|FAIL' | tail -3
```
Expected: `MesoPlanGenerateContractIT` 4/4 green, `ArchitectureTest` green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanGeneratorService.java backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoPlanGenerateContractIT.java
git commit -m "feat(train): POST /api/train/meso-plans/generate — deterministic generator + controller (mezo-<id>)"
```

---

### Task 8: Companion `MesoPlanLlmAdapter` + fake branch + fake-profile IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/MesoPlanLlmAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (sentinel constant near `SLOT_PLAN_SENTINEL` ~line 365; dispatch branch inside `complete(...)` before the `MesoReviewGenerator.MESO_REVIEW_MARKER` branch ~line 626)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoPlanGenerateAiIT.java`

**Interfaces:**
- Produces: `MesoPlanLlmAdapter implements MesoPlanLlm` (`public static final String MARKER = "[meso-plan]"`), `FakeCompanionLlm.MESO_PLAN_SENTINEL = Pattern.compile("\\[fake-meso-plan:(\\{.*}|[^\\]]*)]", Pattern.DOTALL)`.

- [ ] **Step 1: Write the failing fake-profile IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;

/** LLM half of the plan generator on the companion-fake profile (default switches ON). */
@org.springframework.test.context.ActiveProfiles("companion-fake")
class MesoPlanGenerateAiIT extends ApiIntegrationTest {

    private static final String GENERATE = "/api/train/meso-plans/generate";

    @Test
    void testGenerateMesoPlan_shouldMarkLlmUsedAndKeepFrames_whenFakeAnswersDefault() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(List.of("Hét", "Sze", "Pén", "Szo")).weeks(6).priorities(Map.of("back", "emphasize")).build(),
            auth, org.springframework.http.HttpStatus.OK, MesoPlanGenerateResponse.class);

        assertThat(res.getLlmUsed()).isTrue();
        assertThat(res.getRationale()).isEqualTo("FAKE-INDOK");
        int backSets = res.getTemplate().getDays().stream().flatMap(d -> d.getExercises().stream())
            .filter(e -> "back".equals(io.mrkuhne.mezo.feature.train.service.MuscleGroup.of(e.getMuscle())))
            .mapToInt(GymExerciseInput::getWorkingSets).sum();
        assertThat(backSets).isEqualTo(12);
    }

    @Test
    void testGenerateMesoPlan_shouldHonorScriptedPick_whenSentinelPlantedInGoalText() {
        HttpHeaders auth = ownerAuthHeaders();
        List<ExerciseCatalogItem> catalog = restTemplate.exchange("/api/train/exercises", HttpMethod.GET,
            new HttpEntity<>(auth), new ParameterizedTypeReference<List<ExerciseCatalogItem>>() {}).getBody();
        ExerciseCatalogItem chestIso = catalog.stream()
            .filter(i -> i.getMuscle().startsWith("chest") && i.getType() == ExerciseCatalogItem.TypeEnum.ISOLATION)
            .findFirst().orElseThrow();
        String script = "[fake-meso-plan:{\"rationale\":\"Szkriptelt\",\"days\":[{\"day\":\"Hét\",\"exercises\":[{\"catalogId\":\""
            + chestIso.getId() + "\",\"workingSets\":1}]}]}]";

        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(List.of("Hét", "Sze", "Pén", "Szo")).weeks(6).goalText(script).build(),
            auth, org.springframework.http.HttpStatus.OK, MesoPlanGenerateResponse.class);

        assertThat(res.getLlmUsed()).isTrue();
        assertThat(res.getRationale()).isEqualTo("Szkriptelt");
        var monChest = res.getTemplate().getDays().get(0).getExercises().stream()
            .filter(e -> "chest".equals(io.mrkuhne.mezo.feature.train.service.MuscleGroup.of(e.getMuscle()))).toList();
        assertThat(monChest).extracting(GymExerciseInput::getCatalogId).containsExactly(chestIso.getId());
        assertThat(monChest.get(0).getWorkingSets()).isEqualTo(4); // frame's chest 8 / 2 days, not the scripted 1
    }

    @Test
    void testGenerateMesoPlan_shouldFallBackDeterministic_whenFakeFails() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoPlanGenerateResponse res = postForBody(GENERATE, MesoPlanGenerateRequest.builder()
            .daysOfWeek(List.of("Hét", "Csü")).weeks(4).goalText("[fake-fail]").build(),
            auth, org.springframework.http.HttpStatus.OK, MesoPlanGenerateResponse.class);

        assertThat(res.getLlmUsed()).isFalse();
        assertThat(res.getTemplate().getDays()).hasSize(7);
    }
}
```
`restTemplate` — use the `TestRestTemplate` field name `ApiIntegrationTest` exposes (`grep -n 'TestRestTemplate' backend/src/test/java/io/mrkuhne/mezo/support/ApiIntegrationTest.java`); if the base offers a typed `getForList`-style helper, prefer it.

- [ ] **Step 2: Run to see it fail (llmUsed false / rationale mismatch)**

```bash
cd backend && ./mvnw test -Dtest=MesoPlanGenerateAiIT -Dmezo.test.use-testcontainers=true 2>&1 | grep -E 'Tests run:|Expecting' | head -4
```
Expected: 3 failures (no adapter bean yet → deterministic path).

- [ ] **Step 3: Implement the adapter**

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.train.service.MesoPlanFiller;
import io.mrkuhne.mezo.feature.train.service.MesoPlanLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Gemini adapter of the train-owned {@link MesoPlanLlm} port (mesocycle wizard redesign). The
 * {@code HabitSuggestLlmAdapter} idiom verbatim: SMART tier one-shot, audit-tagged, brace-substring
 * extraction, degrade-to-empty. The model receives the FIXED frames (day → group → sets) and the
 * candidate catalog (id · name · zone · type) and must only choose ids and write one sentence;
 * every pick is re-validated by {@code MesoPlanMerger} in train, so nothing here is trusted.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.MESO_PLAN_AI_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
    havingValue = "true")
public class MesoPlanLlmAdapter implements MesoPlanLlm {

    /** Prompt marker the fake LLM keys its deterministic answer on (companion-fake profile). */
    public static final String MARKER = "[meso-plan]";

    private static final String SYSTEM_PROMPT = MARKER + """
            . Hipertrófia-programozó vagy. Egy determinisztikus váz adott: napok, és naponként
            izomcsoportonként a MUNKASZETTEK száma — ezeket NEM változtathatod. A feladatod: minden
            (nap, izomcsoport) kerethez válassz 1–2 gyakorlatot KIZÁRÓLAG a megadott katalógusból
            (a `catalogId` mezővel), a felhasználó céljához igazítva (kímélés, sport, preferencia),
            és a heti két előfordulásnál lehetőleg különböző gyakorlatokat. Írj egy 1–2 mondatos
            magyar indoklást (`rationale`), ami megnevezi, mit miért választottál.
            Válaszolj KIZÁRÓLAG egy JSON objektummal, ebben a formában:
            {"rationale":"...","days":[{"day":"Hét","exercises":[{"catalogId":"<uuid>","workingSets":3}]}]}
            Ismeretlen catalogId-t vagy nem létező napot ne írj. Ne írj semmi mást a JSON körül.
            """;

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<Suggestion> propose(Request request) {
        String user = buildUserPayload(request);
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                new LlmCallContext("train_meso_plan", "generate", null, null),
                () -> companionLlm.completeSmart(SYSTEM_PROMPT, user));
        } catch (Exception e) {
            log.warn("Meso plan LLM call failed — deterministic fill stays", e);
            return Optional.empty();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        try {
            Suggestion s = objectMapper.readValue(raw.substring(start, end + 1), Suggestion.class);
            return s == null ? Optional.empty() : Optional.of(s);
        } catch (Exception e) {
            log.warn("Meso plan LLM answer was not parseable JSON — dropping: {}", raw, e);
            return Optional.empty();
        }
    }

    private static String buildUserPayload(Request r) {
        StringBuilder b = new StringBuilder();
        b.append("[Cél]\n").append(r.goalText() == null || r.goalText().isBlank() ? "nincs megadva" : r.goalText()).append("\n\n");
        b.append("[Fókusz]\n").append(r.tiers() == null || r.tiers().isEmpty() ? "mind grow" : r.tiers()).append("\n\n");
        b.append("[Keretek — nap: izomcsoport=munkaszett]\n");
        for (FramedDay d : r.days()) {
            b.append(d.day()).append(" (").append(d.type()).append("): ").append(d.setsByGroup()).append('\n');
        }
        b.append("\n[Katalógus — catalogId | név | zóna | típus]\n");
        for (MesoPlanFiller.Candidate c : r.candidates()) {
            b.append(c.id()).append(" | ").append(c.name()).append(" | ").append(c.muscle()).append(" | ").append(c.type()).append('\n');
        }
        return b.toString();
    }
}
```
Jackson must deserialize the port's nested records (`Suggestion`, `DayPick`, `ExercisePick`) — records deserialize by canonical constructor in Jackson 3; if unknown-property strictness bites, wrap `objectMapper.readValue` with a reader `objectMapper.readerFor(Suggestion.class).without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)` (import `tools.jackson.databind.DeserializationFeature`).

- [ ] **Step 4: Add the fake branch**

Constant (next to `SLOT_PLAN_SENTINEL`):
```java
    /** Meso plan generator (wizard redesign): greedy `[fake-meso-plan:{json}]` planted in goalText;
     *  default = a valid empty-days answer so the frames stay deterministic and llmUsed is true. */
    public static final Pattern MESO_PLAN_SENTINEL =
            Pattern.compile("\\[fake-meso-plan:(\\{.*}|[^\\]]*)]", Pattern.DOTALL);
```
Dispatch branch (before the `MesoReviewGenerator.MESO_REVIEW_MARKER` branch):
```java
        if (systemPrompt.startsWith(MesoPlanLlmAdapter.MARKER)) {
            Matcher m = MESO_PLAN_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "{\"rationale\":\"FAKE-INDOK\",\"days\":[]}";
        }
```
`MesoPlanLlmAdapter` is in the same package as the fake — no import needed.

- [ ] **Step 5: Run the AI IT, the deterministic IT and ArchUnit green**

```bash
cd backend && ./mvnw test -Dtest='MesoPlanGenerateAiIT,MesoPlanGenerateContractIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true 2>&1 | grep -E 'Tests run:|FAIL' | tail -4
```
Expected: all green (3 + 4 + ArchUnit).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/MesoPlanLlmAdapter.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoPlanGenerateAiIT.java
git commit -m "feat(companion): MesoPlanLlmAdapter (Gemini pick into fixed frames) + fake branch (mezo-<id>)"
```

---

### Task 9: Docs, CODEMAP, full gate, PR

**Files:**
- Modify: `docs/features/train.md` (§4 Mesocycles (planning) — add an **Endpoints** bullet for `POST /api/train/meso-plans/generate` and a `#### Plan generator` sub-block; §7 note that the wizard's program now comes from the generator; §8 add the 5 new test classes; §10 add the 6 new files), `docs/features/companion.md` (adapter list near line 3198: one bullet for `MesoPlanLlmAdapter` + the fake sentinel near line 5028)
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Write the train.md `#### Plan generator` block (place after `#### Volume progression`)**

```markdown
#### Plan generator (mesocycle wizard redesign, `mezo-<id>`)
`POST /api/train/meso-plans/generate` (`MesoPlanGenerateRequest {daysOfWeek[2..6 of Hét..Vas], weeks 4..8, priorities?{group: emphasize|grow|maintain}, goalText?}` → `MesoPlanGenerateResponse {template: MesoTemplateUpsertRequest, rationale, llmUsed}`) is the single-model Hypertrophy generator; nothing is persisted — the FE posts `template` back to `createMesoTemplate` unchanged. Pipeline, all in `service/`: **`MesoPlanSkeleton`** (pure) derives the split from the day COUNT (2–3 Full · 4 Upper/Lower · 5 Upper/Lower/Push/Pull/Legs · 6 PPL×2 — every coarse group ≥2×/week by construction), week-1 sets from `PriorityTier.weekOneStart` (EMPHASIZE MEV+2, else MEV) and ceilings from `PriorityTier.ceiling`, spreads the weekly amount over the group's days (remainder earliest), and emits the phase curve (`MEV…MAV…MRV, Deload`); **`MesoPlanFiller`** (pure) fills each (day, group) frame with 1–2 catalog exercises (compound-first, stim-desc, rotating on the second weekly occurrence) — the fallback that always exists; the train-owned **`MesoPlanLlm`** port (companion's `MesoPlanLlmAdapter`, `[meso-plan]` marker, SMART tier, gated by `mezo.feature.meso-plan-ai.enabled` + the companion switch) lets Gemini pick exercises INTO the frames from the candidate list; **`MesoPlanMerger`** (pure) validates every pick (known id, right group, real day) and renormalizes sets to the frame — the model never changes volume. Tunables: `mezo.meso-plan.*` (`MesoPlanProperties`: session cap 8, 2 exercises/group/day, compound 8–10 / isolation 12–15 reps, RIR 1). **Seeding is tier-aware since this slice:** `seedPlanBaselines`/`seedBaselines` start an EMPHASIZE group's `currentSets` at MEV+2 so the volume log and the generated program agree in week 1.
```

- [ ] **Step 2: Update §8 and §10 lists and the companion.md adapter bullets** — add `MesoPlanSkeletonTest`, `MesoPlanFillerTest`, `MesoPlanMergerTest` (pure), `MesoPlanGenerateContractIT` (AI switch off via `@TestPropertySource`), `MesoPlanGenerateAiIT` (`companion-fake`: default answer, scripted `[fake-meso-plan:{…}]` in `goalText`, `[fake-fail]` fallback), `MesoStartTierSeedIT`, `MesoPlanPropertiesBindingIT`; file map entries for `MesoPlanSkeleton/Filler/Merger/Llm/GeneratorService.java`, `config/MesoPlanProperties.java`, `companion/llm/MesoPlanLlmAdapter.java`. In companion.md add after the `HabitSuggestLlmAdapter` bullet: "`MesoPlanLlmAdapter` (`llm/MesoPlanLlmAdapter.java`) — the train-owned `MesoPlanLlm` port's Gemini half (`[meso-plan]`, SMART tier, `LlmCallContext(train_meso_plan, generate)`), gated by `MESO_PLAN_AI_SWITCH` + the companion switch; the model only picks catalog ids into fixed frames, `train.MesoPlanMerger` validates." and extend the fake's bullet with the `[fake-meso-plan:{json}]` sentinel (planted in `goalText`, default `{"rationale":"FAKE-INDOK","days":[]}`).

- [ ] **Step 3: Regenerate CODEMAP + lint docs**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs && node scripts/gen-codemap.mjs --check
```
Expected: lint reports no staleness for train.md/companion.md; `--check` exits 0.

- [ ] **Step 4: Full local gates**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true 2>&1 | grep -E 'Tests run:.*Fail|BUILD' | tail -3
cd ../frontend && pnpm build 2>&1 | tail -2
```
Expected: `BUILD SUCCESS`; frontend build green (only `api.gen.ts` changed on the FE).

- [ ] **Step 5: Commit docs, push, open the self-PR**

```bash
git add docs/features/train.md docs/features/companion.md docs/CODEMAP.md
git commit -m "docs(train): plan generator + tier-aware seed; CODEMAP (mezo-<id>)"
git push -u origin feat/meso-plan-generator
gh pr create --fill --title "feat(train): mesocycle plan generator — POST /api/train/meso-plans/generate (mezo-<id>)" --body "Spec: docs/superpowers/specs/2026-09-01-mesocycle-wizard-redesign-design.md · Plan: docs/superpowers/plans/2026-09-02-meso-plan-generator-backend.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 6: Wait for CI green, merge locally with `--no-ff`, push main, close the issue**

```bash
gh pr checks --watch
git checkout main && git pull --rebase
git merge --no-ff feat/meso-plan-generator -m "Merge feat/meso-plan-generator: mesocycle plan generator backend (mezo-<id>)"
git push
git branch -d feat/meso-plan-generator
bd close <id>
bd dolt push
```
Expected: `git status` shows `up to date with origin`; `git push` to main triggers `deploy.yml`.

---

## Self-review

- **Spec coverage:** endpoint + request/response (Task 1) ✓; skeleton service with split table, ≥2×/week, ≤8/session, tier start/ceiling, phase curve (Task 4) ✓; Gemini adapter via companion pattern + Fake (Task 8) ✓; validator/fallback filler, LLM never trusted raw, injection guard by id-validation (Tasks 5–6) ✓; goalPreset fixed `hypertrophy`, split label, template-first save (Task 7 IT posts the proposal back) ✓; tier-aware seed so MEV+2 has a persisted home (Task 3 — a spec refinement discovered by recon) ✓; switch + tunables (Task 2) ✓; docs/CODEMAP/CI gates (Task 9) ✓. Spec's "MV ~6 for Maintain" is refined to "MEV, holds" because MV is not a landmark in this codebase — spec §The training model should be edited in the same PR (one line: `| Maintain | MEV | MEV | hold, no ramp |`).
- **Placeholder scan:** all steps carry code; the only "look it up" instructions are for two base-class helper names (`ownerId()`, `restTemplate`) with the exact grep to resolve them.
- **Type consistency:** `MesoPlanFiller.Candidate` is the single candidate type used by filler, port (`Request.candidates`), merger and service ✓; `MesoPlanSkeleton.DayFrame.type` values `Full|Upper|Lower|Push|Pull|Legs|Rest` are the same strings the service writes into `MesoDayInput.type` ✓; `PriorityTier.weekOneStart` used by skeleton and both seed paths ✓; `MesoPlanProperties` constructor order `(sessionCap, minFrequency, maxExercisesPerGroupPerDay, compoundRepMin, compoundRepMax, isolationRepMin, isolationRepMax, targetRir, compoundWarmup, isolationWarmup)` matches the test fixture `(8, 2, 2, 8, 10, 12, 15, 1, 2, 1)` ✓.
