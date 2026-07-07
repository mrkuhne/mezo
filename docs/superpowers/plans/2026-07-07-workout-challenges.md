# Workout Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mock-only "workout challenges" surface live — the companion proposes per-exercise PR/Depth/Volume micro-challenges, the user accepts one-tap (L2), and the system evaluates hit/miss/inconclusive deterministically from logged sets.

**Architecture:** A new `feature/proactive` sub-surface (the P2 N=1-experiments sibling): a `challenge` table, a smart-tier `ChallengeGenerator` (history-grounded, structured targets), a NEW set-level `ChallengeOutcomeEvaluator` (LLM-free), an L2 decision write path (`PatternService.decide` idiom), and a daily outcome-backstop cron. Identity = (`created_by`, `template_session_id`, `workout_date`); the target `exercise_id` is the TEMPLATE exercise, and because `startWorkout` never copies exercises (`WorkoutService.java:204` — logged sets FK straight back to the template exercise), evaluation needs no instance mapping. FE hook lives in `data/train` (consumed by `ActiveWorkoutPage`); the existing carousel/card are reused.

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / MapStruct / React 19 / TanStack Query / Vitest+MSW. Design spec: `docs/superpowers/specs/2026-07-07-workout-challenges-design.md`.

**Driving bd:** `mezo-hbwi`.

## Global Constraints

- Base package `io.mrkuhne.mezo`; UUID PKs (`gen_random_uuid()`); `created_by` server-side; soft-delete (`is_deleted` + `@SQLDelete`/`@SQLRestriction`); jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto a typed record.
- Dual-switch `@ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH}, havingValue = "true")` on EVERY new bean; the job adds a THIRD switch `CHALLENGE_JOB_SWITCH`.
- Contract-first: edit `api/feature/proactive/proactive.yml` BEFORE code, then `cd api/generate && npm run generate:api` + `cd frontend && pnpm generate:api`; never hand-write boundary DTOs.
- Marker literal-mirror rule: the fake's `CHALLENGE_MARKER_MIRROR` is a LITERAL copy of `ChallengeGenerator.CHALLENGE_MARKER` (a companion→proactive import would be a package cycle).
- Honest numbers: no fabricated `confidence` (pattern-copied or null → "tanulom"); `refs` model-SELECTED by index (never invented); outcome is code-computed; `outcome_good` NULLABLE = honest "nem értékelhető".
- Liquibase changeset id = `{12-digit UTC ts}_mezo-hbwi_{desc}`; never modify a released changeset; explicit constraint names (`pk_/fk_/uq_/ck_/idx_`).
- Backend gate: `cd backend && ./mvnw clean test` (docker compose up). FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green). `ALWAYS use clean` for mvn.
- Custom ports: Postgres 15432, backend 8090, Vite 5180.

---

### Task 1: Contract — challenge endpoints + schemas

**Files:**
- Modify: `api/feature/proactive/proactive.yml`
- Regenerate: `api/openapi.yml`, `backend` generated DTOs, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: `GET /api/proactive/challenge?templateSessionId&date` → `ChallengeResponse[]` (200·401); `POST /api/proactive/challenge/{id}/decision` (body `ChallengeDecisionRequest{decision: accept|dismiss}`) → `ChallengeResponse` (200·400·401·404·409). Backend `ProactiveApi.getChallenges(UUID templateSessionId, LocalDate date)` + `decideChallenge(UUID id, ChallengeDecisionRequest)`.

- [ ] **Step 1: Add the two paths** after the `/api/proactive/experiment/{id}/decision` block in `proactive.yml`:

```yaml
  /api/proactive/challenge:
    get:
      tags: [Proactive]
      operationId: getChallenges
      summary: Live workout challenges for a planned session on a day (proposed/accepted/hit/miss/inconclusive) (Challenges)
      description: >-
        Returns the session/day's live challenges (dismissed excluded). Lazily generates when none
        exist and date == today; lazily evaluates accepted ones once the instance is done. An empty
        array is the honest empty state (never a 404).
      parameters:
        - name: templateSessionId
          in: query
          required: true
          schema: { type: string, format: uuid }
        - name: date
          in: query
          required: true
          schema: { type: string, format: date }
      responses:
        '200':
          description: The session/day's live challenges (possibly empty)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/ChallengeResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/proactive/challenge/{id}/decision:
    post:
      tags: [Proactive]
      operationId: decideChallenge
      summary: L2 accept/dismiss a proposed workout challenge (Challenges)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ChallengeDecisionRequest' }
      responses:
        '200':
          description: The challenge with its new status
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ChallengeResponse' }
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
          description: Challenge not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: The challenge is not in the proposed state (already decided)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

- [ ] **Step 2: Add the schemas** after `ExperimentResponse` in `proactive.yml`:

```yaml
    ChallengeDecisionRequest:
      type: object
      required: [decision]
      properties:
        decision: { type: string, pattern: '^(accept|dismiss)$' }
    ChallengeRef:
      type: object
      required: [kind, label]
      properties:
        kind: { type: string }
        label: { type: string }
    ChallengeResponse:
      type: object
      required: [id, exerciseId, exercise, type, typeLabel, status, target, risk, why, glory, refs, generatedAt]
      properties:
        id: { type: string, format: uuid }
        exerciseId: { type: string, format: uuid }
        exercise: { type: string, description: The target exercise's name }
        type: { type: string, description: 'PR | Depth | Volume' }
        typeLabel: { type: string, description: HU display label derived from type }
        status: { type: string, description: 'proposed | accepted | dismissed | hit | miss | inconclusive' }
        target: { type: string, description: Code-derived display string of the structured target }
        confidence:
          type: number
          nullable: true
          description: Pattern-copied; null = "tanulom" (never fabricated)
        risk: { type: string, description: 'low | mid' }
        why: { type: string }
        glory: { type: string }
        refs:
          type: array
          items: { $ref: '#/components/schemas/ChallengeRef' }
        outcome:
          type: string
          nullable: true
          description: Code-formatted outcome once the workout is evaluated
        outcomeGood:
          type: boolean
          nullable: true
          description: true/false once evaluated; null = inconclusive (no logged sets)
        generatedAt: { type: string, format: date-time }
```

- [ ] **Step 3: Regenerate.** Run:

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` gains the two paths; `frontend/src/data/_client/api.gen.ts` gains the `paths['/api/proactive/challenge']` entries. No errors.

- [ ] **Step 4: Verify** the backend generated interface exists. Run:

```bash
cd backend && ./mvnw -q generate-sources && grep -rl "getChallenges\|decideChallenge" target/generated-sources | head
```
Expected: a generated `ProactiveApi.java` referencing both operations.

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): proactive challenge contract — list + decide (mezo-hbwi)"
```

---

### Task 2: challenge table + entity + refs envelope + repo + populator + persistence IT

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607072100_mezo-hbwi_create_challenge.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/ChallengeRefsEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/ChallengeEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/ChallengeRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/ChallengePopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (@Import), `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (prepend `challenge`)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ChallengePersistenceIT.java`

**Interfaces:**
- Produces: `ChallengeEntity{UUID id; UUID templateSessionId; LocalDate workoutDate; UUID exerciseId; String exerciseName; String type; String status; String risk; String title; String why; String glory; BigDecimal targetWeightKg; Integer targetReps; Integer targetSets; Integer targetRir; BigDecimal confidence; ChallengeRefsEnvelope refs; String outcome; Boolean outcomeGood; Instant generatedAt}` + constants `TYPE_PR/DEPTH/VOLUME`, `STATUS_PROPOSED/ACCEPTED/DISMISSED/HIT/MISS/INCONCLUSIVE`, `RISK_LOW/MID`. `ChallengeRefsEnvelope(List<Ref> refs)` with nested `record Ref(String kind, String label)`. `ChallengeRepository` finders (below). `ChallengePopulator.challenge(UUID createdBy, UUID templateSessionId, LocalDate workoutDate, UUID exerciseId, String type, String status)`.

- [ ] **Step 1: Write the migration** `202607072100_mezo-hbwi_create_challenge.sql`:

```sql
-- Workout challenges (bd mezo-hbwi): companion proposes per-exercise PR/Depth/Volume micro-challenges;
-- L2 accept; deterministic hit/miss/inconclusive from logged sets. Identity = (created_by,
-- template_session_id, workout_date); exercise_id = the TEMPLATE exercise (logged sets FK to it).
-- outcome_good NULLABLE (null = inconclusive, no logged sets); confidence NULLABLE ("tanulom").

