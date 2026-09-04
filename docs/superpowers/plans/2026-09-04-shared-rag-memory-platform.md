# Shared RAG Memory Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a versioned hybrid long-term-memory platform, prove it through the chat pilot and
the synthetic Hungarian retrieval gate, while leaving briefing, memoir and prediction disconnected.

**Architecture:** Keep the current `memory_embedding` path as the frozen `OLD` baseline while a new
canonical `memory_item` + versioned `memory_vector` projection is dual-written beside it. A
Mezo-owned `MemoryContextService` prepares a query, runs dense/lexical/fact/graph retrievers,
combines them with deterministic RRF, optionally reranks uncertain requests, selects a diverse
token-bounded context and persists an audit trace. Chat switches through `OLD`, `SHADOW` and `NEW`;
other consumers are explicitly outside this plan.

**Tech Stack:** Java 21, Spring Boot 4, Spring AI 2, PostgreSQL 16, pgvector HNSW cosine,
PostgreSQL FTS + `pg_trgm`, Liquibase, JPA/Hibernate + JDBC, React 19, TypeScript, TanStack Query,
JUnit 5/AssertJ, Vitest/Testing Library, OpenAPI 3.0.3.

**Spec:** `docs/superpowers/specs/2026-09-04-shared-rag-memory-platform-design.md`

## Global Constraints

- Implement only spec slices A–C. Do not connect morning briefing, weekly memoir or prediction.
- Keep `memory_embedding` and `PromptMemoryAssembler` intact as the frozen `OLD` baseline until a
  separately approved retirement change.
- Every owned query filters `created_by` in SQL; post-query filtering is defense in depth only.
- Raw structured health data stays in domain tables and deterministic tools, never in vectors.
- Embedding dimension remains exactly 768; serving generation is explicit configuration.
- `memory_item` is a projection. Source rows remain authoritative.
- Normal chat never requires query rewrite or reranking to stay available.
- `NO_MEMORY_NEEDED` performs no embedding or retrieval call.
- Release gate: Recall@5 ≥85%, nDCG@5 and MRR above baseline, context precision at least +10
  percentage points, zero ownership leaks, empty-query false-positive rate ≤5%, p95 ≤250 ms on
  the normal no-rewrite/no-rerank path including real query embedding.
- All tunables live under `mezo:` in `application.yml` and bind to validated records; never use
  Spring `@Value`.
- Backend tests follow integration-first conventions with real PostgreSQL and Java populators.
- API changes are contract-first; frontend feature code imports hooks only from `@/data/hooks`.
- Each task below already has a Beads child issue. Execute it on its own `feat/<topic>` branch,
  use its exact issue ID in commits and migrations, push a self-PR, wait for CI green, and merge
  before starting a dependent task.
- Every task updates `docs/features/companion.md`, regenerates `docs/CODEMAP.md` when its mapped
  files change, and runs `node scripts/lint-docs.mjs`. Do not repair unrelated stale docs in these
  slices.

## File and interface map

New production package: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/`

```text
memory/
├── config/MemoryPlatformProperties.java
├── dto/
│   ├── ConsumerPolicy.java
│   ├── MemoryRequest.java
│   ├── MemoryContext.java
│   ├── MemoryContextItem.java
│   ├── MemoryCandidate.java
│   ├── PreparedMemoryQuery.java
│   ├── QueryMode.java
│   ├── RetrievalInput.java
│   ├── RetrievalServingMode.java
│   └── ScoreBreakdown.java
├── entity/
│   ├── MemoryItemEntity.java
│   ├── MemoryProvenanceEnvelope.java
│   ├── MemoryRetrievalFeedbackEntity.java
│   ├── MemoryRetrievalResultEntity.java
│   ├── MemoryRetrievalRunEntity.java
│   ├── ScoreBreakdownEnvelope.java
│   └── MemoryVectorEntity.java
├── repository/
│   ├── DenseMemoryQuery.java
│   ├── KnowledgeFactRetrievalQuery.java
│   ├── LexicalMemoryQuery.java
│   ├── MemoryItemRepository.java
│   ├── MemoryRetrievalFeedbackRepository.java
│   ├── MemoryRetrievalResultRepository.java
│   ├── MemoryRetrievalRunRepository.java
│   └── MemoryVectorRepository.java
└── service/
    ├── ChatMemoryContextAdapter.java
    ├── DenseMemoryRetriever.java
    ├── FactMemoryRetriever.java
    ├── GraphMemoryRetriever.java
    ├── LexicalMemoryRetriever.java
    ├── LlmMemoryQueryRewriter.java
    ├── LlmMemoryReranker.java
    ├── MemoryCandidateFusion.java
    ├── MemoryContextRenderer.java
    ├── MemoryContextSelector.java
    ├── MemoryContextService.java
    ├── MemoryItemFeedbackService.java
    ├── MemoryProjectionWriter.java
    ├── MemoryReembeddingJob.java
    ├── MemoryReembeddingService.java
    ├── MemoryQueryAnalyzer.java
    ├── MemoryQueryPreparer.java
    ├── MemoryQueryRewriter.java
    ├── MemoryReranker.java
    ├── MemoryRetrievalAuditWriter.java
    ├── MemoryRetrievalRetentionJob.java
    ├── MemoryRetriever.java
    └── MemoryShadowRunner.java
```

Core contracts, fixed for all tasks:

```java
public enum ConsumerPolicy {
    CHAT_AMBIENT, MORNING_BRIEFING, WEEKLY_MEMOIR, PREDICTION_EVIDENCE
}

public enum QueryMode { NO_MEMORY_NEEDED, SELF_CONTAINED, CONTEXT_DEPENDENT }
public enum RetrievalServingMode { OLD, SHADOW, NEW }

public record MemoryRequest(
        UUID userId,
        ConsumerPolicy consumerPolicy,
        String currentQuery,
        List<CompanionLlm.Turn> shortConversationHistory,
        LocalDate asOf,
        int maxTokenBudget,
        UUID conversationId,
        boolean deep) {}

public record PreparedMemoryQuery(
        QueryMode mode,
        String rawQuery,
        String denseQuery,
        Optional<LocalDate> from,
        Optional<LocalDate> to) {}

public record RetrievalInput(
        MemoryRequest request,
        PreparedMemoryQuery query,
        String embeddingVersion,
        int candidateLimit) {}

public record MemoryCandidate(
        String retriever,
        String candidateKind,
        UUID stableId,
        UUID memoryItemId,
        UUID sourceId,
        String sourceKind,
        String label,
        String content,
        LocalDate occurredOn,
        double localScore,
        boolean pinned,
        boolean conflicting,
        double salience) {}

