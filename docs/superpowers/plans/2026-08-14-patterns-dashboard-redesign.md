# Minták Lifecycle Dashboard + Pattern Detail Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Motor + Minták tabs into one lifecycle-organized pattern dashboard with a per-pattern detail page (history chart, scatter, journal, impact), backed by an append-only `pattern_event` history table and `source_pattern_id` traceability.

**Architecture:** Backend first (S1 history table + writers → S2 traceability columns → S3 one detail endpoint), then frontend (S4 dashboard rewrite + Motor retirement → S5 detail page). The detection math (`PatternGate`, nightly job, freeze semantics) is untouched; the noise floor is a display-layer rule. Dashboard data is FE-composed from the two existing reads; only the detail page gets a new endpoint.

**Tech Stack:** Spring Boot 4.x / Java 21 / Maven / PostgreSQL + Liquibase / MapStruct · React 19 + TanStack Query + vitest · OpenAPI contract-first (`api/`).

**Spec:** `docs/superpowers/specs/2026-08-14-patterns-dashboard-redesign-design.md` (+ mockup HTML alongside — the approved UX copy source).

**bd:** epic `mezo-tk88`; slices `mezo-tk88.1` (S1) → `mezo-tk88.2` (S2) → `mezo-tk88.3` (S3) → `mezo-tk88.4` (S4) → `mezo-tk88.5` (S5). S3 depends on S1+S2; S5 on S3+S4.

## Global Constraints

- **House refs are law** — read before coding: `docs/references/liquibase_conventions.md`, `spring_patterns.md`, `error_handling.md`, `testing_standards.md`, `integration_test_framework.md`, `api_contract_conventions.md`, `configuration_conventions.md` (BE); `docs/references/frontend_conventions.md` (FE).
- Base package `io.mrkuhne.mezo`; UUID PKs (`gen_random_uuid()`); soft delete (`is_deleted` + `@SQLRestriction`); `created_by` server-set; constraint names `pk_/fk_/uq_/ck_/idx_`.
- Migration naming: `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql` under `backend/src/main/resources/db/changelog/1.0.0/script/` + a changeSet entry appended to `1.0.0_master.yml` (`author: daniel.kuhne`, id `"1.0.0:<filename-stem>"`). Never modify released changesets.
- **New domain table ⇒ add to `ResetDatabase` TRUNCATE list in the same change.**
- Backend tests: `./mvnw clean test` (ALWAYS `clean`); integration-first, `test{Method}_should{Result}_when{Condition}`, AssertJ only, populator data, no mocks/H2.
- Contract-first: edit `api/feature/companion/companion.yml` BEFORE code → `cd api/generate && npm run generate:api` → backend types regenerate in `./mvnw generate-sources`; FE types via `cd frontend && pnpm generate:api`.
- FE: hooks only via `@/data/hooks` barrel; `useDualQuery` for dual-mode reads (no mock fallback in real mode); deep absolute `@/*` imports, no new barrels; tests colocated; gate = `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Hungarian UI copy comes verbatim from the mockup** (`docs/superpowers/specs/2026-08-14-patterns-dashboard-redesign-mockup.html`); raw `r/n/p` + ISO window dates appear ONLY inside Motor-diagnosztika.
- Git flow per slice: `feat/<topic>` branch off fresh main → conventional commits carrying the slice's bd id → push → self-PR → CI green → local `--no-ff` merge → push main → delete branch. Close the slice's bd issue + update `docs/features/*` in the same slice.
- Charts (S5): load the `dataviz` skill BEFORE writing chart code.

---

# Slice S1 — `pattern_event` append-only history (`mezo-tk88.1`, branch `feat/pattern-event-history`)

### Task 1: Migration + entity + repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608141000_mezo-tk88.1_create_pattern_event.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/PatternEventEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/PatternEventPayloadEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/PatternEventRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list)
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/PatternEventPopulator.java`

**Interfaces:**
- Produces: `PatternEventEntity` (constants `KIND_SNAPSHOT|KIND_CONFIRMED|KIND_MONITORING|KIND_REJECTED|KIND_REINFORCED|KIND_PROMOTED`; fields `patternId: UUID`, `kind: String`, `occurredAt: Instant`, `payload: PatternEventPayloadEnvelope`), `PatternEventPayloadEnvelope(Double r, Integer n, Double p, Integer reinforcementCount, UUID factId)` with statics `empty()`, `snapshot(double r, int n, double p)`, `reinforced(int count)`, `promoted(UUID factId)`; `PatternEventRepository.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(UUID createdBy, UUID patternId)`; `PatternEventPopulator.snapshot(UUID createdBy, UUID patternId, double r, int n, double p, Instant occurredAt)`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- Minták lifecycle dashboard S1 (bd mezo-tk88.1, spec 2026-08-14 §Backend 1).
-- Append-only pattern history: one snapshot per LIVE nightly evaluation (confirmed rows
-- included — the judged row's stats stay FROZEN, only history accrues) + discrete
-- decision/reinforce/promote events. Band-crossing journal lines are DERIVED from
-- snapshots at render time, never stored. Rejected rows stay silent (no snapshot).

create table pattern_event (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    pattern_id  uuid        not null,
    kind        varchar(16) not null,
    occurred_at timestamptz not null default now(),
    payload     jsonb       not null default '{}'::jsonb,
    constraint pk_pattern_event_id primary key (id),
    constraint fk_pattern_event_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_pattern_event_pattern_id_pattern_id foreign key (pattern_id) references pattern (id) on delete cascade,
    constraint ck_pattern_event_kind check (kind in ('snapshot', 'confirmed', 'monitoring', 'rejected', 'reinforced', 'promoted'))
);

-- The detail read's ordering key (findByCreatedByAndPatternId...OrderByOccurredAtAsc).
create index idx_pattern_event_pattern_id_occurred_at on pattern_event (pattern_id, occurred_at);
```

Append to `1.0.0_master.yml` (same shape as the last entry):

```yaml
  - changeSet:
      id: "1.0.0:202608141000_mezo-tk88.1_create_pattern_event"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608141000_mezo-tk88.1_create_pattern_event.sql
```

- [ ] **Step 2: Entity + payload envelope + repository**

`PatternEventPayloadEnvelope.java`:

```java
package io.mrkuhne.mezo.feature.companion.entity;

import java.util.UUID;

/**
 * Typed jsonb payload of one {@link PatternEventEntity} (S1, spec 2026-08-14). All fields
 * nullable — each kind fills only its own: snapshot → r/n/p; reinforced → reinforcementCount;
 * promoted → factId; the three decision kinds carry an empty payload.
 */
public record PatternEventPayloadEnvelope(Double r, Integer n, Double p,
                                          Integer reinforcementCount, UUID factId) {

    public static PatternEventPayloadEnvelope empty() {
        return new PatternEventPayloadEnvelope(null, null, null, null, null);
    }

    public static PatternEventPayloadEnvelope snapshot(double r, int n, double p) {
        return new PatternEventPayloadEnvelope(r, n, p, null, null);
    }

    public static PatternEventPayloadEnvelope reinforced(int reinforcementCount) {
        return new PatternEventPayloadEnvelope(null, null, null, reinforcementCount, null);
    }

    public static PatternEventPayloadEnvelope promoted(UUID factId) {
        return new PatternEventPayloadEnvelope(null, null, null, null, factId);
    }
}
```

`PatternEventEntity.java` (mirror `PatternEntity`'s annotations — `@SQLDelete`/`@SQLRestriction`, `@JdbcTypeCode(SqlTypes.JSON)`):

```java
package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
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

import java.time.Instant;
import java.util.UUID;

/**
 * One entry of a pattern's append-only history (S1, spec 2026-08-14 §Backend 1): nightly
 * {@code snapshot}s (confirmed rows included — row stats frozen, history accrues), the user's
 * L2 decisions, V3.3 reinforcements and the first-confirm fact promotion. The FE derives the
 * strength chart from snapshots and the journal's band-crossing lines at render time.
 */
@Getter
@Setter
@Entity
@Table(name = "pattern_event")
@SQLDelete(sql = "update pattern_event set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PatternEventEntity extends OwnedEntity {

    public static final String KIND_SNAPSHOT = "snapshot";
    public static final String KIND_CONFIRMED = "confirmed";
    public static final String KIND_MONITORING = "monitoring";
    public static final String KIND_REJECTED = "rejected";
    public static final String KIND_REINFORCED = "reinforced";
    public static final String KIND_PROMOTED = "promoted";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "pattern_id", nullable = false, columnDefinition = "uuid")
    private UUID patternId;

    /** Mirrors ck_pattern_event_kind. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "snapshot|confirmed|monitoring|rejected|reinforced|promoted")
    @Column(nullable = false, length = 16)
    private String kind;

    @NotNull
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now();

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private PatternEventPayloadEnvelope payload = PatternEventPayloadEnvelope.empty();
}
```

`PatternEventRepository.java`:

```java
package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PatternEventRepository extends JpaRepository<PatternEventEntity, UUID> {

    List<PatternEventEntity> findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(
            UUID createdBy, UUID patternId);
}
```

- [ ] **Step 3: `ResetDatabase` + populator**

In `ResetDatabase.resetExceptMasterData()` add `pattern_event, ` immediately before `pattern, ` in the TRUNCATE string. New `PatternEventPopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.time.Instant;
import java.util.UUID;

/** Test data factory for {@code pattern_event} rows (S1). */
@TestComponent
@RequiredArgsConstructor
public class PatternEventPopulator {

