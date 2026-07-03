# Companion V0.2 — Conversations + Sync Chat Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A persisted companion conversation with a non-streamed Hungarian LLM answer — the API spine (tables + contract + services + sync endpoint) that V0.3–V2.x hang on.

**Architecture:** Two new owned tables (`ai_conversation`, `ai_message` with typed-but-empty jsonb envelopes), a contract-first `Companion` API fragment, and two switch-gated services: `ConversationService` (CRUD spine) and `ChatService` (static HU companion-voice system prompt + last-N-message history windowing → `CompanionLlm.complete()` → persist both turns). No FE change (mock ChatPage untouched until V0.4). The living doc `docs/features/companion.md` is born here.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven · PostgreSQL 16 + Liquibase · Spring AI 2.0 behind the existing `CompanionLlm` port (real: Gemini, tests: `FakeCompanionLlm`) · OpenAPI contract-first codegen · MapStruct + Lombok.

**Driving bd issue:** `mezo-fnnq.2` (claimed). Roadmap brief: `docs/superpowers/plans/2026-07-03-companion-roadmap.md` §V0.2. Design spec: `docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md` (§3 data model, §6 guardrails).

## Global Constraints

- Base package `io.mrkuhne.mezo`; feature code under `feature/companion/{controller,service,repository,entity,mapper,config,llm}`.
- UUID PKs (`gen_random_uuid()`); every owned table has `created_by uuid not null`, `is_deleted`, `created_at` (via `OwnedEntity`); soft delete only (`@SQLDelete`/`@SQLRestriction`).
- Contract-first: edit `api/feature/companion/companion.yml` BEFORE Java; merge with `cd api/generate && npm run generate:api`; FE types with `cd frontend && pnpm generate:api`; commit both outputs. Bump `api/base.yml` `info.version` 0.3.0 → 0.4.0.
- Liquibase script naming `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql` — this slice uses `202607031400_mezo-fnnq.2_create_ai_conversation_message.sql`; every constraint explicitly named (`pk_/fk_/uq_/ck_/idx_`); verify with `node scripts/lint-liquibase.mjs`.
- Config: everything tunable in `application.yml` under `mezo:`; `@Validated` `*Properties` records; NEVER `@Value`. Feature switch `mezo.feature.companion.enabled` already exists (`FeaturesConfiguration.COMPANION_SWITCH`); every new companion bean that depends on `CompanionLlm` or serves HTTP must be `@ConditionalOnProperty` on it (switch off ⇒ context still boots — `CompanionLlm` bean is absent then!).
- Errors: `SystemRuntimeErrorException` + `SystemMessage.error/field(code)`; codes resolved from `messages.properties`. This slice reuses existing codes only (`RESOURCE_NOT_FOUND`, `VALIDATION_*`).
- Tests: integration-first; extend `AbstractIntegrationTest` (service-level, add `@Transactional`) or `ApiIntegrationTest` (HTTP-level, NO `@Transactional`); data via `*Populator` (`saveAndFlush`); naming `test{Method}_should{Result}_when{Condition}`; AssertJ only; the LLM in tests is ALWAYS `FakeCompanionLlm` via `@ActiveProfiles("companion-fake")` — network never touched.
- Backend gate: `cd backend && ./mvnw clean test` (compose Postgres must be up; ALWAYS `clean` — Lombok+MapStruct incremental compile is flaky).
- FE gate (api.gen.ts changes): `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- Commit subjects: conventional + bd id, e.g. `feat(companion): ... (mezo-fnnq.2)`.
- Git: work on `feat/companion-v02`; at the end merge into `main` with `--no-ff` and push directly (do NOT `git pull --rebase` after the merge — it flattens the merge commit).

## Decisions locked in this plan (from the roadmap's "open decisions")

1. **Message-window size** = config `mezo.companion.chat.history-window` (messages, not turns; default `20` ≈ 10 turns). Title truncation length = config `mezo.companion.chat.title-max-chars` (default `80`; DB caps at 120).
2. **Auto-titling deferred** as the roadmap says: `title` = first user message truncated to `title-max-chars`; set once, never regenerated.
3. **`started_at` is NOT a separate column** — `OwnedEntity.created_at` is the conversation start; the contract's `startedAt` maps from it. (The design-spec §3 field list is "essence", not DDL; a duplicate column would just drift.)
4. **History windowing lives in the system prompt** (rendered `Daniel:`/`Mezo:` transcript block) — the `CompanionLlm` port keeps its V0.1 two-string shape; a message-list port variant is V0.5's problem (tool calling forces it anyway).
5. **Envelope shapes** (typed jsonb, ADR 0006 / `ProvenanceEnvelope` precedent, always `null` in V0.2): `ToolCallsEnvelope{calls:[{type,name}]}`, `RefsEnvelope{refs:[{kind,id}]}` — field names mirror the FE mock `Tool{type,name}` / `ChatRef{kind,id}` so V0.4 wiring is mechanical.

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `api/feature/companion/companion.yml` | Contract fragment: 4 endpoints + 5 schemas |
| Modify | `api/generate/merge.yml` | Append fragment to inputs |
| Modify | `api/base.yml` | version 0.3.0 → 0.4.0 |
| Create | `backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql` | DDL both tables |
| Modify | `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` | New changeSet entry |
| Create | `backend/.../feature/companion/entity/AiConversationEntity.java` | Conversation aggregate root |
| Create | `backend/.../feature/companion/entity/AiMessageEntity.java` | Message row + envelopes |
| Create | `backend/.../feature/companion/entity/ToolCallsEnvelope.java` | Typed jsonb (empty in V0.2) |
| Create | `backend/.../feature/companion/entity/RefsEnvelope.java` | Typed jsonb (empty in V0.2) |
| Create | `backend/.../feature/companion/repository/AiConversationRepository.java` | Owner-scoped finders |
| Create | `backend/.../feature/companion/repository/AiMessageRepository.java` | History + window finders |
| Modify | `backend/.../feature/companion/config/CompanionProperties.java` | + nested `Chat` record |
| Modify | `backend/src/main/resources/application.yml` | + `mezo.companion.chat.*` |
| Create | `backend/.../feature/companion/mapper/CompanionMapper.java` | Entity → generated api.dto |
| Create | `backend/.../feature/companion/service/ConversationService.java` | list/create/listMessages/getOwned |
| Create | `backend/.../feature/companion/service/ChatService.java` | prompt assembly + sync turn |
| Create | `backend/.../feature/companion/controller/CompanionController.java` | implements generated `CompanionApi` |
| Create | `backend/src/test/.../support/populator/AiConversationPopulator.java` | Test factory |
| Create | `backend/src/test/.../support/populator/AiMessagePopulator.java` | Test factory |
| Modify | `backend/src/test/.../support/AbstractIntegrationTest.java` | @Import the 2 populators |
| Modify | `backend/src/test/.../support/ResetDatabase.java` | TRUNCATE + `ai_message`, `ai_conversation` |
| Create | `backend/src/test/.../feature/companion/AiMessageJsonbRoundTripIT.java` | jsonb envelope round-trip |
| Create | `backend/src/test/.../feature/companion/ConversationServiceIT.java` | service-level |
| Create | `backend/src/test/.../feature/companion/ChatServiceIT.java` | prompt/window/persistence vs fake |
| Create | `backend/src/test/.../feature/companion/CompanionApiIT.java` | HTTP-level |
| Create | `backend/src/test/.../feature/companion/CompanionApiSwitchOffIT.java` | switch=false ⇒ 404 |
| Modify | `frontend/src/data/_client/api.gen.ts` | regenerated (committed) |
| Create | `docs/features/companion.md` | Living doc — born here |
| Modify | `docs/features/README.md` | Index row + map row |
| Modify | `docs/milestones/roadmap.md` | Milestone-log line |

`backend/...` = `backend/src/main/java/io/mrkuhne/mezo`, `backend/src/test/...` = `backend/src/test/java/io/mrkuhne/mezo`.

---

### Task 1: Contract fragment + codegen

**Files:**
- Create: `api/feature/companion/companion.yml`
- Modify: `api/generate/merge.yml` (append input line)
- Modify: `api/base.yml` (`info.version: 0.4.0`)
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` (both committed)

