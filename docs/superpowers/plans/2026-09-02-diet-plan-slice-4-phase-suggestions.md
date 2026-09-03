# Diet Plan Slice 4 — Meso-phase → diet-phase suggestions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The training plan starts advising the diet: when a mesocycle's `goalPreset` disagrees with the active goal's trajectory, or a deload week begins, the engine emits a **suggestion** (never a silent change) the owner accepts or dismisses; accepting applies the change through the normal goal paths and re-evaluates.

**Architecture:** A new `goal_suggestion` aggregate inside `feature/goal` (entity + service + lifecycle: proposed → accepted | dismissed | superseded, one open row per kind per goal, dedup against dismissed rows). Triggers run inside the existing engine choke point (`GoalEngineService.evaluate`) plus meso lifecycle events (`MesocycleClosed`, new `MesocycleActivated`). A deload acceptance persists a per-week **segment override** (`goal.segment_overrides` jsonb) that `GoalProjectionService` folds into its week walk. FE: suggestion cards on GoalsPage + a banner on FuelMaiPage.

**Tech Stack:** Spring Boot + JPA/Hibernate typed-jsonb records, Liquibase SQL migrations, OpenAPI contract-first (generated `GoalApi`), MapStruct, React + TanStack Query dual-mode (real/mock) hooks, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-diet-plan-design.md` (§6.1 `goal_suggestion`, §6.5, §6.8)

**Dependency note:** Independent of slices 1–3 data-wise; assumes the engine/evaluate flow as-is, can land right after slice 1 (or before it — nothing here reads `carbsG`/`fatG`). Slice 5 REUSES `GoalSuggestionEntity` + `GoalSuggestionService.propose(...)` with `kind="weekly_correction"` — see the Produces blocks in Tasks 2–3.

## Global Constraints

- **Contract-drift gate:** any `api/feature/goal/goal.yml` edit requires regenerating BOTH clients in the same commit: `cd api/generate && npm run generate:api` (regenerates backend `GoalApi`/DTOs) and `cd frontend && pnpm generate:api` (regenerates `api.gen.ts`).
- **CODEMAP freshness gate:** after adding new files/classes run `node scripts/gen-codemap.mjs` and commit the regenerated `docs/CODEMAP.md`.
- **ArchUnit store:** before every commit, `git status` must NOT show a modified-to-empty `backend/src/test/resources/archunit-store/` file — a green run can silently empty it; restore with `git checkout -- <file>` if so.
- **Dual FE test modes:** every FE change must pass `pnpm test` AND `VITE_USE_MOCK=true pnpm test` (run in `frontend/`).
- **Backend tests: focused only** (16 GB machine OOMs on the full suite — CI is the authoritative gate): `cd backend && ./mvnw test -Dtest='<ClassName>' -DfailIfNoTests=false`. Never run `./mvnw clean test` locally.
- **Transactional-event trap:** `@TransactionalEventListener(AFTER_COMMIT)` never fires inside a `@Transactional` IT (rolled-back tx). ITs call the listener's target service method directly; the event wiring itself is verified by the annotation + a plain unit assertion, not an IT.
- **Conventional commits** carrying the driving bd id, e.g. `feat(goal): goal_suggestion entity + lifecycle (mezo-XXXX)` — replace `mezo-XXXX` with the slice's actual bd issue id.
- Code/comments English; user-facing copy Hungarian. Config-first: every tunable in `mezo.goal.*` via `GoalEngineProperties`, never hardcoded/`@Value`.

---

### Task 1: Contract — suggestion schemas + endpoints in goal.yml

**Files:**
- Modify: `api/feature/goal/goal.yml` (paths after `/api/goals/{id}/plans/{linkId}` at line ~123; schemas after `GoalTimelineResponse`)
- Generated (same commit): backend `GoalApi`/DTOs, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: DTOs `GoalSuggestionResponse` (`id`, `kind` enum `phase_change|weekly_correction`, `status` enum `proposed|accepted|dismissed|superseded`, `payload: GoalSuggestionPayload`, `createdAt`, `decidedAt?`), `GoalSuggestionPayload` (`reason`, `suggestedTrajectory?`, `balanceOverrideKcal?`, `fromWeek?`, `toWeek?`, `mesoId?`, `mesoTitle?`, `snapshotTrajectory`); generated `GoalApi` methods `listGoalSuggestions(UUID id)`, `acceptGoalSuggestion(UUID id, UUID suggestionId)`, `dismissGoalSuggestion(UUID id, UUID suggestionId)`.

- [ ] **Step 1: Add the endpoints** to `api/feature/goal/goal.yml` after the `/api/goals/{id}/plans/{linkId}` block:

```yaml
  /api/goals/{id}/suggestions:
    get:
      tags: [Goal]
      operationId: listGoalSuggestions
      summary: The goal's OPEN (proposed) suggestions — diet-phase / correction proposals awaiting a decision
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '200':
          description: Open suggestions (may be empty)
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/GoalSuggestionResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/goals/{id}/suggestions/{suggestionId}/accept:
    post:
      tags: [Goal]
      operationId: acceptGoalSuggestion
      summary: Accept a suggestion — applies its payload to the goal (trajectory change or segment override), re-evaluates, returns the updated goal
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: suggestionId, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '200': { description: Applied + re-evaluated, content: { application/json: { schema: { $ref: '#/components/schemas/GoalResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: Stale — the goal changed since the proposal; the suggestion is now superseded, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/goals/{id}/suggestions/{suggestionId}/dismiss:
    post:
      tags: [Goal]
      operationId: dismissGoalSuggestion
      summary: Dismiss a suggestion — records the decision so the same trigger input never re-proposes it
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: suggestionId, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204': { description: Dismissed }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

- [ ] **Step 2: Add the schemas** after `GoalTimelineResponse`:

```yaml
    GoalSuggestionResponse:
      type: object
      required: [id, kind, status, payload, createdAt]
      properties:
        id: { type: string, format: uuid }
        kind: { type: string, enum: [phase_change, weekly_correction] }
        status: { type: string, enum: [proposed, accepted, dismissed, superseded] }
        payload: { $ref: '#/components/schemas/GoalSuggestionPayload' }
        createdAt: { type: string, format: date-time }
        decidedAt: { type: string, format: date-time, nullable: true }
    GoalSuggestionPayload:
      type: object
      description: 'Typed suggestion body. phase_change carries either suggestedTrajectory (preset↔trajectory mismatch) or balanceOverrideKcal+fromWeek+toWeek (deload maintenance week). snapshotTrajectory is the accept-time race guard.'
      required: [reason, snapshotTrajectory]
      properties:
        reason: { type: string, description: 'Hungarian, user-facing rationale' }
        suggestedTrajectory: { type: string, enum: [cut, bulk, maintain], nullable: true }
        balanceOverrideKcal: { type: integer, nullable: true, description: 'Per-week energy-balance override (kcal/day); 0 = maintenance-leaning week' }
        fromWeek: { type: integer, nullable: true }
        toWeek: { type: integer, nullable: true }
        mesoId: { type: string, format: uuid, nullable: true }
        mesoTitle: { type: string, nullable: true }
        snapshotTrajectory: { type: string, enum: [cut, bulk, maintain] }
```

- [ ] **Step 3: Regenerate both clients**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: backend `GoalApi` gains the 3 methods; `api.gen.ts` gains both schemas. `git status` shows only generated files + goal.yml.

- [ ] **Step 4: Verify the backend compiles against the new interface** — it must FAIL (GoalController doesn't implement the new methods yet):

Run: `cd backend && ./mvnw compile -q`
Expected: FAIL — `GoalController is not abstract and does not override abstract method listGoalSuggestions`. This failure is Task 8's cue; to keep the repo green per-commit, commit the contract together with Task 8's controller stub — OR (preferred, simplest) do Steps 1–3 now and commit at the end of Task 8. Do NOT commit a non-compiling state.

---

### Task 2: Migration + entity + typed jsonb payload + repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/<YYYYMMDDHHMM>_mezo-XXXX_goal_suggestion.sql` (stamp with the real current date-time)
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append include)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalSuggestionEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalSuggestionPayloadJson.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalSegmentOverrideJson.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalEntity.java` (add `segmentOverrides`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/GoalSuggestionRepository.java`

**Interfaces:**
- Produces (slice 5 reuses all of these): `GoalSuggestionEntity` (getters/setters: `UUID id`, `UUID goalId`, `String kind`, `String status`, `String dedupKey`, `GoalSuggestionPayloadJson payload`, `Instant decidedAt` + `OwnedEntity` fields); `GoalSuggestionPayloadJson(String reason, String suggestedTrajectory, Integer balanceOverrideKcal, Integer fromWeek, Integer toWeek, UUID mesoId, String mesoTitle, String snapshotTrajectory)`; `GoalSegmentOverrideJson(Integer fromWeek, Integer toWeek, Integer balanceKcal)`; repository finders listed in Step 4.

- [ ] **Step 1: Write the migration SQL** (follow the `character_tables` idiom — snake_case, `created_by` FK to `app_user`, CHECK constraints, partial unique index):

```sql
-- Diet Plan slice 4 (bd mezo-XXXX, spec 2026-09-02-diet-plan-design §6.1/§6.5):
-- goal_suggestion = engine-proposed diet changes awaiting the owner's decision
-- (suggest + approve, never silent). One OPEN (proposed) row per (goal, kind);
-- dedup_key blocks re-proposing an input the owner already dismissed.
-- goal.segment_overrides = accepted per-week energy-balance overrides (deload weeks).

create table goal_suggestion (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    goal_id     uuid        not null,
    kind        varchar(20) not null,
    status      varchar(12) not null default 'proposed',
    dedup_key   varchar(160) not null,
    payload     jsonb       not null,
    decided_at  timestamptz,
    constraint pk_goal_suggestion_id primary key (id),
    constraint fk_goal_suggestion_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_goal_suggestion_goal_id_goal_id foreign key (goal_id) references goal (id) on delete cascade,
    constraint ck_goal_suggestion_kind check (kind in ('phase_change', 'weekly_correction')),
    constraint ck_goal_suggestion_status check (status in ('proposed', 'accepted', 'dismissed', 'superseded'))
);

-- One open proposal per kind per goal — a newer proposal must supersede, not coexist.
create unique index uq_goal_suggestion_open_per_kind
    on goal_suggestion (goal_id, kind) where status = 'proposed' and is_deleted = false;

-- Trigger-side dedup lookup: "was this exact input already decided?"
create index idx_goal_suggestion_goal_dedup on goal_suggestion (goal_id, dedup_key) where is_deleted = false;

-- Accepted deload overrides the projection engine folds into its week walk.
alter table goal add column segment_overrides jsonb;
```

- [ ] **Step 2: Append the changelog include** to `1.0.0_master.yml` (match the existing entries exactly):

```yaml
  - changeSet:
      id: "1.0.0:<YYYYMMDDHHMM>_mezo-XXXX_goal_suggestion"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/<YYYYMMDDHHMM>_mezo-XXXX_goal_suggestion.sql
```

- [ ] **Step 3: Write the entity + json records.**

`GoalSuggestionPayloadJson.java` (mirror `GoalPrescriptionJson`'s plain-record idiom — no Jackson/Hibernate annotations):

```java
package io.mrkuhne.mezo.feature.goal.entity;

import java.util.UUID;

/**
 * Typed body of a {@link GoalSuggestionEntity}, persisted as the {@code payload} jsonb column
 * (app-ObjectMapper serialized via {@code @JdbcTypeCode(SqlTypes.JSON)}, the
 * {@code GoalPrescriptionJson} idiom). A {@code phase_change} carries EITHER
 * {@code suggestedTrajectory} (meso preset ↔ goal trajectory mismatch) OR
 * {@code balanceOverrideKcal}+{@code fromWeek}+{@code toWeek} (deload → maintenance-leaning week).
 * {@code snapshotTrajectory} is the accept-time race guard: the goal's trajectory at proposal
 * time — a mismatch at accept means the goal changed underneath and the suggestion is stale.
 */
public record GoalSuggestionPayloadJson(
    String reason,               // Hungarian, user-facing
    String suggestedTrajectory,  // cut|bulk|maintain, nullable
    Integer balanceOverrideKcal, // kcal/day override (0 = maintenance), nullable
    Integer fromWeek,            // goal-week span of the override, nullable
    Integer toWeek,
    UUID mesoId,                 // the triggering mesocycle, nullable
    String mesoTitle,
    String snapshotTrajectory    // race guard, never null
) {
}
```

`GoalSegmentOverrideJson.java`:

```java
package io.mrkuhne.mezo.feature.goal.entity;

/**
 * One accepted per-week energy-balance override on the goal ({@code goal.segment_overrides}
 * jsonb array element). The projection engine substitutes {@code balanceKcal} for the goal's
 * formula energy balance in every goal-week within [fromWeek, toWeek] — the "deload week eats
 * at maintenance" mechanism (spec §6.5). Weeks are goal-week indices (1-based), matching
 * {@code GoalPrescriptionJson.Segment}.
 */
public record GoalSegmentOverrideJson(Integer fromWeek, Integer toWeek, Integer balanceKcal) {
}
```

`GoalSuggestionEntity.java`:

```java
package io.mrkuhne.mezo.feature.goal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * An engine-proposed diet change awaiting the owner's decision (suggest + approve — the engine
 * never silently rewrites targets; spec 2026-09-02-diet-plan-design §6.5). Lifecycle:
 * {@code proposed} → {@code accepted} | {@code dismissed} | {@code superseded}. Invariants owned
 * by {@code GoalSuggestionService}: at most one open (proposed) row per (goal, kind) — a newer
 * proposal supersedes the open one; a {@code dedupKey} already decided (dismissed OR accepted)
 * is never re-proposed.
 */
@Getter
@Setter
@Entity
@Table(name = "goal_suggestion")
@SQLDelete(sql = "update goal_suggestion set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GoalSuggestionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(name = "goal_id", nullable = false) private UUID goalId;
    @NotNull @Column(nullable = false) private String kind;   // phase_change|weekly_correction (DB CHECK)
    @NotNull @Column(nullable = false) private String status; // proposed|accepted|dismissed|superseded (DB CHECK)

    /** Trigger-input identity — e.g. "preset:cut-prep:meso:<id>" / "deload:meso:<id>:w:4-4". */
    @NotNull @Column(name = "dedup_key", nullable = false) private String dedupKey;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private GoalSuggestionPayloadJson payload;

    @Column(name = "decided_at") private Instant decidedAt;
}
```

Add to `GoalEntity.java` after the `prescription` field (line 72):

```java
    /** Accepted per-week energy-balance overrides (deload → maintenance weeks); null = none (slice 4). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "segment_overrides", columnDefinition = "jsonb")
    private List<GoalSegmentOverrideJson> segmentOverrides;
```

- [ ] **Step 4: Repository** `GoalSuggestionRepository.java`:

```java
package io.mrkuhne.mezo.feature.goal.repository;

import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalSuggestionRepository extends JpaRepository<GoalSuggestionEntity, UUID> {

    Optional<GoalSuggestionEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<GoalSuggestionEntity> findByGoalIdAndCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
        UUID goalId, UUID createdBy, String status);

    Optional<GoalSuggestionEntity> findByGoalIdAndKindAndStatusAndDeletedFalse(
        UUID goalId, String kind, String status);

    boolean existsByGoalIdAndDedupKeyAndStatusInAndDeletedFalse(
        UUID goalId, String dedupKey, List<String> statuses);
}
```

- [ ] **Step 5: Compile + schema-validate via one existing focused IT** (Hibernate schema validation runs on context start):

Run: `cd backend && ./mvnw test -Dtest='GoalServiceIT' -DfailIfNoTests=false`
Expected: PASS (migration applies, entity maps). If schema validation fails, fix the SQL↔entity mismatch before moving on.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db/changelog api/feature/goal/goal.yml backend/src/main/java/io/mrkuhne/mezo/feature/goal frontend/src/data/_client/api.gen.ts
git commit -m "feat(goal): goal_suggestion table + entity + segment_overrides column (mezo-XXXX)"
```

(Contract files ride along only if Task 1 Step 4 chose the stub-now path; otherwise commit them with Task 8.)

---

### Task 3: GoalSuggestionService — propose / supersede / dedup / list / dismiss

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionServiceIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/GoalSuggestionPopulator.java` (mirror `GoalPopulator`: `@Component`, repository-injected, `saveAndFlush`)

**Interfaces:**
- Consumes: Task 2's entity/repository.
- Produces (slice 5's reuse surface): `GoalSuggestionService` with
  `public GoalSuggestionEntity propose(UUID userId, UUID goalId, String kind, String dedupKey, GoalSuggestionPayloadJson payload)` (null return = deduped away),
  `public List<GoalSuggestionResponse> listOpen(UUID userId, UUID goalId)`,
  `public void dismiss(UUID userId, UUID goalId, UUID suggestionId)`,
  and Task 5 adds `public GoalResponse accept(UUID userId, UUID goalId, UUID suggestionId)`.
  Kind constants: `public static final String KIND_PHASE_CHANGE = "phase_change"; public static final String KIND_WEEKLY_CORRECTION = "weekly_correction";`

- [ ] **Step 1: Write the failing IT** (lifecycle only — accept comes in Task 5):

```java
package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Slice-4 suggestion lifecycle: one open per kind, supersede on re-propose, dedup after a decision. */
@Transactional
class GoalSuggestionServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalSuggestionService suggestionService;
    @Autowired private GoalSuggestionRepository suggestionRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private GoalSuggestionPayloadJson payload(String suggested, String snapshot) {
        return new GoalSuggestionPayloadJson(
            "A cut-prep mezo deficitet javasol.", suggested, null, null, null, null, "Pre-cut prep", snapshot);
    }

    @Test
    void testPropose_shouldCreateProposed_whenNoOpenSuggestion() {
        UUID user = databasePopulator.populateUser("sug1@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");

        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        assertThat(s).isNotNull();
        assertThat(s.getStatus()).isEqualTo("proposed");
        assertThat(s.getPayload().suggestedTrajectory()).isEqualTo("cut");
    }

    @Test
    void testPropose_shouldSupersedeOpenRow_whenNewerProposalArrives() {
        UUID user = databasePopulator.populateUser("sug2@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity first = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        GoalSuggestionEntity second = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m2", payload("cut", "bulk"));

        assertThat(second).isNotNull();
        assertThat(suggestionRepository.findById(first.getId()).orElseThrow().getStatus()).isEqualTo("superseded");
        assertThat(second.getStatus()).isEqualTo("proposed");
    }

    @Test
    void testPropose_shouldReturnNull_whenSameDedupKeyAlreadyDecided() {
        UUID user = databasePopulator.populateUser("sug3@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));
        suggestionService.dismiss(user, goal.getId(), s.getId());

        GoalSuggestionEntity again = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        assertThat(again).as("dismissed dedup key must not re-propose").isNull();
        assertThat(suggestionRepository.findById(s.getId()).orElseThrow().getDecidedAt()).isNotNull();
    }

    @Test
    void testPropose_shouldBeIdempotent_whenOpenRowHasSameDedupKey() {
        UUID user = databasePopulator.populateUser("sug4@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity first = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        GoalSuggestionEntity again = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        assertThat(again).isNotNull();
        assertThat(again.getId()).as("same open input → same row, no supersede churn").isEqualTo(first.getId());
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='GoalSuggestionServiceIT' -DfailIfNoTests=false`
Expected: FAIL — `GoalSuggestionService` does not exist.

- [ ] **Step 3: Implement the service:**

```java
package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalSuggestionResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.mapper.GoalSuggestionMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The suggest + approve backbone (spec §6.5/§6.8): the engine PROPOSES diet changes, the owner
 * decides. Invariants: one open (proposed) row per (goal, kind) — a newer proposal supersedes it;
 * a dedupKey the owner already decided (dismissed or accepted) is never re-proposed, so a
 * recurring trigger (every evaluate) stays quiet after a decision until its input changes.
 * Slice 5 reuses propose/list/dismiss verbatim with {@code KIND_WEEKLY_CORRECTION}.
 */
@Service
@RequiredArgsConstructor
public class GoalSuggestionService {

    public static final String KIND_PHASE_CHANGE = "phase_change";
    public static final String KIND_WEEKLY_CORRECTION = "weekly_correction";

    static final String STATUS_PROPOSED = "proposed";
    static final String STATUS_ACCEPTED = "accepted";
    static final String STATUS_DISMISSED = "dismissed";
    static final String STATUS_SUPERSEDED = "superseded";

    private final GoalSuggestionRepository suggestionRepository;
    private final GoalRepository goalRepository;
    private final GoalSuggestionMapper mapper;

    /**
     * Propose a suggestion. Returns the open row (created, or the existing one when the same
     * dedupKey is already open — idempotent re-trigger), or {@code null} when the owner already
     * decided this exact input (dedup: never nag twice about the same thing).
     */
    @Transactional
    public GoalSuggestionEntity propose(
        UUID userId, UUID goalId, String kind, String dedupKey, GoalSuggestionPayloadJson payload) {

        if (suggestionRepository.existsByGoalIdAndDedupKeyAndStatusInAndDeletedFalse(
                goalId, dedupKey, List.of(STATUS_DISMISSED, STATUS_ACCEPTED))) {
            return null;
        }
        var open = suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(goalId, kind, STATUS_PROPOSED);
        if (open.isPresent()) {
            if (dedupKey.equals(open.get().getDedupKey())) {
                return open.get(); // same input, already on the table — idempotent
            }
            // Newer input wins: the stale open proposal is superseded, never silently replaced.
            GoalSuggestionEntity stale = open.get();
            stale.setStatus(STATUS_SUPERSEDED);
            stale.setDecidedAt(Instant.now());
        }
        GoalSuggestionEntity e = new GoalSuggestionEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setGoalId(goalId);
        e.setKind(kind);
        e.setStatus(STATUS_PROPOSED);
        e.setDedupKey(dedupKey);
        e.setPayload(payload);
        return suggestionRepository.save(e);
    }

    /** The goal's open proposals (newest first), ownership-gated through the goal. */
    public List<GoalSuggestionResponse> listOpen(UUID userId, UUID goalId) {
        requireGoal(userId, goalId);
        return suggestionRepository
            .findByGoalIdAndCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(goalId, userId, STATUS_PROPOSED)
            .stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public void dismiss(UUID userId, UUID goalId, UUID suggestionId) {
        GoalSuggestionEntity e = requireOwnedProposed(userId, goalId, suggestionId);
        e.setStatus(STATUS_DISMISSED);
        e.setDecidedAt(Instant.now());
    }

    GoalSuggestionEntity requireOwnedProposed(UUID userId, UUID goalId, UUID suggestionId) {
        return suggestionRepository.findByIdAndCreatedByAndDeletedFalse(suggestionId, userId)
            .filter(s -> s.getGoalId().equals(goalId))
            .filter(s -> STATUS_PROPOSED.equals(s.getStatus()))
            .orElseThrow(this::notFound);
    }

    private void requireGoal(UUID userId, UUID goalId) {
        goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId).orElseThrow(this::notFound);
    }

    /** Ownership gate: missing, foreign and already-decided rows are indistinguishable (404). */
    private SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
```

Also create `backend/src/main/java/io/mrkuhne/mezo/feature/goal/mapper/GoalSuggestionMapper.java` (MapStruct, `GoalMapper` idiom — String → DTO enum via `fromValue`):

```java
package io.mrkuhne.mezo.feature.goal.mapper;

import io.mrkuhne.mezo.api.dto.GoalSuggestionPayload;
import io.mrkuhne.mezo.api.dto.GoalSuggestionResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** Entity → {@link GoalSuggestionResponse}; plain-String kind/status become the DTO enums. */
@Mapper(componentModel = "spring")
public interface GoalSuggestionMapper {

    @Mapping(target = "kind",
        expression = "java(GoalSuggestionResponse.KindEnum.fromValue(entity.getKind()))")
    @Mapping(target = "status",
        expression = "java(GoalSuggestionResponse.StatusEnum.fromValue(entity.getStatus()))")
    @Mapping(target = "payload", expression = "java(toPayload(entity.getPayload()))")
    @Mapping(target = "createdAt", expression = "java(toOffset(entity.getCreatedAt()))")
    @Mapping(target = "decidedAt", expression = "java(entity.getDecidedAt() == null ? null : toOffset(entity.getDecidedAt()))")
    GoalSuggestionResponse toResponse(GoalSuggestionEntity entity);

    default GoalSuggestionPayload toPayload(GoalSuggestionPayloadJson j) {
        return GoalSuggestionPayload.builder()
            .reason(j.reason())
            .suggestedTrajectory(j.suggestedTrajectory() == null ? null
                : GoalSuggestionPayload.SuggestedTrajectoryEnum.fromValue(j.suggestedTrajectory()))
            .balanceOverrideKcal(j.balanceOverrideKcal())
            .fromWeek(j.fromWeek()).toWeek(j.toWeek())
            .mesoId(j.mesoId()).mesoTitle(j.mesoTitle())
            .snapshotTrajectory(
                GoalSuggestionPayload.SnapshotTrajectoryEnum.fromValue(j.snapshotTrajectory()))
            .build();
    }

    default OffsetDateTime toOffset(java.time.Instant i) {
        return i.atOffset(ZoneOffset.UTC);
    }
}
```

(Adjust builder/enum member names to what the generator actually emits — compile tells you.)

- [ ] **Step 4: Run the IT**

Run: `cd backend && ./mvnw test -Dtest='GoalSuggestionServiceIT' -DfailIfNoTests=false`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal backend/src/test/java/io/mrkuhne/mezo
git commit -m "feat(goal): GoalSuggestionService lifecycle — propose/supersede/dedup/dismiss (mezo-XXXX)"
```

---

### Task 4: Projection engine respects segment overrides

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionServiceIT.java` (extend)

**Interfaces:**
- Consumes: `GoalEntity.getSegmentOverrides()` (Task 2).
- Produces: overridden weeks form their own segments with `dailyEnergyBalanceKcal = override.balanceKcal()` and `targetKcal = tdee + override`; label suffix `" · deload — tartás"` when the override is 0.

- [ ] **Step 1: Write the failing IT** (add to `GoalProjectionServiceIT` — follow its existing test style; it builds goals via `GoalPopulator` and calls `project(...)` directly):

```java
    @Test
    void testProject_shouldApplySegmentOverride_whenDeloadWeekAccepted() {
        UUID user = databasePopulator.populateUser("override@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active"); // 8-week window (2026-06-01..07-27)
        goal.setSegmentOverrides(List.of(new GoalSegmentOverrideJson(3, 3, 0)));

        List<GoalProjectionService.ProjectionSegment> segments =
            projectionService.project(goal, user, bootstrap(user, goal), trend(user));

        GoalProjectionService.ProjectionSegment w3 = segments.stream()
            .filter(s -> s.fromWeek() <= 3 && s.toWeek() >= 3).findFirst().orElseThrow();
        assertThat(w3.fromWeek()).as("override splits its own segment").isEqualTo(3);
        assertThat(w3.toWeek()).isEqualTo(3);
        assertThat(w3.dailyEnergyBalanceKcal()).isZero();
        assertThat(w3.targetKcal()).isEqualByComparingTo(w3.tdeeEstimate());
    }
```

(`bootstrap(...)`/`trend(...)`: reuse however the file's existing tests obtain a `TdeeBootstrapJson` + `WeightTrendResponse` — copy the neighboring test's setup lines verbatim.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='GoalProjectionServiceIT' -DfailIfNoTests=false`
Expected: FAIL — the override week is merged into the surrounding segment with the formula balance.

- [ ] **Step 3: Implement.** In `project(...)`: extend the week walk and `WeekLoad` so an overridden week both (a) splits a segment and (b) carries its override:

```java
        // (inside project, replacing the existing per-week loop body)
        for (int w = 1; w <= weeks; w++) {
            String phaseClass = activeMesoPhase(links, mesos, w);
            RunActive run = activeRun(links, runs, w);
            Integer override = overrideFor(goal, w); // null = no override
            load[w] = new WeekLoad(phaseClass, run.active(), run.sessionsPerWeek(), override);
        }
```

```java
    /** The accepted balance override covering goal-week {@code w}, or null (spec §6.5 deload accept). */
    private static Integer overrideFor(GoalEntity goal, int w) {
        if (goal.getSegmentOverrides() == null) {
            return null;
        }
        return goal.getSegmentOverrides().stream()
            .filter(o -> o.fromWeek() != null && o.toWeek() != null && w >= o.fromWeek() && w <= o.toWeek())
            .map(GoalSegmentOverrideJson::balanceKcal)
            .findFirst().orElse(null);
    }
```

`WeekLoad` gains the field (record components participate in `sameLoadAs` via `Objects.equals`):

```java
    private record WeekLoad(String phaseClass, boolean runActive, int runSessionsPerWeek, Integer overrideBalanceKcal) {
        boolean sameLoadAs(WeekLoad other) {
            return other != null
                && Objects.equals(phaseClass, other.phaseClass)
                && runActive == other.runActive
                && runSessionsPerWeek == other.runSessionsPerWeek
                && Objects.equals(overrideBalanceKcal, other.overrideBalanceKcal);
        }
    }
```

In `buildSegment(...)`, substitute the balance and mark the label/rationale:

```java
        BigDecimal effectiveBalance = ld.overrideBalanceKcal() != null
            ? BigDecimal.valueOf(ld.overrideBalanceKcal())
            : balance;
        BigDecimal target = tdee.add(effectiveBalance);
```

…and pass `effectiveBalance` where `balance` fed `projectedRate(...)` and the segment's `dailyEnergyBalanceKcal`. Label: when `ld.overrideBalanceKcal() != null && ld.overrideBalanceKcal() == 0`, append `" · deload — tartás"` to `label(from, to, ld)`'s result and use rationale `"Elfogadott deload-javaslat: ezen a héten tartás (0 kcal egyenleg), a deficit a következő héten folytatódik."`. Update the two existing `new WeekLoad(...)` call sites (the loop) — the compiler finds them.

- [ ] **Step 4: Run the file's full IT** (the old tests guard against regressions — every pre-existing test must still pass with the 4th record component):

Run: `cd backend && ./mvnw test -Dtest='GoalProjectionServiceIT' -DfailIfNoTests=false`
Expected: PASS, including the new test.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine
git commit -m "feat(goal): projection engine folds accepted segment overrides into the week walk (mezo-XXXX)"
```

---

### Task 5: Accept path — trajectory change / deload override + stale-race guard

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionServiceIT.java` (extend)

**Interfaces:**
- Consumes: `GoalFeasibilityService.deriveRatePctPerWeek(String trajectory, BigDecimal startW, BigDecimal targetW, LocalDate start, LocalDate target)` (the exact signature `GoalService.applyUpsert` calls at line 141), `GoalEngineService.evaluate(userId, goalId)`, `GoalMapper.toResponse`.
- Produces: `public GoalResponse accept(UUID userId, UUID goalId, UUID suggestionId)`; new `SystemMessage` key `GOAL_SUGGESTION_STALE` (register it wherever the message-key enumeration/property file lives — grep `RESOURCE_NOT_FOUND` under `backend/src/main/resources` and mirror).

- [ ] **Step 1: Write the failing ITs:**

```java
    @Test
    void testAccept_shouldApplyTrajectoryAndReevaluate_whenSnapshotMatches() {
        UUID user = databasePopulator.populateUser("sug5@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        var response = suggestionService.accept(user, goal.getId(), s.getId());

        assertThat(response.getTrajectory().getValue()).isEqualTo("cut");
        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getPrescription()).as("accept re-evaluates").isNotNull();
        assertThat(suggestionRepository.findById(s.getId()).orElseThrow().getStatus()).isEqualTo("accepted");
    }

    @Test
    void testAccept_shouldApplyDeloadOverride_whenPayloadCarriesBalanceOverride() {
        UUID user = databasePopulator.populateUser("sug6@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "deload:m1:w3",
            new GoalSuggestionPayloadJson("Deload hét — tartás.", null, 0, 3, 3, null, "Hyp blokk", "cut"));

        suggestionService.accept(user, goal.getId(), s.getId());

        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getSegmentOverrides()).hasSize(1);
        assertThat(reloaded.getSegmentOverrides().get(0).balanceKcal()).isZero();
        assertThat(reloaded.getTrajectory()).as("no trajectory change on a deload accept").isEqualTo("cut");
    }

    @Test
    void testAccept_shouldSupersedeAnd409_whenGoalTrajectoryChangedSinceProposal() {
        UUID user = databasePopulator.populateUser("sug7@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));
        goal.setTrajectory("maintain"); // the owner edited the goal underneath

        assertThatThrownBy(() -> suggestionService.accept(user, goal.getId(), s.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasFieldOrPropertyWithValue("httpStatus", HttpStatus.CONFLICT);
        assertThat(suggestionRepository.findById(s.getId()).orElseThrow().getStatus()).isEqualTo("superseded");
    }
```

(Add the imports the file needs: `assertThatThrownBy`, `HttpStatus`, `SystemRuntimeErrorException`, `BiometricProfilePopulator` + `GoalRepository` autowires. If `httpStatus` isn't a readable property on `SystemRuntimeErrorException`, assert on the exception the way existing ITs do — grep `CONFLICT` in `backend/src/test` and copy that assertion idiom.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && ./mvnw test -Dtest='GoalSuggestionServiceIT' -DfailIfNoTests=false`
Expected: FAIL — no `accept` method.

- [ ] **Step 3: Implement `accept`** in `GoalSuggestionService` (new deps: `GoalFeasibilityService`, `GoalEngineService`, `GoalMapper`):

```java
    /**
     * Accept: apply the payload through the normal goal paths — a trajectory change re-derives the
     * weekly rate exactly like {@code GoalService.applyUpsert}; a deload override appends to
     * {@code goal.segmentOverrides} — then re-evaluate. Race guard (spec §6.8): the payload's
     * {@code snapshotTrajectory} must still match the goal; a mismatch supersedes the suggestion
     * and returns 409 so the UI can offer a regenerate.
     */
    @Transactional
    public GoalResponse accept(UUID userId, UUID goalId, UUID suggestionId) {
        GoalSuggestionEntity s = requireOwnedProposed(userId, goalId, suggestionId);
        GoalEntity goal = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId)
            .orElseThrow(this::notFound);

        GoalSuggestionPayloadJson p = s.getPayload();
        if (!goal.getTrajectory().equals(p.snapshotTrajectory())) {
            s.setStatus(STATUS_SUPERSEDED);
            s.setDecidedAt(Instant.now());
            throw new SystemRuntimeErrorException(
                SystemMessage.error("GOAL_SUGGESTION_STALE").build(), HttpStatus.CONFLICT);
        }

        if (p.suggestedTrajectory() != null) {
            goal.setTrajectory(p.suggestedTrajectory());
            // Same derivation applyUpsert runs — the rate magnitude follows the new trajectory.
            goal.setRateTargetPctPerWeek(feasibilityService.deriveRatePctPerWeek(
                p.suggestedTrajectory(), goal.getStartWeightKg(), goal.getTargetWeightKg(),
                goal.getStartDate(), goal.getTargetDate()));
        }
        if (p.balanceOverrideKcal() != null && p.fromWeek() != null && p.toWeek() != null) {
            List<GoalSegmentOverrideJson> overrides = new ArrayList<>(
                goal.getSegmentOverrides() == null ? List.of() : goal.getSegmentOverrides());
            overrides.add(new GoalSegmentOverrideJson(p.fromWeek(), p.toWeek(), p.balanceOverrideKcal()));
            goal.setSegmentOverrides(overrides);
        }

        s.setStatus(STATUS_ACCEPTED);
        s.setDecidedAt(Instant.now());
        goalEngineService.evaluate(userId, goalId);
        return goalMapper.toResponse(goal);
    }
```

Register `GOAL_SUGGESTION_STALE` in the same place `RESOURCE_NOT_FOUND` message keys live (grep and mirror — a properties/enum entry with a Hungarian text like `"A cél időközben megváltozott — a javaslat elavult, kérj újat."`).

- [ ] **Step 4: Run the ITs**

Run: `cd backend && ./mvnw test -Dtest='GoalSuggestionServiceIT' -DfailIfNoTests=false`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(goal): suggestion accept path — trajectory/deload apply + stale 409 guard (mezo-XXXX)"
```

---

### Task 6: Trigger service — preset↔trajectory mismatch + deload week

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionTriggerService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java` (+ `Suggestion` record)
- Modify: `backend/src/main/resources/application.yml` (`mezo.goal.suggestion` block)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java` (call the trigger check at the end of `evaluate`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java` (public phase lookup helper)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionTriggerIT.java`

**Interfaces:**
- Consumes: `GoalSuggestionService.propose(...)`, `GoalPlanLinkRepository`, `MesocycleRepository`, `GoalRepository`.
- Produces: `public void checkPhaseSuggestions(UUID userId, UUID goalId)` (idempotent, graceful when no active goal / no links) and `public void onMesoLifecycle(UUID userId)` (resolves the active goal, then checks) — Task 7's listeners call the latter.

- [ ] **Step 1: Config first.** Add to `GoalEngineProperties` (new component after `bootstrapUncertaintyKcal`):

```java
    /** Suggest+approve trigger tunables (slice 4). */
    @NotNull @Valid Suggestion suggestion
```

```java
    /**
     * Meso goalPreset → suggested goal trajectory. The preset vocabulary is FE-OWNED strings
     * (frontend/src/data/train/train.ts GOAL_PRESETS ids; backend only stores/echoes them —
     * mezo-dq60), so the mapping is config, not an enum: an unknown/new preset simply has no
     * opinion. Absent key = no suggestion (strength/sport are trajectory-neutral).
     */
    public record Suggestion(
        @NotNull Map<String, String> presetTrajectory
    ) {
    }
```

(`import java.util.Map;`.) In `application.yml`, after `bootstrap-uncertainty-kcal: 300`:

```yaml
    suggestion:
      # goalPreset (FE-owned id) -> trajectory the diet should lean toward. Absent = neutral.
      preset-trajectory:
        cut-prep: cut
        hypertrophy: bulk
        erohipertrofia: bulk
        recovery: maintain
```

- [ ] **Step 2: Expose a public phase lookup** on `GoalProjectionService` (reuses the private walk):

```java
    /**
     * The meso phase class active in goal-week {@code goalWeek} (trigger service's deload probe) —
     * same resolution the projection walk uses; null when no gym block covers the week.
     */
    public String phaseForWeek(GoalEntity goal, UUID userId, int goalWeek) {
        List<GoalPlanLinkEntity> links =
            linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goal.getId(), userId);
        Map<UUID, MesocycleEntity> mesos = new LinkedHashMap<>();
        for (GoalPlanLinkEntity l : links) {
            if (PLAN_MESOCYCLE.equals(l.getPlanType())) {
                mesos.computeIfAbsent(l.getPlanId(), id ->
                    mesocycleRepository.findByIdAndCreatedByAndDeletedFalse(id, userId).orElse(null));
            }
        }
        return activeMesoPhase(links, mesos, goalWeek);
    }
```

- [ ] **Step 3: Write the failing IT:**

```java
package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionTriggerService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Slice-4 triggers: preset↔trajectory mismatch and deload-week entry propose; neutral inputs stay quiet. */
@Transactional
class GoalSuggestionTriggerIT extends AbstractIntegrationTest {

    @Autowired private GoalSuggestionTriggerService triggerService;
    @Autowired private GoalSuggestionRepository suggestionRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalPlanLinkPopulator linkPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCheck_shouldProposeCut_whenCutPrepMesoLinkedToBulkGoal() {
        UUID user = databasePopulator.populateUser("trig1@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Pre-cut prep", "active");
        meso.setGoalPreset("cut-prep");
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, meso.getWeeks());

        triggerService.checkPhaseSuggestions(user, goal.getId());

        var open = suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(
            goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "proposed");
        assertThat(open).isPresent();
        assertThat(open.get().getPayload().suggestedTrajectory()).isEqualTo("cut");
        assertThat(open.get().getPayload().snapshotTrajectory()).isEqualTo("bulk");
    }

    @Test
    void testCheck_shouldStayQuiet_whenPresetAgreesOrNeutral() {
        UUID user = databasePopulator.populateUser("trig2@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        MesocycleEntity agree = trainPopulator.createMesocycle(user, "Pre-cut prep", "active");
        agree.setGoalPreset("cut-prep"); // agrees with cut
        MesocycleEntity neutral = trainPopulator.createMesocycle(user, "Strength", "planned");
        neutral.setGoalPreset("strength"); // not in the config map
        linkPopulator.createLink(user, goal.getId(), "mesocycle", agree.getId(), 1, agree.getWeeks());

        triggerService.checkPhaseSuggestions(user, goal.getId());

        assertThat(suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(
            goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "proposed")).isEmpty();
    }

    @Test
    void testCheck_shouldProposeDeloadOverride_whenCurrentGoalWeekIsDeload() {
        UUID user = databasePopulator.populateUser("trig3@test.local");
        // Goal window starting 2 weeks ago so "today" falls in goal-week 3 — pick the populator
        // that lets the start date float, or set dates directly on the entity before flush:
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        goal.setStartDate(java.time.LocalDate.now().minusWeeks(2));
        goal.setTargetDate(java.time.LocalDate.now().plusWeeks(6));
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Hyp blokk", "active");
        // phaseCurve from the populator is [MEV, MAV, Deload] → weekInMeso 2 (goal-week 3) = Deload.
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, meso.getWeeks());

        triggerService.checkPhaseSuggestions(user, goal.getId());

        var open = suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(
            goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "proposed");
        assertThat(open).isPresent();
        assertThat(open.get().getPayload().balanceOverrideKcal()).isZero();
        assertThat(open.get().getPayload().fromWeek()).isEqualTo(3);
        assertThat(open.get().getPayload().toWeek()).isEqualTo(3);
    }
}
```

(Check `GoalPlanLinkPopulator.createLink`'s real signature at `backend/src/test/java/io/mrkuhne/mezo/support/populator/GoalPlanLinkPopulator.java:21` and match the argument order; the trajectory-mismatch case wins over deload when both fire — the deload proposal is only attempted when no mismatch proposal was made this check, keeping "one open per kind" churn-free.)

- [ ] **Step 4: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='GoalSuggestionTriggerIT' -DfailIfNoTests=false`
Expected: FAIL — no `GoalSuggestionTriggerService`.

- [ ] **Step 5: Implement the trigger service:**

```java
package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalProjectionService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Slice-4 trigger probe (spec §6.5): after every engine evaluate and on meso lifecycle events,
 * check whether the training plan disagrees with the diet — (a) a linked meso's goalPreset maps
 * (config {@code mezo.goal.suggestion.preset-trajectory}) to a trajectory other than the goal's;
 * (b) the CURRENT goal-week's meso phase is a deload with no accepted override yet. Both emit a
 * {@code phase_change} suggestion through {@link GoalSuggestionService#propose} — dedup + the
 * one-open-per-kind invariant make this probe idempotent and nag-free, so calling it on every
 * evaluate (weigh-in cadence) is safe. Never throws on missing/neutral data.
 */
@Service
@RequiredArgsConstructor
public class GoalSuggestionTriggerService {

    private static final String PLAN_MESOCYCLE = "mesocycle";
    private static final String PHASE_DELOAD = "DELOAD";

    private final GoalRepository goalRepository;
    private final GoalPlanLinkRepository linkRepository;
    private final MesocycleRepository mesocycleRepository;
    private final GoalProjectionService projectionService;
    private final GoalSuggestionService suggestionService;
    private final GoalEngineProperties props;

    /** Meso lifecycle entry point (Task 7 listeners): resolve the active goal, then check. */
    @Transactional
    public void onMesoLifecycle(UUID userId) {
        goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream()
            .findFirst()
            .ifPresent(g -> checkPhaseSuggestions(userId, g.getId()));
    }

    @Transactional
    public void checkPhaseSuggestions(UUID userId, UUID goalId) {
        GoalEntity goal = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId).orElse(null);
        if (goal == null || !"active".equals(goal.getStatus())) {
            return; // suggestions only advise the live spine
        }
        boolean proposedMismatch = checkPresetMismatch(userId, goal);
        if (!proposedMismatch) {
            checkDeloadWeek(userId, goal); // one probe per check — mismatch outranks deload
        }
    }

    /** (a) linked meso preset ↔ goal trajectory mismatch → suggest the preset's trajectory. */
    private boolean checkPresetMismatch(UUID userId, GoalEntity goal) {
        List<GoalPlanLinkEntity> links =
            linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goal.getId(), userId);
        for (GoalPlanLinkEntity l : links) {
            if (!PLAN_MESOCYCLE.equals(l.getPlanType())) {
                continue;
            }
            MesocycleEntity m =
                mesocycleRepository.findByIdAndCreatedByAndDeletedFalse(l.getPlanId(), userId).orElse(null);
            if (m == null || m.getGoalPreset() == null || "archived".equals(m.getStatus())) {
                continue;
            }
            String wanted = props.suggestion().presetTrajectory().get(m.getGoalPreset());
            if (wanted == null || wanted.equals(goal.getTrajectory())) {
                continue;
            }
            String dedupKey = "preset:" + m.getGoalPreset() + ":meso:" + m.getId()
                + ":traj:" + goal.getTrajectory();
            var proposed = suggestionService.propose(
                userId, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, dedupKey,
                new GoalSuggestionPayloadJson(
                    "A(z) „" + m.getTitle() + "" mezociklus " + m.getGoalPreset()
                        + " presetje " + huTrajectory(wanted) + " irányt javasol, a cél most "
                        + huTrajectory(goal.getTrajectory()) + ".",
                    wanted, null, null, null, m.getId(), m.getTitle(), goal.getTrajectory()));
            if (proposed != null) {
                return true;
            }
        }
        return false;
    }

    /** (b) the current goal-week's phase class is Deload and no accepted override covers it. */
    private void checkDeloadWeek(UUID userId, GoalEntity goal) {
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), LocalDate.now()) / 7 + 1;
        long totalWeeks = ChronoUnit.WEEKS.between(goal.getStartDate(), goal.getTargetDate());
        if (week < 1 || week > totalWeeks) {
            return;
        }
        String phase = projectionService.phaseForWeek(goal, userId, (int) week);
        if (!PHASE_DELOAD.equalsIgnoreCase(phase)) {
            return;
        }
        boolean covered = goal.getSegmentOverrides() != null && goal.getSegmentOverrides().stream()
            .anyMatch(o -> week >= o.fromWeek() && week <= o.toWeek());
        if (covered) {
            return;
        }
        String dedupKey = "deload:goal:" + goal.getId() + ":w:" + week;
        suggestionService.propose(
            userId, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, dedupKey,
            new GoalSuggestionPayloadJson(
                "Deload hét (W" + week + ") — a regeneráció többet ér, ha ezen a héten tartáson eszel.",
                null, 0, (int) week, (int) week, null, null, goal.getTrajectory()));
    }

    private static String huTrajectory(String t) {
        return switch (t) {
            case "cut" -> "deficit (fogyás)";
            case "bulk" -> "szufficit (izomépítés)";
            default -> "tartás";
        };
    }
}
```

Hook it into `GoalEngineService.evaluate` — add the dependency `private final GoalSuggestionTriggerService triggerService;` and, as the LAST line before both `return rx;` statements is wrong — only the full path: insert before the final `return rx;` (the profile-present path only; the graceful no-profile path has no meaningful trajectory data):

```java
        goal.setPrescription(rx);
        triggerService.checkPhaseSuggestions(userId, goalId); // slice-4 probe — idempotent, deduped
        return rx;
```

**Recursion note:** `accept` → `evaluate` → `checkPhaseSuggestions` re-runs, but after a trajectory accept the mismatch is gone (preset == trajectory) and after a deload accept the week is `covered` — the probe self-quiets. The dedup keys embed the pre-change trajectory, so even the exotic paths can't loop. Beware circular bean wiring: `GoalEngineService → TriggerService → GoalSuggestionService → GoalEngineService` — break it by injecting `GoalEngineService` into `GoalSuggestionService` lazily (`@Lazy` on the constructor param) or by having `accept` publish the evaluate through `ObjectProvider<GoalEngineService>`; pick `@Lazy`, it's the repo-simple form.

- [ ] **Step 6: Run the ITs (trigger + recompute regression)**

Run: `cd backend && ./mvnw test -Dtest='GoalSuggestionTriggerIT,GoalSuggestionServiceIT,GoalEngineRecomputeIT' -DfailIfNoTests=false`
Expected: PASS — the recompute IT confirms the evaluate hook broke nothing.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(goal): phase-suggestion triggers — preset mismatch + deload week, evaluate hook (mezo-XXXX)"
```

---

### Task 7: Meso lifecycle events — MesocycleActivated + goal-side listener

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/MesocycleActivated.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java:235-249` (`activateMesocycle` — publish on the real activation branch only)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/MesoLifecycleSuggestionListener.java`
- Test: extend `GoalSuggestionTriggerIT`

**Interfaces:**
- Consumes: `MesocycleClosed(UUID userId, UUID mesocycleId)` (exists), `GoalSuggestionTriggerService.onMesoLifecycle(UUID userId)`.
- Produces: `MesocycleActivated(UUID userId, UUID mesocycleId)`.

- [ ] **Step 1: The event record** (mirror `MesocycleClosed`'s javadoc style):

```java
package io.mrkuhne.mezo.feature.train;

import java.util.UUID;

/**
 * Published by {@code TrainService.activateMesocycle} on the REAL activation branch only (never
 * on an idempotent re-activate). Consumed AFTER_COMMIT by the goal's diet-phase suggestion
 * listener (Diet Plan slice 4) — in a rolled-back test transaction the event never fires, by
 * design (mirrors {@link MesocycleClosed}).
 */
public record MesocycleActivated(UUID userId, UUID mesocycleId) {
}
```

- [ ] **Step 2: Publish it.** In `TrainService.activateMesocycle`, inside the `if (!"active".equals(target.getStatus()))` block, after `target.setCurrentWeek(...)`:

```java
            eventPublisher.publishEvent(new MesocycleActivated(createdBy, id));
```

(`TrainService` already has an `eventPublisher` — it publishes `MesocycleClosed`; add the import.)

- [ ] **Step 3: The goal-side listener:**

```java
package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.train.MesocycleActivated;
import io.mrkuhne.mezo.feature.train.MesocycleClosed;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Meso lifecycle → diet-phase suggestion probe (Diet Plan slice 4). AFTER_COMMIT like
 * {@code MesoReviewListener}: the probe reads committed state and writes its own transaction.
 * ITs exercise {@code GoalSuggestionTriggerService.onMesoLifecycle} directly — a rolled-back
 * test tx never fires these (the MesocycleClosed contract).
 */
@Component
@RequiredArgsConstructor
public class MesoLifecycleSuggestionListener {

    private final GoalSuggestionTriggerService triggerService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMesocycleActivated(MesocycleActivated event) {
        triggerService.onMesoLifecycle(event.userId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMesocycleClosed(MesocycleClosed event) {
        triggerService.onMesoLifecycle(event.userId());
    }
}
```

**Check `MesoReviewListener` first** (`backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MesoReviewListener.java`): if it wraps the handler with `@Async` or a `REQUIRES_NEW` transactional service call, mirror that exactly — the memory note "Transactional emit deadlock" warns that a REQUIRES_NEW write from inside a still-open transaction hangs; AFTER_COMMIT + a new `@Transactional` on `onMesoLifecycle` (it has one) is the safe combination.

- [ ] **Step 4: IT for the service entry point** (add to `GoalSuggestionTriggerIT`):

```java
    @Test
    void testOnMesoLifecycle_shouldResolveActiveGoalAndPropose() {
        UUID user = databasePopulator.populateUser("trig4@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Pre-cut prep", "active");
        meso.setGoalPreset("cut-prep");
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, meso.getWeeks());

        triggerService.onMesoLifecycle(user);

        assertThat(suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(
            goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "proposed")).isPresent();
    }
```

- [ ] **Step 5: Run**

Run: `cd backend && ./mvnw test -Dtest='GoalSuggestionTriggerIT' -DfailIfNoTests=false`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(train,goal): MesocycleActivated event + meso lifecycle suggestion listener (mezo-XXXX)"
```

**Push notification — deliberately deferred:** the notification feature's `AnchorResolver` is a prose-anchor system (every push needs an `AppNotificationKind`, a generator rule, and an anchor-collision-safe minute). The suggestion is already visible on GoalsPage + the Fuel banner (Task 10); wiring push adds a whole notification-kind lifecycle for marginal reach. File a follow-up bd issue ("goal suggestion push notification kind") instead of building it here.

---

### Task 8: Controller wiring + contract coverage

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/controller/GoalController.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalContractIT.java` (follow its existing MockMvc/RestAssured idiom — read it first)

**Interfaces:**
- Consumes: `GoalSuggestionService.listOpen/accept/dismiss`, generated `GoalApi` methods from Task 1.

- [ ] **Step 1: Implement the three overrides** in `GoalController` (add `private final GoalSuggestionService goalSuggestionService;`):

```java
    @Override
    public List<GoalSuggestionResponse> listGoalSuggestions(UUID id) {
        return goalSuggestionService.listOpen(currentUserId.get(), id);
    }

    @Override
    public GoalResponse acceptGoalSuggestion(UUID id, UUID suggestionId) {
        return goalSuggestionService.accept(currentUserId.get(), id, suggestionId);
    }

    @Override
    public void dismissGoalSuggestion(UUID id, UUID suggestionId) {
        goalSuggestionService.dismiss(currentUserId.get(), id, suggestionId);
    }
```

- [ ] **Step 2: Contract IT.** Read `GoalContractIT.java`, copy its request/assertion idiom for one happy-path per endpoint: list returns `[]` for a fresh goal; propose (via the trigger or `GoalSuggestionPopulator`) → list returns 1; accept returns the updated goal (trajectory flipped); dismiss returns 204 and the row leaves the list.

- [ ] **Step 3: Run**

Run: `cd backend && ./mvnw test -Dtest='GoalContractIT' -DfailIfNoTests=false`
Expected: PASS.

- [ ] **Step 4: Commit** (this is the commit that carries `goal.yml` + generated clients if Task 1 deferred them):

```bash
git add api/feature/goal/goal.yml backend frontend/src/data/_client/api.gen.ts
git commit -m "feat(api,goal): suggestion endpoints — list/accept/dismiss (mezo-XXXX)"
```

---

### Task 9: FE data layer — api + hooks + mocks

**Files:**
- Modify: `frontend/src/data/me/goalApi.ts` (suggestion calls)
- Modify: `frontend/src/data/me/goalHooks.ts` (`useGoalSuggestions`, `useSuggestionActions`)
- Modify: `frontend/src/data/me/goals.ts` (mock fixture)
- Test: `frontend/src/data/me/goalSuggestionHooks.test.tsx` (both modes)

**Interfaces:**
- Consumes: generated `components['schemas']['GoalSuggestionResponse']` from Task 1.
- Produces: `useGoalSuggestions(goalId: string | null): { suggestions: GoalSuggestionResponse[]; pending: boolean }`; `useSuggestionActions(): { accept(goalId, sid): Promise<...>; dismiss(goalId, sid): Promise<void>; pending: boolean }`.

- [ ] **Step 1: goalApi additions:**

```ts
export type GoalSuggestionResponse = components['schemas']['GoalSuggestionResponse']
```

```ts
  // Diet-phase suggestions (Diet Plan slice 4) — suggest + approve: the engine proposes,
  // the owner decides. accept returns the updated goal (trajectory/override applied + re-evaluated).
  suggestions: (id: string): Promise<GoalSuggestionResponse[]> =>
    apiFetch<GoalSuggestionResponse[]>(`/api/goals/${id}/suggestions`),
  acceptSuggestion: (id: string, suggestionId: string): Promise<GoalResponse> =>
    apiFetch<GoalResponse>(`/api/goals/${id}/suggestions/${suggestionId}/accept`, { method: 'POST' }),
  dismissSuggestion: (id: string, suggestionId: string): Promise<void> =>
    apiFetch<void>(`/api/goals/${id}/suggestions/${suggestionId}/dismiss`, { method: 'POST' }),
```

- [ ] **Step 2: Mock fixture** in `goals.ts` (after `goalResponse`):

```ts
// Open diet-phase suggestion (slice 4) — mock mode renders one proposed card so the
// GoalsPage suggestion surface + Fuel banner are visible offline. Accept/dismiss no-op.
export const goalSuggestions: GoalSuggestionResponse[] = [
  {
    id: 'sug-deload-w3',
    kind: 'phase_change',
    status: 'proposed',
    payload: {
      reason: 'Deload hét (W3) — a regeneráció többet ér, ha ezen a héten tartáson eszel.',
      balanceOverrideKcal: 0,
      fromWeek: 3,
      toWeek: 3,
      snapshotTrajectory: 'cut',
    },
    createdAt: '2026-05-22T06:10:00Z',
  },
]
```

(Import the type from `goalApi`. If the generated payload type marks other fields required, satisfy the compiler with `null`s per the contract's nullability.)

- [ ] **Step 3: Hooks** in `goalHooks.ts` (mirror the file's mock/real branching):

```ts
export function useGoalSuggestions(goalId: string | null) {
  const mock = isMockMode()
  const { data, isPending } = useQuery({
    queryKey: ['goal', goalId, 'suggestions'],
    queryFn: mock ? async () => mockGoalSuggestions : () => goalApi.suggestions(goalId as string),
    enabled: !!goalId,
    initialData: mock ? mockGoalSuggestions : undefined,
    staleTime: mock ? Infinity : undefined, // mock-cache clobber guard
  })
  return { suggestions: data ?? [], pending: !mock && isPending }
}

export function useSuggestionActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const invalidate = (goalId: string) => {
    if (mock) return
    qc.invalidateQueries({ queryKey: ['goal', goalId, 'suggestions'] })
    qc.invalidateQueries({ queryKey: ['goals'] }) // accept re-evaluates the prescription
  }
  const acceptM = useMutation({
    mutationFn: async ({ goalId, sid }: { goalId: string; sid: string }) => {
      if (mock) return null
      return goalApi.acceptSuggestion(goalId, sid)
    },
    onSuccess: (_d, { goalId }) => invalidate(goalId),
  })
  const dismissM = useMutation({
    mutationFn: async ({ goalId, sid }: { goalId: string; sid: string }) => {
      if (mock) return
      await goalApi.dismissSuggestion(goalId, sid)
    },
    onSuccess: (_d, { goalId }) => invalidate(goalId),
  })
  const accept = useCallback((goalId: string, sid: string) => acceptM.mutateAsync({ goalId, sid }), [acceptM])
  const dismiss = useCallback((goalId: string, sid: string) => dismissM.mutateAsync({ goalId, sid }), [dismissM])
  return { accept, dismiss, pending: acceptM.isPending || dismissM.isPending }
}
```

(Import `goalSuggestions as mockGoalSuggestions` from `@/data/me/goals`.)

- [ ] **Step 4: Hook test** `goalSuggestionHooks.test.tsx` — copy the render/QueryClient harness from an existing hooks test in `frontend/src/data` (grep `renderHook` there): mock mode returns the fixture synchronously; real mode fetches (msw or apiFetch mock per the neighboring test's idiom) and `dismiss` invalidates.

- [ ] **Step 5: Run both modes**

Run: `cd frontend && pnpm vitest run src/data/me && VITE_USE_MOCK=true pnpm vitest run src/data/me`
Expected: PASS in both.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data
git commit -m "feat(fe/me): goal suggestion api + dual-mode hooks + mock fixture (mezo-XXXX)"
```

---

### Task 10: FE UI — suggestion card on GoalsPage + Fuel banner

**Files:**
- Create: `frontend/src/features/me/components/GoalSuggestionCard.tsx`
- Modify: `frontend/src/features/me/pages/GoalsPage.tsx` (render cards above `<GoalRecept …>` at line ~238)
- Create: `frontend/src/features/fuel/components/DietSuggestionBanner.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx` (banner near the top)
- Test: `frontend/src/features/me/components/GoalSuggestionCard.test.tsx`, extend `FuelMaiPage.test.tsx`

**Interfaces:**
- Consumes: Task 9's hooks; existing card/chip/token idiom (`GoalRecept.tsx` is the style reference — inline style + CSS vars, `className="card"`/`"chip"`).

- [ ] **Step 1: Card component** (accept/dismiss actions, verdict-banner styling family):

```tsx
import type { GoalSuggestionResponse } from '@/data/me/goalApi'

// Diet-phase suggestion card (Diet Plan slice 4) — the suggest+approve surface: the
// engine proposed a diet change (trajectory flip or deload maintenance week), the owner
// decides here. Pure presentational; actions come from useSuggestionActions via props.
interface GoalSuggestionCardProps {
  suggestion: GoalSuggestionResponse
  onAccept: () => void
  onDismiss: () => void
  pending?: boolean
}

const TRAJECTORY_HU: Record<string, string> = { cut: 'Fogyás ↓', bulk: 'Hízás ↑', maintain: 'Tartás ≈' }

export function GoalSuggestionCard({ suggestion, onAccept, onDismiss, pending }: GoalSuggestionCardProps) {
  const p = suggestion.payload
  const headline = p.suggestedTrajectory
    ? `Javaslat: váltás — ${TRAJECTORY_HU[p.suggestedTrajectory]}`
    : `Javaslat: deload hét tartáson (W${p.fromWeek})`
  return (
    <div
      className="card"
      style={{
        padding: '10px 11px',
        marginBottom: 8,
        background: 'color-mix(in srgb, var(--warning) 7%, transparent)',
        border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)',
      }}
    >
      <div className="row" style={{ alignItems: 'center', gap: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flex: '0 0 auto' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)' }}>{headline}</span>
      </div>
      <p style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '6px 0 8px' }}>{p.reason}</p>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="chip" onClick={onAccept} disabled={pending}
          style={{ borderColor: 'transparent', background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}>
          {pending ? 'Alkalmazás…' : '✓ Elfogadom'}
        </button>
        <button type="button" className="chip" onClick={onDismiss} disabled={pending}
          style={{ color: 'var(--text-tertiary)' }}>
          Elvetem
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into GoalsPage.** Where `<GoalRecept` renders (line ~238), above it:

```tsx
      {suggestions.map(s => (
        <GoalSuggestionCard
          key={s.id}
          suggestion={s}
          onAccept={() => accept(goalId as string, s.id)}
          onDismiss={() => dismiss(goalId as string, s.id)}
          pending={suggestionPending}
        />
      ))}
```

with, near the page's other hooks: `const { suggestions } = useGoalSuggestions(goalId)` and `const { accept, dismiss, pending: suggestionPending } = useSuggestionActions()`. On accept, the goals invalidation refreshes the recept automatically. If accept rejects with the 409 stale error, surface the existing error-toast idiom the page uses for other mutations (grep how GoalsPage handles mutation errors; if it has none, `catch` and render a one-line `text-secondary` notice "A javaslat elavult — frissítsd az oldalt." under the cards).

- [ ] **Step 3: Fuel banner.** `DietSuggestionBanner.tsx` — a slim link-banner shown only when there's an open suggestion:

```tsx
import { Link } from 'react-router-dom'
import { useGoal, useGoalSuggestions } from '@/data/me/goalHooks'

// Slim Fuel-side surface for an open diet suggestion (slice 4): the decision lives on
// the Cél page — this banner only signals + deep-links. Renders nothing when quiet.
export function DietSuggestionBanner() {
  const { goalId } = useGoal()
  const { suggestions } = useGoalSuggestions(goalId)
  if (!suggestions.length) return null
  return (
    <Link
      to="/me/goals"
      className="card row"
      style={{
        alignItems: 'center', gap: 7, padding: '8px 11px', marginBottom: 8,
        textDecoration: 'none',
        background: 'color-mix(in srgb, var(--warning) 7%, transparent)',
        border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
        Diéta-javaslat vár a Cél oldalon
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
    </Link>
  )
}
```

Render it near the top of `FuelMaiPage.tsx`'s main column (read the page; place it above the KeretHero block). **Verify the route path** — grep the router for the GoalsPage path (`goals` under the me feature) and use the real path, not a guess.

- [ ] **Step 4: Component tests.** `GoalSuggestionCard.test.tsx`: renders reason + headline for both payload shapes; accept/dismiss callbacks fire; disabled while pending. Extend `FuelMaiPage.test.tsx`: mock mode shows the banner (fixture has one open suggestion) and it links to the goals path.

- [ ] **Step 5: Run both modes + build**

Run: `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`
Expected: PASS ×2 + clean build. (Baseline note: `chatApi.test.ts` + `MesocyclePlannerPage.test.tsx` have 2 pre-existing failures on main — those two are not yours; anything else red is.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): goal suggestion cards on Cél + Fuel banner (mezo-XXXX)"
```

---

### Task 11: CODEMAP, docs, gates, wrap-up

**Files:**
- Modify: `docs/CODEMAP.md` (regenerated), `docs/features/goal-engine.md` (§5 bridges + recompute-trigger table gain the suggestion probe; §9 removes "deferred" for the meso→diet bridge), `docs/features/train.md` (§5 integration table row: MesocycleActivated/Closed → goal suggestion probe)

- [ ] **Step 1: Regenerate CODEMAP**

Run: `node scripts/gen-codemap.mjs`
Expected: `docs/CODEMAP.md` gains the new goal files.

- [ ] **Step 2: Update the two feature docs** — one short paragraph + table rows each, in the docs' existing voice; goal-engine.md's trigger table gets a row: `Meso activate/close | MesoLifecycleSuggestionListener → trigger probe (suggestion, not evaluate)`.

- [ ] **Step 3: Full gate check**

Run: `cd backend && ./mvnw test -Dtest='GoalSuggestionServiceIT,GoalSuggestionTriggerIT,GoalProjectionServiceIT,GoalEngineRecomputeIT,GoalContractIT,GoalServiceIT' -DfailIfNoTests=false`
Run: `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`
Run: `git status` → verify no emptied `archunit-store` file, no stray generated diffs.
Expected: all green (minus the two documented pre-existing FE failures).

- [ ] **Step 4: Commit + close out**

```bash
git add docs
git commit -m "docs(goal,train): slice-4 suggestion bridge documented (mezo-XXXX)"
```

File the follow-up bd issue: "goal suggestion push notification kind (AnchorResolver integration)" — deferred from this slice by design.

---

## Self-review notes (already folded in)

- Spec coverage: §6.1 suggestion entity (T2–T3), §6.5 triggers + accept semantics (T5–T7), §6.8 race guard (T5), FE surfaces (T9–T10). The spec's "push via the existing notification anchors" is consciously deferred with a filed follow-up (T7 note) — the two in-app surfaces satisfy the suggest+approve loop.
- Naming: this slice never uses the name `macroSplit` — no collision with the in-flight mezo-tjua work.
- Type consistency: `GoalSuggestionPayloadJson` field order matches the yaml schema and the mapper; `WeekLoad` gains its 4th component in exactly two construction sites (both in the week loop) — the compiler enforces the rest.
