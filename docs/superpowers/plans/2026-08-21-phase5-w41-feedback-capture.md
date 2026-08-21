# Phase 5 W4.1 — Feedback capture on all AI surfaces (`mezo-b3pp.15`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a 👍/👎 verdict (with an optional 👎 reason) on every AI-generated artifact — chat answers, companion-feed messages, the weekly suggestion, the memoir, predictions — as one updatable row per artifact, so W4.2 has real training data instead of months of unrecorded signal.

**Architecture:** One new backend table `message_feedback` behind a small `/api/companion/feedback` surface (PUT upsert / DELETE retract / GET batch-read), riding the existing `mezo.feature.companion.enabled` switch. One shared **controlled** `FeedbackChips` FE component fed by a page-level `useFeedback(kind, ids)` dual-mode hook, mounted on the five surfaces. Three proactive responses (`FeedMessageResponse`, `WeeklySuggestionResponse`, `MemoirResponse`) gain the `id` they never exposed — without it the FE has no artifact id to vote on.

**Tech Stack:** Java 21 / Spring Boot / JPA + Liquibase / Postgres; contract-first OpenAPI (openapi-merge-cli → openapi-generator); React 19 + TanStack Query + Vite; Vitest (dual-mode) + Playwright visual goldens.

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md` §4 + §11 and `CLAUDE.md`/`AGENTS.md`:

- **Contract-first** (`api/feature/...` fragment before code); backend implements the generated `<Tag>Api`; FE types regenerate; **never hand-written boundary DTOs**.
- New tables: UUID PK (`gen_random_uuid()`), `created_by uuid` (`on delete cascade`), `is_deleted` soft delete + `@SQLRestriction`, `created_at`. Explicit constraint names (`pk_/fk_/uq_/ck_/idx_`). Migration files carry the driving slice's bd id.
- **Integration-first tests**; new domain tables → `ResetDatabase` truncate list + populator (`FeedbackPopulator`).
- **LLM/embed tagging:** this slice adds **no** LLM or embed call site (`companion_feedback` is pure code per §11) — do not introduce one.
- **Switch:** feedback rides `mezo.feature.companion.enabled` (`FeaturesConfiguration.COMPANION_SWITCH`). **No own switch** — it is a companion organ.
- Feature docs in the **same change**; `node scripts/lint-docs.mjs` after every docs touch — new staleness is forbidden.
- Frontend: `docs/references/frontend_conventions.md` binds; data hooks via the `@/data/hooks` barrel only; dual-mode (`useDualQuery`) with honest mock seeds; **no** `const { data = SEED } = useQuery(...)` (the `dualMode.guard.test.ts` seed-leak guard fails the build).
- Conventional commit subjects carrying the bd id: `feat(companion): … (mezo-b3pp.15)`.

## Design decisions locked here (do not re-litigate mid-task)

1. **Artifact kinds** (spec §4.4, verbatim): `chat_message | feed_message | weekly_suggestion | memoir | prediction`. Experiments/challenges are deliberately NOT kinds — their accept/dismiss endpoints already are the signal.
2. **Cross-table existence is NOT validated** (spec §8.1): the ids span five tables, and a dangling id is harmless single-user.
3. **Retraction = soft delete; re-vote = resurrect.** `uq_message_feedback_artifact` spans *all* rows (spec DDL has no partial index), so a soft-deleted row would block re-voting. The write path is therefore a **native `insert … on conflict on constraint uq_message_feedback_artifact do update`** that also flips `is_deleted` back to false. Retraction goes through JPA `delete` (→ `@SQLDelete` soft delete).
4. **`id` added to three proactive responses** — `FeedMessageResponse`, `WeeklySuggestionResponse`, `MemoirResponse`. They are MapStruct-mapped from entities that already have `id`, so the backend change is contract-only.
5. **`FeedbackChips` is a controlled component** (`value` + `onVote`), fed by a page-level `useFeedback(kind, ids)`. Rationale: a hook *inside* each chip would issue one HTTP request per card (20+ on ChatPage). The hook owns the toggle semantics (same verdict ⇒ retract).
6. **No chips on the Today demo-briefing card or on needs-nudges** — they are not persisted artifacts and carry no id. Mounting chips there would recreate exactly the false affordance `mezo-kr9v` complains about. `useCompanionFeed`'s mock mode stays `[]` (Phase-1 byte parity, deliberate), so feed chips are real-mode-only; the sheet's chip rendering is unit-tested directly.
7. **Mock mode** keeps verdicts in the TanStack query cache (the `journalHooks` mock-mutation idiom), seeded **empty** — nothing has been voted on yet, which is the honest state.

---

## File Structure

**Contract**
- Create `api/feature/companion-feedback/companion-feedback.yml` — the whole `/api/companion/feedback` surface, tag `CompanionFeedback`.
- Modify `api/generate/merge.yml` — append the fragment.
- Modify `api/feature/proactive/proactive.yml` — `id` on `FeedMessageResponse` / `WeeklySuggestionResponse` / `MemoirResponse`.
- Regenerated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`.

**Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/`)
- `MessageFeedbackEntity.java` — the row.
- `MessageFeedbackRepository.java` — JPA finders + the native upsert.
- `MessageFeedbackService.java` — upsert / retract / batch read; owns the toggle + validation rules.
- `MessageFeedbackMapper.java` — entity → `MessageFeedbackResponse` (MapStruct).
- `CompanionFeedbackController.java` — implements the generated `CompanionFeedbackApi`.
- `backend/src/main/resources/db/changelog/1.0.0/script/202608211200_mezo-b3pp.15_create_message_feedback.sql` + changelog entry.

**Backend tests**
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/FeedbackPopulator.java`
- `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (truncate list)
- `feature/companion/feedback/MessageFeedbackPersistenceIT.java`
- `feature/companion/feedback/CompanionFeedbackApiIT.java`
- `feature/companion/feedback/CompanionFeedbackSwitchOffIT.java`

**Frontend data** (`frontend/src/data/feedback/`)
- `feedbackTypes.ts` · `feedbackApi.ts` · `feedbackHooks.ts` · `feedbackMock.ts` (+ `feedbackHooks.test.tsx`)
- Modify `frontend/src/data/hooks.ts` (barrel), `frontend/src/data/types.ts` (`ChatMessage.id`, `FeedMessage.id`, `Memoir.id`), `frontend/src/data/insights/chatApi.ts`, `frontend/src/data/today/feedApi.ts`, `frontend/src/data/insights/memoirApi.ts`, `frontend/src/data/insights/weeklySuggestionApi.ts`, `frontend/src/data/insights/weeklyHooks.ts`, mock seeds.

**Frontend UI**
- Create `frontend/src/features/insights/components/FeedbackChips.tsx` (+ `FeedbackChips.test.tsx`).
- Modify `features/insights/components/ChatMessage.tsx`, `features/insights/pages/ChatPage.tsx`, `MemoirPage.tsx`, `WeeklyPage.tsx`, `PredictionsPage.tsx`, `features/today/pages/TodayPage.tsx`, `features/today/components/MezoMessagesSheet.tsx`, `features/today/logic/mezoMessages.ts`.

**Docs**
- `docs/features/companion.md` (new W4 section: table, endpoints, semantics), `docs/features/insights.md` (chips on chat/weekly/memoir/predictions), `docs/features/today.md` (feed-message chips), `docs/features/proactive.md` (the three responses now carry `id`).

---

### Task 1: Contract — the feedback surface + the three missing ids

**Files:**
- Create: `api/feature/companion-feedback/companion-feedback.yml`
- Modify: `api/generate/merge.yml`
- Modify: `api/feature/proactive/proactive.yml` (schemas `FeedMessageResponse`, `WeeklySuggestionResponse`, `MemoirResponse`)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `io.mrkuhne.mezo.api.controller.CompanionFeedbackApi` with
  `MessageFeedbackResponse putFeedback(PutFeedbackRequest)`,
  `void deleteFeedback(String artifactKind, UUID artifactId)`,
  `List<MessageFeedbackResponse> listFeedback(String kind, List<UUID> ids)`.
- Produces: DTOs `PutFeedbackRequest{artifactKind,artifactId,verdict,reason}`, `MessageFeedbackResponse{artifactKind,artifactId,verdict,reason,updatedAt}`.
- Produces: FE wire types via `paths['/api/companion/feedback']`.

- [ ] **Step 1: Write the fragment**

Create `api/feature/companion-feedback/companion-feedback.yml`:

```yaml
openapi: 3.0.3
info: { title: mezo companion-feedback fragment, version: 1.0.0 }
paths:
  /api/companion/feedback:
    get:
      tags: [CompanionFeedback]
      operationId: listFeedback
      summary: Batch-read this user's verdicts for one artifact kind (CompanionFeedback)
      description: >-
        Page hydration: the caller passes every artifact id it renders and gets back only the
        ones that carry a verdict. Unknown/never-voted ids are simply absent (never an error) —
        the surface degrades to "no chip selected", never to a failed page.
      parameters:
        - name: kind
          in: query
          required: true
          schema: { type: string, pattern: '^(chat_message|feed_message|weekly_suggestion|memoir|prediction)$' }
        - name: ids
          in: query
          required: true
          style: form
          explode: false
          schema:
            type: array
            minItems: 1
            maxItems: 200
            items: { type: string, format: uuid }
      responses:
        '200':
          description: The verdicts that exist among the requested ids (possibly empty)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/MessageFeedbackResponse' }
        '400':
          description: Validation error (unknown kind, empty/oversized id list)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    put:
      tags: [CompanionFeedback]
      operationId: putFeedback
      summary: Upsert the single verdict for one artifact (CompanionFeedback)
      description: >-
        One updatable verdict per (user, artifactKind, artifactId). Re-tapping the OTHER verdict
        overwrites this row; re-tapping the SAME verdict is a retraction and goes to DELETE.
        Artifact existence is deliberately NOT checked cross-table (the kinds span five tables;
        a dangling id is harmless in a single-user app).
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/PutFeedbackRequest' }
      responses:
        '200':
          description: The stored verdict
          content:
            application/json:
              schema: { $ref: '#/components/schemas/MessageFeedbackResponse' }
        '400':
          description: Validation error (unknown kind/verdict/reason, or reason sent with an up verdict)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/companion/feedback/{artifactKind}/{artifactId}:
    delete:
      tags: [CompanionFeedback]
      operationId: deleteFeedback
      summary: Retract the verdict on one artifact (CompanionFeedback)
      parameters:
        - name: artifactKind
          in: path
          required: true
          schema: { type: string, pattern: '^(chat_message|feed_message|weekly_suggestion|memoir|prediction)$' }
        - name: artifactId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '204':
          description: Retracted (idempotent — retracting a never-voted artifact also returns 204)
        '400':
          description: Validation error (unknown kind)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    PutFeedbackRequest:
      type: object
      required: [artifactKind, artifactId, verdict]
      properties:
        artifactKind: { type: string, pattern: '^(chat_message|feed_message|weekly_suggestion|memoir|prediction)$' }
        artifactId: { type: string, format: uuid }
        verdict: { type: string, pattern: '^(up|down)$' }
        reason:
          type: string
          nullable: true
          pattern: '^(inaccurate|too_much|bad_timing|not_about_me)$'
          description: Only legal with verdict=down (mirrors ck_message_feedback_reason); absent otherwise.
    MessageFeedbackResponse:
      type: object
      required: [artifactKind, artifactId, verdict, updatedAt]
      properties:
        artifactKind: { type: string, description: "'chat_message' | 'feed_message' | 'weekly_suggestion' | 'memoir' | 'prediction'" }
        artifactId: { type: string, format: uuid }
        verdict: { type: string, description: "'up' | 'down'" }
        reason: { type: string, nullable: true, description: "'inaccurate' | 'too_much' | 'bad_timing' | 'not_about_me' — down verdicts only" }
        updatedAt: { type: string, format: date-time }
```

- [ ] **Step 2: Register the fragment**

Append to `api/generate/merge.yml`, after the `journal` line (order = merge order; the base stays first):

```yaml
  - inputFile: ../feature/companion-feedback/companion-feedback.yml
```

- [ ] **Step 3: Add `id` to the three proactive responses**

In `api/feature/proactive/proactive.yml`:

- `FeedMessageResponse`: `required: [id, date, kind, eyebrow, body, refs, generatedAt]`, and under `properties:` add as the first entry:
  ```yaml
        id: { type: string, format: uuid, description: The companion_message row id — the W4.1 feedback artifactId (feed_message). }
  ```
- `WeeklySuggestionResponse`: `required: [id, weekStart, prose, generatedAt]`, add:
  ```yaml
        id: { type: string, format: uuid, description: The weekly_suggestion row id — the W4.1 feedback artifactId (weekly_suggestion). }
  ```
- `MemoirResponse`: `required: [id, weekStart, title, body, anchors, generatedAt]`, add:
  ```yaml
        id: { type: string, format: uuid, description: The memoir row id — the W4.1 feedback artifactId (memoir). }
  ```

- [ ] **Step 4: Regenerate and verify the contract merges**

```bash
cd api/generate && npm run generate:api
```

Expected: `../openapi.yml` rewritten, no merge conflict/duplicate-operationId error. Verify the new operations landed:

```bash
grep -n "putFeedback\|deleteFeedback\|listFeedback" api/openapi.yml
```

- [ ] **Step 5: Regenerate the FE types**

```bash
cd frontend && pnpm generate:api
```

Expected: `src/data/_client/api.gen.ts` now contains `/api/companion/feedback`. Verify:

```bash
grep -n "api/companion/feedback" frontend/src/data/_client/api.gen.ts | head
```

- [ ] **Step 6: Compile the backend so the generated `CompanionFeedbackApi` exists**

```bash
cd backend && ./mvnw -q -DskipTests compile
```

Expected: BUILD SUCCESS. (The generated interface has no implementation yet — that is Task 3; an unimplemented generated API interface does not break compilation.)

- [ ] **Step 7: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): companion feedback contract + ids on feed/weekly/memoir responses (mezo-b3pp.15)"
```

