# S4 Kamra-katalógus szétválasztás (mezo-qw37.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single-table `pantry_item` into a shared, community-editable **definition catalog** (`pantry_catalog`: name, brand, kind, macros, NOVA… — `created_by NULL` = loader master, set = user-authored and visible to everyone) and a **per-user state row** (`pantry_item`: stock, price, notes, dose/protocol/timing/taken, `catalog_id`), migrating live data without changing any `pantry_item.id` (the four `on delete restrict` FKs stay intact), and re-pointing every reader, the seed loader, the AI name matcher, the Receptműhely and the Kamra UI at the split.

**Architecture:** `PantryItemEntity` keeps its id and gains a `@ManyToOne(fetch = LAZY) PantryCatalogEntity catalog` (`catalog_id NOT NULL`); every definition read becomes `item.getCatalog().getX()` and every repository method that hands items to a mapper `join fetch`es the catalog (no read-through delegates, no N+1). A new `PantryCatalogService` owns natural-key find-or-create, the idempotent `ensureItem(userId, catalogId)` ("from-catalog") and the author-or-OWNER edit gate; `PantryService` composes it. The deterministic `PantryNameIndex` moves from `feature/meal` to `feature/pantry` and indexes the global catalog; both the AI meal draft and the Receptműhely create the user's missing `pantry_item` through `ensureItem` at match time. One Liquibase changeset carries the whole split (dedupe → backfill → NOT NULL → drop columns).

