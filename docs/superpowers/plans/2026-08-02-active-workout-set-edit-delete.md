# Active-workout set edit + slot delete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During an active workout, let the user tap any set row to edit its logged values or delete the set — where deleting also removes the slot (4 planned → 3), with a floor of one slot per exercise.

**Architecture:** Contract-first. Two new endpoints (`PUT`/`DELETE /api/train/workouts/{id}/sets/{setId}`) on the existing active-instance guards; the server renumbers the exercise's remaining `setIndex`es after a delete so the frontend's positional cursor model stays gap-free. On the frontend the pure `workoutState` session model grows a `removed` counter plus edit/remove/attach-id operations, a new `SetEditSheet` reuses the existing `SetStepper` inputs, and `ActiveWorkoutPage` turns each read-only set row into a button that opens it.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven / Postgres · React 19 / Vite / TanStack Query / vitest + MSW · OpenAPI 3 contract in `api/feature/train/train.yml`.

**Driving spec:** [`docs/superpowers/specs/2026-08-02-active-workout-set-edit-delete-design.md`](../specs/2026-08-02-active-workout-set-edit-delete-design.md) · **bd:** `mezo-l3on` · **branch:** `feat/set-edit-delete`

## Global Constraints

- **Working directory is the worktree `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-4`.** Verify with `git rev-parse --show-toplevel` before committing. NEVER touch `/Users/daniel.kuhne/MrKuhne/mezo` (the main checkout).
- **Commits:** `git add <explicit paths>` + `git commit --no-verify` only. Never `git add -A` (a beads hook force-stages a stray root `issues.jsonl`).
- **Never run the full backend suite** (`./mvnw clean test` with no `-Dtest`) — this 16 GB machine OOMs on it; CI is the authoritative gate. Always use `clean` with a focused `-Dtest=...`.
- **Run every build/test command in the FOREGROUND with an explicit `timeout: 900000`.** Never `run_in_background`, never `Monitor`, never chain two long commands with `&&`.
- **After any backend run:** `git status --short` and check `backend/src/test/resources/archunit-store/` — if it shows as modified, `git checkout -- backend/src/test/resources/archunit-store/`; never commit it. A concurrent IDE Java language server can also produce compile errors in files you never touched (`ActivityController`, `ActivityClassifier`, missing Lombok builders) — re-run the identical command once before believing it; never "fix" unrelated files.
- **Vitest CLI filters are substring matches, not regex** — pass plain substrings (`SetEditSheet`), never escaped patterns.
- **Hungarian UI copy, English code/comments/commits.** Conventional commit subjects carry the bd id: `feat(train): … (mezo-l3on)`.
- **Do NOT write to the coordinator's ledger** (`.superpowers/sdd/**/progress.md`) and do NOT run `pnpm test:visual` or regenerate Playwright goldens — the coordinator owns both.
- **Frontend house rules** (`docs/references/frontend_conventions.md`): deep absolute `@/*` imports, no barrels except `@/data/hooks`, modals live in `features/<domain>/sheets/`, tests colocated.
- **Backend house rules:** constructor DI via `@RequiredArgsConstructor`, `@Transactional` on service methods only, errors via `SystemRuntimeErrorException` + `SystemMessage`, no hardcoded user-facing text.

---

### Task 1: API contract + regeneration