---

### Task 2: `message_feedback` table + entity + repository + test plumbing

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608211200_mezo-b3pp.15_create_message_feedback.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/MessageFeedbackEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/MessageFeedbackRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/FeedbackPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/feedback/MessageFeedbackPersistenceIT.java`

**Interfaces:**
- Produces: `MessageFeedbackEntity` with constants `KIND_CHAT_MESSAGE/KIND_FEED_MESSAGE/KIND_WEEKLY_SUGGESTION/KIND_MEMOIR/KIND_PREDICTION`, `VERDICT_UP/VERDICT_DOWN`, `REASON_INACCURATE/REASON_TOO_MUCH/REASON_BAD_TIMING/REASON_NOT_ABOUT_ME`; getters `getArtifactKind()/getArtifactId()/getVerdict()/getReason()/getUpdatedAt()`.
- Produces: `MessageFeedbackRepository` with
  `Optional<MessageFeedbackEntity> findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(UUID, String, UUID)`,
  `List<MessageFeedbackEntity> findByCreatedByAndArtifactKindAndArtifactIdInAndDeletedFalse(UUID, String, Collection<UUID>)`,
  `void upsertVerdict(UUID createdBy, String artifactKind, UUID artifactId, String verdict, String reason)`.
- Produces: `FeedbackPopulator.createVerdict(UUID owner, String kind, UUID artifactId, String verdict, String reason)`.

- [ ] **Step 1: Write the migration**

`backend/src/main/resources/db/changelog/1.0.0/script/202608211200_mezo-b3pp.15_create_message_feedback.sql`:

```sql
-- Phase 5 W4.1 (bd mezo-b3pp.15, spec §4.4): one updatable verdict per AI artifact.
-- Artifact existence is deliberately NOT enforced by FK — the five kinds span five tables and
-- a dangling id is harmless in a single-user app (spec §8.1).
create table message_feedback (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    artifact_kind varchar(20) not null,
    artifact_id   uuid        not null,
    verdict       varchar(4)  not null,
    reason        varchar(16),
    constraint pk_message_feedback_id primary key (id),
    constraint fk_message_feedback_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_message_feedback_artifact unique (created_by, artifact_kind, artifact_id),
    constraint ck_message_feedback_artifact_kind check (artifact_kind in ('chat_message', 'feed_message', 'weekly_suggestion', 'memoir', 'prediction')),
    constraint ck_message_feedback_verdict check (verdict in ('up', 'down')),
    constraint ck_message_feedback_reason_value check (reason is null or reason in ('inaccurate', 'too_much', 'bad_timing', 'not_about_me')),
    constraint ck_message_feedback_reason check (reason is null or verdict = 'down')
);

create index idx_message_feedback_created_by_kind on message_feedback (created_by, artifact_kind);
```

Note the unique constraint spans **all** rows (soft-deleted included) — that is deliberate and is why the write path resurrects instead of inserting (Task 3).

- [ ] **Step 2: Register the changeset**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202608211200_mezo-b3pp.15_create_message_feedback"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608211200_mezo-b3pp.15_create_message_feedback.sql
```