create table challenge (
    id                  uuid          not null default gen_random_uuid(),
    created_by          uuid          not null,
    is_deleted          boolean       not null default false,
    created_at          timestamptz   not null default now(),
    template_session_id uuid          not null,
    workout_date        date          not null,
    exercise_id         uuid          not null,
    exercise_name       varchar(120)  not null,
    type                varchar(10)   not null,
    status              varchar(12)   not null default 'proposed',
    risk                varchar(4)    not null default 'low',
    title               varchar(120)  not null,
    why                 text          not null,
    glory               varchar(200)  not null,
    target_weight_kg    numeric(6,2),
    target_reps         integer,
    target_sets         integer,
    target_rir          integer,
    confidence          numeric(4,3),
    refs                jsonb         not null default '[]',
    outcome             text,
    outcome_good        boolean,
    generated_at        timestamptz   not null,
    constraint pk_challenge_id primary key (id),
    constraint fk_challenge_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_challenge_template_session foreign key (template_session_id) references workout_session (id) on delete cascade,
    constraint fk_challenge_exercise foreign key (exercise_id) references exercise (id) on delete cascade,
    constraint ck_challenge_type check (type in ('PR', 'Depth', 'Volume')),
    constraint ck_challenge_status check (status in ('proposed', 'accepted', 'dismissed', 'hit', 'miss', 'inconclusive')),
    constraint ck_challenge_risk check (risk in ('low', 'mid'))
);

create index idx_challenge_session_date on challenge (created_by, template_session_id, workout_date) where is_deleted = false;
```

- [ ] **Step 2: Register the changeset** in `1.0.0_master.yml`, appended AFTER the experiment changeSet:

```yaml
  - include:
      file: db/changelog/1.0.0/script/202607072100_mezo-hbwi_create_challenge.sql
```
(match the existing `- include:` entry shape in that file; id string `1.0.0:202607072100_mezo-hbwi_create_challenge`.)

- [ ] **Step 3: Write `ChallengeRefsEnvelope`** (mirror `entity/MemoirAnchorsEnvelope.java`):

```java
package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/** Typed jsonb envelope for a challenge's code-collected, model-selected refs. */
public record ChallengeRefsEnvelope(List<Ref> refs) {
    public record Ref(String kind, String label) {
    }
}
```

- [ ] **Step 4: Write `ChallengeEntity`** (mirror `entity/ExperimentEntity.java` + the memoir jsonb field):

```java
package io.mrkuhne.mezo.feature.proactive.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Entity
@Table(name = "challenge")
@SQLDelete(sql = "update challenge set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ChallengeEntity extends OwnedEntity {

    public static final String TYPE_PR = "PR";
    public static final String TYPE_DEPTH = "Depth";
    public static final String TYPE_VOLUME = "Volume";
    public static final String STATUS_PROPOSED = "proposed";
    public static final String STATUS_ACCEPTED = "accepted";
    public static final String STATUS_DISMISSED = "dismissed";
    public static final String STATUS_HIT = "hit";
    public static final String STATUS_MISS = "miss";
    public static final String STATUS_INCONCLUSIVE = "inconclusive";
    public static final String RISK_LOW = "low";
    public static final String RISK_MID = "mid";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "template_session_id", nullable = false)
    private UUID templateSessionId;

    @NotNull
    @Column(name = "workout_date", nullable = false)
    private LocalDate workoutDate;

    @NotNull
    @Column(name = "exercise_id", nullable = false)
    private UUID exerciseId;

    @NotNull
    @Column(name = "exercise_name", nullable = false)
    private String exerciseName;

    @NotNull
    @Column(nullable = false)
    private String type;

    @NotNull
    @Column(nullable = false)
    private String status = STATUS_PROPOSED;

    @NotNull
    @Column(nullable = false)
    private String risk = RISK_LOW;

    @NotNull
    @Column(nullable = false)
    private String title;

    @NotNull
    @Column(nullable = false)
    private String why;

    @NotNull
    @Column(nullable = false)
    private String glory;

    @Column(name = "target_weight_kg", precision = 6, scale = 2)
    private BigDecimal targetWeightKg;

    @Column(name = "target_reps")
    private Integer targetReps;

    @Column(name = "target_sets")
    private Integer targetSets;

    @Column(name = "target_rir")
    private Integer targetRir;

    @Column(precision = 4, scale = 3)
    private BigDecimal confidence;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private ChallengeRefsEnvelope refs = new ChallengeRefsEnvelope(java.util.List.of());

    @Column
    private String outcome;

    @Column(name = "outcome_good")
    private Boolean outcomeGood;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
```

- [ ] **Step 5: Write `ChallengeRepository`:**

```java
package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChallengeRepository extends JpaRepository<ChallengeEntity, UUID> {

    List<ChallengeEntity> findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(
        UUID createdBy, UUID templateSessionId, LocalDate workoutDate);

    Optional<ChallengeEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    List<ChallengeEntity> findByCreatedByAndStatus(UUID createdBy, String status);
}
```
(the `@SQLRestriction` keeps all finders live-only, so no `AndDeletedFalse` suffix is needed — the `ExperimentRepository` uses the explicit form; here the restriction covers it. Match whichever the ExperimentRepository does — if it uses `AndDeletedFalse`, add it for consistency.)

- [ ] **Step 6: Write `ChallengePopulator`** (mirror `support/populator/ExperimentPopulator.java`): a factory that inserts a `ChallengeEntity` with sensible defaults (type param, status param, title/why/glory placeholder strings, `exerciseName` "Chest Supported Row", `generatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS)`, empty refs, null targets/confidence/outcome). Signature `challenge(UUID createdBy, UUID templateSessionId, LocalDate workoutDate, UUID exerciseId, String type, String status)`. Overload `challengePr(...)` setting `targetWeightKg`/`targetReps` for the outcome IT if convenient. Register it in `AbstractIntegrationTest`'s `@Import(...)` list and prepend `"challenge"` to the `ResetDatabase` TRUNCATE list.

- [ ] **Step 7: Write the failing persistence IT** `ChallengePersistenceIT` (mirror `ExperimentPersistenceIT`):

```java
// @SpringBootTest persistence IT (extends AbstractIntegrationTest). 3 tests:
// 1. round-trips a proposed row: null targets/confidence/outcome, empty refs, status proposed.
// 2. the status CHECK rejects a bad status (assertThatThrownBy on saveAndFlush of status="nope").
// 3. findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc is owner-scoped
//    (a second user's row for the same session/date is NOT returned).
```
Provide the concrete test bodies using the populator + `challengeRepository`, AssertJ asserts, an `AppUser` from the owner fixture (`ownerId()` / the AbstractIntegrationTest owner accessor) and a template `workout_session` + `exercise` planted via the existing Train populators (reuse `WorkoutSessionPopulator`/`ExercisePopulator` — check their names) so the FKs resolve.

- [ ] **Step 8: Run it — expect RED** (table/entity absent): `cd backend && ./mvnw clean test -Dtest=ChallengePersistenceIT`
- [ ] **Step 9: Run it — expect GREEN** after steps 1-6 compile.
- [ ] **Step 10: Commit**

```bash
git add backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ChallengePersistenceIT.java
git commit -m "feat(challenges): challenge table + entity + refs envelope + repo + persistence IT (mezo-hbwi)"
```

---

### Task 3: new train-repo finders (gather + eval inputs)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseSetRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutSessionRepositoryChallengeIT.java` (or fold into an existing train repo IT)

