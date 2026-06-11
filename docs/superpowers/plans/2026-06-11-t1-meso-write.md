# T1 · Meso-írás — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mesocycle can be created from the wizard (planned or active, with a real start-date picker), activated/closed from the Builder, and its per-day exercise list edited persistently — backed by four new contract-first endpoints.

**Architecture:** Contract grows four operations (`POST /api/train/mesocycles` 201, `POST .../{id}/activate`, `POST .../{id}/close`, `PUT .../{id}/days/{dayId}/exercises`); `MesoDay` gains an optional `id` (the underlying `workout_session` uuid). `TrainService` gets `@Transactional` write methods (hand-mapped request→entity, Slice A idiom; ownership stamped server-side; single-active-meso rule on activate). FE: the Train hook block moves to `data/trainHooks.ts` (hooks.ts re-exports), gains 4 mutations (mock = no-op, real = POST/PUT + invalidate); wizard/Builder/MesoExercises get wired. No DB migration — all tables exist.

**Tech Stack:** Spring Boot 4 / Java 21, openapi-generator (interfaceOnly + Bean Validation from `required:`), MapStruct/Lombok, React 19 + TanStack Query + MSW.

**Driving bd issue:** `mezo-696` (epic `mezo-ogv`). **Spec:** `docs/superpowers/specs/2026-06-11-train-write-clean-slate-design.md`.

**Mandatory reading:** `docs/references/{api_contract_conventions,spring_patterns,error_handling,testing_standards,integration_test_framework}.md`; Slice A write reference: `api/feature/weight/weight.yml` + `feature/biometrics/weight/**` (+ `useGoals.logWeight` FE idiom).

## Locked design decisions