    private final PatternEventRepository patternEventRepository;

    public PatternEventEntity snapshot(UUID createdBy, UUID patternId,
                                       double r, int n, double p, Instant occurredAt) {
        PatternEventEntity entity = new PatternEventEntity();
        entity.setCreatedBy(createdBy);
        entity.setPatternId(patternId);
        entity.setKind(PatternEventEntity.KIND_SNAPSHOT);
        entity.setOccurredAt(occurredAt);
        entity.setPayload(PatternEventPayloadEnvelope.snapshot(r, n, p));
        return patternEventRepository.saveAndFlush(entity);
    }
}
```

- [ ] **Step 4: Verify schema lands**

Run: `cd backend && ./mvnw clean test -Dtest=PatternDetectionServiceIT`
Expected: PASS (migration applies to `mezo_test`; no writer yet, existing tests untouched). Inspect: `psql -h localhost -p 15432 -U mezo mezo_test -c '\d pattern_event'` shows the table.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/support
git commit -m "feat(companion): pattern_event append-only history table (mezo-tk88.1)"
```

### Task 2: Snapshot + reinforce writers in `PatternDetectionService`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PatternDetectionServiceIT.java`

**Interfaces:**
- Consumes: Task 1 (`PatternEventEntity`, `PatternEventPayloadEnvelope`, `PatternEventRepository`).
- Produces: every LIVE evaluation of a non-rejected pair appends one `snapshot` event; a confirmed-row reinforcement appends a `reinforced` event.

- [ ] **Step 1: Write the failing tests** (append to `PatternDetectionServiceIT`; autowire `PatternEventRepository patternEventRepository`)

```java
@Test
void testDetect_shouldAppendSnapshotEvent_whenPairGoesLive() {
    UUID owner = userPopulator.createUser().getId();
    seedAntiCorrelatedDays(owner, 10);

    patternDetectionService.detect(owner);

    PatternEntity pattern = patternRepository
            .findByCreatedByAndKindAndPairKeyAndDeletedFalse(owner, PatternEntity.KIND_STATISTICAL, PAIR_KEY)
            .orElseThrow();
    List<PatternEventEntity> events = patternEventRepository
            .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, pattern.getId());
    assertThat(events).hasSize(1);
    assertThat(events.getFirst().getKind()).isEqualTo(PatternEventEntity.KIND_SNAPSHOT);
    assertThat(events.getFirst().getPayload().r()).isLessThan(-0.9);
    assertThat(events.getFirst().getPayload().n()).isEqualTo(10);
    assertThat(events.getFirst().getPayload().p()).isNotNull();
}

@Test
void testDetect_shouldAppendSnapshotButFreezeStats_whenRowConfirmed() {
    UUID owner = userPopulator.createUser().getId();
    seedAntiCorrelatedDays(owner, 10);
    PatternEntity judged = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_CONFIRMED);
    BigDecimal frozenR = judged.getR();

    patternDetectionService.detect(owner);

    PatternEntity after = patternRepository.findById(judged.getId()).orElseThrow();
    assertThat(after.getR()).isEqualByComparingTo(frozenR); // stats stay frozen (V3.1 contract)
    List<PatternEventEntity> events = patternEventRepository
            .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, judged.getId());
    assertThat(events).extracting(PatternEventEntity::getKind)
            .contains(PatternEventEntity.KIND_SNAPSHOT); // history accrues past the freeze
}

@Test
void testDetect_shouldStaySilent_whenRowRejected() {
    UUID owner = userPopulator.createUser().getId();
    seedAntiCorrelatedDays(owner, 10);
    PatternEntity judged = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_REJECTED);

    patternDetectionService.detect(owner);

    assertThat(patternEventRepository
            .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, judged.getId()))
            .isEmpty();
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && ./mvnw clean test -Dtest=PatternDetectionServiceIT`
Expected: the three new tests FAIL (no events written); existing tests PASS.

- [ ] **Step 3: Implement the writer**

In `PatternDetectionService` inject `private final PatternEventRepository patternEventRepository;` and add:

```java
/** S1 (mezo-tk88.1): one history snapshot per LIVE evaluation — the detail chart's raw data. */
private void recordSnapshot(PatternEntity pattern, PearsonCorrelation.Result result) {
    PatternEventEntity event = new PatternEventEntity();
    event.setCreatedBy(pattern.getCreatedBy());
    event.setPatternId(pattern.getId());
    event.setKind(PatternEventEntity.KIND_SNAPSHOT);
    event.setOccurredAt(Instant.now());
    event.setPayload(PatternEventPayloadEnvelope.snapshot(result.r(), result.n(), result.p()));
    patternEventRepository.saveAndFlush(event);
}
```

Wire it into `upsert(...)`:
- confirmed branch: after `reinforcePromotedFact(pattern, result);` add `recordSnapshot(pattern, result);` (before the `return`);
- rejected branch: unchanged (`return` — no snapshot);
- normal path: after `patternRepository.saveAndFlush(pattern);` add `recordSnapshot(pattern, result);`.

In `reinforcePromotedFact(...)`, inside the `ifPresent` lambda after `knowledgeFactRepository.saveAndFlush(fact);`, append a reinforced event:

```java
PatternEventEntity event = new PatternEventEntity();
event.setCreatedBy(pattern.getCreatedBy());
event.setPatternId(pattern.getId());
event.setKind(PatternEventEntity.KIND_REINFORCED);
event.setOccurredAt(Instant.now());
event.setPayload(PatternEventPayloadEnvelope.reinforced(fact.getReinforcementCount()));
patternEventRepository.saveAndFlush(event);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./mvnw clean test -Dtest=PatternDetectionServiceIT`
Expected: ALL PASS (including a `reinforced`-event assertion if the existing V3.3 reinforcement test is extended — add `assertThat(...).contains(KIND_REINFORCED)` where the fact bump is already asserted).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(companion): nightly job appends snapshot + reinforced pattern events (mezo-tk88.1)"
```

### Task 3: Decision + promotion writers in `PatternService`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternApiIT.java`

**Interfaces:**
- Consumes: Task 1 artifacts.
- Produces: every `decide()` appends one event of the resulting-status kind; the first confirm additionally appends `promoted` with `factId`.

- [ ] **Step 1: Write the failing test** (append to `CompanionPatternApiIT`; autowire `PatternEventRepository patternEventRepository`)

```java
@Test
void testDecidePattern_shouldAppendDecisionAndPromotedEvents_whenFirstConfirmThenMonitor() {
    PatternEntity pattern = patternPopulator.statistical(ownerId());

    postForBody("/api/companion/pattern/" + pattern.getId() + "/decision",
            new PatternDecisionRequest().decision("confirm"),
            ownerAuthHeaders(), HttpStatus.OK, PatternResponse.class);
    postForBody("/api/companion/pattern/" + pattern.getId() + "/decision",
            new PatternDecisionRequest().decision("monitor"),
            ownerAuthHeaders(), HttpStatus.OK, PatternResponse.class);

    List<PatternEventEntity> events = patternEventRepository
            .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(ownerId(), pattern.getId());
    assertThat(events).extracting(PatternEventEntity::getKind).containsExactly(
            PatternEventEntity.KIND_CONFIRMED,
            PatternEventEntity.KIND_PROMOTED,
            PatternEventEntity.KIND_MONITORING);
    assertThat(events.get(1).getPayload().factId())
            .isEqualTo(patternRepository.findById(pattern.getId()).orElseThrow().getPromotedFactId());
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=CompanionPatternApiIT`
Expected: new test FAILS (no events), rest PASS.

- [ ] **Step 3: Implement**

In `PatternService`: inject `private final PatternEventRepository patternEventRepository;`. In `decide(...)` after `pattern.setStatus(status);` and the promotion block, append (order: decision first, then promoted — the promotion happens because of the decision):

```java
recordEvent(pattern, status, PatternEventPayloadEnvelope.empty());
if (PatternEntity.STATUS_CONFIRMED.equals(status) && pattern.getPromotedFactId() == null) {
    pattern.setPromotedFactId(promote(userId, pattern));
    recordEvent(pattern, PatternEventEntity.KIND_PROMOTED,
            PatternEventPayloadEnvelope.promoted(pattern.getPromotedFactId()));
}
```

(The existing `if (...) promote` block is replaced by this — the decision-status event fires on EVERY transition, `promoted` only on first confirm.) Add:

```java
/** S1 (mezo-tk88.1): the L2 decisions are part of the pattern's durable story. */
private void recordEvent(PatternEntity pattern, String kind, PatternEventPayloadEnvelope payload) {
    PatternEventEntity event = new PatternEventEntity();
    event.setCreatedBy(pattern.getCreatedBy());
    event.setPatternId(pattern.getId());
    event.setKind(kind);
    event.setOccurredAt(Instant.now());
    event.setPayload(payload);
    patternEventRepository.saveAndFlush(event);
}
```

Note: the decision-status strings (`confirmed`/`monitoring`/`rejected`) are intentionally identical to the event kinds — no mapping needed.

- [ ] **Step 4: Run the companion suite**

Run: `cd backend && ./mvnw clean test -Dtest='Companion*IT,Pattern*IT'`
Expected: ALL PASS.