**Interfaces:**
- Produces: `WorkoutSessionRepository.findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc(UUID, UUID, LocalDate): Optional<WorkoutSessionEntity>` (the instance for a session on a day) and `ExerciseSetRepository.findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(UUID, UUID, UUID): List<ExerciseSetEntity>` (the logged sets of one exercise in one instance).

- [ ] **Step 1: Add the WorkoutSession finder** to `WorkoutSessionRepository`:

```java
Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc(
    UUID createdBy, UUID templateSessionId, LocalDate date);
```

- [ ] **Step 2: Add the ExerciseSet finder** to `ExerciseSetRepository`:

```java
List<ExerciseSetEntity> findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(
    UUID createdBy, UUID workoutSessionId, UUID exerciseId);
```

- [ ] **Step 3: Write a failing IT** `WorkoutSessionRepositoryChallengeIT` — plant a template session + an instance (templateSessionId set, date=today) + two sets on the template exercise (one in the instance, one in another instance/date); assert the instance finder returns the today instance and the set finder returns only the instance's set for that exercise (owner-scoped). Use the Train populators.
- [ ] **Step 4: Run — expect RED** then **GREEN** (derived finders resolve at context load; RED is the missing test class / assertion): `./mvnw clean test -Dtest=WorkoutSessionRepositoryChallengeIT`
- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/repository backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutSessionRepositoryChallengeIT.java
git commit -m "feat(train): finders for challenge gather + set-level eval (mezo-hbwi)"
```

---

### Task 4: ChallengeGenerator + fake sentinel + config

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ChallengeGeneratorIT.java`

**Interfaces:**
- Consumes: `ChallengeRepository`, `ExerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc`, `ExerciseSetRepository.findByCreatedByAndExerciseIdOrderBySetIndexAsc`, `PatternRepository.findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc`, `ContextSnapshotAssembler.render(UUID, LocalDate)`, `KnowledgeFactService.renderPromptBlock(UUID)`, `CompanionLlm.completeSmart`.
- Produces: `ChallengeGenerator.generate(UUID userId, UUID templateSessionId, LocalDate date): List<ChallengeEntity>` (idempotent; [] on past/future date, no exercise history, or unusable answer); `public static final String CHALLENGE_MARKER = "EDZES-KIHIVAS-FELADAT"`; properties `mezo.proactive.challenge.{outcome-cron, max-per-workout}`.

- [ ] **Step 1: Add the `Challenge` config record** to `ProactiveProperties` (add `@NotNull @Valid Challenge challenge` to the record header + the nested record):

```java
    /** Workout challenges — daily outcome-eval backstop + per-workout proposal cap. */
    public record Challenge(
        /** Daily outcome-evaluation schedule (server zone) — resolves accepted challenges whose day passed. */
        @NotBlank String outcomeCron,
        /** Cap on challenges proposed per workout session/day. */
        @Min(1) @Max(6) int maxPerWorkout
    ) {}
```

- [ ] **Step 2: Add config values** to `application.yml` under `mezo.proactive:`:

```yaml
    challenge:
      # Daily outcome backstop (after the experiment outcome run)
      outcome-cron: "0 25 6 * * *"
      max-per-workout: 3
```
and under `mezo.techcore.cron:` add:

```yaml
      challenge-job:
        enabled: true
```

- [ ] **Step 3: Add the switch constant** to `FeaturesConfiguration`:

```java
public static final String CHALLENGE_JOB_SWITCH = "mezo.techcore.cron.challenge-job.enabled";
```

- [ ] **Step 4: Add the fake sentinel** to `FakeCompanionLlm` — after the experiment block (mirror the `EXPERIMENT_MARKER_MIRROR` idiom, GREEDY):

```java
/** Mirror of ChallengeGenerator.CHALLENGE_MARKER (feature/proactive) — LITERAL, cycle rule. */
public static final String CHALLENGE_MARKER_MIRROR = "EDZES-KIHIVAS-FELADAT";

/** Scripted challenges JSON: {@code [fake-challenge:{…}]} planted via a check-in note.
 *  GREEDY like predictions/experiments — the payload {@code {"challenges":[{…}]}} nests objects. */
public static final Pattern CHALLENGE_SENTINEL =
        Pattern.compile("\\[fake-challenge:(\\{.*\\})]", Pattern.DOTALL);
```
and in `complete(...)`, add a branch alongside the experiment one:

```java
if (systemPrompt.startsWith(CHALLENGE_MARKER_MIRROR)) {
    Matcher m = CHALLENGE_SENTINEL.matcher(userMessage);
    return m.find() ? m.group(1)
        : "{\"challenges\":[{\"exerciseIndex\":0,\"type\":\"PR\",\"targetWeightKg\":107.5,"
        + "\"targetReps\":8,\"risk\":\"low\",\"why\":\"FAKE-INDOK\",\"glory\":\"FAKE-DICS\","
        + "\"refIndexes\":[0],\"patternIndex\":0}]}";
}
```
(The fake's `completeSmart` default delegates to `complete`, so the marker dispatch covers the smart path — the W1 precedent.)

- [ ] **Step 5: Write the failing generator IT** `ChallengeGeneratorIT` (`@Transactional @ActiveProfiles("companion-fake")`, mirror `ExperimentProposalGeneratorIT`). 5 tests:
  1. `generate` for `date != today` returns `[]` (no LLM call).
  2. gather drops an exercise with NO logged-set history (grounding gate) — a session whose single exercise has no sets ⇒ `[]`.
  3. `generate` persists a scripted PR challenge (plant a template session + exercise with past sets + a `[fake-challenge:{…}]` check-in note) — asserts one proposed row with `targetWeightKg`/`targetReps`, derived `exerciseName`, resolved refs, `status=proposed`.
  4. a proposal missing its type's required target fields is dropped (script a `Depth` proposal with no `targetRir`).
  5. cap at `max-per-workout` (script 5 proposals, assert ≤ 3 persisted).

- [ ] **Step 6: Run — expect RED:** `./mvnw clean test -Dtest=ChallengeGeneratorIT`

- [ ] **Step 7: Write `ChallengeGenerator`** — mirror `service/PredictionGenerator.java`'s gather/parse/prompt structure, adapted to per-exercise challenges:

```java
package io.mrkuhne.mezo.feature.proactive.service;
// imports: CompanionLlm, PatternEntity, PatternRepository, ContextSnapshotAssembler,
// KnowledgeFactService, ProactiveProperties, ChallengeEntity, ChallengeRefsEnvelope,
// ChallengeRepository, ExerciseEntity, ExerciseRepository, ExerciseSetEntity, ExerciseSetRepository,
// FeaturesConfiguration; java.math.BigDecimal, java.time.*, java.util.*; lombok; spring; ObjectMapper.

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH}, havingValue = "true")
public class ChallengeGenerator {

    public static final String CHALLENGE_MARKER = "EDZES-KIHIVAS-FELADAT";

    private static final Set<String> VALID_TYPES = Set.of(
        ChallengeEntity.TYPE_PR, ChallengeEntity.TYPE_DEPTH, ChallengeEntity.TYPE_VOLUME);

    private static final String PROMPT = CHALLENGE_MARKER + "\n"
        + "Javasolj 1-3 magyar MIKRO-KIHÍVÁST Daniel mai edzésére, KIZÁRÓLAG a megadott GYAKORLATOK "
        + "és kontextus alapján. Minden kihívás EGY gyakorlathoz kötődik (exerciseIndex) és EGY "
        + "típushoz: PR (targetWeightKg + targetReps kell), Depth (targetRir kell), Volume "
        + "(targetSets kell). Adatot kitalálni tilos; gyógyszer-adagolást SOHA ne javasolj. "
        + "Válaszolj KIZÁRÓLAG szigorú JSON-nal: {\"challenges\":[{\"exerciseIndex\":szám,"
        + "\"type\":\"PR|Depth|Volume\",\"targetWeightKg\":szám|null,\"targetReps\":szám|null,"
        + "\"targetSets\":szám|null,\"targetRir\":szám|null,\"risk\":\"low|mid\",\"why\":\"indok\","
        + "\"glory\":\"jutalom\",\"refIndexes\":[a HIVATKOZÁS-JELÖLTEK sorszámai],"
        + "\"patternIndex\":a MINTA-JELÖLT sorszáma vagy null}]}";

    private final ChallengeRepository challengeRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final PatternRepository patternRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final ProactiveProperties properties;

    record ExerciseCandidate(ExerciseEntity exercise, int maxWeightPr, int loggedSetCount) {}
    record Gather(String payload, List<ExerciseCandidate> exercises,
                  List<PatternEntity> patterns, List<ChallengeRefsEnvelope.Ref> refCandidates) {}
    record ParsedChallenge(Integer exerciseIndex, String type, java.math.BigDecimal targetWeightKg,
                           Integer targetReps, Integer targetSets, Integer targetRir, String risk,
                           String why, String glory, List<Integer> refIndexes, Integer patternIndex) {}
    record ParsedChallenges(List<ParsedChallenge> challenges) {}

    @Transactional
    public List<ChallengeEntity> generate(UUID userId, UUID templateSessionId, LocalDate date) {
        if (!date.equals(LocalDate.now())) { return List.of(); }              // past/future never generate
        List<ChallengeEntity> existing = challengeRepository
            .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(userId, templateSessionId, date);
        if (!existing.isEmpty()) { return existing; }                          // idempotent, NO LLM call
        Gather gather = gather(userId, templateSessionId);
        if (gather == null) { return List.of(); }                             // no exercise history (grounding gate)
        String answer = companionLlm.completeSmart(PROMPT, gather.payload());
        ParsedChallenges parsed = parse(answer);
        if (parsed == null || parsed.challenges() == null) { return List.of(); }
        List<ChallengeEntity> saved = new ArrayList<>();
        for (ParsedChallenge p : parsed.challenges()) {
            if (saved.size() >= properties.challenge().maxPerWorkout()) { break; }
            ChallengeEntity e = build(userId, templateSessionId, date, p, gather);
            if (e != null) { saved.add(challengeRepository.saveAndFlush(e)); }
        }
        return saved;
    }

    /** null when no template exercise has logged-set history (the grounding gate). */
    Gather gather(UUID userId, UUID templateSessionId) {
        List<ExerciseEntity> exercises = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(userId, List.of(templateSessionId));
        List<ExerciseCandidate> candidates = new ArrayList<>();
        for (ExerciseEntity ex : exercises) {
            List<ExerciseSetEntity> sets = exerciseSetRepository
                .findByCreatedByAndExerciseIdOrderBySetIndexAsc(userId, ex.getId());
            List<ExerciseSetEntity> logged = sets.stream().filter(s -> !s.isSkipped() && s.getReps() != null).toList();
            if (logged.isEmpty()) { continue; }                               // no history — drop (decision h)
            int maxPr = logged.stream().map(ExerciseSetEntity::getWeightKg)
                .filter(w -> w != null).map(w -> w.intValue()).reduce(0, Integer::max);
            candidates.add(new ExerciseCandidate(ex, maxPr, logged.size()));
        }
        if (candidates.isEmpty()) { return null; }
        List<PatternEntity> patterns = patternRepository
            .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(userId, PatternEntity.STATUS_CONFIRMED);
        List<ChallengeRefsEnvelope.Ref> refCandidates = new ArrayList<>();
        StringBuilder payload = new StringBuilder(contextSnapshotAssembler.render(userId, LocalDate.now()));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append("\n\nGYAKORLATOK (az exerciseIndex ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            ExerciseCandidate c = candidates.get(i);
            payload.append(i).append(": ").append(c.exercise().getName())
                .append(" (PR≈").append(c.maxWeightPr()).append(" kg, logolt szettek=").append(c.loggedSetCount()).append(")\n");
            refCandidates.add(new ChallengeRefsEnvelope.Ref("PR", c.exercise().getName() + " PR ≈ " + c.maxWeightPr() + " kg"));
        }
        payload.append("\nHIVATKOZÁS-JELÖLTEK (a refIndexes ezekre mutat):\n");
        for (int i = 0; i < refCandidates.size(); i++) {
            payload.append(i).append(": [").append(refCandidates.get(i).kind()).append("] ")
                .append(refCandidates.get(i).label()).append("\n");
        }
        payload.append("\nMINTA-JELÖLTEK (a patternIndex ezekre mutat):\n");
        for (int i = 0; i < patterns.size(); i++) {
            payload.append(i).append(": ").append(patterns.get(i).getTitle())
                .append(" (konfidencia=").append(patterns.get(i).getConfidence()).append(")\n");
        }
        payload.append("\nKIHÍVÁS-TÍPUSOK: PR | Depth | Volume");
        return new Gather(payload.toString(), candidates, patterns, refCandidates);
    }

    private ChallengeEntity build(UUID userId, UUID templateSessionId, LocalDate date,
                                  ParsedChallenge p, Gather gather) {
        if (p == null || p.exerciseIndex() == null
            || p.exerciseIndex() < 0 || p.exerciseIndex() >= gather.exercises().size()) { return null; }
        if (!VALID_TYPES.contains(p.type())) { return null; }
        if (isBlank(p.why()) || isBlank(p.glory())) { return null; }
        // required target fields per type — else unevaluatable (drop)
        boolean ok = switch (p.type()) {
            case ChallengeEntity.TYPE_PR -> p.targetWeightKg() != null && p.targetReps() != null;
            case ChallengeEntity.TYPE_DEPTH -> p.targetRir() != null;
            case ChallengeEntity.TYPE_VOLUME -> p.targetSets() != null;
            default -> false;
        };
        if (!ok) { return null; }
        ExerciseEntity ex = gather.exercises().get(p.exerciseIndex()).exercise();
        ChallengeEntity e = new ChallengeEntity();
        e.setCreatedBy(userId);
        e.setTemplateSessionId(templateSessionId);
        e.setWorkoutDate(date);
        e.setExerciseId(ex.getId());
        e.setExerciseName(ex.getName());
        e.setType(p.type());
        e.setStatus(ChallengeEntity.STATUS_PROPOSED);
        e.setRisk(ChallengeEntity.RISK_MID.equals(p.risk()) ? ChallengeEntity.RISK_MID : ChallengeEntity.RISK_LOW);
        e.setTargetWeightKg(p.targetWeightKg());
        e.setTargetReps(p.targetReps());
        e.setTargetSets(p.targetSets());
        e.setTargetRir(p.targetRir());
        e.setTitle(deriveTitle(p, ex));                 // e.g. "Chest Supported Row" — short label
        e.setWhy(p.why().strip());
        e.setGlory(p.glory().strip());
        e.setConfidence(resolveConfidence(p.patternIndex(), gather.patterns()));
        e.setRefs(resolveRefs(p.refIndexes(), gather.refCandidates()));
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return e;
    }

    private String deriveTitle(ParsedChallenge p, ExerciseEntity ex) { return ex.getName(); }

    private BigDecimal resolveConfidence(Integer index, List<PatternEntity> patterns) {
        if (index == null || index < 0 || index >= patterns.size()) { return null; }
        return patterns.get(index).getConfidence();
    }

    private ChallengeRefsEnvelope resolveRefs(List<Integer> indexes, List<ChallengeRefsEnvelope.Ref> candidates) {
        List<ChallengeRefsEnvelope.Ref> out = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        if (indexes != null) {
            for (Integer i : indexes) {
                if (i != null && i >= 0 && i < candidates.size() && seen.add(i)) { out.add(candidates.get(i)); }
            }
        }
        return new ChallengeRefsEnvelope(out);
    }

    private ParsedChallenges parse(String answer) {
        if (answer == null) { return null; }
        int s = answer.indexOf('{'), e = answer.lastIndexOf('}');
        if (s < 0 || e <= s) { return null; }
        try { return objectMapper.readValue(answer.substring(s, e + 1), ParsedChallenges.class); }
        catch (Exception ex) { log.warn("Challenge answer failed to parse: {}", ex.getMessage()); return null; }
    }

    private boolean isBlank(String x) { return x == null || x.isBlank(); }
}
```

- [ ] **Step 8: Run — expect GREEN:** `./mvnw clean test -Dtest=ChallengeGeneratorIT`
- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeGenerator.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java backend/src/main/resources/application.yml backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ChallengeGeneratorIT.java
git commit -m "feat(challenges): ChallengeGenerator (smart tier, structured targets) + fake sentinel + config (mezo-hbwi)"
```

---

### Task 5: ChallengeOutcomeEvaluator + outcome IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeOutcomeEvaluator.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ChallengeOutcomeIT.java`

**Interfaces:**
- Consumes: `ChallengeRepository`, `WorkoutSessionRepository.findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc`, `ExerciseSetRepository.findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc`.
- Produces: `ChallengeOutcomeEvaluator.evaluate(ChallengeEntity): boolean` (true if it transitioned out of `accepted`) and `.evaluateDue(UUID userId, LocalDate today): int` (cron backstop over all accepted rows).

- [ ] **Step 1: Write the failing IT** `ChallengeOutcomeIT` (fixed past dates, extends `AbstractIntegrationTest`). 6 tests:
  1. PR accepted, instance has a set `weightKg≥target ∧ reps≥target` → `hit`, `outcomeGood=true`, outcome contains "Sikerült".
  2. PR accepted, best set below target → `miss`, `outcomeGood=false`.
  3. Depth accepted, last logged set `rir ≤ target_rir` → `hit`.
  4. Volume accepted, logged set count `≥ target_sets` → `hit`; below → `miss`.
  5. accepted, workout_date in the past, NO instance (user didn't train) → `inconclusive`, `outcomeGood=null`, outcome contains "Nem értékelhető".
  6. accepted, workout_date == today, instance not yet logged (no sets) → UNTOUCHED (stays `accepted`).

- [ ] **Step 2: Run — expect RED:** `./mvnw clean test -Dtest=ChallengeOutcomeIT`

- [ ] **Step 3: Write `ChallengeOutcomeEvaluator`:**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic, LLM-free set-level outcome evaluation for accepted workout challenges. hit/miss from
 * the logged sets of the target exercise in the day's instance; inconclusive (outcome_good=null) when
 * the day passed with no logged sets — never a fabricated miss. A today challenge with no logged sets
 * yet is left untouched (still accepted).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH}, havingValue = "true")
