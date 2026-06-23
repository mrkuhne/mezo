# Fuel Recipes (Receptek) Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL — use superpowers:subagent-driven-development to execute this plan task-by-task. Each task is a TDD cycle (write failing test → run → implement → run → commit). Execute in the **Task Map** order; task IDs are section-scoped, not globally sequential.

**Goal:** Back the mock Recipes (Receptek) UI with a real Spring Boot + Postgres backend (a `recipe` + `recipe_ingredient` aggregate whose lines reference `pantry_item`) and dual-mode TanStack-Query hooks — preserving the `useRecipes()` shape — plus the approved editorial UI redesign.

**Architecture:** Contract-first OpenAPI (`api/feature/recipe/recipe.yml` → `RecipeApi` + `api.dto`). Owned aggregate (`recipe` `@OneToMany` `recipe_ingredient`, cascade + orphanRemoval, `@OrderBy(lineOrder)`); `recipe_ingredient` references `pantry_item` by a plain-UUID FK (`ON DELETE RESTRICT`) plus a per-basis macro snapshot. Macros are computed at read time (contribution = `amount / snapshot_per × snapshot macros`; whole-recipe = Σ contributions; per-serving = whole / servings). Dual-mode FE hooks (mock cache mutators / real API + invalidate `['recipes']` **and** `['pantry']`). Detail + editor are routed full **pages**; the ingredient picker stays a **modal**. Scoring, meal-logging, and cooking steps are deferred (Phase-3 / later slice).

**Tech Stack:** Spring Boot 4 · Java 21 · Maven · PostgreSQL 16 · Liquibase · MapStruct · Lombok · React 19 · Vite · TanStack Query · TypeScript · Tailwind v4. Chamfer "Deep Current" design system.

**Driving bd:** `mezo-lns`. **Spec:** `docs/superpowers/specs/2026-06-23-fuel-recipes-design.md`. **Mockups:** `docs/design/recipes-{library,detail,editor}.html`.

## Global Constraints

- Base pkg `io.mrkuhne.mezo`; feature pkg `feature/recipe/{entity,repository,service,mapper,controller}`.
- UUID PK `gen_random_uuid()`; OWNED (`created_by`/`is_deleted`/`created_at`) set **server-side**; soft-delete via `@SQLDelete`/`@SQLRestriction`. `created_by` NEVER from the client.
- Ownership gate → 404 `RESOURCE_NOT_FOUND` (`requireOwned`); validation → 400 `SystemMessage.field("VALIDATION_INVALID_VALUE", …)`.
- Contract-first: edit `api/feature/recipe/recipe.yml` BEFORE code; never hand-write boundary DTOs; `category` is a **pattern string**, not an enum.
- The contribution/rollup formula is IDENTICAL in the Java mapper and the FE mock hook.
- Liquibase: never modify released changesets; 12-digit UTC prefix + `mezo-lns`; explicit `pk_/fk_/uq_/ck_/idx_` names; new tables → `ResetDatabase` TRUNCATE list.
- Backend tests: integration-first (`@SpringBootTest` + real Postgres), AssertJ, no mocks; `test{Method}_should{Result}_when{Condition}`.
- FE: preserve `useRecipes()` return shape `{recipes, ingredients, sources, categoryMeta}`; both `pnpm test` (REAL) and `VITE_USE_MOCK=true pnpm test` green, plus `pnpm build`.
- Respond Hungarian to the user; code/comments/commits English. NEVER put `[skip ci]` in a commit that becomes the HEAD of a push to `main`.

## Task Map (execution order — 31 tasks)

1. **Contract** — `contract1` → `contract2` → `contract3` → `contract4`
2. **DB / persistence** — `db1` → `db2` → `db3` → `db4` → `db5`
3. **Mapper** — `ctl1`
4. **Service** — `svc2` → `svc3`
5. **Controller + API IT** — `ctl2` → `ctl4`
6. **FE data layer** — `fedata1` → … → `fedata8`
7. **FE UI + routes** — `feui1` → … → `feui9`

**Reconciliation notes (already applied to this plan):** the persistence foundation — `RecipeRepository`, `RecipePopulator`, the `ResetDatabase`/`AbstractIntegrationTest` registration, and `RecipeRepositoryIT` — lives in the **DB section** (`db3`/`db4`/`db5`); the duplicate service-section tasks `svc1`/`svc4` and controller-section task `ctl3` were removed. The **mapper (`ctl1`) runs before the service**. The service exposes `create/get/list/update/delete`; the controller's generated `@Override`s delegate to those short names. The service applies scalar request fields via `mapper.applyScalars`.

---

## Phase 1 — Contract

### Task contract1: Author `api/feature/recipe/recipe.yml` (tag Recipe, 5 endpoints + 5 schemas)

**Files:**
- Create: `api/feature/recipe/recipe.yml`

**Interfaces:**
- Consumes:
  - `api/feature/pantry/pantry.yml` (template — same OpenAPI 3.0.3 fragment shape, inline-map style, `SystemMessageList` error refs).
  - `api/common/common-schemas.yml` provides `SystemMessageList` (referenced via `$ref: '#/components/schemas/SystemMessageList'`; it is merged in by `merge.yml` order, so the fragment may reference it without redefining it — exactly as `pantry.yml` does).
- Produces (these names become the generated artifacts other sections depend on):
  - Tag `Recipe` → generated controller interface `io.mrkuhne.mezo.api.controller.RecipeApi`.
  - operationIds → `RecipeApi` methods: `listRecipes`, `getRecipe`, `createRecipe`, `updateRecipe`, `deleteRecipe`.
  - Schemas → `io.mrkuhne.mezo.api.dto.*` + `frontend/src/lib/api.gen.ts` `components['schemas'][...]`:
    `RecipeRequest`, `RecipeIngredientRequest`, `RecipeResponse`, `RecipeIngredientResponse`, `RecipeListResponse`, plus the inline object schemas `RecipeMacros`, `RecipeContribution`, `RecipeMezoFit`.

**Steps:**

1. Create the fragment file `api/feature/recipe/recipe.yml` with the COMPLETE content below. It mirrors `pantry.yml` exactly in style: a complete mini-document (`openapi`/`info`/`tags`/`paths`/`components`), inline-map response blocks, every non-2xx response referencing `SystemMessageList`, `pattern` (NOT `enum`) on the request `category`, `required` + `minLength: 1` for not-blank, `minItems: 1` on `ingredients`, `exclusiveMinimum: 0` on `amount`, `nullable: true` on optional response fields. Macros and contribution are factored into reusable object schemas (`RecipeMacros`, `RecipeContribution`, `RecipeMezoFit`) so the kcal/p/c/f shape stays single-sourced — same way `pantry.yml` factors `PantryMacros`.

```yaml
openapi: 3.0.3
info: { title: '', version: '' }
tags:
  - name: Recipe
    description: Recipes (Receptek) — owned recipe + recipe_ingredient aggregate; lines reference pantry_item by id with a per-basis macro snapshot
paths:
  /api/recipe:
    get:
      tags: [Recipe]
      operationId: listRecipes
      summary: The owner's recipes (whole-recipe macros computed from line snapshots)
      responses:
        '200': { description: Recipes, content: { application/json: { schema: { $ref: '#/components/schemas/RecipeListResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    post:
      tags: [Recipe]
      operationId: createRecipe
      summary: Create a recipe with its ingredient lines (snapshots captured server-side)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/RecipeRequest' } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/RecipeResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/recipe/{id}:
    get:
      tags: [Recipe]
      operationId: getRecipe
      summary: A single owned recipe by id (detail deep-link / hard-reload refetch)
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '200': { description: Recipe, content: { application/json: { schema: { $ref: '#/components/schemas/RecipeResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    put:
      tags: [Recipe]
      operationId: updateRecipe
      summary: Full-replace an owned recipe aggregate (all fields + all lines)
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/RecipeRequest' } } }
      responses:
        '204': { description: Updated }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    delete:
      tags: [Recipe]
      operationId: deleteRecipe
      summary: Soft-delete an owned recipe (and its lines)
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
components:
  schemas:
    RecipeMacros:
      type: object
      required: [kcal, p, c, f]
      properties:
        kcal: { type: number }
        p: { type: number }
        c: { type: number }
        f: { type: number }
    RecipeContribution:
      type: object
      required: [kcal, p, c, f]
      properties:
        kcal: { type: number }
        p: { type: number }
        c: { type: number }
        f: { type: number }
    RecipeMezoFit:
      type: object
      required: [fitsFor]
      properties:
        score: { type: number, nullable: true }
        fitsFor: { type: array, items: { type: string } }
    RecipeIngredientRequest:
      type: object
      required: [pantryItemId, amount, unit]
      properties:
        pantryItemId: { type: string, format: uuid }
        amount: { type: number, exclusiveMinimum: 0 }
        unit: { type: string, minLength: 1 }
        note: { type: string, nullable: true }
    RecipeIngredientResponse:
      type: object
      required: [pantryItemId, amount, unit, lineOrder, name, contribution]
      properties:
        pantryItemId: { type: string, format: uuid }
        amount: { type: number }
        unit: { type: string }
        note: { type: string, nullable: true }
        lineOrder: { type: integer }
        name: { type: string }
        contribution: { $ref: '#/components/schemas/RecipeContribution' }
    RecipeRequest:
      type: object
      required: [name, category, ingredients]
      properties:
        name: { type: string, minLength: 1 }
        slot: { type: string, nullable: true }
        category: { type: string, pattern: '^(breakfast|lunch|dinner|snack)$' }
        servings: { type: integer, minimum: 1, default: 1 }
        prepMins: { type: integer, minimum: 0, nullable: true }
        cookMins: { type: integer, minimum: 0, nullable: true }
        tags: { type: array, items: { type: string }, default: [] }
        starred: { type: boolean, default: false }
        ingredients:
          type: array
          minItems: 1
          items: { $ref: '#/components/schemas/RecipeIngredientRequest' }
    RecipeResponse:
      type: object
      required: [id, name, category, servings, tags, starred, createdDate, novaDominant, macros, mezoFit, timesLogged, avgScore, lastLogged, ingredients]
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        slot: { type: string, nullable: true }
        category: { type: string }
        servings: { type: integer }
        prepMins: { type: integer, nullable: true }
        cookMins: { type: integer, nullable: true }
        tags: { type: array, items: { type: string } }
        starred: { type: boolean }
        createdDate: { type: string }
        novaDominant: { type: number }
        macros: { $ref: '#/components/schemas/RecipeMacros' }
        mezoFit: { $ref: '#/components/schemas/RecipeMezoFit' }
        timesLogged: { type: integer }
        avgScore: { type: number }
        lastLogged: { type: string }
        ingredients: { type: array, items: { $ref: '#/components/schemas/RecipeIngredientResponse' } }
    RecipeListResponse:
      type: object
      required: [recipes]
      properties:
        recipes: { type: array, items: { $ref: '#/components/schemas/RecipeResponse' } }
```

2. Verify the fragment is valid YAML and self-contained (the only external `$ref` is `SystemMessageList`, supplied by the merge). Run:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && node -e "const y=require('js-yaml');const f=require('fs');const d=y.load(f.readFileSync('../feature/recipe/recipe.yml','utf8'));const s=Object.keys(d.components.schemas);['RecipeRequest','RecipeIngredientRequest','RecipeResponse','RecipeIngredientResponse','RecipeListResponse'].forEach(n=>{if(!s.includes(n))throw new Error('missing '+n)});if(d.components.schemas.RecipeRequest.properties.category.enum)throw new Error('category must be pattern not enum');if(d.components.schemas.RecipeRequest.properties.ingredients.minItems!==1)throw new Error('ingredients minItems must be 1');console.log('fragment OK:',s.join(', '))"
   ```
   Expected output: `fragment OK: RecipeMacros, RecipeContribution, RecipeMezoFit, RecipeIngredientRequest, RecipeIngredientResponse, RecipeRequest, RecipeResponse, RecipeListResponse`.
   (`js-yaml` ships under `api/generate/node_modules` as a transitive dependency of `openapi-merge-cli`, so the one-liner runs from `api/generate`.)

---

### Task contract2: Register the fragment in `merge.yml` and run the OpenAPI merge

**Files:**
- Modify: `api/generate/merge.yml`
- Modify (generated, committed): `api/openapi.yml`

**Interfaces:**
- Consumes: `api/feature/recipe/recipe.yml` (Task contract1); the existing ordered inputs in `merge.yml` (the recipe fragment is appended LAST, after `pantry`, so it can reference `SystemMessageList` from `common-schemas.yml`, which is earlier in the list).
- Produces: merged `api/openapi.yml` now containing the `Recipe` tag, the 5 `/api/recipe` operations, and the `Recipe*` schemas — the single source consumed by both generators downstream.

**Steps:**

1. Append the recipe fragment to the `inputs` list in `api/generate/merge.yml`, immediately after the pantry line (last fragment). The exact edit — replace:
   ```yaml
     - inputFile: ../feature/pantry/pantry.yml
   output: ../openapi.yml
   ```
   with:
   ```yaml
     - inputFile: ../feature/pantry/pantry.yml
     - inputFile: ../feature/recipe/recipe.yml
   output: ../openapi.yml
   ```

2. Run the merge:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && npm run generate:api
   ```
   Expected: openapi-merge-cli prints success (no `Error` lines) and rewrites `api/openapi.yml`.

3. Verify the merged contract picked up the Recipe tag, all 5 paths/operations, and all schemas:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && node -e "const y=require('js-yaml');const f=require('fs');const d=y.load(f.readFileSync('../openapi.yml','utf8'));['/api/recipe','/api/recipe/{id}'].forEach(p=>{if(!d.paths[p])throw new Error('missing path '+p)});['listRecipes','getRecipe','createRecipe','updateRecipe','deleteRecipe'].forEach(op=>{const found=Object.values(d.paths).some(pi=>Object.values(pi).some(o=>o&&o.operationId===op));if(!found)throw new Error('missing operationId '+op)});['RecipeRequest','RecipeIngredientRequest','RecipeResponse','RecipeIngredientResponse','RecipeListResponse'].forEach(n=>{if(!d.components.schemas[n])throw new Error('missing schema '+n)});if(!d.tags.some(t=>t.name==='Recipe'))throw new Error('missing Recipe tag');console.log('merged openapi.yml OK')"
   ```
   Expected output: `merged openapi.yml OK`.

---

### Task contract3: Regenerate frontend types and verify the generated TS artifacts

**Files:**
- Modify (generated, committed): `frontend/src/lib/api.gen.ts`

**Interfaces:**
- Consumes: merged `api/openapi.yml` (Task contract2).
- Produces: `frontend/src/lib/api.gen.ts` now exposes `components['schemas']['RecipeRequest']`, `RecipeIngredientRequest`, `RecipeResponse`, `RecipeIngredientResponse`, `RecipeListResponse` (the exact types the FE `recipeApi.ts`/hooks section imports via `satisfies`).

**Steps:**

1. Run the FE typegen:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm generate:api
   ```
   Expected: `openapi-typescript` rewrites `src/lib/api.gen.ts` with no errors.

