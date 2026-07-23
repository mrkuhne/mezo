# Fuel Slot-Timing + fuel_settings + Slot-Level AI Implementation Plan (mezo-53su)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Mai timeline becomes a living plan — pending windows re-flow around reality, the demo follows the anchor, `mealsPerDay` + the caffeine cutoff move into a Fuel-owned `fuel_settings` singleton, slots gain identity, and every open meal slot can launch AI logging pre-targeted.

**Architecture:** Third per-user singleton (`intention_creed`/`sleep_goal` shape) in the EXISTING `feature/fuel` backend package; the habit engine's caffeine metric repoints onto an ungated fuel-owned `CaffeineCutoffPort` (the `SleepAnchorPort` pattern verbatim). FE: `buildDayPlan` gains slot identity + now-aware re-flow; the mock timeline branch is deleted so `buildDayPlan` runs in both modes (fixed mock "now"); a new `FuelSettingsSheet` edits the settings from Mai.

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / openapi-generator; React 19 + TanStack Query + MSW/Vitest + Playwright visual goldens.

**Spec:** `docs/superpowers/specs/2026-07-23-fuel-slot-timing-design.md` (D1–D8, approved 2026-07-23). Driving bd: `mezo-53su`. Branch: `feat/fuel-slot-timing` (off main; sleep slices A+B landed).

## Global Constraints

