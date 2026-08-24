# Volume Engine — Weekly Distribution + Volume Exemption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the volume engine distribute a muscle group's weekly set target across the mesocycle's whole template week instead of re-applying it every training day, and stop counting posture/plyo work as hypertrophy volume.

**Architecture:** One new persisted per-exercise boolean, `countsTowardVolume` (default `true`), flows through entity → template jsonb → OpenAPI contract → frontend. Four backend read paths (distribution, rollover signals, arc actuals, baseline seeding) filter on it. `WorkoutService.effectiveWorkingSets` keeps its base-1 + largest-remainder algorithm and its signature — only its **input** changes from today's exercises to the meso's whole template week.

**Tech Stack:** Spring Boot 3 / Java 21, Hibernate + Postgres (jsonb, Liquibase), MapStruct, OpenAPI-generated DTOs; React + TypeScript + Vitest on the frontend.

## Global Constraints

- Driving bd issue: **`mezo-gbo7`**. Every commit subject carries it: `feat(train): … (mezo-gbo7)`.
- Spec: [`docs/superpowers/specs/2026-08-24-volume-engine-weekly-distribution-design.md`](../specs/2026-08-24-volume-engine-weekly-distribution-design.md).
- Branch `feat/volume-weekly-distribution` already exists and holds the spec commit. Work on it; do not create another branch.
- Liquibase: script name and changeSet id suffix MUST be `{YYYYMMDDHHMM}_mezo-gbo7_{desc}` (12-digit UTC minute). Use `202608241200`. Enforced by `scripts/lint-liquibase.mjs`.
- Changesets are immutable once committed — if a later task needs a schema change, add a NEW script, never edit `202608241200_…`.
- Java name is `countsTowardVolume` everywhere (Lombok getter: `isCountsTowardVolume()`), DB column `counts_toward_volume`, contract + TS field `countsTowardVolume`. Do not invent variants.
- Backend tests are integration-first on Testcontainers Postgres, no mocks/H2 (`testing_standards.md`). Run focused tests locally; CI is the authoritative full-suite gate.
- Local backend runs need `-Dmezo.test.use-testcontainers=true` — the default fixed-DB mode races and produces fake failures.
- Frontend tests must pass in BOTH modes: `pnpm test` (mock) and `VITE_USE_MOCK=false pnpm test` (real).
- Do not touch the live database. This plan changes code only.

---

### Task 1: Persist the flag and backfill existing data

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608241200_mezo-gbo7_exercise_counts_toward_volume.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet at end of file)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseEntity.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseVolumeFlagIT.java`

**Interfaces:**
- Consumes: nothing.
- Produces: `ExerciseEntity.isCountsTowardVolume()` / `setCountsTowardVolume(boolean)`; DB column `exercise.counts_toward_volume boolean not null default true`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseVolumeFlagIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** mezo-gbo7: the per-exercise hypertrophy-volume exemption flag persists and defaults to true. */
class ExerciseVolumeFlagIT extends AbstractIntegrationTest {

    @Autowired TrainPopulator train;
    @Autowired ExerciseRepository exerciseRepository;

    @Test
    void testExercise_shouldDefaultToCountingTowardVolume_whenFlagNotSet() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Hét");

        ExerciseEntity saved = train.createExercise(owner, day.getId(), "Pull-Up", "back-wide", "compound");

        assertThat(saved.isCountsTowardVolume()).isTrue();
    }

    @Test
    void testExercise_shouldPersistFalse_whenExplicitlyExempted() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity exercise = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");

        exercise.setCountsTowardVolume(false);
        train.save(exercise);

        assertThat(exerciseRepository.findById(exercise.getId()).orElseThrow().isCountsTowardVolume()).isFalse();
    }
}
```

`TrainPopulator` API used here: `createActiveMeso(UUID)`, `createTemplateDay(UUID, UUID, String)`,
`createExercise(UUID, UUID, String name, String muscle, String type)`, `save(ExerciseEntity)`.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=ExerciseVolumeFlagIT test
```

Expected: FAIL — compilation error, `isCountsTowardVolume()` does not exist.

- [ ] **Step 3: Add the entity field**

In `ExerciseEntity.java`, directly after the `catalogId` field:

```java
    /**
     * Whether this exercise's sets count as hypertrophy volume (mezo-gbo7). False for the fix-zárás
     * closing block (posture/accessory work) and for plyometrics, so neither distorts the per-muscle
     * weekly set target nor consumes the group's budget. Read by WorkoutService.effectiveWorkingSets,
     * VolumeProgressionService's weekly signals, VolumeArcService's actuals and the baseline seeding.
     */
    @NotNull
    @Column(name = "counts_toward_volume", nullable = false)
    private boolean countsTowardVolume = true;
```

- [ ] **Step 4: Write the migration script**

Create `202608241200_mezo-gbo7_exercise_counts_toward_volume.sql`:

```sql
-- mezo-gbo7: per-exercise hypertrophy-volume exemption.
alter table exercise
    add column counts_toward_volume boolean not null default true;