- [ ] **Step 3: Write the failing persistence IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/feedback/MessageFeedbackPersistenceIT.java` — model it on `feature/journal/JournalEntryPersistenceIT.java` (read that file first for the base class and assertion helpers this repo uses). It must cover:

1. `testSave_shouldPersistVerdict_whenUpWithoutReason` — a saved `up` row round-trips with `updatedAt` non-null.
2. `testSave_shouldPersistReason_whenDownWithReason` — `down` + `too_much` round-trips.
3. `testSave_shouldViolateCheck_whenReasonSentWithUpVerdict` — saving `up` + `inaccurate` throws (assert the thrown exception's root cause message contains `ck_message_feedback_reason`).
4. `testSave_shouldViolateUnique_whenSameArtifactVotedTwice` — two inserts for the same (owner, kind, artifactId) throw on `uq_message_feedback_artifact`.
5. `testUpsertVerdict_shouldFlipVerdictAndClearReason_whenCalledOnExistingRow` — populate `down`+`bad_timing`, call `repository.upsertVerdict(owner, kind, id, "up", null)`, re-read: verdict `up`, reason null.
6. `testUpsertVerdict_shouldResurrect_whenRowWasSoftDeleted` — populate a row, `repository.delete(e)` (soft delete), then `upsertVerdict(...)`; the JPA finder finds it again with the new verdict (this is the retract-then-re-vote path).

- [ ] **Step 4: Run it to confirm it fails**

```bash
cd backend && ./mvnw test -Dtest=MessageFeedbackPersistenceIT
```

Expected: compilation failure (`MessageFeedbackEntity` / `MessageFeedbackRepository` / `FeedbackPopulator` do not exist yet).

- [ ] **Step 5: Write the entity**

`MessageFeedbackEntity.java` — extends `OwnedEntity` (which supplies `createdBy`/`deleted`/`createdAt`), adds `id`, `updatedAt` (`@UpdateTimestamp`, the `PantryItemEntity` idiom), `artifactKind`, `artifactId`, `verdict`, `reason`. Bean-validation annotations mirror the CHECK constraints exactly (`@Pattern`), `@Table(name = "message_feedback", uniqueConstraints = @UniqueConstraint(name = "uq_message_feedback_artifact", columnNames = {"created_by", "artifact_kind", "artifact_id"}))`, plus `@SQLDelete(sql = "update message_feedback set is_deleted = true where id = ?")` and `@SQLRestriction("is_deleted = false")`. Declare the kind/verdict/reason constants listed under **Interfaces** above so tests and the service never repeat string literals.

- [ ] **Step 6: Write the repository**

`MessageFeedbackRepository.java` extends `JpaRepository<MessageFeedbackEntity, UUID>` with the two derived finders from **Interfaces**, plus the native upsert (this is the load-bearing part):

```java
    /** The single write path for a verdict (spec §4.4: ONE updatable verdict per artifact).
     *
     * <p>Native ON CONFLICT rather than find-then-save because {@code uq_message_feedback_artifact}
     * spans soft-deleted rows too: after a retraction the ghost row still owns the slot, and JPA's
     * {@code @SQLRestriction} hides it from every derived finder. The upsert resurrects it
     * ({@code is_deleted = false}) instead of colliding with it. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        insert into message_feedback (created_by, artifact_kind, artifact_id, verdict, reason, is_deleted, created_at, updated_at)
        values (:createdBy, :artifactKind, :artifactId, :verdict, :reason, false, now(), now())
        on conflict on constraint uq_message_feedback_artifact
        do update set verdict = excluded.verdict, reason = excluded.reason,
                      is_deleted = false, updated_at = now()
        """, nativeQuery = true)
    void upsertVerdict(@Param("createdBy") UUID createdBy, @Param("artifactKind") String artifactKind,
                       @Param("artifactId") UUID artifactId, @Param("verdict") String verdict,
                       @Param("reason") String reason);
```

- [ ] **Step 7: Write the populator and extend `ResetDatabase`**

`FeedbackPopulator.java` — `@TestComponent`, constructor-injected `MessageFeedbackRepository`, one `createVerdict(...)` factory persisting via `saveAndFlush` so the DB CHECKs fire (mirror `JournalPopulator`).

In `ResetDatabase.resetExceptMasterData()`, add `message_feedback` to the TRUNCATE list — put it next to `memory_embedding`/`ai_message` in the companion cluster (the growth rule in that class's javadoc requires it in this same change).

- [ ] **Step 8: Run the IT to green**

```bash
cd backend && ./mvnw test -Dtest=MessageFeedbackPersistenceIT
```

Expected: all 6 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback backend/src/test
git commit -m "feat(companion): message_feedback table, entity and upsert repository (mezo-b3pp.15)"
```

---

### Task 3: The `/api/companion/feedback` surface

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/MessageFeedbackService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/MessageFeedbackMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/CompanionFeedbackController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/feedback/CompanionFeedbackApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/feedback/CompanionFeedbackSwitchOffIT.java`

**Interfaces:**
- Consumes: `MessageFeedbackEntity`, `MessageFeedbackRepository` (Task 2); generated `CompanionFeedbackApi`, `PutFeedbackRequest`, `MessageFeedbackResponse` (Task 1).
- Produces: `MessageFeedbackService.put(UUID userId, PutFeedbackRequest)` → `MessageFeedbackResponse`; `MessageFeedbackService.retract(UUID userId, String artifactKind, UUID artifactId)` → `void`; `MessageFeedbackService.list(UUID userId, String kind, List<UUID> ids)` → `List<MessageFeedbackResponse>`.

- [ ] **Step 1: Write the failing API IT**

`CompanionFeedbackApiIT.java` extends `ApiIntegrationTest` (read `feature/journal/JournalApiIT.java` first — it is the closest precedent: not `@Transactional`, `ownerAuthHeaders()`, `postForBody`/`putForBody` helpers, `assertHasFieldError`). Cases:

1. `testPutFeedback_shouldReturn200AndStoreUpVerdict_whenFirstVote` — PUT `up` on a random chat_message uuid; response carries the kind/id/verdict, `reason` null, `updatedAt` non-null.
2. `testPutFeedback_shouldOverwrite_whenOppositeVerdictSent` — PUT `up`, then PUT `down`+`inaccurate`; the GET batch-read returns exactly ONE row, verdict `down`, reason `inaccurate`.
3. `testPutFeedback_shouldReturn400_whenReasonSentWithUp` — PUT `up`+`too_much` ⇒ 400 (service-level guard; assert the body carries error code `FEEDBACK_REASON_REQUIRES_DOWN`).
4. `testPutFeedback_shouldReturn400_whenArtifactKindUnknown` — `artifactKind: "bogus"` ⇒ 400 with a field error on `artifactKind`.
5. `testPutFeedback_shouldAccept_whenArtifactIdDanglingAcrossTables` — a uuid that exists in no table is accepted (spec §8.1: existence deliberately unchecked).
6. `testDeleteFeedback_shouldReturn204AndRemoveVerdict_whenVoteExists` — populate, DELETE, then GET returns empty.
7. `testDeleteFeedback_shouldReturn204_whenNoVoteExists` — retraction is idempotent.
8. `testPutFeedback_shouldResurrect_whenVotedAgainAfterRetraction` — PUT `up`, DELETE, PUT `down`+`bad_timing` ⇒ 200 and the GET returns the `down` row (proves the upsert beats the unique constraint on the soft-deleted ghost).
9. `testListFeedback_shouldReturnOnlyVotedIds_whenBatchRead` — populate two of three ids, GET with all three ⇒ 2 rows.
10. `testListFeedback_shouldNotLeakOtherUsersVerdicts_whenSameArtifactId` — populate a verdict for a second user (via `userPopulator`) on the same artifact id; the owner's GET returns empty.
11. `testListFeedback_shouldReturn400_whenKindUnknown`.

`CompanionFeedbackSwitchOffIT.java` — the `JournalSwitchOffIT` idiom with `mezo.feature.companion.enabled=false`: every route 404s and the context still starts.

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && ./mvnw test -Dtest='CompanionFeedbackApiIT,CompanionFeedbackSwitchOffIT'
```

Expected: compilation failure — the service/controller do not exist.

- [ ] **Step 3: Write the mapper**

`MessageFeedbackMapper.java` — MapStruct `@Mapper(componentModel = "spring")`, one method `MessageFeedbackResponse toResponse(MessageFeedbackEntity entity)`. Field names already line up (`artifactKind`, `artifactId`, `verdict`, `reason`, `updatedAt`); check the repo's existing mapper config class before adding annotations (`feature/journal/mapper/JournalMapper.java` is the template).

- [ ] **Step 4: Write the service**

`MessageFeedbackService.java` — `@Service`, `@RequiredArgsConstructor`, `@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")`.

```java
    @Transactional
    public MessageFeedbackResponse put(UUID userId, PutFeedbackRequest request) {
        // The DB CHECK is the backstop; this is the honest 400 (a 500 from a CHECK is not an answer).
        if (request.getReason() != null && !MessageFeedbackEntity.VERDICT_DOWN.equals(request.getVerdict())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("FEEDBACK_REASON_REQUIRES_DOWN").build(), HttpStatus.BAD_REQUEST);
        }
        repository.upsertVerdict(userId, request.getArtifactKind(), request.getArtifactId(),
            request.getVerdict(), request.getReason());
        return mapper.toResponse(repository
            .findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
                userId, request.getArtifactKind(), request.getArtifactId())
            .orElseThrow(() -> new IllegalStateException("upserted verdict vanished")));
    }

    /** Retraction (spec §4.4: re-tapping the same verdict removes it) — soft delete via @SQLDelete;
     *  idempotent, because "I have no opinion on this" is already the state a missing row means. */
    @Transactional
    public void retract(UUID userId, String artifactKind, UUID artifactId) {
        repository.findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(userId, artifactKind, artifactId)
            .ifPresent(repository::delete);
    }

    @Transactional(readOnly = true)
    public List<MessageFeedbackResponse> list(UUID userId, String kind, List<UUID> ids) {
        return repository
            .findByCreatedByAndArtifactKindAndArtifactIdInAndDeletedFalse(userId, kind, ids)
            .stream().map(mapper::toResponse).toList();
    }