1. **Day addressing:** contract `MesoDay` gets OPTIONAL `id` (uuid of the `workout_session` row); domain `MesoDay` type gets `id?: string`. PUT addresses `{mesoId}/days/{dayId}`. Mock-mode days have no id → FE auto-save no-ops in mock.
2. **Server-computed fields:** `endDate = startDate + weeks*7 days`; `currentWeek` = planned→0, active→`clamp((today-startDate).days/7 + 1, 1, weeks)`. `orderIndex` = array order (days and exercises).
3. **Lifecycle idempotency:** activate on an already-active meso and close on an already-archived meso are no-op successes. Activate archives every other active meso of the owner. 404 (`RESOURCE_NOT_FOUND`) for missing/foreign ids — no new error codes needed.
4. **Replace semantics:** PUT day exercises soft-deletes the day's current exercise rows and inserts the new list. Returns the rebuilt `MesoDay`.
5. **`phaseCurve` refactor:** `String[]` → `List<String>` on `MesocycleEntity` (Hibernate dirty-checking; the entity comment mandated this before any write path).
6. **Status codes:** create → 201 (Slice A weight POST precedent); lifecycle + PUT → 200.
7. **Wizard payload mapping:** `title = name`, `shortTitle = goal.label ?? name`, `style = goal.style`, `split = "${split.label} · ${days}×/hét"`, `days` from the generated program (skip days with 0 exercises? NO — send all 7 template days verbatim incl. Rest/Volleyball; they're template days with empty exercise lists, matching the seed shape).
8. **startDate:** wizard holds ISO (`<input type="date">`, default today), displays via `huMonthDay`.

---

### Task 1: Contract — four write operations + MesoDay.id

**Files:** Modify `api/feature/train/train.yml`; regen `api/openapi.yml` + `frontend/src/lib/api.gen.ts`; backend compile check.

- [ ] Step 1: branch `feat/t1-meso-write` + `bd update mezo-696 --claim`.
- [ ] Step 2: `MesoDay` schema: add `id: { type: string, format: uuid }` to properties (NOT to required). Add to paths:

```yaml
  /api/train/mesocycles:
    post:
      tags: [Train]
      operationId: createMesocycle
      summary: Create a mesocycle (wizard) with nested template days and exercises
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MesocycleCreateRequest'
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/MesocycleResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/train/mesocycles/{id}/activate:
    post:
      tags: [Train]
      operationId: activateMesocycle
      summary: Activate a mesocycle — archives any other active one (idempotent)
      parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
      responses:
        '200': { description: Activated, content: { application/json: { schema: { $ref: '#/components/schemas/MesocycleResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found / not owned, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/train/mesocycles/{id}/close:
    post:
      tags: [Train]
      operationId: closeMesocycle
      summary: Close (archive) a mesocycle (idempotent)
      parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
      responses:
        '200': { description: Archived, content: { application/json: { schema: { $ref: '#/components/schemas/MesocycleResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found / not owned, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/train/mesocycles/{id}/days/{dayId}/exercises:
    put:
      tags: [Train]
      operationId: replaceDayExercises
      summary: Replace the exercise list of one template day (full-list, order = array order)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: dayId, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: array
              items: { $ref: '#/components/schemas/GymExerciseInput' }
      responses:
        '200': { description: Updated day, content: { application/json: { schema: { $ref: '#/components/schemas/MesoDay' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Meso/day not found or not owned, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

New schemas (expanded block style, matching the file):

```yaml
    MesocycleCreateRequest:
      type: object
      required: [title, status, startDate, weeks, split, style, phaseCurve]
      properties:
        title: { type: string, minLength: 1 }
        shortTitle: { type: string }
        status: { type: string, enum: [active, planned] }
        goal: { type: string }
        startDate: { type: string, format: date }
        weeks: { type: integer, minimum: 1, maximum: 16 }
        split: { type: string, minLength: 1 }
        style: { type: string, minLength: 1 }
        phaseCurve:
          type: array
          minItems: 1
          items: { type: string, enum: [MEV, MAV, MRV, Deload] }
        notes: { type: string }
        days:
          type: array
          items: { $ref: '#/components/schemas/MesoDayInput' }
    MesoDayInput:
      type: object
      required: [day, type]
      properties:
        day: { type: string, minLength: 1, description: "'Hét'..'Vas'" }
        type: { type: string, minLength: 1 }
        muscle: { type: string }
        muscleAccent: { type: boolean }
        note: { type: string }
        exercises:
          type: array
          items: { $ref: '#/components/schemas/GymExerciseInput' }
    GymExerciseInput:
      type: object
      required: [name, sets, targetReps, targetRIR, type]
      properties:
        name: { type: string, minLength: 1 }
        muscle: { type: string }
        sets: { type: integer, minimum: 1, maximum: 20 }
        targetReps: { type: string, minLength: 1 }
        targetRIR: { type: integer, minimum: 0, maximum: 5 }
        type: { type: string, enum: [compound, isolation] }
        warning: { type: string }
```

- [ ] Step 3: merge (`cd api/generate && npm run generate:api`), regen FE (`cd frontend && pnpm generate:api`), backend `./mvnw clean compile -q` → TrainApi gains the 4 methods. Note generated request model names + enum inner classes for Tasks 3–5.
- [ ] Step 4: commit `feat(api): Train write contract — create/activate/close + day-exercise replace (mezo-696)`.

---

### Task 2: Backend — phaseCurve List<String> refactor

**Files:** `MesocycleEntity.java`, `TrainMapper.java` (phaseCurve helper), `TrainPopulator.java`, `TrainSeedData.java`, `TrainServiceIT` (containsExactly assertion type).

- [ ] Step 1: change the entity field to `List<String> phaseCurve` (keep `@JdbcTypeCode(SqlTypes.ARRAY)` + `columnDefinition "text[]"`; update the stale comment — the write path has landed, List is dirty-check-safe). Update `TrainMapper.phaseCurve(...)` helper signature to `List<String>`, populator/seed `new String[]{...}` → `List.of(...)`.
- [ ] Step 2: `./mvnw clean test` → 32/32 (round-trip IT proves text[] still maps).
- [ ] Step 3: commit `refactor(train): phaseCurve String[] -> List<String> for write-path dirty checking (mezo-696)`.

---

### Task 3: Backend — createMesocycle (TDD)

**Files:** `TrainService.java`, `TrainController.java`, `TrainServiceIT.java`, `TrainContractIT.java`.

- [ ] Step 1: failing IT `testCreateMesocycle_shouldPersistNestedDaysAndComputeDerivedFields_whenValid` — build a `MesocycleCreateRequest` (status planned, startDate today−7d, weeks 6, 2 days: first with 2 exercises [array order pins orderIndex], second empty) via the generated builder; call `trainService.createMesocycle(user, req)`; assert: returned id non-null, `endDate == startDate.plusWeeks(6)`, `currentWeek == 0`, DB has 2 workout_session template rows ordered 0,1 with copied fields, exercise orderIndex 0,1, all rows `createdBy == user`. Plus `testCreateMesocycle_shouldComputeCurrentWeek_whenActive`: status active, startDate today−8d → currentWeek 2; startDate today+7d → currentWeek 1.
- [ ] Step 2: implement in `TrainService` (`@Transactional` method-level; hand-mapped like `WeightLogService.log`):

```java
@Transactional
public MesocycleResponse createMesocycle(UUID createdBy, MesocycleCreateRequest req) {
    MesocycleEntity m = new MesocycleEntity();
    m.setCreatedBy(createdBy); // server-side ownership — never from the client
    m.setTitle(req.getTitle());
    m.setShortTitle(req.getShortTitle() != null ? req.getShortTitle() : req.getTitle());
    m.setStatus(req.getStatus().getValue());
    m.setGoal(req.getGoal());
    m.setStartDate(req.getStartDate());
    m.setEndDate(req.getStartDate().plusWeeks(req.getWeeks()));
    m.setWeeks(req.getWeeks());
    m.setCurrentWeek(computeCurrentWeek(req));
    m.setSplit(req.getSplit());
    m.setStyle(req.getStyle());
    m.setPhaseCurve(req.getPhaseCurve().stream().map(PhaseCurveEnum::getValue).toList());
    m.setNotes(req.getNotes());
    m = mesocycleRepository.save(m);
    // template days + exercises — orderIndex from array order
    ... loop req.getDays() -> WorkoutSessionEntity(status "planned", date null) -> save;
        loop day.getExercises() -> ExerciseEntity -> save ...
    return assembled response (reuse listMesocycles' stitching for a single id, or build directly);
}
private int computeCurrentWeek(MesocycleCreateRequest req) {
    if (req.getStatus() != StatusEnum.ACTIVE) return 0;
    long w = ChronoUnit.DAYS.between(req.getStartDate(), LocalDate.now()) / 7 + 1;
    return (int) Math.max(1, Math.min(req.getWeeks(), w));
}
```
(Exact enum accessor names from the generated models — verify after Task 1. Response assembly: extract a private `assembleResponse(MesocycleEntity)` reusing the existing volume/day stitching so GET and POST return identical shapes.)
- [ ] Step 3: controller `@Override createMesocycle(...)` delegating with `currentUserId.get()`. Contract IT: 401 unauth; 201 + body round-trip with `ownerAuthHeaders()`; 400 SystemMessage on missing title (assert via the house `assertHasFieldError`-style helper — check BiometricsContractIT).
- [ ] Step 4: full suite green; commit `feat(train): createMesocycle write path — nested days+exercises, derived fields (mezo-696)`.

---

### Task 4: Backend — activate/close lifecycle (TDD)

**Files:** `TrainService.java`, `TrainController.java`, `TrainServiceIT.java`, `TrainContractIT.java`, `MesocycleRepository.java` (finder for active mesos).

- [ ] Step 1: failing ITs — `testActivateMesocycle_shouldArchivePreviousActive_whenAnotherActiveExists` (create A active + B planned via populator; activate B; assert B active + currentWeek recomputed, A archived); `testActivateMesocycle_shouldBeIdempotent_whenAlreadyActive`; `testCloseMesocycle_shouldArchive_whenActive`; `testActivateMesocycle_shouldThrowNotFound_whenForeignOwner` (expect `SystemRuntimeErrorException` with `RESOURCE_NOT_FOUND`).
- [ ] Step 2: repository finder `List<MesocycleEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status)`. Service:

```java
@Transactional
public MesocycleResponse activateMesocycle(UUID createdBy, UUID id) {
    MesocycleEntity target = ownedMesoOrThrow(createdBy, id); // findById + createdBy check -> RESOURCE_NOT_FOUND
    if (!"active".equals(target.getStatus())) {
        mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .forEach(m -> m.setStatus("archived")); // single-active invariant (spec rule)
        target.setStatus("active");
        target.setCurrentWeek(clampWeek(target.getStartDate(), target.getWeeks()));
    }
    return assembleResponse(target);
}
@Transactional
public MesocycleResponse closeMesocycle(UUID createdBy, UUID id) {
    MesocycleEntity target = ownedMesoOrThrow(createdBy, id);
    if (!"archived".equals(target.getStatus())) target.setStatus("archived");
    return assembleResponse(target);
}
```
- [ ] Step 3: controller overrides + contract IT (401, 200 happy, 404 random uuid).
- [ ] Step 4: suite green; commit `feat(train): mesocycle activate/close lifecycle — single-active invariant (mezo-696)`.

---

### Task 5: Backend — replaceDayExercises + MesoDay.id (TDD)

**Files:** `TrainService.java` (toDay sets id; new write method), `TrainController.java`, `ExerciseRepository.java` (day-scoped finder if missing), `TrainServiceIT.java`, `TrainContractIT.java`.

- [ ] Step 1: failing ITs — `testReplaceDayExercises_shouldSoftDeleteOldAndInsertOrdered_whenValid` (day with 2 exercises → PUT 3 new → finder returns the 3 new in array order; old rows have `is_deleted=true` in raw SQL check); `testReplaceDayExercises_shouldThrowNotFound_whenDayBelongsToOtherMeso`; also assert `listMesocycles` now carries `days[].id`.
- [ ] Step 2: `toDay(...)` adds `.id(s.getId())`. Write method:

```java
@Transactional
public MesoDay replaceDayExercises(UUID createdBy, UUID mesoId, UUID dayId, List<GymExerciseInput> inputs) {
    ownedMesoOrThrow(createdBy, mesoId);
    WorkoutSessionEntity day = workoutSessionRepository.findById(dayId)
        .filter(s -> createdBy.equals(s.getCreatedBy()) && mesoId.equals(s.getMesocycleId()))
        .orElseThrow(() -> notFound());
    exerciseRepository.deleteAll(exerciseRepository
        .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(dayId))); // @SQLDelete -> soft
    List<ExerciseEntity> fresh = ... map inputs with orderIndex i ...; saveAll;
    return toDay(day, fresh);
}
```
- [ ] Step 3: controller override + contract IT (401/404/200 round-trip).
- [ ] Step 4: suite green; commit `feat(train): day-exercise full replace + MesoDay id exposure (mezo-696)`.

---

### Task 6: FE — trainHooks.ts split + 4 mutations + MSW + hook tests (TDD)

**Files:** Create `frontend/src/data/trainHooks.ts`; modify `hooks.ts` (re-export), `lib/trainApi.ts` (4 write methods), `data/types.ts` (`MesoDay.id?: string`), `test/msw/handlers.ts`, `data/trainHooks.test.tsx`.

- [ ] Step 1: failing hook tests — real mode: `createMesocycle` POSTs and invalidates (after resolve, `mesocycles` re-fetches — assert via MSW handler that returns the created meso in the next GET, or spy on request); `activateMesocycle`/`closeMesocycle` POST to the right URL; `saveDayExercises` PUTs. Mock mode: mutations resolve without network (MSW would 'unhandled-request'-error otherwise — the test setup's onUnhandledRequest config tells; verify).
- [ ] Step 2: `trainApi` additions (`satisfies` on bodies):

```ts
create: (body: MesocycleCreateRequest) =>
  apiFetch<MesocycleResponse>('/api/train/mesocycles', { method: 'POST', body: JSON.stringify(body) }),