-- Backfill 1/2 — live exercise rows. Plyometrics and the fix-zárás closing block
-- (mezo.closing-block slugs at the time of writing) are posture/power work, not volume.
update exercise
   set counts_toward_volume = false
 where type = 'plyo'
    or catalog_id in (select id from exercise_catalog
                       where slug in ('dead-hang', 'back-extension-45'));

-- Backfill 2/2 — stored plan documents. Without this a new run stamped from an existing
-- template would recreate counting closing/plyo rows and the defect would silently return.
update meso_template t
   set days = (
         select jsonb_agg(
                  case
                    when jsonb_typeof(d -> 'exercises') <> 'array' then d
                    else jsonb_set(d, '{exercises}', (
                           select coalesce(jsonb_agg(
                                    e || jsonb_build_object('countsTowardVolume',
                                          not coalesce(
                                                e ->> 'type' = 'plyo'
                                             or (e ->> 'catalogId') in (
                                                    select id::text from exercise_catalog
                                                     where slug in ('dead-hang', 'back-extension-45')),
                                                false))
                                    order by eord), '[]'::jsonb)
                             from jsonb_array_elements(d -> 'exercises') with ordinality as ex(e, eord)))
                  end
                order by dord)
           from jsonb_array_elements(t.days) with ordinality as dy(d, dord))
 where jsonb_typeof(t.days) = 'array';
```

The slugs are hardcoded on purpose: this is a point-in-time backfill, not live config reading. Future closing-block entries get the flag from `ClosingBlockService` (Task 3).

- [ ] **Step 5: Register the changeSet**

Append to the END of `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202608241200_mezo-gbo7_exercise_counts_toward_volume"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608241200_mezo-gbo7_exercise_counts_toward_volume.sql
```

- [ ] **Step 6: Run the tests and the migration linter**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=ExerciseVolumeFlagIT test
```

Expected: PASS (both tests).

```bash
node scripts/lint-liquibase.mjs
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseEntity.java backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseVolumeFlagIT.java
git commit -m "feat(train): persist per-exercise countsTowardVolume + backfill plyo/closing block (mezo-gbo7)"
```

---

### Task 2: Carry the flag through the plan document and the contract

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/json/GymExerciseJson.java`
- Modify: `api/feature/train/train.yml` (schemas `GymExercise`, `GymExerciseInput`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java` (only if MapStruct reports an unmapped property)
- Modify: `frontend/src/data/_client/api.gen.ts` (generated — do not hand-edit)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoTemplateVolumeFlagIT.java`

**Interfaces:**
- Consumes: `ExerciseEntity.isCountsTowardVolume()` (Task 1).
- Produces: `GymExerciseJson.countsTowardVolume()` returning a non-null `Boolean`; contract field `countsTowardVolume` on `GymExercise` and `GymExerciseInput`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoTemplateVolumeFlagIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * mezo-gbo7: a plan document written BEFORE the flag existed must still read back as counting,
 * so the migration and old jsonb both deserialize without nulls leaking into the volume math.
 */
class MesoTemplateVolumeFlagIT extends AbstractIntegrationTest {

    @Autowired ObjectMapper objectMapper;

    @Test
    void testGymExerciseJson_shouldDefaultToCounting_whenFieldAbsentFromStoredDocument() throws Exception {
        String legacy = """
            {"id":"0f6d6b4e-3f4a-4a1e-8f34-2b5f7f5d1c11","name":"Pull-Up","muscle":"back-wide",
             "warmupSets":2,"workingSets":3,"repMin":6,"repMax":8,"targetRir":0,
             "anchorWeightKg":null,"type":"compound","warning":null,"catalogId":null}
            """;

        GymExerciseJson parsed = objectMapper.readValue(legacy, GymExerciseJson.class);

        assertThat(parsed.countsTowardVolume()).isTrue();
    }

    @Test
    void testGymExerciseJson_shouldKeepFalse_whenDocumentExemptsTheExercise() throws Exception {
        String exempt = """
            {"id":"0f6d6b4e-3f4a-4a1e-8f34-2b5f7f5d1c12","name":"Dead Hang","muscle":"back-wide",
             "warmupSets":0,"workingSets":2,"repMin":45,"repMax":60,"targetRir":0,
             "anchorWeightKg":null,"type":"plyo","warning":null,"catalogId":null,
             "countsTowardVolume":false}
            """;

        assertThat(objectMapper.readValue(exempt, GymExerciseJson.class).countsTowardVolume()).isFalse();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=MesoTemplateVolumeFlagIT test
```

Expected: FAIL — `countsTowardVolume()` is not a component of `GymExerciseJson`.

- [ ] **Step 3: Add the record component with a compact-constructor default**

Replace the record body in `GymExerciseJson.java`:

```java
public record GymExerciseJson(
    UUID id,
    String name,
    String muscle,
    Integer warmupSets,
    Integer workingSets,
    Integer repMin,
    Integer repMax,
    Integer targetRir,
    Double anchorWeightKg,
    String type,
    String warning,
    UUID catalogId,
    Boolean countsTowardVolume
) {
    /**
     * Documents written before mezo-gbo7 carry no {@code countsTowardVolume}; Jackson hands us null
     * for them. Default it to TRUE here — on every construction path (mapper, hand-rolled rerun
     * materialization, Jackson) — so the volume math never has to null-check, mirroring the
     * coercion {@link MesoDayJson} applies to its own optional fields.
     */
    public GymExerciseJson {
        countsTowardVolume = countsTowardVolume == null || countsTowardVolume;
    }
}
```

