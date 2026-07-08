# Writable Catalog + Demo Videos + Plyo Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the exercise catalog user-writable (create/edit/delete own exercises), attach a YouTube demo to any exercise and watch it inline in 3 places, and add a plyo-led `Láb+Plyo / Felső` split.

**Architecture:** `exercise_catalog` gains `created_by` (null=master JSON, set=user) + `is_deleted` + `video_url`; the startup loader is made non-clobbering; new owner-scoped write endpoints add user rows; `video_url` is resolved onto `GymExercise`/`TodayExercise` server-side; the FE gets a create/edit sheet + an inline YouTube-nocookie player; the planner gets a new split + a weightless plyo lead + a 6-8/RIR0 goal scheme.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven · PostgreSQL 16 + Liquibase · MapStruct + Lombok · OpenAPI contract-first (openapi-generator 7.17) · React 19 + TanStack Query + Vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-catalog-authoring-videos-plyo-split-design.md` · **bd:** `mezo-52zg` · **Branch:** `feat/catalog-authoring` (stacked on `feat/hypertrophy-drive`).

## Global Constraints

- Base package `io.mrkuhne.mezo`; UUID PKs; `created_by` server-side; soft delete via `@SQLDelete`/`@SQLRestriction`.
- **Contract-first:** edit `api/feature/train/train.yml` BEFORE code; request fields prefer `pattern`/`enum` (400 not 500); responses use `enum`; nullable via `nullable: true`. Regenerate: `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api` → backend DTOs regenerate during `./mvnw`.
- **Catalog invariants:** master rows have `created_by = null` and are owned by `ExerciseCatalogLoader` (upsert-by-slug, never deleted). The loader must NOT clobber a user-set `video_url` and NEVER touch user rows (slug not in JSON). The 13 muscle tokens + 3 type tokens are CHECK-constrained in DDL AND in the loader's `MUSCLES`/`TYPES` sets — keep in sync.
- **Config/errors:** tunables under `mezo.` root; errors via `SystemRuntimeErrorException` + `SystemMessage` code (`message.properties`), never hardcoded text.
- **Backend tests:** integration-first `@SpringBootTest` + Testcontainers (`./mvnw clean test -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"` — the 3g fork heap avoids the full-suite OOM), AssertJ, `*Populator` data, `test{Method}_should{Result}_when{Condition}`. Per-task gate = the task's focused/blast-radius classes FOREGROUND; the full suite runs at the end.
- **Frontend:** dual-mode; `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green; import from `@/data/*`, no relative `../`, colocated tests, `satisfies` on request bodies.
- Worktree commits: `git -c core.hooksPath=/dev/null commit` (never stage `.beads/`); run `bd` from the main checkout.

---

### Task 1: Contract — video fields + catalog write endpoints

**Files:**
- Modify: `api/feature/train/train.yml` (ExerciseCatalogItem, GymExercise, TodayExercise; new CatalogExerciseCreateRequest, CatalogVideoRequest; new paths)
- Regen: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces (produced, generated):** `CatalogExerciseCreateRequest {name, muscle(enum13), type(enum), stim, fatigue, videoUrl?}`; `CatalogVideoRequest {videoUrl?}`; `ExerciseCatalogItem` + `videoUrl?` + `editable`; `GymExercise`/`TodayExercise` + `videoUrl?`. Operations `createExercise`, `updateExercise`, `deleteExercise`, `setExerciseVideo`.

- [ ] **Step 1: Add the response fields.** In `train.yml`, `ExerciseCatalogItem` (add to `properties`, and `editable` to `required`):

```yaml
        videoUrl:
          type: string
          nullable: true
        editable:
          type: boolean
          description: true when created_by == the current user (user-authored row)
```
Add `editable` to its `required` list. Then add to **both** `GymExercise` and `TodayExercise` `properties`:

```yaml
        videoUrl:
          type: string
          nullable: true
          description: Effective YouTube demo URL resolved from the linked catalog row (null when none)
```

- [ ] **Step 2: Add the request schemas** (in `components.schemas`):

```yaml
    CatalogExerciseCreateRequest:
      type: object
      required:
        - name
        - muscle
        - type
        - stim
        - fatigue
      properties:
        name:
          type: string
          minLength: 1
        muscle:
          type: string
          enum: [back-mid, lats, chest, shoulder, rear-delt, biceps, triceps, quad, ham, glute, calf, core, traps]
        type:
          type: string
          enum: [compound, isolation, plyo]
        stim:
          type: number
          minimum: 0
          maximum: 1
        fatigue:
          type: number
          minimum: 0
          maximum: 1
        videoUrl:
          type: string
          nullable: true
    CatalogVideoRequest:
      type: object
      properties:
        videoUrl:
          type: string
          nullable: true
          description: A YouTube watch/short URL, or null to clear the demo
```

- [ ] **Step 3: Add the paths.** Add a `post` to the existing `/api/train/exercises` (keep the existing `get`), and new `/api/train/exercises/{id}` + `/api/train/exercises/{id}/video`:

```yaml
    post:
      tags: [Train]
      operationId: createExercise
      summary: Create a user-authored catalog exercise
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CatalogExerciseCreateRequest'
      responses:
        '201':
          description: Created exercise
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExerciseCatalogItem'
        '400':
          description: Validation error
          content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } }
        '401':
          description: Missing/invalid token
          content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } }
  /api/train/exercises/{id}:
    put:
      tags: [Train]
      operationId: updateExercise
      summary: Update a user-authored exercise (master rows → 409)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CatalogExerciseCreateRequest'
      responses:
        '200':
          description: Updated exercise
          content: { application/json: { schema: { $ref: '#/components/schemas/ExerciseCatalogItem' } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: Master row is read-only, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    delete:
      tags: [Train]
      operationId: deleteExercise
      summary: Soft-delete a user-authored exercise (master rows → 409)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: Master row is read-only, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/train/exercises/{id}/video:
    put:
      tags: [Train]
      operationId: setExerciseVideo
      summary: Set/clear the demo video on any catalog exercise (master or user)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CatalogVideoRequest'
      responses:
        '200': { description: Updated, content: { application/json: { schema: { $ref: '#/components/schemas/ExerciseCatalogItem' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

- [ ] **Step 4: Regenerate + commit.**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
cd .. && git -c core.hooksPath=/dev/null add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(train): catalog-write + video contract (mezo-52zg)"
```
Expected: `git diff --stat` shows the merged spec + regenerated FE types. Backend DTOs regenerate in Task 2's build. (Backend compile stays green — the changes are additive to `ExerciseCatalogItem`/`GymExercise`/`TodayExercise` + new types; the new `TrainApi` methods are default-implemented until Task 3 overrides them — `skipDefaultInterface=true` in the pom means the controller must implement them, so **Task 2/3 land before a full backend build**.)

---

### Task 2: Catalog entity + migration + non-clobbering loader

**Files:**
- Modify: `backend/.../feature/train/entity/ExerciseCatalogEntity.java`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607082000_mezo-52zg_catalog_write.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/.../feature/train/ExerciseCatalogLoader.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`
- Test: `backend/.../feature/train/ExerciseCatalogLoaderIT.java` (extend or create)

**Interfaces (produced):** `ExerciseCatalogEntity.getCreatedBy()/getIsDeleted()/getVideoUrl()`; `TrainPopulator.createUserCatalogExercise(UUID createdBy, String name, String muscle, String type)`.

- [ ] **Step 1: Migration.** Create `202607082000_mezo-52zg_catalog_write.sql`:

```sql
-- mezo-52zg: make exercise_catalog writable (user-authored exercises) + demo video.
-- created_by NULL = master content (loader-owned); set = user-authored (soft-deletable).
-- video_url settable on any row; the loader preserves it (never clobbers a user video).
ALTER TABLE exercise_catalog ADD COLUMN created_by UUID;
ALTER TABLE exercise_catalog ADD CONSTRAINT fk_exercise_catalog_created_by_app_user_id
    FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE;
ALTER TABLE exercise_catalog ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE exercise_catalog ADD COLUMN video_url TEXT;
CREATE INDEX idx_exercise_catalog_created_by ON exercise_catalog (created_by);
```
Register in `1.0.0_master.yml` (after the last entry):
```yaml
  - changeSet:
      id: "1.0.0:202607082000_mezo-52zg_catalog_write"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607082000_mezo-52zg_catalog_write.sql
```

- [ ] **Step 2: Entity.** In `ExerciseCatalogEntity.java` add the imports (`OwnedEntity` is NOT used — keep it a plain entity; add `org.hibernate.annotations.SQLDelete/SQLRestriction`) and the class annotations + fields:

```java
@Getter
@Setter
@Entity
@Table(name = "exercise_catalog")
@SQLDelete(sql = "update exercise_catalog set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExerciseCatalogEntity {
```
Add fields (after `fatigue`):

```java
    /** null = master/JSON content (loader-owned); set = user-authored row. */
    @Column(name = "created_by")
    private UUID createdBy;

    @NotNull
    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    /** Effective YouTube demo URL; nullable. */
    @Column(name = "video_url")
    private String videoUrl;