activate: (id: string) => apiFetch<MesocycleResponse>(`/api/train/mesocycles/${id}/activate`, { method: 'POST' }),
close: (id: string) => apiFetch<MesocycleResponse>(`/api/train/mesocycles/${id}/close`, { method: 'POST' }),
replaceDayExercises: (mesoId: string, dayId: string, body: GymExerciseInput[]) =>
  apiFetch<MesoDayDto>(`/api/train/mesocycles/${mesoId}/days/${dayId}/exercises`, { method: 'PUT', body: JSON.stringify(body) }),
```
- [ ] Step 3: move the whole Train block (toMesocycle, toSportSession, TrainData, useTrain) from hooks.ts to `trainHooks.ts`; hooks.ts: `export { useTrain } from './trainHooks'` (verify no other hooks.ts internals depend on the moved imports; consumers' `@/data/hooks` imports keep working). Extend `useTrain` return with the 4 mutation callbacks (mock → async no-op; real → trainApi call; onSuccess real → `qc.invalidateQueries({ queryKey: ['train', 'mesocycles'] })` — Slice A idiom).
- [ ] Step 4: MSW handlers for the 4 write endpoints (201/200 fixtures). Both test modes green.
- [ ] Step 5: commit `feat(train): trainHooks module + create/activate/close/replace mutations (mezo-696)`.

---

### Task 7: FE — wizard date picker + terminal wiring (TDD)

**Files:** `MesocyclePlanner.tsx`, `MesocyclePlanner.test.tsx`.

- [ ] Step 1: failing test — real mode + QueryWrapper: walk the wizard (goal → step1 → step2 → step3 via the existing test's idiom, fake timers for the 600ms generate delay if needed), click "Hozzáad mint tervezett", assert MSW received a POST with `status: 'planned'` and `title`/`weeks`/`days` from the wizard state (capture via `server.use` + request spy), and navigation lands on the library. Update the two existing planner tests with `QueryWrapper` (mutation hook now lives in the component tree).
- [ ] Step 2: `startDate` becomes ISO state with a native date input in Step1 (default: today, `new Date().toISOString().slice(0,10)`); display `huMonthDay(startDate)`; `addWeeks` display helper fed from ISO (check its signature — adapt or compute end display via date-fns-less arithmetic + huMonthDay).
- [ ] Step 3: build payload + wire the two buttons:

```ts
const buildRequest = (status: 'planned' | 'active'): MesocycleCreateRequest => ({
  title: name, shortTitle: goal?.label ?? name, status, goal: goal?.description,
  startDate, weeks, split: split ? `${split.label} · ${days}×/hét` : '', style: goal?.style ?? `${weeks} hét`,
  phaseCurve, days: program.map(d => ({
    day: d.day, type: d.type, muscle: d.muscle, muscleAccent: d.muscleAccent ?? undefined, note: d.note,
    exercises: d.exercises.map(e => ({ name: e.name, muscle: e.muscle, sets: e.sets,
      targetReps: e.targetReps, targetRIR: e.targetRIR, type: e.type, warning: e.warning })),
  })),
})
// "Hozzáad mint tervezett" -> createMesocycle(buildRequest('planned'), { onSuccess: backToLibrary })
// "Aktiválás most"        -> createMesocycle(buildRequest('active'), { onSuccess: backToLibrary })
```
(`program` is Step3's generated+edited day list — lift it to the top component if it currently lives inside Step3; verify. Buttons disabled while pending. Mock mode: mutation no-ops then navigates — Phase 1 behavior preserved.)
- [ ] Step 4: both modes green; commit `feat(train): wizard persists mesocycles — date picker + create wiring (mezo-696)`.

---

### Task 8: FE — Builder lifecycle buttons + MesoExercises auto-save (TDD)

**Files:** `MesocycleBuilder.tsx`, `components/MesoExercises.tsx`, tests (`MesocycleBuilder.test.tsx` additions, `MesoExercises.test.tsx` stays green).

- [ ] Step 1: failing tests — real mode: Builder "Aktiválás" click POSTs `/activate` (MSW spy); "Meso lezárása" POSTs `/close`. MesoExercises: adding an exercise (existing flow) fires a PUT with the new full list when `meso.days[].id` present; mock mode (existing tests): NO network, local append still instant.
- [ ] Step 2: Builder: `const { activateMesocycle, closeMesocycle } = useTrain()`; wire the two buttons (`onClick={() => activateMesocycle(meso.id)}` / `closeMesocycle(meso.id)`); "Heti terv másolása" stays inert (out of scope).
- [ ] Step 3: MesoExercises: keep synchronous local `setDays`; after each add/remove, if the day has `id`, fire `saveDayExercises(meso.id, day.id, exercises)` in the background (optimistic local + invalidate-on-success refresh).
- [ ] Step 4: both modes green; commit `feat(train): Builder lifecycle + MesoExercises persistent editing (mezo-696)`.

---

### Task 9: Gates + live smoke + merge

- [ ] Step 1: full gates — backend both DB modes, FE both modes + build + parity 45/45.
- [ ] Step 2: live browser smoke FROM THE CLEAN SLATE (the T1 acceptance moment): backend `demodata` only + `pnpm dev`; in the browser: library empty → wizard (pick goal, set a date, weeks, split) → "Hozzáad mint tervezett" → library shows it under TERVEZETT; open it → "Aktiválás" → AKTÍV (+ Train MAI still ghosts the workout hero — that's T2); MesoExercises add/remove an exercise → reload → persisted. Also create a second meso and activate it → the first goes ARCHÍV (single-active rule live). Console clean. Kill processes.
- [ ] Step 3: `bd close mezo-696`; merge per Git Workflow (`pull --rebase`, `merge --no-ff feat/t1-meso-write`, branch -d, `bd dolt push && git push`, clean status).

## Self-review notes (plan time)

- Spec T1 row fully covered: wizard create (T7), real date picker (T7), activate/close (T4+T8), day post-editing (T5+T8). Contract-first (T1), single-active invariant (T4), MesoDay.id decision documented, phaseCurve refactor (T2) prerequisite of writes.
- Verify-at-execution: generated request model/enum accessor names; `program` state location in Step3; planner `addWeeks` signature; MSW unhandled-request config; BiometricsContractIT's 400-assert helper name.
- No migration; no new SystemMessage codes (RESOURCE_NOT_FOUND reused).
