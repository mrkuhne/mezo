# Fuel Medication (Gyógyszer) Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task (TDD: write failing test → run → implement → run → commit). Execute in **Task Map** order; task IDs are section-scoped, not globally sequential.

**Goal:** Give the Retatrutide medication a first-class home — a new "Gyógyszer" Fuel tab that logs injections into a real `medication`/`medication_dose` backend, derives the 7-day cycle (`retaDay`/phase) from the dose log, and broadcasts it via the existing `useTodayScenario().retaDay`.

**Architecture:** Contract-first OpenAPI (`api/feature/medication/medication.yml` → `MedicationApi` + `api.dto`). A new owned `feature/medication` slice: `medication` (definition + a typed-jsonb cycle config) and `medication_dose` (one owned row per injection, FK `ON DELETE RESTRICT`, the `run_session_log`/`meal_item` event-log pattern). `MedicationCycleService` derives `{retaDay, phase, week}` from the newest dose + the cycle config. Dual-mode `useMedication`/`useMedicationActions` (the `useWeight`/`useFuelDay` pattern). The broadcast is one localized swap: `useTodayScenario().retaDay` derives from the cycle in real mode (the `?retaDay=` URL override is kept). Reta leaves `pantry_item` (`kind='med'` retired for it; supplements/stim stay).

**Tech Stack:** Spring Boot 4 · Java 21 · Maven · PostgreSQL 16 · Liquibase · MapStruct · Lombok · React 19 · Vite · TanStack Query · TypeScript. Chamfer "Deep Current" design system.

**Driving bd:** `mezo-d94` (roadmap P3). **Spec:** `docs/superpowers/specs/2026-06-26-fuel-medication-design.md`. **Templates to mirror:** the shipped Meal slice (`mezo-arb`: `feature/meal`, `api/feature/meal/meal.yml`), Train's `ProvenanceEnvelope` typed-jsonb, `run_session_log` event table.

## Global Constraints

- Base package `io.mrkuhne.mezo`; package layout `feature/medication/{controller,service,repository,entity,dto,mapper}` (`java_package_structure.md`).
- **UUID PKs** (`gen_random_uuid()`); every owned table has `created_by uuid`, `is_deleted boolean` soft-delete (`@SQLRestriction("is_deleted = false")` + `@SQLDelete`), `created_at/updated_at`.
- **jsonb** via `@JdbcTypeCode(SqlTypes.JSON)` onto a typed record (never `String`).
- **Liquibase** changeset file `{YYYYMMDDHHMM}_mezo-d94_{desc}.sql`; explicit constraint names (`pk_/fk_/uq_/ck_/idx_`); never modify a released changeset; registered in `db/changelog/1.0.0/1.0.0_master.yml`.
- **Seed data in Java** `@Profile("demodata")` only — never SQL.
- **Config** via `@Validated @ConfigurationProperties` records under the `mezo.*` root — never `@Value`, no hardcoded tunables (`configuration_conventions.md`).
- **Contract-first:** edit `api/feature/medication/medication.yml` BEFORE code; merge (`cd api/generate && npm run generate:api`); backend implements the generated `MedicationApi` + uses `api.dto` models; FE types from `frontend/src/lib/api.gen.ts` (`cd frontend && pnpm generate:api`).
- **Errors:** `SystemRuntimeErrorException` + `SystemMessage` codes + `message.properties`; never hardcoded user text (`error_handling.md`).
- **Tests:** integration-first — service tests extend `AbstractIntegrationTest`, HTTP tests extend `ApiIntegrationTest`; data via `*Populator` factories; AssertJ only; no mocks/`@MockBean`/H2; naming `test{Method}_should{Result}_when{Condition}`. New table → add to `ResetDatabase` TRUNCATE list; new aggregate → new populator (`integration_test_framework.md`). Always `./mvnw clean test` (compose up).
- **FE:** hooks stay dual-mode via `isMockMode()` + `useDualQuery`; **view/component signatures must NOT change** except the new tab/sheet; both modes green (`pnpm test` AND `VITE_USE_MOCK=true pnpm test`) + `pnpm build`.
- **Docs:** update `docs/features/fuel.md` + `node scripts/lint-docs.mjs` in the doc task.

---

## File Structure

**Backend (new — `backend/src/main/java/io/mrkuhne/mezo/feature/medication/`):**
- `entity/MedicationEntity.java` — definition + jsonb cycle config; `entity/MedicationDoseEntity.java` — injection event; `entity/MedicationCycleJson.java` — typed-jsonb record.
- `repository/MedicationRepository.java`, `repository/MedicationDoseRepository.java`.
- `service/MedicationCycleService.java` — the derivation; `service/MedicationService.java` — CRUD + dose; `service/dto/MedicationCycle.java` — internal derived value.
- `mapper/MedicationMapper.java`; `controller/MedicationController.java`.
- `config/` — none (cycle config is per-row jsonb, not global).

**Backend (modify):**
- `db/changelog/1.0.0/script/{ts}_mezo-d94_create_medication.sql` (create) + `1.0.0_master.yml` (register).
- `techcore/.../ResetDatabase.java` — add `medication_dose`, `medication` to TRUNCATE.
- demodata loader: `feature/medication/MedicationDemoLoader.java` (`@Profile("demodata")`).
- `techcore/.../message.properties` — new SystemMessage codes (if any beyond existing).