```

- [ ] **Step 3: Non-clobbering loader.** In `ExerciseCatalogLoader.load`, change the per-slug upsert body so it (a) never overwrites `video_url` from JSON onto a row that already has one, (b) leaves `created_by` null. Replace the loop body:

```java
        for (CatalogJsonItem item : items) {
            ExerciseCatalogEntity e = bySlug.getOrDefault(item.slug(), new ExerciseCatalogEntity());
            e.setSlug(item.slug());
            e.setName(item.name());
            e.setMuscle(item.muscle());
            e.setType(item.type());
            e.setStim(item.stim());
            e.setFatigue(item.fatigue());
            // Seed a JSON demo only when provided AND the row has none — never clobber a user video.
            if (item.videoUrl() != null && e.getVideoUrl() == null) {
                e.setVideoUrl(item.videoUrl());
            }
            repository.save(e);
        }
```
Add `String videoUrl` to the `CatalogJsonItem` record: `public record CatalogJsonItem(String slug, String name, String muscle, String type, BigDecimal stim, BigDecimal fatigue, String videoUrl) {}` (Jackson ignores JSON entries without `videoUrl` → null). `repository.findAll()` now returns only non-deleted rows (the `@SQLRestriction`); that's fine — master rows are never deleted, so the slug map still covers them.

- [ ] **Step 4: ResetDatabase — wipe user rows only.** In `ResetDatabase.resetExceptMasterData`, after the app_user delete, add (mirrors the master-preservation pattern; the catalog stays out of the TRUNCATE list):

```java
        // User-authored catalog rows go; master content (created_by null) survives for the loader.
        entityManager.createNativeQuery("DELETE FROM exercise_catalog WHERE created_by IS NOT NULL").executeUpdate();
```

- [ ] **Step 5: Populator helper.** In `TrainPopulator.java` add:

```java
    /** A user-authored catalog exercise (created_by set) for catalog-write tests. */
    public ExerciseCatalogEntity createUserCatalogExercise(UUID createdBy, String name, String muscle, String type) {
        ExerciseCatalogEntity e = new ExerciseCatalogEntity();
        e.setCreatedBy(createdBy);
        e.setSlug(name.toLowerCase().replaceAll("[^a-z0-9]+", "-") + "-" + java.util.UUID.randomUUID());
        e.setName(name);
        e.setMuscle(muscle);
        e.setType(type);
        e.setStim(new java.math.BigDecimal("0.60"));
        e.setFatigue(new java.math.BigDecimal("0.30"));
        return exerciseCatalogRepository.saveAndFlush(e);
    }
