# Fuel P1 — Water Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Mai page's water ring honest — a real `water_log` table + `+250/+500 ml` chips on `MacroHero`, replacing the `consumed.water = targets.water` placeholder.

**Architecture:** Discrete owned `water_log` rows (undo-friendly, weight-log precedent); day rollup = Σ `amount_ml` inside the existing `FuelDayService.getDay` (flows through the existing `FuelDayResponse.consumed.water` — no read-shape change). FE adds `useWaterActions` (dual-mode, `useMealActions` pattern) + presentational chips on `MacroHero`.

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / Testcontainers-or-compose Postgres; React 19 + TanStack Query + MSW tests; OpenAPI contract-first.

**Driving bd:** `mezo-0z5`. Spec: `docs/superpowers/specs/2026-07-02-fuel-stack-protocol-water-design.md` §2.
**Branch:** `feat/fuel-p1-water` (from `main`). Claim first: `bd update mezo-0z5 --claim`.

## Global Constraints

- Backend base package `io.mrkuhne.mezo`; water files live under `feature/meal` (the fuel-day owner).
- UUID PKs (`gen_random_uuid()`); every owned table: `created_by uuid not null` FK → `app_user`, `is_deleted boolean not null default false`, `created_at timestamptz not null default now()`; soft-delete via `@SQLDelete`+`@SQLRestriction`; constraint names `pk_/fk_/uq_/ck_/idx_`.
- Contract-first: edit `api/feature/meal/meal.yml` BEFORE code; merge with `cd api/generate && npm run generate:api`; FE types `cd frontend && pnpm generate:api`; backend Java types regenerate in `./mvnw` builds (openapi-generator, `interfaceOnly`, package `io.mrkuhne.mezo.api.{controller,dto}`).
- Backend tests: ALWAYS `./mvnw clean test` (Lombok+MapStruct incremental compile is flaky); compose Postgres must be up (`cd backend && docker compose up -d`).
- FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- Constructor injection only (`@RequiredArgsConstructor`); `@Transactional` method-level only; no `@Value` (config = `@Validated` `@ConfigurationProperties` — none needed here).
- Hungarian UI copy, English code/comments/commits. Commit subjects carry `(mezo-0z5)`.
- Note: after Task 1 the backend does not compile until Task 4 adds the controller methods (the regenerated `MealApi` gains abstract methods). This is branch-internal state; only the merge to `main` must be green.

---

### Task 1: API contract — water-log endpoints

**Files:**
- Modify: `api/feature/meal/meal.yml`
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: `POST /api/water-log` (operationId `logWater`, 201 → `WaterLogResponse`), `DELETE /api/water-log/{id}` (operationId `deleteWaterLog`, 204); schemas `WaterLogRequest { date?: date, amountMl: integer }`, `WaterLogResponse { id: uuid, date: date, amountMl: integer }`. Tag `Meal` → methods land on the existing generated `MealApi` interface.

- [ ] **Step 1: Add the two paths to `meal.yml`** (into the existing `paths:` block, after the `/api/meal/{id}` entry; match the file's flow-style formatting):

```yaml
  /api/water-log:
    post:
      tags: [Meal]
      operationId: logWater
      summary: Log a discrete water intake entry (day rollup feeds FuelDayResponse.consumed.water)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/WaterLogRequest' } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/WaterLogResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/water-log/{id}:
    delete:
      tags: [Meal]
      operationId: deleteWaterLog
      summary: Soft-delete a water entry (undo)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

- [ ] **Step 2: Add the two schemas** (into `components.schemas`):

```yaml
    WaterLogRequest:
      type: object
      required: [amountMl]
      properties:
        date: { type: string, format: date, description: 'Day key; defaults to the server''s today when omitted' }
        amountMl: { type: integer, minimum: 1 }
    WaterLogResponse:
      type: object
      required: [id, date, amountMl]
      properties:
        id: { type: string, format: uuid }
        date: { type: string, format: date }
        amountMl: { type: integer }
```

- [ ] **Step 3: Merge + regenerate FE types**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` gains the two paths; `frontend/src/data/_client/api.gen.ts` gains `WaterLogRequest`/`WaterLogResponse` schemas.

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): water-log contract — POST /api/water-log + DELETE (mezo-0z5)"
```

---

### Task 2: Liquibase migration `water_log`

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607021200_mezo-0z5_create_water_log.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append at end)

- [ ] **Step 1: Write the migration SQL**

```sql
-- Fuel water logging (mezo-0z5): discrete owned water-intake entries; the Fuel-day rollup
-- (FuelDayResponse.consumed.water) becomes sum(amount_ml) for the day, replacing the
-- targets-echo placeholder. Discrete rows (not a per-day counter) so a mis-tap is undoable.
create table water_log (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    log_date   date        not null,
    amount_ml  integer     not null,
    constraint pk_water_log_id primary key (id),
    constraint fk_water_log_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_water_log_amount_ml check (amount_ml > 0)
);

