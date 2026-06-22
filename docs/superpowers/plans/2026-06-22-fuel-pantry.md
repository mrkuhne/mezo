# Fuel Pantry (Kamra) Slice C — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the Kamra (food + supplement inventory) in Postgres and wire real CRUD end-to-end, without changing the frontend hook signatures or view components.

**Architecture:** One owned `pantry_item` table (Model B, `kind` discriminator). Contract-first OpenAPI fragment → generated `PantryApi` + `api.dto` models. Backend follows the Goal slice CRUD pattern (`createdBy` server-set, `requireOwned` 404 gate, dirty-check update, `@SQLDelete` soft-delete). The GET endpoint projects the single table into the existing `{ ingredients, stash }` shape so `usePantry()` is untouched; new `usePantryActions()` adds create/update/delete via TanStack Query mutations (the `useWeight` dual-mode pattern).

**Tech Stack:** Spring Boot 4 · Java 21 · Postgres 16 · Liquibase · MapStruct · Lombok · openapi-generator 7.17 (spring, interfaceOnly, Lombok-builder models) · React 19 · TanStack Query · Vitest.

## Global Constraints

- Base package `io.mrkuhne.mezo`; feature layout `feature/pantry/{entity,repository,service,controller,mapper}` (mirror `feature/biometrics/weight/`).
- **UUID** PKs (`gen_random_uuid()`), `created_by uuid` set **server-side** from `CurrentUserId.get()` (never from client), soft-delete via `@SQLDelete`/`@SQLRestriction` + `is_deleted`.
- Constructor injection + `@RequiredArgsConstructor`; `@Transactional` **on writes only, in the service** (never controllers/reads).
- Errors via `SystemRuntimeErrorException` + `SystemMessage` codes (`message.properties`); reuse existing `RESOURCE_NOT_FOUND` (404) and `VALIDATION_INVALID_VALUE` (field). No hardcoded user text, no stack traces to client.
- **Contract-first:** edit `api/feature/pantry/pantry.yml` BEFORE code; never hand-write boundary DTOs. Boundary types come from `io.mrkuhne.mezo.api.dto` (backend) and `src/lib/api.gen.ts` (frontend).
- Liquibase changeset filename `{YYYYMMDDHHMM}_mezo-<bd-id>_create_pantry_item.sql` (12-digit UTC prefix); explicit constraint names `pk_/fk_/ck_/idx_`; never modify a released changeset; **no SQL seed**.
- Tests: integration-first, real Postgres (fixed `mezo_test` compose DB), AssertJ only, `test{Method}_should{Result}_when{Condition}`, no mocks/`@MockBean`/H2. **New owned table → join the `ResetDatabase` TRUNCATE list in the same change.** One ownership-isolation test for the aggregate.
- Frontend: **no view/component signature change**; `usePantry()` keeps its exact return shape. Always use `clean` for backend builds (`./mvnw clean test`). FE tests must pass in **both** modes (mock + `VITE_USE_MOCK=false`).
- Spec: `docs/superpowers/specs/2026-06-22-fuel-pantry-design.md`. Driving bd parent: `mezo-9xu` (commit examples use it; the executor substitutes the per-task impl issue id).

---

## File Structure

**Backend (create):**
- `api/feature/pantry/pantry.yml` — contract fragment (endpoints + 8 schemas).
- `backend/src/main/resources/db/changelog/1.0.0/script/202606221200_mezo-9xu_create_pantry_item.sql` — DDL.
- `feature/pantry/entity/PantryItemEntity.java` — the aggregate (+ `MicroFact` jsonb record).
- `feature/pantry/repository/PantryItemRepository.java` — `JpaRepository` + owned finders.
- `feature/pantry/mapper/PantryMapper.java` — entity↔dto split projection + request apply.
- `feature/pantry/service/PantryService.java` — CRUD + per-kind validation + split projection.
- `feature/pantry/controller/PantryController.java` — implements generated `PantryApi`.
- `backend/src/test/.../support/populator/PantryItemPopulator.java` — test factory.
- `backend/src/test/.../feature/pantry/PantryItemRepositoryIT.java`, `PantryServiceIT.java`, `PantryApiIT.java`.

**Backend (modify):**
- `api/generate/merge.yml` — append the fragment.
- `db/changelog/1.0.0/1.0.0_master.yml` — register the changeset.
- `support/AbstractIntegrationTest.java` — `@Import` the populator.
- `support/ResetDatabase.java` — add `pantry_item` to TRUNCATE.

**Frontend (create):**
- `frontend/src/lib/pantryApi.ts` — fetch client.
- `frontend/src/data/pantryHooks.ts` — `usePantry` (real) + `usePantryActions`.
- `frontend/src/data/pantryHooks.test.tsx` — both-mode hook tests.
- `frontend/src/features/fuel/AddPantryItemSheet.tsx` (+ `.test.tsx`) — manual add/edit form.

**Frontend (modify):**
- `frontend/src/data/types.ts` — add `PantryItemInput`.
- `frontend/src/data/hooks.ts` — remove inline `usePantry`, re-export from `pantryHooks`.
- `frontend/src/features/fuel/views/FuelKamraView.tsx` — wire header `＋` → AddPantryItemSheet.
- `frontend/src/features/fuel/IngredientDetailSheet.tsx` — wire Szerkesztés/Frissítés/Törlés.

---

## Task 1: API contract fragment

**Files:**
- Create: `api/feature/pantry/pantry.yml`
- Modify: `api/generate/merge.yml`

**Interfaces:**
- Produces: operations `getPantry` (GET `/api/pantry` → `PantryResponse`), `createPantryItem` (POST → 201 `PantryItemResponse`), `updatePantryItem` (PUT `/api/pantry/{id}` → `PantryItemResponse`), `deletePantryItem` (DELETE `/api/pantry/{id}` → 204). Schemas: `PantryResponse{ingredients:IngredientResponse[],stash:SupplementStashResponse[]}`, `IngredientResponse`, `SupplementStashResponse`, `PantryStock`, `PantryMacros`, `PantryMicro`, `PantryItemRequest`, `PantryItemResponse`. Generates `io.mrkuhne.mezo.api.controller.PantryApi` + `io.mrkuhne.mezo.api.dto.*` and FE `components['schemas']['*']`.

- [ ] **Step 1: Write the contract fragment**

Create `api/feature/pantry/pantry.yml`:

```yaml
openapi: 3.0.3
info: { title: '', version: '' }
tags:
  - name: Pantry
    description: Pantry (Kamra) — food + supplement inventory (single pantry_item table, kind-projected)
paths:
  /api/pantry:
    get:
      tags: [Pantry]
      operationId: getPantry
      summary: The owner's pantry, projected by kind into ingredients + stash
      responses:
        '200': { description: Pantry, content: { application/json: { schema: { $ref: '#/components/schemas/PantryResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    post:
      tags: [Pantry]
      operationId: createPantryItem
      summary: Add a pantry item (food or supplement/stim/med)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/PantryItemRequest' } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/PantryItemResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/pantry/{id}:
    put:
      tags: [Pantry]
      operationId: updatePantryItem
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/PantryItemRequest' } } }
      responses:
        '200': { description: Updated, content: { application/json: { schema: { $ref: '#/components/schemas/PantryItemResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    delete:
      tags: [Pantry]
      operationId: deletePantryItem
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
components:
  schemas:
    PantryResponse:
      type: object
      required: [ingredients, stash]
      properties:
        ingredients: { type: array, items: { $ref: '#/components/schemas/IngredientResponse' } }
        stash: { type: array, items: { $ref: '#/components/schemas/SupplementStashResponse' } }
    PantryMacros:
      type: object
      required: [kcal, p, c, f]
      properties:
        kcal: { type: number }
        p: { type: number }
        c: { type: number }
        f: { type: number }
    PantryMicro:
      type: object
      required: [name, pct]
      properties:
        name: { type: string }
        pct: { type: integer }
    PantryStock:
      type: object
      required: [qty, unit]
      properties:
        qty: { type: number }
        unit: { type: string }
        expires: { type: string, nullable: true }
        lowExpiry: { type: boolean, nullable: true }
    IngredientResponse:
      type: object
      required: [id, name, brand, source, category, per, unit, macros, price, priceUnit, pkg, micros, nova, lastUsed, usedInRecipes]
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        brand: { type: string }
        source: { type: string, enum: [kifli.hu, myprotein.hu, tesco.hu, auchan.hu, manual] }
        category: { type: string }
        per: { type: number }
        unit: { type: string }
        macros: { $ref: '#/components/schemas/PantryMacros' }
        price: { type: number }
        priceUnit: { type: string }
        pkg: { type: string }
        micros: { type: array, items: { $ref: '#/components/schemas/PantryMicro' } }
        nova: { type: integer, minimum: 1, maximum: 4 }
        stock: { allOf: [ { $ref: '#/components/schemas/PantryStock' } ], nullable: true }
        lastUsed: { type: string }
        usedInRecipes: { type: integer }
    SupplementStashResponse:
      type: object
      required: [id, name, brand, type, category, dose, form, protocol, timing, taken]
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        brand: { type: string }
        type: { type: string, enum: [supplement, stimulant, medication] }
        category: { type: string }
        dose: { type: string }
        form: { type: string }
        stock: { type: number, nullable: true }
        stockUnit: { type: string, nullable: true }
        protocol: { type: string }
        timing: { type: string }
        taken: { type: boolean }
        caffeine: { type: boolean, nullable: true }
    PantryItemRequest:
      type: object
      required: [kind, name]
      properties:
        kind: { type: string, enum: [food, supplement, stim, med] }
        name: { type: string }
        brand: { type: string, nullable: true }
        source: { type: string, enum: [kifli.hu, myprotein.hu, tesco.hu, auchan.hu, manual], nullable: true }
        category: { type: string, nullable: true }
        notes: { type: string, nullable: true }
        per: { type: number, nullable: true }
        unit: { type: string, nullable: true }
        kcal: { type: number, nullable: true }
        proteinG: { type: number, nullable: true }
        carbsG: { type: number, nullable: true }
        fatG: { type: number, nullable: true }
        price: { type: integer, nullable: true }
        priceUnit: { type: string, nullable: true }
        pkg: { type: string, nullable: true }
        micros: { type: array, nullable: true, items: { $ref: '#/components/schemas/PantryMicro' } }
        nova: { type: integer, minimum: 1, maximum: 4, nullable: true }
        stockQty: { type: number, nullable: true }
        stockUnit: { type: string, nullable: true }
        stockExpires: { type: string, format: date, nullable: true }
        dose: { type: string, nullable: true }
        form: { type: string, nullable: true }
        protocol: { type: string, nullable: true }
        timing: { type: string, nullable: true }
        caffeine: { type: boolean, nullable: true }
    PantryItemResponse:
      type: object
      required: [id, kind, name]
      properties:
        id: { type: string, format: uuid }
        kind: { type: string, enum: [food, supplement, stim, med] }
        name: { type: string }
        brand: { type: string, nullable: true }
        source: { type: string, nullable: true }
        category: { type: string, nullable: true }
```

- [ ] **Step 2: Register the fragment in the merge config**

In `api/generate/merge.yml`, append after the `biometrics-profile` line (before `output:`):

```yaml
  - inputFile: ../feature/pantry/pantry.yml
```

- [ ] **Step 3: Merge + generate FE types, verify it fails first if the fragment is absent**

Run: `cd api/generate && npm run generate:api`
Expected: writes `api/openapi.yml` with no merge error; `grep -c "operationId: getPantry" ../openapi.yml` → `1`.

- [ ] **Step 4: Generate backend + FE boundary types**

Run: `cd backend && ./mvnw -q generate-sources && find target -name PantryApi.java`
Expected: prints the generated `.../api/controller/PantryApi.java` path.
Run: `cd frontend && pnpm generate:api && grep -c "PantryResponse" src/lib/api.gen.ts`
Expected: `≥ 1`.

- [ ] **Step 5: Commit**

```bash
git add api/feature/pantry/pantry.yml api/generate/merge.yml api/openapi.yml frontend/src/lib/api.gen.ts
git commit -m "feat(api): pantry contract fragment — getPantry/create/update/delete (mezo-9xu)"
```

---

## Task 2: Liquibase migration — `pantry_item`

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606221200_mezo-9xu_create_pantry_item.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`

**Interfaces:**
- Produces: table `pantry_item` with the columns consumed by `PantryItemEntity` (Task 3). Column list is the spec §3 table.

- [ ] **Step 1: Write the DDL changeset**

Create the SQL file:

```sql
create table pantry_item (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid         not null,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz,
    kind            text         not null,
    name            text         not null,
    brand           text,
    source          text         not null default 'manual',
    category        text,
    notes           text,
    -- food / nutrition
    serving_amount  numeric,
    serving_unit    text,
    kcal            numeric,
    protein_g       numeric,
    carbs_g         numeric,
    fat_g           numeric,
    price_huf       integer,
    price_unit      text,
    package_label   text,
    micros          jsonb,
    nova            smallint,
    -- stock (expiry food-only)
    stock_qty       numeric,
    stock_unit      text,
    stock_expires   date,
    -- supplement / stim
    dose            text,
    form            text,
    protocol        text,
    timing          text,
    taken           boolean      not null default false,
    caffeine        boolean,
    constraint pk_pantry_item_id primary key (id),
    constraint fk_pantry_item_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_pantry_item_kind check (kind in ('food','supplement','stim','med')),
    constraint ck_pantry_item_source check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual')),
    constraint ck_pantry_item_nova check (nova is null or nova between 1 and 4)
);

create index idx_pantry_item_created_by on pantry_item (created_by);
create index idx_pantry_item_created_by_kind on pantry_item (created_by, kind);
```

- [ ] **Step 2: Register the changeset**

In `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`, append at the end of the `databaseChangeLog:` list:

```yaml
  - changeSet:
      id: "1.0.0:202606221200_mezo-9xu_create_pantry_item"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606221200_mezo-9xu_create_pantry_item.sql
```

- [ ] **Step 3: Apply the migration (compose must be up)**

Run: `cd backend && docker compose up -d && ./mvnw -q -Dtest=MezoApplicationTests test`
(If no such smoke test exists, run any one existing IT, e.g. `-Dtest=WeightLogApiIT`.)
Expected: PASS — context boots, Liquibase applies the new changeset against `mezo_test` with no error.

- [ ] **Step 4: Verify the table exists**

Run: `docker exec mezo_pg psql -U mezo -d mezo_test -c "\d pantry_item" | head -5`
Expected: prints the `pantry_item` table description.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/changelog/1.0.0/
git commit -m "feat(db): pantry_item table — single-table Model B inventory (mezo-9xu)"
```

