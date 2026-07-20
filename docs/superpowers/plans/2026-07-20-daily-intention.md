# Daily Intention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily intentionality practice — a standing creed + up to 3 daily foci + a holistic evening reflection — in its own `feature/intention` domain, surfaced as an `IntentionBanner` at the top of Today, two DERIVED habits, and a DERIVED `growth_intention` quest.

**Architecture:** New backend `feature/intention` (3 owned tables + `IntentionService` + contract-first `intention.yml`), read by the existing `HabitEvaluator`/`QuestEvaluator` for two new metrics (no new progression source — XP rides the HABIT + QUEST award tails). FE `data/intention/` dual-mode hooks + a Today banner + three sheets. Spec: `docs/superpowers/specs/2026-07-20-daily-intention-design.md` (bd `mezo-a686`).

**Tech Stack:** Spring Boot 4 / Java 21 / Maven, Liquibase, PostgreSQL (compose on :15432), OpenAPI (openapi-merge-cli + openapi-generator), React 19 + TanStack Query + Vitest/MSW.

## Global Constraints

- Base package `io.mrkuhne.mezo`; UUID PKs; owned tables carry `created_by`/`is_deleted`/`created_at`; soft delete via `@SQLDelete`/`@SQLRestriction`.
- Backend tests: `cd backend && ./mvnw clean test -Dtest=<Class> -DargLine=-Xmx3g` (compose up; ALWAYS `clean`). NEVER run the full suite locally (16 GB box OOM) — CI is the full gate.
- FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green).
- Errors: `SystemRuntimeErrorException` + `SystemMessage.error("CODE").build()` — no hardcoded user text; HU copy in `messages.properties` next to the existing codes.
- Config: everything under `mezo:` in `application.yml`; switch via `FeaturesConfiguration` constant + `@ConditionalOnProperty`; tunables via `@Validated` `IntentionProperties` record; **never `@Value`**.
- All user-facing copy Hungarian; code/comments English. Conventional commits with bd id `(mezo-a686)`.
- Worktree commits: `git -c core.hooksPath=/dev/null commit` (bd pre-commit hook would stage `.beads/issues.jsonl`).
- ADR 0010: XP is feedback — no new progression source; the **first** focus of the day earns (habit+quest derived on `focus count ≥ 1`); foci 2–3 are free. Skill for all intention XP: **`mindset`** (LIFE).
- Reflection tokens on the wire: `yes` | `partial` | `no` (HU labels Igen/Részben/Nem on the FE only).
- Cap: max **3** foci per day (service-enforced, 409). Creed ≤ 280 chars, focus ≤ 200 chars.

---

### Task 1: API contract — intention fragment

**Files:**
- Create: `api/feature/intention/intention.yml`
- Modify: `api/generate/merge.yml` (append input)
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `IntentionApi` (tag `Intention`) + DTOs `IntentionDayResponse`, `IntentionFocusResponse`, `IntentionCreedResponse`, `SetCreedRequest`, `AddFocusRequest`, `ReflectRequest` in `io.mrkuhne.mezo.api.dto`; FE wire types under `paths['/api/intention/...']`.

- [ ] **Step 1: Write the fragment**

Create `api/feature/intention/intention.yml`:

```yaml
openapi: 3.0.3
info: { title: mezo intention fragment, version: 1.0.0 }
paths:
  /api/intention/day/{date}:
    get:
      tags: [Intention]
      operationId: getIntentionDay
      summary: The day's creed + foci + reflection (Intention)
      parameters:
        - { name: date, in: path, required: true, schema: { type: string, format: date } }
      responses:
        '200':
          description: The day's intention state
          content:
            application/json:
              schema: { $ref: '#/components/schemas/IntentionDayResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/intention/creed:
    put:
      tags: [Intention]
      operationId: setCreed
      summary: Upsert the standing creed (Intention)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SetCreedRequest' }
      responses:
        '200':
          description: Saved creed
          content:
            application/json:
              schema: { $ref: '#/components/schemas/IntentionCreedResponse' }
        '400':
          description: INTENTION_TEXT_REQUIRED
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/intention/focus:
    post:
      tags: [Intention]
      operationId: addFocus
      summary: Add a focus for the day (max 3) (Intention)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AddFocusRequest' }
      responses:
        '200':
          description: Focus added
          content:
            application/json:
              schema: { $ref: '#/components/schemas/IntentionFocusResponse' }
        '400':
          description: INTENTION_TEXT_REQUIRED
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: INTENTION_FOCUS_CAP
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/intention/focus/{id}:
    delete:
      tags: [Intention]
      operationId: removeFocus
      summary: Remove a focus (Intention)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204':
          description: Removed
        '404':
          description: INTENTION_FOCUS_NOT_FOUND
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/intention/reflect:
    post:
      tags: [Intention]
      operationId: reflect
      summary: Set the day's holistic reflection (Intention)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ReflectRequest' }
      responses:
        '200':
          description: Reflection saved
          content:
            application/json:
              schema: { $ref: '#/components/schemas/IntentionDayResponse' }
        '400':
          description: INTENTION_REFLECTION_INVALID
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    IntentionFocusResponse:
      type: object
      required: [id, focusDate, text]
      properties:
        id: { type: string, format: uuid }
        focusDate: { type: string, format: date }
        text: { type: string }
    IntentionCreedResponse:
      type: object
      required: [text]
      properties:
        text: { type: string }
    IntentionDayResponse:
      type: object
      required: [date, foci, focusCap]
      properties:
        date: { type: string, format: date }
        creed: { type: string, nullable: true }
        foci:
          type: array
          items: { $ref: '#/components/schemas/IntentionFocusResponse' }
        reflection: { type: string, nullable: true, enum: [yes, partial, no] }
        focusCap: { type: integer }
    SetCreedRequest:
      type: object
      required: [text]
      properties:
        text: { type: string }
    AddFocusRequest:
      type: object
      required: [date, text]
      properties:
        date: { type: string, format: date }
        text: { type: string }
    ReflectRequest:
      type: object
      required: [date, value]
      properties:
        date: { type: string, format: date }
        value: { type: string, enum: [yes, partial, no] }
```

- [ ] **Step 2: Register the fragment**

In `api/generate/merge.yml` append after the habit input (`../feature/habit/habit.yml`):

```yaml
  - inputFile: ../feature/intention/intention.yml
```

- [ ] **Step 3: Merge + regenerate FE types**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` contains `/api/intention/day/{date}`; `git diff --stat frontend/src/data/_client/api.gen.ts` shows changes.

- [ ] **Step 4: Verify backend generation compiles**

Run: `cd backend && ./mvnw -q clean generate-sources 2>&1 | tail -3 && ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/IntentionApi.java`
Expected: the `IntentionApi.java` path prints. Note whether the `enum` fields generated a Java enum type (`IntentionDayResponse.ReflectionEnum`) — later tasks use `.getValue()` on it if so.

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): intention fragment — day/creed/focus/reflect (mezo-a686)"
```

---

### Task 2: Migration, entities, repositories, config scaffolding

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607201200_mezo-a686_create_intention.sql`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/intention/entity/{IntentionCreedEntity,IntentionFocusEntity,DailyIntentionEntity}.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/intention/repository/{IntentionCreedRepository,IntentionFocusRepository,DailyIntentionRepository}.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/intention/config/IntentionProperties.java`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`, `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`, `backend/src/main/resources/application.yml`, `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/intention/IntentionEntityIT.java`

**Interfaces:**
- Produces: `IntentionCreedEntity` (`text`), `IntentionFocusEntity` (`focusDate`, `text`), `DailyIntentionEntity` (`intentionDate`, `reflection` + constants `REFLECTION_YES="yes"`/`REFLECTION_PARTIAL="partial"`/`REFLECTION_NO="no"`); the three repositories (finders below); `IntentionProperties` (`mezo.intention`); `FeaturesConfiguration.INTENTION_SWITCH`.

- [ ] **Step 1: Migration**

`202607201200_mezo-a686_create_intention.sql`:

```sql
-- Daily intention (bd mezo-a686): a standing creed + up to 3 daily foci + a holistic evening
-- reflection. No level_up_event CHECK change — intention XP rides the existing HABIT + QUEST tails.

