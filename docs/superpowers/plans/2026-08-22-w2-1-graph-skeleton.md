# W2.1 — Graph Tables + Skeleton + ADR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Postgres-native knowledge-graph skeleton (bd `mezo-b3pp.6`, spec §4.2/§6.1) —
`knowledge_node`/`knowledge_edge` tables, a `feature/companion/graph/` sub-package with entity/repo/
service/controller layers, the `mezo.feature.knowledge-graph.enabled` switch, the
`CompanionProperties.Graph` tuning record, and the ADR recording the Postgres-native decision — so
later slices (W2.2 promotion, W2.3 extraction, W2.4 traversal, W2.5 maintenance, W2.6 FE surface)
have a table + service + switch to build on.

**Architecture:** Two new Liquibase-managed tables mirror the existing `feature/journal` shape
(`OwnedEntity` + soft-delete + `@SQLRestriction`). `GraphService` owns node/edge CRUD including
UPSERT-by-`(created_by, source_kind, source_id)` (the idempotent promotion anchor W2.2 will call) —
that full CRUD surface lives in Java only. Over HTTP, this slice exposes exactly the two operations
the spec commits to now: list active nodes, archive a node (mirrors `GoalController`'s
`archiveGoal` idiom). No `GraphEdgeResponse` REST DTO is created yet — nothing consumes edges over
HTTP until W2.4/W2.6 — so the OpenAPI fragment defines `GraphNodeResponse` only; edges are tested at
the service/repository layer directly. Package: `feature/companion/graph/{entity,repository,service,
controller,mapper}`, gated end-to-end by `FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH`.

**Tech Stack:** Spring Boot, Liquibase (SQL changesets), Spring Data JPA/Hibernate, MapStruct,
openapi-generator (contract-first), JUnit 5 + AssertJ + Testcontainers ITs, ArchUnit.

## Global Constraints

- Contract-first: `api/feature/knowledge-graph/knowledge-graph.yml` written and merged into
  `api/openapi.yml` BEFORE any backend Java that references the generated types (spec §11).
- Every new owned domain table added to `ResetDatabase`'s TRUNCATE list in the same change that
  creates it (spec §11, `ResetDatabase.java` javadoc).
- `@Validated` config records only — no `@Value` anywhere (ArchUnit `no_spring_value_annotation`).
- Integration-first tests; new tables get a populator (`GraphPopulator`) mirroring `JournalPopulator`.
- Controllers implement the generated `<Tag>Api` interface, no hand-written `@RequestMapping`/`@Valid`.
- `feature.companion.graph` stays inside the `companion` ArchUnit slice (`feature.(*)..` matches one
  level after `feature.`) — no new cycle risk from this sub-package by construction.
- No LLM/embed calls in this slice (pure CRUD) — `LlmCallContextHolder` tagging does not apply here;
  it starts mattering in W2.2 (structurer) and W2.3 (extractor).
- No frontend work — W2.6 owns the FE surface.
- Docs: `docs/features/companion.md` updated in this same change (spec §11); run
  `node scripts/lint-docs.mjs` after.

---

### Task 1: ADR — Knowledge graph is Postgres-native

**Files:**
- Create: `docs/decisions/0031-knowledge-graph-postgres-native.md`

**Interfaces:** None (docs-only task).

- [ ] **Step 1: Write the ADR**

```markdown
# 0031 — Knowledge graph is Postgres-native

- **Status:** Accepted
- **Date:** 2026-08-22
- **Driver:** mezo-b3pp.6 (W2.1 Graph tables + skeleton + ADR)

## Context

Phase 5 W2 (design spec §4.2/§6.1, `docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`)
introduces a knowledge graph — nodes (patterns, preferences, goals, life events, seasons, insights)
connected by typed, weighted edges (triggers, precedes, supports, conflicts, relates-to) — to
represent that facts *chain* ("late eating hurts sleep" → "poor sleep hurts training"), not just
exist as a flat list. This needs: node/edge storage, a small-hop neighborhood traversal (W2.4,
≤2 hops from seed nodes), and periodic maintenance (decay/prune/reinforce, W2.5).

The system is single-user (`mezo` is a personal companion app, ADR 0001's k3s/ArgoCD self-managed
deployment), and the graph's expected scale is hundreds of nodes and low-thousands of edges over
years of use — not the millions-of-nodes regime graph databases are built for. Every other Phase 5
table (journal, decision, gratitude, feedback, period_summary) lives in the same Postgres instance
behind the same backup/consistency domain as the rest of the app's data.

## Decision

The knowledge graph is Postgres-native: `knowledge_node`/`knowledge_edge` as plain tables
(§4.2 DDL), neighborhood traversal via a recursive CTE (`GraphTraversalService`, W2.4) bounded to
`maxHops` (default 2) and ordered by edge weight. No graph database, no `pgRouting` extension.

## Consequences

- One backup/consistency domain — the graph never drifts out of sync with the tables it derives
  from (`pattern`, `knowledge_fact`, `goal`, `journal_entry`) because everything is one Postgres
  transaction away.
- No new infrastructure component to operate, monitor, or back up separately (k3s deployment stays
  as-is — no Neo4j/AGE StatefulSet, no second connection pool, no second migration tool).
- Traversal is bounded by design (`maxHops` 1..3) — a recursive CTE over a table with hundreds of
  rows and an indexed `(from_node_id)`/`(to_node_id)` pair stays fast without specialized graph
  indexing; this would not hold at graph-database scale, which is exactly the scale this app will
  never reach (single user).
- If usage ever crosses into the tens-of-thousands-of-nodes range (would require the app to serve
  many independent large-graph users, a different product), this decision would need revisiting —
  explicitly out of scope for a single-user companion.

## Alternatives considered

- **Neo4j:** purpose-built graph database with native traversal (Cypher). Rejected — a whole new
  deployment (StatefulSet, backup strategy, driver dependency, second data-consistency domain) for
  a graph that will hold hundreds of rows is infrastructure weight with no corresponding benefit at
  this scale.
- **Postgres AGE (Apache AGE graph extension):** graph queries inside Postgres via Cypher. Rejected
  — still a non-trivial extension to install/maintain on the k3s Postgres instance, and a recursive
  CTE already does everything a 2-hop bounded traversal over a small table needs; AGE's benefit
  (expressive graph query language) doesn't offset its operational cost here.
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/0031-knowledge-graph-postgres-native.md
git commit -m "docs(decisions): knowledge graph is Postgres-native (mezo-b3pp.6)"
```

