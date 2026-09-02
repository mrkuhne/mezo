# S5 Gyakorlat-katalógus (mezo-qw37.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shared exercise catalog multi-user safe: every user still sees every row, each row now says who authored it (`authoredByMe`, `authorName`) and what the viewer may do with it (`editable`, `mediaEditable`); content edits/deletes and media writes are gated author-or-OWNER (master media OWNER-only) with a `403 EXERCISE_CATALOG_NOT_EDITABLE`; the slug generator survives two users creating the same name at once; deletes stay soft so other users' `exercise.catalog_id` links keep resolving; the FE shows a `Közös · {név}` badge on foreign rows and hides the controls the viewer cannot use.

**Architecture:** `ExerciseCatalogService` switches from a bare `UUID currentUser` to the S1 `AppUserEntity` (via `CurrentUser.get()` in `TrainController`) so it can ask `isOwner()`; two private guards (`contentEditableOrThrow`, `mediaEditableOrThrow`) implement the permission matrix below in one place; author names come from one batched `AppUserRepository.findAllById` per list call. `create()` drops its method-level `@Transactional` and inserts through `saveAndFlush` inside a 3-attempt loop that catches `DataIntegrityViolationException` on the `uq_exercise_catalog_slug` unique index and re-probes the next free suffix — the existing check-then-insert becomes check-then-insert-then-retry. Soft delete already exists (`is_deleted` + `@SQLDelete`/`@SQLRestriction` since `mezo-52zg`), so this slice adds the visibility/FK proof, not a migration. The contract grows three fields; no new endpoint, table or changeset.

**Tech Stack:** Spring Boot 4 / Spring Data JPA (Hibernate `@SQLRestriction`), openapi-generator (contract-first), JUnit 5 + Testcontainers ITs, React 19 + TanStack Query 5 + Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md` §9 (interfaces from §5; terrain §14). Closes `mezo-2fc1` (its first half — de-duplicating the catalog→video resolve — already shipped as `CatalogMediaResolver` in `mezo-8xdl.1`; the remaining half is exactly the multi-user `setVideo` scoping done here).

**Depends on S1 (`mezo-qw37.1`) being merged to `main`:** `feature/auth/service/CurrentUser.get()` returning `AppUserEntity` with `isOwner()`, `AppUserEntity.UserRole`, and the `ApiIntegrationTest.registerUser(String label)` helper returning `RegisteredUser(UUID id, String email, HttpHeaders headers)` (the label becomes the account's `name`). Branch off `main` after the S1 merge.

## Global Constraints

- Contract-first: edit `api/feature/train/train.yml`, then `cd api/generate && npm run generate:api` (merges into `api/openapi.yml`), then `cd frontend && pnpm generate:api`. Commit both generated files. Backend Java DTOs regenerate on every Maven build (`target/`, not committed).
- Every non-2xx response references `SystemMessageList`; new error codes go into `backend/src/main/resources/messages.properties` (`{DOMAIN}_{ACTION}_{REASON}`); tests assert codes via `assertHasRequestError`, never message text.
- ArchUnit (`backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java`): `@Service` in `..service..`, constructor injection only (Lombok `@RequiredArgsConstructor`), method-level `@Transactional` only, no raw `RuntimeException`/`IllegalStateException` outside `techcore`; every `@RestController` implements a generated `*Api`. Feature packages may depend on `feature.auth` (spec §5 — auth depends on nobody).
- Backend focused gate: `cd backend && ./mvnw clean test -Dtest='ExerciseCatalog*,CatalogWrite*,CatalogMedia*,ArchitectureTest' -Dmezo.test.use-testcontainers=true` (Surefire matches simple class names — every new test class in this plan starts with `ExerciseCatalog`). Always `clean` (Lombok + MapStruct incremental compile is flaky).
- Frontend gate: both `VITE_USE_MOCK=true pnpm test` and `VITE_USE_MOCK=false pnpm test` (unset = mock!), then `pnpm build`.
- Docs: update `docs/features/train.md` in the same change; `node scripts/gen-codemap.mjs` (commit `docs/CODEMAP.md`); `node scripts/lint-docs.mjs --errors-only`.
- Conventional commits carry the bd id: `feat(train): … (mezo-qw37.5)`. Branch: `feat/multi-user-s5-exercise-catalog`.
- Hungarian UI copy; hooks consumed only via `@/data/hooks`; `isMockMode()` only inside hook/component bodies; tests colocated; no relative `../` imports.
- Master catalog rows (`box-jump`, …) are never truncated by `ResetDatabase` — any test that writes media onto a master row must clear it in the same test.

---

## Decisions resolved by this plan

### The permission matrix (spec §9, made exact)

| Row | Operation | USER, not the author | USER, the author | OWNER |
|---|---|---|---|---|
| master (`created_by IS NULL`) | `PUT /api/train/exercises/{id}`, `DELETE /api/train/exercises/{id}` | **409 `CATALOG_MASTER_READONLY`** | — | **409 `CATALOG_MASTER_READONLY`** |
| master | `PUT …/{id}/video`, `PUT …/{id}/images` | **403 `EXERCISE_CATALOG_NOT_EDITABLE`** | — | 200 |
| user-authored (`created_by` set) | all five writes | **403 `EXERCISE_CATALOG_NOT_EDITABLE`** | 200 | 200 |
| unknown id, or soft-deleted | any write | 404 `RESOURCE_NOT_FOUND` | 404 | 404 |
| any | `GET /api/train/exercises` | 200, every live row | 200 | 200 |

Why master **content** stays 409 even for the OWNER (the spec's "master → csak OWNER" is applied to media only): `ExerciseCatalogLoader.load` (`backend/src/main/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoader.java:73-98`) upserts name/muscle/type/stim/fatigue by slug on **every** startup, so an OWNER edit of a master row would be silently reverted at the next deploy; and a soft-deleted master row is invisible to the loader's `findAll()` (`@SQLRestriction`) but still holds `uq_exercise_catalog_slug`, so the loader's re-INSERT would crash the next startup. Media on master rows is loader-safe (the loader never clobbers `video_url`/`image_*_url`), hence OWNER-only there. Master content becomes OWNER-editable only if the loader is taught to skip owner-touched rows — out of scope, filed as a risk below.

Why a foreign user row is **403, not 404**: the catalog is public by design (everyone lists every row, ids are not secret), so the `OwnershipGuard` "foreign == 404" invariant for owned tables does not apply; an honest 403 is what the FE needs to explain "ez nem a tiéd". The existing `CatalogWriteContractIT.testUpdateForeignUserExercise_shouldReturn404_whenNotOwner` changes meaning: the OWNER now gets 200 on that row (Task 2 rewrites it).

### Response fields — four flags, all server-derived

`ExerciseCatalogItem` gains `authoredByMe: boolean` (required), `authorName: string | null` (the author's `app_user.name`; null for master rows), `mediaEditable: boolean` (required) — and **keeps `editable`, re-defined as "the viewer may PUT/DELETE this row"** (author or OWNER of a user row; never true on master). Two permission flags rather than one because the matrix differs between content and media on master rows (OWNER: content 409, media 200). The FE derives nothing about roles — it never learns whether the viewer is OWNER; it reads `editable` (⋯ roundel), `mediaEditable` (▶ roundel), `authoredByMe` (`Saját` stamp + the hero `saját` count) and `!authoredByMe && authorName` (`Közös · {név}` stamp).

### Soft delete — already there, proven here

`202607082000_mezo-52zg_catalog_write.sql` added `is_deleted`; `ExerciseCatalogEntity` carries `@SQLDelete(sql = "update exercise_catalog set is_deleted = true where id = ?")` + `@SQLRestriction("is_deleted = false")`; `ExerciseCatalogService.delete` calls `repository.delete(...)`. So **no changeset**. What was never proven and is added in Task 5: a row deleted by its author disappears from every user's list and from `findById`/`existsById`, its slug stays occupied (`countAllBySlugIncludingDeleted`), and another user's `exercise.catalog_id` pointing at it is untouched (the FK is `ON DELETE SET NULL` and only fires on a physical delete, which never happens).

### Slug race

`uniqueSlug` (`ExerciseCatalogService.java:118-130`) keeps its pre-probe (it is what makes "Box Jump" → `box-jump-2` deterministic against master slugs, which the loader owns and never renames), and the insert moves into a retry loop: `saveAndFlush` outside any outer transaction (so the failed INSERT does not poison a shared transaction — `create()` loses its `@Transactional`; the repository call runs in its own), catch `org.springframework.dao.DataIntegrityViolationException`, re-probe (the competitor's row is now committed and visible to the native count), up to `MAX_SLUG_ATTEMPTS = 3`, then rethrow (a 500 on the third collision is acceptable — three same-second collisions on one name in a 20-user beta is not a real path).

---

## File Structure

**Contract — modify**
- `api/feature/train/train.yml` — `ExerciseCatalogItem` +3 fields; 403 responses on the five write ops; summaries.
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`.

**Backend — modify**
- `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ExerciseCatalogService.java` — `AppUserEntity`-based API, permission guards, author-name join, slug retry.
- `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java` — inject `CurrentUser`, pass `currentUser.get()` to the six catalog methods.
- `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java` — ignore the three new DTO fields on `toCatalogItem`.
- `backend/src/main/resources/messages.properties` — `EXERCISE_CATALOG_NOT_EDITABLE`.
- `backend/src/test/java/io/mrkuhne/mezo/feature/train/CatalogWriteContractIT.java` — owner-now-can-edit-foreign + `mediaEditable` asserts.

**Backend — create (tests)**
- `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogPermissionIT.java` — the matrix + the per-viewer flags.
- `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogSlugRaceIT.java` — two threads, one name; master-slug suffixing.
- `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogSoftDeleteIT.java` — visibility + FK survival.