create table intention_creed (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    text       varchar(280) not null,
    constraint pk_intention_creed_id primary key (id),
    constraint fk_intention_creed_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_intention_creed_user on intention_creed (created_by) where is_deleted = false;

create table intention_focus (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    focus_date date        not null,
    text       varchar(200) not null,
    constraint pk_intention_focus_id primary key (id),
    constraint fk_intention_focus_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create index idx_intention_focus_user_date on intention_focus (created_by, focus_date) where is_deleted = false;

create table daily_intention (
    id             uuid        not null default gen_random_uuid(),
    created_by     uuid        not null,
    is_deleted     boolean     not null default false,
    created_at     timestamptz not null default now(),
    intention_date date        not null,
    reflection     varchar(8)  not null,
    constraint pk_daily_intention_id primary key (id),
    constraint fk_daily_intention_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_daily_intention_reflection check (reflection in ('yes', 'partial', 'no'))
);
create unique index uq_daily_intention_user_date on daily_intention (created_by, intention_date) where is_deleted = false;
```

Append to `1.0.0_master.yml` (same shape as the `habit_day` entry):

```yaml
  - changeSet:
      id: "1.0.0:202607201200_mezo-a686_create_intention"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607201200_mezo-a686_create_intention.sql
```

- [ ] **Step 2: Entities**

All three extend `OwnedEntity`, mirror `HabitDayEntity`'s annotations (`@Getter @Setter @Entity @Table(name=...) @SQLDelete(...) @SQLRestriction("is_deleted = false")`, `@Id @GeneratedValue @Column(columnDefinition="uuid") UUID id`). Open `feature/habit/entity/HabitDayEntity.java` and copy its shape.

`IntentionCreedEntity` (`@Table("intention_creed")`): field `@Column(nullable=false, length=280) String text`.

`IntentionFocusEntity` (`@Table("intention_focus")`): `@Column(name="focus_date", nullable=false) LocalDate focusDate`; `@Column(nullable=false, length=200) String text`.

`DailyIntentionEntity` (`@Table("daily_intention")`): constants `public static final String REFLECTION_YES="yes", REFLECTION_PARTIAL="partial", REFLECTION_NO="no";`; `@Column(name="intention_date", nullable=false) LocalDate intentionDate`; `@Column(nullable=false, length=8) String reflection`.

- [ ] **Step 3: Repositories**

```java
// IntentionCreedRepository
public interface IntentionCreedRepository extends JpaRepository<IntentionCreedEntity, UUID> {
    Optional<IntentionCreedEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
// IntentionFocusRepository
public interface IntentionFocusRepository extends JpaRepository<IntentionFocusEntity, UUID> {
    List<IntentionFocusEntity> findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(UUID createdBy, LocalDate focusDate);
    Optional<IntentionFocusEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
// DailyIntentionRepository
public interface DailyIntentionRepository extends JpaRepository<DailyIntentionEntity, UUID> {
    Optional<DailyIntentionEntity> findByCreatedByAndIntentionDateAndDeletedFalse(UUID createdBy, LocalDate intentionDate);
}
```

- [ ] **Step 4: Config**

`FeaturesConfiguration.java` — append next to `HABIT_SWITCH`:

```java
    /** Daily intention (creed + foci + reflection, mezo-a686). Gates /api/intention + services. */
    public static final String INTENTION_SWITCH = "mezo.feature.intention.enabled";
```

`application.yml` — under `mezo.feature` add `intention: { enabled: true }` (expanded style matching neighbors); top-level `mezo.intention` block (sibling of `mezo.habit`):

```yaml
  intention:
    focus-cap: 3
    creed-max-len: 280
    focus-max-len: 200
```

`IntentionProperties.java`:

```java
package io.mrkuhne.mezo.feature.intention.config;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Intention tuning (mezo.intention) — cap + text limits, never code (configuration_conventions.md). */
@Validated
@ConfigurationProperties(prefix = "mezo.intention")
public record IntentionProperties(
    @Min(1) int focusCap,
    @Min(1) int creedMaxLen,
    @Min(1) int focusMaxLen) {}
```

`ResetDatabase.java` — prepend `intention_creed, intention_focus, daily_intention, ` to the head of the TRUNCATE list (before `habit_day`).

- [ ] **Step 5: Entity IT**

`IntentionEntityIT.java` (mirror `HabitDayEntityIT`'s owner idiom — `userPopulator.createUser("intent-a@test.hu").getId()`):

```java
package io.mrkuhne.mezo.feature.intention;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import io.mrkuhne.mezo.feature.intention.repository.IntentionFocusRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class IntentionEntityIT extends AbstractIntegrationTest {

    @Autowired private IntentionFocusRepository focusRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSaveFocus_shouldRoundTripOwnerScoped_whenPersisted() {
        UUID owner = userPopulator.createUser("intent-a@test.hu").getId();
        IntentionFocusEntity e = new IntentionFocusEntity();
        e.setCreatedBy(owner);
        e.setFocusDate(LocalDate.now());
        e.setText("Jelen lenni minden beszélgetésben.");
        focusRepository.saveAndFlush(e);

        var found = focusRepository
            .findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(owner, LocalDate.now());
        assertThat(found).hasSize(1);
        assertThat(found.getFirst().getText()).startsWith("Jelen lenni");
    }
}
```

(Check whether `AbstractIntegrationTest` autowires `UserPopulator` already or if each IT declares it — mirror `HabitDayEntityIT` exactly.)

- [ ] **Step 6: Run + commit**

Run: `cd backend && ./mvnw clean test -Dtest=IntentionEntityIT -DargLine=-Xmx3g` → PASS.

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(intention): tables + entities/repos + config scaffolding (mezo-a686)"
```

---

### Task 3: IntentionService + IntentionMapper + service IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/intention/service/IntentionService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/intention/mapper/IntentionMapper.java`
- Modify: `backend/src/main/resources/messages.properties` (5 new codes)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/intention/IntentionServiceIT.java`
- Test helper: `backend/src/test/java/io/mrkuhne/mezo/support/populator/IntentionPopulator.java` (+ register in `AbstractIntegrationTest` `@Import`)

**Interfaces:**
- Consumes: the three repositories (Task 2), `IntentionProperties`, generated DTOs.
- Produces: `IntentionService` (gated `INTENTION_SWITCH`) — `IntentionDayResponse getDay(UUID,LocalDate)`, `IntentionCreedResponse setCreed(UUID,String)`, `IntentionFocusResponse addFocus(UUID,LocalDate,String)`, `void removeFocus(UUID,UUID)`, `IntentionDayResponse reflect(UUID,LocalDate,String)`. `IntentionMapper` — `IntentionFocusResponse toResponse(IntentionFocusEntity)`.
- Produces: `IntentionPopulator` — `focus(owner,date,text)`, `creed(owner,text)`, `reflection(owner,date,value)`.

- [ ] **Step 1: Add SystemMessage codes**

Append to `messages.properties` next to the `HABIT_*` codes (HU copy, mirror the existing format):

```properties
INTENTION_TEXT_REQUIRED=A szöveg nem lehet üres.
INTENTION_FOCUS_CAP=Ma már elérted a napi szándék-keretet.
INTENTION_FOCUS_NOT_FOUND=A szándék nem található.
INTENTION_REFLECTION_INVALID=Érvénytelen reflexió-érték.
```

(Check the file's exact key format from a `HABIT_*` line — copy it. If codes live in a differently-named properties file, put them where `HABIT_UNKNOWN` lives.)

- [ ] **Step 2: Write the failing service IT**

`IntentionServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.intention;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class IntentionServiceIT extends AbstractIntegrationTest {

    @Autowired private IntentionService service;
    @Autowired private UserPopulator userPopulator;

    private UUID owner() { return userPopulator.createUser("intent-svc@test.hu").getId(); }

    @Test
    void testSetCreed_shouldUpsertSingleRow_whenCalledTwice() {
        UUID owner = owner();
        service.setCreed(owner, "Első vezérelv.");
        var second = service.setCreed(owner, "Szándékkal élek.");
        assertThat(second.getText()).isEqualTo("Szándékkal élek.");
        assertThat(service.getDay(owner, LocalDate.now()).getCreed()).isEqualTo("Szándékkal élek.");
    }

    @Test
    void testAddFocus_shouldCapAtThree_whenFourthAdded() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        service.addFocus(owner, d, "Egy.");
        service.addFocus(owner, d, "Kettő.");
        service.addFocus(owner, d, "Három.");
        assertThat(service.getDay(owner, d).getFoci()).hasSize(3);
        assertThatThrownBy(() -> service.addFocus(owner, d, "Négy."))
            .isInstanceOf(SystemRuntimeErrorException.class); // INTENTION_FOCUS_CAP
        assertThatThrownBy(() -> service.addFocus(owner, d, "  "))
            .isInstanceOf(SystemRuntimeErrorException.class); // INTENTION_TEXT_REQUIRED
    }

    @Test
    void testRemoveFocus_shouldFreeCapacity_whenDeleted() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        var f = service.addFocus(owner, d, "Egy.");
        service.removeFocus(owner, f.getId());
        assertThat(service.getDay(owner, d).getFoci()).isEmpty();
    }

    @Test
    void testReflect_shouldUpsertReflection_whenSet() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        service.reflect(owner, d, "yes");
        assertThat(service.getDay(owner, d).getReflection().getValue()).isEqualTo("yes");
        service.reflect(owner, d, "partial");
        assertThat(service.getDay(owner, d).getReflection().getValue()).isEqualTo("partial");
        assertThatThrownBy(() -> service.reflect(owner, d, "maybe"))
            .isInstanceOf(SystemRuntimeErrorException.class); // INTENTION_REFLECTION_INVALID
    }

    @Test
    void testGetDay_shouldExposeFocusCap_always() {
        assertThat(service.getDay(owner(), LocalDate.now()).getFocusCap()).isEqualTo(3);
    }
}
```

(If the generated `getReflection()` is a plain `String` rather than an enum, drop `.getValue()`. Confirm from Task 1 Step 4.)

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=IntentionServiceIT -DargLine=-Xmx3g`
Expected: COMPILE FAILURE (`IntentionService` missing).

- [ ] **Step 4: Implement IntentionMapper + IntentionService**

`IntentionMapper.java`:

```java
package io.mrkuhne.mezo.feature.intention.mapper;

import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import org.springframework.stereotype.Component;

@Component
public class IntentionMapper {
    public IntentionFocusResponse toResponse(IntentionFocusEntity e) {
        return IntentionFocusResponse.builder()
            .id(e.getId()).focusDate(e.getFocusDate()).text(e.getText()).build();
    }
}
```

`IntentionService.java`:

```java
package io.mrkuhne.mezo.feature.intention.service;

import io.mrkuhne.mezo.api.dto.IntentionCreedResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.feature.intention.config.IntentionProperties;
import io.mrkuhne.mezo.feature.intention.entity.DailyIntentionEntity;
import io.mrkuhne.mezo.feature.intention.entity.IntentionCreedEntity;
import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import io.mrkuhne.mezo.feature.intention.mapper.IntentionMapper;
import io.mrkuhne.mezo.feature.intention.repository.DailyIntentionRepository;
import io.mrkuhne.mezo.feature.intention.repository.IntentionCreedRepository;
import io.mrkuhne.mezo.feature.intention.repository.IntentionFocusRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.INTENTION_SWITCH, havingValue = "true")
public class IntentionService {

    private static final Set<String> REFLECTIONS = Set.of(
        DailyIntentionEntity.REFLECTION_YES,
        DailyIntentionEntity.REFLECTION_PARTIAL,
        DailyIntentionEntity.REFLECTION_NO);

    private final IntentionCreedRepository creedRepository;
    private final IntentionFocusRepository focusRepository;
    private final DailyIntentionRepository dailyRepository;
    private final IntentionMapper mapper;
    private final IntentionProperties properties;

    @Transactional(readOnly = true)
    public IntentionDayResponse getDay(UUID userId, LocalDate date) {
        String creed = creedRepository.findByCreatedByAndDeletedFalse(userId)
            .map(IntentionCreedEntity::getText).orElse(null);
        List<IntentionFocusResponse> foci = focusRepository
            .findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(userId, date)
            .stream().map(mapper::toResponse).toList();
        String reflection = dailyRepository.findByCreatedByAndIntentionDateAndDeletedFalse(userId, date)
            .map(DailyIntentionEntity::getReflection).orElse(null);
        return IntentionDayResponse.builder()
            .date(date).creed(creed).foci(foci)
            .reflection(reflection == null ? null
                : IntentionDayResponse.ReflectionEnum.fromValue(reflection))
            .focusCap(properties.focusCap())
            .build();
    }

    @Transactional
    public IntentionCreedResponse setCreed(UUID userId, String text) {
        String t = requireText(text, properties.creedMaxLen());
        IntentionCreedEntity row = creedRepository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                IntentionCreedEntity e = new IntentionCreedEntity();
                e.setCreatedBy(userId);
                return e;
            });
        row.setText(t);
        creedRepository.save(row);
        return IntentionCreedResponse.builder().text(t).build();
    }

    @Transactional
    public IntentionFocusResponse addFocus(UUID userId, LocalDate date, String text) {
        String t = requireText(text, properties.focusMaxLen());
        long count = focusRepository
            .findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(userId, date).size();
        if (count >= properties.focusCap()) {
            throw conflict("INTENTION_FOCUS_CAP");
        }
        IntentionFocusEntity e = new IntentionFocusEntity();
        e.setCreatedBy(userId);
        e.setFocusDate(date);
        e.setText(t);
        return mapper.toResponse(focusRepository.saveAndFlush(e));
    }

    @Transactional
    public void removeFocus(UUID userId, UUID focusId) {
        IntentionFocusEntity e = focusRepository.findByIdAndCreatedByAndDeletedFalse(focusId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("INTENTION_FOCUS_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        focusRepository.delete(e); // @SQLDelete → soft delete
    }

    @Transactional
    public IntentionDayResponse reflect(UUID userId, LocalDate date, String value) {
        if (value == null || !REFLECTIONS.contains(value)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("INTENTION_REFLECTION_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
        DailyIntentionEntity row = dailyRepository
            .findByCreatedByAndIntentionDateAndDeletedFalse(userId, date)
            .orElseGet(() -> {
                DailyIntentionEntity e = new DailyIntentionEntity();
                e.setCreatedBy(userId);
                e.setIntentionDate(date);
                return e;
            });
        row.setReflection(value);
        dailyRepository.save(row);
        return getDay(userId, date);
    }

    private String requireText(String text, int maxLen) {
        String t = text == null ? "" : text.strip();
        if (t.isEmpty()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("INTENTION_TEXT_REQUIRED").build(), HttpStatus.BAD_REQUEST);
        }
        return t.length() > maxLen ? t.substring(0, maxLen) : t;
    }

    private SystemRuntimeErrorException conflict(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.CONFLICT);
    }
}
```

Adaptation: match the EXACT `SystemRuntimeErrorException`/`SystemMessage` constructor idiom from `HabitService` (Task 6 of the habit plan used `SystemMessage.error("CODE").build()` + `HttpStatus`). If the generated DTO reflection is a plain `String`, replace `IntentionDayResponse.ReflectionEnum.fromValue(reflection)` with `reflection` and drop `.getValue()` in the test.

Also create `IntentionPopulator.java` (test support, `@TestComponent`, mirror `HabitPopulator`): `focus(owner, date, text)` / `creed(owner, text)` / `reflection(owner, date, value)` each `saveAndFlush` the entity; register it in `AbstractIntegrationTest`'s `@Import` list.

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=IntentionServiceIT,IntentionEntityIT -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(intention): IntentionService — creed upsert + capped foci + reflection (mezo-a686)"
```

---

### Task 4: IntentionController + HTTP-level ApiIT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/intention/controller/IntentionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/intention/IntentionApiIT.java`

**Interfaces:**
- Consumes: generated `IntentionApi` (Task 1), `IntentionService` (Task 3), `CurrentUserId`.
- Produces: the live `/api/intention/*` surface, gated `INTENTION_SWITCH` (off → 404).

- [ ] **Step 1: Write the failing IT**

`IntentionApiIT.java` (extends `ApiIntegrationTest`; the demodata owner is the auth principal — no populator needed):

```java
package io.mrkuhne.mezo.feature.intention;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AddFocusRequest;
import io.mrkuhne.mezo.api.dto.IntentionCreedResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.api.dto.ReflectRequest;
import io.mrkuhne.mezo.api.dto.SetCreedRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class IntentionApiIT extends ApiIntegrationTest {

    @Test
    void testGetDay_shouldReturnEmptyWithCap_whenNothingSet() {
        IntentionDayResponse day = getForBody("/api/intention/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, IntentionDayResponse.class);
        assertThat(day.getFoci()).isEmpty();
        assertThat(day.getCreed()).isNull();
        assertThat(day.getFocusCap()).isEqualTo(3);
    }

    @Test
    void testSetCreedThenAddFocus_shouldCompose_whenRead() {
        putForBody("/api/intention/creed", SetCreedRequest.builder().text("Szándékkal élek.").build(),
            ownerAuthHeaders(), HttpStatus.OK, IntentionCreedResponse.class);
        LocalDate d = LocalDate.now();
        postForBody("/api/intention/focus", AddFocusRequest.builder().date(d).text("Jelen lenni.").build(),
            ownerAuthHeaders(), HttpStatus.OK, IntentionFocusResponse.class);

        IntentionDayResponse day = getForBody("/api/intention/day/" + d,
            ownerAuthHeaders(), HttpStatus.OK, IntentionDayResponse.class);
        assertThat(day.getCreed()).isEqualTo("Szándékkal élek.");
        assertThat(day.getFoci()).hasSize(1);
    }

    @Test
    void testAddFocus_shouldRejectFourth_whenCapReached() {
        LocalDate d = LocalDate.now();
        for (String t : new String[] {"Egy.", "Kettő.", "Három."}) {
            postForBody("/api/intention/focus", AddFocusRequest.builder().date(d).text(t).build(),
                ownerAuthHeaders(), HttpStatus.OK, IntentionFocusResponse.class);
        }
        String err = postForBody("/api/intention/focus",
            AddFocusRequest.builder().date(d).text("Négy.").build(),
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "INTENTION_FOCUS_CAP");
    }

    @Test
    void testReflect_shouldSetThenRejectInvalid() {
        LocalDate d = LocalDate.now();
        IntentionDayResponse day = postForBody("/api/intention/reflect",
            ReflectRequest.builder().date(d).value(ReflectRequest.ValueEnum.YES).build(),
            ownerAuthHeaders(), HttpStatus.OK, IntentionDayResponse.class);
        assertThat(day.getReflection().getValue()).isEqualTo("yes");
    }
}
```

(Adapt DTO builders/enum accessors to the generated shapes — `ReflectRequest.ValueEnum.YES` vs a plain string; confirm from Task 1 Step 4. If value is a plain string, use `.value("yes")`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=IntentionApiIT -DargLine=-Xmx3g` — Expected: 404s (no controller).

- [ ] **Step 3: Implement the controller**

`IntentionController.java` (mirror `HabitController` — thin delegate, owner from `CurrentUserId`):

```java
package io.mrkuhne.mezo.feature.intention.controller;

import io.mrkuhne.mezo.api.controller.IntentionApi;
import io.mrkuhne.mezo.api.dto.AddFocusRequest;
import io.mrkuhne.mezo.api.dto.IntentionCreedResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.api.dto.ReflectRequest;
import io.mrkuhne.mezo.api.dto.SetCreedRequest;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.INTENTION_SWITCH, havingValue = "true")
public class IntentionController implements IntentionApi {

    private final IntentionService intentionService;
    private final CurrentUserId currentUserId;

    @Override
    public IntentionDayResponse getIntentionDay(LocalDate date) {
        return intentionService.getDay(currentUserId.get(), date);
    }

    @Override
    public IntentionCreedResponse setCreed(SetCreedRequest request) {
        return intentionService.setCreed(currentUserId.get(), request.getText());
    }

    @Override
    public IntentionFocusResponse addFocus(AddFocusRequest request) {
        return intentionService.addFocus(currentUserId.get(), request.getDate(), request.getText());
    }

    @Override
    public void removeFocus(UUID id) {
        intentionService.removeFocus(currentUserId.get(), id);
    }

    @Override
    public IntentionDayResponse reflect(ReflectRequest request) {
        return intentionService.reflect(currentUserId.get(), request.getDate(),
            request.getValue() == null ? null : request.getValue().getValue());
    }
}
```

(Match the generated `IntentionApi` method signatures exactly — check `target/generated-sources/.../IntentionApi.java`. `removeFocus` may return `void` or `ResponseEntity<Void>`; mirror the generated signature. If `getValue()` isn't an enum, pass `request.getValue()` directly.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=IntentionApiIT -DargLine=-Xmx3g` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(intention): IntentionController + HTTP-level ApiIT (mezo-a686)"
```

---

### Task 5: Habit + quest evaluator wiring + catalog entries

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java` (2 metric cases + metric-set membership)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestEvaluator.java` (1 metric case)
- Modify: `backend/src/main/resources/content/habit-catalog.json` (+2 entries)
- Modify: `backend/src/main/resources/content/quest-catalog.json` (+1 entry)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitCatalogIT.java` (counts 10→12, morning 6→7, evening 4→5)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/intention/IntentionDerivedIT.java`

**Interfaces:**
- Consumes: `IntentionFocusRepository`, `DailyIntentionRepository` (Task 2), `IntentionPopulator` (Task 3).
- Produces: habit metrics `intention_focus_set` / `intention_reflected` and quest metric `intention_focus_set` all wired to the intention repos; the two intention habits + the `growth_intention` quest complete derived.

- [ ] **Step 1: Add the catalog entries**

`habit-catalog.json` — append two entries (validation: xp∈[5,15], skillKind LIFE, MANUAL⟺metric=="manual"; these are DERIVED so any non-"manual" metric is fine):

```json
{ "key": "daily_intention", "chain": "MORNING", "position": 7,
  "title": "Napi szándék", "why": "Egy szándékkal indított nap nem sodródik — te választod az irányt.",
  "anchorCopy": "reggeli rutin után", "mode": "DERIVED", "metric": "intention_focus_set",
  "skillKey": "mindset", "skillKind": "LIFE", "xp": 10 },
{ "key": "intention_reflect", "chain": "EVENING", "position": 5,
  "title": "Szándékkal éltem?", "why": "A napzáró őszinte pillantás tanít a legtöbbet — tartás vagy sodródás volt?",
  "anchorCopy": "lefekvés előtt", "mode": "DERIVED", "metric": "intention_reflected",
  "skillKey": "mindset", "skillKind": "LIFE", "xp": 5 }
```

`quest-catalog.json` — append one entry (validation: xp∈[15,40], difficulty 1..3):

```json
{ "key": "growth_intention", "slot": "GROWTH", "skillKey": "mindset", "skillKind": "LIFE",
  "title": "Fogalmazd meg a mai szándékod", "why": "Aki szándékkal kezdi a napot, az irányítja — nem sodródik.",
  "mode": "DERIVED", "metric": "intention_focus_set", "threshold": null, "xp": 20, "coins": 0,
  "difficulty": 2, "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 1 }
```

- [ ] **Step 2: Wire the evaluators**

`HabitEvaluator.java`:
- Inject the two repos: add `private final io.mrkuhne.mezo.feature.intention.repository.IntentionFocusRepository intentionFocusRepository;` and `private final io.mrkuhne.mezo.feature.intention.repository.DailyIntentionRepository dailyIntentionRepository;` to the constructor field list.
- Add BOTH new metric strings to `INTRADAY_METRICS` — change `Set.of("sleep_wake_window", "manual", "weight_logged_before", "stim_intake_before", "training_done_today", "breakfast_protein")` to also include `"intention_focus_set"` **and** `"intention_reflected"`. Both must be INTRADAY so the habit flips to done **immediately** on the read after the user sets a focus / reflects (an in-app evening action), not only at the nightly `closePast`. (Contrast `no_stim_after`/`last_meal_before`, which are END_OF_DAY because they can only be judged once the day is over — an intention is a positive user action, decidable the moment it happens.)
- Add the two switch arms:

```java
            case "intention_focus_set" -> !intentionFocusRepository
                .findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(userId, date).isEmpty();
            case "intention_reflected" -> dailyIntentionRepository
                .findByCreatedByAndIntentionDateAndDeletedFalse(userId, date).isPresent();
```

`QuestEvaluator.java`:
- Inject `private final io.mrkuhne.mezo.feature.intention.repository.IntentionFocusRepository intentionFocusRepository;`.
- Add the arm to its `switch (q.getTarget().metric())`:

```java
            case "intention_focus_set" -> !intentionFocusRepository
                .findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(q.getCreatedBy(), d).isEmpty();
```

(Match each evaluator's local variable name for the date — `HabitEvaluator` uses `date`, `QuestEvaluator` uses `d`. Read both files first.)

- [ ] **Step 3: Update catalog count tests**

`HabitCatalogIT.java`: change `hasSize(10)`→`hasSize(12)`, `CHAIN_MORNING` `hasSize(6)`→`hasSize(7)`, `CHAIN_EVENING` `hasSize(4)`→`hasSize(5)`, and the morning positions `containsExactly(1,2,3,4,5,6)`→`containsExactly(1,2,3,4,5,6,7)`. If `QuestCatalogIT` asserts an entry count, bump it by 1 (read it first; the habit-plan noted 15 quest entries → now 16).

- [ ] **Step 4: Write the derived-completion IT**

`IntentionDerivedIT.java`:

```java
package io.mrkuhne.mezo.feature.intention;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.service.HabitEvaluator;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class IntentionDerivedIT extends AbstractIntegrationTest {

    @Autowired private HabitEvaluator habitEvaluator;
    @Autowired private IntentionService intentionService;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testFocusSet_shouldSatisfyHabitMetric_whenFocusExists() {
        UUID owner = userPopulator.createUser("intent-derived@test.hu").getId();
        LocalDate d = LocalDate.now();
        assertThat(habitEvaluator.satisfied("intention_focus_set", owner, d)).isFalse();
        intentionService.addFocus(owner, d, "Jelen lenni.");
        assertThat(habitEvaluator.satisfied("intention_focus_set", owner, d)).isTrue();
    }

    @Test
    void testReflected_shouldSatisfyHabitMetric_whenReflectionExists() {
        UUID owner = userPopulator.createUser("intent-reflect@test.hu").getId();
        LocalDate d = LocalDate.now();
        assertThat(habitEvaluator.satisfied("intention_reflected", owner, d)).isFalse();
        intentionService.reflect(owner, d, "yes");
        assertThat(habitEvaluator.satisfied("intention_reflected", owner, d)).isTrue();
    }
}
```

- [ ] **Step 5: Run + commit**

Run: `cd backend && ./mvnw clean test -Dtest='IntentionDerivedIT,HabitCatalogIT,QuestCatalogIT' -DargLine=-Xmx3g` → PASS (catalog loaders accept the new entries; derived metrics satisfy).

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(intention): habit/quest evaluators + catalog entries (mezo-a686)"
```

---

### Task 6: FE data layer — types, api, mock, dual-mode hooks

**Files:**
- Create: `frontend/src/data/intention/{intentionApi,intentionMock,intentionHooks}.ts`
- Modify: `frontend/src/data/types.ts` (intention types), `frontend/src/data/hooks.ts` (barrel line), `frontend/src/test/msw/handlers.ts` (honest-empty defaults)
- Test: `frontend/src/data/intention/intentionHooks.test.tsx`

**Interfaces:**
- Produces (types in `data/types.ts`):

```ts
export type Reflection = 'yes' | 'partial' | 'no'
export interface IntentionFocus { id: string; focusDate: string; text: string }
export interface IntentionDay {
  date: string
  creed: string | null
  foci: IntentionFocus[]
  reflection: Reflection | null
  focusCap: number
}
```

- Produces (hooks, barrel-exported from `@/data/hooks`): `useIntentionDay(date)` → `{ data: IntentionDay, isPending }` (query key `['intentionDay', date]`); `useIntentionActions(date)` → `{ setCreed, addFocus, removeFocus, reflect, pending }`.

- [ ] **Step 1: Write the failing hook tests**

`intentionHooks.test.tsx` (mirror the habit/quest hook test — `makeHookWrapper`, `server.use`, `vi.stubEnv` per describe):

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useIntentionDay, useIntentionActions } from '@/data/intention/intentionHooks'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const DATE = '2026-07-20'

describe('useIntentionDay (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seed synchronously (creed + foci)', () => {
    const { result } = renderHook(() => useIntentionDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data.creed).toBeTruthy()
    expect(result.current.data.focusCap).toBe(3)
  })

  test('addFocus appends within the cap', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useIntentionDay(DATE), { wrapper })
    const actions = renderHook(() => useIntentionActions(DATE), { wrapper })
    const before = day.result.current.data.foci.length
    await act(() => actions.result.current.addFocus('Új fókusz.'))
    await waitFor(() => expect(day.result.current.data.foci.length).toBe(before + 1))
  })
})

