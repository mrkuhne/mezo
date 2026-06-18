# Goal System — G3 Plan-Links (Timeline Coupling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Couple owned plans (mesocycles + running blocks) to a goal as positioned bars on the goal's timeline — `goal_plan_link` with week-positions, soft gym-tiling gap detection, and cascade — and surface the real linked plans in the goal hero (replacing G1's empty `toGoal` `mesocycles: []`).

**Architecture:** A new `GoalPlanLink` aggregate under `feature/goal/` that references a `goal` plus a polymorphic plan (`mesocycle` | `running_block`, by `plan_type` + `plan_id`). A `GoalTimelineService` derives each link's `end_week` from the plan's own `weeks`, validates plan ownership, and computes the uncovered gym-lane weeks (soft flag — non-blocking). New endpoints on `GoalApi` attach/detach/list. Frontend: a `goalLinkApi`, and `useGoal()` enriched to fetch the goal's timeline and populate `linkedMesocycles` + `goal.mesocycles` from real data. **Volleyball stays ambient (never linked).** The timeline LANE UI + the attach/detach hub are G4 — G3 ships the data + API + the read-side wiring (seeded so the hero renders).

**Tech Stack:** Spring Boot 4.x · Java 21 · Maven · PostgreSQL 16 · Liquibase · MapStruct · openapi-generator (spring) · React 19 · TanStack Query · Vitest + MSW.

**Driving issue:** `mezo-3sc` (G3), child of epic `mezo-2hp`. **Spec:** `docs/superpowers/specs/2026-06-18-goal-system-design.md` (§2 coupling model, §3.2 GoalPlanLink, decisions D3–D5). **Reuse the G1 patterns** documented in `docs/superpowers/plans/2026-06-18-goal-system-g1-foundation.md` (entity/repo/service/mapper/controller/contract/migration/IT idioms) — they are unchanged here.

## Global Constraints

- **House standards (mandatory, unchanged from G1):** UUID PKs (`gen_random_uuid()`), `OwnedEntity` base (`created_by`/`is_deleted`/`created_at`), `@SQLDelete`+`@SQLRestriction("is_deleted = false")` soft-delete, lowercase-String + DB CHECK (not JPA enum), `@Transactional` on writes only, ownership stamped server-side, `requireOwned`→404 `RESOURCE_NOT_FOUND`, errors via `SystemMessage`/`SystemRuntimeErrorException`, contract-first, immutable Liquibase changesets (`{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`, named `pk_/fk_/uq_/ck_/idx_` constraints, register in `1.0.0_master.yml`), new owned table → `ResetDatabase` TRUNCATE list + a `*Populator` in `AbstractIntegrationTest` `@Import`. Integration-first tests (`*ServiceIT`/`*ContractIT`), AssertJ, no mocks/H2, `test{Method}_should{Result}_when{Condition}`.
- **Package:** `feature/goal/` (link entity/repo/service/mapper live alongside the existing Goal ones). The existing `GoalController` gains the new endpoints (same `Goal` tag).
- **Cross-feature reads:** the service reads `MesocycleRepository` / `RunningBlockRepository` (from `feature/train`) to validate a plan exists, is owned, and to read its `weeks` for `end_week`. Add **read-only** finders there if missing (`findByIdAndCreatedByAndDeletedFalse`) — do not change train write logic.
- **Polymorphic plan ref:** `plan_type` ∈ {`mesocycle`,`running_block`} (DB CHECK) + `plan_id uuid`. NO DB FK on `plan_id` (it targets two tables); ownership/existence is enforced in the service. `goal_id` DOES get a real FK to `goal(id)` ON DELETE CASCADE.
- **`end_week` is derived, never trusted from the client:** `end_week = start_week + plan.weeks - 1` (computed from the plan's own `weeks`). `start_week` is 1-based, validated `1 ≤ start_week` and `end_week ≤ goal.weeks`-ish (a link may extend past the window — clamp/flag, don't reject; see Task 5).
- **Cascade:** a link belongs to a goal; when the goal is soft-deleted, its links soft-delete too (handle in `GoalService.deleteGoal`). Archiving a goal does NOT delete links (an archived goal keeps its history).
- **Soft gap detection is non-blocking (D5):** the gym lane (mesocycle links) SHOULD tile the goal window; uncovered weeks are reported as gaps, never rejected. Running links are episodic (no gap obligation). Volleyball is ambient — never a link.
- **Scope boundary:** G3 ships the link backend + attach/detach/list API + the FE read-side (linked plans render in the goal hero, seeded). The timeline LANE visualization, the gap RESOLVER UI, and the attach/detach HUB are **G4**. No goal-creation UI here.
- **Build/test:** backend `cd backend && ./mvnw clean test`; contract `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`; frontend `pnpm test` (both modes) + `pnpm build`. Compose Postgres on :15432.