**Files:**
- Modify: `api/feature/train/train.yml` (add the `/sets/{setId}` path item after the existing `/api/train/workouts/{id}/sets` block, and the `SetUpdateRequest` schema next to `SetLogRequest`)
- Regenerated (do not hand-edit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `operationId: updateWorkoutSet` / `deleteWorkoutSet` on the generated `TrainApi` Java interface; `components['schemas']['SetUpdateRequest']` in `api.gen.ts`.

- [ ] **Step 1: Add the path item to `api/feature/train/train.yml`**

Insert immediately after the existing `/api/train/workouts/{id}/sets:` block (which ends with its `'409'` response) and before `/api/train/workouts/{id}/feedback:`:

```yaml
  /api/train/workouts/{id}/sets/{setId}:
    put:
      tags: [Train]
      operationId: updateWorkoutSet
      summary: Overwrite the performance fields of one logged set in an ACTIVE workout instance
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: setId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SetUpdateRequest'
      responses:
        '200':
          description: The updated set with its re-derived medals
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExerciseSetResponse'
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
        '404':
          description: Set not found, not owned, not in this instance, or a skip marker
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '409':
          description: Workout already completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
    delete:
      tags: [Train]
      operationId: deleteWorkoutSet
      summary: Soft-delete one logged set and renumber the exercise's remaining setIndexes
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: setId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: Set deleted
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '404':
          description: Set not found, not owned, not in this instance, or a skip marker
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '409':
          description: Workout already completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

- [ ] **Step 2: Add the `SetUpdateRequest` schema**

In the same file, immediately after the `SetLogRequest:` schema block (it ends with the `kind:` property), at the same indentation as `SetLogRequest:`:

```yaml
    SetUpdateRequest:
      type: object
      description: >-
        Full replacement of one logged set's performance fields (mezo-l3on). Deliberately NOT a
        partial patch — an absent optional field CLEARS it, which avoids the JSON null vs. missing
        tri-state. setIndex, kind, exerciseId and the target* prescription snapshot are immutable.
      required:
        - weightKg
        - reps
      properties:
        weightKg:
          type: number
          minimum: 0
          maximum: 999
        reps:
          type: integer
          minimum: 1
          maximum: 100
        rir:
          type: integer
          minimum: 0
          maximum: 5
          nullable: true
          description: Ignored (forced null) on a warmup set — effort tracking is working-set-only
        side:
          type: string
          pattern: '^[LBR]$'
        note:
          type: string
          maxLength: 500
```

- [ ] **Step 3: Merge the contract and regenerate the frontend types**

Run as two separate foreground calls (`timeout: 900000`):

```bash
cd api/generate && npm run generate:api
```

```bash
cd frontend && pnpm generate:api
```

- [ ] **Step 4: Verify the generated artifacts carry the new operations**

```bash
grep -c "updateWorkoutSet\|deleteWorkoutSet" api/openapi.yml
grep -c "SetUpdateRequest" frontend/src/data/_client/api.gen.ts
```

Expected: both counts ≥ 1. If `api.gen.ts` has no `SetUpdateRequest`, the merge step did not pick up the fragment — re-check indentation in `train.yml`.

- [ ] **Step 5: Verify the backend generator accepts the contract**

```bash
cd backend && ./mvnw -q clean generate-sources
```

Expected: BUILD SUCCESS. Then confirm the interface methods exist:

```bash
grep -n "updateWorkoutSet\|deleteWorkoutSet" backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/TrainApi.java | head
```

- [ ] **Step 6: Commit**

```bash
git add api/feature/train/train.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit --no-verify -m "feat(api): PUT/DELETE one logged workout set (mezo-l3on)"
```

---

### Task 2: Backend — update + delete a logged set

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java` (add two `@Transactional` methods + one private guard helper next to `logSet`, ~line 485)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java` (two `@Override`s next to `logWorkoutSet`, ~line 221)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutSetMutationIT.java`

**Interfaces:**
- Consumes: `updateWorkoutSet(UUID id, UUID setId, SetUpdateRequest)` / `deleteWorkoutSet(UUID id, UUID setId)` from the generated `TrainApi` (Task 1); the existing `ExerciseSetRepository.findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(...)` (already present — do NOT add a new query).
- Produces: `WorkoutService.updateSet(UUID createdBy, UUID workoutId, UUID setId, SetUpdateRequest req) -> ExerciseSetResponse` and `WorkoutService.deleteSet(UUID createdBy, UUID workoutId, UUID setId) -> void`.

- [ ] **Step 1: Write the failing integration test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutSetMutationIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.SetUpdateRequest;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutSkipRequest;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** PUT/DELETE on a single logged set of an ACTIVE instance (mezo-l3on). */
class WorkoutSetMutationIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private WorkoutSessionEntity templateDayForToday(UUID owner) {
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Set-mutation meso", "active");
        return trainPopulator.createWorkoutSession(
            owner, meso.getId(), WorkoutServiceIT.todayLabel(), "Pull Day", 0, "planned");
    }

    private WorkoutInstanceResponse start(WorkoutSessionEntity template, HttpHeaders headers) {
        return postForBody("/api/train/workouts",
            WorkoutStartRequest.builder().templateSessionId(template.getId()).build(),
            headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);
    }

    private ExerciseSetResponse logSet(
        UUID workoutId, UUID exerciseId, int setIndex, String weight, int reps, HttpHeaders headers
    ) {
        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(exerciseId).setIndex(setIndex)
            .weightKg(new BigDecimal(weight)).reps(reps).rir(2).build();
        return postForBody("/api/train/workouts/" + workoutId + "/sets",
            req, headers, HttpStatus.CREATED, ExerciseSetResponse.class);
    }

    private static SetUpdateRequest update(String weight, int reps, Integer rir) {
        return SetUpdateRequest.builder()
            .weightKg(new BigDecimal(weight)).reps(reps).rir(rir).build();
    }

    @Test
    void testUpdateSet_shouldOverwritePerformanceFields_whenOwnedActiveInstance() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        ExerciseSetResponse logged = logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);

        ExerciseSetResponse updated = putForBody(
            "/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            update("82.5", 8, 1), headers, HttpStatus.OK, ExerciseSetResponse.class);

        assertThat(updated.getId()).isEqualTo(logged.getId());
        assertThat(updated.getWeightKg()).isEqualByComparingTo(new BigDecimal("82.5"));
        assertThat(updated.getReps()).isEqualTo(8);
        assertThat(updated.getRir()).isEqualTo(1);
        // Immutable fields survive the overwrite.
        assertThat(updated.getSetIndex()).isEqualTo(0);
        assertThat(updated.getKind()).isEqualTo(ExerciseSetResponse.KindEnum.WORKING);
    }

    @Test
    void testUpdateSet_shouldForceNullRir_whenWarmupSet() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        SetLogRequest warm = SetLogRequest.builder().exerciseId(exercise.getId()).setIndex(0)
            .weightKg(new BigDecimal("40")).reps(12).build();
        warm.setKind("warmup");
        ExerciseSetResponse logged = postForBody("/api/train/workouts/" + started.getId() + "/sets",
            warm, headers, HttpStatus.CREATED, ExerciseSetResponse.class);

        ExerciseSetResponse updated = putForBody(
            "/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            update("42.5", 10, 3), headers, HttpStatus.OK, ExerciseSetResponse.class);

        assertThat(updated.getReps()).isEqualTo(10);
        assertThat(updated.getRir()).isNull();
    }

    @Test
    void testUpdateSet_shouldReturn400_whenRepsOutOfRange() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        ExerciseSetResponse logged = logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);

        putForBody("/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            update("80", 0, 2), headers, HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testUpdateSet_shouldReturn404_whenSetUnknown() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);

        String body = putForBody(
            "/api/train/workouts/" + started.getId() + "/sets/" + UUID.randomUUID(),
            update("80", 8, 2), headers, HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testUpdateSet_shouldReturn404_whenSetIsSkipMarker() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        postForBody("/api/train/workouts/" + started.getId() + "/skip",
            WorkoutSkipRequest.builder().exerciseId(exercise.getId()).build(),
            headers, HttpStatus.NO_CONTENT, String.class);
        WorkoutInstanceResponse afterSkip = getForBody(
            "/api/train/workouts/" + started.getId(), headers, HttpStatus.OK, WorkoutInstanceResponse.class);
        // The skip marker is the instance's only set row; getWorkout hides nothing here.
        UUID markerId = afterSkip.getSets().isEmpty() ? null : afterSkip.getSets().get(0).getId();
        if (markerId == null) {
            return; // the detail read filters skip markers — nothing addressable, guard proven elsewhere
        }

        putForBody("/api/train/workouts/" + started.getId() + "/sets/" + markerId,
            update("80", 8, 2), headers, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testUpdateSet_shouldReturn409_whenWorkoutCompleted() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        ExerciseSetResponse logged = logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);
        postForBody("/api/train/workouts/" + started.getId() + "/finish",
            null, headers, HttpStatus.OK, WorkoutInstanceResponse.class);

        String body = putForBody(
            "/api/train/workouts/" + started.getId() + "/sets/" + logged.getId(),
            update("80", 8, 2), headers, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "TRAIN_WORKOUT_NOT_ACTIVE");
    }

    @Test
    void testDeleteSet_shouldRemoveRowAndRenumberRemaining_whenMiddleSetDeleted() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);
        ExerciseSetResponse second = logSet(started.getId(), exercise.getId(), 1, "82.5", 9, headers);
        logSet(started.getId(), exercise.getId(), 2, "85", 8, headers);

        deleteAndExpect("/api/train/workouts/" + started.getId() + "/sets/" + second.getId(),
            headers, HttpStatus.NO_CONTENT);

        WorkoutInstanceResponse after = postForBody("/api/train/workouts/" + started.getId() + "/finish",
            null, headers, HttpStatus.OK, WorkoutInstanceResponse.class);
        List<ExerciseSetResponse> sets = after.getSets();
        assertThat(sets).hasSize(2);
        assertThat(sets).extracting(ExerciseSetResponse::getSetIndex).containsExactly(0, 1);
        assertThat(sets).extracting(ExerciseSetResponse::getWeightKg)
            .containsExactly(new BigDecimal("80.00"), new BigDecimal("85.00"));
    }

    @Test
    void testDeleteSet_shouldFreeTheIndex_whenANewSetIsLoggedAfterwards() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = start(template, headers);
        logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);
        ExerciseSetResponse second = logSet(started.getId(), exercise.getId(), 1, "82.5", 9, headers);

        deleteAndExpect("/api/train/workouts/" + started.getId() + "/sets/" + second.getId(),
            headers, HttpStatus.NO_CONTENT);
        logSet(started.getId(), exercise.getId(), 1, "90", 6, headers);

        WorkoutInstanceResponse after = postForBody("/api/train/workouts/" + started.getId() + "/finish",
            null, headers, HttpStatus.OK, WorkoutInstanceResponse.class);
        assertThat(after.getSets()).extracting(ExerciseSetResponse::getSetIndex).containsExactly(0, 1);
    }

    @Test
    void testDeleteSet_shouldReturn409_whenWorkoutCompleted() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutSessionEntity completed =
            trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "completed");
        WorkoutInstanceResponse started = start(template, headers);
        ExerciseSetResponse logged = logSet(started.getId(), exercise.getId(), 0, "80", 10, headers);

        deleteAndExpect("/api/train/workouts/" + completed.getId() + "/sets/" + logged.getId(),
            headers, HttpStatus.CONFLICT);
    }

    @Test
    void testDeleteSet_shouldReturn401_whenUnauthenticated() {
        deleteAndExpect("/api/train/workouts/" + UUID.randomUUID() + "/sets/" + UUID.randomUUID(),
            null, HttpStatus.UNAUTHORIZED);
    }
}
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
cd backend && ./mvnw clean test -Dtest='WorkoutSetMutationIT'
```

Expected: failures — the generated `TrainApi` default methods return `501 NOT_IMPLEMENTED`, so the asserts on 200/204 fail. (If it fails to compile because `SetUpdateRequest` is missing, Task 1 did not land — stop and report.)

- [ ] **Step 3: Implement the service methods**

In `WorkoutService.java`, directly after `logSet(...)`, add:

```java
    /**
     * Overwrite one logged set's performance fields in an ACTIVE instance (mezo-l3on). Full
     * replacement, not a patch: an absent optional field clears it (spec D7). {@code setIndex},
     * {@code kind}, {@code exerciseId} and the {@code target*} prescription snapshot are immutable —
     * they describe WHICH slot this is and what was prescribed for it, not what the user did.
     */
    @Transactional
    public ExerciseSetResponse updateSet(UUID createdBy, UUID workoutId, UUID setId, SetUpdateRequest req) {
        ExerciseSetEntity set = ownedActiveSetOrThrow(createdBy, workoutId, setId);
        set.setWeightKg(req.getWeightKg());
        set.setReps(req.getReps());
        // Warmup sets carry no RIR (mirrors logSet) — effort tracking is working-set-only.
        set.setRir("warmup".equals(set.getKind()) ? null : req.getRir());
        set.setSide(req.getSide());
        set.setNote(req.getNote());
        ExerciseSetEntity saved = exerciseSetRepository.save(set);
        exerciseSetRepository.flush(); // the medal replay reads through the repository
        ExerciseSetResponse response = mapper.toSetResponse(saved);
        // Same rationale as logSet: medals are derived and decorative, the user's edit must survive
        // a failure in the replay-derivation that follows it.
        try {
            response.setMedals(medalService.forSet(createdBy, saved.getId()));
        } catch (RuntimeException e) {
            log.warn("Medal derivation failed for updated set {} — keeping the update", saved.getId(), e);
            response.setMedals(List.of());
        }
        return response;
    }

    /**
     * Soft-delete one logged set of an ACTIVE instance and RENUMBER the exercise's remaining sets to
     * 0..n-1 (mezo-l3on, spec D5). The frontend cursor is positional ({@code logged.length}) and
     * {@code seedFromOpen} assumes contiguous indices, so a gap would make the next logged set
     * collide with an existing index.
     */
    @Transactional
    public void deleteSet(UUID createdBy, UUID workoutId, UUID setId) {
        ExerciseSetEntity set = ownedActiveSetOrThrow(createdBy, workoutId, setId);
        UUID exerciseId = set.getExerciseId();
        exerciseSetRepository.delete(set); // @SQLDelete → soft delete
        exerciseSetRepository.flush();
        List<ExerciseSetEntity> remaining = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(createdBy, workoutId, exerciseId);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).setSetIndex(i);
        }
        exerciseSetRepository.saveAll(remaining);
        exerciseSetRepository.flush();
    }

    /**
     * Shared guard for the set-level writes: owned instance, still {@code active}, and a set row that
     * belongs to THIS instance and is not a whole-exercise skip marker. Mirrors {@link #logSet}'s
     * chain-verification; a skip marker is not a logged set, so it is addressable only through the
     * skip flow.
     */
    private ExerciseSetEntity ownedActiveSetOrThrow(UUID createdBy, UUID workoutId, UUID setId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if (!"active".equals(instance.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE").build(), HttpStatus.CONFLICT);
        }
        return exerciseSetRepository.findById(setId)
            .filter(s -> createdBy.equals(s.getCreatedBy())
                && instance.getId().equals(s.getWorkoutSessionId())
                && !s.isSkipped())
            .orElseThrow(WorkoutService::notFound);
    }
```

Add the `SetUpdateRequest` import (`io.mrkuhne.mezo.api.dto.SetUpdateRequest`) next to the existing `SetLogRequest` import.

- [ ] **Step 4: Implement the controller overrides**

In `TrainController.java`, directly after `logWorkoutSet(...)`:

```java
    @Override
    public ExerciseSetResponse updateWorkoutSet(UUID id, UUID setId, SetUpdateRequest setUpdateRequest) {
        return workoutService.updateSet(currentUserId.get(), id, setId, setUpdateRequest);
    }

    @Override
    public void deleteWorkoutSet(UUID id, UUID setId) {
        workoutService.deleteSet(currentUserId.get(), id, setId);
    }
```

Add the matching import. If the generated signature differs (parameter order or an `ResponseEntity` wrapper), follow the generated interface exactly — it is the source of truth.

- [ ] **Step 5: Run the test and the architecture guard**

```bash
cd backend && ./mvnw clean test -Dtest='WorkoutSetMutationIT,ArchitectureTest'
```

Expected: BUILD SUCCESS, all tests green.

- [ ] **Step 6: Verify no archunit-store damage, then commit**

```bash
git status --short
```

If `backend/src/test/resources/archunit-store/` appears: `git checkout -- backend/src/test/resources/archunit-store/`.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutSetMutationIT.java
git commit --no-verify -m "feat(train): update + delete a logged set on an active instance (mezo-l3on)"
```

---

### Task 3: Frontend session model — `removed`, edit, remove, attach-id

**Files:**
- Modify: `frontend/src/features/train/logic/workoutState.ts`
- Test: `frontend/src/features/train/logic/workoutState.test.ts`

**Interfaces:**
- Consumes: nothing outside this file.
- Produces (used by Tasks 5 and 6):
  - `export type SetSide = 'L' | 'B' | 'R'`
  - `LoggedSet = { weight: number; reps: number; rir: number; id?: string; side?: SetSide | null; note?: string }`
  - `Session.removed: Record<string, number>`
  - `effectiveSetCount(s, id): number` — now `max(1, planned + extra - removed)`
  - `canRemoveSet(s: Session, id: string): boolean`
  - `removeSet(s: Session, id: string, index: number): Session`
  - `updateLoggedSet(s: Session, id: string, index: number, patch: Partial<LoggedSet>): Session`
  - `attachSetId(s: Session, id: string, index: number, setId: string): Session`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/features/train/logic/workoutState.test.ts` (keep the file's existing imports and add the new names to them):

```ts
describe('set edit + slot removal (mezo-l3on)', () => {
  const ex = [{ id: 'a', warmupSets: 1, workingSets: 3, prescribedSets: null }]

  test('removeSet on a pending slot shrinks the effective count without touching logs', () => {
    const s = completeSet(makeSession(ex), 'a', { weight: 80, reps: 10, rir: 2 })
    const after = removeSet(s, 'a', 3)
    expect(effectiveSetCount(after, 'a')).toBe(3)
    expect(after.logged.a).toHaveLength(1)
  })

  test('removeSet on a logged set drops the entry AND the slot, shifting later sets down', () => {
    let s = makeSession(ex)
    s = completeSet(s, 'a', { weight: 80, reps: 10, rir: 2 })
    s = completeSet(s, 'a', { weight: 82.5, reps: 9, rir: 2 })
    s = completeSet(s, 'a', { weight: 85, reps: 8, rir: 1 })
    const after = removeSet(s, 'a', 1)
    expect(effectiveSetCount(after, 'a')).toBe(3)
    expect(after.logged.a.map((x) => x.weight)).toEqual([80, 85])
    expect(nextSetIdx(after, 'a')).toBe(2)
  })

  test('removeSet refuses to drop the last remaining slot', () => {
    const one = [{ id: 'a', warmupSets: 0, workingSets: 1, prescribedSets: null }]
    const s = makeSession(one)
    expect(canRemoveSet(s, 'a')).toBe(false)
    expect(removeSet(s, 'a', 0)).toBe(s)
    expect(effectiveSetCount(s, 'a')).toBe(1)
  })

  test('canRemoveSet is true while more than one slot remains', () => {
    expect(canRemoveSet(makeSession(ex), 'a')).toBe(true)
  })

  test('updateLoggedSet overwrites only the addressed set', () => {
    let s = makeSession(ex)
    s = completeSet(s, 'a', { weight: 80, reps: 10, rir: 2 })
    s = completeSet(s, 'a', { weight: 82.5, reps: 9, rir: 2 })
    const after = updateLoggedSet(s, 'a', 0, { weight: 77.5, reps: 12, rir: 3, note: 'javítva' })
    expect(after.logged.a[0]).toMatchObject({ weight: 77.5, reps: 12, rir: 3, note: 'javítva' })
    expect(after.logged.a[1]).toMatchObject({ weight: 82.5, reps: 9 })
  })

  test('attachSetId binds the server id to the logged entry', () => {
    const s = completeSet(makeSession(ex), 'a', { weight: 80, reps: 10, rir: 2 })
    expect(attachSetId(s, 'a', 0, 'st-9').logged.a[0].id).toBe('st-9')
  })

  test('seedFromOpen carries the server id, side and note into the session', () => {
    const s = seedFromOpen(ex, {
      sets: [{ id: 'st-1', exerciseId: 'a', setIndex: 0, weightKg: 80, reps: 10, rir: 2, side: 'L', note: 'bal' }],
    })
    expect(s.logged.a[0]).toMatchObject({ id: 'st-1', weight: 80, reps: 10, rir: 2, side: 'L', note: 'bal' })
  })
})
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd frontend && pnpm test workoutState
```

Expected: FAIL — `canRemoveSet`, `removeSet`, `updateLoggedSet`, `attachSetId` are not exported.

- [ ] **Step 3: Implement the model changes**

In `workoutState.ts`:

```ts
export type SetSide = 'L' | 'B' | 'R'

export interface LoggedSet {
  weight: number
  reps: number
  rir: number
  /** Server-side set id — the address for the edit/delete writes (mezo-l3on). Absent for the
   *  moment between the optimistic local append and the logSet response that carries it. */
  id?: string
  side?: SetSide | null
  note?: string
}
```

Add to `Session`:

```ts
  /** Slots removed from an exercise (mezo-l3on) — the mirror of `extra`, and client-only in the
   *  same way: a mid-workout reload restores the template's planned count. */
  removed: Record<string, number>
```

`makeSession` returns `{ order, logged: {}, extra: {}, removed: {}, skipped: [], planned, prescribed }`; `mergePlan` spreads `s` so it needs no change.

```ts
/** Planned sets + extras − removed slots, never below one (the exercise always has a slot). */
export function effectiveSetCount(s: Session, id: string): number {
  return Math.max(1, (s.planned[id] ?? 0) + (s.extra[id] ?? 0) - (s.removed[id] ?? 0))
}

/** A slot may be dropped only while the exercise would keep at least one (spec D4). */
export function canRemoveSet(s: Session, id: string): boolean {
  return effectiveSetCount(s, id) > 1
}

/**
 * Drop ONE slot of an exercise (spec D2): the count shrinks by one, and when the addressed index
 * is already logged its entry goes too, so the later sets shift down into its place. Refuses (and
 * returns the same session) at the one-slot floor.
 */
export function removeSet(s: Session, id: string, index: number): Session {
  if (!canRemoveSet(s, id)) return s
  const logged = s.logged[id] ?? []
  const next: Session = { ...s, removed: { ...s.removed, [id]: (s.removed[id] ?? 0) + 1 } }
  if (index < logged.length) {
    next.logged = { ...s.logged, [id]: [...logged.slice(0, index), ...logged.slice(index + 1)] }
  }
  return next
}

/** Overwrite the addressed logged set's fields (no-op past the end of the log). */
export function updateLoggedSet(s: Session, id: string, index: number, patch: Partial<LoggedSet>): Session {
  const logged = s.logged[id]
  if (!logged || index >= logged.length) return s
  const next = [...logged]
  next[index] = { ...next[index], ...patch }
  return { ...s, logged: { ...s.logged, [id]: next } }
}

/** Bind the server's set id onto an already-appended logged entry. */
export function attachSetId(s: Session, id: string, index: number, setId: string): Session {
  return updateLoggedSet(s, id, index, { id: setId })
}
```

Extend `PersistedSet` with `id?: string`, `side?: string | null`, `note?: string | null`, and in `seedFromOpen`'s loop build the entry as:

```ts
    const entry: LoggedSet = {
      weight: Number(set.weightKg ?? 0),
      reps: set.reps ?? 0,
      rir: set.rir ?? 0,
      ...(set.id ? { id: set.id } : {}),
      ...(set.side ? { side: set.side as SetSide } : {}),
      ...(set.note ? { note: set.note } : {}),
    }
```

- [ ] **Step 4: Run the tests**

```bash
cd frontend && pnpm test workoutState
```

Expected: PASS (all tests in the file, old and new).

- [ ] **Step 5: Typecheck**

```bash
cd frontend && pnpm build
```

Expected: success. `ActiveWorkoutPage` already spreads sessions immutably, so no call site breaks; if TypeScript flags a missing `removed` in a test-constructed `Session` literal, fix that literal.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/logic/workoutState.ts frontend/src/features/train/logic/workoutState.test.ts
git commit --no-verify -m "feat(train): session model — slot removal, set edit, server set ids (mezo-l3on)"
```

---

### Task 4: Data layer — `updateSet` / `deleteSet` hooks

**Files:**
- Modify: `frontend/src/data/train/trainApi.ts`
- Modify: `frontend/src/data/train/trainHooks.ts`
- Test: `frontend/src/data/train/trainHooks.test.tsx`

**Interfaces:**
- Consumes: `SetUpdateRequest` from `api.gen.ts` (Task 1).
- Produces (used by Task 6, both on the `TrainData` interface returned by `useTrain`):
  - `updateSet: (workoutId: string, setId: string, body: SetUpdateRequest, opts?: { onSuccess?: (r?: ExerciseSetResponse) => void }) => void`
  - `deleteSet: (workoutId: string, setId: string) => void`
  - `logSet`'s mock branch now returns an `id` too.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/data/train/trainHooks.test.tsx`:

```ts
test('useTrain (real mode) updateSet/deleteSet hit the set sub-resource', async () => {
  const calls: string[] = []
  server.use(
    http.put(`${API_BASE}/api/train/workouts/:id/sets/:setId`, async ({ params, request }) => {
      const body = (await request.json()) as { weightKg: number; reps: number }
      calls.push(`put:${params.id}/${params.setId}:${body.weightKg}x${body.reps}`)
      return HttpResponse.json({ id: String(params.setId), exerciseId: 'ex-1', setIndex: 0, medals: [] })
    }),
    http.delete(`${API_BASE}/api/train/workouts/:id/sets/:setId`, ({ params }) => {
      calls.push(`del:${params.id}/${params.setId}`)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  const saved = vi.fn()
  result.current.updateSet('w-1', 'st-7', { weightKg: 82.5, reps: 9, rir: 1 }, { onSuccess: saved })
  await waitFor(() => expect(saved).toHaveBeenCalled())
  result.current.deleteSet('w-1', 'st-7')
  await waitFor(() =>
    expect(calls).toEqual(expect.arrayContaining(['put:w-1/st-7:82.5x9', 'del:w-1/st-7'])),
  )
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd frontend && pnpm test trainHooks
```

Expected: FAIL — `result.current.updateSet is not a function`.

- [ ] **Step 3: Add the API client calls**

In `trainApi.ts`, add the type export next to the others:

```ts
export type SetUpdateRequest = components['schemas']['SetUpdateRequest']
```

and, directly after `logSet` in the `trainApi` object:

```ts
  updateSet: (workoutId: string, setId: string, body: SetUpdateRequest): Promise<ExerciseSetResponse> =>
    apiFetch<ExerciseSetResponse>(`/api/train/workouts/${workoutId}/sets/${setId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteSet: (workoutId: string, setId: string): Promise<void> =>
    apiFetch<void>(`/api/train/workouts/${workoutId}/sets/${setId}`, { method: 'DELETE' }),
```

- [ ] **Step 4: Add the mutations to `useTrain`**

In `trainHooks.ts`, extend the `TrainData` interface (next to `logSet`):

```ts
  /** Overwrite one logged set (mezo-l3on). Mock mode is a no-op that echoes the id. */
  updateSet: (
    workoutId: string,
    setId: string,
    body: SetUpdateRequest,
    opts?: { onSuccess?: (r?: ExerciseSetResponse) => void },
  ) => void
  /** Soft-delete one logged set; the server renumbers the exercise's remaining setIndexes. */
  deleteSet: (workoutId: string, setId: string) => void
```

Import `SetUpdateRequest` from `@/data/train/trainApi` alongside the existing type imports. Add the mutations right after `logSetMutation`:

```ts
  // Set edit/delete (mezo-l3on). The mock branch deliberately does NOT re-run
  // evaluateMockSetMedals: that evaluator keeps a module-level running history and pushes every
  // evaluated set into it, so re-evaluating an edit would record the set a SECOND time and inflate
  // the next record. Mock mode simply shows no medal chips for an edited exercise.
  const updateSetMutation = useMutation({
    mutationFn: mock
      ? async (args: { workoutId: string; setId: string; body: SetUpdateRequest }) =>
          ({ id: args.setId, medals: [] }) as ExerciseSetResponse
      : (args: { workoutId: string; setId: string; body: SetUpdateRequest }) =>
          trainApi.updateSet(args.workoutId, args.setId, args.body),
    onSuccess: invalidateToday,
  })
  const deleteSetMutation = useMutation({
    mutationFn: mock
      ? async (_args: { workoutId: string; setId: string }) => undefined
      : (args: { workoutId: string; setId: string }) => trainApi.deleteSet(args.workoutId, args.setId),
    onSuccess: invalidateToday,
  })
```

Add the `useCallback` wrappers next to the existing `logSet` one (~line 650):

```ts
  const updateSet = useCallback(
    (
      workoutId: string,
      setId: string,
      body: SetUpdateRequest,
      opts?: { onSuccess?: (r?: ExerciseSetResponse) => void },
    ) =>
      updateSetMutation.mutate({ workoutId, setId, body }, { onSuccess: (r) => opts?.onSuccess?.(r) }),
    [updateSetMutation],
  )
  const deleteSet = useCallback(
    (workoutId: string, setId: string) => deleteSetMutation.mutate({ workoutId, setId }),
    [deleteSetMutation],
  )
```

and add `updateSet,` + `deleteSet,` to the object the hook returns (next to `logSet,` ~line 749).

- [ ] **Step 5: Give the mock `logSet` response an id**

Still in `trainHooks.ts`, in `logSetMutation`'s mock branch, replace the returned object so the id exists in BOTH modes (a mock response that omits a field the real API populates is an invisible correctness hole — the edit sheet addresses sets by id):

```ts
          // `id` is synthesised too (mezo-l3on): the set-edit sheet addresses sets by their server
          // id, so mock mode needs a stable one per logged set.
          return { id: crypto.randomUUID(), medals } as ExerciseSetResponse
```

- [ ] **Step 6: Run the tests in both modes**

```bash
cd frontend && pnpm test trainHooks
```

```bash
cd frontend && VITE_USE_MOCK=true pnpm test trainHooks
```

Expected: PASS in both.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/train/trainApi.ts frontend/src/data/train/trainHooks.ts frontend/src/data/train/trainHooks.test.tsx
git commit --no-verify -m "feat(data): updateSet/deleteSet train hooks + mock set ids (mezo-l3on)"
```

---

### Task 5: `SetEditSheet` component

**Files:**
- Create: `frontend/src/features/train/sheets/SetEditSheet.tsx`
- Test: `frontend/src/features/train/sheets/SetEditSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (`@/shared/ui/Sheet`), `Display` (`@/shared/ui/Display`), `SetStepper` (`@/features/train/components/SetStepper`), `SetSide` (`@/features/train/logic/workoutState`).
- Produces (used by Task 6):

```ts
export interface SetEditValues { weight: number; reps: number; rir: number; side: SetSide | null; note: string }
export function SetEditSheet(props: {
  exerciseName: string
  setLabel: string
  mode: 'logged' | 'pending'
  kind: 'warmup' | 'working'
  exerciseType: 'compound' | 'isolation' | 'plyo'
  initial: SetEditValues
  canDelete: boolean
  onSave: (v: SetEditValues) => void
  onDelete: () => void
  onClose: () => void
}): JSX.Element
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/sheets/SetEditSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SetEditSheet, type SetEditValues } from '@/features/train/sheets/SetEditSheet'

const base = {
  exerciseName: 'Fekvenyomás',
  setLabel: '1. working szett',
  mode: 'logged' as const,
  kind: 'working' as const,
  exerciseType: 'compound' as const,
  initial: { weight: 82.5, reps: 9, rir: 2, side: null, note: '' } satisfies SetEditValues,
  canDelete: true,
  onSave: () => {},
  onDelete: () => {},
  onClose: () => {},
}

test('a logged working set offers save + delete and the RIR row', () => {
  render(<SetEditSheet {...base} />)
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Szett törlése/ })).toBeEnabled()
  expect(screen.getByLabelText('RIR 2')).toBeInTheDocument()
  expect(screen.getByText('Fekvenyomás')).toBeInTheDocument()
})