public class ChallengeOutcomeEvaluator {

    private final ChallengeRepository challengeRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;

    /** Backstop over all accepted challenges of the user. Returns the count resolved. */
    @Transactional
    public int evaluateDue(UUID userId, LocalDate today) {
        int resolved = 0;
        for (ChallengeEntity c : challengeRepository.findByCreatedByAndStatus(userId, ChallengeEntity.STATUS_ACCEPTED)) {
            if (evaluate(c, today)) { resolved++; }
        }
        return resolved;
    }

    /** Evaluate one accepted challenge; returns true if it left the accepted state. */
    @Transactional
    public boolean evaluate(ChallengeEntity c, LocalDate today) {
        if (!ChallengeEntity.STATUS_ACCEPTED.equals(c.getStatus())) { return false; }
        Optional<WorkoutSessionEntity> instance = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc(
                c.getCreatedBy(), c.getTemplateSessionId(), c.getWorkoutDate());
        List<ExerciseSetEntity> logged = instance
            .map(w -> exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(c.getCreatedBy(), w.getId(), c.getExerciseId())
                .stream().filter(s -> !s.isSkipped() && s.getReps() != null).toList())
            .orElse(List.of());
        boolean dayPassed = c.getWorkoutDate().isBefore(today);
        if (logged.isEmpty()) {
            if (!dayPassed) { return false; }                        // today, not logged yet — leave accepted
            c.setStatus(ChallengeEntity.STATUS_INCONCLUSIVE);
            c.setOutcome("Nem értékelhető — nem lett logolva.");
            c.setOutcomeGood(null);
            challengeRepository.saveAndFlush(c);
            return true;
        }
        boolean hit = switch (c.getType()) {
            case ChallengeEntity.TYPE_PR -> logged.stream().anyMatch(s ->
                s.getWeightKg() != null && c.getTargetWeightKg() != null
                    && s.getWeightKg().compareTo(c.getTargetWeightKg()) >= 0
                    && s.getReps() != null && c.getTargetReps() != null && s.getReps() >= c.getTargetReps());
            case ChallengeEntity.TYPE_DEPTH -> {
                ExerciseSetEntity last = logged.get(logged.size() - 1);
                yield last.getRir() != null && c.getTargetRir() != null && last.getRir() <= c.getTargetRir();
            }
            case ChallengeEntity.TYPE_VOLUME -> c.getTargetSets() != null && logged.size() >= c.getTargetSets();
            default -> false;
        };
        c.setStatus(hit ? ChallengeEntity.STATUS_HIT : ChallengeEntity.STATUS_MISS);
        c.setOutcomeGood(hit);
        c.setOutcome((hit ? "Sikerült · " : "Nem sikerült most · ") + describe(c, logged));
        challengeRepository.saveAndFlush(c);
        return true;
    }

    private String describe(ChallengeEntity c, List<ExerciseSetEntity> logged) {
        return switch (c.getType()) {
            case ChallengeEntity.TYPE_PR -> {
                BigDecimal best = logged.stream().map(ExerciseSetEntity::getWeightKg)
                    .filter(w -> w != null).reduce(BigDecimal.ZERO, (a, b) -> a.compareTo(b) >= 0 ? a : b);
                yield "legjobb szett " + best.stripTrailingZeros().toPlainString() + " kg";
            }
            case ChallengeEntity.TYPE_DEPTH -> "utolsó szet RIR " + logged.get(logged.size() - 1).getRir();
            case ChallengeEntity.TYPE_VOLUME -> logged.size() + " logolt szett";
            default -> "";
        };
    }
}
```

- [ ] **Step 4: Run — expect GREEN:** `./mvnw clean test -Dtest=ChallengeOutcomeIT`
- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeOutcomeEvaluator.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ChallengeOutcomeIT.java
git commit -m "feat(challenges): ChallengeOutcomeEvaluator — deterministic set-level hit/miss/inconclusive (mezo-hbwi)"
```

---

### Task 6: Write path — service + controller + mapper + job + API ITs

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveChallengeService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java`
- Modify: `backend/src/main/resources/messages.properties`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiChallengeIT.java`, `.../ChallengeJobIT.java`, `.../ChallengeJobSwitchOffIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiSwitchOffIT.java` (+2 cases)