```
Inject `ExerciseCatalogRepository exerciseCatalogRepository` into `TrainPopulator` if not present (add the field + it's `@RequiredArgsConstructor`/`@Component` — mirror the existing repo fields).

- [ ] **Step 6: Loader IT.** In `ExerciseCatalogLoaderIT` add:

```java
    @Test
    void testLoader_shouldPreserveUserVideo_whenReRun() {
        var master = exerciseCatalogRepository.findBySlug("box-jump").orElseThrow();
        master.setVideoUrl("https://youtu.be/USER_SET");
        exerciseCatalogRepository.saveAndFlush(master);
        loader.run(); // re-run against the drifted DB
        assertThat(exerciseCatalogRepository.findBySlug("box-jump").orElseThrow().getVideoUrl())
            .isEqualTo("https://youtu.be/USER_SET");
    }

    @Test
    void testLoader_shouldNotTouchUserRows_whenReRun() {
        var user = train.createUserCatalogExercise(ownerId(), "My Move", "quad", "plyo");
        loader.run();
        assertThat(exerciseCatalogRepository.findById(user.getId())).isPresent();
    }
```
(Autowire `ExerciseCatalogLoader loader`, `ExerciseCatalogRepository exerciseCatalogRepository`, `TrainPopulator train`.)

- [ ] **Step 7: Build + gate (this task must also make Task-1's contract compile — the new `TrainApi` methods still need Task 3; so run only the loader IT class here, the full backend build lands after Task 3).**

```bash
cd backend && ./mvnw clean test -Dtest=ExerciseCatalogLoaderIT -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"
```
Expected: PASS. (If the build fails because `TrainController` doesn't yet implement `createExercise`/… — that is Task 3; if the reviewer runs this task in isolation, temporarily stub the 4 `TrainApi` methods to `throw new UnsupportedOperationException()` and remove the stubs in Task 3. Prefer landing Task 2+3 together.)

- [ ] **Step 8: Commit.**

```bash
git -c core.hooksPath=/dev/null add backend/ && git -c core.hooksPath=/dev/null commit -m "feat(train): catalog write columns + non-clobbering loader (mezo-52zg)"
```

---

### Task 3: Catalog write service + endpoints

**Files:**
- Modify: `backend/.../feature/train/service/ExerciseCatalogService.java`
- Modify: `backend/.../feature/train/controller/TrainController.java`
- Modify: `backend/.../feature/train/mapper/TrainMapper.java`
- Modify: `backend/.../feature/train/repository/ExerciseCatalogRepository.java` (add a slug-prefix count for uniqueness)
- Modify: `backend/src/main/resources/.../message.properties` (add `CATALOG_MASTER_READONLY`)
- Test: `backend/.../feature/train/CatalogWriteContractIT.java`

**Interfaces (consumed):** `CatalogExerciseCreateRequest`, `CatalogVideoRequest`, `ExerciseCatalogItem` (Task 1); `ExerciseCatalogEntity` fields (Task 2). **Produced:** `ExerciseCatalogService.create/update/delete/setVideo`, `list(createdBy)`.

- [ ] **Step 1: Failing contract IT.** Create `CatalogWriteContractIT.java` (extends `ApiIntegrationTest`):

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class CatalogWriteContractIT extends ApiIntegrationTest {

    @Test
    void testCreateExercise_shouldReturnEditableUserRow_whenValid() {
        CatalogExerciseCreateRequest req = CatalogExerciseCreateRequest.builder()
            .name("DB Jump Squat").muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.PLYO)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
        ExerciseCatalogItem body = post("/api/train/exercises", req, ExerciseCatalogItem.class, HttpStatus.CREATED);
        assertThat(body.getEditable()).isTrue();
        assertThat(body.getSlug()).startsWith("db-jump-squat");
    }

    @Test
    void testUpdateMasterExercise_shouldReturn409_whenMasterReadonly() {
        ExerciseCatalogItem boxJump = get("/api/train/exercises", ExerciseCatalogItem[].class, HttpStatus.OK)
            .stream().filter(e -> "box-jump".equals(e.getSlug())).findFirst().orElseThrow();
        CatalogExerciseCreateRequest req = CatalogExerciseCreateRequest.builder()
            .name("x").muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.PLYO)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
        putExpectingError("/api/train/exercises/" + boxJump.getId(), req, HttpStatus.CONFLICT, "CATALOG_MASTER_READONLY");
    }

    @Test
    void testSetVideo_shouldAttachToMaster_whenAnyRow() {
        ExerciseCatalogItem boxJump = get("/api/train/exercises", ExerciseCatalogItem[].class, HttpStatus.OK)
            .stream().filter(e -> "box-jump".equals(e.getSlug())).findFirst().orElseThrow();
        var vidReq = io.mrkuhne.mezo.api.dto.CatalogVideoRequest.builder().videoUrl("https://youtu.be/abc").build();
        ExerciseCatalogItem out = put("/api/train/exercises/" + boxJump.getId() + "/video", vidReq, ExerciseCatalogItem.class, HttpStatus.OK);
        assertThat(out.getVideoUrl()).isEqualTo("https://youtu.be/abc");
        assertThat(out.getEditable()).isFalse(); // master stays non-editable
    }
}
```
(Use the `ApiIntegrationTest` verb helpers — `post`/`put`/`get`/`putExpectingError` — matching the existing `*ContractIT` classes; adjust helper names to the ones the base class actually exposes.)

- [ ] **Step 2: Run → FAIL** (`./mvnw test -Dtest=CatalogWriteContractIT …` fails: endpoints unimplemented).

- [ ] **Step 3: Repository uniqueness helper.** In `ExerciseCatalogRepository` add:

```java
    long countBySlugStartingWith(String slugPrefix);
```