```

- [ ] **Step 5: Write the controller**

`CompanionFeedbackController.java` — `@RestController`, `@RequiredArgsConstructor`, `@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")`, `implements CompanionFeedbackApi`, thin delegation with ownership from `CurrentUserId` (the `JournalController` shape exactly). Class javadoc: `/api/companion/feedback` surface (bd mezo-b3pp.15) — rides `COMPANION_SWITCH` (no own switch; it is a companion organ, spec §8.1).

- [ ] **Step 6: Run the ITs to green**

```bash
cd backend && ./mvnw test -Dtest='CompanionFeedbackApiIT,CompanionFeedbackSwitchOffIT,MessageFeedbackPersistenceIT'
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(companion): feedback upsert/retract/batch-read endpoints (mezo-b3pp.15)"
```

---

### Task 4: Expose the proactive artifact ids end-to-end

**Files:**
- Verify/Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java`
- Test: existing proactive ITs (`backend/src/test/java/io/mrkuhne/mezo/feature/proactive/…`)

**Interfaces:**
- Consumes: the Task 1 contract (`id` now required on the three responses).
- Produces: `/api/proactive/feed`, `/api/proactive/weekly-suggestion`, `/api/proactive/memoir` responses carrying the row id — the FE's `artifactId` for `feed_message` / `weekly_suggestion` / `memoir`.

- [ ] **Step 1: Add the assertion to the existing ITs first**

Find the ITs covering those three endpoints:

```bash
grep -rln "proactive/memoir\|proactive/weekly-suggestion\|proactive/feed" backend/src/test/java
```

In each, add an assertion that the returned `id` is non-null and equals the populated entity's id (use the existing `MemoirPopulator` / `CompanionMessagePopulator` return values).

- [ ] **Step 2: Run them — they should fail only if MapStruct did not auto-map**

```bash
cd backend && ./mvnw test -Dtest='*Memoir*IT,*WeeklySuggestion*IT,*Feed*IT'
```

Expected: PASS without production changes — `MemoirEntity`/`WeeklySuggestionEntity`/`CompanionMessageEntity` all expose `getId()` and MapStruct maps same-named properties automatically. If any FAILS with a null `id`, add the explicit `@Mapping(target = "id", source = "id")` to that method in `ProactiveMapper` and re-run.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java backend/src/main/java/io/mrkuhne/mezo/feature/proactive
git commit -m "test(proactive): pin the artifact ids now exposed on feed/weekly/memoir (mezo-b3pp.15)"
```

---

### Task 5: FE data layer — `useFeedback`

**Files:**
- Create: `frontend/src/data/feedback/feedbackTypes.ts`
- Create: `frontend/src/data/feedback/feedbackApi.ts`
- Create: `frontend/src/data/feedback/feedbackMock.ts`
- Create: `frontend/src/data/feedback/feedbackHooks.ts`
- Test: `frontend/src/data/feedback/feedbackHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts`
- Modify: `frontend/src/data/hooks.reexport.test.ts`

**Interfaces:**
- Produces (`feedbackTypes.ts`):
  ```ts
  export type FeedbackArtifactKind = 'chat_message' | 'feed_message' | 'weekly_suggestion' | 'memoir' | 'prediction'
  export type FeedbackVerdict = 'up' | 'down'
  export type FeedbackReason = 'inaccurate' | 'too_much' | 'bad_timing' | 'not_about_me'
  export interface ArtifactFeedback { artifactKind: FeedbackArtifactKind; artifactId: string; verdict: FeedbackVerdict; reason: FeedbackReason | null; updatedAt: string }
  export interface FeedbackHandle {
    get: (artifactId: string) => ArtifactFeedback | undefined
    vote: (artifactId: string, verdict: FeedbackVerdict, reason?: FeedbackReason) => void
    pending: boolean
  }
  ```
- Produces: `useFeedback(kind: FeedbackArtifactKind, ids: string[]): FeedbackHandle` — exported through `@/data/hooks`.
- Consumed by: Tasks 6–9.

- [ ] **Step 1: Write the failing hook test**

`feedbackHooks.test.tsx` — follow `frontend/src/data/journal/journalHooks.test.tsx` for the render-hook + QueryClientProvider wrapper and the mock/real-mode switch idiom. Cases:

1. mock mode: `get(id)` is `undefined` before any vote (honest empty seed).
2. mock mode: after `vote('a', 'up')`, `get('a')` is `{verdict:'up', reason:null}`.
3. mock mode: `vote('a','up')` twice ⇒ `get('a')` is `undefined` (re-tapping the same verdict retracts).
4. mock mode: `vote('a','up')` then `vote('a','down','too_much')` ⇒ `{verdict:'down', reason:'too_much'}`.
5. mock mode: no network call is made (`fetch` spy not called).
6. real mode: mount with `ids: ['a','b']` ⇒ exactly one GET to `/api/companion/feedback?kind=chat_message&ids=a,b`; the returned rows hydrate `get`.
7. real mode: `vote('a','down','bad_timing')` issues `PUT /api/companion/feedback` and updates optimistically before the response resolves.
8. real mode: re-tapping the same verdict issues `DELETE /api/companion/feedback/chat_message/a`.
9. real mode: an empty `ids` array issues **no** request (the contract requires `minItems: 1`).
10. real mode: a failing GET degrades to "no verdicts" (`get` returns undefined, nothing throws) — IDENT-3.

- [ ] **Step 2: Run it to confirm failure**