**Interfaces:**
- Produces (backend codegen, used by Tasks 4–6): interface `io.mrkuhne.mezo.api.controller.CompanionApi` with methods `List<ConversationResponse> listConversations()`, `ConversationResponse createConversation()` (201), `List<MessageResponse> listMessages(UUID conversationId)`, `MessageResponse sendMessage(UUID conversationId, SendMessageRequest sendMessageRequest)`; DTOs `io.mrkuhne.mezo.api.dto.{ConversationResponse, MessageResponse, MessageTool, MessageRef, SendMessageRequest}` (Lombok builders).

- [ ] **Step 1: Create branch**

```bash
git checkout -b feat/companion-v02
```

- [ ] **Step 2: Write the fragment**

Create `api/feature/companion/companion.yml`:

```yaml
openapi: 3.0.3
info: { title: '', version: '' }
tags:
  - name: Companion
    description: Phase-3 companion chat — conversations + messages (mezo-fnnq)
paths:
  /api/companion/conversation:
    get:
      tags: [Companion]
      operationId: listConversations
      summary: List the owner's conversations, most recently active first
      responses:
        '200':
          description: Conversations ordered by last activity (newest first)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/ConversationResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    post:
      tags: [Companion]
      operationId: createConversation
      summary: Start a new, empty conversation (title is set by the first message)
      responses:
        '201':
          description: The created conversation
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ConversationResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/companion/conversation/{conversationId}/messages:
    get:
      tags: [Companion]
      operationId: listMessages
      summary: Full message history of one conversation, oldest first
      parameters:
        - name: conversationId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Messages in chronological order
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/MessageResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Conversation not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/companion/conversation/{conversationId}/message:
    post:
      tags: [Companion]
      operationId: sendMessage
      summary: Send a user message and get the assistant's answer (sync JSON — V0.2; SSE arrives in V0.4)
      parameters:
        - name: conversationId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SendMessageRequest' }
      responses:
        '200':
          description: The persisted assistant message
          content:
            application/json:
              schema: { $ref: '#/components/schemas/MessageResponse' }
        '400':
          description: Validation error
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Conversation not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    ConversationResponse:
      type: object
      required: [id, startedAt]
      properties:
        id: { type: string, format: uuid }
        title: { type: string, nullable: true, maxLength: 120, description: 'Null until the first user message; then that message truncated.' }
        startedAt: { type: string, format: date-time }
        lastMessageAt: { type: string, format: date-time, nullable: true }
    MessageResponse:
      type: object
      required: [id, role, content, createdAt, tools, refs]
      properties:
        id: { type: string, format: uuid }
        role: { type: string, description: "'user' | 'assistant'" }
        content: { type: string }
        createdAt: { type: string, format: date-time }
        tools:
          type: array
          description: Tool calls behind this answer — always empty until V0.5.
          items: { $ref: '#/components/schemas/MessageTool' }
        refs:
          type: array
          description: Data references backing this answer — always empty until V0.5.
          items: { $ref: '#/components/schemas/MessageRef' }
    MessageTool:
      type: object
      required: [type, name]
      properties:
        type: { type: string, description: "'read' | 'compute' (mirrors the FE ToolType)" }
        name: { type: string }
    MessageRef:
      type: object
      required: [kind, id]
      properties:
        kind: { type: string }
        id: { type: string }
    SendMessageRequest:
      type: object
      required: [content]
      properties:
        content: { type: string, minLength: 1, maxLength: 4000 }
```

- [ ] **Step 3: Register the fragment + bump version**

In `api/generate/merge.yml` append after the fuel line:

```yaml
  - inputFile: ../feature/companion/companion.yml
```

In `api/base.yml` change `version: 0.3.0` → `version: 0.4.0`.

- [ ] **Step 4: Merge + regenerate both sides**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
cd ../backend && ./mvnw clean compile
```

Expected: merge writes `api/openapi.yml`; FE writes `src/data/_client/api.gen.ts`; Maven `generate-sources` emits `target/generated-sources/openapi/.../CompanionApi.java` and compiles (an unimplemented generated interface is fine — `interfaceOnly`).

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): companion conversation + message contract fragment (mezo-fnnq.2)"
```

---

### Task 2: Migration + entities + repositories + test infra (jsonb round-trip)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/{AiConversationEntity,AiMessageEntity,ToolCallsEnvelope,RefsEnvelope}.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/{AiConversationRepository,AiMessageRepository}.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/{AiConversationPopulator,AiMessagePopulator}.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (@Import list)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list, lines ~38-43)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/AiMessageJsonbRoundTripIT.java`