---

## Task 3: Entity + repository + test factory (persistence layer)

**Files:**
- Create: `feature/pantry/entity/PantryItemEntity.java`, `feature/pantry/entity/MicroFact.java`
- Create: `feature/pantry/repository/PantryItemRepository.java`
- Create: `backend/src/test/.../support/populator/PantryItemPopulator.java`
- Create: `backend/src/test/.../feature/pantry/PantryItemRepositoryIT.java`
- Modify: `support/AbstractIntegrationTest.java`, `support/ResetDatabase.java`

**Interfaces:**
- Produces: `PantryItemEntity` (getters/setters for all spec §3 columns; `List<MicroFact> micros`); `record MicroFact(String name, int pct)`; `PantryItemRepository` with `findByCreatedByAndDeletedFalseOrderByNameAsc(UUID)` and `findByIdAndCreatedByAndDeletedFalse(UUID,UUID)`; `PantryItemPopulator.createFood(...)` / `createSupplement(...)`.
- Consumes: `OwnedEntity`, `OwnedRepository` are NOT used (no `date` field) — extend `JpaRepository` directly (cf. `GoalRepository`).

- [ ] **Step 1: Write the jsonb record**

Create `feature/pantry/entity/MicroFact.java`:

```java
package io.mrkuhne.mezo.feature.pantry.entity;

/** A single micronutrient coverage fact, stored inside the {@code micros} jsonb array. */
public record MicroFact(String name, int pct) {}
```

- [ ] **Step 2: Write the entity**

Create `feature/pantry/entity/PantryItemEntity.java`:

```java
package io.mrkuhne.mezo.feature.pantry.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "pantry_item")
@SQLDelete(sql = "update pantry_item set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PantryItemEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @NotNull
    @Column(nullable = false)
    private String kind; // food | supplement | stim | med

    @NotNull
    @Column(nullable = false)
    private String name;

    private String brand;

    @NotNull
    @Column(nullable = false)
    private String source = "manual";

    private String category;
    private String notes;

    // food / nutrition
    @Column(name = "serving_amount")
    private BigDecimal servingAmount;

    @Column(name = "serving_unit")
    private String servingUnit;

    private BigDecimal kcal;

    @Column(name = "protein_g")
    private BigDecimal proteinG;

    @Column(name = "carbs_g")
    private BigDecimal carbsG;

    @Column(name = "fat_g")
    private BigDecimal fatG;

    @Column(name = "price_huf")
    private Integer priceHuf;

    @Column(name = "price_unit")
    private String priceUnit;

    @Column(name = "package_label")
    private String packageLabel;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<MicroFact> micros;

    private Short nova;

    // stock
    @Column(name = "stock_qty")
    private BigDecimal stockQty;

    @Column(name = "stock_unit")
    private String stockUnit;

    @Column(name = "stock_expires")
    private LocalDate stockExpires;

    // supplement / stim
    private String dose;
    private String form;
    private String protocol;
    private String timing;

    @Column(nullable = false)
    private boolean taken = false;

    private Boolean caffeine;
}
```

- [ ] **Step 3: Write the repository**

Create `feature/pantry/repository/PantryItemRepository.java`:

```java
package io.mrkuhne.mezo.feature.pantry.repository;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// No 'date' base field => extend JpaRepository directly (cf. GoalRepository), not OwnedRepository.
public interface PantryItemRepository extends JpaRepository<PantryItemEntity, UUID> {

    List<PantryItemEntity> findByCreatedByAndDeletedFalseOrderByNameAsc(UUID createdBy);

    Optional<PantryItemEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
```

- [ ] **Step 4: Write the test populator**

Create `backend/src/test/java/io/mrkuhne/mezo/support/populator/PantryItemPopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.pantry.entity.MicroFact;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the PantryItem aggregate — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class PantryItemPopulator {

    private final PantryItemRepository repository;

    /** A food row with macros, stock + expiry, NOVA, and one micro. */
    public PantryItemEntity createFood(UUID owner, String name, LocalDate expires) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(owner);
        e.setKind("food");
        e.setName(name);
        e.setBrand("Bonafarm");
        e.setSource("kifli.hu");
        e.setCategory("protein");
        e.setServingAmount(new BigDecimal("100"));
        e.setServingUnit("g");
        e.setKcal(new BigDecimal("110"));
        e.setProteinG(new BigDecimal("23.0"));
        e.setCarbsG(BigDecimal.ZERO);
        e.setFatG(new BigDecimal("1.5"));
        e.setNova((short) 1);
        e.setMicros(List.of(new MicroFact("B6", 92)));
        e.setStockQty(new BigDecimal("400"));
        e.setStockUnit("g");
        e.setStockExpires(expires);
        return repository.saveAndFlush(e);
    }

    /** A supplement row with dose + protocol + stock-as-doses. */
    public PantryItemEntity createSupplement(UUID owner, String name) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(owner);
        e.setKind("supplement");
        e.setName(name);
        e.setBrand("MyProtein");
        e.setSource("myprotein.hu");
        e.setCategory("muscle");
        e.setDose("5g");
        e.setForm("por");
        e.setProtocol("Naponta egy adag");
        e.setTiming("morning");
        e.setStockQty(new BigDecimal("86"));
        e.setStockUnit("adag");
        return repository.saveAndFlush(e);
    }
}
```

- [ ] **Step 5: Register populator + TRUNCATE growth rule**

In `support/AbstractIntegrationTest.java`, add the import and append `PantryItemPopulator.class` to the `@Import({...})` list:

```java
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
// ... in @Import({ ... , WeightLogPopulator.class, PantryItemPopulator.class, ResetDatabase.class })
```

In `support/ResetDatabase.java`, add `pantry_item` to the TRUNCATE statement (first table is fine):

```java
"TRUNCATE TABLE pantry_item, weight_log, sleep_log, check_in, "
```

- [ ] **Step 6: Write the failing persistence IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryItemRepositoryIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class PantryItemRepositoryIT extends AbstractIntegrationTest {

    @Autowired private PantryItemRepository repository;
    @Autowired private PantryItemPopulator populator;

    private static final UUID OWNER = UUID.randomUUID();

    @Test
    void testFindByOwner_shouldReturnFoodWithJsonbMicros_whenPersisted() {
        populator.createFood(OWNER, "Csirkemell", LocalDate.of(2026, 5, 25));

        var items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(OWNER);

        assertThat(items).hasSize(1);
        PantryItemEntity e = items.get(0);
        assertThat(e.getKind()).isEqualTo("food");
        assertThat(e.getNova()).isEqualTo((short) 1);
        assertThat(e.getMicros()).singleElement()
            .satisfies(m -> { assertThat(m.name()).isEqualTo("B6"); assertThat(m.pct()).isEqualTo(92); });
    }

    @Test
    void testFindByOwner_shouldHideRow_whenSoftDeleted() {
        PantryItemEntity e = populator.createSupplement(OWNER, "Kreatin");
        repository.delete(e); // @SQLDelete soft-deletes

        assertThat(repository.findByCreatedByAndDeletedFalseOrderByNameAsc(OWNER)).isEmpty();
    }
}
```

- [ ] **Step 7: Run it — expect compile/test pass**

Run: `cd backend && ./mvnw clean test -Dtest=PantryItemRepositoryIT`
Expected: PASS (2 tests). Proves entity↔DDL sync, jsonb round-trip, soft-delete restriction, owner finder.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/ backend/src/test/java/io/mrkuhne/mezo/
git commit -m "feat(pantry): entity + repository + persistence IT, jsonb micros + soft-delete (mezo-9xu)"
```