---

### Task 1: Contract — goal-plan-link endpoints + schemas

**Files:**
- Modify: `api/feature/goal/goal.yml` (add 3 paths + schemas under the existing `Goal` tag)
- Regenerate: `api/openapi.yml`, `frontend/src/lib/api.gen.ts`

**Interfaces:**
- Produces: `GoalPlanLinkResponse` (id, planType, planId, startWeek, endWeek, plan: { title, status, startDate, endDate, weeks }), `GoalPlanAttachRequest` (planType, planId, startWeek), `GoalTimelineResponse` (goalId, weeks, links: GoalPlanLinkResponse[], gaps: { fromWeek, toWeek }[]). Operations `listGoalTimeline`, `attachGoalPlan`, `detachGoalPlan`.

- [ ] **Step 1: Add the paths to `api/feature/goal/goal.yml`** (append under `paths:`)

```yaml
  /api/goals/{id}/timeline:
    get:
      tags: [Goal]
      operationId: listGoalTimeline
      summary: The goal's positioned plan links + uncovered gym-lane gaps
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '200': { description: Timeline, content: { application/json: { schema: { $ref: '#/components/schemas/GoalTimelineResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/goals/{id}/plans:
    post:
      tags: [Goal]
      operationId: attachGoalPlan
      summary: Attach an owned mesocycle or running block at a week position
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/GoalPlanAttachRequest' } } }
      responses:
        '201': { description: Linked, content: { application/json: { schema: { $ref: '#/components/schemas/GoalPlanLinkResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Goal or plan not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/goals/{id}/plans/{linkId}:
    delete:
      tags: [Goal]
      operationId: detachGoalPlan
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: linkId, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204': { description: Detached }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

- [ ] **Step 2: Add the schemas** under `components.schemas` in `goal.yml`

```yaml
    GoalPlanRef:
      type: object
      required: [title, status, startDate, endDate, weeks]
      properties:
        title: { type: string }
        status: { type: string, enum: [planned, active, archived] }
        startDate: { type: string, format: date }
        endDate: { type: string, format: date }
        weeks: { type: integer }
    GoalPlanLinkResponse:
      type: object
      required: [id, planType, planId, startWeek, endWeek, plan]
      properties:
        id: { type: string, format: uuid }
        planType: { type: string, enum: [mesocycle, running_block] }
        planId: { type: string, format: uuid }
        startWeek: { type: integer }
        endWeek: { type: integer }
        plan: { $ref: '#/components/schemas/GoalPlanRef' }
    GoalPlanAttachRequest:
      type: object
      required: [planType, planId, startWeek]
      properties:
        planType: { type: string, pattern: '^(mesocycle|running_block)$' }
        planId: { type: string, format: uuid }
        startWeek: { type: integer, minimum: 1 }
    GoalGap:
      type: object
      required: [fromWeek, toWeek]
      properties:
        fromWeek: { type: integer }
        toWeek: { type: integer }
    GoalTimelineResponse:
      type: object
      required: [goalId, weeks, links, gaps]
      properties:
        goalId: { type: string, format: uuid }
        weeks: { type: integer }
        links: { type: array, items: { $ref: '#/components/schemas/GoalPlanLinkResponse' } }
        gaps: { type: array, items: { $ref: '#/components/schemas/GoalGap' } }
```

- [ ] **Step 3: Regenerate** — `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`. Verify: `grep -c "GoalTimelineResponse" ../api/openapi.yml src/lib/api.gen.ts` ≥ 1 each.

- [ ] **Step 4: Commit** — `git add api/feature/goal api/openapi.yml frontend/src/lib/api.gen.ts && git commit -m "feat(api): goal-plan-link timeline contract (mezo-3sc)"`

---

### Task 2: Migration — `goal_plan_link` table

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606181600_mezo-3sc_create_goal_plan_link.sql`
- Modify: `1.0.0_master.yml`; `ResetDatabase.java` (TRUNCATE list)