- [ ] **Step 4: Extend the contract**

In `api/feature/train/train.yml`, add to the `GymExercise` schema's `properties` (after `catalogId`):

```yaml
        countsTowardVolume:
          type: boolean
          description: Whether this exercise's sets count as hypertrophy volume; false for the fix-zárás closing block and plyometrics (mezo-gbo7). Absent = true.
```

Add the identical block to `GymExerciseInput`'s `properties`. Do **not** add it to either schema's `required` list — absence must mean `true`.

- [ ] **Step 5: Regenerate the client and run the tests**

```bash
cd frontend && pnpm generate:api
```

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=MesoTemplateVolumeFlagIT test
```

Expected: PASS. If MapStruct fails the build with an unmapped-target-property error on `countsTowardVolume`, add the explicit `@Mapping(target = "countsTowardVolume", source = "countsTowardVolume")` to the affected methods in `TrainMapper.java` — the field name is identical on both sides, so no rename is needed.

- [ ] **Step 6: Commit**

```bash
git add api/feature/train/train.yml frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/train backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoTemplateVolumeFlagIT.java
git commit -m "feat(api): carry countsTowardVolume through the plan document and contract (mezo-gbo7)"
```

---

### Task 3: Set the flag correctly on creation

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ClosingBlockService.java` (the `closingExercise(...)` factory, ~line 111)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java` (~line 443, where `setWorkingSets(in.getWorkingSets())` writes an exercise from a `GymExerciseInput`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ClosingBlockVolumeFlagIT.java`

**Interfaces:**
- Consumes: `ExerciseEntity.setCountsTowardVolume(boolean)` (Task 1), `GymExerciseInput.getCountsTowardVolume()` (Task 2).
- Produces: closing-block rows always `false`; a `GymExerciseInput` with no explicit flag yields `false` for `type = "plyo"` and `true` otherwise.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/ClosingBlockVolumeFlagIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.service.ClosingBlockService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** mezo-gbo7: fix-zárás rows are posture work — they must never enter the volume model. */
class ClosingBlockVolumeFlagIT extends AbstractIntegrationTest {

    @Autowired ClosingBlockService closingBlockService;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired TrainPopulator train;

    @Test
    void testEnsureClosingExercises_shouldExemptAppendedRowsFromVolume() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createMesocycle(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Hét");
        train.createExercise(owner, day.getId(), "Pull-Up", "back-wide", "compound");

        closingBlockService.ensureClosingExercises(owner, meso.getId());

        List<ExerciseEntity> appended = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, List.of(day.getId()))
            .stream().filter(e -> !"Pull-Up".equals(e.getName())).toList();
        assertThat(appended).isNotEmpty();
        assertThat(appended).allSatisfy(e -> assertThat(e.isCountsTowardVolume()).isFalse());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=ClosingBlockVolumeFlagIT test
```

Expected: FAIL — appended rows carry the column default `true`.

- [ ] **Step 3: Set the flag on both creation paths**

In `ClosingBlockService.closingExercise(...)`, next to `e.setWorkingSets(r.config().workingSets())`:

```java
        e.setCountsTowardVolume(false); // posture/accessory work — never hypertrophy volume (mezo-gbo7)
```

In `TrainService`, next to `e.setWorkingSets(in.getWorkingSets())`:

```java
        // mezo-gbo7: absent flag means "counts", except plyo which defaults to exempt.
        e.setCountsTowardVolume(in.getCountsTowardVolume() != null
            ? in.getCountsTowardVolume()
            : !"plyo".equals(in.getType() == null ? null : in.getType().getValue()));
```

If `GymExerciseInput.getType()` is a plain `String` rather than an enum wrapper, drop the `.getValue()` and compare directly — check the generated DTO before writing this line.

- [ ] **Step 4: Run the tests**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='ClosingBlockVolumeFlagIT,ClosingBlock*IT' test
```

Expected: PASS, and no regression in the existing closing-block tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service backend/src/test/java/io/mrkuhne/mezo/feature/train/ClosingBlockVolumeFlagIT.java
git commit -m "feat(train): exempt closing-block and plyo rows from volume on creation (mezo-gbo7)"
```

---

### Task 4: Distribute the weekly target across the whole template week

This is the defect the spec exists for. Everything else supports it.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java` (the `effectiveSets` block in `getToday`, ~lines 188-199; the `effectiveWorkingSets` method, ~lines 352-420)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeEffectiveSetsIT.java` (add two tests)

**Interfaces:**
- Consumes: `ExerciseEntity.isCountsTowardVolume()` (Task 1).
- Produces: no signature change — `effectiveWorkingSets(List<ExerciseEntity>, List<MuscleGroupVolumeLogEntity>)` keeps its shape; callers now pass the week's template exercises.

- [ ] **Step 1: Write the failing tests**

Append to `VolumeEffectiveSetsIT`:

```java
    @Test
    void testGetToday_shouldSpreadTargetAcrossTheWeek_whenGroupIsTrainedOnTwoDays() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        String otherLabel = "Hét".equals(todayLabel) ? "Kedd" : "Hét";