- [ ] **Step 4: Mapper.** In `TrainMapper`, `toCatalogItem` — `videoUrl` auto-maps (same name); `editable` is computed in the service (MapStruct can't see the current user). Add `@Mapping(target = "editable", ignore = true)`:

```java
    @Mapping(target = "type", expression = "java(ExerciseCatalogItem.TypeEnum.fromValue(entity.getType()))")
    @Mapping(target = "editable", ignore = true)
    ExerciseCatalogItem toCatalogItem(ExerciseCatalogEntity entity);
```

- [ ] **Step 5: Service.** Rewrite `ExerciseCatalogService` with the write methods (the `list` now takes the current user to set `editable`):

```java
    public List<ExerciseCatalogItem> list(UUID currentUser) {
        return repository.findAllByOrderByMuscleAscNameAsc().stream()
            .map(e -> withEditable(e, currentUser)).toList();
    }

    @Transactional
    public ExerciseCatalogItem create(UUID createdBy, CatalogExerciseCreateRequest req) {
        ExerciseCatalogEntity e = new ExerciseCatalogEntity();
        e.setCreatedBy(createdBy);
        e.setSlug(uniqueSlug(req.getName()));
        apply(e, req);
        return withEditable(repository.save(e), createdBy);
    }

    @Transactional
    public ExerciseCatalogItem update(UUID currentUser, UUID id, CatalogExerciseCreateRequest req) {
        ExerciseCatalogEntity e = ownedOrThrow(currentUser, id);
        apply(e, req);
        return withEditable(repository.save(e), currentUser);
    }

    @Transactional
    public void delete(UUID currentUser, UUID id) {
        repository.delete(ownedOrThrow(currentUser, id)); // @SQLDelete soft-deletes
    }

    @Transactional
    public ExerciseCatalogItem setVideo(UUID currentUser, UUID id, String videoUrl) {
        ExerciseCatalogEntity e = repository.findById(id).orElseThrow(ExerciseCatalogService::notFound);
        e.setVideoUrl(videoUrl);
        return withEditable(repository.save(e), currentUser);
    }

    private ExerciseCatalogEntity ownedOrThrow(UUID currentUser, UUID id) {
        ExerciseCatalogEntity e = repository.findById(id).orElseThrow(ExerciseCatalogService::notFound);
        if (e.getCreatedBy() == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("CATALOG_MASTER_READONLY").build(), HttpStatus.CONFLICT);
        }
        if (!currentUser.equals(e.getCreatedBy())) {
            throw notFound();
        }
        return e;
    }

    private void apply(ExerciseCatalogEntity e, CatalogExerciseCreateRequest req) {
        e.setName(req.getName());
        e.setMuscle(req.getMuscle().getValue());
        e.setType(req.getType().getValue());
        e.setStim(req.getStim());
        e.setFatigue(req.getFatigue());
        if (req.getVideoUrl() != null) e.setVideoUrl(req.getVideoUrl());
    }

    private ExerciseCatalogItem withEditable(ExerciseCatalogEntity e, UUID currentUser) {
        ExerciseCatalogItem dto = mapper.toCatalogItem(e);
        dto.setEditable(e.getCreatedBy() != null && e.getCreatedBy().equals(currentUser));
        return dto;
    }

    private String uniqueSlug(String name) {
        String base = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.isBlank()) base = "exercise";
        long n = repository.countBySlugStartingWith(base);
        return n == 0 ? base : base + "-" + (n + 1);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(SystemMessage.error("TRAIN_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
```
Add the imports (`CatalogExerciseCreateRequest`, `SystemRuntimeErrorException`, `SystemMessage`, `HttpStatus`, `@Transactional`, `UUID`). (Reuse the existing Train not-found code if there is one; else add `TRAIN_NOT_FOUND` to `message.properties`.)

- [ ] **Step 6: message.properties.** Add:
```
CATALOG_MASTER_READONLY=A beépített gyakorlatok nem szerkeszthetők.
```
(and `TRAIN_NOT_FOUND` if not already present, HU text.)

- [ ] **Step 7: Controller.** In `TrainController` implement the 4 new `TrainApi` methods + pass the current user to `list`:

```java
    @Override
    public List<ExerciseCatalogItem> getExerciseCatalog() {
        return exerciseCatalogService.list(currentUserId.require());
    }

    @Override
    public ResponseEntity<ExerciseCatalogItem> createExercise(CatalogExerciseCreateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(exerciseCatalogService.create(currentUserId.require(), req));
    }

    @Override
    public ExerciseCatalogItem updateExercise(UUID id, CatalogExerciseCreateRequest req) {
        return exerciseCatalogService.update(currentUserId.require(), id, req);
    }

    @Override
    public ResponseEntity<Void> deleteExercise(UUID id) {
        exerciseCatalogService.delete(currentUserId.require(), id);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ExerciseCatalogItem setExerciseVideo(UUID id, CatalogVideoRequest req) {
        return exerciseCatalogService.setVideo(currentUserId.require(), id, req.getVideoUrl());
    }
```
(Match the generated `TrainApi` signatures — `useResponseEntity=false` means non-2xx-default methods return the body type directly; the 201/204 ones return `ResponseEntity`. Check the generated interface and mirror its exact signatures. `currentUserId.require()` — use whatever accessor the existing controller uses to get the UUID.)

- [ ] **Step 8: Run → PASS + commit.**

```bash
cd backend && ./mvnw clean test -Dtest='CatalogWriteContractIT,ExerciseCatalogLoaderIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"
git -c core.hooksPath=/dev/null add backend/ && git -c core.hooksPath=/dev/null commit -m "feat(train): catalog write service + endpoints (mezo-52zg)"
```
Expected: green.

---

### Task 4: Resolve videoUrl onto GymExercise / TodayExercise

**Files:**
- Modify: `backend/.../feature/train/service/WorkoutService.java` (getToday exercise mapping)
- Modify: `backend/.../feature/train/service/TrainService.java` (meso day exercise mapping, `toGymExercise` sites)
- Modify: `backend/.../feature/train/repository/ExerciseCatalogRepository.java` (batch fetch by ids)
- Test: `backend/.../feature/train/CatalogVideoResolutionIT.java`

**Interfaces (produced):** `TodayExercise.videoUrl` + `GymExercise.videoUrl` populated from `exercise.catalog_id → catalog.video_url`.

- [ ] **Step 1: Failing IT.** `CatalogVideoResolutionIT` — create a user catalog exercise with a video, a meso day exercise linked to it (`catalogId`), assert `getToday().exercises[0].videoUrl` equals the catalog video. (Model the meso/day/exercise setup on `WorkoutTodayPrescriptionIT`; use `train.createExercise(owner, day, name, i, muscle, type, catalogId)` — the 7-arg overload sets catalogId.)

- [ ] **Step 2: Run → FAIL** (videoUrl null).

- [ ] **Step 3: Repo batch fetch.** In `ExerciseCatalogRepository` add:
```java
    List<ExerciseCatalogEntity> findByIdIn(java.util.Collection<UUID> ids);
```

- [ ] **Step 4: Resolve in getToday.** In `WorkoutService.getToday`, after building the exercise DTOs, batch-load the catalog videos and set them. Replace the exercises-map lambda tail so that, after `t.setLastWeek(...)` and the prescription block, it also sets the video. Concretely, before the `.exercises(...)` stream, build:
```java
        List<UUID> catalogIds = exercises.stream().map(ExerciseEntity::getCatalogId).filter(java.util.Objects::nonNull).toList();
        Map<UUID, String> videoByCatalog = catalogIds.isEmpty() ? Map.of()
            : exerciseCatalogRepository.findByIdIn(catalogIds).stream()
                .filter(c -> c.getVideoUrl() != null)
                .collect(Collectors.toMap(ExerciseCatalogEntity::getId, ExerciseCatalogEntity::getVideoUrl));
```
and inside the map lambda add:
```java
                if (e.getCatalogId() != null) t.setVideoUrl(videoByCatalog.get(e.getCatalogId()));
```
Inject `ExerciseCatalogRepository exerciseCatalogRepository` into `WorkoutService` (add the field; it's `@RequiredArgsConstructor`).

- [ ] **Step 5: Resolve in meso days.** In `TrainService`, wherever `toGymExercise` is applied to build a `MesoDay`'s exercises (the list-mesocycles + assembleResponse paths), do the same batch-resolve and `setVideoUrl` on each `GymExercise` whose exercise has a `catalogId`. (Add a small private helper `applyVideos(List<GymExercise> dtos, List<ExerciseEntity> entities)` reused by both sites.)

- [ ] **Step 6: Run → PASS + commit.**

```bash
cd backend && ./mvnw clean test -Dtest='CatalogVideoResolutionIT,WorkoutTodayPrescriptionIT,TrainServiceIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"
git -c core.hooksPath=/dev/null add backend/ && git -c core.hooksPath=/dev/null commit -m "feat(train): resolve demo video onto today/meso exercises (mezo-52zg)"
```

---

### Task 5: FE data layer — catalog write hooks + video

**Files:**
- Modify: `frontend/src/data/types.ts` (`ExerciseLibraryItem` + videoUrl/editable)
- Modify: `frontend/src/data/train/trainApi.ts` (create/update/delete/setVideo clients + re-exports)
- Modify: `frontend/src/data/train/trainHooks.ts` (`toLibraryItem` + 4 mutations + `TrainData`)
- Modify: `frontend/src/data/train/train.ts` (mock `exerciseLibrary` — add videoUrl/editable to keep types green)
- Test: `frontend/src/data/train/trainHooks.test.tsx`

**Interfaces (produced):** `useTrain().createCatalogExercise/updateCatalogExercise/deleteCatalogExercise/setExerciseVideo`; `ExerciseLibraryItem.videoUrl?: string | null`, `.editable?: boolean`.

- [ ] **Step 1: Types.** In `types.ts`, extend `ExerciseLibraryItem`:
```ts
export interface ExerciseLibraryItem {
  id: string; name: string; muscle: string; type: ExerciseKind; stim: number; fatigue: number
  catalogId?: string
  videoUrl?: string | null
  editable?: boolean
}
```

- [ ] **Step 2: API client.** In `trainApi.ts` add the re-exports + methods:
```ts
export type CatalogExerciseCreateRequest = components['schemas']['CatalogExerciseCreateRequest']
export type CatalogVideoRequest = components['schemas']['CatalogVideoRequest']
```
```ts
  createExercise: (body: CatalogExerciseCreateRequest): Promise<ExerciseCatalogItem> =>
    apiFetch<ExerciseCatalogItem>('/api/train/exercises', { method: 'POST', body: JSON.stringify(body) }),
  updateExercise: (id: string, body: CatalogExerciseCreateRequest): Promise<ExerciseCatalogItem> =>
    apiFetch<ExerciseCatalogItem>(`/api/train/exercises/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteExercise: (id: string): Promise<void> =>
    apiFetch<void>(`/api/train/exercises/${id}`, { method: 'DELETE' }),
  setExerciseVideo: (id: string, videoUrl: string | null): Promise<ExerciseCatalogItem> =>
    apiFetch<ExerciseCatalogItem>(`/api/train/exercises/${id}/video`, {
      method: 'PUT', body: JSON.stringify({ videoUrl } satisfies CatalogVideoRequest),
    }),
```

- [ ] **Step 3: Hooks.** In `trainHooks.ts` extend `toLibraryItem` to carry the new fields:
```ts
function toLibraryItem(r: ExerciseCatalogItem): ExerciseLibraryItem {
  return { id: r.id, catalogId: r.id, name: r.name, muscle: r.muscle, type: r.type, stim: r.stim, fatigue: r.fatigue,
    videoUrl: r.videoUrl ?? null, editable: r.editable }
}
```
Add 4 mutations mirroring `gymScheduleMutation` (mock no-op / real API), each `onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['train','exerciseCatalog'] }) }`, plus `useCallback` wrappers `createCatalogExercise`, `updateCatalogExercise`, `deleteCatalogExercise`, `setExerciseVideo`. Add the 4 signatures to `TrainData` and return them:
```ts
  createCatalogExercise: (req: CatalogExerciseCreateRequest, opts?: MutateOpts) => void
  updateCatalogExercise: (id: string, req: CatalogExerciseCreateRequest, opts?: MutateOpts) => void
  deleteCatalogExercise: (id: string, opts?: MutateOpts) => void
  setExerciseVideo: (id: string, videoUrl: string | null, opts?: MutateOpts) => void