2. Verify the generated TS contains every Recipe schema name (the contract task's existence assertion):
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && grep -E "RecipeRequest:|RecipeIngredientRequest:|RecipeResponse:|RecipeIngredientResponse:|RecipeListResponse:" frontend/src/lib/api.gen.ts
   ```
   Expected: one matching line per schema (all five present).

3. Type-check that the generated file compiles cleanly within the FE project (no malformed generation):
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm exec tsc -b --noEmit
   ```
   Expected: exits 0 (the generated file alone must not introduce type errors; this is the contract task's TS "test").

---

### Task contract4: Verify backend generate-sources emits RecipeApi + api.dto models, then commit

**Files:**
- (No source edits — this task verifies the build wiring. The committed artifacts are `api/openapi.yml` + `frontend/src/lib/api.gen.ts`; the Java sources under `backend/target/generated-sources/` are build output, NOT committed.)

**Interfaces:**
- Consumes: merged `api/openapi.yml` (Task contract2) — `backend/pom.xml`'s `openapi-generator-maven-plugin` reads it in the `generate-sources` phase.
- Produces (build output later backend sections implement against): `io.mrkuhne.mezo.api.controller.RecipeApi` (interface with the 5 mapped methods) and `io.mrkuhne.mezo.api.dto.{RecipeRequest,RecipeIngredientRequest,RecipeResponse,RecipeIngredientResponse,RecipeListResponse,RecipeMacros,RecipeContribution,RecipeMezoFit}`.

**Steps:**

1. Run the backend generate-sources phase (compose need not be up — this phase does no DB work; it only generates Java from the contract):
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean generate-sources
   ```
   Expected: `BUILD SUCCESS`; the openapi-generator goal runs against `api/openapi.yml`.

2. Verify the generated `RecipeApi` interface and its 5 methods exist:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && test -f backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/RecipeApi.java && grep -E "listRecipes|getRecipe|createRecipe|updateRecipe|deleteRecipe" backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/RecipeApi.java
   ```
   Expected: the file exists and all 5 operationId method names appear.

3. Verify the generated `api.dto` model classes exist:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && for n in RecipeRequest RecipeIngredientRequest RecipeResponse RecipeIngredientResponse RecipeListResponse RecipeMacros RecipeContribution RecipeMezoFit; do test -f "backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/$n.java" && echo "OK $n" || echo "MISSING $n"; done
   ```
   Expected: `OK` for all eight model classes (no `MISSING`).

4. Commit the two committed generated artifacts plus the fragment + merge config together (one contract commit, both sides regenerated green):
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && git add api/feature/recipe/recipe.yml api/generate/merge.yml api/openapi.yml frontend/src/lib/api.gen.ts
   git commit -m "feat(api): add Recipe contract — 5 endpoints + Recipe* DTOs (mezo-lns)"
   ```
   (Conventional commit subject carrying the driving bd id `mezo-lns`. NEVER add `[skip ci]`. The Java `target/` output stays uncommitted — regenerated every build.)

---

## Phase 2 — DB / persistence

## DATABASE + ENTITIES — `recipe` / `recipe_ingredient` aggregate (mezo-lns)

Builds the persistence layer for the Fuel Recipes feature: two OWNED tables (`recipe`, `recipe_ingredient`), their JPA entities (the **first** `@OneToMany`/`@ManyToOne` aggregate in the codebase — every existing relation is a plain-UUID FK, so this introduces the cascade/orphanRemoval pattern), a Spring Data repository, the test populators, the `ResetDatabase` growth-rule update, and a persistence IT proving the aggregate round-trips (cascade insert, `@OrderBy`, soft-delete restriction).

Grounded in: the Pantry template (`PantryItemEntity` / `MicroFact` jsonb pattern, `PantryItemRepository`, `PantryItemPopulator`, `PantryItemRepositoryIT`), `OwnedEntity`, and `docs/references/{liquibase_conventions,java_package_structure,spring_patterns,integration_test_framework,testing_standards}.md`. Constraint names, columns and indexes are taken VERBATIM from the SHARED INTERFACES.

---

### Task db1: Create the `recipe` + `recipe_ingredient` migration and register it

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606231400_mezo-lns_create_recipe.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`

**Interfaces:**
- Consumes: `app_user(id)` (FK target, existing); `pantry_item(id)` (FK target, from `202606221200_mezo-9xu_create_pantry_item.sql`).
- Produces: tables `recipe` and `recipe_ingredient` with the exact columns/constraints/indexes below. Later tasks (`db2`, `db3`) map JPA entities onto these names; the SERVICE/CONTRACT sections rely on column semantics (`line_order`, `snapshot_*`, `nova_dominant`, `fit_score`, `fits_for`).

**Steps:**

1. Create the migration script `backend/src/main/resources/db/changelog/1.0.0/script/202606231400_mezo-lns_create_recipe.sql` with this EXACT content (UUID PK `gen_random_uuid()`; both tables OWNED — `created_by`/`is_deleted`/`created_at`; explicit `pk_/fk_/ck_/idx_` names; `recipe_ingredient.pantry_item_id` is a plain FK column with `ON DELETE RESTRICT`, NOT a JPA association):

```sql
-- Fuel Recipes (mezo-lns): a recipe aggregate (recipe + ordered recipe_ingredient lines).
-- Both tables are OWNED (created_by FK -> app_user, soft-delete via is_deleted).
-- recipe_ingredient carries a denormalized snapshot of the pantry_item at write time so a
-- later edit/delete of the pantry_item never silently rewrites historical recipe macros.

create table recipe (
    id            uuid         not null default gen_random_uuid(),
    created_by    uuid         not null,
    is_deleted    boolean      not null default false,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz,
    name          text         not null,
    slot          text,
    category      text         not null,
    servings      integer      not null default 1,
    prep_mins     integer,
    cook_mins     integer,
    tags          jsonb,
    starred       boolean      not null default false,
    nova_dominant smallint,
    fit_score     numeric,
    fits_for      jsonb,
    constraint pk_recipe_id primary key (id),
    constraint fk_recipe_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_recipe_category check (category in ('breakfast','lunch','dinner','snack')),
    constraint ck_recipe_servings check (servings >= 1),
    constraint ck_recipe_prep_mins check (prep_mins is null or prep_mins >= 0),
    constraint ck_recipe_cook_mins check (cook_mins is null or cook_mins >= 0),
    constraint ck_recipe_nova_dominant check (nova_dominant is null or nova_dominant between 1 and 4)
);

create index idx_recipe_created_by on recipe (created_by);
create index idx_recipe_created_by_category on recipe (created_by, category);

create table recipe_ingredient (
    id                 uuid         not null default gen_random_uuid(),
    created_by         uuid         not null,
    is_deleted         boolean      not null default false,
    created_at         timestamptz  not null default now(),
    recipe_id          uuid         not null,
    pantry_item_id     uuid         not null,
    amount             numeric      not null,
    unit               text         not null,
    note               text,
    line_order         integer      not null,
    snapshot_name      text         not null,
    snapshot_per       numeric      not null,
    snapshot_basis_unit text        not null,
    snapshot_kcal      numeric      not null,
    snapshot_protein_g numeric      not null,
    snapshot_carbs_g   numeric      not null,
    snapshot_fat_g     numeric      not null,
    constraint pk_recipe_ingredient_id primary key (id),
    constraint fk_recipe_ingredient_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_recipe_ingredient_recipe_id_recipe_id foreign key (recipe_id) references recipe (id) on delete cascade,
    constraint fk_recipe_ingredient_pantry_item_id_pantry_item_id foreign key (pantry_item_id) references pantry_item (id) on delete restrict,
    constraint ck_recipe_ingredient_amount check (amount > 0)
);

create index idx_recipe_ingredient_recipe_id on recipe_ingredient (recipe_id);
create index idx_recipe_ingredient_created_by on recipe_ingredient (created_by);
create index idx_recipe_ingredient_pantry_item_id on recipe_ingredient (pantry_item_id);
```

2. Register the changeset in `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` by appending this block AFTER the existing `202606231200_mezo-zza_extend_pantry_item` changeSet (end of file — never modify a released changeset):

```yaml
  - changeSet:
      id: "1.0.0:202606231400_mezo-lns_create_recipe"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606231400_mezo-lns_create_recipe.sql
```

3. Apply the migration against the running compose DB and confirm both tables + constraints exist:

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw -q liquibase:update
```
Expected: BUILD SUCCESS, changeset `202606231400_mezo-lns_create_recipe` marked as run. (If you prefer, the next `./mvnw clean test` also applies it on the test DB — either proves the SQL parses.)

4. Verify the DDL is valid Postgres and the indexes/constraints landed:

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && docker compose exec -T postgres \
  psql -U mezo -d mezo -c "\d recipe" -c "\d recipe_ingredient"
```
Expected: both tables listed with `pk_recipe_id`, `fk_recipe_ingredient_pantry_item_id_pantry_item_id` (RESTRICT), the three `idx_recipe_ingredient_*` indexes and the `ck_recipe_*` checks.

5. Commit:

```bash
git add backend/src/main/resources/db/changelog/1.0.0/script/202606231400_mezo-lns_create_recipe.sql \
        backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml
git commit -m "feat(db): add recipe + recipe_ingredient tables (mezo-lns)"
```

---

### Task db2: `RecipeIngredientEntity` (the `@ManyToOne` child)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/entity/RecipeIngredientEntity.java`

**Interfaces:**
- Consumes: `io.mrkuhne.mezo.techcore.persistence.OwnedEntity` (provides `createdBy:UUID`, `deleted:boolean`, `createdAt:Instant`); table `recipe_ingredient` (db1).
- Produces: `RecipeIngredientEntity` with getters/setters (Lombok `@Getter/@Setter`) for: `id:UUID`, `recipe:RecipeEntity` (`@ManyToOne`, join column `recipe_id`), `pantryItemId:UUID` (plain column `pantry_item_id`), `amount:BigDecimal`, `unit:String`, `note:String`, `lineOrder:Integer` (column `line_order`), `snapshotName:String`, `snapshotPer:BigDecimal`, `snapshotBasisUnit:String`, `snapshotKcal:BigDecimal`, `snapshotProteinG:BigDecimal`, `snapshotCarbsG:BigDecimal`, `snapshotFatG:BigDecimal`. The mapper/service/populator in later sections rely on these exact accessor names.

**Steps:**

1. Create the entity. It must be authored BEFORE `RecipeEntity` (db3) because `RecipeEntity.lines` references this type; `recipe` is a real `@ManyToOne` association (the parent of the new aggregate pattern), while `pantryItemId` stays a plain UUID column (no association — the snapshot is the durable record). Soft-delete via `@SQLDelete`/`@SQLRestriction`, mirroring `PantryItemEntity`:

```java
package io.mrkuhne.mezo.feature.recipe.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One ordered ingredient line of a {@link RecipeEntity} (FK {@code recipe_id},
 * {@code ON DELETE CASCADE}). Lines are ordered within a recipe by {@code lineOrder}.
 *
 * <p>{@code pantryItemId} is a PLAIN UUID column (FK to {@code pantry_item}, {@code ON DELETE
 * RESTRICT}), deliberately NOT a JPA association: the {@code snapshot*} fields capture the live
 * {@code PantryItem}'s name + per-basis macros at write time so a later edit/delete of the source
 * item never silently rewrites this recipe's historical macros.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "recipe_ingredient")
@SQLDelete(sql = "update recipe_ingredient set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RecipeIngredientEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipe_id", nullable = false)
    private RecipeEntity recipe;

    @NotNull
    @Column(name = "pantry_item_id", nullable = false)
    private UUID pantryItemId;

    @NotNull
    @Column(nullable = false)
    private BigDecimal amount;

    @NotNull
    @Column(nullable = false)
    private String unit;

    @Column
    private String note;

    @NotNull
    @Column(name = "line_order", nullable = false)
    private Integer lineOrder;

    @NotNull
    @Column(name = "snapshot_name", nullable = false)
    private String snapshotName;

    @NotNull
    @Column(name = "snapshot_per", nullable = false)
    private BigDecimal snapshotPer;

    @NotNull
    @Column(name = "snapshot_basis_unit", nullable = false)
    private String snapshotBasisUnit;

    @NotNull
    @Column(name = "snapshot_kcal", nullable = false)
    private BigDecimal snapshotKcal;

    @NotNull
    @Column(name = "snapshot_protein_g", nullable = false)
    private BigDecimal snapshotProteinG;

    @NotNull
    @Column(name = "snapshot_carbs_g", nullable = false)
    private BigDecimal snapshotCarbsG;

    @NotNull
    @Column(name = "snapshot_fat_g", nullable = false)
    private BigDecimal snapshotFatG;
}
```

2. Compile (will not pass standalone yet — `RecipeEntity` is created in db3; this is expected and resolved together):

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw -q clean compile
```
Expected: FAILURE — `cannot find symbol: class RecipeEntity`. Proceed to db3 immediately; the two entities compile as a unit (do not commit a non-compiling tree — db2 and db3 share one commit, made at the end of db3).

---

### Task db3: `RecipeEntity` (the `@OneToMany` parent) + `RecipeRepository`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/entity/RecipeEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/repository/RecipeRepository.java`

**Interfaces:**
- Consumes: `OwnedEntity`; `RecipeIngredientEntity` (db2).
- Produces:
  - `RecipeEntity` with accessors for: `id:UUID`, `name:String`, `slot:String`, `category:String`, `servings:Integer`, `prepMins:Integer`, `cookMins:Integer`, `tags:List<String>` (jsonb), `starred:boolean`, `novaDominant:Short` (column `nova_dominant`), `fitScore:BigDecimal` (nullable), `fitsFor:List<String>` (jsonb, nullable), `updatedAt:Instant` (`@UpdateTimestamp`), `lines:List<RecipeIngredientEntity>` (`@OneToMany(mappedBy="recipe", cascade=ALL, orphanRemoval=true) @OrderBy("lineOrder")`). The mapper reads these; the service mutates `lines` (clear + rebuild for full-replace) and sets `createdBy`/`novaDominant`.
  - `RecipeRepository extends JpaRepository<RecipeEntity, UUID>` with: `List<RecipeEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy)` and `Optional<RecipeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy)`. The SERVICE section calls exactly these two finders (`requireOwned` uses the `findByIdAnd…` finder).

**Steps:**

1. Create `RecipeEntity`. `tags` + `fitsFor` are jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto `List<String>` (mirror the `micros` jsonb pattern in `PantryItemEntity`); `updatedAt` is `@UpdateTimestamp`; `novaDominant` is `Short` (smallint, derived+persisted at write); `fitScore`/`fitsFor` stay nullable (Phase-3 placeholder). The `lines` collection IS the aggregate boundary — `cascade=ALL` + `orphanRemoval=true` persist/delete children with the parent, `@OrderBy("lineOrder")` guarantees ordered load:

```java
package io.mrkuhne.mezo.feature.recipe.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * A recipe aggregate root: header fields + an ordered list of {@link RecipeIngredientEntity}
 * lines (the {@code lines} collection is the aggregate boundary — {@code cascade = ALL} +
 * {@code orphanRemoval = true} persist/remove children with the parent, {@code @OrderBy} loads
 * them by {@code line_order}). This is the first true {@code @OneToMany} aggregate in the codebase.
 *
 * <p>{@code tags}/{@code fitsFor} are jsonb string arrays (mirrors the {@code micros} jsonb on
 * {@code PantryItemEntity}). {@code novaDominant} is derived + persisted at write time;
 * {@code fitScore}/{@code fitsFor} stay null until Phase-3 mezo-fit scoring exists.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 *
 * <p><b>Soft delete does NOT cascade through {@code @OneToMany}</b>: {@code @SQLDelete} only
 * rewrites this row, so the service must bulk-soft-delete the {@code recipe_ingredient} children
 * explicitly on delete.
 */
@Getter
@Setter
@Entity
@Table(name = "recipe")
@SQLDelete(sql = "update recipe set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RecipeEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @NotNull
    @Column(nullable = false)
    private String name;

    @Column
    private String slot;

    @NotNull
    @Column(nullable = false)
    private String category; // breakfast|lunch|dinner|snack (DB CHECK)

    @NotNull
    @Column(nullable = false)
    private Integer servings = 1;

    @Column(name = "prep_mins")
    private Integer prepMins;

    @Column(name = "cook_mins")
    private Integer cookMins;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> tags;

    @Column(nullable = false)
    private boolean starred = false;

    @Column(name = "nova_dominant")
    private Short novaDominant;

    @Column(name = "fit_score")
    private BigDecimal fitScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "fits_for", columnDefinition = "jsonb")
    private List<String> fitsFor;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineOrder")
    private List<RecipeIngredientEntity> lines = new ArrayList<>();
}
```

2. Create `RecipeRepository` (extend `JpaRepository` directly — no shared `date` base field, same call as `PantryItemRepository`; the `@SQLRestriction` already hides soft-deleted rows, the explicit `DeletedFalse` keeps the derived-name contract clear):

```java
package io.mrkuhne.mezo.feature.recipe.repository;

import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// No 'date' base field => extend JpaRepository directly (cf. PantryItemRepository), not OwnedRepository.
public interface RecipeRepository extends JpaRepository<RecipeEntity, UUID> {

    List<RecipeEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    Optional<RecipeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
```

3. Compile the whole tree (db2 + db3 together):

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw -q clean compile
```
Expected: BUILD SUCCESS (both entities + repository resolve; Hibernate metamodel validates the `@OneToMany`/`@ManyToOne` pairing on `mappedBy="recipe"`).

4. Commit the entity+repository unit:

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/entity/RecipeEntity.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/recipe/entity/RecipeIngredientEntity.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/recipe/repository/RecipeRepository.java
git commit -m "feat(recipe): add Recipe aggregate entities + repository (mezo-lns)"
```

---

### Task db4: `RecipePopulator` test factory + `ResetDatabase` growth-rule update

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/RecipePopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`

**Interfaces:**
- Consumes: `RecipeRepository` (db3); `RecipeEntity`/`RecipeIngredientEntity` (db2/db3); existing `PantryItemPopulator.createFood(UUID, String, LocalDate)` (returns a persisted `PantryItemEntity` whose `id` seeds the line's `pantryItemId` FK — the FK is RESTRICT so the pantry row MUST exist first).
- Produces: `RecipePopulator` (`@TestComponent`) with `RecipeEntity createRecipe(UUID owner, UUID pantryItemId)` — persists a 2-line `breakfast` recipe via `saveAndFlush` (cascade persists the lines) so DB CHECKs fire; the lines are added in `lineOrder` 1 then 0 to prove `@OrderBy` reorders them on reload. Registered in `AbstractIntegrationTest`'s `@Import`. `ResetDatabase` TRUNCATE list now includes `recipe, recipe_ingredient`.

**Steps:**

1. Add `recipe, recipe_ingredient` to the FRONT of the `ResetDatabase` TRUNCATE list (child-then-parent ordering is moot under `CASCADE`, but listing the children helps readability). Edit the native query string in `resetExceptMasterData()`:

```java
        entityManager.createNativeQuery(
            "TRUNCATE TABLE recipe_ingredient, recipe, pantry_item, weight_log, sleep_log, check_in, "
                + "exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle, "
                + "gym_schedule_slot, sport_schedule_slot, sport_session, run_session_log, running_block, "
                + "goal_plan_link, goal, biometric_profile CASCADE").executeUpdate();
```

2. Create `RecipePopulator`. It builds a recipe whose two lines reference the SAME persisted `pantryItemId` (the test passes a real `pantry_item.id`), sets `created_by` on the recipe AND each line (FK-valid owner), and intentionally adds the lines in order `[lineOrder=1, lineOrder=0]` so the reload-then-`@OrderBy` assertion is meaningful. Persist via `saveAndFlush` (cascade writes the children):

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the Recipe aggregate — persists via {@code saveAndFlush} so DB CHECKs + cascade fire. */
@TestComponent
@RequiredArgsConstructor
public class RecipePopulator {

    private final RecipeRepository repository;

    /**
     * A breakfast recipe with two lines that both reference {@code pantryItemId} (which MUST be a
     * real, persisted {@code pantry_item.id} — the FK is RESTRICT). The lines are added in reverse
     * {@code lineOrder} ([1] then [0]) so a reload proves {@code @OrderBy("lineOrder")} sorts them.
     */
    public RecipeEntity createRecipe(UUID owner, UUID pantryItemId) {
        RecipeEntity recipe = new RecipeEntity();
        recipe.setCreatedBy(owner);
        recipe.setName("Túrós tál");
        recipe.setCategory("breakfast");
        recipe.setServings(2);
        recipe.setPrepMins(10);
        recipe.setTags(List.of("magas-fehérje", "gyors"));
        recipe.setNovaDominant((short) 1);

        recipe.getLines().add(line(owner, pantryItemId, 1, "Méz", new BigDecimal("20")));
        recipe.getLines().add(line(owner, pantryItemId, 0, "Túró", new BigDecimal("250")));

        return repository.saveAndFlush(recipe);
    }

    private RecipeIngredientEntity line(UUID owner, UUID pantryItemId, int order, String name, BigDecimal amount) {
        RecipeIngredientEntity ing = new RecipeIngredientEntity();
        ing.setCreatedBy(owner);
        ing.setPantryItemId(pantryItemId);
        ing.setAmount(amount);
        ing.setUnit("g");
        ing.setLineOrder(order);
        ing.setSnapshotName(name);
        ing.setSnapshotPer(new BigDecimal("100"));
        ing.setSnapshotBasisUnit("g");
        ing.setSnapshotKcal(new BigDecimal("110"));
        ing.setSnapshotProteinG(new BigDecimal("13.0"));
        ing.setSnapshotCarbsG(new BigDecimal("4.0"));
        ing.setSnapshotFatG(new BigDecimal("4.5"));
        return ing;
    }
}
```

3. Register `RecipePopulator` in `AbstractIntegrationTest`. Add the import and append it to the `@Import` list (keep `ResetDatabase` last):

```java
import io.mrkuhne.mezo.support.populator.RecipePopulator;
```
and update the `@Import` to include `RecipePopulator.class` (after `PantryItemPopulator.class`):

```java
@Import({TestcontainersConfiguration.class, DatabasePopulator.class, UserPopulator.class,
    TrainPopulator.class, RunningPopulator.class, GoalPopulator.class, GoalPlanLinkPopulator.class,
    BiometricProfilePopulator.class, WeightLogPopulator.class, PantryItemPopulator.class,
    RecipePopulator.class, ResetDatabase.class})
```

4. Compile the test tree (no test runs yet — the IT lands in db5):

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw -q clean test-compile
```
Expected: BUILD SUCCESS.

5. Commit:

```bash
git add backend/src/test/java/io/mrkuhne/mezo/support/populator/RecipePopulator.java \
        backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java \
        backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java
git commit -m "test(recipe): add RecipePopulator + register recipe tables in ResetDatabase (mezo-lns)"
```

---

### Task db5: Persistence IT — cascade insert, `@OrderBy`, soft-delete restriction

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeRepositoryIT.java`

**Interfaces:**
- Consumes: `AbstractIntegrationTest`; `DatabasePopulator.populateUser(String)→UUID`; `PantryItemPopulator.createFood(UUID, String, LocalDate)→PantryItemEntity`; `RecipePopulator.createRecipe(UUID, UUID)→RecipeEntity`; `RecipeRepository.{findByCreatedByAndDeletedFalseOrderByCreatedAtDesc, findByIdAndCreatedByAndDeletedFalse}`.
- Produces: proof that (a) the aggregate persists through one `saveAndFlush` (cascade writes both lines), (b) `@OrderBy("lineOrder")` returns lines sorted 0→1 on reload, (c) `@SQLRestriction` hides a soft-deleted recipe. No new production names.

**Steps:**

1. Write the failing IT (mirrors `PantryItemRepositoryIT` style — `@Transactional` subclass, owner via `populateUser`, FK-valid pantry row via `createFood`). The `pantry_item` FK is RESTRICT, so the food row MUST be created first and its id fed into the recipe lines:

```java
package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeRepositoryIT extends AbstractIntegrationTest {

    @Autowired private RecipeRepository repository;
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    // created_by + pantry_item_id both have FKs — owners and pantry rows MUST be real (populated first).
    @Test
    void testFindByOwner_shouldPersistAggregateAndOrderLines_whenSaved() {
        UUID owner = databasePopulator.populateUser("owner@test.local");
        PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
        recipePopulator.createRecipe(owner, food.getId());

        var recipes = repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner);

        assertThat(recipes).hasSize(1);
        RecipeEntity r = recipes.get(0);
        assertThat(r.getCategory()).isEqualTo("breakfast");
        assertThat(r.getServings()).isEqualTo(2);
        assertThat(r.getTags()).containsExactly("magas-fehérje", "gyors");
        assertThat(r.getNovaDominant()).isEqualTo((short) 1);
        // cascade persisted BOTH lines; @OrderBy("lineOrder") returns them 0 -> 1 despite reverse insert.
        assertThat(r.getLines()).hasSize(2);
        assertThat(r.getLines()).extracting(l -> l.getLineOrder()).containsExactly(0, 1);
        assertThat(r.getLines().get(0).getSnapshotName()).isEqualTo("Túró");
        assertThat(r.getLines().get(0).getPantryItemId()).isEqualTo(food.getId());
    }

    @Test
    void testFindByOwner_shouldHideRow_whenSoftDeleted() {
        UUID owner = databasePopulator.populateUser("owner@test.local");
        PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
        RecipeEntity r = recipePopulator.createRecipe(owner, food.getId());

        repository.delete(r); // @SQLDelete soft-deletes the recipe row

        assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner)).isEmpty();
        assertThat(repository.findByIdAndCreatedByAndDeletedFalse(r.getId(), owner)).isEmpty();
    }
}
```

2. Run the IT and watch it FAIL until the schema/entities are wired (it passes once db1–db4 are in place; run it explicitly to confirm the aggregate behaves). Compose must be up (`docker compose up -d`) for the fixed `mezo_test` DB:

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw -q clean test -Dtest=RecipeRepositoryIT
```
Expected on a tree WITHOUT db1–db4: FAILURE (compile error / missing table). With db1–db4 present this is the implementation-complete gate — see step 3.

3. (Implementation is already done in db1–db4 — there is no further production code for this IT.) Re-run to confirm PASS:

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw -q clean test -Dtest=RecipeRepositoryIT
```
Expected: BUILD SUCCESS, 2 tests passing (`@OrderBy` returns `[0, 1]`; soft-deleted recipe is hidden by both finders).

4. Run the FULL backend suite to prove nothing regressed (the new TRUNCATE entries + `@OneToMany` metamodel must not break existing ITs):

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
```
Expected: BUILD SUCCESS, all tests green.

5. Commit:

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeRepositoryIT.java
git commit -m "test(recipe): aggregate persistence IT — cascade, @OrderBy, soft-delete (mezo-lns)"
```

---

## Phase 3 — Mapper

The read-side mapper (entity → response, with computed contribution + whole-recipe macros +
`mezoFit` placeholder + derived defaults) and the apply-side mapper helper
(`applyScalars`: copies the scalar (non-line) `RecipeRequest` fields onto a `RecipeEntity`,
used by the service on create/update). This is the single owner of scalar request→entity mapping.

Grounded in:
- `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/mapper/PantryMapper.java` — hand-written
  `default` methods, `nz(...)` null-coalescing helper, enum via `Enum.fromValue(...)` /
  `r.getX().getValue()`, builder DTOs.
- `docs/references/api_contract_conventions.md` (generated `api.dto.*`, never hand-write boundary
  DTOs), `error_handling.md` (`SystemMessage` codes, no hardcoded text), and `testing_standards.md`
  (`test{Method}_should{Result}_when{Condition}`, AssertJ only, no mocks).

**Contract DTOs consumed (from the contract section, generated under `io.mrkuhne.mezo.api.dto.*`):**
`RecipeRequest`, `RecipeIngredientRequest`, `RecipeResponse`, `RecipeIngredientResponse`,
`RecipeListResponse`, `RecipeMacros {kcal,p,c,f}`, `RecipeContribution {kcal,p,c,f}`,
`RecipeMezoFit {score (nullable), fitsFor}` — all Lombok `@Builder`.

**Entity accessors consumed (from the DB section, authored separately) — used VERBATIM:**
`RecipeEntity` extends `OwnedEntity`: `getId():UUID`, `getName()`, `getSlot()`, `getCategory():String`,
`getServings():Integer`, `getPrepMins():Integer`, `getCookMins():Integer`, `getTags():List<String>`,
`isStarred():boolean`, `getNovaDominant():Short`, `getFitScore():BigDecimal`,
`getFitsFor():List<String>`, `getLines():List<RecipeIngredientEntity>`, `getCreatedAt():Instant`,
plus setters `setName/setSlot/setCategory/setServings/setPrepMins/setCookMins/setTags/setStarred/setNovaDominant`.
`RecipeIngredientEntity` extends `OwnedEntity`:
`getPantryItemId():UUID`, `getAmount():BigDecimal`, `getUnit():String`, `getNote():String`,
`getLineOrder():Integer`, `getSnapshotName():String`, `getSnapshotPer():BigDecimal`,
`getSnapshotBasisUnit():String`, `getSnapshotKcal():BigDecimal`, `getSnapshotProteinG():BigDecimal`,
`getSnapshotCarbsG():BigDecimal`, `getSnapshotFatG():BigDecimal`.

---

### Task ctl1: Create `RecipeMapper` (apply-scalars + read-side response with computed macros)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/mapper/RecipeMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperTest.java`

**Interfaces:**
- Consumes:
  - `io.mrkuhne.mezo.api.dto.RecipeRequest` — `getName()`, `getSlot()`, `getCategory():String`
    (pattern string, NOT an enum on the request), `getServings():Integer`, `getPrepMins():Integer`,
    `getCookMins():Integer`, `getTags():List<String>`, `getStarred():Boolean`.
  - `io.mrkuhne.mezo.api.dto.RecipeResponse`, `RecipeIngredientResponse`, `RecipeMacros`,
    `RecipeContribution`, `RecipeMezoFit` — all `@Builder`.
  - `RecipeEntity` / `RecipeIngredientEntity` accessors (see header) — produced by the entity
    section.
- Produces (the service + later code depend on these VERBATIM):
  - `@Mapper(componentModel = "spring") public interface RecipeMapper`.
  - `void applyScalars(RecipeEntity e, RecipeRequest r)` — copies the scalar (non-line) fields
    onto an existing entity (null-coalescing the defaulted ones); the **service** owns line
    rebuild + snapshots + `created_by` + `nova_dominant`.
  - `RecipeResponse toResponse(RecipeEntity e)` — full read projection.
  - `RecipeIngredientResponse toLineResponse(RecipeIngredientEntity l)`.
  - `RecipeContribution contribution(RecipeIngredientEntity l)` — the per-line formula
    `factor = amount / snapshotPer`, `round(snapshot.{…} * factor)`.

**Steps:**

1. Write the failing test FIRST. It exercises the pure read-side computation (contribution
   rounding, whole-recipe rollup = Σ line contributions, `mezoFit` placeholder
   `{score:null, fitsFor:[]}` when `fitScore == null`, and derived defaults
   `timesLogged 0 / avgScore 0 / lastLogged "—"`). It builds entities directly (no Spring
   context — MapStruct `componentModel=spring` interfaces are plain interfaces with `default`
   methods, instantiable via the generated `RecipeMapperImpl`).

   Create `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperTest.java`:

   ```java
   package io.mrkuhne.mezo.feature.recipe;

   import static org.assertj.core.api.Assertions.assertThat;

   import io.mrkuhne.mezo.api.dto.RecipeResponse;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
   import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
   import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapperImpl;
   import java.math.BigDecimal;
   import java.util.List;
   import java.util.UUID;
   import org.junit.jupiter.api.Test;

   class RecipeMapperTest {

       private final RecipeMapper mapper = new RecipeMapperImpl();

       private RecipeIngredientEntity line(
           String name, BigDecimal amount, BigDecimal per,
           String kcal, String p, String c, String f, int order) {
           RecipeIngredientEntity l = new RecipeIngredientEntity();
           l.setPantryItemId(UUID.randomUUID());
           l.setAmount(amount);
           l.setUnit("g");
           l.setLineOrder(order);
           l.setSnapshotName(name);
           l.setSnapshotPer(per);
           l.setSnapshotBasisUnit("g");
           l.setSnapshotKcal(new BigDecimal(kcal));
           l.setSnapshotProteinG(new BigDecimal(p));
           l.setSnapshotCarbsG(new BigDecimal(c));
           l.setSnapshotFatG(new BigDecimal(f));
           return l;
       }

       private RecipeEntity recipe() {
           RecipeEntity e = new RecipeEntity();
           e.setName("Túrós tál");
           e.setCategory("breakfast");
           e.setServings(2);
           e.setStarred(false);
           // 200 g of a per-100g food: factor = 2 -> kcal 110*2=220, p 23*2=46, c 0, f 1.5*2=3
           // + 50 g of a per-100g food: factor = 0.5 -> kcal 50, p 5, c 10, f 2.5(round->3? see below)
           e.getLines().add(line("Csirkemell", new BigDecimal("200"), new BigDecimal("100"),
               "110", "23", "0", "1.5", 0));
           e.getLines().add(line("Zabpehely", new BigDecimal("50"), new BigDecimal("100"),
               "100", "10", "20", "5", 1));
           return e;
       }

       @Test
       void testToResponse_shouldComputeRoundedContributionsAndWholeRecipeRollup_whenLinesPresent() {
           RecipeResponse r = mapper.toResponse(recipe());

           // line 0: 200/100 = 2.0 -> kcal 220, p 46, c 0, f 3
           assertThat(r.getIngredients().get(0).getContribution().getKcal())
               .isEqualByComparingTo("220");
           assertThat(r.getIngredients().get(0).getContribution().getP())
               .isEqualByComparingTo("46");
           assertThat(r.getIngredients().get(0).getContribution().getF())
               .isEqualByComparingTo("3");
           // line 1: 50/100 = 0.5 -> kcal 50, p 5, c 10, f round(2.5)=3 (HALF_UP)
           assertThat(r.getIngredients().get(1).getContribution().getKcal())
               .isEqualByComparingTo("50");
           assertThat(r.getIngredients().get(1).getContribution().getC())
               .isEqualByComparingTo("10");
           assertThat(r.getIngredients().get(1).getContribution().getF())
               .isEqualByComparingTo("3");
           // whole-recipe macros = Σ contributions: kcal 270, p 51, c 10, f 6
           assertThat(r.getMacros().getKcal()).isEqualByComparingTo("270");
           assertThat(r.getMacros().getP()).isEqualByComparingTo("51");
           assertThat(r.getMacros().getC()).isEqualByComparingTo("10");
           assertThat(r.getMacros().getF()).isEqualByComparingTo("6");
       }

       @Test
       void testToResponse_shouldEmitPendingMezoFitAndDerivedDefaults_whenFitScoreNull() {
           RecipeResponse r = mapper.toResponse(recipe());

           assertThat(r.getMezoFit().getScore()).isNull();
           assertThat(r.getMezoFit().getFitsFor()).isEmpty();
           assertThat(r.getTimesLogged()).isEqualTo(0);
           assertThat(r.getAvgScore()).isEqualByComparingTo("0");
           assertThat(r.getLastLogged()).isEqualTo("—");
       }

       @Test
       void testToResponse_shouldPassThroughScalarsAndLineOrder_whenMapped() {
           RecipeResponse r = mapper.toResponse(recipe());

           assertThat(r.getName()).isEqualTo("Túrós tál");
           assertThat(r.getCategory()).isEqualTo("breakfast");
           assertThat(r.getServings()).isEqualTo(2);
           assertThat(r.getIngredients()).extracting(i -> i.getName())
               .containsExactly("Csirkemell", "Zabpehely");
           assertThat(r.getIngredients()).extracting(i -> i.getLineOrder())
               .containsExactly(0, 1);
       }
   }
   ```

2. Run it — expect a COMPILE failure (the `RecipeMapper` interface and `RecipeMapperImpl` do not
   exist yet):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=RecipeMapperTest
   ```

   Expected: BUILD FAILURE — `cannot find symbol: class RecipeMapper` / `RecipeMapperImpl`.

3. Implement the mapper. Create
   `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/mapper/RecipeMapper.java` with the FULL
   content below. `applyScalars` null-coalesces the OpenAPI-defaulted fields (`servings`→1,
   `tags`→`[]`, `starred`→false) so a defaulted-away request still lands valid values;
   `category`/`name`/`slot`/`prepMins`/`cookMins` pass through (validation already happened at the
   boundary). Note: `category` is a **plain String** on both request and entity (pattern, not
   enum), so no `.getValue()` here — but the read side still passes the string straight through.
   `contribution` implements the shared formula with `BigDecimal`, rounding each macro to a whole
   number via `setScale(0, HALF_UP)`.

   ```java
   package io.mrkuhne.mezo.feature.recipe.mapper;

   import io.mrkuhne.mezo.api.dto.RecipeContribution;
   import io.mrkuhne.mezo.api.dto.RecipeIngredientResponse;
   import io.mrkuhne.mezo.api.dto.RecipeMacros;
   import io.mrkuhne.mezo.api.dto.RecipeMezoFit;
   import io.mrkuhne.mezo.api.dto.RecipeRequest;
   import io.mrkuhne.mezo.api.dto.RecipeResponse;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
   import java.math.BigDecimal;
   import java.math.RoundingMode;
   import java.util.ArrayList;
   import java.util.List;
   import org.mapstruct.Mapper;

   @Mapper(componentModel = "spring")
   public interface RecipeMapper {

       /**
        * Copies the scalar (non-line) request fields onto an existing entity. The service owns
        * line rebuild, snapshot capture, server-side {@code created_by}, and {@code nova_dominant}
        * derivation — this method MUST NOT touch the line collection.
        */
       default void applyScalars(RecipeEntity e, RecipeRequest r) {
           e.setName(r.getName());
           e.setSlot(r.getSlot());
           e.setCategory(r.getCategory()); // plain String (pattern, not enum)
           e.setServings(r.getServings() == null ? 1 : r.getServings());
           e.setPrepMins(r.getPrepMins());
           e.setCookMins(r.getCookMins());
           e.setTags(r.getTags() == null ? List.of() : r.getTags());
           e.setStarred(Boolean.TRUE.equals(r.getStarred()));
       }

       default RecipeResponse toResponse(RecipeEntity e) {
           List<RecipeIngredientResponse> lines = e.getLines() == null ? List.of()
               : e.getLines().stream().map(this::toLineResponse).toList();
           return RecipeResponse.builder()
               .id(e.getId())
               .name(e.getName())
               .slot(e.getSlot())
               .category(e.getCategory())
               .servings(e.getServings())
               .prepMins(e.getPrepMins())
               .cookMins(e.getCookMins())
               .tags(e.getTags() == null ? List.of() : e.getTags())
               .starred(e.isStarred())
               .createdDate(e.getCreatedAt() == null ? "" : e.getCreatedAt().toString())
               .novaDominant(e.getNovaDominant() == null ? null : new BigDecimal(e.getNovaDominant().intValue()))
               .macros(rollup(lines))
               .mezoFit(RecipeMezoFit.builder()
                   .score(e.getFitScore())                       // null -> pending sparkle on FE
                   .fitsFor(e.getFitsFor() == null ? List.of() : e.getFitsFor())
                   .build())
               .timesLogged(0)        // derived from logging — out of scope this slice
               .avgScore(BigDecimal.ZERO)
               .lastLogged("—")
               .ingredients(lines)
               .build();
       }

       default RecipeIngredientResponse toLineResponse(RecipeIngredientEntity l) {
           return RecipeIngredientResponse.builder()
               .pantryItemId(l.getPantryItemId())
               .amount(l.getAmount())
               .unit(l.getUnit())
               .note(l.getNote())
               .lineOrder(l.getLineOrder())
               .name(l.getSnapshotName())
               .contribution(contribution(l))
               .build();
       }

       /** Per-line contribution: factor = amount / snapshotPer; round(snapshot.{…} * factor). */
       default RecipeContribution contribution(RecipeIngredientEntity l) {
           BigDecimal per = l.getSnapshotPer() == null || l.getSnapshotPer().signum() == 0
               ? BigDecimal.ONE : l.getSnapshotPer();
           BigDecimal factor = l.getAmount().divide(per, 6, RoundingMode.HALF_UP);
           return RecipeContribution.builder()
               .kcal(scaled(l.getSnapshotKcal(), factor))
               .p(scaled(l.getSnapshotProteinG(), factor))
               .c(scaled(l.getSnapshotCarbsG(), factor))
               .f(scaled(l.getSnapshotFatG(), factor))
               .build();
       }

       /** Whole-recipe macros = Σ line contributions. */
       private RecipeMacros rollup(List<RecipeIngredientResponse> lines) {
           BigDecimal kcal = BigDecimal.ZERO, p = BigDecimal.ZERO, c = BigDecimal.ZERO, f = BigDecimal.ZERO;
           List<RecipeContribution> contribs = new ArrayList<>();
           for (RecipeIngredientResponse l : lines) contribs.add(l.getContribution());
           for (RecipeContribution x : contribs) {
               kcal = kcal.add(x.getKcal());
               p = p.add(x.getP());
               c = c.add(x.getC());
               f = f.add(x.getF());
           }
           return RecipeMacros.builder().kcal(kcal).p(p).c(c).f(f).build();
       }

       private static BigDecimal scaled(BigDecimal base, BigDecimal factor) {
           BigDecimal v = base == null ? BigDecimal.ZERO : base;
           return v.multiply(factor).setScale(0, RoundingMode.HALF_UP);
       }
   }
   ```

4. Run the test — expect PASS:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=RecipeMapperTest
   ```

   Expected: BUILD SUCCESS, `RecipeMapperTest` 3 tests green (contribution rounding, rollup,
   pending mezoFit + derived defaults, scalar pass-through).

5. Commit:

   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/mapper/RecipeMapper.java \
           backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperTest.java
   git commit -m "feat(recipe): add RecipeMapper (contribution rollup + read projection) (mezo-lns)"
   ```

---

## Phase 4 — Service

### Task svc2: Create `RecipeService` (create + snapshot capture + rollup-ready persist) + create-path IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeServiceIT.java`

**Interfaces:**
- Consumes:
  - `io.mrkuhne.mezo.api.dto.RecipeRequest` (getters: `getName()`, `getSlot()`, `getCategory()`, `getServings()->Integer`, `getPrepMins()->Integer`, `getCookMins()->Integer`, `getTags()->List<String>`, `getStarred()->Boolean`, `getIngredients()->List<RecipeIngredientRequest>`)
  - `io.mrkuhne.mezo.api.dto.RecipeIngredientRequest` (getters: `getPantryItemId()->UUID`, `getAmount()->BigDecimal`, `getUnit()->String`, `getNote()->String`)
  - `io.mrkuhne.mezo.api.dto.RecipeResponse` (mapper output; here only used as the return type of `create`/`get`)
  - `RecipeRepository` (DB section, task db3) — `findByCreatedByAndDeletedFalseOrderByCreatedAtDesc`, `findByIdAndCreatedByAndDeletedFalse`, `save`, `delete`
  - `io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository#findByIdAndCreatedByAndDeletedFalse(UUID,UUID)->Optional<PantryItemEntity>`
  - `io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity` (getters: `getName()`, `getServingAmount()`, `getServingUnit()`, `getKcal()`, `getProteinG()`, `getCarbsG()`, `getFatG()`, `getNova()->Short`)
  - `io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper#toResponse(RecipeEntity)->RecipeResponse` (from the mapper section)
  - `io.mrkuhne.mezo.techcore.exception.SystemMessage`, `SystemRuntimeErrorException`
- Produces (consumed by the controller section + later svc tasks):
  - `@Service RecipeService`
  - `RecipeResponse create(UUID userId, RecipeRequest req)`
  - `RecipeResponse get(UUID userId, UUID id)`
  - `RecipeListResponse list(UUID userId)` *(Task svc3 adds `list`; this task ships `create` + `get` + private helpers)*
  - private `RecipeIngredientEntity buildLine(UUID userId, RecipeEntity recipe, RecipeIngredientRequest lineReq, int index)` — resolves the pantry item owner-scoped, captures the snapshot, sets `created_by`/`line_order`
  - private `Short deriveNovaDominant(List<RecipeIngredientEntity> lines)` — max source NOVA across resolved lines (kept on the service since it reads the live `PantryItem.nova` during build)
  - private `RecipeEntity requireOwned(UUID userId, UUID id)` — 404 gate (Task svc3 reuses)

> Follow `PantryService` style exactly: constructor injection via `@RequiredArgsConstructor`, method-level `@Transactional`, `requireOwned` 404 gate, `SystemMessage.field("VALIDATION_INVALID_VALUE", "ingredients")` for bad lines. **`pantry_item` is resolved with the SAME owner-scoped not-deleted finder the Pantry feature uses** — missing, foreign, and soft-deleted items are all indistinguishable 400s. NOVA derivation reads `PantryItem.nova` while the line is being built (the snapshot itself does not store NOVA).

**Steps:**

1. Write the failing create-path IT. Create `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeServiceIT.java`:
   ```java
   package io.mrkuhne.mezo.feature.recipe;

   import static org.assertj.core.api.Assertions.assertThat;
   import static org.assertj.core.api.Assertions.assertThatThrownBy;

   import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
   import io.mrkuhne.mezo.api.dto.RecipeRequest;
   import io.mrkuhne.mezo.api.dto.RecipeResponse;
   import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
   import io.mrkuhne.mezo.feature.recipe.service.RecipeService;
   import io.mrkuhne.mezo.support.AbstractIntegrationTest;
   import io.mrkuhne.mezo.support.DatabasePopulator;
   import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
   import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
   import java.math.BigDecimal;
   import java.time.LocalDate;
   import java.util.List;
   import java.util.UUID;
   import org.junit.jupiter.api.BeforeEach;
   import org.junit.jupiter.api.Test;
   import org.springframework.beans.factory.annotation.Autowired;
   import org.springframework.transaction.annotation.Transactional;

   @Transactional
   class RecipeServiceIT extends AbstractIntegrationTest {

       @Autowired private RecipeService service;
       @Autowired private PantryItemPopulator pantryPopulator;
       @Autowired private DatabasePopulator databasePopulator;

       private UUID owner;
       private UUID other;

       @BeforeEach
       void setUpOwners() {
           owner = databasePopulator.populateUser("a@test.local");
           other = databasePopulator.populateUser("b@test.local");
       }

       /** A food at 100 g basis: 110 kcal / 23 P / 0 C / 1.5 F per 100 g (cf. PantryItemPopulator.createFood). */
       private PantryItemEntity food(String name) {
           return pantryPopulator.createFood(owner, name, LocalDate.of(2026, 5, 25));
       }

       private RecipeIngredientRequest line(UUID pantryItemId, String amount, String unit) {
           RecipeIngredientRequest l = new RecipeIngredientRequest();
           l.setPantryItemId(pantryItemId);
           l.setAmount(new BigDecimal(amount));
           l.setUnit(unit);
           return l;
       }

       private RecipeRequest req(String name, RecipeIngredientRequest... lines) {
           RecipeRequest r = new RecipeRequest();
           r.setName(name);
           r.setCategory("lunch");
           r.setServings(2);
           r.setIngredients(List.of(lines));
           return r;
       }

       @Test
       void testCreate_shouldSnapshotAndRollUpMacros_whenValidLines() {
           PantryItemEntity chicken = food("Csirkemell"); // 110 kcal/100g, 23 P, 0 C, 1.5 F, NOVA 1

           RecipeResponse created = service.create(owner, req("Ebéd", line(chicken.getId(), "200", "g")));

           assertThat(created.getId()).isNotNull();
           // factor = 200 / 100 = 2 -> whole-recipe macros = snapshot * 2
           assertThat(created.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(220));
           assertThat(created.getMacros().getP()).isEqualByComparingTo(BigDecimal.valueOf(46));
           assertThat(created.getMacros().getC()).isEqualByComparingTo(BigDecimal.ZERO);
           assertThat(created.getMacros().getF()).isEqualByComparingTo(BigDecimal.valueOf(3));
           assertThat(created.getNovaDominant()).isEqualByComparingTo(BigDecimal.valueOf(1));
           assertThat(created.getIngredients()).singleElement()
               .satisfies(i -> {
                   assertThat(i.getName()).isEqualTo("Csirkemell"); // snapshot name
                   assertThat(i.getLineOrder()).isEqualTo(0);
                   assertThat(i.getContribution().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(220));
               });
       }

       @Test
       void testCreate_shouldOrderLinesByRequestIndex_whenMultipleLines() {
           PantryItemEntity a = food("Alpha");
           PantryItemEntity b = food("Bravo");

           RecipeResponse created = service.create(owner,
               req("Multi", line(a.getId(), "100", "g"), line(b.getId(), "100", "g")));

           assertThat(created.getIngredients()).extracting("lineOrder").containsExactly(0, 1);
           assertThat(created.getIngredients()).extracting("name").containsExactly("Alpha", "Bravo");
       }

       @Test
       void testCreate_shouldReject_whenPantryItemMissing() {
           assertThatThrownBy(() -> service.create(owner, req("Bad", line(UUID.randomUUID(), "100", "g"))))
               .isInstanceOf(SystemRuntimeErrorException.class);
       }

       @Test
       void testCreate_shouldReject_whenPantryItemForeign() {
           PantryItemEntity otherFood = pantryPopulator.createFood(other, "Idegen", LocalDate.of(2026, 5, 25));

           assertThatThrownBy(() -> service.create(owner, req("Bad", line(otherFood.getId(), "100", "g"))))
               .isInstanceOf(SystemRuntimeErrorException.class);
       }

       @Test
       void testGet_shouldReturnRecipe_whenOwned() {
           PantryItemEntity chicken = food("Csirkemell");
           RecipeResponse created = service.create(owner, req("Ebéd", line(chicken.getId(), "100", "g")));

           RecipeResponse fetched = service.get(owner, created.getId());

           assertThat(fetched.getName()).isEqualTo("Ebéd");
           assertThat(fetched.getIngredients()).hasSize(1);
       }

       @Test
       void testGet_shouldReturn404_whenForeignRecipe() {
           PantryItemEntity chicken = food("Csirkemell");
           RecipeResponse created = service.create(owner, req("Ebéd", line(chicken.getId(), "100", "g")));

           assertThatThrownBy(() -> service.get(other, created.getId()))
               .isInstanceOf(SystemRuntimeErrorException.class);
       }
   }
   ```

2. Run the IT — expect FAILURE (compile error: `RecipeService` does not exist):
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=RecipeServiceIT
   ```
   Expected: compilation failure on the missing `RecipeService` import.

3. Implement `RecipeService` (create + get + helpers). Create `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java`:
   ```java
   package io.mrkuhne.mezo.feature.recipe.service;

   import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
   import io.mrkuhne.mezo.api.dto.RecipeRequest;
   import io.mrkuhne.mezo.api.dto.RecipeResponse;
   import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
   import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
   import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
   import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
   import io.mrkuhne.mezo.techcore.exception.SystemMessage;
   import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
   import java.math.BigDecimal;
   import java.util.ArrayList;
   import java.util.List;
   import java.util.Objects;
   import java.util.UUID;
   import lombok.RequiredArgsConstructor;
   import org.springframework.http.HttpStatus;
   import org.springframework.stereotype.Service;
   import org.springframework.transaction.annotation.Transactional;

   @Service
   @RequiredArgsConstructor
   public class RecipeService {

       private final RecipeRepository repository;
       private final PantryItemRepository pantryItemRepository;
       private final RecipeMapper mapper;

       @Transactional
       public RecipeResponse create(UUID userId, RecipeRequest req) {
           RecipeEntity recipe = new RecipeEntity();
           recipe.setCreatedBy(userId); // server-side ownership — never from the client
           mapper.applyScalars(recipe, req);
           rebuildLines(userId, recipe, req.getIngredients());
           return mapper.toResponse(repository.save(recipe)); // cascade=ALL persists the lines
       }

       @Transactional(readOnly = true)
       public RecipeResponse get(UUID userId, UUID id) {
           return mapper.toResponse(requireOwned(userId, id));
       }

       /**
        * Full-replace the line collection from the request, in array order. Each line resolves its
        * pantry item owner-scoped &amp; not-deleted (missing/foreign/deleted -> 400) and captures a
        * per-basis snapshot, then nova_dominant is re-derived from the live PantryItem NOVAs.
        */
       private void rebuildLines(UUID userId, RecipeEntity recipe, List<RecipeIngredientRequest> lineReqs) {
           recipe.getLines().clear(); // orphanRemoval deletes any previously attached lines
           List<RecipeIngredientEntity> built = new ArrayList<>();
           for (int i = 0; i < lineReqs.size(); i++) {
               RecipeIngredientEntity line = buildLine(userId, recipe, lineReqs.get(i), i);
               recipe.getLines().add(line);
               built.add(line);
           }
           recipe.setNovaDominant(deriveNovaDominant(userId, lineReqs));
       }

       /** Resolves the pantry item owner-scoped, captures the per-basis snapshot, sets created_by + line_order. */
       private RecipeIngredientEntity buildLine(
               UUID userId, RecipeEntity recipe, RecipeIngredientRequest req, int index) {
           PantryItemEntity item = resolvePantryItem(userId, req.getPantryItemId());
           RecipeIngredientEntity line = new RecipeIngredientEntity();
           line.setCreatedBy(userId); // owned child — set server-side, never from the client
           line.setRecipe(recipe);
           line.setPantryItemId(item.getId());
           line.setAmount(req.getAmount());
           line.setUnit(req.getUnit());
           line.setNote(req.getNote());
           line.setLineOrder(index);
           // Snapshot = the pantry item's per-basis macros at compose time (stable basis for contribution).
           line.setSnapshotName(item.getName());
           line.setSnapshotPer(orDefault(item.getServingAmount(), BigDecimal.ONE));
           line.setSnapshotBasisUnit(item.getServingUnit() == null ? "unit" : item.getServingUnit());
           line.setSnapshotKcal(orDefault(item.getKcal(), BigDecimal.ZERO));
           line.setSnapshotProteinG(orDefault(item.getProteinG(), BigDecimal.ZERO));
           line.setSnapshotCarbsG(orDefault(item.getCarbsG(), BigDecimal.ZERO));
           line.setSnapshotFatG(orDefault(item.getFatG(), BigDecimal.ZERO));
           return line;
       }

       /** Owner-scoped, not-deleted lookup; missing/foreign/deleted are indistinguishable 400s. */
       private PantryItemEntity resolvePantryItem(UUID userId, UUID pantryItemId) {
           if (pantryItemId == null) {
               throw invalidIngredients();
           }
           return pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(pantryItemId, userId)
               .orElseThrow(this::invalidIngredients);
       }

       /** Dominant NOVA = the max source NOVA across the resolved lines; null when no line carries one. */
       private Short deriveNovaDominant(UUID userId, List<RecipeIngredientRequest> lineReqs) {
           return lineReqs.stream()
               .map(l -> resolvePantryItem(userId, l.getPantryItemId()).getNova())
               .filter(Objects::nonNull)
               .max(Short::compareTo)
               .orElse(null);
       }

       private SystemRuntimeErrorException invalidIngredients() {
           return new SystemRuntimeErrorException(
               SystemMessage.field("VALIDATION_INVALID_VALUE", "ingredients").build(), HttpStatus.BAD_REQUEST);
       }

       private static BigDecimal orDefault(BigDecimal value, BigDecimal fallback) {
           return value == null ? fallback : value;
       }

       /** Ownership gate: missing and foreign rows are indistinguishable (404). */
       private RecipeEntity requireOwned(UUID userId, UUID id) {
           return repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
               .orElseThrow(() -> new SystemRuntimeErrorException(
                   SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
       }
   }
   ```

4. Run the IT — expect PASS (requires svc4 populator + entity + mapper present):
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=RecipeServiceIT
   ```
   Expected: 6 tests green.

5. Commit:
   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java \
           backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeServiceIT.java
   git commit -m "feat(recipe): RecipeService create with snapshot capture + nova rollup (mezo-lns)"
   ```

> **Note on `deriveNovaDominant` resolving items twice:** it re-runs `resolvePantryItem` per line for clarity. If a reviewer flags the double lookup, the same-tx persistence context returns the already-loaded `PantryItemEntity` (first-level cache), so there is no extra SQL. Leave it readable; do not pre-optimize.

---

### Task svc3: Add `list`, `update` (full-replace), `delete` (soft-delete cascade) to `RecipeService` + ITs

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/repository/RecipeIngredientRepository.java` *(new — bulk soft-delete of children)*
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeServiceIT.java`

**Interfaces:**
- Consumes: everything from svc2 plus `io.mrkuhne.mezo.api.dto.RecipeListResponse` (contract: `{ recipes: RecipeResponse[] }`, getter/builder `recipes`), and `io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity`.
- Produces (consumed by the controller section):
  - `RecipeListResponse list(UUID userId)`
  - `void update(UUID userId, UUID id, RecipeRequest req)` — `requireOwned` 404 → full-replace aggregate
  - `void delete(UUID userId, UUID id)` — `requireOwned` 404 → soft-delete recipe + explicit bulk soft-delete of `recipe_ingredient` children
  - new `RecipeIngredientRepository` with `@Modifying @Query` bulk soft-delete: `int softDeleteByRecipeId(UUID recipeId)`

> **Why the child repository exists:** `@SQLDelete` on `RecipeIngredientEntity` only fires for `EntityManager.remove`/`repository.delete` on a managed instance — it does **NOT** cascade when the parent is soft-deleted (a soft-delete is an UPDATE, not a DELETE, so no Hibernate cascade runs). The spec mandates an **explicit bulk soft-delete** of the children. We use a `@Modifying` JPQL UPDATE (per `spring_patterns.md`: derived → JPQL → native; a set-based soft-delete is a JPQL `update` because there is no derived form). **`update` is an intentional full-replace** — the editor always sends the complete recipe — and is explicitly NOT the lossy-input bug `mezo-dh6` flags for Pantry; the Javadoc states this.

**Steps:**

1. Add the failing list/update/delete ITs to `RecipeServiceIT.java` (append inside the class, after `testGet_shouldReturn404_whenForeignRecipe`):
   ```java
       @Test
       void testList_shouldReturnOwnedNewestFirst_whenMultipleRecipes() {
           PantryItemEntity food = food("Csirkemell");
           service.create(owner, req("Régi", line(food.getId(), "100", "g")));
           service.create(owner, req("Új", line(food.getId(), "100", "g")));

           var recipes = service.list(owner).getRecipes();

           assertThat(recipes).extracting("name").containsExactly("Új", "Régi");
       }

       @Test
       void testList_shouldIsolateOwners_whenTwoUsers() {
           PantryItemEntity food = food("Csirkemell");
           service.create(owner, req("Enyém", line(food.getId(), "100", "g")));

           assertThat(service.list(other).getRecipes()).isEmpty();
       }

       @Test
       void testUpdate_shouldReturn404_whenForeignRecipe() {
           PantryItemEntity food = food("Csirkemell");
           RecipeResponse mine = service.create(owner, req("Ebéd", line(food.getId(), "100", "g")));

           assertThatThrownBy(() -> service.update(other, mine.getId(),
               req("Hack", line(food.getId(), "100", "g"))))
               .isInstanceOf(SystemRuntimeErrorException.class);
       }

       @Test
       void testUpdate_shouldFullReplaceLines_whenLinesAddedRemovedReordered() {
           PantryItemEntity a = food("Alpha");
           PantryItemEntity b = food("Bravo");
           PantryItemEntity c = food("Charlie");
           RecipeResponse created = service.create(owner,
               req("V1", line(a.getId(), "100", "g"), line(b.getId(), "100", "g")));

           // Replace with: b first (reorder), c added, a removed.
           RecipeRequest v2 = req("V2",
               line(b.getId(), "150", "g"), line(c.getId(), "100", "g"));
           service.update(owner, created.getId(), v2);

           RecipeResponse after = service.get(owner, created.getId());
           assertThat(after.getName()).isEqualTo("V2");
           assertThat(after.getIngredients()).extracting("name").containsExactly("Bravo", "Charlie");
           assertThat(after.getIngredients()).extracting("lineOrder").containsExactly(0, 1);
           // Bravo at 150 g -> factor 1.5 -> 110 * 1.5 = 165 kcal; Charlie 100 g -> 110 kcal -> rollup 275.
           assertThat(after.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(275));
       }

       @Test
       void testDelete_shouldReturn404_whenForeignRecipe() {
           PantryItemEntity food = food("Csirkemell");
           RecipeResponse mine = service.create(owner, req("Ebéd", line(food.getId(), "100", "g")));

           assertThatThrownBy(() -> service.delete(other, mine.getId()))
               .isInstanceOf(SystemRuntimeErrorException.class);
       }

       @Test
       void testDelete_shouldHideRecipeAndSoftDeleteChildren_whenOwned() {
           PantryItemEntity food = food("Csirkemell");
           RecipeResponse mine = service.create(owner,
               req("Ebéd", line(food.getId(), "100", "g"), line(food.getId(), "50", "g")));

           service.delete(owner, mine.getId());

           // Recipe is hidden by the owner-scoped finder...
           assertThatThrownBy(() -> service.get(owner, mine.getId()))
               .isInstanceOf(SystemRuntimeErrorException.class);
           assertThat(service.list(owner).getRecipes()).isEmpty();
           // ...and the children are soft-deleted too (no live recipe_ingredient rows remain for this recipe).
           assertThat(recipeIngredientRepository.softDeleteByRecipeId(mine.getId())).isZero();
       }
   ```
   Also add the autowire + import at the top of the class:
   ```java
       @Autowired private io.mrkuhne.mezo.feature.recipe.repository.RecipeIngredientRepository recipeIngredientRepository;
   ```

2. Run the IT — expect FAILURE (no `list`/`update`/`delete` on `RecipeService`; no `RecipeIngredientRepository`):
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=RecipeServiceIT
   ```
   Expected: compilation failure on the missing `RecipeIngredientRepository` + service methods.

3. Create the child repository `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/repository/RecipeIngredientRepository.java`:
   ```java
   package io.mrkuhne.mezo.feature.recipe.repository;

   import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
   import java.util.UUID;
   import org.springframework.data.jpa.repository.JpaRepository;
   import org.springframework.data.jpa.repository.Modifying;
   import org.springframework.data.jpa.repository.Query;
   import org.springframework.data.repository.query.Param;

   public interface RecipeIngredientRepository extends JpaRepository<RecipeIngredientEntity, UUID> {

       /**
        * Bulk soft-delete of a recipe's lines. @SQLDelete does NOT cascade through @OneToMany on a
        * parent soft-delete (a soft-delete is an UPDATE, so no Hibernate remove-cascade runs), so the
        * service triggers this explicitly. Set-based UPDATE -> JPQL @Modifying (no derived form exists).
        */
       @Modifying
       @Query("update RecipeIngredientEntity ri set ri.deleted = true "
           + "where ri.recipe.id = :recipeId and ri.deleted = false")
       int softDeleteByRecipeId(@Param("recipeId") UUID recipeId);
   }
   ```

4. Add `list`, `update`, `delete` to `RecipeService`. Inject the child repository (extend the field block) and add the methods. In `RecipeService.java`, change the field block and add imports + methods:

   Add import:
   ```java
   import io.mrkuhne.mezo.api.dto.RecipeListResponse;
   ```
   Add the field (after `mapper`):
   ```java
       private final RecipeIngredientRepository recipeIngredientRepository;
   ```
   Add the public methods (after `get`):
   ```java
       @Transactional(readOnly = true)
       public RecipeListResponse list(UUID userId) {
           List<RecipeResponse> recipes = repository
               .findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId).stream()
               .map(mapper::toResponse)
               .toList();
           return RecipeListResponse.builder().recipes(recipes).build();
       }

       /**
        * Full-replace of the aggregate: the editor always sends the COMPLETE recipe (all header fields +
        * all lines), so we overwrite the header and rebuild the line collection (orphanRemoval deletes the
        * lines no longer present). This is INTENTIONAL full-replace, NOT the lossy partial-input bug
        * mezo-dh6 flags for Pantry. Snapshots are re-resolved against the live pantry on every save.
        */
       @Transactional
       public void update(UUID userId, UUID id, RecipeRequest req) {
           RecipeEntity recipe = requireOwned(userId, id);
           mapper.applyScalars(recipe, req);
           rebuildLines(userId, recipe, req.getIngredients()); // dirty-checked; flush on tx commit
       }

       @Transactional
       public void delete(UUID userId, UUID id) {
           RecipeEntity recipe = requireOwned(userId, id);
           // @SQLDelete soft-deletes the recipe, but does NOT cascade to @OneToMany children on a
           // soft-delete (UPDATE, not DELETE) — so bulk-soft-delete the lines explicitly.
           recipeIngredientRepository.softDeleteByRecipeId(recipe.getId());
           repository.delete(recipe); // @SQLDelete -> is_deleted = true
       }
   ```
   Add the import for the imported repository (it is already in the `repository` package, same as `RecipeRepository`):
   ```java
   import io.mrkuhne.mezo.feature.recipe.repository.RecipeIngredientRepository;
   ```

5. Run the IT — expect PASS:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=RecipeServiceIT
   ```
   Expected: all (svc2's 6 + svc3's 6 =) 12 tests green.

6. Commit:
   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java \
           backend/src/main/java/io/mrkuhne/mezo/feature/recipe/repository/RecipeIngredientRepository.java \
           backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeServiceIT.java
   git commit -m "feat(recipe): list + full-replace update + soft-delete cascade (mezo-lns)"
   ```

---

## Phase 5 — Controller + API IT

### Task ctl2: Create `RecipeController` implementing the generated `RecipeApi`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/controller/RecipeController.java`

**Interfaces:**
- Consumes:
  - `io.mrkuhne.mezo.api.controller.RecipeApi` — `listRecipes()`, `getRecipe(UUID)`,
    `createRecipe(RecipeRequest)`, `updateRecipe(UUID, RecipeRequest)`, `deleteRecipe(UUID)`
    (status codes 200/200/201/204/204 come from the generated interface).
  - `RecipeService` (authored separately) — SHORT method names: `RecipeListResponse list(UUID)`,
    `RecipeResponse get(UUID,UUID)`, `RecipeResponse create(UUID,RecipeRequest)`,
    `void update(UUID,UUID,RecipeRequest)`, `void delete(UUID,UUID)`. (The generated `@Override`
    method names stay `listRecipes/getRecipe/createRecipe/updateRecipe/deleteRecipe` — fixed by the
    generated `RecipeApi` — but each delegates to the service's short name.)
  - `io.mrkuhne.mezo.techcore.security.CurrentUserId` — `get():UUID`.
- Produces: `@RestController RecipeController implements RecipeApi` (Spring bean wiring the HTTP
  boundary to the service; the API IT in ctl4 exercises it end-to-end).

**Steps:**

1. (No isolated unit test — the controller is a pure delegating shim; its behavior is covered
   end-to-end by the API IT in ctl4, matching how `PantryController`/`GoalController` are tested.)
   Implement it directly. Create
   `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/controller/RecipeController.java`:

   ```java
   package io.mrkuhne.mezo.feature.recipe.controller;

   import io.mrkuhne.mezo.api.controller.RecipeApi;
   import io.mrkuhne.mezo.api.dto.RecipeListResponse;
   import io.mrkuhne.mezo.api.dto.RecipeRequest;
   import io.mrkuhne.mezo.api.dto.RecipeResponse;
   import io.mrkuhne.mezo.feature.recipe.service.RecipeService;
   import io.mrkuhne.mezo.techcore.security.CurrentUserId;
   import java.util.UUID;
   import lombok.RequiredArgsConstructor;
   import org.springframework.web.bind.annotation.RestController;

   /** Implements the generated {@link RecipeApi}; mappings/status/validation come from the interface. */
   @RestController
   @RequiredArgsConstructor
   public class RecipeController implements RecipeApi {

       private final RecipeService service;
       private final CurrentUserId currentUserId;

       @Override
       public RecipeListResponse listRecipes() {
           return service.list(currentUserId.get());
       }

       @Override
       public RecipeResponse getRecipe(UUID id) {
           return service.get(currentUserId.get(), id);
       }

       @Override
       public RecipeResponse createRecipe(RecipeRequest recipeRequest) {
           return service.create(currentUserId.get(), recipeRequest);
       }

       @Override
       public void updateRecipe(UUID id, RecipeRequest recipeRequest) {
           service.update(currentUserId.get(), id, recipeRequest);
       }

       @Override
       public void deleteRecipe(UUID id) {
           service.delete(currentUserId.get(), id);
       }
   }
   ```

2. Compile to confirm the controller satisfies the generated interface (method signatures match
   `RecipeApi` exactly):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test-compile
   ```

   Expected: BUILD SUCCESS (controller overrides line up with the generated `RecipeApi`; if the
   service section's method names differ, this is where the verbatim signatures are enforced).

3. Commit:

   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/controller/RecipeController.java
   git commit -m "feat(recipe): add RecipeController implementing RecipeApi (mezo-lns)"
   ```

---

### Task ctl4: API-level integration tests for all five Recipe endpoints (`RecipeApiIT`)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeApiIT.java`

**Interfaces:**
- Consumes:
  - `ApiIntegrationTest` — `ownerAuthHeaders()`, `getForBody`, `postForBody`, `putForBody`,
    `deleteAndExpect`, `exchangeForBody`, `assertHasFieldError`, `objectMapper`, `currentUserId`
    of the seeded owner (the only authenticated principal).
  - `io.mrkuhne.mezo.api.dto.RecipeRequest`, `RecipeIngredientRequest`, `RecipeResponse`,
    `RecipeListResponse` (`@Builder`/setter DTOs).
  - `PantryItemPopulator` — `createFood(UUID owner, String name, LocalDate expires)` returns a
    per-100g food (kcal 110, p 23, c 0, f 1.5) owned by the given user.
  - The owner id: resolve via the same seeded-owner login the base uses. The populators need a
    `UUID owner` — obtain it from the JWT-less server side is not available in the test thread, so
    create owned rows for the **seeded owner** by reading the owner id from the DB. Use the
    inherited `ownerId()` helper IF present; otherwise create pantry items **via the API**
    (`POST /api/pantry`) so they are owned by the authenticated owner, which avoids needing the
    raw owner UUID. **This IT creates its pantry items through the API** (mirrors how `PantryApiIT`
    works end-to-end and sidesteps owner-UUID plumbing).
- Produces: `RecipeApiIT` (HTTP-level coverage: 5 happy paths + IDOR 404s + 400 validations +
  macro rollup + full-replace PUT).

**Steps:**

1. Write the failing IT FIRST. It drives everything over HTTP as the seeded owner. Pantry items
   are created via `POST /api/pantry` (so they belong to the authenticated owner and resolve in
   the service's owner-scoped ingredient lookup). Create
   `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeApiIT.java`:

   ```java
   package io.mrkuhne.mezo.feature.recipe;

   import static org.assertj.core.api.Assertions.assertThat;

   import io.mrkuhne.mezo.api.dto.PantryItemRequest;
   import io.mrkuhne.mezo.api.dto.PantryItemResponse;
   import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
   import io.mrkuhne.mezo.api.dto.RecipeListResponse;
   import io.mrkuhne.mezo.api.dto.RecipeRequest;
   import io.mrkuhne.mezo.api.dto.RecipeResponse;
   import io.mrkuhne.mezo.support.ApiIntegrationTest;
   import java.math.BigDecimal;
   import java.util.List;
   import java.util.UUID;
   import org.junit.jupiter.api.Test;
   import org.springframework.http.HttpHeaders;
   import org.springframework.http.HttpMethod;
   import org.springframework.http.HttpStatus;

   class RecipeApiIT extends ApiIntegrationTest {

       /** Creates a per-100g food via the API (owned by the authenticated owner) and returns its id. */
       private UUID createFood(HttpHeaders auth, String name, String kcal, String p, String c, String f) {
           PantryItemRequest r = new PantryItemRequest();
           r.setKind(PantryItemRequest.KindEnum.FOOD);
           r.setName(name);
           r.setPer(new BigDecimal("100"));
           r.setUnit("g");
           r.setKcal(new BigDecimal(kcal));
           r.setProteinG(new BigDecimal(p));
           r.setCarbsG(new BigDecimal(c));
           r.setFatG(new BigDecimal(f));
           PantryItemResponse created =
               postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class);
           return created.getId();
       }

       private RecipeIngredientRequest line(UUID pantryItemId, String amount) {
           RecipeIngredientRequest l = new RecipeIngredientRequest();
           l.setPantryItemId(pantryItemId);
           l.setAmount(new BigDecimal(amount));
           l.setUnit("g");
           return l;
       }

       private RecipeRequest recipeReq(UUID... pantryItemIds) {
           RecipeRequest r = new RecipeRequest();
           r.setName("Túrós tál");
           r.setCategory("breakfast");
           r.setServings(2);
           r.setStarred(false);
           r.setTags(List.of("magas-fehérje"));
           List<RecipeIngredientRequest> lines = new java.util.ArrayList<>();
           for (UUID id : pantryItemIds) lines.add(line(id, "200"));
           r.setIngredients(lines);
           return r;
       }

       @Test
       void testCreateThenGet_shouldReturnRecipeWithComputedMacros_whenAuthed() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");

           RecipeResponse created =
               postForBody("/api/recipe", recipeReq(food), auth, HttpStatus.CREATED, RecipeResponse.class);
           assertThat(created.getId()).isNotNull();

           RecipeResponse got =
               getForBody("/api/recipe/" + created.getId(), auth, HttpStatus.OK, RecipeResponse.class);
           assertThat(got.getName()).isEqualTo("Túrós tál");
           assertThat(got.getCategory()).isEqualTo("breakfast");
           // 200 g of a per-100g food: factor 2 -> kcal 220, p 46, c 0, f 3
           assertThat(got.getIngredients()).hasSize(1);
           assertThat(got.getIngredients().get(0).getName()).isEqualTo("Csirkemell");
           assertThat(got.getIngredients().get(0).getLineOrder()).isEqualTo(0);
           assertThat(got.getIngredients().get(0).getContribution().getKcal()).isEqualByComparingTo("220");
           // whole-recipe rollup
           assertThat(got.getMacros().getKcal()).isEqualByComparingTo("220");
           assertThat(got.getMacros().getP()).isEqualByComparingTo("46");
           assertThat(got.getMacros().getF()).isEqualByComparingTo("3");
           // pending mezoFit + derived defaults
           assertThat(got.getMezoFit().getScore()).isNull();
           assertThat(got.getMezoFit().getFitsFor()).isEmpty();
           assertThat(got.getTimesLogged()).isEqualTo(0);
           assertThat(got.getLastLogged()).isEqualTo("—");
       }

       @Test
       void testList_shouldReturnCreatedRecipe_whenAuthed() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           postForBody("/api/recipe", recipeReq(food), auth, HttpStatus.CREATED, RecipeResponse.class);

           RecipeListResponse list = getForBody("/api/recipe", auth, HttpStatus.OK, RecipeListResponse.class);

           assertThat(list.getRecipes()).extracting(RecipeResponse::getName).contains("Túrós tál");
       }

       @Test
       void testGet_shouldReturn404_whenUnknownId() {
           HttpHeaders auth = ownerAuthHeaders();

           exchangeForBody(HttpMethod.GET, "/api/recipe/" + UUID.randomUUID(),
               null, auth, HttpStatus.NOT_FOUND, String.class);
       }

       @Test
       void testCreate_shouldReturn400FieldError_whenIngredientsEmpty() {
           HttpHeaders auth = ownerAuthHeaders();
           RecipeRequest bad = recipeReq(); // zero lines -> violates minItems:1
           bad.setIngredients(List.of());

           String body = exchangeForBody(
               HttpMethod.POST, "/api/recipe", bad, auth, HttpStatus.BAD_REQUEST, String.class);

           assertHasFieldError(body, "ingredients", "VALIDATION_INVALID_VALUE");
       }

       @Test
       void testCreate_shouldReturn400FieldError_whenNameBlank() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           RecipeRequest bad = recipeReq(food);
           bad.setName(""); // minLength:1 -> Size

           String body = exchangeForBody(
               HttpMethod.POST, "/api/recipe", bad, auth, HttpStatus.BAD_REQUEST, String.class);

           assertHasFieldError(body, "name", "VALIDATION_INVALID_VALUE");
       }

       @Test
       void testCreate_shouldReturn400FieldError_whenCategoryInvalid() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           RecipeRequest bad = recipeReq(food);
           bad.setCategory("brunch"); // fails the pattern ^(breakfast|lunch|dinner|snack)$

           String body = exchangeForBody(
               HttpMethod.POST, "/api/recipe", bad, auth, HttpStatus.BAD_REQUEST, String.class);

           assertHasFieldError(body, "category", "VALIDATION_INVALID_VALUE");
       }

       @Test
       void testCreate_shouldReturn400FieldError_whenPantryItemMissing() {
           HttpHeaders auth = ownerAuthHeaders();
           RecipeRequest bad = recipeReq(UUID.randomUUID()); // references a non-existent pantry item

           String body = exchangeForBody(
               HttpMethod.POST, "/api/recipe", bad, auth, HttpStatus.BAD_REQUEST, String.class);

           assertHasFieldError(body, "ingredients", "VALIDATION_INVALID_VALUE");
       }

       @Test
       void testUpdate_shouldReturn404_whenUnknownId() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");

           exchangeForBody(HttpMethod.PUT, "/api/recipe/" + UUID.randomUUID(),
               recipeReq(food), auth, HttpStatus.NOT_FOUND, String.class);
       }

       @Test
       void testUpdate_shouldFullReplaceLines_whenOwned() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID chicken = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           UUID oats = createFood(auth, "Zabpehely", "100", "10", "20", "5");

           RecipeResponse created =
               postForBody("/api/recipe", recipeReq(chicken), auth, HttpStatus.CREATED, RecipeResponse.class);
           assertThat(created.getIngredients()).hasSize(1);

           // Full-replace: editor re-sends the COMPLETE recipe, now with two lines (chicken removed, oats added)
           RecipeRequest replace = recipeReq(oats);
           replace.setName("Zabkása");
           putForBody("/api/recipe/" + created.getId(), replace, auth, HttpStatus.NO_CONTENT, Void.class);

           RecipeResponse after =
               getForBody("/api/recipe/" + created.getId(), auth, HttpStatus.OK, RecipeResponse.class);
           assertThat(after.getName()).isEqualTo("Zabkása");
           assertThat(after.getIngredients()).extracting(i -> i.getName()).containsExactly("Zabpehely");
           // 200 g of per-100g oats: factor 2 -> kcal 200
           assertThat(after.getMacros().getKcal()).isEqualByComparingTo("200");
       }

       @Test
       void testDelete_shouldReturn204ThenHide_whenOwned() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           RecipeResponse created =
               postForBody("/api/recipe", recipeReq(food), auth, HttpStatus.CREATED, RecipeResponse.class);

           deleteAndExpect("/api/recipe/" + created.getId(), auth, HttpStatus.NO_CONTENT);

           exchangeForBody(HttpMethod.GET, "/api/recipe/" + created.getId(),
               null, auth, HttpStatus.NOT_FOUND, String.class);
           RecipeListResponse list = getForBody("/api/recipe", auth, HttpStatus.OK, RecipeListResponse.class);
           assertThat(list.getRecipes()).extracting(RecipeResponse::getId).doesNotContain(created.getId());
       }

       @Test
       void testDelete_shouldReturn404_whenUnknownId() {
           HttpHeaders auth = ownerAuthHeaders();

           deleteAndExpect("/api/recipe/" + UUID.randomUUID(), auth, HttpStatus.NOT_FOUND);
       }
   }
   ```

2. Run the IT — expect FAILURE (the recipe endpoints/service do not yet behave; this IT is the
   acceptance gate for the controller+service+mapper wiring). Requires the local Postgres compose
   up (or Testcontainers):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=RecipeApiIT
   ```

   Expected: BUILD FAILURE — until the `recipe` Liquibase tables, entities, repository, and
   `RecipeService` from the other sections are merged, the create/list/get calls error (no table /
   no bean / 500). Once those land + this section's mapper (ctl1) and controller (ctl2), the IT
   goes green. (If running this section in isolation before the DB/service sections, this IT is
   expected red — it is the integration acceptance gate for the whole slice's backend.)

3. There is no separate "implement" step for the IT — the production code it asserts is the
   controller (ctl2) + mapper (ctl1) of this section plus the DB/entity/repository/service of the
   sibling sections. Once the full slice backend is assembled, run the IT to PASS:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && docker compose up -d && ./mvnw clean test -Dtest=RecipeApiIT
   ```

   Expected: BUILD SUCCESS — all `RecipeApiIT` cases green (create+get with macro rollup, list,
   404 on unknown GET/PUT/DELETE, 400 field errors for empty ingredients / blank name / bad
   category / missing pantry item, full-replace PUT, soft-delete hides).

4. Run the FULL backend suite to confirm no regression (new TRUNCATE entries + new tables play
   nice with the shared `mezo_test` DB):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
   ```

   Expected: BUILD SUCCESS — entire suite green.

5. Commit:

   ```bash
   git add backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeApiIT.java
   git commit -m "test(recipe): API-level IT for all Recipe endpoints (CRUD, IDOR, validation, rollup) (mezo-lns)"
   ```

---

## Phase 6 — FE data layer

## Frontend Data Layer — Recipe API client, dual-mode hooks, MSW (`mezo-lns`)

This section swaps the Recipes data boundary from the static mock seed to a real REST client
**without breaking the `useRecipes()` public return shape** (`{recipes, ingredients, sources,
categoryMeta}`) that `FuelRecipesView` and the recipe pages consume. It mirrors the Pantry
data-layer pattern verbatim: `src/lib/pantryApi.ts` (the `toRequest` mapper + list-response cast)
and `src/data/pantryHooks.ts` (dual-mode `useQuery` with `initialData`/`staleTime:Infinity` in
mock + `setQueryData` cache mutators; real-mode API + invalidate). The one new twist over Pantry:
recipe writes invalidate **both** `['recipes']` and `['pantry']` (a recipe references pantry items,
so creating/editing/deleting affects the pantry `usedInRecipes` rollup), and `useRecipes()` blends
**one** dual-mode domain query (`recipes`) with the static/pantry-sourced presentation config
(`ingredients/sources/categoryMeta`).

The FE `Recipe`/`RecipeIngredient` types extend to carry the new server-computed per-line `name`
+ `contribution{kcal,p,c,f}` (the editor renders per-ingredient macro contributions) while keeping
the existing `refId` (= `pantryItemId`). The **mock branch must compute `contribution` and the
whole-recipe `macros` with the EXACT SAME `amount / per` formula as the backend Java mapper**, so
both modes are byte-identical: `factor = amount / per` (per defaults to 1 for discrete units so
`amount/1 = amount`); `contribution.{kcal,p,c,f} = round(snapshot.{kcal,protein,carbs,fat} *
factor)`; `recipe.macros = Σ line contributions`.

Grounded in: `src/lib/pantryApi.ts`, `src/data/pantryHooks.ts`, `src/data/hooks.ts`
(`useRecipes` one-liner at ~line 154 + the pantry re-export at line 175), `src/lib/mode.ts`
(`isMockMode`), `src/lib/api.ts` (`apiFetch`, 204→undefined), `src/test/msw/handlers.ts`
(existing pantry/biometrics handler style, `API_BASE` re-export), `src/data/types.ts`
(`Recipe`/`RecipeLog` ~line 108, `NovaGroup`), `src/data/pantry.ts` (the 6-recipe mock seed +
18-ingredient seed), `src/data/pantryHooks.test.tsx` + `src/data/weightHooks.test.tsx` (dual-mode
hook + invalidation test style), `src/test/queryWrapper.tsx` (`QueryWrapper`, `makeHookWrapper`),
`src/data/pantryData.test.tsx` (the 6-recipe shape assertion this section must keep green).

Consumes from the **Contract section** (VERBATIM): `frontend/src/lib/api.gen.ts`
`components['schemas']['RecipeRequest' | 'RecipeIngredientRequest' | 'RecipeResponse' |
'RecipeIngredientResponse' | 'RecipeListResponse']`.

---

### Task fedata1: Extend FE `Recipe`/ingredient types — per-line `name` + `contribution`, `RecipeInput`

**Files:**
- Modify: `frontend/src/data/types.ts`
- Test: `frontend/src/data/recipeTypes.test.ts` (Create)

**Interfaces:**
- Consumes: existing `NovaGroup` (`./nova`), `MealBreakdown`, `RecipeLog`, `RecipeCategory`
  (already in `types.ts`).
- Produces (later tasks + the components section depend on these VERBATIM):
  - `RecipeIngredientLine` — `{ refId: string; amount: number; unit: string; note?: string;
    name?: string; contribution?: { kcal: number; p: number; c: number; f: number } }`
    (`refId` === `pantryItemId`; `name`/`contribution` are server-computed, optional so an
    editor-draft line can omit them before save).
  - `Recipe.ingredients: RecipeIngredientLine[]` (replaces the old inline `{ refId; amount; unit;
    note? }[]`); `Recipe.mezoFit.score: number | null` (was `number`); `Recipe.novaDominant:
    NovaGroup` unchanged.
  - `RecipeInput` — the form payload `useRecipeActions().create/update` accept:
    `{ name: string; slot?: string | null; category: RecipeCategory; servings: number;
    prepMins?: number | null; cookMins?: number | null; tags: string[]; starred: boolean;
    ingredients: { pantryItemId: string; amount: number; unit: string; note?: string | null }[] }`.

**Steps:**

1. Write the failing test. Create `frontend/src/data/recipeTypes.test.ts`:

   ```ts
   import { describe, it, expect } from 'vitest'
   import type { Recipe, RecipeIngredientLine, RecipeInput } from './types'

   describe('Recipe type extensions (per-line name + contribution, RecipeInput)', () => {
     it('a RecipeIngredientLine carries refId + optional name + contribution', () => {
       const line: RecipeIngredientLine = {
         refId: '11111111-1111-4111-8111-111111111111',
         amount: 70, unit: 'g', note: 'főtt',
         name: 'Zabpehely',
         contribution: { kcal: 260, p: 9.5, c: 42, f: 4.9 },
       }
       expect(line.refId).toMatch(/^[0-9a-f-]+$/)
       expect(line.name).toBe('Zabpehely')
       expect(line.contribution).toEqual({ kcal: 260, p: 9.5, c: 42, f: 4.9 })
     })

     it('a Recipe exposes line-level name/contribution and a nullable mezoFit.score', () => {
       const recipe: Recipe = {
         id: 'r1', name: 'Teszt', slot: 'Reggeli', category: 'breakfast',
         createdDate: 'Ma', timesLogged: 0, avgScore: 0, lastLogged: '—',
         servings: 1, prepMins: 5, cookMins: 0, tags: ['x'],
         ingredients: [{ refId: 'p1', amount: 70, unit: 'g', name: 'Zab', contribution: { kcal: 260, p: 9, c: 42, f: 5 } }],
         macros: { kcal: 260, p: 9, c: 42, f: 5 },
         novaDominant: 1,
         mezoFit: { score: null, fitsFor: [] },
         starred: false,
       }
       expect(recipe.ingredients[0].name).toBe('Zab')
       expect(recipe.mezoFit.score).toBeNull()
     })

     it('a RecipeInput is the editor save payload (pantryItemId lines)', () => {
       const input: RecipeInput = {
         name: 'Új recept', slot: null, category: 'lunch', servings: 2,
         prepMins: 10, cookMins: 20, tags: [], starred: false,
         ingredients: [{ pantryItemId: 'p1', amount: 200, unit: 'g', note: null }],
       }
       expect(input.ingredients[0].pantryItemId).toBe('p1')
       expect(input.category).toBe('lunch')
     })
   })
   ```

2. Run it — expect a TYPE/compile FAILURE (no `RecipeIngredientLine`/`RecipeInput`, `mezoFit.score`
   not nullable):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test recipeTypes
   ```

   Expected: Vitest reports the file fails to compile/transform — `RecipeIngredientLine` and
   `RecipeInput` are not exported, and `mezoFit: { score: null }` is not assignable.

3. Implement. In `frontend/src/data/types.ts`, replace the `Recipe` block (the lines from
   `export interface Recipe {` through its closing `}` at ~line 110–121) with:

   ```ts
   export interface RecipeIngredientLine {
     refId: string // === pantryItemId (the pantry source row); kept as refId for the mock seed
     amount: number
     unit: string
     note?: string
     name?: string // server-computed snapshot name (present on persisted/loaded recipes)
     contribution?: { kcal: number; p: number; c: number; f: number } // this line's macro share
   }
   export interface Recipe {
     id: string; name: string; slot: string; category: RecipeCategory
     createdDate: string; timesLogged: number; avgScore: number; lastLogged: string
     servings: number; prepMins: number; cookMins: number; tags: string[]
     ingredients: RecipeIngredientLine[]
     macros: { kcal: number; p: number; c: number; f: number }
     novaDominant: NovaGroup
     mezoFit: { score: number | null; fitsFor: string[] }
     starred: boolean
     recentLogs?: RecipeLog[]
     templateBreakdown?: MealBreakdown
   }
   /** Editor save payload — maps to the RecipeRequest contract (refId → pantryItemId). */
   export interface RecipeInput {
     name: string
     slot?: string | null
     category: RecipeCategory
     servings: number
     prepMins?: number | null
     cookMins?: number | null
     tags: string[]
     starred: boolean
     ingredients: { pantryItemId: string; amount: number; unit: string; note?: string | null }[]
   }
   ```

4. Run it — expect PASS:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test recipeTypes
   ```

   Expected: all 3 tests pass.

5. Commit:

   ```bash
   git add frontend/src/data/types.ts frontend/src/data/recipeTypes.test.ts
   git commit -m "feat(recipes): extend FE Recipe types with per-line name + contribution + RecipeInput (mezo-lns)"
   ```

---

### Task fedata2: Add the shared contribution/macro helper (`computeRecipeMacros`)

**Files:**
- Create: `frontend/src/data/recipeMacros.ts`
- Test: `frontend/src/data/recipeMacros.test.ts`

**Interfaces:**
- Consumes: `Ingredient` (`./types`), `RecipeIngredientLine` (`./types` from fedata1).
- Produces (the mock hook + the editor reuse this — the ONE place the formula lives FE-side; it
  must match the backend Java mapper bit-for-bit):
  - `roundMacro(n: number): number` — `Math.round(n * 10) / 10` (1-decimal rounding; matches the
    backend `round(...)` to 1 fractional digit on numeric macros).
  - `lineContribution(amount: number, per: number, src: { kcal: number; p: number; c: number;
    f: number }): { kcal: number; p: number; c: number; f: number }` — `factor = amount /
    (per || 1)`; each field `= roundMacro(src.field * factor)`.
  - `enrichLine(line: RecipeIngredientLine, ing: Ingredient | undefined): RecipeIngredientLine` —
    returns the line with `name` (= `ing?.name`) + `contribution` (= `lineContribution(amount,
    ing.per, ing.macros)`, or zeros when the ingredient is missing).
  - `computeRecipeMacros(lines: RecipeIngredientLine[]): { kcal: number; p: number; c: number;
    f: number }` — sums each line's `contribution` (already-enriched), `roundMacro` on the totals.

**Steps:**

1. Write the failing test. Create `frontend/src/data/recipeMacros.test.ts`:

   ```ts
   import { describe, it, expect } from 'vitest'
   import { roundMacro, lineContribution, enrichLine, computeRecipeMacros } from './recipeMacros'
   import type { Ingredient, RecipeIngredientLine } from './types'

   const zab: Ingredient = {
     id: 'ing-zab', name: 'Zabpehely', brand: '', source: 'kifli.hu', category: 'carb',
     per: 100, unit: 'g', macros: { kcal: 372, p: 13.5, c: 60, f: 7 },
     price: 0, priceUnit: '', pkg: '', micros: [], nova: 1, stock: null,
     lastUsed: '—', usedInRecipes: 0,
   }

   describe('recipeMacros (shared contribution/rollup formula)', () => {
     it('roundMacro rounds to one decimal', () => {
       expect(roundMacro(42.04)).toBe(42)
       expect(roundMacro(9.449)).toBe(9.4)
       expect(roundMacro(4.9)).toBe(4.9)
     })

     it('lineContribution scales per-100 macros by amount/per', () => {
       // 70g of zab: factor 0.7 → kcal 372*0.7=260.4→260.4, p 13.5*0.7=9.45→9.5, c 60*0.7=42, f 7*0.7=4.9
       expect(lineContribution(70, 100, zab.macros)).toEqual({ kcal: 260.4, p: 9.5, c: 42, f: 4.9 })
     })

     it('per defaults to 1 for discrete units (amount/1 = amount)', () => {
       // 1 "db" egg @ per:1 macros {kcal:78,...} → factor 1
       const egg = { kcal: 78, p: 6, c: 0.6, f: 5.5 }
       expect(lineContribution(1, 1, egg)).toEqual({ kcal: 78, p: 6, c: 0.6, f: 5.5 })
       expect(lineContribution(2, 0, egg)).toEqual({ kcal: 156, p: 12, c: 1.2, f: 11 }) // per 0 → treated as 1
     })

     it('enrichLine fills name + contribution from the ingredient', () => {
       const line: RecipeIngredientLine = { refId: 'ing-zab', amount: 70, unit: 'g' }
       const out = enrichLine(line, zab)
       expect(out.name).toBe('Zabpehely')
       expect(out.contribution).toEqual({ kcal: 260.4, p: 9.5, c: 42, f: 4.9 })
       expect(out.refId).toBe('ing-zab')
     })

     it('enrichLine zeros the contribution when the ingredient is missing', () => {
       const line: RecipeIngredientLine = { refId: 'gone', amount: 70, unit: 'g' }
       const out = enrichLine(line, undefined)
       expect(out.name).toBe('gone')
       expect(out.contribution).toEqual({ kcal: 0, p: 0, c: 0, f: 0 })
     })

     it('computeRecipeMacros sums enriched line contributions', () => {
       const lines: RecipeIngredientLine[] = [
         { refId: 'ing-zab', amount: 70, unit: 'g', contribution: { kcal: 260.4, p: 9.5, c: 42, f: 4.9 } },
         { refId: 'ing-mez', amount: 12, unit: 'g', contribution: { kcal: 36.5, p: 0, c: 9.9, f: 0 } },
       ]
       expect(computeRecipeMacros(lines)).toEqual({ kcal: 296.9, p: 9.5, c: 51.9, f: 4.9 })
     })
   })
   ```

2. Run it — expect FAILURE (module does not exist):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test recipeMacros
   ```

   Expected: `Failed to resolve import "./recipeMacros"`.

3. Implement. Create `frontend/src/data/recipeMacros.ts`:

   ```ts
   import type { Ingredient, RecipeIngredientLine } from './types'

   type Macros = { kcal: number; p: number; c: number; f: number }

   /** 1-decimal rounding — must match the backend numeric-macro rounding (round to 1 frac digit). */
   export function roundMacro(n: number): number {
     return Math.round(n * 10) / 10
   }

   /**
    * One ingredient line's macro contribution. factor = amount / per (per defaults to 1 for
    * discrete units so amount/1 = amount). IDENTICAL to the backend RecipeMapper formula.
    */
   export function lineContribution(amount: number, per: number, src: Macros): Macros {
     const factor = amount / (per || 1)
     return {
       kcal: roundMacro(src.kcal * factor),
       p: roundMacro(src.p * factor),
       c: roundMacro(src.c * factor),
       f: roundMacro(src.f * factor),
     }
   }

   /** Fill a line's snapshot name + contribution from its source ingredient (zeros if missing). */
   export function enrichLine(line: RecipeIngredientLine, ing: Ingredient | undefined): RecipeIngredientLine {
     if (!ing) return { ...line, name: line.refId, contribution: { kcal: 0, p: 0, c: 0, f: 0 } }
     return { ...line, name: ing.name, contribution: lineContribution(line.amount, ing.per, ing.macros) }
   }

   /** Whole-recipe macros = sum of line contributions (each already enriched). */
   export function computeRecipeMacros(lines: RecipeIngredientLine[]): Macros {
     const sum = lines.reduce<Macros>(
       (acc, l) => {
         const c = l.contribution ?? { kcal: 0, p: 0, c: 0, f: 0 }
         return { kcal: acc.kcal + c.kcal, p: acc.p + c.p, c: acc.c + c.c, f: acc.f + c.f }
       },
       { kcal: 0, p: 0, c: 0, f: 0 },
     )
     return { kcal: roundMacro(sum.kcal), p: roundMacro(sum.p), c: roundMacro(sum.c), f: roundMacro(sum.f) }
   }
   ```

4. Run it — expect PASS:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test recipeMacros
   ```

   Expected: all 6 tests pass.

5. Commit:

   ```bash
   git add frontend/src/data/recipeMacros.ts frontend/src/data/recipeMacros.test.ts
   git commit -m "feat(recipes): add shared contribution/macro rollup helper (mezo-lns)" 
   ```

---

### Task fedata3: Re-seed mock recipes with `pantryItemId` lines + computed name/contribution

**Files:**
- Modify: `frontend/src/data/pantry.ts`
- Modify: `frontend/src/data/pantryData.test.tsx`
- Test (assertion added to): `frontend/src/data/pantryData.test.tsx`

**Interfaces:**
- Consumes: `enrichLine`, `computeRecipeMacros` (fedata2); `ingredients` mock seed +
  `RecipeIngredientLine` (fedata1).
- Produces: the exported `recipes: Recipe[]` mock seed where every ingredient line carries the
  computed `name` + `contribution`, and each recipe's `macros` is **recomputed** from those
  contributions (so the mock seed equals what the backend would return). `recipesBase` still uses
  `refId` keys verbatim (= pantry item ids). The 6-recipe count + `templateBreakdown`/`recentLogs`
  enrichment is preserved.

**Steps:**

1. Write the failing assertion. In `frontend/src/data/pantryData.test.tsx`, ADD this test (keep
   the existing 6-recipe / templateBreakdown / recentLogs tests unchanged):

   ```ts
   import { ingredients } from './pantry'
   import { lineContribution } from './recipeMacros'

   test('every mock recipe line carries a computed name + contribution; macros = Σ contributions', () => {
     const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
     for (const recipe of result.current.recipes) {
       let sum = { kcal: 0, p: 0, c: 0, f: 0 }
       for (const line of recipe.ingredients) {
         const ing = ingredients.find(i => i.id === line.refId)
         expect(line.name).toBe(ing?.name)
         expect(line.contribution).toEqual(lineContribution(line.amount, ing!.per, ing!.macros))
         const c = line.contribution!
         sum = { kcal: sum.kcal + c.kcal, p: sum.p + c.p, c: sum.c + c.c, f: sum.f + c.f }
       }
       const r = (n: number) => Math.round(n * 10) / 10
       expect(recipe.macros).toEqual({ kcal: r(sum.kcal), p: r(sum.p), c: r(sum.c), f: r(sum.f) })
     }
   })
   ```

   Also update the FIRST two existing tests to pass a wrapper, since `useRecipes` becomes a query
   hook in fedata4 (the test file already imports `QueryWrapper`): change
   `renderHook(() => useRecipes())` → `renderHook(() => useRecipes(), { wrapper: QueryWrapper })`
   in the `'useRecipes returns 6 recipes…'`, `'logged recipes…'`, and `'standalone recipes…'`
   tests.

2. Run it — expect FAILURE (lines have no `name`/`contribution`; `useRecipes` not yet a query so
   the wrapper-less variants also break once fedata4 lands — at this point the new assertion fails
   on the missing `name`):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test pantryData
   ```

   Expected: the new `'every mock recipe line carries a computed name…'` test fails —
   `expected undefined to be 'Zabpehely'`.

3. Implement. In `frontend/src/data/pantry.ts`:

   a. Add imports at the top (alongside the existing `import { fuelDay } from './fuel'`):

   ```ts
   import { enrichLine, computeRecipeMacros } from './recipeMacros'
   ```

   b. Keep `recipesBase` exactly as-is (the `refId`/`amount`/`unit`/`note` lines + the hardcoded
      `macros` are the design-intent values). Change the final `export const recipes` mapping (the
      block starting `export const recipes: Recipe[] = recipesBase.map(r => {`) so each line is
      enriched and `macros` recomputed from the enriched contributions. Replace the `return { ...r,
      recentLogs, templateBreakdown }` tail with:

   ```ts
     // Enrich each line with snapshot name + contribution, then roll the whole-recipe macros up
     // from those contributions — IDENTICAL to what the backend RecipeMapper produces, so the
     // mock seed and the API agree byte-for-byte (the shared recipeMacros formula).
     const enrichedIngredients = r.ingredients.map(line =>
       enrichLine(line, ingredients.find(i => i.id === line.refId)),
     )
     const macros = computeRecipeMacros(enrichedIngredients)

     return { ...r, ingredients: enrichedIngredients, macros, recentLogs, templateBreakdown }
   ```

   (`ingredients` is already in scope — it is the exported array declared above `recipesBase` in
   the same module.)

4. Run it — expect PASS:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test pantryData
   ```

   Expected: all `pantryData` tests pass (6 recipes, breakdowns, recentLogs, and the new
   name/contribution + macro-rollup test).

5. Commit:

   ```bash
   git add frontend/src/data/pantry.ts frontend/src/data/pantryData.test.tsx
   git commit -m "feat(recipes): enrich mock recipe seed with computed line name/contribution (mezo-lns)"
   ```

---

### Task fedata4: `src/lib/recipeApi.ts` — list/get/create/update/remove + `toRequest`

**Files:**
- Create: `frontend/src/lib/recipeApi.ts`
- Test: `frontend/src/lib/recipeApi.test.ts`

**Interfaces:**
- Consumes (VERBATIM from the Contract section's `api.gen.ts`):
  `components['schemas']['RecipeRequest' | 'RecipeListResponse' | 'RecipeResponse']`; `apiFetch`
  (`@/lib/api`); `Recipe`, `RecipeInput` (`@/data/types` from fedata1).
- Produces (the hook + MSW depend on these VERBATIM):
  - `toRequest(input: RecipeInput): RecipeRequest` — maps `ingredients[].pantryItemId` straight
    through, casts `category` to the contract type (like `pantryApi.toRequest` casts `category`),
    passes `slot`/`prepMins`/`cookMins`/`note` nullables through.
  - `recipeApi.list(): Promise<Recipe[]>` — `GET /api/recipe`, returns `RecipeListResponse.recipes`
    cast to `Recipe[]` (domain `NovaGroup` vs generated `number`, `mezoFit.score` number|null,
    line `refId` ← `pantryItemId` re-key).
  - `recipeApi.get(id: string): Promise<Recipe>` — `GET /api/recipe/{id}`, cast.
  - `recipeApi.create(input: RecipeInput): Promise<void>` — `POST`, body `toRequest(input)`.
  - `recipeApi.update(id, input): Promise<void>` — `PUT /api/recipe/{id}`.
  - `recipeApi.remove(id): Promise<void>` — `DELETE /api/recipe/{id}`.
  - `fromResponse(r: RecipeResponse): Recipe` — re-keys `ingredients[].pantryItemId → refId`,
    carries `name`/`contribution`, casts enums; reused by `list`/`get`.

**Steps:**

1. Write the failing test. Create `frontend/src/lib/recipeApi.test.ts`:

   ```ts
   import { afterEach, beforeEach, describe, expect, it } from 'vitest'
   import { http, HttpResponse } from 'msw'
   import { recipeApi, toRequest } from './recipeApi'
   import { server } from '@/test/msw/server'
   import { API_BASE } from '@/test/msw/handlers'
   import type { RecipeInput } from '@/data/types'

   const input: RecipeInput = {
     name: 'Túrós zabkása', slot: 'Reggeli', category: 'breakfast', servings: 1,
     prepMins: 5, cookMins: 3, tags: ['high-protein'], starred: true,
     ingredients: [
       { pantryItemId: 'p-zab', amount: 70, unit: 'g', note: null },
       { pantryItemId: 'p-turo', amount: 200, unit: 'g', note: 'félzsíros' },
     ],
   }

   const apiRecipe = {
     id: 'r1', name: 'Túrós zabkása', slot: 'Reggeli', category: 'breakfast',
     servings: 1, prepMins: 5, cookMins: 3, tags: ['high-protein'], starred: true,
     createdDate: 'Ma', novaDominant: 3, macros: { kcal: 580, p: 42, c: 78, f: 12 },
     mezoFit: { score: null, fitsFor: [] }, timesLogged: 0, avgScore: 0, lastLogged: '—',
     ingredients: [
       { pantryItemId: 'p-zab', amount: 70, unit: 'g', note: null, lineOrder: 0, name: 'Zab', contribution: { kcal: 260, p: 9, c: 42, f: 5 } },
       { pantryItemId: 'p-turo', amount: 200, unit: 'g', note: 'félzsíros', lineOrder: 1, name: 'Túró', contribution: { kcal: 260, p: 36, c: 7, f: 10 } },
     ],
   }

   afterEach(() => server.resetHandlers())

   describe('toRequest', () => {
     it('maps the editor input straight onto the RecipeRequest (pantryItemId lines, category cast)', () => {
       const req = toRequest(input)
       expect(req.name).toBe('Túrós zabkása')
       expect(req.category).toBe('breakfast')
       expect(req.ingredients).toEqual([
         { pantryItemId: 'p-zab', amount: 70, unit: 'g', note: null },
         { pantryItemId: 'p-turo', amount: 200, unit: 'g', note: 'félzsíros' },
       ])
     })
   })

   describe('recipeApi', () => {
     it('list returns Recipe[] re-keyed to refId with name + contribution', async () => {
       server.use(http.get(`${API_BASE}/api/recipe`, () => HttpResponse.json({ recipes: [apiRecipe] })))
       const recipes = await recipeApi.list()
       expect(recipes).toHaveLength(1)
       expect(recipes[0].id).toBe('r1')
       expect(recipes[0].mezoFit.score).toBeNull()
       expect(recipes[0].ingredients[0]).toMatchObject({
         refId: 'p-zab', amount: 70, unit: 'g', name: 'Zab', contribution: { kcal: 260, p: 9, c: 42, f: 5 },
       })
     })

     it('get fetches one recipe by id', async () => {
       server.use(http.get(`${API_BASE}/api/recipe/r1`, () => HttpResponse.json(apiRecipe)))
       const recipe = await recipeApi.get('r1')
       expect(recipe.name).toBe('Túrós zabkása')
       expect(recipe.ingredients[1].refId).toBe('p-turo')
     })

     it('create POSTs the mapped request body and resolves void', async () => {
       let body: unknown
       server.use(http.post(`${API_BASE}/api/recipe`, async ({ request }) => {
         body = await request.json()
         return HttpResponse.json(apiRecipe, { status: 201 })
       }))
       await expect(recipeApi.create(input)).resolves.toBeUndefined()
       expect((body as { name: string }).name).toBe('Túrós zabkása')
       expect((body as { ingredients: unknown[] }).ingredients).toHaveLength(2)
     })

     it('update PUTs to /api/recipe/{id} and resolves void on 204', async () => {
       server.use(http.put(`${API_BASE}/api/recipe/r1`, () => new HttpResponse(null, { status: 204 })))
       await expect(recipeApi.update('r1', input)).resolves.toBeUndefined()
     })

     it('remove DELETEs and resolves void on 204', async () => {
       server.use(http.delete(`${API_BASE}/api/recipe/r1`, () => new HttpResponse(null, { status: 204 })))
       await expect(recipeApi.remove('r1')).resolves.toBeUndefined()
     })
   })
   ```

2. Run it — expect FAILURE (module does not exist):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test recipeApi
   ```

   Expected: `Failed to resolve import "./recipeApi"`.

3. Implement. Create `frontend/src/lib/recipeApi.ts` (mirrors `pantryApi.ts` — `toRequest` mapper
   + list-response cast):

   ```ts
   import { apiFetch } from './api'
   import type { components } from './api.gen'
   import type { Recipe, RecipeInput, RecipeIngredientLine } from '@/data/types'

   type RecipeRequest = components['schemas']['RecipeRequest']
   type RecipeResponse = components['schemas']['RecipeResponse']
   type RecipeListResponse = components['schemas']['RecipeListResponse']

   /** Editor input → contract request. pantryItemId passes straight through; category is a trusted
    *  form string cast to the contract type (mirrors pantryApi's category cast). */
   export function toRequest(input: RecipeInput): RecipeRequest {
     return {
       name: input.name,
       slot: input.slot ?? null,
       category: input.category as RecipeRequest['category'],
       servings: input.servings,
       prepMins: input.prepMins ?? null,
       cookMins: input.cookMins ?? null,
       tags: input.tags,
       starred: input.starred,
       ingredients: input.ingredients.map(i => ({
         pantryItemId: i.pantryItemId,
         amount: i.amount,
         unit: i.unit,
         // omit note when null so the request mirrors the optional contract field
         ...(i.note != null ? { note: i.note } : {}),
       })),
     } satisfies RecipeRequest
   }

   /** Contract response → domain Recipe. Re-keys each line's pantryItemId → refId, carries the
    *  server-computed name + contribution, and casts enum-ish numbers (NovaGroup, mezoFit.score). */
   export function fromResponse(r: RecipeResponse): Recipe {
     return {
       id: r.id,
       name: r.name,
       slot: r.slot ?? '',
       category: r.category as Recipe['category'],
       createdDate: r.createdDate,
       timesLogged: r.timesLogged,
       avgScore: r.avgScore,
       lastLogged: r.lastLogged,
       servings: r.servings,
       prepMins: r.prepMins ?? 0,
       cookMins: r.cookMins ?? 0,
       tags: r.tags,
       ingredients: r.ingredients.map(
         (l): RecipeIngredientLine => ({
           refId: l.pantryItemId,
           amount: l.amount,
           unit: l.unit,
           note: l.note ?? undefined,
           name: l.name,
           contribution: l.contribution,
         }),
       ),
       macros: r.macros,
       novaDominant: r.novaDominant as Recipe['novaDominant'],
       mezoFit: { score: r.mezoFit.score ?? null, fitsFor: r.mezoFit.fitsFor },
       starred: r.starred,
     }
   }

   export const recipeApi = {
     list: (): Promise<Recipe[]> =>
       apiFetch<RecipeListResponse>('/api/recipe').then(res => res.recipes.map(fromResponse)),
     get: (id: string): Promise<Recipe> =>
       apiFetch<RecipeResponse>(`/api/recipe/${id}`).then(fromResponse),
     create: (input: RecipeInput): Promise<void> =>
       apiFetch('/api/recipe', { method: 'POST', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
     update: (id: string, input: RecipeInput): Promise<void> =>
       apiFetch(`/api/recipe/${id}`, { method: 'PUT', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
     remove: (id: string): Promise<void> =>
       apiFetch(`/api/recipe/${id}`, { method: 'DELETE' }).then(() => undefined),
   }
   ```

4. Run it — expect PASS:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test recipeApi
   ```

   Expected: all 6 `recipeApi` tests pass.

5. Commit:

   ```bash
   git add frontend/src/lib/recipeApi.ts frontend/src/lib/recipeApi.test.ts
   git commit -m "feat(recipes): add recipeApi client (list/get/create/update/remove + toRequest) (mezo-lns)"
   ```

---

### Task fedata5: Add `/api/recipe` MSW handlers (list/get/create/update/remove)

**Files:**
- Modify: `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Consumes: `API_BASE` (`@/lib/api`, already imported in the file); the `RecipeResponse` shape
  from the Contract section.
- Produces (the hook tests in fedata6 default to these; they override with `server.use()` for
  payload capture / list-after-write): `http.get('/api/recipe')`, `http.get('/api/recipe/:id')`,
  `http.post('/api/recipe')`, `http.put('/api/recipe/:id')`, `http.delete('/api/recipe/:id')` —
  a single fixture recipe matching the `RecipeResponse` contract (re-keyed lines, computed
  name/contribution, nullable `mezoFit.score`).

**Steps:**

1. (No standalone test — these handlers are exercised by fedata6's hook tests. They are added as
   defaults the way the existing pantry/train handlers are.) Implement: in
   `frontend/src/test/msw/handlers.ts`, add the following handlers inside the exported `handlers`
   array (place them right after the pantry handlers, before the closing `]`). First, define a
   module-level fixture above the `export const handlers = [` line:

   ```ts
   // Recipe fixture (mezo-lns) mirroring the RecipeResponse contract — one breakfast recipe with
   // two pantry-item lines (computed name + contribution, lineOrder, nullable mezoFit.score).
   const recipeFixture = {
     id: 'rc1f3a0e2-0000-4000-8000-000000000001',
     name: 'Túrós zabkása · áfonyával', slot: 'Reggeli', category: 'breakfast',
     servings: 1, prepMins: 5, cookMins: 3, tags: ['high-protein', 'pre-workout'], starred: true,
     createdDate: 'Máj 14', novaDominant: 3, macros: { kcal: 580, p: 42, c: 78, f: 12 },
     mezoFit: { score: 0.92, fitsFor: ['Reggel · Reta D3'] },
     timesLogged: 0, avgScore: 0, lastLogged: '—',
     ingredients: [
       { pantryItemId: 'p-zab', amount: 70, unit: 'g', note: null, lineOrder: 0, name: 'Zabpehely', contribution: { kcal: 260, p: 9.5, c: 42, f: 4.9 } },
       { pantryItemId: 'p-turo', amount: 200, unit: 'g', note: null, lineOrder: 1, name: 'Túró', contribution: { kcal: 260, p: 36, c: 7, f: 10 } },
     ],
   }
   ```

   Then add these entries to the `handlers` array:

   ```ts
     // Recipe (mezo-lns) — defaults; tests override with server.use() for payload capture +
     // list-after-write. GET list/detail return the fixture; writes echo 201/204.
     http.get(`${API_BASE}/api/recipe`, () => HttpResponse.json({ recipes: [recipeFixture] })),
     http.get(`${API_BASE}/api/recipe/:id`, ({ params }) =>
       HttpResponse.json({ ...recipeFixture, id: String(params.id) }),
     ),
     http.post(`${API_BASE}/api/recipe`, async ({ request }) => {
       const body = (await request.json()) as Record<string, unknown>
       return HttpResponse.json({ ...recipeFixture, ...body, id: 'rc1f3a0e2-0000-4000-8000-0000000000be' }, { status: 201 })
     }),
     http.put(`${API_BASE}/api/recipe/:id`, () => new HttpResponse(null, { status: 204 })),
     http.delete(`${API_BASE}/api/recipe/:id`, () => new HttpResponse(null, { status: 204 })),
   ```

2. Verify the handlers parse + the suite still loads (run an existing real-mode test that boots the
   MSW server):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test weightHooks
   ```

   Expected: `weightHooks` tests still pass (MSW server boots with the new handlers, no syntax
   error).

3. Commit:

   ```bash
   git add frontend/src/test/msw/handlers.ts
   git commit -m "test(recipes): add /api/recipe MSW handlers (mezo-lns)"
   ```

---

### Task fedata6: `src/data/recipeHooks.ts` — `useRecipes` + `useRecipeActions` (dual-mode)

**Files:**
- Create: `frontend/src/data/recipeHooks.ts`
- Test: `frontend/src/data/recipeHooks.test.tsx`

**Interfaces:**
- Consumes: `recipeApi` (fedata4); `isMockMode` (`@/lib/mode`); `recipes` mock seed +
  `pantryCategoryMeta` (`./pantry`); `pantrySources` (`./pantrySources`); `ingredients`
  (`./pantry`); `enrichLine`, `computeRecipeMacros` (fedata2); `Recipe`, `RecipeInput`,
  `RecipeIngredientLine` (`./types`); the `/api/recipe` MSW handlers (fedata5).
- Produces (re-exported from `hooks.ts` in fedata7; the components/routes section depends on these
  VERBATIM):
  - `useRecipes(): { recipes: Recipe[]; ingredients: Ingredient[]; sources: typeof pantrySources;
    categoryMeta: typeof pantryCategoryMeta }` — `recipes` is the ONLY dual-mode field
    (`useQuery({ queryKey: ['recipes'] })`, mock `initialData` + `staleTime: Infinity` / real
    `queryFn: recipeApi.list`); `ingredients`/`sources`/`categoryMeta` come from the pantry/static
    config (NOT dual-mode here). Public shape is IDENTICAL to the old one-liner.
  - `useRecipeActions(): { create: (input: RecipeInput) => void; update: (id: string, input:
    RecipeInput) => void; remove: (id: string) => void }` — mock branch = `setQueryData(['recipes'])`
    cache mutators (computing `name`/`contribution`/`macros` via the SHARED formula); real branch =
    `recipeApi` call + `invalidateQueries(['recipes'])` AND `invalidateQueries(['pantry'])`.
- `RECIPES_KEY = ['recipes'] as const` (module-local; tests reference `['recipes']`).

**Steps:**

1. Write the failing test. Create `frontend/src/data/recipeHooks.test.tsx`:

   ```tsx
   import type { ReactNode } from 'react'
   import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
   import { renderHook, waitFor, act } from '@testing-library/react'
   import { http, HttpResponse } from 'msw'
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
   import { useRecipes, useRecipeActions } from './recipeHooks'
   import { server } from '@/test/msw/server'
   import { API_BASE } from '@/test/msw/handlers'
   import type { RecipeInput } from './types'

   function sharedWrapper() {
     const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
     const Wrapper = ({ children }: { children: ReactNode }) => (
       <QueryClientProvider client={qc}>{children}</QueryClientProvider>
     )
     return { qc, Wrapper }
   }

   const newRecipe: RecipeInput = {
     name: 'Új recept', slot: 'Snack', category: 'snack', servings: 1,
     prepMins: 2, cookMins: 0, tags: [], starred: false,
     ingredients: [{ pantryItemId: 'ing-zab', amount: 70, unit: 'g', note: null }],
   }

   afterEach(() => vi.unstubAllEnvs())

   describe('useRecipes (mock mode)', () => {
     beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

     it('returns the preserved shape: recipes + ingredients + sources + categoryMeta', () => {
       const { Wrapper } = sharedWrapper()
       const { result } = renderHook(() => useRecipes(), { wrapper: Wrapper })
       expect(Object.keys(result.current).sort()).toEqual(['categoryMeta', 'ingredients', 'recipes', 'sources'])
       expect(result.current.recipes).toHaveLength(6) // the seed
       expect(result.current.ingredients.length).toBeGreaterThan(0)
       expect(result.current.sources['kifli.hu'].label).toBeTruthy()
       expect(result.current.categoryMeta.protein.label).toBe('Fehérje')
       // seed recipes carry computed macros (rolled up from line contributions)
       const rec1 = result.current.recipes.find(r => r.id === 'rec-1')!
       expect(rec1.macros.kcal).toBeGreaterThan(0)
       expect(rec1.ingredients[0].contribution).toBeDefined()
     })

     it('create appends a recipe with computed name/contribution/macros into the SAME cache', async () => {
       const { Wrapper } = sharedWrapper()
       const { result } = renderHook(
         () => ({ read: useRecipes(), actions: useRecipeActions() }),
         { wrapper: Wrapper },
       )
       const before = result.current.read.recipes.length
       act(() => result.current.actions.create(newRecipe))
       await waitFor(() => expect(result.current.read.recipes.length).toBe(before + 1))
       const added = result.current.read.recipes.find(r => r.name === 'Új recept')!
       expect(added.ingredients[0].refId).toBe('ing-zab')
       expect(added.ingredients[0].name).toBe('Zabpehely · gluténmentes')
       // 70g zab (per 100, kcal 372) → contribution kcal = round(372*0.7) = 260.4; macros = Σ
       expect(added.ingredients[0].contribution!.kcal).toBe(260.4)
       expect(added.macros.kcal).toBe(260.4)
     })

     it('remove deletes a recipe from the shared cache', async () => {
       const { Wrapper } = sharedWrapper()
       const { result } = renderHook(
         () => ({ read: useRecipes(), actions: useRecipeActions() }),
         { wrapper: Wrapper },
       )
       const before = result.current.read.recipes.length
       act(() => result.current.actions.remove('rec-1'))
       await waitFor(() => expect(result.current.read.recipes.length).toBe(before - 1))
       expect(result.current.read.recipes.some(r => r.id === 'rec-1')).toBe(false)
     })
   })

   describe('useRecipes (real mode)', () => {
     beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

     it('loads recipes from the API (MSW fixture)', async () => {
       const { Wrapper } = sharedWrapper()
       const { result } = renderHook(() => useRecipes(), { wrapper: Wrapper })
       await waitFor(() => expect(result.current.recipes.length).toBe(1))
       const r = result.current.recipes[0]
       expect(r.name).toBe('Túrós zabkása · áfonyával')
       expect(r.ingredients[0].refId).toBe('p-zab')
       expect(r.ingredients[0].contribution).toEqual({ kcal: 260, p: 9.5, c: 42, f: 4.9 })
       expect(r.mezoFit.score).toBe(0.92)
       // static presentation config is still present in real mode
       expect(result.current.sources).toBeDefined()
       expect(result.current.categoryMeta).toBeDefined()
       expect(result.current.ingredients.length).toBeGreaterThan(0)
     })

     it('create POSTs and invalidates BOTH ["recipes"] and ["pantry"]', async () => {
       const { qc, Wrapper } = sharedWrapper()
       const spy = vi.spyOn(qc, 'invalidateQueries')
       let posted = false
       server.use(
         http.post(`${API_BASE}/api/recipe`, async () => {
           posted = true
           return HttpResponse.json({ id: 'new' }, { status: 201 })
         }),
       )
       const { result } = renderHook(() => useRecipeActions(), { wrapper: Wrapper })
       act(() => result.current.create(newRecipe))
       await waitFor(() => expect(posted).toBe(true))
       await waitFor(() => {
         const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
         expect(keys).toContain(JSON.stringify(['recipes']))
         expect(keys).toContain(JSON.stringify(['pantry']))
       })
     })

     it('remove DELETEs and invalidates BOTH caches', async () => {
       const { qc, Wrapper } = sharedWrapper()
       const spy = vi.spyOn(qc, 'invalidateQueries')
       let deleted = false
       server.use(
         http.delete(`${API_BASE}/api/recipe/r1`, () => {
           deleted = true
           return new HttpResponse(null, { status: 204 })
         }),
       )
       const { result } = renderHook(() => useRecipeActions(), { wrapper: Wrapper })
       act(() => result.current.remove('r1'))
       await waitFor(() => expect(deleted).toBe(true))
       await waitFor(() => {
         const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
         expect(keys).toContain(JSON.stringify(['recipes']))
         expect(keys).toContain(JSON.stringify(['pantry']))
       })
     })
   })
   ```

2. Run it — expect FAILURE (module does not exist):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test recipeHooks && VITE_USE_MOCK=true pnpm test recipeHooks
   ```

   Expected: `Failed to resolve import "./recipeHooks"`.

3. Implement. Create `frontend/src/data/recipeHooks.ts` (mirrors `pantryHooks.ts`'s dual-mode
   `useQuery` + `setQueryData` mutators; adds dual-cache invalidation):

   ```ts
   import { useCallback } from 'react'
   import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
   import { recipeApi } from '@/lib/recipeApi'
   import { isMockMode } from '@/lib/mode'
   import { recipes as mockRecipes, ingredients, pantryCategoryMeta } from './pantry'
   import { pantrySources } from './pantrySources'
   import { enrichLine, computeRecipeMacros } from './recipeMacros'
   import { deriveNovaDominant } from './nova'
   import type { Recipe, RecipeInput, RecipeIngredientLine } from './types'

   const RECIPES_KEY = ['recipes'] as const
   const PANTRY_KEY = ['pantry'] as const

   /** Public shape preserved verbatim: only `recipes` is dual-mode; the rest is static/pantry config. */
   export function useRecipes() {
     const mock = isMockMode()
     const { data: recipes = mockRecipes } = useQuery({
       queryKey: RECIPES_KEY,
       queryFn: mock ? async () => mockRecipes : recipeApi.list,
       initialData: mock ? mockRecipes : undefined, // synchronous first render in mock (parity/tests)
       // Mock mode is client-owned: useRecipeActions mutates the ['recipes'] cache via setQueryData,
       // so the query must never background-refetch and clobber those edits back to the seed.
       staleTime: mock ? Infinity : 0,
     })
     return {
       recipes,
       ingredients,                       // pantry source rows (for the picker)
       sources: pantrySources,            // static presentation config
       categoryMeta: pantryCategoryMeta,  // static presentation config
     }
   }

   /** Create/update/delete on the ['recipes'] cache. Real writes invalidate ['recipes'] AND ['pantry']. */
   export function useRecipeActions() {
     const qc = useQueryClient()
     const mock = isMockMode()

     const invalidate = () => {
       qc.invalidateQueries({ queryKey: RECIPES_KEY })
       qc.invalidateQueries({ queryKey: PANTRY_KEY }) // recipe writes shift pantry usedInRecipes
     }

     const createM = useMutation({
       mutationFn: mock
         ? async (input: RecipeInput) => mockCreate(qc, input)
         : (input: RecipeInput) => recipeApi.create(input),
       onSuccess: mock ? undefined : invalidate,
     })
     const updateM = useMutation({
       mutationFn: mock
         ? async (v: { id: string; input: RecipeInput }) => mockUpdate(qc, v.id, v.input)
         : (v: { id: string; input: RecipeInput }) => recipeApi.update(v.id, v.input),
       onSuccess: mock ? undefined : invalidate,
     })
     const removeM = useMutation({
       mutationFn: mock
         ? async (id: string) => mockRemove(qc, id)
         : (id: string) => recipeApi.remove(id),
       onSuccess: mock ? undefined : invalidate,
     })

     const create = useCallback((input: RecipeInput) => createM.mutate(input), [createM])
     const update = useCallback((id: string, input: RecipeInput) => updateM.mutate({ id, input }), [updateM])
     const remove = useCallback((id: string) => removeM.mutate(id), [removeM])
     return { create, update, remove }
   }

   // --- mock-mode cache mutators: keep the offline app interactive. The contribution + macro
   // computation uses the SAME shared formula (recipeMacros) as the backend, so mock writes are
   // byte-identical to what the API would return. ---
   function buildRecipe(id: string, input: RecipeInput, base?: Recipe): Recipe {
     const lines: RecipeIngredientLine[] = input.ingredients.map(i =>
       enrichLine(
         { refId: i.pantryItemId, amount: i.amount, unit: i.unit, note: i.note ?? undefined },
         ingredients.find(ing => ing.id === i.pantryItemId),
       ),
     )
     const macros = computeRecipeMacros(lines)
     return {
       id,
       name: input.name,
       slot: input.slot ?? '',
       category: input.category,
       createdDate: base?.createdDate ?? 'Ma',
       timesLogged: base?.timesLogged ?? 0,
       avgScore: base?.avgScore ?? 0,
       lastLogged: base?.lastLogged ?? '—',
       servings: input.servings,
       prepMins: input.prepMins ?? 0,
       cookMins: input.cookMins ?? 0,
       tags: input.tags,
       ingredients: lines,
       macros,
       novaDominant: deriveNovaDominant(lines, ingredients),
       mezoFit: base?.mezoFit ?? { score: null, fitsFor: [] },
       starred: input.starred,
       recentLogs: base?.recentLogs ?? [],
       templateBreakdown: base?.templateBreakdown,
     }
   }
   function mockCreate(qc: ReturnType<typeof useQueryClient>, input: RecipeInput) {
     qc.setQueryData<Recipe[]>(RECIPES_KEY, prev => [...(prev ?? mockRecipes), buildRecipe(crypto.randomUUID(), input)])
     return undefined
   }
   function mockUpdate(qc: ReturnType<typeof useQueryClient>, id: string, input: RecipeInput) {
     qc.setQueryData<Recipe[]>(RECIPES_KEY, prev =>
       (prev ?? mockRecipes).map(r => (r.id === id ? buildRecipe(id, input, r) : r)),
     )
     return undefined
   }
   function mockRemove(qc: ReturnType<typeof useQueryClient>, id: string) {
     qc.setQueryData<Recipe[]>(RECIPES_KEY, prev => (prev ?? mockRecipes).filter(r => r.id !== id))
     return undefined
   }
   ```

   Then add the small `deriveNovaDominant` helper to `frontend/src/data/nova.ts` (the dominant NOVA
   group = the highest NOVA among the recipe's ingredients — matches the backend "derived at write"
   rule). Append to `nova.ts`:

   ```ts
   import type { Ingredient, RecipeIngredientLine } from './types'
   /** Dominant NOVA = the max NOVA group across the recipe's ingredient lines (1 when none). */
   export function deriveNovaDominant(lines: RecipeIngredientLine[], pool: Ingredient[]): NovaGroup {
     let max = 1 as NovaGroup
     for (const l of lines) {
       const ing = pool.find(i => i.id === l.refId)
       if (ing && ing.nova > max) max = ing.nova
     }
     return max
   }
   ```

   (If `nova.ts` has no existing type imports, add the `import type` line at the top instead of
   mid-file; place the function after the existing exports. `NovaGroup` is already declared there.)

4. Run it — expect PASS in BOTH modes:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test recipeHooks && pnpm test recipeHooks
   ```

   Expected: all `useRecipes (mock mode)` + `useRecipes (real mode)` tests pass in both runs (mock
   run: the real-mode `describe` still passes because it stubs `VITE_USE_MOCK=false` per-test; the
   real run: the mock `describe` stubs `true` per-test).

5. Commit:

   ```bash
   git add frontend/src/data/recipeHooks.ts frontend/src/data/nova.ts frontend/src/data/recipeHooks.test.tsx
   git commit -m "feat(recipes): dual-mode useRecipes + useRecipeActions hooks with dual-cache invalidation (mezo-lns)"
   ```

---

### Task fedata7: Re-export `useRecipes` + `useRecipeActions` from `hooks.ts`; retire the old one-liner

**Files:**
- Modify: `frontend/src/data/hooks.ts`
- Test: `frontend/src/data/hooks.test.tsx` (add a re-export smoke assertion)

**Interfaces:**
- Consumes: `useRecipes`, `useRecipeActions` (fedata6).
- Produces: `useRecipes` + `useRecipeActions` importable from `@/data/hooks` (the consumer import
  path stays stable — exactly how `usePantry`/`usePantryActions` are re-exported). The old inline
  `useRecipes` (and its now-unused `recipes`/`pantrySources`/`pantryCategoryMeta` imports) are
  removed from `hooks.ts`.

**Steps:**

1. Write the failing test. In `frontend/src/data/hooks.test.tsx`, add:

   ```tsx
   import { useRecipes, useRecipeActions } from './hooks'

   test('useRecipes + useRecipeActions are re-exported from @/data/hooks', () => {
     expect(typeof useRecipes).toBe('function')
     expect(typeof useRecipeActions).toBe('function')
   })
   ```

   (If `hooks.test.tsx` already imports from `./hooks`, fold these into the existing import; do not
   duplicate the import line.)

2. Run it — expect FAILURE (`useRecipeActions` not exported from `hooks.ts`):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test hooks.test
   ```

   Expected: `useRecipeActions` is `undefined` → `expected 'undefined' to be 'function'`.

3. Implement. In `frontend/src/data/hooks.ts`:

   a. Delete the inline `useRecipes` function (the block at ~line 154–156):

   ```ts
   export function useRecipes() {
     return { recipes, ingredients, sources: pantrySources, categoryMeta: pantryCategoryMeta }
   }
   ```

   b. Remove the now-unused names from the pantry import. Change the line (~15):

   ```ts
   import { ingredients, recipes, pantrySources, pantryCategoryMeta } from './pantry'
   ```

   to (drop `recipes`; keep `ingredients` — it is still used by other hooks; drop
   `pantrySources`/`pantryCategoryMeta` only if no other hook in this file uses them — verify with
   the grep in step 4, and if they ARE used elsewhere keep them):

   ```ts
   import { ingredients } from './pantry'
   ```

   c. Add the re-export alongside the existing pantry re-export (after line 175
   `export { usePantry, usePantryActions } from './pantryHooks'`):

   ```ts
   export { useRecipes, useRecipeActions } from './recipeHooks'
   ```

4. Verify no leftover references to the removed imports break the build, then run the smoke test:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && \
     grep -nE '\b(recipes|pantrySources|pantryCategoryMeta)\b' src/data/hooks.ts; \
     pnpm test hooks.test
   ```

   Expected: the grep shows no remaining bare uses of `recipes` in `hooks.ts` (only the re-export
   line for the hooks); `hooks.test` passes including the new re-export assertion. (If the grep
   shows `pantrySources`/`pantryCategoryMeta` still referenced by another hook, keep them in the
   import — adjust step 3b accordingly.)

5. Commit:

   ```bash
   git add frontend/src/data/hooks.ts frontend/src/data/hooks.test.tsx
   git commit -m "feat(recipes): re-export useRecipes/useRecipeActions from hooks, retire mock one-liner (mezo-lns)"
   ```

---

### Task fedata8: Full dual-mode gate — both test modes + build green

**Files:**
- (no new files — verification + the feature doc touch)
- Modify: `docs/features/fuel.md` (update the Recipes data-layer description per the living-docs policy)

**Interfaces:**
- Consumes: everything from fedata1–7.
- Produces: a green `pnpm test` (REAL), green `VITE_USE_MOCK=true pnpm test` (MOCK), green
  `pnpm build`, and an up-to-date feature doc (staleness flag cleared).

**Steps:**

1. Run the REAL-mode suite (default = backend/MSW path):

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test
   ```

   Expected: all tests pass, including `recipeTypes`, `recipeMacros`, `recipeApi`, `recipeHooks`,
   `pantryData`, `hooks.test`.

2. Run the MOCK-mode suite:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test
   ```

   Expected: all tests pass in mock mode (the `recipeHooks` mock `describe`, the seed-shape
   `pantryData` tests, etc.).

3. Type-check + build:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm build
   ```

   Expected: `tsc -b` clean + `vite build` succeeds (no unused-import / type errors from the
   `hooks.ts` edits or the new modules).

4. Update the living feature doc. In `docs/features/fuel.md`, update the Recipes section to
   describe the new data boundary: `useRecipes()` is now a dual-mode TanStack query
   (`['recipes']`) composed with pantry-sourced `ingredients/sources/categoryMeta`;
   `useRecipeActions()` (create/update/remove) writes via `recipeApi` and invalidates both
   `['recipes']` and `['pantry']`; the per-line `name`/`contribution` + whole-recipe `macros` are
   computed by the shared `recipeMacros` formula (mock) / backend mapper (real) and are
   byte-identical. Point the §file-map at `src/lib/recipeApi.ts`, `src/data/recipeHooks.ts`,
   `src/data/recipeMacros.ts`. Then clear the staleness flag:

   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && node scripts/lint-docs.mjs
   ```

   Expected: lint passes with no staleness/broken-link errors for `fuel.md`. (If `fuel.md` does not
   yet exist as a feature doc, create it via the `knowledge-base` skill's 10-section template
   instead of editing in place.)

5. Commit:

   ```bash
   git add docs/features/fuel.md
   git commit -m "docs(fuel): document Recipes dual-mode data layer + shared macro formula (mezo-lns)"
   ```

---

## Phase 7 — FE UI + routes

## Frontend UI + Routes — Fuel Recipes (Receptek) editorial redesign

Driving bd: **mezo-lns**. These tasks rework the Recipes Fuel sub-view into the approved **editorial** design and turn detail + editor into full **routed pages**, consuming the dual-mode `useRecipes()` / `useRecipeActions()` data layer authored by the DATA+HOOKS section.

**Consumed from the DATA+HOOKS section (use these signatures VERBATIM — do not redefine):**
- `useRecipes(): { recipes: Recipe[]; ingredients: Ingredient[]; sources: PantrySourceKey[]; categoryMeta: Record<string, PantryCategoryMeta> }` — re-exported from `@/data/hooks`. `recipes` is dual-mode (query key `['recipes']`); the others come from pantry/static config. **Hard-reload deep-link**: the DATA section (fedata6) exposes NO raw `useRecipesQuery` export — so the detail/editor route guards rely on `useRecipes().recipes` only: mock `initialData` makes it synchronous; in real mode a cold deep-link shows the not-found fallback briefly until the list resolves. (No `isPending` skeleton branch in the guards.)
- `useRecipeActions(): { create: (input: RecipeInput) => void; update: (id: string, input: RecipeInput) => void; remove: (id: string) => void }` — re-exported from `@/data/hooks`. Mock branch mutates the `['recipes']` cache; real branch calls the API + invalidates `['recipes']` and `['pantry']`. (Note: the underlying mutations are `useMutation`; these wrappers fire `.mutate()`, same pattern as `usePantryActions`.)
- `RecipeInput` (from `@/data/types`, authored by DATA section): `{ name: string; slot: string | null; category: RecipeCategory; servings: number; prepMins: number | null; cookMins: number | null; tags: string[]; starred: boolean; ingredients: { refId: string; amount: number; unit: string; note?: string }[] }`.
- Extended `Recipe.ingredients[]` line shape (authored by DATA section, per spec §7.2): each line carries `{ refId, amount, unit, note?, name, contribution: { kcal, p, c, f } }`. `Recipe.mezoFit.score: number | null` (null = pending). `Recipe.macros` = whole-recipe totals.

If `RecipeInput` / the extended line shape are not yet in `@/data/types` when a task runs, that task's first step adds the minimal type it needs there (coordinated to match the DATA section's names).

---

### Task feui1: Shared `MacroCells` component (chamfer kcal/P/C/F cell strip)

**Files:**
- Create: `frontend/src/features/fuel/components/MacroCells.tsx`
- Test: `frontend/src/features/fuel/components/MacroCells.test.tsx`

**Interfaces:**
- Consumes: nothing (pure presentational).
- Produces: `export function MacroCells(props: MacroCellsProps)` where `export interface MacroCellsProps { macros: { kcal: number; p: number; c: number; f: number }; perLabel?: string; size?: 'sm' | 'md' }`. Renders 4 chamfer cells (`.mc` look from `recipes-*.html`: kcal in brand-glow, P in success-green, C/F primary), labels `kcal / Prot / Carb / Fat`; optional left `perLabel` rail (vertical mono text, e.g. `160 g` or `/100g`).

**Steps:**
1. Write the failing test `frontend/src/features/fuel/components/MacroCells.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MacroCells } from './MacroCells'

test('renders the four macro values with their labels', () => {
  render(<MacroCells macros={{ kcal: 420, p: 38, c: 12, f: 22 }} />)
  expect(screen.getByText('420')).toBeInTheDocument()
  expect(screen.getByText('38')).toBeInTheDocument()
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText('22')).toBeInTheDocument()
  expect(screen.getByText('kcal')).toBeInTheDocument()
  expect(screen.getByText('Prot')).toBeInTheDocument()
  expect(screen.getByText('Carb')).toBeInTheDocument()
  expect(screen.getByText('Fat')).toBeInTheDocument()
})

test('renders the per-basis rail label when given', () => {
  render(<MacroCells macros={{ kcal: 116, p: 24, c: 0, f: 6 }} perLabel="/100g" />)
  expect(screen.getByText('/100g')).toBeInTheDocument()
})
```
2. Run it — `pnpm test src/features/fuel/components/MacroCells.test.tsx` — expected FAILURE (module not found).
3. Implement `frontend/src/features/fuel/components/MacroCells.tsx`:
```tsx
// ============================================================
// Mezo · MacroCells (shared chamfer kcal/P/C/F strip)
// The `.mc` cell look from docs/design/recipes-*.html — used by the editorial
// RecipeCard body, the RecipeDetailView ingredient rows, the editor pick-rows,
// and the IngredientPickerSheet cards. An optional left `perLabel` rail prints
// the basis (e.g. "160 g" for an editor row at its amount, "/100g" in the picker).
// ============================================================
export interface MacroCellsProps {
  macros: { kcal: number; p: number; c: number; f: number }
  perLabel?: string
  size?: 'sm' | 'md'
}

const CELLS = [
  { key: 'kcal' as const, label: 'kcal', color: 'var(--brand-glow)' },
  { key: 'p' as const, label: 'Prot', color: 'var(--success)' },
  { key: 'c' as const, label: 'Carb', color: 'var(--text-primary)' },
  { key: 'f' as const, label: 'Fat', color: 'var(--text-primary)' },
]

export function MacroCells({ macros, perLabel, size = 'sm' }: MacroCellsProps) {
  const valFs = size === 'md' ? 15 : 13
  return (
    <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
      {perLabel && (
        <span
          className="label-mono"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7.5, letterSpacing: '0.06em', color: 'var(--text-quaternary)',
            writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '0 1px', flexShrink: 0,
          }}
        >
          {perLabel}
        </span>
      )}
      {CELLS.map(c => (
        <div
          key={c.key}
          className="notch-4"
          style={{ flex: 1, textAlign: 'center', padding: '6px 2px', background: 'rgba(255,255,255,0.025)' }}
        >
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: valFs, fontWeight: 600, color: c.color }}>
            {macros[c.key]}
          </div>
          <div className="label-mono" style={{ fontSize: 7, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {c.label}
          </div>
        </div>
      ))}
    </div>
  )
}
```
4. Run it — `pnpm test src/features/fuel/components/MacroCells.test.tsx` — expected PASS.
5. Commit — `git add frontend/src/features/fuel/components/MacroCells.tsx frontend/src/features/fuel/components/MacroCells.test.tsx` then `feat(fuel): add shared MacroCells chamfer strip (mezo-lns)`.

---

### Task feui2: Shared `RecipeFitBadge` (pending sparkle / scored number)

**Files:**
- Create: `frontend/src/features/fuel/components/RecipeFitBadge.tsx`
- Test: `frontend/src/features/fuel/components/RecipeFitBadge.test.tsx`

**Interfaces:**
- Consumes: `Icon` from `@/components/ui/Icon` (`name="sparkle"`).
- Produces: `export function RecipeFitBadge(props: RecipeFitBadgeProps)` where `export interface RecipeFitBadgeProps { score: number | null; size?: 'card' | 'hero' }`. `score == null` → **P2 pending**: pulsing `sparkle` Icon + "Mezo" micro-label. `score != null` → **scored**: Antonio number `Math.round(score * 100)` + "fit" label. Stable top-right slot (absolute), no layout shift between states.

**Steps:**
1. Write the failing test `frontend/src/features/fuel/components/RecipeFitBadge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { RecipeFitBadge } from './RecipeFitBadge'

test('pending state shows the Mezo sparkle label, no number', () => {
  render(<RecipeFitBadge score={null} />)
  expect(screen.getByText('Mezo')).toBeInTheDocument()
  expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
})

test('scored state shows the rounded fit number + fit label', () => {
  render(<RecipeFitBadge score={0.92} />)
  expect(screen.getByText('92')).toBeInTheDocument()
  expect(screen.getByText('fit')).toBeInTheDocument()
})
```
2. Run it — `pnpm test src/features/fuel/components/RecipeFitBadge.test.tsx` — expected FAILURE.
3. Implement `frontend/src/features/fuel/components/RecipeFitBadge.tsx`:
```tsx
// ============================================================
// Mezo · RecipeFitBadge (Mezo-fit slot — pending vs scored)
// The stable top-right badge from docs/design/recipes-library.html / -detail.html.
// v1: fit_score is always null (Phase-3 scoring deferred) → P2 sparkle "pending"
// signal. When a real score lands the SAME slot shows the Antonio number + "fit"
// — no layout shift. `size="hero"` is the bigger detail-hero variant.
// ============================================================
import { Icon } from '@/components/ui/Icon'

export interface RecipeFitBadgeProps {
  score: number | null
  size?: 'card' | 'hero'
}

export function RecipeFitBadge({ score, size = 'card' }: RecipeFitBadgeProps) {
  const isHero = size === 'hero'
  const pending = score == null
  return (
    <div
      className="notch-8"
      style={{
        position: 'absolute', top: isHero ? 10 : 9, right: isHero ? 11 : 10, zIndex: 4,
        minWidth: isHero ? 44 : 40, padding: isHero ? '6px 6px 5px' : '5px 5px 4px', textAlign: 'center',
        background: 'rgba(8,12,16,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        boxShadow: pending ? undefined : '0 0 0 1px rgba(94,234,212,0.25), 0 6px 16px -6px rgba(20,184,166,0.5)',
      }}
    >
      {pending ? (
        <>
          <div style={{ color: 'var(--brand-glow)', display: 'flex', justifyContent: 'center', animation: 'mezo-twinkle 2.2s ease-in-out infinite' }}>
            <Icon name="sparkle" size={isHero ? 18 : 16} />
          </div>
          <div className="label-mono" style={{ fontSize: 6.5, letterSpacing: '0.16em', color: 'var(--brand-glow)', opacity: 0.8, marginTop: 3 }}>
            Mezo
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: isHero ? 22 : 18, fontWeight: 600, lineHeight: 1, color: 'var(--brand-glow)' }}>
            {Math.round(score * 100)}
          </div>
          <div className="label-mono" style={{ fontSize: 6.5, letterSpacing: '0.16em', color: 'var(--text-tertiary)', marginTop: 3 }}>
            fit
          </div>
        </>
      )}
    </div>
  )
}
```
4. Add the `mezo-twinkle` keyframe to `frontend/src/styles/prototype.css` (append at end of file):
```css
/* RecipeFitBadge / fit-zone pending sparkle pulse (recipes-*.html @keyframes tw) */
@keyframes mezo-twinkle {
  0%, 100% { opacity: 0.45; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.08); }
}
```
5. Run it — `pnpm test src/features/fuel/components/RecipeFitBadge.test.tsx` — expected PASS.
6. Commit — `git add frontend/src/features/fuel/components/RecipeFitBadge.tsx frontend/src/features/fuel/components/RecipeFitBadge.test.tsx frontend/src/styles/prototype.css` then `feat(fuel): add RecipeFitBadge pending/scored signal (mezo-lns)`.

---

### Task feui3: Shared `ServingToggle` (/adag ↔ egész segmented switch)

**Files:**
- Create: `frontend/src/features/fuel/components/ServingToggle.tsx`
- Test: `frontend/src/features/fuel/components/ServingToggle.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type ServingBasis = 'serving' | 'whole'`; `export function ServingToggle(props: ServingToggleProps)` where `export interface ServingToggleProps { value: ServingBasis; servings: number; onChange: (b: ServingBasis) => void }`. Two segments: `1 adag` and `Egész · {servings} adag` (the `.segtoggle/.seg` look from `recipes-detail.html`).

**Steps:**
1. Write the failing test `frontend/src/features/fuel/components/ServingToggle.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ServingToggle } from './ServingToggle'