**Frontend — modify**
- `frontend/src/data/types.ts` — `ExerciseLibraryItem` +3 optional fields.
- `frontend/src/data/train/trainHooks.ts` — `toLibraryItem` maps them.
- `frontend/src/data/train/trainHooks.test.tsx` — typed fixtures gain the required fields.
- `frontend/src/test/msw/handlers.ts` — catalog fixture carries the flags; one shared (foreign-authored) row.
- `frontend/src/features/train/pages/ExercisesPage.tsx` — `Saját`/`Közös` stamps, roundel gating.
- `frontend/src/features/train/pages/ExercisesPage.test.tsx` — new cases both modes.
- `frontend/src/features/train/sheets/VideoUrlSheet.tsx` — header comment only (no longer ownership-free).

**Docs — modify**
- `docs/features/train.md` §2 (`Gyakorlatok`), §4 (`Exercise catalog + records`), §8, §10.
- `docs/CODEMAP.md` (regenerated).

---

### Task 1: Contract — `authoredByMe` / `authorName` / `mediaEditable` + 403 on the write ops

**Files:**
- Modify: `api/feature/train/train.yml` (paths at `:597-704`, schema `ExerciseCatalogItem` at `:2534-2579`)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `io.mrkuhne.mezo.api.dto.ExerciseCatalogItem` with `Boolean getAuthoredByMe()/setAuthoredByMe`, `String getAuthorName()/setAuthorName`, `Boolean getMediaEditable()/setMediaEditable` (Lombok builder + all-args as today); FE `components['schemas']['ExerciseCatalogItem']` with `authoredByMe: boolean`, `authorName?: string | null`, `mediaEditable: boolean`.

- [ ] **Step 1: Edit the schema**

In `api/feature/train/train.yml`, replace the `ExerciseCatalogItem` `required` list and the `editable` property with:

```yaml
    ExerciseCatalogItem:
      type: object
      required:
        - id
        - slug
        - name
        - muscle
        - type
        - stim
        - fatigue
        - editable
        - mediaEditable
        - authoredByMe
      properties:
        # … id / slug / name / muscle / type / stim / fatigue / videoUrl / imageStartUrl / imageEndUrl unchanged …
        editable:
          type: boolean
          description: >-
            true when the viewer may PUT/DELETE this row — its author or the OWNER on a
            user-authored row. Never true on a master (built-in) row: those are loader-owned
            content (409 CATALOG_MASTER_READONLY for everyone).
        mediaEditable:
          type: boolean
          description: >-
            true when the viewer may set/clear the demo video and stills — the author or the
            OWNER on a user-authored row, the OWNER only on a master row.
        authoredByMe:
          type: boolean
          description: true when created_by == the viewer (multi-user S5, mezo-qw37.5)
        authorName:
          type: string
          nullable: true
          description: The author's display name for user-authored rows; null on master rows
```

- [ ] **Step 2: Edit the five write operations**

`updateExercise` (`PUT /api/train/exercises/{id}`) — summary and responses:

```yaml
      summary: Update a user-authored exercise (author or OWNER; master rows → 409)
      # … parameters/requestBody unchanged …
      responses:
        '200':
          description: Updated exercise
          content: { application/json: { schema: { $ref: '#/components/schemas/ExerciseCatalogItem' } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '403': { description: Not the author nor the OWNER (EXERCISE_CATALOG_NOT_EDITABLE), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: Master row is read-only, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

`deleteExercise` — summary `Soft-delete a user-authored exercise (author or OWNER; master rows → 409)`; add the same `'403'` line between `'401'` and `'404'`.

`setExerciseVideo` — summary `Set/clear the demo video (author or OWNER on a user row; OWNER only on a master row)`; add the `'403'` line between `'401'` and `'404'`.

`setExerciseImages` — summary `Set/clear the demo stills (author or OWNER on a user row; OWNER only on a master row)`; add the `'403'` line between `'401'` and `'404'`.

`getExerciseCatalog` — summary `Shared exercise catalog (master + every user's rows), muscle then name ascending; each item carries the viewer's permissions`.

- [ ] **Step 3: Regenerate**

Run:
```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```
Expected: `grep -n "mediaEditable\|authoredByMe\|authorName" frontend/src/data/_client/api.gen.ts` shows the three properties under `ExerciseCatalogItem`.

- [ ] **Step 4: Verify the backend DTO regenerates (compilation of the service will fail until Task 2 — that is expected)**

Run: `cd backend && ./mvnw -q generate-sources && grep -n "mediaEditable\|authoredByMe\|authorName" target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/ExerciseCatalogItem.java | head -6`
Expected: the three fields are listed.

- [ ] **Step 5: Commit**

```bash
git add api/feature/train/train.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): exercise catalog item carries authoredByMe/authorName/mediaEditable, 403 on writes (mezo-qw37.5)"
```

---

### Task 2: Backend permission matrix — `AppUserEntity`-based service, guards, `EXERCISE_CATALOG_NOT_EDITABLE`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ExerciseCatalogService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java:76-117`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java:67-69`
- Modify: `backend/src/main/resources/messages.properties` (after line 13 `CATALOG_MASTER_READONLY`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/train/CatalogWriteContractIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogPermissionIT.java`

**Interfaces:**
- Consumes (S1): `io.mrkuhne.mezo.feature.auth.service.CurrentUser.get() : AppUserEntity`, `AppUserEntity.getId()`, `AppUserEntity.getName()`, `AppUserEntity.isOwner()`, `AppUserRepository.findAllById(Iterable<UUID>)` (inherited from `JpaRepository`), `ApiIntegrationTest.registerUser(String) : RegisteredUser(id, email, headers)`.
- Produces: `ExerciseCatalogService.list(AppUserEntity viewer)`, `create(AppUserEntity author, CatalogExerciseCreateRequest)`, `update(AppUserEntity actor, UUID id, CatalogExerciseCreateRequest)`, `delete(AppUserEntity actor, UUID id)`, `setVideo(AppUserEntity actor, UUID id, String videoUrl)`, `setImages(AppUserEntity actor, UUID id, String startUrl, String endUrl)` — all returning `ExerciseCatalogItem` (except `delete`) with the four flags populated. Error code `EXERCISE_CATALOG_NOT_EDITABLE` (403).

- [ ] **Step 1: Add the message code**

Append after `CATALOG_MASTER_READONLY=…` in `messages.properties`:

```properties
EXERCISE_CATALOG_NOT_EDITABLE=Ezt a gyakorlatot csak a szerzője vagy a tulajdonos szerkesztheti.
```

- [ ] **Step 2: Write the failing permission IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogPermissionIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.CatalogImagesRequest;
import io.mrkuhne.mezo.api.dto.CatalogVideoRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * The multi-user permission matrix of the shared exercise catalog (S5, mezo-qw37.5):
 * master row content → 409 for everyone; master row media → OWNER only (403 otherwise);
 * user-authored row → its author or the OWNER (403 otherwise); plus the per-viewer flags
 * (editable / mediaEditable / authoredByMe / authorName) on the list.
 */
class ExerciseCatalogPermissionIT extends ApiIntegrationTest {

    private static final String VIDEO = "https://youtu.be/dQw4w9WgXcQ";

