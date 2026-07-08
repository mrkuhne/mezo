# Prescribed Sets + Hypertrophy Drive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc set logging with pre-populated warmup/working prescribed sets whose target weight & reps are dynamically computed (double progression), pre-filling the active workout.

**Architecture:** Approach A (spec D1) — the template `exercise` row stores the *recipe* (warmup/working counts, rep range, target RIR, optional anchor); a new `SetRecommendationService` computes concrete per-set weight/reps at `GET /workouts/today` from completed history; `exercise_set` gains a `kind` (warmup|working) flag excluded from records/e1RM/progression. Gated by `mezo.feature.hypertrophy-drive.enabled`.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven · PostgreSQL 16 + Liquibase · MapStruct + Lombok · OpenAPI contract-first (openapi-generator 7.17) · React 19 + TanStack Query + Vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-prescribed-sets-hypertrophy-drive-design.md` · **bd:** `mezo-dhdr`

## Global Constraints

- Base package `io.mrkuhne.mezo`; UUID PKs; `created_by` ownership server-side; soft delete via `@SQLDelete`/`@SQLRestriction`.
- **Contract-first:** edit `api/feature/train/train.yml` BEFORE code; request fields prefer `pattern` over `enum` (400 not 500); responses use `enum`; nullable via `nullable: true`. Regenerate: `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api` → backend DTOs regenerate during `./mvnw`.
- **Config:** all tunables under `mezo.` root as `@Validated @ConfigurationProperties` records; feature switch = `FeaturesConfiguration` constant + `@ConditionalOnProperty` gate bean + `application.yml`; never `@Value`.
- **Backend tests:** integration-first `@SpringBootTest` + Postgres (compose up), AssertJ only, data via `*Populator`; `test{Method}_should{Result}_when{Condition}`. Run `./mvnw clean test` (always `clean`).
- **Frontend:** dual-mode; `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- **Migrations:** never modify released changesets; explicit `pk_/fk_/uq_/ck_/idx_` names; changeset `{YYYYMMDDHHMM}_mezo-dhdr_{desc}.sql` registered in `1.0.0_master.yml`; seed in Java `@Profile`, never SQL.
- Worktree commits: `git -c core.hooksPath=/dev/null commit`; run `bd` from the main checkout.

---

### Task 1: Backend foundation — contract + schema + entities + call-sites (atomic green landing)

This is a rename refactor (`exercise.sets`→`working_sets`, drop `target_reps`); the DTO field rename forces every call-site to change together. Land it as one green increment.

**Files:**
- Modify: `api/feature/train/train.yml` (GymExercise, GymExerciseInput, TodayExercise, SetLogRequest, ExerciseSetResponse; new PrescribedSet)
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607072000_mezo-dhdr_prescribed_sets.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/.../feature/train/entity/ExerciseEntity.java`, `ExerciseSetEntity.java`
- Modify: `backend/.../feature/train/mapper/TrainMapper.java`
- Modify: `backend/.../feature/train/service/TrainService.java:211-230` (`toExerciseEntity`)
- Modify: `backend/.../feature/train/service/WorkoutService.java:194-218` (`logSet`)
- Modify: `backend/.../feature/train/TrainSeedData.java` (exercise builders)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java:138-163`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/PrescribedSetsFoundationIT.java` (new)

**Interfaces:**
- Produces (entity): `ExerciseEntity.getWarmupSets()/getWorkingSets()/getRepMin()/getRepMax()/getTargetRir()/getAnchorWeightKg()`; `ExerciseSetEntity.getKind()/setKind(String)`.
- Produces (DTO, generated): `GymExercise`/`GymExerciseInput`/`TodayExercise` with `warmupSets,workingSets,repMin,repMax,targetRIR,anchorWeightKg`; `TodayExercise.prescribedSets: List<PrescribedSet>`, `.rationale`; `PrescribedSet{kind,targetWeightKg,targetReps,targetRIR}`; `SetLogRequest.kind`, `ExerciseSetResponse.kind`.

- [ ] **Step 1: Edit the contract.** In `api/feature/train/train.yml` replace the `GymExercise` (1040–1072), `GymExerciseInput` (1142–1174), `TodayExercise` (1324–1359), `SetLogRequest` (1499–1532), `ExerciseSetResponse` (1461–1490) schemas and add `PrescribedSet`:

```yaml
    GymExercise:
      type: object
      required:
        - id
        - name
        - muscle
        - warmupSets
        - workingSets
        - repMin
        - repMax
        - targetRIR
        - type
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        muscle:
          type: string
        warmupSets:
          type: integer
        workingSets:
          type: integer
        repMin:
          type: integer
        repMax:
          type: integer
        targetRIR:
          type: integer
        anchorWeightKg:
          type: number
          nullable: true
        type:
          type: string
          enum: [compound, isolation, plyo]
        warning:
          type: string
        catalogId:
          type: string
          format: uuid
```

```yaml
    GymExerciseInput:
      type: object
      required:
        - name
        - warmupSets
        - workingSets
        - repMin
        - repMax
        - targetRIR
        - type
      properties:
        name:
          type: string
          minLength: 1
        muscle:
          type: string
        warmupSets:
          type: integer
          minimum: 0
          maximum: 10
        workingSets:
          type: integer
          minimum: 1
          maximum: 10
        repMin:
          type: integer
          minimum: 1
          maximum: 100
        repMax:
          type: integer
          minimum: 1
          maximum: 100
        targetRIR:
          type: integer
          minimum: 0
          maximum: 5
        anchorWeightKg:
          type: number
          minimum: 0
          maximum: 999
          nullable: true
        type:
          type: string
          enum: [compound, isolation, plyo]
        warning:
          type: string
        catalogId:
          type: string
          format: uuid
```

```yaml
    TodayExercise:
      type: object
      required:
        - id
        - name
        - muscle
        - warmupSets
        - workingSets
        - repMin
        - repMax
        - targetRIR
        - type
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        muscle:
          type: string
        warmupSets:
          type: integer
        workingSets:
          type: integer
        repMin:
          type: integer
        repMax:
          type: integer
        targetRIR:
          type: integer
        anchorWeightKg:
          type: number
          nullable: true
        type:
          type: string
          enum: [compound, isolation, plyo]
        warning:
          type: string
        note:
          type: string
          maxLength: 500
          nullable: true
          description: durable per-exercise note
        lastWeek:
          $ref: '#/components/schemas/LastWeekRef'
        prescribedSets:
          type: array
          nullable: true
          description: >-
            Per-set targets computed by the Hypertrophy Drive engine; null when the
            mezo.feature.hypertrophy-drive switch is off.
          items:
            $ref: '#/components/schemas/PrescribedSet'
        rationale:
          type: string
          nullable: true
          description: Short HU explanation of the recommendation (e.g. "Múlt hét 8 × 77.5 kg → +2.5 kg")
    PrescribedSet:
      type: object
      required:
        - kind
        - targetReps
      properties:
        kind:
          type: string
          enum: [warmup, working]
        targetWeightKg:
          type: number
          nullable: true
        targetReps:
          type: integer
        targetRIR:
          type: integer
          nullable: true
```

In `SetLogRequest` add (after `rir`, keeping `side`/`note`):

```yaml
        kind:
          type: string
          pattern: '^(warmup|working)$'
          description: warmup|working — defaults to working server-side when omitted
```

In `ExerciseSetResponse` add (after `skipped`):

```yaml
        kind:
          type: string
          enum: [warmup, working]