---

### Task 2: Migration — knowledge_node + knowledge_edge tables

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608221600_mezo-b3pp.6_create_knowledge_graph.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)

**Interfaces:**
- Produces: tables `knowledge_node`, `knowledge_edge` (exact columns per spec §4.2, reproduced below)
  that Task 3's entities map onto.

- [ ] **Step 1: Write the migration SQL**

```sql
-- Phase 5 W2.1 (bd mezo-b3pp.6, spec §4.2/§6.1, ADR 0031): knowledge-graph skeleton. Nodes
-- represent durable facts about Daniel (patterns, preferences, goals, life events, seasons,
-- insights incl. the W4.3 profile singleton); edges are typed, weighted relationships between
-- them. Both tables are populated by later slices (W2.2 promotion, W2.3 extraction) — this
-- migration only creates the schema.
create table knowledge_node (
    id          uuid primary key default gen_random_uuid(),
    created_by  uuid not null references app_user(id) on delete cascade,
    is_deleted  boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    kind        varchar(12) not null,
    title       varchar(120) not null,
    summary     text,
    status      varchar(10) not null default 'active',
    source_kind varchar(20),
    source_id   uuid,
    occurred_on date,
    meta        jsonb,
    constraint ck_knowledge_node_kind check (kind in ('PATTERN', 'PREFERENCE', 'GOAL', 'LIFE_EVENT', 'SEASON', 'INSIGHT')),
    constraint ck_knowledge_node_status check (status in ('candidate', 'active', 'archived'))
);
-- Idempotent promotion anchor (W2.2): UPSERT by (created_by, source_kind, source_id).
create unique index uq_knowledge_node_source on knowledge_node (created_by, source_kind, source_id)
    where source_id is not null and is_deleted = false;
create index idx_knowledge_node_created_by_status on knowledge_node (created_by, status);

create table knowledge_edge (
    id                 uuid primary key default gen_random_uuid(),
    created_by         uuid not null references app_user(id) on delete cascade,
    is_deleted         boolean not null default false,
    created_at         timestamptz not null default now(),
    from_node_id       uuid not null references knowledge_node(id) on delete cascade,
    to_node_id         uuid not null references knowledge_node(id) on delete cascade,
    kind               varchar(12) not null,
    weight             numeric(4,3) not null default 0.500,
    evidence           jsonb,
    last_reinforced_at timestamptz,
    constraint ck_knowledge_edge_kind check (kind in ('TRIGGERS', 'PRECEDED_BY', 'SUPPORTS', 'CONFLICTS', 'RELATES_TO')),
    constraint ck_knowledge_edge_weight check (weight >= 0 and weight <= 1),
    constraint uq_knowledge_edge_pair unique (created_by, from_node_id, to_node_id, kind)
);
create index idx_knowledge_edge_from on knowledge_edge (from_node_id);
create index idx_knowledge_edge_to   on knowledge_edge (to_node_id);
```

- [ ] **Step 2: Register the changeSet**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (after the
`202608221200_mezo-b3pp.16_create_feedback_rollup` entry, same indentation):

```yaml
  - changeSet:
      id: "1.0.0:202608221600_mezo-b3pp.6_create_knowledge_graph"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608221600_mezo-b3pp.6_create_knowledge_graph.sql
```

- [ ] **Step 3: Verify the migration applies**

Run: `cd backend && ./mvnw -q -Dtest=none -DfailIfNoTests=false verify -DskipTests -Dliquibase.skip=false 2>&1 | tail -30`
(or simply run any existing IT — `./mvnw test -Dtest=CompanionPropertiesIT`; Liquibase runs on
context start against the Testcontainers Postgres). Expected: BUILD SUCCESS, no Liquibase changeSet
error mentioning `knowledge_node`/`knowledge_edge`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/changelog/1.0.0/script/202608221600_mezo-b3pp.6_create_knowledge_graph.sql backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml
git commit -m "feat(companion): knowledge_node + knowledge_edge tables (mezo-b3pp.6)"
```

---

### Task 3: Feature switch + Graph tuning config

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml` (switch + tuning values)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java`

**Interfaces:**
- Produces: `FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH = "mezo.feature.knowledge-graph.enabled"`;
  `CompanionProperties.Graph(int maxHops, int topK, double decayFactor, double pruneFloor, int renderMaxTokens)`
  accessible as `companionProperties.graph()`. Task 6's `GraphService`/`GraphController` condition
  on `KNOWLEDGE_GRAPH_SWITCH`; later slices (W2.4/W2.5) read the `Graph` record's fields.

- [ ] **Step 1: Add the switch constant**

In `FeaturesConfiguration.java`, append after the `JOURNAL_SWITCH` field (before the closing brace):

```java

    /** Phase 5 W2.1 knowledge graph (bd mezo-b3pp.6) — off ⇒ no graph beans exist, the graph API
     *  404s, and every graph hook elsewhere (W3.1 [Összefüggések] block, W4.2 reinforcement,
     *  RECOVERY profile input) stays silently absent. */
    public static final String KNOWLEDGE_GRAPH_SWITCH = "mezo.feature.knowledge-graph.enabled";