- [ ] **Step 5: Docs + commit + slice close**

Update `docs/features/companion.md` (V3.1 section: note the append-only history + writers with `file:line` pointers) → `node scripts/lint-docs.mjs` → commit:

```bash
git add backend docs
git commit -m "feat(companion): pattern decisions + promotion append history events (mezo-tk88.1)"
```

Then the standing flow: `./mvnw clean test` full, push branch, self-PR, CI green, `--no-ff` merge, `bd close mezo-tk88.1`.

---

# Slice S2 — `source_pattern_id` traceability (`mezo-tk88.2`, branch `feat/source-pattern-id`)

### Task 4: Three additive migrations + entity fields

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608141100_mezo-tk88.2_prediction_source_pattern.sql` (+ `..._1110_..._experiment_source_pattern.sql`, `..._1120_..._challenge_source_pattern.sql`)
- Modify: `1.0.0_master.yml` (3 changeSets)
- Modify: `PredictionEntity.java`, `ExperimentEntity.java`, `ChallengeEntity.java` (`feature/proactive/entity/`)

**Interfaces:**
- Produces: `sourcePatternId: UUID` (nullable) getter/setter on all three entities; column `source_pattern_id` on tables `prediction`, `experiment`, `challenge`.

- [ ] **Step 1: Write the migrations** (one per table — identical shape, adjust names):

```sql
-- Minták lifecycle dashboard S2 (bd mezo-tk88.2, spec 2026-08-14 §Backend 3).
-- The generators already resolve the model's patternIndex to a confirmed PatternEntity
-- (the confidence copy) — now the grounding is queryable. Pre-existing rows stay NULL.

alter table prediction add column source_pattern_id uuid;

alter table prediction add constraint fk_prediction_source_pattern_id_pattern_id
    foreign key (source_pattern_id) references pattern (id) on delete set null;

create index idx_prediction_source_pattern_id on prediction (source_pattern_id)
    where source_pattern_id is not null;
```

- [ ] **Step 2: Entity fields** (same on all three):

```java
/** S2 (mezo-tk88.2): the grounding pattern (loose ref, ON DELETE SET NULL) — the detail page's impact list. */
@Column(name = "source_pattern_id", columnDefinition = "uuid")
private UUID sourcePatternId;
```

- [ ] **Step 3: Verify migrations apply**

Run: `cd backend && ./mvnw clean test -Dtest=PredictionPersistenceIT`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main
git commit -m "feat(proactive): source_pattern_id columns on prediction/experiment/challenge (mezo-tk88.2)"
```

### Task 5: Generators store the grounding id + repository finders

**Files:**
- Modify: `PredictionGenerator.java`, `ExperimentProposalGenerator.java`, `ChallengeGenerator.java` (`feature/proactive/service/`)
- Modify: `PredictionRepository.java`, `ExperimentRepository.java`, `ChallengeRepository.java` (`feature/proactive/repository/`)
- Test: `PredictionJobIT.java`, `ExperimentProposalGeneratorIT.java`, `ChallengePersistenceIT.java` (`feature/proactive/`)

**Interfaces:**
- Consumes: Task 4 fields.
- Produces: `findByCreatedByAndSourcePatternIdAndDeletedFalse(UUID createdBy, UUID sourcePatternId)` on all three repositories (S3 consumes these); generator rows carry `sourcePatternId`.

- [ ] **Step 1: Write the failing assertions** — each generator IT already has a canned-LLM-answer test whose fake answer carries `patternIndex: 0` and asserts the confidence copy from the seeded confirmed pattern. Extend THAT test in each file with:

```java
assertThat(saved.getFirst().getSourcePatternId()).isEqualTo(confirmedPattern.getId());
```

(match the local variable names of each test; the seeded confirmed `PatternEntity` is already in scope there — it grounds the confidence assertion). Also add one out-of-range guard test per generator IT:

```java
// patternIndex out of range → NO grounding link, row still saved (mirror of resolveConfidence null)
assertThat(saved.getFirst().getSourcePatternId()).isNull();
```

in the existing test that covers the invalid/missing `patternIndex` branch (each generator IT has one for the confidence-null path).

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && ./mvnw clean test -Dtest='PredictionJobIT,ExperimentProposalGeneratorIT,ChallengePersistenceIT'`
Expected: extended tests FAIL (`getSourcePatternId` returns null where an id is expected).

- [ ] **Step 3: Implement** — one helper per generator (next to the existing `resolveConfidence`):

```java
/** S2 (mezo-tk88.2): same index resolution as resolveConfidence — the grounding made queryable. */
private UUID resolveSourcePatternId(Integer index, List<PatternEntity> candidates) {
    if (index == null || index < 0 || index >= candidates.size()) {
        return null;
    }
    return candidates.get(index).getId();
}
```

Call sites: `PredictionGenerator` save loop → `e.setSourcePatternId(resolveSourcePatternId(p.patternIndex(), gather.candidates()));` · `ExperimentProposalGenerator` save loop → same with `gather.candidates()` · `ChallengeGenerator.toEntity` → `e.setSourcePatternId(resolveSourcePatternId(p.patternIndex(), gather.patterns()));`. Add the repository finder to all three repositories:

```java
List<PredictionEntity> findByCreatedByAndSourcePatternIdAndDeletedFalse(UUID createdBy, UUID sourcePatternId);
```

- [ ] **Step 4: Run to verify green**

Run: `cd backend && ./mvnw clean test -Dtest='PredictionJobIT,ExperimentProposalGeneratorIT,ChallengePersistenceIT'`
Expected: ALL PASS.

- [ ] **Step 5: Docs + commit + slice close**

`docs/features/proactive.md`: one line per generator noting the stored grounding (+ pointers). `node scripts/lint-docs.mjs`. Commit `feat(proactive): generators persist the grounding pattern id (mezo-tk88.2)`. Full `./mvnw clean test`, push, self-PR, CI, merge, `bd close mezo-tk88.2`.

---

# Slice S3 — pair detail endpoint (`mezo-tk88.3`, branch `feat/pattern-pair-detail`)

### Task 6: Contract fragment + regeneration

**Files:**
- Modify: `api/feature/companion/companion.yml` (path + 6 schemas)
- Regenerate: `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`

**Interfaces:**
- Produces: generated `CompanionApi.patternPairDetail(String pairKey)` + DTOs `PatternPairDetailResponse`, `PatternEventResponse`, `AlignedDayResponse`, `PatternImpactResponse`, `PatternImpactFact`, `PatternImpactRef`; FE types in `api.gen.ts`.

- [ ] **Step 1: Add the path** (after `/api/companion/pattern/monitor`):

```yaml
  /api/companion/pattern/pair/{pairKey}:
    get:
      tags: [Companion]
      operationId: patternPairDetail
      summary: >-
        Egy katalógus-pár teljes részletező nézete (mezo-tk88.3): pár-meta + élő kapu-állapot
        (a monitor matekja), a perzisztált minta (ha van), az append-only esemény-történet,
        az illesztett napok (élőben számolva — sosem tárolt), és a hatás-lista (tény +
        source_pattern_id hivatkozók). Sor nélküli párra is válaszol (pattern: null).
      parameters:
        - name: pairKey
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: A pár részletei
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PatternPairDetailResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Unknown pair key (not in the catalog)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

- [ ] **Step 2: Add the schemas** (next to `PatternMetricCoverage`):

```yaml
    PatternPairDetailResponse:
      type: object
      required: [pair, events, days, impact]
      properties:
        pair: { $ref: '#/components/schemas/PatternMonitorPair' }
        pattern:
          allOf: [{ $ref: '#/components/schemas/PatternResponse' }]
          nullable: true
          description: 'A perzisztált minta-sor — null, amíg a pár nem ment át a kapun (még gyűlik).'
        events:
          type: array
          items: { $ref: '#/components/schemas/PatternEventResponse' }
          description: 'Append-only történet, occurred_at szerint növekvő.'
        days:
          type: array
          items: { $ref: '#/components/schemas/AlignedDayResponse' }
          description: 'Az AKTUÁLIS ablak illesztett napjai — élőben számolva, sosem tárolt.'
        impact: { $ref: '#/components/schemas/PatternImpactResponse' }
    PatternEventResponse:
      type: object
      required: [kind, occurredAt]
      properties:
        kind: { type: string, pattern: '^(snapshot|confirmed|monitoring|rejected|reinforced|promoted)$' }
        occurredAt: { type: string, format: date-time }
        r: { type: number, format: double, nullable: true }
        n: { type: integer, nullable: true }
        p: { type: number, format: double, nullable: true }
        reinforcementCount: { type: integer, nullable: true }
        factId: { type: string, format: uuid, nullable: true }
    AlignedDayResponse:
      type: object
      required: [date, a, b]
      properties:
        date: { type: string, format: date, description: 'metric-a napja (metric-b lagDays-szel később olvasódik).' }
        a: { type: number, format: double }
        b: { type: number, format: double }
    PatternImpactResponse:
      type: object
      required: [predictions, experiments, challenges]
      properties:
        fact:
          allOf: [{ $ref: '#/components/schemas/PatternImpactFact' }]
          nullable: true
        predictions:
          type: array
          items: { $ref: '#/components/schemas/PatternImpactRef' }
        experiments:
          type: array
          items: { $ref: '#/components/schemas/PatternImpactRef' }
        challenges:
          type: array
          items: { $ref: '#/components/schemas/PatternImpactRef' }
    PatternImpactFact:
      type: object
      required: [id, text, reinforcementCount, includeInPrompt]
      properties:
        id: { type: string, format: uuid }
        text: { type: string }
        reinforcementCount: { type: integer }
        includeInPrompt: { type: boolean }
    PatternImpactRef:
      type: object
      required: [id, title, status]
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        status: { type: string, description: 'A hivatkozó sor saját státusza (pending/validated/missed · proposed/active/completed/dismissed …).' }
```