        var today = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity press = train.createExercise(owner, today.getId(), "Fekvenyomás", "chest", "compound");
        press.setWorkingSets(3);
        train.save(press);

        var other = train.createTemplateDay(owner, meso.getId(), otherLabel);
        ExerciseEntity flye = train.createExercise(owner, other.getId(), "Cable Flye", 1, "chest", "isolation", null);
        flye.setWorkingSets(3);
        train.save(flye);

        train.createVolumeLog(owner, meso.getId(), "chest", 10);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        // The WEEK's two chest exercises share currentSets(10): base 1/1, remaining 8 split 4/4.
        // Before mezo-gbo7 today's lone exercise absorbed all 10 and the week totalled 20.
        assertThat(byId(res, press.getId()).getWorkingSets()).isEqualTo(5);
    }

    @Test
    void testGetToday_shouldKeepTemplateSets_whenExerciseIsExemptFromVolume() {
        UUID owner = ownerId();
        MesocycleEntity meso = pinnedActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);

        ExerciseEntity row = train.createExercise(owner, day.getId(), "Csónakázás", "back-mid", "compound");
        row.setWorkingSets(3);
        train.save(row);
        ExerciseEntity hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setWorkingSets(2);
        hang.setCountsTowardVolume(false);
        train.save(hang);

        train.createVolumeLog(owner, meso.getId(), "back", 10);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        // The exempt hang keeps its template 2 and is absent from the distribution, so the whole
        // back target lands on the one counting exercise.
        assertThat(byId(res, hang.getId()).getWorkingSets()).isEqualTo(2);
        assertThat(byId(res, row.getId()).getWorkingSets()).isEqualTo(10);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=VolumeEffectiveSetsIT test
```

Expected: FAIL — the first asserts 5 but gets 10 (today-only distribution); the second asserts 2 but gets a distributed value.

- [ ] **Step 3: Feed the method the week instead of the day**

In `getToday`, replace the `effectiveSets` block:

```java
        Map<UUID, Integer> effectiveSets = Map.of();
        if (activeMeso != null && volumeGate.getIfAvailable() != null) {
            List<MuscleGroupVolumeLogEntity> logs = muscleGroupVolumeLogRepository
                .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(activeMeso.getId()));
            if (!logs.isEmpty()) {
                effectiveSets = effectiveWorkingSets(weekTemplateExercises(createdBy, activeMeso.getId()), logs);
            }
        }
```

Add the loader next to `effectiveWorkingSets`:

```java
    /**
     * Every TEMPLATE day's exercises for the meso — the unit the weekly volume target is
     * distributed over (mezo-gbo7). Instances are excluded (they carry a templateSessionId);
     * exercises hang off the template row, never off the instance.
     */
    private List<ExerciseEntity> weekTemplateExercises(UUID createdBy, UUID mesocycleId) {
        List<UUID> templateDayIds = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesocycleId)).stream()
            .filter(s -> s.getTemplateSessionId() == null)
            .map(WorkoutSessionEntity::getId)
            .toList();
        return templateDayIds.isEmpty()
            ? List.of()
            : exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, templateDayIds);
    }
```

- [ ] **Step 4: Filter exempt rows inside the distributor**

In `effectiveWorkingSets`, replace the grouping line:

```java
        Map<String, List<ExerciseEntity>> byGroup = exercises.stream()
            .filter(ExerciseEntity::isCountsTowardVolume) // mezo-gbo7: posture/plyo work is not volume
            .collect(Collectors.groupingBy(e -> MuscleGroup.of(e.getMuscle())));