create index idx_water_log_created_by_log_date on water_log (created_by, log_date);
```

- [ ] **Step 2: Register in `1.0.0_master.yml`** (append after the last changeSet, same shape):

```yaml
  - changeSet:
      id: "1.0.0:202607021200_mezo-0z5_create_water_log"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607021200_mezo-0z5_create_water_log.sql
```

- [ ] **Step 3: Commit** (backend still doesn't compile — expected until Task 4; do NOT run mvn yet)

```bash
git add backend/src/main/resources/db/changelog/
git commit -m "feat(db): create water_log table (mezo-0z5)"
```

---

### Task 3: Entity + repository + test plumbing

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/WaterLogEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/WaterLogRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/WaterLogPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (`@Import` list)

**Interfaces:**
- Produces: `WaterLogRepository.sumAmountForDay(UUID userId, LocalDate date): int`, `findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy): Optional<WaterLogEntity>`; `WaterLogPopulator.createWaterLog(UUID owner, LocalDate date, int amountMl): WaterLogEntity`.

- [ ] **Step 1: Entity** (`MedicationDoseEntity` precedent — extends `OwnedEntity`):

```java
package io.mrkuhne.mezo.feature.meal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "water_log")
@SQLDelete(sql = "update water_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WaterLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @NotNull
    @Column(name = "amount_ml", nullable = false)
    private Integer amountMl;
}
```

- [ ] **Step 2: Repository**

```java
package io.mrkuhne.mezo.feature.meal.repository;

import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface WaterLogRepository extends JpaRepository<WaterLogEntity, UUID> {

    Optional<WaterLogEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    @Query("select coalesce(sum(w.amountMl), 0) from WaterLogEntity w "
        + "where w.createdBy = :userId and w.logDate = :date and w.deleted = false")
    int sumAmountForDay(UUID userId, LocalDate date);
}
```

- [ ] **Step 3: Populator**

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class WaterLogPopulator {

    private final WaterLogRepository repository;

    public WaterLogEntity createWaterLog(UUID owner, LocalDate date, int amountMl) {
        WaterLogEntity e = new WaterLogEntity();
        e.setCreatedBy(owner);
        e.setLogDate(date);
        e.setAmountMl(amountMl);
        return repository.saveAndFlush(e);
    }
}
```

- [ ] **Step 4:** Add `water_log` to the front of the TRUNCATE list in `ResetDatabase.resetExceptMasterData()` (`"TRUNCATE TABLE water_log, medication_dose, medication, …"`), and add `WaterLogPopulator.class` to the `@Import` list in `AbstractIntegrationTest`.

- [ ] **Step 5: Commit** (still not compiling — the generated `MealApi` abstract methods land in Task 4)

```bash
git add backend/src
git commit -m "feat(be): water_log entity + repository + test plumbing (mezo-0z5)"
```

---

### Task 4: Service + controller + FuelDayService rollup (TDD)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/WaterLogApiIT.java` (next to the existing meal ITs — mirror their package)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/WaterLogService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/controller/MealController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java`

**Interfaces:**
- Consumes: `WaterLogRepository` (Task 3), generated `WaterLogRequest`/`WaterLogResponse` DTOs (Task 1), `CurrentUserId.get()`.
- Produces: `WaterLogService.logWater(UUID userId, WaterLogRequest request): WaterLogResponse`, `deleteWaterLog(UUID userId, UUID id): void`, `sumForDay(UUID userId, LocalDate date): int`. `FuelDayService.consumed.water` = real sum.

- [ ] **Step 1: Write the failing IT** (`ApiIntegrationTest` base; JSON asserts via `objectMapper.readTree`):