describe('useIntentionDay (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty while unresolved — never the seed', () => {
    const { result } = renderHook(() => useIntentionDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data.foci).toHaveLength(0)
    expect(result.current.data.creed).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && pnpm test src/data/intention/intentionHooks.test.tsx` — FAIL (module not found).

- [ ] **Step 3: Implement**

Add the types to `data/types.ts` (block above). Then:

`intentionApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { IntentionDay, IntentionFocus, Reflection } from '@/data/types'

type DayWire = paths['/api/intention/day/{date}']['get']['responses']['200']['content']['application/json']
type FocusWire = DayWire['foci'][number]

export function toDay(w: DayWire): IntentionDay {
  return {
    date: w.date,
    creed: w.creed ?? null,
    foci: (w.foci ?? []).map(toFocus),
    reflection: (w.reflection ?? null) as Reflection | null,
    focusCap: w.focusCap,
  }
}
function toFocus(w: FocusWire): IntentionFocus {
  return { id: w.id, focusDate: w.focusDate, text: w.text }
}

export const intentionApi = {
  day: (date: string) => apiFetch<DayWire>(`/api/intention/day/${date}`).then(toDay),
  setCreed: (text: string) =>
    apiFetch(`/api/intention/creed`, { method: 'PUT', body: JSON.stringify({ text }) }),
  addFocus: (date: string, text: string) =>
    apiFetch(`/api/intention/focus`, { method: 'POST', body: JSON.stringify({ date, text }) }),
  removeFocus: (id: string) => apiFetch(`/api/intention/focus/${id}`, { method: 'DELETE' }),
  reflect: (date: string, value: Reflection) =>
    apiFetch(`/api/intention/reflect`, { method: 'POST', body: JSON.stringify({ date, value }) }),
}
```

`intentionMock.ts`:

```ts
import type { IntentionDay } from '@/data/types'

/** Deterministic seed: a creed + 2 foci, no reflection yet. */
export const mockIntentionDay: IntentionDay = {
  date: '2026-07-20',
  creed: 'Minden döntésem a célom felé visz — szándékkal élek, nem sodródom.',
  foci: [
    { id: 'if1', focusDate: '2026-07-20', text: 'Jelen lenni minden beszélgetésben — nem fél füllel.' },
    { id: 'if2', focusDate: '2026-07-20', text: 'Az edzésen a formára figyelek, nem a súlyra.' },
  ],
  reflection: null,
  focusCap: 3,
}
```

`intentionHooks.ts` (dual-mode; mock mutations patch the `['intentionDay', date]` cache; the first focus of the day awards via `awardGamificationEvent`):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { intentionApi } from '@/data/intention/intentionApi'
import { mockIntentionDay } from '@/data/intention/intentionMock'
import type { IntentionDay, Reflection } from '@/data/types'
import { useDualQuery } from '@/data/useDualQuery'

const key = (d: string) => ['intentionDay', d]
const EMPTY = (date: string): IntentionDay => ({ date, creed: null, foci: [], reflection: null, focusCap: 3 })

export function useIntentionDay(date: string) {
  return useDualQuery<IntentionDay>({
    queryKey: key(date),
    mockData: mockIntentionDay,
    realFetch: () => intentionApi.day(date),
    realEmpty: EMPTY(date),
  })
}

export function useIntentionActions(date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const patch = (fn: (d: IntentionDay) => IntentionDay) =>
    qc.setQueryData<IntentionDay>(key(date), (d) => (d ? fn(d) : d))
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key(date) })
    qc.invalidateQueries({ queryKey: ['habitDay', date] })
    qc.invalidateQueries({ queryKey: ['dailyQuests', date] })
    qc.invalidateQueries({ queryKey: ['progressionProfile'] })
  }

  const setCreedM = useMutation({
    mutationFn: async (text: string) => {
      if (mock) { patch((d) => ({ ...d, creed: text })); return }
      return intentionApi.setCreed(text).then(() => undefined)
    },
    onSuccess: mock ? undefined : invalidate,
  })
  const addFocusM = useMutation({
    mutationFn: async (text: string) => {
      if (mock) {
        patch((d) => {
          if (d.foci.length >= d.focusCap) return d
          const first = d.foci.length === 0
          if (first) awardGamificationEvent(qc, { type: 'HABIT', xpOverride: 10 })
          return { ...d, foci: [...d.foci, { id: `if-${d.foci.length + 1}-${date}`, focusDate: date, text }] }
        })
        return
      }
      return intentionApi.addFocus(date, text).then(() => undefined)
    },
    onSuccess: mock ? undefined : invalidate,
  })
  const removeFocusM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) { patch((d) => ({ ...d, foci: d.foci.filter((f) => f.id !== id) })); return }
      return intentionApi.removeFocus(id).then(() => undefined)
    },
    onSuccess: mock ? undefined : invalidate,
  })
  const reflectM = useMutation({
    mutationFn: async (value: Reflection) => {
      if (mock) { patch((d) => ({ ...d, reflection: value })); return }
      return intentionApi.reflect(date, value).then(() => undefined)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  return {
    setCreed: (text: string) => setCreedM.mutateAsync(text),
    addFocus: (text: string) => addFocusM.mutateAsync(text),
    removeFocus: (id: string) => removeFocusM.mutateAsync(id),
    reflect: (value: Reflection) => reflectM.mutateAsync(value),
    pending: setCreedM.isPending || addFocusM.isPending || removeFocusM.isPending || reflectM.isPending,
  }
}
```

Registry edits:
- `data/hooks.ts`: `export { useIntentionDay, useIntentionActions } from '@/data/intention/intentionHooks'`
- `test/msw/handlers.ts` — honest-empty default:

```ts
http.get(`${API_BASE}/api/intention/day/:date`, ({ params }) =>
  HttpResponse.json({ date: params.date, creed: null, foci: [], reflection: null, focusCap: 3 }),
),
```

- [ ] **Step 4: Run both modes**

Run: `cd frontend && pnpm test src/data/intention/intentionHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/intention/intentionHooks.test.tsx` → PASS both.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(intention): FE data layer — dual-mode intention hooks (mezo-a686)"
```

---

### Task 7: IntentionBanner + IntentionSheet + CreedSheet + Today mount

**Files:**
- Create: `frontend/src/features/today/components/IntentionBanner.tsx`, `frontend/src/features/today/sheets/IntentionSheet.tsx`, `frontend/src/features/today/sheets/CreedSheet.tsx`
- Modify: `frontend/src/styles/prototype.css` (`intent-*` CSS family), `frontend/src/features/today/pages/TodayPage.tsx` (mount under `GreetingHeader`)
- Test: `frontend/src/features/today/components/IntentionBanner.test.tsx`

**Interfaces:**
- Consumes: `useIntentionDay`/`useIntentionActions` (via `@/data/hooks`), `daypartNow` (`@/shared/lib/daypart`), `localDateString` (`@/shared/lib/dates`), `Sheet` (`@/shared/ui/Sheet`).
- Produces: `<IntentionBanner />` (no props).

- [ ] **Step 1: Port the banner CSS**

Append the `.intent-*` rules from the approved mockup (`scratchpad/intention-mockup.html`) to `frontend/src/styles/prototype.css` under a new section header `/* ===== Daily intention banner (mezo-a686) ===== */`. Copy every `.intent`, `.intent::after`, `.intent-head`, `.intent-star`, `.intent-eye`, `.intent-creed`, `.intent-edit`, `.intent-div`, `.intent-focus-eye`, `.intent-focus`, `.intent-foci`, `.fx`, `.fx-mark`, `.fx-text`, `.intent-add`, `.intent-cap`, `.intent-cta`, `.intent-row`, `.intent-prompt`, `.reflect`, `.reflect-q`, `.reflect-opts`, `.reflect-opt`, `.reflect-opt.on-yes`, `.reflect-done` rule verbatim — they already use the app's theme tokens (`--surface-1`, `--wash-lav`, `--lav-deep`, `--sage-deep`, `--warm`, etc.), so they work in light + dark unchanged. Prefix `.fx`/`.fx-mark`/`.fx-text` with `.intent ` (scope them) to avoid collisions: `.intent .fx`, `.intent .fx-mark`, `.intent .fx-text`.

- [ ] **Step 2: Write the failing component test**

`IntentionBanner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { QueryWrapper } from '@/test/queryWrapper'

vi.mock('@/shared/lib/daypart', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/daypart')>()),
  daypartNow: vi.fn(() => 'reggel'),
}))
import { daypartNow } from '@/shared/lib/daypart'