```

- [ ] **Step 2: Add the Graph tuning record**

In `CompanionProperties.java`, add `@NotNull @Valid Graph graph` to the record's parameter list
(after `ambientRecall`):

```java
    @NotNull @Valid AmbientRecall ambientRecall,
    @NotNull @Valid Graph graph
) {
```

Then add the nested record (after the `AmbientRecall` record body, before `Hypotheses`):

```java
    /** W2.1 knowledge-graph tuning (spec §6.1) — traversal bounds + nightly maintenance knobs. */
    public record Graph(
        /** Neighborhood traversal depth from a seed node (W2.4). */
        @Min(1) @Max(3) int maxHops,
        /** Top-K neighbors returned by weight (W2.4). */
        @Min(1) @Max(20) int topK,
        /** Nightly edge-weight multiplicative decay (W2.5) — e.g. 0.99 = 1%/day fade. */
        @DecimalMin("0.9") @DecimalMax("1.0") double decayFactor,
        /** Edges below this weight are soft-deleted on the nightly pass (W2.5). */
        @DecimalMin("0.0") @DecimalMax("1.0") double pruneFloor,
        /** Hard cap on the rendered [Összefüggések] block (estimated tokens, W2.4). */
        @Min(1) int renderMaxTokens
    ) {}
```

- [ ] **Step 3: Bind the config in application.yml**

Add the switch under `mezo.feature` (after the `journal:` block, in
`backend/src/main/resources/application.yml`):

```yaml
    # Phase 5 W2.1 knowledge graph (bd mezo-b3pp.6) — off ⇒ /api/companion/graph 404s, no graph
    # beans exist, and every graph hook elsewhere stays silently absent.
    knowledge-graph:
      enabled: true
```

Add the tuning block under `mezo.companion` (after the `ambient-recall:` block, before `summary:`):

```yaml
    graph:
      # W2.1 (mezo-b3pp.6, spec §6.1): traversal bounds consumed by W2.4's GraphTraversalService
      # and nightly maintenance knobs consumed by W2.5's GraphMaintenanceJob. Declared here now so
      # every later slice reads the same record; unused until then.
      max-hops: 2
      top-k: 8
      decay-factor: 0.99
      prune-floor: 0.05
      render-max-tokens: 800
```

- [ ] **Step 4: Add the config-binding test**

In `CompanionPropertiesIT.java`, append (before the closing `}`):

```java

    @Test
    void testGraphConfig_shouldBindTraversalAndMaintenanceKnobsFromYaml_whenContextStarts() {
        assertThat(properties.graph().maxHops()).isEqualTo(2);
        assertThat(properties.graph().topK()).isEqualTo(8);
        assertThat(properties.graph().decayFactor()).isEqualTo(0.99);
        assertThat(properties.graph().pruneFloor()).isEqualTo(0.05);
        assertThat(properties.graph().renderMaxTokens()).isEqualTo(800);
    }
```

- [ ] **Step 5: Run the test**

Run: `cd backend && ./mvnw test -Dtest=CompanionPropertiesIT`
Expected: all tests in the class PASS, including the new `testGraphConfig_...`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java
git commit -m "feat(companion): knowledge-graph switch + Graph tuning record (mezo-b3pp.6)"
```

---

### Task 4: OpenAPI contract fragment — GraphNodeResponse + list/archive

**Files:**
- Create: `api/feature/knowledge-graph/knowledge-graph.yml`
- Modify: `api/generate/merge.yml`

**Interfaces:**
- Produces (after generation): Java interface `io.mrkuhne.mezo.api.controller.KnowledgeGraphApi`
  with methods `listGraphNodes(): List<GraphNodeResponse>` and
  `archiveGraphNode(UUID id): GraphNodeResponse`; DTO `io.mrkuhne.mezo.api.dto.GraphNodeResponse`
  with fields `id, kind, title, summary, status, sourceKind, sourceId, occurredOn, createdAt,
  updatedAt` (kind/status as string enums per the OpenAPI `enum`). Task 6's `GraphController`
  implements `KnowledgeGraphApi`; Task 5's `GraphMapper` produces `GraphNodeResponse`.

- [ ] **Step 1: Write the contract fragment**

```yaml
openapi: 3.0.3
info: { title: mezo knowledge-graph fragment, version: 1.0.0 }
paths:
  /api/companion/graph/node:
    get:
      tags: [KnowledgeGraph]
      operationId: listGraphNodes
      summary: Active knowledge-graph nodes for the current user (KnowledgeGraph)
      responses:
        '200':
          description: Active nodes, newest first
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/GraphNodeResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/companion/graph/node/{id}/archive:
    post:
      tags: [KnowledgeGraph]
      operationId: archiveGraphNode
      summary: Archive a node — hides it from active listing and traversal (KnowledgeGraph)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '200':
          description: Archived node
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GraphNodeResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: GRAPH_NODE_NOT_FOUND
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    GraphNodeResponse:
      type: object
      required: [id, kind, title, status, createdAt, updatedAt]
      properties:
        id: { type: string, format: uuid }
        kind: { type: string, enum: [PATTERN, PREFERENCE, GOAL, LIFE_EVENT, SEASON, INSIGHT] }
        title: { type: string }
        summary: { type: string, nullable: true }
        status: { type: string, enum: [candidate, active, archived] }
        sourceKind: { type: string, nullable: true }
        sourceId: { type: string, format: uuid, nullable: true }
        occurredOn: { type: string, format: date, nullable: true }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
```

- [ ] **Step 2: Register the fragment in merge.yml**

In `api/generate/merge.yml`, append after the `companion-feedback` line:

```yaml
  - inputFile: ../feature/knowledge-graph/knowledge-graph.yml
```

- [ ] **Step 3: Regenerate the merged contract**

Run: `cd api/generate && npm run generate:api`
Expected: `api/openapi.yml` updates with the `KnowledgeGraph` tag's paths/schemas; command exits 0.

- [ ] **Step 4: Commit**

```bash
git add api/feature/knowledge-graph/knowledge-graph.yml api/generate/merge.yml api/openapi.yml
git commit -m "feat(api): knowledge-graph contract fragment — list/archive node (mezo-b3pp.6)"
```

---

### Task 5: Entities + repositories

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/entity/GraphNodeEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/entity/GraphEdgeEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/entity/GraphEdgeEvidence.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphNodeRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphEdgeRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphEntityPersistenceIT.java`

**Interfaces:**
- Consumes: `OwnedEntity` (`io.mrkuhne.mezo.techcore.persistence.OwnedEntity` — `createdBy`,
  `deleted`, `createdAt`).
- Produces: `GraphNodeEntity` (constants `KIND_PATTERN/KIND_PREFERENCE/KIND_GOAL/KIND_LIFE_EVENT/
  KIND_SEASON/KIND_INSIGHT`, `STATUS_CANDIDATE/STATUS_ACTIVE/STATUS_ARCHIVED`; getters/setters:
  `id, kind, title, summary, status, sourceKind, sourceId, occurredOn, meta, updatedAt` +
  inherited `createdBy, deleted, createdAt`); `GraphEdgeEntity` (constants
  `KIND_TRIGGERS/KIND_PRECEDED_BY/KIND_SUPPORTS/KIND_CONFLICTS/KIND_RELATES_TO`; getters/setters:
  `id, fromNodeId, toNodeId, kind, weight, evidence, lastReinforcedAt` + inherited fields);
  `GraphEdgeEvidence(String sourceKind, java.util.UUID sourceId, String note, java.time.Instant at)`.
  `GraphNodeRepository`: `findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(UUID, String, UUID):
  Optional<GraphNodeEntity>`, `findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(UUID,
  String): List<GraphNodeEntity>`, `findByIdAndCreatedByAndDeletedFalse(UUID, UUID):
  Optional<GraphNodeEntity>`. `GraphEdgeRepository`: `findByCreatedByAndFromNodeIdAndToNodeIdAndKindAndDeletedFalse(
  UUID, UUID, UUID, String): Optional<GraphEdgeEntity>`,
  `findByCreatedByAndFromNodeIdAndDeletedFalse(UUID, UUID): List<GraphEdgeEntity>`,
  `findByCreatedByAndToNodeIdAndDeletedFalse(UUID, UUID): List<GraphEdgeEntity>`. Task 6's
  `GraphService` consumes both repositories; Task 7's `GraphPopulator` consumes both entities.

- [ ] **Step 1: Write the evidence envelope**

```java
package io.mrkuhne.mezo.feature.companion.graph.entity;