test('save reports the edited values', async () => {
  const onSave = vi.fn()
  render(<SetEditSheet {...base} onSave={onSave} />)
  await userEvent.click(screen.getByLabelText('Ismétlés növelése'))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ weight: 82.5, reps: 10, rir: 2 }))
})

test('a warmup set hides the RIR row', () => {
  render(<SetEditSheet {...base} kind="warmup" setLabel="B1 bemelegítő szett" />)
  expect(screen.queryByLabelText('RIR 2')).not.toBeInTheDocument()
})

test('an isolation exercise offers the Side row', () => {
  render(<SetEditSheet {...base} exerciseType="isolation" />)
  expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument()
})

test('a plyo exercise hides the weight stepper', () => {
  render(<SetEditSheet {...base} exerciseType="plyo" />)
  expect(screen.queryByLabelText('Súly növelése')).not.toBeInTheDocument()
})

test('a pending slot offers delete only, with disabled inputs', () => {
  render(<SetEditSheet {...base} mode="pending" />)
  expect(screen.queryByRole('button', { name: /Mentés/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Szett törlése/ })).toBeEnabled()
  expect(screen.getByLabelText('Ismétlés növelése')).toBeDisabled()
})

test('the last remaining slot cannot be deleted and says why', () => {
  render(<SetEditSheet {...base} canDelete={false} />)
  expect(screen.getByRole('button', { name: /Szett törlése/ })).toBeDisabled()
  expect(screen.getByText(/Az utolsó szett nem törölhető/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd frontend && pnpm test SetEditSheet
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the sheet**

Create `frontend/src/features/train/sheets/SetEditSheet.tsx`:

```tsx
// ============================================================
// Mezo · SetEditSheet — edit or delete ONE set of the active workout (mezo-l3on).
// Opened by tapping a row of the active-workout set list. Reuses the logging
// surface's own inputs (SetStepper + the RIR/Side pill rows) so the app has a
// single input language for a set; the destructive action removes the SLOT too
// (spec D2), floored at one slot per exercise (spec D4).
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Display } from '@/shared/ui/Display'
import { SetStepper } from '@/features/train/components/SetStepper'
import type { SetSide } from '@/features/train/logic/workoutState'

export interface SetEditValues {
  weight: number
  reps: number
  rir: number
  side: SetSide | null
  note: string
}

interface SetEditSheetProps {
  exerciseName: string
  /** "1. working szett" / "B1 bemelegítő szett" — the row's own label. */
  setLabel: string
  /** 'pending' = the slot has no logged set yet: targets shown, read-only, delete only. */
  mode: 'logged' | 'pending'
  kind: 'warmup' | 'working'
  exerciseType: 'compound' | 'isolation' | 'plyo'
  initial: SetEditValues
  canDelete: boolean
  onSave: (v: SetEditValues) => void
  onDelete: () => void
  onClose: () => void
}

export function SetEditSheet({
  exerciseName, setLabel, mode, kind, exerciseType, initial, canDelete, onSave, onDelete, onClose,
}: SetEditSheetProps) {
  const [weight, setWeight] = useState(initial.weight)
  const [reps, setReps] = useState(initial.reps)
  const [rir, setRir] = useState(initial.rir)
  const [side, setSide] = useState<SetSide | null>(initial.side)
  const [note, setNote] = useState(initial.note)
  const readOnly = mode === 'pending'

  return (
    <Sheet onClose={onClose} labelledBy="set-edit-title">
      {(close) => (
        <>
          <div className="col" style={{ marginBottom: 14 }}>
            <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>{setLabel}</span>
            <div id="set-edit-title" style={{ marginTop: 6 }}>
              <Display size="md">{exerciseName}</Display>
            </div>
          </div>

          <div className="steprow">
            {exerciseType !== 'plyo' && (
              <SetStepper label="Súly" value={weight} step={2.5} unit="kg" min={0} max={999}
                disabled={readOnly} onChange={setWeight} />
            )}
            <SetStepper label="Ismétlés" value={reps} step={1} integer min={1} max={100}
              disabled={readOnly} onChange={setReps} />
          </div>

          {kind !== 'warmup' && (
            <div className="rirrow">
              <span className="rk">RIR</span>
              {[0, 1, 2, 3].map((n) => (
                <button key={n} type="button" disabled={readOnly} aria-pressed={rir === n}
                  aria-label={`RIR ${n}`} onClick={() => setRir(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}

          {exerciseType === 'isolation' && (
            <div className="rirrow">
              <span className="rk">Side</span>
              {(['L', 'B', 'R'] as const).map((s) => (
                <button key={s} type="button" disabled={readOnly} aria-pressed={side === s}
                  onClick={() => setSide(side === s ? null : s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {!readOnly && (
            <input
              className="setnote"
              aria-label="Szett megjegyzés"
              placeholder="Megjegyzés ehhez a szetthez (opcionális)"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}

          {!readOnly && (
            <button type="button" className="donebtn np-press"
              onClick={() => { onSave({ weight, reps, rir, side, note }); close() }}>
              Mentés ✓
            </button>
          )}

          <button
            type="button"
            className="cta-ghost np-press"
            disabled={!canDelete}
            style={{
              marginTop: 9, width: '100%', padding: 12,
              color: 'var(--error)', boxShadow: 'inset 0 0 0 1.5px color-mix(in srgb, var(--error) 40%, transparent)',
              opacity: canDelete ? 1 : 0.45,
            }}
            onClick={() => { onDelete(); close() }}
          >
            Szett törlése
          </button>
          {!canDelete && (
            <p style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
              Az utolsó szett nem törölhető — a gyakorlat kihagyásához használd a Kihagyás-t.
            </p>
          )}
        </>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Add the `disabled` prop to `SetStepper`**

`SetEditSheet` passes `disabled`, which `SetStepper` does not accept yet. In `frontend/src/features/train/components/SetStepper.tsx` add `disabled` to the props type (`disabled?: boolean`), destructure it with a `false` default, and put `disabled={disabled}` on all three buttons (the tap-to-edit value button and the two ± buttons). Guard the value button so a disabled stepper cannot enter edit mode.

- [ ] **Step 5: Run the tests**

```bash
cd frontend && pnpm test SetEditSheet SetStepper
```

Expected: PASS (both files; confirm the run reports 2 test files).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/sheets/SetEditSheet.tsx frontend/src/features/train/sheets/SetEditSheet.test.tsx frontend/src/features/train/components/SetStepper.tsx
git commit --no-verify -m "feat(train): SetEditSheet — edit or delete one set (mezo-l3on)"
```

---

### Task 6: Wire the set list on `ActiveWorkoutPage`

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx`
- Test: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 3, 4 and 5.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx`. The file already pins mock mode in a `beforeEach`, and provides `setup()` (renders the page at `/train/session`); `within` is already imported. Mock `ex1` (Chest Supported Row) has **2 warmup + 3 working = 5 planned sets**, so its first row is `B1`.

```tsx
// ---- set edit + slot delete (mezo-l3on) ----

/** The set-list row buttons carry the row's own label; the first is always B1 on ex1. */
const firstRow = () => screen.getAllByRole('button', { name: /szett szerkesztése/ })[0]

test('mock mode: a logged set row opens the edit sheet, and saving rewrites the row', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓'))
  const skipRest = screen.queryByRole('button', { name: 'Pihenő kihagyása' })
  if (skipRest) await user.click(skipRest)

  const before = firstRow().getAttribute('aria-label')
  await user.click(firstRow())
  const sheet = within(screen.getByRole('dialog'))
  await user.click(sheet.getByLabelText('Ismétlés növelése'))
  await user.click(sheet.getByRole('button', { name: 'Mentés ✓' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  // The row is read-only output of the session model, so a changed label proves the edit landed.
  expect(firstRow().getAttribute('aria-label')).not.toBe(before)
})

test('mock mode: deleting a set drops one slot from the exercise', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelectorAll('.setdots .sd')).toHaveLength(5)

  // The pending-slot path: nothing is logged yet, so this row has no server row either.
  await user.click(firstRow())
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))

  await waitFor(() => expect(container.querySelectorAll('.setdots .sd')).toHaveLength(4))
})

test('mock mode: the last remaining slot cannot be deleted', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))

  // 5 planned slots -> delete four of them, one at a time.
  for (let i = 0; i < 4; i++) {
    await user.click(firstRow())
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Szett törlése' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  }
  expect(container.querySelectorAll('.setdots .sd')).toHaveLength(1)

  await user.click(firstRow())
  const sheet = within(screen.getByRole('dialog'))
  expect(sheet.getByRole('button', { name: 'Szett törlése' })).toBeDisabled()
  expect(sheet.getByText(/Az utolsó szett nem törölhető/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
cd frontend && pnpm test ActiveWorkoutPage
```

Expected: FAIL — no row button with that accessible name exists.

- [ ] **Step 3: Turn the set rows into buttons**

First add a module-level helper next to `medalKey` so the row and the sheet always agree on a set's name:

```tsx
/** The human label of one set slot — shared by the set-list row, its aria-label and the edit sheet. */
function setSlotLabel(index: number, warmup: boolean, warmupCount: number): string {
  return warmup ? `B${index + 1} bemelegítő szett` : `${index - warmupCount + 1}. working szett`
}
```

Then, in the prescribed-set list (`ActiveWorkoutPage.tsx` ~line 1104), change the row's outer `<div key={i} className="row gap-sm" style={{…}}>` into:

```tsx
                <button
                  key={i}
                  type="button"
                  className="row gap-sm np-press"
                  aria-label={`${setSlotLabel(i, warm, warmupCount)} szerkesztése${isDone ? ` — ${w ?? '–'} kg × ${r ?? '–'}` : ''}`}
                  onClick={() => setEditingSetIdx(i)}
                  style={{ padding: '10px 12px', alignItems: 'center', background: 'var(--surface-2)', borderLeft: '2px solid ' + accent, opacity: isDone ? 0.5 : 1, width: '100%', textAlign: 'left' }}
                >
```

(closing `</div>` → `</button>`; the existing `setLabel`/`kindLabel` locals stay as they are — they drive the visible text.) Add a trailing chevron just before the close so the row reads as tappable:

```tsx
                  <span aria-hidden="true" style={{ color: 'var(--text-tertiary)', fontSize: 13, marginLeft: 2 }}>›</span>
```

- [ ] **Step 4: Add the state, handlers and the sheet mount**

Add near the other `useState`s:

```tsx
  const [editingSetIdx, setEditingSetIdx] = useState<number | null>(null)
```

Add the handlers next to `completeSet` (they use `current`, the viewed exercise):

```tsx
  // Drop every in-session medal chip of one exercise (mezo-l3on): after an edit or a delete the
  // exercise's OTHER sets can gain or lose records too, and the authoritative list only arrives
  // with the finish response — a missing chip is honest, a stale one is not.
  const clearExerciseMedals = (ex: LoggedWorkoutExercise) => {
    setMedalsBySet((m) => {
      const next: Record<string, Medal[]> = {}
      const dropped: Medal[] = []
      for (const [k, v] of Object.entries(m)) {
        if (k.startsWith(`${ex.id}:`)) dropped.push(...v)
        else next[k] = v
      }
      const droppedKeys = new Set(dropped.map(medalKey))
      setSessionMedals((s) => s.filter((md) => !droppedKeys.has(medalKey(md))))
      return next
    })
  }

  const handleSetSave = (idx: number, v: SetEditValues) => {
    const ex = current
    const setId = session.logged[ex.id]?.[idx]?.id
    setSession(updateLoggedSet(session, ex.id, idx, { weight: v.weight, reps: v.reps, rir: v.rir, side: v.side, note: v.note }))
    clearExerciseMedals(ex)
    const isWarmup = prescribedAt(session, ex.id, idx)?.kind === 'warmup'
    if (setId) {
      updateSet(workoutId ?? 'mock', setId, {
        weightKg: weightless ? 0 : v.weight,
        reps: v.reps,
        ...(isWarmup ? {} : { rir: v.rir }),
        ...(v.side ? { side: v.side } : {}),
        ...(v.note.trim() ? { note: v.note.trim() } : {}),
      }, {
        onSuccess: (r) => {
          const medals = r?.medals ?? []
          if (medals.length) {
            setMedalsBySet((m) => ({ ...m, [`${ex.id}:${idx}`]: medals }))
            setSessionMedals((s) => [...s, ...medals])
          }
        },
      })
    }
    setEditingSetIdx(null)
  }

  const handleSetDelete = (idx: number) => {
    const ex = current
    const setId = session.logged[ex.id]?.[idx]?.id
    // The removed set must not leave a rest countdown running toward it.
    rest.skip()
    setSession(removeSet(session, ex.id, idx))
    clearExerciseMedals(ex)
    // A pending slot has no server row — the shrink is purely client state.
    if (setId) deleteSet(workoutId ?? 'mock', setId)
    setEditingSetIdx(null)
  }
```

Pull `updateSet` / `deleteSet` out of `useTrain` in the guard component and thread them through `SessionProps` exactly like `logSet` (add both to the interface and to the `<ActiveWorkoutSession …>` element).

In `completeSet`'s `onSuccess`, bind the returned id before the medal handling:

```tsx
        if (r?.id) setSession((s) => attachSetId(s, finishing.id, wasSetIdx, r.id!))
```

Mount the sheet **inside the active-phase render block**, right after the `ExerciseActionSheet` mount (`~line 806`) — `warmupCount`, `cursor` and `current` are all in that scope — with the same debrief precedence:

```tsx
      {editingSetIdx !== null && !feedbackEx && (() => {
        const idx = editingSetIdx
        const t = prescribedAt(session, current.id, idx)
        const warm = t?.kind === 'warmup'
        const actual = session.logged[current.id]?.[idx]
        return (
          <SetEditSheet
            exerciseName={current.name}
            setLabel={setSlotLabel(idx, warm, warmupCount)}
            mode={actual ? 'logged' : 'pending'}
            kind={warm ? 'warmup' : 'working'}
            exerciseType={current.type}
            initial={{
              weight: actual?.weight ?? t?.targetWeightKg ?? prefill(current).weight,
              reps: actual?.reps ?? t?.targetReps ?? prefill(current).reps,
              rir: actual?.rir ?? t?.targetRIR ?? current.targetRIR,
              side: actual?.side ?? null,
              note: actual?.note ?? '',
            }}
            canDelete={canRemoveSet(session, current.id)}
            onSave={(v) => handleSetSave(idx, v)}
            onDelete={() => handleSetDelete(idx)}
            onClose={() => setEditingSetIdx(null)}
          />
        )
      })()}
```

Import the new names: `canRemoveSet`, `removeSet`, `updateLoggedSet`, `attachSetId` from `@/features/train/logic/workoutState`, and `SetEditSheet`, `type SetEditValues` from `@/features/train/sheets/SetEditSheet`.

- [ ] **Step 4b: Reset the open sheet when the viewed exercise changes**

The row index is meaningless against another exercise. Extend the existing effect that resets the logging inputs on `current.id` change (or add a small one) with `setEditingSetIdx(null)`.

- [ ] **Step 5: Run the page tests in both modes**

```bash
cd frontend && pnpm test ActiveWorkoutPage
```

```bash
cd frontend && VITE_USE_MOCK=true pnpm test ActiveWorkoutPage
```

Expected: PASS in both.

- [ ] **Step 6: Full suite in both modes + build (this task touched a shared surface)**

```bash
cd frontend && pnpm build
```

```bash
cd frontend && pnpm test
```

```bash
cd frontend && VITE_USE_MOCK=true pnpm test
```

Expected: all green. Do NOT run `pnpm test:visual`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/train/pages/ActiveWorkoutPage.tsx frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx
git commit --no-verify -m "feat(train): tap a set row to edit or delete it mid-workout (mezo-l3on)"
```

---

### Task 7: Living docs

**Files:**
- Modify: `docs/features/train.md` (§2 active-workout behavior, §4 endpoint list, §9 known gaps)
- Modify: `docs/features/_platform-data-layer.md` (only if it enumerates `useTrain`'s mutations — check with `grep -n "logSet" docs/features/_platform-data-layer.md`)

- [ ] **Step 1: Update `docs/features/train.md`**

In the active-workout part of §2, after the sentence describing the read-only prescribed set list, add (Hungarian prose, matching the file's voice):

> **A szett-sorok szerkeszthetők (`mezo-l3on`).** Az aktív fázisban minden sor gomb: koppintásra a `SetEditSheet` nyílik, amely a logolás saját beviteli elemeit hozza (`SetStepper` súly/ismétlés + RIR sor working szetten + Side izolációs gyakorlaton + szett-megjegyzés). Logolt soron `Mentés ✓` és `Szett törlése`; még nem logolt sloton a stepperek a célértéket mutatják letiltva, és csak a törlés érhető el. **A törlés a slotot is elviszi** (4 tervezettből 3 lesz, a mögöttes sorok előrelépnek), gyakorlatonként **egy slot padlóval** — az utolsónál a gomb inaktív, a gyakorlat elhagyására a `Kihagyás` való. A szerkesztés/törlés kizárólag az **aktív** instance-on él (a `/train/review/:id` és a `complete` fázis változatlan); a záró lapról a `← Vissza az edzéshez` visszavisz. A slot-darabszám — a `＋ Szett` `extra`-jához hasonlóan — **kliens-állapot**, egy edzés közbeni újratöltés visszahozza a tervezett darabszámot; a logolt szettek javítása/törlése viszont perzisztens.

In §4's endpoint table/list, next to `POST /api/train/workouts/{id}/sets`:

> `PUT /api/train/workouts/{id}/sets/{setId}` — egy logolt szett teljesítmény-mezőinek felülírása (teljes csere, nem patch; `kind`/`setIndex`/`target*` nem változik, warmup soron a `rir` mindig `null`), újraderivált `medals`-szal. `DELETE /api/train/workouts/{id}/sets/{setId}` — soft delete, majd az adott gyakorlat megmaradt szettjeinek `setIndex`-e 0..n-1-re rendeződik (a FE pozicionális kurzora hézagmentességet feltételez). Mindkettő csak `active` instance-on (`409 TRAIN_WORKOUT_NOT_ACTIVE`), skip-marker sorra `404`.

In §9 (or wherever the doc lists known gaps), add one line: a lezárt edzés utólagos szett-javítása és a szerveroldali slot-darabszám továbbra is nyitott (`mezo-l3on` follow-up).

- [ ] **Step 2: Run the docs lint**

```bash
node scripts/lint-docs.mjs
```

Expected: no errors; the train doc's staleness flag clears (it lists `frontend/src/features/train` among its `key_files`).

- [ ] **Step 3: Commit**

```bash
git add docs/features/train.md
git commit --no-verify -m "docs(train): set edit + slot delete in the active workout (mezo-l3on)"
```

(Add `docs/features/_platform-data-layer.md` to the same commit if Step 1's grep found a mutation list there and you updated it.)

---

## Coordinator-only closing steps (not for task subagents)

1. `bd close mezo-l3on` + `bd export -o .beads/issues.jsonl`, committed.
2. Push the branch, open the self-PR, wait for CI green (regenerate visual goldens only if `test-visual` goes red — `train-session` captures the **prep** phase, so no pixel move is expected).
3. `--no-ff` merge to main from a temp branch (main is checked out in the primary checkout), push, delete the branch.