- [ ] **Step 1: Write the changeset**

```sql
CREATE TABLE goal_plan_link (
    id          UUID DEFAULT gen_random_uuid(),
    created_by  UUID NOT NULL,
    goal_id     UUID NOT NULL,
    plan_type   TEXT NOT NULL,
    plan_id     UUID NOT NULL,
    start_week  INT NOT NULL,
    end_week    INT NOT NULL,
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_goal_plan_link_id PRIMARY KEY (id),
    CONSTRAINT fk_goal_plan_link_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_goal_plan_link_goal_id_goal_id
        FOREIGN KEY (goal_id) REFERENCES goal(id) ON DELETE CASCADE,
    CONSTRAINT ck_goal_plan_link_plan_type CHECK (plan_type IN ('mesocycle','running_block')),
    CONSTRAINT ck_goal_plan_link_weeks CHECK (start_week >= 1 AND end_week >= start_week)
);
CREATE INDEX idx_goal_plan_link_goal_id ON goal_plan_link (goal_id);
CREATE INDEX idx_goal_plan_link_created_by ON goal_plan_link (created_by);
```

> No FK on `plan_id` (polymorphic — targets `mesocycle` OR `running_block`); existence/ownership enforced in the service. `goal_id` has a real cascade FK.

- [ ] **Step 2: Register in `1.0.0_master.yml`** (append a `changeSet` with id `"1.0.0:202606181600_mezo-3sc_create_goal_plan_link"`, author `daniel.kuhne`, `sqlFile` relativeToChangelogFile path `script/202606181600_mezo-3sc_create_goal_plan_link.sql`).

- [ ] **Step 3: Add `goal_plan_link` to `ResetDatabase`'s TRUNCATE list** — insert it BEFORE `goal` in the `TRUNCATE TABLE ... CASCADE` list (child before parent for readability; CASCADE handles it regardless): `... running_block, goal_plan_link, goal, biometric_profile CASCADE`.

- [ ] **Step 4: Verify boot** — `cd backend && ./mvnw clean test -Dtest=CorsConfigIT` → PASS (Liquibase applies the changeset).

- [ ] **Step 5: Commit** — `git add backend/src/main/resources/db/changelog backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java && git commit -m "feat(db): goal_plan_link table (mezo-3sc)"`

---

### Task 3: `GoalPlanLinkEntity` + repository + populator + persistence IT

**Files:**
- Create: `feature/goal/entity/GoalPlanLinkEntity.java`, `feature/goal/repository/GoalPlanLinkRepository.java`
- Create: `support/populator/GoalPlanLinkPopulator.java`; Modify: `AbstractIntegrationTest` `@Import`
- Test: `feature/goal/GoalPlanLinkServiceIT.java`

**Interfaces:**
- Produces: `GoalPlanLinkEntity` (fields: `UUID id`, `UUID goalId`, `String planType`, `UUID planId`, `Integer startWeek`, `Integer endWeek`); `GoalPlanLinkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(UUID,UUID)`, `findByIdAndCreatedByAndDeletedFalse(UUID,UUID)`. `GoalPlanLinkPopulator.createLink(UUID owner, UUID goalId, String planType, UUID planId, int startWeek, int endWeek)`.