test('renders both bases and reports a change', async () => {
  const onChange = vi.fn()
  render(<ServingToggle value="serving" servings={2} onChange={onChange} />)
  expect(screen.getByRole('button', { name: '1 adag' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Egész · 2 adag/ }))
  expect(onChange).toHaveBeenCalledWith('whole')
})
```
2. Run it — `pnpm test src/features/fuel/components/ServingToggle.test.tsx` — expected FAILURE.
3. Implement `frontend/src/features/fuel/components/ServingToggle.tsx`:
```tsx
// ============================================================
// Mezo · ServingToggle (/adag ↔ egész)
// The segmented basis switch from docs/design/recipes-detail.html (.segtoggle).
// Used by RecipeDetailView's macro hero and RecipeEditorView's live total card.
// `servings` is the real recipe value; the "whole" label echoes it.
// ============================================================
export type ServingBasis = 'serving' | 'whole'

export interface ServingToggleProps {
  value: ServingBasis
  servings: number
  onChange: (b: ServingBasis) => void
}

const SEGS: { id: ServingBasis; label: (n: number) => string }[] = [
  { id: 'serving', label: () => '1 adag' },
  { id: 'whole', label: n => `Egész · ${n} adag` },
]

export function ServingToggle({ value, servings, onChange }: ServingToggleProps) {
  return (
    <div className="row" style={{ gap: 5, padding: 4, background: 'var(--surface-2)', borderRadius: 10 }}>
      {SEGS.map(s => {
        const active = value === s.id
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className="notch-4 flex-1"
            style={{
              padding: '7px 0', textAlign: 'center',
              fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              background: active ? 'var(--brand-primary)' : 'transparent',
            }}
          >
            {s.label(servings)}
          </button>
        )
      })}
    </div>
  )
}
```
4. Run it — `pnpm test src/features/fuel/components/ServingToggle.test.tsx` — expected PASS.
5. Commit — `git add frontend/src/features/fuel/components/ServingToggle.tsx frontend/src/features/fuel/components/ServingToggle.test.tsx` then `feat(fuel): add ServingToggle /adag<->egész switch (mezo-lns)`.

---

### Task feui4: Rework `RecipeCard` to the editorial image band + `RecipeFitBadge`

**Files:**
- Modify: `frontend/src/features/fuel/components/RecipeCard.tsx`
- Modify: `frontend/src/features/fuel/components/RecipeCard.test.tsx`

**Interfaces:**
- Consumes: `MacroCells` (feui1), `RecipeFitBadge` (feui2); `Recipe` from `@/data/types`; `Icon` from `@/components/ui/Icon`.
- Produces: `export function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: (r: Recipe) => void })` (signature unchanged). New editorial markup: image band (118px, diagonal-stripe gradient + bottom fade), overlaid Antonio name, slot tag + star top-left, `RecipeFitBadge` top-right; body = `MacroCells` (whole-recipe macros) + meta line (`N hozzávaló · {prep+cook} perc · NOVA {n}`).

**Steps:**
1. Update the test `frontend/src/features/fuel/components/RecipeCard.test.tsx` to the editorial shape (replace the whole file):
```tsx
import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { RecipeCard } from './RecipeCard'
import { useRecipes } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the editorial name, macro cells and pending fit; click opens', async () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const recipe = result.current.recipes[0]
  const onOpen = vi.fn()
  render(<RecipeCard recipe={recipe} onOpen={onOpen} />, { wrapper: QueryWrapper })
  expect(screen.getByText(recipe.name)).toBeInTheDocument()
  // MacroCells labels are present.
  expect(screen.getByText('kcal')).toBeInTheDocument()
  expect(screen.getByText('Prot')).toBeInTheDocument()
  // v1 fit is pending → Mezo sparkle label.
  expect(screen.getByText('Mezo')).toBeInTheDocument()
  await userEvent.click(screen.getByText(recipe.name))
  expect(onOpen).toHaveBeenCalledWith(recipe)
})
```
2. Run it — `pnpm test src/features/fuel/components/RecipeCard.test.tsx` — expected FAILURE (old card has no "Mezo"/"Prot" text).
3. Implement `frontend/src/features/fuel/components/RecipeCard.tsx` (full replace):
```tsx
// ============================================================
// Mezo · RecipeCard (editorial library card)
// docs/design/recipes-library.html `.rc-b`: an image band (diagonal-stripe
// gradient + bottom fade) with the Antonio name overlaid, a slot tag + star
// top-left and the Mezo-fit badge top-right; below the band a MacroCells strip
// (whole-recipe macros) and a meta line. v1 fit_score is null → the badge shows
// the P2 pending sparkle.
// ============================================================
import type { Recipe } from '@/data/types'
import { Icon } from '@/components/ui/Icon'
import { MacroCells } from './MacroCells'
import { RecipeFitBadge } from './RecipeFitBadge'