```

Then update the method's Javadoc — it currently says "today's exercises of that group". Replace that sentence with:

```java
     * a muscle group's volume-log {@code currentSets} distributed across the MESO WEEK's
     * counting exercises of that group (mezo-gbo7 — distributing it per day multiplied weekly
     * volume by training frequency), proportional to each exercise's template {@code workingSets}.
     * Base-1 + largest-remainder: every counting exercise gets a floor of 1 set, then the rest of
     * the target is handed out proportionally, so {@code sum(effective) == currentSets} exactly
     * whenever {@code currentSets >= the week's counting-exercise count}. Below that every
     * exercise still gets its floor of 1, so the weekly sum can only exceed the target, never fall
     * short. Exempt exercises and groups with no log row are absent from the returned map — the
     * caller falls back to the template {@code workingSets}.
```

- [ ] **Step 5: Run the tests**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='VolumeEffectiveSetsIT,VolumeEffectiveSetsSwitchOffIT,WorkoutServiceIT' test
```

Expected: PASS. The two pre-existing distribution tests stay green because their fixtures use a single template day, where the week and the day are the same set.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeEffectiveSetsIT.java
git commit -m "fix(train): distribute the weekly set target across the meso week, not per day (mezo-gbo7)"
```

---

### Task 5: Keep exempt work out of the rollover signals

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeProgressionService.java` (`lastWeekSignals`, the set loop ~lines 190-207)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeProgressionServiceIT.java`

**Interfaces:**
- Consumes: `ExerciseEntity.isCountsTowardVolume()` (Task 1).
- Produces: `loggedLastWeek` and `grind` reflect only counting exercises.

- [ ] **Step 1: Write the failing test**

Append to `VolumeProgressionServiceIT`. It reuses the class's existing `reload(meso)` helper and the
populator calls `activeMesoStartedWeeksAgo`, `createWorkoutSession`, `createExercise`,
`createWorkoutInstance`, `createLoggedSet` — the same chain `completedChestSetsInWeek` uses
internally, spelled out here because we need a `back` group and an exempt exercise:

```java
    @Test
    void testRollover_shouldIgnoreExemptExercises_whenCountingLastWeeksVolume() {
        UUID owner = ownerId();
        // calWeek 3 (started 2 weeks ago); back target sits at 10 with MRV headroom.
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        train.createVolumeLog(owner, meso.getId(), "back", 10);

        // Week 2 logs 10 working sets — but ONLY on an exempt exercise (the fix-zárás hang).
        var day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "planned");
        var hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setTargetRir(0);
        hang.setCountsTowardVolume(false);
        train.save(hang);
        var instance = train.createWorkoutInstance(
            owner, day, meso.getStartDate().plusWeeks(1), "completed");
        for (int i = 0; i < 10; i++) {
            train.createLoggedSet(owner, hang.getId(), instance.getId(), i, "0", 45, 0);
        }

        svc.rolloverIfDue(owner, reload(meso));

        // No COUNTING volume last week -> target not hit -> HOLD at 10.
        // Before mezo-gbo7 the hang's 10 sets read as a hit target and ramped to 12.
        assertThat(backLog(owner, meso.getId()).getCurrentSets()).isEqualTo(10);
    }

    private MuscleGroupVolumeLogEntity backLog(UUID owner, UUID mesoId) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(mesoId))
            .stream().filter(r -> "back".equals(r.getMuscle())).findFirst().orElseThrow();
    }
```

If the class already has a generic log-lookup helper alongside `chestLog`, use it instead of adding
`backLog`.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=VolumeProgressionServiceIT test
```

Expected: FAIL — exempt sets count, the target reads as hit, `currentSets` ramps to 12.

- [ ] **Step 3: Skip exempt exercises in the signal loop**

In `lastWeekSignals`, immediately after the existing null-guard on the resolved exercise:

```java
                ExerciseEntity exercise = exercisesById.get(s.getExerciseId());
                if (exercise == null || !exercise.isCountsTowardVolume()) {
                    continue; // mezo-gbo7: posture/plyo sets are not hypertrophy volume
                }
```

This single guard covers both signals: it stops the `loggedLastWeek.merge(...)` and stops the exercise ever reaching `latestRirByExercise`, so a hard-ground closing exercise can no longer flag `grind` for the group.

- [ ] **Step 4: Run the tests**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=VolumeProgressionServiceIT test
```

Expected: PASS, existing tests included.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeProgressionService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeProgressionServiceIT.java
git commit -m "fix(train): exclude exempt exercises from the weekly volume signals (mezo-gbo7)"
```

---

### Task 6: Keep exempt work out of the volume arc's actuals

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseSetRepository.java` (the `aggregateWorkingSetsByMuscleAndDate` JPQL, ~lines 87-97)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeArcVolumeFlagIT.java`

**Interfaces:**
- Consumes: `ExerciseEntity.countsTowardVolume` (Task 1).
- Produces: `aggregateWorkingSetsByMuscleAndDate` returns counting sets only; `VolumeArcService` needs no change.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeArcVolumeFlagIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.feature.train.service.VolumeArcService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** mezo-gbo7: the arc's actual bars must aggregate hypertrophy volume only. */
class VolumeArcVolumeFlagIT extends AbstractIntegrationTest {

    @Autowired VolumeArcService volumeArcService;
    @Autowired TrainPopulator train;

    @Test
    void testArc_shouldCountOnlyVolumeBearingSets_whenTheWeekIncludesClosingBlockWork() {
        UUID owner = ownerId();
        var meso = train.activeMesoStartedWeeksAgo(
            owner, 0, 6, 1, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        train.createVolumeLog(owner, meso.getId(), "back", 10);

        var day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "planned");
        var row = train.createExercise(owner, day.getId(), "Csónakázás", "back-mid", "compound");
        var hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setCountsTowardVolume(false);
        train.save(hang);

        var instance = train.createWorkoutInstance(owner, day, meso.getStartDate(), "completed");
        for (int i = 0; i < 3; i++) {
            train.createLoggedSet(owner, row.getId(), instance.getId(), i, "60", 8, 1);
        }
        for (int i = 0; i < 2; i++) {
            train.createLoggedSet(owner, hang.getId(), instance.getId(), 3 + i, "0", 45, 0);
        }

        MuscleVolumeArc back = volumeArcService.arc(owner, meso.getId()).getMuscles().stream()
            .filter(m -> "back".equals(m.getMuscle())).findFirst().orElseThrow();

        // 3 counting sets, not 5 — the hang's two sets are posture work.
        assertThat(back.getWeeks().get(0).getActual()).isEqualTo(3);
    }
}
```

If `VolumeArcService.arc(UUID, UUID)` is package-private, this test's package already matches
(`io.mrkuhne.mezo.feature.train` vs the service's `…train.service`) — in that case call it through
`TrainController`/the public service method the contract IT uses, or widen nothing and instead
assert via `VolumeArcContractIT`'s HTTP path. Check the modifier before writing the test.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=VolumeArcVolumeFlagIT test
```