public interface MemoryRetriever {
    String name();
    List<MemoryCandidate> retrieve(RetrievalInput input);
}

public record ScoreBreakdown(
        double rrf,
        double temporal,
        double salience,
        double sourceReliability,
        double pinned,
        double recency,
        double finalScore) {}

public record MemoryContextItem(
        UUID retrievalResultId,
        UUID memoryItemId,
        UUID sourceId,
        String sourceKind,
        String label,
        String content,
        LocalDate occurredOn,
        String indicator,
        ScoreBreakdown score) {}

public record MemoryContext(
        List<MemoryContextItem> items,
        String promptBlock,
        List<RefsEnvelope.Ref> refs,
        UUID traceId) {
    public static final MemoryContext EMPTY = new MemoryContext(List.of(), "", List.of(), null);
}
```

`memoryItemId` is nullable for fact/graph candidates; `retrievalResultId` is present only after the
audit writer persists selected candidates. Java annotations use `@Nullable` only if the repository
already has one standard annotation available; otherwise the records document nullability in
Javadoc and tests.

---

### Task 1: Canonical schema and persistence model (`mezo-6dii.1`)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609041020_mezo-6dii.1_memory_platform.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/entity/MemoryItemEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/entity/MemoryVectorEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/entity/MemoryRetrievalRunEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/entity/MemoryRetrievalResultEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/entity/MemoryRetrievalFeedbackEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/entity/MemoryProvenanceEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/entity/ScoreBreakdownEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryItemRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryVectorRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryRetrievalRunRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryRetrievalResultRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryRetrievalFeedbackRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/KnowledgeFactEntity.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MemoryItemPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryPlatformPersistenceIT.java`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: existing `OwnedEntity`, `EmbeddingPort.DIMENSIONS`, `memory_embedding`,
  `knowledge_fact`, `app_user`.
- Produces: persisted canonical items/vectors/audit rows and the repositories used by every later
  task.

- [x] **Step 1: Create the failing PostgreSQL persistence test**

Write `MemoryPlatformPersistenceIT` extending `AbstractIntegrationTest` with `@Transactional`.
The test must prove: all JSON/array fields round-trip; two vector generations coexist for one item;
duplicate `(item, version)` fails; a B-user repository lookup returns empty; and selected results
cascade from a physically purged audit run. The migration's idempotent `insert … select … on
conflict do nothing` backfill is reviewed through its post-migration count/invariant SQL: every live
legacy row has exactly one matching item and ready `gemini-embedding-001-768-v1` vector.

```java
@Test
void testPersist_shouldKeepTwoVectorGenerations_whenVersionsDiffer() {
    UUID owner = userPopulator.createUser().getId();
    MemoryItemEntity item = memoryItemPopulator.item(owner, "journal_entry", UUID.randomUUID(),
            "Futás után jobban aludtam", LocalDate.of(2026, 8, 29));

    memoryItemPopulator.vector(item, "gemini-embedding-001-768-v1", axisVector(0));
    memoryItemPopulator.vector(item, "gemini-embedding-001-768-v2", axisVector(1));

    assertThat(memoryVectorRepository.findByCreatedByAndMemoryItemIdOrderByEmbeddingVersion(owner, item.getId()))
            .extracting(MemoryVectorEntity::getEmbeddingVersion)
            .containsExactly("gemini-embedding-001-768-v1", "gemini-embedding-001-768-v2");
}
```

- [x] **Step 2: Run the test and confirm the schema is missing**

Run:

```bash
cd backend
./mvnw clean test -Dtest=MemoryPlatformPersistenceIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL because `memory_item`, `memory_vector` and audit entities/tables do not exist.

- [x] **Step 3: Add the migration and register it**

The migration must create `pg_trgm`, then these tables and constraints:

```sql
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists pgcrypto;

create table memory_item (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    source_kind varchar(32) not null,
    source_id uuid not null,
    title text,
    content text not null,
    search_text text not null,
    occurred_on date not null,
    content_hash char(64) not null,
    schema_version integer not null,
    topics text[] not null default '{}',
    people text[] not null default '{}',
    salience numeric(4,3) not null default 0.500,
    valid_from date,
    valid_to date,
    state varchar(16) not null default 'active',
    superseded_by uuid,
    provenance jsonb not null default '{}',
    search_vector tsvector generated always as
        (to_tsvector('simple', coalesce(search_text, ''))) stored,
    constraint pk_memory_item_id primary key (id),
    constraint uq_memory_item_id_created_by unique (id, created_by),
    constraint uq_memory_item_owner_source unique (created_by, source_kind, source_id),
    constraint fk_memory_item_created_by_app_user_id foreign key (created_by)
        references app_user (id) on delete cascade,
    constraint fk_memory_item_superseded_by_memory_item_id foreign key (superseded_by)
        references memory_item (id) on delete set null,
    constraint ck_memory_item_state check (state in ('active', 'suppressed', 'superseded')),
    constraint ck_memory_item_salience check (salience between 0 and 1),
    constraint ck_memory_item_validity check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table memory_vector (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    memory_item_id uuid not null,
    embedding_version varchar(80) not null,
    provider varchar(32) not null,
    model varchar(120) not null,
    dimensions smallint not null,
    embedding vector(768),
    embedded_content_hash char(64) not null,
    status varchar(16) not null,
    failure_code varchar(100),
    constraint pk_memory_vector_id primary key (id),
    constraint uq_memory_vector_item_version unique (memory_item_id, embedding_version),
    constraint fk_memory_vector_item_owner foreign key (memory_item_id, created_by)
        references memory_item (id, created_by) on delete cascade,
    constraint ck_memory_vector_dimensions check (dimensions = 768),
    constraint ck_memory_vector_status check (status in ('pending', 'ready', 'failed')),
    constraint ck_memory_vector_ready_embedding check
        (status <> 'ready' or embedding is not null)
);
```

Also create `memory_retrieval_run`, `memory_retrieval_result`, and
`memory_retrieval_feedback`. Each carries `created_by`. Run stores `consumer_policy`, `query_mode`,
`raw_query`, nullable `rewritten_query`, `embedding_version`, `serving_mode`, `duration_ms`,
`retriever_trace jsonb`, nullable `error_code`, and unique `trace_id`. Result stores
`candidate_kind`, `candidate_ref_id`, nullable `memory_item_id`, `rank`, `selected`,
`content_snapshot`, `occurred_on`, and `score_breakdown jsonb`. Feedback has one unique active row
per `(created_by, result_id)` and `action in ('useful','irrelevant','suppress')`. Composite
owner-aware FKs connect run→result→feedback. `on delete cascade` is allowed for audit retention.