- Worktree: run everything from `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-2`, branch `feat/fuel-slot-timing`. Commit with `git -c core.hooksPath=/dev/null commit ...`; subjects end with `(mezo-53su)`.
- Backend tests: ALWAYS `./mvnw clean test`, focused `-Dtest=...`, `-DargLine=-Xmx3g`; compose Postgres :15432 up; NEVER the full suite locally (CI is the gate).
- Frontend gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- Contract-first; new fragment `api/feature/fuel-settings/fuel-settings.yml` MUST be registered in `api/generate/merge.yml`; own tag `FuelSettings` → generated `FuelSettingsApi` (a `Fuel`-tagged op would force methods into the ungated `FuelController` — same `useTags=true` reasoning as the sleep slices).
- Exact values: `meals_per_day` bounds **3..6**; caffeine cutoff HH:mm regex `'^([01]\d|2[0-3]):[0-5]\d$'`; ghost defaults **4** / **"14:00"** (from `FuelSettingsProperties`, prefix `mezo.fuel-settings`); flag `mezo.feature.fuel-settings.enabled` (+ `FeaturesConfiguration.FUEL_SETTINGS_SWITCH`). GET never 404s.
- The habit caffeine metric is **`no_stim_after`** (`HabitEvaluator.java:89-90` — the ONLY consumer of `HabitProperties.caffeineCutoff()`); the habit CATALOG key is `caffeine_cutoff` — do not confuse them. After the repoint, `HabitProperties` drops `caffeineCutoff` and `application.yml` drops `mezo.habit.caffeine-cutoff` (dead config forbidden). The ghost cutoff equals the old config ("14:00") so existing caffeine ITs stay green unmodified.
- `CaffeineCutoffPort` + resolver are UNGATED (habit-on + fuel-settings-off must boot); only `FuelSettingsService`/`FuelSettingsController` carry `@ConditionalOnProperty(FUEL_SETTINGS_SWITCH)`.
- FE: hooks via the `data/hooks.ts` barrel; deep `@/` imports; no `../`; dual-mode honesty (`useDualQuery`, `realEmpty` = ghost, never the mock seed); assertions in migrated tests re-sourced, never weakened.
- Re-flow semantics (D4, exact): pending MEAL windows re-space evenly on `[floor, kitchenClose]` where `floor = max(eatingStart, now, lastLoggedMealMin + MIN_SLOT_GAP_MIN)` (`lastLoggedMealMin` = latest logged meal's wall-clock minute, 0 if none); order preserved; post/pre-workout snaps re-applied for FUTURE blocks only (block start ≥ now); 90-min min-gap forward-push; clamp at kitchenClose (floor ≥ kitchenClose → all pending stack at kitchenClose). Done/block/protocol slots untouched. Deterministic — `nowHHmm` stays an injected input.
- Mock-mode `nowHHmm` is FIXED at **"13:30"** (D6 determinism); real mode keeps the wall clock.
- Visual goldens: fuel/today surfaces are expected to change (D6 accepted) — refresh darwin locally + linux via the `update-visual-baselines.yml` workflow, exactly like the habit-engine slice did.

## File Structure (created/modified)

```
api/feature/fuel-settings/fuel-settings.yml                CREATE  GET/PUT /api/fuel/settings
api/generate/merge.yml                                     MODIFY  register fragment
api/openapi.yml + frontend/src/data/_client/api.gen.ts     REGEN   committed

backend/.../db/changelog/1.0.0/script/{ts}_mezo-53su_create_fuel_settings.sql  CREATE (+master.yml)
backend/.../feature/fuel/entity/FuelSettingsEntity.java                        CREATE
backend/.../feature/fuel/repository/FuelSettingsRepository.java                CREATE
backend/.../feature/fuel/config/FuelSettingsProperties.java                    CREATE
backend/.../feature/fuel/service/FuelSettingsService.java                      CREATE  gated
backend/.../feature/fuel/service/CaffeineCutoffPort.java                       CREATE  interface
backend/.../feature/fuel/service/CaffeineCutoffResolver.java                   CREATE  UNGATED
backend/.../feature/fuel/controller/FuelSettingsController.java                CREATE  gated, implements FuelSettingsApi
backend/.../feature/habit/service/HabitEvaluator.java                          MODIFY  no_stim_after reads the port
backend/.../feature/habit/config/HabitProperties.java                          MODIFY  -caffeineCutoff
backend/.../techcore/configuration/FeaturesConfiguration.java                  MODIFY  +FUEL_SETTINGS_SWITCH
backend/src/main/resources/application.yml                                     MODIFY  +flag +mezo.fuel-settings; -habit caffeine-cutoff
backend/src/test/.../support/{ResetDatabase,AbstractIntegrationTest}.java      MODIFY  +fuel_settings +populator
backend/src/test/.../support/populator/FuelSettingsPopulator.java              CREATE
backend/src/test/.../feature/fuel/FuelSettingsApiIT.java                       CREATE
backend/src/test/.../feature/fuel/FuelSettingsSwitchOffApiIT.java              CREATE
backend/src/test/.../feature/habit/HabitEvaluatorIT.java                       MODIFY  +seeded-cutoff test

frontend/src/data/types.ts                                 MODIFY  +FuelSettings; FuelSlot +slotKey?
frontend/src/data/fuel/fuelSettingsApi.ts                  CREATE
frontend/src/data/fuel/fuelSettingsHooks.ts                CREATE  + fuelSettingsHooks.test.tsx
frontend/src/data/hooks.ts                                 MODIFY  barrel
frontend/src/test/msw/handlers.ts                          MODIFY  +GET/PUT /api/fuel/settings
frontend/src/features/fuel/logic/buildDayPlan.ts           MODIFY  slotKey out + re-flow + caffeineCutoff in (+tests)
frontend/src/data/fuel/fuelConfig.ts                       MODIFY  -PLANNER_DEFAULTS -CAFFEINE_CUTOFF -slotKeyOfLabel
frontend/src/data/fuel/timelineHooks.ts                    MODIFY  unified both-modes build; settings-sourced
frontend/src/data/fuel/fuel.ts                             MODIFY  fuelPlan.today seed retired
frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx    CREATE  + test
frontend/src/features/me/sheets/EditGoalSheet.tsx          MODIFY  -Napi ritmus section (+test)
frontend/src/features/fuel/components/SlotCard.tsx         MODIFY  +AI chip (+test)
frontend/src/features/fuel/sheets/AiLogSheet.tsx           MODIFY  slot-lock (+test)
frontend/src/features/fuel/pages/FuelMaiPage.tsx           MODIFY  settings chip + AI wiring (+test)
frontend/tests (mock-plan consumers)                       MODIFY  timelineHooks/FuelTimeline/TodayPage/conditionalCards/todayHooks/PredictionsPage tests re-sourced
docs/features/fuel.md, habit.md, me.md, _platform-api-backend.md, _platform-data-layer.md  MODIFY
docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md                           MODIFY  status (incl. slice B PR #48 = merged fix)
```

---

### Task 1: API contract — fuel-settings fragment + regen

**Files:**
- Create: `api/feature/fuel-settings/fuel-settings.yml`
- Modify: `api/generate/merge.yml` (append after the sleep-shot line)
- Regen+commit: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (backend, at build): `io.mrkuhne.mezo.api.controller.FuelSettingsApi` with `FuelSettingsResponse getFuelSettings()` and `FuelSettingsResponse setFuelSettings(SetFuelSettingsRequest)`; `api.dto.FuelSettingsResponse`/`SetFuelSettingsRequest` (Lombok builders; `mealsPerDay: Integer`, `caffeineCutoff: String`, both required both ways).
- Produces (frontend): `components['schemas']['FuelSettingsResponse' | 'SetFuelSettingsRequest']`.

- [ ] **Step 1: Write the fragment** (complete file):

```yaml
openapi: 3.0.3
info: { title: mezo fuel-settings fragment, version: 1.0.0 }
tags:
  - name: FuelSettings
    description: Fuel-owned per-user planner settings (eating cadence + caffeine cutoff)
paths:
  /api/fuel/settings:
    get:
      tags: [FuelSettings]
      operationId: getFuelSettings
      summary: The fuel settings; config-default ghost when unset — never 404 (FuelSettings)
      responses:
        '200':
          description: The settings (ghost 4 / 14:00 before the first save)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/FuelSettingsResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    put:
      tags: [FuelSettings]
      operationId: setFuelSettings
      summary: Upsert the fuel settings (per-user singleton) (FuelSettings)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SetFuelSettingsRequest' }
      responses:
        '200':
          description: Saved settings
          content:
            application/json:
              schema: { $ref: '#/components/schemas/FuelSettingsResponse' }
        '400':
          description: Validation failure
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
    FuelSettingsResponse:
      type: object
      required: [mealsPerDay, caffeineCutoff]
      properties:
        mealsPerDay:
          type: integer
          minimum: 3
          maximum: 6
          description: Eating occasions per day — drives the planner's meal windows
        caffeineCutoff:
          type: string
          pattern: '^([01]\d|2[0-3]):[0-5]\d$'
          description: Last caffeine time, HH:mm — the Mai chip, day plan and habit metric all read this
    SetFuelSettingsRequest:
      type: object
      required: [mealsPerDay, caffeineCutoff]
      properties:
        mealsPerDay: { type: integer, minimum: 3, maximum: 6 }
        caffeineCutoff: { type: string, pattern: '^([01]\d|2[0-3]):[0-5]\d$' }
```

- [ ] **Step 2: Register.** In `api/generate/merge.yml`, append after the sleep-shot input line:

```yaml
  - inputFile: ../feature/fuel-settings/fuel-settings.yml
```

- [ ] **Step 3: Regen + sanity**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && grep -c "FuelSettingsResponse" ../api/openapi.yml src/data/_client/api.gen.ts && pnpm build`
Expected: greps ≥ 1 each; build PASS.

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): fuel-settings contract (mezo-53su)"
```

---

### Task 2: Backend schema + entity + config plumbing

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/{YYYYMMDDHHMM}_mezo-53su_create_fuel_settings.sql` (UTC timestamp via `date -u +%Y%m%d%H%M` at authoring; changeset appended to `1.0.0/1.0.0_master.yml` with id `"1.0.0:{ts}_mezo-53su_create_fuel_settings"`, author `daniel.kuhne`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/entity/FuelSettingsEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/repository/FuelSettingsRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/config/FuelSettingsProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`, `backend/src/main/resources/application.yml`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/FuelSettingsPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (+`fuel_settings` in the TRUNCATE list), `AbstractIntegrationTest.java` (+`FuelSettingsPopulator.class` in `@Import`)

**Interfaces:**
- Produces: `FuelSettingsEntity` (`getMealsPerDay(): Integer`, `getCaffeineCutoff(): String` + `OwnedEntity`); `FuelSettingsRepository.findByCreatedByAndDeletedFalse(UUID): Optional<FuelSettingsEntity>`; `FuelSettingsPopulator.settings(UUID owner, int mealsPerDay, String caffeineCutoff): FuelSettingsEntity` + `settings(UUID owner)` (4, "14:00"); `FuelSettingsProperties(int defaultMealsPerDay, String defaultCaffeineCutoff)`; `FUEL_SETTINGS_SWITCH`.

- [ ] **Step 1: Migration SQL** (complete file; replace `{ts}` consistently):

```sql
-- Fuel planner settings (bd mezo-53su, spec docs/superpowers/specs/2026-07-23-fuel-slot-timing-design.md).
-- Per-user singleton (intention_creed shape): eating cadence + caffeine cutoff move off the weight
-- goal / habit config into a Fuel-owned home. goal.meals_per_day stays on the wire, unread
-- (dropped later together with the retired wake/bed columns).

create table fuel_settings (
    id              uuid        not null default gen_random_uuid(),
    created_by      uuid        not null,
    is_deleted      boolean     not null default false,
    created_at      timestamptz not null default now(),
    meals_per_day   integer     not null,
    caffeine_cutoff varchar(5)  not null,
    constraint pk_fuel_settings_id primary key (id),
    constraint fk_fuel_settings_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_fuel_settings_meals_per_day check (meals_per_day between 3 and 6)
);
create unique index uq_fuel_settings_user on fuel_settings (created_by) where is_deleted = false;
```

- [ ] **Step 2: Entity** (complete file):

```java
package io.mrkuhne.mezo.feature.fuel.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** Fuel planner settings — one live row per owner (partial-unique on created_by, intention_creed shape). */
@Getter
@Setter
@Entity
@Table(name = "fuel_settings")
@SQLDelete(sql = "update fuel_settings set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class FuelSettingsEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Min(3)
    @Max(6)
    @Column(name = "meals_per_day", nullable = false)
    private Integer mealsPerDay;

    @NotNull
    @Column(name = "caffeine_cutoff", nullable = false, length = 5)
    private String caffeineCutoff;
}
```

- [ ] **Step 3: Repository** (complete file):

```java
package io.mrkuhne.mezo.feature.fuel.repository;

import io.mrkuhne.mezo.feature.fuel.entity.FuelSettingsEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton config row (no 'date' base field) => extend JpaRepository directly, not OwnedRepository.
public interface FuelSettingsRepository extends JpaRepository<FuelSettingsEntity, UUID> {

    Optional<FuelSettingsEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
```

- [ ] **Step 4: Properties + switch + yml.** `FuelSettingsProperties.java` (complete file):

```java
package io.mrkuhne.mezo.feature.fuel.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Fuel-settings ghost defaults (mezo.fuel-settings) — served before the user saves (never 404). */
@Validated
@ConfigurationProperties(prefix = "mezo.fuel-settings")
public record FuelSettingsProperties(

    /** Eating occasions per day before the user saves a setting. */
    @Min(3) @Max(6)
    int defaultMealsPerDay,

    /** Caffeine cutoff ghost, HH:mm — equals the old mezo.habit.caffeine-cutoff so behavior is unchanged. */
    @NotBlank
    String defaultCaffeineCutoff
) {}
```

`FeaturesConfiguration.java` — after `SLEEP_SHOT_SWITCH`:

```java
    /** Fuel planner settings (mezo-53su) — eating cadence + caffeine cutoff singleton. Gates /api/fuel/settings (the caffeine resolver stays on). */
    public static final String FUEL_SETTINGS_SWITCH = "mezo.feature.fuel-settings.enabled";
```

`application.yml` — under `mezo.feature:` after `sleep-shot:`:

```yaml
    # Fuel planner settings (mezo-53su): eating cadence + caffeine cutoff singleton.
    fuel-settings:
      enabled: true
```

New value block (after `mezo.sleep-shot:`):

```yaml
  # Fuel-settings ghost defaults (mezo-53su). Binds onto FuelSettingsProperties.
  fuel-settings:
    default-meals-per-day: 4
    default-caffeine-cutoff: "14:00"
```

- [ ] **Step 5: Populator** (complete file):

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.fuel.entity.FuelSettingsEntity;
import io.mrkuhne.mezo.feature.fuel.repository.FuelSettingsRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class FuelSettingsPopulator {

    private final FuelSettingsRepository fuelSettingsRepository;

    /** Any valid settings row — the ghost values. */
    public FuelSettingsEntity settings(UUID owner) {
        return settings(owner, 4, "14:00");
    }

    public FuelSettingsEntity settings(UUID owner, int mealsPerDay, String caffeineCutoff) {
        FuelSettingsEntity e = new FuelSettingsEntity();
        e.setCreatedBy(owner);
        e.setMealsPerDay(mealsPerDay);
        e.setCaffeineCutoff(caffeineCutoff);
        return fuelSettingsRepository.saveAndFlush(e);
    }
}
```

- [ ] **Step 6: Test plumbing.** `ResetDatabase`: add `fuel_settings, ` to the TRUNCATE string (next to `sleep_goal`). `AbstractIntegrationTest`: add `FuelSettingsPopulator.class,` to the `@Import` list.
- [ ] **Step 7: Lint + schema-verify:** `node scripts/lint-liquibase.mjs` → PASS; `cd backend && docker compose up -d && ./mvnw clean test -Dtest=FuelSettingsApiIT -DargLine=-Xmx3g` → EXPECTED COMPILE FAILURE (IT not written yet — Task 3); instead run `./mvnw clean test -Dtest=SleepGoalApiIT -DargLine=-Xmx3g` → PASS (migration applies, entity validates, context boots with the new properties).
- [ ] **Step 8: Commit**

```bash
git add backend/src api/ 2>/dev/null; git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): fuel_settings table + entity + config plumbing (mezo-53su)"
```

---

### Task 3: `FuelSettingsService` + controller + ITs (TDD)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/FuelSettingsService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/controller/FuelSettingsController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/FuelSettingsApiIT.java`, `FuelSettingsSwitchOffApiIT.java`