```bash
cd frontend && pnpm vitest run src/data/feedback/feedbackHooks.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `feedbackTypes.ts` and `feedbackMock.ts`**

Types exactly as in **Interfaces**. `feedbackMock.ts` exports `export const mockFeedback: ArtifactFeedback[] = []` with a comment stating the honest reason (nothing has been voted on in the demo seed; mock votes accumulate in the query cache during the session).

- [ ] **Step 4: Write `feedbackApi.ts`**

Wire types from `paths['/api/companion/feedback']`; three calls mirroring `journalApi`'s shape:

```ts
export const feedbackApi = {
  list: (kind: FeedbackArtifactKind, ids: string[]): Promise<ArtifactFeedback[]> =>
    apiFetch<FeedbackListResponse>(`/api/companion/feedback?kind=${kind}&ids=${ids.join(',')}`)
      .then((rows) => rows.map(toArtifactFeedback)),
  put: (kind: FeedbackArtifactKind, artifactId: string, verdict: FeedbackVerdict, reason?: FeedbackReason) =>
    apiFetch<FeedbackWire>('/api/companion/feedback', {
      method: 'PUT',
      body: JSON.stringify({ artifactKind: kind, artifactId, verdict, reason } satisfies PutFeedbackBody),
    }).then(toArtifactFeedback),
  remove: (kind: FeedbackArtifactKind, artifactId: string): Promise<void> =>
    apiFetch<void>(`/api/companion/feedback/${kind}/${artifactId}`, { method: 'DELETE' }),
}
```

- [ ] **Step 5: Write `feedbackHooks.ts`**

`useFeedback(kind, ids)`:
- Read via `useDualQuery<ArtifactFeedback[]>({ queryKey: ['feedback', kind, [...ids].sort().join(',')], mockData: mockFeedback, realFetch: () => feedbackApi.list(kind, ids), realEmpty: [] })`, and **skip the fetch entirely when `ids.length === 0`** (pass `realEmpty` through — check `useDualQuery`'s `enabled`/skip support before writing this and follow whatever the file actually offers; if it has none, guard by returning the empty handle before the query in a stable-hooks-order way, e.g. `realFetch: async () => (ids.length ? feedbackApi.list(kind, ids) : [])`).
- `vote(artifactId, verdict, reason)`: read the current entry; if `current?.verdict === verdict` ⇒ retract, else upsert. Mock mode mutates the cache entry directly (the `journalHooks` `setQueryData` idiom); real mode calls the API and invalidates `['feedback', kind]` on success, with an optimistic `setQueryData` first so the chip reacts instantly.
- **Do not** write `const { data = mockFeedback } = useQuery(...)` anywhere — the seed-leak guard fails the build.

- [ ] **Step 6: Barrel + reexport test**

Add to `frontend/src/data/hooks.ts`:

```ts
export { useFeedback } from '@/data/feedback/feedbackHooks'
```

Add a `describe` block to `hooks.reexport.test.ts` asserting `hooks.useFeedback` is the `feedbackHooks` implementation (mirror the existing journal block).

- [ ] **Step 7: Run the tests green in both modes**

```bash
cd frontend && pnpm vitest run src/data/feedback src/data/hooks.reexport.test.ts src/data/dualMode.guard.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data
git commit -m "feat(insights): useFeedback dual-mode hook + feedback api client (mezo-b3pp.15)"
```

---

### Task 6: The shared `FeedbackChips` component

**Files:**
- Create: `frontend/src/features/insights/components/FeedbackChips.tsx`
- Test: `frontend/src/features/insights/components/FeedbackChips.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export function FeedbackChips({ value, onVote, label }: {
    value: ArtifactFeedback | undefined
    onVote: (verdict: FeedbackVerdict, reason?: FeedbackReason) => void
    /** Screen-reader context, e.g. 'a heti tervjavaslatról'. */
    label: string
  }): JSX.Element
  ```
- Consumed by: Tasks 7–9.

Behavior: a 👍 and a 👎 chip; the active verdict renders selected (`chip brand`, `aria-pressed`). Tapping 👎 (when not already `down`) expands a four-chip reason row — `pontatlan` (`inaccurate`), `túl sok` (`too_much`), `rossz időzítés` (`bad_timing`), `nem rólam szól` (`not_about_me`) — and picking one calls `onVote('down', reason)`. Tapping 👎 when already `down` calls `onVote('down')`, which the hook turns into a retraction. The reason row collapses after a pick and on retraction. Use `Icon name="check"`/`Icon name="x"`? **No** — there is no thumb glyph in `shared/ui/Icon.tsx` (verified: the catalog has no `thumb*`); render the chips with the text labels `Segített` / `Nem talált` plus `👍`/`👎` characters, matching the existing text-chip idiom in `MemoirPage`.

- [ ] **Step 1: Write the failing component test**

Cases (Testing Library, no network):
1. renders both chips unselected when `value` is undefined; no reason row.
2. clicking 👍 calls `onVote('up')` exactly once with no reason.
3. `value.verdict === 'up'` ⇒ the 👍 chip has `aria-pressed="true"`, the 👎 chip `false`.
4. clicking 👎 does NOT call `onVote` immediately — it reveals the four reason chips.
5. clicking the `túl sok` reason calls `onVote('down', 'too_much')` and hides the reason row.
6. with `value.verdict === 'down'`, clicking 👎 calls `onVote('down')` (retraction path) and shows no reason row.
7. with `value = {verdict:'down', reason:'bad_timing'}`, the `rossz időzítés` chip renders selected.
8. the group exposes an accessible name containing the `label` prop.

- [ ] **Step 2: Run to confirm failure**

```bash
cd frontend && pnpm vitest run src/features/insights/components/FeedbackChips.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Presentational only: no hooks beyond `useState` for the reason-row toggle, no data imports. Hungarian copy throughout (house language for user-facing text).

- [ ] **Step 4: Run green**

```bash
cd frontend && pnpm vitest run src/features/insights/components/FeedbackChips.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/components
git commit -m "feat(insights): FeedbackChips — shared 👍/👎 + reason row (mezo-b3pp.15)"
```

---

### Task 7: Mount on ChatPage + MemoirPage (closes `mezo-kr9v`)

**Files:**
- Modify: `frontend/src/data/types.ts` (`ChatMessage.id?`, `Memoir.id`)
- Modify: `frontend/src/data/insights/chatApi.ts` (`toChatMessage` carries `id`)
- Modify: `frontend/src/data/insights/memoirApi.ts` (`toMemoir` carries `id`)
- Modify: `frontend/src/data/insights/insights.ts` (memoir mock seed gains an id)
- Modify: `frontend/src/features/insights/components/ChatMessage.tsx`
- Modify: `frontend/src/features/insights/pages/ChatPage.tsx`
- Modify: `frontend/src/features/insights/pages/MemoirPage.tsx`
- Test: `frontend/src/features/insights/pages/MemoirPage.test.tsx` (create if absent), `frontend/src/data/insights/chatApi.test.ts`

**Interfaces:**
- Consumes: `useFeedback` (Task 5), `FeedbackChips` (Task 6).
- Produces: `ChatMessage.id?: string` (absent on the in-flight streaming draft and on optimistic user rows — chips render only when present); `Memoir.id: string`.

- [ ] **Step 1: Write the failing tests**