Add owner-led B-tree indexes, a GIN index on `search_vector`, a GIN trigram index on `search_text`,
and HNSW on `memory_vector.embedding vector_cosine_ops` with a partial predicate for ready live
rows. Backfill one `memory_item` and one ready legacy vector per live `memory_embedding` row using
`encode(digest(content, 'sha256'), 'hex')`; enable `pgcrypto` if not already present. Do not alter
or delete `memory_embedding`. Use the legacy row ID as `memory_item.id`, set `search_text` to
`lower(unaccent(content))`, and name the copied generation `gemini-embedding-001-768-v1`. End the
migration with a `DO` block that raises if a live legacy row has no matching item or if a migrated
item has no ready v1 vector; the invariant queries are:

```sql
select m.id from memory_embedding m
left join memory_item i on i.id = m.id and i.created_by = m.created_by
where m.is_deleted = false and i.id is null;

select i.id from memory_item i
left join memory_vector v on v.memory_item_id = i.id
  and v.embedding_version = 'gemini-embedding-001-768-v1' and v.status = 'ready'
where i.is_deleted = false and v.id is null;
```

Extend `knowledge_fact` additively with `pinned`, `valid_from`, `valid_to`, `superseded_by`,
`conflicts_with` and `provenance jsonb`; both relationship columns are self-FKs with
`on delete set null`. Defaults must preserve current prompt behavior. `FactMemoryRetriever` marks a
candidate conflicting when `conflicts_with` is non-null and returns both owned active sides when
both remain valid; no service silently chooses a winner.

- [x] **Step 4: Add constraint-mirroring entities and repositories**

Entities extend `OwnedEntity`, mirror lengths/check domains with validation, map JSON through typed
records and arrays through Hibernate array support. `MemoryItemEntity` adds `@UpdateTimestamp` for
`updated_at`; it must not map generated `search_vector`. Repositories expose only owner-scoped
business finders, for example:

```java
Optional<MemoryItemEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
Optional<MemoryItemEntity> findByCreatedByAndSourceKindAndSourceId(
        UUID createdBy, String sourceKind, UUID sourceId);
List<MemoryVectorEntity> findByCreatedByAndMemoryItemIdOrderByEmbeddingVersion(
        UUID createdBy, UUID memoryItemId);
Optional<MemoryVectorEntity> findByCreatedByAndMemoryItemIdAndEmbeddingVersionAndStatusAndDeletedFalse(
        UUID createdBy, UUID memoryItemId, String embeddingVersion, String status);
```

- [x] **Step 5: Add test data/reset support and run the focused test**

Add all five tables before `memory_embedding` in `ResetDatabase`'s TRUNCATE statement. The
`MemoryItemPopulator` persists valid items, vectors, runs and results with `saveAndFlush` and exposes
the existing 768-dimensional axis-vector helper rather than duplicating vector math.

Run the Step 2 command. Expected: PASS.

- [x] **Step 6: Update living docs, validate and commit**

Update Companion §§3–4, §8 and §10; generate CODEMAP and run:

```bash
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs
cd backend
./mvnw clean test -Dtest=MemoryPlatformPersistenceIT -Dmezo.test.use-testcontainers=true
```

Commit:

```bash
git add backend docs
git commit -m "feat(memory): add canonical memory platform schema (mezo-6dii.1)"
```

---

### Task 2: Dual-write projection and vector generations (`mezo-6dii.2`)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/config/MemoryPlatformProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryProjectionWriter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryReembeddingService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryReembeddingJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java`
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryProjectionWriterIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryReembeddingIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriterIT.java`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: Task 1 repositories/entities, current `MemoryEmbeddingWriter` source-specific methods,
  `EmbeddingPort`.
- Produces: `MemoryProjectionWriter.upsert(...)`, `suppress(...)`, and an explicit serving vector
  generation for dense retrieval.

```java
public record ProjectionCommand(
        UUID userId, String sourceKind, UUID sourceId, String title, String content,
        LocalDate occurredOn, List<String> topics, List<String> people,
        double salience, MemoryProvenanceEnvelope provenance) {}

@Transactional
public MemoryItemEntity upsert(ProjectionCommand command, float[] embedding) { }

@Transactional
public void suppress(UUID userId, String sourceKind, UUID sourceId) { }

public ReembeddingResult reembedMissing(UUID userId, String targetVersion, int batchSize) { }
```

- [x] **Step 1: Write failing dual-write lifecycle tests**

For chat turn, daily/weekly/monthly summary, journal, decision, gratitude, reflection, activity note
and check-in note, assert that the existing writer produces both the unchanged `memory_embedding`
row and one active canonical item with a ready serving-version vector. Cover update-in-place,
content-hash change, same-content no-op, soft-delete/suppress and revive.

```java
assertThat(memoryItemRepository.findByCreatedByAndSourceKindAndSourceId(owner, kind, refId))
        .get().extracting(MemoryItemEntity::getContentHash).isEqualTo(sha256(expectedContent));
assertThat(memoryVectorRepository
        .findByCreatedByAndMemoryItemIdAndEmbeddingVersionAndStatusAndDeletedFalse(
                owner, itemId, "gemini-embedding-001-768-v1", "ready"))
        .isPresent();
```

- [x] **Step 2: Run the tests and confirm the projection is absent**

```bash
cd backend
./mvnw clean test -Dtest=MemoryEmbeddingWriterIT,MemoryProjectionWriterIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL because current writes touch only `memory_embedding`.

- [x] **Step 3: Bind versioned projection configuration**

Add `mezo.companion.memory-platform` with explicit commented defaults and this record shape:

```java
@Validated
@ConfigurationProperties(prefix = "mezo.companion.memory-platform")
public record MemoryPlatformProperties(
        @NotBlank String servingEmbeddingVersion,
        @NotBlank String embeddingProvider,
        @NotBlank String embeddingModel,
        @Min(1) @Max(10) int schemaVersion,
        @NotNull Retrieval serving,
        @NotNull Reembedding reembedding,
        @NotNull Audit audit) {
    public record Retrieval(@Min(1) @Max(100) int candidateLimit,
                            @Min(60) @Max(6000) int chatMaxTokens,
                            @Min(1) @Max(2000) int itemMaxChars) {}
    public record Reembedding(boolean enabled,
                              @NotBlank String targetVersion,
                              @Min(1) @Max(500) int batchSize,
                              @NotBlank String cron) {}
    public record Audit(@Min(1) @Max(365) int retentionDays, @NotBlank String retentionCron) {}
}
```