**Interfaces:**
- Consumes: Task 1's generated `FuelSettingsApi` + DTOs; Task 2's repository/properties/populator/switch.
- Produces: `FuelSettingsService.getSettings(UUID): FuelSettingsResponse`, `setSettings(UUID, SetFuelSettingsRequest): FuelSettingsResponse` — Task 4's resolver shares the repository, not this service.

- [ ] **Step 1: Failing ITs.** `FuelSettingsApiIT.java` (complete file):

```java
package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetFuelSettingsRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the generated {@code FuelSettingsApi} contract. */
class FuelSettingsApiIT extends ApiIntegrationTest {

    @Test
    void testGetFuelSettings_shouldReturnConfigDefaultGhost_whenNoneSet() {
        FuelSettingsResponse s =
            getForBody("/api/fuel/settings", ownerAuthHeaders(), HttpStatus.OK, FuelSettingsResponse.class);

        assertThat(s.getMealsPerDay()).isEqualTo(4);
        assertThat(s.getCaffeineCutoff()).isEqualTo("14:00");
    }

    @Test
    void testSetFuelSettings_shouldUpsertSingleRow_whenSavedTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/fuel/settings",
            SetFuelSettingsRequest.builder().mealsPerDay(5).caffeineCutoff("13:00").build(),
            auth, HttpStatus.OK, FuelSettingsResponse.class);
        FuelSettingsResponse second = putForBody("/api/fuel/settings",
            SetFuelSettingsRequest.builder().mealsPerDay(3).caffeineCutoff("15:30").build(),
            auth, HttpStatus.OK, FuelSettingsResponse.class);

        assertThat(second.getMealsPerDay()).isEqualTo(3);

        FuelSettingsResponse read =
            getForBody("/api/fuel/settings", auth, HttpStatus.OK, FuelSettingsResponse.class);
        assertThat(read.getMealsPerDay()).isEqualTo(3);
        assertThat(read.getCaffeineCutoff()).isEqualTo("15:30");
    }

    @Test
    void testSetFuelSettings_shouldReturn400FieldErrors_whenInvalid() {
        SetFuelSettingsRequest bad = SetFuelSettingsRequest.builder()
            .mealsPerDay(7).caffeineCutoff("25:99").build();

        String body = putForBody("/api/fuel/settings", bad, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "mealsPerDay", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(body, "caffeineCutoff", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testFuelSettingsEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/fuel/settings", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
```

`FuelSettingsSwitchOffApiIT.java` (complete file):

```java
package io.mrkuhne.mezo.feature.fuel;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the fuel-settings switch OFF, the @ConditionalOnProperty controller is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.fuel-settings.enabled=false")
class FuelSettingsSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testGetFuelSettings_shouldReturn404_whenFuelSettingsSwitchOff() {
        getForBody("/api/fuel/settings", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
```

- [ ] **Step 2: RED:** `cd backend && ./mvnw clean test -Dtest='FuelSettings*IT' -DargLine=-Xmx3g` → COMPILE FAILURE (service/controller missing).
- [ ] **Step 3: Service** (complete file):

```java
package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.api.dto.FuelSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetFuelSettingsRequest;
import io.mrkuhne.mezo.feature.fuel.config.FuelSettingsProperties;
import io.mrkuhne.mezo.feature.fuel.entity.FuelSettingsEntity;
import io.mrkuhne.mezo.feature.fuel.repository.FuelSettingsRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.FUEL_SETTINGS_SWITCH, havingValue = "true")
public class FuelSettingsService {

    private final FuelSettingsRepository repository;
    private final FuelSettingsProperties properties;

    /** Config-default ghost when unset — never 404: every user has working planner settings. */
    public FuelSettingsResponse getSettings(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(e -> compose(e.getMealsPerDay(), e.getCaffeineCutoff()))
            .orElseGet(() -> compose(properties.defaultMealsPerDay(), properties.defaultCaffeineCutoff()));
    }

    @Transactional
    public FuelSettingsResponse setSettings(UUID userId, SetFuelSettingsRequest req) {
        FuelSettingsEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                FuelSettingsEntity e = new FuelSettingsEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        row.setMealsPerDay(req.getMealsPerDay());
        row.setCaffeineCutoff(req.getCaffeineCutoff());
        repository.save(row);
        return compose(row.getMealsPerDay(), row.getCaffeineCutoff());
    }

    private static FuelSettingsResponse compose(int mealsPerDay, String caffeineCutoff) {
        return FuelSettingsResponse.builder()
            .mealsPerDay(mealsPerDay)
            .caffeineCutoff(caffeineCutoff)
            .build();
    }
}
```

- [ ] **Step 4: Controller** (complete file; mirror `FuelController`'s `CurrentUserId` import):

```java
package io.mrkuhne.mezo.feature.fuel.controller;

import io.mrkuhne.mezo.api.controller.FuelSettingsApi;
import io.mrkuhne.mezo.api.dto.FuelSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetFuelSettingsRequest;
import io.mrkuhne.mezo.feature.fuel.service.FuelSettingsService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/fuel/settings surface (mezo-53su) — mappings come from the generated {@link FuelSettingsApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.FUEL_SETTINGS_SWITCH, havingValue = "true")
public class FuelSettingsController implements FuelSettingsApi {

    private final FuelSettingsService service;
    private final CurrentUserId currentUserId;

    @Override
    public FuelSettingsResponse getFuelSettings() {
        return service.getSettings(currentUserId.get());
    }

    @Override
    public FuelSettingsResponse setFuelSettings(SetFuelSettingsRequest setFuelSettingsRequest) {
        return service.setSettings(currentUserId.get(), setFuelSettingsRequest);
    }
}
```

- [ ] **Step 5: GREEN:** `./mvnw clean test -Dtest='FuelSettings*IT' -DargLine=-Xmx3g` → 5/5 PASS.
- [ ] **Step 6: Commit**

```bash
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): fuel settings service + /api/fuel/settings (mezo-53su)"
```

---

### Task 4: `CaffeineCutoffPort` + habit repoint + config trim (TDD)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/CaffeineCutoffPort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/CaffeineCutoffResolver.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java` (line ~89-90 + injection)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/config/HabitProperties.java` (drop `caffeineCutoff`)
- Modify: `backend/src/main/resources/application.yml` (drop `mezo.habit.caffeine-cutoff`)
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitEvaluatorIT.java`

**Interfaces:**
- Consumes: Task 2's `FuelSettingsRepository`, `FuelSettingsProperties`, `FuelSettingsPopulator`.
- Produces: `CaffeineCutoffPort.resolve(UUID userId): LocalTime` — always resolves (ghost when unset).

- [ ] **Step 1: Failing IT.** Add to `HabitEvaluatorIT.java` (mirror the file's existing `owner()`/populator idioms; the two existing caffeine tests at lines ~121-134 stay UNTOUCHED — the ghost equals the old config so they remain green):

```java
    @Test
    void testSatisfied_shouldUseFuelSettingsCutoff_whenRowExists() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        fuelSettingsPopulator.settings(owner, 4, "17:00"); // personal cutoff later than the ghost
        var stim = pantryItemPopulator.createStim(owner, "Origin pre-workout");
        supplementIntakePopulator.createIntake(owner, stim.getId(), at(d, "16:00"));

        // 16:00 intake is BEFORE the personal 17:00 cutoff -> satisfied (would fail on the 14:00 ghost).
        assertThat(evaluator.satisfied("no_stim_after", owner, d)).isTrue();
    }