```

- [ ] **Step 2: Regenerate types.** Run:

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` rewritten; `git diff --stat` shows both. (Backend DTOs regenerate in Step 11's build.)

- [ ] **Step 3: Write the migration.** Create `202607072000_mezo-dhdr_prescribed_sets.sql`:

```sql
-- mezo-dhdr: prescribed sets — warmup/working recipe on the template exercise + set kind flag.
-- Approach A: the recipe lives here; concrete per-set targets are computed on-the-fly by
-- SetRecommendationService. exercise_set.kind classifies logged sets; warmups are excluded
-- from records/e1RM/progression.

-- exercise: rename sets -> working_sets; add warmup_sets / rep_min / rep_max / anchor_weight_kg;
-- migrate target_reps ("a-b" | "a") into rep_min/rep_max; drop target_reps.
ALTER TABLE exercise RENAME COLUMN sets TO working_sets;
ALTER TABLE exercise ADD COLUMN warmup_sets INT NOT NULL DEFAULT 0;
ALTER TABLE exercise ADD COLUMN rep_min INT;
ALTER TABLE exercise ADD COLUMN rep_max INT;
ALTER TABLE exercise ADD COLUMN anchor_weight_kg NUMERIC(6,2);

UPDATE exercise SET
    rep_min = COALESCE(NULLIF(split_part(target_reps, '-', 1), '') ::int, 8),
    rep_max = COALESCE(NULLIF(split_part(target_reps, '-', 2), '') ::int,
                       NULLIF(split_part(target_reps, '-', 1), '') ::int, 12);

ALTER TABLE exercise ALTER COLUMN rep_min SET NOT NULL;
ALTER TABLE exercise ALTER COLUMN rep_max SET NOT NULL;
ALTER TABLE exercise ADD CONSTRAINT ck_exercise_rep_range CHECK (rep_min >= 1 AND rep_max >= rep_min);
ALTER TABLE exercise DROP COLUMN target_reps;

-- exercise_set: classify each logged set; existing rows default to working.
ALTER TABLE exercise_set ADD COLUMN kind VARCHAR(7) NOT NULL DEFAULT 'working';
ALTER TABLE exercise_set ADD CONSTRAINT ck_exercise_set_kind CHECK (kind IN ('warmup','working'));
```

(Note: `target_reps` values are always `"a-b"`/`"a"` numeric strings in this app; a non-numeric value would fail the `::int` cast — acceptable for the controlled single-user data.)

- [ ] **Step 4: Register the changeset.** Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (after the last `heartbeat_note` entry):

```yaml
  - changeSet:
      id: "1.0.0:202607072000_mezo-dhdr_prescribed_sets"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607072000_mezo-dhdr_prescribed_sets.sql
```

- [ ] **Step 5: Update `ExerciseEntity`.** In `ExerciseEntity.java` replace the `sets` + `target_reps` fields with the recipe fields (keep `targetRir`):

```java
    @NotNull
    @Column(name = "warmup_sets", nullable = false)
    private Integer warmupSets = 0;

    @NotNull
    @Column(name = "working_sets", nullable = false)
    private Integer workingSets;

    @NotNull
    @Column(name = "rep_min", nullable = false)
    private Integer repMin;

    @NotNull
    @Column(name = "rep_max", nullable = false)
    private Integer repMax;

    @NotNull
    @Column(name = "target_rir", nullable = false)
    private Integer targetRir;

    /** Optional first-session seed weight (kg); null → engine leaves the first working set blank. */
    @Column(name = "anchor_weight_kg", precision = 6, scale = 2)
    private java.math.BigDecimal anchorWeightKg;
```

(Delete the old `private Integer sets;` and `private String targetReps;` declarations; the `targetRir` field is unchanged from today.)

- [ ] **Step 6: Update `ExerciseSetEntity`.** Add after `skipped` in `ExerciseSetEntity.java`:

```java
    @NotNull
    @Column(nullable = false)
    private String kind = "working"; // warmup|working (DB CHECK)
```

- [ ] **Step 7: Update the mapper.** In `TrainMapper.java`, the recipe fields auto-map (same names) and `toSetResponse` auto-maps `kind`. Add two ignores to `toTodayExercise` (the engine fills them in the service):

```java
    @Mapping(target = "targetRIR", source = "targetRir")
    @Mapping(target = "type", expression = "java(TodayExercise.TypeEnum.fromValue(entity.getType()))")
    @Mapping(target = "lastWeek", ignore = true)
    @Mapping(target = "prescribedSets", ignore = true)
    @Mapping(target = "rationale", ignore = true)
    TodayExercise toTodayExercise(ExerciseEntity entity);
```

- [ ] **Step 8: Update `TrainService.toExerciseEntity`.** Replace lines 222–223 (`e.setSets(...); e.setTargetReps(...);`) with the recipe setters:

```java
        e.setWarmupSets(in.getWarmupSets());
        e.setWorkingSets(in.getWorkingSets());
        e.setRepMin(in.getRepMin());
        e.setRepMax(in.getRepMax());
        e.setTargetRir(in.getTargetRIR());
        e.setAnchorWeightKg(in.getAnchorWeightKg());
```

(Keep the surrounding `setName`/`setMuscle`/`setType`/`setWarning`/`setCatalogId`/`setOrderIndex` lines unchanged.)

- [ ] **Step 9: Persist `kind` on log.** In `WorkoutService.logSet`, after `set.setSide(req.getSide());` add:

```java
        set.setKind(req.getKind() != null ? req.getKind() : "working");
```

- [ ] **Step 10: Fix the remaining call-sites so the build compiles.** In `TrainPopulator.java` both `createExercise` methods (lines 145–146 and 161–162) replace `e.setSets(3); e.setTargetReps("8-10");` with:

```java
        e.setWarmupSets(2);
        e.setWorkingSets(3);
        e.setRepMin(6);
        e.setRepMax(8);
```

Then in `TrainSeedData.java` do the identical swap at every exercise builder — find them with `grep -n "setSets\|setTargetReps" backend/src/main/java/io/mrkuhne/mezo/feature/train/TrainSeedData.java` and replace each `setSets(N)`/`setTargetReps("a-b")` pair with `setWarmupSets(2); setWorkingSets(N); setRepMin(a); setRepMax(b);` (keep each exercise's existing `setTargetRir`).

- [ ] **Step 11: Write the round-trip IT.** Create `PrescribedSetsFoundationIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PrescribedSetsFoundationIT extends AbstractIntegrationTest {

    @Autowired TrainPopulator train;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired ExerciseSetRepository exerciseSetRepository;
    @Autowired WorkoutService workoutService;

    @Test
    void testExerciseRecipe_shouldPersistWarmupAndWorkingCounts_whenSaved() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");

        ExerciseEntity reloaded = exerciseRepository.findById(ex.getId()).orElseThrow();
        assertThat(reloaded.getWarmupSets()).isEqualTo(2);
        assertThat(reloaded.getWorkingSets()).isEqualTo(3);
        assertThat(reloaded.getRepMin()).isEqualTo(6);
        assertThat(reloaded.getRepMax()).isEqualTo(8);
    }

    @Test
    void testLogSet_shouldDefaultKindToWorking_whenKindOmitted() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var instance = train.startInstance(owner, day.getId());

        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(ex.getId()).setIndex(0)
            .weightKg(BigDecimal.valueOf(80)).reps(8).rir(0).build();
        ExerciseSetResponse res = workoutService.logSet(owner, instance.getId(), req);

        ExerciseSetEntity saved = exerciseSetRepository.findById(res.getId()).orElseThrow();
        assertThat(saved.getKind()).isEqualTo("working");
        assertThat(res.getKind()).isEqualTo(ExerciseSetResponse.KindEnum.WORKING);
    }

    @Test
    void testLogSet_shouldPersistWarmupKind_whenKindWarmup() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var instance = train.startInstance(owner, day.getId());

        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(ex.getId()).setIndex(0)
            .weightKg(BigDecimal.valueOf(40)).reps(8).rir(4).kind("warmup").build();
        ExerciseSetResponse res = workoutService.logSet(owner, instance.getId(), req);

        assertThat(exerciseSetRepository.findById(res.getId()).orElseThrow().getKind()).isEqualTo("warmup");
    }
}
```

(If `TrainPopulator` lacks `createActiveMeso`/`createTemplateDay`/`createExercise(owner,day,name,muscle,type)`/`startInstance` helpers with these signatures, add thin wrappers mirroring the existing populator methods — the two `createExercise` overloads already exist at lines 138/154; give the 4-arg form used here.)

- [ ] **Step 12: Run backend build + IT.**

Run: `cd backend && docker compose up -d && ./mvnw clean test -Dtest=PrescribedSetsFoundationIT`
Expected: PASS (3 tests). Then `./mvnw clean test` — the full suite compiles and stays green (existing `TrainServiceIT`/`WorkoutServiceIT`/`WorkoutContractIT` may need their exercise fixtures updated to the recipe setters — apply the same swap as Step 10 wherever a test builds an `ExerciseEntity` or a `GymExerciseInput`).

- [ ] **Step 13: Frontend typecheck of the regen.**

Run: `cd frontend && pnpm build`
Expected: this FAILS on `data/train/trainHooks.ts`/`trainApi.ts`/`types.ts` (the `sets`/`targetReps` fields are gone from the generated `TodayExercise`/`GymExercise`). That is expected — the FE is fixed in Tasks 6–8. For THIS task's gate, only confirm `api.gen.ts` regenerated and the backend suite is green; do not block on the FE build here.

- [ ] **Step 14: Commit.**

```bash
git -c core.hooksPath=/dev/null add api/ backend/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(train): prescribed-set recipe schema + kind flag (mezo-dhdr)"
```

---

### Task 2: Config + feature gate

**Files:**
- Create: `backend/.../feature/train/config/HypertrophyProperties.java`
- Create: `backend/.../feature/train/HypertrophyDriveGate.java`
- Modify: `backend/.../techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.feature.hypertrophy-drive` + `mezo.hypertrophy` blocks)
- Modify: the `@ConfigurationPropertiesScan`/`@EnableConfigurationProperties` registration (wherever `ProgressionProperties` is registered — grep `EnableConfigurationProperties` / `ConfigurationPropertiesScan`)
- Test: `backend/.../feature/train/HypertrophyPropertiesIT.java` (new)

**Interfaces:**
- Produces: `HypertrophyProperties` (record) with `plateStep()`, `defaultIncrement()`, `increment()` (Map<String,BigDecimal>), `warmupRamp()` (List<Ramp>), `defaultWarmupSets()`; nested `Ramp(pct, repsFactor)`. `HypertrophyDriveGate` marker bean.

- [ ] **Step 1: Add the switch constant.** In `FeaturesConfiguration.java` add:

```java
    /** Hypertrophy Drive — pre-populated prescribed sets + dynamic weight/rep recommendation. */
    public static final String HYPERTROPHY_DRIVE_SWITCH = "mezo.feature.hypertrophy-drive.enabled";
```

- [ ] **Step 2: Add the gate bean.** Create `HypertrophyDriveGate.java`:

```java
package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Marker bean present ONLY when {@code mezo.feature.hypertrophy-drive.enabled=true}; gates the
 * prescribed-set computation in {@code WorkoutService.getToday} via {@code ObjectProvider}. When the
 * property is absent/false the bean is missing → the today response carries no prescribedSets and the
 * FE falls back to the ad-hoc logger. Mirrors {@code ProgressionGate}; no {@code matchIfMissing}.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.HYPERTROPHY_DRIVE_SWITCH, havingValue = "true")
public class HypertrophyDriveGate {
}
```

- [ ] **Step 3: Add the properties record.** Create `HypertrophyProperties.java`:

```java
package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Hypertrophy Drive tuning (mezo.hypertrophy): plate rounding, load increments per exercise
 * type, the warmup ramp, and the default warmup-set count for new exercises. */
@Validated
@ConfigurationProperties(prefix = "mezo.hypertrophy")
public record HypertrophyProperties(
    @NotNull @Positive BigDecimal plateStep,          // 2.5 — rounding granularity for computed kg
    @NotNull @Positive BigDecimal defaultIncrement,   // 2.5 — fallback increment (e.g. plyo/unknown type)
    @NotNull Map<String, @Positive BigDecimal> increment, // per type: compound 5.0, isolation 2.5
    @NotNull @Size(min = 1) @Valid List<Ramp> warmupRamp,
    @NotNull @PositiveOrZero Integer defaultWarmupSets   // 2
) {
    /** One warmup step as a fraction of the working weight + a rep factor of repMax. */
    public record Ramp(
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double pct,        // 0.50, 0.75
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double repsFactor  // 1.0, 0.5
    ) {}
}
```

- [ ] **Step 4: Register the properties.** Wherever the existing `ProgressionProperties` is registered (grep `@EnableConfigurationProperties` or `@ConfigurationPropertiesScan` under `techcore`/`feature`), add `HypertrophyProperties.class`. If the project uses `@ConfigurationPropertiesScan` on the main app class, no edit is needed — verify by grepping; otherwise add `HypertrophyProperties.class` to the `@EnableConfigurationProperties({...})` list.

- [ ] **Step 5: Add the YAML.** In `application.yml`, under `mezo.feature` (after the `progression` block, ~line 114) add:

```yaml
    # Hypertrophy Drive — pre-populated prescribed sets + dynamic recommendation on GET /workouts/today.
    hypertrophy-drive:
      enabled: true
```

And under the `mezo:` root (next to the `progression:` block, ~line 365) add:

```yaml
  hypertrophy:
    plate-step: 2.5           # kg rounding granularity for computed weights
    default-increment: 2.5    # fallback load step when a type has no explicit increment
    increment:
      compound: 5.0           # compound lifts progress in 5 kg jumps
      isolation: 2.5          # isolation lifts in 2.5 kg jumps
    default-warmup-sets: 2
    warmup-ramp:
      - { pct: 0.50, reps-factor: 1.0 }   # 50% × repMax
      - { pct: 0.75, reps-factor: 0.5 }   # 75% × ⌈repMax/2⌉
```

- [ ] **Step 6: Write the properties IT.** Create `HypertrophyPropertiesIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.HypertrophyProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

class HypertrophyPropertiesIT extends AbstractIntegrationTest {

    @Autowired HypertrophyProperties props;
    @Autowired ApplicationContext ctx;

    @Test
    void testProperties_shouldBind_whenApplicationYmlLoaded() {
        assertThat(props.plateStep()).isEqualByComparingTo(BigDecimal.valueOf(2.5));
        assertThat(props.increment().get("compound")).isEqualByComparingTo(BigDecimal.valueOf(5.0));
        assertThat(props.warmupRamp()).hasSize(2);
        assertThat(props.warmupRamp().get(0).pct()).isEqualTo(0.50);
        assertThat(props.defaultWarmupSets()).isEqualTo(2);
    }

    @Test
    void testGate_shouldBePresent_whenSwitchEnabled() {
        // default test profile has the switch on (application.yml)
        Assertions.assertThat(ctx.getBeansOfType(HypertrophyDriveGate.class)).isNotEmpty();
    }
}
```

- [ ] **Step 7: Run + commit.**

Run: `cd backend && ./mvnw clean test -Dtest=HypertrophyPropertiesIT`  Expected: PASS (2).

```bash
git -c core.hooksPath=/dev/null add backend/
git -c core.hooksPath=/dev/null commit -m "feat(train): hypertrophy-drive config + feature gate (mezo-dhdr)"
```

---

### Task 3: The recommendation engine (`SetRecommendationService`)

**Files:**
- Create: `backend/.../feature/train/service/SetRecommendationService.java`
- Create: `backend/.../feature/train/service/Prescription.java` (record)
- Modify: `backend/.../feature/train/repository/ExerciseSetRepository.java` (add a working-only finder if not present — see Task 5; the engine reuses the existing `findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc`)
- Test: `backend/.../feature/train/SetRecommendationServiceIT.java`

**Interfaces:**
- Consumes: `ExerciseEntity` recipe getters (Task 1); `HypertrophyProperties` (Task 2); `WorkoutSessionRepository.findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc`, `ExerciseSetRepository.findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc`.
- Produces: `Prescription prescribe(UUID createdBy, ExerciseEntity ex, UUID templateSessionId)` where `Prescription = record(List<PrescribedSet> sets, String rationale)`.

- [ ] **Step 1: Write the failing IT.** Create `SetRecommendationServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.service.Prescription;
import io.mrkuhne.mezo.feature.train.service.SetRecommendationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class SetRecommendationServiceIT extends AbstractIntegrationTest {

    @Autowired SetRecommendationService svc;
    @Autowired TrainPopulator train;

    @Test
    void testPrescribe_shouldSeedFromAnchor_whenNoHistory() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setAnchorWeightKg(BigDecimal.valueOf(60));
        train.save(ex);

        Prescription p = svc.prescribe(owner, ex, day.getId());

        // 2 warmup + 3 working; working weight = anchor 60
        assertThat(p.sets()).hasSize(5);
        assertThat(p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP)).hasSize(2);
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work).hasSize(3);
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(60));
        assertThat(work.get(0).getTargetReps()).isEqualTo(8);        // repMax
        assertThat(work.get(0).getTargetRIR()).isEqualTo(0);
        // warmups ramp off 60: 50% -> 30, 75% -> 45
        var warm = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP).toList();
        assertThat(warm.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(30));
        assertThat(warm.get(1).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(45));
    }

    @Test
    void testPrescribe_shouldLeaveWeightNull_whenNoHistoryAndNoAnchor() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");

        Prescription p = svc.prescribe(owner, ex, day.getId());

        assertThat(p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING))
            .allSatisfy(s -> assertThat(s.getTargetWeightKg()).isNull());
    }

    @Test
    void testPrescribe_shouldAddIncrement_whenLastTopSetHitRepMax() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // completed instance with a working top set 8 × 77.5 (repMax=8 → +5 for compound)
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(77.5), 8, 0);

        Prescription p = svc.prescribe(owner, ex, day.getId());

        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(82.5)); // 77.5 + 5
        assertThat(p.rationale()).contains("+5");
    }

    @Test
    void testPrescribe_shouldHoldWeight_whenLastRepsInRange() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(80), 7, 0); // 7 in [6,8) → hold

        Prescription p = svc.prescribe(owner, ex, day.getId());
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(80));
    }

    @Test
    void testPrescribe_shouldReduceWeight_whenLastRepsBelowRepMin() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(80), 4, 0); // 4 < 6 → -5

        Prescription p = svc.prescribe(owner, ex, day.getId());
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(75));
    }

    @Test
    void testPrescribe_shouldIgnoreWarmupHistory_whenComputingBase() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // a heavier WARMUP row (100kg) must not become the reference; only working (80×8) counts
        train.completedInstanceWithSets(owner, day.getId(), ex.getId(), sets -> {
            sets.add(train.set("warmup", BigDecimal.valueOf(100), 8, 4));
            sets.add(train.set("working", BigDecimal.valueOf(80), 8, 0));
        });

        Prescription p = svc.prescribe(owner, ex, day.getId());
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(85)); // 80 + 5
    }
}
```

(Add the `TrainPopulator` helpers referenced — `save`, `completedInstanceWithWorkingSet(owner, dayId, exId, weight, reps, rir)`, `completedInstanceWithSets(owner, dayId, exId, Consumer<List<ExerciseSetEntity>>)`, `set(kind, weight, reps, rir)` — as thin factory methods building a `completed` `workout_session` instance + `exercise_set` rows with the given `kind`. Model them on the existing populator's instance/set builders.)

- [ ] **Step 2: Run to verify failure.**

Run: `cd backend && ./mvnw clean test -Dtest=SetRecommendationServiceIT`
Expected: FAIL — `SetRecommendationService`/`Prescription` do not exist.

- [ ] **Step 3: Add the `Prescription` record.** Create `Prescription.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import java.util.List;

/** The engine output for one exercise: the ordered prescribed sets + a short HU rationale. */
public record Prescription(List<PrescribedSet> sets, String rationale) {}
```

- [ ] **Step 4: Implement the engine.** Create `SetRecommendationService.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.feature.train.config.HypertrophyProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Hypertrophy Drive — computes the prescribed warmup + working sets for one template exercise's
 * upcoming session (spec D2 double progression). Pure read; the switch is enforced by the caller
 * (WorkoutService.getToday via ObjectProvider&lt;HypertrophyDriveGate&gt;).
 */
@Service
@RequiredArgsConstructor
public class SetRecommendationService {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final HypertrophyProperties props;

    public Prescription prescribe(UUID createdBy, ExerciseEntity ex, UUID templateSessionId) {
        ExerciseSetEntity ref = referenceWorkingSet(createdBy, ex.getId(), templateSessionId);
        BigDecimal base;
        String rationale;

        if (ref != null && ref.getWeightKg() != null) {
            int rp = ref.getReps();
            BigDecimal inc = props.increment().getOrDefault(ex.getType(), props.defaultIncrement());
            BigDecimal w = ref.getWeightKg();
            if (rp >= ex.getRepMax()) {
                base = w.add(inc);
                rationale = "Múlt hét " + rp + " × " + strip(w) + " kg → +" + strip(inc) + " kg";
            } else if (rp < ex.getRepMin()) {
                base = w.subtract(inc);
                rationale = "Múlt hét " + rp + " rep a cél alatt → −" + strip(inc) + " kg";
            } else {
                base = w;
                rationale = "Múlt hét " + rp + " rep a tartományban → súly tart, cél +1 rep";
            }
            base = roundClamp(base);
        } else if (ref != null) {
            base = null; // weightless history (plyo/bodyweight)
            rationale = "Testsúlyos — ismétlésre progresszálunk";
        } else if (ex.getAnchorWeightKg() != null) {
            base = roundClamp(ex.getAnchorWeightKg());
            rationale = "Kezdő súly (anchor)";
        } else {
            base = null;
            rationale = "Első alkalom — add meg a súlyt";
        }

        List&lt;PrescribedSet&gt; sets = new ArrayList&lt;&gt;();
        if (base != null) {
            for (int i = 0; i &lt; ex.getWarmupSets(); i++) {
                HypertrophyProperties.Ramp r = props.warmupRamp().get(Math.min(i, props.warmupRamp().size() - 1));
                sets.add(PrescribedSet.builder()
                    .kind(PrescribedSet.KindEnum.WARMUP)
                    .targetWeightKg(roundClamp(base.multiply(BigDecimal.valueOf(r.pct()))))
                    .targetReps(Math.max(1, (int) Math.round(ex.getRepMax() * r.repsFactor())))
                    .targetRIR(null)
                    .build());
            }
        }
        for (int j = 0; j &lt; ex.getWorkingSets(); j++) {
            sets.add(PrescribedSet.builder()
                .kind(PrescribedSet.KindEnum.WORKING)
                .targetWeightKg(base)
                .targetReps(ex.getRepMax())
                .targetRIR(ex.getTargetRir())
                .build());
        }
        return new Prescription(sets, rationale);
    }

    /** Top WORKING set of the most recent completed instance of this exercise (max weight, then reps). */
    private ExerciseSetEntity referenceWorkingSet(UUID createdBy, UUID exerciseId, UUID templateSessionId) {
        WorkoutSessionEntity prev = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
                createdBy, templateSessionId, "completed")
            .orElse(null);
        if (prev == null) {
            return null;
        }
        return exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, prev.getId()).stream()
            .filter(s -&gt; exerciseId.equals(s.getExerciseId()))
            .filter(s -&gt; "working".equals(s.getKind()) &amp;&amp; !s.isSkipped() &amp;&amp; s.getReps() != null)
            .max(Comparator
                .comparing((ExerciseSetEntity s) -&gt; s.getWeightKg() != null ? s.getWeightKg() : BigDecimal.valueOf(-1))
                .thenComparing(ExerciseSetEntity::getReps))
            .orElse(null);
    }

    private BigDecimal roundClamp(BigDecimal x) {
        BigDecimal step = props.plateStep();
        BigDecimal rounded = x.divide(step, 0, RoundingMode.HALF_UP).multiply(step);
        return rounded.max(BigDecimal.ZERO).min(BigDecimal.valueOf(999));
    }

    private String strip(BigDecimal x) {
        return x.stripTrailingZeros().toPlainString();
    }
}
```

- [ ] **Step 5: Run to verify pass.**

Run: `cd backend && ./mvnw clean test -Dtest=SetRecommendationServiceIT`
Expected: PASS (6 tests). If `PrescribedSet.builder().targetRIR(null)` fails to compile (Integer boxing), it is fine — the generated DTO's `targetRIR` is a nullable `Integer`.

- [ ] **Step 6: Commit.**

```bash
git -c core.hooksPath=/dev/null add backend/
git -c core.hooksPath=/dev/null commit -m "feat(train): SetRecommendationService double-progression engine (mezo-dhdr)"
```

---

### Task 4: Wire the engine into `GET /workouts/today`

**Files:**
- Modify: `backend/.../feature/train/service/WorkoutService.java` (fields + `getToday`)
- Test: `backend/.../feature/train/WorkoutTodayPrescriptionIT.java` (new; or extend `WorkoutContractIT`)

**Interfaces:**
- Consumes: `SetRecommendationService.prescribe` (Task 3), `ObjectProvider<HypertrophyDriveGate>` (Task 2).
- Produces: `TodayExercise.prescribedSets` + `.rationale` populated when the switch is on; null when off.

- [ ] **Step 1: Write the failing IT.** Create `WorkoutTodayPrescriptionIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class WorkoutTodayPrescriptionIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;

    @Test
    void testGetToday_shouldAttachPrescribedSets_whenSwitchOn() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        // template day must match today's HU day label so getToday resolves it
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setAnchorWeightKg(BigDecimal.valueOf(60));
        train.save(ex);

        WorkoutTodayResponse res = workoutService.getToday(owner);

        assertThat(res.getExercises()).hasSize(1);
        var te = res.getExercises().get(0);
        assertThat(te.getPrescribedSets()).hasSize(5);       // 2 warmup + 3 working
        assertThat(te.getRationale()).isNotBlank();
        assertThat(te.getWarmupSets()).isEqualTo(2);
        assertThat(te.getWorkingSets()).isEqualTo(3);
    }
}
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd backend && ./mvnw clean test -Dtest=WorkoutTodayPrescriptionIT`
Expected: FAIL — `getPrescribedSets()` is null (engine not wired).

- [ ] **Step 3: Inject the collaborators.** In `WorkoutService.java` add two fields to the constructor block (after `progressionGate`):

```java
    private final SetRecommendationService setRecommendationService;
    private final ObjectProvider&lt;HypertrophyDriveGate&gt; hypertrophyGate;
```

(Add the import `io.mrkuhne.mezo.feature.train.HypertrophyDriveGate`.)

- [ ] **Step 4: Attach the prescription in `getToday`.** Replace the exercises-mapping lambda (lines 111–115) with:

```java
            .exercises(exercises.stream().map(e -&gt; {
                TodayExercise t = mapper.toTodayExercise(e);
                t.setLastWeek(lastWeek.get(e.getId()));
                if (hypertrophyGate.getIfAvailable() != null) {
                    Prescription p = setRecommendationService.prescribe(createdBy, e, day.getId());
                    t.setPrescribedSets(p.sets());
                    t.setRationale(p.rationale());
                }
                return t;
            }).toList())
```

- [ ] **Step 5: Run to verify pass.**

Run: `cd backend && ./mvnw clean test -Dtest=WorkoutTodayPrescriptionIT`  Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git -c core.hooksPath=/dev/null add backend/
git -c core.hooksPath=/dev/null commit -m "feat(train): attach prescribed sets to GET /workouts/today (mezo-dhdr)"
```

---

### Task 5: Exclude warmups from records / last-week / progression XP

**Files:**
- Modify: `backend/.../feature/train/repository/ExerciseSetRepository.java` (add working-only finder)
- Modify: `backend/.../feature/train/service/ExerciseRecordService.java:48-49`
- Modify: `backend/.../feature/train/service/WorkoutService.java` (`lastWeekRefs` filter)
- Modify: `backend/.../feature/train/signal/GymSignalCalculator.java:49`
- Test: `backend/.../feature/train/WarmupExclusionIT.java` (new)

**Interfaces:**
- Consumes: `ExerciseSetEntity.getKind()`.
- Produces: records/e1RM/lastWeek/XP computed over `kind='working'` sets only.

- [ ] **Step 1: Write the failing IT.** Create `WarmupExclusionIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class WarmupExclusionIT extends AbstractIntegrationTest {

    @Autowired ExerciseRecordService records;
    @Autowired TrainPopulator train;

    @Test
    void testRecords_shouldExcludeWarmupSets_fromBestSet() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // a heavier warmup (100kg) must NOT be the best set; the working 80×8 is the record
        train.completedInstanceWithSets(owner, day.getId(), ex.getId(), sets -> {
            sets.add(train.set("warmup", BigDecimal.valueOf(100), 5, 4));
            sets.add(train.set("working", BigDecimal.valueOf(80), 8, 0));
        });

        List<ExerciseRecordResponse> res = records.list(owner);

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getBestSet().getWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(80));
        assertThat(res.get(0).getTotalSets()).isEqualTo(1); // only the working set counts
    }
}
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd backend && ./mvnw clean test -Dtest=WarmupExclusionIT`
Expected: FAIL — bestSet is 100 (warmup still counted).

- [ ] **Step 3: Add the working-only finder.** In `ExerciseSetRepository.java` add:

```java
    /** Working sets only (record aggregation input — warmups excluded). */
    List&lt;ExerciseSetEntity&gt; findByCreatedByAndRepsNotNullAndKind(UUID createdBy, String kind);