- [ ] **Step 1: Write `GoalPlanLinkEntity`** (mirror `GoalEntity`'s annotations; no jsonb/array here)

```java
package io.mrkuhne.mezo.feature.goal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** A positioned coupling of an owned plan (mesocycle|running_block) to a {@code goal}'s timeline. */
@Getter
@Setter
@Entity
@Table(name = "goal_plan_link")
@SQLDelete(sql = "update goal_plan_link set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GoalPlanLinkEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Column(name = "goal_id", nullable = false, columnDefinition = "uuid") private UUID goalId;
    @NotNull @Column(name = "plan_type", nullable = false) private String planType; // mesocycle|running_block (CHECK)
    @NotNull @Column(name = "plan_id", nullable = false, columnDefinition = "uuid") private UUID planId;
    @NotNull @Column(name = "start_week", nullable = false) private Integer startWeek;
    @NotNull @Column(name = "end_week", nullable = false) private Integer endWeek;
}
```

- [ ] **Step 2: Write `GoalPlanLinkRepository`**

```java
package io.mrkuhne.mezo.feature.goal.repository;

import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalPlanLinkRepository extends JpaRepository<GoalPlanLinkEntity, UUID> {
    List<GoalPlanLinkEntity> findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(UUID goalId, UUID createdBy);
    Optional<GoalPlanLinkEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
```

- [ ] **Step 3: Write `GoalPlanLinkPopulator`** (`@TestComponent @RequiredArgsConstructor`, `saveAndFlush`), register `GoalPlanLinkPopulator.class` in `AbstractIntegrationTest`'s `@Import` array.

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class GoalPlanLinkPopulator {
    private final GoalPlanLinkRepository repository;

    public GoalPlanLinkEntity createLink(UUID owner, UUID goalId, String planType, UUID planId, int startWeek, int endWeek) {
        GoalPlanLinkEntity e = new GoalPlanLinkEntity();
        e.setCreatedBy(owner);
        e.setGoalId(goalId);
        e.setPlanType(planType);
        e.setPlanId(planId);
        e.setStartWeek(startWeek);
        e.setEndWeek(endWeek);
        return repository.saveAndFlush(e);
    }
}
```

- [ ] **Step 4: Write the persistence IT** (`GoalPlanLinkServiceIT extends AbstractIntegrationTest`, `@Transactional`): round-trip a link; the `ck_goal_plan_link_plan_type` CHECK rejects an unknown plan_type; the goal-scoped finder excludes other goals/owners. Use `databasePopulator.populateUser` + `GoalPopulator.createGoal` for FK validity. (Mirror `GoalServiceIT`'s structure.)

- [ ] **Step 5: Run** — `cd backend && ./mvnw clean test -Dtest=GoalPlanLinkServiceIT` (RED→GREEN).

- [ ] **Step 6: Commit** — `git add backend/src/main/java/io/mrkuhne/mezo/feature/goal backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/goal && git commit -m "feat(goal): GoalPlanLinkEntity + repository + IT (mezo-3sc)"`

---

### Task 4: `GoalPlanLinkService` — attach / detach / list

**Files:**
- Create: `feature/goal/service/GoalPlanLinkService.java`, `feature/goal/mapper/GoalPlanLinkMapper.java`
- Modify (read-only finders if missing): `feature/train/repository/MesocycleRepository.java`, `RunningBlockRepository.java`
- Test: extend `GoalPlanLinkServiceIT`

**Interfaces:**
- Consumes: `GoalPlanLinkRepository`, `GoalRepository` (own the goal), `MesocycleRepository` + `RunningBlockRepository` (validate the plan + read its `weeks`), `GoalPlanLinkMapper`, generated `GoalPlanLinkResponse`/`GoalPlanAttachRequest`.
- Produces: `attachPlan(UUID userId, UUID goalId, GoalPlanAttachRequest req)` → `GoalPlanLinkResponse` (computes `endWeek = startWeek + plan.weeks - 1`); `detachPlan(UUID userId, UUID goalId, UUID linkId)`; `listLinks(UUID userId, UUID goalId)` → `List<GoalPlanLinkEntity>` (for the timeline service). A private `PlanRef resolvePlan(userId, planType, planId)` returning `{ title, status, startDate, endDate, weeks }`.

- [ ] **Step 1: Ensure the train repos expose an owned-by-id finder** — confirm/add to `MesocycleRepository` and `RunningBlockRepository`: `Optional<MesocycleEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy)` (RunningBlockRepository already has this per G1 extraction; add the mesocycle one if missing). Read-only addition; do not touch train write logic.

- [ ] **Step 2: Write `GoalPlanLinkMapper`** (`@Mapper(componentModel="spring")`) — `toResponse(GoalPlanLinkEntity, GoalPlanRef plan)` with `planType`→enum via expression `GoalPlanLinkResponse.PlanTypeEnum.fromValue(...)`, and the `plan` set from the resolved ref. (MapStruct: pass the `GoalPlanRef` as a second source param; map fields by name.)

- [ ] **Step 3: Write `GoalPlanLinkService`**

```java
package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalPlanAttachRequest;
import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalPlanRef;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.mapper.GoalPlanLinkMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GoalPlanLinkService {

    private final GoalPlanLinkRepository linkRepository;
    private final GoalRepository goalRepository;
    private final MesocycleRepository mesocycleRepository;
    private final RunningBlockRepository runningBlockRepository;
    private final GoalPlanLinkMapper mapper;

    public List<GoalPlanLinkEntity> listLinks(UUID userId, UUID goalId) {
        requireGoal(userId, goalId);
        return linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goalId, userId);
    }

    @Transactional
    public GoalPlanLinkResponse attachPlan(UUID userId, UUID goalId, GoalPlanAttachRequest req) {
        requireGoal(userId, goalId);
        GoalPlanRef plan = resolvePlan(userId, req.getPlanType(), req.getPlanId());
        GoalPlanLinkEntity e = new GoalPlanLinkEntity();
        e.setCreatedBy(userId);
        e.setGoalId(goalId);
        e.setPlanType(req.getPlanType());
        e.setPlanId(req.getPlanId());
        e.setStartWeek(req.getStartWeek());
        e.setEndWeek(req.getStartWeek() + plan.getWeeks() - 1); // derived — request never sets end_week
        return mapper.toResponse(linkRepository.save(e), plan);
    }

    @Transactional
    public void detachPlan(UUID userId, UUID goalId, UUID linkId) {
        requireGoal(userId, goalId);
        GoalPlanLinkEntity link = linkRepository.findByIdAndCreatedByAndDeletedFalse(linkId, userId)
            .filter(l -> l.getGoalId().equals(goalId))
            .orElseThrow(() -> notFound());
        linkRepository.delete(link); // @SQLDelete soft-deletes
    }

    /** Resolve + ownership-check the referenced plan, returning the display ref the response carries. */
    public GoalPlanRef resolvePlan(UUID userId, String planType, UUID planId) {
        if ("mesocycle".equals(planType)) {
            var m = mesocycleRepository.findByIdAndCreatedByAndDeletedFalse(planId, userId).orElseThrow(this::notFound);
            return GoalPlanRef.builder().title(m.getTitle())
                .status(GoalPlanRef.StatusEnum.fromValue(m.getStatus()))
                .startDate(m.getStartDate()).endDate(m.getEndDate()).weeks(m.getWeeks()).build();
        }
        var b = runningBlockRepository.findByIdAndCreatedByAndDeletedFalse(planId, userId).orElseThrow(this::notFound);
        return GoalPlanRef.builder().title(b.getTitle())
            .status(GoalPlanRef.StatusEnum.fromValue(b.getStatus()))
            .startDate(b.getStartDate()).endDate(b.getEndDate()).weeks(b.getWeeks()).build();
    }

    private GoalEntity requireGoal(UUID userId, UUID goalId) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId).orElseThrow(this::notFound);
    }

    private SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