```java
package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import io.mrkuhne.mezo.techcore.configuration.OwnerProperties;
import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import tools.jackson.databind.JsonNode;

class WaterLogApiIT extends ApiIntegrationTest {

    @Autowired private WaterLogPopulator waterPop;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private int dayWater(String date) {
        ResponseEntity<String> day = exchangeForResponse(
            HttpMethod.GET, "/api/fuel/day/" + date, null, ownerAuthHeaders());
        assertThat(day.getStatusCode().value()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(day.getBody());
        return json.get("consumed").get("water").asInt();
    }

    @Test
    void testLogWater_shouldReturn201AndSumIntoDayRollup_whenPosted() {
        ownerId();
        String today = LocalDate.now().toString();

        ResponseEntity<String> res = exchangeForResponse(HttpMethod.POST, "/api/water-log",
            Map.of("date", today, "amountMl", 250), ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(201);
        exchangeForResponse(HttpMethod.POST, "/api/water-log",
            Map.of("date", today, "amountMl", 500), ownerAuthHeaders());

        assertThat(dayWater(today)).isEqualTo(750);
    }

    @Test
    void testGetFuelDay_shouldReportZeroWater_whenNothingLogged() {
        ownerId();
        assertThat(dayWater(LocalDate.now().toString())).isZero();
    }

    @Test
    void testLogWater_shouldReject_whenAmountNonPositive() {
        ownerId();
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.POST, "/api/water-log",
            Map.of("date", LocalDate.now().toString(), "amountMl", 0), ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        assertHasFieldError(res.getBody(), "amountMl", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testDeleteWaterLog_shouldRemoveFromRollup_whenDeleted() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        WaterLogEntity row = waterPop.createWaterLog(owner, today, 400);

        deleteAndExpect("/api/water-log/" + row.getId(), ownerAuthHeaders(), org.springframework.http.HttpStatus.NO_CONTENT);

        assertThat(dayWater(today.toString())).isZero();
    }

    @Test
    void testDeleteWaterLog_shouldReturn404_whenMissing() {
        ownerId();
        deleteAndExpect("/api/water-log/" + UUID.randomUUID(), ownerAuthHeaders(), org.springframework.http.HttpStatus.NOT_FOUND);
    }
}
```

- [ ] **Step 2: Run it to verify it fails** (first make the module compile — that requires Steps 3-5's classes to exist; the compile failure itself is the first "red")

Run: `cd backend && ./mvnw clean test -Dtest=WaterLogApiIT`
Expected: compile error — `MealController` does not implement `logWater`/`deleteWaterLog`.

- [ ] **Step 3: WaterLogService**

```java
package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.WaterLogRequest;
import io.mrkuhne.mezo.api.dto.WaterLogResponse;
import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WaterLogService {

    private final WaterLogRepository repository;

    @Transactional
    public WaterLogResponse logWater(UUID userId, WaterLogRequest request) {
        if (request.getAmountMl() == null || request.getAmountMl() <= 0) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "amountMl").build(), HttpStatus.BAD_REQUEST);
        }
        WaterLogEntity e = new WaterLogEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setLogDate(request.getDate() != null ? request.getDate() : LocalDate.now());
        e.setAmountMl(request.getAmountMl());
        WaterLogEntity saved = repository.save(e);
        return WaterLogResponse.builder()
            .id(saved.getId()).date(saved.getLogDate()).amountMl(saved.getAmountMl()).build();
    }

    @Transactional
    public void deleteWaterLog(UUID userId, UUID id) {
        WaterLogEntity e = repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        repository.delete(e); // @SQLDelete → soft delete
    }

    @Transactional(readOnly = true)
    public int sumForDay(UUID userId, LocalDate date) {
        return repository.sumAmountForDay(userId, date);
    }
}
```

- [ ] **Step 4: MealController** — add the field `private final WaterLogService waterLogService;` and:

```java
    @Override
    public WaterLogResponse logWater(WaterLogRequest waterLogRequest) {
        return waterLogService.logWater(currentUserId.get(), waterLogRequest);
    }

    @Override
    public void deleteWaterLog(UUID id) {
        waterLogService.deleteWaterLog(currentUserId.get(), id);
    }
```

(Exact `@Override` signatures come from the regenerated `MealApi` — match them; `201`/`204` statuses are declared by the generated interface.)

- [ ] **Step 5: FuelDayService rollup** — inject `private final WaterLogService waterLogService;`. In `getDay(UUID userId, LocalDate date)` compute `int water = waterLogService.sumForDay(userId, date);` and pass it into the consumed builder; replace the placeholder line (currently `FuelDayService.java:66`):

```java
            .water(BigDecimal.valueOf(targets.water())) // placeholder until water-logging lands
```

with

```java
            .water(BigDecimal.valueOf(water))
```

(thread `water` through the private `consumed(...)` helper as a new parameter).

- [ ] **Step 6: Run the IT — green**

Run: `cd backend && ./mvnw clean test -Dtest=WaterLogApiIT`
Expected: 5 tests PASS.

- [ ] **Step 7: Full backend gate**

Run: `cd backend && ./mvnw clean test`
Expected: all green (existing `FuelDay`/meal ITs that assumed `consumed.water == targets.water` may need their expectation updated to `0` — fix them to assert the new honest behavior, not the placeholder).

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(be): water logging — WaterLogService + real consumed.water rollup (mezo-0z5)"
```

---

### Task 5: FE — `useWaterActions` + honest mock water

**Files:**
- Modify: `frontend/src/data/fuel/mealApi.ts`
- Modify: `frontend/src/data/fuel/fuelHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel line 15)
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/fuel/fuelHooks.test.tsx`

**Interfaces:**
- Produces: `useWaterActions(date?: string): { logWater(amountMl: number): void }` exported from `@/data/hooks`.
- Consumes: `mealApi`, `fuelDayKey(date)`, `seedDayData`, `isMockMode`, `FUELDAY_KEY` (all already in `fuelHooks.ts`).

- [ ] **Step 1: Failing tests** — add to `fuelHooks.test.tsx` (existing wrapper + `vi.stubEnv` pattern):

```tsx
describe('useWaterActions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('increments consumed.water and survives a subsequent meal log', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => ({ day: useFuelDay(), water: useWaterActions(), meals: useMealActions() }), { wrapper: Wrapper })
    const before = result.current.day.fuel.consumed.water
    act(() => result.current.water.logWater(250))
    await waitFor(() => expect(result.current.day.fuel.consumed.water).toBe(before + 250))
    act(() => result.current.meals.logMeal({ slot: 'snack', items: [] }))
    await waitFor(() => expect(result.current.day.fuel.consumed.water).toBe(before + 250))
  })
})