Use defaults `gemini-embedding-001-768-v1`, `google`, existing embedding model, schema version
`1`, candidate limit `30`, chat budget `1200`, item cap `600`, reembedding disabled with target
version `gemini-embedding-001-768-v1`, batch size `100` and cron `0 10 4 * * *`, retention `30`
days and cron `0 50 3 * * *`.

- [x] **Step 4: Implement idempotent canonical projection writes**

`MemoryProjectionWriter` computes lowercase accent-folded `searchText` with the existing
`ToolText.fold`, SHA-256 hex with `MessageDigest`, and deterministic defaults (`topics=[]`,
`people=[]`, `salience=0.5`). SQL backfill uses `lower(unaccent(content))` for the same normalized
search shape. The writer revives an existing item rather than inserting over the unique
source key. It writes or updates only the configured vector generation; identical content hash plus
ready vector is a no-op.

Keep current `MemoryEmbeddingWriter` behavior byte-for-byte, then call the projection writer with
the already-produced vector. A failure in the new projection must be logged and leave OLD serving
available; do not make existing source writes fail during `OLD`/`SHADOW` rollout.

- [x] **Step 5: Implement and test resumable parallel re-embedding**

`MemoryReembeddingService` selects at most `batchSize` active items whose target-version vector is
absent, failed or has a stale `embedded_content_hash`; it creates/updates `pending`, embeds one
document batch, then writes each row `ready`. A provider failure marks affected rows `failed` with
a stable error code; the next run retries them. `MemoryReembeddingJob` is bean-gated by the explicit
reembedding switch, fans out through `UserFanOut`, and never changes `servingEmbeddingVersion`.
`MemoryReembeddingIT` proves interrupted batches resume, a ready matching hash is skipped, a changed
hash is refreshed, and generation v1 stays readable while v2 is incomplete.

- [x] **Step 6: Run lifecycle and regression tests**

Run the Step 2 command plus:

```bash
./mvnw clean test -Dtest=AmbientRecallEvalIT,NoteVectorLifecycleIT,TurnEmbeddingListenerIT,MemoryReembeddingIT -Dmezo.test.use-testcontainers=true
```

Expected: PASS; the frozen OLD eval output is unchanged.

- [x] **Step 7: Update docs and commit**

Update Companion §§3–4 and §10, regenerate CODEMAP, lint docs, then commit:

```bash
git add backend docs
git commit -m "feat(memory): dual-write versioned memory projections (mezo-6dii.2)"
```

---

### Task 3: Adaptive query preparation (`mezo-6dii.3`)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/QueryMode.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/MemoryRequest.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/PreparedMemoryQuery.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryQueryAnalyzer.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryQueryPreparer.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryQueryRewriter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryQueryRewriter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryQueryAnalyzerTest.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryQueryPreparerIT.java`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: `CompanionLlm`, `CompanionLlm.Turn`, `MemoryRequest`.
- Produces: `PreparedMemoryQuery`; no retrieval or persistence.

```java
public interface MemoryQueryRewriter {
    String rewrite(String currentQuery, List<CompanionLlm.Turn> boundedHistory);
}

public PreparedMemoryQuery prepare(MemoryRequest request);
```

- [ ] **Step 1: Write the deterministic routing table test**

Use a parameterized pure unit test with Hungarian cases:

```java
static Stream<Arguments> modes() {
    return Stream.of(
        arguments("köszönöm", NO_MEMORY_NEEDED),
        arguments("szia", NO_MEMORY_NEEDED),
        arguments("Mikor futottam utoljára 10 kilométert?", SELF_CONTAINED),
        arguments("Miért volt gyenge a keddi futásom?", SELF_CONTAINED),
        arguments("És előtte hogy aludtam?", CONTEXT_DEPENDENT),
        arguments("Mi történt utána?", CONTEXT_DEPENDENT));
}
```

Also assert blank history downgrades a context-dependent form to `SELF_CONTAINED`, and explicit ISO
dates populate `from/to` without an LLM call.

- [ ] **Step 2: Run the unit test and confirm the analyzer is absent**

```bash
cd backend
./mvnw clean test -Dtest=MemoryQueryAnalyzerTest
```

Expected: FAIL at compilation because the query-preparation types do not exist.

- [ ] **Step 3: Implement conservative deterministic analysis**

`NO_MEMORY_NEEDED` is limited to a closed, accent-folded set of greetings, thanks and explicit
general/meta phrases. `CONTEXT_DEPENDENT` requires non-empty history plus an accent-folded
referential marker (`előtte`, `utána`, `akkor`, `arról`, `azzal`, `ehhez`, `vele`, `ő`, `az`) or a
leading continuation (`és`, `de`, `viszont`) in a query under 160 characters. Everything else is
`SELF_CONTAINED`. Keep constants package-private so the table test pins changes.

- [ ] **Step 4: Write and run the failing rewrite/fallback integration tests**

Add a fake marker `[fake-memory-rewrite:<text>]` to `FakeCompanionLlm`. Assert the preparer passes at
most the latest six nonblank turns, caps every history item at 500 characters, returns the scripted
standalone query, retains raw query separately, and falls back on `[fake-fail]`, blank output or
output over 500 characters.

```bash
./mvnw clean test -Dtest=MemoryQueryPreparerIT -Dmezo.test.use-testcontainers=true
```

Expected before implementation: FAIL because `LlmMemoryQueryRewriter` is absent.

- [ ] **Step 5: Implement the bounded rewrite adapter**

Use the existing cheap `CompanionLlm.complete(system, history, currentQuery, List.of(), Map.of())`
port. The system prompt demands one standalone Hungarian search query and no explanation. Do not
add a new provider SDK or Spring AI dependency. `MemoryQueryPreparer` catches runtime failures and
returns `denseQuery=rawQuery`.

- [ ] **Step 6: Verify, document and commit**

Run both tests, update Companion §§3, §8 and §10, regenerate CODEMAP/lint, then commit:

```bash
git add backend docs
git commit -m "feat(memory): prepare contextual retrieval queries (mezo-6dii.3)"
```

---

### Task 4: Four hybrid retrievers (`mezo-6dii.4`)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/ConsumerPolicy.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/RetrievalInput.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/MemoryCandidate.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryRetriever.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/DenseMemoryQuery.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/LexicalMemoryQuery.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/KnowledgeFactRetrievalQuery.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/DenseMemoryRetriever.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LexicalMemoryRetriever.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/FactMemoryRetriever.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/GraphMemoryRetriever.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/HybridMemoryRetrieverIT.java`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: Tasks 1–3 data/query contracts, `EmbeddingPort`, `GraphTraversalService`.
- Produces: four `MemoryRetriever` beans named `dense`, `lexical`, `facts`, `graph`.