**Interfaces:**
- Consumes: `OwnedEntity` (`techcore/persistence/OwnedEntity.java` — gives `createdBy`/`deleted`/`createdAt`; NOTE field is `deleted`, column `is_deleted`), `OwnedRepository<T>` (`techcore/persistence/OwnedRepository.java` — its default `findAllOwned` orders by `e.date`, which our entities don't have ⇒ MUST override).
- Produces (used by Tasks 4–5):
  - `AiConversationEntity` — `UUID getId()`, `String getTitle()`/`setTitle`, `Instant getLastMessageAt()`/`setLastMessageAt`, inherited `setCreatedBy(UUID)`, `Instant getCreatedAt()`.
  - `AiMessageEntity` — constants `ROLE_USER = "user"`, `ROLE_ASSISTANT = "assistant"`; `setConversation(AiConversationEntity)`, `setRole(String)`, `setContent(String)`, `getToolCalls(): ToolCallsEnvelope`, `getRefs(): RefsEnvelope`.
  - `AiConversationRepository.findAllOwned(UUID)` (activity-ordered), `findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy): Optional<AiConversationEntity>`.
  - `AiMessageRepository.findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(UUID, UUID): List<AiMessageEntity>` and `...OrderByCreatedAtDesc(UUID, UUID, Pageable): List<AiMessageEntity>`.
  - Populators: `AiConversationPopulator.conversation(UUID createdBy)` / `conversation(UUID createdBy, String title, Instant lastMessageAt)`; `AiMessagePopulator.message(AiConversationEntity conversation, String role, String content)`.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/AiMessageJsonbRoundTripIT.java` (mirror of `feature/train/ProvenanceRoundTripIT`):

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Proves the typed jsonb envelopes on ai_message survive a real DB round-trip (ADR 0006 pattern). */
@Transactional
class AiMessageJsonbRoundTripIT extends AbstractIntegrationTest {

    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbcTemplate;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testPersist_shouldRoundTripTypedEnvelopes_whenToolCallsAndRefsSet() {
        UUID userId = databasePopulator.populateUser("companion-jsonb@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz");
        message.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCallsEnvelope.ToolCall("read", "get_weight_trend"))));
        message.setRefs(new RefsEnvelope(List.of(
                new RefsEnvelope.Ref("weight", "2026-07-01"))));
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolCalls().calls()).hasSize(1);
        assertThat(reloaded.getToolCalls().calls().getFirst().name()).isEqualTo("get_weight_trend");
        assertThat(reloaded.getRefs().refs().getFirst().kind()).isEqualTo("weight");
        assertThat(jdbcTemplate.queryForObject(
                "select jsonb_typeof(tool_calls) from ai_message where id = ?", String.class, id))
                .isEqualTo("object");
    }

    @Test
    void testPersist_shouldKeepEnvelopesNull_whenNotSet() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-null@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_USER);
        message.setContent("kérdés");
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolCalls()).isNull();
        assertThat(reloaded.getRefs()).isNull();
    }
}
```

- [ ] **Step 2: Run it — expect compile failure**

```bash
cd backend && ./mvnw clean test -Dtest=AiMessageJsonbRoundTripIT
```

Expected: COMPILATION ERROR (`AiMessageEntity` etc. do not exist).

- [ ] **Step 3: Write the migration**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql`:

```sql
-- Phase 3 companion chat persistence spine (bd mezo-fnnq.2, roadmap §V0.2).
-- Conversation start time = created_at (no separate started_at column — plan decision #3).

create table ai_conversation (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid         not null,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    title           varchar(120),
    last_message_at timestamptz,
    constraint pk_ai_conversation_id primary key (id),
    constraint fk_ai_conversation_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create index idx_ai_conversation_created_by_last_message_at on ai_conversation (created_by, last_message_at desc);

create table ai_message (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid         not null,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    conversation_id uuid         not null,
    role            varchar(16)  not null,
    content         text         not null,
    tool_calls      jsonb,
    refs            jsonb,
    constraint pk_ai_message_id primary key (id),
    constraint fk_ai_message_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_ai_message_conversation_id_ai_conversation_id foreign key (conversation_id) references ai_conversation (id) on delete cascade,
    constraint ck_ai_message_role check (role in ('user', 'assistant'))
);

create index idx_ai_message_conversation_id_created_at on ai_message (conversation_id, created_at);
create index idx_ai_message_created_by on ai_message (created_by);
```

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (same shape as the last entry):

```yaml
  - changeSet:
      id: "1.0.0:202607031400_mezo-fnnq.2_create_ai_conversation_message"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql
```

Verify: `node scripts/lint-liquibase.mjs` → 0 violations.

- [ ] **Step 4: Write envelopes + entities**

`.../feature/companion/entity/ToolCallsEnvelope.java`:

```java
package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;

/**
 * Typed jsonb envelope for ai_message.tool_calls (ADR 0006 / ProvenanceEnvelope precedent).
 * V0.2 only persists null; V0.5 (tool calling) starts writing entries and may extend ToolCall
 * with args/result fields. Field names mirror the FE mock Tool contract { type, name }.
 */
public record ToolCallsEnvelope(List<ToolCall> calls) {

    public record ToolCall(String type, String name) {
    }
}
```

`.../feature/companion/entity/RefsEnvelope.java`:

```java
package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;

/**
 * Typed jsonb envelope for ai_message.refs — the data references backing an assistant answer.
 * V0.2 only persists null; V0.5 fills it. Mirrors the FE mock ChatRef contract { kind, id }.
 */
public record RefsEnvelope(List<Ref> refs) {

    public record Ref(String kind, String id) {
    }
}
```

`.../feature/companion/entity/AiConversationEntity.java`:

```java
package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "ai_conversation")
@SQLDelete(sql = "update ai_conversation set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class AiConversationEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Null until the first user message; then that message truncated to mezo.companion.chat.title-max-chars. */
    @Size(max = 120)
    @Column(length = 120)
    private String title;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;
}
```

`.../feature/companion/entity/AiMessageEntity.java`:

```java
package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "ai_message")
@SQLDelete(sql = "update ai_message set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class AiMessageEntity extends OwnedEntity {

    public static final String ROLE_USER = "user";
    public static final String ROLE_ASSISTANT = "assistant";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private AiConversationEntity conversation;

    /** Mirrors ck_ai_message_role. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "user|assistant")
    @Column(nullable = false, length = 16)
    private String role;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** Tool-call audit envelope — always null in V0.2; V0.5 starts writing it. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tool_calls", columnDefinition = "jsonb")
    private ToolCallsEnvelope toolCalls;

    /** Data references backing the answer — always null in V0.2; V0.5 starts writing it. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private RefsEnvelope refs;
}
```

- [ ] **Step 5: Write repositories**

`.../feature/companion/repository/AiConversationRepository.java`:

```java
package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiConversationRepository extends OwnedRepository<AiConversationEntity> {

    /** ai_conversation has no `date` column — order by last activity instead. */
    @Override
    @Query("""
            select c from AiConversationEntity c
            where c.createdBy = :createdBy and c.deleted = false
            order by coalesce(c.lastMessageAt, c.createdAt) desc
            """)
    List<AiConversationEntity> findAllOwned(UUID createdBy);

    Optional<AiConversationEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
```

`.../feature/companion/repository/AiMessageRepository.java`:

```java
package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Child-table repository (MealItemRepository style) — always accessed conversation- and owner-scoped. */
public interface AiMessageRepository extends JpaRepository<AiMessageEntity, UUID> {

    /** Full history, oldest first — the read surface of GET .../messages. */
    List<AiMessageEntity> findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(
            UUID conversationId, UUID createdBy);

    /** Newest-first page for prompt windowing — ChatService reverses it. */
    List<AiMessageEntity> findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtDesc(
            UUID conversationId, UUID createdBy, Pageable pageable);
}
```

- [ ] **Step 6: Write populators + register test infra**

`backend/src/test/java/io/mrkuhne/mezo/support/populator/AiConversationPopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.time.Instant;
import java.util.UUID;

@TestComponent
@RequiredArgsConstructor
public class AiConversationPopulator {

    private final AiConversationRepository repository;

    /** A fresh, empty conversation (no title, no activity yet). */
    public AiConversationEntity conversation(UUID createdBy) {
        AiConversationEntity conversation = new AiConversationEntity();
        conversation.setCreatedBy(createdBy);
        return repository.saveAndFlush(conversation);
    }

    public AiConversationEntity conversation(UUID createdBy, String title, Instant lastMessageAt) {
        AiConversationEntity conversation = new AiConversationEntity();
        conversation.setCreatedBy(createdBy);
        conversation.setTitle(title);
        conversation.setLastMessageAt(lastMessageAt);
        return repository.saveAndFlush(conversation);
    }
}
```

`backend/src/test/java/io/mrkuhne/mezo/support/populator/AiMessagePopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class AiMessagePopulator {

    private final AiMessageRepository repository;

    /** A message in the given conversation, owner inherited from the conversation. Envelopes stay null (V0.2 shape). */
    public AiMessageEntity message(AiConversationEntity conversation, String role, String content) {
        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(conversation.getCreatedBy());
        message.setRole(role);
        message.setContent(content);
        return repository.saveAndFlush(message);
    }
}
```

Modify `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java`: add `AiConversationPopulator.class, AiMessagePopulator.class` to the existing `@Import({...})` list (keep alphabetical position with the other populators) and the matching imports.

Modify `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`: add `ai_message, ai_conversation` to the `TRUNCATE TABLE ... CASCADE` table list (growth rule — same change as the migration).

- [ ] **Step 7: Run the test — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest=AiMessageJsonbRoundTripIT
```

Expected: 2 tests PASS (Liquibase applies the new changeset to `mezo_test` on context start).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo
git commit -m "feat(companion): ai_conversation + ai_message tables, entities, repos (mezo-fnnq.2)"
```

---

### Task 3: Chat config (window + title length)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml` (under the existing `mezo.companion:` block)
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java`

**Interfaces:**
- Produces (used by Task 5): `CompanionProperties.chat()` → `record Chat(int historyWindow, int titleMaxChars)`.

- [ ] **Step 1: Extend the failing test**

Add to the existing `CompanionPropertiesIT`:

```java
    @Test
    void testChatConfig_shouldBindWindowAndTitleFromYaml_whenContextStarts() {
        assertThat(properties.chat().historyWindow()).isEqualTo(20);
        assertThat(properties.chat().titleMaxChars()).isEqualTo(80);
    }
```

- [ ] **Step 2: Run — expect compile failure** (`chat()` does not exist)

```bash
cd backend && ./mvnw clean test -Dtest=CompanionPropertiesIT
```

- [ ] **Step 3: Implement**

`CompanionProperties.java` becomes:

```java
package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "mezo.companion")
public record CompanionProperties(@NotNull @Valid Llm llm, @NotNull @Valid Chat chat) {

    public record Llm(
            /** Cheap tier — every conversational turn. */
            @NotBlank String chatModel,
            /** Smart tier — heavy pipelines; unused until V3.2. */
            @NotBlank String smartModel) {
    }

    public record Chat(
            /** How many prior messages (user+assistant rows, 20 ≈ 10 turns) are windowed into the system prompt. */
            @Min(0) @Max(200) int historyWindow,
            /** Auto-title = first user message truncated to this many chars (DB column caps at 120). */
            @Min(10) @Max(120) int titleMaxChars) {
    }
}
```

(Keep any existing Javadoc on `Llm` fields as-is if it differs — only the `Chat` addition matters.)

`application.yml` — extend the existing `mezo.companion:` block:

```yaml
  companion:
    llm:
      chat-model: gemini-2.5-flash
      smart-model: gemini-2.5-pro
    chat:
      # How many prior messages (user+assistant rows) are windowed into the system prompt (20 = ~10 turns)
      history-window: 20
      # Auto-title = first user message truncated to this many characters (DB column caps at 120)
      title-max-chars: 80
```

- [ ] **Step 4: Run — expect PASS** (same command)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java
git commit -m "feat(companion): chat history-window + title config (mezo-fnnq.2)"
```

---

### Task 4: CompanionMapper + ConversationService

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ConversationService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ConversationServiceIT.java`

**Interfaces:**
- Consumes: Task 1 DTOs (`ConversationResponse`, `MessageResponse`, `MessageTool`, `MessageRef` — Lombok builders), Task 2 entities/repos/populators, `CurrentUserId` is NOT used here (services take `UUID userId` as first param — house pattern).
- Produces (used by Tasks 5–6):
  - `CompanionMapper.toConversationResponse(AiConversationEntity): ConversationResponse`, `toMessageResponse(AiMessageEntity): MessageResponse`.
  - `ConversationService.list(UUID userId): List<ConversationResponse>`, `create(UUID userId): ConversationResponse`, `listMessages(UUID userId, UUID conversationId): List<MessageResponse>`, `getOwned(UUID userId, UUID conversationId): AiConversationEntity` (throws 404 `RESOURCE_NOT_FOUND`).

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/ConversationServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Transactional
class ConversationServiceIT extends AbstractIntegrationTest {

    @Autowired private ConversationService conversationService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCreate_shouldPersistEmptyConversation_whenCalled() {
        UUID userId = databasePopulator.populateUser("conv-create@test.local");

        ConversationResponse created = conversationService.create(userId);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getTitle()).isNull();
        assertThat(created.getStartedAt()).isNotNull();
        assertThat(created.getLastMessageAt()).isNull();
        assertThat(conversationService.list(userId)).hasSize(1);
    }

    @Test
    void testList_shouldOrderByActivityDesc_whenMultipleConversations() {
        UUID userId = databasePopulator.populateUser("conv-order@test.local");
        AiConversationEntity older = conversationPopulator.conversation(
                userId, "régi", Instant.parse("2026-07-01T10:00:00Z"));
        AiConversationEntity newer = conversationPopulator.conversation(
                userId, "friss", Instant.parse("2026-07-02T10:00:00Z"));

        List<ConversationResponse> list = conversationService.list(userId);

        assertThat(list).extracting(ConversationResponse::getId)
                .containsExactly(newer.getId(), older.getId());
    }

    @Test
    void testList_shouldExcludeOtherUsersConversations_whenTwoUsers() {
        UUID mine = databasePopulator.populateUser("conv-mine@test.local");
        UUID theirs = databasePopulator.populateUser("conv-theirs@test.local");
        conversationPopulator.conversation(theirs);

        assertThat(conversationService.list(mine)).isEmpty();
    }

    @Test
    void testListMessages_shouldReturnChronological_whenMessagesExist() {
        UUID userId = databasePopulator.populateUser("conv-msgs@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "első kérdés");
        messagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "első válasz");

        List<MessageResponse> messages = conversationService.listMessages(userId, conversation.getId());

        assertThat(messages).extracting(MessageResponse::getContent)
                .containsExactly("első kérdés", "első válasz");
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
        assertThat(messages.getFirst().getTools()).isEmpty();
        assertThat(messages.getFirst().getRefs()).isEmpty();
    }

    @Test
    void testListMessages_shouldThrow404_whenConversationNotOwned() {
        UUID mine = databasePopulator.populateUser("conv-notmine@test.local");
        UUID theirs = databasePopulator.populateUser("conv-owner@test.local");
        AiConversationEntity foreign = conversationPopulator.conversation(theirs);

        assertThatThrownBy(() -> conversationService.listMessages(mine, foreign.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
```

- [ ] **Step 2: Run — expect compile failure** (`ConversationService` does not exist)

```bash
cd backend && ./mvnw clean test -Dtest=ConversationServiceIT
```

- [ ] **Step 3: Implement mapper + service**

`.../feature/companion/mapper/CompanionMapper.java`:

```java
package io.mrkuhne.mezo.feature.companion.mapper;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageRef;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.MessageTool;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import org.mapstruct.Mapper;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Mapper(componentModel = "spring")
public interface CompanionMapper {

    default ConversationResponse toConversationResponse(AiConversationEntity entity) {
        return ConversationResponse.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .startedAt(toOffset(entity.getCreatedAt()))
                .lastMessageAt(toOffset(entity.getLastMessageAt()))
                .build();
    }

    default MessageResponse toMessageResponse(AiMessageEntity entity) {
        return MessageResponse.builder()
                .id(entity.getId())
                .role(entity.getRole())
                .content(entity.getContent())
                .createdAt(toOffset(entity.getCreatedAt()))
                .tools(toTools(entity.getToolCalls()))
                .refs(toRefs(entity.getRefs()))
                .build();
    }

    /** Null envelope (the V0.2 steady state) maps to an empty array on the wire. */
    default List<MessageTool> toTools(ToolCallsEnvelope envelope) {
        if (envelope == null || envelope.calls() == null) {
            return List.of();
        }
        return envelope.calls().stream()
                .map(call -> MessageTool.builder().type(call.type()).name(call.name()).build())
                .toList();
    }

    default List<MessageRef> toRefs(RefsEnvelope envelope) {
        if (envelope == null || envelope.refs() == null) {
            return List.of();
        }
        return envelope.refs().stream()
                .map(ref -> MessageRef.builder().kind(ref.kind()).id(ref.id()).build())
                .toList();
    }

    default OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
```

`.../feature/companion/service/ConversationService.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ConversationService {

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final CompanionMapper mapper;

    public List<ConversationResponse> list(UUID userId) {
        return conversationRepository.findAllOwned(userId).stream()
                .map(mapper::toConversationResponse)
                .toList();
    }

    @Transactional
    public ConversationResponse create(UUID userId) {
        AiConversationEntity conversation = new AiConversationEntity();
        conversation.setCreatedBy(userId);
        return mapper.toConversationResponse(conversationRepository.save(conversation));
    }

    public List<MessageResponse> listMessages(UUID userId, UUID conversationId) {
        getOwned(userId, conversationId);
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversationId, userId)
                .stream()
                .map(mapper::toMessageResponse)
                .toList();
    }

    /** Loads an owned conversation or throws 404 — shared with ChatService. */
    public AiConversationEntity getOwned(UUID userId, UUID conversationId) {
        return conversationRepository.findByIdAndCreatedByAndDeletedFalse(conversationId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
```

- [ ] **Step 4: Run — expect PASS** (same command)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): ConversationService + CompanionMapper (mezo-fnnq.2)"
```

---

### Task 5: ChatService — windowed prompt + sync answer

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`