**Interfaces:**
- Consumes: `ChallengeGenerator.generate`, `ChallengeOutcomeEvaluator.evaluate`, `ChallengeRepository`, `ProactiveMapper.toChallengeResponse`.
- Produces: `ProactiveChallengeService.getChallenges(UUID userId, UUID templateSessionId, LocalDate date): List<ChallengeResponse>` (lazy generate + lazy evaluate accepted, dismissed excluded), `.decide(UUID userId, UUID id, ChallengeDecisionRequest): ChallengeResponse`; `ChallengeJob.runOutcome()`; codes `PROACTIVE_CHALLENGE_NOT_FOUND`, `PROACTIVE_CHALLENGE_NOT_PROPOSED`.

- [ ] **Step 1: Add the message codes** to `messages.properties`:

```properties
PROACTIVE_CHALLENGE_NOT_FOUND=Challenge not found.
PROACTIVE_CHALLENGE_NOT_PROPOSED=The challenge is not awaiting a decision.
```

- [ ] **Step 2: Add the mapper method** to `ProactiveMapper` (MapStruct). `ChallengeResponse toChallengeResponse(ChallengeEntity e)`. Map `exercise` ← `exerciseName`, `refs` ← `refs.refs()` (a nested `List<Ref>` → `List<ChallengeRef>` mapping; add a `ChallengeRef toChallengeRef(ChallengeRefsEnvelope.Ref r)` helper). Derive `typeLabel` and `target` via `@Named` / `expression` or `default` methods on the mapper:

```java
default String typeLabel(String type) {
    return switch (type) {
        case "PR" -> "PR-attempt";
        case "Depth" -> "Mélység";
        case "Volume" -> "Volumen";
        default -> type;
    };
}
default String targetDisplay(ChallengeEntity e) {
    return switch (e.getType()) {
        case "PR" -> e.getTargetWeightKg().stripTrailingZeros().toPlainString() + " kg × " + e.getTargetReps();
        case "Depth" -> "Utolsó szet RIR " + e.getTargetRir() + "-ig";
        case "Volume" -> e.getTargetSets() + " szett";
        default -> "";
    };
}
```
Wire `typeLabel` and `target` with `@Mapping(target = "typeLabel", expression = "java(typeLabel(e.getType()))")` and `@Mapping(target = "target", expression = "java(targetDisplay(e))")`; `confidence` maps `BigDecimal`→wire number, `Instant`→OffsetDateTime via the existing default. (Follow the exact idiom already used for `toExperimentResponse` in this mapper.)

- [ ] **Step 3: Write `ProactiveChallengeService`:**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.ChallengeDecisionRequest;
import io.mrkuhne.mezo.api.dto.ChallengeResponse;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.error.SystemMessage;
import io.mrkuhne.mezo.techcore.error.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH}, havingValue = "true")
public class ProactiveChallengeService {

    private static final List<String> DISMISSED = List.of(ChallengeEntity.STATUS_DISMISSED);

    private final ChallengeRepository challengeRepository;
    private final ChallengeGenerator generator;
    private final ChallengeOutcomeEvaluator outcomeEvaluator;
    private final ProactiveMapper mapper;

    @Transactional
    public List<ChallengeResponse> getChallenges(UUID userId, UUID templateSessionId, LocalDate date) {
        List<ChallengeEntity> rows = challengeRepository
            .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(userId, templateSessionId, date);
        if (rows.isEmpty() && date.equals(LocalDate.now())) {
            rows = generator.generate(userId, templateSessionId, date);        // lazy first proposal
        }
        LocalDate today = LocalDate.now();
        for (ChallengeEntity c : rows) {
            if (ChallengeEntity.STATUS_ACCEPTED.equals(c.getStatus())) {
                outcomeEvaluator.evaluate(c, today);                           // lazy resolve when instance is done
            }
        }
        return rows.stream()
            .filter(c -> !DISMISSED.contains(c.getStatus()))
            .map(mapper::toChallengeResponse).toList();
    }

    @Transactional
    public ChallengeResponse decide(UUID userId, UUID id, ChallengeDecisionRequest request) {
        ChallengeEntity c = challengeRepository.findByIdAndCreatedBy(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("PROACTIVE_CHALLENGE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (!ChallengeEntity.STATUS_PROPOSED.equals(c.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PROACTIVE_CHALLENGE_NOT_PROPOSED").build(), HttpStatus.CONFLICT);
        }
        switch (request.getDecision()) {
            case "accept" -> c.setStatus(ChallengeEntity.STATUS_ACCEPTED);
            case "dismiss" -> c.setStatus(ChallengeEntity.STATUS_DISMISSED);
            default -> throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "decision").build());
        }
        return mapper.toChallengeResponse(challengeRepository.saveAndFlush(c));
    }
}
```
(Verify `SystemMessage.field("VALIDATION_INVALID_VALUE", ...)` matches what `ProactiveExperimentService` uses for the same guard; copy its exact call.)

- [ ] **Step 4: Wire the controller** — add to `ProactiveController` (inject `ProactiveChallengeService challengeService`):

```java
@Override
public List<ChallengeResponse> getChallenges(UUID templateSessionId, LocalDate date) {
    return challengeService.getChallenges(currentUserId.get(), templateSessionId, date);
}