- `chatApi.test.ts`: `toChatMessage` copies the wire `id` onto the FE message.
- `MemoirPage.test.tsx`: (a) the page renders the feedback chips and NOT the retired Like/Love/Save/Dismiss row (assert `queryByText('Love')` is null); (b) clicking 👍 in mock mode marks the chip pressed.
- A ChatPage-level test asserting chips render on assistant messages that carry an id and NOT on user messages.

- [ ] **Step 2: Run to confirm failure**

```bash
cd frontend && pnpm vitest run src/data/insights/chatApi.test.ts src/features/insights/pages
```

- [ ] **Step 3: Thread the ids**

- `types.ts`: add `id?: string` to `ChatMessage` (documented: "the persisted `ai_message` row id — absent while a turn is still streaming, which is exactly when there is nothing to vote on yet"); add `id: string` to `Memoir`.
- `chatApi.ts`: `toChatMessage` sets `id: m.id`.
- `memoirApi.ts`: `toMemoir` sets `id: wire.id`.
- `insights.ts` memoir mock: add a stable uuid-shaped id (e.g. `'00000000-0000-4000-8000-00000000mem1'` — use a real-looking uuid, the FE never parses it).

- [ ] **Step 4: Mount on chat**

In `ChatPage.tsx`: collect `const assistantIds = messages.filter((m) => m.role === 'assistant' && m.id).map((m) => m.id!)`, call `const fb = useFeedback('chat_message', assistantIds)`, and pass the per-message value/handler into `<ChatMessage m={m} feedback={…} />`. `ChatMessage.tsx` gains an optional `feedback?: { value: ArtifactFeedback | undefined; onVote: (v: FeedbackVerdict, r?: FeedbackReason) => void }` prop and renders `<FeedbackChips …/>` under the card, assistant rows only, only when the prop is present.

- [ ] **Step 5: Replace the memoir mock reactions**

In `MemoirPage.tsx`: delete the `ReactionKey` type, the `reactions` state and the four buttons entirely; mount `<FeedbackChips …/>` fed by `useFeedback('memoir', memoir ? [memoir.id] : [])`. The chips render in **live mode too** (the mock row never did) — that is the `mezo-kr9v` fix.

- [ ] **Step 6: Run green in both modes**

```bash
cd frontend && pnpm vitest run src/features/insights src/data/insights
VITE_USE_MOCK=true pnpm vitest run src/features/insights src/data/insights
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(insights): feedback chips on chat answers and the memoir (mezo-b3pp.15, mezo-kr9v)"
```

---

### Task 8: Mount on WeeklyPage + PredictionsPage

**Files:**
- Modify: `frontend/src/data/insights/weeklySuggestionApi.ts`, `frontend/src/data/insights/weeklyHooks.ts`
- Modify: `frontend/src/features/insights/pages/WeeklyPage.tsx`
- Modify: `frontend/src/features/insights/pages/PredictionsPage.tsx`
- Test: `frontend/src/data/insights/weeklyHooks.test.tsx`, page tests

**Interfaces:**
- Consumes: `useFeedback`, `FeedbackChips`.
- Produces: `useWeekly()` additionally returns `weeklySuggestionId: string | null` (the existing `weeklySuggestion: string | null` prose field is unchanged — additive, so no call site breaks).

- [ ] **Step 1: Write the failing tests**

- `weeklyHooks.test.tsx`: real mode ⇒ `weeklySuggestionId` is the wire id; mock mode ⇒ a stable mock id; no suggestion ⇒ null.
- WeeklyPage test: chips render when a suggestion exists, and NOT in the "A társ heti tervjavaslata hamarosan." empty state.
- PredictionsPage test: each prediction card renders chips; the empty state renders none.

- [ ] **Step 2: Run to confirm failure**

```bash
cd frontend && pnpm vitest run src/data/insights/weeklyHooks.test.tsx src/features/insights/pages
```

- [ ] **Step 3: Carry the id through the weekly suggestion**

`weeklySuggestionApi.get` currently maps the wire down to `w.prose`; change it to return `{ id: w.id, prose: w.prose }` and update `weeklyHooks` to keep both (query key unchanged), returning `weeklySuggestionId` alongside `weeklySuggestion`. Mock mode returns a stable mock id next to `mockWeeklySuggestion`.

- [ ] **Step 4: Mount the chips**

- `WeeklyPage.tsx`: inside the `weeklySuggestion != null` branch, under the prose, mount `<FeedbackChips …/>` fed by `useFeedback('weekly_suggestion', id ? [id] : [])`. Leave the mock-only Elfogad/Hangoljuk buttons untouched — they are a separate parked affordance, out of this slice's scope.
- `PredictionsPage.tsx`: `const fb = useFeedback('prediction', predictions.map((p) => p.id))`, and mount chips at the bottom of each card.

- [ ] **Step 5: Run green in both modes**

```bash
cd frontend && pnpm vitest run src/data src/features/insights
VITE_USE_MOCK=true pnpm vitest run src/data src/features/insights
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(insights): feedback chips on the weekly suggestion and predictions (mezo-b3pp.15)"
```

---

### Task 9: Mount on the companion-feed messages (Today)

**Files:**
- Modify: `frontend/src/data/types.ts` (`FeedMessage.id`)
- Modify: `frontend/src/data/today/feedApi.ts`
- Modify: `frontend/src/features/today/logic/mezoMessages.ts` (`MezoMessageItem.artifactId`)
- Modify: `frontend/src/features/today/components/MezoMessagesSheet.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.tsx`
- Test: `frontend/src/features/today/logic/mezoMessages.test.ts`, `frontend/src/features/today/components/MezoMessagesSheet.test.tsx`

**Interfaces:**
- Consumes: `useFeedback`, `FeedbackChips`.
- Produces: `MezoMessageItem.artifactId?: string` — set from the feed row's uuid; **absent** on the demo-briefing card and on needs-nudges (they are not persisted artifacts). `MezoMessagesSheet` gains an optional `feedback?: FeedbackHandle` prop; it renders chips only for items that have BOTH an `artifactId` and the prop.

- [ ] **Step 1: Write the failing tests**

- `mezoMessages.test.ts`: a feed row's `artifactId` is its uuid; the demo-briefing card and a nudge have `artifactId === undefined`.
- `MezoMessagesSheet.test.tsx`: given a `feedback` handle and an item with `artifactId`, chips render and clicking 👍 calls `vote(artifactId, 'up')`; given an item without `artifactId`, no chips render.

- [ ] **Step 2: Run to confirm failure**

```bash
cd frontend && pnpm vitest run src/features/today
```

- [ ] **Step 3: Thread the id and mount**