- [ ] **Step 3: Regenerate + verify compile fails on the unimplemented interface**

Run: `cd api/generate && npm run generate:api && cd ../../backend && ./mvnw clean compile`
Expected: FAIL — `CompanionController` does not implement `patternPairDetail` (proves the generated seam exists).

- [ ] **Step 4: Commit**

```bash
git add api
git commit -m "feat(api): pattern pair detail contract (mezo-tk88.3)"
```

### Task 7: `PatternPairDetailService` + controller + 404 message

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternPairDetailService.java`
- Modify: `PatternMonitorService.java` (widen `toPair` and `statisticalRowsByPairKey` from `private` to package-private so the detail service reuses the EXACT monitor math — no duplicated gate logic)
- Modify: `CompanionMapper.java` (`toPatternEventResponse`)
- Modify: `CompanionController.java` (implement `patternPairDetail`)
- Modify: `backend/src/main/resources/messages.properties` (add `COMPANION_PATTERN_PAIR_NOT_FOUND=Pattern pair not found.`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternPairDetailApiIT.java`

**Interfaces:**
- Consumes: S1 repository/finder, S2 repository finders, `PatternMonitorService.toPair(...)`, `MetricSeriesService.series(UUID, MetricKey, LocalDate, LocalDate)`, `PatternGate.window(...)`, `CompanionProperties.patterns()`.
- Produces: `PatternPairDetailResponse patternPairDetail(UUID userId, String pairKey)`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PatternPairDetailResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** mezo-tk88.3: the one-stop detail read — meta+gate, nullable row, events, live days, impact. */
@ActiveProfiles("companion-fake")
class CompanionPatternPairDetailApiIT extends ApiIntegrationTest {

    private static final String PAIR_KEY = "checkin-stress~sleep-quality";

    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private void seedAlignedDays(UUID owner, int days) {
        for (int i = 0; i < days; i++) {
            LocalDate day = LocalDate.now().minusDays(1L + i);
            int stress = (i % 5) + 1;
            checkInPopulator.createCheckIn(owner, day, "08:00", 3, stress, null);
            sleepLogPopulator.createSleepLog(owner, day, new BigDecimal("7.0"), 6 - stress);
        }
    }

    @Test
    void testPatternPairDetail_shouldReturnRowEventsDaysAndGate_whenPairHasHistory() {
        UUID owner = ownerId();
        seedAlignedDays(owner, 10);
        PatternEntity row = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_PROPOSED);
        patternEventPopulator.snapshot(owner, row.getId(), -0.55, 10, 0.06, Instant.now());

        PatternPairDetailResponse detail = getForBody("/api/companion/pattern/pair/" + PAIR_KEY,
                ownerAuthHeaders(), HttpStatus.OK, PatternPairDetailResponse.class);