@Override
public ChallengeResponse decideChallenge(UUID id, ChallengeDecisionRequest request) {
    return challengeService.decide(currentUserId.get(), id, request);
}
```
(add the `ChallengeResponse` / `ChallengeDecisionRequest` imports.)

- [ ] **Step 5: Write `ChallengeJob`** (mirror the outcome half of `service/ExperimentJob.java`, single cron):

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository; // match ExperimentJob's user-repo import
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {
    FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
    FeaturesConfiguration.CHALLENGE_JOB_SWITCH}, havingValue = "true")
public class ChallengeJob {

    private final AppUserRepository appUserRepository;      // use ExperimentJob's actual user repo
    private final ChallengeOutcomeEvaluator outcomeEvaluator;

    @Scheduled(cron = "${mezo.proactive.challenge.outcome-cron}")
    public void runOutcome() {
        LocalDate today = LocalDate.now();
        appUserRepository.findAll().forEach(u -> {
            try { outcomeEvaluator.evaluateDue(u.getId(), today); }
            catch (Exception e) { log.warn("Challenge outcome run failed for {}: {}", u.getId(), e.getMessage()); }
        });
    }
}
```
(Match `ExperimentJob`'s exact user-repository type + accessor — open `ExperimentJob.java` and copy its `appUserRepository.findAll()` idiom verbatim.)

- [ ] **Step 6: Write `ProactiveApiChallengeIT`** (`extends ApiIntegrationTest`, `@ActiveProfiles("companion-fake")`, mirror `ProactiveApiExperimentIT` + the pattern-decision cases). Cases:
  - GET with no confirmed-pattern/history context → `200 []`; 401 without token (use the base helper's no-auth call).
  - Plant a template session + an exercise with past logged sets → GET `?templateSessionId=&date={today}` lazily proposes → 1 proposed row (the fake default PR challenge).
  - `POST /challenge/{id}/decision {accept}` → 200 status accepted; a second decide on the now-accepted row → **409**; `{dismiss}` on a fresh proposed row → 200 dismissed, and it disappears from the next GET.
  - decide on a random UUID → 404; `{decision:"nope"}` → 400 (contract pattern).
  - After accepting + logging a hitting set + the instance completes, a re-GET resolves the challenge to `hit` (optional if the fixture wiring is cheap; otherwise cover in `ChallengeOutcomeIT` only).

- [ ] **Step 7: Write `ChallengeJobIT`** (1): the outcome run resolves a due accepted challenge (plant an accepted row with a past `workout_date` and no instance → becomes `inconclusive`). `ChallengeJobSwitchOffIT` (1): `CHALLENGE_JOB_SWITCH=false` ⇒ no `ChallengeJob` bean (`assertThat(context.getBeansOfType(ChallengeJob.class)).isEmpty()`, the `ExperimentJobSwitchOffIT` idiom).

- [ ] **Step 8: Extend `ProactiveApiSwitchOffIT`** (+2): with `mezo.feature.proactive.enabled=false`, `GET /api/proactive/challenge?...` and `POST /api/proactive/challenge/{uuid}/decision` both return 404 (no controller bean).

- [ ] **Step 9: Run the full backend gate:** `cd backend && ./mvnw clean test`
Expected: all green (docker compose up on :15432).

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive backend/src/main/resources/messages.properties backend/src/test/java/io/mrkuhne/mezo/feature/proactive
git commit -m "feat(challenges): write path — list/decide + ChallengeJob outcome backstop (mezo-hbwi)"
```

---

### Task 7: FE data layer — types + challengeApi + challengeHooks + MSW + tests

**Files:**
- Modify: `frontend/src/data/types.ts` (extend `Challenge`)
- Create: `frontend/src/data/train/challengeApi.ts`, `frontend/src/data/train/challengeHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel export)
- Modify: `frontend/src/test/msw/handlers.ts` (GET + POST handlers)
- Create: `frontend/src/data/train/challengeHooks.test.tsx`

**Interfaces:**
- Consumes: `paths['/api/proactive/challenge']` from `api.gen.ts`.
- Produces: `useChallenges(templateSessionId: string | null, date: string): { challenges: Challenge[]; mode }` + `useChallengeActions(templateSessionId: string | null, date: string): { decide, pending }`; `challengeApi.list/decide`.

- [ ] **Step 1: Extend the `Challenge` type** in `types.ts` — make it honest + live-compatible while keeping the mock seed compiling:

```ts
export interface ChallengeRef { kind: string; label: string }
export type ChallengeType = 'PR' | 'Depth' | 'Volume' | 'Tempo'
export type ChallengeStatus = 'proposed' | 'accepted' | 'dismissed' | 'hit' | 'miss' | 'inconclusive'
export interface Challenge {
  id: string
  type: ChallengeType
  typeLabel: string
  exerciseId: string
  exercise?: string
  target: string
  confidence?: number | null   // null → "tanulom"
  risk: 'low' | 'mid'
  why: string
  refs: ChallengeRef[]
  tools?: Tool[]               // mock-only; absent in live
  glory: string
  status?: ChallengeStatus     // absent in the Phase-1 mock seed (treated as proposed)
  outcome?: string
  outcomeGood?: boolean
}
```
(The mock seed in `data/train/train.ts` keeps `confidence`/`tools` — now type-compatible. No seed edit required.)

- [ ] **Step 2: Write `challengeApi.ts`** (mirror `data/insights/experimentsApi.ts`):

```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { Challenge, ChallengeStatus, ChallengeType } from '@/data/types'

type ChallengeWire =
  paths['/api/proactive/challenge']['get']['responses']['200']['content']['application/json'][number]
type DecisionRequest =
  paths['/api/proactive/challenge/{id}/decision']['post']['requestBody']['content']['application/json']

export function toChallenge(w: ChallengeWire): Challenge {
  return {
    id: w.id,
    type: w.type as ChallengeType,
    typeLabel: w.typeLabel,
    exerciseId: w.exerciseId,
    exercise: w.exercise,
    target: w.target,
    confidence: w.confidence ?? null,
    risk: w.risk as 'low' | 'mid',
    why: w.why,
    refs: w.refs,
    glory: w.glory,
    status: w.status as ChallengeStatus,
    outcome: w.outcome ?? undefined,
    outcomeGood: w.outcomeGood ?? undefined,
    // no tools in live — omitted
  }
}

export const challengeApi = {
  list: (templateSessionId: string, date: string) =>
    apiFetch<ChallengeWire[]>(
      `/api/proactive/challenge?templateSessionId=${templateSessionId}&date=${date}`,
    ).then((rows) => rows.map(toChallenge)),
  decide: (id: string, decision: 'accept' | 'dismiss') =>
    apiFetch<ChallengeWire>(`/api/proactive/challenge/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision } satisfies DecisionRequest),
    }).then(toChallenge),
}
```

- [ ] **Step 3: Write `challengeHooks.ts`** (dual-mode; mock seeds from `train.ts`'s `workout.challenges`):

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { challengeApi } from '@/data/train/challengeApi'
import { workout as mockWorkout } from '@/data/train/train'
import type { Challenge } from '@/data/types'

const key = (t: string | null, d: string) => ['challenges', t, d]

export function useChallenges(templateSessionId: string | null, date: string): { challenges: Challenge[]; mode: 'mock' | 'live' } {
  const mock = isMockMode()
  const q = useQuery<Challenge[]>({
    queryKey: key(templateSessionId, date),
    queryFn: mock ? async () => mockWorkout.challenges : () => challengeApi.list(templateSessionId as string, date),
    enabled: mock || !!templateSessionId,
    initialData: mock ? mockWorkout.challenges : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  if (mock) return { challenges: mockWorkout.challenges, mode: 'mock' }
  return { challenges: q.data ?? [], mode: 'live' }
}

export function useChallengeActions(templateSessionId: string | null, date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const invalidate = () => qc.invalidateQueries({ queryKey: key(templateSessionId, date) })
  const decision = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'accept' | 'dismiss' }) => {
      if (mock) return
      await challengeApi.decide(id, decision)
    },
    onSuccess: mock ? undefined : invalidate,
  })
  return {
    decide: (id: string, d: 'accept' | 'dismiss') => decision.mutate({ id, decision: d }),
    pending: decision.isPending,
  }
}
```

- [ ] **Step 4: Barrel export** — add to `data/hooks.ts`:

```ts
export { useChallenges, useChallengeActions } from '@/data/train/challengeHooks'
```

- [ ] **Step 5: MSW handlers** — add to `test/msw/handlers.ts`: a default `http.get('*/api/proactive/challenge', () => HttpResponse.json([]))` and `http.post('*/api/proactive/challenge/:id/decision', async ({ params, request }) => { const { decision } = await request.json(); return HttpResponse.json({ /* a minimal ChallengeWire echoing status accepted|dismissed */ }) })`. Provide a shared `challengeWire(overrides)` factory in the test-support file the other proactive handlers use.

- [ ] **Step 6: Write the failing hooks test** `challengeHooks.test.tsx` (mirror `experimentsHooks.test.tsx`). 3+ tests:
  1. real mode maps a wire row (server.use a GET returning one PR wire → `useChallenges` yields it, `confidence` null preserved).
  2. real default `[]` → empty list.
  3. mock mode returns `mockWorkout.challenges` without fetching.
  4. `useChallengeActions().decide('id','accept')` posts and invalidates (assert a refetch or a POST spy).

- [ ] **Step 7: Run — expect RED then GREEN:** `cd frontend && pnpm test challengeHooks`
- [ ] **Step 8: Commit**

```bash
git add frontend/src/data
git commit -m "feat(fe): useChallenges + useChallengeActions dual-mode hooks (mezo-hbwi)"
```

---

### Task 8: FE surface — ActiveWorkoutPage wire + ChallengeCard honest states

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx`
- Modify: `frontend/src/features/train/components/ChallengeCard.tsx`
- Modify: `frontend/src/features/train/components/ChallengesCarousel.tsx` (outcome-state rendering)
- Test: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx` (or the challenge-focused test file already there)

**Interfaces:**
- Consumes: `useChallenges`, `useChallengeActions` from `@/data/hooks`.