Expected: FAIL — actual is 5, not 3.

- [ ] **Step 3: Filter in the query**

In `ExerciseSetRepository`, add one predicate to the JPQL:

```java
        SELECT e.muscle AS muscle, w.date AS date, COUNT(s) AS sets
        FROM ExerciseSetEntity s, ExerciseEntity e, WorkoutSessionEntity w
        WHERE s.createdBy = :createdBy
          AND s.exerciseId = e.id
          AND s.workoutSessionId = w.id
          AND w.mesocycleId = :mesoId
          AND w.status = 'completed'
          AND s.kind = 'working'
          AND s.skipped = false
          AND s.reps IS NOT NULL
          AND e.countsTowardVolume = true
        GROUP BY e.muscle, w.date
```

- [ ] **Step 4: Run the tests**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='VolumeArcVolumeFlagIT,MesocycleReportServiceIT' test
```

Expected: PASS. `MesocycleReportServiceIT` runs too because the report freezes the same arc.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseSetRepository.java backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeArcVolumeFlagIT.java
git commit -m "fix(train): count only volume-bearing sets in the arc's actuals (mezo-gbo7)"
```

---

### Task 7: Do not seed a target a group cannot spend

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeProgressionService.java` (`seedBaselines`, ~lines 87-90)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeBaselineSeedIT.java`

**Interfaces:**
- Consumes: `ExerciseEntity.isCountsTowardVolume()` (Task 1).
- Produces: `seedBaselines` creates rows only for groups with ≥1 counting exercise.

- [ ] **Step 1: Write the failing test**

Append to `VolumeBaselineSeedIT`:

```java
    @Test
    void testSeedBaselines_shouldSkipGroup_whenAllItsExercisesAreExemptFromVolume() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createMesocycle(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity hang = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        hang.setCountsTowardVolume(false);
        train.save(hang);
        train.createExercise(owner, day.getId(), "Fekvenyomás", "chest-mid", "compound");

        volumeProgressionService.seedBaselines(owner, meso.getId());

        assertThat(volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(meso.getId())))
            .extracting(MuscleGroupVolumeLogEntity::getMuscle)
            .containsExactly("chest");
    }
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=VolumeBaselineSeedIT test
```

Expected: FAIL — a `back` row is seeded too.

- [ ] **Step 3: Filter the trained-group scan**

In `seedBaselines`:

```java
        SortedSet<String> trained = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, templateIds).stream()
            .filter(ExerciseEntity::isCountsTowardVolume) // mezo-gbo7: no target without volume work
            .map(e -> MuscleGroup.of(e.getMuscle()))
            .collect(Collectors.toCollection(TreeSet::new));
```

- [ ] **Step 4: Run the tests**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=VolumeBaselineSeedIT test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeProgressionService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeBaselineSeedIT.java
git commit -m "fix(train): seed volume baselines only for groups with counting work (mezo-gbo7)"
```

---

### Task 8: Teach the frontend budget and lint the same rule

**Files:**
- Modify: `frontend/src/data/types.ts` (`GymExercise`)
- Modify: `frontend/src/features/train/logic/setBudget.ts`
- Modify: `frontend/src/features/train/logic/structureLint.ts`
- Modify: `frontend/src/features/train/components/SetBudgetCard.tsx`
- Modify: `frontend/src/features/train/components/DayBreakdownCard.tsx`
- Test: `frontend/src/features/train/logic/setBudget.test.ts`, `frontend/src/features/train/logic/structureLint.test.ts`

**Interfaces:**
- Consumes: contract field `countsTowardVolume` (Task 2).
- Produces: exported `countsForVolume(ex: { countsTowardVolume?: boolean; type: ExerciseKind }): boolean` from `setBudget.ts`; `MuscleBudgetRow.exemptSets` replaces `plyoSets`.

- [ ] **Step 1: Write the failing tests**

Add to `setBudget.test.ts`:

```ts
test('an exempt exercise is reported separately and never enters the budget', () => {
  const days = [{
    day: 'Hét', type: 'Pull', muscle: 'back', exerciseCount: 2,
    exercises: [
      { id: 'a', name: 'Pull-Up', muscle: 'back-wide', warmupSets: 2, workingSets: 3,
        repMin: 6, repMax: 8, targetRIR: 0, type: 'compound' as const },
      { id: 'b', name: '45° Back Extension', muscle: 'back-lower', warmupSets: 0, workingSets: 2,
        repMin: 12, repMax: 15, targetRIR: 2, type: 'isolation' as const, countsTowardVolume: false },
    ],
  }]
  const back = muscleBudgets(days)[0]
  expect(back.workingSets).toBe(3)
  expect(back.exemptSets).toBe(2)
})