**Backend (new tests):** `feature/medication/{MedicationCycleServiceIT,MedicationServiceIT,MedicationApiIT,MedicationMapperTest}.java`; `support/populator/{MedicationPopulator,MedicationDosePopulator}.java`.

**Contract:** `api/feature/medication/medication.yml` (create); `api/generate/merge.yml` (register input).

**Frontend (new — `frontend/src/`):**
- `lib/medicationApi.ts` — client + `toRequest`/`fromResponse`.
- `data/medicationHooks.ts` — `useMedication`/`useMedicationActions` (re-exported from `data/hooks.ts`).
- `data/medication.ts` — mock seed (definition + cycle + doses).
- `features/fuel/views/FuelMedicationView.tsx`; `features/fuel/LogDoseSheet.tsx`; `features/fuel/components/MedicationCycleBar.tsx`.

**Frontend (modify):**
- `features/fuel/FuelSubNav.tsx` + `app/router.tsx` — add the Gyógyszer tab/route.
- `data/hooks.ts` — re-export the new hooks; `data/useTodayScenario` (in `hooks.ts:18`) — derive `retaDay` from the cycle in real mode.
- `data/types.ts` — `Medication`/`MedicationDose`/`MedicationCycle` FE types.
- `test/msw/handlers.ts` — `/api/medication` handlers.

**Docs:** `docs/features/fuel.md` (§3/§4/§9), `docs/milestones/roadmap.md` (P3 brief), `docs/superpowers/plans/2026-06-26-fuel-completion-roadmap.md` (P3 line + P0b note).

---

## Task Map

1. Contract — `medication.yml` + merge + generate
2. Liquibase migration (`medication`, `medication_dose`)
3. Entities + cycle jsonb
4. Repositories
5. `MedicationCycleService` (derivation) + IT
6. `MedicationService` (CRUD + dose) + IT
7. `MedicationMapper` + unit test
8. `MedicationController` + `MedicationApiIT`
9. demodata seed + populators + `ResetDatabase`
10. FE `medicationApi.ts` + mock seed + types
11. FE `medicationHooks.ts` (+ MSW) + tests
12. FE `FuelMedicationView` + tab/route + `MedicationCycleBar` + tests
13. FE `LogDoseSheet` + tests
14. Broadcast — `useTodayScenario().retaDay` derive + test
15. Docs + roadmap/ADR reconciliation

---

### Task 1: API contract — `medication.yml`

**Files:**
- Create: `api/feature/medication/medication.yml`
- Modify: `api/generate/merge.yml` (add `../feature/medication/medication.yml` to inputs)
- Verify: `api/openapi.yml` (merged), `frontend/src/lib/api.gen.ts` (regenerated)

**Interfaces — Produces (the contract every later task binds to):**
- Paths: `GET /api/medication`, `PUT /api/medication/{id}`, `POST /api/medication/{id}/dose`, `DELETE /api/medication/{id}/dose/{doseId}`.
- Schemas: `MedicationResponse { id, name, activeIngredient, route, cadence, defaultDose, doseUnit, cycle: MedicationCycleConfig, active }`; `MedicationCycleConfig { cycleLengthDays:int, phases: MedicationPhase[] }`; `MedicationPhase { key: enum[peak,stable,trough], fromDay:int, toDay:int, label }`; `MedicationCycleResponse { retaDay:int, phaseKey, phaseLabel, lastDoseAt: date-time nullable, week: MedicationCycleCell[] }`; `MedicationCycleCell { day:int, phaseKey, label, current:boolean }`; `MedicationDoseResponse { id, administeredAt: date-time, dose:number, note }`; `MedicationDayResponse { medication: MedicationResponse, cycle: MedicationCycleResponse, recentDoses: MedicationDoseResponse[] }`; `MedicationRequest` (PUT body, the definition + cycle); `MedicationDoseRequest { administeredAt?: date-time, dose:number, note? }`.
- `GET /api/medication` returns `MedicationDayResponse`.

- [ ] **Step 1: Write the contract fragment**

Create `api/feature/medication/medication.yml` mirroring `api/feature/meal/meal.yml`'s structure (paths + components/schemas under a `Medication` tag). Define exactly the paths and schemas in the Produces block above. Key shapes:

```yaml
# operationIds: getMedicationDay, updateMedication, logDose, deleteDose
paths:
  /api/medication:
    get:
      tags: [Medication]
      operationId: getMedicationDay
      responses: { '200': { description: ok, content: { application/json: { schema: { $ref: '#/components/schemas/MedicationDayResponse' } } } } }
  /api/medication/{id}:
    put:
      tags: [Medication]
      operationId: updateMedication
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/MedicationRequest' } } } }
      responses: { '200': { description: ok, content: { application/json: { schema: { $ref: '#/components/schemas/MedicationResponse' } } } } }
  /api/medication/{id}/dose:
    post:
      tags: [Medication]
      operationId: logDose
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/MedicationDoseRequest' } } } }
      responses: { '201': { description: created, content: { application/json: { schema: { $ref: '#/components/schemas/MedicationDoseResponse' } } } } }
  /api/medication/{id}/dose/{doseId}:
    delete:
      tags: [Medication]
      operationId: deleteDose
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: doseId, in: path, required: true, schema: { type: string, format: uuid } }
      responses: { '204': { description: deleted } }
components:
  schemas:
    MedicationPhase:
      type: object
      required: [key, fromDay, toDay, label]
      properties:
        key: { type: string, enum: [peak, stable, trough] }
        fromDay: { type: integer }
        toDay: { type: integer }
        label: { type: string }
    MedicationCycleConfig:
      type: object
      required: [cycleLengthDays, phases]
      properties:
        cycleLengthDays: { type: integer }
        phases: { type: array, items: { $ref: '#/components/schemas/MedicationPhase' } }
    # ... MedicationCycleCell, MedicationCycleResponse, MedicationDoseResponse,
    #     MedicationResponse, MedicationDayResponse, MedicationRequest, MedicationDoseRequest
    #     (full shapes per the Produces block — copy meal.yml's required/nullable discipline)
```

