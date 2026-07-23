# Saját edzés (custom workout) + Mai cross-day entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) Make the Mai tab's inert weekly gym rows open `GymDaySheet` so cross-day start is reachable from Mai (`mezo-j3x0`); (B) add "Saját edzés" — user-composed, saveable custom workout templates startable any time, logged through the unchanged ActiveWorkout flow and counted into history/records/Insights/companion/XP (`mezo-ws2x`).

**Architecture:** A custom template is an ordinary `workout_session` TEMPLATE row (`template_session_id NULL`, `mesocycle_id NULL`) discriminated by a new `origin` column (`meso|custom`); its exercises are ordinary `exercise` recipe rows. The instance machinery (start/log/skip/finish/auto-close/review) is reused untouched; instances inherit `origin`. Plan-adherence consumers (`findDoneInstanceDates` → weekly ✓ marks, quests, discipline) stay meso-only; everything else counts custom automatically.

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / MapStruct (backend), OpenAPI contract-first (`api/feature/train/train.yml`), React 19 + TanStack Query + Vitest (frontend).

**Driving docs:** spec `docs/superpowers/specs/2026-07-23-custom-workout-design.md` (D1–D11); house rules `docs/references/frontend_conventions.md`, `api_contract_conventions.md`, `java_standards` refs, `integration_test_framework.md`.

## Global Constraints

- Code/comments/commits in ENGLISH; UI copy in Hungarian. UI name: **„Saját edzés”**; code name `custom`.
- Contract-first: edit `api/feature/train/train.yml` BEFORE backend/FE code; regenerate via `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api` (backend Java types regenerate inside `./mvnw`).
- FE: imports deep + absolute via `@/*`; hooks consumed ONLY from `@/data/hooks`; no new barrels; tests colocated; both modes green: `pnpm test` AND `VITE_USE_MOCK=true pnpm test`; mock mode = synchronous fixtures + no-op writes; real mode = no static fallback.
- BE: constructor DI (`@RequiredArgsConstructor`), method-level `@Transactional` on writes only, UUID PKs, soft delete via `@SQLDelete`/`@SQLRestriction`, ownership server-side (`createdBy` param first), AssertJ-only assertions, integration-first tests extending `AbstractIntegrationTest`, test naming `test{Method}_should{Result}_when{Condition}`.
- Liquibase: new script under `backend/src/main/resources/db/changelog/1.0.0/script/`, `{YYYYMMDDHHMM}_mezo-ws2x_{desc}.sql` (UTC timestamp — adjust to the actual time when executing; must sort after `202607231400_mezo-d8tr_pantry_photo_source.sql`), registered in `1.0.0_master.yml`; never modify released changesets; explicit constraint names.
- Backend focused tests locally (`./mvnw clean test -Dtest=...`, compose Postgres up); the FULL suite runs in CI via the self-PR. ALWAYS `clean` (Lombok+MapStruct incremental is flaky).
- Conventional commit subjects carry the driving bd id, e.g. `feat(train): ... (mezo-ws2x)`.
- Git flow per phase: own `feat/<topic>` branch → push → self-PR → CI green → local `--no-ff` merge to main → push. Never use bare `git stash` (shared stash stack across worktrees).

---

# PHASE A — Mai → GymDaySheet cross-day entry (`mezo-j3x0`, branch `feat/mai-gymday-entry`)

### Task 1: Phase A setup + `WeeklyDayRow` gains `onOpenGymDay`

**Files:**
- Modify: `frontend/src/features/train/components/WeeklyDayRow.tsx`
- Test: `frontend/src/features/train/components/WeeklyDayRow.test.tsx`

**Interfaces:**
- Consumes: existing `WeeklyDayRowProps` (`gymLogged`, `onStartGym`, `onReviewGym`).
- Produces: new optional prop `onOpenGymDay?: () => void` — fired when a **non-today, not-done** gym row is tapped. Task 2 wires it.

- [ ] **Step 1: Claim the issue + branch**

```bash
bd update mezo-j3x0 --claim
git checkout -b feat/mai-gymday-entry
```

- [ ] **Step 2: Write the failing test** — append to `WeeklyDayRow.test.tsx` (harness imports already present):

```tsx
it('a non-today, not-done gym row is tappable and calls onOpenGymDay (mezo-j3x0)', () => {
  const onOpenGymDay = vi.fn()
  const onStartGym = vi.fn()
  const onReviewGym = vi.fn()
  render(
    <WeeklyDayRow
      agenda={{
        day: 'Szo', date: '2026-06-20', isToday: false,
        gym: { day: 'Szo', active: true, time: '10:00', duration: null, type: 'Pull Day' } as never,
        sport: [], running: [],
      }}
      onOpenGymDay={onOpenGymDay}
      onStartGym={onStartGym}
      onReviewGym={onReviewGym}
    />,
  )
  fireEvent.click(screen.getByRole('button'))
  expect(onOpenGymDay).toHaveBeenCalledTimes(1)
  expect(onStartGym).not.toHaveBeenCalled()
  expect(onReviewGym).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test WeeklyDayRow`