    private static CatalogExerciseCreateRequest request(String name) {
        return CatalogExerciseCreateRequest.builder()
            .name(name).muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.COMPOUND)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
    }

    private static CatalogVideoRequest video(String url) {
        return CatalogVideoRequest.builder().videoUrl(url).build();
    }

    private ExerciseCatalogItem find(HttpHeaders viewer, UUID id) {
        return getForList("/api/train/exercises", viewer, HttpStatus.OK, ExerciseCatalogItem.class)
            .stream().filter(e -> id.equals(e.getId())).findFirst().orElseThrow();
    }

    private ExerciseCatalogItem master(HttpHeaders viewer, String slug) {
        return getForList("/api/train/exercises", viewer, HttpStatus.OK, ExerciseCatalogItem.class)
            .stream().filter(e -> slug.equals(e.getSlug())).findFirst().orElseThrow();
    }

    private ExerciseCatalogItem createAs(HttpHeaders author, String name) {
        return postForBody("/api/train/exercises", request(name), author, HttpStatus.CREATED, ExerciseCatalogItem.class);
    }

    // ---- master rows ----

    @Test
    void testSetVideo_shouldReturn403_whenUserTouchesMasterRow() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem boxJump = master(anna.headers(), "box-jump");
        String body = putForBody("/api/train/exercises/" + boxJump.getId() + "/video", video(VIDEO),
            anna.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "EXERCISE_CATALOG_NOT_EDITABLE");
    }

    @Test
    void testSetImages_shouldReturn403_whenUserTouchesMasterRow() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem boxJump = master(anna.headers(), "box-jump");
        CatalogImagesRequest req = CatalogImagesRequest.builder()
            .imageStartUrl("/exercises/box-jump-a.jpg").imageEndUrl("/exercises/box-jump-b.jpg").build();
        String body = putForBody("/api/train/exercises/" + boxJump.getId() + "/images", req,
            anna.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "EXERCISE_CATALOG_NOT_EDITABLE");
    }

    @Test
    void testUpdateAndDelete_shouldReturn409_whenUserTouchesMasterRow() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem boxJump = master(anna.headers(), "box-jump");
        String put = putForBody("/api/train/exercises/" + boxJump.getId(), request("x"),
            anna.headers(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(put, "CATALOG_MASTER_READONLY");
        String del = exchangeForBody(HttpMethod.DELETE, "/api/train/exercises/" + boxJump.getId(), null,
            anna.headers(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(del, "CATALOG_MASTER_READONLY");
    }

    @Test
    void testSetVideo_shouldReturn200_whenOwnerTouchesMasterRow() {
        HttpHeaders owner = ownerAuthHeaders();
        ExerciseCatalogItem boxJump = master(owner, "box-jump");
        ExerciseCatalogItem out = putForBody("/api/train/exercises/" + boxJump.getId() + "/video", video(VIDEO),
            owner, HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(out.getVideoUrl()).isEqualTo(VIDEO);
        assertThat(out.getEditable()).isFalse();
        assertThat(out.getMediaEditable()).isTrue();
        // box-jump is a master row ResetDatabase never cleans — clear the residue.
        putForBody("/api/train/exercises/" + boxJump.getId() + "/video", video(null), owner, HttpStatus.OK, ExerciseCatalogItem.class);
    }

    // ---- user-authored rows ----

    @Test
    void testUpdateAndSetVideo_shouldReturn200_whenUserTouchesOwnRow() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem mine = createAs(anna.headers(), "Anna Move");
        ExerciseCatalogItem updated = putForBody("/api/train/exercises/" + mine.getId(), request("Anna Move v2"),
            anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(updated.getName()).isEqualTo("Anna Move v2");
        ExerciseCatalogItem withVideo = putForBody("/api/train/exercises/" + mine.getId() + "/video", video(VIDEO),
            anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(withVideo.getVideoUrl()).isEqualTo(VIDEO);
        deleteAndExpect("/api/train/exercises/" + mine.getId(), anna.headers(), HttpStatus.NO_CONTENT);
    }

    @Test
    void testUpdateDeleteAndMedia_shouldReturn403_whenUserTouchesOtherUsersRow() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        ExerciseCatalogItem annas = createAs(anna.headers(), "Anna Move");

        String put = putForBody("/api/train/exercises/" + annas.getId(), request("hijack"),
            bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(put, "EXERCISE_CATALOG_NOT_EDITABLE");
        String del = exchangeForBody(HttpMethod.DELETE, "/api/train/exercises/" + annas.getId(), null,
            bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(del, "EXERCISE_CATALOG_NOT_EDITABLE");
        String vid = putForBody("/api/train/exercises/" + annas.getId() + "/video", video(VIDEO),
            bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(vid, "EXERCISE_CATALOG_NOT_EDITABLE");
        String img = putForBody("/api/train/exercises/" + annas.getId() + "/images",
            CatalogImagesRequest.builder().imageStartUrl("/x-a.jpg").imageEndUrl("/x-b.jpg").build(),
            bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(img, "EXERCISE_CATALOG_NOT_EDITABLE");

        // Nothing leaked through: the row is unchanged for its author.
        assertThat(find(anna.headers(), annas.getId()).getName()).isEqualTo("Anna Move");
    }

    @Test
    void testOwner_shouldReturn200_whenTouchingAnotherUsersRow() {
        RegisteredUser anna = registerUser("Anna");
        HttpHeaders owner = ownerAuthHeaders();
        ExerciseCatalogItem annas = createAs(anna.headers(), "Anna Move");

        ExerciseCatalogItem updated = putForBody("/api/train/exercises/" + annas.getId(), request("Curated by owner"),
            owner, HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(updated.getName()).isEqualTo("Curated by owner");
        assertThat(updated.getAuthoredByMe()).isFalse();
        assertThat(updated.getAuthorName()).isEqualTo("Anna");
        putForBody("/api/train/exercises/" + annas.getId() + "/video", video(VIDEO), owner, HttpStatus.OK, ExerciseCatalogItem.class);
        deleteAndExpect("/api/train/exercises/" + annas.getId(), owner, HttpStatus.NO_CONTENT);
    }

    @Test
    void testAnyWrite_shouldReturn404_whenIdUnknown() {
        RegisteredUser anna = registerUser("Anna");
        UUID ghost = UUID.randomUUID();
        putForBody("/api/train/exercises/" + ghost, request("x"), anna.headers(), HttpStatus.NOT_FOUND, String.class);
        putForBody("/api/train/exercises/" + ghost + "/video", video(VIDEO), anna.headers(), HttpStatus.NOT_FOUND, String.class);
        putForBody("/api/train/exercises/" + ghost, request("x"), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    // ---- the per-viewer flags on the list ----

    @Test
    void testList_shouldCarryViewerPermissions_whenThreeAccountsLookAtTheSameRows() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        HttpHeaders owner = ownerAuthHeaders();
        UUID annasId = createAs(anna.headers(), "Anna Move").getId();

        ExerciseCatalogItem asAnna = find(anna.headers(), annasId);
        assertThat(asAnna.getAuthoredByMe()).isTrue();
        assertThat(asAnna.getAuthorName()).isEqualTo("Anna");
        assertThat(asAnna.getEditable()).isTrue();
        assertThat(asAnna.getMediaEditable()).isTrue();

        ExerciseCatalogItem asBela = find(bela.headers(), annasId);
        assertThat(asBela.getAuthoredByMe()).isFalse();
        assertThat(asBela.getAuthorName()).isEqualTo("Anna");
        assertThat(asBela.getEditable()).isFalse();
        assertThat(asBela.getMediaEditable()).isFalse();

        ExerciseCatalogItem asOwner = find(owner, annasId);
        assertThat(asOwner.getAuthoredByMe()).isFalse();
        assertThat(asOwner.getAuthorName()).isEqualTo("Anna");
        assertThat(asOwner.getEditable()).isTrue();
        assertThat(asOwner.getMediaEditable()).isTrue();

        ExerciseCatalogItem masterAsBela = master(bela.headers(), "box-jump");
        assertThat(masterAsBela.getAuthoredByMe()).isFalse();
        assertThat(masterAsBela.getAuthorName()).isNull();
        assertThat(masterAsBela.getEditable()).isFalse();
        assertThat(masterAsBela.getMediaEditable()).isFalse();

        ExerciseCatalogItem masterAsOwner = master(owner, "box-jump");
        assertThat(masterAsOwner.getEditable()).isFalse();
        assertThat(masterAsOwner.getMediaEditable()).isTrue();
    }

    @Test
    void testList_shouldShowEveryUsersRows_whenTwoUsersAuthor() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        UUID annasId = createAs(anna.headers(), "Anna Move").getId();
        UUID belasId = createAs(bela.headers(), "Béla Move").getId();
        assertThat(getForList("/api/train/exercises", anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class))
            .extracting(ExerciseCatalogItem::getId).contains(annasId, belasId);
        assertThat(getForList("/api/train/exercises", bela.headers(), HttpStatus.OK, ExerciseCatalogItem.class))
            .extracting(ExerciseCatalogItem::getId).contains(annasId, belasId);
    }
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='ExerciseCatalogPermissionIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation error — `getMediaEditable()`/`getAuthoredByMe()` exist on the regenerated DTO, but the mapper does not populate the new fields yet and the assertions on 403 fail with 200/404 (`testSetVideo_shouldReturn403_whenUserTouchesMasterRow` gets 200; `…OtherUsersRow` gets 404 on PUT/DELETE and 200 on video). If the build fails earlier because MapStruct reports "Unmapped target properties" as an error, do Step 4 first.

- [ ] **Step 4: Mapper — ignore the three derived fields**

In `TrainMapper.java`, replace the `toCatalogItem` block:

```java
    @Mapping(target = "type", expression = "java(ExerciseCatalogItem.TypeEnum.fromValue(entity.getType()))")
    @Mapping(target = "editable", ignore = true)
    @Mapping(target = "mediaEditable", ignore = true)
    @Mapping(target = "authoredByMe", ignore = true)
    @Mapping(target = "authorName", ignore = true)
    ExerciseCatalogItem toCatalogItem(ExerciseCatalogEntity entity);
```

- [ ] **Step 5: Rewrite `ExerciseCatalogService`**

Replace the whole file with (the slug retry loop is Task 4 — this version keeps today's `uniqueSlug` and `@Transactional create` so the diff stays reviewable):

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read + write side of the shared exercise catalog (multi-user since S5, mezo-qw37.5).
 *
 * <p>Everyone lists everything. Writes follow one matrix: a MASTER row (created_by null) is
 * loader-owned content — its name/muscle/type/stim/fatigue are read-only for everyone
 * (409 CATALOG_MASTER_READONLY, because {@code ExerciseCatalogLoader} re-upserts them at every
 * startup) while its media (video, stills) is OWNER-only; a USER-authored row may be edited,
 * deleted and re-mediated by its author or the OWNER. Anything else is 403
 * EXERCISE_CATALOG_NOT_EDITABLE (the catalog is public, so a foreign row is not a 404 here).
 * Each returned item carries the viewer's permissions ({@code editable}, {@code mediaEditable})
 * and the authorship ({@code authoredByMe}, {@code authorName}); the FE derives nothing about
 * roles itself. Sorted muscle-then-name so the picker renders grouped.
 */
@Service
@RequiredArgsConstructor
public class ExerciseCatalogService {

    private final ExerciseCatalogRepository repository;
    private final AppUserRepository appUserRepository;
    private final TrainMapper mapper;

    public List<ExerciseCatalogItem> list(AppUserEntity viewer) {
        List<ExerciseCatalogEntity> rows = repository.findAllByOrderByMuscleAscNameAsc();
        Map<UUID, String> names = authorNames(rows);
        return rows.stream().map(e -> toItem(e, viewer, names)).toList();
    }

    @Transactional
    public ExerciseCatalogItem create(AppUserEntity author, CatalogExerciseCreateRequest req) {
        ExerciseCatalogEntity e = new ExerciseCatalogEntity();
        e.setCreatedBy(author.getId());
        e.setSlug(uniqueSlug(req.getName()));
        apply(e, req);
        return toItem(repository.save(e), author, Map.of(author.getId(), author.getName()));
    }

    @Transactional
    public ExerciseCatalogItem update(AppUserEntity actor, UUID id, CatalogExerciseCreateRequest req) {
        ExerciseCatalogEntity e = contentEditableOrThrow(actor, id);
        apply(e, req);
        // UPDATE sets the media fields unconditionally so clearing one (null) actually removes it.
        // CREATE keeps apply()'s set-only-when-present semantics (a fresh row defaults to null).
        e.setVideoUrl(req.getVideoUrl());
        e.setImageStartUrl(req.getImageStartUrl());
        e.setImageEndUrl(req.getImageEndUrl());
        return toItem(repository.save(e), actor, authorNames(List.of(e)));
    }

    @Transactional
    public void delete(AppUserEntity actor, UUID id) {
        repository.delete(contentEditableOrThrow(actor, id)); // @SQLDelete soft-deletes
    }

    @Transactional
    public ExerciseCatalogItem setVideo(AppUserEntity actor, UUID id, String videoUrl) {
        ExerciseCatalogEntity e = mediaEditableOrThrow(actor, id);
        e.setVideoUrl(videoUrl);
        return toItem(repository.save(e), actor, authorNames(List.of(e)));
    }

    /** Both frames are written unconditionally, so a null clears that frame. */
    @Transactional
    public ExerciseCatalogItem setImages(AppUserEntity actor, UUID id, String startUrl, String endUrl) {
        ExerciseCatalogEntity e = mediaEditableOrThrow(actor, id);
        e.setImageStartUrl(startUrl);
        e.setImageEndUrl(endUrl);
        return toItem(repository.save(e), actor, authorNames(List.of(e)));
    }

    // ---- the permission matrix ----

    /** PUT/DELETE: never on a master row (409); author or OWNER on a user row (else 403). */
    private ExerciseCatalogEntity contentEditableOrThrow(AppUserEntity actor, UUID id) {
        ExerciseCatalogEntity e = repository.findById(id).orElseThrow(OwnershipGuard::notFound);
        if (e.getCreatedBy() == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("CATALOG_MASTER_READONLY").build(), HttpStatus.CONFLICT);
        }
        requireAuthorOrOwner(actor, e);
        return e;
    }

    /** video/images: OWNER only on a master row; author or OWNER on a user row (else 403). */
    private ExerciseCatalogEntity mediaEditableOrThrow(AppUserEntity actor, UUID id) {
        ExerciseCatalogEntity e = repository.findById(id).orElseThrow(OwnershipGuard::notFound);
        if (e.getCreatedBy() == null) {
            if (!actor.isOwner()) {
                throw notEditable();
            }
            return e;
        }
        requireAuthorOrOwner(actor, e);
        return e;
    }

    private static void requireAuthorOrOwner(AppUserEntity actor, ExerciseCatalogEntity e) {
        if (!actor.isOwner() && !actor.getId().equals(e.getCreatedBy())) {
            throw notEditable();
        }
    }

    private static SystemRuntimeErrorException notEditable() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("EXERCISE_CATALOG_NOT_EDITABLE").build(), HttpStatus.FORBIDDEN);
    }

    // ---- mapping ----

    private void apply(ExerciseCatalogEntity e, CatalogExerciseCreateRequest req) {
        e.setName(req.getName());
        e.setMuscle(req.getMuscle().getValue());
        e.setType(req.getType().getValue());
        e.setStim(req.getStim());
        e.setFatigue(req.getFatigue());
        if (req.getVideoUrl() != null) {
            e.setVideoUrl(req.getVideoUrl());
        }
        if (req.getImageStartUrl() != null) {
            e.setImageStartUrl(req.getImageStartUrl());
        }
        if (req.getImageEndUrl() != null) {
            e.setImageEndUrl(req.getImageEndUrl());
        }
    }

    /** One batched app_user read per list call — never a lookup per row. */
    private Map<UUID, String> authorNames(Collection<ExerciseCatalogEntity> rows) {
        Set<UUID> ids = rows.stream().map(ExerciseCatalogEntity::getCreatedBy)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return appUserRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(AppUserEntity::getId, AppUserEntity::getName));
    }

    private ExerciseCatalogItem toItem(ExerciseCatalogEntity e, AppUserEntity viewer, Map<UUID, String> names) {
        boolean master = e.getCreatedBy() == null;
        boolean mine = !master && e.getCreatedBy().equals(viewer.getId());
        ExerciseCatalogItem dto = mapper.toCatalogItem(e);
        dto.setAuthoredByMe(mine);
        dto.setAuthorName(master ? null : names.get(e.getCreatedBy()));
        dto.setEditable(!master && (mine || viewer.isOwner()));
        dto.setMediaEditable(master ? viewer.isOwner() : (mine || viewer.isOwner()));
        return dto;
    }

    private String uniqueSlug(String name) {
        String base = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.isBlank()) {
            base = "exercise";
        }
        String candidate = base;
        int n = 1;
        while (repository.countAllBySlugIncludingDeleted(candidate) > 0) {
            n++;
            candidate = base + "-" + n;
        }
        return candidate;
    }
}
```

- [ ] **Step 6: Controller — pass the account entity**

In `TrainController.java`: add `import io.mrkuhne.mezo.feature.auth.service.CurrentUser;`, add the field `private final CurrentUser currentUser;` next to `private final CurrentUserId currentUserId;` (line 81), and replace the six catalog methods (lines 88-117):

```java
    @Override
    public List<ExerciseCatalogItem> getExerciseCatalog() {
        return exerciseCatalogService.list(currentUser.get());
    }

    @Override
    public ExerciseCatalogItem createExercise(CatalogExerciseCreateRequest catalogExerciseCreateRequest) {
        return exerciseCatalogService.create(currentUser.get(), catalogExerciseCreateRequest);
    }

    @Override
    public ExerciseCatalogItem updateExercise(UUID id, CatalogExerciseCreateRequest catalogExerciseCreateRequest) {
        return exerciseCatalogService.update(currentUser.get(), id, catalogExerciseCreateRequest);
    }

    @Override
    public void deleteExercise(UUID id) {
        exerciseCatalogService.delete(currentUser.get(), id);
    }

    @Override
    public ExerciseCatalogItem setExerciseVideo(UUID id, CatalogVideoRequest catalogVideoRequest) {
        return exerciseCatalogService.setVideo(currentUser.get(), id, catalogVideoRequest.getVideoUrl());
    }

    @Override
    public ExerciseCatalogItem setExerciseImages(UUID id, CatalogImagesRequest catalogImagesRequest) {
        return exerciseCatalogService.setImages(currentUser.get(), id,
            catalogImagesRequest.getImageStartUrl(), catalogImagesRequest.getImageEndUrl());
    }
```

(`currentUser.get()` is request-cached by S1's `CurrentUser`, so the second call inside one request is free.)

- [ ] **Step 7: Update `CatalogWriteContractIT` to the new matrix**

Three edits in `backend/src/test/java/io/mrkuhne/mezo/feature/train/CatalogWriteContractIT.java`:

(a) Class Javadoc: replace "attaching a demo video to any row (master stays non-editable)" with "attaching demo media to a master row as the OWNER (master stays content-non-editable, media-editable for the OWNER only — the USER side of the matrix lives in `ExerciseCatalogPermissionIT`)".

(b) In `testSetVideo_shouldAttachToMaster_whenAnyRow` (rename to `testSetVideo_shouldAttachToMaster_whenOwner`) and in `testSetExerciseImages_shouldAttachAndClearOnMasterRow_whenOwnershipFree` (rename to `…_whenOwner`), after the existing `assertThat(out.getEditable()).isFalse();` add:

```java
        assertThat(out.getMediaEditable()).isTrue();   // OWNER may re-mediate master content
        assertThat(out.getAuthoredByMe()).isFalse();
        assertThat(out.getAuthorName()).isNull();
```

(c) Replace `testUpdateForeignUserExercise_shouldReturn404_whenNotOwner` entirely:

```java
    @Test
    void testUpdateForeignUserExercise_shouldReturn200_whenOwnerCurates() {
        // The OWNER curates the shared catalog: another user's row is editable for them (S5).
        // A plain USER touching a foreign row gets 403 — see ExerciseCatalogPermissionIT.
        HttpHeaders auth = ownerAuthHeaders();
        UUID otherUserId = databasePopulator.populateUser("other@example.com");
        ExerciseCatalogEntity foreign = train.createUserCatalogExercise(otherUserId, "Foreign Move", "quad", "plyo");
        CatalogExerciseCreateRequest req = CatalogExerciseCreateRequest.builder()
            .name("Foreign Move · curated").muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.PLYO)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
        ExerciseCatalogItem out = putForBody(
            "/api/train/exercises/" + foreign.getId(), req, auth, HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(out.getName()).isEqualTo("Foreign Move · curated");
        assertThat(out.getAuthoredByMe()).isFalse();
        assertThat(out.getEditable()).isTrue();
        assertThat(out.getAuthorName()).isEqualTo("other@example.com"); // UserPopulator sets name = email
    }
```

Also in `testCreateExercise_shouldReturnEditableUserRow_whenValid` add after the `editable` assert:

```java
        assertThat(body.getAuthoredByMe()).isTrue();
        assertThat(body.getMediaEditable()).isTrue();
```

- [ ] **Step 8: Run the focused ITs + ArchUnit**

Run: `cd backend && ./mvnw clean test -Dtest='ExerciseCatalogPermissionIT,CatalogWriteContractIT,ExerciseCatalogContractIT,CatalogMediaResolutionIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train backend/src/main/resources/messages.properties backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogPermissionIT.java backend/src/test/java/io/mrkuhne/mezo/feature/train/CatalogWriteContractIT.java
git commit -m "feat(train): exercise catalog permission matrix — author/OWNER writes, master media OWNER-only, viewer flags + author name (mezo-qw37.5)"
```

---

### Task 3: Slug race — retry on `DataIntegrityViolationException`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ExerciseCatalogService.java` (`create`, `uniqueSlug`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogSlugRaceIT.java`

**Interfaces:**
- Consumes: `ExerciseCatalogRepository.countAllBySlugIncludingDeleted(String)` (native, sees soft-deleted slugs — `ExerciseCatalogRepository.java:27-29`), `ApiIntegrationTest.exchangeForResponse(...)` (raw, status not asserted — thread-safe for parallel calls).
- Produces: `ExerciseCatalogService.create` is no longer `@Transactional`; constant `MAX_SLUG_ATTEMPTS = 3`.

- [ ] **Step 1: Write the failing race IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Slug generation under contention (mezo-2fc1 / S5): two requests creating the same name at the
 * same moment must both succeed with distinct slugs, never a 500 from uq_exercise_catalog_slug;
 * and a name matching a built-in row must be suffixed past the master slug.
 */
class ExerciseCatalogSlugRaceIT extends ApiIntegrationTest {

    private static CatalogExerciseCreateRequest request(String name) {
        return CatalogExerciseCreateRequest.builder()
            .name(name).muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.COMPOUND)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
    }

    @Test
    void testCreateExercise_shouldYieldDistinctSlugs_whenTwoRequestsRaceOnOneName() throws Exception {
        HttpHeaders auth = ownerAuthHeaders();
        CountDownLatch go = new CountDownLatch(1);
        Callable<ResponseEntity<String>> post = () -> {
            go.await(10, TimeUnit.SECONDS);
            return exchangeForResponse(HttpMethod.POST, "/api/train/exercises", request("Race Move"), auth);
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<ResponseEntity<String>> first = pool.submit(post);
            Future<ResponseEntity<String>> second = pool.submit(post);
            go.countDown();
            ResponseEntity<String> r1 = first.get(30, TimeUnit.SECONDS);
            ResponseEntity<String> r2 = second.get(30, TimeUnit.SECONDS);

            assertThat(r1.getStatusCode()).withFailMessage("body: %s", r1.getBody()).isEqualTo(HttpStatus.CREATED);
            assertThat(r2.getStatusCode()).withFailMessage("body: %s", r2.getBody()).isEqualTo(HttpStatus.CREATED);
            ExerciseCatalogItem a = objectMapper.readValue(r1.getBody(), ExerciseCatalogItem.class);
            ExerciseCatalogItem b = objectMapper.readValue(r2.getBody(), ExerciseCatalogItem.class);
            assertThat(List.of(a.getSlug(), b.getSlug())).containsExactlyInAnyOrder("race-move", "race-move-2");
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void testCreateExercise_shouldSuffixPastMasterSlug_whenNameMatchesBuiltIn() {
        // "Box Jump" is loader content (slug box-jump); a user's row with the same name gets -2.
        ExerciseCatalogItem mine = postForBody("/api/train/exercises", request("Box Jump"),
            ownerAuthHeaders(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        assertThat(mine.getSlug()).isEqualTo("box-jump-2");
        ExerciseCatalogItem again = postForBody("/api/train/exercises", request("Box Jump"),
            ownerAuthHeaders(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        assertThat(again.getSlug()).isEqualTo("box-jump-3");
    }
}
```

- [ ] **Step 2: Run to verify it fails (or is flaky)**

Run: `cd backend && ./mvnw clean test -Dtest='ExerciseCatalogSlugRaceIT' -Dmezo.test.use-testcontainers=true`
Expected: `testCreateExercise_shouldYieldDistinctSlugs…` FAILS at least intermittently with one 500 (`DataIntegrityViolationException` → `INTERNAL_ERROR`) — run it up to three times; the master-slug test passes already (it exercises today's pre-probe). If the race never materialises locally, proceed anyway: the retry loop is the point, and Step 4 asserts the loop through the deterministic path too.

- [ ] **Step 3: Implement the retry loop**

In `ExerciseCatalogService.java`:

Add the imports `org.springframework.dao.DataIntegrityViolationException` and `lombok.extern.slf4j.Slf4j`; annotate the class with `@Slf4j`; add the constant under the fields:

```java
    /** Slug collisions under contention: re-probe and re-insert this many times before giving up. */
    static final int MAX_SLUG_ATTEMPTS = 3;
```

Replace `create` (remove its `@Transactional` — the failed INSERT must not poison an enclosing transaction; each `saveAndFlush` runs in the repository's own):

```java
    /**
     * Check-then-insert-then-retry. The pre-probe ({@link #uniqueSlug}) makes the common case
     * deterministic ("Box Jump" → box-jump-2 past the master slug); the retry covers the race where
     * two requests probe the same free slug and the second INSERT trips uq_exercise_catalog_slug.
     * Deliberately NOT @Transactional: a unique-violation on flush marks the surrounding transaction
     * rollback-only, so the retry has to happen outside one — saveAndFlush commits per attempt.
     */
    public ExerciseCatalogItem create(AppUserEntity author, CatalogExerciseCreateRequest req) {
        String base = slugBase(req.getName());
        DataIntegrityViolationException last = null;
        for (int attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
            ExerciseCatalogEntity e = new ExerciseCatalogEntity(); // a fresh instance per attempt
            e.setCreatedBy(author.getId());
            e.setSlug(uniqueSlug(base));
            apply(e, req);
            try {
                return toItem(repository.saveAndFlush(e), author, Map.of(author.getId(), author.getName()));
            } catch (DataIntegrityViolationException ex) {
                last = ex;
                log.info("Catalog slug collision on '{}' (attempt {}/{}), re-probing", e.getSlug(), attempt, MAX_SLUG_ATTEMPTS);
            }
        }
        throw last;
    }
```

Replace `uniqueSlug` with the split pair:

```java
    private static String slugBase(String name) {
        String base = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return base.isBlank() ? "exercise" : base;
    }

    /** First free candidate: base, base-2, base-3 … against the physical table (soft-deleted rows included). */
    private String uniqueSlug(String base) {
        String candidate = base;
        int n = 1;
        while (repository.countAllBySlugIncludingDeleted(candidate) > 0) {
            n++;
            candidate = base + "-" + n;
        }
        return candidate;
    }
```

- [ ] **Step 4: Run the race IT several times + the write contract**

Run (three times): `cd backend && ./mvnw clean test -Dtest='ExerciseCatalogSlugRaceIT,CatalogWriteContractIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS every time; when the race materialises the log shows `Catalog slug collision on 'race-move' (attempt 1/3), re-probing`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ExerciseCatalogService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogSlugRaceIT.java
git commit -m "fix(train): catalog slug race — retry on unique violation instead of 500, closes mezo-2fc1 (mezo-qw37.5)"
```

---

### Task 4: Soft-delete visibility + FK survival IT

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogSoftDeleteIT.java`

**Interfaces:**
- Consumes: `TrainPopulator.createMesocycle(UUID createdBy, String title, String status)`, `createWorkoutSession(UUID createdBy, UUID mesocycleId, String dayLabel, String type, int order, String status)`, `createExercise(UUID createdBy, UUID workoutSessionId, String name, int order, String muscle, String type, UUID catalogId)` (as used in `CatalogMediaResolutionIT`), `ExerciseRepository.findById`, `ExerciseCatalogRepository.findById/existsById/countAllBySlugIncludingDeleted`.
- Produces: nothing new in production code — this task documents and pins existing behaviour (no changeset: `is_deleted` exists since `202607082000_mezo-52zg_catalog_write.sql`).

- [ ] **Step 1: Write the IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Deleting a shared catalog row is a SOFT delete (spec §9): it vanishes from every user's list
 * and from by-id reads, its slug stays occupied, and another user's exercise.catalog_id link to
 * it survives untouched (the ON DELETE SET NULL FK only fires on a physical delete, which never
 * happens on this table).
 */
class ExerciseCatalogSoftDeleteIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator train;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private ExerciseRepository exerciseRepository;

    private static CatalogExerciseCreateRequest request(String name) {
        return CatalogExerciseCreateRequest.builder()
            .name(name).muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.COMPOUND)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
    }

    @Test
    void testDelete_shouldHideRowEverywhereButKeepOtherUsersLink_whenAuthorDeletes() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        ExerciseCatalogItem annas = postForBody("/api/train/exercises", request("Anna Move"),
            anna.headers(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        UUID catalogId = annas.getId();

        // Béla planned Anna's exercise into his own mesocycle (the link every user may make).
        MesocycleEntity meso = train.createMesocycle(bela.id(), "Béla meso", "active");
        WorkoutSessionEntity day = train.createWorkoutSession(bela.id(), meso.getId(), "Hétfő", "push", 0, "active");
        ExerciseEntity linked = train.createExercise(bela.id(), day.getId(), "Anna Move", 0, "quad", "compound", catalogId);

        deleteAndExpect("/api/train/exercises/" + catalogId, anna.headers(), HttpStatus.NO_CONTENT);

        // Hidden from every viewer's list and from by-id reads (Hibernate @SQLRestriction)…
        assertThat(getForList("/api/train/exercises", anna.headers(), HttpStatus.OK, ExerciseCatalogItem.class))
            .extracting(ExerciseCatalogItem::getId).doesNotContain(catalogId);
        assertThat(getForList("/api/train/exercises", bela.headers(), HttpStatus.OK, ExerciseCatalogItem.class))
            .extracting(ExerciseCatalogItem::getId).doesNotContain(catalogId);
        assertThat(catalogRepository.findById(catalogId)).isEmpty();
        assertThat(catalogRepository.existsById(catalogId)).isFalse();
        // …a further write on it is a 404 even for its author…
        putForBody("/api/train/exercises/" + catalogId, request("zombie"), anna.headers(), HttpStatus.NOT_FOUND, String.class);
        // …the physical row (and its slug) is still there…
        assertThat(catalogRepository.countAllBySlugIncludingDeleted(annas.getSlug())).isEqualTo(1);
        // …and Béla's plan still points at it — no SET NULL, no orphaned history.
        assertThat(exerciseRepository.findById(linked.getId()).orElseThrow().getCatalogId()).isEqualTo(catalogId);
    }

    @Test
    void testCreate_shouldNotReuseSlug_whenSameNameRecreatedAfterDelete() {
        RegisteredUser anna = registerUser("Anna");
        ExerciseCatalogItem first = postForBody("/api/train/exercises", request("Phoenix Move"),
            anna.headers(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        deleteAndExpect("/api/train/exercises/" + first.getId(), anna.headers(), HttpStatus.NO_CONTENT);
        ExerciseCatalogItem second = postForBody("/api/train/exercises", request("Phoenix Move"),
            anna.headers(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        assertThat(first.getSlug()).isEqualTo("phoenix-move");
        assertThat(second.getSlug()).isEqualTo("phoenix-move-2"); // the soft-deleted row keeps its slug
    }
}
```

- [ ] **Step 2: Run it**

Run: `cd backend && ./mvnw clean test -Dtest='ExerciseCatalogSoftDeleteIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS on first run (behaviour already exists; the test pins it). If `createWorkoutSession`/`createExercise` signatures differ from the ones above, mirror the exact overloads used in `CatalogMediaResolutionIT.java:84-88` — do not add new populator overloads for this.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogSoftDeleteIT.java
git commit -m "test(train): pin catalog soft-delete visibility + cross-user catalog_id survival (mezo-qw37.5)"
```

---

### Task 5: Frontend data layer — types, `toLibraryItem`, MSW fixtures

**Files:**
- Modify: `frontend/src/data/types.ts:1279-1288` (`ExerciseLibraryItem`)
- Modify: `frontend/src/data/train/trainHooks.ts:232-240` (`toLibraryItem`)
- Modify: `frontend/src/test/msw/handlers.ts:878-907` (catalog fixture + write handlers)
- Modify: `frontend/src/data/train/trainHooks.test.tsx:435-456` (typed fixtures)

**Interfaces:**
- Produces: `ExerciseLibraryItem.authoredByMe?: boolean`, `authorName?: string | null`, `mediaEditable?: boolean` (all optional — the Phase-1 static seed in `data/train/train.ts` leaves them unset, which reads as "not mine / no author / no media control", exactly right for mock mode).
- MSW catalog fixture semantics (real-mode tests): the viewer is the OWNER. `Chest Supported Row` = my own row; `Lateral Raise` = **shared, authored by "Anna"** (`authoredByMe: false, authorName: 'Anna', editable: false, mediaEditable: false` — a USER's view of a foreign row, so the page tests can prove the hidden controls without a second fixture); every other row = master seen by the OWNER (`editable: false, mediaEditable: true, authoredByMe: false`).

- [ ] **Step 1: Write the failing hook tests**

In `trainHooks.test.tsx`, replace the two `toLibraryItem` tests (lines 435-456):

```ts
test('toLibraryItem maps videoUrl, the permission flags and the authorship from the catalog row', () => {
  const item = toLibraryItem({
    id: 'f1e3a0e2-0000-4000-8000-000000000099', slug: 'db-row', name: 'DB Row',
    muscle: 'back-mid', type: 'compound', stim: 0.8, fatigue: 0.5,
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ', editable: true, mediaEditable: true,
    authoredByMe: true, authorName: 'Daniel',
  } satisfies ExerciseCatalogItem)
  expect(item).toMatchObject({
    id: 'f1e3a0e2-0000-4000-8000-000000000099',
    catalogId: 'f1e3a0e2-0000-4000-8000-000000000099',
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    editable: true,
    mediaEditable: true,
    authoredByMe: true,
    authorName: 'Daniel',
  })
})

test('toLibraryItem null-coalesces an absent videoUrl and authorName to null', () => {
  const item = toLibraryItem({
    id: 'f1e3a0e2-0000-4000-8000-0000000000aa', slug: 'lat-raise', name: 'Lateral Raise',
    muscle: 'shoulder', type: 'isolation', stim: 0.7, fatigue: 0.2,
    editable: false, mediaEditable: false, authoredByMe: false,
  } satisfies ExerciseCatalogItem)
  expect(item.videoUrl).toBeNull()
  expect(item.authorName).toBeNull()
  expect(item.editable).toBe(false)
  expect(item.mediaEditable).toBe(false)
  expect(item.authoredByMe).toBe(false)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/train/trainHooks.test.tsx`
Expected: the two tests fail on `mediaEditable`/`authoredByMe`/`authorName` being `undefined` (tsc-level: `toLibraryItem`'s return type has no such keys — `pnpm build` would also fail until Step 3).

- [ ] **Step 3: Extend the type and the mapper**

`frontend/src/data/types.ts` — replace the `ExerciseLibraryItem` interface:

```ts
export interface ExerciseLibraryItem {
  id: string; name: string; muscle: string; type: ExerciseKind; stim: number; fatigue: number
  catalogId?: string  // set when the item comes from the backend catalog (real mode)
  videoUrl?: string | null  // YouTube demo URL; null/absent when no demo is set
  // Demo stills, start + end position (mezo-8xdl). imageStartUrl is the presence flag:
  // absent means the exercise has no image at all (37 of the 161 master rows, ADR 0020).
  imageStartUrl?: string | null
  imageEndUrl?: string | null
  // Multi-user catalog (mezo-qw37.5) — all four are SERVER-derived for the current viewer;
  // the FE never reasons about roles. Absent on the Phase-1 static seed (mock mode).
  editable?: boolean       // the viewer may edit/delete this row (author or OWNER; never a master row)
  mediaEditable?: boolean  // the viewer may set/clear its video/stills (OWNER only on master rows)
  authoredByMe?: boolean   // created_by == the viewer → the `Saját` stamp
  authorName?: string | null  // the author's name on user-authored rows → the `Közös · {név}` stamp
}
```

`frontend/src/data/train/trainHooks.ts` — replace `toLibraryItem`:

```ts
// Catalog row -> the Phase-1 library shape; `id` doubles as the catalog uuid and
// `catalogId` flags "came from the backend catalog" (mock statics never set it).
// `videoUrl` + the four multi-user flags (editable / mediaEditable / authoredByMe /
// authorName, mezo-qw37.5) carry the authoring metadata the page renders.
export function toLibraryItem(r: ExerciseCatalogItem): ExerciseLibraryItem {
  return {
    id: r.id, catalogId: r.id, name: r.name, muscle: r.muscle, type: r.type, stim: r.stim, fatigue: r.fatigue,
    videoUrl: r.videoUrl ?? null,
    editable: r.editable, mediaEditable: r.mediaEditable,
    authoredByMe: r.authoredByMe, authorName: r.authorName ?? null,
    imageStartUrl: r.imageStartUrl ?? null, imageEndUrl: r.imageEndUrl ?? null,
  }
}
```

- [ ] **Step 4: Update the MSW catalog fixture and write handlers**

In `frontend/src/test/msw/handlers.ts`, replace the `GET /api/train/exercises` handler and the three write handlers (lines 878-907):

```ts
  // Exercise catalog fixture — small slice across muscles incl. one plyo item, seen by the OWNER
  // (multi-user S5, mezo-qw37.5): Chest Supported Row is the viewer's own row; Lateral Raise is
  // SHARED — authored by "Anna", not editable and not media-editable, i.e. a USER's view of a
  // foreign row (drives the `Közös` badge + hidden-roundel tests); the rest are master rows the
  // OWNER may re-mediate but never edit. Hip Thrust must stay: the real-mode MesoExercises test
  // picks it from the sheet.
  http.get(`${API_BASE}/api/train/exercises`, () =>
    HttpResponse.json([
      { id: 'f1e3a0e2-0000-4000-8000-000000000070', slug: 'chest-supported-row', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound', stim: 0.92, fatigue: 0.55, editable: true, mediaEditable: true, authoredByMe: true, authorName: 'Daniel', videoUrl: 'https://youtu.be/GZTvxN5fPBc' },
      // Hip Thrust also carries the demo stills (mezo-8xdl) — 124 of the 161 master rows do.
      { id: 'f1e3a0e2-0000-4000-8000-000000000071', slug: 'hip-thrust', name: 'Hip Thrust', muscle: 'glute', type: 'compound', stim: 0.86, fatigue: 0.55, editable: false, mediaEditable: true, authoredByMe: false, authorName: null, videoUrl: 'https://youtu.be/xDmFkJxPzeM', imageStartUrl: '/exercises/hip-thrust-a.jpg', imageEndUrl: '/exercises/hip-thrust-b.jpg' },
      { id: 'f1e3a0e2-0000-4000-8000-000000000072', slug: 'box-jump', name: 'Box Jump', muscle: 'quad', type: 'plyo', stim: 0.6, fatigue: 0.35, editable: false, mediaEditable: true, authoredByMe: false, authorName: null },
      { id: 'f1e3a0e2-0000-4000-8000-000000000073', slug: 'lateral-raise', name: 'Lateral Raise', muscle: 'shoulder-side', type: 'isolation', stim: 0.72, fatigue: 0.2, editable: false, mediaEditable: false, authoredByMe: false, authorName: 'Anna' },
      { id: 'f1e3a0e2-0000-4000-8000-000000000074', slug: 'standing-calf-raise', name: 'Standing Calf Raise', muscle: 'calf', type: 'isolation', stim: 0.72, fatigue: 0.2, editable: false, mediaEditable: true, authoredByMe: false, authorName: null },
      { id: 'f1e3a0e2-0000-4000-8000-000000000075', slug: 'cable-crunch', name: 'Cable Crunch', muscle: 'core', type: 'isolation', stim: 0.72, fatigue: 0.2, editable: false, mediaEditable: true, authoredByMe: false, authorName: null },
    ]),
  ),
  // Writable catalog mutations — author (POST), edit (PUT), delete, set video. A row the
  // viewer just wrote is theirs: editable + media-editable + authoredByMe.
  http.post(`${API_BASE}/api/train/exercises`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { id: 'f1e3a0e2-0000-4000-8000-0000000000ff', slug: 'authored', editable: true, mediaEditable: true, authoredByMe: true, authorName: 'Daniel', ...body },
      { status: 201 },
    )
  }),
  http.put(`${API_BASE}/api/train/exercises/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: params.id, slug: 'authored', editable: true, mediaEditable: true, authoredByMe: true, authorName: 'Daniel', ...body })
  }),
  http.delete(`${API_BASE}/api/train/exercises/:id`, () => new HttpResponse(null, { status: 204 })),
  http.put(`${API_BASE}/api/train/exercises/:id/video`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: params.id, slug: 'authored', editable: true, mediaEditable: true, authoredByMe: true, authorName: 'Daniel', ...body })
  }),
```

- [ ] **Step 5: Run the hook tests in both modes + typecheck**

Run:
```bash
cd frontend && VITE_USE_MOCK=false pnpm test src/data/train/trainHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/train/trainHooks.test.tsx && pnpm build
```
Expected: all PASS; build green. (The existing ExercisesPage tests still pass at this point: the `saját` count is still 1 — Chest Supported Row is `editable` AND `authoredByMe` — and Box Jump still exposes the video roundel because the page has not yet switched to `mediaEditable`.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/data/train/trainHooks.ts frontend/src/data/train/trainHooks.test.tsx frontend/src/test/msw/handlers.ts
git commit -m "feat(train): FE catalog items carry editable/mediaEditable/authoredByMe/authorName (mezo-qw37.5)"
```

---

### Task 6: Frontend — `Közös · {név}` badge, control gating on `ExercisesPage`

**Files:**
- Modify: `frontend/src/features/train/pages/ExercisesPage.tsx` (`RecordRow` :84-174, `GhostRow` :176-232, stat strip :309, row wiring :369-392)
- Modify: `frontend/src/features/train/pages/ExercisesPage.test.tsx`
- Modify: `frontend/src/features/train/sheets/VideoUrlSheet.tsx:1-10` (header comment only)

**Interfaces:**
- Consumes: `ExerciseLibraryItem.editable / mediaEditable / authoredByMe / authorName` from Task 5.
- UI copy: stamp `Saját` (unchanged, now on `authoredByMe`), new stamp `Közös · {authorName}`; roundel labels unchanged (`Gyakorlat szerkesztése`, `Videó hozzáadása`, `Videó szerkesztése`).

- [ ] **Step 1: Write the failing page tests**

Append to `ExercisesPage.test.tsx` (real-mode block, before the `describe('ExercisesPage (real mode, pending)')`):

```ts
// Multi-user catalog (mezo-qw37.5): a row another user authored is SHARED — it renders with a
// `Közös · {név}` stamp and, because the viewer may neither edit nor re-mediate it, with NO
// roundel at all. The MSW fixture's Lateral Raise is Anna's (catalog-only, so a ghost row).
test('a shared row from another user carries the Közös badge and no edit/video roundel', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'lateral')
  const name = screen.getByText('Lateral Raise')
  const card = name.closest('.excat') as HTMLElement
  expect(within(card).getByText('Közös · Anna')).toBeInTheDocument()
  expect(within(card).queryByText('Saját')).not.toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: 'Gyakorlat szerkesztése' })).not.toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: /^Videó/ })).not.toBeInTheDocument()
})

test('a master row shows neither Saját nor Közös, and the video roundel follows mediaEditable', async () => {
  renderView()
  const boxRow = await screen.findByRole('button', { name: /Box Jump/ })
  const card = boxRow.closest('.excat') as HTMLElement
  expect(within(card).queryByText('Saját')).not.toBeInTheDocument()
  expect(within(card).queryByText(/Közös/)).not.toBeInTheDocument()
  // the fixture viewer is the OWNER → master media stays editable for them
  expect(within(card).getByRole('button', { name: 'Videó hozzáadása' })).toBeInTheDocument()
})

test('a master row hides the video roundel when the viewer may not re-mediate it', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercises`, () =>
      HttpResponse.json([
        { id: 'f1e3a0e2-0000-4000-8000-000000000072', slug: 'box-jump', name: 'Box Jump', muscle: 'quad', type: 'plyo', stim: 0.6, fatigue: 0.35, editable: false, mediaEditable: false, authoredByMe: false, authorName: null },
      ]),
    ),
  )
  renderView()
  const boxRow = await screen.findByRole('button', { name: /Box Jump/ })
  const card = boxRow.closest('.excat') as HTMLElement
  expect(within(card).queryByRole('button', { name: /^Videó/ })).not.toBeInTheDocument()
})