- `types.ts`: `FeedMessage` gains `id: string`; `feedApi` maps it.
- `mezoMessages.ts`: `MezoMessageItem` gains `artifactId?: string`; the `feed.map` sets it (the item's own `id` stays the kind — it is the React key and the seen-messages key; do not repurpose it).
- `MezoMessagesSheet.tsx`: optional `feedback` prop; render `<FeedbackChips …/>` at the bottom of a bubble when the item carries an `artifactId`.
- `TodayPage.tsx`: `const feedFb = useFeedback('feed_message', feed.map((m) => m.id))` and pass it to the sheet.

- [ ] **Step 4: Run green in both modes**

```bash
cd frontend && pnpm vitest run src/features/today src/data/today
VITE_USE_MOCK=true pnpm vitest run src/features/today src/data/today
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(today): feedback chips on companion-feed messages (mezo-b3pp.15)"
```

---

### Task 10: Docs in the same change

**Files:**
- Modify: `docs/features/companion.md`
- Modify: `docs/features/insights.md`
- Modify: `docs/features/today.md`
- Modify: `docs/features/proactive.md`

- [ ] **Step 1: Read the knowledge-base rules first**

Invoke the `knowledge-base` skill — it is the operating manual for `docs/features/` (10-section structure, code-native anchors, staleness stamps). Follow it rather than free-styling the edits.

- [ ] **Step 2: `companion.md` — the primary home**

Add to §4 a `### Backend tables (W4.1, ✅ mezo-b3pp.15)` block documenting `message_feedback` (columns, the five artifact kinds, `uq_message_feedback_artifact`, the two CHECKs), and to the REST-endpoints subsection the three operations with their semantics: one updatable verdict per artifact; **re-tap = retraction (soft delete)**; **re-vote after retraction resurrects the row via the native upsert** (say why: the unique constraint spans soft-deleted rows); artifact existence deliberately unchecked cross-table; rides `COMPANION_SWITCH` with no own switch. In §9 (Decisions/gotchas) record that experiments/challenges are NOT feedback artifacts because their decision endpoints already carry that signal.

- [ ] **Step 3: `insights.md`, `today.md`, `proactive.md`**

- `insights.md`: chips on chat answers (assistant rows with a persisted id only — never the streaming draft), on the weekly suggestion, on predictions, and the memoir row now being **live-mode real** — note that this retires the mock Like/Love/Save/Dismiss reactions and closes `mezo-kr9v`.
- `today.md`: chips inside `MezoMessagesSheet` for persisted feed messages; explicitly note that the demo-briefing card and needs-nudges carry no chips (no persisted artifact ⇒ no false affordance) and that mock mode's feed is empty by design.
- `proactive.md`: the feed/weekly-suggestion/memoir responses now expose `id`, and why (the W4.1 `artifactId`).

- [ ] **Step 4: Lint**

```bash
node scripts/lint-docs.mjs
```

Expected: no NEW staleness/orphan/broken-link findings versus the pre-change run. If the baseline already reports findings, compare against `git stash`-clean output rather than assuming zero.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs(companion): W4.1 feedback capture — table, endpoints, surfaces (mezo-b3pp.15)"
```

---

### Task 11: Gates + visual goldens

- [ ] **Step 1: Backend focused ITs**

Compose must be up (`docker compose up -d` in `backend/`). The full suite is CI's job.

```bash
cd backend && ./mvnw clean test -Dtest='MessageFeedbackPersistenceIT,CompanionFeedbackApiIT,CompanionFeedbackSwitchOffIT'
```

- [ ] **Step 2: Frontend, both modes + build**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Both modes must be green — a bare `pnpm test` in a worktree can run mock twice, so the explicit second invocation is not redundant.

- [ ] **Step 3: Visual goldens**

Mock mode now renders chips on the chat, weekly, memoir and predictions surfaces, so `insights-chat`, `insights-heti`, `insights-memoar`, `insights-elorejelzesek` are expected to move. The three `today-*` shots should NOT move (the sheet is closed in the shots and mock's feed is empty) — if they do, stop and find out why before updating.

```bash
cd frontend && pnpm test:visual
```

Then, once the diffs are confirmed to be exactly the new chip rows:

```bash
cd frontend && pnpm test:visual:update
```

Commit the darwin baselines, then trigger the linux baselines per the house workflow (`gh workflow run update-visual-baselines.yml -r <branch>`, approve the bot run if it lands `action_required`, `git fetch`, and merge the **origin** branch so the bot commit is included).

- [ ] **Step 4: Commit**

```bash
git add frontend/tests/visual
git commit -m "test(visual): refresh goldens for the feedback chip rows (mezo-b3pp.15)"
```

---

## Self-Review

**Spec coverage (§8.1):**
- `message_feedback` (§4.4) in the companion feature → Task 2. ✅
- Contract `PUT` upsert / `DELETE` retract / `GET` batch-read → Task 1 + Task 3. ✅
- Existence not checked cross-table; `reason` only with `down` (ck + contract) → Task 1 (contract pattern), Task 2 (CHECK), Task 3 (service 400 + IT #3, #5). ✅
- Rides `mezo.feature.companion.enabled`, no own switch → Task 3 + `CompanionFeedbackSwitchOffIT`. ✅
- Shared `FeedbackChips` in `features/insights/components/` with 👍/👎 + the four HU reason chips, optimistic update, `useFeedback(kind, ids)` → Tasks 5–6. ✅
- Mounted on chat, feed cards, weekly suggestion, memoir (live-mode, mock reactions gone, closes `mezo-kr9v`), predictions → Tasks 7–9. ✅
- Acceptance "verdict upsert/retract round-trips on every surface in both FE modes; one row per artifact enforced; memoir mock reactions gone" → Task 3 ITs #1/#2/#6/#8, Task 5 hook tests, Task 7 MemoirPage test, Task 11 both-mode gate. ✅

**Cross-cutting (§11):** contract-first ✅; no new LLM/embed call site (so no `LlmCallContextHolder` change — correct for `companion_feedback`) ✅; integration-first + `ResetDatabase` + `FeedbackPopulator` ✅; docs in-change + lint ✅; `@/data/hooks` barrel + `useDualQuery` + honest mock seed ✅.

**Prerequisite the spec did not name but the slice cannot ship without:** `FeedMessageResponse`/`WeeklySuggestionResponse`/`MemoirResponse` had no `id` — Tasks 1 and 4 add and pin it. This is additive to the contract and invisible to existing consumers.

**Type consistency:** `FeedbackArtifactKind`/`FeedbackVerdict`/`FeedbackReason`/`ArtifactFeedback`/`FeedbackHandle` are defined once in Task 5 and used unchanged in Tasks 6–9; the wire kind strings match the DB CHECK, the OpenAPI patterns, and the entity constants character-for-character.