```
Import the two request types from `trainApi`.

- [ ] **Step 4: Mock fixtures.** In `train.ts`, the mock `exerciseLibrary` items are fine as-is (videoUrl/editable optional → undefined). No change required; the `toLibraryItem` real path supplies them. (Optionally add `videoUrl` to one mock item + `editable: false` to keep the mock explicit.)

- [ ] **Step 5: Hook test.** In `trainHooks.test.tsx` add a case asserting `toLibraryItem` maps `videoUrl`/`editable`. Run both modes:
```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- trainHooks && pnpm test -- trainHooks
```
Expected: green (the FE build stays green — these are additive types + hooks).

- [ ] **Step 6: Commit.**
```bash
git -c core.hooksPath=/dev/null add frontend/ && git -c core.hooksPath=/dev/null commit -m "feat(train): FE catalog-write hooks + video field (mezo-52zg)"
```

---

### Task 6: Inline demo video — `VideoDemo` in 3 surfaces

**Files:**
- Create: `frontend/src/features/train/components/VideoDemo.tsx` (+ `VideoDemo.test.tsx`)
- Modify: `frontend/src/features/train/sheets/ExerciseRecordSheet.tsx`
- Modify: `frontend/src/features/train/sheets/ExercisePickerSheet.tsx`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx`
- Modify: `frontend/src/data/types.ts` (`LoggedWorkoutExercise` + videoUrl) + `trainHooks.ts` `toWorkoutPlan` (map videoUrl)