import java.time.Instant;
import java.util.UUID;

/**
 * One evidence item behind a {@code knowledge_edge} (spec §4.2): the source row that justified
 * creating or reinforcing the edge, e.g. a confirmed pattern or a life-event confirmation.
 */
public record GraphEdgeEvidence(String sourceKind, UUID sourceId, String note, Instant at) {
}
```

- [ ] **Step 2: Write GraphNodeEntity**

```java
package io.mrkuhne.mezo.feature.companion.graph.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * One knowledge-graph node (Phase 5 W2.1, bd mezo-b3pp.6, spec §4.2/§6.1, ADR 0031) — a durable
 * fact about Daniel: a pattern, preference, goal, life event, season, or insight (the W4.3
 * companion profile is a singleton {@code INSIGHT} node, not a separate table). {@code status}
 * carries the L2 candidate→active→archived lifecycle independently of {@code is_deleted}
 * (inherited soft-delete); archiving a node keeps the row, just out of active listing/traversal.
 *
 * <p>{@code sourceKind}/{@code sourceId} + {@link #KIND_PATTERN} etc. back the idempotent
 * promotion anchor {@code uq_knowledge_node_source} — later slices (W2.2/W2.3) UPSERT by this pair
 * so re-promoting the same source row never duplicates a node.
 */
@Getter
@Setter
@Entity
@Table(name = "knowledge_node")
@SQLDelete(sql = "update knowledge_node set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GraphNodeEntity extends OwnedEntity {

    public static final String KIND_PATTERN = "PATTERN";
    public static final String KIND_PREFERENCE = "PREFERENCE";
    public static final String KIND_GOAL = "GOAL";
    public static final String KIND_LIFE_EVENT = "LIFE_EVENT";
    public static final String KIND_SEASON = "SEASON";
    public static final String KIND_INSIGHT = "INSIGHT";

    public static final String STATUS_CANDIDATE = "candidate";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_ARCHIVED = "archived";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** Mirrors ck_knowledge_node_kind. */
    @NotNull
    @Size(max = 12)
    @Pattern(regexp = "PATTERN|PREFERENCE|GOAL|LIFE_EVENT|SEASON|INSIGHT")
    @Column(nullable = false, length = 12)
    private String kind;

    @NotNull
    @Size(max = 120)
    @Column(nullable = false, length = 120)
    private String title;

    @Column(columnDefinition = "text")
    private String summary;

    /** Mirrors ck_knowledge_node_status. */
    @NotNull
    @Size(max = 10)
    @Pattern(regexp = "candidate|active|archived")
    @Column(nullable = false, length = 10)
    private String status = STATUS_ACTIVE;

    @Size(max = 20)
    @Column(name = "source_kind", length = 20)
    private String sourceKind;

    @Column(name = "source_id", columnDefinition = "uuid")
    private UUID sourceId;

    @Column(name = "occurred_on")
    private LocalDate occurredOn;

    /** Kind-specific payload — typed envelopes per kind arrive with the slices that write them
     *  (W2.2 PATTERN meta, W2.3 LIFE_EVENT meta); a generic map until then. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> meta;
}
```

- [ ] **Step 3: Write GraphEdgeEntity**

```java
package io.mrkuhne.mezo.feature.companion.graph.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One typed, weighted relationship between two {@link GraphNodeEntity} rows (Phase 5 W2.1, bd
 * mezo-b3pp.6, spec §4.2/§6.1, ADR 0031). {@code weight} starts humble (edges are created at
 * {@code confidence × 0.5} in W2.2) and moves via nightly decay/reinforcement (W2.5).
 *
 * <p>{@code fromNodeId}/{@code toNodeId} are flat UUID columns (the {@code GoalPlanLinkEntity}
 * idiom), not JPA relations — this codebase's dominant FK style.
 */
@Getter
@Setter
@Entity
@Table(name = "knowledge_edge")
@SQLDelete(sql = "update knowledge_edge set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GraphEdgeEntity extends OwnedEntity {

    public static final String KIND_TRIGGERS = "TRIGGERS";
    public static final String KIND_PRECEDED_BY = "PRECEDED_BY";
    public static final String KIND_SUPPORTS = "SUPPORTS";
    public static final String KIND_CONFLICTS = "CONFLICTS";
    public static final String KIND_RELATES_TO = "RELATES_TO";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "from_node_id", nullable = false, columnDefinition = "uuid")
    private UUID fromNodeId;

    @NotNull
    @Column(name = "to_node_id", nullable = false, columnDefinition = "uuid")
    private UUID toNodeId;

    /** Mirrors ck_knowledge_edge_kind. */
    @NotNull
    @Size(max = 12)
    @Pattern(regexp = "TRIGGERS|PRECEDED_BY|SUPPORTS|CONFLICTS|RELATES_TO")
    @Column(nullable = false, length = 12)
    private String kind;

    /** Mirrors ck_knowledge_edge_weight (0..1). */
    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("1.0")
    @Column(nullable = false, precision = 4, scale = 3)
    private BigDecimal weight = new BigDecimal("0.500");

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<GraphEdgeEvidence> evidence;

    @Column(name = "last_reinforced_at")
    private Instant lastReinforcedAt;
}
```

- [ ] **Step 4: Write the repositories**

```java
package io.mrkuhne.mezo.feature.companion.graph.repository;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GraphNodeRepository extends JpaRepository<GraphNodeEntity, UUID> {

    Optional<GraphNodeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<GraphNodeEntity> findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
        UUID createdBy, String sourceKind, UUID sourceId);

    List<GraphNodeEntity> findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, String status);
}
```

```java
package io.mrkuhne.mezo.feature.companion.graph.repository;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GraphEdgeRepository extends JpaRepository<GraphEdgeEntity, UUID> {

    Optional<GraphEdgeEntity> findByCreatedByAndFromNodeIdAndToNodeIdAndKindAndDeletedFalse(
        UUID createdBy, UUID fromNodeId, UUID toNodeId, String kind);

    List<GraphEdgeEntity> findByCreatedByAndFromNodeIdAndDeletedFalse(UUID createdBy, UUID fromNodeId);

    List<GraphEdgeEntity> findByCreatedByAndToNodeIdAndDeletedFalse(UUID createdBy, UUID toNodeId);
}
```

- [ ] **Step 5: Write the failing persistence IT**

```java
package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEvidence;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