**Tech Stack:** Spring Boot 4 / Hibernate 7 (JPQL `join fetch`, `@ManyToOne(LAZY)`), Liquibase SQL changesets (+ a standalone Liquibase-API migration IT on a throwaway `pgvector/pgvector:pg16` Testcontainer), openapi-generator (contract-first), JUnit 5 + Testcontainers ITs, React 19 + TanStack Query 5 + Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md` §8 (and §11–§12). Depends on S1 (`mezo-qw37.1`): `CurrentUser.get()/id()/requireOwner()` in `feature/auth/service`, `AppUserEntity.isOwner()`, `ApiIntegrationTest.registerUser(label) → RegisteredUser(id, email, headers)`.

## Global Constraints

- Contract-first: edit `api/feature/pantry/pantry.yml`, then `cd api/generate && npm run generate:api` (merges into `api/openapi.yml`), then `cd frontend && pnpm generate:api`. Commit both generated files. Backend Java DTOs regenerate on every Maven build (`target/`, not committed).
- Every non-2xx response references `SystemMessageList`; new error codes go into `backend/src/main/resources/messages.properties` (`{DOMAIN}_{ACTION}_{REASON}`). New in S4: `PANTRY_CATALOG_NOT_EDITABLE` (403), `PANTRY_CATALOG_NAME_TAKEN` (409).
- Liquibase: file `backend/src/main/resources/db/changelog/1.0.0/script/202609021410_mezo-qw37.4_pantry_catalog_split.sql`, registered LAST in `1.0.0/1.0.0_master.yml` (after S1's `202609021200_mezo-qw37.1_multi_user_accounts.sql`); constraint prefixes `pk_/fk_/uq_/ck_/idx_`; `INSERT` only with the `-- lint-liquibase: allow-insert` marker (this changeset is a genuine backfill); released changesets are immutable — never touch `202606221200_mezo-9xu_*`, `202606231200_mezo-zza_*`, `202607051415_mezo-bka_*`, `202607181100_mezo-8vum_*`, `202607231400_mezo-d8tr_*`; entity annotations mirror constraints; `spring.jpa.hibernate.ddl-auto=validate`, so the entity split and the migration MUST land in the same commit.
- ArchUnit (`backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java`): `@Entity` in `..entity..`, `@Service` in `..service..`, `@RestController` in `..controller..` implementing a generated `*Api`; constructor injection only; no class-level `@Transactional`; no raw `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` outside `techcore`; feature slices cycle-free (frozen: `meal↔recipe`, `biometrics↔goal` — do NOT add `recipe → meal`, which is why `PantryNameIndex` moves to `feature/pantry`).
- Backend focused gate: `cd backend && ./mvnw clean test -Dtest='Pantry*,MealAiDraft*,MealService*,MealApiIT,RecipeService*,RecipeApiIT,RecipeWorkshop*,RecipeBreakdown*,Protocol*,Intake*,HabitEvaluator*,ArchitectureTest' -Dmezo.test.use-testcontainers=true` (Surefire matches simple class names). CI (`ci.yml`) is the full-suite gate.
- Frontend gate: `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test` (unset = mock!).
- After adding entities/tables/files: `node scripts/gen-codemap.mjs` and commit `docs/CODEMAP.md`; `node scripts/lint-docs.mjs --errors-only`; `node scripts/lint-liquibase.mjs`.
- Conventional commits carry the bd id: `feat(pantry): … (mezo-qw37.4)`. Branch: `feat/multi-user-s4-pantry-catalog`.
- Hungarian UI copy; routed leaves are `*Page`; modals are `*Sheet` in `sheets/`; hooks are consumed only via `@/data/hooks`; `isMockMode()` is called inside hook/component bodies, never at module scope; dual-mode reads use `useDualQuery` (`frontend/src/data/useDualQuery.ts`), never the seed as a real-mode fallback (`dualMode.guard.test.ts` enforces it).
- Ownership rule stays: `created_by` is set server-side from the principal; foreign/missing rows are indistinguishable 404s (`RESOURCE_NOT_FOUND`).

---

## File Structure

**Backend — create**
- `backend/src/main/resources/db/changelog/1.0.0/script/202609021410_mezo-qw37.4_pantry_catalog_split.sql` — `pantry_catalog` table, dedupe/backfill DML, `pantry_item.catalog_id`, definition-column drop.
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/entity/PantryCatalogEntity.java` — the shared definition row (no `@SQLRestriction`: soft-deleted rows must stay loadable through an item's FK and revivable by the loader).
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryCatalogRepository.java` — natural-key lookup, search, master listing.
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryCatalogService.java` — `search`, `findOrCreate`, `ensureItem`, `editable`/`requireEditable`, `authorNames`/`sharedFromName`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryNameIndex.java` — MOVED from `feature/meal/service`, now indexes `PantryCatalogEntity`.
- Tests: `feature/pantry/PantryCatalogMigrationIT.java` (standalone Liquibase-API test), `feature/pantry/PantryCatalogServiceIT.java`, `feature/pantry/PantryCatalogApiIT.java`, `feature/pantry/service/PantryNameIndexTest.java` (moved), `support/populator/PantryCatalogPopulator.java`.

**Backend — modify**
- `api/feature/pantry/pantry.yml` (+ `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` regenerated)
- `feature/pantry/entity/PantryItemEntity.java` (definition columns out, `catalog` in), `feature/pantry/repository/PantryItemRepository.java` (join-fetch queries), `feature/pantry/mapper/PantryMapper.java`, `feature/pantry/service/PantryService.java`, `feature/pantry/service/PantrySuggestionService.java`, `feature/pantry/service/PantryImportService.java`, `feature/pantry/controller/PantryController.java`, `feature/pantry/PantryCatalogLoader.java`
- Definition readers outside pantry (every one listed in Task 4 with `path:line`): `feature/meal/service/MealService.java`, `feature/meal/service/MealAiDraftService.java`, `feature/recipe/service/RecipeService.java`, `feature/recipe/service/RecipeWorkshopService.java`, `feature/recipe/service/RecipeWorkshopValidator.java`, `feature/fuel/service/ProtocolService.java`, `feature/fuel/service/PlacementEngine.java`, `feature/fuel/service/IntakeService.java`, `feature/fuel/ProtocolSeedData.java`, `feature/habit/service/HabitEvaluator.java`, `feature/character/service/CharacterSignalReads.java`
- `backend/src/main/resources/messages.properties`
- Delete: `feature/meal/service/PantryNameIndex.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndexTest.java` (both move to pantry)
- Tests: `support/ResetDatabase.java`, `support/AbstractIntegrationTest.java` (`@Import` the new populator), `support/populator/PantryItemPopulator.java`, `support/populator/MealPopulator.java`, `feature/pantry/PantryCatalogLoaderIT.java` (rewritten), `feature/pantry/PantryApiIT.java`, `feature/pantry/PantryServiceIT.java`, `feature/pantry/PantryItemRepositoryIT.java`, `feature/pantry/service/PantrySuggestionServiceTest.java`, `feature/meal/MealAiDraftServiceIT.java`, `feature/recipe/RecipeWorkshopApiIT.java`, `feature/recipe/RecipeWorkshopValidatorTest.java`, `feature/recipe/RecipeBreakdownApiIT.java`, `feature/fuel/ProtocolSeedDataIT.java`

**Frontend — create**
- `frontend/src/features/fuel/sheets/CatalogSearchSheet.tsx` (+ `.test.tsx`) — "Hozzáadás a közösből".
- `frontend/src/features/fuel/components/KamraCard.test.tsx` — the "közös" badge.

**Frontend — modify**
- `frontend/src/data/types.ts` (`PantryCatalogEntry`, `PantrySharedFrom`, new optional fields on `Ingredient`/`SupplementStashItem`/`PantryItem`), `frontend/src/data/fuel/pantry.ts` (`pantryCatalogFixture`), `frontend/src/data/fuel/pantryApi.ts` (`searchCatalog`, `addFromCatalog`), `frontend/src/data/fuel/pantryHooks.ts` (`usePantryActions().searchCatalog/addFromCatalog`, mock cache mutators), `frontend/src/data/fuel/pantryHooks.test.tsx`, `frontend/src/features/fuel/logic/kamraItems.ts`, `frontend/src/features/fuel/components/KamraCard.tsx`, `frontend/src/features/fuel/pages/FuelKamraPage.tsx` (+ test), `frontend/src/features/fuel/pages/KamraItemDetailPage.tsx` (+ test), `frontend/src/features/fuel/sheets/AddPantryItemSheet.tsx` (`definitionLocked`, + test), `frontend/src/test/msw/handlers.ts`

**Docs**
- Create `docs/features/pantry.md` (the spec assumed it exists — it does not; today the pantry lives inside `docs/features/fuel.md` and `docs/CODEMAP.md` binds `pantry → fuel.md`), create `docs/features/recipe.md`, touch `docs/features/fuel.md` (status lines + links), `docs/features/README.md` (index rows), `docs/references/liquibase_conventions.md` (catalog-table exception note), regenerate `docs/CODEMAP.md`.

---

### Task 1: Contract — catalog fields, search, from-catalog, 403/409

**Files:**
- Modify: `api/feature/pantry/pantry.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (backend generated): `PantryApi.searchPantryCatalog(String q, String kind) : List<PantryCatalogEntry>`, `PantryApi.addPantryItemFromCatalog(PantryFromCatalogRequest) : PantryItemResponse` (200), `PantryItemRequest.getCatalogId()`, `PantryItemResponse.getCatalogId()`, `IngredientResponse`/`SupplementStashResponse` `.catalogId/.sharedFrom/.catalogEditable`, `PantrySharedFrom.getAuthorName()`, `PantryCatalogEntry` (builder).
- Produces (frontend generated): `components['schemas']['PantryCatalogEntry' | 'PantryFromCatalogRequest' | 'PantrySharedFrom']`.

- [ ] **Step 1: Add the two paths**

In `api/feature/pantry/pantry.yml`, after the `/api/pantry/{id}` block (before the `# Import paths live OUTSIDE` comment) insert:

```yaml
  # Static segments under /api/pantry are safe here: there is no GET /api/pantry/{id} and no
  # POST /api/pantry/{id}, so `catalog` / `items/from-catalog` never fall into the id pattern.
  /api/pantry/catalog:
    get:
      tags: [Pantry]
      operationId: searchPantryCatalog
      summary: Global pantry catalog search (master + every user's definitions; is_deleted=false; max 50)
      parameters:
        - { name: q, in: query, required: false, schema: { type: string, maxLength: 120 } }
        - { name: kind, in: query, required: false, schema: { type: string, pattern: '^(food|supplement|stim|med)$' } }
      responses:
        '200': { description: Matching catalog entries ordered by name, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/PantryCatalogEntry' } } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/pantry/items/from-catalog:
    post:
      tags: [Pantry]
      operationId: addPantryItemFromCatalog
      summary: Put a catalog entry on the caller's shelf — idempotent (an existing live row is returned as-is)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/PantryFromCatalogRequest' } } }
      responses:
        '200': { description: The caller's pantry item for that catalog entry (created or pre-existing), content: { application/json: { schema: { $ref: '#/components/schemas/PantryItemResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Unknown or deleted catalog entry, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

Add to the existing `put:` under `/api/pantry/{id}` two responses after `'404'`:

```yaml
        '403': { description: Definition fields changed on a catalog entry the caller did not author (and is not OWNER), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: Renaming would collide with another catalog entry's name+brand, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

- [ ] **Step 2: Extend the schemas**

In `IngredientResponse`: change `required` to `[id, name, brand, source, category, per, unit, macros, price, priceUnit, pkg, micros, lastUsed, usedInRecipes, catalogId, catalogEditable]` and add after `usedInRecipes`:

```yaml
        # S4 (mezo-qw37.4): the shared definition row behind this shelf entry
        catalogId: { type: string, format: uuid }
        sharedFrom: { allOf: [ { $ref: '#/components/schemas/PantrySharedFrom' } ], nullable: true }
        catalogEditable: { type: boolean }
```

In `SupplementStashResponse`: change `required` to `[id, name, brand, type, category, dose, form, protocol, timing, taken, catalogId, catalogEditable]` and add the same three properties after `saturatedFatG`.

In `PantryItemRequest` add after `kind`:

```yaml
        # S4: bind to an existing catalog entry instead of describing a new definition (create only; ignored on update)
        catalogId: { type: string, format: uuid, nullable: true }
```

In `PantryItemResponse` add `catalogId: { type: string, format: uuid }` after `id` and add `catalogId` to its `required`.

Append these schemas after `PantryItemResponse`:

```yaml
    PantrySharedFrom:
      type: object
      required: [authorName]
      properties:
        authorName: { type: string }
    PantryFromCatalogRequest:
      type: object
      required: [catalogId]
      properties:
        catalogId: { type: string, format: uuid }
    PantryCatalogEntry:
      type: object
      required: [id, kind, name, source]
      properties:
        id: { type: string, format: uuid }
        kind: { type: string, enum: [food, supplement, stim, med] }
        name: { type: string }
        brand: { type: string, nullable: true }
        source: { $ref: '#/components/schemas/PantrySource' }
        category: { type: string, nullable: true }
        per: { type: number, nullable: true }
        unit: { type: string, nullable: true }
        kcal: { type: number, nullable: true }
        proteinG: { type: number, nullable: true }
        carbsG: { type: number, nullable: true }
        fatG: { type: number, nullable: true }
        fiberG: { type: number, nullable: true }
        sugarG: { type: number, nullable: true }
        saltG: { type: number, nullable: true }
        saturatedFatG: { type: number, nullable: true }
        nova: { type: integer, minimum: 1, maximum: 4, nullable: true }
        form: { type: string, nullable: true }
        caffeine: { type: boolean, nullable: true }
        # null = loader master row; set = the user who authored it
        authorName: { type: string, nullable: true }
```

- [ ] **Step 3: Regenerate + verify**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ../backend && ./mvnw -q generate-sources`
Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` change; `target/generated-sources/openapi/.../PantryApi.java` contains `searchPantryCatalog` and `addPantryItemFromCatalog`. `grep -n "searchPantryCatalog\|PantryCatalogEntry" frontend/src/data/_client/api.gen.ts` shows both.

- [ ] **Step 4: Commit**

```bash
git add api/feature/pantry/pantry.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): pantry catalog search + from-catalog + shared/editable fields (mezo-qw37.4)"
```

---
### Task 2: The migration changeset — `pantry_catalog`, dedupe, backfill, column drop

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021410_mezo-qw37.4_pantry_catalog_split.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append LAST)

**Interfaces:**
- Produces: table `pantry_catalog` (columns listed below), `pantry_item.catalog_id uuid NOT NULL` + `fk_pantry_item_catalog_id_pantry_catalog_id` (`on delete restrict`), `uq_pantry_item_created_by_catalog_id` partial unique index, `uq_pantry_catalog_natural` unique expression index. `pantry_item` LOSES: `kind, name, brand, source, category, serving_amount, serving_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, salt_g, saturated_fat_g, package_label, micros, nova, form, caffeine` and the constraints `ck_pantry_item_kind/source/nova/category` + index `idx_pantry_item_created_by_kind`. `pantry_item` KEEPS: `id, created_by, is_deleted, created_at, updated_at, notes, price_huf, price_unit, stock_qty, stock_unit, stock_expires, dose, protocol, timing, taken` + `pk_pantry_item_id`, `fk_pantry_item_created_by_app_user_id`, `idx_pantry_item_created_by`.
- Consumed by Task 3 (entities must mirror this exactly — `ddl-auto: validate`) and Task 4 (migration IT).

Column provenance (exact, from the released changesets): base columns from `202606221200_mezo-9xu_create_pantry_item.sql`; `fiber_g/sugar_g/salt_g/saturated_fat_g` + `ck_pantry_item_category` from `202606231200_mezo-zza_extend_pantry_item.sql`; the 14-value `source` allow-list is the one `202607231400_mezo-d8tr_pantry_photo_source.sql` left in place.

- [ ] **Step 1: Write the changeset**

`backend/src/main/resources/db/changelog/1.0.0/script/202609021410_mezo-qw37.4_pantry_catalog_split.sql`:

```sql
-- lint-liquibase: allow-insert
-- Multi-user accounts S4 (mezo-qw37.4): split pantry_item into a SHARED definition catalog
-- (pantry_catalog: what a food/supplement IS) and PER-USER state (pantry_item: what I have of it).
-- pantry_item keeps its id, so the four ON DELETE RESTRICT FKs (meal_item, recipe_ingredient,
-- protocol_item, supplement_intake) and pantry_import's SET NULL FK are untouched.
-- The INSERTs below are a backfill of EXISTING rows (dedupe by natural key), not seed data.
-- Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §8.

-- 1. The catalog. created_by NULL = loader master (seed/pantry-catalog.json); set = user-authored,
--    visible to everyone (K1). ON DELETE SET NULL: a deleted author's definitions must survive for
--    the other users whose pantry_item rows point at them. No @SQLRestriction on the entity side —
--    a soft-deleted catalog row stays loadable through an item's FK and revivable by the loader.
create table pantry_catalog (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz,
    kind            text         not null,
    name            text         not null,
    brand           text,
    source          text         not null default 'manual',
    category        text,
    serving_amount  numeric,
    serving_unit    text,
    kcal            numeric,
    protein_g       numeric,
    carbs_g         numeric,
    fat_g           numeric,
    fiber_g         numeric,
    sugar_g         numeric,
    salt_g          numeric,
    saturated_fat_g numeric,
    package_label   text,
    micros          jsonb,
    nova            smallint,
    form            text,
    caffeine        boolean,
    constraint pk_pantry_catalog_id primary key (id),
    constraint fk_pantry_catalog_created_by_app_user_id foreign key (created_by) references app_user (id) on delete set null,
    constraint ck_pantry_catalog_kind check (kind in ('food','supplement','stim','med')),
    constraint ck_pantry_catalog_source check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts',
                      'gymbeam.hu','web','photo')),
    constraint ck_pantry_catalog_category check (category is null or category in (
        'vegetables','fruits','meat','fish','eggs','dairy','cheese','legumes','grains',
        'pasta','bakery','nuts_seeds','oils_fats','condiments','snacks','beverages','supplement','other')),
    constraint ck_pantry_catalog_nova check (nova is null or nova between 1 and 4)
);

-- Natural key: case-insensitive name + brand (brand-less rows share the '' bucket).
create unique index uq_pantry_catalog_natural on pantry_catalog (lower(name), lower(coalesce(brand, '')));
create index idx_pantry_catalog_created_by on pantry_catalog (created_by);
create index idx_pantry_catalog_kind on pantry_catalog (kind);

-- 2. Pre-flight guard. After the split one user may hold ONE live row per definition
--    (uq_pantry_item_created_by_catalog_id below). If a user today has two live rows with the
--    same name+brand, this throwaway unique index fails with "could not create unique index",
--    the changeset rolls back and the app refuses to start — resolve the duplicates by hand
--    (docs/features/pantry.md §9 has the diagnostic query) rather than let the migration pick one.
create unique index uq_pantry_item_split_guard
    on pantry_item (created_by, lower(name), lower(coalesce(brand, ''))) where is_deleted = false;
drop index uq_pantry_item_split_guard;

-- 3. One catalog row per natural key from the LIVE items; the earliest created_at (then id) wins
--    and becomes the author. Every other live row with that key binds to the winner in step 5.
insert into pantry_catalog (created_by, is_deleted, created_at, kind, name, brand, source, category,
    serving_amount, serving_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, salt_g,
    saturated_fat_g, package_label, micros, nova, form, caffeine)
select distinct on (lower(name), lower(coalesce(brand, '')))
       created_by, false, created_at, kind, name, brand, source, category,
       serving_amount, serving_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, salt_g,
       saturated_fat_g, package_label, micros, nova, form, caffeine
from pantry_item
where is_deleted = false
order by lower(name), lower(coalesce(brand, '')), created_at asc, id asc;

-- 4. Soft-deleted items need a catalog_id too (NOT NULL). Those whose key already exists bind to
--    the live row in step 5; the rest get an is_deleted=true catalog row of their own.
insert into pantry_catalog (created_by, is_deleted, created_at, kind, name, brand, source, category,
    serving_amount, serving_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, salt_g,
    saturated_fat_g, package_label, micros, nova, form, caffeine)
select distinct on (lower(d.name), lower(coalesce(d.brand, '')))
       d.created_by, true, d.created_at, d.kind, d.name, d.brand, d.source, d.category,
       d.serving_amount, d.serving_unit, d.kcal, d.protein_g, d.carbs_g, d.fat_g, d.fiber_g, d.sugar_g,
       d.salt_g, d.saturated_fat_g, d.package_label, d.micros, d.nova, d.form, d.caffeine
from pantry_item d
where d.is_deleted = true
  and not exists (select 1 from pantry_catalog c
                   where lower(c.name) = lower(d.name)
                     and lower(coalesce(c.brand, '')) = lower(coalesce(d.brand, '')))
order by lower(d.name), lower(coalesce(d.brand, '')), d.created_at asc, d.id asc;

-- 5. Backfill the link (nullable -> backfill -> NOT NULL -> constrain: the Citus recipe, spec §13).
alter table pantry_item add column catalog_id uuid;
update pantry_item i
   set catalog_id = c.id
  from pantry_catalog c
 where lower(c.name) = lower(i.name)
   and lower(coalesce(c.brand, '')) = lower(coalesce(i.brand, ''));
alter table pantry_item alter column catalog_id set not null;
alter table pantry_item add constraint fk_pantry_item_catalog_id_pantry_catalog_id
    foreign key (catalog_id) references pantry_catalog (id) on delete restrict;
create index idx_pantry_item_catalog_id on pantry_item (catalog_id);
create unique index uq_pantry_item_created_by_catalog_id
    on pantry_item (created_by, catalog_id) where is_deleted = false;

-- 6. The definition columns leave pantry_item (their CHECKs and the kind index go first).
drop index idx_pantry_item_created_by_kind;
alter table pantry_item drop constraint ck_pantry_item_kind;
alter table pantry_item drop constraint ck_pantry_item_source;
alter table pantry_item drop constraint ck_pantry_item_nova;
alter table pantry_item drop constraint ck_pantry_item_category;
alter table pantry_item
    drop column kind,
    drop column name,
    drop column brand,
    drop column source,
    drop column category,
    drop column serving_amount,
    drop column serving_unit,
    drop column kcal,
    drop column protein_g,
    drop column carbs_g,
    drop column fat_g,
    drop column fiber_g,
    drop column sugar_g,
    drop column salt_g,
    drop column saturated_fat_g,
    drop column package_label,
    drop column micros,
    drop column nova,
    drop column form,
    drop column caffeine;
```

(No `DO $$ … $$` block on purpose: Liquibase's default `;` statement splitter does not understand dollar quoting; the throwaway unique index is the guard instead.)

- [ ] **Step 2: Register it LAST in the master**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (after S1's `202609021200_mezo-qw37.1_multi_user_accounts` entry — if S1 has not merged yet, still append at the very end; Task 4's IT asserts this file is the last changeset):

```yaml
  - changeSet:
      id: "1.0.0:202609021410_mezo-qw37.4_pantry_catalog_split"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021410_mezo-qw37.4_pantry_catalog_split.sql
```

- [ ] **Step 3: Lint**

Run: `node scripts/lint-liquibase.mjs`
Expected: `result: PASS` (the `allow-insert` marker suppresses rule 2; every constraint/index carries its prefix).

- [ ] **Step 4: Commit (schema only — the tree does not boot yet; Task 3 lands the entities in the same PR)**

```bash
git add backend/src/main/resources/db/changelog/1.0.0/script/202609021410_mezo-qw37.4_pantry_catalog_split.sql backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml
git commit -m "feat(pantry): pantry_catalog split changeset — dedupe, backfill catalog_id, drop definition columns (mezo-qw37.4)"
```

---
### Task 3: Entities + repositories — `PantryCatalogEntity`, `PantryItemEntity.catalog`, join-fetch finders

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/entity/PantryCatalogEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryCatalogRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/entity/PantryItemEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryItemRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/PantryCatalogPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/PantryItemPopulator.java`, `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java`, `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryItemRepositoryIT.java`

**Interfaces:**
- Produces: `PantryCatalogEntity` (getters/setters for every column in Task 2; `isMaster()`), `PantryItemEntity.getCatalog() : PantryCatalogEntity` (LAZY, `optional = false`), `PantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(UUID)` (join fetch, ordered by `catalog.name`), `findByIdAndCreatedByAndDeletedFalse(UUID, UUID)` (join fetch), `findAllWithCatalogByIdIn(Collection<UUID>)`, `findWithCatalogById(UUID)`, `findByCreatedByAndCatalog_IdAndDeletedFalse(UUID, UUID)`; `PantryCatalogRepository.findByNaturalKey(String name, String brand)`, `searchAll(String like, Limit)`, `searchByKind(String like, String kind, Limit)`, `findByDeletedFalseOrderByNameAsc()`, `findByCreatedByIsNull()`; `PantryCatalogPopulator.createFoodDefinition(UUID author, String name, String brand)`, `createMasterFood(String name)`; `PantryItemPopulator` keeps every existing signature (find-or-create catalog by natural key, find-or-create the owner's live item).
- The tree does NOT compile at the end of this task's Step 3 — Task 4 rewrites the callers. Run the tests only after Task 4.

- [ ] **Step 1: Write the failing repository IT**

Replace `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryItemRepositoryIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class PantryItemRepositoryIT extends AbstractIntegrationTest {

    @Autowired private PantryItemRepository repository;
    @Autowired private PantryCatalogRepository catalogRepository;
    @Autowired private PantryItemPopulator populator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testFindByOwner_shouldReturnFoodWithCatalogAndJsonbMicros_whenPersisted() {
        UUID owner = databasePopulator.populateUser("repo-a@test.local");
        populator.createFood(owner, "Csirkemell", LocalDate.now().plusDays(3));

        List<PantryItemEntity> items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);

        assertThat(items).hasSize(1);
        PantryCatalogEntity c = items.getFirst().getCatalog();
        assertThat(c.getName()).isEqualTo("Csirkemell");
        assertThat(c.getBrand()).isEqualTo("Bonafarm");
        assertThat(c.getMicros()).extracting("name").containsExactly("B6");
        assertThat(c.getCreatedBy()).isEqualTo(owner); // populator rows are user-authored, never master
        assertThat(items.getFirst().getStockQty()).isEqualByComparingTo("400"); // state stays on the item
    }

    @Test
    void testCreateFood_shouldShareOneCatalogRow_whenTwoUsersHoldTheSameFood() {
        UUID a = databasePopulator.populateUser("repo-a@test.local");
        UUID b = databasePopulator.populateUser("repo-b@test.local");
        PantryItemEntity mine = populator.createFood(a, "Túró", LocalDate.now().plusDays(3));
        PantryItemEntity theirs = populator.createFood(b, "túró", LocalDate.now().plusDays(3)); // natural key is case-insensitive

        assertThat(theirs.getId()).isNotEqualTo(mine.getId());
        assertThat(theirs.getCatalog().getId()).isEqualTo(mine.getCatalog().getId());
        assertThat(catalogRepository.findByNaturalKey("TÚRÓ", "bonafarm")).isPresent();
        assertThat(repository.findByCreatedByAndCatalog_IdAndDeletedFalse(b, mine.getCatalog().getId()))
            .contains(theirs);
    }

    @Test
    void testFindByOwner_shouldHideRow_whenSoftDeleted() {
        UUID owner = databasePopulator.populateUser("repo-a@test.local");
        PantryItemEntity e = populator.createFood(owner, "Túró", LocalDate.now().plusDays(3));
        repository.delete(e); // @SQLDelete -> is_deleted = true on pantry_item only
        repository.flush();
        assertThat(repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();
        assertThat(catalogRepository.findById(e.getCatalog().getId())).isPresent(); // the definition survives
    }

    @Test
    void testSearch_shouldMatchNameOrBrandCaseInsensitively_andFilterByKind() {
        UUID owner = databasePopulator.populateUser("repo-a@test.local");
        populator.createFood(owner, "Zabpehely", LocalDate.now().plusDays(3));   // brand Bonafarm
        populator.createSupplement(owner, "Kreatin");                             // brand MyProtein

        assertThat(catalogRepository.searchAll("%zab%", Limit.of(50))).extracting(PantryCatalogEntity::getName)
            .containsExactly("Zabpehely");
        assertThat(catalogRepository.searchAll("%myprot%", Limit.of(50))).extracting(PantryCatalogEntity::getName)
            .containsExactly("Kreatin");
        assertThat(catalogRepository.searchByKind("%%", "supplement", Limit.of(50)))
            .extracting(PantryCatalogEntity::getName).contains("Kreatin").doesNotContain("Zabpehely");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='PantryItemRepositoryIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation error — `PantryCatalogEntity`/`getCatalog()` missing.

- [ ] **Step 3: Write `PantryCatalogEntity`**

```java
package io.mrkuhne.mezo.feature.pantry.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * The shared pantry DEFINITION (S4, mezo-qw37.4): what a food/supplement IS — name, brand, kind,
 * macros, NOVA. Hybrid like {@code exercise_catalog}: {@code createdBy == null} is loader master
 * content ({@code seed/pantry-catalog.json}); a set {@code createdBy} is a user-authored row that
 * every user can see and put on their own shelf. Per-user state (stock, price, dose, notes) lives
 * on {@link PantryItemEntity}, which points here via {@code catalog_id}.
 *
 * <p>Deliberately NO {@code @SQLRestriction}: a soft-deleted catalog row must stay loadable through
 * a (soft-deleted) item's FK and revivable by the loader; readers filter {@code deleted} explicitly.
 * Natural key {@code (lower(name), lower(coalesce(brand,'')))} is unique in the DB.
 */
@Getter
@Setter
@Entity
@Table(name = "pantry_catalog")
public class PantryCatalogEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** null = master (loader-owned); set = the authoring user (visible to all). */
    @Column(name = "created_by", columnDefinition = "uuid")
    private UUID createdBy;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @NotNull
    @Column(nullable = false)
    private String kind; // food | supplement | stim | med (ck_pantry_catalog_kind)

    @NotNull
    @Column(nullable = false)
    private String name;

    private String brand;

    @NotNull
    @Column(nullable = false)
    private String source = "manual"; // ck_pantry_catalog_source

    private String category; // ck_pantry_catalog_category (nullable)

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

    @Column(name = "fiber_g")
    private BigDecimal fiberG;

    @Column(name = "sugar_g")
    private BigDecimal sugarG;

    @Column(name = "salt_g")
    private BigDecimal saltG;

    @Column(name = "saturated_fat_g")
    private BigDecimal saturatedFatG;

    @Column(name = "package_label")
    private String packageLabel;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<MicroFact> micros;

    private Short nova; // ck_pantry_catalog_nova

    private String form;

    private Boolean caffeine;

    public boolean isMaster() {
        return createdBy == null;
    }
}
```

- [ ] **Step 4: Rewrite `PantryItemEntity`**

Replace the whole class body of `feature/pantry/entity/PantryItemEntity.java` (keep the package + Lombok/Hibernate imports; add `jakarta.persistence.FetchType`, `jakarta.persistence.JoinColumn`, `jakarta.persistence.ManyToOne`; drop `java.util.List`, `JdbcTypeCode`, `SqlTypes`):

```java
/**
 * Per-user pantry STATE (S4, mezo-qw37.4): stock, price, notes, dose/protocol/timing/taken for
 * one shared definition ({@link PantryCatalogEntity}). The id is what {@code meal_item},
 * {@code recipe_ingredient}, {@code protocol_item} and {@code supplement_intake} reference
 * (ON DELETE RESTRICT) — the split kept every id. One LIVE row per (created_by, catalog_id)
 * ({@code uq_pantry_item_created_by_catalog_id}). Definition reads go through
 * {@code getCatalog()}; the repository finders that feed mappers {@code join fetch} it.
 */
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
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "catalog_id", nullable = false)
    private PantryCatalogEntity catalog;

    private String notes;

    @Column(name = "price_huf")
    private Integer priceHuf;

    @Column(name = "price_unit")
    private String priceUnit;

    // stock
    @Column(name = "stock_qty")
    private BigDecimal stockQty;

    @Column(name = "stock_unit")
    private String stockUnit;

    @Column(name = "stock_expires")
    private LocalDate stockExpires;

    // supplement / stim (per-user protocol facts; `form` and `caffeine` are definition facts on the catalog)
    private String dose;
    private String protocol;
    private String timing;

    @Column(nullable = false)
    private boolean taken = false;
}
```

- [ ] **Step 5: Repositories**

Replace `feature/pantry/repository/PantryItemRepository.java`:

```java
package io.mrkuhne.mezo.feature.pantry.repository;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * No 'date' base field => extend JpaRepository directly (cf. GoalRepository), not OwnedRepository.
 * Since S4 (mezo-qw37.4) the definition lives on {@code catalog}; every finder that hands rows to a
 * mapper or a name reader {@code join fetch}es it so no caller trips a LazyInitializationException
 * or an N+1. {@code deleted = false} is belt-and-braces with the entity's @SQLRestriction — keep both.
 */
public interface PantryItemRepository extends JpaRepository<PantryItemEntity, UUID> {

    /** The owner's live shelf, alphabetical by the DEFINITION name (kept name for the ~15 callers). */
    @Query("select i from PantryItemEntity i join fetch i.catalog c "
        + "where i.createdBy = :createdBy and i.deleted = false order by c.name asc")
    List<PantryItemEntity> findByCreatedByAndDeletedFalseOrderByNameAsc(@Param("createdBy") UUID createdBy);

    @Query("select i from PantryItemEntity i join fetch i.catalog "
        + "where i.id = :id and i.createdBy = :createdBy and i.deleted = false")
    Optional<PantryItemEntity> findByIdAndCreatedByAndDeletedFalse(@Param("id") UUID id, @Param("createdBy") UUID createdBy);

    /** Batch fetch for the recipe/meal fit passes (ids come from OWNED lines; @SQLRestriction hides deleted rows). */
    @Query("select i from PantryItemEntity i join fetch i.catalog where i.id in :ids")
    List<PantryItemEntity> findAllWithCatalogByIdIn(@Param("ids") Collection<UUID> ids);

    /** Unscoped by-id read with the definition attached (ProtocolService's name lookups). */
    @Query("select i from PantryItemEntity i join fetch i.catalog where i.id = :id")
    Optional<PantryItemEntity> findWithCatalogById(@Param("id") UUID id);

    /** The from-catalog idempotency key: one live row per (owner, definition). */
    Optional<PantryItemEntity> findByCreatedByAndCatalog_IdAndDeletedFalse(UUID createdBy, UUID catalogId);
}
```

Create `feature/pantry/repository/PantryCatalogRepository.java`:

```java
package io.mrkuhne.mezo.feature.pantry.repository;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Global (not owner-scoped) definition catalog — see PantryCatalogEntity for the master/user split. */
public interface PantryCatalogRepository extends JpaRepository<PantryCatalogEntity, UUID> {

    /** Natural-key lookup, deleted rows INCLUDED (the caller revives or binds). {@code brandKey} = lowercased brand or "". */
    @Query("select c from PantryCatalogEntity c where lower(c.name) = lower(:name) "
        + "and lower(coalesce(c.brand, '')) = :brandKey")
    Optional<PantryCatalogEntity> findByNaturalKeyRaw(@Param("name") String name, @Param("brandKey") String brandKey);

    default Optional<PantryCatalogEntity> findByNaturalKey(String name, String brand) {
        return findByNaturalKeyRaw(name, brand == null ? "" : brand.strip().toLowerCase());
    }

    /** {@code like} is already lowercased + %-wrapped by the service. Two methods (no `:kind is null`) keep the bind types explicit. */
    @Query("select c from PantryCatalogEntity c where c.deleted = false "
        + "and (lower(c.name) like :like or lower(coalesce(c.brand, '')) like :like) order by c.name asc")
    List<PantryCatalogEntity> searchAll(@Param("like") String like, Limit limit);

    @Query("select c from PantryCatalogEntity c where c.deleted = false and c.kind = :kind "
        + "and (lower(c.name) like :like or lower(coalesce(c.brand, '')) like :like) order by c.name asc")
    List<PantryCatalogEntity> searchByKind(@Param("like") String like, @Param("kind") String kind, Limit limit);

    /** The live global index the AI name matcher is built from. */
    List<PantryCatalogEntity> findByDeletedFalseOrderByNameAsc();

    /** Master rows (loader-owned). */
    List<PantryCatalogEntity> findByCreatedByIsNull();
}
```

- [ ] **Step 6: Populators + `ResetDatabase`**

Create `support/populator/PantryCatalogPopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the shared pantry definition (S4). Find-or-create by natural key — never collides on uq_pantry_catalog_natural. */
@TestComponent
@RequiredArgsConstructor
public class PantryCatalogPopulator {

    private final PantryCatalogRepository repository;

    /** A per-100 g food definition authored by {@code author} (null = master row). */
    public PantryCatalogEntity createFoodDefinition(UUID author, String name, String brand) {
        return repository.findByNaturalKey(name, brand).orElseGet(() -> {
            PantryCatalogEntity c = new PantryCatalogEntity();
            c.setCreatedBy(author);
            c.setKind("food");
            c.setName(name);
            c.setBrand(brand);
            c.setSource("manual");
            c.setCategory("other");
            c.setServingAmount(new BigDecimal("100"));
            c.setServingUnit("g");
            c.setKcal(new BigDecimal("110"));
            c.setProteinG(new BigDecimal("23.0"));
            c.setCarbsG(BigDecimal.ZERO);
            c.setFatG(new BigDecimal("1.5"));
            c.setNova((short) 1);
            return repository.saveAndFlush(c);
        });
    }

    /** A loader-style master row (created_by NULL) — survives ResetDatabase like the loader's own rows. */
    public PantryCatalogEntity createMasterFood(String name) {
        return createFoodDefinition(null, name, null);
    }
}
```

Rewrite `support/populator/PantryItemPopulator.java` keeping all six public signatures. Inject `PantryCatalogRepository catalogRepository` next to `repository`; add two private helpers and route every factory through them:

```java
    /** Find-or-create the definition by natural key (user-authored by {@code owner}); the configurer fills a NEW row only. */
    private PantryCatalogEntity catalogFor(UUID owner, String name, String brand, java.util.function.Consumer<PantryCatalogEntity> definition) {
        return catalogRepository.findByNaturalKey(name, brand).orElseGet(() -> {
            PantryCatalogEntity c = new PantryCatalogEntity();
            c.setCreatedBy(owner);
            c.setName(name);
            c.setBrand(brand);
            definition.accept(c);
            return catalogRepository.saveAndFlush(c);
        });
    }

    /** Find-or-create the owner's LIVE item for the definition (uq_pantry_item_created_by_catalog_id); state fields fill a NEW row only. */
    private PantryItemEntity itemFor(UUID owner, PantryCatalogEntity catalog, java.util.function.Consumer<PantryItemEntity> state) {
        return repository.findByCreatedByAndCatalog_IdAndDeletedFalse(owner, catalog.getId()).orElseGet(() -> {
            PantryItemEntity e = new PantryItemEntity();
            e.setCreatedBy(owner);
            e.setCatalog(catalog);
            state.accept(e);
            return repository.saveAndFlush(e);
        });
    }
```

Then, e.g. `createFood(owner, name, expires)` becomes: `catalogFor(owner, name, "Bonafarm", c -> { c.setKind("food"); c.setSource("kifli.hu"); c.setCategory("meat"); c.setServingAmount(new BigDecimal("100")); c.setServingUnit("g"); c.setKcal(new BigDecimal("110")); c.setProteinG(new BigDecimal("23.0")); c.setCarbsG(BigDecimal.ZERO); c.setFatG(new BigDecimal("1.5")); c.setNova((short) 1); c.setMicros(List.of(new MicroFact("B6", 92))); })` followed by `return itemFor(owner, catalog, e -> { e.setStockQty(new BigDecimal("400")); e.setStockUnit("g"); e.setStockExpires(expires); });`. Apply the same split to `createFoodWithNutrients` (brand null; definition = source manual, category dairy, per 100 g, kcal 110, p 13.0, c 4.0, f 4.5, fiber 3.2, sugar 4.1, salt 0.4, sat 2.8, nova 1; no state), `createPricedFood` (brand null; definition = kind food, source manual, category, per 100 g, kcal 100, nova; state = priceHuf, priceUnit), `createSupplement(owner, name)` / `createSupplement(owner, name, timing)` / `createStim` (brand "MyProtein"; definition = kind supplement|stim, source myprotein.hu, category supplement, form "por"; state = dose "5g", protocol "Naponta egy adag", timing, stockQty 86, stockUnit "adag"). Note `form` is now a DEFINITION field (catalog), `dose/protocol/timing` stay STATE (item).

In `support/AbstractIntegrationTest.java` add `PantryCatalogPopulator.class` to the `@Import` list right before `PantryItemPopulator.class` (+ import).

In `support/ResetDatabase.java`: add `pantry_catalog` NOWHERE in the TRUNCATE list; instead insert, immediately AFTER the TRUNCATE statement and BEFORE the `DELETE FROM app_user` statement:

```java
        // Hybrid catalog (S4, mezo-qw37.4): user-authored definitions go, loader master rows
        // (created_by IS NULL) survive. MUST run before the app_user delete — the FK is ON DELETE
        // SET NULL, so a deleted test user's rows would otherwise be promoted to master and leak.
        entityManager.createNativeQuery("DELETE FROM pantry_catalog WHERE created_by IS NOT NULL").executeUpdate();
```
Update the class Javadoc: "exercise_catalog and pantry_catalog are hybrid tables …".

- [ ] **Step 7: Commit (still not compiling — Task 4 completes the split)**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/entity backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryItemRepositoryIT.java
git commit -m "feat(pantry): PantryCatalogEntity + catalog-backed PantryItemEntity, join-fetch finders, populators (mezo-qw37.4)"
```

---
### Task 4: Re-point every definition reader at `getCatalog()` — the tree compiles again

**Files (every call site that read a definition field off `PantryItemEntity`, lines as of the S4 baseline):**
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/mapper/PantryMapper.java` (whole file — rewritten in Task 6; here only enough to compile)
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryService.java:38-48,52-58,62-66` (Task 6 rewrites; here compile-only)
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantrySuggestionService.java:40-41,56-66,72-79,84-88,94-95`
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryImportService.java:83-103` (Task 7 rewrites; here compile-only)
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoader.java` (Task 5 rewrites; here compile-only)
- `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java:213-216` (`pantryCategory`), `:296-309` (pantry arm of `buildItem`), `:404-414` (`dominantNova`)
- `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealAiDraftService.java:170-175` (prompt), `:269-284` (`pantryItem`), `:243-255` (`matchByNameOrEstimate` — Task 8 rewrites)
- `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndex.java` (Task 8 moves it)
- `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java:90-96` (`pantryByIdFor`), `:125-135` (`fitLines` nova + category), `:207-231` (`buildLine`), `:243-248` (`deriveNovaDominant`)
- `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeWorkshopService.java:110-116` (prompt)
- `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeWorkshopValidator.java:71-78`
- `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/ProtocolService.java:209,274-283,305-307`
- `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/PlacementEngine.java:52-53,86,94`
- `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/IntakeService.java:37-41`
- `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedData.java:73-120`
- `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java:153-156`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterSignalReads.java:396-399`
- Tests: `support/populator/MealPopulator.java:56`, `feature/pantry/service/PantrySuggestionServiceTest.java:22-31`, `feature/recipe/RecipeBreakdownApiIT.java:149-151`, `feature/fuel/ProtocolSeedDataIT.java:46-52`

**Interfaces:**
- Consumes: `PantryItemEntity.getCatalog()`, `PantryItemRepository.findAllWithCatalogByIdIn`, `findWithCatalogById` (Task 3).
- Produces: a compiling tree whose behaviour is unchanged for every existing IT (the pantry ITs are re-baselined in Task 6).

- [ ] **Step 1: Mechanical rewrite — the rule**

Every `x.getKind()`, `getName()`, `getBrand()`, `getSource()`, `getCategory()`, `getServingAmount()`, `getServingUnit()`, `getKcal()`, `getProteinG()`, `getCarbsG()`, `getFatG()`, `getFiberG()`, `getSugarG()`, `getSaltG()`, `getSaturatedFatG()`, `getPackageLabel()`, `getMicros()`, `getNova()`, `getForm()`, `getCaffeine()` on a `PantryItemEntity` becomes `x.getCatalog().getY()`; the matching setters on a NEW item move onto a catalog row (Tasks 5–7 own those). Concretely:

- `MealService.pantryCategory` (213-216): `.map(p -> p.getCatalog().getCategory())`.
- `MealService.buildItem` pantry arm (296-309): `PantryCatalogEntity c = p.getCatalog();` then `c.getName()`, `c.getServingAmount()`, `c.getServingUnit()`, `c.getKcal()`, `c.getProteinG()`, `c.getCarbsG()`, `c.getFatG()`, `c.getFiberG()`, `c.getSugarG()`, `c.getSaltG()`, `c.getSaturatedFatG()`, `c.getNova()`.
- `MealService.dominantNova` (410-414): `pantryItemRepository.findAllWithCatalogByIdIn(ids).stream().map(p -> p.getCatalog().getNova())` and the rest unchanged.
- `MealAiDraftService.buildSystemPrompt` (170-175): `p.getCatalog().getName()`, `.getBrand()`, `.getServingAmount()`, `.getServingUnit()`; `pantryItem` (269-284): same substitution for name/servingAmount/servingUnit/kcal/proteinG/carbsG/fatG/nova. `matchByNameOrEstimate` compiles unchanged until Task 8 — for now change `PantryNameIndex.keysOf`/`match`/`of` to read `item.getCatalog().getName()/getBrand()/getServingUnit()/getKind()`; Task 8 replaces the class.
- `RecipeService.pantryByIdFor` (95): `pantryItemRepository.findAllWithCatalogByIdIn(ids)`; `fitLines` (125-135): `p == null ? null : p.getCatalog().getNova()` and the category read two lines below becomes `p.getCatalog().getCategory()`; `buildLine` (207-231): `PantryCatalogEntity c = item.getCatalog();` and every snapshot source `c.getX()`; `deriveNovaDominant` (245): `.map(l -> resolvePantryItem(userId, l.getPantryItemId()).getCatalog().getNova())`.
- `RecipeWorkshopService.buildSystemPrompt` (111-116): `p.getCatalog().getName()/getBrand()/getServingAmount()/getServingUnit()`.
- `RecipeWorkshopValidator.mapLine` (76-77): `p.getCatalog().getName()`, `p.getCatalog().getServingUnit()`.
- `ProtocolService`: line 209 `pantryItemRepository.findWithCatalogById(item.getPantryItemId())`; line 278 `KIND_FOOD.equals(item.getCatalog().getKind())`; line 306 `pantryItemRepository.findWithCatalogById(pantryItemId).map(p -> p.getCatalog().getName())`.
- `PlacementEngine.place` (53): `item.getCatalog().getName()`; lines 86/94 likewise (`item.getTiming()` stays — timing is state).
- `IntakeService.logIntake` (41): `item.getCatalog().getKind()`.
- `HabitEvaluator.stimIntakes` (155): `.map(p -> "stim".equals(p.getCatalog().getKind()))`.
- `CharacterSignalReads.gatherStack` (397-398): `names.put(p.getId(), p.getCatalog().getName())`.
- `PantrySuggestionService`: `priceHuf`/`priceUnit` STAY on the item (`e.getPriceHuf()`), while `kind`, `category`, `nova`, `name`, `source` move to `e.getCatalog()`: `Collectors.groupingBy(e -> e.getCatalog().getCategory(), TreeMap::new, Collectors.toList())`, the `"food".equals(e.getCatalog().getKind()) && e.getCatalog().getCategory() != null` filter, `Comparator.comparing(e -> e.getCatalog().getNova())`, `high.getCatalog().getNova()`, `seen.add(item.getCatalog().getName())`, `PantrySource.fromValue(item.getCatalog().getSource())`.
- `ProtocolSeedData.ensureItem/tastyDose/originPwo` (73-120): build a `PantryCatalogEntity` candidate (kind stim, name, brand, source manual, category supplement, form, caffeine true, servingAmount, servingUnit) plus a state block (dose, stockQty/unit, protocol, timing, notes); `ensureItem` matches `p.getCatalog().getName()` and, on miss, does `catalogRepository.findByNaturalKey(name, brand).orElseGet(() -> catalogRepository.save(candidate))`, then a new `PantryItemEntity` with `setCreatedBy(ownerId)`, `setCatalog(catalog)` and the state block. Task 6 swaps this inline find-or-create for `PantryCatalogService`.
- `PantryImportService.importItem` (83-103) and `PantryCatalogLoader.toEntity` (114-136): the same inline find-or-create for now (Tasks 5/7 finish them).
- `PantryMapper`: every `e.getX()` definition read becomes `e.getCatalog().getX()`; `applyRequest`/`applyRequestPartial` split into definition setters on `e.getCatalog()` and state setters on `e` (Task 6 replaces the mapper wholesale — here only make it compile with that split).
- Tests: `MealPopulator:56` → `pantryItem.getCatalog().getName()`; `PantrySuggestionServiceTest.food(...)` builds a `PantryCatalogEntity` with kind/name/source/category/nova and a `PantryItemEntity` with `setCatalog(c)` + `setPriceHuf/PriceUnit`; `RecipeBreakdownApiIT:149-151` → `var row = pantryItemRepository.findWithCatalogById(food).orElseThrow(); row.getCatalog().setFiberG(new BigDecimal("90")); pantryCatalogRepository.saveAndFlush(row.getCatalog());` (autowire `PantryCatalogRepository`); `ProtocolSeedDataIT:46-52` → `tasty.getCatalog().getKind()`, `tasty.getCatalog().getCaffeine()` (`getDose()`, `getTiming()`, `getStockQty()` stay on the item).

- [ ] **Step 2: Compile + run the touched suites**

Run: `cd backend && ./mvnw clean test -Dtest='PantryItemRepositoryIT,MealService*,MealApiIT,RecipeService*,RecipeApiIT,RecipeBreakdown*,Protocol*,Intake*,HabitEvaluator*,CharacterSignal*,PantrySuggestionServiceTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (`PantryItemRepositoryIT` from Task 3 passes now too). If a test creates the same food name twice for one owner and asserts two rows, give the second a distinct name — one live row per (owner, definition) is the new invariant.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "refactor(pantry): definition reads through PantryItemEntity.getCatalog() across meal/recipe/fuel/habit/character (mezo-qw37.4)"
```

---
### Task 5: `PantryCatalogLoader` — profile-independent master upsert, never a `pantry_item`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoader.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoaderIT.java` (rewrite)

**Interfaces:**
- Produces: `PantryCatalogLoader.run()` (no-arg, `@Transactional`) — upserts the 147 rows of `seed/pantry-catalog.json` into `pantry_catalog` by natural key with `created_by = NULL`; on a hit it claims the row as master (`created_by → NULL`, `is_deleted → false`) and fills only NULL definition fields (never overwrites a curated value); it never writes `pantry_item`. The JSON's `stockQty`/`stockUnit`/`priceHuf` are per-user facts and are ignored (the migration already carried the owner's stock/prices onto his items). `@Order(50)`, no `@Profile`. `PantryCatalogLoader.naturalKey(name, brand)` (package-private static) mirrors `uq_pantry_catalog_natural`.

- [ ] **Step 1: Rewrite the failing IT**

Replace `PantryCatalogLoaderIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** The catalog loader is master content (every profile), upserts by natural key, never creates a shelf row. */
@Transactional
class PantryCatalogLoaderIT extends AbstractIntegrationTest {

    private static final int CATALOG_SIZE = 147;

    @Autowired private PantryCatalogLoader loader;
    @Autowired private PantryCatalogRepository catalogRepository;
    @Autowired private PantryItemRepository itemRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testRun_shouldLoadMasterRows_whenContextStarts() {
        // Profile-independent: it already ran at startup; ResetDatabase keeps created_by IS NULL rows.
        assertThat(catalogRepository.findByCreatedByIsNull()).hasSize(CATALOG_SIZE);
        PantryCatalogEntity bulgur = catalogRepository.findByNaturalKey("Bulgur Raw Kifli", null).orElseThrow();
        assertThat(bulgur.isMaster()).isTrue();
        assertThat(bulgur.getKind()).isEqualTo("food");
        assertThat(bulgur.getCategory()).isEqualTo("grains");
        assertThat(bulgur.getSource()).isEqualTo("kifli.hu");
        assertThat(bulgur.getFiberG()).isEqualByComparingTo(new BigDecimal("13"));
        assertThat(bulgur.getNova()).isEqualTo((short) 1);
        assertThat(catalogRepository.findByCreatedByIsNull()).anyMatch(c -> "lidl".equals(c.getSource()));
        assertThat(catalogRepository.findByCreatedByIsNull())
            .filteredOn(c -> c.getNova() == null).extracting(PantryCatalogEntity::getName)
            .containsExactlyInAnyOrder("Jenny Kaja", "Szilvia Törlőkendő");
    }

    @Test
    void testRun_shouldNeverCreatePantryItems() {
        UUID owner = databasePopulator.populateUser("loader-owner@test.local");
        loader.run();
        assertThat(itemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();
        assertThat(itemRepository.count()).isZero();
    }

    @Test
    void testRun_shouldBeIdempotent_whenRunTwice() {
        long before = catalogRepository.count();
        loader.run();
        assertThat(catalogRepository.count()).isEqualTo(before);
    }

    @Test
    void testRun_shouldClaimUserRowAndFillNullsOnly_whenNaturalKeyAlreadyAuthoredByAUser() {
        UUID user = databasePopulator.populateUser("loader-user@test.local");
        PantryCatalogEntity bulgur = catalogRepository.findByNaturalKey("Bulgur Raw Kifli", null).orElseThrow();
        // Simulate the migrated prod state: the owner's own row for a seed food, curated by hand.
        bulgur.setCreatedBy(user);
        bulgur.setNova((short) 4);     // deliberate hand-set value — must survive
        bulgur.setFiberG(null);        // a gap the seed can fill (seed: 13)
        catalogRepository.saveAndFlush(bulgur);

        loader.run();

        PantryCatalogEntity after = catalogRepository.findById(bulgur.getId()).orElseThrow();
        assertThat(after.isMaster()).isTrue();                                   // claimed as master
        assertThat(after.getNova()).isEqualTo((short) 4);                         // curated value untouched
        assertThat(after.getFiberG()).isEqualByComparingTo(new BigDecimal("13")); // NULL filled from the seed
        assertThat(catalogRepository.findByCreatedByIsNull()).hasSize(CATALOG_SIZE); // no duplicate row
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='PantryCatalogLoaderIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `findByCreatedByIsNull()` is empty (the loader still seeds the owner's shelf under `demodata` only).

- [ ] **Step 3: Rewrite the loader**

```java
package io.mrkuhne.mezo.feature.pantry;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Master-content loader for the shared pantry catalog (S4, mezo-qw37.4 — the ExerciseCatalogLoader
 * shape): runs in EVERY profile, upserts {@code seed/pantry-catalog.json} (147 definitions) into
 * {@code pantry_catalog} by natural key with {@code created_by = NULL}. A natural-key hit is CLAIMED
 * as master (a migrated owner row, or a user who typed the same food) and only its NULL definition
 * fields are filled — a curated value is never overwritten. It never creates a {@code pantry_item}:
 * a user's shelf starts empty and grows from the catalog ("Hozzáadás a közösből").
 */
@Slf4j
@Component
@Order(50)
@RequiredArgsConstructor
public class PantryCatalogLoader implements CommandLineRunner {

    private final PantryCatalogRepository repository;
    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)

    /** One row as authored in seed/pantry-catalog.json. priceHuf/stockQty/stockUnit are per-user facts — read, ignored. */
    public record CatalogRow(
        String name, String kind, String source, String category,
        BigDecimal per, String unit,
        BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG,
        BigDecimal fiberG, BigDecimal sugarG, BigDecimal saltG, BigDecimal saturatedFatG,
        Integer priceHuf, String packageLabel,
        BigDecimal stockQty, String stockUnit,
        Short nova) {}

    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by the IT to re-run against a drifted DB. */
    @Transactional
    public void run() {
        Map<String, PantryCatalogEntity> byKey = new HashMap<>();
        repository.findAll().forEach(c -> byKey.put(naturalKey(c.getName(), c.getBrand()), c));
        int inserted = 0;
        int claimed = 0;
        for (CatalogRow row : readCatalog()) {
            String key = naturalKey(row.name(), null);
            PantryCatalogEntity hit = byKey.get(key);
            if (hit == null) {
                PantryCatalogEntity c = new PantryCatalogEntity();
                c.setName(row.name());
                fill(c, row, true);
                byKey.put(key, repository.save(c));
                inserted++;
                continue;
            }
            if (!hit.isMaster() || hit.isDeleted()) {
                hit.setCreatedBy(null);
                hit.setDeleted(false);
                claimed++;
            }
            fill(hit, row, false); // NULL-only backfill (the mezo-32ko nova rule, generalized)
            repository.save(hit);
        }
        if (inserted > 0 || claimed > 0) {
            log.info("pantry catalog: {} master row(s) inserted, {} claimed (mezo-qw37.4)", inserted, claimed);
        }
    }

    /** {@code overwrite=true} for a new row; otherwise only NULL fields take the seed value. */
    private static void fill(PantryCatalogEntity c, CatalogRow r, boolean overwrite) {
        set(overwrite, c::getKind, c::setKind, r.kind());
        set(overwrite, c::getSource, c::setSource, r.source());
        set(overwrite, c::getCategory, c::setCategory, r.category());
        set(overwrite, c::getServingAmount, c::setServingAmount, r.per());
        set(overwrite, c::getServingUnit, c::setServingUnit, r.unit());
        set(overwrite, c::getKcal, c::setKcal, r.kcal());
        set(overwrite, c::getProteinG, c::setProteinG, r.proteinG());
        set(overwrite, c::getCarbsG, c::setCarbsG, r.carbsG());
        set(overwrite, c::getFatG, c::setFatG, r.fatG());
        set(overwrite, c::getFiberG, c::setFiberG, r.fiberG());
        set(overwrite, c::getSugarG, c::setSugarG, r.sugarG());
        set(overwrite, c::getSaltG, c::setSaltG, r.saltG());
        set(overwrite, c::getSaturatedFatG, c::setSaturatedFatG, r.saturatedFatG());
        set(overwrite, c::getPackageLabel, c::setPackageLabel, r.packageLabel());
        set(overwrite, c::getNova, c::setNova, r.nova());
    }

    private static <T> void set(boolean overwrite, Supplier<T> getter, Consumer<T> setter, T seed) {
        if (seed == null) return;
        if (overwrite || getter.get() == null) setter.accept(seed);
    }

    /** Mirrors uq_pantry_catalog_natural: lower(name) + lower(coalesce(brand,'')). */
    static String naturalKey(String name, String brand) {
        return name.strip().toLowerCase() + "|" + (brand == null ? "" : brand.strip().toLowerCase());
    }

    private List<CatalogRow> readCatalog() {
        try (InputStream in = new ClassPathResource("seed/pantry-catalog.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, CatalogRow.class));
        } catch (IOException e) {
            throw new IllegalStateException("seed/pantry-catalog.json is unreadable", e);
        }
    }
}
```
(`IllegalStateException` in a startup loader mirrors `ExerciseCatalogLoader`, which the ArchUnit raw-exception rule already tolerates for loaders — verify by running `ArchitectureTest`; if it bites, throw `SystemRuntimeErrorException(SystemMessage.error("PANTRY_CATALOG_SEED_UNREADABLE").build(), HttpStatus.INTERNAL_SERVER_ERROR)` and add the code to `messages.properties`.) Delete the now-unused `AppUserRepository`/`OwnerProperties`/`PantryItemRepository` imports and the `@Profile` import.

- [ ] **Step 4: Run + commit**

Run: `cd backend && ./mvnw clean test -Dtest='PantryCatalogLoaderIT,ProtocolSeedDataIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoader.java backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoaderIT.java
git commit -m "feat(pantry): profile-independent PantryCatalogLoader upserting master definitions by natural key (mezo-qw37.4)"
```

---
### Task 6: `PantryCatalogService` + `PantryService`/`PantryMapper`/`PantryController` — search, from-catalog, natural-key bind, 403 edit gate

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryCatalogService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/mapper/PantryMapper.java` (rewrite), `feature/pantry/service/PantryService.java` (rewrite), `feature/pantry/controller/PantryController.java`, `feature/fuel/ProtocolSeedData.java` (swap the Task 4 inline find-or-create for the service), `backend/src/main/resources/messages.properties`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogApiIT.java` (new), `feature/pantry/PantryApiIT.java`, `feature/pantry/PantryServiceIT.java`, `feature/pantry/PantryCatalogServiceIT.java` (new)

**Interfaces:**
- Consumes: `CurrentUser.get() : AppUserEntity`, `CurrentUser.id() : UUID` (S1), `AppUserEntity.isOwner()`, `AppUserRepository.findAllById`, `ApiIntegrationTest.registerUser(label)` (S1).
- Produces: `PantryCatalogService.search(String q, String kind) : List<PantryCatalogEntry>`; `findOrCreate(UUID authorId, PantryCatalogEntity candidate) : PantryCatalogEntity` (natural-key hit → revived + returned, else inserted under `authorId` in a `REQUIRES_NEW` transaction so a concurrent identical insert binds to the winner); `ensureItem(UUID userId, UUID catalogId) : PantryItemEntity` (idempotent; 404 `RESOURCE_NOT_FOUND` for an unknown/deleted catalog id); `editable(AppUserEntity user, PantryCatalogEntity c) : boolean` (OWNER, or the author of a non-master row); `requireEditable(user, c)` → 403 `PANTRY_CATALOG_NOT_EDITABLE`; `authorNames(Collection<PantryCatalogEntity>) : Map<UUID,String>`; `sharedFromName(UUID userId, PantryCatalogEntity c, Map<UUID,String> names) : String` (null when master or own). `PantryService.getPantry(AppUserEntity)`, `createItem(UUID, PantryItemRequest)` (binds by `catalogId`, else natural-key find-or-create — no 409), `updateItem(AppUserEntity, UUID, PantryItemRequest)` (state always; definition only when a definition field actually differs AND the caller may edit, else 403; rename collision → 409 `PANTRY_CATALOG_NAME_TAKEN`), `deleteItem(UUID, UUID)` (soft-deletes the item only), `addFromCatalog(UUID, UUID) : PantryItemResponse`.

- [ ] **Step 1: Message codes**

Append to `backend/src/main/resources/messages.properties` after the `PANTRY_PHOTO_*` lines:

```properties
PANTRY_CATALOG_NOT_EDITABLE=Only the author or the owner can edit this shared catalog entry.
PANTRY_CATALOG_NAME_TAKEN=Another catalog entry already carries this name and brand.
```

- [ ] **Step 2: Write the failing HTTP IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogApiIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.PantryCatalogEntry;
import io.mrkuhne.mezo.api.dto.PantryFromCatalogRequest;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/** S4 (mezo-qw37.4): the shared catalog over HTTP — search, from-catalog idempotency, the author/OWNER edit gate. */
class PantryCatalogApiIT extends ApiIntegrationTest {

    private PantryItemRequest food(String name, String brand, int kcal) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setBrand(brand);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(BigDecimal.valueOf(kcal));
        r.setPrice(990);
        return r;
    }

    private IngredientResponse ingredientOf(HttpHeaders auth, UUID itemId) {
        return getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class).getIngredients().stream()
            .filter(i -> i.getId().equals(itemId)).findFirst().orElseThrow();
    }

    @Test
    void testCreate_shouldBindToExistingCatalogRow_whenAnotherUserAlreadyDefinedTheSameNameAndBrand() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");

        PantryItemResponse annas = postForBody("/api/pantry", food("Skyr natúr", "Ehrmann", 63), anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        PantryItemResponse belas = postForBody("/api/pantry", food("skyr natúr", "EHRMANN", 999), bela.headers(), HttpStatus.CREATED, PantryItemResponse.class);

        assertThat(belas.getId()).isNotEqualTo(annas.getId());
        assertThat(belas.getCatalogId()).isEqualTo(annas.getCatalogId()); // natural-key hit, no 409
        IngredientResponse belaSees = ingredientOf(bela.headers(), belas.getId());
        assertThat(belaSees.getMacros().getKcal()).isEqualByComparingTo("63");  // the winner's definition, not Béla's 999
        assertThat(belaSees.getPrice()).isEqualByComparingTo("990");            // his own state
        assertThat(belaSees.getSharedFrom()).isNotNull();
        assertThat(belaSees.getSharedFrom().getAuthorName()).isEqualTo("Anna");
        assertThat(belaSees.getCatalogEditable()).isFalse();
        assertThat(ingredientOf(anna.headers(), annas.getId()).getSharedFrom()).isNull();
        assertThat(ingredientOf(anna.headers(), annas.getId()).getCatalogEditable()).isTrue();
    }

    @Test
    void testSearch_shouldFindEveryUsersDefinitionsAndMaster_whenQueryMatchesNameOrBrand() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        postForBody("/api/pantry", food("Kecsketej", "Hollandia", 60), anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);

        List<PantryCatalogEntry> hits = getForList("/api/pantry/catalog?q=kecske", bela.headers(), HttpStatus.OK, PantryCatalogEntry.class);
        assertThat(hits).extracting(PantryCatalogEntry::getName).containsExactly("Kecsketej");
        assertThat(hits.getFirst().getAuthorName()).isEqualTo("Anna");

        List<PantryCatalogEntry> master = getForList("/api/pantry/catalog?q=bulgur", bela.headers(), HttpStatus.OK, PantryCatalogEntry.class);
        assertThat(master).extracting(PantryCatalogEntry::getName).contains("Bulgur Raw Kifli");
        assertThat(master.getFirst().getAuthorName()).isNull(); // loader master

        List<PantryCatalogEntry> supplements = getForList("/api/pantry/catalog?kind=supplement", bela.headers(), HttpStatus.OK, PantryCatalogEntry.class);
        assertThat(supplements).allMatch(e -> e.getKind() == PantryCatalogEntry.KindEnum.SUPPLEMENT);
        getForBody("/api/pantry/catalog?kind=drink", bela.headers(), HttpStatus.BAD_REQUEST, String.class);
        getForBody("/api/pantry/catalog?q=bulgur", null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testFromCatalog_shouldBeIdempotent_andReturn404ForUnknownEntry() {
        RegisteredUser bela = registerUser("Béla");
        UUID bulgur = getForList("/api/pantry/catalog?q=Bulgur%20Raw", bela.headers(), HttpStatus.OK, PantryCatalogEntry.class).getFirst().getId();

        PantryItemResponse first = postForBody("/api/pantry/items/from-catalog", new PantryFromCatalogRequest(bulgur), bela.headers(), HttpStatus.OK, PantryItemResponse.class);
        PantryItemResponse second = postForBody("/api/pantry/items/from-catalog", new PantryFromCatalogRequest(bulgur), bela.headers(), HttpStatus.OK, PantryItemResponse.class);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(first.getCatalogId()).isEqualTo(bulgur);
        PantryResponse pantry = getForBody("/api/pantry", bela.headers(), HttpStatus.OK, PantryResponse.class);
        assertThat(pantry.getIngredients()).filteredOn(i -> i.getCatalogId().equals(bulgur)).hasSize(1);
        assertThat(pantry.getIngredients().getFirst().getSharedFrom()).isNull(); // master: not "shared from" anyone
        assertThat(pantry.getIngredients().getFirst().getCatalogEditable()).isFalse(); // USER cannot edit master
        String body = postForBody("/api/pantry/items/from-catalog", new PantryFromCatalogRequest(UUID.randomUUID()), bela.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testUpdate_shouldGateDefinitionEditsByAuthorOrOwner_andAlwaysAllowState() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        HttpHeaders owner = ownerAuthHeaders();
        PantryItemResponse annas = postForBody("/api/pantry", food("Görög joghurt", "Mizo", 119), anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        PantryItemResponse belas = postForBody("/api/pantry/items/from-catalog", new PantryFromCatalogRequest(annas.getCatalogId()), bela.headers(), HttpStatus.OK, PantryItemResponse.class);

        // Béla changes only STATE (price) while echoing the definition unchanged -> 200
        PantryItemRequest priceOnly = food("Görög joghurt", "Mizo", 119);
        priceOnly.setPrice(1490);
        putForBody("/api/pantry/" + belas.getId(), priceOnly, bela.headers(), HttpStatus.OK, PantryItemResponse.class);
        assertThat(ingredientOf(bela.headers(), belas.getId()).getPrice()).isEqualByComparingTo("1490");

        // Béla changes a DEFINITION field (kcal) -> 403, nothing written
        PantryItemRequest kcalEdit = food("Görög joghurt", "Mizo", 200);
        String body = exchangeForBody(HttpMethod.PUT, "/api/pantry/" + belas.getId(), kcalEdit, bela.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "PANTRY_CATALOG_NOT_EDITABLE");
        assertThat(ingredientOf(anna.headers(), annas.getId()).getMacros().getKcal()).isEqualByComparingTo("119");

        // Anna (author) edits kcal -> 200 and Béla sees it too (shared definition)
        putForBody("/api/pantry/" + annas.getId(), kcalEdit, anna.headers(), HttpStatus.OK, PantryItemResponse.class);
        assertThat(ingredientOf(bela.headers(), belas.getId()).getMacros().getKcal()).isEqualByComparingTo("200");

        // OWNER edits anyone's definition -> 200 (via his own shelf row)
        PantryItemResponse owners = postForBody("/api/pantry/items/from-catalog", new PantryFromCatalogRequest(annas.getCatalogId()), owner, HttpStatus.OK, PantryItemResponse.class);
        putForBody("/api/pantry/" + owners.getId(), food("Görög joghurt", "Mizo", 210), owner, HttpStatus.OK, PantryItemResponse.class);
        assertThat(ingredientOf(anna.headers(), annas.getId()).getMacros().getKcal()).isEqualByComparingTo("210");

        // Renaming onto another entry's natural key -> 409
        postForBody("/api/pantry", food("Skyr natúr", "Mizo", 63), anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        String clash = exchangeForBody(HttpMethod.PUT, "/api/pantry/" + annas.getId(), food("Skyr natúr", "Mizo", 210), anna.headers(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(clash, "PANTRY_CATALOG_NAME_TAKEN");
    }

    @Test
    void testDelete_shouldSoftDeleteOnlyTheShelfRow_whenAnotherUserSharesTheDefinition() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        PantryItemResponse annas = postForBody("/api/pantry", food("Kefir", "Mizo", 55), anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        PantryItemResponse belas = postForBody("/api/pantry/items/from-catalog", new PantryFromCatalogRequest(annas.getCatalogId()), bela.headers(), HttpStatus.OK, PantryItemResponse.class);

        deleteAndExpect("/api/pantry/" + annas.getId(), anna.headers(), HttpStatus.NO_CONTENT);

        assertThat(getForBody("/api/pantry", anna.headers(), HttpStatus.OK, PantryResponse.class).getIngredients()).isEmpty();
        assertThat(ingredientOf(bela.headers(), belas.getId()).getName()).isEqualTo("Kefir"); // definition survives
        // and Anna can re-add it from the catalog (a NEW live row; the old one stays soft-deleted)
        PantryItemResponse again = postForBody("/api/pantry/items/from-catalog", new PantryFromCatalogRequest(annas.getCatalogId()), anna.headers(), HttpStatus.OK, PantryItemResponse.class);
        assertThat(again.getId()).isNotEqualTo(annas.getId());
    }
}
```

Also extend `PantryApiIT` with one assertion in `testCreateThenGet_shouldReturnFoodInIngredients_whenAuthed`: `assertThat(pantry.getIngredients().getFirst().getCatalogId()).isNotNull(); assertThat(pantry.getIngredients().getFirst().getCatalogEditable()).isTrue();` (the seeded owner is OWNER).

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='PantryCatalogApiIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — 404/405 on `/api/pantry/catalog` and `/api/pantry/items/from-catalog` (the generated `PantryApi` methods are unimplemented → compile error on `PantryController`, which is the first failure).

- [ ] **Step 4: `PantryCatalogService`**

```java
package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryCatalogEntry;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.mapper.PantryMapper;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The shared-catalog rules (S4, mezo-qw37.4): natural-key find-or-create, the idempotent
 * "put it on my shelf" ({@link #ensureItem}), the author-or-OWNER edit gate, and the
 * "shared from" author names. Every writer that turns a definition into a shelf row —
 * PantryService, PantryImportService, ProtocolSeedData, the AI meal draft, the Receptműhely —
 * goes through here so the one-live-row-per-(user, definition) invariant has one owner.
 */
@Service
@RequiredArgsConstructor
public class PantryCatalogService {

    static final int SEARCH_LIMIT = 50;

    private final PantryCatalogRepository catalogRepository;
    private final PantryItemRepository itemRepository;
    private final AppUserRepository appUserRepository;
    private final PantryMapper mapper;
    private final PlatformTransactionManager transactionManager;

    /** Global search: master + every user's live definitions, name OR brand, case-insensitive, max 50. */
    @Transactional(readOnly = true)
    public List<PantryCatalogEntry> search(String q, String kind) {
        String like = "%" + (q == null ? "" : q.strip().toLowerCase().replace("%", "\\%").replace("_", "\\_")) + "%";
        List<PantryCatalogEntity> hits = kind == null || kind.isBlank()
            ? catalogRepository.searchAll(like, Limit.of(SEARCH_LIMIT))
            : catalogRepository.searchByKind(like, kind, Limit.of(SEARCH_LIMIT));
        Map<UUID, String> names = authorNames(hits);
        return hits.stream().map(c -> mapper.toCatalogEntry(c, c.isMaster() ? null : names.get(c.getCreatedBy()))).toList();
    }

    /**
     * Natural-key find-or-create. A hit (even a soft-deleted one from the migration) is revived and
     * returned — never a 409 (spec §11). A miss is inserted in its OWN committed transaction so that
     * two users typing the same food at once both end up bound to the single winner: the loser's
     * unique-index violation is caught and re-resolved by lookup.
     */
    public PantryCatalogEntity findOrCreate(UUID authorId, PantryCatalogEntity candidate) {
        Objects.requireNonNull(candidate.getName(), "candidate.name");
        return catalogRepository.findByNaturalKey(candidate.getName(), candidate.getBrand())
            .map(this::revive)
            .orElseGet(() -> insertOrBind(authorId, candidate));
    }

    private PantryCatalogEntity revive(PantryCatalogEntity c) {
        if (c.isDeleted()) {
            c.setDeleted(false);
            return catalogRepository.save(c);
        }
        return c;
    }

    private PantryCatalogEntity insertOrBind(UUID authorId, PantryCatalogEntity candidate) {
        TransactionTemplate own = new TransactionTemplate(transactionManager);
        own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        try {
            UUID id = own.execute(status -> {
                candidate.setCreatedBy(authorId);
                candidate.setName(candidate.getName().strip());
                if (candidate.getSource() == null) candidate.setSource("manual");
                return catalogRepository.saveAndFlush(candidate).getId();
            });
            return catalogRepository.findById(id).orElseThrow(); // re-read in the caller's session
        } catch (DataIntegrityViolationException raced) {
            return catalogRepository.findByNaturalKey(candidate.getName(), candidate.getBrand())
                .map(this::revive)
                .orElseThrow(() -> raced);
        }
    }

    /** Idempotent "from-catalog": the user's live row for the definition, created if missing. */
    @Transactional
    public PantryItemEntity ensureItem(UUID userId, UUID catalogId) {
        return itemRepository.findByCreatedByAndCatalog_IdAndDeletedFalse(userId, catalogId).orElseGet(() -> {
            PantryCatalogEntity catalog = catalogRepository.findById(catalogId)
                .filter(c -> !c.isDeleted())
                .orElseThrow(() -> new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
            PantryItemEntity item = new PantryItemEntity();
            item.setCreatedBy(userId); // server-side ownership — never from the client
            item.setCatalog(catalog);
            return itemRepository.saveAndFlush(item);
        });
    }

    /** OWNER edits anything; a USER edits only the definitions they authored (master rows are OWNER-only). */
    public boolean editable(AppUserEntity user, PantryCatalogEntity c) {
        return user.isOwner() || (!c.isMaster() && c.getCreatedBy().equals(user.getId()));
    }

    public void requireEditable(AppUserEntity user, PantryCatalogEntity c) {
        if (!editable(user, c)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_CATALOG_NOT_EDITABLE").build(), HttpStatus.FORBIDDEN);
        }
    }

    /** One batch read of the authoring users' names (master rows have none). */
    public Map<UUID, String> authorNames(Collection<PantryCatalogEntity> rows) {
        List<UUID> ids = rows.stream().map(PantryCatalogEntity::getCreatedBy).filter(Objects::nonNull).distinct().toList();
        return ids.isEmpty() ? Map.of() : appUserRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(AppUserEntity::getId, AppUserEntity::getName));
    }

    /** null when the row is master or the user's own; else the author's display name. */
    public String sharedFromName(UUID userId, PantryCatalogEntity c, Map<UUID, String> names) {
        if (c.isMaster() || c.getCreatedBy().equals(userId)) return null;
        return names.getOrDefault(c.getCreatedBy(), "ismeretlen");
    }
}
```

- [ ] **Step 5: `PantryMapper` — definition vs state, plus the new response fields**

Rewrite the mapper's write side and response builders (keep `toStock`, `toImportEntry`, `toIngredientSource`, `toStashSource`, `nz`, `typeFromKind`, `LOW_EXPIRY_DAYS`, `LOG` as they are):

```java
    // ---- write side: DEFINITION (catalog) vs STATE (item) ----

    default void applyDefinition(PantryCatalogEntity c, PantryItemRequest r) {
        c.setKind(r.getKind() == null ? null : r.getKind().getValue());
        c.setName(r.getName());
        c.setBrand(r.getBrand());
        if (r.getSource() != null) c.setSource(r.getSource().getValue());
        c.setCategory(r.getCategory() == null ? null : r.getCategory().getValue());
        c.setServingAmount(r.getPer());
        c.setServingUnit(r.getUnit());
        c.setKcal(r.getKcal());
        c.setProteinG(r.getProteinG());
        c.setCarbsG(r.getCarbsG());
        c.setFatG(r.getFatG());
        c.setFiberG(r.getFiberG());
        c.setSugarG(r.getSugarG());
        c.setSaltG(r.getSaltG());
        c.setSaturatedFatG(r.getSaturatedFatG());
        c.setPackageLabel(r.getPkg());
        c.setMicros(r.getMicros() == null ? null
            : r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList());
        c.setNova(r.getNova() == null ? null : r.getNova().shortValue());
        c.setForm(r.getForm());
        c.setCaffeine(r.getCaffeine());
    }

    /** PATCH-style: null = leave unchanged (same contract as before the split). */
    default void applyDefinitionPartial(PantryCatalogEntity c, PantryItemRequest r) {
        if (r.getKind() != null) c.setKind(r.getKind().getValue());
        if (r.getName() != null) c.setName(r.getName());
        setIfPresent(r.getBrand(), c::setBrand);
        if (r.getSource() != null) c.setSource(r.getSource().getValue());
        if (r.getCategory() != null) c.setCategory(r.getCategory().getValue());
        setIfPresent(r.getPer(), c::setServingAmount);
        setIfPresent(r.getUnit(), c::setServingUnit);
        setIfPresent(r.getKcal(), c::setKcal);
        setIfPresent(r.getProteinG(), c::setProteinG);
        setIfPresent(r.getCarbsG(), c::setCarbsG);
        setIfPresent(r.getFatG(), c::setFatG);
        setIfPresent(r.getFiberG(), c::setFiberG);
        setIfPresent(r.getSugarG(), c::setSugarG);
        setIfPresent(r.getSaltG(), c::setSaltG);
        setIfPresent(r.getSaturatedFatG(), c::setSaturatedFatG);
        setIfPresent(r.getPkg(), c::setPackageLabel);
        if (r.getMicros() != null) c.setMicros(
            r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList());
        if (r.getNova() != null) c.setNova(r.getNova().shortValue());
        setIfPresent(r.getForm(), c::setForm);
        setIfPresent(r.getCaffeine(), c::setCaffeine);
    }

    /**
     * True when any definition field the request CARRIES differs from the catalog row. This is the
     * 403 trigger: the edit sheet always echoes the definition back, so an unchanged echo must pass
     * for a user who may not edit the shared row.
     */
    default boolean definitionDiffers(PantryCatalogEntity c, PantryItemRequest r) {
        return (r.getKind() != null && !r.getKind().getValue().equals(c.getKind()))
            || (r.getName() != null && !r.getName().strip().equals(c.getName()))
            || (r.getBrand() != null && !r.getBrand().strip().equals(c.getBrand() == null ? "" : c.getBrand().strip()))
            || (r.getSource() != null && !r.getSource().getValue().equals(c.getSource()))
            || (r.getCategory() != null && !r.getCategory().getValue().equals(c.getCategory()))
            || numDiffers(r.getPer(), c.getServingAmount())
            || (r.getUnit() != null && !r.getUnit().equals(c.getServingUnit()))
            || numDiffers(r.getKcal(), c.getKcal()) || numDiffers(r.getProteinG(), c.getProteinG())
            || numDiffers(r.getCarbsG(), c.getCarbsG()) || numDiffers(r.getFatG(), c.getFatG())
            || numDiffers(r.getFiberG(), c.getFiberG()) || numDiffers(r.getSugarG(), c.getSugarG())
            || numDiffers(r.getSaltG(), c.getSaltG()) || numDiffers(r.getSaturatedFatG(), c.getSaturatedFatG())
            || (r.getPkg() != null && !r.getPkg().equals(c.getPackageLabel()))
            || (r.getMicros() != null && !r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList()
                .equals(c.getMicros() == null ? List.of() : c.getMicros()))
            || (r.getNova() != null && !Short.valueOf(r.getNova().shortValue()).equals(c.getNova()))
            || (r.getForm() != null && !r.getForm().equals(c.getForm()))
            || (r.getCaffeine() != null && !r.getCaffeine().equals(c.getCaffeine()));
    }

    private static boolean numDiffers(BigDecimal requested, BigDecimal stored) {
        if (requested == null) return false;
        return stored == null || requested.compareTo(stored) != 0;
    }

    default void applyUserFields(PantryItemEntity e, PantryItemRequest r) {
        e.setNotes(r.getNotes());
        e.setPriceHuf(r.getPrice());
        e.setPriceUnit(r.getPriceUnit());
        e.setStockQty(r.getStockQty());
        e.setStockUnit(r.getStockUnit());
        e.setStockExpires(r.getStockExpires());
        e.setDose(r.getDose());
        e.setProtocol(r.getProtocol());
        e.setTiming(r.getTiming());
    }

    default void applyUserFieldsPartial(PantryItemEntity e, PantryItemRequest r) {
        setIfPresent(r.getNotes(), e::setNotes);
        setIfPresent(r.getPrice(), e::setPriceHuf);
        setIfPresent(r.getPriceUnit(), e::setPriceUnit);
        setIfPresent(r.getStockQty(), e::setStockQty);
        setIfPresent(r.getStockUnit(), e::setStockUnit);
        setIfPresent(r.getStockExpires(), e::setStockExpires);
        setIfPresent(r.getDose(), e::setDose);
        setIfPresent(r.getProtocol(), e::setProtocol);
        setIfPresent(r.getTiming(), e::setTiming);
    }
```

Response side — replace `toIngredientResponse(PantryItemEntity)` / `toSupplementResponse(PantryItemEntity)` / `toItemResponse` with:

```java
    default IngredientResponse toIngredientResponse(PantryItemEntity e, String sharedFromName, boolean catalogEditable) {
        PantryCatalogEntity c = e.getCatalog();
        return IngredientResponse.builder()
            .id(e.getId())
            .name(c.getName())
            .brand(c.getBrand() == null ? "" : c.getBrand())
            .source(toIngredientSource(c.getSource()))
            .category(c.getCategory() == null ? "" : c.getCategory())
            .per(c.getServingAmount())
            .unit(c.getServingUnit())
            .macros(PantryMacros.builder()
                .kcal(nz(c.getKcal())).p(nz(c.getProteinG())).c(nz(c.getCarbsG())).f(nz(c.getFatG())).build())
            .price(e.getPriceHuf() == null ? BigDecimal.ZERO : BigDecimal.valueOf(e.getPriceHuf()))
            .priceUnit(e.getPriceUnit() == null ? "" : e.getPriceUnit())
            .pkg(c.getPackageLabel() == null ? "" : c.getPackageLabel())
            .micros(c.getMicros() == null ? List.of()
                : c.getMicros().stream().map(m -> PantryMicro.builder().name(m.name()).pct(m.pct()).build()).toList())
            .nova(c.getNova() == null ? null : c.getNova().intValue()) // honest null since mezo-32ko
            .stock(toStock(e))
            .fiberG(c.getFiberG())
            .sugarG(c.getSugarG())
            .saltG(c.getSaltG())
            .saturatedFatG(c.getSaturatedFatG())
            .lastUsed("—")
            .usedInRecipes(0)
            .catalogId(c.getId())
            .sharedFrom(sharedFromName == null ? null : PantrySharedFrom.builder().authorName(sharedFromName).build())
            .catalogEditable(catalogEditable)
            .build();
    }

    default SupplementStashResponse toSupplementResponse(PantryItemEntity e, String sharedFromName, boolean catalogEditable) {
        PantryCatalogEntity c = e.getCatalog();
        return SupplementStashResponse.builder()
            .id(e.getId())
            .name(c.getName())
            .brand(c.getBrand() == null ? "" : c.getBrand())
            .type(SupplementStashResponse.TypeEnum.fromValue(typeFromKind(c.getKind())))
            .category(c.getCategory() == null ? "" : c.getCategory())
            .dose(e.getDose() == null ? "" : e.getDose())
            .form(c.getForm() == null ? "" : c.getForm())
            .stock(e.getStockQty())
            .stockUnit(e.getStockUnit())
            .protocol(e.getProtocol() == null ? "" : e.getProtocol())
            .timing(e.getTiming() == null ? "" : e.getTiming())
            .taken(e.isTaken())
            .caffeine(c.getCaffeine())
            .source(c.getSource() == null ? null : toStashSource(c.getSource()))
            .per(c.getServingAmount())
            .unit(c.getServingUnit())
            .macros(c.getKcal() == null ? null : PantryMacros.builder()
                .kcal(nz(c.getKcal())).p(nz(c.getProteinG())).c(nz(c.getCarbsG())).f(nz(c.getFatG())).build())
            .price(e.getPriceHuf() == null ? null : BigDecimal.valueOf(e.getPriceHuf()))
            .priceUnit(e.getPriceUnit())
            .pkg(c.getPackageLabel())
            .micros(c.getMicros() == null ? null
                : c.getMicros().stream().map(m -> PantryMicro.builder().name(m.name()).pct(m.pct()).build()).toList())
            .nova(c.getNova() == null ? null : c.getNova().intValue())
            .fiberG(c.getFiberG())
            .sugarG(c.getSugarG())
            .saltG(c.getSaltG())
            .saturatedFatG(c.getSaturatedFatG())
            .catalogId(c.getId())
            .sharedFrom(sharedFromName == null ? null : PantrySharedFrom.builder().authorName(sharedFromName).build())
            .catalogEditable(catalogEditable)
            .build();
    }

    default PantryItemResponse toItemResponse(PantryItemEntity e) {
        PantryCatalogEntity c = e.getCatalog();
        return PantryItemResponse.builder()
            .id(e.getId())
            .catalogId(c.getId())
            .kind(PantryItemResponse.KindEnum.fromValue(c.getKind()))
            .name(c.getName())
            .brand(c.getBrand())
            .source(c.getSource())
            .category(c.getCategory())
            .build();
    }

    default PantryCatalogEntry toCatalogEntry(PantryCatalogEntity c, String authorName) {
        return PantryCatalogEntry.builder()
            .id(c.getId())
            .kind(PantryCatalogEntry.KindEnum.fromValue(c.getKind()))
            .name(c.getName())
            .brand(c.getBrand())
            .source(toIngredientSource(c.getSource()))
            .category(c.getCategory())
            .per(c.getServingAmount())
            .unit(c.getServingUnit())
            .kcal(c.getKcal()).proteinG(c.getProteinG()).carbsG(c.getCarbsG()).fatG(c.getFatG())
            .fiberG(c.getFiberG()).sugarG(c.getSugarG()).saltG(c.getSaltG()).saturatedFatG(c.getSaturatedFatG())
            .nova(c.getNova() == null ? null : c.getNova().intValue())
            .form(c.getForm())
            .caffeine(c.getCaffeine())
            .authorName(authorName)
            .build();
    }
```
(Add imports `io.mrkuhne.mezo.api.dto.PantryCatalogEntry`, `io.mrkuhne.mezo.api.dto.PantrySharedFrom`, `io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity`. Delete `applyRequest`/`applyRequestPartial` and the old single-arg response builders; the Task 4 compile shims go with them.)

- [ ] **Step 6: `PantryService` rewrite**

```java
package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.pantry.config.PantryImportProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.mapper.PantryMapper;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryImportRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PantryService {

    private final PantryItemRepository repository;
    private final PantryCatalogRepository catalogRepository;
    private final PantryImportRepository importRepository;
    private final PantryCatalogService catalogService;
    private final PantrySuggestionService suggestionService;
    private final PantryImportProperties importProperties;
    private final PantryMapper mapper;

    /**
     * The caller's shelf joined to the shared definitions (S4). {@code sharedFrom} names the author
     * of a definition someone else created; {@code catalogEditable} is the author-or-OWNER gate the
     * edit sheet uses to lock the definition fields.
     */
    @Transactional(readOnly = true)
    public PantryResponse getPantry(AppUserEntity user) {
        List<PantryItemEntity> items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(user.getId());
        Map<UUID, String> names = catalogService.authorNames(items.stream().map(PantryItemEntity::getCatalog).toList());
        return PantryResponse.builder()
            .ingredients(items.stream().filter(e -> "food".equals(e.getCatalog().getKind()))
                .map(e -> mapper.toIngredientResponse(e,
                    catalogService.sharedFromName(user.getId(), e.getCatalog(), names),
                    catalogService.editable(user, e.getCatalog()))).toList())
            .stash(items.stream().filter(e -> !"food".equals(e.getCatalog().getKind()))
                .map(e -> mapper.toSupplementResponse(e,
                    catalogService.sharedFromName(user.getId(), e.getCatalog(), names),
                    catalogService.editable(user, e.getCatalog()))).toList())
            .imports(importRepository
                .findByCreatedByAndDeletedFalseOrderByImportedAtDesc(user.getId(), Limit.of(importProperties.feedSize()))
                .stream().map(mapper::toImportEntry).toList())
            .suggestions(suggestionService.suggest(items))
            .build();
    }

    /**
     * With {@code catalogId}: bind to that definition (idempotent) and apply the state fields.
     * Without: find-or-create the definition by natural key — a hit binds to the existing shared
     * row (no 409, spec §11), so the caller's OWN definition values are only used for a NEW row.
     */
    @Transactional
    public PantryItemResponse createItem(UUID userId, PantryItemRequest req) {
        if (req.getCatalogId() != null) {
            PantryItemEntity item = catalogService.ensureItem(userId, req.getCatalogId());
            mapper.applyUserFieldsPartial(item, req);
            return mapper.toItemResponse(item);
        }
        validatePerKind(req);
        PantryCatalogEntity candidate = new PantryCatalogEntity();
        mapper.applyDefinition(candidate, req);
        PantryCatalogEntity catalog = catalogService.findOrCreate(userId, candidate);
        PantryItemEntity item = catalogService.ensureItem(userId, catalog.getId());
        mapper.applyUserFields(item, req);
        return mapper.toItemResponse(item);
    }

    /** The from-catalog endpoint — service-level twin of the AI/workshop auto-add. */
    @Transactional
    public PantryItemResponse addFromCatalog(UUID userId, UUID catalogId) {
        return mapper.toItemResponse(catalogService.ensureItem(userId, catalogId));
    }

    /**
     * State fields always; definition fields only when they actually differ AND the caller may edit
     * the shared row (author or OWNER) — else 403 and nothing is written. A rename onto another
     * entry's natural key is a 409 rather than a unique-index 500.
     */
    @Transactional
    public PantryItemResponse updateItem(AppUserEntity user, UUID id, PantryItemRequest req) {
        validatePerKind(req);
        PantryItemEntity e = requireOwned(user.getId(), id);
        PantryCatalogEntity c = e.getCatalog();
        if (mapper.definitionDiffers(c, req)) {
            catalogService.requireEditable(user, c);
            String newName = req.getName() == null ? c.getName() : req.getName().strip();
            String newBrand = req.getBrand() == null ? c.getBrand() : req.getBrand().strip();
            catalogRepository.findByNaturalKey(newName, newBrand)
                .filter(other -> !other.getId().equals(c.getId()))
                .ifPresent(other -> {
                    throw new SystemRuntimeErrorException(
                        SystemMessage.error("PANTRY_CATALOG_NAME_TAKEN").build(), HttpStatus.CONFLICT);
                });
            mapper.applyDefinitionPartial(c, req); // dirty-checked, flushed on commit
        }
        mapper.applyUserFieldsPartial(e, req);
        return mapper.toItemResponse(e);
    }

    /** Soft-deletes the SHELF row only; the shared definition (and other users' rows) survive. */
    @Transactional
    public void deleteItem(UUID userId, UUID id) {
        repository.delete(requireOwned(userId, id)); // @SQLDelete on pantry_item
    }

    /** Per-kind required fields live here (not DB CHECKs) so the single table stays flexible. */
    private void validatePerKind(PantryItemRequest req) {
        String kind = req.getKind() == null ? null : req.getKind().getValue();
        if ("food".equals(kind)) {
            requireField(req.getUnit(), "unit");
            requireField(req.getKcal(), "kcal");
        } else {
            boolean hasDose = req.getDose() != null && !req.getDose().isBlank();
            if (!hasDose && req.getPer() == null) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "dose").build(), HttpStatus.BAD_REQUEST);
            }
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

- [ ] **Step 7: Controller**

```java
package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryApi;
import io.mrkuhne.mezo.api.dto.PantryCatalogEntry;
import io.mrkuhne.mezo.api.dto.PantryFromCatalogRequest;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.feature.pantry.service.PantryCatalogService;
import io.mrkuhne.mezo.feature.pantry.service.PantryService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated {@link PantryApi}; mappings/status/validation come from the interface. */
@RestController
@RequiredArgsConstructor
public class PantryController implements PantryApi {

    private final PantryService service;
    private final PantryCatalogService catalogService;
    private final CurrentUser currentUser; // S1: the entity (role) is needed for the edit gate

    @Override
    public PantryResponse getPantry() {
        return service.getPantry(currentUser.get());
    }

    @Override
    public PantryItemResponse createPantryItem(PantryItemRequest pantryItemRequest) {
        return service.createItem(currentUser.id(), pantryItemRequest);
    }

    @Override
    public PantryItemResponse updatePantryItem(UUID id, PantryItemRequest pantryItemRequest) {
        return service.updateItem(currentUser.get(), id, pantryItemRequest);
    }

    @Override
    public void deletePantryItem(UUID id) {
        service.deleteItem(currentUser.id(), id);
    }

    @Override
    public List<PantryCatalogEntry> searchPantryCatalog(String q, String kind) {
        return catalogService.search(q, kind);
    }

    @Override
    public PantryItemResponse addPantryItemFromCatalog(PantryFromCatalogRequest req) {
        return service.addFromCatalog(currentUser.id(), req.getCatalogId());
    }
}
```

Then swap `ProtocolSeedData`'s Task-4 inline find-or-create for `pantryCatalogService.findOrCreate(ownerId, candidate)` + `pantryCatalogService.ensureItem(ownerId, catalog.getId())` and apply the state block to the returned item (save via `pantryItemRepository.save`).

- [ ] **Step 8: Service-level IT for the seams HTTP does not reach**

`backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.pantry.service.PantryCatalogService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryCatalogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** NOT @Transactional: findOrCreate commits in REQUIRES_NEW; ResetDatabase cleans up (user-authored rows only). */
class PantryCatalogServiceIT extends AbstractIntegrationTest {

    @Autowired private PantryCatalogService service;
    @Autowired private PantryCatalogRepository catalogRepository;
    @Autowired private PantryItemRepository itemRepository;
    @Autowired private PantryCatalogPopulator catalogPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private static PantryCatalogEntity candidate(String name, String brand) {
        PantryCatalogEntity c = new PantryCatalogEntity();
        c.setKind("food");
        c.setName(name);
        c.setBrand(brand);
        c.setSource("manual");
        return c;
    }

    @Test
    void testFindOrCreate_shouldReviveSoftDeletedRow_whenNaturalKeyMatches() {
        UUID user = databasePopulator.populateUser("cat-a@test.local");
        PantryCatalogEntity dead = catalogPopulator.createFoodDefinition(user, "Kefir", null);
        dead.setDeleted(true);
        catalogRepository.saveAndFlush(dead);

        PantryCatalogEntity got = service.findOrCreate(user, candidate("kefir", ""));

        assertThat(got.getId()).isEqualTo(dead.getId());
        assertThat(got.isDeleted()).isFalse();
        assertThat(catalogRepository.findAll()).filteredOn(c -> "Kefir".equalsIgnoreCase(c.getName())).hasSize(1);
    }

    @Test
    void testEnsureItem_shouldReturnTheSameLiveRow_andRejectDeletedCatalog() {
        UUID user = databasePopulator.populateUser("cat-a@test.local");
        PantryCatalogEntity def = catalogPopulator.createFoodDefinition(user, "Zabpehely", null);

        PantryItemEntity first = service.ensureItem(user, def.getId());
        PantryItemEntity second = service.ensureItem(user, def.getId());
        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(itemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(user)).hasSize(1);

        def.setDeleted(true);
        catalogRepository.saveAndFlush(def);
        itemRepository.delete(first);
        assertThatThrownBy(() -> service.ensureItem(user, def.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void testFindOrCreate_shouldBindToWinner_whenTwoUsersCreateTheSameKeyConcurrently() throws Exception {
        UUID a = databasePopulator.populateUser("cat-a@test.local");
        UUID b = databasePopulator.populateUser("cat-b@test.local");
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        var fa = pool.submit(() -> service.findOrCreate(a, candidate("Lencse", "Lidl")));
        var fb = pool.submit(() -> service.findOrCreate(b, candidate("lencse", "LIDL")));
        PantryCatalogEntity ra = fa.get();
        PantryCatalogEntity rb = fb.get();
        pool.shutdown();

        assertThat(ra.getId()).isEqualTo(rb.getId());
        assertThat(catalogRepository.findAll()).filteredOn(c -> "Lencse".equalsIgnoreCase(c.getName())).hasSize(1);
    }
}
```

Update `PantryServiceIT`: `getPantry(owner)` calls now take the `AppUserEntity` — load it via `appUserRepository.findById(owner).orElseThrow()`; `updateItem` likewise; the "isolate owners" test is unchanged in spirit (two users, two shelves — `Túró` for both now shares ONE catalog row, which is the point).

- [ ] **Step 9: Run + commit**

Run: `cd backend && ./mvnw clean test -Dtest='Pantry*,ProtocolSeedDataIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry backend/src/main/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedData.java backend/src/main/resources/messages.properties backend/src/test/java/io/mrkuhne/mezo/feature/pantry
git commit -m "feat(pantry): catalog search, from-catalog, natural-key bind on create, author/OWNER edit gate (mezo-qw37.4)"
```

---

### Task 7: Import / scrape / photo confirm — catalog row + shelf row

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryImportService.java:70-118`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java`

**Interfaces:**
- Consumes: `PantryCatalogService.findOrCreate`, `ensureItem`.
- Produces: `POST /api/pantry-import` creates a user-authored `pantry_catalog` row (or binds to the natural-key hit) + the caller's `pantry_item` (price on the item) + the `pantry_import` feed row pointing at the item. Scrape (`POST /api/pantry-import/scrape`) and photo (`/photo`) are draft-only and unchanged — they persist through this same confirm.

- [ ] **Step 1: Add the failing assertions to `PantryImportApiIT`**

In the existing happy-path import test (the one that POSTs a confirmed OFF draft and reads `/api/pantry`), add:

```java
        var ing = pantry.getIngredients().stream().filter(i -> i.getId().equals(created.getId())).findFirst().orElseThrow();
        assertThat(ing.getCatalogId()).isNotNull();
        assertThat(ing.getSharedFrom()).isNull();         // own definition
        assertThat(ing.getCatalogEditable()).isTrue();    // author (OWNER here anyway)
```
and a new test:

```java
    @Test
    void testImport_shouldBindToExistingDefinition_whenAnotherUserImportedTheSameProduct() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        PantryImportRequest req = new PantryImportRequest();
        req.setName("Skyr natúr");
        req.setBrand("Ehrmann");
        req.setPer(new BigDecimal("100"));
        req.setUnit("g");
        req.setKcal(new BigDecimal("63"));
        PantryItemResponse annas = postForBody("/api/pantry-import", req, anna.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        PantryItemResponse belas = postForBody("/api/pantry-import", req, bela.headers(), HttpStatus.CREATED, PantryItemResponse.class);
        assertThat(belas.getCatalogId()).isEqualTo(annas.getCatalogId());
        assertThat(belas.getId()).isNotEqualTo(annas.getId());
        // each user's feed has exactly one row, pointing at their own shelf item
        assertThat(getForBody("/api/pantry", bela.headers(), HttpStatus.OK, PantryResponse.class).getImports()).hasSize(1);
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='PantryImportApiIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL on `getCatalogId()`/binding (the Task 4 shim creates a fresh catalog row per import, so the second import's catalog id differs — or the unique index fires).

- [ ] **Step 3: Rewrite `importItem`**

Replace lines 83-118 (from `PantryItemEntity item = new PantryItemEntity();` to `return mapper.toItemResponse(item);`) with:

```java
        PantryCatalogEntity candidate = new PantryCatalogEntity();
        candidate.setKind("food");
        candidate.setSource(source);
        candidate.setName(req.getName());
        candidate.setBrand(req.getBrand());
        candidate.setCategory(req.getCategory() == null ? null : req.getCategory().getValue());
        candidate.setServingAmount(req.getPer());
        candidate.setServingUnit(req.getUnit());
        candidate.setKcal(req.getKcal());
        candidate.setProteinG(req.getProteinG());
        candidate.setCarbsG(req.getCarbsG());
        candidate.setFatG(req.getFatG());
        candidate.setFiberG(req.getFiberG());
        candidate.setSugarG(req.getSugarG());
        candidate.setSaltG(req.getSaltG());
        candidate.setSaturatedFatG(req.getSaturatedFatG());
        candidate.setNova(req.getNova() == null ? null : req.getNova().shortValue());
        // A natural-key hit binds to the shared definition (its values win); a miss is authored by this user.
        PantryCatalogEntity catalog = catalogService.findOrCreate(userId, candidate);
        PantryItemEntity item = catalogService.ensureItem(userId, catalog.getId());
        item.setPriceHuf(req.getPriceHuf());
        item.setPriceUnit(req.getPriceUnit());
        item = itemRepository.save(item);

        PantryImportEntity feed = new PantryImportEntity();
        feed.setCreatedBy(userId);
        feed.setSource(source);
        feed.setItemName(catalog.getName());
        feed.setItemCount(1);
        feed.setStatus(isManualReview(req.getConfidence()) ? "manual-review" : "synced");
        feed.setBarcode(req.getBarcode());
        feed.setSourceUrl(req.getSourceUrl());
        feed.setPantryItemId(item.getId());
        feed.setImportedAt(Instant.now());
        importRepository.save(feed);

        return mapper.toItemResponse(item);
```
Inject `private final PantryCatalogService catalogService;` and import `PantryCatalogEntity`.

- [ ] **Step 4: Run + commit**

Run: `cd backend && ./mvnw clean test -Dtest='PantryImport*,PantryScrape*,PantryPhoto*' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryImportService.java backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java
git commit -m "feat(pantry): import/scrape/photo confirm writes a shared definition + the caller's shelf row (mezo-qw37.4)"
```

---
### Task 8: AI name matching against the catalog — `PantryNameIndex` moves to pantry; meal draft + Receptműhely auto-add the shelf row

**Files:**
- Move: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndex.java` → `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryNameIndex.java` (indexes `PantryCatalogEntity`)
- Move: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/PantryNameIndexTest.java` → `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/service/PantryNameIndexTest.java`
- Modify: `feature/meal/service/MealAiDraftService.java` (`draft` becomes read-write; index built from the global catalog; match → `ensureItem`), `feature/recipe/service/RecipeWorkshopService.java` (same), `feature/recipe/service/RecipeWorkshopValidator.java` (name-match hook)
- Test: `feature/meal/MealAiDraftServiceIT.java`, `feature/recipe/RecipeWorkshopApiIT.java`, `feature/recipe/RecipeWorkshopValidatorTest.java`

**Interfaces:**
- Produces: `PantryNameIndex.of(List<PantryCatalogEntity>) : PantryNameIndex`, `match(String name, String unit) : Optional<PantryCatalogEntity>` (same normalization/ambiguity/unit rules as `docs/superpowers/specs/2026-09-01-meal-ai-pantry-name-match-design.md`, food-only). `RecipeWorkshopValidator.sanitize(RawDraft, Function<UUID, Optional<PantryItemEntity>> byId, BiFunction<String, String, Optional<PantryItemEntity>> byName)`; the old 2-arg `sanitize` stays as an overload passing `(n, u) -> Optional.empty()`.
- Resolved ambiguity (spec §8 says "on log / on recipe save"): the shelf row is created **at match time** (draft / workshop turn), because `MealAiDraftItem`/`WorkshopDraftLine` carry a `pantryItemId`, not a catalog id, and `MealService.create`/`RecipeService.create` resolve that id owner-scoped. Creating it at match time needs no contract change; a discarded draft leaves an (own, harmless, re-usable) shelf row behind — documented in `pantry.md` §9.

- [ ] **Step 1: Move the index + its test, retarget to the catalog**

`git mv` both files into `feature/pantry/service`. In the class: package `io.mrkuhne.mezo.feature.pantry.service`; import `PantryCatalogEntity` instead of `PantryItemEntity`; `Map<String, PantryCatalogEntity> byKey`; `of(List<PantryCatalogEntity> rows)`; `match` returns `Optional<PantryCatalogEntity>`; `keysOf(PantryCatalogEntity item)`; the Javadoc's first sentence becomes "Strict, deterministic name → CATALOG-row lookup shared by the AI meal draft and the Receptműhely (S4: the index is the whole live catalog, so a food any user defined is matchable; the caller turns the hit into the user's own shelf row via PantryCatalogService.ensureItem)." Everything else (normalization, `PACK_SIZE`, `UNIT_SYNONYMS`, `DEFAULT_SERVING_UNIT`, ambiguity removal, the food-only filter) is unchanged. In the test, the fixture builder becomes:

```java
    private static PantryCatalogEntity item(String name, String brand, String servingUnit) {
        PantryCatalogEntity e = new PantryCatalogEntity();
        e.setId(UUID.randomUUID());
        e.setName(name);
        e.setBrand(brand);
        e.setServingAmount(new BigDecimal("100"));
        e.setServingUnit(servingUnit);
        e.setKind("food");
        return e;
    }
```
Every existing assertion stays byte-identical (they only compare returned rows).

- [ ] **Step 2: Add the failing ITs**

`MealAiDraftServiceIT` — add:

```java
    @Autowired private PantryCatalogPopulator catalogPopulator;
    @Autowired private PantryItemRepository pantryItemRepository;

    @Test
    void testDraft_shouldMatchAnotherUsersCatalogDefinition_andCreateMyShelfRow() {
        UUID anna = databasePopulator.populateUser("meal-ai-anna@test.local");
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        PantryCatalogEntity def = catalogPopulator.createFoodDefinition(anna, "Kölesgolyó", null); // per 100 g, 110 kcal
        assertThat(pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();

        String json = """
            {"slot":"snack","title":null,"note":null,"items":[
              {"pantryItemId":null,"recipeId":null,"name":"kölesgolyó","amount":40,"unit":"g",
               "kcal":999,"proteinG":1,"carbsG":1,"fatG":1}
            ]}""";
        MealAiDraftResponse res = service.draft(owner, LocalDate.now(), "[fake-meal:" + json + "]", null);

        MealAiDraftItem line = res.getItems().getFirst();
        assertThat(line.getSource()).isEqualTo("pantry");
        assertThat(line.getKcal()).isEqualByComparingTo("110");          // the catalog's numbers, not 999
        assertThat(line.getNeedsReview()).isTrue();
        var mine = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        assertThat(mine).hasSize(1);                                       // auto-added from the catalog
        assertThat(mine.getFirst().getCatalog().getId()).isEqualTo(def.getId());
        assertThat(line.getPantryItemId()).isEqualTo(mine.getFirst().getId()); // MY row, resolvable by MealService.create
    }
```
(Because `MealAiDraftServiceIT` is not `@Transactional`, the `ensureItem` write commits and `ResetDatabase` cleans it.)

`RecipeWorkshopApiIT` — add:

```java
    @Test
    void testTurn_shouldMatchCatalogByName_andPutItOnMyShelf_whenLlmLeftTheIdNull() {
        RegisteredUser anna = registerUser("Anna");
        HttpHeaders bela = registerUser("Béla").headers();
        createFood(anna.headers(), "Kölesgolyó"); // Anna's definition, shared

        String sentinel = """
            [fake-workshop:{"reply":"Kész.","draft":{"name":"Golyós tál","category":"snack",\
            "servings":1,"steps":[],\
            "lines":[{"pantryItemId":null,"name":"kölesgolyó","amount":40,"unit":"g",\
            "kcal":200,"proteinG":10,"carbsG":20,"fatG":5}]}}]""";
        WorkshopTurnRequest req = new WorkshopTurnRequest();
        req.setMessage(sentinel);

        WorkshopTurnResponse res = postForBody("/api/recipe/workshop/turn", req, bela, HttpStatus.OK, WorkshopTurnResponse.class);

        WorkshopDraftLine line = res.getDraft().getLines().get(0);
        assertThat(line.getSource()).isEqualTo("pantry");
        assertThat(line.getName()).isEqualTo("Kölesgolyó");
        assertThat(line.getKcal()).isNull(); // pantry lines carry no macros — the FE computes them
        PantryResponse pantry = getForBody("/api/pantry", bela, HttpStatus.OK, PantryResponse.class);
        assertThat(pantry.getIngredients()).extracting("id").contains(line.getPantryItemId()); // Béla's own row now exists
    }
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd backend && ./mvnw clean test -Dtest='MealAiDraftServiceIT,RecipeWorkshopApiIT,PantryNameIndexTest' -Dmezo.test.use-testcontainers=true`
Expected: the two new tests FAIL (`source == "estimate"`); `PantryNameIndexTest` passes after the move.

- [ ] **Step 4: `MealAiDraftService`**

- Inject `private final PantryCatalogRepository pantryCatalogRepository;` and `private final PantryCatalogService pantryCatalogService;` (imports from `feature.pantry.repository` / `feature.pantry.service`; `PantryNameIndex` import moves to `io.mrkuhne.mezo.feature.pantry.service.PantryNameIndex`).
- `draft(...)`: change `@Transactional(readOnly = true)` to `@Transactional` and update the comment: "Read-write since S4: a catalog name-match creates the user's shelf row (ensureItem); a read-only tx would silently skip that flush."
- `toResponse(...)`: replace `PantryNameIndex nameIndex = PantryNameIndex.of(pantry);` with `PantryNameIndex nameIndex = PantryNameIndex.of(pantryCatalogRepository.findByDeletedFalseOrderByNameAsc());` (the GLOBAL catalog).
- `matchByNameOrEstimate(ExtractedLine line, PantryNameIndex nameIndex, boolean demoted)` gains a leading `UUID userId` parameter (both callers in `mapLine` pass it) and becomes:

```java
        PantryCatalogEntity matched = nameIndex.match(line.name(), line.unit()).orElse(null);
        if (matched != null) {
            PantryItemEntity mine = pantryCatalogService.ensureItem(userId, matched.getId()); // idempotent auto-add
            log.info("Meal AI draft: '{}' name-matched catalog {} -> shelf row {}", line.name(), matched.getId(), mine.getId());
            return pantryItem(mine, line, true);
        }
        return estimateItem(line, demoted);
```

- [ ] **Step 5: `RecipeWorkshopValidator` + `RecipeWorkshopService`**

Validator: add `import java.util.function.BiFunction;`, keep the existing `sanitize(raw, pantryLookup)` as `return sanitize(raw, pantryLookup, (n, u) -> Optional.empty());` and add the 3-arg version whose `mapLine(line, pantryLookup, nameMatch)` inserts, after the hallucinated-id warning and BEFORE the macro-less drop:

```java
        PantryItemEntity byName = nameMatch.apply(line.name(), line.unit()).orElse(null);
        if (byName != null) {
            WorkshopDraftLine out = base(line);
            out.setSource("pantry");
            out.setPantryItemId(byName.getId());
            out.setName(byName.getCatalog().getName());
            out.setUnit(byName.getCatalog().getServingUnit() == null || byName.getCatalog().getServingUnit().isBlank()
                ? "g" : byName.getCatalog().getServingUnit());
            return out; // macros stay null: FE computes from the pantry row
        }
```
Service: inject `PantryCatalogRepository pantryCatalogRepository` + `PantryCatalogService pantryCatalogService`; `turn` becomes `@Transactional` (read-write, same reason); build `PantryNameIndex nameIndex = PantryNameIndex.of(pantryCatalogRepository.findByDeletedFalseOrderByNameAsc());` before `validator.sanitize(...)` and call
`validator.sanitize(parsed.draft(), id -> pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(id, userId), (name, unit) -> nameIndex.match(name, unit).map(c -> pantryCatalogService.ensureItem(userId, c.getId())))`.

`RecipeWorkshopValidatorTest`: add one case — `sanitize(raw, id -> Optional.empty(), (n, u) -> Optional.of(itemWithCatalog("Kölesgolyó", "g")))` on a line with `pantryItemId null, name "kölesgolyó"` yields `source pantry`, DB name, `kcal null`; the existing 2-arg tests are untouched.

- [ ] **Step 6: Run + commit**

Run: `cd backend && ./mvnw clean test -Dtest='MealAiDraft*,RecipeWorkshop*,PantryNameIndexTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (ArchUnit: `recipe → pantry` and `meal → pantry` are existing edges; no `recipe → meal`).

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryNameIndex.java backend/src/main/java/io/mrkuhne/mezo/feature/meal backend/src/main/java/io/mrkuhne/mezo/feature/recipe backend/src/test/java/io/mrkuhne/mezo/feature
git commit -m "feat(pantry): AI meal draft + Receptműhely name-match against the shared catalog and auto-add the shelf row (mezo-qw37.4)"
```

---
### Task 9: Migration IT — legacy rows in, catalog + intact FKs out

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogMigrationIT.java`

**Interfaces:**
- Consumes: the changeset from Task 2, the `pgvector/pgvector:pg16` image `TestcontainersConfiguration` already uses, `liquibase-core` (on the classpath via `spring-boot-starter-liquibase`).
- Produces: proof that two users' overlapping foods collapse into ONE catalog row (earliest wins), both shelf rows survive with their ids, `meal_item.pantry_item_id` still resolves, soft-deleted rows get a deleted catalog row, and the definition columns are gone. This test does NOT extend `AbstractIntegrationTest` — the Spring context has already migrated past the split, so the pre-split state can only be seeded by driving Liquibase by hand up to the changeset before ours.

- [ ] **Step 1: Write the IT**

```java
package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;
import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Drives Liquibase by hand on a throwaway Postgres: every changeset BEFORE the pantry split, then
 * legacy rows via JDBC (two users, overlapping foods, a meal_item FK, a soft-deleted row), then the
 * split changeset — and asserts the data-preserving invariants of spec §8. Standalone on purpose:
 * the Spring test context boots on an already-split schema.
 */
@Testcontainers
class PantryCatalogMigrationIT {

    private static final String CHANGELOG = "db/changelog/db.changelog-master.yaml";
    private static final String SPLIT_SCRIPT = "202609021410_mezo-qw37.4_pantry_catalog_split.sql";
    private static final Path MASTER_YML = Path.of("src/main/resources/db/changelog/1.0.0/1.0.0_master.yml");

    @Container
    static final PostgreSQLContainer PG = new PostgreSQLContainer(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    private static final UUID ANNA = UUID.randomUUID();
    private static final UUID BELA = UUID.randomUUID();
    private static final UUID ANNA_TURO = UUID.randomUUID();
    private static final UUID BELA_TURO = UUID.randomUUID();
    private static final UUID ANNA_ZAB = UUID.randomUUID();
    private static final UUID BELA_KEFIR_DELETED = UUID.randomUUID();
    private static final UUID MEAL = UUID.randomUUID();

    @Test
    @SuppressWarnings("deprecation") // the Liquibase facade is deprecated in favour of CommandScope but still shipped
    void testSplit_shouldDedupeIntoOneCatalogRow_keepItemIdsAndFks_andDropDefinitionColumns() throws Exception {
        int changesetsBeforeSplit = countChangesetsBeforeSplit();
        try (Connection conn = DriverManager.getConnection(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword())) {
            Database db = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(conn));
            Liquibase liquibase = new Liquibase(CHANGELOG, new ClassLoaderResourceAccessor(), db);
            liquibase.update(changesetsBeforeSplit, new Contexts(), new LabelExpression());
            seedLegacyRows(conn);

            liquibase.update(new Contexts(), new LabelExpression()); // applies exactly the split

            try (Statement st = conn.createStatement()) {
                // one shared definition per natural key; the EARLIEST row (Anna's) is the author and wins the numbers
                assertThat(scalar(st, "select count(*) from pantry_catalog where is_deleted = false")).isEqualTo(2L);
                assertThat(scalar(st, "select kcal from pantry_catalog where lower(name) = 'túró'")).isEqualTo(new java.math.BigDecimal("130"));
                assertThat(scalar(st, "select created_by from pantry_catalog where lower(name) = 'túró'")).isEqualTo(ANNA);
                // both shelf rows survive, same ids, bound to the same catalog row
                assertThat(scalar(st, "select count(distinct catalog_id) from pantry_item where id in ('" + ANNA_TURO + "','" + BELA_TURO + "')")).isEqualTo(1L);
                assertThat(scalar(st, "select price_huf from pantry_item where id = '" + BELA_TURO + "'")).isEqualTo(1490); // Béla's own state kept
                assertThat(scalar(st, "select count(*) from pantry_item where catalog_id is null")).isEqualTo(0L);
                // the soft-deleted Kefir got its own is_deleted catalog row (no live natural-key hit)
                assertThat(scalar(st, "select is_deleted from pantry_catalog where lower(name) = 'kefir'")).isEqualTo(true);
                assertThat(scalar(st, "select count(*) from pantry_catalog")).isEqualTo(3L);
                // FK consumers untouched
                assertThat(scalar(st, "select pantry_item_id from meal_item where meal_id = '" + MEAL + "'")).isEqualTo(ANNA_TURO);
                // definition columns are gone, state columns stay
                List<String> cols = columns(st, "pantry_item");
                assertThat(cols).doesNotContain("name", "brand", "kind", "kcal", "micros", "form", "caffeine")
                    .contains("catalog_id", "price_huf", "stock_qty", "dose", "protocol", "timing", "taken", "notes");
                assertThat(scalar(st, "select count(*) from pg_indexes where indexname = 'uq_pantry_item_created_by_catalog_id'")).isEqualTo(1L);
                assertThat(scalar(st, "select count(*) from pg_indexes where indexname = 'uq_pantry_catalog_natural'")).isEqualTo(1L);
            }
        }
    }

    /** Count of `- changeSet:` entries before ours, and a guard that ours is the LAST one registered. */
    private static int countChangesetsBeforeSplit() throws IOException {
        String yml = Files.readString(MASTER_YML, StandardCharsets.UTF_8);
        int total = yml.split("- changeSet:", -1).length - 1;
        assertThat(yml.strip()).endsWith("path: script/" + SPLIT_SCRIPT);
        return total - 1;
    }

    private static void seedLegacyRows(Connection conn) throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("insert into app_user (id, email, password_hash, name) values ('" + ANNA + "', 'anna@test.local', 'x', 'Anna'), ('" + BELA + "', 'bela@test.local', 'x', 'Béla')");
            // Anna: Túró/Mizo (kcal 130, earlier) + Zabpehely; Béla: túró/MIZO (kcal 999, later, price 1490) + a soft-deleted Kefir
            st.execute("insert into pantry_item (id, created_by, created_at, kind, name, brand, source, serving_amount, serving_unit, kcal, price_huf) values "
                + "('" + ANNA_TURO + "', '" + ANNA + "', now() - interval '2 days', 'food', 'Túró', 'Mizo', 'manual', 100, 'g', 130, 990), "
                + "('" + BELA_TURO + "', '" + BELA + "', now() - interval '1 day', 'food', 'túró', 'MIZO', 'manual', 100, 'g', 999, 1490), "
                + "('" + ANNA_ZAB + "', '" + ANNA + "', now(), 'food', 'Zabpehely', null, 'manual', 100, 'g', 370, null)");
            st.execute("insert into pantry_item (id, created_by, is_deleted, kind, name, source, serving_amount, serving_unit, kcal) values "
                + "('" + BELA_KEFIR_DELETED + "', '" + BELA + "', true, 'food', 'Kefir', 'manual', 100, 'ml', 55)");
            st.execute("insert into meal (id, created_by, logged_at, meal_date, slot) values ('" + MEAL + "', '" + ANNA + "', now(), current_date, 'breakfast')");
            st.execute("insert into meal_item (created_by, meal_id, line_order, source, pantry_item_id, amount, unit, snapshot_name, snapshot_per, snapshot_basis_unit, snapshot_kcal, snapshot_protein_g, snapshot_carbs_g, snapshot_fat_g) values "
                + "('" + ANNA + "', '" + MEAL + "', 0, 'pantry', '" + ANNA_TURO + "', 150, 'g', 'Túró', 100, 'g', 130, 18, 3.5, 5)");
        }
    }

    private static Object scalar(Statement st, String sql) throws Exception {
        try (ResultSet rs = st.executeQuery(sql)) {
            assertThat(rs.next()).as(sql).isTrue();
            return rs.getObject(1);
        }
    }

    private static List<String> columns(Statement st, String table) throws Exception {
        List<String> out = new java.util.ArrayList<>();
        try (ResultSet rs = st.executeQuery("select column_name from information_schema.columns where table_name = '" + table + "'")) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }
}
```
Notes for the implementer: (1) the `app_user` insert relies on S1's `role/status/timezone/must_change_password` defaults — no S1 columns need listing; (2) `scalar` returns `BigDecimal` for `numeric`, `UUID` for `uuid`, `Long` for `count(*)`, `Integer` for `integer`, `Boolean` for `boolean` — the assertions above match those types; (3) if `Liquibase#update(int, Contexts, LabelExpression)` has been removed in the shipped Liquibase, use `new CommandScope("updateCount")` with `DATABASE_ARG`, `CHANGELOG_FILE_ARG` and `COUNT_ARG` from `liquibase.command.core.UpdateCountCommandStep` — same semantics.

- [ ] **Step 2: Run it (it must PASS against Task 2's SQL; a failure here is a migration bug, fix the SQL, never the test)**

Run: `cd backend && ./mvnw clean test -Dtest='PantryCatalogMigrationIT'`
Expected: PASS. Also verify the guard: temporarily add a duplicate live `Túró/Mizo` row for Anna in `seedLegacyRows`, re-run, expect the split to FAIL with `could not create unique index "uq_pantry_item_split_guard"`; revert.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogMigrationIT.java
git commit -m "test(pantry): standalone Liquibase migration IT for the pantry_catalog split (mezo-qw37.4)"
```

---
### Task 10: Frontend data layer — types, `pantryApi`, `usePantryActions().searchCatalog/addFromCatalog`, mock fixture, MSW

**Files:**
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/fuel/pantry.ts`, `frontend/src/data/fuel/pantryApi.ts`, `frontend/src/data/fuel/pantryHooks.ts`, `frontend/src/features/fuel/logic/kamraItems.ts`, `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/fuel/pantryHooks.test.tsx`

**Interfaces:**
- Produces: types `PantrySharedFrom { authorName: string }`, `PantryCatalogEntry`; optional fields `catalogId?: string; sharedFrom?: PantrySharedFrom | null; catalogEditable?: boolean` on `Ingredient`, `SupplementStashItem`, `PantryItem`; `pantryCatalogFixture: PantryCatalogEntry[]` (mock); `pantryApi.searchCatalog(q, kind?) : Promise<PantryCatalogEntry[]>`, `pantryApi.addFromCatalog(catalogId) : Promise<void>`; `usePantryActions()` gains `searchCatalog(q, kind?)` and `addFromCatalog(catalogId)` (returns `Promise<void>`, mutateAsync so the sheet can await + close). The `usePantry()` return shape is unchanged (the `pantryHooks.test.tsx` key-set assertion stays green).

- [ ] **Step 1: Write the failing hook tests**

Append to `frontend/src/data/fuel/pantryHooks.test.tsx` inside `describe('usePantry (mock mode)')`:

```tsx
  it('searchCatalog filters the mock catalog fixture by name/brand and kind', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => usePantryActions(), { wrapper: Wrapper })
    const hits = await result.current.searchCatalog('skyr')
    expect(hits.map(h => h.name)).toEqual(['Skyr natúr'])
    expect(hits[0].authorName).toBe('Anna')
    const supp = await result.current.searchCatalog('', 'supplement')
    expect(supp.every(h => h.kind === 'supplement')).toBe(true)
    expect(supp.length).toBeGreaterThan(0)
  })

  it('addFromCatalog appends the catalog entry to the shared cache with sharedFrom + catalogEditable=false', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ pantry: usePantry(), actions: usePantryActions() }),
      { wrapper: Wrapper },
    )
    const before = result.current.pantry.ingredients.length
    await act(async () => { await result.current.actions.addFromCatalog('cat-skyr') })
    await waitFor(() => expect(result.current.pantry.ingredients.length).toBe(before + 1))
    const added = result.current.pantry.ingredients.find(i => i.catalogId === 'cat-skyr')
    expect(added?.name).toBe('Skyr natúr')
    expect(added?.sharedFrom).toEqual({ authorName: 'Anna' })
    expect(added?.catalogEditable).toBe(false)
    // idempotent: a second add does not duplicate the row
    await act(async () => { await result.current.actions.addFromCatalog('cat-skyr') })
    expect(result.current.pantry.ingredients.filter(i => i.catalogId === 'cat-skyr')).toHaveLength(1)
  })
```

And a real-mode block (add `import { HttpResponse } from 'msw'` if not present — it is):

```tsx
describe('usePantryActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('searchCatalog GETs /api/pantry/catalog with q + kind and maps the entries', async () => {
    let seenUrl = ''
    server.use(http.get(`${API_BASE}/api/pantry/catalog`, ({ request }) => {
      seenUrl = request.url
      return HttpResponse.json([{ id: 'c1', kind: 'food', name: 'Kefir', source: 'manual', authorName: null }])
    }))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => usePantryActions(), { wrapper: Wrapper })
    const hits = await result.current.searchCatalog('kef', 'food')
    expect(seenUrl).toContain('q=kef')
    expect(seenUrl).toContain('kind=food')
    expect(hits).toEqual([{ id: 'c1', kind: 'food', name: 'Kefir', source: 'manual', authorName: null }])
  })

  it('addFromCatalog POSTs /api/pantry/items/from-catalog and invalidates the pantry', async () => {
    let body: unknown = null
    server.use(http.post(`${API_BASE}/api/pantry/items/from-catalog`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ id: 'i1', catalogId: 'c1', kind: 'food', name: 'Kefir' })
    }))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => usePantryActions(), { wrapper: Wrapper })
    await act(async () => { await result.current.addFromCatalog('c1') })
    expect(body).toEqual({ catalogId: 'c1' })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['pantry'] })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test -- src/data/fuel/pantryHooks.test.tsx`
Expected: FAIL — `searchCatalog`/`addFromCatalog` are not functions.

- [ ] **Step 3: Types**

In `frontend/src/data/types.ts`, right before `export interface Ingredient {` add:

```ts
// S4 (mezo-qw37.4): the shared definition behind a shelf row.
export interface PantrySharedFrom { authorName: string }
/** One row of the global pantry catalog (GET /api/pantry/catalog) — master (authorName null) or user-authored. */
export interface PantryCatalogEntry {
  id: string; kind: PantryItemKind; name: string; brand?: string | null; source: PantrySourceKey
  category?: string | null; per?: number | null; unit?: string | null
  kcal?: number | null; proteinG?: number | null; carbsG?: number | null; fatG?: number | null
  fiberG?: number | null; sugarG?: number | null; saltG?: number | null; saturatedFatG?: number | null
  nova?: NovaGroup | null; form?: string | null; caffeine?: boolean | null
  authorName?: string | null
}
```
(`PantryItemKind` is declared later in the file — TypeScript hoists type declarations, no reorder needed.) Add to `Ingredient`, `SupplementStashItem` and `PantryItem` one line each: `catalogId?: string; sharedFrom?: PantrySharedFrom | null; catalogEditable?: boolean`. The mock seed is untouched (fields optional = "defaulted": absent means own/editable).

- [ ] **Step 4: Mock fixture**

Append to `frontend/src/data/fuel/pantry.ts` after `pantryLookupFixture`:

```ts
// === Mock shared catalog (S4, mezo-qw37.4) — what "Hozzáadás a közösből" searches in demo mode ===
export const pantryCatalogFixture: PantryCatalogEntry[] = [
  { id: 'cat-skyr', kind: 'food', name: 'Skyr natúr', brand: 'Ehrmann', source: 'manual', category: 'dairy', per: 100, unit: 'g', kcal: 63, proteinG: 10.6, carbsG: 4, fatG: 0.2, sugarG: 3.9, saltG: 0.09, saturatedFatG: 0.1, nova: 1, authorName: 'Anna' },
  { id: 'cat-bulgur', kind: 'food', name: 'Bulgur Raw Kifli', brand: null, source: 'kifli.hu', category: 'grains', per: 100, unit: 'g', kcal: 331, proteinG: 11, carbsG: 63, fatG: 1, fiberG: 13, nova: 1, authorName: null },
  { id: 'cat-kreatin', kind: 'supplement', name: 'Creatine Monohydrate', brand: 'MyProtein', source: 'myprotein.hu', category: 'supplement', per: 100, unit: 'g', kcal: 0, form: 'por', authorName: 'Béla' },
]
```
(add `PantryCatalogEntry` to the type import at the top).

- [ ] **Step 5: `pantryApi`**

Add the generated types `type PantryCatalogEntryResponse = components['schemas']['PantryCatalogEntry']` and `type PantryFromCatalogRequest = components['schemas']['PantryFromCatalogRequest']`, import `PantryCatalogEntry` from `@/data/types`, and append to the `pantryApi` object:

```ts
  // S4 (mezo-qw37.4): the shared catalog. Search is an ephemeral read (no cache), like lookup.
  searchCatalog: (q: string, kind?: string): Promise<PantryCatalogEntry[]> => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (kind) params.set('kind', kind)
    const qs = params.toString()
    return apiFetch<PantryCatalogEntryResponse[]>(`/api/pantry/catalog${qs ? `?${qs}` : ''}`)
      // nova 1..4 + source enum are structurally the domain type — same cast fromLookupResult uses.
      .then(rows => rows as unknown as PantryCatalogEntry[])
  },
  addFromCatalog: (catalogId: string): Promise<void> =>
    apiFetch('/api/pantry/items/from-catalog', {
      method: 'POST',
      body: JSON.stringify({ catalogId } satisfies PantryFromCatalogRequest),
    }).then(() => undefined),
```

- [ ] **Step 6: Hooks**

In `frontend/src/data/fuel/pantryHooks.ts`: import `pantryCatalogFixture` from `@/data/fuel/pantry` and `PantryCatalogEntry` from `@/data/types`. Inside `usePantryActions()` add, before the `return`:

```ts
  // S4 (mezo-qw37.4): shared catalog. Search is ephemeral (no cache); mock filters the fixture.
  const searchCatalog = useCallback(
    (q: string, kind?: string): Promise<PantryCatalogEntry[]> => {
      if (!mock) return pantryApi.searchCatalog(q, kind)
      const needle = q.trim().toLowerCase()
      return new Promise(resolve => setTimeout(() => resolve(
        pantryCatalogFixture.filter(e =>
          (!kind || e.kind === kind)
          && (!needle || e.name.toLowerCase().includes(needle) || (e.brand ?? '').toLowerCase().includes(needle))),
      ), 200))
    },
    [mock],
  )
  const fromCatalogMut = useMutation({
    mutationFn: mock
      ? async (catalogId: string) => mockAddFromCatalog(qc, catalogId)
      : (catalogId: string) => pantryApi.addFromCatalog(catalogId),
    onSuccess: mock ? undefined : invalidate,
  })
  const addFromCatalog = useCallback((catalogId: string) => fromCatalogMut.mutateAsync(catalogId), [fromCatalogMut])
```
and extend the return: `return { addItem, updateItem, deleteItem, importItem, lookupItems, scrapeItem, photoExtract, searchCatalog, addFromCatalog }`.

Add the mock mutator next to `mockImport`:

```ts
/** Mock from-catalog: idempotent append of the fixture entry as an ingredient (food) or stash row, marked shared. */
function mockAddFromCatalog(qc: ReturnType<typeof useQueryClient>, catalogId: string) {
  const entry = pantryCatalogFixture.find(e => e.id === catalogId)
  if (!entry) return undefined
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    const already = base.ingredients.some(i => i.catalogId === catalogId) || base.stash.some(s => s.catalogId === catalogId)
    if (already) return base
    const shared = { catalogId, sharedFrom: entry.authorName ? { authorName: entry.authorName } : null, catalogEditable: false }
    if (entry.kind === 'food') {
      const ing: Ingredient = {
        id: crypto.randomUUID(), name: entry.name, brand: entry.brand ?? '', source: entry.source,
        category: entry.category ?? 'other', per: entry.per ?? 100, unit: entry.unit ?? 'g',
        macros: { kcal: entry.kcal ?? 0, p: entry.proteinG ?? 0, c: entry.carbsG ?? 0, f: entry.fatG ?? 0 },
        price: 0, priceUnit: '', pkg: '', micros: [], nova: entry.nova ?? 1,
        fiberG: entry.fiberG ?? undefined, sugarG: entry.sugarG ?? undefined,
        saltG: entry.saltG ?? undefined, saturatedFatG: entry.saturatedFatG ?? undefined,
        stock: null, lastUsed: '—', usedInRecipes: 0, ...shared,
      }
      return { ...base, ingredients: [...base.ingredients, ing] }
    }
    const supp: SupplementStashItem = {
      id: crypto.randomUUID(), name: entry.name, brand: entry.brand ?? '',
      type: entry.kind === 'stim' ? 'stimulant' : entry.kind === 'med' ? 'medication' : 'supplement',
      category: entry.category ?? 'supplement', dose: '', form: entry.form ?? '',
      stock: null, stockUnit: null, protocol: '', timing: 'flexible', taken: false, caffeine: entry.caffeine ?? undefined,
      source: entry.source, per: entry.per ?? undefined, unit: entry.unit ?? undefined,
      macros: entry.kcal != null ? { kcal: entry.kcal, p: entry.proteinG ?? 0, c: entry.carbsG ?? 0, f: entry.fatG ?? 0 } : undefined,
      nova: entry.nova ?? undefined, ...shared,
    }
    return { ...base, stash: [...base.stash, supp] }
  })
  return undefined
}
```

In `frontend/src/features/fuel/logic/kamraItems.ts`, the stash mapping object gains `catalogId: s.catalogId, sharedFrom: s.sharedFrom, catalogEditable: s.catalogEditable,` (the ingredient spread already carries them).

- [ ] **Step 7: MSW defaults**

In `frontend/src/test/msw/handlers.ts`, after the `GET /api/pantry` handler:

```ts
  // S4 (mezo-qw37.4) shared catalog — honest-empty search; from-catalog echoes a shelf row.
  http.get(`${API_BASE}/api/pantry/catalog`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/pantry/items/from-catalog`, async ({ request }) => {
    const body = (await request.json()) as { catalogId: string }
    return HttpResponse.json({ id: 'from-catalog-1', catalogId: body.catalogId, kind: 'food', name: 'Skyr natúr' })
  }),
```

- [ ] **Step 8: Run both modes + commit**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test -- src/data/fuel && VITE_USE_MOCK=false pnpm test -- src/data/fuel && pnpm build`
Expected: PASS in both modes; `dualMode.guard.test.ts` still green (no `useQuery` seed default was added).

```bash
git add frontend/src/data frontend/src/features/fuel/logic/kamraItems.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(fuel): pantry catalog types, searchCatalog/addFromCatalog dual-mode actions, mock fixture (mezo-qw37.4)"
```

---
### Task 11: Frontend UI — `CatalogSearchSheet` ("Hozzáadás a közösből"), "közös" badge, locked definition fields

**Files:**
- Create: `frontend/src/features/fuel/sheets/CatalogSearchSheet.tsx`, `frontend/src/features/fuel/sheets/CatalogSearchSheet.test.tsx`, `frontend/src/features/fuel/components/KamraCard.test.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelKamraPage.tsx` (+ `.test.tsx`), `frontend/src/features/fuel/components/KamraCard.tsx`, `frontend/src/features/fuel/pages/KamraItemDetailPage.tsx` (+ `.test.tsx`), `frontend/src/features/fuel/sheets/AddPantryItemSheet.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `usePantry()` items' `catalogId/sharedFrom/catalogEditable`, `usePantryActions().searchCatalog/addFromCatalog` (Task 10).
- Produces: `CatalogSearchSheet({ onClose })`; `AddPantryItemSheet` prop `definitionLocked?: boolean` (default false) — when true, kind/category/name/source/macro/nutrition inputs are `disabled` and a note explains why; price/stock/dose stay editable.

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/fuel/sheets/CatalogSearchSheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { CatalogSearchSheet } from '@/features/fuel/sheets/CatalogSearchSheet'
import { usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

test('searches the shared catalog and puts a hit on the shelf', async () => {
  const qc = newQc()
  const onClose = vi.fn()
  render(<QueryClientProvider client={qc}><CatalogSearchSheet onClose={onClose} /></QueryClientProvider>)
  expect(screen.getByText('Hozzáadás a közösből')).toBeInTheDocument()

  await userEvent.type(screen.getByPlaceholderText('Keresés név vagy márka szerint'), 'skyr')
  await waitFor(() => expect(screen.getByText('Skyr natúr')).toBeInTheDocument())
  expect(screen.getByText(/Anna/)).toBeInTheDocument() // author chip on a user-authored row

  await userEvent.click(screen.getByRole('button', { name: /Polcra/ }))
  const { result } = renderHook(() => usePantry(), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })
  await waitFor(() => expect(result.current.ingredients.some(i => i.catalogId === 'cat-skyr')).toBe(true))
  // the row now reads "a polcon" instead of offering Polcra again
  await waitFor(() => expect(screen.getByText('a polcon')).toBeInTheDocument())
})

test('kind chips narrow the search; the master row shows "mezo" instead of an author', async () => {
  render(<QueryClientProvider client={newQc()}><CatalogSearchSheet onClose={() => {}} /></QueryClientProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Supp' }))
  await waitFor(() => expect(screen.getByText('Creatine Monohydrate')).toBeInTheDocument())
  expect(screen.queryByText('Skyr natúr')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Étel' }))
  await userEvent.type(screen.getByPlaceholderText('Keresés név vagy márka szerint'), 'bulgur')
  await waitFor(() => expect(screen.getByText('Bulgur Raw Kifli')).toBeInTheDocument())
  expect(screen.getByText('mezo')).toBeInTheDocument()
})
```

`frontend/src/features/fuel/components/KamraCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { KamraCard } from '@/features/fuel/components/KamraCard'
import type { PantryItem } from '@/data/types'

const base: PantryItem = { id: 'x', name: 'Skyr natúr', brand: 'Ehrmann', source: 'manual', category: 'dairy', kind: 'food', macros: { kcal: 63, p: 10.6, c: 4, f: 0.2 } }

test('shows the "közös" badge only when the definition is shared from another user', () => {
  const { rerender } = render(<KamraCard item={{ ...base, sharedFrom: { authorName: 'Anna' } }} onOpen={() => {}} />)
  expect(screen.getByText('közös')).toBeInTheDocument()
  rerender(<KamraCard item={{ ...base, sharedFrom: null }} onOpen={() => {}} />)
  expect(screen.queryByText('közös')).not.toBeInTheDocument()
})
```

`FuelKamraPage.test.tsx` — add: `test('header "Közös" opens the catalog search sheet', async () => { renderView(); await userEvent.click(screen.getByRole('button', { name: /Közös/ })); expect(screen.getByText('Hozzáadás a közösből')).toBeInTheDocument() })`.

`AddPantryItemSheet.test.tsx` — add: `test('definitionLocked disables the definition fields but keeps price editable', () => { render(<QueryWrapper><AddPantryItemSheet open onClose={() => {}} editId="e1" definitionLocked initial={{ kind: 'food', name: 'Skyr natúr', per: 100, unit: 'g', kcal: 63 }} /></QueryWrapper>); expect(screen.getByDisplayValue('Skyr natúr')).toBeDisabled(); expect(screen.getByDisplayValue('63')).toBeDisabled(); expect(screen.getByPlaceholderText('750')).toBeEnabled(); expect(screen.getByText(/csak a szerző vagy a tulajdonos/)).toBeInTheDocument() })` (mirror the file's existing render helper/wrapper).

`KamraItemDetailPage.test.tsx` — add a test that seeds the cache with a shared ingredient and asserts the "közös · Anna" line: `qc.setQueryData(['pantry'], { ingredients: [{ ...ingredients[0], id: 'shared-1', catalogId: 'cat-skyr', sharedFrom: { authorName: 'Anna' }, catalogEditable: false }], stash: [], imports: [], suggestions: [] })` then `renderDetail('shared-1', qc)` and `expect(screen.getByText('közös · Anna')).toBeInTheDocument()` (`ingredients` from `@/data/fuel/pantry`).

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test -- src/features/fuel`
Expected: FAIL — `CatalogSearchSheet` missing; badge/lock/detail assertions fail.

- [ ] **Step 3: `CatalogSearchSheet`**

```tsx
// ============================================================
// Mezo · CatalogSearchSheet (S4, mezo-qw37.4) — "Hozzáadás a közösből"
// Searches the SHARED pantry catalog (master seed + every user's definitions) and puts a hit on
// the caller's own shelf via usePantryActions().addFromCatalog (idempotent server-side). Rows
// already on the shelf (matched by catalogId) read "a polcon" instead of offering Polcra again.
// ============================================================
import { useEffect, useState } from 'react'
import { usePantry, usePantryActions } from '@/data/hooks'
import type { PantryCatalogEntry, PantryItemKind } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'

const KIND_CHIPS: { id: PantryItemKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Mind' }, { id: 'food', label: 'Étel' }, { id: 'supplement', label: 'Supp' },
  { id: 'stim', label: 'Stim' }, { id: 'med', label: 'Gyógyszer' },
]

export function CatalogSearchSheet({ onClose }: { onClose: () => void }) {
  const { ingredients, stash } = usePantry()
  const { searchCatalog, addFromCatalog } = usePantryActions()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<PantryItemKind | 'all'>('all')
  const [hits, setHits] = useState<PantryCatalogEntry[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const onShelf = new Set([...ingredients, ...stash].map(i => i.catalogId).filter(Boolean))

  // Debounced search; every keystroke/chip change supersedes the previous request.
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      searchCatalog(q, kind === 'all' ? undefined : kind).then(r => { if (alive) setHits(r) }).catch(() => { if (alive) setHits([]) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q, kind, searchCatalog])

  async function add(entry: PantryCatalogEntry) {
    setBusy(entry.id)
    try { await addFromCatalog(entry.id) } finally { setBusy(null) }
  }

  return (
    <Sheet onClose={onClose} labelledBy="catalog-search-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div className="col">
              <Eyebrow brand>Közös katalógus</Eyebrow>
              <div id="catalog-search-title" style={{ marginTop: 4 }}><Display size="md">Hozzáadás a közösből</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Keresés név vagy márka szerint"
            style={{ fontSize: 14, width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}
          />
          <div className="row gap-xs" style={{ margin: '10px 0' }}>
            {KIND_CHIPS.map(c => (
              <button key={c.id} type="button" className={`chip${kind === c.id ? ' brand' : ''}`} onClick={() => setKind(c.id)}>{c.label}</button>
            ))}
          </div>
          <div className="col gap-xs">
            {hits.length === 0 && <span className="text-tertiary" style={{ fontSize: 12, padding: 8 }}>Nincs találat a közös katalógusban.</span>}
            {hits.map(h => {
              const have = onShelf.has(h.id)
              return (
                <div key={h.id} className="card row" style={{ alignItems: 'center', gap: 10, padding: '8px 10px' }}>
                  <div className="col flex-1" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                    <div className="row gap-xs" style={{ alignItems: 'center', fontSize: 10, color: 'var(--text-tertiary)' }}>
                      <SourceBadge source={h.source} />
                      {h.brand && <span>{h.brand}</span>}
                      {h.kcal != null && <span>· {h.kcal} kcal/{h.per ?? 100}{h.unit ?? 'g'}</span>}
                      <span className="chip" style={{ fontSize: 8, padding: '1px 5px' }}>{h.authorName ?? 'mezo'}</span>
                    </div>
                  </div>
                  {have
                    ? <span className="text-tertiary" style={{ fontSize: 11 }}>a polcon</span>
                    : <button type="button" className="chip brand" disabled={busy === h.id} onClick={() => add(h)}><Icon name="plus" size={11} /> Polcra</button>}
                </div>
              )
            })}
          </div>
          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Wire the page, badge, detail, lock**

- `FuelKamraPage.tsx`: `const [catalogOpen, setCatalogOpen] = useState(false)`; in `PageHead` add before the `Import` button `<button type="button" className="pgact" onClick={() => setCatalogOpen(true)}><Icon name="users" size={12} /> Közös</button>` (use `"search"` if the icon set has no `users`); render `{catalogOpen && <CatalogSearchSheet onClose={() => setCatalogOpen(false)} />}` next to `ImportItemSheet`; in the empty state add a second chip `<button onClick={() => setCatalogOpen(true)} className="chip mt-sm" style={{ padding: '10px 16px' }}>Hozzáadás a közösből</button>`; the empty-state copy becomes „Vedd fel az első tételt — vagy válassz a közös katalógusból —, és itt jelenik meg a leltárban."
- `KamraCard.tsx`: inside the `.sb` row, after the brand/protocol span, add `{item.sharedFrom && <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--mz-cell-sage-ink)', background: 'var(--mz-cell-sage-bg)' }}>közös</span>}`.
- `KamraItemDetailPage.tsx`: in the `km-head .sb` row, after the NOVA dot, add `{item.sharedFrom && (<><span>·</span><span style={{ color: 'var(--mz-cell-sage-ink)' }}>közös · {item.sharedFrom.authorName}</span></>)}`; pass `definitionLocked={item.catalogEditable === false}` to `AddPantryItemSheet`.
- `AddPantryItemSheet.tsx`: new prop `definitionLocked?: boolean` (default `false`); `const lock = definitionLocked === true`; add `disabled={lock}` to the Típus and Kategória selects, the Név input, the Forrás select, and every Makrók/Tápanyag input; leave Készlet/Ár/Dózis enabled; under the Alap section, when `lock`, render `<p className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', margin: '0 2px 8px' }}>Közös katalógus-tétel: az adatait csak a szerző vagy a tulajdonos szerkesztheti. Az ár, a készlet és a dózis a tiéd.</p>`. `submit()` is unchanged — it echoes the locked definition back untouched, which the backend's `definitionDiffers` treats as "no definition edit", so state-only saves pass.

- [ ] **Step 5: Run both modes + build + commit**

Run: `cd frontend && pnpm build && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test`
Expected: PASS in both modes (visual goldens: if the Kamra golden fails on the new header button, regenerate per the `verify` skill and commit the new baseline).

```bash
git add frontend/src/features/fuel
git commit -m "feat(fuel): Kamra catalog search sheet, közös badge, locked definition fields for shared entries (mezo-qw37.4)"
```

---
### Task 12: Docs — `docs/features/pantry.md` (new), `docs/features/recipe.md` (new), `fuel.md`/README/liquibase touches, CODEMAP

**Files:**
- Create: `docs/features/pantry.md`, `docs/features/recipe.md`
- Modify: `docs/features/fuel.md` (lines 31-32 status bullets + a pointer paragraph), `docs/features/README.md` (§2 index rows, §3 map rows), `docs/references/liquibase_conventions.md` (§"Indexing Convention (owned tables)" — catalog-table exception), `docs/CODEMAP.md` (regenerated)

**Interfaces:**
- Produces: two lint-clean 10-section feature docs whose `key_files` bind `pantry` and `recipe` in CODEMAP (today both bind to `fuel.md` / nothing); CODEMAP regenerated with `PantryCatalogEntity→pantry_catalog`, the two new endpoints, `PantryCatalogService`, `PantryNameIndex` under pantry.

- [ ] **Step 1: Write `docs/features/pantry.md`**

Frontmatter + the 10 sections (English prose, Hungarian labels verbatim). Content to write — each bullet is a paragraph to author, grounded in the files named:

```markdown
---
title: Pantry (Kamra)
type: feature-domain
status: done
updated: 2026-09-02
tags: [fuel, pantry, frontend, data-layer, backend, multi-user]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/pantry
  - api/feature/pantry/pantry.yml
  - frontend/src/data/fuel/pantryHooks.ts
  - frontend/src/data/fuel/pantryApi.ts
  - frontend/src/features/fuel/pages/FuelKamraPage.tsx
  - frontend/src/features/fuel/pages/KamraItemDetailPage.tsx
  - frontend/src/features/fuel/sheets/CatalogSearchSheet.tsx
  - backend/src/main/resources/db/changelog/1.0.0/script/202609021410_mezo-qw37.4_pantry_catalog_split.sql
related: [fuel, recipe, _platform-data-layer, _platform-auth-security]
---

# Pantry (Kamra) — Feature Documentation

> One-line: the shelf at route `/fuel/kamra` (tab "Fuel" → tile "Kamra"): a SHARED definition catalog (`pantry_catalog`) + PER-USER state rows (`pantry_item`). **Status: ✅ backend + FE dual-mode done; split into catalog/state by S4 (`mezo-qw37.4`).**
```

- **§1 Summary** — what the pantry is; the S4 split (K1 in the multi-user spec): `pantry_catalog` = definitions (master `created_by NULL` from `seed/pantry-catalog.json`, user-authored rows visible to everyone), `pantry_item` = the user's stock/price/notes/dose/protocol/timing/taken + `catalog_id`; every `pantry_item.id` survived the migration so `meal_item`/`recipe_ingredient`/`protocol_item`/`supplement_intake` FKs are untouched. Link the spec §8 and `2026-06-22`-era pantry history in `fuel.md`.
- **§2 User-facing behavior** — `FuelKamraPage` header: „Közös" (opens `CatalogSearchSheet` — „Hozzáadás a közösből", search by name/brand, kind chips Mind/Étel/Supp/Stim/Gyógyszer, „Polcra" / „a polcon"), „Import" (OFF / Link / Fotó — unchanged), „Új tétel"; the „közös" badge on `KamraCard`; the detail page's „közös · {szerző}" line; the edit sheet's locked definition fields with the note „Közös katalógus-tétel: az adatait csak a szerző vagy a tulajdonos szerkesztheti…"; deleting removes only your shelf row.
- **§3 Architecture & data flow** — `usePantry()` (`useDualQuery` `['pantry']`, `realEmpty` empty arrays, mock seed unchanged + optional new fields) → `pantryApi.list` → `GET /api/pantry` → `PantryService.getPantry(AppUserEntity)` → `PantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc` (join fetch) → `PantryMapper.toIngredientResponse(e, sharedFromName, editable)`. Write paths: `createItem` (natural-key bind vs. new definition), `addFromCatalog` → `PantryCatalogService.ensureItem`, `updateItem` (`definitionDiffers` → `requireEditable`), `deleteItem`. The `REQUIRES_NEW` insert in `findOrCreate` and why (concurrent identical inserts bind to the winner). Mock-mode mutators (`mockAddFromCatalog`).
- **§4 Data model & API** — both tables column by column (definition vs state), constraints/indexes (`uq_pantry_catalog_natural`, `uq_pantry_item_created_by_catalog_id` partial, `fk_pantry_item_catalog_id_pantry_catalog_id` restrict, `fk_pantry_catalog_created_by_app_user_id` set null), the migration's four steps (guard → dedupe live → deleted-only → backfill/NOT NULL/drop), the contract table (`GET /api/pantry` + `catalogId/sharedFrom/catalogEditable`, `POST /api/pantry` + optional `catalogId`, `PUT` 403 `PANTRY_CATALOG_NOT_EDITABLE` / 409 `PANTRY_CATALOG_NAME_TAKEN`, `DELETE`, `GET /api/pantry/catalog?q=&kind=`, `POST /api/pantry/items/from-catalog`), the entity mapping choice (`@ManyToOne(LAZY)` + join-fetch finders, no `@SQLRestriction` on the catalog and why).
- **§5 Integrations** — Meal (`MealService` snapshots from `getCatalog()`, `MealAiDraftService` + `PantryNameIndex` over the global catalog, auto-`ensureItem` at match time), Recipe (`RecipeService` snapshots/NOVA/category live reads; `RecipeWorkshopService`/`Validator` name match + auto-add), Fuel stack (`ProtocolService`/`PlacementEngine`/`IntakeService` read kind/name via the catalog; `ProtocolSeedData` seeds definition + state), Habit (`HabitEvaluator` stim kind), Character (`CharacterSignalReads` names), Import (`PantryImportService` writes catalog + item + feed), Auth (`CurrentUser`, `AppUserEntity.isOwner()`), Loader (`PantryCatalogLoader` @Order(50), every profile).
- **§6 How to use it** — `usePantry()` shape (unchanged + new optional fields), `usePantryActions()` incl. `searchCatalog/addFromCatalog`; backend: "to turn a definition into a shelf row call `PantryCatalogService.ensureItem`, never `new PantryItemEntity` outside the populator".
- **§7 How to extend it** — adding a definition field = catalog column + `PantryCatalogEntity` + mapper (`applyDefinition`, `applyDefinitionPartial`, `definitionDiffers`, responses, `toCatalogEntry`) + contract; adding a state field = item column + `applyUserFields*`; the natural key is name+brand only — changing it means a new unique index AND the loader's `naturalKey`.
- **§8 Testing** — `PantryCatalogMigrationIT` (standalone Liquibase), `PantryCatalogApiIT` (search / from-catalog idempotency / 403 / 409 / delete keeps definition), `PantryCatalogServiceIT` (revive, ensureItem, concurrent bind), `PantryCatalogLoaderIT`, `PantryItemRepositoryIT`, `PantryNameIndexTest`, `MealAiDraftServiceIT`/`RecipeWorkshopApiIT` auto-add cases; FE `CatalogSearchSheet.test.tsx`, `KamraCard.test.tsx`, `pantryHooks.test.tsx` (both modes); the commands from Global Constraints.
- **§9 Decisions, gotchas & deferred** — (a) auto-add happens at match time, not save time (why); (b) natural key ignores `kind` — a "Kreatin" food and a "Kreatin" supplement collide (accepted; add a brand to disambiguate); (c) migration dedupe: the earliest row's numbers win, the later user's differing values are DROPPED (their state survives) — listed as a known data-loss edge; (d) the pre-flight guard and the diagnostic query for operators: `select created_by, lower(name), lower(coalesce(brand,'')), count(*) from pantry_item where not is_deleted group by 1,2,3 having count(*) > 1;`; (e) a deleted author's rows become master-like (`SET NULL`) and are then OWNER-editable only; (f) `ResetDatabase` order (catalog delete before app_user delete); (g) the seed's `stockQty/priceHuf` are ignored by the loader; (h) deferred: catalog moderation/merge UI, per-user definition overrides (K2 rejected in the spec), `usedInRecipes`/`lastUsed` still constants.
- **§10 Key files** — grouped list of every file this plan touched (backend pantry package, migration, contract, FE data + views + sheets, tests, docs).

- [ ] **Step 2: Write `docs/features/recipe.md`** (the missing feature doc — AGENTS rule; the recipe feature is touched by this slice)

```markdown
---
title: Recipes (Receptek)
type: feature-domain
status: done
updated: 2026-09-02
tags: [fuel, recipe, frontend, data-layer, backend, llm]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/recipe
  - api/feature/recipe/recipe.yml
  - frontend/src/data/fuel/recipeHooks.ts
  - frontend/src/data/fuel/recipeApi.ts
  - frontend/src/features/fuel/pages/FuelRecipesPage.tsx
  - frontend/src/features/fuel/pages/RecipeDetailPage.tsx
  - frontend/src/features/fuel/pages/RecipeEditorPage.tsx
  - frontend/src/features/fuel/pages/RecipeWorkshopPage.tsx
related: [fuel, pantry, _platform-data-layer, companion]
---

# Recipes (Receptek) — Feature Documentation

> One-line: the recipe library at `/fuel/recipes` (tab "Fuel" → tile "Receptek") — an owned `recipe` + `recipe_ingredient` aggregate whose lines reference the user's `pantry_item` rows with a frozen per-basis macro/nutrient snapshot, a deterministic mezo-fit score at read, a lazily-materialized AI breakdown, and the stateless Receptműhely AI turn. **Status: ✅ backend + FE dual-mode done.**
```

Sections to author (grounded in the code read for this plan):
- **§1 Summary** — aggregate root `RecipeEntity` (`recipe`: name, slot, category `breakfast|lunch|dinner|snack`, servings, prepMins, tags/fitsFor jsonb, novaDominant, role, updatedAt) + `RecipeIngredientEntity` (`recipe_ingredient`: `pantry_item_id` plain UUID FK restrict, amount, unit, note, lineOrder, `snapshot_*` name/per/basisUnit/kcal/protein/carbs/fat + fiber/sugar/salt/saturatedFat); the first true `@OneToMany` aggregate (cascade ALL, orphanRemoval, `@OrderBy line_order`); soft delete does not cascade — the service bulk-soft-deletes lines. Driving specs: `2026-06-23-fuel-recipes-design.md`, `2026-07-19-recipe-ai-breakdown-design.md`, `2026-07-25-recipe-scoring-dimensions-design.md`, `2026-07-27-recipe-role-scoring-design.md`, `2026-07-30-recipe-ingredient-overrides-design.md`, `2026-08-11-recipe-meal-nutrient-freeze-design.md` (ADR 0026), `2026-09-01-receptmuhely-design.md` (mezo-92pb).
- **§2 User-facing behavior** — `FuelRecipesPage` (library, fit badge), `RecipeDetailPage` (tabs, breakdown prose, „Logolás"), `RecipeEditorPage` (`IngredientPickerSheet` from the Kamra, save bar), `RecipeWorkshopPage` (chat + draft diff, goals `high_protein|pre_workout|post_workout|before_bed|breakfast`, „Frissítettem a vázlatot." fallback reply, save through the normal editor). Since S4: a workshop line the LLM could not link but whose name matches a shared catalog definition arrives as a `pantry` line AND the definition is put on the user's shelf automatically.
- **§3 Architecture & data flow** — `useRecipes()`/`useRecipeActions()` (`useDualQuery` `['recipes']`, `realEmpty: []`), `RECIPE_BREAKDOWN_KEY(id)`, `recipeApi` (`list/get/create/update/remove/getBreakdown` + `refId↔pantryItemId` re-key); backend `RecipeService.create/get/list/update/delete` (`rebuildLines` re-resolves every line owner-scoped via `PantryItemRepository.findByIdAndCreatedByAndDeletedFalse` — missing/foreign/deleted = 400 — and freezes the snapshot from `item.getCatalog()`), `withFit` (deterministic `MealScoringService.recipeFit` at READ over `fitLines`: macros + facts from the frozen snapshot, NOVA + category still LIVE from the catalog via `findAllWithCatalogByIdIn`), `RecipeBreakdownService`/`RecipeBreakdownProseService` (envelope + cached AI prose, `RecipeBreakdownLlm` port), `RecipeWorkshopService.turn` (`RecipeWorkshopLlm` port, `LlmCallContext("recipe_workshop","turn")`, `RecipeWorkshopValidator.sanitize` with the by-id and by-name lookups, `PantryNameIndex` over the global catalog, `PantryCatalogService.ensureItem`).
- **§4 Data model & API** — the two tables (from `202606231400_mezo-lns_create_recipe.sql` + `202608111200_mezo-m6uv_recipe_ingredient_nutrient_snapshot.sql`), the contract table: `GET/POST /api/recipe`, `GET/PUT/DELETE /api/recipe/{id}`, `GET /api/recipe/{id}/breakdown`, `POST /api/recipe/workshop/turn` (`WorkshopTurnRequest{message, history[], draft?, goal?}` → `WorkshopTurnResponse{reply, draft}`; `WorkshopDraftLine{source pantry|estimate, pantryItemId?, name, amount, unit, kcal?…}`), `GET /api/recipe/{id}/logs` (lives in `meal.yml`). Error codes: `RECIPE_WORKSHOP_LLM_UNAVAILABLE` 503, `RECIPE_WORKSHOP_EXTRACT_FAILED` 502, `RECIPE_WORKSHOP_DRAFT_SERIALIZE_FAILED` 500.
- **§5 Integrations** — Pantry (lines FK `pantry_item`; definition reads via `getCatalog()`; deleting a pantry row is RESTRICTed by the FK, soft-delete only hides it → fit degrades honestly), Meal (`MealService` recipe arm: per-serving rollup `MealService.perServing`, `recipe_overrides` keyed by `lineOrder` with a `pantryItemId` consistency check, `RecipeLogs`), Nutrition (`MealScoringService.recipeFit`, `ScoredLine`), Companion (consumer-owned LLM ports — ADR 0012; `LlmCallContextHolder` for the llm-usage log), the frozen `meal↔recipe` ArchUnit cycle (`archunit-store`) — do not add `recipe → meal` imports (this is why `PantryNameIndex` lives in pantry).
- **§6 How to use it** — hook examples, `recipeMacros.ts` helpers (`computeRecipeMacros`, `computeRecipeNutrients`, `lineContribution`, `factsOf`), the `pantryImpact.ts` rule (`recipesUsingPantryItem`, `movesRecipeScores`) that pantry writes use to invalidate recipe caches.
- **§7 How to extend it** — contract-first; new line field = migration + entity + `RecipeMapper` + `recipeApi.fromResponse`; new scoring dimension = `MealScoringService` (see fuel.md §9); new workshop rule = `RecipeWorkshopValidator` (pure, unit-tested) never the prompt alone.
- **§8 Testing** — `RecipeApiIT`, `RecipeServiceIT`, `RecipeRepositoryIT`, `RecipeMapperTest`, `RecipeMapperOverrideRollupTest`, `RecipeBreakdownApiIT`, `RecipeBreakdownFallbackApiIT`, `RecipeBreakdownProseServiceTest`, `RecipeWorkshopApiIT` (+ `LlmUnavailable`, `SwitchOff`), `RecipeWorkshopValidatorTest`; FE `recipeHooks.test.tsx`, `recipeApi.test.ts`, `recipeMacros.test.ts`, the four page tests.
- **§9 Decisions, gotchas & deferred** — snapshot freeze (ADR 0026) vs live NOVA/category (mezo-4tzf sibling), fit computed at read (`recipe.fit_score` reserved), `servings` clamp 1..12 in the workshop, `maxLines`/`maxSteps`/`maxHistoryTurns` from `RecipeWorkshopProperties`, the S4 auto-add at turn time and its "discarded draft leaves a shelf row" trade-off, literal "Daniel:" in `buildUserMessage` is S6's persona work.
- **§10 Key files** — backend package listing, contract, FE data (`recipeHooks/recipeApi/recipeMacros/pantryImpact/queryKeys`), pages/sheets/components (`RecipeCard`, `RecipeFitBadge`, `RecipeIngredientList/Row`, `RecipeLogsList`, `RecipeOverrideRow`, `RecipeScoreSheet`, `IngredientPickerSheet`), tests, specs/ADRs.

- [ ] **Step 3: Touch `fuel.md`, `README.md`, `liquibase_conventions.md`**

- `docs/features/fuel.md` line 31 (`FE real` bullet): after "`usePantry`/`usePantryActions` (`data/fuel/pantryApi.ts`, `/api/pantry`)" insert " — **since S4 (`mezo-qw37.4`) backed by the shared `pantry_catalog` + per-user `pantry_item` split; details, catalog search and the author/OWNER edit gate live in [`pantry.md`](pantry.md)**"; line 32 (`Backend` bullet): replace "(single-table `pantry_item`, Model B, `kind` discriminator; `pantry.yml`, mezo-9xu)" with "(`pantry_catalog` shared definitions + `pantry_item` per-user state since S4 `mezo-qw37.4` — see [`pantry.md`](pantry.md); `pantry.yml`, mezo-9xu)" and after "`backend/.../feature/recipe` (`recipe` + `recipe_ingredient`, `recipe.yml`, mezo-lns)" add " — see [`recipe.md`](recipe.md)".
- `docs/features/README.md` §2 domain table: add rows `| [`pantry.md`](pantry.md) | Pantry / Kamra (`/fuel/kamra`) | ✅ done | Shared definition catalog (`pantry_catalog`, master + user-authored) + per-user shelf state (`pantry_item`); OFF/URL/photo import; catalog search "Hozzáadás a közösből". |` and `| [`recipe.md`](recipe.md) | Recipes / Receptek (`/fuel/recipes`) | ✅ done | Owned recipe aggregate with frozen line snapshots, deterministic mezo-fit at read, AI breakdown, stateless Receptműhely turn. |`; §3 map: change the "Pantry / "Kamra" / scrape import" row's doc to `[pantry.md](pantry.md) §2–§4` and "Recipe library / new recipe" to `[recipe.md](recipe.md) §2`.
- `docs/references/liquibase_conventions.md` under "## Indexing Convention (owned tables)", after the first sentence, add: "**Exception — catalog tables.** `exercise_catalog` and `pantry_catalog` are hybrid master/user tables: `created_by` is NULLABLE (NULL = loader master), the unique key is global (a slug, or a `lower(name), lower(coalesce(brand,''))` expression index), and the FK is `ON DELETE SET NULL` so a deleted author's definitions outlive the account. Per-user state stays in an owned table that points at the catalog (`pantry_item.catalog_id`)."

- [ ] **Step 4: Regenerate + lint**

Run: `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs`
Expected: `docs/CODEMAP.md` changes (pantry block gains `PantryCatalogEntity`→`pantry_catalog`, the two endpoints, `PantryCatalogService`, `PantryNameIndex`, `PantryCatalogMigrationIT`/`PantryCatalogApiIT`/`PantryCatalogServiceIT`, `PantryCatalogPopulator`; `pantry → pantry.md`, `recipe → recipe.md` in the docs column); lint-docs reports no errors (no orphans, no broken links, staleness flags cleared for `fuel.md`/`pantry.md`/`recipe.md`); lint-liquibase PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/features/pantry.md docs/features/recipe.md docs/features/fuel.md docs/features/README.md docs/references/liquibase_conventions.md docs/CODEMAP.md
git commit -m "docs(pantry): pantry.md + recipe.md feature docs, catalog-table convention note, CODEMAP regen (mezo-qw37.4)"
```

---

### Task 13: Full gates, push, self-PR

**Files:** none new.

- [ ] **Step 1: Backend focused gate**

Run: `cd backend && ./mvnw clean test -Dtest='Pantry*,MealAiDraft*,MealService*,MealApiIT,RecipeService*,RecipeApiIT,RecipeWorkshop*,RecipeBreakdown*,Protocol*,Intake*,HabitEvaluator*,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS, and `ArchitectureTest` reports no new slice cycle.

- [ ] **Step 2: Frontend gate**

Run: `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: PASS in both modes.

- [ ] **Step 3: Doc/lint gates**

Run: `node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs`
Expected: all PASS.

- [ ] **Step 4: Manual smoke (verify skill recipe)** — start the backend with `demodata`, log in as the owner: the shelf still shows every pre-split item with prices; open „Közös" → search „bulgur" → „Polcra" is replaced by „a polcon" for items already there; register a second account (S1 invite), its Kamra is empty, „Közös" lists the owner's items with the author chip, „Polcra" adds one, editing its kcal is refused with the locked fields, price edit saves.

- [ ] **Step 5: Push + self-PR (the CI full suite is the authoritative gate — the 16 GB machine cannot run it)**

```bash
git push -u origin feat/multi-user-s4-pantry-catalog
gh pr create --title "feat(pantry): shared pantry catalog split — S4 (mezo-qw37.4)" --body "$(cat <<'EOF'
## Summary
- `pantry_catalog` (shared definitions, master + user-authored) + `pantry_item` (per-user state, ids preserved, FKs intact) — one changeset with a pre-flight duplicate guard
- `GET /api/pantry/catalog`, `POST /api/pantry/items/from-catalog`, `catalogId/sharedFrom/catalogEditable` on the pantry read; 403 `PANTRY_CATALOG_NOT_EDITABLE`, 409 `PANTRY_CATALOG_NAME_TAKEN`
- profile-independent `PantryCatalogLoader`; AI meal draft + Receptműhely match the global catalog and auto-add the shelf row
- Kamra: „Hozzáadás a közösből", „közös" badge, locked definition fields
- docs: `pantry.md`, `recipe.md`, CODEMAP

## Test plan
- [ ] CI green (full backend IT suite incl. `PantryCatalogMigrationIT`, FE both modes, lint, contract drift)
- [ ] manual smoke per plan Task 13 Step 4

Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §8 · Plan: docs/superpowers/plans/2026-09-02-s4-pantry-catalog.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After CI is green: `git checkout main && git pull --rebase && git merge --no-ff feat/multi-user-s4-pantry-catalog && git push && git branch -d feat/multi-user-s4-pantry-catalog`. **Before merging to a branch that deploys to prod, run the §9 diagnostic query against a fresh prod dump** — a duplicate (owner, name, brand) live pair makes the changeset refuse (by design); resolve it in the Kamra UI first.

---

## Self-Review

**Spec coverage (§8):** schema (`pantry_catalog` columns, CHECK relocation, natural-key unique, `created_by NULL` master, `SET NULL` author FK) → Task 2; `pantry_item` keeps id + the four `restrict` FKs + `pantry_import` `set null`, gains `catalog_id NOT NULL` + `uq_pantry_item_user_catalog` (named `uq_pantry_item_created_by_catalog_id` per the `{type}_{table}_{column}` convention) → Task 2; migration dedupe (earliest `created_at` wins), backfill, soft-deleted rows bind or get `is_deleted` catalog rows, definition columns dropped → Task 2, proven by Task 9; `PantryCatalogLoader` profile-independent `@Order(50)`, natural-key upsert with `created_by NULL`, never a `pantry_item` → Task 5; `GET /api/pantry` shape unchanged + `catalogId/sharedFrom/catalogEditable` → Tasks 1, 6; `GET /api/pantry/catalog?q=&kind=` (deleted=false, name/brand ILIKE, max 50) → Tasks 1, 3, 6; `POST /api/pantry/items/from-catalog` idempotent → Tasks 1, 6; `createPantryItem` natural-key bind, no 409 → Task 6; `updatePantryItem` state always / definition author-or-OWNER else 403 → Task 6; delete soft-deletes only the item → Task 6; import/scrape/photo → Task 7; `MealAiDraftService` + `RecipeWorkshopService` match the catalog and auto-create the shelf row → Task 8; `CharacterSignalReads`/`MealService`/`RecipeService`/`ProtocolService` stay per-user through `pantry_item` → Task 4; FE catalog search, „közös" badge, read-only definition fields → Task 11; `usePantry` mock seed unchanged + new fields defaulted, `useDualQuery` kept → Task 10; docs (`pantry.md` — created, since it did not exist; `recipe.md` written; CODEMAP regen) → Task 12; tests (migration IT, search IT, permission IT, from-catalog idempotency IT, `ResetDatabase` keeps `created_by IS NULL` catalog rows) → Tasks 3, 6, 9. §11 natural-key race → `findOrCreate`'s `REQUIRES_NEW` insert + bind (Task 6, `PantryCatalogServiceIT`). §12 ownership-isolation via `registerUser` → `PantryCatalogApiIT`.

**Placeholder scan:** no TBD/TODO; every code step carries code; the "mechanical rewrite" in Task 4 names each file:line and the exact replacement expression; the doc tasks list section-by-section content rather than a generic "update the doc".

**Type consistency:** `PantryCatalogService.search(String, String) : List<PantryCatalogEntry>` — used by the controller (Task 6) and the contract op `searchPantryCatalog(String q, String kind)` (Task 1); `ensureItem(UUID, UUID) : PantryItemEntity` — used by `PantryService.createItem/addFromCatalog` (6), `PantryImportService` (7), `MealAiDraftService`/`RecipeWorkshopService` (8), `ProtocolSeedData` (6); `findOrCreate(UUID, PantryCatalogEntity)` — 6, 7; `PantryItemRepository.findByCreatedByAndCatalog_IdAndDeletedFalse` — 3 (populator), 6 (`ensureItem`); `findAllWithCatalogByIdIn` / `findWithCatalogById` — 3, 4; `PantryMapper.toIngredientResponse(e, String, boolean)` / `toSupplementResponse(e, String, boolean)` / `toItemResponse(e)` / `toCatalogEntry(c, String)` / `applyDefinition` / `applyDefinitionPartial` / `definitionDiffers` / `applyUserFields` / `applyUserFieldsPartial` — 6 (definitions) and 6/7 (callers); `PantryNameIndex.of(List<PantryCatalogEntity>)` / `match(...) : Optional<PantryCatalogEntity>` — 8 (index, both services, test); `RecipeWorkshopValidator.sanitize(raw, byId, byName)` — 8; FE `usePantryActions().searchCatalog(q, kind?)` / `addFromCatalog(id)` — 10 (hooks + tests) and 11 (sheet); `PantryCatalogEntry`/`PantrySharedFrom` domain types — 10, 11; `AddPantryItemSheet.definitionLocked` — 11 (sheet, detail page, test). Contract response status for `addPantryItemFromCatalog` is `200` in Task 1 and asserted as `HttpStatus.OK` in Task 6 and returned as JSON 200 by MSW in Task 10. Changeset filename `202609021410_mezo-qw37.4_pantry_catalog_split.sql` is identical in Tasks 2, 9 and 12.