test('the saját stat counts authored rows, not editable ones', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercises`, () =>
      HttpResponse.json([
        // the OWNER may edit Anna's row (editable) but did not author it — must not count as saját
        { id: 'f1e3a0e2-0000-4000-8000-000000000073', slug: 'lateral-raise', name: 'Lateral Raise', muscle: 'shoulder-side', type: 'isolation', stim: 0.72, fatigue: 0.2, editable: true, mediaEditable: true, authoredByMe: false, authorName: 'Anna' },
        { id: 'f1e3a0e2-0000-4000-8000-000000000070', slug: 'chest-supported-row', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound', stim: 0.92, fatigue: 0.55, editable: true, mediaEditable: true, authoredByMe: true, authorName: 'Daniel' },
      ]),
    ),
  )
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  const strip = screen.getByLabelText('Katalógus áttekintés')
  expect(within(strip).getByText('saját').previousElementSibling).toHaveTextContent('1')
})
```

Append to the existing `describe('ExercisesPage (mock mode)')` block:

```ts
  // The Phase-1 static seed carries no authorship → no Közös stamp anywhere in mock mode.
  it('shows no Közös badge on static catalog rows', async () => {
    renderView()
    await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'row')
    expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
    expect(screen.queryByText(/Közös/)).toBeNull()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/features/train/pages/ExercisesPage.test.tsx`
Expected: `a shared row … Közös badge` fails (`Közös · Anna` not found; a `Videó hozzáadása` roundel IS rendered on Lateral Raise because gating is still on `catalogId` only); `hides the video roundel when … mediaEditable` fails; the `saját` count test fails with `2`.

- [ ] **Step 3: Implement — stamps and gating**

In `ExercisesPage.tsx`:

(a) Add a tiny helper next to `Tag` (after line 57):

```tsx
// Authorship stamps (mezo-qw37.5): `Saját` on rows the viewer authored, `Közös · {név}` on rows
// another user shared into the catalog. Master (built-in) rows carry neither. Both read
// server-derived flags — the page never reasons about roles.
function AuthorTags({ lib }: { lib?: ExerciseLibraryItem }) {
  if (!lib) return null
  if (lib.authoredByMe) return <Tag bg="var(--primary-bg)" color="var(--primary-deep)">Saját</Tag>
  // The lav family (`--wash-lav` / `--lav-deep`, the same pair `muscleColors.ts:20` uses for Váll)
  // is neutral among the muscle washes here — the stamp must not read as a muscle tag.
  if (lib.authorName) return <Tag bg="var(--wash-lav)" color="var(--lav-deep)">Közös · {lib.authorName}</Tag>
  return null
}
```

(b) In `RecordRow`, replace line 131 `{lib?.editable && <Tag …>Saját</Tag>}` with `<AuthorTags lib={lib} />`.

(c) In `GhostRow`, after the `Még nincs rekord` tag (line 208) add `<AuthorTags lib={item} />`.

(d) Stat strip (line 309): `exerciseLibrary.filter((e) => e.editable)` → `exerciseLibrary.filter((e) => e.authoredByMe)`.

(e) Row wiring — the `onVideo` gates (lines 379 and 389) add `mediaEditable`:

```tsx
                  onVideo={lib?.catalogId && lib.mediaEditable ? () => setVideoFor({ id: lib.catalogId!, name: lib.name, videoUrl: lib.videoUrl ?? null }) : undefined}
```

```tsx
                onVideo={g.catalogId && g.mediaEditable ? () => setVideoFor({ id: g.catalogId ?? g.id, name: g.name, videoUrl: g.videoUrl ?? null }) : undefined}
```

(`onEdit` stays on `editable` — its meaning is now "author or OWNER", decided server-side.)

(f) Update the file header comment (lines 15-17): replace "▶ opens VideoUrlSheet." with "▶ opens VideoUrlSheet (only when the server says `mediaEditable` — master rows for the OWNER, own rows for anyone; mezo-qw37.5). `Saját`/`Közös · {név}` stamps come from `authoredByMe`/`authorName`."

(g) `VideoUrlSheet.tsx` header (lines 1-10): replace "on ANY catalog exercise, master (seed) or user-authored" with "on a catalog exercise the viewer may re-mediate (`mediaEditable`: the author or the OWNER on a user row, the OWNER only on a master row — multi-user S5, `mezo-qw37.5`)", and "the ownership-free endpoint — so built-in rows get demo videos too, unlike the owner-only full edit" with "gated server-side by the same rule; a 403 `EXERCISE_CATALOG_NOT_EDITABLE` surfaces as the generic „Mentés sikertelen" toast".

- [ ] **Step 4: Run the page tests in both modes + build**

Run:
```bash
cd frontend && VITE_USE_MOCK=false pnpm test src/features/train && VITE_USE_MOCK=true pnpm test src/features/train && pnpm build
```
Expected: all PASS. Two pre-existing tests must still pass unchanged: `compact hero shows … saját … 1` (Chest Supported Row is `authoredByMe`) and `a seed (non-editable) record row exposes a video-add affordance` (Box Jump is `mediaEditable: true` in the fixture — the OWNER's view).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/pages/ExercisesPage.tsx frontend/src/features/train/pages/ExercisesPage.test.tsx frontend/src/features/train/sheets/VideoUrlSheet.tsx
git commit -m "feat(train): Közös badge on shared catalog rows, edit/video controls follow server permissions (mezo-qw37.5)"
```

---

### Task 7: Docs, CODEMAP, full gates, push, PR

**Files:**
- Modify: `docs/features/train.md` (§2 `Gyakorlatok` :186-188, §4 `Exercise catalog + records` :358-369, §8 :505, §10 :641 and :650)
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: `train.md` §2 — the `Gyakorlatok` paragraph**

In the long paragraph starting `Default state "Top gyakorlatok · rekordjaid"` (line 188), replace the sentence block from `Your own rows are **editable + deletable**:` up to and including `(\`mezo-bnsk\`).` with:

```markdown
**Multi-user catalog (S5, `mezo-qw37.5`):** the catalog is one shared pool — every user's rows show for everyone — and each row arrives with four **server-derived** flags (`editable`, `mediaEditable`, `authoredByMe`, `authorName`; the page never reasons about roles). Tag row: **`Saját`** on rows you authored, **`Közös · {név}`** on rows another user shared (master/built-in rows carry neither); the hero's `saját` cell counts `authoredByMe`. The card's **`⋯` roundel** (`editable` = you are the author, or you are the OWNER) opens `CatalogExerciseSheet` in edit mode (`edit` prop → `updateCatalogExercise`), and **delete lives inside that sheet** as a two-tap-confirm `Gyakorlat törlése` action (`deleteCatalogExercise`) — a soft delete, so other users' plans that link the row keep resolving. Built-in (master) rows are read-only for the full edit for everyone incl. the OWNER (server 409, §4). The round **`▶`** video roundel follows `mediaEditable` (your own rows; master rows only for the OWNER) and opens **`VideoUrlSheet`** (`sheets/VideoUrlSheet.tsx`), the one-field URL editor calling `setExerciseVideo` (`PUT /…/{id}/video`, §4) with an **Eltávolítás** action; a row you may not touch shows no roundel at all, and a forbidden write that slips through (stale list) is a 403 surfaced as the generic „Mentés sikertelen" toast.
```

- [ ] **Step 2: `train.md` §4 — endpoints, service, DTOs**

Replace the `**Endpoints:**` bullet (line 361) with:

```markdown
- **Endpoints:** `GET /api/train/exercises` (the shared catalog — master + every user's rows, `staleTime 1h` on FE — each item carries the viewer's `editable` + `mediaEditable` and the authorship `authoredByMe` + `authorName`), **`POST /api/train/exercises`** (create a user exercise, 201; slug = `uniqueSlug` pre-probe + a 3-attempt retry on `uq_exercise_catalog_slug`, `mezo-2fc1`), **`PUT /api/train/exercises/{id}`** / **`DELETE /api/train/exercises/{id}`** (edit / soft-delete a USER exercise as its author or the OWNER — a master row → **409 `CATALOG_MASTER_READONLY`** for everyone, another user's row as a plain USER → **403 `EXERCISE_CATALOG_NOT_EDITABLE`**, unknown or soft-deleted → 404), **`PUT /api/train/exercises/{id}/video`** and **`PUT /api/train/exercises/{id}/images`** (attach/clear the demo media — the author or the OWNER on a user row, the **OWNER only on a master row**, else 403; clearing = null), `GET /api/train/exercise-records` (computed on the fly — no materialized table).
```

Replace the `**Service**` bullet (line 362) with:

```markdown
- **Service** (`ExerciseCatalogService`, multi-user since S5 `mezo-qw37.5`): takes the S1 `AppUserEntity` (via `CurrentUser.get()` in `TrainController`) so it can ask `isOwner()`. One matrix in two private guards — `contentEditableOrThrow` (PUT/DELETE: master → 409; user row → author or OWNER, else 403) and `mediaEditableOrThrow` (video/images: master → OWNER only, else 403; user row → author or OWNER, else 403). **Why master content stays 409 even for the OWNER:** `ExerciseCatalogLoader` re-upserts name/muscle/type/stim/fatigue by slug at every startup (an OWNER edit would be reverted at the next deploy) and a soft-deleted master row would make the loader's re-INSERT trip the slug unique index; master **media** is loader-safe (never clobbered), hence OWNER-editable. `list` resolves `authorName` with ONE batched `AppUserRepository.findAllById` over the distinct `created_by` values. `create` is deliberately **not** `@Transactional`: it loops `saveAndFlush` up to `MAX_SLUG_ATTEMPTS = 3`, catching `DataIntegrityViolationException` and re-probing the next free suffix (a unique violation would mark an enclosing transaction rollback-only). The other writes keep method-level `@Transactional`. `delete` is the Hibernate `@SQLDelete` soft delete — `ExerciseCatalogSoftDeleteIT` pins that the row leaves every list and by-id read, keeps its slug, and leaves other users' `exercise.catalog_id` links intact (the `ON DELETE SET NULL` FK never fires).
```

In the `**DTOs:**` bullet (line 368) replace `plus **\`editable\` + \`videoUrl\` + \`imageStartUrl\`/\`imageEndUrl\`**` with `plus **\`editable\` + \`mediaEditable\` + \`authoredByMe\` + \`authorName\` (viewer-relative, S5) + \`videoUrl\` + \`imageStartUrl\`/\`imageEndUrl\`**`.

- [ ] **Step 3: `train.md` §8 and §10**

§8 backend list (line 505): after `ExerciseCatalogContractIT` add `, \`ExerciseCatalogPermissionIT\` (the S5 USER/OWNER matrix + per-viewer flags, via \`registerUser\`), \`ExerciseCatalogSlugRaceIT\` (two threads, one name), \`ExerciseCatalogSoftDeleteIT\``.

§10 line 641 (`VideoUrlSheet.tsx`): replace `for ANY catalog row incl. built-in ones, opened from the per-row \`▶ Videó\` action → \`setExerciseVideo\` (ownership-free \`/video\` endpoint, \`mezo-bnsk\`)` with `for rows the viewer may re-mediate (\`mediaEditable\` — own rows; master rows for the OWNER only, \`mezo-qw37.5\`), opened from the per-row \`▶ Videó\` action → \`setExerciseVideo\` (\`/video\` endpoint, \`mezo-bnsk\`)`.

§10 line 650 (`service/{…}.java`): replace `(owner-scoped except the two media writers; master row → 409 \`CATALOG_MASTER_READONLY\`; \`uniqueSlug\` slug-gen)` with `(author-or-OWNER gated, master media OWNER-only, 403 \`EXERCISE_CATALOG_NOT_EDITABLE\` / 409 \`CATALOG_MASTER_READONLY\`; \`uniqueSlug\` pre-probe + retry loop — S5 \`mezo-qw37.5\`)`.

Update the frontmatter `updated:` to `2026-09-02`.

- [ ] **Step 4: Regenerate CODEMAP, lint docs and Liquibase**

Run:
```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs
```
Expected: CODEMAP lists the three new ITs under the train block; lint passes (no changeset was added, so lint-liquibase is a no-op sanity run).

- [ ] **Step 5: Full local gates**

Run:
```bash
cd backend && ./mvnw clean test -Dtest='ExerciseCatalog*,CatalogWrite*,CatalogMedia*,ExerciseRecord*,TrainContractIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green in both modes. (The full backend suite runs in CI on the self-PR.)

- [ ] **Step 6: Commit, push, open the self-PR**

```bash
git add docs/features/train.md docs/CODEMAP.md
git commit -m "docs(train): multi-user exercise catalog — permission matrix, Közös badge, slug retry, soft-delete proof (mezo-qw37.5)"
git push -u origin feat/multi-user-s5-exercise-catalog
gh pr create --title "feat(train): multi-user exercise catalog — S5 (mezo-qw37.5)" --body "$(cat <<'EOF'
S5 of the multi-user accounts epic (mezo-qw37): shared exercise catalog with author/OWNER permissions.

- `ExerciseCatalogItem` +`authoredByMe`, `authorName`, `mediaEditable` (viewer-relative, server-derived)
- Permission matrix: master content 409 for everyone (loader-owned), master media OWNER-only, user rows author-or-OWNER, else 403 `EXERCISE_CATALOG_NOT_EDITABLE`
- Slug race: check-then-insert-then-retry (3 attempts) on `uq_exercise_catalog_slug` — closes mezo-2fc1
- Soft delete pinned by IT (visibility + cross-user `catalog_id` survival); no changeset needed
- FE: `Közös · {név}` badge, `Saját` on `authoredByMe`, roundels gated on `editable`/`mediaEditable`
- Docs: `train.md` §2/§4/§8/§10, CODEMAP regenerated

Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §9 · Plan: docs/superpowers/plans/2026-09-02-s5-exercise-catalog.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then wait for CI green, `git checkout main && git pull --rebase && git merge --no-ff feat/multi-user-s5-exercise-catalog && git push && git branch -d feat/multi-user-s5-exercise-catalog` (the orchestrator's protocol; the PR auto-closes).

---

## Self-review

**Spec §9 coverage:** `list()` stays "everyone sees everything" + `authoredByMe`/`authorName` → Tasks 1, 2 (`testList_shouldShowEveryUsersRows…`, `testList_shouldCarryViewerPermissions…`); media/edit/delete matrix with `403 EXERCISE_CATALOG_NOT_EDITABLE` → Task 2 (matrix made exact in "Decisions"; master content stays 409 with the loader rationale written down); soft delete → already present, pinned by Task 4 (no changeset, stated); slug race retry on `DataIntegrityViolationException` max 3 → Task 3; `mezo-2fc1` closure → Task 3 commit + the header note (the resolve de-dup half already shipped); FE `közös` badge on `!authoredByMe && authorName != null` and hidden controls → Task 6; the four required tests (USER on master media 403, own row 200, other user's row 403, OWNER everything 200; concurrent slug; soft-delete visibility; FE both modes) → Tasks 2, 3, 4, 5–6; docs + CODEMAP → Task 7. The orchestrator's `editable` question: kept and re-defined, plus `mediaEditable` — rationale in "Decisions". "Image upload" in the spec is the existing `PUT …/images` (URL pair) — there is no multipart upload endpoint on the catalog; nothing to add.

**Placeholder scan:** every step carries the code or the exact edit; the only conditional instruction is the MapStruct unmapped-target ordering note in Task 2 Step 3, which names the concrete action (do Step 4 first). CSS tokens verified against `muscleColors.ts:20` (`--wash-lav`, `--lav-deep`); `@Slf4j` is already used by `WorkoutService`/`ClosingBlockService` in the same package.

**Type consistency:** `ExerciseCatalogService.list/create/update/delete/setVideo/setImages` all take `AppUserEntity` first (Task 2) and `TrainController` calls them with `currentUser.get()` (Task 2 Step 6); `MAX_SLUG_ATTEMPTS`, `slugBase`, `uniqueSlug(String base)` match between Task 3's `create` and helpers; DTO getters `getEditable/getMediaEditable/getAuthoredByMe/getAuthorName` are used identically in Tasks 2–4; FE field names `editable/mediaEditable/authoredByMe/authorName` match across `types.ts`, `toLibraryItem`, the MSW fixture and the page tests; the test-asserted copy `Közös · Anna`, `Saját`, `Gyakorlat szerkesztése`, `Videó hozzáadása` matches the page code; `RegisteredUser.id()/headers()` match S1's record.

**Risks for the orchestrator:**
- **Loader vs. soft-deleted/edited master rows** is a latent startup hazard independent of this slice (a soft-deleted *master* row would crash the loader's re-INSERT). This plan keeps master content immutable precisely to avoid it; if a later slice wants OWNER-curated master content, the loader must learn to skip owner-touched rows first — file a bd issue.
- `create()` losing `@Transactional` means nothing else may call it inside an outer transaction expecting atomicity (today only `TrainController` does). `ExerciseCatalogLoaderIT` is `@Transactional` but uses the loader, not the service — unaffected.
- The race IT is non-deterministic by nature; it asserts the *outcome* (`race-move` + `race-move-2`, both 201) which holds whether or not the collision actually happens, so it cannot flake green-to-red — but it cannot prove the retry ran either; the log line is the evidence.
- `CatalogWriteContractIT.testUpdateForeignUserExercise…` flips from 404 to 200 (OWNER curates): a deliberate contract change, documented in the matrix.