        assertThat(detail.getPair().getKey()).isEqualTo(PAIR_KEY);
        assertThat(detail.getPattern()).isNotNull();
        assertThat(detail.getPattern().getId()).isEqualTo(row.getId());
        assertThat(detail.getEvents()).hasSize(1);
        assertThat(detail.getEvents().getFirst().getKind()).isEqualTo("snapshot");
        assertThat(detail.getDays()).hasSize(10); // lag 0 — every seeded day aligns
        assertThat(detail.getImpact().getPredictions()).isEmpty();
    }

    @Test
    void testPatternPairDetail_shouldReturnNullPattern_whenPairNeverWentLive() {
        PatternPairDetailResponse detail = getForBody("/api/companion/pattern/pair/" + PAIR_KEY,
                ownerAuthHeaders(), HttpStatus.OK, PatternPairDetailResponse.class);

        assertThat(detail.getPattern()).isNull();
        assertThat(detail.getEvents()).isEmpty();
        assertThat(detail.getPair().getVerdict()).isIn("no_data", "few_days");
    }

    @Test
    void testPatternPairDetail_shouldReturn404_whenPairKeyUnknown() {
        getForBody("/api/companion/pattern/pair/nonsense~pair",
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
```

(Use the house `ApiIntegrationTest` verb helpers — if `getForBody` differs, mirror `CompanionPatternApiIT`'s `getForList`/`postForBody` idioms.) Also extend with an impact test once implemented: seed a confirmed row + a prediction via its populator with `setSourcePatternId(row.getId())` and assert `detail.getImpact().getPredictions()` carries it.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=CompanionPatternPairDetailApiIT`
Expected: FAIL (compile error — controller method missing).

- [ ] **Step 3: Implement the service**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.AlignedDayResponse;
import io.mrkuhne.mezo.api.dto.PatternImpactFact;
import io.mrkuhne.mezo.api.dto.PatternImpactRef;
import io.mrkuhne.mezo.api.dto.PatternImpactResponse;
import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternPairDetailResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * mezo-tk88.3: the pattern detail page's single read. Reuses the monitor's EXACT pair math
 * ({@link PatternMonitorService#toPair}) so the detail can never disagree with the dashboard;
 * days are computed live from the current window (frozen rows honestly show today's data).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PatternPairDetailService {

    private final PatternMonitorService patternMonitorService;
    private final MetricSeriesService metricSeriesService;
    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final PredictionRepository predictionRepository;
    private final ExperimentRepository experimentRepository;
    private final ChallengeRepository challengeRepository;
    private final CompanionProperties properties;
    private final CompanionMapper mapper;

    @Transactional(readOnly = true)
    public PatternPairDetailResponse detail(UUID userId, String pairKey) {
        CompanionProperties.Patterns config = properties.patterns();
        CompanionProperties.PatternPair pair = config.pairs().stream()
                .filter(p -> p.key().equals(pairKey))
                .findFirst()
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("COMPANION_PATTERN_PAIR_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(config.lookbackDays() - 1L);

        Map<MetricKey, Map<LocalDate, Double>> cache = new EnumMap<>(MetricKey.class);
        cache.put(pair.metricA(), metricSeriesService.series(userId, pair.metricA(), from, to.plusDays(pair.lagDays())));
        if (pair.metricA() != pair.metricB()) {
            cache.put(pair.metricB(), metricSeriesService.series(userId, pair.metricB(), from, to.plusDays(pair.lagDays())));
        }

        PatternEntity row = patternRepository
                .findByCreatedByAndKindAndPairKeyAndDeletedFalse(userId, PatternEntity.KIND_STATISTICAL, pairKey)
                .orElse(null);
        PatternMonitorPair monitorPair = patternMonitorService.toPair(pair, cache, row, config.minN(), from, to);

        return PatternPairDetailResponse.builder()
                .pair(monitorPair)
                .pattern(row == null ? null : mapper.toPatternResponse(row))
                .events(row == null ? List.of() : patternEventRepository
                        .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(userId, row.getId())
                        .stream().map(mapper::toPatternEventResponse).toList())
                .days(alignedDays(cache, pair, from, to))
                .impact(impact(userId, row))
                .build();
    }

    private List<AlignedDayResponse> alignedDays(Map<MetricKey, Map<LocalDate, Double>> cache,
                                                 CompanionProperties.PatternPair pair,
                                                 LocalDate from, LocalDate to) {
        Map<LocalDate, Double> seriesA = PatternGate.window(cache.get(pair.metricA()), from, to);
        Map<LocalDate, Double> seriesB = PatternGate.window(cache.get(pair.metricB()),
                from.plusDays(pair.lagDays()), to.plusDays(pair.lagDays()));
        List<AlignedDayResponse> out = new ArrayList<>();
        seriesA.forEach((day, a) -> {
            Double b = seriesB.get(day.plusDays(pair.lagDays()));
            if (b != null) {
                out.add(AlignedDayResponse.builder().date(day).a(a).b(b).build());
            }
        });
        out.sort(java.util.Comparator.comparing(AlignedDayResponse::getDate));
        return out;
    }

    private PatternImpactResponse impact(UUID userId, PatternEntity row) {
        PatternImpactResponse.PatternImpactResponseBuilder builder = PatternImpactResponse.builder()
                .fact(null).predictions(List.of()).experiments(List.of()).challenges(List.of());
        if (row == null) {
            return builder.build();
        }
        if (row.getPromotedFactId() != null) {
            knowledgeFactRepository.findById(row.getPromotedFactId())
                    .filter(f -> !f.isDeleted())
                    .ifPresent(f -> builder.fact(PatternImpactFact.builder()
                            .id(f.getId())
                            .text(f.getFactText())
                            .reinforcementCount(f.getReinforcementCount())
                            .includeInPrompt(f.isIncludeInPrompt())
                            .build()));
        }
        builder.predictions(predictionRepository
                .findByCreatedByAndSourcePatternIdAndDeletedFalse(userId, row.getId()).stream()
                .map(e -> PatternImpactRef.builder().id(e.getId()).title(e.getTitle()).status(e.getStatus()).build())
                .toList());
        builder.experiments(experimentRepository
                .findByCreatedByAndSourcePatternIdAndDeletedFalse(userId, row.getId()).stream()
                .map(e -> PatternImpactRef.builder().id(e.getId()).title(e.getTitle()).status(e.getStatus()).build())
                .toList());
        builder.challenges(challengeRepository
                .findByCreatedByAndSourcePatternIdAndDeletedFalse(userId, row.getId()).stream()
                .map(e -> PatternImpactRef.builder().id(e.getId()).title(e.getTitle()).status(e.getStatus()).build())
                .toList());
        return builder.build();
    }
}
```

Adjust to reality while implementing: `KnowledgeFactEntity`'s exact getter names (`getFactText`, `getReinforcementCount`, `isIncludeInPrompt` — verify in the entity) and generated-builder shapes (`nullable` wrappers may generate `JsonNullable` depending on generator config — mirror whatever `PatternResponse.critique` does today). If `feature/proactive` → `feature/companion` imports trip the ArchUnit package-cycle test, invert: move the three impact finder calls behind a small `PatternImpactSource` interface in `feature/companion` implemented in `feature/proactive` (check `ArchitectureTest` first; companion → proactive direction may simply be allowed since proactive already imports companion — in that case put this service's impact block in a `feature/proactive` service `PatternImpactService` and inject it here).

`CompanionMapper` addition:

```java
default io.mrkuhne.mezo.api.dto.PatternEventResponse toPatternEventResponse(
        io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity entity) {
    return io.mrkuhne.mezo.api.dto.PatternEventResponse.builder()
            .kind(entity.getKind())
            .occurredAt(entity.getOccurredAt().atOffset(java.time.ZoneOffset.UTC))
            .r(entity.getPayload().r())
            .n(entity.getPayload().n())
            .p(entity.getPayload().p())
            .reinforcementCount(entity.getPayload().reinforcementCount())
            .factId(entity.getPayload().factId())
            .build();
}
```

`PatternMonitorService`: change `private PatternMonitorPair toPair(...)` → `PatternMonitorPair toPair(...)` (package-private; same package). Controller:

```java
@Override
public PatternPairDetailResponse patternPairDetail(String pairKey) {
    return patternPairDetailService.detail(currentUserId.get(), pairKey);
}
```

- [ ] **Step 4: Run to verify green + impact case**

Run: `cd backend && ./mvnw clean test -Dtest=CompanionPatternPairDetailApiIT`
Expected: ALL PASS (add the impact-list test now — seed confirmed row + prediction with `sourcePatternId`, assert the ref appears with its title/status).

- [ ] **Step 5: Docs + commit + slice close**

`docs/features/companion.md` §API table + `insights.md` §3 (data layer) get the endpoint row. Lint. Commit `feat(companion): pattern pair detail endpoint (mezo-tk88.3)`. Full suite, push, PR, CI, merge, `bd close mezo-tk88.3`.

---

# Slice S4 — FE lifecycle dashboard + Motor retirement (`mezo-tk88.4`, branch `feat/patterns-lifecycle-dashboard`)

Read `docs/references/frontend_conventions.md` FIRST. All copy verbatim from the mockup.

### Task 8: Pure lifecycle merge logic

**Files:**
- Modify: `frontend/src/data/insights/insights.ts` (add `STRONG_SIGNAL`)
- Create: `frontend/src/features/insights/logic/lifecycle.ts`
- Create: `frontend/src/features/insights/logic/verdicts.ts` (move `verdictSentence` out of `PairRow.tsx` unchanged, same signature `verdictSentence(pair: PatternMonitorPair, bottleneckCoveredDays: number | null): string`)
- Test: `frontend/src/features/insights/logic/lifecycle.test.ts`

**Interfaces:**
- Produces:

```ts
// insights.ts
export const STRONG_SIGNAL = { minAbsR: 0.3, maxP: 0.15 } // a döntés-inbox küszöbe (spec: display-layer)

// lifecycle.ts
export type LifecycleBucket = 'decide' | 'monitoring' | 'confirmed' | 'gathering' | 'noRelationship' | 'rejected'
export interface LifecycleEntry {
  key: string                       // pairKey
  pattern: Pattern | null
  pair: PatternMonitorPair | null
  bucket: LifecycleBucket
}
export function isStrongSignal(r: number | null | undefined, p: number | null | undefined): boolean
export function bucketize(patterns: Pattern[], monitor: PatternMonitor | null): Map<LifecycleBucket, LifecycleEntry[]>
export const BUCKET_ORDER: LifecycleBucket[] // decide, monitoring, confirmed, gathering, noRelationship, rejected
```

- [ ] **Step 1: Write the failing tests**

```ts
import { bucketize, isStrongSignal } from '@/features/insights/logic/lifecycle'
import { patterns as mockPatterns, patternMonitor } from '@/data/insights/insights'
import type { Pattern, PatternMonitor, PatternMonitorPair } from '@/data/types'

const pair = (over: Partial<PatternMonitorPair>): PatternMonitorPair => ({
  ...patternMonitor.pairs[0], ...over,
})
const pattern = (over: Partial<Pattern>): Pattern => ({
  id: 'p1', pairKey: 'k1', category: 'physiology', categoryLabel: 'Fiziológia',
  title: 't', mechanism: 'm', evidence: [], kind: 'statistical', status: 'proposed', ...over,
})

describe('isStrongSignal', () => {
  test('needs BOTH |r| >= 0.3 AND p <= 0.15', () => {
    expect(isStrongSignal(-0.37, 0.14)).toBe(true)
    expect(isStrongSignal(-0.37, 0.188)).toBe(false) // a screenshot Hétvége-sora — nem inbox
    expect(isStrongSignal(0.0, 1.0)).toBe(false)     // a Reta-sor — nem inbox
    expect(isStrongSignal(0.29, 0.01)).toBe(false)
    expect(isStrongSignal(null, 0.05)).toBe(false)
  })
})

describe('bucketize', () => {
  test('proposed strong statistical row → decide; weak → noRelationship', () => {
    const monitor: PatternMonitor = { ...patternMonitor, pairs: [
      pair({ key: 'k1', verdict: 'live', r: -0.55, n: 20, p: 0.01 }),
      pair({ key: 'k2', verdict: 'live', r: 0.0, n: 14, p: 1.0 }),
    ] }
    const buckets = bucketize(
      [pattern({ id: 'a', pairKey: 'k1' }), pattern({ id: 'b', pairKey: 'k2' })], monitor)
    expect(buckets.get('decide')!.map((e) => e.key)).toEqual(['k1'])
    expect(buckets.get('noRelationship')!.map((e) => e.key)).toEqual(['k2'])
  })

  test('user-judged statuses win over strength', () => {
    const monitor: PatternMonitor = { ...patternMonitor, pairs: [pair({ key: 'k1', verdict: 'frozen', r: 0.0, p: 1.0 })] }
    const buckets = bucketize([pattern({ pairKey: 'k1', status: 'confirmed' })], monitor)
    expect(buckets.get('confirmed')).toHaveLength(1)
    expect(buckets.get('noRelationship')).toHaveLength(0)
  })

  test('pairs without a pattern row land in gathering', () => {
    const monitor: PatternMonitor = { ...patternMonitor, pairs: [pair({ key: 'k9', verdict: 'few_days', missingDays: 3, r: null, n: null, p: null })] }
    const buckets = bucketize([], monitor)
    expect(buckets.get('gathering')!.map((e) => e.key)).toEqual(['k9'])
    expect(buckets.get('gathering')![0].pattern).toBeNull()
  })

  test('hypothesis rows gate on confidence, not r/p', () => {
    const buckets = bucketize(
      [pattern({ pairKey: 'h1', kind: 'ai_hypothesis', confidence: 0.8 }),
       pattern({ id: 'p2', pairKey: 'h2', kind: 'ai_hypothesis', confidence: 0.5 })], null)
    expect(buckets.get('decide')!.map((e) => e.key)).toEqual(['h1'])
    expect(buckets.get('noRelationship')!.map((e) => e.key)).toEqual(['h2'])
  })

  test('degraded monitor (null) → proposed statistical rows stay in decide (server gate passed)', () => {
    const buckets = bucketize([pattern({ pairKey: 'k1' })], null)
    expect(buckets.get('decide')).toHaveLength(1)
  })

  test('decide sorts by |r| desc (strongest asks first)', () => {
    const monitor: PatternMonitor = { ...patternMonitor, pairs: [
      pair({ key: 'k1', verdict: 'live', r: -0.35, n: 20, p: 0.05 }),
      pair({ key: 'k2', verdict: 'live', r: 0.6, n: 20, p: 0.01 }),
    ] }
    const buckets = bucketize(
      [pattern({ id: 'a', pairKey: 'k1' }), pattern({ id: 'b', pairKey: 'k2' })], monitor)
    expect(buckets.get('decide')!.map((e) => e.key)).toEqual(['k2', 'k1'])
  })
})
```

- [ ] **Step 2: Run to verify failure** — `cd frontend && pnpm vitest run src/features/insights/logic/lifecycle.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lifecycle.ts`**

```ts
import { MIN_PATTERN_CONFIDENCE, STRONG_SIGNAL } from '@/data/insights/insights'
import type { Pattern, PatternMonitor, PatternMonitorPair } from '@/data/types'

/** A dashboard hat életciklus-kosara (spec 2026-08-14) — a szekció-sorrend is. */
export type LifecycleBucket = 'decide' | 'monitoring' | 'confirmed' | 'gathering' | 'noRelationship' | 'rejected'
export const BUCKET_ORDER: LifecycleBucket[] = ['decide', 'monitoring', 'confirmed', 'gathering', 'noRelationship', 'rejected']

export interface LifecycleEntry {
  key: string
  pattern: Pattern | null
  pair: PatternMonitorPair | null
  bucket: LifecycleBucket
}

/** A döntés-inbox küszöbe — MEGJELENÍTÉSI szabály, a kapu/perzisztencia érintetlen. */
export function isStrongSignal(r: number | null | undefined, p: number | null | undefined): boolean {
  return r != null && p != null && Math.abs(r) >= STRONG_SIGNAL.minAbsR && p <= STRONG_SIGNAL.maxP
}

function bucketFor(pattern: Pattern, pair: PatternMonitorPair | null): LifecycleBucket {
  switch (pattern.status ?? 'proposed') {
    case 'confirmed': return 'confirmed'
    case 'monitoring': return 'monitoring'
    case 'rejected': return 'rejected'
    case 'proposed':
      if (pattern.kind === 'ai_hypothesis') {
        return pattern.confidence != null && pattern.confidence >= MIN_PATTERN_CONFIDENCE ? 'decide' : 'noRelationship'
      }
      // statistical: a monitor élő r/p-je dönt; monitor híján (degraded) a szerver-kapu már átengedte → kérdezzünk
      if (pair == null || pair.r == null || pair.p == null) return 'decide'
      return isStrongSignal(pair.r, pair.p) ? 'decide' : 'noRelationship'
  }
}

export function bucketize(patterns: Pattern[], monitor: PatternMonitor | null): Map<LifecycleBucket, LifecycleEntry[]> {
  const buckets = new Map<LifecycleBucket, LifecycleEntry[]>(BUCKET_ORDER.map((b) => [b, []]))
  const pairsByKey = new Map((monitor?.pairs ?? []).map((p) => [p.key, p]))
  const seenPairKeys = new Set<string>()

  for (const pattern of patterns) {
    const pair = pairsByKey.get(pattern.pairKey) ?? null
    if (pair) seenPairKeys.add(pair.key)
    const bucket = bucketFor(pattern, pair)
    buckets.get(bucket)!.push({ key: pattern.pairKey, pattern, pair, bucket })
  }
  // sor nélküli párok: still gathering — a few_days/no_data/degenerate nudge a képviselőjük;
  // egy LIVE-de-még-sor-nélküli pár is ide esik (ma éjjel dolgozza fel a job)
  for (const pair of monitor?.pairs ?? []) {
    if (!seenPairKeys.has(pair.key)) {
      buckets.get('gathering')!.push({ key: pair.key, pattern: null, pair, bucket: 'gathering' })
    }
  }
  buckets.get('decide')!.sort((x, y) => Math.abs(y.pair?.r ?? 0) - Math.abs(x.pair?.r ?? 0))
  return buckets
}
```

Add to `insights.ts` next to `MIN_PATTern_CONFIDENCE` (exact name `MIN_PATTERN_CONFIDENCE`):

```ts
/** A döntés-inbox erősség-küszöbe (spec 2026-08-14): |r| >= minAbsR ÉS p <= maxP — az
 *  "ígéretes jel" határa (confidenceMeta). Alatta a lelet "nincs összefüggés" — eredmény,
 *  nem döntés-kérés. */
export const STRONG_SIGNAL = { minAbsR: 0.3, maxP: 0.15 }
```

Create `logic/verdicts.ts` by MOVING `verdictSentence` + `bottleneckLabel` from `PairRow.tsx` verbatim (export both); update `PairRow.tsx` to import from it temporarily (deleted next task) and move its `verdictSentence` tests if any live in `MotorPage.test.tsx` → `verdicts.test.ts`.

- [ ] **Step 4: Run to verify green** — `pnpm vitest run src/features/insights/logic/` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(insights): lifecycle bucketing logic + strength gate (mezo-tk88.4)"`

### Task 9: Dashboard components

**Files:**
- Create: `frontend/src/features/insights/components/MotorStateHero.tsx`
- Create: `frontend/src/features/insights/components/PatternDecisionCard.tsx`
- Create: `frontend/src/features/insights/components/LifecycleSection.tsx`
- Test: `frontend/src/features/insights/components/PatternDecisionCard.test.tsx`

**Interfaces:**
- Consumes: Task 8 types; `findingSentence`/`confidenceMeta`/`pairLine` from `logic/findings.ts`; `DOMAIN_META`, `DOMAIN_ORDER` from `logic/domains.ts`; `usePatternActions` decide signature `(id: string, decision: PatternStatus) => void`.
- Produces:

```ts
export function MotorStateHero(props: {
  monitor: PatternMonitor | null
  counts: Record<LifecycleBucket, number>
  activeDomains: Set<MetricDomain>
  onToggleDomain: (d: MetricDomain) => void
}): JSX.Element

export function PatternDecisionCard(props: {
  pattern: Pattern
  pair: PatternMonitorPair | null
  onDecide: (d: PatternStatus) => void
  showExplainer?: boolean          // csak az inbox ELSŐ kártyáján
}): JSX.Element

export function LifecycleSection(props: {
  title: string                    // pl. "✓ Megerősítve — él a tudásban"
  accent: string                   // CSS color var a címhez
  count: number
  defaultOpen?: boolean
  footNote?: string
  children: React.ReactNode
}): JSX.Element                    // count === 0 → renders nothing

export function LifecycleMiniRow(props: { title: string; sub: string; to: string }): JSX.Element
```

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PatternDecisionCard } from '@/features/insights/components/PatternDecisionCard'
import { patterns as mockPatterns, patternMonitor } from '@/data/insights/insights'

const statistical = mockPatterns.find((p) => p.kind === 'statistical' && p.status === 'proposed')!
const pair = patternMonitor.pairs.find((p) => p.key === statistical.pairKey) ?? patternMonitor.pairs[0]

test('renders question title, decision verbs and the detail link', () => {
  render(
    <MemoryRouter>
      <PatternDecisionCard pattern={statistical} pair={pair} onDecide={() => {}} showExplainer />
    </MemoryRouter>,
  )
  expect(screen.getByText(pair.questionHu)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Megerősítem/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Figyeljük' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Elvetem' })).toBeInTheDocument()
  expect(screen.getByText('Mi történik a döntéseddel')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Részletek és előzmények/ }))
    .toHaveAttribute('href', `/insights/patterns/${pair.key}`)
  // nyers statisztika SOSEM a kártyán:
  expect(screen.queryByText(/r=/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/features/insights/components/PatternDecisionCard.test.tsx` → FAIL.

- [ ] **Step 3: Implement the three components** — visual structure + copy from the mockup (`.card` + rail in `patternCategoryColor(pattern.category)`, domain chip via `DOMAIN_META[pair.metricBDomain]`, confidence chip from `confidenceMeta(pair.n, pair.p)` when both non-null else the `tanulom` eyebrow, question title `pair?.questionHu ?? pattern.title`, pair line `pairLine(pair)`, "📈 Amit eddig látunk" box with `findingSentence(pair)` bold-strength composition — fall back to `pattern.mechanism` when `pair?.r == null`). Explainer block copy (showExplainer only):

```
Mi történik a döntéseddel
Megerősítem — tartós tudás lesz: bekerül a Tudástárba és a társ fejébe, előrejelzés és kísérlet épülhet rá.
Figyeljük még — marad a listán, a motor tovább számolja, de nem tanulok belőle.
Elvetem — befagy, többé nem hozom elő.
```

Buttons reuse the `PatternCard` footer styling (cta-ghost flex-1, active state colors success/warning/error) with labels **Megerősítem / Figyeljük / Elvetem** (active: **Megerősítve** stays on the confirm button when `pattern.status === 'confirmed'`). `MotorStateHero`: eyebrow row `A motor állapota` + `{lastRunAt "ma HH:mm" || '—'} · {lookbackDays} nap`; sentence `**{pairs.length} kérdést** figyelek a naplóidból. **{counts.confirmed} megerősített** összefüggés dolgozik a társban, **{counts.decide} vár a döntésedre**.`; 6 tiles (labels: `döntésre vár · megfigyelés alatt · megerősítve · még gyűlik · nincs kapcsolat · elvetve`); domain chips from `DOMAIN_ORDER` filtered to domains present among `monitor.pairs` `metricBDomain`s, plus a leading `Mind` chip. `LifecycleSection`: `useState(defaultOpen)` collapsible `.card` with header row (title+count, chevron) — return `null` when `count === 0`.

- [ ] **Step 4: Run to verify green** — `pnpm vitest run src/features/insights/components/` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(insights): dashboard hero + decision card + lifecycle section components (mezo-tk88.4)"`

### Task 10: `PatternsPage` rewrite + Motor retirement + redirects

**Files:**
- Rewrite: `frontend/src/features/insights/pages/PatternsPage.tsx`
- Rewrite test: `frontend/src/features/insights/pages/PatternsPage.test.tsx`
- Modify: `frontend/src/features/insights/pages/tabs.ts` (remove `motor` entry)
- Modify: `frontend/src/app/router.tsx` (remove `MotorPage` import/route; add `{ path: 'motor', element: <Navigate to="/insights" replace /> }` inside the insights children — import `Navigate` from `react-router-dom`)
- Delete: `MotorPage.tsx`, `MotorPage.test.tsx`, `PairRow.tsx`, `MotorHero.tsx`, `DomainSection.tsx`, `VerdictFilterChips.tsx`, `PatternCard.tsx`, `PatternCard.test.tsx`
- Modify: `frontend/src/features/insights/pages/insights.nav.test.tsx` (7 tabs, no Motor)

**Interfaces:**
- Consumes: Tasks 8–9; `usePatterns`, `usePatternMonitor`, `usePatternActions` from `@/data/hooks`; `MetricCoverageRing`; `verdictSentence` from `logic/verdicts.ts`.

- [ ] **Step 1: Rewrite the page test first** (drives the page):

```tsx
// mock mode
test('renders the hero sentence, tiles and lifecycle sections from the seeds', () => {
  renderPage()
  expect(screen.getByText('A motor állapota')).toBeInTheDocument()
  expect(screen.getByText(/kérdést/)).toBeInTheDocument()
  expect(screen.getByText(/Döntésre vár/)).toBeInTheDocument()
  expect(screen.getByText(/Megerősítve — él a tudásban/)).toBeInTheDocument()
  expect(screen.getByText('Adat-egészség')).toBeInTheDocument()
})

test('?pair= redirects to the detail page', () => {
  render(
    <MemoryRouter initialEntries={['/insights?pair=late-meal~next-sleep-quality']}>
      <Routes>
        <Route path="/insights" element={<PatternsPage />} />
        <Route path="/insights/patterns/:pairKey" element={<div>DETAIL STUB</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
  expect(screen.getByText('DETAIL STUB')).toBeInTheDocument()
})

// real mode: msw stubs for BOTH endpoints (pattern list + monitor) → sections composed;
// 404 on both → the degraded card (no Motor link any more)
```

- [ ] **Step 2: Run to verify failure** — old page still renders → FAIL.

- [ ] **Step 3: Rewrite `PatternsPage`**

Structure (all data client-side, no new endpoint):

```tsx
export function PatternsPage() {
  const { patterns, degraded, isPending } = usePatterns()
  const { monitor } = usePatternMonitor()
  const { decide } = usePatternActions()
  const [params] = useSearchParams()
  const [activeDomains, setActiveDomains] = useState<Set<MetricDomain>>(new Set())

  const targetPairKey = params.get('pair')
  if (targetPairKey) return <Navigate to={`/insights/patterns/${targetPairKey}`} replace />
  if (degraded) { /* meglévő degraded card, Motor-link nélkül */ }

  const buckets = bucketize(patterns, monitor)
  const counts = Object.fromEntries(BUCKET_ORDER.map((b) => [b, buckets.get(b)!.length])) as Record<LifecycleBucket, number>
  const byDomain = (e: LifecycleEntry) =>
    activeDomains.size === 0 || (e.pair != null && activeDomains.has(e.pair.metricBDomain))
  // … MotorStateHero → decide-kártyák (első showExplainer) → 5 LifecycleSection → Adat-egészség
}
```

Section copy (verbatim, from the mockup): `🔔 Döntésre vár` eyebrow + `csak erős jel` meta · `✓ Megerősítve — él a tudásban` (defaultOpen, footNote `Ez a {n} összefüggés benne van a társ fejében minden beszélgetésnél, és ebből épülnek az előrejelzések.`) · `👁 Megfigyelés alatt` · `⏳ Még gyűlik az adat` (rows: `verdictSentence(pair, …)` as sub; footNote `Ezek nem hibák — csak nincs elég közös nap. Amit logolsz, az hozza őket életre.`) · `○ Megnéztük — nincs összefüggés` (footNote `Ez is eredmény: megnéztük, és nincs kapcsolat. Nem kér döntést — ha később megerősödne, feljebb lép.`) · `✕ Elvetve`. Mini-row subs: confirmed → `megerősítve · azóta ×N megerősödött` when the promoted fact data is present (real mode lacks it on this read → use `megerősítve` alone; the ×N lives on the detail page); monitoring/noRelationship → the finding sentence one-liner or `r`-trend when available. `Adat-egészség`: a collapsed `LifecycleSection`-style card hosting the `MetricCoverageRing` list (port the `metrics.sort` + `referencing`/`waiting` wiring from the old `MotorPage` verbatim). Empty state (`patterns.length===0 && (monitor?.pairs.length ?? 0)===0 && !isPending`) keeps the existing „Még nincs felismert minta…" card, link now removed.

- [ ] **Step 4: Retire Motor** — tabs.ts entry out; router motor→Navigate; delete the 8 files; fix `insights.nav.test.tsx` expectations (7 pills). Grep guard: `grep -rn "MotorPage\|PairRow\|VerdictFilterChips\|MotorHero\|DomainSection" frontend/src` → only `domains.ts` (kept) and no dead imports.

- [ ] **Step 5: Run the full FE gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: ALL GREEN in both modes.

- [ ] **Step 6: Docs + commit + slice close**

`docs/features/insights.md`: rewrite §2.1 (dashboard) + fold §2.8 (Motor tab → retired, diagnostics moved), update the tab table (7 tabs), file map. `node scripts/lint-docs.mjs`. Commit `feat(insights): lifecycle dashboard replaces the pattern inbox + Motor tab (mezo-tk88.4)`. Push, PR, CI, merge, `bd close mezo-tk88.4`.

---

# Slice S5 — FE detail page (`mezo-tk88.5`, branch `feat/pattern-detail-page`)

**Before chart code: load the `dataviz` skill.**

### Task 11: Types + API client + dual-mode hook + mock seeds

**Files:**
- Modify: `frontend/src/data/types.ts`
- Create: `frontend/src/data/insights/patternDetailApi.ts`
- Create: `frontend/src/data/insights/patternDetailHooks.ts`
- Modify: `frontend/src/data/insights/insights.ts` (mock detail seeds)
- Modify: `frontend/src/data/hooks.ts` (re-export)
- Test: `frontend/src/data/insights/patternDetailHooks.test.tsx`

**Interfaces:**
- Produces:

```ts
// types.ts
export type PatternEventKind = 'snapshot' | 'confirmed' | 'monitoring' | 'rejected' | 'reinforced' | 'promoted'
export interface PatternEvent {
  kind: PatternEventKind
  occurredAt: string          // ISO datetime
  r?: number; n?: number; p?: number
  reinforcementCount?: number
  factId?: string
}
export interface AlignedDay { date: string; a: number; b: number }
export interface PatternImpactRef { id: string; title: string; status: string }
export interface PatternImpact {
  fact: { id: string; text: string; reinforcementCount: number; includeInPrompt: boolean } | null
  predictions: PatternImpactRef[]
  experiments: PatternImpactRef[]
  challenges: PatternImpactRef[]
}
export interface PatternPairDetail {
  pair: PatternMonitorPair
  pattern: Pattern | null
  events: PatternEvent[]
  days: AlignedDay[]
  impact: PatternImpact
}

// patternDetailHooks.ts
export function usePatternPairDetail(pairKey: string): {
  detail: PatternPairDetail | null; degraded: boolean; notFound: boolean
  isPending: boolean; isError: boolean; refetch: () => void; mode: 'mock' | 'live'
}
```

- [ ] **Step 1: Failing hook test** — mock mode returns the seeded detail for a seeded key and a synthesized minimal one (pattern:null) for a catalog-only key; real mode maps a msw-stubbed response; 404 (unknown key) → `notFound: true`; companion off 404 vs unknown-pair 404 both arrive as ApiError 404 — treat any 404 as `notFound` + `degraded` false (the page shows one honest "nincs ilyen minta" state).

- [ ] **Step 2: Implement** — `patternDetailApi.get(pairKey)` fetches `/api/companion/pattern/pair/${pairKey}` and maps: `pattern` via the EXISTING `toPattern` (import from `patternsApi.ts` — export it there if not yet), `pair` passes through like `monitorApi` does, events/days/impact 1:1. Hook via `useDualQuery` (`queryKey: ['pattern-pair-detail', pairKey]`), catching 404 → `{ detail: null, notFound: true }` shape. Mock seeds in `insights.ts`:

```ts
/** Két kézzel írt detail-seed (spec-mockup a forrás): egy megerősített pár teljes történettel
 *  + egy gyűjtögető pár; minden MÁS katalógus-kulcsra a builder minimál-detailt ad
 *  (pair a patternMonitor-ból, pattern: null). */
export function mockPatternPairDetail(pairKey: string): PatternPairDetail | null
```

Seed content for the confirmed showcase (`sleep-quality~next-day-training-rpe` — pick the seed pair that exists in `patternMonitor.pairs`): 5 snapshot events (r −0.18 → −0.58 growth over jún 3 → aug 13), `confirmed` + `promoted` on júl 12, two `reinforced` (júl 30 ×2, aug 13 ×4), ~24 `days` points along a negative trend, impact `{fact: {…, reinforcementCount: 4, includeInPrompt: true}, predictions: 2 (1 validated, 1 pending), experiments: 1 active, challenges: 1 completed}` — titles from the mockup. Barrel-export `usePatternPairDetail` via `data/hooks.ts`.

- [ ] **Step 3: Green + commit** — `pnpm vitest run src/data/insights/patternDetailHooks.test.tsx` both modes → PASS. Commit `feat(insights): pattern pair detail data layer (mezo-tk88.5)`.

### Task 12: History/journal pure logic + chart components

**Files:**
- Create: `frontend/src/features/insights/logic/patternHistory.ts`
- Test: `frontend/src/features/insights/logic/patternHistory.test.ts`
- Create: `frontend/src/features/insights/components/PatternStrengthChart.tsx`
- Create: `frontend/src/features/insights/components/PatternScatter.tsx`

**Interfaces:**
- Consumes: `PatternEvent`, `AlignedDay`, `PatternMonitorPair`; `strengthWord` from `logic/findings.ts`.
- Produces:

```ts
// patternHistory.ts — pure, chart/journal input prep
export interface StrengthPoint { date: string; absR: number; kind: 'snapshot' | 'confirmed' }
export function strengthSeries(events: PatternEvent[]): StrengthPoint[]
// snapshotok |r|-je időrendben; a confirmed esemény napja a hozzá legközelebbi snapshot |r|-jével jelölt pont

export interface JournalEntry { date: string; tone: 'neutral' | 'success' | 'accent'; text: string; factLink?: boolean }
export function journalEntries(events: PatternEvent[], pair: PatternMonitorPair | null): JournalEntry[]
```

Journal derivation rules (write as tests first): first snapshot → `Életre kelt — {n} közös nap gyűlt össze, {erősség} jel.` (strengthWord band); a snapshot whose `strengthWord(|r|)` band DIFFERS from the previous snapshot's → `A jel erősödött/gyengült, átlépte a(z) „{új sáv}" sávot.`; `confirmed` → `**Megerősítetted.**` (+ `factLink: true` when a later `promoted` exists); `monitoring` → `Megfigyelésre tetted.`; `rejected` → `Elvetetted — befagyasztva.`; `reinforced` → `Újra előjött ugyanabban az irányban — a tudás megerősödött (×{reinforcementCount}).`; `promoted` renders no own line (folded into the confirm line's fact link). Dates formatted `aug 13.` style (existing date helpers in `@/shared/lib` — grep for the `hó nap` formatter used by the conversation picker and reuse).

- [ ] **Step 1/2: Tests → fail** (band crossing, first-snapshot, reinforce text, promoted folding). 
- [ ] **Step 3: Implement logic; then the two SVG components** — hand-drawn SVG per the mockup (viewBox 340×150 / 340×190), token colors only (`var(--success-base)`, `var(--accent-base)`, `var(--dv-lav)`, `var(--primary-base)`, `var(--border-strong)`, text `var(--text-disabled)`), band guides at 0.3/0.6 labeled `érezhető · 0.3` / `határozott · 0.6`, confirm point accented; scatter: axis labels `jó/rossz` + `könnyű edzés/kemény edzés` generalized to `pair.metricALabel`/`pair.metricBLabel` low/high wording — labels: y-axis `pair.metricBLabel`, x low/high plain `alacsony/magas` when no hand-written axis copy exists; trend line from a least-squares fit over `days` (tiny pure `fitLine(days)` helper in `patternHistory.ts`, tested); latest day highlighted with an accent ring. Charts render `null` on `<2` points (the page shows the empty-state text instead).
- [ ] **Step 4: Green + commit** — `feat(insights): pattern history logic + strength/scatter charts (mezo-tk88.5)`.

### Task 13: `PatternDetailPage` + route + tests + docs

**Files:**
- Create: `frontend/src/features/insights/pages/PatternDetailPage.tsx`
- Create: `frontend/src/features/insights/components/PatternJournal.tsx`, `PatternImpactCard.tsx`
- Modify: `frontend/src/app/router.tsx` — sibling route BEFORE the insights section (the `fuel/recipes/:id` idiom): `{ path: 'insights/patterns/:pairKey', element: <PatternDetailPage /> }`
- Test: `frontend/src/features/insights/pages/PatternDetailPage.test.tsx`

**Interfaces:**
- Consumes: Tasks 11–12; `usePatternActions` (same decide buttons); `verdictSentence` (gathering states); `confidenceMeta`/`findingSentence`/`pairLine`.

- [ ] **Step 1: Failing page tests** (mock mode):

```tsx
test('confirmed pair renders all five blocks in order', () => {
  renderAt('/insights/patterns/sleep-quality~next-day-training-rpe')
  expect(screen.getByText('← Minták')).toBeInTheDocument()
  expect(screen.getByText('Hogyan erősödött a jel')).toBeInTheDocument()
  expect(screen.getByText(/nap, amiből ez kijött/)).toBeInTheDocument()
  expect(screen.getByText('A minta története')).toBeInTheDocument()
  expect(screen.getByText('Mit kezd ezzel az app')).toBeInTheDocument()
  expect(screen.getByText('Motor-diagnosztika')).toBeInTheDocument()
  expect(screen.getByText(/Megerősítetted/)).toBeInTheDocument()
})

test('gathering pair renders gate nudge + honest empty states, future-tense impact', () => {
  renderAt(`/insights/patterns/${gatheringKey}`)
  expect(screen.getByText(/még .* nap/i)).toBeInTheDocument()          // verdictSentence nudge
  expect(screen.getByText(/Még nincs előzmény/)).toBeInTheDocument()
  expect(screen.getByText(/Ha megerősíted/)).toBeInTheDocument()
})

test('unknown key renders the honest not-found state with a back link', () => {
  renderAt('/insights/patterns/nonsense~key')
  expect(screen.getByText(/Nincs ilyen minta/)).toBeInTheDocument()
})
```

Real mode: msw stub for the detail endpoint (one confirmed payload) → the five blocks; msw 404 → not-found state.

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement the page** — own leaf screen (no Insights sub-nav): back link `← Minták` → `/insights`; header card = `PatternDecisionCard` REUSED with `showExplainer={false}` (active-state button labels handle judged rows) + title size bump prop or local wrapper style; then `PatternStrengthChart` in a card titled `Hogyan erősödött a jel` + caption `A jel folyamatosan erősödik, ahogy gyűlnek a közös napok — {first n} napról {last n}-re.` (computed from first/last snapshot; hide when <2 snapshots → `Még nincs előzmény — az éjszakai futások töltik.`); scatter card titled `A {days.length} nap, amiből ez kijött` + caption `Minden pont egy nap. A kiemelt a legutóbbi: {date}.` (+ `Napok listája →` toggling an inline plain table `dátum · {metricALabel} · {metricBLabel}`); `PatternJournal` card `A minta története` (timeline styling from the mockup: left rail, dots colored by tone); `PatternImpactCard` card `Mit kezd ezzel az app` — rows `Tudástár-tény` (`×{n} megerősítve · benne van a társ promptjában` / `nincs a promptban`), `{n} előrejelzés` (`{validated} bejött · {pending} még fut`), `{n} kísérlet`, `{n} kihívás`, each linking to its surface (`/insights/knowledge`, `/insights/predictions`, `/insights/experiments`, `/train` for challenges); undecided/no-row → future-tense single row `Ha megerősíted: bekerül a Tudástárba és a társ fejébe, előrejelzés és kísérlet épülhet rá.`; collapsed `🔧 Motor-diagnosztika` (LifecycleSection reuse): window `Ablak: {windowFrom} – {windowTo} ({lookbackDays} nap) · lag: {lagDays} nap · utolsó futás: {lastRunAt}`, freeze note on judged rows `Mivel megítélted, a számok befagytak — az éjszakai job már csak azt figyeli, előjön-e újra.`, source chips `{metricALabel} · {sourceA}` (from monitor metrics or detail pair — the monitor read supplies `sourceHu` via `usePatternMonitor`, already cached), mono stat `r={r} · n={n} · p={p}`.

- [ ] **Step 4: Full FE gate** — `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → GREEN both modes.

- [ ] **Step 5: Docs + commit + slice + epic close**

`docs/features/insights.md`: add the detail-page section (§2.1b), file map, §10 endpoint row; `companion.md` cross-note. `node scripts/lint-docs.mjs`. Commit `feat(insights): pattern detail page — history, scatter, journal, impact (mezo-tk88.5)`. Push, PR, CI, merge, `bd close mezo-tk88.5`, then `bd close mezo-tk88` (epic) — final sweep: `git pull --rebase && bd dolt push && git push && git status` clean.

---

## Self-review notes (resolved into the plan above)

- **Spec coverage:** hero/inbox/sections/Adat-egészség (T8–10), detail 4 blocks + diagnostics (T11–13), `pattern_event` + writers (T1–3), traceability (T4–5), endpoint (T6–7), Motor retirement + redirects (T10), display threshold (T8), honest states (T10/T13), docs folded per slice. Deferred items (backfill, per-day drill-in, filter persistence) stay out — matching the spec.
- **Consistency:** event kinds = decision status strings (single vocabulary); `toPattern` reused (export from `patternsApi.ts`); `verdictSentence` moved once (T8) and consumed by T10+T13; `STRONG_SIGNAL` consumed only via `isStrongSignal`.
- **Known judgment calls baked in:** degraded-monitor proposed rows go to `decide` (server gate passed — better to ask than hide); LIVE-but-rowless pairs read as `gathering` (tonight's job persists); any detail 404 = one honest not-found state; ArchUnit package-direction check called out in T7 with the fallback design.