**Interfaces (produced):** `VideoDemo({ url }: { url: string | null | undefined })`; `LoggedWorkoutExercise.videoUrl?: string | null`.

- [ ] **Step 1: Failing test.** `VideoDemo.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { VideoDemo } from '@/features/train/components/VideoDemo'

it('extracts the id from a youtu.be url and lazy-mounts the iframe on tap', () => {
  render(<VideoDemo url="https://youtu.be/abc123" />)
  expect(screen.queryByTitle('Demo videó')).toBeNull() // not mounted yet
  fireEvent.click(screen.getByRole('button', { name: /demo/i }))
  const frame = screen.getByTitle('Demo videó') as HTMLIFrameElement
  expect(frame.src).toContain('youtube-nocookie.com/embed/abc123')
})

it('renders nothing when url is null', () => {
  const { container } = render(<VideoDemo url={null} />)
  expect(container).toBeEmptyDOMElement()
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `VideoDemo.tsx`:**
```tsx
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'

/** Extract a YouTube video id from watch/short/embed URLs; null if unrecognized. */
export function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return m ? m[1] : null
}

export function VideoDemo({ url }: { url: string | null | undefined }) {
  const [open, setOpen] = useState(false)
  if (!url) return null
  const id = youTubeId(url)
  if (!id) return null
  return (
    <div className="col gap-sm">
      <button type="button" className="chip notch-4" style={{ fontSize: 9, alignSelf: 'flex-start' }}
        aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="today" size={11} /> ▶ Demo
      </button>
      {open && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'var(--surface-2)' }}>
          <iframe title="Demo videó" loading="lazy" allowFullScreen
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
        </div>
      )}
    </div>
  )
}
```
(If `Icon` has no play glyph, keep the `▶` text; drop the `<Icon>` if it complicates the test.)

- [ ] **Step 4: Wire the 3 surfaces.**
  - **ExerciseRecordSheet** (`sheets/ExerciseRecordSheet.tsx`): the sheet's `record` is an `ExerciseRecordResponse` which has no video; look the video up from the catalog. Simplest: pass the matching `ExerciseLibraryItem.videoUrl` down from `ExercisesPage` (`ExercisesPage` already has `exerciseLibrary`). Add an optional `videoUrl?: string | null` prop to `ExerciseRecordSheet` and render `<VideoDemo url={videoUrl} />` under the hero. In `ExercisesPage`, when opening the sheet, resolve `exerciseLibrary.find(e => e.catalogId === record.catalogId)?.videoUrl` and pass it.
  - **ExercisePickerSheet** (`sheets/ExercisePickerSheet.tsx`): each row `e` is an `ExerciseLibraryItem` with `videoUrl`. Add a `<VideoDemo url={e.videoUrl} />` in the row (or a small ▶ that stops propagation so it doesn't trigger `onPick`).
  - **ActiveWorkoutPage** (`pages/ActiveWorkoutPage.tsx`): under the `<Display size="lg">{current.name}</Display>` block (lines 709-711), add `<VideoDemo url={current.videoUrl} />`. This needs `current.videoUrl` — add `videoUrl` to `LoggedWorkoutExercise` (types.ts) and map it in `toWorkoutPlan` (`trainHooks.ts`): `videoUrl: e.videoUrl ?? null`.

- [ ] **Step 5: Run both modes + build + commit.**
```bash
cd frontend && VITE_USE_MOCK=true pnpm test && pnpm test && pnpm build
git -c core.hooksPath=/dev/null add frontend/ && git -c core.hooksPath=/dev/null commit -m "feat(train): inline demo video in workout/browser/picker (mezo-52zg)"
```

---

### Task 7: Catalog authoring UI — `CatalogExerciseSheet` + ExercisesPage

**Files:**
- Create: `frontend/src/features/train/sheets/CatalogExerciseSheet.tsx` (+ test)
- Modify: `frontend/src/features/train/pages/ExercisesPage.tsx` (header `+ Új gyakorlat`, edit/delete on owned rows)

**Interfaces (consumed):** `useTrain().createCatalogExercise/updateCatalogExercise/deleteCatalogExercise` + `MUSCLE_LABELS` + `CatalogExerciseCreateRequest`.

- [ ] **Step 1: Failing test.** `CatalogExerciseSheet.test.tsx` — render, fill name/muscle/type/stim/fatigue, submit → asserts `createCatalogExercise` called with the built `CatalogExerciseCreateRequest` (mock the hook). Also a validation case (empty name → submit disabled).

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `CatalogExerciseSheet.tsx`** — a `Sheet` with: a name input, a muscle segmented picker over the 13 `MUSCLE_LABELS` keys, a type segmented (`compound|isolation|plyo`), stim + fatigue steppers (0–1, step 0.05), a video URL input, and a `Mentés` CTA (disabled when name blank). On save builds `{ name, muscle, type, stim, fatigue, videoUrl } satisfies CatalogExerciseCreateRequest` and calls `createCatalogExercise` (create mode) or `updateCatalogExercise(id, …)` (edit mode, when an `edit?: ExerciseLibraryItem` prop is passed). Follow the `ExercisePickerSheet` visual idiom (search/chip styles). Muscle keys list: `['back-mid','lats','chest','shoulder','rear-delt','biceps','triceps','quad','ham','glute','calf','core','traps']`.

- [ ] **Step 4: ExercisesPage integration.** Add a `+ Új gyakorlat` button in the `page-header` that opens `CatalogExerciseSheet` (create mode). On the ghost/record rows that correspond to an **editable** library item (`exerciseLibrary.find(e => e.catalogId === …)?.editable`), render a small pencil (edit → sheet in edit mode) + trash (→ `deleteCatalogExercise(id)`). Keep the existing search/filter/record layout.

- [ ] **Step 5: Run both modes + build + commit.**
```bash
cd frontend && VITE_USE_MOCK=true pnpm test && pnpm test && pnpm build
git -c core.hooksPath=/dev/null add frontend/ && git -c core.hooksPath=/dev/null commit -m "feat(train): catalog authoring sheet + edit/delete (mezo-52zg)"
```

---

### Task 8: Plyo content (2 exercises + seed videos)

**Files:**
- Modify: `backend/src/main/resources/content/exercise-catalog.json`

- [ ] **Step 1: Add the 2 plyo entries + demo videos.** In `exercise-catalog.json`, add a comma after the last entry (line 111, `approach-jump`) and insert before the closing `]`:
```json
  { "slug": "db-jump-squat", "name": "DB Jump Squat", "muscle": "quad", "type": "plyo", "stim": 0.62, "fatigue": 0.45, "videoUrl": "https://youtu.be/REPLACE_ME_DBJS" },
  { "slug": "single-leg-plate-hop", "name": "Single-Leg Plate Hop", "muscle": "calf", "type": "plyo", "stim": 0.52, "fatigue": 0.30, "videoUrl": "https://youtu.be/REPLACE_ME_SLPH" }