test('a plyo exercise with no explicit flag still stays out of the budget', () => {
  const days = [{
    day: 'Kedd', type: 'Legs', muscle: 'quad', exerciseCount: 1,
    exercises: [
      { id: 'c', name: 'Box Jump', muscle: 'quad', warmupSets: 0, workingSets: 2,
        repMin: 6, repMax: 10, targetRIR: 0, type: 'plyo' as const },
    ],
  }]
  expect(muscleBudgets(days)).toHaveLength(0)
})
```

The second test pins the compatibility rule: mock fixtures and pre-migration rows carry no flag, and a flagless plyo must keep behaving as it does today.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm vitest run src/features/train/logic/setBudget.test.ts
```

Expected: FAIL — `exemptSets` does not exist.

- [ ] **Step 3: Add the field and the shared predicate**

In `frontend/src/data/types.ts`, inside `GymExercise` after `catalogId`:

```ts
  countsTowardVolume?: boolean  // false = posture/plyo work, outside the hypertrophy budget (mezo-gbo7)
```

In `setBudget.ts`, widen the existing type import to bring in `ExerciseKind`:

```ts
import type { ExerciseKind, MesoDay } from '@/data/types'
```

then export the predicate and use it:

```ts
/**
 * Does this exercise's work count as hypertrophy volume? The server sets the flag explicitly
 * (false for the fix-zárás closing block and plyo). When it is absent — mock fixtures, plans
 * written before mezo-gbo7 — fall back to the old rule so behaviour is unchanged.
 */
export function countsForVolume(ex: { countsTowardVolume?: boolean; type: ExerciseKind }): boolean {
  return ex.countsTowardVolume ?? ex.type !== 'plyo'
}
```

Replace the accumulation guard in `muscleBudgets`:

```ts
      if (!countsForVolume(ex)) { row.exemptSets += ex.workingSets; continue }
```

Rename `plyoSets` to `exemptSets` in the `MuscleBudgetRow` interface, its initializer, and its doc comment ("Sets that do not count toward the budget — reported separately for visibility.").

- [ ] **Step 4: Update the card and the lint**

In `SetBudgetCard.tsx`, replace the plyo chip:

```tsx
                      {row.exemptSets > 0 && <span style={{ color: 'var(--text-tertiary)' }}> +{row.exemptSets} kiegészítő</span>}
```

Three plyo guards remain, in two files. Replace each `ex.type === 'plyo'` test with `!countsForVolume(ex)`:

- `setBudget.ts` — `sessionCapWarnings` (the per-day per-group tally) and `daySessionBreakdown` (which splits `sets` from `plyoSets`; rename that row field to `exemptSets` too, and update `DayGroupRow` plus `DayBreakdownCard.tsx` where it renders).
- `structureLint.ts` — the guard at the top of the per-exercise loop. Import `countsForVolume` from `@/features/train/logic/setBudget`, which this file already imports `BUDGET_GROUP_LABELS`/`budgetGroup` from.

Two rules must NOT change: **session size** (`const size = d.exercises.length`) keeps counting every exercise, because a closing exercise is still a real session slot; and **session length** (`estimateSessionMinutes(d.exercises)`) keeps its full list, because exempt work still takes gym time. The sets-per-exercise band check sits inside the per-exercise loop after the guard, so it stops firing on exempt rows automatically.

- [ ] **Step 5: Run the frontend tests in both modes**

```bash
cd frontend && pnpm test
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm test
```