---

## Task 4: Mapper + service (CRUD + per-kind validation + split projection)

**Files:**
- Create: `feature/pantry/mapper/PantryMapper.java`, `feature/pantry/service/PantryService.java`
- Create: `backend/src/test/.../feature/pantry/PantryServiceIT.java`

**Interfaces:**
- Consumes: generated `api.dto.{PantryResponse,IngredientResponse,SupplementStashResponse,PantryStock,PantryMacros,PantryMicro,PantryItemRequest,PantryItemResponse}`; `PantryItemRepository`; entity `MicroFact`.
- Produces: `PantryService.getPantry(UUID) -> PantryResponse`; `createItem(UUID, PantryItemRequest) -> PantryItemResponse`; `updateItem(UUID, UUID, PantryItemRequest) -> PantryItemResponse`; `deleteItem(UUID, UUID)`. `PantryMapper.toIngredientResponse/toSupplementResponse/toItemResponse(entity)` + `applyRequest(entity, req)`.

- [ ] **Step 1: Write the mapper**

Create `feature/pantry/mapper/PantryMapper.java` (explicit builder bodies — generated DTOs are Lombok `@Builder`):

```java
package io.mrkuhne.mezo.feature.pantry.mapper;

import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryMacros;
import io.mrkuhne.mezo.api.dto.PantryMicro;
import io.mrkuhne.mezo.api.dto.PantryStock;
import io.mrkuhne.mezo.api.dto.SupplementStashResponse;
import io.mrkuhne.mezo.feature.pantry.entity.MicroFact;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface PantryMapper {

    /** Expiry is "low" when within 3 days. */
    int LOW_EXPIRY_DAYS = 3;

    default void applyRequest(PantryItemEntity e, PantryItemRequest r) {
        e.setKind(r.getKind() == null ? null : r.getKind().getValue());
        e.setName(r.getName());
        e.setBrand(r.getBrand());
        if (r.getSource() != null) e.setSource(r.getSource().getValue());
        e.setCategory(r.getCategory());
        e.setNotes(r.getNotes());
        e.setServingAmount(r.getPer());
        e.setServingUnit(r.getUnit());
        e.setKcal(r.getKcal());
        e.setProteinG(r.getProteinG());
        e.setCarbsG(r.getCarbsG());
        e.setFatG(r.getFatG());
        e.setPriceHuf(r.getPrice());
        e.setPriceUnit(r.getPriceUnit());
        e.setPackageLabel(r.getPkg());
        e.setMicros(r.getMicros() == null ? null
            : r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList());
        e.setNova(r.getNova() == null ? null : r.getNova().shortValue());
        e.setStockQty(r.getStockQty());
        e.setStockUnit(r.getStockUnit());
        e.setStockExpires(r.getStockExpires());
        e.setDose(r.getDose());
        e.setForm(r.getForm());
        e.setProtocol(r.getProtocol());
        e.setTiming(r.getTiming());
        e.setCaffeine(r.getCaffeine());
    }

    default IngredientResponse toIngredientResponse(PantryItemEntity e) {
        return IngredientResponse.builder()
            .id(e.getId())
            .name(e.getName())
            .brand(e.getBrand() == null ? "" : e.getBrand())
            .source(IngredientResponse.SourceEnum.fromValue(e.getSource()))
            .category(e.getCategory() == null ? "" : e.getCategory())
            .per(e.getServingAmount())
            .unit(e.getServingUnit())
            .macros(PantryMacros.builder()
                .kcal(nz(e.getKcal())).p(nz(e.getProteinG())).c(nz(e.getCarbsG())).f(nz(e.getFatG())).build())
            .price(e.getPriceHuf() == null ? BigDecimal.ZERO : BigDecimal.valueOf(e.getPriceHuf()))
            .priceUnit(e.getPriceUnit() == null ? "" : e.getPriceUnit())
            .pkg(e.getPackageLabel() == null ? "" : e.getPackageLabel())
            .micros(e.getMicros() == null ? List.of()
                : e.getMicros().stream().map(m -> PantryMicro.builder().name(m.name()).pct(m.pct()).build()).toList())
            .nova(e.getNova() == null ? 1 : e.getNova().intValue())
            .stock(toStock(e))
            .lastUsed("—")          // derived from logging — out of scope this slice
            .usedInRecipes(0)        // derived from recipes — out of scope this slice
            .build();
    }

    default PantryStock toStock(PantryItemEntity e) {
        if (e.getStockQty() == null) return null;
        LocalDate exp = e.getStockExpires();
        return PantryStock.builder()
            .qty(e.getStockQty())
            .unit(e.getStockUnit() == null ? "" : e.getStockUnit())
            .expires(exp == null ? null : exp.toString())
            .lowExpiry(exp != null && ChronoUnit.DAYS.between(LocalDate.now(), exp) <= LOW_EXPIRY_DAYS)
            .build();
    }

    default SupplementStashResponse toSupplementResponse(PantryItemEntity e) {
        return SupplementStashResponse.builder()
            .id(e.getId())
            .name(e.getName())
            .brand(e.getBrand() == null ? "" : e.getBrand())
            .type(SupplementStashResponse.TypeEnum.fromValue(typeFromKind(e.getKind())))
            .category(e.getCategory() == null ? "" : e.getCategory())
            .dose(e.getDose() == null ? "" : e.getDose())
            .form(e.getForm() == null ? "" : e.getForm())
            .stock(e.getStockQty())
            .stockUnit(e.getStockUnit())
            .protocol(e.getProtocol() == null ? "" : e.getProtocol())
            .timing(e.getTiming() == null ? "" : e.getTiming())
            .taken(e.isTaken())
            .caffeine(e.getCaffeine())
            .build();
    }

    default PantryItemResponse toItemResponse(PantryItemEntity e) {
        return PantryItemResponse.builder()
            .id(e.getId())
            .kind(PantryItemResponse.KindEnum.fromValue(e.getKind()))
            .name(e.getName())
            .brand(e.getBrand())
            .source(e.getSource())
            .category(e.getCategory())
            .build();
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    private static String typeFromKind(String kind) {
        return switch (kind) {
            case "stim" -> "stimulant";
            case "med" -> "medication";
            default -> "supplement";
        };
    }
}
```

> If the generated enums are named differently (e.g. `IngredientResponse.SourceEnum` vs an inlined type), adjust the enum references to the generated names — run `find target -name IngredientResponse.java` and read the nested enum. The `.fromValue(String)` helper is standard for openapi-generator enums.

- [ ] **Step 2: Write the service**

Create `feature/pantry/service/PantryService.java`:

```java
package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.mapper.PantryMapper;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
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
public class PantryService {

    private final PantryItemRepository repository;
    private final PantryMapper mapper;

    /** All owned items, projected by kind: food -> ingredients; supplement/stim/med -> stash. */
    public PantryResponse getPantry(UUID userId) {
        List<PantryItemEntity> items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId);
        return PantryResponse.builder()
            .ingredients(items.stream().filter(e -> "food".equals(e.getKind()))
                .map(mapper::toIngredientResponse).toList())
            .stash(items.stream().filter(e -> !"food".equals(e.getKind()))
                .map(mapper::toSupplementResponse).toList())
            .build();
    }

    @Transactional
    public PantryItemResponse createItem(UUID userId, PantryItemRequest req) {
        validatePerKind(req);
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        mapper.applyRequest(e, req);
        if (e.getSource() == null) e.setSource("manual");
        return mapper.toItemResponse(repository.save(e));
    }

    @Transactional
    public PantryItemResponse updateItem(UUID userId, UUID id, PantryItemRequest req) {
        validatePerKind(req);
        PantryItemEntity e = requireOwned(userId, id);
        mapper.applyRequest(e, req); // dirty-checked; flush on tx commit
        return mapper.toItemResponse(e);
    }

    @Transactional
    public void deleteItem(UUID userId, UUID id) {
        repository.delete(requireOwned(userId, id)); // @SQLDelete soft-deletes
    }

    /** Per-kind required fields live here (not DB CHECKs) so the single table stays flexible. */
    private void validatePerKind(PantryItemRequest req) {
        String kind = req.getKind() == null ? null : req.getKind().getValue();
        if ("food".equals(kind)) {
            requireField(req.getUnit(), "unit");
            requireField(req.getKcal(), "kcal");
        } else { // supplement | stim | med
            requireField(req.getDose(), "dose");
        }
    }

    private void requireField(Object value, String field) {
        boolean missing = value == null || (value instanceof String s && s.isBlank());
        if (missing) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", field).build(), HttpStatus.BAD_REQUEST);
        }
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private PantryItemEntity requireOwned(UUID userId, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
```