- [ ] **Step 2: Merge + regenerate, verify it builds**

```bash
cd api/generate && npm run generate:api          # → api/openapi.yml
cd ../../frontend && pnpm generate:api            # → src/lib/api.gen.ts
cd ../backend && ./mvnw -q -o generate-sources    # → MedicationApi + api.dto
```
Expected: all three succeed; `grep -c "MedicationDayResponse" frontend/src/lib/api.gen.ts` ≥ 1.

- [ ] **Step 3: Commit**

```bash
git add api/feature/medication/medication.yml api/generate/merge.yml api/openapi.yml frontend/src/lib/api.gen.ts
git commit -m "feat(api): medication contract — day/dose/cycle endpoints (mezo-d94)"
```

---

### Task 2: Liquibase migration

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606261200_mezo-d94_create_medication.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append the include)

**Interfaces — Produces:** tables `medication`, `medication_dose` with the columns Task 3's entities map.

- [ ] **Step 1: Write the changeset**

Mirror `202606241400_mezo-arb_create_meal.sql` (UUID PK default `gen_random_uuid()`, `created_by`, `is_deleted` default false, timestamps, explicit constraint names). Create `medication.sql`:

```sql
--liquibase formatted sql
--changeset mezo:202606261200_mezo-d94_create_medication
create table medication (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  name varchar(120) not null,
  active_ingredient varchar(120),
  route varchar(40),
  cadence varchar(40),
  default_dose numeric,
  dose_unit varchar(20),
  cycle jsonb not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_medication primary key (id)
);
create index idx_medication_owner on medication (created_by) where is_deleted = false;

create table medication_dose (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  medication_id uuid not null,
  administered_at timestamptz not null,
  administered_date date not null,
  dose numeric not null,
  note text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_medication_dose primary key (id),
  constraint fk_medication_dose_medication foreign key (medication_id) references medication (id) on delete restrict
);
create index idx_medication_dose_lookup on medication_dose (created_by, medication_id, administered_date) where is_deleted = false;
```
(The duplicate `primary key`/`constraint pk_` — keep only the `constraint pk_` form to match the repo's named-constraint convention; drop the inline `primary key`.)

- [ ] **Step 2: Register + run, verify the schema applies**

Append to `1.0.0_master.yml`: `- include: { file: script/202606261200_mezo-d94_create_medication.sql, relativeToChangelogFile: true }`.

```bash
cd backend && docker compose up -d && ./mvnw -q -o liquibase:update -Dliquibase.contexts=  # or boot the app
```
Expected: Liquibase applies cleanly; `\d medication_dose` shows `fk_medication_dose_medication`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/changelog/1.0.0/
git commit -m "feat(db): medication + medication_dose tables (mezo-d94)"
```

---

### Task 3: Entities + cycle jsonb

**Files:**
- Create: `backend/.../feature/medication/entity/MedicationEntity.java`, `MedicationDoseEntity.java`, `MedicationCycleJson.java`

**Interfaces — Produces:** `MedicationEntity` (getters per column + `getCycle(): MedicationCycleJson`), `MedicationDoseEntity` (`getAdministeredAt`, `getAdministeredDate`, `getDose`, `getNote`, `getMedicationId`), `MedicationCycleJson(int cycleLengthDays, List<Phase> phases)` with nested `Phase(String key, int fromDay, int toDay, String label)`.

- [ ] **Step 1: Write the cycle jsonb record**

```java
package io.mrkuhne.mezo.feature.medication.entity;
import java.util.List;
public record MedicationCycleJson(int cycleLengthDays, List<Phase> phases) {
    public record Phase(String key, int fromDay, int toDay, String label) {}
}
```

- [ ] **Step 2: Write the entities**

Mirror `MealEntity` (owned, `@SQLRestriction`/`@SQLDelete`, Lombok `@Getter/@Setter`, `@JdbcTypeCode(SqlTypes.JSON)` on `cycle`). `MedicationEntity` fields: `id`(UUID, `@GeneratedValue`), `createdBy`, `name`, `activeIngredient`, `route`, `cadence`, `defaultDose`(BigDecimal), `doseUnit`, `cycle`(MedicationCycleJson, jsonb), `active`(boolean), `deleted`, `createdAt`, `updatedAt`. `MedicationDoseEntity` fields: `id`, `createdBy`, `medicationId`(UUID plain — the meal_item plain-UUID-FK pattern), `administeredAt`(Instant), `administeredDate`(LocalDate), `dose`(BigDecimal), `note`, `deleted`, timestamps. Annotate `cycle`:

```java
@JdbcTypeCode(SqlTypes.JSON)
@Column(columnDefinition = "jsonb")
private MedicationCycleJson cycle;
```

- [ ] **Step 3: Compile**

Run: `cd backend && ./mvnw -q -o test-compile`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/medication/entity/
git commit -m "feat(medication): entities + typed-jsonb cycle config (mezo-d94)"
```

---

### Task 4: Repositories

**Files:**
- Create: `backend/.../feature/medication/repository/MedicationRepository.java`, `MedicationDoseRepository.java`

**Interfaces — Produces:**
- `MedicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(UUID): Optional<MedicationEntity>`; `findByIdAndCreatedByAndDeletedFalse(UUID, UUID): Optional<MedicationEntity>`.
- `MedicationDoseRepository.findTop10ByCreatedByAndMedicationIdAndDeletedFalseOrderByAdministeredAtDesc(UUID, UUID): List<MedicationDoseEntity>`; `findFirstByCreatedByAndMedicationIdAndDeletedFalseAndAdministeredDateLessThanEqualOrderByAdministeredDateDesc(UUID, UUID, LocalDate): Optional<MedicationDoseEntity>`; `findByIdAndCreatedByAndDeletedFalse(UUID, UUID): Optional<MedicationDoseEntity>`.

- [ ] **Step 1: Write both repositories**

Plain `JpaRepository<MedicationEntity, UUID>` + the derived queries above (mirror `MealRepository`/`MealItemRepository` derived-query style).

- [ ] **Step 2: Compile**

Run: `cd backend && ./mvnw -q -o test-compile` — Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/medication/repository/
git commit -m "feat(medication): repositories (mezo-d94)"
```

---

### Task 5: `MedicationCycleService` (the derivation) — TDD

**Files:**
- Create: `backend/.../feature/medication/service/MedicationCycleService.java`, `service/dto/MedicationCycle.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/medication/MedicationCycleServiceIT.java`
- Test support: `support/populator/MedicationPopulator.java`, `MedicationDosePopulator.java` (created here, first consumer)

**Interfaces:**
- Consumes: `MedicationRepository`, `MedicationDoseRepository`, the entities.
- Produces: `MedicationCycleService.derive(UUID userId, MedicationEntity med, LocalDate onDate): MedicationCycle`; `MedicationCycle(int retaDay, String phaseKey, String phaseLabel, Instant lastDoseAt, List<Cell> week)` with `Cell(int day, String phaseKey, String label, boolean current)`.

- [ ] **Step 1: Write the populators**

`MedicationPopulator.createReta(UUID owner)` → persists a Retatrutide `MedicationEntity` with cycle `cycleLengthDays=7, phases=[peak 1-2, stable 3-5, trough 6-7]`, `active=true`, `defaultDose=6`, `doseUnit="mg"`. `MedicationDosePopulator.createDose(UUID owner, UUID medId, LocalDate date, BigDecimal dose)` → persists a `medication_dose` with `administeredAt = date.atStartOfDay(UTC).toInstant()`, `administeredDate = date`. Both `@TestComponent`, `saveAndFlush` (mirror `PantryItemPopulator`).

- [ ] **Step 2: Write the failing test**

```java
@Transactional
class MedicationCycleServiceIT extends AbstractIntegrationTest {
    @Autowired MedicationCycleService service;
    @Autowired MedicationPopulator medPop;
    @Autowired MedicationDosePopulator dosePop;
    @Autowired DatabasePopulator databasePopulator;
    UUID owner;
    @BeforeEach void setUp() { owner = databasePopulator.populateUser("a@test.local"); }

    @Test
    void testDerive_shouldReturnStablePhaseDay3_whenLastDose2DaysAgo() {
        var med = medPop.createReta(owner);
        dosePop.createDose(owner, med.getId(), LocalDate.of(2026, 6, 22), new java.math.BigDecimal("6")); // Mon
        var cycle = service.derive(owner, med, LocalDate.of(2026, 6, 24)); // +2 days
        assertThat(cycle.retaDay()).isEqualTo(3);
        assertThat(cycle.phaseKey()).isEqualTo("stable");
        assertThat(cycle.week()).hasSize(7);
        assertThat(cycle.week().get(2).current()).isTrue();   // day 3 is "now"
    }

    @Test
    void testDerive_shouldReturnNoDoseGhost_whenNoDoses() {
        var med = medPop.createReta(owner);
        var cycle = service.derive(owner, med, LocalDate.of(2026, 6, 24));
        assertThat(cycle.retaDay()).isZero();          // honest-zero, no fabricated day
        assertThat(cycle.lastDoseAt()).isNull();
    }
}
```

- [ ] **Step 3: Run, verify it fails**

Run: `cd backend && ./mvnw -q -o test -Dtest=MedicationCycleServiceIT`
Expected: FAIL — `MedicationCycleService` / `MedicationCycle` do not exist (compile error), then once stubbed, assertion failures.

- [ ] **Step 4: Implement `MedicationCycle` + the service**

`MedicationCycle` is the record in the Produces block. `MedicationCycleService` (`@Service`, `@RequiredArgsConstructor`, `@Transactional(readOnly=true)`):

```java
public MedicationCycle derive(UUID userId, MedicationEntity med, LocalDate onDate) {
    var cfg = med.getCycle();
    var last = doseRepo.findFirstByCreatedByAndMedicationIdAndDeletedFalseAndAdministeredDateLessThanEqualOrderByAdministeredDateDesc(
        userId, med.getId(), onDate);
    if (last.isEmpty()) {
        return new MedicationCycle(0, null, null, null, ghostWeek(cfg));   // honest-zero
    }
    var lastDate = last.get().getAdministeredDate();
    long since = ChronoUnit.DAYS.between(lastDate, onDate);
    int day = (int) Math.min(since + 1, cfg.cycleLengthDays());            // clamp past cycle length
    var phase = phaseOf(cfg, day);
    return new MedicationCycle(day, phase.key(), phase.label(),
        last.get().getAdministeredAt(), buildWeek(cfg, day));
}
// phaseOf: the phases[] entry whose fromDay..toDay contains `day`
// buildWeek: cells 1..cycleLengthDays, current = (cell.day == day)
// ghostWeek: same cells, current = false
```

- [ ] **Step 5: Run, verify it passes**

Run: `cd backend && ./mvnw -q -o test -Dtest=MedicationCycleServiceIT`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/medication/service/ backend/src/test/java/io/mrkuhne/mezo/feature/medication/MedicationCycleServiceIT.java backend/src/test/java/io/mrkuhne/mezo/support/populator/Medication*Populator.java
git commit -m "feat(medication): cycle derivation service — retaDay/phase from dose log (mezo-d94)"
```

---

### Task 6: `MedicationService` (CRUD + dose) — TDD

**Files:**
- Create: `backend/.../feature/medication/service/MedicationService.java`
- Test: `backend/.../feature/medication/MedicationServiceIT.java`

**Interfaces:**
- Consumes: `MedicationRepository`, `MedicationDoseRepository`, `MedicationCycleService`, `MedicationMapper` (Task 7 — for this task stub the mapper calls behind a thin DTO assembly, OR sequence Task 7 before 6; recommended: do Task 7 first, then this consumes the mapper).
- Produces: `getDay(UUID): MedicationDayResponse`; `logDose(UUID, UUID medId, MedicationDoseRequest): MedicationDoseResponse`; `deleteDose(UUID, UUID medId, UUID doseId)`; `updateMedication(UUID, UUID id, MedicationRequest): MedicationResponse`.

> **Ordering note:** implement **Task 7 (mapper) before Task 6** so this service returns mapped DTOs. The Task Map lists 6 before 7 by domain grouping; execute 7→6.

- [ ] **Step 1: Write the failing test**

```java
@Transactional
class MedicationServiceIT extends AbstractIntegrationTest {
    @Autowired MedicationService service;
    @Autowired MedicationPopulator medPop;
    @Autowired DatabasePopulator databasePopulator;
    UUID owner, other;
    @BeforeEach void setUp() { owner = databasePopulator.populateUser("a@test.local"); other = databasePopulator.populateUser("b@test.local"); }

    @Test
    void testLogDose_shouldAppendDoseAndShiftCycle_whenValid() {
        var med = medPop.createReta(owner);
        var req = new MedicationDoseRequest().dose(new java.math.BigDecimal("6"))
            .administeredAt(java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC));
        var saved = service.logDose(owner, med.getId(), req);
        assertThat(saved.getId()).isNotNull();
        var day = service.getDay(owner);
        assertThat(day.getRecentDoses()).extracting("id").contains(saved.getId());
        assertThat(day.getCycle().getRetaDay()).isEqualTo(1);   // dose today → day 1
    }

    @Test
    void testLogDose_shouldReject_whenForeignMedication() {
        var mine = medPop.createReta(owner);
        assertThatThrownBy(() -> service.logDose(other, mine.getId(),
            new MedicationDoseRequest().dose(new java.math.BigDecimal("6"))))
            .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
    }
}
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd backend && ./mvnw -q -o test -Dtest=MedicationServiceIT` — Expected: FAIL (service missing / assertions).

- [ ] **Step 3: Implement the service**

`@Service @RequiredArgsConstructor`. `requireOwnedMedication`/`requireOwnedDose` gates (404 `RESOURCE_NOT_FOUND`, mirror `MealService.requireOwned`). `logDose`: validate `dose` non-null+positive and `administeredAt` not future (else `VALIDATION_INVALID_VALUE`); build `MedicationDoseEntity` (server-stamp `createdBy`, derive `administeredDate` from `administeredAt`, default `administeredAt = now(UTC)` when null — mirror `MealService.applyHeader`); save; return `mapper.toDoseResponse(...)`. `getDay`: load active medication (404 if none), `cycleService.derive(...)`, recent doses, assemble `MedicationDayResponse` via the mapper. `deleteDose`: soft-delete via repo. `updateMedication`: apply request to the definition + cycle, save.

- [ ] **Step 4: Run, verify it passes**

Run: `cd backend && ./mvnw -q -o test -Dtest=MedicationServiceIT` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/medication/service/MedicationService.java backend/src/test/java/io/mrkuhne/mezo/feature/medication/MedicationServiceIT.java
git commit -m "feat(medication): service — log/delete dose, getDay, update (mezo-d94)"
```

---

### Task 7: `MedicationMapper` — TDD (execute BEFORE Task 6)

**Files:**
- Create: `backend/.../feature/medication/mapper/MedicationMapper.java`
- Test: `backend/.../feature/medication/MedicationMapperTest.java`

**Interfaces — Produces:** `toResponse(MedicationEntity): MedicationResponse`; `toCycleResponse(MedicationCycle): MedicationCycleResponse`; `toDoseResponse(MedicationDoseEntity): MedicationDoseResponse`; `toDay(MedicationEntity, MedicationCycle, List<MedicationDoseEntity>): MedicationDayResponse`; `applyRequest(MedicationEntity, MedicationRequest)`.

- [ ] **Step 1: Write the failing unit test** (plain JUnit, no Spring — mirror `MealMapperTest`)

```java
class MedicationMapperTest {
    final MedicationMapper m = org.mapstruct.factory.Mappers.getMapper(MedicationMapper.class);
    @Test
    void testToCycleResponse_shouldMapWeekAndCurrent() {
        var cycle = new MedicationCycle(3, "stable", "Stabil",
            java.time.Instant.parse("2026-06-22T00:00:00Z"),
            java.util.List.of(new MedicationCycle.Cell(1,"peak","Peak",false),
                              new MedicationCycle.Cell(3,"stable","Stabil",true)));
        var resp = m.toCycleResponse(cycle);
        assertThat(resp.getRetaDay()).isEqualTo(3);
        assertThat(resp.getWeek()).anySatisfy(c -> { assertThat(c.getCurrent()).isTrue(); });
    }
}
```

- [ ] **Step 2: Run, verify it fails** — `./mvnw -q -o test -Dtest=MedicationMapperTest` → FAIL (mapper missing).
- [ ] **Step 3: Implement the mapper** — `@Mapper(componentModel="spring")` interface; default methods for the jsonb-derived shapes (mirror `MealMapper` default-method style; map `MedicationCycle.Cell` → `MedicationCycleCell` etc.).
- [ ] **Step 4: Run, verify it passes** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(medication): mapper (mezo-d94)"`

---

### Task 8: `MedicationController` + `MedicationApiIT` — TDD

**Files:**
- Create: `backend/.../feature/medication/controller/MedicationController.java`
- Test: `backend/.../feature/medication/MedicationApiIT.java`

**Interfaces:**
- Consumes: generated `MedicationApi`, `MedicationService`, `currentUserId` provider (mirror `MealController`).
- Produces: live HTTP endpoints per Task 1.

- [ ] **Step 1: Write the failing HTTP test** (extend `ApiIntegrationTest`, use verb helpers + `ownerAuthHeaders()`)

```java
class MedicationApiIT extends ApiIntegrationTest {
    @Autowired MedicationPopulator medPop;
    @Test
    void testLogDose_shouldReturn201AndShiftCycle_whenPosted() {
        var med = medPop.createReta(ownerId());
        var body = """
          { "dose": 6, "administeredAt": "2026-06-29T07:00:00Z" }""";
        var res = post("/api/medication/" + med.getId() + "/dose", body, ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(201);
        var day = get("/api/medication", ownerAuthHeaders());
        assertThat(day.getBody()).contains("\"retaDay\":1");
    }
}
```
(Use the project's actual `ApiIntegrationTest` helper signatures — check `integration_test_framework.md`; `ownerId()`/`ownerAuthHeaders()` are the established helpers.)

- [ ] **Step 2: Run, verify it fails** — `./mvnw -q -o test -Dtest=MedicationApiIT` → FAIL.
- [ ] **Step 3: Implement the controller** — `@RestController @RequiredArgsConstructor implements MedicationApi`; delegate each operation to `MedicationService`, passing `currentUserId.get()`; return the generated `ResponseEntity` shapes (mirror `MealController`).
- [ ] **Step 4: Run, verify it passes** — Expected: PASS.
- [ ] **Step 5: Run the full backend suite** — `./mvnw clean test` → all green (the new tables are in `ResetDatabase` after Task 9; if Task 9 not yet done, this IT may leak rows — **do Task 9 before the full-suite run**).
- [ ] **Step 6: Commit** — `git commit -m "feat(medication): controller + API IT (mezo-d94)"`

---

### Task 9: demodata seed + `ResetDatabase`

**Files:**
- Create: `backend/.../feature/medication/MedicationDemoLoader.java`
- Modify: `backend/.../techcore/.../ResetDatabase.java` (add `medication_dose`, `medication` to the TRUNCATE list — children before parents)

**Interfaces — Produces:** a demodata Reta medication + a recent Monday dose so `getDay` returns `retaDay≈3` in the running app.

- [ ] **Step 1: Add the TRUNCATE entries** — add `"medication_dose", "medication"` to `ResetDatabase` (order: dose before medication; mirror how meal_item precedes meal).
- [ ] **Step 2: Write the demo loader** — `@Component @Profile("demodata") @RequiredArgsConstructor implements ApplicationRunner` (mirror `PantryCatalogLoader`): if the owner has no active medication, create the Retatrutide medication (cycle config peak1-2/stable3-5/trough6-7, 6mg) + one dose on the most recent Monday on/before today (compute from `LocalDate.now()` — server time is fine for demo).
- [ ] **Step 3: Run the full suite** — `cd backend && ./mvnw clean test` → all green (incl. Medication ITs; ResetDatabase now truncates the new tables between tests).
- [ ] **Step 4: Boot-check the seed** — `./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata` then `curl -s localhost:8090/api/medication -H "<owner auth>"` shows a `retaDay` 1–7. Stop.
- [ ] **Step 5: Commit** — `git commit -m "feat(medication): demodata seed + ResetDatabase (mezo-d94)"`

---

### Task 10: FE — `medicationApi.ts` + mock seed + types

**Files:**
- Create: `frontend/src/lib/medicationApi.ts`, `frontend/src/data/medication.ts`
- Modify: `frontend/src/data/types.ts` (add `Medication`, `MedicationDose`, `MedicationCycle`, `MedicationCycleCell`)

**Interfaces — Produces:** `medicationApi.getDay()`, `.logDose(medId, input)`, `.deleteDose(medId, doseId)`, `.updateMedication(medId, input)` (mirror `mealApi.ts`); `medicationSeed` (the mock day: definition + cycle retaDay 3 + 3 doses); FE types matching the generated DTOs (re-keyed to FE-friendly names if the slice convention does so — check `mealApi.fromResponse`).

- [ ] **Step 1: Add FE types** to `data/types.ts` (match the generated `api.gen.ts` shapes; `Medication`, `MedicationDose { id, administeredAt, dose, note }`, `MedicationCycle { retaDay, phaseKey, phaseLabel, lastDoseAt, week }`, `MedicationCycleCell { day, phaseKey, label, current }`).
- [ ] **Step 2: Write the mock seed** `data/medication.ts` — a `medicationSeed: MedicationDay` with Retatrutide, cycle config, `retaDay:3/stable`, and 3 past doses (Jún 22/15/8). This is mock-mode `initialData`.
- [ ] **Step 3: Write the api client** `lib/medicationApi.ts` using `apiFetch` against the generated paths (mirror `mealApi.ts` `toRequest`/`fromResponse`).
- [ ] **Step 4: Typecheck** — `cd frontend && pnpm exec tsc -b` → EXIT 0.
- [ ] **Step 5: Commit** — `git commit -m "feat(fuel): medication FE api client + mock seed + types (mezo-d94)"`

---

### Task 11: FE — `medicationHooks.ts` (+ MSW) — TDD

**Files:**
- Create: `frontend/src/data/medicationHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (re-export), `frontend/src/test/msw/handlers.ts` (`/api/medication` handlers)
- Test: `frontend/src/data/medicationHooks.test.tsx`

**Interfaces — Produces:** `useMedication(): { medication, cycle, doses }` (dual-mode via `useDualQuery`, `['medication']`); `useMedicationActions(): { logDose, removeDose, updateMedication }` (mock mutates `['medication']`; real calls `medicationApi` then invalidates `['medication']` + `['today']` + `['fuelDay']`).

- [ ] **Step 1: Write the failing test** — mock mode: `useMedication()` returns the seed cycle `retaDay 3`; `logDose` appends a dose and the cycle recomputes to day 1. Real mode (MSW): `useMedication()` reads the handler fixture. (Mirror `fuelHooks.test.tsx` structure: `renderHook` + `QueryClientProvider`, `vi.stubEnv('VITE_USE_MOCK', ...)`.)
- [ ] **Step 2: Run, verify it fails** — `VITE_USE_MOCK=true pnpm vitest run src/data/medicationHooks.test.tsx` → FAIL.
- [ ] **Step 3: Implement the hooks** (mirror `fuelHooks.ts` `useFuelDay`/`useMealActions` dual-mode composition) + add MSW `/api/medication` GET/POST/DELETE handlers (mirror the `/api/fuel/day` handlers).
- [ ] **Step 4: Run both modes** — `VITE_USE_MOCK=true pnpm vitest run src/data/medicationHooks.test.tsx` AND `pnpm vitest run src/data/medicationHooks.test.tsx` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(fuel): dual-mode medication hooks + MSW (mezo-d94)"`

---

### Task 12: FE — `FuelMedicationView` + tab/route + `MedicationCycleBar` — TDD

**Files:**
- Create: `frontend/src/features/fuel/views/FuelMedicationView.tsx`, `frontend/src/features/fuel/components/MedicationCycleBar.tsx`
- Modify: `frontend/src/features/fuel/FuelSubNav.tsx`, `frontend/src/app/router.tsx`
- Test: `frontend/src/features/fuel/views/FuelMedicationView.test.tsx`

**Interfaces:** Consumes `useMedication`, `useMedicationActions`. Produces the `/fuel/gyogyszer` route + the Gyógyszer sub-nav entry.

- [ ] **Step 1: Write the failing test** — render the view (mock mode); assert the medication name "Retatrutide", the "Stabil" phase, the cycle bar's current-day cell, and that the dose log shows the 3 seeded doses. (Mirror `FuelKamraView.test`/`RecipeDetailView.test`.)
- [ ] **Step 2: Run, verify it fails** — FAIL (view missing).
- [ ] **Step 3: Implement** the `MedicationCycleBar` (the 7-cell strip from the approved mockup — port the `gyogyszer-a-szellos.html` cycle CSS to the design system's tokens), the `FuelMedicationView` (card + bar + phase note + dose log + "＋ Beadás" button opening `LogDoseSheet` from Task 13), and wire `FuelSubNav` + `router.tsx` (the `/fuel/gyogyszer` index route under the Fuel outlet, mirror how `kamra` is wired).
- [ ] **Step 4: Run both modes** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(fuel): Gyógyszer tab — medication view + cycle bar + sub-nav (mezo-d94)"`

---

### Task 13: FE — `LogDoseSheet` — TDD

**Files:**
- Create: `frontend/src/features/fuel/LogDoseSheet.tsx`
- Modify: `frontend/src/features/fuel/views/FuelMedicationView.tsx` (mount the sheet)
- Test: `frontend/src/features/fuel/LogDoseSheet.test.tsx`

**Interfaces:** Consumes `useMedicationActions().logDose`. Produces the capture sheet (date default today · time optional · dose prefilled from last · note).

- [ ] **Step 1: Write the failing test** — open the sheet, fill dose, save → `logDose` called with the dose; the new dose appears and the cycle recomputes to day 1. (Mirror `LogMealSheet`/`AddPantryItemSheet` tests.)
- [ ] **Step 2: Run, verify it fails** — FAIL.
- [ ] **Step 3: Implement** the chamfer `Sheet` form (mirror `AddPantryItemSheet` shell): Dátum (default today), Időpont (optional), Dózis (prefill last), Jegyzet → `logDose`.
- [ ] **Step 4: Run both modes** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(fuel): LogDoseSheet — dose capture (mezo-d94)"`

---

### Task 14: Broadcast — `useTodayScenario().retaDay` derive — TDD

**Files:**
- Modify: `frontend/src/data/hooks.ts` (`useTodayScenario`, ~line 18), `frontend/src/features/fuel/components/RetaWeekStrip` consumer (`FuelPlanView.tsx` — drop hardcoded `currentDay={3}`)
- Test: `frontend/src/data/hooks.test.tsx` (extend the existing `useTodayScenario` test)

**Interfaces:** Produces real-mode `retaDay` from `useMedication().cycle.retaDay`; `?retaDay=` URL override still wins.

- [ ] **Step 1: Write the failing test** — extend `hooks.test.tsx`: real mode → `useTodayScenario().retaDay` equals `useMedication().cycle.retaDay` (from MSW); with `?retaDay=5` → still 5 (override wins); mock mode unchanged (defaults to `today.retaDay`).
- [ ] **Step 2: Run, verify it fails** — FAIL.
- [ ] **Step 3: Implement** — in `useTodayScenario`, in real mode read `useMedication().cycle.retaDay` as the base (fallback to `today.retaDay` when no medication/no dose); keep the URL-param override as the top priority. Update `FuelPlanView` to pass the derived day to `RetaWeekStrip` instead of `3`.
- [ ] **Step 4: Run both modes + the existing Today/Mai/Terv tests** — `pnpm test` AND `VITE_USE_MOCK=true pnpm test` → all green (the regression guard that the broadcast didn't break Today/Mai/Terv).
- [ ] **Step 5: Build** — `pnpm build` → succeeds.
- [ ] **Step 6: Commit** — `git commit -m "feat(fuel): broadcast derived retaDay via useTodayScenario (mezo-d94)"`

---

### Task 15: Docs + roadmap/ADR reconciliation

**Files:**
- Modify: `docs/features/fuel.md` (§3 add the Gyógyszer tab + medication hooks; §4 add `medication`/`medication_dose` tables + endpoints; §9 update the Reta seam — now first-class, left pantry), frontmatter `updated: 2026-06-26`
- Modify: `docs/milestones/roadmap.md` (P3 brief → "Gyógyszer tab + medication domain"), `docs/superpowers/plans/2026-06-26-fuel-completion-roadmap.md` (P3 line + the P0b note: Reta first-class, not a pantry row)

- [ ] **Step 1: Update `fuel.md`** — the three sections above + the `key_files` list (add `frontend/src/data/medicationHooks.ts`, `frontend/src/lib/medicationApi.ts`). Bump `updated`.
- [ ] **Step 2: Update the roadmap + completion-roadmap** — P3 brief + P0b note.
- [ ] **Step 3: Lint** — `node scripts/lint-docs.mjs` → `fuel.md` clean.
- [ ] **Step 4: Final full gates** — `cd backend && ./mvnw clean test` (all green) AND `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build` (all green).
- [ ] **Step 5: Commit + close** — `git commit -m "docs(fuel): Gyógyszer slice — fuel.md + roadmap + P0b note (mezo-d94)"`; then `bd close mezo-d94 -r "Gyógyszer tab + medication/medication_dose domain + derived retaDay broadcast shipped"`.

---

## Self-Review

**Spec coverage:** §1 scope → Tasks 1-14; §2 data model → Tasks 2-4; §3 derivation → Task 5; §4 contract → Task 1; §5 FE → Tasks 10-13; §6 broadcast → Task 14; §7 error handling → Tasks 6/8 (validation + ownership); §8 testing → every task's TDD steps + the full-suite gates in Tasks 9/15; §9 roadmap impact → Task 15; §10 decisions → reflected throughout (A=dose log, first-class, per-row jsonb cycle, narrow calorie, broadcast via useTodayScenario). No gaps.

**Placeholder scan:** the contract (Task 1) and a few boilerplate-heavy entity/mapper steps reference the mirrored shipped files (`meal.yml`, `MealEntity`, `MealMapper`) by exact path rather than re-pasting their full body — these are concrete pointers to in-repo templates, not "TBD"s; the slice-specific shapes (cycle jsonb, derivation, broadcast, contract paths/schemas) are written in full.

**Type consistency:** `MedicationCycle`(internal record, Task 5) vs `MedicationCycleResponse`(DTO, Task 1) are distinct by design — the mapper (Task 7) bridges them; `MedicationCycle.Cell` → `MedicationCycleCell`. `retaDay` is the single name across BE derivation, DTO, FE types, and the broadcast. `logDose`/`removeDose`/`updateMedication` names are consistent between the hook (Task 11), api client (Task 10), and service/controller (Tasks 6/8).

**Ordering caveat surfaced:** execute **Task 7 before Task 6** (the service consumes the mapper); execute **Task 9 before the first `./mvnw clean test`** (ResetDatabase must truncate the new tables). Both are flagged inline.