Expected: PASS in both. `pnpm test` alone runs mock mode twice in a worktree — the real-mode run is the one that exercises the contract path, so do not skip it.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/features/train
git commit -m "feat(train): budget and structure lint read countsTowardVolume (mezo-gbo7)"
```

---

### Task 9: Let the user set the flag, and stop the editor from dropping it

**Files:**
- Modify: `frontend/src/features/train/logic/mesoDays.ts:33-35`
- Modify: `frontend/src/features/train/components/MesoExercises.tsx:31-34`
- Modify: `frontend/src/features/train/components/ExerciseRecipeRow.tsx`
- Modify: `frontend/src/features/train/components/ExerciseAccordionRow.tsx`
- Test: `frontend/src/features/train/logic/mesoDays.test.ts`

**Interfaces:**
- Consumes: `GymExercise.countsTowardVolume` (Task 8).
- Produces: the flag survives a save round-trip; both editor rows expose a toggle.

- [ ] **Step 1: Write the failing test**

Add to `mesoDays.test.ts`:

```ts
test('toDayInputs carries countsTowardVolume so the toggle survives a save', () => {
  const inputs = toDayInputs([{
    day: 'Hét', type: 'Pull', muscle: 'back', exerciseCount: 1,
    exercises: [
      { id: 'x', name: 'Dead Hang', muscle: 'back-wide', warmupSets: 0, workingSets: 2,
        repMin: 45, repMax: 60, targetRIR: 0, type: 'plyo', countsTowardVolume: false },
    ],
  }])
  expect(inputs[0].exercises?.[0].countsTowardVolume).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/train/logic/mesoDays.test.ts
```

Expected: FAIL — the property is `undefined`, silently dropped by the explicit field list.

- [ ] **Step 3: Add the field to BOTH enumerations**

In `mesoDays.ts` and in `MesoExercises.tsx`'s `persistDay`, extend the identical object literal:

```ts
      anchorWeightKg: e.anchorWeightKg, type: e.type, warning: e.warning, catalogId: e.catalogId,
      countsTowardVolume: e.countsTowardVolume,
```

Both must change. Missing one leaves a save path that silently resets the toggle.

- [ ] **Step 4: Add the toggle to both editor rows**

In `ExerciseRecipeRow.tsx`, import `countsForVolume` from `@/features/train/logic/setBudget` (Task 8) and add, next to the existing `AnchorStepper`:

```tsx
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            aria-label={`${ex.name} · számít a volumenbe`}
            checked={countsForVolume(ex)}
            onChange={(e) => onChange({ countsTowardVolume: e.target.checked })}
          />
          Számít a volumenbe
        </label>
```

Add the same block to `ExerciseAccordionRow.tsx` beside its `AnchorTile`. Follow each file's own styling idiom rather than copying the inline styles verbatim if the file uses shared classes.

- [ ] **Step 5: Run the frontend tests in both modes and build**

```bash
cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Expected: all PASS, build clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train
git commit -m "feat(train): per-exercise volume toggle in the meso editor (mezo-gbo7)"
```

---

### Task 10: Documentation, generated artifacts, and the full gate

**Files:**
- Modify: `docs/features/train.md` (the DA6 bullet, ~line 236, and the volume-progression section ~line 199)
- Modify: `docs/CODEMAP.md` (regenerated)
- Test: the whole suite

**Interfaces:**
- Consumes: everything above.
- Produces: a PR-ready branch.

- [ ] **Step 1: Update the feature doc**

In `docs/features/train.md`, the DA6 bullet currently reads "distributes each muscle group's `currentSets` across **today's** same-group exercises". Rewrite that sentence:

```markdown
- **Effective per-exercise working sets (same `getToday` call, DA6):** once the rollover has run (or on a week where it was already up to date), and only when the switch is on and the meso has volume-log rows, `WorkoutService.effectiveWorkingSets` distributes each muscle group's `currentSets` across **the meso template week's** same-group exercises that carry `countsTowardVolume` — proportional to each exercise's template `workingSets`, remainder to the largest, never below 1 — and this **derived** count overrides `TodayExercise.workingSets` (the template row itself is untouched). Distributing per DAY (the pre-`mezo-gbo7` behaviour) multiplied weekly volume by training frequency and broke the spec's `[MEV, MRV]` bound. Exempt exercises — the fix-zárás closing block and plyometrics — keep their template `workingSets` and are excluded from the rollover signals, the arc's actuals and baseline seeding.
```

- [ ] **Step 2: Regenerate the codemap**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 3: Run the doc and contract linters**

```bash
node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs
```

Expected: no errors.

- [ ] **Step 4: Run the focused backend suite**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='Volume*IT,Workout*IT,ClosingBlock*IT,MesoTemplate*IT,Exercise*IT' test
```

Expected: PASS. Focused runs skip ArchUnit and codemap checks — CI covers those, which is why Steps 2-3 exist.

- [ ] **Step 5: Commit and push**

```bash
git add docs/
git commit -m "docs(train): weekly volume distribution + volume exemption (mezo-gbo7)"
git push -u origin feat/volume-weekly-distribution
```

- [ ] **Step 6: Open the PR and wait for CI**

```bash
gh pr create --fill --title "fix(train): weekly volume distribution + per-exercise volume exemption (mezo-gbo7)"
```

Wait for CI green — it is the authoritative full-suite gate (full backend IT suite, FE both modes, lint, contract-drift). Only then merge locally with `--no-ff` and push `main`, per the repo's git workflow.

- [ ] **Step 7: Close the issue**

```bash
bd close mezo-gbo7
```

`mezo-dq60` (the builder's automatic set-filling) unblocks once this lands.

---

## Notes for the implementer

**Why the two pre-existing distribution tests stay green.** `VolumeEffectiveSetsIT`'s original cases build a single template day, so "the week" and "today" are the same exercise set and the arithmetic is unchanged. If you find yourself editing those expectations, you have changed the algorithm rather than its input — go back and re-read Task 4.

**The flag's absent-means-what rule differs by layer, on purpose.** On the backend the column is `not null default true`, so absence cannot happen after Task 1. In stored jsonb and on the frontend, absence is real: the backend coerces null to `true` (Task 2), while the frontend falls back to `type !== 'plyo'` (Task 8) so mock fixtures and legacy plans keep behaving exactly as they do now. Do not "simplify" the frontend to `?? true` — that silently changes mock-mode budgets.

**Do not touch the running mesocycle.** The migration's backfill handles live data. No manual SQL against the live database is part of this plan.