- [ ] **Step 1: Write the failing owner/state/asOf retrieval matrix**

Seed two users with exact-term, semantic-only, old salient, suppressed, superseded, expired,
future-dated and cross-user distractors. Assert:

```java
assertThat(dense.retrieve(input(ownerA))).extracting(MemoryCandidate::sourceId)
        .contains(semanticId).doesNotContain(ownerBId, suppressedId, futureId);
assertThat(lexical.retrieve(input(ownerA))).extracting(MemoryCandidate::sourceId)
        .containsExactly(exactNameId);
assertThat(facts.retrieve(input(ownerA))).extracting(MemoryCandidate::sourceId)
        .contains(pinnedFactId, queryFactId).doesNotContain(supersededFactId);
assertThat(graph.retrieve(input(ownerA))).allMatch(c -> c.retriever().equals("graph"));
```

- [ ] **Step 2: Run the test and confirm retriever classes are absent**

```bash
cd backend
./mvnw clean test -Dtest=HybridMemoryRetrieverIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL at compilation.

- [ ] **Step 3: Implement dense and lexical JDBC queries**

Dense SQL joins ready live `memory_vector` to active live `memory_item`, filters owner, serving
version, validity and `occurred_on <= asOf`, excludes current-conversation chat sources, orders by
`embedding <=> cast(:queryVector as vector)`, and limits before mapping.

Lexical SQL receives `ToolText.fold(rawQuery)`, then ranks:

```sql
ts_rank_cd(i.search_vector, websearch_to_tsquery('simple', :query))
  + greatest(similarity(i.search_text, :query), word_similarity(:query, i.search_text)) * 0.25
```

It uses the same owner/state/validity/asOf predicates and orders by score desc, occurred_on desc,
id. Empty normalized queries return immediately without SQL.

- [ ] **Step 4: Implement fact and graph adapters**

`KnowledgeFactRetrievalQuery` unions pinned active facts with query-matching active facts, excludes
expired/superseded rows, ranks pinned first then FTS/trigram relevance, and caps the union.
`GraphMemoryRetriever` reuses `GraphTraversalService.seedsFor` and `neighborhood`; each edge becomes
one candidate with a stable edge ID, endpoint-labelled content and weight as local score. Empty
seeds return empty without traversal SQL.

- [ ] **Step 5: Make failure isolation explicit at the retriever boundary**

Retrievers throw their own failures; they do not silently return empty on exceptions. Task 5's
coordinator owns catch/log/audit so an empty legitimate result remains distinguishable from a
failed retriever. Preserve JDBC savepoint behavior in dense/lexical/fact query classes using the
existing `MemoryEmbeddingAnnQuery`/`GraphTraversalQuery` pattern.

- [ ] **Step 6: Verify indexes and tests**

Run the Step 2 command and use `EXPLAIN (ANALYZE, BUFFERS)` inside the IT for a seeded query only as
diagnostic output; assertions cover results and isolation, not planner cost guesses. Expected:
PASS.

- [ ] **Step 7: Update docs and commit**

Update Companion §§3, §5, §8 and §10, regenerate CODEMAP/lint, then commit:

```bash
git add backend docs
git commit -m "feat(memory): add hybrid owner-scoped retrievers (mezo-6dii.4)"
```

---

### Task 5: Fusion, selection, reranking and audit (`mezo-6dii.5`)

**Files:**
- Create: all remaining `memory/dto` records from the file map
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryCandidateFusion.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryContextSelector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryContextRenderer.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryReranker.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryReranker.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryRetrievalAuditWriter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryRetrievalRetentionJob.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryContextService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/config/MemoryPlatformProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryCandidateFusionTest.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryContextSelectorTest.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryContextServiceIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryRetrievalRetentionIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryPlatformPropertiesIT.java`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: four `MemoryRetriever` beans and query preparation.
- Produces: `MemoryContextService.retrieve(MemoryRequest)` and complete explainable audit rows.

- [ ] **Step 1: Write failing pure RRF and selection tests**

Pin weighted RRF with constant 60 and stable-ID dedupe:

```java
double expected = 1.0 / 61.0 + 1.0 / 62.0;
assertThat(fused.getFirst().score().rrf()).isCloseTo(expected, within(1e-12));
```

Assert deterministic tie order (`finalScore desc`, `occurredOn desc`, `stableId`), mild recency
cannot beat a materially stronger older exact match, near-duplicates collapse, at most two items
from one source conversation survive, conflicts survive as a pair, and the rendered block never
exceeds `maxTokenBudget` under the existing conservative three-chars-per-token estimate.

- [ ] **Step 2: Run pure tests and confirm services are absent**

```bash
cd backend
./mvnw clean test -Dtest=MemoryCandidateFusionTest,MemoryContextSelectorTest
```

Expected: FAIL at compilation.

- [ ] **Step 3: Implement deterministic fusion and bounded modifiers**

Deduplicate on `(candidateKind, stableId)`. Sum `retrieverWeight / (60 + oneBasedRank)` and add
bounded modifiers: pinned `+0.005`, source reliability up to `+0.004`, temporal fit up to `+0.004`,
salience in `[-0.002,+0.002]`, recency in `[0,+0.003]`. All values bind from validated config;
defaults are identical to these numbers. Store every component in `ScoreBreakdown`.

Extend `MemoryPlatformProperties` with validated `Fusion`, `Execution`, `Reranker` and `Indicators`
records. Defaults: RRF constant 60; retriever weights 1.0 each; 200 ms retriever timeout; reranker
disabled, uncertainty delta 0.002, maximum 20 candidates; `old-after-days=365`. Add
`MemoryPlatformPropertiesIT` startup-failure cases for zero/negative bounds and one valid binding
case. The renderer labels weekly/monthly sources `summary`, active items older than 365 days `old`,
and unresolved fact conflicts `conflict`.

- [ ] **Step 4: Implement uncertainty and optional reranking**

Uncertain means any of: top-two final-score delta below configured `0.002`; dense and lexical top
stable IDs disagree; a selected candidate is conflicting; policy is `WEEKLY_MEMOIR`; or
`MemoryRequest.deep()` is true. `CHAT_AMBIENT` allows reranking only for these conditions and
only when `reranker-enabled=true` (default false).

`LlmMemoryReranker` sends only candidate IDs and capped content to `completeSmart`, accepts a JSON
array containing only supplied IDs, drops duplicates/unknown IDs, appends omitted candidates in
deterministic fused order, and returns fused order on any failure. Add a fake marker to cover valid,
unknown-ID, malformed and failure responses.