describe('useWaterActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('POSTs /api/water-log and invalidates fuelDay', async () => {
    const posted: unknown[] = []
    server.use(http.post(`${API_BASE}/api/water-log`, async ({ request }) => {
      posted.push(await request.json())
      return HttpResponse.json({ id: 'w1', date: '2026-07-02', amountMl: 250 }, { status: 201 })
    }))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useWaterActions('2026-07-02'), { wrapper: Wrapper })
    act(() => result.current.logWater(250))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({ date: '2026-07-02', amountMl: 250 })
    await waitFor(() => expect(spy.mock.calls.some(c => JSON.stringify(c[0]).includes('fuelDay'))).toBe(true))
  })
})
```

Run: `cd frontend && pnpm vitest run src/data/fuel/fuelHooks.test.tsx`
Expected: FAIL — `useWaterActions` is not exported.

- [ ] **Step 2: `mealApi.logWater`** (in `mealApi.ts`, inside the exported object):

```ts
  logWater: (date: string, amountMl: number): Promise<void> =>
    apiFetch('/api/water-log', { method: 'POST', body: JSON.stringify({ date, amountMl }) }).then(() => undefined),
```

- [ ] **Step 3: `useWaterActions` in `fuelHooks.ts`** + fix `recomputeConsumed`:

```ts
export function useWaterActions(date: string = localDateString()) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const waterM = useMutation({
    mutationFn: mock
      ? async (amountMl: number) => {
          qc.setQueryData<FuelDayData>(fuelDayKey(date), d => {
            const base = d ?? { ...seedDayData, date }
            return { ...base, consumed: { ...base.consumed, water: base.consumed.water + amountMl } }
          })
        }
      : (amountMl: number) => mealApi.logWater(date, amountMl),
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: [FUELDAY_KEY] }),
  })

  const logWater = useCallback((amountMl: number) => waterM.mutate(amountMl), [waterM])
  return { logWater }
}
```

Change `recomputeConsumed` (currently pins water to `targets.water`) to preserve the day's logged water:

```ts
function recomputeConsumed(meals: FuelMeal[], water: number): MacroSet {
  return meals.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f, water: a.water }),
    { kcal: 0, p: 0, c: 0, f: 0, water },
  )
}
```

and update its caller in `patchDay` to `recomputeConsumed(meals, base.consumed.water)`.

- [ ] **Step 4: Barrel + MSW default handler** — extend `hooks.ts` line 15 to `export { useFuelDay, useMealActions, useRecipeLogs, useWaterActions } from '@/data/fuel/fuelHooks'`; add to `test/msw/handlers.ts` (next to the `/api/meal` handlers):

```ts
  http.post(`${API_BASE}/api/water-log`, () =>
    HttpResponse.json({ id: 'w1', date: '2026-07-02', amountMl: 250 }, { status: 201 })),