class GraphEntityPersistenceIT extends AbstractIntegrationTest {

    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private GraphEdgeRepository edgeRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testSaveNode_shouldPersistWithDefaultsAndMeta_whenValid() {
        UUID owner = ownerId();
        GraphNodeEntity node = new GraphNodeEntity();
        node.setCreatedBy(owner);
        node.setKind(GraphNodeEntity.KIND_PATTERN);
        node.setTitle("Késői evés rontja az alvást");
        node.setSummary("r=0.42, n=18, 30 nap.");
        node.setMeta(Map.of("r", 0.42, "n", 18));

        GraphNodeEntity saved = nodeRepository.saveAndFlush(node);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(saved.isDeleted()).isFalse();
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(saved.getMeta()).containsEntry("n", 18);
    }

    @Test
    void testSaveNode_shouldReject_whenKindNotInCheckSet() {
        UUID owner = ownerId();
        GraphNodeEntity node = new GraphNodeEntity();
        node.setCreatedBy(owner);
        node.setKind("BOGUS");
        node.setTitle("x");

        assertThatThrownBy(() -> nodeRepository.saveAndFlush(node))
            .isInstanceOf(Exception.class);
    }

    @Test
    void testSaveNode_shouldRejectDuplicateSource_whenSameCreatedByAndSourceKindAndSourceId() {
        UUID owner = ownerId();
        UUID sourceId = UUID.randomUUID();
        GraphNodeEntity first = new GraphNodeEntity();
        first.setCreatedBy(owner);
        first.setKind(GraphNodeEntity.KIND_PATTERN);
        first.setTitle("Első.");
        first.setSourceKind("pattern");
        first.setSourceId(sourceId);
        nodeRepository.saveAndFlush(first);

        GraphNodeEntity duplicate = new GraphNodeEntity();
        duplicate.setCreatedBy(owner);
        duplicate.setKind(GraphNodeEntity.KIND_PATTERN);
        duplicate.setTitle("Második, ugyanaz a forrás.");
        duplicate.setSourceKind("pattern");
        duplicate.setSourceId(sourceId);

        assertThatThrownBy(() -> nodeRepository.saveAndFlush(duplicate))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testSaveEdge_shouldPersistWithEvidenceAndDefaultWeight_whenValid() {
        UUID owner = ownerId();
        GraphNodeEntity from = nodeRepository.saveAndFlush(newNode(owner, "A"));
        GraphNodeEntity to = nodeRepository.saveAndFlush(newNode(owner, "B"));

        GraphEdgeEntity edge = new GraphEdgeEntity();
        edge.setCreatedBy(owner);
        edge.setFromNodeId(from.getId());
        edge.setToNodeId(to.getId());
        edge.setKind(GraphEdgeEntity.KIND_TRIGGERS);
        edge.setEvidence(List.of(new GraphEdgeEvidence("pattern", from.getId(), "confirm", Instant.now())));

        GraphEdgeEntity saved = edgeRepository.saveAndFlush(edge);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getWeight()).isEqualByComparingTo(new BigDecimal("0.500"));
        assertThat(saved.getEvidence()).hasSize(1);
    }