- [ ] **Step 1: Adapt `ChallengeCard`** for honest states:
  - Confidence line: `{c.confidence == null ? 'tanulom' : \`conf ${(c.confidence * 100).toFixed(0)}%\`}` (replaces the current `(c.confidence * 100)` which NPEs on null).
  - Tools row: render only when `c.tools?.length` (live sends none → hidden; mock keeps them). Guard the existing `.map`.
  - Completed states: when `c.status` is `hit`/`miss`/`inconclusive`, render a status chip (`✓ Megerősítve` success / `◯ Nem igazolódott` neutral / `◌ Nem értékelhető` warning) + the `c.outcome` line, and HIDE the accept/skip action row (the workout is decided). Use the colors from the approved mockup (`docs/superpowers/specs/2026-07-07-workout-challenges-design.md` §5 + the mockup file).

- [ ] **Step 2: Wire `ActiveWorkoutPage`** to real challenges + real accept/dismiss:
  - Compute `const localToday = localDateString()` and `const templateSessionId = todaySession?.templateSessionId ?? null`.
  - `const { challenges } = useChallenges(templateSessionId, localToday)` and `const { decide } = useChallengeActions(templateSessionId, localToday)`.
  - In live mode, feed `challenges` into the carousel instead of `W.challenges`; keep `W.challenges` for mock (or unify: `useChallenges` already returns the mock seed in mock mode, so `challenges` works for BOTH — prefer unifying and dropping the `W.challenges` read).
  - `accepted` map derives from the server status: `Object.fromEntries(challenges.map(c => [c.id, c.status === 'accepted' || c.status === 'hit' || c.status === 'miss']))`. `onToggle` in live calls `decide(id, accepted ? 'dismiss' : 'accept')`; in mock keeps the local `acceptedChallenges` toggle (byte parity). Gate on `isMockMode()` or the `mode` from the hook.
  - The `exChallenge`/`activeChallenge` lookups (`ActiveWorkoutPage.tsx:403,480`) keep working since they read from the same `challenges` array.

- [ ] **Step 3: Carousel** — `ChallengesCarousel` already returns `null` on empty (live honest absence). Ensure a resolved (`hit`/`miss`/`inconclusive`) challenge still renders a card (it should — they're in the array); no dot-glow change needed. Adjust only if a completed card should not count toward the "accepted" dot styling.

- [ ] **Step 4: Update/writes tests** `ActiveWorkoutPage.test.tsx`:
  - mock describe: the seed challenges render (existing behavior — keep byte parity; the `tools` chips still show, `conf 72%` shows).
  - real describe (MSW): a GET returning one proposed PR challenge with `confidence: null` renders `tanulom` and NO tools chips; clicking `Vállaljuk` posts `accept` (assert via a `server.use` POST spy or a re-GET returning `accepted`); a wire row with `status: 'hit'` renders `✓ Megerősítve` + outcome, no action buttons.

- [ ] **Step 5: Run the full FE gate:**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build passes; both test modes green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train
git commit -m "feat(fe): workout challenges live — real accept/dismiss + honest confidence/tools/outcome (mezo-hbwi)"
```

---

### Task 9: Docs + gates + merge + close

**Files:**
- Modify: `docs/features/train.md`, `docs/features/proactive.md`
- Possibly: `docs/features/insights.md` (cross-ref), `docs/milestones/roadmap.md`
- Run: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Update `docs/features/train.md`** — the challenges surface is now live: §2 (user-facing: propose → L2 accept → hit/miss/inconclusive), §3 (the GET/decide flow + lazy generate/eval), §4 (the `/api/proactive/challenge` endpoints + the `challenge` table + `ChallengeGenerator`/`ChallengeOutcomeEvaluator`), §5 (integration with proactive), §10 (key files). Note the honest-numbers treatment (tanulom, hidden tools, refs) and the type catalog v1 (PR/Depth/Volume; Tempo deferred).

- [ ] **Step 2: Update `docs/features/proactive.md`** — add a "Workout challenges" block to §1 + a status row (a NEW workout-scoped proactive surface, distinct from the standing experiments); §3 the lazy generate+eval flow; §4 the table/endpoints/config/`CHALLENGE_JOB_SWITCH`; §9 the decisions (package=proactive, B-model identity, structured targets, new set-level evaluator, no propose endpoint) + gotcha (the SEVENTH marker `CHALLENGE_MARKER`).

- [ ] **Step 3: Update `docs/milestones/roadmap.md`** — a line item that workout challenges shipped (Train × proactive), if the roadmap tracks per-surface status.

- [ ] **Step 4: Lint docs:**

```bash
node scripts/lint-docs.mjs
```
Expected: PASS (clears the staleness flags on the touched feature docs; fix any broken cross-links it reports).

- [ ] **Step 5: Re-run both full gates** if any code changed during docs (`./mvnw clean test`; `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`).

- [ ] **Step 6: Commit docs:**

```bash
git add docs/
git commit -m "docs(challenges): train + proactive feature docs — workout challenges live (mezo-hbwi)"
```

- [ ] **Step 7: Merge per house flow** (single dev, `--no-ff`, rebase BEFORE the merge, never after — it flattens the merge commit):

```bash
git checkout main && git pull --rebase && git merge --no-ff feat/workout-challenges -m "Merge feat/workout-challenges — live workout challenges (mezo-hbwi)"
git branch -d feat/workout-challenges
```

- [ ] **Step 8: Close bd + push:**

```bash
bd close mezo-hbwi
bd update mezo-hbwi --notes "Workout challenges live: proactive /api/proactive/challenge (list+decide), ChallengeGenerator (structured targets), ChallengeOutcomeEvaluator (set-level hit/miss/inconclusive), ActiveWorkoutPage real accept/dismiss. Tempo deferred."
bd dolt push && git push
git status   # MUST show "up to date with origin"
```

## Self-Review

- **Spec coverage:** §2 decisions a–h → Task 1 (contract/a), Task 2 (table/entity/d,g), Task 4 (generator/e,f,h + config/a), Task 5 (evaluator/c,d,g), Task 6 (write path/g + package/a), Task 7–8 (FE/e,f,g). §3 data model → Task 2. §4 generation → Task 4. §5 evaluation → Task 5. §6 endpoints → Task 1 + Task 6. §7 FE → Task 7–8. §8 honest-numbers → Task 4 (confidence/refs) + Task 8 (tanulom/tools). §9 testing → each task's IT + Task 8 FE. §11 forks → all resolved in the design. No gaps.
- **Placeholder scan:** the ITs are described with concrete case lists + fixtures rather than full bodies — the implementer writes them from the named populators/assert idioms (the P2 plan's convention); every production class has complete code. No "TBD"/"handle edge cases".
- **Type consistency:** `ChallengeEntity` constants (`STATUS_*`, `TYPE_*`, `RISK_*`) used identically in Tasks 4/5/6; `ChallengeGenerator.generate(userId, templateSessionId, date)` signature matches the service call in Task 6; `ChallengeOutcomeEvaluator.evaluate(c, today)`/`evaluateDue(userId, today)` match Task 6's service + job calls; FE `toChallenge`/`useChallenges(templateSessionId, date)` match across Tasks 7–8; wire fields (`typeLabel`, `target`, `confidence`, `status`, `outcome`, `outcomeGood`) consistent between the contract (Task 1), mapper (Task 6), and FE (Task 7).
- **Verify-at-execution flags:** the exact `AppUserRepository` type/accessor in `ChallengeJob` (copy from `ExperimentJob`); the `ProactiveMapper` MapStruct expression idiom (copy from `toExperimentResponse`); `SystemMessage.field(...)` invalid-value call (copy from `ProactiveExperimentService`); whether `ChallengeRepository` finders need the explicit `AndDeletedFalse` suffix (match `ExperimentRepository`); the Train populator class names for FK fixtures (`WorkoutSessionPopulator`/`ExercisePopulator`/`ExerciseSetPopulator` — confirm at execution).