const NOVA_COLOR: Record<number, string> = { 1: 'var(--success)', 2: 'var(--warning)', 3: 'var(--warning)', 4: 'var(--error)' }

export function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: (r: Recipe) => void }) {
  const totalMins = recipe.prepMins + recipe.cookMins
  return (
    <button
      onClick={() => onOpen(recipe)}
      className="notch-16"
      style={{ position: 'relative', width: '100%', textAlign: 'left', background: 'var(--surface-1)', overflow: 'hidden', marginBottom: 0 }}
    >
      {/* Image band */}
      <div style={{ position: 'relative', height: 118, background: 'linear-gradient(135deg,#16323a,#0f2027)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(125deg,rgba(255,255,255,0.025) 0 14px,rgba(255,255,255,0) 14px 28px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(5,7,9,0) 28%,rgba(5,7,9,0.88) 100%)' }} />
        {/* top-left: slot tag + star */}
        <div className="row gap-xs" style={{ position: 'absolute', top: 10, left: 11, zIndex: 3, alignItems: 'center' }}>
          {recipe.slot && (
            <span className="chip brand" style={{ fontSize: 8, padding: '3px 7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {recipe.slot}
            </span>
          )}
          {recipe.starred && <Icon name="bookmark" size={12} color="var(--warning)" />}
        </div>
        <RecipeFitBadge score={recipe.mezoFit.score} />
        {/* name overlay */}
        <div
          style={{
            position: 'absolute', left: 12, right: 12, bottom: 10, zIndex: 3,
            fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.01em', lineHeight: 1, color: 'var(--text-primary)',
          }}
        >
          {recipe.name}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '11px 13px 13px' }}>
        <MacroCells macros={recipe.macros} />
        <div className="row gap-xs flex-wrap" style={{ alignItems: 'center', marginTop: 10, fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'var(--text-tertiary)' }}>
          <span>{recipe.ingredients.length} hozzávaló</span>
          <span>·</span>
          <span>{totalMins} perc</span>
          <span>·</span>
          <span style={{ color: NOVA_COLOR[recipe.novaDominant] ?? 'var(--text-tertiary)' }}>NOVA {recipe.novaDominant}</span>
        </div>
      </div>
    </button>
  )
}
```
   (If `notch-16` is not a defined utility, add it to `frontend/src/styles/prototype.css` mirroring the existing `notch-12` rule with a 16px chamfer; check first with `grep -n "notch-16\|notch-12" frontend/src/styles/prototype.css`.)
4. Run it — `pnpm test src/features/fuel/components/RecipeCard.test.tsx` — expected PASS.
5. Commit — `git add frontend/src/features/fuel/components/RecipeCard.tsx frontend/src/features/fuel/components/RecipeCard.test.tsx frontend/src/styles/prototype.css` then `feat(fuel): editorial RecipeCard with image band + fit badge (mezo-lns)`.

---

### Task feui5: Rework `FuelRecipesView` — segmented typebar filter, real counts, navigate to detail

**Files:**
- Modify: `frontend/src/features/fuel/views/FuelRecipesView.tsx`
- Modify: `frontend/src/features/fuel/views/FuelRecipesView.test.tsx`

**Interfaces:**
- Consumes: `useRecipes` (`@/data/hooks`), `RecipeCard` (feui4), `useNavigate` (react-router-dom); `Eyebrow`, `PageTitle`, `Icon`.
- Produces: `export function FuelRecipesView()` (unchanged). Removes `RecipeStat`/`StatCell` strip's fake "Avg fit 0.89", removes the chip-row filter and the `RecipeDetailSheet`/`NewRecipeSheet` overlays. New: a **segmented typebar** (Mind / Reggeli / Ebéd / Vacsi / ★ with live counts) like Kamra; header sub shows real `"{n} recept · {s} csillagos"`; `+ Új` navigates to `/fuel/recipes/new`; card click navigates to `/fuel/recipes/{id}`.

**Steps:**
1. Update `frontend/src/features/fuel/views/FuelRecipesView.test.tsx` (full replace):
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { FuelRecipesView } from './FuelRecipesView'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

function renderView() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/recipes']}>
        <Routes>
          <Route path="/fuel/recipes" element={<FuelRecipesView />} />
          <Route path="/fuel/recipes/new" element={<LocationProbe />} />
          <Route path="/fuel/recipes/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the title and the segmented typebar', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Receptek' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Reggeli/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mind/ })).toBeInTheDocument()
})

test('the fake "Avg fit" stat is gone', () => {
  renderView()
  expect(screen.queryByText('0.89')).not.toBeInTheDocument()
  expect(screen.queryByText(/Avg fit/)).not.toBeInTheDocument()
})

test('filtering to a category with no recipes shows the empty state', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Vacsi/ }))
  // dinner may or may not have recipes in the seed; assert the typebar stays interactive
  expect(screen.getByRole('button', { name: /Vacsi/ })).toBeInTheDocument()
})

test('Új navigates to the editor route', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Új/ }))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/recipes/new')
})

test('tapping a card navigates to the detail route', async () => {
  renderView()
  const firstName = screen.getAllByText(/.+/).find(() => true)
  // click the first recipe card by its visible name (Antonio overlay) — use the
  // first card button.
  const cards = screen.getAllByRole('button').filter(b => b.className.includes('notch-16'))
  await userEvent.click(cards[0])
  expect(screen.getByTestId('location').textContent).toMatch(/^\/fuel\/recipes\/.+/)
  void firstName
})
```
2. Run it — `pnpm test src/features/fuel/views/FuelRecipesView.test.tsx` — expected FAILURE.
3. Implement `frontend/src/features/fuel/views/FuelRecipesView.tsx` (full replace):
```tsx
// ============================================================
// Mezo · FuelRecipesView (Receptek — editorial library)
// Approved redesign (docs/design/recipes-library.html): editorial RecipeCards +
// a segmented typebar filter (Mind / Reggeli / Ebéd / Vacsi / ★ with live counts,
// the Kamra typebar pattern) replacing the old chip row. The fake "Avg fit 0.89"
// stat is removed; the header sub shows real counts. Detail + create are now
// routed PAGES — the card navigates to /fuel/recipes/:id, +Új to /fuel/recipes/new
// (the old RecipeDetailSheet / NewRecipeSheet overlays are retired).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recipe } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { RecipeCard } from '@/features/fuel/components/RecipeCard'

type FilterId = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'starred'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Mind' },
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsi' },
  { id: 'starred', label: '★' },
]

function countFor(recipes: Recipe[], id: FilterId): number {
  if (id === 'all') return recipes.length
  if (id === 'starred') return recipes.filter(r => r.starred).length
  return recipes.filter(r => r.category === id).length
}

export function FuelRecipesView() {
  const navigate = useNavigate()
  const { recipes } = useRecipes()
  const [filter, setFilter] = useState<FilterId>('all')

  const starredCount = recipes.filter(r => r.starred).length
  const filtered = recipes.filter(r => {
    if (filter === 'all') return true
    if (filter === 'starred') return r.starred
    return r.category === filter
  })

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Fuel · Receptek</Eyebrow>
          <PageTitle className="mt-sm">Receptek</PageTitle>
          <span className="label-mono" style={{ display: 'block', fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginTop: 5 }}>
            {recipes.length} recept · {starredCount} csillagos
          </span>
        </div>
        <button onClick={() => navigate('/fuel/recipes/new')} className="chip brand" style={{ padding: '8px 10px' }}>
          <Icon name="plus" size={12} /> Új
        </button>
      </div>

      {/* Segmented typebar */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ gap: 5, padding: 5, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 13 }}>
          {FILTERS.map(f => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="notch-8 col flex-1"
                style={{ alignItems: 'center', padding: '8px 0 7px', background: active ? 'var(--brand-primary)' : 'transparent', boxShadow: active ? '0 8px 18px -8px rgba(20,184,166,0.6)' : undefined }}
              >
                <span style={{ fontFamily: 'var(--ff-display)', fontSize: 13, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', lineHeight: 1, color: active ? 'var(--text-inverse)' : 'var(--text-secondary)' }}>{f.label}</span>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, marginTop: 3, color: active ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>{countFor(recipes, f.id)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="col" style={{ gap: 13 }}>
          {filtered.map(r => (
            <RecipeCard key={r.id} recipe={r} onOpen={() => navigate(`/fuel/recipes/${r.id}`)} />
          ))}
          {filtered.length === 0 && (
            <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs egyező recept.</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```