```

(add `@Autowired private FuelSettingsPopulator fuelSettingsPopulator;` to the class fields.)

- [ ] **Step 2: RED:** `cd backend && ./mvnw clean test -Dtest=HabitEvaluatorIT -DargLine=-Xmx3g` → the new test FAILS (evaluator still reads the 14:00 config; 16:00 > 14:00 → false).
- [ ] **Step 3: Port + resolver** (complete files):

```java
package io.mrkuhne.mezo.feature.fuel.service;

import java.time.LocalTime;
import java.util.UUID;

/** Read seam for the user's caffeine cutoff — habit/planner consumers depend on this, never on the row. */
public interface CaffeineCutoffPort {

    /** Resolves the cutoff; config-default ghost when no settings row exists (never empty). */
    LocalTime resolve(UUID userId);
}
```

```java
package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.feature.fuel.config.FuelSettingsProperties;
import io.mrkuhne.mezo.feature.fuel.repository.FuelSettingsRepository;
import java.time.LocalTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The single caffeine-cutoff source (spec D3). Deliberately NOT gated on the fuel-settings switch:
 * the habit engine's no_stim_after metric must resolve even when /api/fuel/settings is off.
 */
@Component
@RequiredArgsConstructor
public class CaffeineCutoffResolver implements CaffeineCutoffPort {

    private final FuelSettingsRepository repository;
    private final FuelSettingsProperties properties;

    @Override
    public LocalTime resolve(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(e -> LocalTime.parse(e.getCaffeineCutoff()))
            .orElseGet(() -> LocalTime.parse(properties.defaultCaffeineCutoff()));
    }
}
```

- [ ] **Step 4: Repoint the metric.** In `HabitEvaluator.java`: add `private final CaffeineCutoffPort caffeineCutoffPort;` (import `io.mrkuhne.mezo.feature.fuel.service.CaffeineCutoffPort`) and change the case to:

```java
            case "no_stim_after" -> stimIntakes(userId, date).stream()
                .noneMatch(t -> t.isAfter(caffeineCutoffPort.resolve(userId)));
```

- [ ] **Step 5: Config trim.** `HabitProperties.java`: remove the `@NotBlank String caffeineCutoff,` component. `application.yml`: remove the `caffeine-cutoff: "14:00"` line under `mezo.habit:`. Verify: `grep -rn "caffeineCutoff\|caffeine-cutoff" backend/src | grep -v target | grep -v fuel` → only the habit CATALOG key `caffeine_cutoff` (json + tests referencing the catalog key) may remain — list every hit in the report with a one-line justification. If an ArchUnit rule enumerates allowed feature edges, add habit→fuel (check `feature_slices_are_cycle_free` — habit→sleep already exists as precedent).
- [ ] **Step 6: GREEN:** `./mvnw clean test -Dtest='HabitEvaluatorIT,HabitServiceIT,HabitJobIT,FuelSettings*IT' -DargLine=-Xmx3g` → all green (the two untouched caffeine tests prove ghost-parity; the new one proves the personal cutoff).
- [ ] **Step 7: Commit**

```bash
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(habit,fuel): no_stim_after reads the fuel-settings caffeine cutoff via CaffeineCutoffPort (mezo-53su)"
```

---

### Task 5: FE data layer — settings API + dual-mode hooks + MSW

**Files:**
- Modify: `frontend/src/data/types.ts` (+`FuelSettings`)
- Create: `frontend/src/data/fuel/fuelSettingsApi.ts`
- Create: `frontend/src/data/fuel/fuelSettingsHooks.ts` + `fuelSettingsHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Consumes: Task 1's generated schemas.
- Produces: `interface FuelSettings { mealsPerDay: number; caffeineCutoff: string }`; `FUEL_SETTINGS_GHOST: FuelSettings = { mealsPerDay: 4, caffeineCutoff: '14:00' }` (exported from `fuelSettingsHooks.ts`); `useFuelSettings(): { settings: FuelSettings; isPending: boolean }` (query key `['fuelSettings']`); `useFuelSettingsActions(): { setSettings: (s: FuelSettings) => Promise<void>; pending: boolean }`. Tasks 7–8 consume these.

- [ ] **Step 1: Type.** In `data/types.ts` (near the fuel types):

```ts
/** Fuel-owned planner settings (mezo-53su) — eating cadence + caffeine cutoff, per-user singleton. */
export interface FuelSettings {
  mealsPerDay: number
  caffeineCutoff: string
}
```

- [ ] **Step 2: API client** — `fuelSettingsApi.ts` (complete file, the `biometricProfileApi` GET+PUT shape):

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { FuelSettings } from '@/data/types'

type FuelSettingsResponse = components['schemas']['FuelSettingsResponse']
type SetFuelSettingsRequest = components['schemas']['SetFuelSettingsRequest']

export const fuelSettingsApi = {
  get: (): Promise<FuelSettings> => apiFetch<FuelSettingsResponse>('/api/fuel/settings'),
  set: (settings: FuelSettings): Promise<FuelSettings> =>
    apiFetch<FuelSettingsResponse>('/api/fuel/settings', {
      method: 'PUT',
      body: JSON.stringify({
        mealsPerDay: settings.mealsPerDay,
        caffeineCutoff: settings.caffeineCutoff,
      } satisfies SetFuelSettingsRequest),
    }),
}
```

- [ ] **Step 3: Hooks** — `fuelSettingsHooks.ts` (complete file):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { fuelSettingsApi } from '@/data/fuel/fuelSettingsApi'
import type { FuelSettings } from '@/data/types'

/** The backend's config-default ghost — the honest value in BOTH modes before a save. */
export const FUEL_SETTINGS_GHOST: FuelSettings = { mealsPerDay: 4, caffeineCutoff: '14:00' }

export function useFuelSettings() {
  const { data, isPending } = useDualQuery<FuelSettings>({
    queryKey: ['fuelSettings'],
    mockData: FUEL_SETTINGS_GHOST,
    realFetch: fuelSettingsApi.get,
    realEmpty: FUEL_SETTINGS_GHOST,
  })
  return { settings: data, isPending }
}

export function useFuelSettingsActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (settings: FuelSettings) => {
      if (mock) {
        qc.setQueryData<FuelSettings>(['fuelSettings'], settings)
        return
      }
      await fuelSettingsApi.set(settings)
    },
    onSuccess: mock ? undefined : () => {
      qc.invalidateQueries({ queryKey: ['fuelSettings'] })
      qc.invalidateQueries({ queryKey: ['habitDay'] }) // no_stim_after re-centers on the new cutoff
    },
  })
  return {
    setSettings: (s: FuelSettings) => mutation.mutateAsync(s).then(() => undefined),
    pending: mutation.isPending,
  }
}
```

- [ ] **Step 4: Barrel + MSW.** `data/hooks.ts` (next to the fuel lines): `export { useFuelSettings, useFuelSettingsActions } from '@/data/fuel/fuelSettingsHooks'`. `test/msw/handlers.ts` defaults:

```ts
  http.get(`${API_BASE}/api/fuel/settings`, () =>
    HttpResponse.json({ mealsPerDay: 4, caffeineCutoff: '14:00' })),
  http.put(`${API_BASE}/api/fuel/settings`, async ({ request }) =>
    HttpResponse.json(await request.json())),
```