```

> Verify the generated `GoalPlanRef.builder()` + `GoalPlanRef.StatusEnum` names against `target/generated-sources/openapi/.../api/dto/GoalPlanRef.java` after the first build; adjust the builder/enum names if the generator differs. `getWeeks()` is `Integer` on both entities.

- [ ] **Step 4: Add service ITs to `GoalPlanLinkServiceIT`** — attach a mesocycle (assert `endWeek == startWeek + meso.weeks - 1`); attach with a foreign/unknown `planId` → 404; detach removes the link; attaching a `running_block` resolves the block ref. Use `TrainPopulator` to create the meso/running for the owner.

- [ ] **Step 5: Run** — `cd backend && ./mvnw clean test -Dtest=GoalPlanLinkServiceIT` (RED→GREEN).

- [ ] **Step 6: Commit** — `git commit -m "feat(goal): GoalPlanLinkService attach/detach/list + mapper (mezo-3sc)"`

---

### Task 5: `GoalTimelineService` — coverage + gym-lane gaps

**Files:**
- Create: `feature/goal/service/GoalTimelineService.java`
- Test: `feature/goal/GoalTimelineServiceIT.java`

**Interfaces:**
- Consumes: `GoalRepository` (the goal's `weeks`), `GoalPlanLinkService.listLinks`, `GoalPlanLinkService.resolvePlan` (for each link's plan ref + type).
- Produces: `getTimeline(UUID userId, UUID goalId)` → `GoalTimelineResponse` (`links` mapped, `gaps` = the uncovered `[fromWeek,toWeek]` runs in the goal window NOT covered by any **mesocycle** link).

- [ ] **Step 1: Write `GoalTimelineService`** — the gap algorithm: mark weeks `1..goal.weeks` covered iff some `mesocycle`-type link spans them (`startWeek ≤ w ≤ endWeek`); collapse uncovered runs into `[fromWeek,toWeek]` gaps. Running links do NOT count toward coverage (episodic). Clamp link weeks to `1..goal.weeks` for the coverage scan (a link extending past the window covers up to `goal.weeks`).

```java
// core of getTimeline:
GoalEntity goal = requireGoal(userId, goalId);
List<GoalPlanLinkEntity> links = linkService.listLinks(userId, goalId);
int weeks = goal.getWeeks();
boolean[] covered = new boolean[weeks + 1]; // 1-based
List<GoalPlanLinkResponse> linkDtos = new ArrayList<>();
for (GoalPlanLinkEntity l : links) {
    GoalPlanRef ref = linkService.resolvePlan(userId, l.getPlanType(), l.getPlanId());
    linkDtos.add(mapper.toResponse(l, ref));
    if ("mesocycle".equals(l.getPlanType())) {
        for (int w = Math.max(1, l.getStartWeek()); w <= Math.min(weeks, l.getEndWeek()); w++) covered[w] = true;
    }
}
List<GoalGap> gaps = new ArrayList<>();
int run = -1;
for (int w = 1; w <= weeks; w++) {
    if (!covered[w] && run < 0) run = w;
    if ((covered[w] || w == weeks) && run >= 0) {
        int end = covered[w] ? w - 1 : w;
        gaps.add(GoalGap.builder().fromWeek(run).toWeek(end).build());
        run = -1;
    }
}
return GoalTimelineResponse.builder().goalId(goalId).weeks(weeks).links(linkDtos).gaps(gaps).build();
```

> Confirm the generated builder names (`GoalGap.builder()`, `GoalTimelineResponse.builder()`). Inject `GoalPlanLinkMapper mapper` here too (or have `GoalPlanLinkService` return DTOs). Keep this read-only (no `@Transactional`).

- [ ] **Step 2: Write `GoalTimelineServiceIT`** — a goal of 8 weeks + a 6-week mesocycle link at week 1 ⇒ exactly one gap `[7,8]`; a full-coverage meso (8 weeks at week 1) ⇒ no gaps; a running link does NOT fill a gap (episodic). Assert link ordering by `startWeek`.

- [ ] **Step 3: Run** — `cd backend && ./mvnw clean test -Dtest=GoalTimelineServiceIT` (RED→GREEN).

- [ ] **Step 4: Commit** — `git commit -m "feat(goal): GoalTimelineService coverage + gym-lane gaps (mezo-3sc)"`

---

### Task 6: `GoalController` endpoints + cascade-on-delete + ContractIT

**Files:**
- Modify: `feature/goal/controller/GoalController.java` (implement the 3 new generated methods)
- Modify: `feature/goal/service/GoalService.java` (`deleteGoal` cascades links)
- Test: `feature/goal/GoalTimelineContractIT.java`

**Interfaces:**
- Consumes: `GoalPlanLinkService`, `GoalTimelineService` injected into `GoalController`.
- Produces: HTTP `GET /api/goals/{id}/timeline`, `POST /api/goals/{id}/plans`, `DELETE /api/goals/{id}/plans/{linkId}`.

- [ ] **Step 1: Implement the 3 new `GoalApi` overrides** in `GoalController` (thin delegates passing `currentUserId.get()`): `listGoalTimeline(id)` → `goalTimelineService.getTimeline(...)`; `attachGoalPlan(id, req)` → `goalPlanLinkService.attachPlan(...)`; `detachGoalPlan(id, linkId)` → `goalPlanLinkService.detachPlan(...)`. Inject the two new services via the constructor.

- [ ] **Step 2: Cascade links on goal delete** — in `GoalService.deleteGoal`, after `requireOwned`, soft-delete the goal's links before deleting the goal (inject `GoalPlanLinkRepository`; `linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(id, userId).forEach(linkRepository::delete)`). The DB FK is `ON DELETE CASCADE` for the hard path, but soft-delete needs the explicit sweep so a re-created goal doesn't inherit ghost links.

- [ ] **Step 3: Write `GoalTimelineContractIT extends ApiIntegrationTest`** — create a goal + a mesocycle (via the HTTP train endpoints or `TrainPopulator` + a direct repo, matching how other ContractITs seed cross-aggregate data), `POST /api/goals/{id}/plans` (201, assert `endWeek`), `GET /api/goals/{id}/timeline` (200, link present, gaps computed), `DELETE .../plans/{linkId}` (204, gone from timeline), `POST` with unknown planId → 404, unauth → 401.

- [ ] **Step 4: Run** — `cd backend && ./mvnw clean test -Dtest=GoalTimelineContractIT` (RED→GREEN).

- [ ] **Step 5: Commit** — `git commit -m "feat(goal): timeline/attach/detach endpoints + link cascade on delete (mezo-3sc)"`

---

### Task 7: Demodata — link the demo meso + running block to the demo goal

**Files:**
- Modify: `feature/goal/GoalSeedData.java` (after seeding the goal, link the owner's active mesocycle + active running block)

**Interfaces:**
- Consumes: `GoalPlanLinkRepository`, `MesocycleRepository`, `RunningBlockRepository`, the seeded goal.

- [ ] **Step 1: Extend `GoalSeedData.run()`** — after `goalRepository.save(g)`, find the owner's active mesocycle + active running block (via their repos' `findByCreatedByAndStatusAndDeletedFalse(owner, "active")`), and for each create a `GoalPlanLinkEntity` (start_week 1, end_week = start_week + plan.weeks - 1, plan_type accordingly). Guard each with a presence check (the train/running seeds run at `@Order(100/110)`, goal at `120`, so they exist). Keep deterministic. Volleyball is NOT linked.

- [ ] **Step 2: Verify** — `cd backend && ./mvnw clean test -Dtest=GoalTimelineContractIT` (demodata profile; the seed runs, context boots, no failure).

- [ ] **Step 3: Commit** — `git commit -m "feat(goal): demodata links meso+running to the demo goal (mezo-3sc)"`

---

### Task 8: Frontend `goalLinkApi`

**Files:**
- Create: `frontend/src/lib/goalLinkApi.ts`

**Interfaces:**
- Produces: `goalLinkApi.{ timeline(goalId), attach(goalId, body), detach(goalId, linkId) }`; types `GoalTimelineResponse`, `GoalPlanLinkResponse`, `GoalPlanAttachRequest` aliased from `api.gen`.

- [ ] **Step 1: Write the module** (mirror `goalApi.ts`)

```ts
import { apiFetch } from './api'
import type { components } from './api.gen'