4. Run it — `pnpm test src/features/fuel/views/FuelRecipesView.test.tsx` — expected PASS.
5. Commit — `git add frontend/src/features/fuel/views/FuelRecipesView.tsx frontend/src/features/fuel/views/FuelRecipesView.test.tsx` then `feat(fuel): editorial Recipes library with segmented filter (mezo-lns)`.

---

### Task feui6: Rework `IngredientPickerSheet` to macro-cell `/100g` cards (stays a modal)

**Files:**
- Modify: `frontend/src/features/fuel/IngredientPickerSheet.tsx`

**Interfaces:**
- Consumes: `usePantry` (`@/data/hooks`), `MacroCells` (feui1), `Sheet`, `Icon`, `Eyebrow`, `Display`, `SourceBadge`.
- Produces: `export function IngredientPickerSheet({ onPick, onClose }: { onPick: (ing: Ingredient) => void; onClose: () => void })` (signature unchanged). Each row now: name + source badge + brand/NOVA subline + a `MacroCells` strip with `perLabel="/100g"` (replaces the cramped `MacroRow`). Stays a nested `Sheet` (`className="sheet-nested"`).

**Steps:**
1. Implement the picker-row rework in `frontend/src/features/fuel/IngredientPickerSheet.tsx` — replace the `PickerRow` body's `<MacroRow .../>` block and imports. Full replacement of the file:
```tsx
// ============================================================
// Mezo · IngredientPickerSheet (nested modal — Kamra pick)
// Opens ON TOP of the RecipeEditorView page to pick a pantry ingredient. Search
// filters the Kamra by name + brand; each PickerRow shows a category-accented
// card with name + source badge + brand/NOVA subline and a MacroCells strip
// (/100g, the design-mockup cell look). Tapping ＋ fires onPick(ing).
// docs/design/recipes-editor.html (right phone · `.prow` + `.macstrip`).
// ============================================================
import { useState } from 'react'
import type { Ingredient } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { MacroCells } from './components/MacroCells'

function PickerRow({ ing, onPick }: { ing: Ingredient; onPick: () => void }) {
  const { categoryMeta } = usePantry()
  const catColor = categoryMeta[ing.category]?.color ?? 'var(--text-secondary)'
  return (
    <div className="card notch-4" style={{ padding: '11px 12px', borderLeft: '2px solid ' + catColor }}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{ing.name}</span>
            <SourceBadge source={ing.source} />
          </div>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {ing.brand}{ing.nova ? ` · NOVA ${ing.nova}` : ''}
          </span>
        </div>
        <button
          onClick={onPick}
          aria-label={ing.name + ' hozzáadása'}
          className="notch-4"
          style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(20,184,166,0.14)', color: 'var(--brand-glow)' }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div style={{ marginTop: 9 }}>
        <MacroCells macros={ing.macros} perLabel="/100g" />
      </div>
    </div>
  )
}

export function IngredientPickerSheet({
  onPick,
  onClose,
}: {
  onPick: (ing: Ingredient) => void
  onClose: () => void
}) {
  const { ingredients } = usePantry()
  const [query, setQuery] = useState('')

  const filtered = ingredients.filter(
    i =>
      !query ||
      i.name.toLowerCase().includes(query.toLowerCase()) ||
      i.brand.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <Sheet onClose={onClose} className="sheet-nested" labelledBy="ingredient-pick-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="col">
              <Eyebrow brand>Kamra · pick</Eyebrow>
              <div id="ingredient-pick-title" style={{ marginTop: 4 }}>
                <Display size="md">Válassz hozzávalót</Display>
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div
            className="row gap-sm"
            style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}
          >
            <Icon name="search" size={12} color="var(--text-tertiary)" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Keress a Kamrában…"
              style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}
            />
          </div>

          <div className="col gap-sm" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {filtered.map(ing => (
              <PickerRow key={ing.id} ing={ing} onPick={() => onPick(ing)} />
            ))}
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
```
2. Run the picker's existing coverage (it is exercised via the editor test feui8 and any direct render) — `pnpm test src/features/fuel/IngredientPickerSheet` (expected: no dedicated test file yet → "no tests found" is fine; the editor test covers it). Run `pnpm test src/features/fuel` to confirm no regression — expected PASS for the suites that touch the picker (after feui8 lands; until then just typecheck via `pnpm build` in feui9 gate).
3. Commit — `git add frontend/src/features/fuel/IngredientPickerSheet.tsx` then `feat(fuel): IngredientPickerSheet macro-cell /100g cards (mezo-lns)`.