```

- [ ] **Step 5: Run tests — green**

Run: `cd frontend && pnpm vitest run src/data/fuel/fuelHooks.test.tsx`
Expected: PASS (both new describes + all pre-existing).

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): useWaterActions dual-mode hook + honest mock water (mezo-0z5)"
```

---

### Task 6: FE — MacroHero chips + Mai wiring

**Files:**
- Modify: `frontend/src/features/fuel/components/MacroHero.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx` (the `<MacroHero .../>` call site, ~line 80)
- Test: `frontend/src/features/fuel/components/MacroHero.test.tsx`

**Interfaces:**
- Produces: `MacroHero` gains optional prop `onLogWater?: (amountMl: number) => void`; chips render only when provided (component stays presentational — Today's usages are untouched).

- [ ] **Step 1: Failing tests** (append to `MacroHero.test.tsx`, reusing its fixtures):

```tsx
it('renders +250/+500 water chips and calls onLogWater', () => {
  const onLogWater = vi.fn()
  render(<MacroHero targets={targets} consumed={consumed} onLogWater={onLogWater} />)
  fireEvent.click(screen.getByRole('button', { name: 'Víz +250 ml' }))
  fireEvent.click(screen.getByRole('button', { name: 'Víz +500 ml' }))
  expect(onLogWater).toHaveBeenNthCalledWith(1, 250)
  expect(onLogWater).toHaveBeenNthCalledWith(2, 500)
})

it('renders no water chips without onLogWater', () => {
  render(<MacroHero targets={targets} consumed={consumed} />)
  expect(screen.queryByRole('button', { name: /Víz \+/ })).toBeNull()
})
```

Run: `cd frontend && pnpm vitest run src/features/fuel/components/MacroHero.test.tsx` — Expected: FAIL.

- [ ] **Step 2: Implement** — extend the props to `{ targets, consumed, eyebrow, onLogWater }: { targets: MacroSet; consumed: MacroSet; eyebrow?: string; onLogWater?: (amountMl: number) => void }` and render inside the existing Víz footer row (after the water value/ProgressBar column):

```tsx
        {onLogWater && (
          <div className="row gap-xs">
            {[250, 500].map(ml => (
              <button
                key={ml}
                type="button"
                className="chip notch-4"
                aria-label={`Víz +${ml} ml`}
                style={{ fontSize: 9, padding: '4px 8px' }}
                onClick={() => onLogWater(ml)}
              >
                +{ml}
              </button>
            ))}
          </div>
        )}
```

- [ ] **Step 3: Wire FuelMaiPage** — add `const { logWater } = useWaterActions()` (import from `@/data/hooks`) and pass `onLogWater={logWater}` at the call site.

- [ ] **Step 4: Run tests — green**, then the full gate

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: all green in both modes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): +250/+500 ml water chips on MacroHero, wired on Mai (mezo-0z5)"
```

---

### Task 7: Docs + close + merge + push

**Files:**
- Modify: `docs/features/fuel.md` (§1 status line, §2 Mai paragraph, §3 meal-logging exception paragraph, §4 endpoints)
- Modify: `docs/superpowers/plans/2026-06-26-fuel-completion-roadmap.md` (mark P1 ✅ SHIPPED, like P3)
- Modify: `docs/milestones/roadmap.md` (Fuel line)

- [ ] **Step 1:** Update the docs: fuel.md — water is now real (`water_log`, `POST /api/water-log`, `useWaterActions`, MacroHero chips; the "always 100%" caveat is gone); roadmap plan P1 section gets a `✅ SHIPPED (mezo-0z5, <date>)` header note; milestones roadmap Fuel status line mentions P1.
- [ ] **Step 2:** Run `node scripts/lint-docs.mjs` — Expected: PASS, no stale flag on fuel.md.
- [ ] **Step 3:** Commit docs; close the issue:

```bash
git add docs/ && git commit -m "docs(fuel): water logging shipped — fuel.md + roadmap (mezo-0z5)"
bd close mezo-0z5
git add .beads/issues.jsonl && git commit -m "chore(bd): sync issues.jsonl — close mezo-0z5"
```

- [ ] **Step 4:** Merge + push (pull-rebase BEFORE the merge, never after — it would flatten the `--no-ff` merge):

```bash
git checkout main && git pull --rebase
git merge --no-ff feat/fuel-p1-water -m "Merge feat/fuel-p1-water: real water logging on Mai (mezo-0z5)"
git branch -d feat/fuel-p1-water
bd dolt push && git push && git status
```

Expected: `up to date with 'origin/main'`.