**Interfaces:**
- Consumes: `CompanionLlm.complete(String systemPrompt, String userMessage): String` (V0.1 port — unchanged), `FakeCompanionLlm.PREFIX = "FAKE-LLM"` (fake echoes `PREFIX + " system=[" + systemPrompt + "] user=[" + userMessage + "]"`), `ConversationService.getOwned`, `CompanionProperties.chat()`, Task 2 repos/populators, Task 4 mapper.
- Produces (used by Task 6): `ChatService.sendMessage(UUID userId, UUID conversationId, SendMessageRequest request): MessageResponse`.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** ChatService against the deterministic fake LLM — asserts persistence AND prompt assembly (the fake echoes its inputs). */
@Transactional
@ActiveProfiles("companion-fake")
class ChatServiceIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    @Test
    void testSendMessage_shouldPersistUserAndAssistantRows_whenFirstMessage() {
        UUID userId = databasePopulator.populateUser("chat-first@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("mit egyek ma?"));

        List<AiMessageEntity> rows = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId);
        assertThat(rows).hasSize(2);
        assertThat(rows.getFirst().getRole()).isEqualTo(AiMessageEntity.ROLE_USER);
        assertThat(rows.getFirst().getContent()).isEqualTo("mit egyek ma?");
        assertThat(rows.getLast().getRole()).isEqualTo(AiMessageEntity.ROLE_ASSISTANT);
        assertThat(rows.getLast().getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(rows.getLast().getToolCalls()).isNull();
        assertThat(rows.getLast().getRefs()).isNull();
        assertThat(answer.getRole()).isEqualTo("assistant");
        assertThat(answer.getTools()).isEmpty();

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getLastMessageAt()).isNotNull();
        assertThat(touched.getTitle()).isEqualTo("mit egyek ma?");
    }

    @Test
    void testSendMessage_shouldIncludeCompanionVoiceAndUserMessageInPrompt_whenCalled() {
        UUID userId = databasePopulator.populateUser("chat-voice@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia mezo"));

        // The fake echoes system=[...] user=[...] — the persisted answer proves prompt assembly.
        assertThat(answer.getContent()).contains("Te vagy a mezo");
        assertThat(answer.getContent()).contains("retatrutid");
        assertThat(answer.getContent()).contains("user=[szia mezo]");
        assertThat(answer.getContent()).doesNotContain("Eddigi beszélgetés");
    }

    @Test
    void testSendMessage_shouldWindowHistoryIntoPrompt_whenPriorTurnsExist() {
        UUID userId = databasePopulator.populateUser("chat-window@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");
        messagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "korábbi válasz");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("és most?"));

        assertThat(answer.getContent()).contains("Eddigi beszélgetés");
        assertThat(answer.getContent()).contains("Daniel: korábbi kérdés");
        assertThat(answer.getContent()).contains("Mezo: korábbi válasz");
        // The current message is the user param, not part of the rendered history block.
        assertThat(answer.getContent()).doesNotContain("Daniel: és most?");
        assertThat(answer.getContent()).contains("user=[és most?]");
    }

    @Test
    void testSendMessage_shouldLimitHistoryToWindow_whenMoreMessagesThanWindow() {
        UUID userId = databasePopulator.populateUser("chat-limit@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        // 22 prior messages with window=20: the 2 oldest must fall out.
        for (int i = 1; i <= 22; i++) {
            messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "üzenet-" + i);
        }

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("összegzés?"));

        assertThat(answer.getContent()).doesNotContain("üzenet-1\n");
        assertThat(answer.getContent()).doesNotContain("üzenet-2\n");
        assertThat(answer.getContent()).contains("üzenet-3");
        assertThat(answer.getContent()).contains("üzenet-22");
    }

    @Test
    void testSendMessage_shouldTruncateTitle_whenFirstMessageLong() {
        UUID userId = databasePopulator.populateUser("chat-title@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        String longContent = "x".repeat(200);

        chatService.sendMessage(userId, conversation.getId(), request(longContent));

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getTitle()).hasSize(80);
    }

    @Test
    void testSendMessage_shouldKeepTitle_whenSecondMessage() {
        UUID userId = databasePopulator.populateUser("chat-title2@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        chatService.sendMessage(userId, conversation.getId(), request("első téma"));

        chatService.sendMessage(userId, conversation.getId(), request("második üzenet"));

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getTitle()).isEqualTo("első téma");
    }

    @Test
    void testSendMessage_shouldThrow404_whenConversationNotOwned() {
        UUID mine = databasePopulator.populateUser("chat-notmine@test.local");
        UUID theirs = databasePopulator.populateUser("chat-owner@test.local");
        AiConversationEntity foreign = conversationPopulator.conversation(theirs);

        assertThatThrownBy(() -> chatService.sendMessage(mine, foreign.getId(), request("hahó")))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
```

- [ ] **Step 2: Run — expect compile failure** (`ChatService` does not exist)

```bash
cd backend && ./mvnw clean test -Dtest=ChatServiceIT
```

- [ ] **Step 3: Implement**

`.../feature/companion/service/ChatService.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatService {

    /**
     * Static Hungarian companion voice — IDENT-1 (companion, not coach), the clinical guard and
     * grounding-lite from the design spec §6. V0.3 appends the context snapshot; V1.1 the knowledge facts.
     */
    static final String SYSTEM_PROMPT = """
            Te vagy a mezo, Daniel személyes egészség- és teljesítmény-társa.
            Hangnem: közvetlen, többes szám első személyű („nézzük meg", „ezt visszük ma") — társ vagy, nem edző.
            Megfigyelsz és javasolsz, sosem osztályozol és sosem moralizálsz.
            Csak Daniel saját, naplózott adataira és a beszélgetésben elhangzottakra támaszkodj.
            Ha valamit nem tudsz, mondd ki őszintén, hogy nem tudod — számot vagy adatot kitalálni tilos.
            Gyógyszer adagolására (pl. retatrutid) vonatkozó változtatást SOHA ne javasolj — az orvosi döntés.
            Válaszolj magyarul, tömören.""";

    static final String HISTORY_HEADER = "\n\nEddigi beszélgetés (legrégebbitől a legújabbig):\n";

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final ConversationService conversationService;
    private final CompanionLlm companionLlm;
    private final CompanionProperties properties;
    private final CompanionMapper mapper;

    @Transactional
    public MessageResponse sendMessage(UUID userId, UUID conversationId, SendMessageRequest request) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);

        // Window BEFORE persisting the new message — the current content travels as the user param.
        String systemPrompt = SYSTEM_PROMPT + renderHistory(loadWindow(userId, conversationId));

        persistMessage(conversation, userId, AiMessageEntity.ROLE_USER, request.getContent());
        String answer = companionLlm.complete(systemPrompt, request.getContent());
        AiMessageEntity assistant =
                persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT, answer);

        touchConversation(conversation, request.getContent());
        return mapper.toMessageResponse(assistant);
    }

    private List<AiMessageEntity> loadWindow(UUID userId, UUID conversationId) {
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtDesc(
                        conversationId, userId, PageRequest.of(0, properties.chat().historyWindow()))
                .reversed();
    }

    private String renderHistory(List<AiMessageEntity> window) {
        if (window.isEmpty()) {
            return "";
        }
        StringBuilder history = new StringBuilder(HISTORY_HEADER);
        for (AiMessageEntity message : window) {
            history.append(AiMessageEntity.ROLE_USER.equals(message.getRole()) ? "Daniel: " : "Mezo: ")
                    .append(message.getContent())
                    .append('\n');
        }
        return history.toString();
    }

    private AiMessageEntity persistMessage(
            AiConversationEntity conversation, UUID userId, String role, String content) {
        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(role);
        message.setContent(content);
        // saveAndFlush so the two rows of a turn get distinct created_at (history ordering key)
        return messageRepository.saveAndFlush(message);
    }

    private void touchConversation(AiConversationEntity conversation, String userContent) {
        conversation.setLastMessageAt(Instant.now());
        if (conversation.getTitle() == null) {
            int max = properties.chat().titleMaxChars();
            conversation.setTitle(
                    userContent.length() <= max ? userContent : userContent.substring(0, max));
        }
        conversationRepository.save(conversation);
    }
}
```

- [ ] **Step 4: Run — expect PASS** (same command; also rerun `-Dtest=CompanionLlmFakeIT` to be sure nothing regressed on the port)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): ChatService — windowed HU prompt + sync answer (mezo-fnnq.2)"
```