```
Also add `"videoUrl"` to the existing `box-jump` and `depth-jump` entries (so demos work out-of-box), e.g. append `, "videoUrl": "https://youtu.be/REPLACE_ME_BOX" }` — **the user will replace the placeholder URLs with real YouTube links; leave them as valid `youtu.be/…` strings so the loader/validation pass.** (The `CatalogJsonItem` record gained the optional `videoUrl` in Task 2, so entries without it still parse.)

- [ ] **Step 2: Verify + commit.**
```bash
cd backend && ./mvnw clean test -Dtest=ExerciseCatalogLoaderIT -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"
git -c core.hooksPath=/dev/null add backend/ && git -c core.hooksPath=/dev/null commit -m "feat(train): plyo catalog entries + seed demo videos (mezo-52zg)"
```
Expected: loader IT green (validates the 2 new tokens; `db-jump-squat`/`single-leg-plate-hop` use existing muscle/type tokens).

---

### Task 9: Plyo split + goal scheme (planner)

**Files:**
- Modify: `frontend/src/features/train/logic/planner.ts`
- Modify: `frontend/src/data/train/train.ts` (`SPLITS`, `GOAL_PRESETS`)
- Test: `frontend/src/features/train/logic/planner.test.ts`

**Interfaces (consumed):** `generateProgram`, `SPLIT_TEMPLATES`, `SCHEMES`, `exercisesForDay`, `ExerciseSeed`, `GymExercise` (recipe shape).

- [ ] **Step 1: Failing test.** In `planner.test.ts` add:
```ts
it('generates the Láb+Plyo/Felső split with a weightless plyo lead and 6-8/RIR0 working sets', () => {
  const days = generateProgram({
    goal: GOAL_PRESETS.find((g) => g.id === 'erohipertrofia')!,
    split: 'Láb+Plyo / Felső', days: 4,
  })
  const lower = days.find((d) => d.type.startsWith('Láb+Plyo A'))!
  const plyo = lower.exercises[0]
  expect(plyo.type).toBe('plyo')
  expect(plyo.warmupSets).toBe(0)
  const squat = lower.exercises.find((e) => e.name === 'Barbell Squat')!
  expect([squat.repMin, squat.repMax]).toEqual([6, 8])
  expect(squat.targetRIR).toBe(0)
  expect(lower.exercises.length).toBeGreaterThanOrEqual(6)
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Add the goal + split data** in `train.ts`. In `GOAL_PRESETS` add:
```ts
  { id: 'erohipertrofia', label: 'Erő-Hipertrófia', sub: '6-8 rep · failure', defaultWeeks: 6, split: 'Láb+Plyo / Felső', days: 4, style: 'RP', phaseTemplate: ['MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'], color: 'var(--brand-glow)', icon: 'train', description: 'Kevés gyakorlat · 6-8 rep RIR 0 · plyo-vezérelt láb + felső' },
```
In `SPLITS` add:
```ts
  { label: 'Láb+Plyo / Felső', days: [4], best: 'erohipertrofia' },
```

- [ ] **Step 4: Planner — scheme, plyo seed, split template, day-types.** In `planner.ts`:
  1. `SCHEMES` — add: `erohipertrofia: { compound: { reps: '6-8', rir: 0, sets: 3 }, isolation: { reps: '8-10', rir: 0, sets: 2 } },`
  2. Add a plyo scheme constant near `SCHEMES`: `const PLYO_SCHEME = { reps: 5, sets: 3 }`.
  3. Relax `ExerciseSeed.type` to `ExerciseKind` (allow `'plyo'`).
  4. `SPLIT_TEMPLATES` — add:
```ts
  'Láb+Plyo / Felső': [
    { day: 'Hét', type: 'Láb+Plyo A', muscle: 'quad+ham+glute+calf' },
    { day: 'Kedd', type: 'Felső A', muscle: 'back+chest+shoulder+arms' },
    { day: 'Sze', type: 'Rest', muscle: '' },
    { day: 'Csü', type: 'Láb+Plyo B', muscle: 'quad+ham+glute+calf' },
    { day: 'Pén', type: 'Felső B', muscle: 'back+chest+shoulder+arms' },
    { day: 'Szo', type: 'Rest', muscle: '' },
    { day: 'Vas', type: 'Rest', muscle: '' },
  ],
```
  5. `exercisesForDay` — add cases for `Láb+Plyo A/B` and `Felső A/B` (the exact 6-exercise lists from the spec §5; the lower days lead with a plyo seed `{ name:'Box Jump', muscle:'quad', type:'plyo' }` / `{ name:'Depth Jump', muscle:'quad', type:'plyo' }`).
  6. Add `Láb+Plyo` and `Felső` to `BASE_TYPES` so `trainingDay`'s `baseType` resolution matches (`BASE_TYPES.find(t => d.type.startsWith(t))`). Order matters — put the longer `'Láb+Plyo'` before any prefix collision.
  7. In `trainingDay`'s `.map(seed => …)`, branch on plyo: when `seed.type === 'plyo'`, emit `{ …, warmupSets: 0, workingSets: PLYO_SCHEME.sets, repMin: PLYO_SCHEME.reps, repMax: PLYO_SCHEME.reps, targetRIR: 0 }` (no weight — the P3 engine prescribes it weightless); otherwise the existing recipe path.

- [ ] **Step 5: Run → PASS + both modes + build + commit.**
```bash
cd frontend && pnpm test -- planner && VITE_USE_MOCK=true pnpm test && pnpm test && pnpm build
git -c core.hooksPath=/dev/null add frontend/ && git -c core.hooksPath=/dev/null commit -m "feat(train): Láb+Plyo/Felső split + plyo lead + 6-8/RIR0 scheme (mezo-52zg)"
```

---

### Task 10: Docs + final gate

**Files:**
- Modify: `docs/features/train.md` (§2 video demo + catalog authoring, §4 catalog columns + endpoints, §10 files)
- Run: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Update `train.md`.** §4: document `exercise_catalog` gaining `created_by/is_deleted/video_url`, the loader non-clobber rule, the new `POST/PUT/DELETE /exercises` + `PUT /exercises/{id}/video` endpoints, `videoUrl` on `GymExercise`/`TodayExercise`. §2: the inline demo video (3 surfaces) + the `+ Új gyakorlat` authoring flow, and the new `Láb+Plyo / Felső` split. §10: add `VideoDemo`, `CatalogExerciseSheet`, the catalog write service methods. Frontmatter `updated: 2026-07-08`.

- [ ] **Step 2: Lint + final gates.**
```bash
node scripts/lint-docs.mjs                       # PASS
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"   # full suite green
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test                 # green both modes
```

- [ ] **Step 3: Commit + close bd.**
```bash
git -c core.hooksPath=/dev/null add docs/ && git -c core.hooksPath=/dev/null commit -m "docs(train): document writable catalog + videos + plyo split (mezo-52zg)"
```
From the MAIN checkout: `bd close mezo-52zg`.

---

## Self-Review

**Spec coverage:** D2 writable catalog → Tasks 2,3. D3 video model + loader-preserve → Tasks 2,3,4. D4 edit authority (409 master) → Task 3. D5 slug-gen → Task 3. D6 loader → Task 2. D7 3 video surfaces → Task 6. D8 split + weightless plyo lead → Task 9. D9 scheme → Task 9. D10 2 plyo entries → Task 8. Contract (videoUrl + endpoints) → Task 1. Migration → Task 2. ResetDatabase/populator → Task 2. Docs → Task 10. **Gap check:** the FE `editable` gating in ExercisesPage (Task 7) depends on `ExerciseLibraryItem.editable` (Task 5) ✓; the active-workout `videoUrl` depends on backend resolution (Task 4) + `LoggedWorkoutExercise.videoUrl` (Task 6) ✓.

**Placeholder scan:** the only placeholders are the intentional `REPLACE_ME_*` YouTube URLs in Task 8 (the user supplies real links) and the migration-timestamp `{ts}` — both flagged as deliberate. No TBD/TODO in logic steps.

**Type consistency:** `CatalogExerciseCreateRequest`/`CatalogVideoRequest` used identically across Tasks 1/3/5/7; `ExerciseCatalogItem.editable`/`videoUrl` across 1/3/5; `VideoDemo({url})` across Task 6; `createCatalogExercise/updateCatalogExercise/deleteCatalogExercise/setExerciseVideo` consistent across Tasks 5/7; `erohipertrofia` goal id + `Láb+Plyo / Felső` label consistent across Tasks 9. `videoUrl` on `TodayExercise`/`GymExercise`/`LoggedWorkoutExercise`/`ExerciseLibraryItem` — consistent nullable `string | null`.