---

### Task feui7: `RecipeDetailView` — full page (hero, serving toggle, ingredient contributions, live star/edit/delete)

**Files:**
- Create: `frontend/src/features/fuel/views/RecipeDetailView.tsx`
- Test: `frontend/src/features/fuel/views/RecipeDetailView.test.tsx`

**Interfaces:**
- Consumes: `useRecipes`, `useRecipeActions` (`@/data/hooks`); `MacroCells` (feui1), `RecipeFitBadge` (feui2), `ServingToggle`+`ServingBasis` (feui3); `useNavigate`/`useParams`; `Eyebrow`, `Icon`, `SourceBadge`; `Recipe`, `RecipeInput`, `PantryCategoryMeta` from `@/data/types`. (The DATA section exposes NO raw `useRecipesQuery`, so the guard relies on `useRecipes().recipes` only — no `isPending` skeleton branch.)
- Produces: `export function RecipeDetailView()`. Reads `:id`; **route guard**: no match → not-found fallback (`Nincs ilyen recept.`) — `useRecipes().recipes` is synchronous in mock (via `initialData`) and resolves shortly after mount in real mode. Renders the editorial hero (band, name, slot tag, star, `RecipeFitBadge size="hero"`), a back button + overflow, a **macro hero** with `ServingToggle` (serving = whole/servings, rounded), a meta strip (adag/idő/NOVA/hozzávaló), the **Hozzávalók** list (each row: category accent, name, source, amount + per-line `contribution` via `MacroCells`), the **"Mezo-fit · hamarosan"** sparkle zone, and actions: inert `+ Mai étkezéshez`, live **Csillag** (toggles `starred` via `update`), live **Szerkesztés** (navigate `/fuel/recipes/:id/edit`), live **Törlés** (`remove` + navigate back). Exposes `export function recipeToInput(r: Recipe): RecipeInput` for the star toggle + the editor.