---

### Task 6: Controller + HTTP-level ITs (incl. switch-off)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionApiSwitchOffIT.java`

**Interfaces:**
- Consumes: generated `CompanionApi` (Task 1), `ConversationService`/`ChatService` (Tasks 4–5), `CurrentUserId.get(): UUID` (`techcore/security`), `ApiIntegrationTest` helpers (`ownerAuthHeaders()`, `getForList`, `postForBody`, `getForBody`, `assertHasFieldError`, `assertHasRequestError`).

- [ ] **Step 1: Write the failing tests**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionApiIT.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** HTTP-level companion flow against the fake LLM ("companion-fake" merges with the base's "demodata"). */
@ActiveProfiles("companion-fake")
class CompanionApiIT extends ApiIntegrationTest {

    private static final String CONVERSATION_URI = "/api/companion/conversation";

    @Test
    void testListConversations_shouldReturn401_whenNoToken() {
        getForBody(CONVERSATION_URI, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testCreateConversation_shouldReturn201Empty_whenAuthenticated() {
        ConversationResponse created = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getTitle()).isNull();
        assertThat(created.getStartedAt()).isNotNull();
    }

    @Test
    void testSendMessage_shouldReturnAssistantMessageAndPersistFlow_whenValid() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);
        SendMessageRequest request = SendMessageRequest.builder().content("mi a mai terv?").build();

        MessageResponse answer = postForBody(
                CONVERSATION_URI + "/" + conversation.getId() + "/message",
                request, ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);

        assertThat(answer.getRole()).isEqualTo("assistant");
        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(answer.getTools()).isEmpty();
        assertThat(answer.getRefs()).isEmpty();

        List<MessageResponse> messages = getForList(
                CONVERSATION_URI + "/" + conversation.getId() + "/messages",
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);
        assertThat(messages).hasSize(2);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
        assertThat(messages.getFirst().getContent()).isEqualTo("mi a mai terv?");
        assertThat(messages.getLast().getRole()).isEqualTo("assistant");

        List<ConversationResponse> conversations = getForList(
                CONVERSATION_URI, ownerAuthHeaders(), HttpStatus.OK, ConversationResponse.class);
        assertThat(conversations)
                .filteredOn(c -> c.getId().equals(conversation.getId()))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.getTitle()).isEqualTo("mi a mai terv?");
                    assertThat(c.getLastMessageAt()).isNotNull();
                });
    }

    @Test
    void testSendMessage_shouldReturn400FieldError_whenContentEmpty() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        String body = postForBody(
                CONVERSATION_URI + "/" + conversation.getId() + "/message",
                SendMessageRequest.builder().content("").build(),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        // empty string fails minLength (Size) → VALIDATION_INVALID_VALUE (not REQUIRED_FIELD)
        assertHasFieldError(body, "content", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testListMessages_shouldReturn404_whenUnknownConversation() {
        String body = getForBody(
                CONVERSATION_URI + "/" + UUID.randomUUID() + "/messages",
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
```

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionApiSwitchOffIT.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** Switch off ⇒ the whole companion HTTP surface does not exist (bean-boundary gating). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CompanionApiSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testListConversations_shouldReturn404_whenCompanionSwitchedOff() {
        String body = getForBody(
                "/api/companion/conversation", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (`CompanionApiIT` fails with 404s — no controller bean yet; the switch-off IT passes trivially, that's fine)

```bash
cd backend && ./mvnw clean test -Dtest='CompanionApi*IT'
```

- [ ] **Step 3: Implement the controller**

`.../feature/companion/controller/CompanionController.java`:

```java
package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionApi;
import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionController implements CompanionApi {

    private final ConversationService conversationService;
    private final ChatService chatService;
    private final CurrentUserId currentUserId;

    @Override
    public List<ConversationResponse> listConversations() {
        return conversationService.list(currentUserId.get());
    }

    @Override
    public ConversationResponse createConversation() {
        return conversationService.create(currentUserId.get());
    }

    @Override
    public List<MessageResponse> listMessages(UUID conversationId) {
        return conversationService.listMessages(currentUserId.get(), conversationId);
    }

    @Override
    public MessageResponse sendMessage(UUID conversationId, SendMessageRequest request) {
        return chatService.sendMessage(currentUserId.get(), conversationId, request);
    }
}
```

(If the generated `CompanionApi` method signatures differ in parameter naming/order, follow the generated interface — it is the source of truth.)

- [ ] **Step 4: Run — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionApi*IT'
```

- [ ] **Step 5: Full backend gate**

```bash
cd backend && ./mvnw clean test
```

Expected: ALL tests green (including all pre-existing suites — `ResetDatabase` change must not break anything).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): REST controller + API ITs incl. switch-off (mezo-fnnq.2)"
```

---

### Task 7: Docs — birth of `docs/features/companion.md` + index + roadmap

**Files:**
- Create: `docs/features/companion.md`
- Modify: `docs/features/README.md` (§2 Domain docs list + §3 feature→doc map row for the companion backend; the ChatPage row keeps pointing at `insights.md` until V0.4)
- Modify: `docs/milestones/roadmap.md` (milestone-log line: V0.2 done)
- Check: `docs/features/_platform-api-backend.md` — if it enumerates contract fragments/feature packages, add the companion row (link, don't duplicate)

**Interfaces:** none (documentation).

- [ ] **Step 1: Write `docs/features/companion.md`**

Follow the canonical 10-section template from `docs/features/README.md` §5. Frontmatter and section skeleton (fill §3/§4/§10 with the exact file paths and `file:line` pointers as implemented; be precise about what exists vs deferred):

```markdown
---
title: Companion (AI chat brain)
type: feature-domain
status: mixed
updated: 2026-07-03
tags: [companion, ai, chat, llm, backend, phase-3]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion
  - api/feature/companion/companion.yml
  - backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql
  - docs/decisions/0008-companion-llm-spring-ai-2-gemini.md
related: [insights, _platform-api-backend, _platform-auth-security]
---

# Companion (AI chat brain) — Feature Documentation

> One-line: the Phase-3 AI companion backend — persisted conversations + a sync Hungarian
> chat endpoint over the `CompanionLlm` port (Spring AI 2 / Gemini). **Status: backend ✅
> V0.2 (spine); FE 🔶 mock (ChatPage is still the simulated `insights` surface until V0.4).**
```

Content requirements per section:
- **§1 Summary:** what V0.2 shipped (tables, contract, services, sync endpoint); driver bd `mezo-fnnq.2`; link the design spec + roadmap + ADR 0008.
- **§2 User-facing behavior:** none yet — the user-visible chat is still the mock ChatPage (`insights.md` §2.5); state this honestly.
- **§3 Architecture & data flow:** `CompanionController → ConversationService/ChatService → CompanionLlm (port: Gemini real / fake profile) + AiConversation/AiMessage repos`; the prompt-assembly shape (static HU voice + windowed history, current message as user param); switch-gating (`mezo.feature.companion.enabled` — every bean conditional; off ⇒ 404).
- **§4 Data model & API:** both tables (columns, envelopes-always-null-in-V0.2), the 4 endpoints with statuses, the config keys (`mezo.companion.chat.*`).
- **§5 Integrations:** insights/ChatPage (🟣 V0.4 seam, contract: `MessageResponse` ↔ FE `ChatMessage{role,ts,text,tools,refs}`); auth (`CurrentUserId`, `created_by` scoping); V0.3 snapshot + V0.5 tools as named future seams.
- **§6 How to use:** curl-level examples of the 4 endpoints (there is no FE hook yet).
- **§7 How to extend:** contract-first recipe + where V0.3 (snapshot into `SYSTEM_PROMPT` composition) and V0.4 (SSE) plug in.
- **§8 Testing:** the 5 IT classes + the `companion-fake` profile trick (fake echoes its inputs ⇒ prompt assembly is assertable); commands.
- **§9 Decisions, gotchas & deferred:** plan decisions 1–5 (window config, deferred auto-titling, no `started_at` column, windowing-in-prompt, envelope shapes); gotcha: `CompanionLlm` bean absent when switch off — never inject it into an ungated bean; deferred: streaming (V0.4), snapshot (V0.3), tools (V0.5).
- **§10 Key files:** grouped path list.

- [ ] **Step 2: Index + roadmap rows**

- `docs/features/README.md` §2 "Domain docs": add `companion.md` line.
- `docs/features/README.md` §3 map: add row `| Companion chat backend (conversations + sync message) | /api/companion/* | companion.md §3–§4 |`.
- `docs/milestones/roadmap.md`: add the V0.2-done line to the milestone log (same style as the existing entries).
- `docs/features/_platform-api-backend.md`: check for a fragment/feature enumeration; if present, add companion.

- [ ] **Step 3: Lint**

```bash
node scripts/lint-docs.mjs
```

Expected: 0 errors (no orphan, no broken link; companion.md fresh).

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs(companion): birth of features/companion.md — V0.2 spine (mezo-fnnq.2)"
```

---

### Task 8: Full gates + finish the branch

**Files:** none new.

- [ ] **Step 1: Backend gate (full)**

```bash
cd backend && ./mvnw clean test
```

Expected: ALL green.

- [ ] **Step 2: FE gate (api.gen.ts changed in Task 1)**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: build OK, both test modes green (contract change is additive — no FE source touched).

- [ ] **Step 3: Liquibase + docs lint (belt and braces)**

```bash
node scripts/lint-liquibase.mjs && node scripts/lint-docs.mjs
```

- [ ] **Step 4: Merge + close + push**

Use the superpowers:finishing-a-development-branch skill. House flow (single dev, no PR):

```bash
git checkout main
git pull --rebase          # BEFORE the merge, never after
git merge --no-ff feat/companion-v02 -m "Merge feat/companion-v02: conversations + sync chat endpoint (mezo-fnnq.2)"
git branch -d feat/companion-v02
bd close mezo-fnnq.2       # then: bd update mezo-fnnq.2 --notes="V0.2 shipped: tables+contract+services+sync endpoint" (close takes no reason arg)
bd dolt push
git push
git status                 # MUST show "up to date with origin"
```

---

## Self-Review (done at plan time)

- **Spec coverage vs roadmap §V0.2:** tables ✓ (Task 2), typed jsonb envelopes ✓ (Task 2, null in V0.2 by design), contract fragment with the 4 listed endpoints ✓ (Task 1), ConversationService + ChatService with static HU prompt ✓ (Tasks 4–5), history windowing ✓ (Task 5), sync JSON response ✓ (Tasks 1+5), populators + ResetDatabase ✓ (Task 2), ITs against fake asserting persistence + prompt assembly ✓ (Task 5), FE untouched ✓, living doc born ✓ (Task 7). Open decisions resolved as plan decisions 1–2.
- **Guardrails (design spec §6):** clinical guard + no-fabrication + grounding-lite are IN the SYSTEM_PROMPT text; switch-gating on every bean; LLM-free tests via the fake. Internal-sphere rule moot (no tools yet).
- **Type consistency:** `ConversationResponse{id,title,startedAt,lastMessageAt}` / `MessageResponse{id,role,content,createdAt,tools,refs}` used identically in contract (Task 1), mapper (Task 4), tests (Tasks 4–6). `getOwned` defined in Task 4, consumed in Task 5. `FakeCompanionLlm.PREFIX` consumed in Tasks 5–6 matches V0.1 (`"FAKE-LLM"`). Repository finder names identical across Tasks 2/4/5.
- **Known risks called out:** (a) generated `CompanionApi` exact parameter names may differ → Task 6 note says the generated interface wins; (b) `@ActiveProfiles` on subclasses MERGES with the base's profiles (`inheritProfiles=true` default) — relied on in `ChatServiceIT`/`CompanionApiIT`; (c) `AiConversationRepository.findAllOwned` @Override MUST carry the @Query or context startup fails validating `e.date`; (d) the migration timestamp `202607031400` must be bumped by a minute if another same-minute script lands first.