export type GoalTimelineResponse = components['schemas']['GoalTimelineResponse']
export type GoalPlanLinkResponse = components['schemas']['GoalPlanLinkResponse']
export type GoalPlanAttachRequest = components['schemas']['GoalPlanAttachRequest']

export const goalLinkApi = {
  timeline: (goalId: string): Promise<GoalTimelineResponse> =>
    apiFetch<GoalTimelineResponse>(`/api/goals/${goalId}/timeline`),
  attach: (goalId: string, body: GoalPlanAttachRequest): Promise<GoalPlanLinkResponse> =>
    apiFetch<GoalPlanLinkResponse>(`/api/goals/${goalId}/plans`, { method: 'POST', body: JSON.stringify(body satisfies GoalPlanAttachRequest) }),
  detach: (goalId: string, linkId: string): Promise<void> =>
    apiFetch<void>(`/api/goals/${goalId}/plans/${linkId}`, { method: 'DELETE' }),
}
```

- [ ] **Step 2: Type-check** — `cd frontend && pnpm build` → PASS.
- [ ] **Step 3: Commit** — `git commit -m "feat(fe): goalLinkApi module (mezo-3sc)"`

---

### Task 9: Frontend — `useGoal` populates real linked plans

**Files:**
- Modify: `frontend/src/data/goalHooks.ts` (real mode: fetch the goal's timeline; build `linkedMesocycles` + `goal.mesocycles` from the links)
- Test: `frontend/src/data/goalHooks.test.tsx` (extend)

**Interfaces:**
- Consumes: `goalLinkApi.timeline`, the existing `useGoal` shape `{ goal, linkedMesocycles }`.
- Produces: in real mode, `goal.mesocycles` = the linked plan ids and `linkedMesocycles` = `Record<id, LinkedMeso>` built from `GoalTimelineResponse.links` (map `plan.title→shortTitle`, `plan.status→status`, `plan.startDate/endDate/weeks`). Mock mode unchanged (static `linkedMesocycles`).

- [ ] **Step 1: Extend `useGoal`** — in real mode, after resolving the active goal, `useQuery(['goal', goalId, 'timeline'], () => goalLinkApi.timeline(goalId))` (enabled when a real goal id exists); build `linkedMesocycles` (a `Record<planId, LinkedMeso>` from `timeline.links` — `{ id: planId, shortTitle: plan.title, status: plan.status, startDate: huMonthDay(plan.startDate), endDate: huMonthDay(plan.endDate), weeks: plan.weeks }`) and set `goal.mesocycles = timeline.links.map(l => l.planId)`. Mock mode keeps the static `mockGoal.mesocycles` + static `linkedMesocycles`. Keep the back-compat `toGoal` shape; only `mesocycles` + `linkedMesocycles` become real.

- [ ] **Step 2: Add a real-mode test** — `useGoal` (real mode) maps a `GET /api/goals` active goal + `GET /api/goals/{id}/timeline` with one mesocycle link into `goal.mesocycles` (one id) and `linkedMesocycles[id].shortTitle`. (MSW handlers for both endpoints.)

- [ ] **Step 3: Run** — `cd frontend && pnpm test -- goalHooks` (RED→GREEN). Then `pnpm build`.
- [ ] **Step 4: Commit** — `git commit -m "feat(fe): useGoal populates real linked plans from the timeline (mezo-3sc)"`

---

### Task 10: Full gates + docs

- [ ] **Step 1: Backend gate** — `cd backend && ./mvnw clean test` → BUILD SUCCESS (all G1 + G3 ITs green).
- [ ] **Step 2: Frontend gates** — `cd frontend && pnpm test` (real) + `VITE_USE_MOCK=true pnpm test` (mock) + `pnpm build` → all PASS.
- [ ] **Step 3: Docs** — update `docs/features/me.md` (the Cél/goal section: linked plans are now real via `goal_plan_link`/`GoalTimelineService`; volleyball ambient) + `docs/features/_platform-api-backend.md` (new `/api/goals/{id}/timeline|plans` endpoints + `feature/goal` link aggregate). `file:line` pointers, no pasted code. Run `node scripts/lint-docs.mjs` → PASS (bump any incidentally-drifted doc's `updated:` only if its content is verified-current).
- [ ] **Step 4: Commit** — `git commit -m "docs(features): goal_plan_link timeline + green gates (mezo-3sc)"`

---

## Self-review notes (controller)

- **Spec coverage (§3.2, D3–D5):** `GoalPlanLink` entity/table ✓ T2-3; attach/detach/list + `end_week` derivation ✓ T4; soft gym-lane gap detection ✓ T5; cascade ✓ T6; volleyball never linked ✓ (only meso/running plan_types); FE read-side ✓ T8-9.
- **Scope boundary held:** no timeline lane UI, no attach/detach hub, no goal-creation (all G4). The attach/detach API exists but its UI is G4; G3 seeds links so the read-side renders.
- **Cross-feature coupling:** `GoalPlanLinkService` reads train repos read-only; the only train change is an additive read finder.
- **Type consistency:** `endWeek = startWeek + plan.weeks - 1` used in both T4 (attach) and the seed (T7) and asserted in T4/T5 ITs. `linkedMesocycles` is `Record<planId, LinkedMeso>` in both the FE build (T9) and the existing `GoalsView` consumer.

## Post-G3

- **G4** — the command-center: timeline LANE view (bars + gap resolver), the attach/detach HUB (plan slots launching the existing planners), goal-creation, retiring the `toGoal` back-compat mapper, and the `rateTarget` display (mezo-5om).
- **G5** — the TDEE/prescription engine.