Expected: FAIL — `onOpenGymDay` not called (the non-today row's `onClick` is currently `undefined`).

- [ ] **Step 4: Implement** — in `WeeklyDayRow.tsx`:

Add to `WeeklyDayRowProps` (after `onReviewGym`):

```tsx
  /** A non-today, not-done gym day was tapped — open its GymDaySheet (cross-day start, mezo-j3x0). */
  onOpenGymDay?: () => void
```

Destructure it in the component signature, and change the gym branch's button `onClick` (currently `gymLogged ? onReviewGym : isToday ? onStartGym : undefined`) to:

```tsx
              <button key="gym" type="button" className="s" onClick={gymLogged ? onReviewGym : isToday ? onStartGym : onOpenGymDay}>
```

- [ ] **Step 5: Run the test file to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test WeeklyDayRow`
Expected: PASS (all existing WeeklyDayRow tests stay green — done/today behavior unchanged).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/WeeklyDayRow.tsx frontend/src/features/train/components/WeeklyDayRow.test.tsx
git commit -m "feat(train): weekly gym rows expose onOpenGymDay for cross-day entry (mezo-j3x0)"
```

### Task 2: `TrainTodayPage` mounts `GymDaySheet` for tapped weekly days

**Files:**
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx`
- Test: `frontend/src/features/train/pages/TrainTodayPage.test.tsx`

**Interfaces:**
- Consumes: Task 1's `onOpenGymDay`; existing `GymDaySheet` props (`day: MesoDay`, `completedThisWeek`, `openTemplateSessionId`, `openWorkoutTitle`, `onClose`) — prop derivation copied from `GymPage.tsx:131-144`.
- Produces: user-visible behavior only (no new exports).

- [ ] **Step 1: Write the failing test** — append to `TrainTodayPage.test.tsx` (mock "today" is pinned to Csü by the fixtures, so Hét's `Push` row is deterministically non-today):

```tsx
test('a non-today weekly gym row opens the GymDaySheet with the cross-day start CTA (mezo-j3x0)', () => {
  renderView()
  // Mock today = Csü (fixture flag); the Hét row shows the Push day → non-today gym row.
  fireEvent.click(screen.getByRole('button', { name: /Push/ }))
  // The sheet renders the day's first exercise and the non-today start CTA.
  expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument()
  expect(screen.getByText(/Indítsuk · ma/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test TrainTodayPage`
Expected: FAIL — clicking does nothing, `Barbell Bench Press` not found.

- [ ] **Step 3: Implement** — in `TrainTodayPage.tsx`:

Add imports:

```tsx
import { GymDaySheet } from '@/features/train/sheets/GymDaySheet'
import type { MesoDay } from '@/data/types'
```

Add state next to the existing sheet states (`sportLogSport`, `runLogCtx`):

```tsx
  const [openGymDay, setOpenGymDay] = useState<MesoDay | null>(null)
```

In the `<WeeklyDayRow ...>` props (after `onReviewGym`), add:

```tsx
              onOpenGymDay={(() => {
                const md = activeMeso.days?.find((d) => d.day === a.day && d.exerciseCount > 0)
                return md ? () => setOpenGymDay(md) : undefined
              })()}
```

At the bottom, next to the `SportLogSheet`/`RunLogSheet` mounts, add (prop derivation mirrors `GymPage.tsx:131-144`):

```tsx
      {openGymDay && (
        <GymDaySheet
          day={openGymDay}
          completedThisWeek={(() => {
            const done = weekWorkouts.find((w) => w.templateSessionId && w.templateSessionId === openGymDay.id)
            return done ? { id: done.id, date: done.date } : null
          })()}
          openTemplateSessionId={todaySession?.openWorkout?.templateSessionId ?? null}
          openWorkoutTitle={
            activeMeso.days?.find((d) => d.id && d.id === todaySession?.openWorkout?.templateSessionId)?.type ?? null
          }
          onClose={() => setOpenGymDay(null)}
        />
      )}
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test TrainTodayPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/pages/TrainTodayPage.tsx frontend/src/features/train/pages/TrainTodayPage.test.tsx
git commit -m "feat(train): Mai weekly gym rows open GymDaySheet — cross-day start from Mai (mezo-j3x0)"
```

### Task 3: Phase A docs + gates + ship

**Files:**
- Modify: `docs/features/train.md` (§2 `Mai` section)

- [ ] **Step 1: Update `docs/features/train.md`** — in the §2 `Mai` paragraph, find the sentence fragment “the **completed gym day is now interactive**” context and the gym-hero gating paragraph's weekly-rows sentence; add after the weekly-rows description (same paragraph):

> Since `mezo-j3x0` (the p7rp D3 follow-up) the **non-today, not-done weekly gym rows are tappable too** — they open the day's `GymDaySheet` (the same four-state footer as the Gym tab), so a cross-day start is reachable from Mai; today's row still starts directly and done rows still open the review.

Also update the p7rp spec's D3 reference if the doc quotes it as "stays inert" — the `Mai` section must not claim inertness anymore.

- [ ] **Step 2: Lint docs + full FE gate**

```bash
node scripts/lint-docs.mjs
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: lint clean; build + both modes green.

- [ ] **Step 3: Commit, push, self-PR**

```bash
git add docs/features/train.md
git commit -m "docs(features): train.md — Mai weekly rows open GymDaySheet (mezo-j3x0)"
git push -u origin feat/mai-gymday-entry
gh pr create --title "feat(train): Mai weekly gym rows open GymDaySheet (mezo-j3x0)" --body "Cross-day start reachable from Mai — p7rp D3 follow-up. Spec: docs/superpowers/specs/2026-07-23-custom-workout-design.md (part A)."
```

- [ ] **Step 4: Wait for CI green, then merge locally per house flow**

```bash
gh pr checks --watch
git checkout main && git pull --rebase
git merge --no-ff feat/mai-gymday-entry
git push
git branch -d feat/mai-gymday-entry
bd close mezo-j3x0
```

Note: `main` must not be checked out in another worktree at merge time (`git worktree list` to verify; if it is, run the merge from the checkout that holds `main`).

---

# PHASE B — Saját edzés (`mezo-ws2x`, branch `feat/custom-workout`)

### Task 4: Migration + entity + repository finder (`origin` column)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607231600_mezo-ws2x_workout_session_origin.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/WorkoutSessionEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java`

**Interfaces:**
- Produces: `WorkoutSessionEntity.getOrigin()/setOrigin(String)` (default `"meso"`); repository finder `findByCreatedByAndOriginAndTemplateSessionIdIsNullOrderByCreatedAtAsc(UUID, String)` — Tasks 6–7 consume both.

- [ ] **Step 1: Claim + branch (from the merged main state)**

```bash
bd update mezo-ws2x --claim
git checkout -b feat/custom-workout
```

- [ ] **Step 2: Create the migration script** (adjust the 12-digit UTC timestamp in the filename AND changeset id to the actual current time):

```sql
-- mezo-ws2x: workout_session.origin — discriminates mesocycle-plan rows from custom (saját)
-- workout templates/instances. Existing rows backfill to 'meso' via the column default.
ALTER TABLE workout_session
    ADD COLUMN origin TEXT NOT NULL DEFAULT 'meso';
ALTER TABLE workout_session
    ADD CONSTRAINT ck_workout_session_origin CHECK (origin IN ('meso', 'custom'));
```

- [ ] **Step 3: Register it** — append to `1.0.0_master.yml` (same shape as the last entry):

```yaml
  - changeSet:
      id: "1.0.0:202607231600_mezo-ws2x_workout_session_origin"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607231600_mezo-ws2x_workout_session_origin.sql
```

- [ ] **Step 4: Entity field** — in `WorkoutSessionEntity.java`, after the `orderIndex` field:

```java
    /** Template/instance origin: mesocycle plan day vs custom (saját) workout (DB CHECK, mezo-ws2x). */
    @NotNull
    @Column(nullable = false)
    private String origin = "meso"; // meso|custom
```

- [ ] **Step 5: Repository finder** — in `WorkoutSessionRepository.java`, after the existing derived finders:

```java
    /** The owner's CUSTOM (saját) workout templates, oldest first (mezo-ws2x). */
    List<WorkoutSessionEntity> findByCreatedByAndOriginAndTemplateSessionIdIsNullOrderByCreatedAtAsc(
        UUID createdBy, String origin);
```

- [ ] **Step 6: Verify the migration applies** (compose Postgres must be up: `cd backend && docker compose up -d`)

Run: `cd backend && ./mvnw clean test -Dtest=CrossDayWorkoutIT`
Expected: PASS — Liquibase applies the new changeset, entity↔DDL in sync.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/WorkoutSessionEntity.java backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java
git commit -m "feat(train): workout_session.origin column + custom-template finder (mezo-ws2x)"
```

### Task 5: Contract — custom-workout endpoints + summary `origin`/`title`

**Files:**
- Modify: `api/feature/train/train.yml`
- Regenerate: `api/openapi.yml` (merge), `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (generated): BE `io.mrkuhne.mezo.api.dto.CustomWorkoutResponse` / `CustomWorkoutUpsertRequest` + `TrainApi` methods `listCustomWorkouts()`, `createCustomWorkout(...)`, `updateCustomWorkout(UUID, ...)`, `deleteCustomWorkout(UUID)`; FE `components['schemas']['CustomWorkoutResponse'|'CustomWorkoutUpsertRequest']`; `WorkoutSummaryResponse` gains required `origin` (`meso|custom`) + `title`.

- [ ] **Step 1: Add the paths** — insert into `train.yml` immediately AFTER the `/api/train/mesocycles/{id}/days/{dayId}/exercises` path block (match the file's expanded YAML style and its 400/401/404 `SystemMessageList` response idiom used by that block):

```yaml
  /api/train/custom-workouts:
    get:
      tags: [Train]
      operationId: listCustomWorkouts
      summary: The owner's saved custom (saját) workout templates, oldest first
      responses:
        '200':
          description: Custom workout templates
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/CustomWorkoutResponse'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
    post:
      tags: [Train]
      operationId: createCustomWorkout
      summary: Create a custom workout template (name + full recipe exercise list)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CustomWorkoutUpsertRequest'
      responses:
        '201':
          description: The created template
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CustomWorkoutResponse'
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
  /api/train/custom-workouts/{id}:
    put:
      tags: [Train]
      operationId: updateCustomWorkout
      summary: Rename + full exercise-list replace of a custom workout template
      parameters:
        - name: id
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
              $ref: '#/components/schemas/CustomWorkoutUpsertRequest'
      responses:
        '200':
          description: The updated template
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CustomWorkoutResponse'
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
          description: Foreign/missing/non-custom row
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
    delete:
      tags: [Train]
      operationId: deleteCustomWorkout
      summary: Soft-delete a custom workout template (instance history survives)
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: Deleted
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '404':
          description: Foreign/missing/non-custom row
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

- [ ] **Step 2: Add the schemas** — insert immediately AFTER the `GymExerciseInput` schema block:

```yaml
    CustomWorkoutResponse:
      type: object
      required:
        - id
        - name
        - exercises
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        exercises:
          type: array
          items:
            $ref: '#/components/schemas/GymExercise'
    CustomWorkoutUpsertRequest:
      type: object
      required:
        - name
        - exercises
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 120
        exercises:
          type: array
          items:
            $ref: '#/components/schemas/GymExerciseInput'
```

- [ ] **Step 3: Extend `WorkoutSummaryResponse`** — change `required` to `[id, date, status, origin, title]` and add two properties:

```yaml
        origin:
          type: string
          enum: [meso, custom]
          description: Mesocycle-plan instance vs custom (saját) workout instance (mezo-ws2x)
        title:
          type: string
          description: The workout title — the template day's title / the custom workout's name
```

- [ ] **Step 4: Regenerate both sides**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` updated; `git diff --stat` shows both.

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): custom-workout CRUD contract + summary origin/title (mezo-ws2x)"
```

### Task 6: Backend CRUD — `TrainService` + `TrainController` + `CustomWorkoutIT`

Note: the spec's §Data-model names a `CustomWorkoutService`; the CRUD lands in **`TrainService`** instead — it already owns the template-day/exercise machinery (`toExerciseEntity`, `toDay`, `videosByCatalog` are private there). Behavior/endpoints are unchanged; record this deviation in the train.md update (Task 13).

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/CustomWorkoutIT.java` (create)

**Interfaces:**
- Consumes: Task 4's entity field + finder; Task 5's generated DTOs/`TrainApi` methods.
- Produces: `TrainService.listCustomWorkouts(UUID)`, `createCustomWorkout(UUID, CustomWorkoutUpsertRequest)`, `updateCustomWorkout(UUID, UUID, CustomWorkoutUpsertRequest)`, `deleteCustomWorkout(UUID, UUID)` — all returning generated DTOs; Task 7's ITs and Task 8's FE client call these endpoints.

- [ ] **Step 1: Write the failing IT** — create `CustomWorkoutIT.java` (mirror `CrossDayWorkoutIT`'s harness):

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.CustomWorkoutResponse;
import io.mrkuhne.mezo.api.dto.CustomWorkoutUpsertRequest;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Saját edzés (mezo-ws2x): custom workout template CRUD — meso-less workout_session
 * template rows (origin='custom') with ordinary exercise recipe rows.
 */
@Transactional
class CustomWorkoutIT extends AbstractIntegrationTest {

    @Autowired private TrainService trainService;
    @Autowired private DatabasePopulator databasePopulator;

    private static CustomWorkoutUpsertRequest upsert(String name, String... exerciseNames) {
        List<GymExerciseInput> exercises = java.util.Arrays.stream(exerciseNames)
            .map(n -> GymExerciseInput.builder()
                .name(n).muscle("chest")
                .warmupSets(1).workingSets(3).repMin(8).repMax(10).targetRIR(1)
                .type(GymExerciseInput.TypeEnum.COMPOUND)
                .build())
            .toList();
        return CustomWorkoutUpsertRequest.builder().name(name).exercises(exercises).build();
    }

    @Test
    void testCreateCustomWorkout_shouldPersistMesoLessTemplate_whenValid() {
        UUID user = databasePopulator.populateUser("custom-create@test.local");
        CustomWorkoutResponse r = trainService.createCustomWorkout(user, upsert("Pihenőnapi felső", "Incline DB Press"));
        assertThat(r.getId()).isNotNull();
        assertThat(r.getName()).isEqualTo("Pihenőnapi felső");
        assertThat(r.getExercises()).hasSize(1);
        assertThat(r.getExercises().get(0).getName()).isEqualTo("Incline DB Press");
    }

    @Test
    void testListCustomWorkouts_shouldReturnOwnRowsOnly_whenTwoUsers() {
        UUID a = databasePopulator.populateUser("custom-a@test.local");
        UUID b = databasePopulator.populateUser("custom-b@test.local");
        trainService.createCustomWorkout(a, upsert("A edzése", "Row"));
        assertThat(trainService.listCustomWorkouts(b)).isEmpty();
        assertThat(trainService.listCustomWorkouts(a)).hasSize(1);
    }

    @Test
    void testUpdateCustomWorkout_shouldRenameAndReplaceExercises_whenOwned() {
        UUID user = databasePopulator.populateUser("custom-update@test.local");
        CustomWorkoutResponse created = trainService.createCustomWorkout(user, upsert("V1", "Row"));
        CustomWorkoutResponse updated = trainService.updateCustomWorkout(
            user, created.getId(), upsert("V2", "Bench", "Curl"));
        assertThat(updated.getName()).isEqualTo("V2");
        assertThat(updated.getExercises()).hasSize(2);
        assertThat(trainService.listCustomWorkouts(user)).hasSize(1);
    }

    @Test
    void testDeleteCustomWorkout_shouldSoftDelete_whenOwned() {
        UUID user = databasePopulator.populateUser("custom-delete@test.local");
        CustomWorkoutResponse created = trainService.createCustomWorkout(user, upsert("Törlendő", "Row"));
        trainService.deleteCustomWorkout(user, created.getId());
        assertThat(trainService.listCustomWorkouts(user)).isEmpty();
    }

    @Test
    void testUpdateCustomWorkout_shouldThrowNotFound_whenForeignRow() {
        UUID a = databasePopulator.populateUser("custom-foreign-a@test.local");
        UUID b = databasePopulator.populateUser("custom-foreign-b@test.local");
        CustomWorkoutResponse created = trainService.createCustomWorkout(a, upsert("A-é", "Row"));
        assertThatThrownBy(() -> trainService.updateCustomWorkout(b, created.getId(), upsert("Hijack", "Row")))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=CustomWorkoutIT`
Expected: COMPILE FAILURE — `TrainService.createCustomWorkout` does not exist yet (the generated DTOs from Task 5 DO exist).

- [ ] **Step 3: Implement `TrainService` methods** — add after `replaceDayExercises` (imports to add: `io.mrkuhne.mezo.api.dto.CustomWorkoutResponse`, `io.mrkuhne.mezo.api.dto.CustomWorkoutUpsertRequest`, `java.util.Map`, `java.util.stream.Collectors` — keep existing import ordering):

```java
    // ── Saját edzés (custom workout templates, mezo-ws2x) ─────────────────────────
    // A custom template is a meso-less workout_session TEMPLATE row (origin='custom',
    // mesocycleId null, templateSessionId null); its name lives in `type` (like meso day
    // titles) and its exercises are ordinary recipe rows, so the whole instance machinery
    // (start/log/finish/records/prescriptions) works on it unchanged.

    /** The owner's custom (saját) workout templates, oldest first. */
    public List<CustomWorkoutResponse> listCustomWorkouts(UUID createdBy) {
        List<WorkoutSessionEntity> templates = workoutSessionRepository
            .findByCreatedByAndOriginAndTemplateSessionIdIsNullOrderByCreatedAtAsc(createdBy, "custom");
        if (templates.isEmpty()) {
            return List.of();
        }
        List<ExerciseEntity> exercises = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, templates.stream().map(WorkoutSessionEntity::getId).toList());
        Map<UUID, List<ExerciseEntity>> byTemplate = exercises.stream()
            .collect(Collectors.groupingBy(ExerciseEntity::getWorkoutSessionId));
        Map<UUID, String> videos = videosByCatalog(exercises);
        return templates.stream()
            .map(t -> toCustomWorkoutResponse(t, byTemplate.getOrDefault(t.getId(), List.of()), videos))
            .toList();
    }

    @Transactional
    public CustomWorkoutResponse createCustomWorkout(UUID createdBy, CustomWorkoutUpsertRequest req) {
        WorkoutSessionEntity template = new WorkoutSessionEntity();
        template.setCreatedBy(createdBy); // server-side ownership — never from the client
        template.setOrigin("custom");
        template.setDayLabel(""); // custom templates are not weekday-bound
        template.setType(req.getName());
        template.setStatus("planned");
        WorkoutSessionEntity saved = workoutSessionRepository.save(template);
        return replaceCustomExercises(createdBy, saved, req.getExercises());
    }

    @Transactional
    public CustomWorkoutResponse updateCustomWorkout(UUID createdBy, UUID id, CustomWorkoutUpsertRequest req) {
        WorkoutSessionEntity template = ownedCustomTemplateOrThrow(createdBy, id);
        template.setType(req.getName());
        return replaceCustomExercises(createdBy, template, req.getExercises());
    }

    @Transactional
    public void deleteCustomWorkout(UUID createdBy, UUID id) {
        // Soft delete (@SQLDelete) — completed instances and their sets keep feeding
        // records/history (the record identity read includes soft-deleted rows).
        workoutSessionRepository.delete(ownedCustomTemplateOrThrow(createdBy, id));
    }

    /** An owned CUSTOM template row by id — missing/foreign/meso-origin/instance rows are all 404. */
    private WorkoutSessionEntity ownedCustomTemplateOrThrow(UUID createdBy, UUID id) {
        return OwnershipGuard.ownedOrThrow(
            workoutSessionRepository.findById(id)
                .filter(s -> "custom".equals(s.getOrigin()) && s.getTemplateSessionId() == null),
            createdBy);
    }

    /** Full-list replace, same soft-delete + re-insert pattern as {@link #replaceDayExercises}. */
    private CustomWorkoutResponse replaceCustomExercises(
            UUID createdBy, WorkoutSessionEntity template, List<GymExerciseInput> inputs) {
        exerciseRepository.deleteAll(exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(template.getId())));
        List<ExerciseEntity> fresh = new ArrayList<>(inputs.size());
        for (int i = 0; i < inputs.size(); i++) {
            fresh.add(toExerciseEntity(createdBy, template.getId(), inputs.get(i), i));
        }
        List<ExerciseEntity> saved = exerciseRepository.saveAll(fresh);
        return toCustomWorkoutResponse(template, saved, videosByCatalog(saved));
    }

    private CustomWorkoutResponse toCustomWorkoutResponse(
            WorkoutSessionEntity template, List<ExerciseEntity> exercises, Map<UUID, String> videos) {
        return CustomWorkoutResponse.builder()
            .id(template.getId())
            .name(template.getType())
            .exercises(toDay(template, exercises, videos).getExercises())
            .build();
    }
```

(If `toDay`'s exact signature differs — check its declaration in this class — adapt the `toCustomWorkoutResponse` call to it; the goal is reusing the existing exercise→`GymExercise` mapping.)

- [ ] **Step 4: Implement the controller overrides** — in `TrainController.java` after the `replaceDayExercises` override (imports: `CustomWorkoutResponse`, `CustomWorkoutUpsertRequest`; match the generated `TrainApi` signatures exactly — the file already returns bare DTOs):

```java
    @Override
    public List<CustomWorkoutResponse> listCustomWorkouts() {
        return service.listCustomWorkouts(currentUserId.get());
    }

    @Override
    public CustomWorkoutResponse createCustomWorkout(CustomWorkoutUpsertRequest customWorkoutUpsertRequest) {
        return service.createCustomWorkout(currentUserId.get(), customWorkoutUpsertRequest);
    }

    @Override
    public CustomWorkoutResponse updateCustomWorkout(UUID id, CustomWorkoutUpsertRequest customWorkoutUpsertRequest) {
        return service.updateCustomWorkout(currentUserId.get(), id, customWorkoutUpsertRequest);
    }

    @Override
    public void deleteCustomWorkout(UUID id) {
        service.deleteCustomWorkout(currentUserId.get(), id);
    }
```

- [ ] **Step 5: Run the IT to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=CustomWorkoutIT`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(train): custom workout template CRUD — meso-less template days (mezo-ws2x)"
```

### Task 7: Backend flow — start guards, `getToday` meso-independence, counting semantics

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java` (`findDoneInstanceDates` query)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java` (`toWorkoutSummary` title mapping)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/CustomWorkoutIT.java` (extend)

**Interfaces:**
- Consumes: Task 6's `TrainService.createCustomWorkout`; existing `WorkoutService.startWorkout/getToday/finishWorkout/listWorkouts`.
- Produces: D2 (instances inherit `origin`), D3 (D5 guard skipped for custom, D6 kept), D4 (`getToday` open-instance + param branches resolve without an active meso; `completedWorkout` null for custom days), D5 (`findDoneInstanceDates` meso-only), D6 (summaries carry `origin` + `title`). Task 8+ consume the wire shapes.

- [ ] **Step 1: Extend `CustomWorkoutIT` with failing flow tests** (add these test methods + the extra autowires):

```java
    @Autowired private io.mrkuhne.mezo.feature.train.service.WorkoutService workoutService;
    @Autowired private io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository workoutSessionRepository;
```

```java
    private static io.mrkuhne.mezo.api.dto.WorkoutStartRequest startRequest(UUID templateId) {
        return io.mrkuhne.mezo.api.dto.WorkoutStartRequest.builder().templateSessionId(templateId).build();
    }

    @Test
    void testStartWorkout_shouldCopyCustomOrigin_whenCustomTemplate() {
        UUID user = databasePopulator.populateUser("custom-origin@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Saját", "Row"));
        var instance = workoutService.startWorkout(user, startRequest(cw.getId()));
        assertThat(workoutSessionRepository.findById(instance.getId()).orElseThrow().getOrigin())
            .isEqualTo("custom");
    }

    @Test
    void testStartWorkout_shouldAllowRepeatSameWeek_whenCustomTemplate() {
        UUID user = databasePopulator.populateUser("custom-repeat@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Saját", "Row"));
        var first = workoutService.startWorkout(user, startRequest(cw.getId()));
        workoutService.finishWorkout(user, first.getId());
        // D5 (once per week) must NOT apply to custom templates — a second same-week start succeeds.
        var second = workoutService.startWorkout(user, startRequest(cw.getId()));
        assertThat(second.getId()).isNotEqualTo(first.getId());
    }

    @Test
    void testStartWorkout_shouldThrowOpenElsewhere_whenAnotherWorkoutOpen() {
        UUID user = databasePopulator.populateUser("custom-d6@test.local");
        CustomWorkoutResponse a = trainService.createCustomWorkout(user, upsert("A", "Row"));
        CustomWorkoutResponse b = trainService.createCustomWorkout(user, upsert("B", "Bench"));
        workoutService.startWorkout(user, startRequest(a.getId()));
        assertThatThrownBy(() -> workoutService.startWorkout(user, startRequest(b.getId())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("TRAIN_WORKOUT_OPEN_ELSEWHERE");
    }

    @Test
    void testGetToday_shouldResolveCustomTemplate_whenNoActiveMeso() {
        UUID user = databasePopulator.populateUser("custom-nomeso@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Meso nélkül", "Row"));
        var today = workoutService.getToday(user, cw.getId());
        assertThat(today.getTemplateSessionId()).isEqualTo(cw.getId());
        assertThat(today.getTitle()).isEqualTo("Meso nélkül");
        assertThat(today.getExercises()).hasSize(1);
    }

    @Test
    void testGetToday_shouldPreferOpenCustomInstance_whenNoParam() {
        UUID user = databasePopulator.populateUser("custom-openwins@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Nyitott", "Row"));
        workoutService.startWorkout(user, startRequest(cw.getId()));
        var today = workoutService.getToday(user, null);
        assertThat(today.getTemplateSessionId()).isEqualTo(cw.getId());
        assertThat(today.getOpenWorkout()).isNotNull();
    }

    @Test
    void testGetToday_shouldNotSetCompletedWorkout_whenCustomCompletedThisWeek() {
        UUID user = databasePopulator.populateUser("custom-nocompleted@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Ismételhető", "Row"));
        var instance = workoutService.startWorkout(user, startRequest(cw.getId()));
        workoutService.finishWorkout(user, instance.getId());
        var today = workoutService.getToday(user, cw.getId());
        // A custom day is repeatable — it must never flip the FE into the review redirect.
        assertThat(today.getCompletedWorkout()).isNull();
        // ...and it must not tick the plan-adherence weekly done dates (D5 semantics).
        assertThat(today.getWeekDoneDates()).isEmpty();
    }

    @Test
    void testAutoCloseStale_shouldSettleCustomInstance_whenPastActiveWithSet() {
        UUID user = databasePopulator.populateUser("custom-autoclose@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Tegnapi", "Row"));
        var instance = workoutService.startWorkout(user, startRequest(cw.getId()));
        workoutService.logSet(user, instance.getId(), io.mrkuhne.mezo.api.dto.SetLogRequest.builder()
            .exerciseId(cw.getExercises().get(0).getId()).setIndex(0).weightKg(java.math.BigDecimal.valueOf(60)).reps(8).build());
        // Age the open instance to yesterday, then any getToday lazily settles it (mezo-cd8s).
        WorkoutSessionEntity aged = workoutSessionRepository.findById(instance.getId()).orElseThrow();
        aged.setDate(java.time.LocalDate.now().minusDays(1));
        workoutSessionRepository.save(aged);
        workoutService.getToday(user, null);
        assertThat(workoutSessionRepository.findById(instance.getId()).orElseThrow().getStatus())
            .isEqualTo("completed");
    }

    @Test
    void testListWorkouts_shouldCarryOriginAndTitle_whenCustomCompleted() {
        UUID user = databasePopulator.populateUser("custom-summary@test.local");
        CustomWorkoutResponse cw = trainService.createCustomWorkout(user, upsert("Pihenőnapi felső", "Row"));
        var instance = workoutService.startWorkout(user, startRequest(cw.getId()));
        workoutService.finishWorkout(user, instance.getId());
        java.time.LocalDate today = java.time.LocalDate.now();
        var summaries = workoutService.listWorkouts(user, today.minusDays(1), today.plusDays(1));
        assertThat(summaries).hasSize(1);
        assertThat(summaries.get(0).getOrigin().getValue()).isEqualTo("custom");
        assertThat(summaries.get(0).getTitle()).isEqualTo("Pihenőnapi felső");
    }
```

(If `finishWorkout`'s signature differs — check it in `WorkoutService` — adapt the calls; it takes `(UUID createdBy, UUID workoutId)` per the controller delegation.)

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd backend && ./mvnw clean test -Dtest=CustomWorkoutIT`
Expected: the Task 6 tests still PASS; the new ones FAIL (`getToday` returns empty without a meso; second same-week start 409s; summaries lack origin/title).

- [ ] **Step 3: Implement `WorkoutService.startWorkout` changes** — inside the method: (a) after the template lookup + resume branch, make the D5 guard origin-aware; (b) copy origin onto the instance:

Replace:

```java
        if (completedThisWeek(createdBy, template.getId()) != null) {
```

with:

```java
        // D5 is plan-adherence: a custom (saját) template is repeatable any time (mezo-ws2x).
        if (!"custom".equals(template.getOrigin()) && completedThisWeek(createdBy, template.getId()) != null) {
```

and after `instance.setMesocycleId(template.getMesocycleId());` add:

```java
        instance.setOrigin(template.getOrigin());
```

- [ ] **Step 4: Implement the `getToday` restructure** — replace the block from the `MesocycleEntity activeMeso = ...` lookup down to (and including) the `if (day == null) { return empty; }` guard with:

```java
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        // Fix zárás: idempotent ensure across ALL template days of the active meso, BEFORE
        // today's exercise list is resolved — its own @Transactional (getToday itself is a read).
        if (activeMeso != null && closingBlockGate.getIfAvailable() != null) {
            closingBlockService.ensureClosingExercises(createdBy, activeMeso.getId());
        }
        // Gym done-state signal: this week's completed MESO-ORIGIN instance dates (custom
        // never ticks the planned rows — mezo-ws2x D5). Computed regardless of whether
        // today is a gym day, so the weekly rows can mark PAST done days.
        List<LocalDate> weekDoneDates = doneDatesThisWeek(createdBy);
        empty.setWeekDoneDates(weekDoneDates);
        // Day resolution (mezo-p7rp + mezo-ws2x): open instance > param > weekday label.
        // The open-instance and param branches are meso-INDEPENDENT — a custom (saját)
        // workout must resolve with no active meso too; only the weekday fallback needs one.
        WorkoutSessionEntity open = workoutSessionRepository
            .findFirstByCreatedByAndStatusAndTemplateSessionIdIsNotNullOrderByDateDescCreatedAtDesc(
                createdBy, "active")
            .orElse(null);
        WorkoutSessionEntity day;
        if (open != null) {
            day = ownedTemplateOrThrow(createdBy, open.getTemplateSessionId());
        } else if (templateSessionId != null) {
            day = ownedTemplateOrThrow(createdBy, templateSessionId);
        } else if (activeMeso != null) {
            day = findPlannedTemplateForDate(createdBy, LocalDate.now()).orElse(null);
        } else {
            day = null;
        }
        if (day == null) {
            return empty;
        }
```

(The old `if (activeMeso == null) { return empty; }` early return is deleted — that is the point of D4.)

Then replace the `completedToday` resolution line with:

```java
        // A custom day is repeatable — completedWorkout would trigger the FE review
        // redirect, so it stays null for custom-origin days (mezo-ws2x D4).
        WorkoutSessionEntity completedToday =
            "custom".equals(day.getOrigin()) ? null : completedThisWeek(createdBy, day.getId());
```

- [ ] **Step 5: Meso-only `findDoneInstanceDates`** — in `WorkoutSessionRepository`, add one predicate line to that query only (NOT to `findDoneInstancesBetween`):

```java
    @Query("""
        SELECT DISTINCT s.date FROM WorkoutSessionEntity s
        WHERE s.createdBy = :createdBy
          AND s.templateSessionId IS NOT NULL
          AND s.origin = 'meso'
          AND s.date BETWEEN :from AND :to
          AND s.status = 'completed'
        """)
```

Update the query's javadoc to note custom-origin instances are excluded (plan-adherence semantics, mezo-ws2x).

- [ ] **Step 6: Summary mapping** — in `TrainMapper`, the entity's `origin` auto-maps to the generated enum exactly like the existing `status` field; only `title` needs an explicit mapping. Change:

```java
    WorkoutSummaryResponse toWorkoutSummary(WorkoutSessionEntity entity);
```

to:

```java
    @Mapping(target = "title", source = "type")
    WorkoutSummaryResponse toWorkoutSummary(WorkoutSessionEntity entity);
```

(Add the `org.mapstruct.Mapping` import if missing.)

- [ ] **Step 7: Run the full custom IT + the guard/flow neighbours**

Run: `cd backend && ./mvnw clean test -Dtest='CustomWorkoutIT,CrossDayWorkoutIT,WorkoutDoneSemanticsIT,WorkoutAutoCloseIT'`
Expected: ALL PASS — the meso-flow ITs prove the restructure/guard changes did not regress p7rp/cd8s behavior.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(train): custom start guards, meso-independent getToday, meso-only done dates, summary origin/title (mezo-ws2x)"
```

### Task 8: FE data layer — client, types, fixtures, hooks

**Files:**
- Modify: `frontend/src/data/train/trainApi.ts`
- Modify: `frontend/src/data/types.ts` (add `CustomWorkout`)
- Modify: `frontend/src/data/train/train.ts` (add `customWorkoutsMock`)
- Create: `frontend/src/data/train/customWorkoutHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel re-export)
- Test: `frontend/src/data/train/customWorkoutHooks.test.ts` (create)

**Interfaces:**
- Consumes: Task 5's generated `CustomWorkoutResponse`/`CustomWorkoutUpsertRequest` schema types.
- Produces: `useCustomWorkouts(): { customWorkouts: CustomWorkout[]; customPending: boolean }` and `useCustomWorkoutActions(): { createCustomWorkout, updateCustomWorkout, deleteCustomWorkout, savePending }` re-exported from `@/data/hooks`; FE type `CustomWorkout { id, name, exercises: GymExercise[] }`; fixture `customWorkoutsMock` (1 template, 3 exercises). Tasks 10–12 consume these.

- [ ] **Step 1: Write the failing hook test** — create `customWorkoutHooks.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { useCustomWorkouts } from '@/data/train/customWorkoutHooks'
import { customWorkoutsMock } from '@/data/train/train'

afterEach(() => vi.unstubAllEnvs())

describe('useCustomWorkouts', () => {
  it('mock mode: serves the static fixtures synchronously', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useCustomWorkouts(), { wrapper: makeHookWrapper() })
    expect(result.current.customWorkouts).toEqual(customWorkoutsMock)
    expect(result.current.customPending).toBe(false)
  })

  it('real mode: fetches and maps the template list', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/train/custom-workouts`, () => HttpResponse.json([
      { id: 'cw-real-1', name: 'Pihenőnapi felső', exercises: [] },
    ])))
    const { result } = renderHook(() => useCustomWorkouts(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.customWorkouts).toHaveLength(1))
    expect(result.current.customWorkouts[0].name).toBe('Pihenőnapi felső')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test customWorkoutHooks`
Expected: FAIL — module `@/data/train/customWorkoutHooks` does not exist.

- [ ] **Step 3: Implement the data layer.**

`trainApi.ts` — add to the type exports:

```ts
export type CustomWorkoutResponse = components['schemas']['CustomWorkoutResponse']
export type CustomWorkoutUpsertRequest = components['schemas']['CustomWorkoutUpsertRequest']
```

and to the `trainApi` object:

```ts
  customWorkouts: (): Promise<CustomWorkoutResponse[]> =>
    apiFetch<CustomWorkoutResponse[]>('/api/train/custom-workouts'),
  createCustomWorkout: (body: CustomWorkoutUpsertRequest): Promise<CustomWorkoutResponse> =>
    apiFetch<CustomWorkoutResponse>('/api/train/custom-workouts', { method: 'POST', body: JSON.stringify(body) }),
  updateCustomWorkout: (id: string, body: CustomWorkoutUpsertRequest): Promise<CustomWorkoutResponse> =>
    apiFetch<CustomWorkoutResponse>(`/api/train/custom-workouts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCustomWorkout: (id: string): Promise<void> =>
    apiFetch<void>(`/api/train/custom-workouts/${id}`, { method: 'DELETE' }),
```

`types.ts` — after the `MesoDay` interface:

```ts
export interface CustomWorkout {
  id: string
  name: string
  exercises: GymExercise[]
}
```

`train.ts` — add `CustomWorkout` to the existing `@/data/types` type import, then add near the other train fixtures:

```ts
// Saved custom (saját) workout templates — mock parity for the entry sheet/composer (mezo-ws2x).
export const customWorkoutsMock: CustomWorkout[] = [
  {
    id: 'custom-1',
    name: 'Pihenőnapi felső',
    exercises: [
      { id: 'cw1-1', name: 'Incline DB Press', muscle: 'chest', warmupSets: 1, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
      { id: 'cw1-2', name: 'Lat Pulldown', muscle: 'lats', warmupSets: 1, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'compound' },
      { id: 'cw1-3', name: 'Lateral Raise', muscle: 'shoulder', warmupSets: 0, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
    ],
  },
]
```

`customWorkoutHooks.ts` — full file:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { trainApi, type CustomWorkoutResponse, type CustomWorkoutUpsertRequest } from '@/data/train/trainApi'
import { customWorkoutsMock } from '@/data/train/train'
import type { CustomWorkout } from '@/data/types'

// The contract exercises are structurally identical to the FE GymExercise (targetRIR
// et al.) — the boundary cast mirrors toMesocycle's idiom (trainHooks.ts).
function toCustomWorkout(r: CustomWorkoutResponse): CustomWorkout {
  return { id: r.id, name: r.name, exercises: r.exercises as CustomWorkout['exercises'] }
}

/** The owner's saved custom (saját) workout templates. Mock: static fixtures, synchronous. */
export function useCustomWorkouts() {
  const mock = isMockMode()
  const q = useQuery<CustomWorkout[]>({
    queryKey: ['train', 'customWorkouts'],
    queryFn: mock
      ? async () => customWorkoutsMock
      : () => trainApi.customWorkouts().then((rs) => rs.map(toCustomWorkout)),
    initialData: mock ? customWorkoutsMock : undefined,
  })
  return { customWorkouts: q.data ?? [], customPending: !mock && q.isPending }
}

type SaveCb = { onSuccess?: (r?: CustomWorkout) => void; onSettled?: () => void }

/** Custom-workout template CRUD. Mock mode no-ops every write (visual parity only). */
export function useCustomWorkoutActions() {
  const mock = isMockMode()
  const qc = useQueryClient()
  const invalidate = () => {
    if (!mock) qc.invalidateQueries({ queryKey: ['train', 'customWorkouts'] })
  }
  const createM = useMutation({
    mutationFn: mock
      ? async (_body: CustomWorkoutUpsertRequest) => undefined
      : (body: CustomWorkoutUpsertRequest) => trainApi.createCustomWorkout(body).then(toCustomWorkout),
    onSuccess: invalidate,
  })
  const updateM = useMutation({
    mutationFn: mock
      ? async (_args: { id: string; body: CustomWorkoutUpsertRequest }) => undefined
      : (args: { id: string; body: CustomWorkoutUpsertRequest }) =>
          trainApi.updateCustomWorkout(args.id, args.body).then(toCustomWorkout),
    onSuccess: invalidate,
  })
  const deleteM = useMutation({
    mutationFn: mock ? async (_id: string) => undefined : (id: string) => trainApi.deleteCustomWorkout(id),
    onSuccess: invalidate,
  })
  return {
    createCustomWorkout: (body: CustomWorkoutUpsertRequest, cb?: SaveCb) =>
      createM.mutate(body, { onSuccess: (r) => cb?.onSuccess?.(r ?? undefined), onSettled: cb?.onSettled }),
    updateCustomWorkout: (args: { id: string; body: CustomWorkoutUpsertRequest }, cb?: SaveCb) =>
      updateM.mutate(args, { onSuccess: (r) => cb?.onSuccess?.(r ?? undefined), onSettled: cb?.onSettled }),
    deleteCustomWorkout: (id: string, cb?: SaveCb) =>
      deleteM.mutate(id, { onSuccess: () => cb?.onSuccess?.(), onSettled: cb?.onSettled }),
    savePending: createM.isPending || updateM.isPending,
  }
}
```

`hooks.ts` barrel — after the `useWorkoutDetail, useWeekWorkouts` line:

```ts
export { useCustomWorkouts, useCustomWorkoutActions } from '@/data/train/customWorkoutHooks'
```

- [ ] **Step 4: Run to verify it passes (both modes)**

Run: `cd frontend && pnpm test customWorkoutHooks && VITE_USE_MOCK=true pnpm test customWorkoutHooks`
Expected: PASS in both.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data
git commit -m "feat(data): custom-workout client + dual-mode hooks + mock fixtures (mezo-ws2x)"
```

### Task 9: Extract the shared `ExerciseRecipeRow`

**Files:**
- Create: `frontend/src/features/train/components/ExerciseRecipeRow.tsx`
- Modify: `frontend/src/features/train/components/MesoDayTabsEditor.tsx`
- Test: existing `frontend/src/features/train/components/MesoDayTabsEditor.test.tsx` (must stay green — no behavior change)

**Interfaces:**
- Produces: `export function ExerciseRecipeRow({ ex, onRemove, onChange }: { ex: GymExercise; onRemove: () => void; onChange: (patch: Partial<GymExercise>) => void })` — Task 10's composer consumes it.

- [ ] **Step 1: Move the code.** Create `ExerciseRecipeRow.tsx` containing — moved VERBATIM from `MesoDayTabsEditor.tsx` — the `RecipeRow` component (renamed `ExerciseRecipeRow`, now `export function`), plus the private `RecipeStepper` and `AnchorStepper` helpers and their comments. File header + imports:

```tsx
// ============================================================
// Mezo · ExerciseRecipeRow — one exercise's recipe editor row (name +
// muscle + remove ✕ + the six always-visible recipe steppers). Shared by
// MesoDayTabsEditor (planner/builder) and CustomWorkoutBuilderPage (saját
// edzés composer, mezo-ws2x). Extracted verbatim from MesoDayTabsEditor.
// ============================================================
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
```

- [ ] **Step 2: Rewire `MesoDayTabsEditor.tsx`** — delete the three moved functions, add `import { ExerciseRecipeRow } from '@/features/train/components/ExerciseRecipeRow'`, and change the render call `<RecipeRow ...>` → `<ExerciseRecipeRow ...>` (same props). Remove now-unused imports (`MUSCLE_LABELS` stays only if still referenced elsewhere in the file — it is, by the day header? verify; drop if unused).

- [ ] **Step 3: Verify no behavior change**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test MesoDayTabsEditor && pnpm build`
Expected: PASS + clean build (catches unused-import errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/train/components
git commit -m "refactor(train): extract shared ExerciseRecipeRow from MesoDayTabsEditor (mezo-ws2x)"
```

### Task 10: Composer — `CustomWorkoutBuilderPage` + routes

**Files:**
- Create: `frontend/src/features/train/pages/CustomWorkoutBuilderPage.tsx`
- Modify: `frontend/src/app/router.tsx`
- Test: `frontend/src/features/train/pages/CustomWorkoutBuilderPage.test.tsx` (create)

**Interfaces:**
- Consumes: Task 8 hooks (`useCustomWorkouts`, `useCustomWorkoutActions`), Task 9's `ExerciseRecipeRow`, existing `ExercisePickerSheet` (`onPick(item: ExerciseLibraryItem)`, stays open across picks), `SortableList`, `useTrain` (indirectly via the picker).
- Produces: routes `/train/custom/new` and `/train/custom/:id` (full-screen siblings, no sub-nav). Task 11's sheet navigates here.

- [ ] **Step 1: Write the failing tests** — create `CustomWorkoutBuilderPage.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CustomWorkoutBuilderPage } from '@/features/train/pages/CustomWorkoutBuilderPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => render(
  <QueryWrapper>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/train/custom/new" element={<CustomWorkoutBuilderPage />} />
        <Route path="/train/custom/:id" element={<CustomWorkoutBuilderPage />} />
      </Routes>
    </MemoryRouter>
  </QueryWrapper>,
)

test('new composer: save disabled until name + at least one exercise', () => {
  renderAt('/train/custom/new')
  const save = screen.getByRole('button', { name: 'Mentés' })
  expect(save).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Edzés neve'), { target: { value: 'Vasárnapi push' } })
  expect(save).toBeDisabled() // still no exercise
})

test('the picker adds a catalog exercise as a recipe row', () => {
  renderAt('/train/custom/new')
  fireEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  // ExercisePickerSheet lists the mock exercise library; pick the first row.
  fireEvent.click(screen.getAllByRole('button', { name: /hozzáadása$/ })[0])
  // The picked exercise lands as an ExerciseRecipeRow (recipe steppers appear).
  expect(screen.getAllByText('Work').length).toBeGreaterThan(0)
})

test('editing an existing custom workout prefills name + exercises', () => {
  renderAt('/train/custom/custom-1')
  expect(screen.getByLabelText('Edzés neve')).toHaveValue('Pihenőnapi felső')
  expect(screen.getByText('Incline DB Press')).toBeInTheDocument()
  expect(screen.getByText('Lateral Raise')).toBeInTheDocument()
})
```

Note: check `ExercisePickerSheet`'s actual per-row button aria-label/name before finalizing the second test's pick selector (open the file; the row buttons flash `Hozzáadva ✓` and carry the exercise name). Adjust the selector to the real accessible name — the assertion (a recipe row appears) stays.

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test CustomWorkoutBuilderPage`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the page** — create `CustomWorkoutBuilderPage.tsx`:

```tsx
// ============================================================
// Mezo · CustomWorkoutBuilderPage — the "Saját edzés" composer (mezo-ws2x).
// Full-screen sibling route (/train/custom/new | /train/custom/:id): name +
// recipe exercise list (shared ExerciseRecipeRow + multi-add ExercisePickerSheet).
// "Mentés" persists via the custom-workout CRUD hooks; "Indítás ma →" saves,
// then jumps into the active session pinned to the template (?day=).
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCustomWorkouts, useCustomWorkoutActions } from '@/data/hooks'
import type { CustomWorkoutUpsertRequest } from '@/data/train/trainApi'
import type { CustomWorkout, ExerciseLibraryItem, GymExercise } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'
import { ExerciseRecipeRow } from '@/features/train/components/ExerciseRecipeRow'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'

const DEFAULT_RECIPE = { warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 1 } as const

function toUpsert(name: string, exercises: GymExercise[]): CustomWorkoutUpsertRequest {
  return {
    name: name.trim(),
    exercises: exercises.map((e) => ({
      name: e.name, muscle: e.muscle,
      warmupSets: e.warmupSets, workingSets: e.workingSets,
      repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
      anchorWeightKg: e.anchorWeightKg, type: e.type, catalogId: e.catalogId,
    })),
  }
}

export function CustomWorkoutBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { customWorkouts } = useCustomWorkouts()
  const { createCustomWorkout, updateCustomWorkout, savePending } = useCustomWorkoutActions()
  const existing: CustomWorkout | null = customWorkouts.find((w) => w.id === id) ?? null

  const [name, setName] = useState('')
  const [exercises, setExercises] = useState<GymExercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  // Derived-state reset: real mode loads the template async — prefill once it lands.
  const [loadedId, setLoadedId] = useState<string | null>(null)
  if (existing && loadedId !== existing.id) {
    setLoadedId(existing.id)
    setName(existing.name)
    setExercises(existing.exercises)
  }

  const valid = name.trim().length > 0 && exercises.length > 0
  const totalSets = exercises.reduce((a, e) => a + e.workingSets, 0)

  const addFromCatalog = (item: ExerciseLibraryItem) => {
    setExercises((xs) => [...xs, {
      id: crypto.randomUUID(), name: item.name, muscle: item.muscle, type: item.type,
      ...DEFAULT_RECIPE, anchorWeightKg: null, catalogId: item.catalogId,
    }])
  }
  const save = (onDone?: (saved?: CustomWorkout) => void) => {
    const body = toUpsert(name, exercises)
    if (existing) updateCustomWorkout({ id: existing.id, body }, { onSuccess: onDone })
    else createCustomWorkout(body, { onSuccess: onDone })
  }
  const startNow = () => save((saved) => {
    // Mock writes no-op (no id back) — the plain session route keeps prototype parity.
    navigate(saved?.id ? `/train/session?day=${saved.id}` : '/train/session', { replace: true })
  })

  return (
    <>
      <div className="pghead-np">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="over"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            ← Edzés · Saját edzés
          </button>
          <h1>{existing ? 'Saját edzés' : 'Új saját edzés'}</h1>
        </div>
      </div>

      <div style={{ padding: '0 24px 12px' }}>
        <label className="col gap-xs" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          Edzés neve
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pl. Pihenőnapi felső"
            maxLength={120}
            className="card"
            style={{ padding: '10px 12px', fontSize: 14, color: 'var(--text-primary)', background: 'var(--surface-1)' }}
          />
        </label>
      </div>

      <div style={{ padding: '0 24px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="eyebrow">Gyakorlatok</span>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
            {exercises.length} gyakorlat · {totalSets} szett
          </span>
        </div>
        <div className="col gap-sm">
          <SortableList
            items={exercises.map((e) => ({ ...e, label: e.name }))}
            onReorder={(ids) => setExercises((xs) => ids.flatMap((i) => xs.find((x) => x.id === i) ?? []))}
            renderItem={(e) => (
              <ExerciseRecipeRow
                ex={e}
                onRemove={() => setExercises((xs) => xs.filter((x) => x.id !== e.id))}
                onChange={(patch) => setExercises((xs) => xs.map((x) => (x.id === e.id ? { ...x, ...patch } : x)))}
              />
            )}
          />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="card"
            style={{
              padding: 12, width: '100%', background: 'transparent', borderStyle: 'dashed',
              borderColor: 'var(--line)', color: 'var(--tag-gym)', fontSize: 10,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Icon name="plus" size={12} /> Gyakorlat hozzáadása
          </button>
        </div>
      </div>

      <div className="row gap-sm" style={{ padding: '0 24px 32px' }}>
        <button
          type="button"
          disabled={!valid || savePending}
          onClick={() => save(() => navigate(-1))}
          className="card np-press"
          style={{ flex: 1, padding: '12px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}
        >
          Mentés
        </button>
        <button
          type="button"
          disabled={!valid || savePending}
          onClick={startNow}
          className="np-cta np-press"
          style={{ flex: 2 }}
        >
          Indítás ma →
        </button>
      </div>

      {pickerOpen && (
        <ExercisePickerSheet dayLabel="Saját edzés" onPick={addFromCatalog} onClose={() => setPickerOpen(false)} />
      )}
    </>
  )
}
```

- [ ] **Step 4: Register the routes** — in `app/router.tsx`, add the import and, next to the `train/mesocycles/:id` sibling routes:

```tsx
import { CustomWorkoutBuilderPage } from '@/features/train/pages/CustomWorkoutBuilderPage'
```

```tsx
      { path: 'train/custom/new', element: <CustomWorkoutBuilderPage /> },
      { path: 'train/custom/:id', element: <CustomWorkoutBuilderPage /> },
```

- [ ] **Step 5: Run to verify the tests pass**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test CustomWorkoutBuilderPage`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/pages/CustomWorkoutBuilderPage.tsx frontend/src/features/train/pages/CustomWorkoutBuilderPage.test.tsx frontend/src/app/router.tsx
git commit -m "feat(train): saját edzés composer page + routes (mezo-ws2x)"
```

### Task 11: Entry sheet + entry points (Mai ×3, Gym chip)

**Files:**
- Create: `frontend/src/features/train/sheets/CustomWorkoutSheet.tsx`
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx` (rest-day card CTA, weekly-plan footer row, no-meso ghost row, sheet mount)
- Modify: `frontend/src/features/train/pages/GymPage.tsx` (header chip + sheet mount)
- Test: `frontend/src/features/train/sheets/CustomWorkoutSheet.test.tsx` (create), `frontend/src/features/train/pages/TrainTodayPage.test.tsx` + `GymPage.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 8's `useCustomWorkouts`; Task 10's routes; existing `Sheet` primitive (`onClose`, `labelledBy`, render-prop `close`).
- Produces: `CustomWorkoutSheet({ onClose }: { onClose: () => void })`.

- [ ] **Step 1: Write the failing sheet test** — `CustomWorkoutSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('lists the saved custom workouts with recipe meta + the new-CTA', () => {
  render(
    <QueryWrapper><MemoryRouter><CustomWorkoutSheet onClose={() => {}} /></MemoryRouter></QueryWrapper>,
  )
  expect(screen.getByText('Pihenőnapi felső')).toBeInTheDocument()
  expect(screen.getByText('3 gyakorlat · 9 szett')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Új összeállítása/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pihenőnapi felső szerkesztése' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test CustomWorkoutSheet`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the sheet** — `CustomWorkoutSheet.tsx`:

```tsx
// ============================================================
// Mezo · CustomWorkoutSheet — "Saját edzés" entry sheet (mezo-ws2x):
// the saved custom templates (tap → start via /train/session?day=,
// ✎ → composer) + "Új összeállítása". Opened from Mai (rest-day card,
// weekly-plan footer, no-meso ghost) and GymPage's header chip.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useCustomWorkouts } from '@/data/hooks'

export function CustomWorkoutSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { customWorkouts } = useCustomWorkouts()
  return (
    <Sheet onClose={onClose} labelledBy="custom-workout-title">
      {(close) => (
        <>
          <div className="col" style={{ marginBottom: 12 }}>
            <span className="eyebrow brand">Saját edzés</span>
            <h2 id="custom-workout-title" style={{ fontSize: 18, marginTop: 4 }}>Mit nyomunk ma?</h2>
          </div>

          {customWorkouts.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              Még nincs mentett saját edzésed — rakd össze az elsőt.
            </p>
          )}

          <div className="col gap-sm" style={{ marginBottom: 12 }}>
            {customWorkouts.map((w) => (
              <div key={w.id} className="card row gap-sm" style={{ padding: '10px 12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => { navigate(`/train/session?day=${w.id}`); close() }}
                  className="col flex-1 np-press"
                  style={{ background: 'none', border: 'none', textAlign: 'left', minWidth: 0, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{w.name}</span>
                  <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {w.exercises.length} gyakorlat · {w.exercises.reduce((a, e) => a + e.workingSets, 0)} szett
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${w.name} szerkesztése`}
                  onClick={() => { navigate(`/train/custom/${w.id}`); close() }}
                  className="chip"
                  style={{ padding: '5px 8px', flexShrink: 0 }}
                >
                  ✎
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { navigate('/train/custom/new'); close() }}
            className="card"
            style={{
              padding: 12, width: '100%', background: 'transparent', borderStyle: 'dashed',
              borderColor: 'var(--line)', color: 'var(--tag-gym)', fontSize: 10,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Icon name="plus" size={12} /> Új összeállítása
          </button>
        </>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Wire the entry points.**

`TrainTodayPage.tsx`:
- import: `import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'`
- state: `const [customOpen, setCustomOpen] = useState(false)`
- **Rest-day card**: inside the `Ma pihenőnap` card, after the `<p>…</p>`, add:

```tsx
            <CtaGhost
              className="rad-12 mt-md"
              onClick={() => setCustomOpen(true)}
              style={{ borderColor: 'color-mix(in srgb, var(--tag-gym) 40%, transparent)', color: 'var(--tag-gym)' }}
            >
              <Icon name="plus" size={12} /> Saját edzés
            </CtaGhost>
```

- **Weekly-plan footer**: after the `agenda.map` day-rows `<div className="col gap-sm">…</div>`, add:

```tsx
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="card mt-md"
            style={{
              padding: 12, width: '100%', background: 'transparent', borderStyle: 'dashed',
              borderColor: 'var(--line)', color: 'var(--tag-gym)', fontSize: 10,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Icon name="plus" size={12} /> Saját edzés
          </button>
```

- **No-meso ghost branch** (the early-return when `!activeMeso`): the same dashed button, plus the sheet mount INSIDE that returned fragment (the branch returns before the main JSX):

```tsx
        <div style={{ padding: '0 24px 16px' }}>
          <button type="button" onClick={() => setCustomOpen(true)} className="card" style={{
            padding: 12, width: '100%', background: 'transparent', borderStyle: 'dashed',
            borderColor: 'var(--line)', color: 'var(--tag-gym)', fontSize: 10,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="plus" size={12} /> Saját edzés
          </button>
        </div>
        {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
```

(The `useState` for `customOpen` must be declared before the early returns — put it with the other `useState` calls at the top; hook order stays render-stable.)

- **Main JSX**: mount next to the other sheets:

```tsx
      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
```

`GymPage.tsx`:
- import + `const [customOpen, setCustomOpen] = useState(false)` (top, before early returns)
- header chip — inside the header's `row gap-sm` div, BEFORE the mock-gated `Időpontok` button (this one is NOT mock-gated):

```tsx
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="pgact-np np-press"
            style={{ background: 'var(--wash-gym)', color: 'var(--tag-gym)' }}
          >
            <Icon name="plus" size={12} /> Saját
          </button>
```

- mount at the bottom next to the other sheets:

```tsx
      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
```

- [ ] **Step 5: Entry-point tests.**

Append to `TrainTodayPage.test.tsx`:

```tsx
test('the weekly-plan footer opens the Saját edzés sheet (mezo-ws2x)', () => {
  renderView()
  fireEvent.click(screen.getAllByRole('button', { name: /Saját edzés/ })[0])
  expect(screen.getByText('Mit nyomunk ma?')).toBeInTheDocument()
  expect(screen.getByText('Pihenőnapi felső')).toBeInTheDocument()
})
```

Append to `GymPage.test.tsx`:

```tsx
test('the Saját header chip opens the custom workout sheet (mezo-ws2x)', () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: /Saját$/ }))
  expect(screen.getByText('Mit nyomunk ma?')).toBeInTheDocument()
})
```

- [ ] **Step 6: Run the touched test files**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test CustomWorkoutSheet TrainTodayPage GymPage`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/train/sheets/CustomWorkoutSheet.tsx frontend/src/features/train/sheets/CustomWorkoutSheet.test.tsx frontend/src/features/train/pages
git commit -m "feat(train): saját edzés entry sheet + Mai/Gym entry points (mezo-ws2x)"
```

### Task 12: Weekly agenda custom rows + Gym load tile

**Files:**
- Modify: `frontend/src/features/train/components/WeeklyDayRow.tsx` (`custom` on `WeeklyAgendaDay` + row rendering)
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx` (derive custom-by-date from `useWeekWorkouts`)
- Modify: `frontend/src/features/train/logic/weeklyLoad.ts` (Gym tile count)
- Test: `WeeklyDayRow.test.tsx` (extend), `frontend/src/features/train/logic/weeklyLoad.custom.test.ts` (create)

**Interfaces:**
- Consumes: Task 7's `WorkoutSummaryResponse.origin/title` (via the existing `useWeekWorkouts`).
- Produces: `WeeklyAgendaDay.custom?: { id: string; title: string }[]`; `WeeklyDayRowProps.onReviewCustom?: (id: string) => void`; `weeklyLoad` accepts the `custom` key.

- [ ] **Step 1: Write the failing tests.**

Append to `WeeklyDayRow.test.tsx`:

```tsx
it('renders a completed custom (saját) workout row and opens its review (mezo-ws2x)', () => {
  const onReviewCustom = vi.fn()
  const { container } = render(
    <WeeklyDayRow
      agenda={{ day: 'Szo', isToday: false, gym: null, sport: [], running: [], custom: [{ id: 'w9', title: 'Pihenőnapi felső' }] }}
      onStartGym={() => {}}
      onReviewCustom={onReviewCustom}
    />,
  )
  expect(screen.getByText('SAJÁT')).toBeInTheDocument()
  expect(screen.getByText('Pihenőnapi felső')).toBeInTheDocument()
  expect(screen.getByText('kész')).toBeInTheDocument()
  // a day with only a custom session is NOT a rest row
  expect(container.querySelector('.dayrow.rest')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button'))
  expect(onReviewCustom).toHaveBeenCalledWith('w9')
})
```

Create `weeklyLoad.custom.test.ts`:

```ts
import { expect, test } from 'vitest'
import { weeklyLoad } from '@/features/train/logic/weeklyLoad'

test('completed custom sessions add to the Gym tile count (mezo-ws2x)', () => {
  const tiles = weeklyLoad([
    { gym: { day: 'Hét', active: true, time: '18:00', duration: null, type: 'Push' } as never, sport: [], running: [], custom: [] },
    { gym: null, sport: [], running: [], custom: [{ id: 'w1', title: 'Pihenőnapi felső' }] },
  ])
  expect(tiles.find((t) => t.kind === 'gym')?.value).toBe('2×')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test WeeklyDayRow weeklyLoad`
Expected: FAIL — `SAJÁT` not rendered; gym tile shows `1×`.

- [ ] **Step 3: Implement `WeeklyDayRow`** — add to `WeeklyAgendaDay`:

```tsx
  /** Completed custom (saját) workout instances on this date — extra done rows (mezo-ws2x). */
  custom?: { id: string; title: string }[]
```

Add to `WeeklyDayRowProps` + destructure:

```tsx
  /** A completed custom (saját) workout row was tapped — open its review. */
  onReviewCustom?: (id: string) => void
```

Change `hasContent`:

```tsx
  const customItems = agenda.custom ?? []
  const hasContent = sessions.length > 0 || customItems.length > 0
```

After the `sessions.map(...)` block (still inside `.sess`), render the custom rows:

```tsx
        {customItems.map((c) => (
          <button
            key={c.id}
            type="button"
            className="s"
            onClick={onReviewCustom ? () => onReviewCustom(c.id) : undefined}
          >
            <span className="stag stag-gym">SAJÁT</span>
            {c.title}
            <span className="done-chip">kész</span>
          </button>
        ))}
```

- [ ] **Step 4: Implement `TrainTodayPage` derivation** — above the `agenda` construction add:

```tsx
  // Completed custom (saját) instances of this week, grouped by ISO date — extra
  // weekly rows on the date they were actually trained (mezo-ws2x).
  const customByDate = new Map<string, { id: string; title: string }[]>()
  for (const w of weekWorkouts) {
    if (w.origin === 'custom' && w.status === 'completed') {
      const list = customByDate.get(w.date) ?? []
      list.push({ id: w.id, title: w.title })
      customByDate.set(w.date, list)
    }
  }
```

In the `agenda` map add `custom: customByDate.get(weekDateIso(i)) ?? [],` and on `<WeeklyDayRow>` add:

```tsx
              onReviewCustom={(wid) => navigate(`/train/review/${wid}`)}
```

- [ ] **Step 5: Implement `weeklyLoad`** — change the signature's `Pick` to include `'custom'` and the gym block to:

```ts
export function weeklyLoad(agenda: Pick<WeeklyAgendaDay, 'gym' | 'sport' | 'running' | 'custom'>[]): LoadTile[] {
  const tiles: LoadTile[] = []

  const gymDays = agenda.filter((a) => a.gym)
  // Completed custom (saját) sessions are real gym load — they add to the count (mezo-ws2x).
  const customCount = agenda.reduce((n, a) => n + (a.custom?.length ?? 0), 0)
  const gymCount = gymDays.length + customCount
  if (gymCount) {
    const durs = gymDays.map((a) => a.gym!.duration).filter((d): d is number => d != null)
    const avg = durs.length ? Math.round(durs.reduce((x, y) => x + y, 0) / durs.length) : null
    tiles.push({ kind: 'gym', label: 'Gym', icon: '🏋️', value: avg ? `${gymCount}× · ${avg}p` : `${gymCount}×` })
  }
```

(The rest of the function is unchanged.)

- [ ] **Step 6: Run to verify green**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test WeeklyDayRow weeklyLoad TrainTodayPage`
Expected: PASS (all existing tests too — mock `weekWorkouts` is empty, so mock rendering is byte-identical).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/train/components/WeeklyDayRow.tsx frontend/src/features/train/components/WeeklyDayRow.test.tsx frontend/src/features/train/pages/TrainTodayPage.tsx frontend/src/features/train/logic
git commit -m "feat(train): weekly agenda custom rows + Gym load-tile counting (mezo-ws2x)"
```

### Task 13: Docs + full gates + ship

**Files:**
- Modify: `docs/features/train.md` (§2, §4, §5)

- [ ] **Step 1: Update `docs/features/train.md`:**
- **§2**: add a short **`Saját edzés`** paragraph after the `Gym` section: the three entry points → `CustomWorkoutSheet` → composer (`/train/custom/new|:id`, full-screen sibling route) → unchanged ActiveWorkout flow; repeatable (D5 skipped, D6 kept); completed instances as `SAJÁT` weekly rows + Gym load-tile count. Mention `mezo-ws2x` + the spec path.
- **§2 `Mai`/`Gym`**: mention the new entry points (rest-day card CTA, weekly footer row, no-meso ghost row, `+ Saját` header chip).
- **§4 Workout execution**: document `workout_session.origin` (`meso|custom`, instances inherit it), the `custom-workouts` CRUD endpoints + DTOs, the D5-guard exception, the meso-independent `getToday` resolution, `completedWorkout` suppression for custom, `findDoneInstanceDates` meso-only + `WorkoutSummaryResponse.origin/title`. Note the CRUD lives in `TrainService` (supersedes the spec's `CustomWorkoutService` naming).
- **§5**: extend the counting-semantics note: custom counts in records/prescriptions/Insights/companion/XP; excluded from weekly ✓ marks, quests, discipline.
- Add the sibling routes to the §2 route list (`/train/custom/new`, `/train/custom/:id`).

- [ ] **Step 2: Lint + full gates**

```bash
node scripts/lint-docs.mjs
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
cd ../backend && ./mvnw clean test -Dtest='CustomWorkoutIT,CrossDayWorkoutIT,WorkoutDoneSemanticsIT,WorkoutDetailContractIT,WorkoutAutoCloseIT'
```

Expected: all green (the FULL backend suite runs in CI).

- [ ] **Step 3: Commit, push, self-PR, merge**

```bash
git add docs/features/train.md
git commit -m "docs(features): train.md — saját edzés (custom workout) domain update (mezo-ws2x)"
git push -u origin feat/custom-workout
gh pr create --title "feat(train): saját edzés — custom workout templates (mezo-ws2x)" --body "Meso-less template days (origin column), CRUD + guards + meso-independent getToday, FE composer/sheet/agenda. Spec: docs/superpowers/specs/2026-07-23-custom-workout-design.md."
gh pr checks --watch
git checkout main && git pull --rebase
git merge --no-ff feat/custom-workout
git push
git branch -d feat/custom-workout
bd close mezo-ws2x
bd dolt push
git status   # MUST show "up to date with origin"
```

---

## Self-review notes

- Spec coverage: D1→T4/T6, D2→T7, D3→T7, D4→T7, D5→T7 (+IT), D6→T5/T7, D7→T5/T6, D8→T1/T2, D9→T12, D10→T9, D11 (mock parity)→T8/T10/T11; part A→T1–T3.
- Deviation from spec recorded: CRUD in `TrainService` (not a new `CustomWorkoutService`) — helper reuse; documented in T6 + T13.
- Verify-before-trust points flagged inline: `toDay` signature (T6), `finishWorkout` signature (T7), `ExercisePickerSheet` row accessible name (T10) — check the real code at execution time, adapt mechanically.