- [ ] **Step 5: Hook tests** — `fuelSettingsHooks.test.tsx` (complete file):

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useFuelSettings, useFuelSettingsActions, FUEL_SETTINGS_GHOST } from '@/data/fuel/fuelSettingsHooks'

afterEach(() => vi.unstubAllEnvs())

describe('useFuelSettings (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the ghost synchronously and setSettings patches the cache', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useFuelSettings(), act: useFuelSettingsActions() }), { wrapper })
    expect(result.current.read.settings).toEqual(FUEL_SETTINGS_GHOST)
    await act(() => result.current.act.setSettings({ mealsPerDay: 5, caffeineCutoff: '13:00' }))
    await waitFor(() => expect(result.current.read.settings.mealsPerDay).toBe(5))
  })
})

describe('useFuelSettings (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('starts from the honest ghost, then loads the server value', async () => {
    server.use(http.get(`${API_BASE}/api/fuel/settings`, () =>
      HttpResponse.json({ mealsPerDay: 6, caffeineCutoff: '12:30' })))
    const { result } = renderHook(() => useFuelSettings(), { wrapper: makeHookWrapper() })
    expect(result.current.settings).toEqual(FUEL_SETTINGS_GHOST)
    await waitFor(() => expect(result.current.settings.mealsPerDay).toBe(6))
  })

  it('setSettings PUTs the exact body and refetches', async () => {
    let putBody: unknown
    server.use(
      http.put(`${API_BASE}/api/fuel/settings`, async ({ request }) => {
        putBody = await request.json()
        return HttpResponse.json(putBody as object)
      }),
      http.get(`${API_BASE}/api/fuel/settings`, () =>
        HttpResponse.json({ mealsPerDay: 3, caffeineCutoff: '15:30' })),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useFuelSettings(), act: useFuelSettingsActions() }), { wrapper })
    await act(() => result.current.act.setSettings({ mealsPerDay: 3, caffeineCutoff: '15:30' }))
    expect(putBody).toEqual({ mealsPerDay: 3, caffeineCutoff: '15:30' })
    await waitFor(() => expect(result.current.read.settings.caffeineCutoff).toBe('15:30'))
  })
})
```

- [ ] **Step 6: Run:** `cd frontend && pnpm test src/data/fuel/fuelSettingsHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/fuel/fuelSettingsHooks.test.tsx && pnpm build` → PASS.
- [ ] **Step 7: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fe-data): useFuelSettings dual-mode hooks + settings client (mezo-53su)"
```

---

### Task 6: `buildDayPlan` — slotKey out, re-flow, caffeineCutoff in (TDD)

**Files:**
- Modify: `frontend/src/data/types.ts` (`FuelSlot` +`slotKey?: MealSlot`)
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts`
- Test: extend `frontend/src/features/fuel/logic/buildDayPlan.test.ts` (the file exists — read it first, add a `describe`)

**Interfaces:**
- Consumes: nothing new (pure logic).
- Produces: `DayPlanInput` gains `caffeineCutoff: string`; meal/snack `FuelSlot`s carry `slotKey` (block/protocol/extra slots may omit it EXCEPT extra logged-meal slots which also carry their key); exported `reflowPendingWindows(windows: PlannedWindow[], filled: boolean[], floor: number, kitchenClose: number, blocks: PlannerBlock[], now: number): PlannedWindow[]` for direct testing. Tasks 7–8 rely on `slot.slotKey` and the plan's `caffeineCutoff` passthrough.

- [ ] **Step 1: Failing tests.** Add to `buildDayPlan.test.ts` (adapt imports/builders to the file's existing helpers — read it first; the cases below are the required coverage, each with exact expectations):

```ts
describe('slot identity + now-aware re-flow (mezo-53su)', () => {
  // Baseline inputs used across the cases: wake 06:00, bed 23:00 -> eatingStart 06:45, kitchenClose 21:30.
  const base = { wake: '06:00', bed: '23:00', mealsPerDay: 4, blocks: [], budget: BUDGET, meals: [], recipes: [], protocolSlots: [], intakes: [], caffeineCutoff: '14:00' }

  it('meal slots carry their slotKey; block slots do not', () => {
    const plan = buildDayPlan({ ...base, blocks: [{ kind: 'gym', label: 'Pull', time: '07:30', durationMin: 60 }], nowHHmm: '06:00' })
    const meal = plan.slots.find(s => s.label === 'Reggeli')!
    const block = plan.slots.find(s => s.kind === 'workout')!
    expect(meal.slotKey).toBe('breakfast')
    expect(block.slotKey).toBeUndefined()
  })

  it('pending windows never render in the past (morning parity, midday drift)', () => {
    const morning = buildDayPlan({ ...base, nowHHmm: '06:00' })
    // floor = max(eatingStart 06:45, 06:00, 0) = 06:45 -> identical to the static placement
    expect(morning.slots.find(s => s.label === 'Reggeli')!.time).toBe('06:45')
    const midday = buildDayPlan({ ...base, nowHHmm: '13:30' })
    // nothing logged by 13:30 -> ALL pending windows re-space evenly on [13:30, 21:30]
    for (const s of midday.slots.filter(s => s.slotKey)) {
      expect(toMin(s.time)).toBeGreaterThanOrEqual(toMin('13:30'))
    }
    expect(midday.slots.find(s => s.label === 'Reggeli')!.time).toBe('13:30') // first pending sits at the floor
  })

  it('late lunch pushes the rest: floor = lastLogged + 90', () => {
    const lunch = mkMeal({ slot: 'lunch', loggedAt: `${TODAY}T15:00:00`, title: 'Késői ebéd' })
    const plan = buildDayPlan({ ...base, meals: [lunch], nowHHmm: '15:05' })
    // floor = max(06:45, 15:05, 15:00+90 = 16:30) = 16:30; pending = Reggeli, Vacsora, Uzsonna
    const pending = plan.slots.filter(s => s.slotKey && s.state !== 'done')
    for (const s of pending) expect(toMin(s.time)).toBeGreaterThanOrEqual(toMin('16:30'))
    const done = plan.slots.find(s => s.state === 'done')!
    expect(done.time).toBe('15:00') // done slots keep their loggedAt
  })

  it('re-flow keeps the 90-min gap and clamps at kitchen close', () => {
    const plan = buildDayPlan({ ...base, nowHHmm: '20:00' })
    // floor 20:00, close 21:30 -> 4 pending windows squeeze into 90 min: spacing collapses toward the close
    const pending = plan.slots.filter(s => s.slotKey)
    expect(toMin(pending[pending.length - 1].time)).toBeLessThanOrEqual(toMin('21:30'))
    for (const s of pending) expect(toMin(s.time)).toBeGreaterThanOrEqual(toMin('20:00'))
  })

  it('future-block snaps survive the re-flow; past blocks do not re-snap', () => {
    const blocks = [{ kind: 'gym' as const, label: 'Pull', time: '18:00', durationMin: 60 }]
    const plan = buildDayPlan({ ...base, blocks, nowHHmm: '13:30' })
    // post-workout main snaps to 19:45 (blockEnd 19:00 + 45) even after re-flow
    expect(plan.slots.some(s => s.slotKey && s.time === '19:45')).toBe(true)
  })

  it('is deterministic: same inputs, same plan', () => {
    const a = buildDayPlan({ ...base, nowHHmm: '13:30' })
    const b = buildDayPlan({ ...base, nowHHmm: '13:30' })
    expect(a).toEqual(b)
  })

  it('passes the caffeineCutoff input through', () => {
    const plan = buildDayPlan({ ...base, caffeineCutoff: '12:30', nowHHmm: '06:00' })
    expect(plan.caffeineCutoff).toBe('12:30')
  })
})
```

(`mkMeal`/`BUDGET`/`TODAY` — reuse or add tiny local builders consistent with the file's existing fixtures; `toMin` from `@/data/fuel/fuelConfig`.)

- [ ] **Step 2: RED:** `cd frontend && pnpm test src/features/fuel/logic/buildDayPlan.test.ts` → new cases FAIL (no slotKey on slots, no re-flow, no caffeineCutoff input).
- [ ] **Step 3: Implement.** In `data/types.ts`, add to `FuelSlot`: `slotKey?: MealSlot` (comment: `// meal/snack window identity (mezo-53su); absent on block/protocol slots`). In `buildDayPlan.ts`:

(a) `DayPlanInput` gains `caffeineCutoff: string`; the return object's `caffeineCutoff: CAFFEINE_CUTOFF` becomes `caffeineCutoff: input.caffeineCutoff` (the `CAFFEINE_CUTOFF` import is removed — Task 7 deletes the constant).

(b) New exported pure function (place above `buildDayPlan`):

```ts
/**
 * Now-aware re-flow (spec D4): pending meal windows re-space evenly on [floor, kitchenClose],
 * order preserved; future-block snaps re-applied; 90-min min-gap forward-push; clamp at close.
 * Done windows (filled[i]) keep their planned time — their slots render at loggedAt anyway.
 */
export function reflowPendingWindows(
  windows: PlannedWindow[],
  filled: boolean[],
  floor: number,
  kitchenClose: number,
  blocks: PlannerBlock[],
  now: number,
): PlannedWindow[] {
  const pendingIdx = windows.map((_, i) => i).filter(i => !filled[i])
  if (pendingIdx.length === 0 || floor <= windows[pendingIdx[0]].time) {
    // nothing pending, or the earliest pending window is already at/after the floor -> keep the plan
    if (pendingIdx.every(i => windows[i].time >= floor)) return windows
  }
  const out = windows.map(w => ({ ...w }))
  const span = Math.max(0, kitchenClose - floor)
  const n = pendingIdx.length
  pendingIdx.forEach((wi, j) => {
    out[wi].time = n === 1 ? floor : floor + (span * j) / (n - 1)
  })
  // Re-apply snaps for FUTURE blocks only (a past workout must not drag a window backward).
  for (const b of [...blocks].sort((x, y) => toMin(x.time) - toMin(y.time))) {
    const start = toMin(b.time)
    if (start < now) continue
    const end = start + (b.durationMin ?? DEFAULT_BLOCK_MIN)
    const post = pendingIdx
      .map(i => out[i])
      .filter(w => w.kind === 'meal')
      .sort((a, z) => Math.abs(a.time - start) - Math.abs(z.time - start))[0]
    if (post) post.time = Math.max(floor, Math.min(kitchenClose, end + POST_WORKOUT_SNAP_MIN))
  }
  // Order + min-gap forward-push + clamp (pending only; done windows keep their slot in the order).
  const pendings = pendingIdx.map(i => out[i]).sort((a, z) => a.time - z.time)
  for (let i = 1; i < pendings.length; i++) {
    if (pendings[i].time < pendings[i - 1].time + MIN_SLOT_GAP_MIN) {
      pendings[i].time = Math.min(kitchenClose, pendings[i - 1].time + MIN_SLOT_GAP_MIN)
    }
  }
  return out
}
```

(c) Integrate in `buildDayPlan` between the cursor computation and the slot assembly: compute the fill map WITHOUT consuming cursors, derive the floor, re-flow, THEN assemble slots from the re-flowed windows (the existing map/cursor logic moves after the re-flow — the `windows.map((w, i) => ...)` body itself is unchanged apart from adding `slotKey: w.slotKey` to all three return shapes, and the extra-slot builder in 3b also gains `slotKey: k`):

```ts
  // 2b. Fill map (which window will be 'done') WITHOUT consuming cursors yet.
  const willFill: boolean[] = (() => {
    const c: Record<SlotKey, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }
    return windows.map(w => c[w.slotKey]++ < loggedByKey[w.slotKey].length)
  })()

  // 2c. Now-aware re-flow of the pending windows (spec D4).
  const eatingStart = toMin(wake) + EATING_START_OFFSET_MIN
  const lastLoggedMin = meals.length
    ? Math.max(...meals.map(m => toMin(hhmmFromLoggedAt(m.loggedAt, nowHHmm))))
    : 0
  const floor = Math.max(eatingStart, now, lastLoggedMin ? lastLoggedMin + MIN_SLOT_GAP_MIN : 0)
  const flowed = reflowPendingWindows(windows, willFill, floor, kitchenCloseMin, blocks, now)
```

…and the subsequent slot assembly iterates `flowed` instead of `windows` (budgets stay index-aligned — `splitBudget` ran on the pre-flow windows; weights don't change in re-flow, so the budgets remain valid).

- [ ] **Step 4: GREEN:** `pnpm test src/features/fuel/logic/buildDayPlan.test.ts` → ALL green (old + new). The OLD tests in this file pin pre-flow behavior with early `nowHHmm` values — where an old expectation conflicts ONLY because its `nowHHmm` implies a floor above the pinned times, re-source the expectation to the flowed value with a comment; never delete assertions. List every touched old test in the report.
- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): slot identity + now-aware window re-flow + cutoff input in buildDayPlan (mezo-53su)"
```

---

### Task 7: Unified mock timeline — seed retirement + test migration

**Files:**
- Modify: `frontend/src/data/fuel/timelineHooks.ts` (delete the mock shortcut; settings-sourced inputs; fixed mock now)
- Modify: `frontend/src/data/fuel/fuelConfig.ts` (delete `PLANNER_DEFAULTS`, `CAFFEINE_CUTOFF`; `slotKeyOfLabel` stays until Task 9 removes its last call site — delete it THERE)
- Modify: `frontend/src/data/fuel/fuel.ts` (delete `fuelPlan`/`fuelToday` + the `FuelPlanToday` seed block, lines ~359-488)
- Test: `frontend/src/data/fuel/timelineHooks.test.tsx` + every mock-plan-pinning test (`FuelTimeline.test.tsx`, `FuelMaiPage.test.tsx`, `TodayPage.test.tsx`, `conditionalCards.test.tsx`, `todayHooks.test.tsx`, `PredictionsPage.test.tsx`, `fuelConfig.test.ts`)

**Interfaces:**
- Consumes: Task 5's `useFuelSettings` (ghost always present), Task 6's `buildDayPlan` (+`caffeineCutoff` input).
- Produces: `useFuelTimeline` computes the plan in BOTH modes from the same composition; mock `nowHHmm` fixed at `'13:30'`. Every downstream consumer sees a COMPUTED mock plan.

- [ ] **Step 1: timelineHooks rewrite.** In `timelineHooks.ts`:
  - Add `const { settings } = useFuelSettings()` (import from `@/data/fuel/fuelSettingsHooks` — data-internal deep import).
  - `const mealsPerDay = settings.mealsPerDay` (the `goal?.mealsPerDay ?? PLANNER_DEFAULTS.mealsPerDay` line and the `PLANNER_DEFAULTS` import are deleted; `goal` stays for `deriveDailyBudget`'s segment inputs).
  - DELETE the mock shortcut block (`if (isMockMode()) { return { plan: fuelPlan.today, ... } }`) and the `fuelPlan` import; keep `getScoredMeal` sourced from `fuel.meals` in both modes.
  - `nowHHmm`: `const nowHHmm = isMockMode() ? MOCK_NOW_HHMM : \`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}\`` with `export const MOCK_NOW_HHMM = '13:30'` declared at the top of the file (comment: `// Fixed mock "now" (spec D6) — deterministic demo + tests`).
  - `buildDayPlan({ ..., caffeineCutoff: settings.caffeineCutoff, ... })`.
- [ ] **Step 2: Seed retirement.** Delete `fuelPlan`/`fuelToday` from `fuel.ts`; `grep -rn "fuelPlan\|fuelToday" frontend/src` must return ZERO hits afterwards. Delete `PLANNER_DEFAULTS` + `CAFFEINE_CUTOFF` from `fuelConfig.ts`; `grep -rn "PLANNER_DEFAULTS\|CAFFEINE_CUTOFF" frontend/src` → zero hits.
- [ ] **Step 3: Test migration.** Run `pnpm test` in BOTH modes and fix every failure by RE-SOURCING to the computed mock plan (fixed now 13:30, mock sleep goal 06:45/23:15 → eatingStart 07:30, kitchenClose 21:45; mock settings ghost 4/'14:00'; blocks from the mock train/running data) — never by weakening:
  - `timelineHooks.test.tsx`: the `toBe(fuelPlan.today)` byte-parity test becomes a computed-plan contract test — assert mock mode yields `plan.slots.length > 0`, one `state === 'now'` slot, `plan.caffeineCutoff === '14:00'`, `plan.kitchenClose === '21:45'`, and determinism (two renders → `toEqual`). The real-mode `not.toBe(fuelPlan.today)` asserts drop their seed reference (assert on computed values instead).
  - Component/page tests that pinned seed strings (`Pull Day`, `Ébresztő`, `Délutáni stack`, `05:50`, `16:00`…): re-pin to the computed plan's actual output — run the test, read the rendered output, assert the real computed labels/times (the implementer derives them from the mock inputs; they are deterministic). Where a test only needs "a done slot exists" semantics, assert by state/kind rather than a string time.
  - `fuelConfig.test.ts`: `slotKeyOfLabel` tests stay (deletion happens in Task 9 with the last call site).
  - List EVERY migrated assertion (old → new) in the report.