```

- [ ] **Step 4: Filter in the record service.** In `ExerciseRecordService.list` change line 49:

```java
        List&lt;ExerciseSetEntity&gt; sets = exerciseSetRepository
            .findByCreatedByAndRepsNotNullAndKind(createdBy, "working");
```

- [ ] **Step 5: Filter last-week refs.** In `WorkoutService.lastWeekRefs`, extend the `.filter(...)` predicate (the `s.getWeightKg() != null && ...` line) to also require working:

```java
                .filter(s -&gt; "working".equals(s.getKind())
                    &amp;&amp; s.getWeightKg() != null &amp;&amp; s.getReps() != null &amp;&amp; s.getRir() != null)
```

- [ ] **Step 6: Filter progression XP.** In `GymSignalCalculator.java` line 49 extend the skip guard:

```java
            if (s.isSkipped() || s.getReps() == null || !"working".equals(s.getKind())) {
```

- [ ] **Step 7: Run to verify pass + full suite.**

Run: `cd backend && ./mvnw clean test -Dtest=WarmupExclusionIT` → PASS. Then `./mvnw clean test` → the whole backend suite green.

- [ ] **Step 8: Commit.**

```bash
git -c core.hooksPath=/dev/null add backend/
git -c core.hooksPath=/dev/null commit -m "feat(train): exclude warmup sets from records/lastWeek/XP (mezo-dhdr)"
```

---

### Task 6: Frontend types + hooks (prescribedSets, kind, recipe)

**Files:**
- Modify: `frontend/src/data/types.ts` (GymExercise + LoggedWorkoutExercise recipe/prescribed fields; new `PrescribedSet`)
- Modify: `frontend/src/data/train/trainApi.ts` (re-export `PrescribedSet`)
- Modify: `frontend/src/data/train/trainHooks.ts` (`toWorkoutPlan` mapping; `SetLogRequest.kind`)
- Modify: `frontend/src/data/train/train.ts` (mock `workout` fixture + builder-day fixtures → recipe shape)
- Test: `frontend/src/data/train/trainHooks.test.tsx` (extend)

**Interfaces:**
- Produces (FE types): `PrescribedSet = { kind:'warmup'|'working'; targetWeightKg:number|null; targetReps:number; targetRIR:number|null }`; `GymExercise` + `LoggedWorkoutExercise` gain `warmupSets,workingSets,repMin,repMax,anchorWeightKg?`; `LoggedWorkoutExercise` gains `prescribedSets: PrescribedSet[]|null`, `rationale: string|null`, and a derived `sets:number` (= warmupSets+workingSets) for `workoutState`.

- [ ] **Step 1: Add FE types.** In `types.ts` replace `GymExercise` (lines 561–570) `sets`/`targetReps` with recipe fields, and add `PrescribedSet` + extend `LoggedWorkoutExercise`:

```ts
export interface PrescribedSet {
  kind: 'warmup' | 'working'
  targetWeightKg: number | null
  targetReps: number
  targetRIR: number | null
}

export interface GymExercise {
  id: string
  name: string
  muscle: string
  warmupSets: number
  workingSets: number
  repMin: number
  repMax: number
  targetRIR: number
  anchorWeightKg?: number | null
  type: ExerciseKind
  warning?: string
  catalogId?: string
}
```

In `LoggedWorkoutExercise` (lines 622–632) replace `sets`/`targetReps` and add prescribed fields:

```ts
export interface LoggedWorkoutExercise {
  id: string
  name: string
  warmupSets: number
  workingSets: number
  repMin: number
  repMax: number
  targetRIR: number
  anchorWeightKg: number | null
  type: ExerciseKind
  muscle: string
  sets: number // derived total (warmupSets + workingSets) — drives workoutState set count
  prescribedSets: PrescribedSet[] | null
  rationale: string | null
  lastWeek: LastWeekSet | null
  note?: string | null
}
```

- [ ] **Step 2: Re-export the DTO type.** In `trainApi.ts` add (after `ExerciseSetResponse`):

```ts
export type PrescribedSet = components['schemas']['PrescribedSet']
```

- [ ] **Step 3: Map in `toWorkoutPlan`.** In `trainHooks.ts` replace the `exercises` map (lines 54–62) with:

```ts
    exercises: r.exercises.map((e) => ({
      id: e.id, name: e.name, muscle: e.muscle,
      warmupSets: e.warmupSets, workingSets: e.workingSets,
      repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
      anchorWeightKg: e.anchorWeightKg ?? null,
      type: e.type,
      sets: e.warmupSets + e.workingSets,
      prescribedSets: (e.prescribedSets as PrescribedSet[] | undefined) ?? null,
      rationale: e.rationale ?? null,
      note: e.note ?? null,
      lastWeek: e.lastWeek
        ? { weight: Number(e.lastWeek.weightKg), reps: e.lastWeek.reps, rir: e.lastWeek.rir }
        : null,
    })),
```

Add `type PrescribedSet` to the `trainApi` import block.

- [ ] **Step 4: Update the mock fixtures.** In `train.ts` rewrite the `workout.exercises` fixtures (lines 277–282) to the recipe + prescribedSets shape (mock mirrors the real engine output). Example for `ex1`:

```ts
    {
      id: 'ex1', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
      warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 0, anchorWeightKg: null,
      sets: 5,
      rationale: 'Múlt hét 9 × 102.5 kg → +2.5 kg',
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: 52.5, targetReps: 10, targetRIR: null },
        { kind: 'warmup', targetWeightKg: 77.5, targetReps: 5, targetRIR: null },
        { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
        { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
        { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
      ],
      lastWeek: { weight: 102.5, reps: 9, rir: 2 },
    },
```

Apply the same shape to `ex2`–`ex5` (drop `sets:4`/`targetReps` → `warmupSets/workingSets/repMin/repMax`, add `sets` total + a `prescribedSets` array + `rationale`). Also update the builder-day exercise fixtures (lines ~158–206, `GymExercise` shape) from `sets: N, targetReps: 'a-b'` to `warmupSets: 2, workingSets: N, repMin: a, repMax: b` (keep `targetRIR`).

- [ ] **Step 5: Add `kind` to logSet call (optional plumb).** No change needed in the mutation types (the generated `SetLogRequest.kind` is optional); the call site in Task 7 will pass `kind`.

- [ ] **Step 6: Extend the hook test.** In `trainHooks.test.tsx` add a case asserting `toWorkoutPlan` maps prescribedSets + recipe fields (mirror the existing mapping test):

```tsx
it('maps prescribedSets and recipe fields from the today response', () => {
  const plan = toWorkoutPlan({
    templateSessionId: 't1', title: 'Pull', durationEst: 60,
    exercises: [{
      id: 'e1', name: 'Row', muscle: 'back-mid', type: 'compound',
      warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 0, anchorWeightKg: null,
      prescribedSets: [{ kind: 'working', targetWeightKg: 80, targetReps: 8, targetRIR: 0 }],
      rationale: 'x',
    }],
  } as unknown as WorkoutTodayResponse)
  expect(plan?.exercises[0].sets).toBe(5)
  expect(plan?.exercises[0].prescribedSets).toHaveLength(1)
  expect(plan?.exercises[0].rationale).toBe('x')
})
```

(If `toWorkoutPlan` is not exported, export it for the test, as the existing mapping tests do.)

- [ ] **Step 7: Run both modes + commit.**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- trainHooks && pnpm test -- trainHooks
git -c core.hooksPath=/dev/null add frontend/
git -c core.hooksPath=/dev/null commit -m "feat(train): FE types + toWorkoutPlan for prescribed sets (mezo-dhdr)"
```

---

### Task 7: Active-workout pre-population

**Files:**
- Modify: `frontend/src/features/train/logic/workoutState.ts` (carry prescribed targets; seed count from prescription)
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (prefill from prescribed target; render warmup/working; rationale replaces static hint; pass `kind` on log)
- Test: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx` (extend)

**Interfaces:**
- Consumes: `LoggedWorkoutExercise.prescribedSets/rationale` (Task 6).
- Produces: `makeSession(exercises)` seeds `planned[id] = warmupSets+workingSets`; `Session.prescribed: Record<string, PrescribedSet[]>`; a helper `prescribedAt(session, id, idx): PrescribedSet | null`.

- [ ] **Step 1: Write the failing test.** In `ActiveWorkoutPage.test.tsx` add:

```tsx
it('pre-fills the current set stepper from the prescribed target', async () => {
  renderActiveWorkout() // helper that mounts with the mock `workout` fixture (ex1: working 105×10)
  // warmups are set 1-2; the working target for set 3 is 105 kg × 10
  expect(await screen.findByLabelText('kg')).toHaveValue(52.5) // first warmup target
  expect(screen.getByLabelText('reps')).toHaveValue(10)
})

it('renders the rationale line instead of the static hint', async () => {
  renderActiveWorkout()
  expect(await screen.findByText(/→ \+2\.5 kg/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd frontend && pnpm test -- ActiveWorkoutPage`  Expected: FAIL.

- [ ] **Step 3: Extend `workoutState.ts`.** Change `LoggedSet`/`Session`/`makeSession`/`seedFromOpen` to carry prescriptions:

```ts
import type { PrescribedSet } from '@/data/types'

export interface Session {
  order: string[]
  setIdx: number
  logged: Record<string, LoggedSet[]>
  extra: Record<string, number>
  skipped: string[]
  planned: Record<string, number>
  /** Per-exercise prescribed targets (warmup then working), aligned to setIndex. */
  prescribed: Record<string, PrescribedSet[]>
}

export function makeSession(
  exercises: { id: string; warmupSets: number; workingSets: number; prescribedSets: PrescribedSet[] | null }[],
): Session {
  const order = exercises.map((e) => e.id)
  const planned: Record<string, number> = {}
  const prescribed: Record<string, PrescribedSet[]> = {}
  for (const e of exercises) {
    planned[e.id] = e.warmupSets + e.workingSets
    prescribed[e.id] = e.prescribedSets ?? []
  }
  return { order, setIdx: 0, logged: {}, extra: {}, skipped: [], planned, prescribed }
}

/** The prescribed target for a given set index of an exercise (null past the plan / no prescription). */
export function prescribedAt(s: Session, id: string, idx: number): PrescribedSet | null {
  return s.prescribed[id]?.[idx] ?? null
}
```

Update `seedFromOpen(exercises, open)` to accept the same `exercises` shape and thread `prescribed` (build `makeSession(exercises)` as it already does, then overlay logged/skipped — unchanged logic). Keep `effectiveSetCount`/`currentExerciseId`/`completeSet`/`advance`/`addExtraSet`/`skipExercise` unchanged (they read `planned`/`extra`).

- [ ] **Step 4: Prefill + render in `ActiveWorkoutPage.tsx`.**

(a) Change the prefill source. The current `prefill(exercise)` uses `lastWeek`; replace the active-set prefill to read the prescribed target for the current set index. Add a helper near the top of the component:

```tsx
const curTarget = prescribedAt(session, current.id, session.setIdx)
```

and seed `weight`/`reps` from it when present. In the mount seed (lines 132–134) and after each `completeSet`/exercise advance, set:

```tsx
    setWeight(curTarget?.targetWeightKg ?? startPrefill.weight)
    setReps(curTarget?.targetReps ?? startPrefill.reps)
    setRir(curTarget?.targetRIR ?? 0)
```

(Wire this via a `useEffect` on `[current.id, session.setIdx]` that resets the three inputs from `prescribedAt(session, current.id, session.setIdx)`, falling back to `lastWeek`-based prefill when null — keeps first-session/no-engine behavior.)

(b) Show the current set's kind. In the exercise-card eyebrow (lines 675–681) append the kind chip:

```tsx
              <span className="chip brand" style={{ fontSize: 9, padding: '3px 8px' }}>
                {curTarget?.kind === 'warmup' ? 'Bemelegítő' : `Cél · ${current.repMin}-${current.repMax} @ RIR ${current.targetRIR}`}
              </span>
```

(c) Replace the static hint (lines 735–739) with the rationale:

```tsx
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {current.rationale ?? `RIR ${current.lastWeek?.rir ?? ''} — súly tartás vagy +1 rep`}
                  </span>
```

(d) Style warmup set-dots. In the set-dots map (lines 748–754) add a warmup class when the prescribed set at index `i` is a warmup:

```tsx
                  const isWarm = prescribedAt(session, current.id, i)?.kind === 'warmup'
                  return (
                    <div key={i}
                      className={'set-dot' + (i < session.setIdx ? ' done' : i === session.setIdx ? ' active' : '')
                        + (isExtra ? ' extra' : '') + (isWarm ? ' warm' : '')} />
                  )
```

(e) Pass `kind` when logging. In `completeSet` (lines 210–213) add `kind` derived from the current target:

```tsx
      logSet(workoutId, {
        exerciseId: finishing.id, setIndex: wasSetIdx, weightKg: weight, reps, rir,
        kind: prescribedAt(session, finishing.id, wasSetIdx)?.kind ?? 'working',
        ...(side ? { side } : {}), ...(note.trim() ? { note: note.trim() } : {}),
      })
```

(f) Add the `.set-dot.warm` style to `prototype.css` (near `.set-dot.extra`):

```css
.set-dot.warm { border-color: color-mix(in srgb, var(--warning) 40%, transparent); background: color-mix(in srgb, var(--warning) 8%, transparent); }
.set-dot.warm.done { background: var(--warning); border-color: var(--warning); }
```

- [ ] **Step 5: Update callers of `makeSession`.** The mount seed (lines 128–130) passes `W.exercises`; those now carry `warmupSets/workingSets/prescribedSets`, so `makeSession(W.exercises)` and `seedFromOpen(W.exercises, …)` type-check with the new signature. Fix any other `makeSession` caller (grep) to pass the recipe shape.

- [ ] **Step 6: Run both modes + commit.**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- ActiveWorkoutPage && pnpm test -- ActiveWorkoutPage && pnpm build
git -c core.hooksPath=/dev/null add frontend/
git -c core.hooksPath=/dev/null commit -m "feat(train): active-workout pre-population from prescribed sets (mezo-dhdr)"
```

---

### Task 8: Builder set-structure editor + day-card summary

**Files:**
- Modify: `frontend/src/features/train/components/ExerciseEditRow.tsx` (recipe steppers)
- Modify: `frontend/src/features/train/components/GymExRow.tsx` (recipe summary)
- Modify: `frontend/src/features/train/components/MesoExercises.tsx` (`libraryToGymExercise` defaults + `persistDay` mapping)
- Modify: `frontend/src/features/train/components/EditorChip.tsx` (add optional ± handlers) OR inline steppers in ExerciseEditRow
- Test: `frontend/src/features/train/components/ExerciseEditRow.test.tsx` (new)

**Interfaces:**
- Consumes: `GymExercise` recipe fields (Task 6); `saveDayExercises` (existing).
- Produces: editable warmup/working/rep-range/RIR/anchor per exercise; `GymExerciseInput` recipe payload on persist.

- [ ] **Step 1: Write the failing test.** Create `ExerciseEditRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { ExerciseEditRow } from '@/features/train/components/ExerciseEditRow'

const ex = {
  id: 'e1', name: 'Fekvenyomás', muscle: 'chest', type: 'compound' as const,
  warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 0,
}

it('shows the recipe summary line', () => {
  render(<ExerciseEditRow ex={ex} onRemove={() => {}} onChange={() => {}} />)
  expect(screen.getByText(/2 bem · 3 work · 6-8 · RIR 0/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd frontend && pnpm test -- ExerciseEditRow`  Expected: FAIL.

- [ ] **Step 3: Rewrite the summary + editor in `ExerciseEditRow.tsx`.** Replace the meta line (lines 29–34) summary text and the `EditorChip` block (lines 78–82) with recipe steppers. Change the props to `{ ex: GymExercise; onRemove: () => void; onChange: (patch: Partial<GymExercise>) => void }`. Meta line:

```tsx
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--brand-glow)' }}>
                {ex.warmupSets} bem · {ex.workingSets} work · {ex.repMin}-{ex.repMax} · RIR {ex.targetRIR}
              </span>
```

Editor block (replace the three display `EditorChip`s):

```tsx
          <div className="row gap-sm flex-wrap">
            <RecipeStepper label="Bemelegítő" value={ex.warmupSets} min={0} max={10}
              onChange={(v) => onChange({ warmupSets: v })} />
            <RecipeStepper label="Working" value={ex.workingSets} min={1} max={10}
              onChange={(v) => onChange({ workingSets: v })} />
            <RecipeStepper label="Rep min" value={ex.repMin} min={1} max={100}
              onChange={(v) => onChange({ repMin: v })} />
            <RecipeStepper label="Rep max" value={ex.repMax} min={ex.repMin} max={100}
              onChange={(v) => onChange({ repMax: v })} />
            <RecipeStepper label="RIR" value={ex.targetRIR} min={0} max={5}
              onChange={(v) => onChange({ targetRIR: v })} />
          </div>
```

Add a small local `RecipeStepper` component (a label + −/value/+ tile reusing the EditorChip visual, wired to onChange):

```tsx
function RecipeStepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div style={{ flex: '1 1 30%', minWidth: 88, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', padding: '6px 10px' }}>
      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{label}</span>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 600 }}>{value}</span>
        <div className="row gap-xs">
          <button type="button" aria-label={`${label} csökkentése`} onClick={() => onChange(clamp(value - 1))}
            style={{ width: 22, height: 22, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>−</button>
          <button type="button" aria-label={`${label} növelése`} onClick={() => onChange(clamp(value + 1))}
            style={{ width: 22, height: 22, background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>+</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Thread `onChange` through the day list.** In `MesoExercises.tsx` add an `updateExercise(dayKey, exId, patch)` mutator (mirrors `removeExercise`, applies `patch` to the matching exercise then `persistDay`), and pass `onChange` into the row (via `DayExerciseSection` → `ExerciseEditRow`). Update `libraryToGymExercise` (lines 29–39) defaults + `persistDay` payload (lines 47–52):

```ts
function libraryToGymExercise(item: ExerciseLibraryItem): MesoDay['exercises'][number] {
  return {
    id: `${item.id}-${Date.now()}`,
    name: item.name, muscle: item.muscle,
    warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 0,
    type: item.type,
    ...(item.catalogId ? { catalogId: item.catalogId } : {}),
  }
}
```

```ts
    saveDayExercises(meso.id, day.id, day.exercises.map((e) => ({
      name: e.name, muscle: e.muscle,
      warmupSets: e.warmupSets, workingSets: e.workingSets,
      repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
      anchorWeightKg: e.anchorWeightKg, type: e.type, warning: e.warning, catalogId: e.catalogId,
    })))
```

(`DayExerciseSection` passes `onChange={(patch) => onChangeExercise(e.id, patch)}` down to `ExerciseEditRow`; add the `onChangeExercise` prop alongside the existing `onRemoveExercise`.)

- [ ] **Step 5: Day-card / GymExRow summary.** In `GymExRow.tsx` replace the right-side stat (lines 49–52) with the recipe summary:

```tsx
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color: typeColor, lineHeight: 1 }}>
            {ex.warmupSets}+{ex.workingSets}
          </span>
          <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>{ex.repMin}-{ex.repMax} · RIR {ex.targetRIR}</span>
```

- [ ] **Step 6: Run both modes + build + commit.**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && pnpm test && pnpm build
git -c core.hooksPath=/dev/null add frontend/
git -c core.hooksPath=/dev/null commit -m "feat(train): builder set-structure editor + recipe summary (mezo-dhdr)"
```

---

### Task 9: Docs + wrap-up

**Files:**
- Modify: `docs/features/train.md` (§2 active-workout pre-population, §4 recipe columns + kind + prescribedSets, §9 gotchas)
- Run: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Update `train.md`.** In §4 "Workout execution" document the `exercise` recipe columns (`warmup_sets/working_sets/rep_min/rep_max/anchor_weight_kg`, replacing `sets`/`target_reps`), the `exercise_set.kind` flag, the new `mezo-dhdr` migration, and `GET /workouts/today` now returning `prescribedSets` + `rationale` behind `mezo.feature.hypertrophy-drive.enabled`. In §2 note the active workout pre-populates from `prescribedSets` (warmup/working). In §9 add the gotcha: warmups (`kind='warmup'`) are excluded from records/e1RM/lastWeek/XP; the engine computes on completed-history only (resume-safe). Add `SetRecommendationService`, `HypertrophyProperties`, `HypertrophyDriveGate` to §10 key files. Update the frontmatter `updated:` to `2026-07-07`.

- [ ] **Step 2: Lint.**

Run: `node scripts/lint-docs.mjs`
Expected: no errors; the train.md staleness flag cleared.

- [ ] **Step 3: Final full gate.**

```bash
cd backend && ./mvnw clean test
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green.

- [ ] **Step 4: Commit + close bd.**

```bash
git -c core.hooksPath=/dev/null add docs/
git -c core.hooksPath=/dev/null commit -m "docs(train): document prescribed sets + hypertrophy drive (mezo-dhdr)"
```

Then from the MAIN checkout: `bd close mezo-dhdr` + `bd update mezo-dhdr --notes "Shipped: prescribed-set recipe + SetRecommendationService double-progression engine + kind flag + FE pre-population."`

---

## Self-Review

**Spec coverage:** D1 recipe+on-the-fly → Tasks 1,3,4. D2 double progression → Task 3. D3 recipe shape → Tasks 1 (schema/entity). D4 kind flag + working-only readers → Tasks 1,5. D5 warmup ramp → Task 3 config+engine. D6 anchor/first-session → Task 3. D7 plyo weightless → Task 3 (null base) + Task 7 (FE hides kg for plyo — note in Task 7 step 4b if `current.type==='plyo'` suppress the kg stepper). D8 getToday + switch-off → Tasks 2,4. D9 increment/RIR → Tasks 2,3. D10 switch+config → Task 2. D11 migration → Task 1. D12 out of scope → not built. §6 UI → Tasks 7,8. §8 testing → per-task ITs + Task 9 gate. **Gap closed:** add to Task 7 step 4a — for `current.type === 'plyo'` (weightless) hide the kg `CompactStepper` and log with `weightKg` omitted/0.

**Placeholder scan:** none — every step carries real code or an exact command.

**Type consistency:** `Prescription(sets, rationale)` used in Tasks 3–4; `prescribedAt`/`makeSession(recipe shape)` used in Tasks 6–7; `HypertrophyProperties.Ramp(pct, repsFactor)` used in Tasks 2–3; `findByCreatedByAndRepsNotNullAndKind` defined Task 5 step 3, used step 4. Consistent.