    @Test
    void testSaveEdge_shouldRejectDuplicatePair_whenSameFromToKind() {
        UUID owner = ownerId();
        GraphNodeEntity from = nodeRepository.saveAndFlush(newNode(owner, "A"));
        GraphNodeEntity to = nodeRepository.saveAndFlush(newNode(owner, "B"));
        edgeRepository.saveAndFlush(newEdge(owner, from.getId(), to.getId()));

        assertThatThrownBy(() -> edgeRepository.saveAndFlush(newEdge(owner, from.getId(), to.getId())))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    private GraphNodeEntity newNode(UUID owner, String title) {
        GraphNodeEntity n = new GraphNodeEntity();
        n.setCreatedBy(owner);
        n.setKind(GraphNodeEntity.KIND_PATTERN);
        n.setTitle(title);
        return n;
    }

    private GraphEdgeEntity newEdge(UUID owner, UUID fromId, UUID toId) {
        GraphEdgeEntity e = new GraphEdgeEntity();
        e.setCreatedBy(owner);
        e.setFromNodeId(fromId);
        e.setToNodeId(toId);
        e.setKind(GraphEdgeEntity.KIND_TRIGGERS);
        return e;
    }
}
```

- [ ] **Step 6: Run it to see it fail (repositories/entities not yet compiled is expected pre-write; run AFTER writing the code above to confirm green instead)**

Run: `cd backend && ./mvnw test -Dtest=GraphEntityPersistenceIT`
Expected: PASS (this task writes production code and the test together — there is no separate
red step here because the entities/repositories are new, not a behavior change to existing code).
If any test fails, fix the entity/repository/migration mismatch before moving on.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/entity backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphEntityPersistenceIT.java
git commit -m "feat(companion): graph node/edge entities + repositories (mezo-b3pp.6)"
```

---

### Task 6: GraphService + GraphMapper + GraphController + switch-off IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/mapper/GraphMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/controller/GraphController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphSwitchOffIT.java`

**Interfaces:**
- Consumes: `GraphNodeRepository`/`GraphEdgeRepository` (Task 5), generated `KnowledgeGraphApi`/
  `GraphNodeResponse` (Task 4), `FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH` (Task 3),
  `CurrentUserId` (existing bean, `io.mrkuhne.mezo.techcore.security.CurrentUserId`), `SystemMessage`/
  `SystemRuntimeErrorException` (existing, `io.mrkuhne.mezo.techcore.exception`).
- Produces: `GraphService` public methods — `upsertNode(UUID userId, String kind, String title,
  String summary, String sourceKind, UUID sourceId, LocalDate occurredOn, Map<String,Object> meta):
  GraphNodeEntity`, `listActive(UUID userId): List<GraphNodeEntity>`, `archive(UUID userId, UUID
  nodeId): GraphNodeEntity`, `upsertEdge(UUID userId, UUID fromNodeId, UUID toNodeId, String kind,
  BigDecimal weight, List<GraphEdgeEvidence> evidence): GraphEdgeEntity`, `edgesFrom(UUID userId,
  UUID nodeId): List<GraphEdgeEntity>`, `edgesTo(UUID userId, UUID nodeId): List<GraphEdgeEntity>`.
  Task 7's `GraphApiIT` drives these through `GraphController`.

- [ ] **Step 1: Write GraphService**

```java
package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEvidence;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Knowledge-graph node/edge CRUD (Phase 5 W2.1, bd mezo-b3pp.6, spec §4.2/§6.1). {@link
 * #upsertNode}/{@link #upsertEdge} are the idempotent promotion primitives later slices call —
 * W2.2's pattern/fact/goal promotion, W2.3's life-event confirm — never insert directly. Gated
 * {@code KNOWLEDGE_GRAPH_SWITCH}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphService {

    private final GraphNodeRepository nodeRepository;
    private final GraphEdgeRepository edgeRepository;

    /** UPSERT by (createdBy, sourceKind, sourceId) — re-promotion updates title/summary/meta, never duplicates. */
    @Transactional
    public GraphNodeEntity upsertNode(UUID userId, String kind, String title, String summary,
            String sourceKind, UUID sourceId, LocalDate occurredOn, Map<String, Object> meta) {
        GraphNodeEntity node = (sourceKind != null && sourceId != null)
            ? nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(userId, sourceKind, sourceId)
                .orElseGet(GraphNodeEntity::new)
            : new GraphNodeEntity();
        node.setCreatedBy(userId);
        node.setKind(kind);
        node.setTitle(title);
        node.setSummary(summary);
        node.setSourceKind(sourceKind);
        node.setSourceId(sourceId);
        node.setOccurredOn(occurredOn);
        node.setMeta(meta);
        return nodeRepository.saveAndFlush(node);
    }

    @Transactional(readOnly = true)
    public List<GraphNodeEntity> listActive(UUID userId) {
        return nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            userId, GraphNodeEntity.STATUS_ACTIVE);
    }

    @Transactional
    public GraphNodeEntity archive(UUID userId, UUID nodeId) {
        GraphNodeEntity node = findOwnedNode(userId, nodeId);
        node.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        return nodeRepository.saveAndFlush(node);
    }

    /** UPSERT by (createdBy, fromNodeId, toNodeId, kind) — re-proposing the same edge updates weight/evidence. */
    @Transactional
    public GraphEdgeEntity upsertEdge(UUID userId, UUID fromNodeId, UUID toNodeId, String kind,
            BigDecimal weight, List<GraphEdgeEvidence> evidence) {
        GraphEdgeEntity edge = edgeRepository
            .findByCreatedByAndFromNodeIdAndToNodeIdAndKindAndDeletedFalse(userId, fromNodeId, toNodeId, kind)
            .orElseGet(GraphEdgeEntity::new);
        edge.setCreatedBy(userId);
        edge.setFromNodeId(fromNodeId);
        edge.setToNodeId(toNodeId);
        edge.setKind(kind);
        if (weight != null) {
            edge.setWeight(weight);
        }
        edge.setEvidence(evidence);
        return edgeRepository.saveAndFlush(edge);
    }

    @Transactional(readOnly = true)
    public List<GraphEdgeEntity> edgesFrom(UUID userId, UUID nodeId) {
        return edgeRepository.findByCreatedByAndFromNodeIdAndDeletedFalse(userId, nodeId);
    }

    @Transactional(readOnly = true)
    public List<GraphEdgeEntity> edgesTo(UUID userId, UUID nodeId) {
        return edgeRepository.findByCreatedByAndToNodeIdAndDeletedFalse(userId, nodeId);
    }

    private GraphNodeEntity findOwnedNode(UUID userId, UUID nodeId) {
        return nodeRepository.findByIdAndCreatedByAndDeletedFalse(nodeId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("GRAPH_NODE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
```

- [ ] **Step 2: Write GraphMapper**

```java
package io.mrkuhne.mezo.feature.companion.graph.mapper;

import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface GraphMapper {

    @Mapping(target = "kind", expression = "java(GraphNodeResponse.KindEnum.fromValue(e.getKind()))")
    @Mapping(target = "status", expression = "java(GraphNodeResponse.StatusEnum.fromValue(e.getStatus()))")
    GraphNodeResponse toResponse(GraphNodeEntity e);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
```

- [ ] **Step 3: Write GraphController**

```java
package io.mrkuhne.mezo.feature.companion.graph.controller;

import io.mrkuhne.mezo.api.controller.KnowledgeGraphApi;
import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.companion.graph.mapper.GraphMapper;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/companion/graph surface (bd mezo-b3pp.6) — gated on {@code KNOWLEDGE_GRAPH_SWITCH}
 *  (off ⇒ the whole surface 404s and no graph beans exist). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphController implements KnowledgeGraphApi {

    private final GraphService graphService;
    private final GraphMapper graphMapper;
    private final CurrentUserId currentUserId;

    @Override
    public List<GraphNodeResponse> listGraphNodes() {
        return graphService.listActive(currentUserId.get()).stream().map(graphMapper::toResponse).toList();
    }

    @Override
    public GraphNodeResponse archiveGraphNode(UUID id) {
        return graphMapper.toResponse(graphService.archive(currentUserId.get(), id));
    }
}
```

- [ ] **Step 4: Write the switch-off IT**

```java
package io.mrkuhne.mezo.feature.companion.graph;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the knowledge-graph switch OFF, the @ConditionalOnProperty controller (and service) are absent -> 404. */
@TestPropertySource(properties = "mezo.feature.knowledge-graph.enabled=false")
class GraphSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testGraphSurface_shouldReturn404_whenSwitchedOff() {
        getForBody("/api/companion/graph/node", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
        postForBody("/api/companion/graph/node/" + UUID.randomUUID() + "/archive", null,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && ./mvnw test -Dtest=GraphSwitchOffIT,GraphEntityPersistenceIT`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/mapper backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/controller backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphSwitchOffIT.java
git commit -m "feat(companion): GraphService + /api/companion/graph surface (mezo-b3pp.6)"
```

---

### Task 7: ResetDatabase + GraphPopulator + GraphApiIT

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/GraphPopulator.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphApiIT.java`

**Interfaces:**
- Consumes: `GraphNodeRepository`/`GraphEdgeRepository` (Task 5), `GraphService` (Task 6),
  `ApiIntegrationTest` (existing base — `getForBody`, `postForBody`, `getForList`, `ownerAuthHeaders`,
  `assertHasRequestError`), `UserPopulator` (existing, `io.mrkuhne.mezo.support.populator`).
- Produces: `GraphPopulator.createNode(UUID owner, String kind, String title): GraphNodeEntity`,
  `GraphPopulator.createEdge(UUID owner, UUID fromId, UUID toId, String kind):
  GraphEdgeEntity` — reusable by W2.2+ test suites.

- [ ] **Step 1: Add the tables to ResetDatabase's TRUNCATE list**

In `ResetDatabase.java`, insert `knowledge_node, knowledge_edge, ` into the native TRUNCATE query
string — add it right after `feedback_rollup,` (keeping the existing comma-separated list otherwise
unchanged):

```java
                + "meal_slot_template, check_in, journal_entry, decision_entry, gratitude_entry, "
                + "knowledge_node, knowledge_edge, "
```

(i.e. the full first-argument string gains `knowledge_node, knowledge_edge, ` immediately before
`meal_slot_template` — place it wherever reads cleanly against the existing line breaks; the SQL
itself is order-insensitive since it's one `TRUNCATE ... CASCADE`.)

- [ ] **Step 2: Write GraphPopulator**

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for GraphNodeEntity/GraphEdgeEntity — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class GraphPopulator {

    private final GraphNodeRepository nodeRepository;
    private final GraphEdgeRepository edgeRepository;

    public GraphNodeEntity createNode(UUID owner, String kind, String title) {
        GraphNodeEntity n = new GraphNodeEntity();
        n.setCreatedBy(owner);
        n.setKind(kind);
        n.setTitle(title);
        return nodeRepository.saveAndFlush(n);
    }

    public GraphEdgeEntity createEdge(UUID owner, UUID fromNodeId, UUID toNodeId, String kind) {
        GraphEdgeEntity e = new GraphEdgeEntity();
        e.setCreatedBy(owner);
        e.setFromNodeId(fromNodeId);
        e.setToNodeId(toNodeId);
        e.setKind(kind);
        return edgeRepository.saveAndFlush(e);
    }
}
```

- [ ] **Step 3: Write the failing (then passing) API IT**

```java
package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract IT for the {@code /api/companion/graph} surface (bd mezo-b3pp.6) — drives
 * the generated {@code KnowledgeGraphApi}: active-node listing, archive, ownership 404.
 */
class GraphApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testListGraphNodes_shouldReturnOnlyActiveNodes_whenSomeArchived() {
        UUID owner = ownerId();
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív csomópont.");
        GraphNodeEntity toArchive = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Archiválandó.");
        toArchive.setStatus(GraphNodeEntity.STATUS_ARCHIVED);

        List<GraphNodeResponse> nodes = getForList("/api/companion/graph/node", ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);

        assertThat(nodes).extracting(GraphNodeResponse::getTitle).contains("Aktív csomópont.");
    }

    @Test
    void testArchiveGraphNode_shouldFlipStatusAndDropFromActiveListing_whenOwnNode() {
        UUID owner = ownerId();
        GraphNodeEntity node = graphPopulator.createNode(owner, GraphNodeEntity.KIND_GOAL, "Archiválandó cél.");

        GraphNodeResponse archived = postForBody("/api/companion/graph/node/" + node.getId() + "/archive",
            null, ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);

        assertThat(archived.getStatus()).isEqualTo(GraphNodeResponse.StatusEnum.ARCHIVED);

        List<GraphNodeResponse> active = getForList("/api/companion/graph/node", ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);
        assertThat(active).extracting(GraphNodeResponse::getId).doesNotContain(node.getId());
    }

    @Test
    void testArchiveGraphNode_shouldReturn404_whenNotOwnNode() {
        UUID otherUser = userPopulator.createUser().getId();
        GraphNodeEntity node = graphPopulator.createNode(otherUser, GraphNodeEntity.KIND_GOAL, "Nem az enyém.");

        String body = postForBody("/api/companion/graph/node/" + node.getId() + "/archive", null,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "GRAPH_NODE_NOT_FOUND");
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `cd backend && ./mvnw test -Dtest=GraphApiIT,GraphSwitchOffIT,GraphEntityPersistenceIT`
Expected: all PASS.

- [ ] **Step 5: Run the full ArchUnit + companion test slice to catch regressions**

Run: `cd backend && ./mvnw test -Dtest=ArchitectureTest,CompanionPropertiesIT`
Expected: all PASS — confirms no new cycle, no layer-placement violation, config binds.

- [ ] **Step 6: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java backend/src/test/java/io/mrkuhne/mezo/support/populator/GraphPopulator.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphApiIT.java
git commit -m "test(companion): ResetDatabase + GraphPopulator + graph API ITs (mezo-b3pp.6)"
```

---

### Task 8: Docs — companion.md + lint

**Files:**
- Modify: `docs/features/companion.md`

**Interfaces:** None (docs-only task).

- [ ] **Step 1: Add a "Backend tables (W2.1 knowledge graph, ✅ `mezo-b3pp.6`)" section**

In `docs/features/companion.md`, under `## 4. Data model & API`, insert a new subsection right
after `### Backend tables (W4.2 feedback rollups, ✅ mezo-b3pp.16)` (i.e. before `### Entities`),
following that section's structure:

```markdown
### Backend tables (W2.1 knowledge graph, ✅ `mezo-b3pp.6`)

Migration `202608221600_mezo-b3pp.6_create_knowledge_graph.sql` (in `1.0.0_master.yml`) — the
Postgres-native knowledge-graph skeleton (spec §4.2/§6.1, [ADR 0031](../decisions/0031-knowledge-graph-postgres-native.md)).
Behind the W2 graph gate ([ADR 0030](../decisions/0030-graph-gate-outcome-build.md), spec §10):
build was chosen after living with W3.1's always-on recall.

- **`knowledge_node`** — `id uuid pk`, `created_by uuid fk→app_user(id) ON DELETE CASCADE`,
  `updated_at timestamptz`, `kind varchar(12)` (`PATTERN|PREFERENCE|GOAL|LIFE_EVENT|SEASON|INSIGHT`),
  `title varchar(120)`, `summary text`, `status varchar(10)` default `active`
  (`candidate|active|archived`), `source_kind varchar(20)`, `source_id uuid`, `occurred_on date`,
  `meta jsonb`. **`uq_knowledge_node_source (created_by, source_kind, source_id)`** (partial, where
  `source_id is not null`) is the idempotent promotion anchor W2.2/W2.3 UPSERT against.
- **`knowledge_edge`** — `id uuid pk`, `created_by uuid fk`, `from_node_id`/`to_node_id uuid
  fk→knowledge_node(id) ON DELETE CASCADE`, `kind varchar(12)`
  (`TRIGGERS|PRECEDED_BY|SUPPORTS|CONFLICTS|RELATES_TO`), `weight numeric(4,3)` default `0.500`
  (`ck_knowledge_edge_weight` 0..1), `evidence jsonb`, `last_reinforced_at timestamptz`.
  `uq_knowledge_edge_pair (created_by, from_node_id, to_node_id, kind)` — same UPSERT idiom.
- **`status` vs `is_deleted`** — the two are independent: `is_deleted` is the inherited
  `OwnedEntity` soft-delete; `status='archived'` is the visible L2 lifecycle state (the `GoalEntity`
  `planned/active/archived` idiom). Archiving a node keeps the row, just out of active
  listing/traversal.
- **The W4.3 companion profile is a singleton `knowledge_node`** of `kind=INSIGHT`,
  `source_kind='profile'`, per user — not a separate table (spec §4.2).
- **`GraphNodeEntity`/`GraphEdgeEntity`** (`feature/companion/graph/entity/`, W2.1)
  `extends OwnedEntity`; `meta` is a generic `Map<String,Object>` jsonb column for now — typed
  envelopes per kind arrive with the slices that write them (W2.2 PATTERN meta `{r,n,direction}`,
  W2.3 LIFE_EVENT meta); `evidence` is a typed `List<GraphEdgeEvidence>` jsonb column
  (`{sourceKind, sourceId, note, at}` per item, the `PantryItemEntity.micros` List<record> jsonb
  precedent).
- **`GraphService`** (`feature/companion/graph/service/`, W2.1) — `upsertNode`/`upsertEdge` are the
  ONLY write paths later slices use (never a direct `repository.save`); both UPSERT by their unique
  index so re-promoting the same source row never duplicates. `archive(userId, nodeId)` flips
  `status` only.
- **Switch** `mezo.feature.knowledge-graph.enabled` (`FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH`)
  — off ⇒ no graph beans exist, `/api/companion/graph/*` 404s, and every graph hook elsewhere (W3.1
  `[Összefüggések]` block, W4.2 reinforcement, RECOVERY profile input) stays silently absent.
- **`CompanionProperties.Graph`** (prefix `mezo.companion.graph`): `maxHops` (1..3, default 2),
  `topK` (1..20, default 8), `decayFactor` (0.9..1, default 0.99), `pruneFloor` (0..1, default 0.05),
  `renderMaxTokens` (default 800) — declared now, consumed starting W2.4 (traversal) and W2.5
  (maintenance job); unused until then.
- **Scope, explicitly**: this slice is schema + CRUD + the two REST operations the spec commits to
  now (list active nodes, archive a node). No node-*creation* REST endpoint (nodes are written only
  by internal promotion/extraction pipelines, W2.2/W2.3); no `GraphEdgeResponse` REST DTO yet
  (nothing consumes edges over HTTP until W2.4 traversal / W2.6 FE surface) — edges are exercised at
  the service/repository layer directly (`GraphEntityPersistenceIT`).
```

- [ ] **Step 2: Add a REST endpoints subsection**

Insert a new subsection after `### REST endpoints — feedback (contract-first — tag CompanionFeedback → CompanionFeedbackApi)`
(before `### The V0.5 tool catalog`):

```markdown
### REST endpoints — knowledge graph (contract-first — tag `KnowledgeGraph` → `KnowledgeGraphApi`)

W2.1 (`mezo-b3pp.6`) — gated `KNOWLEDGE_GRAPH_SWITCH`:

- `GET /api/companion/graph/node` — active nodes for the current user, newest first.
- `POST /api/companion/graph/node/{id}/archive` — archive a node (200 + the archived node body;
  404 `GRAPH_NODE_NOT_FOUND` if not owned).
```

- [ ] **Step 3: Add a Config keys entry**

In the `### Config keys (mezo.companion.* — CompanionProperties, @Validated)` section, add a line
for `graph` alongside the existing per-record bullets (match that section's existing bullet style —
read the surrounding lines to match exact formatting before inserting).

- [ ] **Step 4: Add to Key files (§10)**

Under `## 10. Key files`, add entries for the new files:
`feature/companion/graph/entity/GraphNodeEntity.java`, `GraphEdgeEntity.java`,
`feature/companion/graph/service/GraphService.java`,
`feature/companion/graph/controller/GraphController.java`,
`api/feature/knowledge-graph/knowledge-graph.yml` — matching the existing table/list format used
for the W4.2 feedback-rollup entries in that section.

- [ ] **Step 5: Lint the docs**

Run: `node scripts/lint-docs.mjs`
Expected: exits 0, no new staleness/orphan/broken-link warnings.

- [ ] **Step 6: Commit**

```bash
git add docs/features/companion.md
git commit -m "docs(companion): W2.1 knowledge-graph skeleton section (mezo-b3pp.6)"
```

---

### Task 9: Full verification pass

**Files:** None created/modified — verification only.

- [ ] **Step 1: Run the full graph + companion + journal focused suite**

Run: `cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.graph.**,CompanionPropertiesIT,ArchitectureTest'`
Expected: BUILD SUCCESS, 0 failures.

- [ ] **Step 2: Confirm the switch-on default doesn't break any existing companion IT**

Run: `cd backend && ./mvnw test -Dtest='io.mrkuhne.mezo.feature.companion.**'`
Expected: BUILD SUCCESS (the new `knowledge-graph.enabled: true` default must not 500 any existing
companion endpoint — nothing else references graph beans yet, so this should be a no-op regression
check).

- [ ] **Step 3: Confirm docs lint is still clean**

Run: `node scripts/lint-docs.mjs`
Expected: exits 0.

- [ ] **Step 4: git status sanity check**

Run: `git status --short`
Expected: clean (everything from Tasks 1-8 committed).