- [ ] **Step 4: Full FE gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → ALL green both modes.
- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): unified computed timeline in both modes — static mock seed retired (mezo-53su)"
```

---

### Task 8: Settings UI — `FuelSettingsSheet` + Mai chip + EditGoalSheet trim

**Files:**
- Create: `frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx` + `FuelSettingsSheet.test.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx` (szerkeszt chip in the `.fuelchips` row + sheet mount) + `FuelMaiPage.test.tsx`
- Modify: `frontend/src/features/me/sheets/EditGoalSheet.tsx` (remove the whole "Napi ritmus" section) + `EditGoalSheet.test.tsx`; `frontend/src/data/me/goalHooks.ts` + `goalApi.ts` (drop the now-unused `savePlanner` planner arg path — `savePlanner` is deleted if EditGoalSheet was its only caller; `goalResponseToUpsert` keeps `mealsPerDay: res.mealsPerDay` pass-through)

**Interfaces:**
- Consumes: Task 5's `useFuelSettings`/`useFuelSettingsActions` via `@/data/hooks`; `Sheet` render-prop idiom.
- Produces: `FuelSettingsSheet({ onClose })`; the Mai `.fuelchips` row shows the LIVE `plan.caffeineCutoff` (already does) + the new chip.

- [ ] **Step 1: Failing sheet test** (`FuelSettingsSheet.test.tsx`, complete file; mock-mode):

```tsx
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderSheet = (onClose = vi.fn()) => {
  render(<QueryWrapper><FuelSettingsSheet onClose={onClose} /></QueryWrapper>)
  return onClose
}