- [ ] **Step 5: Write failing orchestration/failure/audit integration tests**

Use real retriever beans and fake embedding/LLM. `MemoryContextServiceIT` deliberately extends
`AbstractIntegrationTest` without `@Transactional`: retrievers execute on worker connections and
must see committed populator fixtures; shared `ResetDatabase` still isolates every test. Cover `NO_MEMORY_NEEDED` no-call behavior,
successful parallel retrieval, one failed retriever with three successful peers, all retrievers
failed → empty context, selected result IDs present, raw/rewritten query fields, timing/count/error
details, serving version and score JSON.

```bash
./mvnw clean test -Dtest=MemoryContextServiceIT -Dmezo.test.use-testcontainers=true
```

Expected before implementation: FAIL because the coordinator/audit writer is absent.

- [ ] **Step 6: Implement concurrent orchestration and `REQUIRES_NEW` audit writes**

Use Boot's named `applicationTaskExecutor` through `AsyncTaskExecutor.submitCompletable`, one future
per retriever. Apply a configured 200 ms per-retriever timeout, catch each future independently and
record its error code. Do not share a JDBC connection across worker threads. `MemoryRetrievalAuditWriter`
persists run/results in a public `@Transactional(propagation = REQUIRES_NEW)` method on a separate
bean so traces survive a later chat-model failure and selected result IDs can be returned.

- [ ] **Step 7: Implement rendering and retention**

Render one `[Hosszú távú memória]` block with complete capped content, label, occurred date and
explicit conflict/old/summary indicator. `MemoryRetrievalRetentionJob` uses `UserFanOut`, the
configured 03:50 cron and an explicit repository hard-delete of runs older than 30 days; cascade
removes result/feedback audit children. This physical deletion is the documented audit-retention
exception to normal domain soft deletion.

- [ ] **Step 8: Verify all paths and commit**

Run pure tests, service IT and retention IT; update Companion §§3–5, §8–10, regenerate CODEMAP/lint,
then commit:

```bash
git add backend docs
git commit -m "feat(memory): fuse select and audit memory context (mezo-6dii.5)"
```

---

### Task 6: Chat `OLD` / `SHADOW` / `NEW` rollout (`mezo-6dii.6`)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/RetrievalServingMode.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/ChatMemoryContextAdapter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryShadowRunner.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/RecalledMemoriesEnvelope.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/config/MemoryPlatformProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `api/feature/companion/companion.yml`
- Modify: `api/openapi.yml`
- Modify: `frontend/src/data/_client/api.gen.ts`
- Modify: `frontend/src/data/insights/chatApi.ts`
- Modify: `frontend/src/data/types.ts`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/ChatMemoryRolloutIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceAmbientRecallIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceIT.java`
- Modify: `frontend/src/data/insights/chatApi.test.ts`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: `MemoryContextService`, frozen `PromptMemoryAssembler`, current fact/graph assemblers.
- Produces: one `ChatMemoryPayload` used identically by sync and streaming chat.

```java
public record ChatMemoryPayload(
        String factsBlock,
        String memoriesBlock,
        String graphBlock,
        List<RefsEnvelope.Ref> refs,
        RecalledMemoriesEnvelope recalled) {}

public ChatMemoryPayload resolve(UUID userId, UUID conversationId, String query,
        List<CompanionLlm.Turn> history, LocalDate today);
```

- [ ] **Step 1: Make the disclosure contract change first**

Add optional `retrievalRunId`, `retrievalResultId`, `memoryItemId` and `indicator` fields to
`RecalledMemory`. Keep all existing fields and meanings for OLD rows. Regenerate merged OpenAPI and
frontend types before backend implementation:

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

- [ ] **Step 2: Write failing three-mode chat integration tests**

`OLD` asserts the existing prompt and recalled envelope byte-for-byte. `SHADOW` asserts the same
served prompt/answer plus an eventually persisted shadow run. `NEW` asserts the unified block,
stable run/result IDs and no duplicate legacy fact/graph blocks. Add embedding failure, all-retriever
failure and B-user cases. Execute the same matrix through sync and SSE `done` responses.

- [ ] **Step 3: Run the focused tests before implementation**

```bash
cd backend
./mvnw clean test -Dtest=ChatMemoryRolloutIT,ChatServiceAmbientRecallIT,ChatStreamServiceIT -Dmezo.test.use-testcontainers=true
```

Expected: new rollout tests FAIL; existing OLD tests PASS.

- [ ] **Step 4: Implement the rollout adapter without changing OLD**

Move `loadWindow` before retrieval in both sync and streamed preparation. The adapter behavior is:

```text
OLD    = current facts + PromptMemoryAssembler + GraphPromptAssembler; return exactly current data
SHADOW = return OLD immediately; submit immutable MemoryRequest to MemoryShadowRunner
NEW    = MemoryContextService; factsBlock="", graphBlock="", memoriesBlock=context.promptBlock
```

`MemoryShadowRunner` runs on `applicationTaskExecutor`, catches/logs every exception and never
mutates the serving payload. NEW catches total platform failure and falls back to OLD for beta;
the run records the fallback. Keep new-pattern acknowledgement, character and profile blocks in
their existing positions.

- [ ] **Step 5: Preserve sync/stream persistence parity**

Map selected `MemoryContextItem`s into `RecalledMemoriesEnvelope.Item`, persist the same envelope on
assistant messages in both paths and map its optional IDs to OpenAPI. Existing pre-platform JSONB
without the new keys must continue deserializing.

- [ ] **Step 6: Run backend and frontend contract tests**

```bash
cd backend
./mvnw clean test -Dtest=ChatMemoryRolloutIT,ChatServiceAmbientRecallIT,ChatStreamServiceIT,CompanionApiIT -Dmezo.test.use-testcontainers=true
cd ../frontend
pnpm test -- chatApi.test.ts
pnpm build
```

Expected: PASS in all three configured modes.

- [ ] **Step 7: Document and commit**

Update Companion §§2–5, §8–10, regenerate CODEMAP/lint, then commit all contract artifacts:

```bash
git add api backend frontend docs
git commit -m "feat(memory): roll shared retrieval through chat modes (mezo-6dii.6)"
```

---

### Task 7: Item feedback, suppression and beta controls (`mezo-6dii.7`)

**Files:**
- Create: `api/feature/memory-retrieval/memory-retrieval.yml`
- Modify: `api/generate/merge.yml`
- Modify: `api/openapi.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/controller/MemoryRetrievalController.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryItemFeedbackService.java`
- Modify: Task 1 feedback repositories/entities as required by generated DTO mapping
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryRetrievalFeedbackApiIT.java`
- Modify: `frontend/src/data/_client/api.gen.ts`
- Create: `frontend/src/data/insights/memoryFeedbackApi.ts`
- Create: `frontend/src/data/insights/memoryFeedbackHooks.ts`
- Modify: `frontend/src/data/hooks.ts`
- Modify: `frontend/src/features/insights/components/RecalledMemoriesRow.tsx`
- Modify: `frontend/src/features/insights/components/RecalledMemoriesRow.test.tsx`
- Modify: `frontend/src/features/insights/components/ChatMessage.tsx`
- Modify: `frontend/src/features/insights/pages/ChatPage.tsx`
- Modify: `frontend/src/test/msw/handlers.ts`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: selected retrieval result IDs from Task 6.
- Produces: batch-read + upsert feedback API and immediate canonical-item suppression.