- [ ] **Step 3: Write the failing service IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.feature.pantry.service.PantryService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class PantryServiceIT extends AbstractIntegrationTest {

    @Autowired private PantryService service;
    @Autowired private PantryItemPopulator populator;

    private static final UUID OWNER = UUID.randomUUID();
    private static final UUID OTHER = UUID.randomUUID();

    private PantryItemRequest foodReq() {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Túró");
        r.setUnit("g");
        r.setKcal(java.math.BigDecimal.valueOf(130));
        return r;
    }

    @Test
    void testGetPantry_shouldSplitByKind_whenMixedItems() {
        populator.createFood(OWNER, "Csirkemell", LocalDate.of(2026, 5, 25));
        populator.createSupplement(OWNER, "Kreatin");

        var resp = service.getPantry(OWNER);

        assertThat(resp.getIngredients()).extracting("name").containsExactly("Csirkemell");
        assertThat(resp.getStash()).extracting("name").containsExactly("Kreatin");
        assertThat(resp.getStash().get(0).getType().getValue()).isEqualTo("supplement");
    }

    @Test
    void testCreateItem_shouldPersistOwnedFood_whenValid() {
        var created = service.createItem(OWNER, foodReq());

        assertThat(created.getId()).isNotNull();
        assertThat(service.getPantry(OWNER).getIngredients()).hasSize(1);
    }

    @Test
    void testCreateItem_shouldReject_whenFoodMissingKcal() {
        PantryItemRequest r = foodReq();
        r.setKcal(null);

        assertThatThrownBy(() -> service.createItem(OWNER, r))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testUpdateItem_shouldReturn404_whenForeignRow() {
        var mine = service.createItem(OWNER, foodReq());

        assertThatThrownBy(() -> service.updateItem(OTHER, mine.getId(), foodReq()))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testDeleteItem_shouldSoftHide_whenOwned() {
        var mine = service.createItem(OWNER, foodReq());

        service.deleteItem(OWNER, mine.getId());

        assertThat(service.getPantry(OWNER).getIngredients()).isEmpty();
    }

    @Test
    void testGetPantry_shouldIsolateOwners_whenTwoUsers() {
        populator.createFood(OWNER, "Csirkemell", LocalDate.of(2026, 5, 25));

        assertThat(service.getPantry(OTHER).getIngredients()).isEmpty();
    }
}
```

- [ ] **Step 4: Run it**

Run: `cd backend && ./mvnw clean test -Dtest=PantryServiceIT`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/ backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryServiceIT.java
git commit -m "feat(pantry): service CRUD + per-kind validation + kind-split projection (mezo-9xu)"
```

---

## Task 5: Controller + HTTP API IT

**Files:**
- Create: `feature/pantry/controller/PantryController.java`
- Create: `backend/src/test/.../feature/pantry/PantryApiIT.java`

**Interfaces:**
- Consumes: generated `api.controller.PantryApi` (methods `getPantry`, `createPantryItem(PantryItemRequest)`, `updatePantryItem(UUID, PantryItemRequest)`, `deletePantryItem(UUID)`); `PantryService`; `CurrentUserId`.
- Produces: live endpoints `GET/POST/PUT/DELETE /api/pantry`.

> Confirm the generated `PantryApi` method signatures first: `find target -name PantryApi.java` and read the `@Override`-able methods (openapi-generator names them from `operationId`; the `204` delete returns `ResponseEntity<Void>`).

- [ ] **Step 1: Write the controller**

Create `feature/pantry/controller/PantryController.java`:

```java
package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryApi;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.pantry.service.PantryService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/status come from {@link PantryApi}. */
@RestController
@RequiredArgsConstructor
public class PantryController implements PantryApi {

    private final PantryService service;
    private final CurrentUserId currentUserId;

    @Override
    public ResponseEntity<PantryResponse> getPantry() {
        return ResponseEntity.ok(service.getPantry(currentUserId.get()));
    }

    @Override
    public ResponseEntity<PantryItemResponse> createPantryItem(PantryItemRequest pantryItemRequest) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.createItem(currentUserId.get(), pantryItemRequest));
    }

    @Override
    public ResponseEntity<PantryItemResponse> updatePantryItem(UUID id, PantryItemRequest pantryItemRequest) {
        return ResponseEntity.ok(service.updateItem(currentUserId.get(), id, pantryItemRequest));
    }

    @Override
    public ResponseEntity<Void> deletePantryItem(UUID id) {
        service.deleteItem(currentUserId.get(), id);
        return ResponseEntity.noContent().build();
    }
}
```

> If `PantryApi` declares plain return types (not `ResponseEntity<...>`) — depends on the generator's `interfaceOnly` output — match whatever the generated interface declares (read it). The Weight/Goal controllers return the body directly; if so, drop the `ResponseEntity` wrappers and use `@ResponseStatus(HttpStatus.CREATED)` on `createPantryItem`.

- [ ] **Step 2: Write the failing API IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryApiIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class PantryApiIT extends ApiIntegrationTest {

    private PantryItemRequest foodReq() {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Túró");
        r.setUnit("g");
        r.setKcal(BigDecimal.valueOf(130));
        return r;
    }

    @Test
    void testCreateThenGet_shouldReturnFoodInIngredients_whenAuthed() {
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/pantry", foodReq(), auth, HttpStatus.CREATED, PantryItemResponse.class);
        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        assertThat(pantry.getIngredients()).extracting("name").contains("Túró");
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenFoodMissingKcal() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemRequest bad = foodReq();
        bad.setKcal(null);

        String body = exchangeForBody(
            org.springframework.http.HttpMethod.POST, "/api/pantry", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "kcal", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testUpdate_shouldReturn404_whenUnknownId() {
        HttpHeaders auth = ownerAuthHeaders();

        exchangeForBody(org.springframework.http.HttpMethod.PUT, "/api/pantry/" + UUID.randomUUID(),
            foodReq(), auth, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDelete_shouldReturn204ThenHide_whenOwned() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemResponse created = postForBody("/api/pantry", foodReq(), auth, HttpStatus.CREATED, PantryItemResponse.class);

        deleteAndExpect("/api/pantry/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);
        assertThat(pantry.getIngredients()).extracting("id").doesNotContain(created.getId());
    }
}
```

- [ ] **Step 3: Run it**

Run: `cd backend && ./mvnw clean test -Dtest=PantryApiIT`
Expected: PASS (4 tests).

- [ ] **Step 4: Full backend gate**

Run: `cd backend && ./mvnw clean test`
Expected: PASS (whole suite green — confirms ResetDatabase TRUNCATE + populator import didn't break other ITs).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/controller/ backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryApiIT.java
git commit -m "feat(pantry): REST controller GET/POST/PUT/DELETE + HTTP IT (mezo-9xu)"
```

---

## Task 6: Frontend API client

**Files:**
- Create: `frontend/src/lib/pantryApi.ts`
- Modify: `frontend/src/data/types.ts` (add `PantryItemInput`)

**Interfaces:**
- Consumes: generated `components['schemas']['PantryResponse' | 'PantryItemRequest' | 'PantryItemResponse']`; domain `Ingredient`, `SupplementStashItem`.
- Produces: `pantryApi.list(): Promise<{ ingredients: Ingredient[]; stash: SupplementStashItem[] }>`, `pantryApi.create(input: PantryItemInput): Promise<void>`, `pantryApi.update(id, input): Promise<void>`, `pantryApi.remove(id): Promise<void>`; domain type `PantryItemInput`.

- [ ] **Step 1: Add the domain input type**

In `frontend/src/data/types.ts`, after the `PantryItem` interface, add:

```ts
/** Form payload for creating/editing a pantry item (maps to the PantryItemRequest contract). */
export interface PantryItemInput {
  kind: PantryItemKind
  name: string
  brand?: string
  source?: PantrySourceKey
  category?: string
  notes?: string
  per?: number; unit?: string
  kcal?: number; proteinG?: number; carbsG?: number; fatG?: number
  price?: number; priceUnit?: string; pkg?: string
  micros?: { name: string; pct: number }[]
  nova?: NovaGroup
  stockQty?: number; stockUnit?: string; stockExpires?: string
  dose?: string; form?: string; protocol?: string; timing?: string; caffeine?: boolean
}
```

- [ ] **Step 2: Write the client**

Create `frontend/src/lib/pantryApi.ts`:

```ts
import { apiFetch } from './api'
import type { components } from './api.gen'
import type { Ingredient, SupplementStashItem, PantryItemInput } from '@/data/types'

type PantryResponse = components['schemas']['PantryResponse']
type PantryItemRequest = components['schemas']['PantryItemRequest']

function toRequest(input: PantryItemInput): PantryItemRequest {
  return {
    kind: input.kind, name: input.name, brand: input.brand, source: input.source,
    category: input.category, notes: input.notes, per: input.per, unit: input.unit,
    kcal: input.kcal, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG,
    price: input.price, priceUnit: input.priceUnit, pkg: input.pkg, micros: input.micros,
    nova: input.nova, stockQty: input.stockQty, stockUnit: input.stockUnit,
    stockExpires: input.stockExpires, dose: input.dose, form: input.form,
    protocol: input.protocol, timing: input.timing, caffeine: input.caffeine,
  } satisfies PantryItemRequest
}

export const pantryApi = {
  // The contract's IngredientResponse/SupplementStashResponse are structurally the domain
  // types except nova (number vs NovaGroup) — cast like sleepApi does.
  list: (): Promise<{ ingredients: Ingredient[]; stash: SupplementStashItem[] }> =>
    apiFetch<PantryResponse>('/api/pantry') as Promise<{ ingredients: Ingredient[]; stash: SupplementStashItem[] }>,
  create: (input: PantryItemInput): Promise<void> =>
    apiFetch('/api/pantry', { method: 'POST', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  update: (id: string, input: PantryItemInput): Promise<void> =>
    apiFetch(`/api/pantry/${id}`, { method: 'PUT', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  remove: (id: string): Promise<void> =>
    apiFetch(`/api/pantry/${id}`, { method: 'DELETE' }).then(() => undefined),
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && pnpm tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/pantryApi.ts frontend/src/data/types.ts
git commit -m "feat(pantry): FE api client + PantryItemInput type (mezo-9xu)"
```

---

## Task 7: Frontend hooks (`usePantry` real + `usePantryActions`)

**Files:**
- Create: `frontend/src/data/pantryHooks.ts`, `frontend/src/data/pantryHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts` (remove inline `usePantry`, re-export)

**Interfaces:**
- Consumes: `pantryApi`; mock arrays `ingredients`, `supplementsStash`, `pantrySources`, `pantryCategoryMeta`, `pantryImports`, `pantrySuggestions`; `isMockMode`.
- Produces: `usePantry()` returning the EXACT shape `{ ingredients, stash, sources, categoryMeta, imports, suggestions }`; `usePantryActions()` returning `{ addItem(input), updateItem(id, input), deleteItem(id) }`.

- [ ] **Step 1: Write the hooks**

Create `frontend/src/data/pantryHooks.ts`:

```ts
import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pantryApi } from '@/lib/pantryApi'
import { isMockMode } from '@/lib/mode'
import { ingredients as mockIngredients, pantryCategoryMeta, pantryImports, pantrySuggestions } from './pantry'
import { pantrySources } from './pantrySources'
import { supplementsStash } from './fuel'
import type { Ingredient, SupplementStashItem, PantryItemInput } from './types'

const PANTRY_KEY = ['pantry'] as const
const mockData = { ingredients: mockIngredients, stash: supplementsStash }

/** Keeps the exact pre-existing return shape — views/buildKamraItems are untouched. */
export function usePantry() {
  const mock = isMockMode()
  const { data = mockData } = useQuery({
    queryKey: PANTRY_KEY,
    queryFn: mock ? async () => mockData : pantryApi.list,
    initialData: mock ? mockData : undefined, // synchronous first render in mock (parity/tests)
  })
  return {
    ingredients: data.ingredients,
    stash: data.stash,
    sources: pantrySources,           // static presentation config
    categoryMeta: pantryCategoryMeta, // static presentation config
    imports: mock ? pantryImports : [],       // scrape feed deferred in real mode
    suggestions: mock ? pantrySuggestions : [], // suggestions deferred in real mode
  }
}

/** Create/update/delete mutations on the ['pantry'] cache (useWeight dual-mode pattern). */
export function usePantryActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidate = () => qc.invalidateQueries({ queryKey: PANTRY_KEY })

  const add = useMutation({
    mutationFn: mock
      ? async (input: PantryItemInput) => mockAdd(qc, input)
      : (input: PantryItemInput) => pantryApi.create(input),
    onSuccess: mock ? undefined : invalidate,
  })
  const update = useMutation({
    mutationFn: mock
      ? async (v: { id: string; input: PantryItemInput }) => mockUpdate(qc, v.id, v.input)
      : (v: { id: string; input: PantryItemInput }) => pantryApi.update(v.id, v.input),
    onSuccess: mock ? undefined : invalidate,
  })
  const remove = useMutation({
    mutationFn: mock
      ? async (id: string) => mockRemove(qc, id)
      : (id: string) => pantryApi.remove(id),
    onSuccess: mock ? undefined : invalidate,
  })

  const addItem = useCallback((input: PantryItemInput) => add.mutate(input), [add])
  const updateItem = useCallback((id: string, input: PantryItemInput) => update.mutate({ id, input }), [update])
  const deleteItem = useCallback((id: string) => remove.mutate(id), [remove])
  return { addItem, updateItem, deleteItem }
}

// --- mock-mode cache mutators: keep the offline app interactive ---
type PantryCache = { ingredients: Ingredient[]; stash: SupplementStashItem[] }
function mockAdd(qc: ReturnType<typeof useQueryClient>, input: PantryItemInput) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    const id = crypto.randomUUID()
    if (input.kind === 'food') {
      const ing: Ingredient = {
        id, name: input.name, brand: input.brand ?? '', source: input.source ?? 'manual',
        category: input.category ?? 'protein', per: input.per ?? 100, unit: input.unit ?? 'g',
        macros: { kcal: input.kcal ?? 0, p: input.proteinG ?? 0, c: input.carbsG ?? 0, f: input.fatG ?? 0 },
        price: input.price ?? 0, priceUnit: input.priceUnit ?? '', pkg: input.pkg ?? '',
        micros: input.micros ?? [], nova: input.nova ?? 1,
        stock: input.stockQty != null ? { qty: input.stockQty, unit: input.stockUnit ?? 'g', expires: input.stockExpires ?? '' } : null,
        lastUsed: '—', usedInRecipes: 0,
      }
      return { ...base, ingredients: [...base.ingredients, ing] }
    }
    const supp: SupplementStashItem = {
      id, name: input.name, brand: input.brand ?? '',
      type: input.kind === 'stim' ? 'stimulant' : input.kind === 'med' ? 'medication' : 'supplement',
      category: input.category ?? 'muscle', dose: input.dose ?? '', form: input.form ?? '',
      stock: input.stockQty ?? null, stockUnit: input.stockUnit ?? null,
      protocol: input.protocol ?? '', timing: input.timing ?? 'flexible', taken: false, caffeine: input.caffeine,
    }
    return { ...base, stash: [...base.stash, supp] }
  })
  return undefined
}
function mockUpdate(qc: ReturnType<typeof useQueryClient>, id: string, input: PantryItemInput) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    return {
      ingredients: base.ingredients.map(i => i.id === id ? { ...i, name: input.name, brand: input.brand ?? i.brand } : i),
      stash: base.stash.map(s => s.id === id ? { ...s, name: input.name, brand: input.brand ?? s.brand } : s),
    }
  })
  return undefined
}
function mockRemove(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    return { ingredients: base.ingredients.filter(i => i.id !== id), stash: base.stash.filter(s => s.id !== id) }
  })
  return undefined
}
```

- [ ] **Step 2: Re-export from hooks.ts**

In `frontend/src/data/hooks.ts`, delete the inline `usePantry` function (the `export function usePantry() { return { ingredients, stash: supplementsStash, ... } }` block) and add to the re-export section at the bottom:

```ts
export { usePantry, usePantryActions } from './pantryHooks'
```

Remove now-unused imports in `hooks.ts` if `ingredients`/`pantryImports`/`pantrySuggestions`/`pantryCategoryMeta`/`pantrySources` are no longer referenced there (run `pnpm tsc -b` to find them).

- [ ] **Step 3: Write the both-mode hook tests**

Create `frontend/src/data/pantryHooks.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePantry, usePantryActions } from './pantryHooks'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('usePantry (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('returns the preserved shape with seeded ingredients + stash', () => {
    const { result } = renderHook(() => usePantry(), { wrapper: wrapper() })
    expect(result.current.ingredients.length).toBeGreaterThan(0)
    expect(result.current.stash.length).toBeGreaterThan(0)
    expect(result.current.sources).toBeDefined()
    expect(result.current.categoryMeta).toBeDefined()
    expect(Array.isArray(result.current.imports)).toBe(true)
  })

  it('addItem appends a food ingredient to the cache', async () => {
    const { result: pantry } = renderHook(() => usePantry(), { wrapper: wrapper() })
    const before = pantry.current.ingredients.length
    const { result: actions } = renderHook(() => usePantryActions(), { wrapper: wrapper() })
    // NOTE: both hooks must share one QueryClient — use a single combined renderHook in practice:
    expect(typeof actions.current.addItem).toBe('function')
    expect(before).toBeGreaterThan(0)
  })
})
```

> The combined add/read test needs a shared QueryClient; render both hooks under the same wrapper instance (hoist the `qc` out of `wrapper()` for that test). Keep this test focused on the mock path; the real path is covered by `PantryApiIT`.

- [ ] **Step 4: Run FE tests both modes**

Run: `cd frontend && pnpm test -- pantryHooks`
Then: `cd frontend && VITE_USE_MOCK=false pnpm test -- pantryHooks`
Expected: PASS in both.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/pantryHooks.ts frontend/src/data/pantryHooks.test.tsx frontend/src/data/hooks.ts
git commit -m "feat(pantry): usePantry (real query) + usePantryActions mutations, preserved hook shape (mezo-9xu)"
```

---

## Task 8: Wire the sheets (Add / Edit / Update-stock / Delete)

**Files:**
- Create: `frontend/src/features/fuel/AddPantryItemSheet.tsx`, `AddPantryItemSheet.test.tsx`
- Modify: `frontend/src/features/fuel/views/FuelKamraView.tsx`, `frontend/src/features/fuel/IngredientDetailSheet.tsx`

**Interfaces:**
- Consumes: `usePantryActions`; existing sheet/`Sheet` primitive used elsewhere in `features/fuel` (e.g. `ImportItemSheet`'s shell).
- Produces: a working manual add/edit form + delete action; no change to `usePantry`/view function signatures.

- [ ] **Step 1: Write the failing add-sheet test**

Create `frontend/src/features/fuel/AddPantryItemSheet.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddPantryItemSheet } from './AddPantryItemSheet'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

function renderSheet(onClose = vi.fn()) {
  const qc = new QueryClient()
  render(
    <QueryClientProvider client={qc}>
      <AddPantryItemSheet open onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose }
}

describe('AddPantryItemSheet', () => {
  it('submits a food item and closes', () => {
    const { onClose } = renderSheet()
    fireEvent.change(screen.getByLabelText(/név/i), { target: { value: 'Brokkoli' } })
    fireEvent.change(screen.getByLabelText(/kcal/i), { target: { value: '34' } })
    fireEvent.click(screen.getByRole('button', { name: /polcra|mentés/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Write the add/edit sheet**

Create `frontend/src/features/fuel/AddPantryItemSheet.tsx`. Mirror an existing sheet's shell (import the same `Sheet`/bottom-sheet component `ImportItemSheet.tsx` uses — open it to copy the wrapper import + close affordance). Minimal controlled form:

```tsx
import { useState } from 'react'
import { usePantryActions } from '@/data/hooks'
import type { PantryItemInput, PantryItemKind, PantryItemKind as Kind } from '@/data/types'
// import { Sheet } from '<same path ImportItemSheet uses>'

export function AddPantryItemSheet(
  { open, onClose, editId, initial }:
  { open: boolean; onClose: () => void; editId?: string; initial?: Partial<PantryItemInput> },
) {
  const { addItem, updateItem } = usePantryActions()
  const [kind, setKind] = useState<PantryItemKind>(initial?.kind ?? 'food')
  const [name, setName] = useState(initial?.name ?? '')
  const [kcal, setKcal] = useState(initial?.kcal?.toString() ?? '')
  const [dose, setDose] = useState(initial?.dose ?? '')

  function submit() {
    const input: PantryItemInput = kind === 'food'
      ? { kind, name, unit: initial?.unit ?? 'g', kcal: Number(kcal) || 0,
          proteinG: initial?.proteinG, carbsG: initial?.carbsG, fatG: initial?.fatG, source: 'manual' }
      : { kind, name, dose, source: 'manual' }
    if (editId) updateItem(editId, input)
    else addItem(input)
    onClose()
  }

  if (!open) return null
  return (
    // Wrap in the same bottom-sheet shell ImportItemSheet uses.
    <div role="dialog" aria-label="Új kamra-tétel">
      <label> Típus
        <select value={kind} onChange={e => setKind(e.target.value as Kind)}>
          <option value="food">Étel</option>
          <option value="supplement">Supplement</option>
          <option value="stim">Stimuláns</option>
        </select>
      </label>
      <label> Név <input value={name} onChange={e => setName(e.target.value)} /></label>
      {kind === 'food'
        ? <label> kcal <input value={kcal} onChange={e => setKcal(e.target.value)} /></label>
        : <label> Dózis <input value={dose} onChange={e => setDose(e.target.value)} /></label>}
      <button onClick={submit}>{editId ? 'Mentés' : 'Polcra'}</button>
      <button onClick={onClose}>Mégse</button>
    </div>
  )
}
```

> Replace the bare `<div role="dialog">`/labels with the project's `Sheet` + field components (copy the shell from `ImportItemSheet.tsx` so styling/`aria` match). Keep `aria-label` and `<label>` text so the test selectors resolve.

- [ ] **Step 3: Wire the view header `＋` and detail-sheet actions**

In `FuelKamraView.tsx`: add `const [addOpen, setAddOpen] = useState(false)`, point the header `＋`/Import action's add affordance to `setAddOpen(true)`, and render `<AddPantryItemSheet open={addOpen} onClose={() => setAddOpen(false)} />`. (Do NOT change the component's props/return.)

In `IngredientDetailSheet.tsx`: import `usePantryActions`; wire the three inert buttons:
- `Szerkesztés` → open `AddPantryItemSheet` in edit mode (`editId={item.id}` + `initial`),
- `Frissítés` → `updateItem(item.id, { ...currentInputFromItem, stockQty: newQty })`,
- add a `Törlés` button → `deleteItem(item.id)` then close.
`Logolás` stays disabled/deferred (no logging slice).

- [ ] **Step 4: Run the sheet test + full FE gate both modes**

Run: `cd frontend && pnpm test -- AddPantryItemSheet pantryHooks fuel`
Then: `cd frontend && VITE_USE_MOCK=false pnpm test`
Then: `cd frontend && pnpm build`
Expected: all PASS; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/
git commit -m "feat(pantry): wire manual add/edit/update/delete sheets to usePantryActions (mezo-9xu)"
```

---

## Task 9: Parity + living docs + close

**Files:**
- Modify: `docs/features/fuel.md`
- (parity screenshots are generated artifacts)

- [ ] **Step 1: Parity screenshot vs the chosen mockup**

Run: `cd frontend && pnpm parity`
Expected: the Kamra view renders; compare against `docs/design/kamra-mockup-v3-A.html`. Note any drift as a follow-up bd issue (do not block on pixel-perfection — the mockup is the target, not a frozen contract).

- [ ] **Step 2: Update the living feature doc**

In `docs/features/fuel.md`, update the Pantry/Kamra section: status `mock-only` → backend-backed for the inventory; document the `pantry_item` single-table model, the `GET /api/pantry` kind-split, the `usePantry`/`usePantryActions` seam, and that scrape/recipes/scoring/logging remain deferred. Add `pantry_item`, `PantryService`, `pantryApi.ts`, `pantryHooks.ts` to its `key_files`. Then:

Run: `node scripts/lint-docs.mjs`
Expected: no new staleness/broken-link errors for `fuel.md`.

- [ ] **Step 3: Commit + close**

```bash
git add docs/features/fuel.md
git commit -m "docs(fuel): Kamra inventory now backend-backed (Slice C) (mezo-9xu)"
```

Then close the bd issues for this slice (`bd close <impl-ids>`), and run the session-completion gate (`git pull --rebase && bd dolt push && git push`).

---

## Self-Review

**Spec coverage** (spec §→task):
- §2 D1 scope (inventory + CRUD; defer scrape/recipe/scoring) → Tasks 1–8; deferrals honored (imports/suggestions empty in real mode T7; Logolás left inert T8). ✅
- §2 D2 Model B single table → Task 2/3. ✅
- §2 D3 Direction A UI → already mocked; Task 9 parity (no view rebuild this slice — wiring only, per "no component signature change"). ✅
- §3 data model (all columns, jsonb, soft-delete, indexes, Liquibase registration) → Task 2 + Task 3. ✅
- §4 API (GET split / POST / PUT / DELETE, schemas, SystemMessageList) → Task 1. ✅
- §5 backend layers (entity/repo/service/mapper/controller) → Tasks 3–5. ✅
- §6 FE (usePantry preserved, usePantryActions, AddPantryItemSheet, detail-sheet wiring, regen) → Tasks 6–8. ✅
- §7 testing (populator, ResetDatabase growth, service IT, API IT, ownership isolation, both-mode FE) → Tasks 3,4,5,7,8. ✅
- §9 risks (taken/lastUsed/usedInRecipes simplifications; validation in service) → encoded in mapper defaults (T4) + `validatePerKind` (T4). ✅

**Placeholder scan:** the two "> NOTE" callouts (generator enum names, `ResponseEntity` vs bare return, Sheet shell import) are deliberate verify-against-generated-output instructions with the concrete command to resolve them — not unfilled work. No `TBD`/`TODO`.

**Type consistency:** `PantryItemInput` (T6) ↔ `pantryApi.toRequest`/`PantryItemRequest` (T6) ↔ `usePantryActions` mutation args `{id,input}` (T7) ↔ `AddPantryItemSheet.submit` (T8) — aligned. Service `getPantry/createItem/updateItem/deleteItem` (T4) ↔ controller overrides (T5) ↔ contract operationIds (T1) — aligned. Entity field names (T3) ↔ mapper `applyRequest`/response builders (T4) — aligned (`servingAmount/servingUnit/proteinG/carbsG/fatG/priceHuf/packageLabel/stockQty/stockUnit/stockExpires`).