describe('FuelSettingsSheet', () => {
  test('opens prefilled from the ghost settings', () => {
    renderSheet()
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
    expect(screen.getByLabelText('Koffein-cutoff')).toHaveValue('14:00')
  })

  test('stepper clamps between 3 and 6', async () => {
    renderSheet()
    const minus = screen.getByRole('button', { name: 'Étkezés csökkentése' })
    await userEvent.click(minus)
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('3')
    expect(minus).toBeDisabled()
  })

  test('saving persists the edited values and closes', async () => {
    const onClose = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    fireEvent.change(screen.getByLabelText('Koffein-cutoff'), { target: { value: '13:00' } })
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: RED** → module not found. **Implement the sheet** (complete component; mirror the EditGoalSheet row/stepper styling exactly — read it first):

```tsx
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useFuelSettings, useFuelSettingsActions } from '@/data/hooks'

const ROW: React.CSSProperties = { justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }
const LABEL: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }

/** Fuel planner settings editor (mezo-53su): eating cadence + caffeine cutoff. */
export function FuelSettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings } = useFuelSettings()
  const { setSettings, pending } = useFuelSettingsActions()
  const [mealsPerDay, setMealsPerDay] = useState(settings.mealsPerDay)
  const [caffeineCutoff, setCaffeineCutoff] = useState(settings.caffeineCutoff)

  const save = (close: () => void) =>
    setSettings({ mealsPerDay, caffeineCutoff }).then(close)

  return (
    <Sheet onClose={onClose} labelledBy="fuel-settings-title">
      {(close) => (
        <div className="col gap-sm">
          <h2 id="fuel-settings-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            Fuel beállítások
          </h2>

          <div className="row" style={ROW}>
            <span style={LABEL}>Étkezés/nap</span>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <button type="button" className="chip" aria-label="Étkezés csökkentése"
                disabled={mealsPerDay <= 3} onClick={() => setMealsPerDay(v => Math.max(3, v - 1))}
                style={{ opacity: mealsPerDay <= 3 ? 0.4 : 1 }}><Icon name="minus" size={12} /></button>
              <span aria-label="Étkezés/nap"
                style={{ minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {mealsPerDay}
              </span>
              <button type="button" className="chip" aria-label="Étkezés növelése"
                disabled={mealsPerDay >= 6} onClick={() => setMealsPerDay(v => Math.min(6, v + 1))}
                style={{ opacity: mealsPerDay >= 6 ? 0.4 : 1 }}><Icon name="plus" size={12} /></button>
            </div>
          </div>

          <div className="row" style={ROW}>
            <span style={LABEL}>Koffein-cutoff</span>
            <input type="time" aria-label="Koffein-cutoff" value={caffeineCutoff}
              onChange={(e) => e.target.value && setCaffeineCutoff(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums', colorScheme: 'dark' }} />
          </div>
          <span style={{ fontSize: 9, color: 'var(--faint)' }}>A cutoff a Mai chipet, a nap-tervet és a koffein-habitot is állítja.</span>

          <button type="button" className="cta-primary" disabled={pending}
            style={{ opacity: pending ? 0.5 : 1 }} onClick={() => save(close)}>
            <Icon name="check" size={14} /> Mentés
          </button>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 3: Mai wiring.** In `FuelMaiPage.tsx`: `const [settingsOpen, setSettingsOpen] = useState(false)`; in the `.fuelchips` row append `<button type="button" className="chip" aria-label="Fuel beállítások" onClick={() => setSettingsOpen(true)} style={{ fontSize: 9, padding: '3px 8px' }}>szerkeszt</button>`; mount `{settingsOpen && <FuelSettingsSheet onClose={() => setSettingsOpen(false)} />}` next to the other sheets. Add a `FuelMaiPage.test.tsx` case: click `Fuel beállítások` → `getByRole('dialog', { name: 'Fuel beállítások' })` appears.
- [ ] **Step 4: EditGoalSheet trim.** Remove the entire "Napi ritmus" section (SECTION_LABEL block, stepper, hint, `Ritmus mentése` button) + the `mealsPerDay` state + the `savePlanner` call. In `goalHooks.ts` delete `savePlanner` (mutation + callback) IF grep shows EditGoalSheet was its only consumer (verify: `grep -rn "savePlanner" frontend/src` — report the hits); `goalApi.ts`'s `goalResponseToUpsert` keeps `mealsPerDay: res.mealsPerDay` (wire pass-through, unread). Update `EditGoalSheet.test.tsx`: the rhythm tests are replaced by `expect(screen.queryByText('Napi ritmus')).toBeNull()` + the goal-PUT test asserts `body.mealsPerDay === goalResponse.mealsPerDay` (pass-through proof).
- [ ] **Step 5: Run:** `pnpm test src/features/fuel/sheets/FuelSettingsSheet.test.tsx src/features/fuel/pages/FuelMaiPage.test.tsx src/features/me/sheets/EditGoalSheet.test.tsx` in both modes → green.
- [ ] **Step 6: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel,me): FuelSettingsSheet on Mai; EditGoalSheet loses the planner section (mezo-53su)"
```

---

### Task 9: Slot-level AI — SlotCard chip + slot-lock + Mai wiring

**Files:**
- Modify: `frontend/src/features/fuel/components/SlotCard.tsx` (+`onAiLog` prop + AI chip) + `SlotCard.test.tsx` (extend if exists, else create)
- Modify: `frontend/src/features/fuel/components/FuelTimeline.tsx` (thread `onAiLog`)
- Modify: `frontend/src/features/fuel/sheets/AiLogSheet.tsx` (slot-lock) + `AiLogSheet.test.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx` (AI wiring: `handleAiLog`, `aiSlot` state, `initialSlot` pass; `handleLogMeal` uses `slot.slotKey`) + test
- Modify: `frontend/src/data/fuel/fuelConfig.ts` (delete `slotKeyOfLabel`) + `fuelConfig.test.ts` (delete its tests)

**Interfaces:**
- Consumes: Task 6's `FuelSlot.slotKey`.
- Produces: `SlotCard`/`FuelTimeline` gain `onAiLog?: (slot: FuelSlot) => void`; `AiLogSheet` keeps its props but `initialSlot` now LOCKS (the draft's proposed slot is ignored when `initialSlot` is set; the review selector still allows manual change).

- [ ] **Step 1: Failing tests.**
  - `AiLogSheet.test.tsx` — add: with `initialSlot="lunch"`, after a mock draft resolves (mock draft's slot is `snack`), the review selector shows `Ebéd` as `aria-pressed=true` (the draft did NOT override); without `initialSlot`, the draft's `snack` wins (existing behavior — assert it to pin both branches).
  - `SlotCard` test — an open budget slot with `slotKey` renders BOTH `Logolás` and the `AI` chip (`aria-label` `` `${slot.label} AI-logolása` ``); a done slot renders neither; clicking the AI chip calls `onAiLog` with the slot.
  - `FuelMaiPage.test.tsx` — clicking a slot's AI chip opens the AI sheet (dialog present).
- [ ] **Step 2: RED** → run the three files.
- [ ] **Step 3: Implement.**
  - `AiLogSheet.tsx`: change line ~82 `setSlot(d.slot)` → `if (!initialSlot) setSlot(d.slot)` (comment: `// slot-lock (mezo-53su): a slot-targeted launch keeps its slot; the review selector still allows manual change`).
  - `SlotCard.tsx`: add `onAiLog?: (slot: FuelSlot) => void` to the props; after the two `Logolás` buttons add (rendered under the same `isSuggestion || isBudgetSlot` visibility, `slot.slotKey` present):

```tsx
{(isSuggestion || isBudgetSlot) && slot.slotKey && onAiLog && (
  <button
    type="button"
    aria-label={`${slot.label} AI-logolása`}
    onClick={() => onAiLog(slot)}
    className="chx"
    style={{ marginTop: 6, marginLeft: 6, background: 'var(--wash-lav)', color: 'var(--lav-deep)' }}
  >
    AI
  </button>
)}
```

  - `FuelTimeline.tsx`: add `onAiLog` to the props and pass it to `SlotCard`.
  - `FuelMaiPage.tsx`: `const [aiSlot, setAiSlot] = useState<MealSlot | undefined>(undefined)`; `const handleAiLog = (slot: FuelSlot) => { setAiSlot(slot.slotKey); setAiOpen(true) }`; header AI button sets `setAiSlot(undefined)` before opening; `<AiLogSheet ... initialSlot={aiSlot} />`; `<FuelTimeline ... onAiLog={handleAiLog} />`; `handleLogMeal`'s `slotKeyOfLabel(slot.label)` → `slot.slotKey ?? 'snack'`.
  - Delete `slotKeyOfLabel` from `fuelConfig.ts` + its unit tests; `grep -rn "slotKeyOfLabel" frontend/src` → zero hits.
- [ ] **Step 4: GREEN** both modes on the touched files, then the FULL FE gate (`pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`).
- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel): per-slot AI logging with slot-lock; slotKey replaces label guessing (mezo-53su)"
```

---

### Task 10: Living docs + cluster notes

**Files:**
- Modify: `docs/features/fuel.md` (settings singleton, re-flow, slot identity, per-slot AI, mock unification), `docs/features/habit.md` (no_stim_after → CaffeineCutoffPort), `docs/features/me.md` (EditGoalSheet lost the planner section), `docs/features/_platform-api-backend.md` (+`/api/fuel/settings`), `docs/features/_platform-data-layer.md` (+`useFuelSettings`, `['fuelSettings']` key; timeline both-modes computed)
- Modify: `docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md` — §0/§3: this slice done; ALSO fix the stale slice-B line ("PR pending" → merged as PR #48); §5 → the remaining consumer (morning-training reschedule) + slice C next.

- [ ] **Step 1:** Update the touched sections with verified `file:line` pointers; overwrite in place; each doc's language respected; clear any staleness THIS branch introduces (key_files git-drift — bump affected docs' frontmatter, with evidence in the report).
- [ ] **Step 2:** `node scripts/lint-docs.mjs` → touched docs clean, zero branch-introduced staleness.
- [ ] **Step 3: Commit**

```bash
git add docs
git -c core.hooksPath=/dev/null commit -m "docs(fuel): slot-timing + settings + per-slot AI feature docs; cluster notes status (mezo-53su)"
```

---

### Task 11: Final verification + goldens + PR

- [ ] **Step 1: Focused backend gate:** `cd backend && ./mvnw clean test -Dtest='FuelSettings*IT,HabitEvaluatorIT,HabitServiceIT,HabitJobIT,SleepGoal*IT' -DargLine=-Xmx3g` → PASS.
- [ ] **Step 2: Full FE gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → both modes green.
- [ ] **Step 3: Contract drift:** regen both + `git diff --exit-code` on the two artifacts → clean.
- [ ] **Step 4: Visual goldens:** run the local visual suite (`frontend/tests/visual`, per its README) — the fuel/today surfaces are EXPECTED to differ (computed mock plan). Refresh darwin baselines locally, commit; trigger `update-visual-baselines.yml` for linux after push (the habit-engine slice's exact flow).
- [ ] **Step 5: Runtime verify (mock FE, `verify` skill):** `/fuel` Mai — computed timeline (slots re-spaced after the fixed 13:30 mock-now, none in the past), `szerkeszt` chip → FuelSettingsSheet → set mealsPerDay 5 + cutoff 13:00 → save → chip + plan update live; slot AI chip → AiLogSheet with the slot locked through a mock draft; EditGoalSheet (a `/me/goals` goal hero tap) has no "Napi ritmus". Screenshot the Mai timeline.
- [ ] **Step 6: Push + PR + CI + merge** (worktree flow; check `mergeable` first — back-merge like slice A if a parallel session landed):

```bash
git push -u origin feat/fuel-slot-timing
gh pr create --title "feat(fuel): living Mai timeline — fuel_settings, now-aware re-flow, slot identity, per-slot AI (mezo-53su)" --body "..."
# CI green -> gh pr merge --merge --delete-branch
```

- [ ] **Step 7: bd close** (from `~/MrKuhne/mezo`): `bd close mezo-53su` + notes + `bd dolt push`.

---

## Self-Review (done at authoring)

- **Spec coverage:** D1 → Tasks 6/7 (re-flow, constants, mock, identity); D2 → Tasks 1-3 (singleton, ghost, wire pass-through); D3 → Task 4 (port, ungated, config trim, IT parity); D4 → Task 6 (floor formula verbatim from Global Constraints); D5 → Tasks 6/9 (slotKey out, slotKeyOfLabel deleted at last call site); D6 → Task 7 (unified build, fixed 13:30, seed retired, golden expectation) + Task 11 step 4; D7 → Task 9 (chip + lock + header unchanged); D8 → Task 8 (sheet, chips row, EditGoalSheet trim). Spec §7 testing → Tasks 3/4/5/6/7/8/9 + 11; §8 out-of-scope respected (no column drops, no LogMealSheet changes, no backend AI changes).
- **Type consistency:** `FuelSettings { mealsPerDay, caffeineCutoff }` identical across Tasks 5 (def) / 7 / 8; `FUEL_SETTINGS_GHOST` 4/'14:00' = backend ghost; `CaffeineCutoffPort.resolve(UUID): LocalTime` def (Task 4) = use (Task 4 evaluator); `FuelSlot.slotKey?: MealSlot` def (Task 6) = uses (Tasks 7/9); `reflowPendingWindows` signature consistent; `MOCK_NOW_HHMM = '13:30'` (Task 7) matches the Task 6 test's midday case and Task 11's runtime verify.
- **Placeholders:** none — the two "read the file first" notes (buildDayPlan test fixtures, EditGoalSheet styling) are adapt-to-actual instructions with required behavior fully specified; Task 7's re-pin instruction defines the method (run, read computed output, assert it) rather than fake values I cannot know pre-implementation — deliberate, since the computed labels/times derive from mock data the implementer runs.