- [ ] **Step 1: Author and generate the contract first**

Create protected operations:

```text
GET /api/companion/memory/retrieval-feedback?resultIds=<uuid,...>
PUT /api/companion/memory/retrieval/{runId}/result/{resultId}/feedback
```

The PUT body has required string `action` with regex `^(useful|irrelevant|suppress)$`. Responses
carry run ID, result ID, action and updatedAt. GET accepts 1–100 UUIDs and returns only caller-owned
rows. Register the fragment, merge OpenAPI and regenerate frontend types.

- [ ] **Step 2: Write failing API ownership and state-transition tests**

Cover unauthenticated 401, owned useful/irrelevant upsert, idempotent repeat, switch action, foreign
run/result 404, mismatched run/result 404, suppress of a memory candidate, suppress of fact/graph
candidate 400, and subsequent NEW retrieval excluding the suppressed item.

```bash
cd backend
./mvnw clean test -Dtest=MemoryRetrievalFeedbackApiIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL because the generated API/controller does not exist.

- [ ] **Step 3: Implement transactional feedback and suppression**

The controller injects `CurrentUserId`. Service lookup uses `(resultId, runId, createdBy)` in one
query. `useful` and `irrelevant` upsert the active feedback row. `suppress` additionally requires a
non-null memory item owned by the same user, sets its state to `suppressed`, and marks every serving
vector unavailable through the joined item state; no source-domain row is deleted. Publish no
automatic learning event.

- [ ] **Step 4: Write failing frontend hook/component tests**

Test one batch GET per visible result-ID set, optimistic action update with rollback, source/date and
indicator display, useful/irrelevant buttons, and two-tap confirmation for **Ne használd többé**.
OLD recalled cards without retrieval IDs remain display-only. Change each card's outer element from
`button` to `article` so feedback buttons are never nested inside another button.

- [ ] **Step 5: Implement the typed data path and UI**

Create API functions typed from generated schemas, a `useMemoryRetrievalFeedback(resultIds)` hook
using `useDualQuery`, and re-export it from `@/data/hooks`. `ChatPage` calls the hook once for the
whole rendered thread and passes a small handle through `ChatMessage` to `RecalledMemoriesRow`.
Mock mode keeps session-local optimistic state. Use the global mutation error toast; after suppress,
show a normal success toast and visually mark the card unavailable.

- [ ] **Step 6: Verify both frontend modes and backend API**

```bash
cd backend
./mvnw clean test -Dtest=MemoryRetrievalFeedbackApiIT -Dmezo.test.use-testcontainers=true
cd ../frontend
pnpm test -- RecalledMemoriesRow.test.tsx ChatPage.test.tsx memoryFeedbackHooks.test.tsx
VITE_USE_MOCK=true pnpm test -- RecalledMemoriesRow.test.tsx ChatPage.test.tsx memoryFeedbackHooks.test.tsx
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Document and commit**

Update Companion §§2, §4–5, §8 and §10, regenerate CODEMAP/lint, then commit:

```bash
git add api backend frontend docs
git commit -m "feat(memory): add item feedback and suppression (mezo-6dii.7)"
```

---

### Task 8: Synthetic Hungarian evaluation corpus (`mezo-6dii.8`)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/MemoryEvalCorpus.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/MemoryEvalMetrics.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/SyntheticMemoryCorpusGenerator.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/MemoryRetrievalDeterministicEvalIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/MemoryEvalMetricsTest.java`
- Create: `backend/src/test/resources/eval/memory/v1/personas.json`
- Create: `backend/src/test/resources/eval/memory/v1/development.json`
- Create: `backend/src/test/resources/eval/memory/v1/tuning.json`
- Create: `backend/src/test/resources/eval/memory/v1/holdout.json`
- Create: `backend/src/test/resources/eval/memory/v1/review.json`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: frozen OLD assembler and NEW `MemoryContextService`.
- Produces: deterministic corpus loader, metric calculator and CI regression report.

```java
public record EvalQuery(
        String id, String personaId, String scenarioId, String family,
        String query, List<CompanionLlm.Turn> history,
        Map<String, Integer> relevanceBySourceKey, boolean expectsEmpty) {}

public record EvalMetrics(
        double recallAt5, double ndcgAt5, double mrr,
        double contextPrecision, double emptyFalsePositiveRate,
        int ownershipLeaks) {}
```

- [ ] **Step 1: Write metric unit tests with hand-calculated examples**

Cover multiple relevant items, graded 0/1/2 nDCG, missing required item, reciprocal first hit,
empty selection, no-memory false positive and macro averaging. Include the hand calculation in test
comments and use `within(1e-9)` assertions.

- [ ] **Step 2: Run the metric test and confirm the calculator is absent**

```bash
cd backend
./mvnw clean test -Dtest=MemoryEvalMetricsTest
```

Expected: FAIL at compilation.

- [ ] **Step 3: Implement the deterministic generator and immutable corpus shape**

Use fixed seed `20260904L`. Generate coherent timelines before queries for exactly three persona IDs:
`rich`, `sparse`, `changing`. Every generated source has a stable key such as
`rich:journal:2026-05-14:01`. Query families are `paraphrase`, `follow_up`, `exact_value`,
`old_salient`, `near_negative`, `negation`, `superseded`, `empty`, and `ownership`.

Split by `scenarioId` at 20% development, 20% tuning, 60% holdout. The holdout contains at least
300 queries and at least 100 per persona. The generator fails if a scenario appears in two splits,
if a gold key is absent, if an ownership query lacks a foreign distractor, or if persona/family
minimums are missed.

- [ ] **Step 4: Generate the four JSON artifacts and perform the human label gate**

Run a test-main entry point that writes deterministic JSON only when
`-Dmezo.eval.write-corpus=true` is present:

```bash
cd backend
./mvnw clean test -Dtest=SyntheticMemoryCorpusGenerator -Dmezo.eval.write-corpus=true
```

Review every holdout query against its timeline without inspecting retrieval output. After the
review, run the approval entry point; it writes the real UTC date and derives the count/hash from
`holdout.json`, so review metadata cannot drift from the reviewed bytes:

```bash
./mvnw clean test -Dtest=SyntheticMemoryCorpusGenerator \
  -Dmezo.eval.approve-review=true \
  -Dmezo.eval.reviewer="Daniel Kuhne"
```

`review.json` maps exactly to
`ReviewMetadata(String corpusVersion, long generatorSeed, String reviewedBy, LocalDate reviewedAt,
int queryCount, String holdoutSha256, String status)`, with status `approved`. The deterministic
eval must refuse to run when review metadata, seed, count or SHA-256 does not match the corpus.

- [ ] **Step 5: Add the network-free OLD-vs-NEW regression runner**

Seed each persona through Java populators, use scripted fake vectors, run both retrieval paths,
map stable source keys to ranked outputs and calculate all metrics. Assert zero ownership leakage,
metric arithmetic, scenario split integrity and a small deterministic smoke floor; do not assert the
real semantic 85% gate against fake vector geometry.

- [ ] **Step 6: Verify reproducibility**

Run the generator twice and verify `git diff --exit-code` after the second run, then:

```bash
./mvnw clean test -Dtest=MemoryEvalMetricsTest,MemoryRetrievalDeterministicEvalIT -Dmezo.test.use-testcontainers=true
```

Expected: PASS with identical metrics and corpus bytes.

- [ ] **Step 7: Document and commit**

Update Companion §8 and §10 with corpus version, case families and honest limits; regenerate
CODEMAP/lint, then commit:

```bash
git add backend docs
git commit -m "test(memory): add synthetic Hungarian retrieval eval (mezo-6dii.8)"
```

---

### Task 9: Real Gemini release gate and report (`mezo-6dii.9`)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/MemoryRetrievalGeminiEvalIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/MemoryEvalReport.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/MemoryEvalGate.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/MemoryEvalGateTest.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryRetrievalAuditWriter.java`
- Modify: `docs/features/companion.md`
- Modify: `docs/infrastructure/local-dev-testing.md`

**Interfaces:**
- Consumes: approved `memory-v1` corpus, real `GeminiEmbeddingAdapter`, OLD and NEW retrieval paths,
  LLM/embedding usage audit.
- Produces: opt-in JSON report at `backend/target/memory-eval/memory-v1-report.json`; it never flips
  serving mode or enables another consumer.

- [ ] **Step 1: Write the pure release-gate test**

```java
EvalMetrics passing = new EvalMetrics(.85, .71, .76, .68, .04, 0);
EvalMetrics baseline = new EvalMetrics(.70, .62, .65, .55, .09, 0);
EvalBudget budget = new EvalBudget(new BigDecimal("5.00"), BigDecimal.ZERO);
assertThat(MemoryEvalGate.evaluate(passing, baseline, Duration.ofMillis(240), budget).passed())
        .isTrue();
```

Add one failing case per threshold, including exactly 84.99% recall, +9.99 percentage-point
precision, one ownership leak and 251 ms p95.

- [ ] **Step 2: Run the gate test and confirm the evaluator is absent**

```bash
cd backend
./mvnw clean test -Dtest=MemoryEvalGateTest
```

Expected: FAIL at compilation.

- [ ] **Step 3: Implement report and gate types**

The JSON report includes corpus version/hash, timestamp, git commit, provider/model/embedding
version, baseline and candidate metrics, deltas, per-persona and per-family metrics, p50/p95/p99,
embedding calls/characters/cost, reranker calls/tokens/cost, failed query IDs and one boolean per
hard gate. `MemoryEvalGate` owns the nested
`EvalBudget(BigDecimal maxEmbeddingUsd, BigDecimal maxRerankingUsd)` record used by the test above.
Cost budgets come from command-line properties and are printed, never hardcoded.

- [ ] **Step 4: Add the opt-in real-provider evaluation IT**

Annotate it `@Tag("eval")`; require `-Dmezo.memory.eval.real=true` and the real Gemini profile. Load
the approved holdout, embed its canonical items into a dedicated serving version
`gemini-embedding-001-memory-v1`, warm one query, then measure every query from before query embedding
until `MemoryContext` completion. Run OLD and NEW on identical data, disable rewrite/reranker for the
250 ms path, calculate metrics and write the report. The test fails when any hard gate fails.

- [ ] **Step 5: Run the documented release command**

```bash
cd backend
test -n "$GEMINI_API_KEY"
./mvnw clean test \
  -Dtest=MemoryRetrievalGeminiEvalIT \
  -Dgroups=eval \
  -Dmezo.memory.eval.real=true \
  -Dmezo.memory.eval.max-embedding-usd=5.00 \
  -Dmezo.memory.eval.max-reranking-usd=0.00 \
  -Dmezo.test.use-testcontainers=true
```

Expected: `MemoryRetrievalGeminiEvalIT` runs rather than skips, creates the JSON report and clearly
prints PASS/FAIL for every threshold. Never commit the API key or raw provider payloads.

- [ ] **Step 6: Inspect the report and make the promotion decision explicit**

Attach the JSON report to `mezo-6dii.9` and add a Beads note containing the corpus hash, candidate
metrics, baseline deltas, p95 and total cost. Passing the test does **not** change
`mezo.companion.memory-platform.serving-mode`; switching `SHADOW` to `NEW` is a separate explicit
configuration change after product-owner approval. Briefing/memoir/prediction issues are created
only after that decision.

- [ ] **Step 7: Run regression gates, document and commit**

```bash
cd backend
./mvnw clean test -Dtest=MemoryEvalGateTest,MemoryEvalMetricsTest,MemoryRetrievalDeterministicEvalIT -Dmezo.test.use-testcontainers=true
cd ..
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs
```

Update Companion §8–10 and local testing docs with the exact opt-in command and report location,
then commit:

```bash
git add backend docs
git commit -m "test(memory): add real Gemini retrieval release gate (mezo-6dii.9)"
```

## Final integration gate

After all nine PRs are CI-green and merged, run or verify the authoritative CI workflow containing:

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
cd .. && node scripts/lint-docs.mjs && node scripts/gen-codemap.mjs --check
```

Then run the real Gemini gate once from Task 9. Keep chat in `SHADOW` unless the report passes and
the product owner explicitly authorizes `NEW`. Do not start a briefing, memoir or prediction
integration from this plan.