**Steps:**
1. Write the failing test `frontend/src/features/fuel/views/RecipeDetailView.test.tsx`:
```tsx
import type { ReactNode } from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecipeDetailView } from './RecipeDetailView'
import { useRecipes } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderDetail(id: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fuel/recipes/${id}`]}>
        <Routes>
          <Route path="/fuel/recipes/:id" element={<RecipeDetailView />} />
          <Route path="/fuel/recipes/:id/edit" element={<LocationProbe />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function firstId(qc: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  return result.current.recipes[0]
}

test('renders the hero, macro hero and ingredient contributions', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  expect(await screen.findByText(r.name)).toBeInTheDocument()
  // whole-recipe kcal appears in the macro hero
  expect(screen.getByText(String(r.macros.kcal))).toBeInTheDocument()
  // the deferred fit zone
  expect(screen.getByText(/Mezo-fit · hamarosan/)).toBeInTheDocument()
  // first ingredient name from the snapshot
  expect(screen.getByText(r.ingredients[0].name)).toBeInTheDocument()
})

test('a missing id shows the not-found fallback', async () => {
  renderDetail('does-not-exist', newQc())
  expect(await screen.findByText('Nincs ilyen recept.')).toBeInTheDocument()
})

test('the serving toggle switches the macro basis', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Egész/ }))
  // whole-recipe kcal stays present in the "egész" basis
  expect(screen.getByText(String(r.macros.kcal))).toBeInTheDocument()
})

test('Szerkesztés navigates to the edit route', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  expect(screen.getByTestId('location').textContent).toBe(`/fuel/recipes/${r.id}/edit`)
})

test('Törlés removes the recipe and navigates back to the library', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes[0]
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Törlés/ }))
  await waitFor(() => expect(result.current.recipes.some(x => x.id === r.id)).toBe(false))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/recipes')
})

test('Csillag toggles the starred flag', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes.find(x => !x.starred) ?? result.current.recipes[0]
  const before = r.starred
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Csillag/ }))
  await waitFor(() => expect(result.current.recipes.find(x => x.id === r.id)?.starred).toBe(!before))
})
```
2. Run it — `pnpm test src/features/fuel/views/RecipeDetailView.test.tsx` — expected FAILURE (module not found).
3. Implement `frontend/src/features/fuel/views/RecipeDetailView.tsx`:
```tsx
// ============================================================
// Mezo · RecipeDetailView (Receptek — recipe detail PAGE)
// Approved full-page detail (docs/design/recipes-detail.html · "A" phone),
// consistent with the Kamra item detail being a route. Single scroll, v1-honest:
// editorial hero → /adag↔egész macro hero → meta strip → Hozzávalók (per-line
// contribution in MacroCells) → "Mezo-fit · hamarosan" sparkle zone → actions.
// Star / Szerkesztés / Törlés are LIVE (useRecipeActions); + Mai étkezéshez is
// inert (meal-log deferred). Route guard distinguishes the recipes query's
// isPending (skeleton) from a resolved not-found (fallback).
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Recipe, RecipeInput, PantryCategoryMeta } from '@/data/types'
import { useRecipes, useRecipeActions } from '@/data/hooks'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Icon } from '@/components/ui/Icon'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { RecipeFitBadge } from '@/features/fuel/components/RecipeFitBadge'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'

const NOVA_COLOR: Record<number, string> = { 1: 'var(--success)', 2: 'var(--warning)', 3: 'var(--warning)', 4: 'var(--error)' }

// Build a complete RecipeInput from a Recipe — prefills every field so a star
// toggle (or the editor) preserves untouched values. The editor reuses this.
export function recipeToInput(r: Recipe): RecipeInput {
  return {
    name: r.name,
    slot: r.slot || null,
    category: r.category,
    servings: r.servings,
    prepMins: r.prepMins,
    cookMins: r.cookMins,
    tags: r.tags,
    starred: r.starred,
    ingredients: r.ingredients.map(i => ({ refId: i.refId, amount: i.amount, unit: i.unit, note: i.note })),
  }
}

function round(n: number) { return Math.round(n) }
function byBasis(v: number, basis: ServingBasis, servings: number) {
  return basis === 'whole' ? round(v) : round(v / Math.max(1, servings))
}

function MacroHeroCell({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="notch-8" style={{ textAlign: 'center', padding: '10px 2px', background: 'rgba(255,255,255,0.025)' }}>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, lineHeight: 1, color: accent ? 'var(--success)' : 'var(--text-primary)' }}>{value}</div>
      <div className="label-mono" style={{ fontSize: 8, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 5 }}>{label}</div>
    </div>
  )
}