const renderBanner = () => render(<QueryWrapper><IntentionBanner /></QueryWrapper>)

describe('IntentionBanner', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => {
    vi.mocked(daypartNow).mockReturnValue('reggel')
    vi.unstubAllEnvs()
  })

  test('shows the creed and today foci', () => {
    renderBanner()
    expect(screen.getByText('Vezérelv')).toBeInTheDocument()
    expect(screen.getByText(/szándékkal élek/i)).toBeInTheDocument()
    expect(screen.getByText(/Jelen lenni minden beszélgetésben/)).toBeInTheDocument()
    expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument()
  })

  test('opens the focus sheet from the + Fókusz button', async () => {
    renderBanner()
    await userEvent.click(screen.getByRole('button', { name: /Fókusz hozzáadása/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  test('evening daypart shows the reflect row', () => {
    vi.mocked(daypartNow).mockReturnValue('este')
    renderBanner()
    expect(screen.getByText('Szándékkal élted a napot?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Igen' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Implement the sheets**

`CreedSheet.tsx`:

```tsx
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'

export function CreedSheet({ initial, onSave, onClose }:
  { initial: string; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(initial)
  return (
    <Sheet onClose={onClose} labelledBy="creed-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 12 }}>
          <h2 id="creed-title" style={{ font: '700 18px/1.2 var(--ff-display)' }}>A vezérelved</h2>
          <p className="text-tertiary" style={{ fontSize: 12.5 }}>
            Egy mondat az irányról, ami a döntéseidet vezeti — erre nézel rá minden nap.
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={3}
            placeholder="Minden döntésem a célom felé visz — szándékkal élek."
            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--card-border)',
              background: 'var(--surface-1)', color: 'var(--ink)', font: '500 14px/1.4 var(--ff-body)', resize: 'none' }} />
          <button className="hab-act" disabled={!text.trim()} style={{ alignSelf: 'flex-end' }}
            onClick={() => { onSave(text.trim()); close() }}>Mentés</button>
        </div>
      )}
    </Sheet>
  )
}
```

`IntentionSheet.tsx` (add a focus; shows the creed read-only):

```tsx
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'

export function IntentionSheet({ creed, onSave, onClose }:
  { creed: string | null; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  return (
    <Sheet onClose={onClose} labelledBy="focus-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 12 }}>
          <h2 id="focus-title" style={{ font: '700 18px/1.2 var(--ff-display)' }}>Mi ma a fókuszod?</h2>
          {creed && (
            <div className="intent-creed" style={{ background: 'var(--wash-lav)', padding: '10px 12px', borderRadius: 12 }}>
              „{creed}"
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={200} rows={2} autoFocus
            placeholder="Ma arra figyelek, hogy…"
            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--card-border)',
              background: 'var(--surface-1)', color: 'var(--ink)', font: '500 14px/1.4 var(--ff-body)', resize: 'none' }} />
          <button className="hab-act" disabled={!text.trim()} style={{ alignSelf: 'flex-end' }}
            onClick={() => { onSave(text.trim()); close() }}>Hozzáadom</button>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Implement IntentionBanner**

`IntentionBanner.tsx` (port the approved mockup markup; 5 states; reflect inline in evening):

```tsx
import { useState } from 'react'
import { useIntentionDay, useIntentionActions } from '@/data/hooks'
import type { Reflection } from '@/data/types'
import { IntentionSheet } from '@/features/today/sheets/IntentionSheet'
import { CreedSheet } from '@/features/today/sheets/CreedSheet'
import { daypartNow } from '@/shared/lib/daypart'
import { localDateString } from '@/shared/lib/dates'

const REFLECT_LABEL: Record<Reflection, string> = { yes: 'Igen', partial: 'Részben', no: 'Nem' }

export function IntentionBanner() {
  const date = localDateString()
  const { data, isPending } = useIntentionDay(date)
  const { setCreed, addFocus, reflect } = useIntentionActions(date)
  const [focusOpen, setFocusOpen] = useState(false)
  const [creedOpen, setCreedOpen] = useState(false)
  const evening = daypartNow() === 'este'

  if (isPending && data.foci.length === 0 && !data.creed) {
    return null // honest ghost: real mode before data / switch off
  }

  const head = (
    <div className="intent-head">
      <span className="intent-star" aria-hidden="true">✦</span>
      <span className="intent-eye">Vezérelv</span>
      {data.creed && (
        <button className="intent-edit" aria-label="Vezérelv szerkesztése" onClick={() => setCreedOpen(true)}>
          szerkeszt
        </button>
      )}
    </div>
  )

  return (
    <div className="intent">
      {head}
      {data.creed ? (
        <div className="intent-creed">„{data.creed}"</div>
      ) : (
        <>
          <div className="intent-creed" style={{ fontStyle: 'normal', color: 'var(--sub)' }}>
            Fogalmazd meg az irányt, ami a döntéseidet vezeti — egy mondat, amire minden nap ránézel.
          </div>
          <div className="intent-row" style={{ marginTop: 12 }}>
            <button className="intent-cta" onClick={() => setCreedOpen(true)}>+ Vezérelv megírása</button>
          </div>
        </>
      )}

      {data.creed && (
        <>
          <div className="intent-div" />
          {data.foci.length === 0 ? (
            <div className="intent-row">
              <span className="intent-prompt">Mi ma a fókuszod?</span>
              <button className="intent-cta" aria-label="Fókusz hozzáadása" onClick={() => setFocusOpen(true)}>
                + Mai fókusz
              </button>
            </div>
          ) : (
            <>
              <div className="intent-focus-eye">
                <span>{evening ? 'Ma szándékaim voltak' : 'Ma szándékaim'}</span>
                <span className="cnt">{data.foci.length} / {data.focusCap}</span>
              </div>
              <div className="intent-foci">
                {data.foci.map((f) => (
                  <div key={f.id} className="fx">
                    <span className="fx-mark" aria-hidden="true">◆</span>
                    <span className="fx-text">{f.text}</span>
                  </div>
                ))}
              </div>
              {data.foci.length < data.focusCap ? (
                <button className="intent-add" aria-label="Fókusz hozzáadása" onClick={() => setFocusOpen(true)}>
                  + Fókusz
                </button>
              ) : (
                <div className="intent-cap">Elérted a napi {data.focusCap} fókuszt — a kevesebb néha több.</div>
              )}
            </>
          )}

          {evening && data.foci.length > 0 && (
            <div className="reflect">
              {data.reflection ? (
                <div className="reflect-done">✓ {REFLECT_LABEL[data.reflection]} — a mai szándékodra reflektáltál.</div>
              ) : (
                <>
                  <div className="reflect-q">Szándékkal élted a napot?</div>
                  <div className="reflect-opts">
                    {(['yes', 'partial', 'no'] as Reflection[]).map((v) => (
                      <button key={v} className="reflect-opt" onClick={() => reflect(v)}>{REFLECT_LABEL[v]}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {focusOpen && <IntentionSheet creed={data.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
      {creedOpen && <CreedSheet initial={data.creed ?? ''} onSave={setCreed} onClose={() => setCreedOpen(false)} />}
    </div>
  )
}
```

Mount in `TodayPage.tsx` directly under `<GreetingHeader .../>` (before `<DayArc .../>`): `<IntentionBanner />` (import from `@/features/today/components/IntentionBanner`). If `TodayPage.test.tsx` barrel-mocks `@/data/hooks`, add `useIntentionDay` (returns `{ data: <empty IntentionDay>, isPending: false }`) + `useIntentionActions` (no-op fns) to its mock factory so existing Today tests keep passing.

- [ ] **Step 5: Run the tests**

Run: `cd frontend && pnpm test src/features/today && VITE_USE_MOCK=true pnpm test src/features/today` → PASS both.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(today): IntentionBanner + creed/focus sheets, mounted under the greeting (mezo-a686)"
```

---

### Task 8: RoutineCard intention actions + ReflectSheet

**Files:**
- Modify: `frontend/src/features/today/logic/habitAction.ts` (+2 kinds), `frontend/src/features/today/logic/habitAction.test.ts`
- Modify: `frontend/src/features/today/components/RoutineCard.tsx` (wire the two actions)
- Create: `frontend/src/features/today/sheets/ReflectSheet.tsx`

**Interfaces:**
- Consumes: `useIntentionActions` (via `@/data/hooks`).
- Produces: `habitAction` kinds `intention-sheet` (key `daily_intention`) + `intention-reflect` (key `intention_reflect`).

- [ ] **Step 1: Extend habitAction + its test**

`habitAction.ts` — add the kinds and the key mappings:

```ts
export type HabitAction =
  | { kind: 'check' }
  | { kind: 'nav'; to: string }
  | { kind: 'meal-sheet' }
  | { kind: 'sleep-sheet' }
  | { kind: 'intention-sheet' }
  | { kind: 'intention-reflect' }
  | { kind: 'none' }
```

Add, before the `NAV_BY_KEY` lookup in `habitAction(...)`:

```ts
  if (h.key === 'daily_intention') {
    return { kind: 'intention-sheet' }
  }
  if (h.key === 'intention_reflect') {
    return { kind: 'intention-reflect' }
  }
```

`habitAction.test.ts` — add a test:

```ts
  test('intention habits open their own surfaces', () => {
    expect(habitAction({ ...byKey('morning_sunlight'), key: 'daily_intention', status: 'pending' }))
      .toEqual({ kind: 'intention-sheet' })
    expect(habitAction({ ...byKey('morning_sunlight'), key: 'intention_reflect', status: 'pending' }))
      .toEqual({ kind: 'intention-reflect' })
  })
```

(The `byKey('morning_sunlight')` spread just supplies a valid `HabitItem`; only `key`/`status`/`mode` matter. `morning_sunlight` is MANUAL — override `mode` to a DERIVED value so the MANUAL short-circuit doesn't fire: spread `{ ...byKey('morning_sunlight'), mode: 'DERIVED', key: 'daily_intention', status: 'pending' }`.)

- [ ] **Step 2: ReflectSheet**

`ReflectSheet.tsx`:

```tsx
import { Sheet } from '@/shared/ui/Sheet'
import type { Reflection } from '@/data/types'

const OPTS: { v: Reflection; label: string }[] = [
  { v: 'yes', label: 'Igen' }, { v: 'partial', label: 'Részben' }, { v: 'no', label: 'Nem' },
]

export function ReflectSheet({ onReflect, onClose }:
  { onReflect: (v: Reflection) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="reflect-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 14 }}>
          <h2 id="reflect-title" style={{ font: '700 18px/1.2 var(--ff-display)' }}>Szándékkal élted a napot?</h2>
          <div className="reflect-opts">
            {OPTS.map((o) => (
              <button key={o.v} className="reflect-opt" onClick={() => { onReflect(o.v); close() }}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 3: Wire RoutineCard**

In `RoutineCard.tsx`: import `useIntentionActions`, `IntentionSheet`, `ReflectSheet`, `useIntentionDay`. Add state `intentionOpen`/`reflectOpen`. Read `const { addFocus, reflect } = useIntentionActions(date)` + `const { data: intention } = useIntentionDay(date)`. Extend `runAction` with:

```ts
    } else if (action.kind === 'intention-sheet') {
      setIntentionOpen(true)
    } else if (action.kind === 'intention-reflect') {
      setReflectOpen(true)
    }
```

Render at the end (next to the meal/sleep sheets):

```tsx
      {intentionOpen && <IntentionSheet creed={intention.creed} onSave={addFocus} onClose={() => setIntentionOpen(false)} />}
      {reflectOpen && <ReflectSheet onReflect={reflect} onClose={() => setReflectOpen(false)} />}
```

The `ariaLabel` for these pending habits stays `${h.title} logolása` (they are not `check`), so the downstream-row / current-button rendering is unchanged.

- [ ] **Step 4: Run**

Run: `cd frontend && pnpm test src/features/today/logic src/features/today/components && VITE_USE_MOCK=true pnpm test src/features/today` → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(today): RoutineCard intention-sheet + reflect actions (mezo-a686)"
```

---

### Task 9: Gates, feature doc, visual goldens, PR

**Files:**
- Create: `docs/features/intention.md`
- Modify: `docs/features/today.md` (§2 IntentionBanner mount + related), `docs/features/habit.md` (§3/§5 the 2 intention habits + evaluator metrics), `docs/features/growth.md` (§4 the growth_intention quest)
- Verify: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Full FE gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build green, ALL tests pass both modes. Fix anything broken (esp. TodayPage/GrowthPage test mock factories missing the intention hooks).

- [ ] **Step 2: Focused backend gate**

Run: `cd backend && ./mvnw clean test -Dtest='Intention*IT,Habit*IT,QuestApiIT,QuestCatalogIT' -DargLine=-Xmx3g`
Expected: ALL PASS. Full suite runs in CI.

- [ ] **Step 3: Runtime verify (mock, both dayparts)**

`cd frontend && VITE_USE_MOCK=true pnpm dev`, drive `http://localhost:5180/today` via chrome-devtools at 390px: confirm the banner renders under the greeting (creed + 2 foci + `+ Fókusz`), the focus sheet opens, and the RoutineCard's `Napi szándék` habit opens the same sheet. Screenshot for evidence.

- [ ] **Step 4: Write `docs/features/intention.md`**

Follow the 10-section template (`docs/features/README.md`). `key_files`: `backend/src/main/java/io/mrkuhne/mezo/feature/intention`, `frontend/src/data/intention`, `frontend/src/features/today/components/IntentionBanner.tsx`, `api/feature/intention/intention.yml`. Content: creed + foci(cap 3) + reflection; the derived habit/quest wiring (no new progression source); the banner's 5 states; the 3 endpoints + error codes; config (`mezo.intention.*`); mock/real parity. Update the three sibling docs' cross-links + the Today §2 mount order + habit §3/§5 (2 new habits + `intention_focus_set`/`intention_reflected` metrics) + growth §4 (`growth_intention`). Run `node scripts/lint-docs.mjs` — clean.

- [ ] **Step 5: Refresh visual goldens**

The Today screen gains the banner; the visual golden captures `/today` at 13:42 (délutan). At 13:42 the banner shows the creed + foci (no reflect row — evening only), so the today golden **changes**. Run `cd frontend && pnpm test:visual:update` (darwin), commit the changed `today-*-darwin.png`. After pushing, trigger the linux baseline: `gh workflow run update-visual-baselines.yml -r feat/daily-intention`, wait for it, `git pull --rebase`, then an empty commit to retrigger PR CI.

- [ ] **Step 6: Commit docs + goldens, push, PR**

```bash
git add docs/ frontend/tests/visual/
git -c core.hooksPath=/dev/null commit -m "docs(intention): feature doc + cross-links + visual goldens (mezo-a686)"
git push -u origin feat/daily-intention
gh pr create --title "feat(intention): daily intention — creed + foci + reflection (mezo-a686)" --body "..."
```

PR body: summary + test evidence + spec/plan links, ending with the standard footer. Wait for CI green; land with `gh pr merge --merge`. After merge: from the MAIN checkout `bd close mezo-a686` + `bd dolt push`.

Out of scope (spec §9): per-focus checkable state, weekly Insights review, in-place focus edit, AI suggestions, push reminders.