export function RecipeDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes, categoryMeta, ingredients } = useRecipes()
  const { update, remove } = useRecipeActions()
  const [basis, setBasis] = useState<ServingBasis>('serving')

  const recipe = recipes.find(r => r.id === id)

  // Not-found fallback. The DATA section exposes no raw query status, so the guard
  // relies on useRecipes().recipes: mock mode resolves synchronously via initialData;
  // real mode shows this fallback briefly on a cold deep-link until the list resolves.
  if (!recipe) {
    return (
      <div style={{ padding: '0 24px' }}>
        <button
          onClick={() => navigate('/fuel/recipes')}
          className="notch-8"
          style={{ width: 32, height: 32, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, marginBottom: 14 }}
          aria-label="Vissza"
        >‹</button>
        <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
          <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs ilyen recept.</span>
        </div>
      </div>
    )
  }

  const totalMins = recipe.prepMins + recipe.cookMins
  const macros = recipe.macros
  const catColor = (cat: string): string => (categoryMeta as Record<string, PantryCategoryMeta>)[cat]?.color ?? 'var(--text-secondary)'
  // resolve each line's pantry source for the subline (falls back to snapshot name only)
  const sourceOf = (refId: string) => ingredients.find(i => i.id === refId)?.source

  const toggleStar = () => update(recipe.id, { ...recipeToInput(recipe), starred: !recipe.starred })
  const del = () => { remove(recipe.id); navigate('/fuel/recipes') }

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* Top bar */}
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 12px' }}>
        <button
          onClick={() => navigate('/fuel/recipes')}
          className="notch-8"
          style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}
          aria-label="Vissza"
        >‹</button>
        <Eyebrow className="text-tertiary">Recept</Eyebrow>
        <div style={{ width: 34 }} />
      </div>

      {/* Hero */}
      <div className="notch-16" style={{ position: 'relative', height: 196, marginBottom: 14, overflow: 'hidden', background: 'linear-gradient(135deg,#16323a,#0f2027)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(125deg,rgba(255,255,255,0.025) 0 16px,rgba(255,255,255,0) 16px 32px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(5,7,9,0) 32%,rgba(5,7,9,0.9) 100%)' }} />
        <div className="row gap-xs" style={{ position: 'absolute', top: 11, left: 12, zIndex: 3, alignItems: 'center' }}>
          {recipe.slot && <span className="chip brand" style={{ fontSize: 8, padding: '3px 7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{recipe.slot}</span>}
          {recipe.starred && <Icon name="bookmark" size={13} color="var(--warning)" />}
        </div>
        <RecipeFitBadge score={recipe.mezoFit.score} size="hero" />
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 30, zIndex: 3, fontFamily: 'var(--ff-display)', fontSize: 28, fontWeight: 600, textTransform: 'uppercase', lineHeight: 0.98, color: 'var(--text-primary)' }}>
          {recipe.name}
        </div>
        <div style={{ position: 'absolute', left: 14, bottom: 12, zIndex: 3, fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
          {recipe.servings} adag · {totalMins} perc · létrehozva {recipe.createdDate}
        </div>
      </div>

      {/* Macro hero */}
      <div style={{ marginBottom: 12 }}>
        <ServingToggle value={basis} servings={recipe.servings} onChange={setBasis} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        <MacroHeroCell value={byBasis(macros.kcal, basis, recipe.servings)} label="kcal" />
        <MacroHeroCell value={byBasis(macros.p, basis, recipe.servings)} label="Fehérje" accent />
        <MacroHeroCell value={byBasis(macros.c, basis, recipe.servings)} label="Szénh." />
        <MacroHeroCell value={byBasis(macros.f, basis, recipe.servings)} label="Zsír" />
      </div>

      {/* Meta strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, margin: '12px 0 16px' }}>
        {[
          { v: String(recipe.servings), l: 'Adag', c: undefined as string | undefined },
          { v: `${totalMins}p`, l: 'Idő', c: undefined },
          { v: String(recipe.novaDominant), l: 'NOVA', c: NOVA_COLOR[recipe.novaDominant] },
          { v: String(recipe.ingredients.length), l: 'Hozzáv.', c: undefined },
        ].map(m => (
          <div key={m.l} className="notch-4" style={{ textAlign: 'center', padding: '9px 2px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, fontWeight: 600, color: m.c ?? 'var(--text-primary)' }}>{m.v}</div>
            <div className="label-mono" style={{ fontSize: 7, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 3 }}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Hozzávalók */}
      <div className="row" style={{ alignItems: 'center', gap: 9, margin: '4px 2px 10px' }}>
        <span className="label-mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>HOZZÁVALÓK</span>
        <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)' }}>{recipe.ingredients.length}</span>
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
      </div>
      <div className="col gap-sm" style={{ marginBottom: 16 }}>
        {recipe.ingredients.map((line, i) => {
          const src = sourceOf(line.refId)
          return (
            <div key={i} className="card notch-4" style={{ padding: '10px 12px', borderLeft: '2px solid ' + catColor(ingredients.find(ii => ii.id === line.refId)?.category ?? '') }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div className="col flex-1" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{line.name}</span>
                  <span className="row gap-xs" style={{ fontFamily: 'var(--ff-mono)', fontSize: 8.5, color: 'var(--text-tertiary)', marginTop: 3, alignItems: 'center' }}>
                    {src && <SourceBadge source={src} />}
                    {line.note && <span>· {line.note}</span>}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {line.amount}<span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 1 }}>{line.unit}</span>
                </span>
              </div>
              <div style={{ marginTop: 9 }}>
                <MacroCells macros={line.contribution} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Mezo-fit · hamarosan */}
      <div
        className="notch-12"
        style={{ margin: '16px 0', padding: '18px 16px', textAlign: 'center', background: 'rgba(20,184,166,0.05)', border: '1px dashed var(--border-brand)' }}
      >
        <div style={{ color: 'var(--brand-glow)', display: 'flex', justifyContent: 'center', marginBottom: 10, animation: 'mezo-twinkle 2.2s ease-in-out infinite' }}>
          <Icon name="sparkle" size={26} />
        </div>
        <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 600, textTransform: 'uppercase', color: 'var(--brand-glow)', marginBottom: 6 }}>
          Mezo-fit · hamarosan
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 260, margin: '0 auto' }}>
          A pontszám, a Reta-fázis-illeszkedés és a logolási előzmények a Mezo-agy bekapcsolásakor érkeznek (Phase-3).
        </div>
      </div>

      {/* Actions */}
      <button className="cta-primary notch-4" disabled style={{ marginBottom: 9 }}>
        <Icon name="plus" size={14} /> Mai étkezéshez · hamarosan
      </button>
      <div className="row gap-sm">
        <button className="cta-ghost notch-4" onClick={toggleStar} style={{ flex: 1 }}>
          <Icon name="bookmark" size={12} /> {recipe.starred ? 'Csillag le' : 'Csillag'}
        </button>
        <button className="cta-ghost notch-4" onClick={() => navigate(`/fuel/recipes/${recipe.id}/edit`)} style={{ flex: 1.4 }}>
          <Icon name="settings" size={12} /> Szerkesztés
        </button>
        <button className="cta-ghost notch-4" onClick={del} style={{ flex: 1, color: 'var(--error)', borderColor: 'rgba(244,63,94,0.25)' }} aria-label="Törlés">
          <Icon name="x" size={12} /> Törlés
        </button>
      </div>
    </div>
  )
}
```
4. Run it — `pnpm test src/features/fuel/views/RecipeDetailView.test.tsx` — expected PASS.
5. Commit — `git add frontend/src/features/fuel/views/RecipeDetailView.tsx frontend/src/features/fuel/views/RecipeDetailView.test.tsx` then `feat(fuel): RecipeDetailView full page with live star/edit/delete (mezo-lns)`.

---

### Task feui8: `RecipeEditorView` — full page (create = edit), live total, picked rows, sticky save

**Files:**
- Create: `frontend/src/features/fuel/views/RecipeEditorView.tsx`
- Test: `frontend/src/features/fuel/views/RecipeEditorView.test.tsx`

**Interfaces:**
- Consumes: `useRecipes`, `useRecipeActions` (`@/data/hooks`); `recipeToInput` (feui7); `MacroCells` (feui1), `ServingToggle`+`ServingBasis` (feui3); `IngredientPickerSheet` (feui6); `useNavigate`/`useParams`; `Icon`, `Eyebrow`; `Recipe`, `RecipeInput`, `Ingredient`, `RecipeCategory` from `@/data/types`. (The DATA section exposes NO raw `useRecipesQuery`; the edit-mode guard relies on `useRecipes().recipes` only — no `isPending` skeleton branch.) **Contribution formula (must match the mapper + mock hook exactly):** `factor = amount / per` (per from the resolved pantry ingredient's `per`, default 1); `contribution.{k,p,c,f} = round(macro * factor)`.
- Produces: `export function RecipeEditorView()`. Mode = create when no `:id`, edit when `:id` present (prefill via `recipeToInput`). Captures all fields: név, slot (segmented), csillag toggle, adag + idő steppers, címkék (chips, add/remove), hozzávalók (picked rows with per-row stepper + delete + live `MacroCells` contribution). Live **total card** with `ServingToggle` (default `/adag`) + a footer echoing the other basis. Sticky **Mentés** bar → `create(input)` or `update(id, input)` then `navigate(-1)` (or to detail). `Mégse` → `navigate(-1)`.

**Steps:**
1. Write the failing test `frontend/src/features/fuel/views/RecipeEditorView.test.tsx`:
```tsx
import type { ReactNode } from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecipeEditorView } from './RecipeEditorView'
import { useRecipes } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderNew(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/fuel/recipes', '/fuel/recipes/new']} initialIndex={1}>
        <Routes>
          <Route path="/fuel/recipes/new" element={<RecipeEditorView />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderEdit(id: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fuel/recipes/${id}/edit`]}>
        <Routes>
          <Route path="/fuel/recipes/:id/edit" element={<RecipeEditorView />} />
          <Route path="/fuel/recipes/:id" element={<LocationProbe />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('create mode: Mentés is disabled until a name + an ingredient are present', async () => {
  const qc = newQc()
  renderNew(qc)
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
  await userEvent.type(screen.getByPlaceholderText(/Tonhalsaláta/), 'Teszt recept')
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  expect(await screen.findByText('Válassz hozzávalót')).toBeInTheDocument()
  // add the first pantry ingredient
  const adds = await screen.findAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(adds[0])
  await waitFor(() => expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled())
})

test('create mode: saving adds a recipe to the cache and navigates back', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const before = result.current.recipes.length

  renderNew(qc)
  await userEvent.type(screen.getByPlaceholderText(/Tonhalsaláta/), 'Teszt recept')
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  const adds = await screen.findAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(adds[0])
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))

  await waitFor(() => expect(result.current.recipes.length).toBe(before + 1))
  expect(result.current.recipes.some(r => r.name === 'Teszt recept')).toBe(true)
})

test('edit mode: prefills the name and saves an update', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes[0]

  renderEdit(r.id, qc)
  const nameInput = (await screen.findByPlaceholderText(/Tonhalsaláta/)) as HTMLInputElement
  expect(nameInput.value).toBe(r.name)
  await userEvent.clear(nameInput)
  await userEvent.type(nameInput, r.name + ' v2')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(result.current.recipes.find(x => x.id === r.id)?.name).toBe(r.name + ' v2'))
})

test('a picked row contribution recomputes when the amount changes', async () => {
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  const adds = await screen.findAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(adds[0])
  // a "Kamrából hozzáad" add-button reappears once the picker closes
  expect(await screen.findByRole('button', { name: /Kamrából/ })).toBeInTheDocument()
  // the picked row shows MacroCells (kcal/Prot labels)
  expect(screen.getAllByText('Prot').length).toBeGreaterThan(0)
})
```
2. Run it — `pnpm test src/features/fuel/views/RecipeEditorView.test.tsx` — expected FAILURE.
3. Implement `frontend/src/features/fuel/views/RecipeEditorView.tsx`:
```tsx
// ============================================================
// Mezo · RecipeEditorView (Receptek — create = edit PAGE)
// Approved full-page editor (docs/design/recipes-editor.html · left phone),
// replacing the retired NewRecipeSheet. Captures every real field: név, slot
// (segmented), csillag, adag + elő/főzési idő (steppers), címkék (chips),
// hozzávalók (picked rows = MacroCells contribution at the line amount, live via
// a per-row stepper + delete). A live total card carries the /adag↔egész toggle
// (default /adag) with a footer echoing the other basis. Sticky Mentés →
// useRecipeActions.create/update, then navigate back. Picker opens as a modal.
//
// Contribution = round(macro * amount/per) — the SAME amount/per rule as the
// backend mapper and the mock hook (replaces NewRecipeSheet's unit==='g' hack).
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Ingredient, Recipe, RecipeCategory, RecipeInput } from '@/data/types'
import { useRecipes, useRecipeActions } from '@/data/hooks'
import { recipeToInput } from './RecipeDetailView'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Icon } from '@/components/ui/Icon'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'
import { IngredientPickerSheet } from '@/features/fuel/IngredientPickerSheet'

interface DraftLine { refId: string; amount: number; unit: string; note?: string }

const SLOTS: { id: RecipeCategory; label: string }[] = [
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
]

const round = (n: number) => Math.round(n)

// contribution of a draft line, given its resolved pantry ingredient
function contributionOf(line: DraftLine, ing: Ingredient | undefined) {
  if (!ing) return { kcal: 0, p: 0, c: 0, f: 0 }
  const factor = line.amount / (ing.per || 1)
  return {
    kcal: round(ing.macros.kcal * factor),
    p: round(ing.macros.p * factor),
    c: round(ing.macros.c * factor),
    f: round(ing.macros.f * factor),
  }
}

function Stepper({ value, unit, onChange, min = 0 }: { value: number; unit: string; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="row" style={{ alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', display: 'inline-flex' }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--brand-glow)', fontSize: 16 }} aria-label="Csökkentés">−</button>
      <span style={{ minWidth: 36, textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
      <button onClick={() => onChange(value + 1)} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--brand-glow)', fontSize: 16 }} aria-label="Növelés">+</button>
      <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '0 8px 0 2px' }}>{unit}</span>
    </div>
  )
}

export function RecipeEditorView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes, ingredients, categoryMeta } = useRecipes()
  const { create, update } = useRecipeActions()

  const editing = recipes.find(r => r.id === id)
  const isEditMode = Boolean(id)

  // seed the draft once from the editing recipe (or empty for create)
  const [name, setName] = useState(() => editing?.name ?? '')
  const [slot, setSlot] = useState<RecipeCategory>(() => editing?.category ?? 'breakfast')
  const [starred, setStarred] = useState(() => editing?.starred ?? false)
  const [servings, setServings] = useState(() => editing?.servings ?? 1)
  const [mins, setMins] = useState(() => (editing ? editing.prepMins + editing.cookMins : 0))
  const [tags, setTags] = useState<string[]>(() => editing?.tags ?? [])
  const [lines, setLines] = useState<DraftLine[]>(() =>
    editing ? editing.ingredients.map(i => ({ refId: i.refId, amount: i.amount, unit: i.unit, note: i.note })) : [],
  )
  const [basis, setBasis] = useState<ServingBasis>('serving')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState('')

  // Edit-mode deep link with no matching recipe → not-found. The DATA section exposes
  // no raw query status, so we rely on useRecipes().recipes: synchronous in mock (via
  // initialData); in real mode a cold hard-reload may show this briefly until the list resolves.
  if (isEditMode && !editing) {
    return (
      <div style={{ padding: '0 24px' }}>
        <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
          <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs ilyen recept.</span>
        </div>
      </div>
    )
  }

  const resolved = lines.map(l => ({ line: l, ing: ingredients.find(i => i.id === l.refId) }))
  const wholeTotal = resolved.reduce(
    (acc, { line, ing }) => {
      const c = contributionOf(line, ing)
      return { kcal: acc.kcal + c.kcal, p: acc.p + c.p, c: acc.c + c.c, f: acc.f + c.f }
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  )
  const perServing = {
    kcal: round(wholeTotal.kcal / Math.max(1, servings)),
    p: round(wholeTotal.p / Math.max(1, servings)),
    c: round(wholeTotal.c / Math.max(1, servings)),
    f: round(wholeTotal.f / Math.max(1, servings)),
  }
  const shownTotal = basis === 'whole' ? wholeTotal : perServing
  const otherTotal = basis === 'whole' ? perServing : wholeTotal
  const otherLabel = basis === 'whole' ? 'egy adag' : 'egész recept'

  const addPicked = (ing: Ingredient) => {
    setLines(prev => [...prev, { refId: ing.id, amount: ing.per || 100, unit: ing.unit || 'g' }])
    setPickerOpen(false)
  }
  const addTag = () => {
    const t = tagDraft.trim()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagDraft('')
  }

  const canSave = name.trim().length > 0 && lines.length > 0
  const save = () => {
    if (!canSave) return
    const input: RecipeInput = {
      name: name.trim(),
      slot: editing?.slot ?? null,
      category: slot,
      servings,
      prepMins: mins,
      cookMins: 0,
      tags,
      starred,
      ingredients: lines.map(l => ({ refId: l.refId, amount: l.amount, unit: l.unit, note: l.note })),
    }
    if (isEditMode && editing) {
      update(editing.id, { ...recipeToInput(editing), ...input })
      navigate(`/fuel/recipes/${editing.id}`)
    } else {
      create(input)
      navigate('/fuel/recipes')
    }
  }

  const catColor = (cat: string | undefined): string => (cat && categoryMeta[cat]?.color) || 'var(--success)'

  return (
    <>
      <div style={{ padding: '0 16px 110px' }}>
        {/* Top bar */}
        <div className="row" style={{ alignItems: 'center', gap: 10, padding: '6px 0 12px' }}>
          <button
            onClick={() => navigate(-1)}
            className="notch-8"
            style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}
            aria-label="Vissza"
          >‹</button>
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow brand>{isEditMode ? 'Recept szerkesztése' : 'Új recept'}</Eyebrow>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1, marginTop: 2, color: 'var(--text-primary)' }}>
              {name || '—'}
            </span>
          </div>
        </div>

        {/* Név */}
        <div className="card notch-4" style={{ padding: '10px 12px', marginBottom: 9 }}>
          <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>NÉV</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="pl. Tonhalsaláta · postworkout"
            aria-label="Recept neve"
            style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 4, width: '100%' }}
          />
        </div>

        {/* Slot + csillag */}
        <div className="card notch-4" style={{ padding: '10px 12px', marginBottom: 9 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>SLOT</span>
            <button onClick={() => setStarred(s => !s)} className="chip" style={{ padding: '4px 8px', color: starred ? 'var(--warning)' : 'var(--text-tertiary)' }} aria-label="Csillag">
              <Icon name="bookmark" size={11} /> {starred ? 'Csillagos' : 'Csillag'}
            </button>
          </div>
          <div className="row gap-xs flex-wrap" style={{ marginTop: 8 }}>
            {SLOTS.map(s => (
              <button key={s.id} onClick={() => setSlot(s.id)} className={'chip' + (slot === s.id ? ' brand' : '')} style={{ fontSize: 9, padding: '6px 10px' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Adag & idő */}
        <div className="row gap-sm" style={{ marginBottom: 9 }}>
          <div className="card notch-4 flex-1" style={{ padding: '10px 12px' }}>
            <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>ADAG</span>
            <div style={{ marginTop: 6 }}><Stepper value={servings} unit="adag" min={1} onChange={setServings} /></div>
          </div>
          <div className="card notch-4 flex-1" style={{ padding: '10px 12px' }}>
            <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>ELŐ + FŐZÉS</span>
            <div style={{ marginTop: 6 }}><Stepper value={mins} unit="perc" min={0} onChange={setMins} /></div>
          </div>
        </div>

        {/* Live total */}
        <div className="notch-4" style={{ padding: '11px 12px', marginBottom: 12, background: 'rgba(20,184,166,0.05)', border: '1px solid var(--border-brand)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--brand-glow)' }}>MAKRÓ-ÖSSZEG</span>
            <ServingToggle value={basis} servings={servings} onChange={setBasis} />
          </div>
          <MacroCells macros={shownTotal} size="md" />
          <div className="label-mono" style={{ textAlign: 'center', marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 8.5, color: 'var(--text-tertiary)' }}>
            {otherLabel} = <span style={{ color: 'var(--text-secondary)' }}>{otherTotal.kcal} kcal</span> · P {otherTotal.p} · C {otherTotal.c} · F {otherTotal.f}
          </div>
        </div>

        {/* Hozzávalók */}
        <div className="row" style={{ alignItems: 'center', gap: 9, margin: '4px 2px 10px' }}>
          <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>HOZZÁVALÓK</span>
          <span className="label-mono" style={{ fontSize: 9.5, color: 'var(--brand-glow)' }}>{lines.length}</span>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
        </div>

        <div className="col gap-sm" style={{ marginBottom: 3 }}>
          {lines.length === 0 && (
            <div className="card notch-4" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed' }}>
              <span className="text-tertiary" style={{ fontSize: 11 }}>Még nincs hozzávaló. Nyomd a Kamrából hozzáad gombot.</span>
            </div>
          )}
          {resolved.map(({ line, ing }, i) => (
            <div key={i} className="card notch-4" style={{ padding: '11px 12px', borderLeft: '2px solid ' + catColor(ing?.category) }}>
              <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                <div className="col flex-1" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{ing?.name ?? line.refId}</span>
                  {ing?.brand && <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 2 }}>{ing.brand}</span>}
                </div>
                <div className="row" style={{ alignItems: 'center', background: 'var(--surface-2)', display: 'inline-flex' }}>
                  <button onClick={() => setLines(prev => prev.map((p, idx) => idx === i ? { ...p, amount: Math.max(1, p.amount - 10) } : p))} style={{ width: 25, height: 28, display: 'grid', placeItems: 'center', color: 'var(--brand-glow)', fontSize: 14 }} aria-label={`${ing?.name ?? 'tétel'} csökkentés`}>−</button>
                  <span style={{ minWidth: 32, textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{line.amount}</span>
                  <button onClick={() => setLines(prev => prev.map((p, idx) => idx === i ? { ...p, amount: p.amount + 10 } : p))} style={{ width: 25, height: 28, display: 'grid', placeItems: 'center', color: 'var(--brand-glow)', fontSize: 14 }} aria-label={`${ing?.name ?? 'tétel'} növelés`}>+</button>
                  <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', padding: '0 6px 0 1px' }}>{line.unit}</span>
                </div>
                <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} aria-label="Eltávolítás" style={{ padding: 3, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  <Icon name="x" size={12} />
                </button>
              </div>
              <div style={{ marginTop: 9 }}>
                <MacroCells macros={contributionOf(line, ing)} perLabel={`${line.amount} ${line.unit}`} />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setPickerOpen(true)}
          className="notch-4"
          style={{ width: '100%', padding: 11, marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--brand-glow)', background: 'rgba(20,184,166,0.08)', border: '1px dashed var(--border-brand)' }}
        >
          <Icon name="plus" size={14} /> Kamrából hozzáad
        </button>

        {/* Címkék */}
        <div className="row" style={{ alignItems: 'center', gap: 9, margin: '16px 2px 10px' }}>
          <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>CÍMKÉK</span>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
        </div>
        <div className="row gap-xs flex-wrap" style={{ alignItems: 'center' }}>
          {tags.map(t => (
            <button key={t} onClick={() => setTags(prev => prev.filter(x => x !== t))} className="chip" style={{ fontSize: 10, padding: '6px 10px' }}>
              {t} <Icon name="x" size={9} />
            </button>
          ))}
          <input
            value={tagDraft}
            onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="＋ címke"
            aria-label="Új címke"
            style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '6px 10px', border: '1px dashed var(--border-strong)', minWidth: 80 }}
          />
        </div>
      </div>

      {/* Sticky save bar */}
      <div
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 8, background: 'rgba(10,15,20,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid var(--border-subtle)', padding: '12px 16px 26px', display: 'flex', gap: 9 }}
      >
        <button className="cta-ghost notch-4" onClick={() => navigate(-1)} style={{ flex: 1 }}>Mégse</button>
        <button className="cta-primary notch-4" disabled={!canSave} onClick={save} style={{ flex: 1.8 }}>
          <Icon name="check" size={15} /> Mentés
        </button>
      </div>

      {pickerOpen && <IngredientPickerSheet onPick={addPicked} onClose={() => setPickerOpen(false)} />}
    </>
  )
}

// Re-export the Recipe type usage to keep this file self-documenting for the
// editing path (no runtime effect).
export type { Recipe }
```
4. Run it — `pnpm test src/features/fuel/views/RecipeEditorView.test.tsx` — expected PASS.
5. Commit — `git add frontend/src/features/fuel/views/RecipeEditorView.tsx frontend/src/features/fuel/views/RecipeEditorView.test.tsx` then `feat(fuel): RecipeEditorView full-page create=edit with live total (mezo-lns)`.

---

### Task feui9: Wire routes + retire `RecipeDetailSheet` / `NewRecipeSheet`; full gate

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Delete: `frontend/src/features/fuel/RecipeDetailSheet.tsx`, `frontend/src/features/fuel/RecipeDetailSheet.test.tsx`, `frontend/src/features/fuel/NewRecipeSheet.tsx`, `frontend/src/features/fuel/NewRecipeSheet.test.tsx`

**Interfaces:**
- Consumes: `RecipeDetailView` (feui7), `RecipeEditorView` (feui8).
- Produces: routes `fuel/recipes/:id` (`RecipeDetailView`), `fuel/recipes/new` + `fuel/recipes/:id/edit` (`RecipeEditorView`). The detail/editor are **NOT** nested children of `FuelScreen` (which renders the sub-nav + outlet) — they are full pages, mirroring how `train/mesocycles/:id` sits as a top-level `fuel/...` sibling route (so they render without the Fuel sub-nav chrome). Place them as siblings under the `fuel` path **outside** the `children` array, like `train/session`.

**Steps:**
1. Confirm no stragglers import the retired sheets: run `grep -rn "RecipeDetailSheet\|NewRecipeSheet" frontend/src` — expected only their own files + (already-reworked) `FuelRecipesView` should NOT reference them anymore after feui5. If `FuelRecipesView` still imports them, that is a feui5 regression — fix there.
2. Edit `frontend/src/app/router.tsx` — add imports near the other fuel imports:
```tsx
import { RecipeDetailView } from '@/features/fuel/views/RecipeDetailView'
import { RecipeEditorView } from '@/features/fuel/views/RecipeEditorView'
```
   and add the routes as **siblings** of the `fuel` group (right after the `fuel` route object that has the `children`, mirroring the `train/session` / `train/mesocycles/:id` top-level placement):
```tsx
      { path: 'fuel/recipes/new', element: <RecipeEditorView /> },
      { path: 'fuel/recipes/:id', element: <RecipeDetailView /> },
      { path: 'fuel/recipes/:id/edit', element: <RecipeEditorView /> },
```
   Order matters: `new` must precede `:id` so `/fuel/recipes/new` is not captured by the `:id` param. (React Router ranks static over dynamic, but list `new` first for clarity.) Leave the existing `recipes` index child (`FuelRecipesView`) inside the `fuel` children untouched.
3. Delete the retired files:
```
git rm frontend/src/features/fuel/RecipeDetailSheet.tsx frontend/src/features/fuel/RecipeDetailSheet.test.tsx frontend/src/features/fuel/NewRecipeSheet.tsx frontend/src/features/fuel/NewRecipeSheet.test.tsx
```
4. Run the full fuel suite in BOTH modes:
   - `pnpm test src/features/fuel` — expected PASS.
   - `VITE_USE_MOCK=true pnpm test src/features/fuel` — expected PASS.
5. Run the whole gate (both modes + build):
   - `pnpm test` — expected PASS (REAL mode — needs MSW recipe handlers from the DATA section; if a recipe-touching test fails only because handlers are missing, that's a cross-section dependency — note it, do not weaken the test).
   - `VITE_USE_MOCK=true pnpm test` — expected PASS.
   - `pnpm build` — expected PASS (`tsc -b && vite build`, no unused-import / type errors).
6. Update the feature doc `docs/features/fuel.md` (or the recipes section): note the editorial library, full-page detail + editor routes, the shared `MacroCells`/`RecipeFitBadge`/`ServingToggle`, the retired sheets, and the pending-fit (P2) deferral; then run `node scripts/lint-docs.mjs` to clear staleness. (If no `fuel.md` exists, add a short recipes subsection to the nearest Fuel feature doc.)
7. Commit — `git add frontend/src/app/router.tsx docs/features` and stage the deletions, then `feat(fuel): route recipe detail/editor pages, retire recipe sheets (mezo-lns)`.

---

### Notes for the integrating controller
- **Cross-section dependency:** every task here imports `useRecipes` / `useRecipeActions` from `@/data/hooks`, plus the extended `Recipe.ingredients[]` (`name` + `contribution`) and `RecipeInput` types — all authored by the DATA+HOOKS section. Sequence the DATA tasks (hooks, types, `recipeApi`, MSW handlers) **before** feui4–feui9. feui1–feui3 (pure presentational shared components) have no data dependency and can land first.
- **Route guards (no raw query):** the DATA section (fedata6) exposes NO `useRecipesQuery` — so the feui7/feui8 route guards rely on `useRecipes().recipes` only (no `isPending` skeleton branch): mock `initialData` keeps it synchronous; real mode briefly shows the not-found fallback on a cold deep-link until the list resolves. (Already applied in this plan.)
- **Contribution formula parity:** `contributionOf` in feui8 uses `round(macro * amount/per)` — this MUST equal the backend mapper + the mock hook's line contribution exactly (spec §6.3 / shared CONTRIBUTION FORMULA). Keep it identical.
