# Fuel Meal-Logging (Mai) Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL — use superpowers:subagent-driven-development to execute this plan task-by-task (TDD: write failing test → run → implement → run → commit). Execute in the **Task Map** order; task IDs are section-scoped, not globally sequential.

**Goal:** Back the 100%-mock meal-logging (Mai/Today) with a real Spring Boot + Postgres backend and dual-mode hooks, and ship the one new `LogMealSheet` — un-deferring the inert "+ Mai étkezéshez" / "+ Logolás" CTAs.

**Architecture:** Contract-first OpenAPI (`api/feature/meal/meal.yml` → `MealApi` + `api.dto`; + a `GET /api/recipe/{id}/logs` op on the recipe contract). Owned `meal` `@OneToMany` `meal_item` aggregate (mirrors `recipe`→`recipe_ingredient`); `meal_item` is **polymorphic** — a plain-UUID FK to `recipe` OR `pantry_item` (`ON DELETE RESTRICT`) + a `source` discriminator + an exactly-one-of CHECK + a frozen per-basis macro snapshot. Macros computed at read (`factor = amount/snapshot_per`, whole-number `round`); day `consumed` = Σ meal macros vs `nutrition_targets` (`@ConfigurationProperties`). Slot-with-N-items **pure-create** (POST 201, full-replace PUT, soft-delete cascade). Dual-mode `useFuelDay` (composed, FuelDay shape preserved) + `useMealActions` (invalidate `['fuelDay']`+`['recipes']`+`['pantry']`). Hybrid UI: wire MacroHero/meal-list/RecipeLogsList + one new chamfer `LogMealSheet` + 2-tab Receptek/Kamra picker. Score deferred (`meal.breakdown` jsonb NULL + pending sparkle, Phase-3).

**Tech Stack:** Spring Boot 4 · Java 21 · Maven · PostgreSQL 16 · Liquibase · MapStruct · Lombok · React 19 · Vite · TanStack Query · TypeScript. Chamfer "Deep Current" design system.

**Driving bd:** `mezo-arb`. **Spec:** `docs/superpowers/specs/2026-06-24-fuel-meal-logging-design.md`. **Mockup:** `docs/design/meal-logging-sheet.html`. **Template:** the shipped Recipes slice (`mezo-lns`).

## Global Constraints

- Base pkg `io.mrkuhne.mezo`; feature pkg `feature/meal/{entity,repository,service,mapper,controller,config}`.
- UUID PK `gen_random_uuid()`; OWNED (`created_by`/`is_deleted`/`created_at`) set server-side; soft-delete `@SQLDelete`/`@SQLRestriction`; `created_by` NEVER from the client.
- Ownership gate → 404 `RESOURCE_NOT_FOUND`; validation → 400 `SystemMessage.field("VALIDATION_INVALID_VALUE", …)`. `meal_item` polymorphic arm validated server-side (exactly-one-of recipe|pantry).
- Contract-first; never hand-write boundary DTOs; `pattern` (not enum) on request strings.
- The contribution/rollup formula is IDENTICAL in the Java mapper and the FE mock (whole-number `round`, matching the shipped recipe slice).
- Liquibase: never modify released changesets; 12-digit UTC prefix + `mezo-arb`; explicit `pk_/fk_/uq_/ck_/idx_`; new tables → `ResetDatabase` TRUNCATE.
- Backend tests: integration-first (`@SpringBootTest` + real Postgres), AssertJ, no mocks; `test{Method}_should{Result}_when{Condition}`.
- FE: preserve the `useFuelDay()` return = the full `FuelDay` shape (only `targets/consumed/meals` real; `pacing/micronutrients/supplements` static); both `pnpm test` (REAL) and `VITE_USE_MOCK=true pnpm test` green + `pnpm build`.
- Respond Hungarian to the user; code/comments/commits English. NEVER put `[skip ci]` in a commit that becomes the HEAD of a push to `main`.

## Task Map (execution order)

1. **Contract** — `ct1` → `ct2` → `ct3` → `ct4`
2. **DB / persistence** — `db1` → … → `db8`
3. **Mapper** — the MealMapperTest task → the MealMapper implementation task
4. **Service** — `svc1` → … → `svc6`
5. **Controller + API IT** — the 6 controller tasks in order
6. **FE data layer** — the 7 fedata tasks in order
7. **FE UI** — MealPickerSheet → LogMealSheet → wire Mai → wire CTAs → wire Today + gate → fuel.md

**Reconciliation notes (already applied):** MealBreakdownJson is owned by the DB section (the duplicate mapper task was removed). The FE data layer (types, `mealApi`, `fuelHooks`, MSW, hooks.ts re-export) is owned by the FE-data phase; the FE-UI phase's duplicate data tasks were removed and its UI tasks consume the FE-data canonical types (`MealItemLine`/`refId`, `FuelMeal.mealItems`, `MealInput`) + hooks (`useFuelDay`/`useMealActions`/`useRecipeLogs`). The mapper runs before the service; the service exposes `create/getDay/update/delete/recipeLogs` and the controller delegates to those. The service adds the recipe-logs finder to the DB-owned `MealItemRepository`.

---

## Phase 1 — Contract

# Fuel Meal-Logging — CONTRACT tasks

Owner section: **CONTRACT**. Driving bd: `mezo-arb`. Stack: OpenAPI 3.0.3 (contract-first) → generated `MealApi` + `io.mrkuhne.mezo.api.dto.*` (backend) and `frontend/src/lib/api.gen.ts` (FE types). No Java/TS code is written here — this section ONLY authors the contract fragments, wires the merge, regenerates both generated artifacts, and verifies the generated names exist. Every downstream section (DB / Mapper / Service / Controller / FE) CONSUMES the names produced here.

Ground rules read before authoring (do not re-derive): `api/feature/recipe/recipe.yml` (the shipped template — `RecipeRequest`/`RecipeResponse`/`RecipeIngredientRequest`/`RecipeIngredientResponse`/`RecipeMacros` structure, `pattern` over `enum`, `SystemMessageList` on every non-2xx, `tag → <Tag>Api`, `operationId → method name`), `api/generate/merge.yml` (ordered input list — every fragment MUST be appended), `docs/references/api_contract_conventions.md` (authoring rules, generator config, checklist), spec §5.

This section has NO TDD loop in the classic sense (no unit under test) — the "test" for a contract is: the merge succeeds, both generators emit without error, and the expected generated symbols are present. Each task's verify step asserts exactly that.

---

### Task ct1: Author `api/feature/meal/meal.yml` (tag Meal — paths + all Meal schemas)

**Files:**
- Create: `api/feature/meal/meal.yml`

**Interfaces:**
- Consumes (template patterns, verbatim shapes from `api/feature/recipe/recipe.yml`): `SystemMessageList` (referenced on every non-2xx; defined in `api/common/common-schemas.yml`), the `RecipeRequest`/`RecipeResponse` authoring conventions (request fields validated by `pattern`, `minItems`, `exclusiveMinimum`; tag = generated interface name; operationId = controller method name).
- Produces (generated backend `io.mrkuhne.mezo.api.dto.*` model classes + `io.mrkuhne.mezo.api.controller.MealApi` interface; generated FE `components['schemas'][...]`):
  - Interface: `MealApi` with methods `getFuelDay(LocalDate date)` → `FuelDayResponse`, `createMeal(MealRequest)` → `MealResponse`, `updateMeal(UUID id, MealRequest)` → void/204, `deleteMeal(UUID id)` → void/204.
  - DTOs: `MealRequest`, `MealItemRequest`, `MealResponse`, `MealItemResponse`, `FuelDayResponse`, `Macros`, `MacroSet`, `MealScore`.
  - `Macros{kcal,p,c,f}` (all `number`, required). `MacroSet{kcal,p,c,f,water}` (all `number`, required). `MealScore{value: number nullable, breakdown: object nullable}`.
  - `MealRequest{ slot(required, pattern ^(breakfast|lunch|dinner|snack)$), loggedAt(date-time nullable), title(nullable), items(MealItemRequest[], minItems 1) }`.
  - `MealItemRequest{ source(required, pattern ^(recipe|pantry)$), recipeId(uuid nullable), pantryItemId(uuid nullable), amount(number, exclusiveMinimum 0), unit(string required, minLength 1) }`.
  - `MealResponse{ id(uuid), slot, loggedAt(date-time), mealDate(date), title(nullable), macros(Macros), score(MealScore), items(MealItemResponse[]) }`.
  - `MealItemResponse{ source, recipeId(uuid nullable), pantryItemId(uuid nullable), amount(number), unit, lineOrder(integer), name, nova(integer nullable), contribution(Macros) }`.
  - `FuelDayResponse{ date, targets(MacroSet), consumed(MacroSet), meals(MealResponse[]) }`.

**Steps:**

1. Create the file `api/feature/meal/meal.yml` with the EXACT content below (a complete mini-document: `openapi`/`info`/`tags`/`paths`/`components`, mirroring `recipe.yml` so openapi-merge-cli can combine it). Operation ids match the future `MealApi` method names; the `Meal` tag yields the `MealApi` interface; every non-2xx references `SystemMessageList`.

```yaml
openapi: 3.0.3
info: { title: '', version: '' }
tags:
  - name: Meal
    description: Meal logging (Étkezés-logolás) — owned meal + meal_item aggregate; polymorphic items reference a recipe or a pantry_item by id with a per-basis macro snapshot. GET /api/fuel/day/{date} aggregates the day for the Fuel screen.
paths:
  /api/fuel/day/{date}:
    get:
      tags: [Meal]
      operationId: getFuelDay
      summary: The owner's nutrition day — targets, consumed rollup, and the day's meals
      parameters: [ { name: date, in: path, required: true, schema: { type: string, format: date } } ]
      responses:
        '200': { description: Fuel day, content: { application/json: { schema: { $ref: '#/components/schemas/FuelDayResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/meal:
    post:
      tags: [Meal]
      operationId: createMeal
      summary: Log a meal with its items (recipe/pantry snapshots captured server-side)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/MealRequest' } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/MealResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/meal/{id}:
    put:
      tags: [Meal]
      operationId: updateMeal
      summary: Full-replace an owned meal aggregate (all fields + all items, snapshots re-captured)
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/MealRequest' } } }
      responses:
        '204': { description: Updated }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    delete:
      tags: [Meal]
      operationId: deleteMeal
      summary: Soft-delete an owned meal (and its items)
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
components:
  schemas:
    Macros:
      type: object
      required: [kcal, p, c, f]
      properties:
        kcal: { type: number }
        p: { type: number }
        c: { type: number }
        f: { type: number }
    MacroSet:
      type: object
      required: [kcal, p, c, f, water]
      properties:
        kcal: { type: number }
        p: { type: number }
        c: { type: number }
        f: { type: number }
        water: { type: number }
    MealScore:
      type: object
      properties:
        value: { type: number, nullable: true }
        breakdown: { type: object, nullable: true, additionalProperties: true }
    MealItemRequest:
      type: object
      required: [source, amount, unit]
      properties:
        source: { type: string, pattern: '^(recipe|pantry)$' }
        recipeId: { type: string, format: uuid, nullable: true }
        pantryItemId: { type: string, format: uuid, nullable: true }
        amount: { type: number, exclusiveMinimum: 0 }
        unit: { type: string, minLength: 1 }
    MealItemResponse:
      type: object
      required: [source, amount, unit, lineOrder, name, contribution]
      properties:
        source: { type: string }
        recipeId: { type: string, format: uuid, nullable: true }
        pantryItemId: { type: string, format: uuid, nullable: true }
        amount: { type: number }
        unit: { type: string }
        lineOrder: { type: integer }
        name: { type: string }
        nova: { type: integer, nullable: true }
        contribution: { $ref: '#/components/schemas/Macros' }
    MealRequest:
      type: object
      required: [slot, items]
      properties:
        slot: { type: string, pattern: '^(breakfast|lunch|dinner|snack)$' }
        loggedAt: { type: string, format: date-time, nullable: true }
        title: { type: string, nullable: true }
        items:
          type: array
          minItems: 1
          items: { $ref: '#/components/schemas/MealItemRequest' }
    MealResponse:
      type: object
      required: [id, slot, loggedAt, mealDate, macros, score, items]
      properties:
        id: { type: string, format: uuid }
        slot: { type: string }
        loggedAt: { type: string, format: date-time }
        mealDate: { type: string, format: date }
        title: { type: string, nullable: true }
        macros: { $ref: '#/components/schemas/Macros' }
        score: { $ref: '#/components/schemas/MealScore' }
        items: { type: array, items: { $ref: '#/components/schemas/MealItemResponse' } }
    FuelDayResponse:
      type: object
      required: [date, targets, consumed, meals]
      properties:
        date: { type: string, format: date }
        targets: { $ref: '#/components/schemas/MacroSet' }
        consumed: { $ref: '#/components/schemas/MacroSet' }
        meals: { type: array, items: { $ref: '#/components/schemas/MealResponse' } }
```

2. Validate the fragment is well-formed YAML (parse-only; no merge yet). Run:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && node -e "const y=require('js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('api/feature/meal/meal.yml','utf8'));const s=Object.keys(d.components.schemas).sort().join(',');console.log('schemas:',s);console.log('ops:',Object.values(d.paths).flatMap(p=>Object.values(p).map(o=>o.operationId)).join(','))"
   ```
   Expected output (order-independent for schemas): `schemas: FuelDayResponse,MacroSet,Macros,MealItemRequest,MealItemResponse,MealRequest,MealResponse,MealScore` and `ops:` containing `getFuelDay,createMeal,updateMeal,deleteMeal`. (If `js-yaml` is not resolvable from repo root, run the same one-liner with `cd api/generate` where `openapi-merge-cli` pulls it in transitively, or fall back to `npx js-yaml api/feature/meal/meal.yml >/dev/null && echo OK`.)

3. Commit:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && git add api/feature/meal/meal.yml && git commit -m "feat(api): add Meal contract fragment — fuel-day + meal CRUD schemas (mezo-arb)"
   ```

---

### Task ct2: Append GET `/api/recipe/{id}/logs` + `RecipeLogListResponse`/`RecipeLogResponse` to the recipe contract (non-breaking)

**Files:**
- Modify: `api/feature/recipe/recipe.yml`

**Interfaces:**
- Consumes: existing `RecipeApi` tag + `/api/recipe/{id}` path-param style (verbatim from the file), `SystemMessageList`.
- Produces (added to generated `RecipeApi` + `io.mrkuhne.mezo.api.dto.*`):
  - New `RecipeApi` method `recipeLogs(UUID id)` → `RecipeLogListResponse`.
  - DTO `RecipeLogResponse{ mealId(uuid), slot, loggedAt(date-time), kcal(number), p(number), c(number), f(number) }`.
  - DTO `RecipeLogListResponse{ recentLogs: RecipeLogResponse[] }`.

**Steps:**

1. Add the new path. In `api/feature/recipe/recipe.yml`, immediately AFTER the `/api/recipe/{id}` block (after the `delete:` operation's last `'404'` line, before the `components:` line — i.e. as a new top-level entry under `paths:`), insert:

```yaml
  /api/recipe/{id}/logs:
    get:
      tags: [Recipe]
      operationId: recipeLogs
      summary: Recent meal logs that included this owned recipe (for the recipe detail RecipeLogsList)
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '200': { description: Recent logs, content: { application/json: { schema: { $ref: '#/components/schemas/RecipeLogListResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

   The exact text to insert after (the existing last delete responses block of `/api/recipe/{id}`) is:
   ```yaml
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
   ```
   Insert the new `/api/recipe/{id}/logs:` block on the line directly after that `'404'` line and before `components:`.

2. Add the two schemas. Under `components: schemas:`, append (after the last existing schema `RecipeListResponse`, keeping its indentation — each schema is a key under `schemas:`):

```yaml
    RecipeLogResponse:
      type: object
      required: [mealId, slot, loggedAt, kcal, p, c, f]
      properties:
        mealId: { type: string, format: uuid }
        slot: { type: string }
        loggedAt: { type: string, format: date-time }
        kcal: { type: number }
        p: { type: number }
        c: { type: number }
        f: { type: number }
    RecipeLogListResponse:
      type: object
      required: [recentLogs]
      properties:
        recentLogs: { type: array, items: { $ref: '#/components/schemas/RecipeLogResponse' } }
```

3. Verify the existing operations are untouched and the new ones are present. Run:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && node -e "const y=require('js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('api/feature/recipe/recipe.yml','utf8'));const ops=Object.values(d.paths).flatMap(p=>Object.values(p).map(o=>o.operationId));console.log('ops:',ops.join(','));console.log('hasLogs:',ops.includes('recipeLogs'));console.log('schemas have logs:',['RecipeLogResponse','RecipeLogListResponse'].every(k=>k in d.components.schemas));console.log('old ops intact:',['listRecipes','createRecipe','getRecipe','updateRecipe','deleteRecipe'].every(o=>ops.includes(o)))"
   ```
   Expected: `hasLogs: true`, `schemas have logs: true`, `old ops intact: true`.

4. Commit:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && git add api/feature/recipe/recipe.yml && git commit -m "feat(api): add GET /api/recipe/{id}/logs + RecipeLog schemas to recipe contract (mezo-arb)"
   ```

---

### Task ct3: Register `meal.yml` in the merge config + merge + regenerate FE/backend types

**Files:**
- Modify: `api/generate/merge.yml`
- (regenerated, committed) `api/openapi.yml`
- (regenerated, committed) `frontend/src/lib/api.gen.ts`

**Interfaces:**
- Consumes: `api/feature/meal/meal.yml` (ct1), the recipe-logs additions (ct2), the existing `merge.yml` ordered input list.
- Produces: merged `api/openapi.yml` containing all Meal + RecipeLog paths/schemas; `frontend/src/lib/api.gen.ts` exposing `components['schemas']['MealRequest' | 'MealItemRequest' | 'MealResponse' | 'MealItemResponse' | 'FuelDayResponse' | 'Macros' | 'MacroSet' | 'MealScore' | 'RecipeLogResponse' | 'RecipeLogListResponse']`. These two committed artifacts are what the backend `generate-sources` (ct4) and the FE section build against.

**Steps:**

1. Append the meal fragment to the merge input list. In `api/generate/merge.yml`, after the line `  - inputFile: ../feature/recipe/recipe.yml` add a new line:
   ```yaml
     - inputFile: ../feature/meal/meal.yml
   ```
   (Order: meal AFTER recipe, since `RecipeLogResponse`/`RecipeLogListResponse` and the day aggregation conceptually depend on the recipe slice; the recipe-logs additions live IN `recipe.yml` so no extra ordering is needed — meal simply goes last before `output:`.)

2. Run the merge. Expected: regenerates `api/openapi.yml` with no error and a "merge successful" style message.
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && npm run generate:api
   ```

3. Verify the merged contract carries the new symbols. Run:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && node -e "const y=require('js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('api/openapi.yml','utf8'));const need=['MealRequest','MealItemRequest','MealResponse','MealItemResponse','FuelDayResponse','Macros','MacroSet','MealScore','RecipeLogResponse','RecipeLogListResponse'];console.log('schemas ok:',need.every(k=>k in d.components.schemas));const paths=Object.keys(d.paths);console.log('paths ok:',['/api/fuel/day/{date}','/api/meal','/api/meal/{id}','/api/recipe/{id}/logs'].every(p=>paths.includes(p)))"
   ```
   Expected: `schemas ok: true` and `paths ok: true`.

4. Regenerate frontend types from the merged contract. Expected: rewrites `frontend/src/lib/api.gen.ts` with no error.
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm generate:api
   ```

5. Verify the FE types file now contains the new schema names. Run:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && grep -E "MealRequest:|MealItemRequest:|MealResponse:|MealItemResponse:|FuelDayResponse:|Macros:|MacroSet:|MealScore:|RecipeLogResponse:|RecipeLogListResponse:" frontend/src/lib/api.gen.ts | sort
   ```
   Expected: all ten schema keys appear (each as a `<Name>: { ... }` entry inside `components['schemas']`).

6. Commit the wiring + both regenerated artifacts together (one commit keeps both sides in lockstep, per the conventions doc):
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo && git add api/generate/merge.yml api/openapi.yml frontend/src/lib/api.gen.ts && git commit -m "feat(api): merge Meal fragment + recipe logs; regen openapi.yml + FE api.gen.ts (mezo-arb)"
   ```

---

### Task ct4: Verify backend `generate-sources` emits `MealApi` + the `api.dto.*` models + the new `RecipeApi.recipeLogs` op

**Files:**
- Test (verification only — no source authored here): regenerated Java sources under `backend/target/generated-sources/openapi/` (NOT committed).

**Interfaces:**
- Consumes: committed `api/openapi.yml` (ct3) — the backend `openapi-generator-maven-plugin` reads it from `generate-sources`.
- Produces (generated, for downstream DB/Mapper/Service/Controller sections to implement/consume): `io.mrkuhne.mezo.api.controller.MealApi` (interface — methods `getFuelDay`, `createMeal`, `updateMeal`, `deleteMeal`), `io.mrkuhne.mezo.api.dto.{MealRequest, MealItemRequest, MealResponse, MealItemResponse, FuelDayResponse, Macros, MacroSet, MealScore, RecipeLogResponse, RecipeLogListResponse}`, and the augmented `io.mrkuhne.mezo.api.controller.RecipeApi` carrying `recipeLogs(UUID)` → `RecipeLogListResponse`.

**Steps:**

1. Run only the generate-sources phase (fast — no compile of app code needed to prove the contract generates). Expected: BUILD SUCCESS, the openapi plugin runs.
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw -q generate-sources
   ```

2. Verify the generated interface + DTO files exist. Run:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && \
   ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/MealApi.java && \
   ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/MealRequest.java \
      target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/MealItemRequest.java \
      target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/MealResponse.java \
      target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/MealItemResponse.java \
      target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/FuelDayResponse.java \
      target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/Macros.java \
      target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/MacroSet.java \
      target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/MealScore.java \
      target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/RecipeLogResponse.java \
      target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/RecipeLogListResponse.java
   ```
   Expected: all paths listed (no "No such file"). If the openapi output dir differs in this repo's `pom.xml`, locate it once with `find target/generated-sources -name MealApi.java` and re-run the listing against that base; do NOT change the pom.

3. Verify the generated `MealApi` declares the four expected methods and `RecipeApi` now declares `recipeLogs`. Run:
   ```bash
   cd /Users/daniel.kuhne/MrKuhne/mezo/backend && \
   grep -E "getFuelDay|createMeal|updateMeal|deleteMeal" target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/MealApi.java && \
   grep -E "recipeLogs" target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/RecipeApi.java
   ```
   Expected: the four Meal method names appear in `MealApi.java`, and `recipeLogs` appears in `RecipeApi.java`.

4. No commit (target/ is gitignored, regenerated every build). This task is a verification gate proving the contract is consumable by both generators before downstream sections build on it.

---

## Notes for the Task-Map controller

- ct1 and ct2 are independent (different files) and may run in either order, but BOTH must precede ct3 (merge needs both fragments final). ct3 must precede ct4 (backend reads the committed `api/openapi.yml`).
- This whole CONTRACT section is the hard prerequisite for the DB, Mapper, Service, Controller, and FE sections — they all import the symbols listed under "Produces" above. Schedule CONTRACT first.

---

## Phase 2 — DB / persistence

# Part: DATABASE + ENTITIES (meal aggregate persistence foundation)

Driving bd: **mezo-arb**. Base pkg `io.mrkuhne.mezo`. Stack: Spring Boot 4 / Java 21 / Maven / Postgres 16 / Liquibase / Lombok.

This part OWNS the persistence foundation of the meal-logging slice: the `meal` + `meal_item`
Liquibase migration, `MealEntity`, `MealItemEntity`, `MealBreakdownJson`, `MealRepository`,
`MealItemRepository`, the `MealPopulator` test factory, the `AbstractIntegrationTest` `@Import`
registration, the `ResetDatabase` TRUNCATE addition, and the persistence IT `MealRepositoryIT`.
The mapper / service / controller parts CONSUME these — they never re-create them.

It maps 1:1 onto the shipped **recipe** slice (`recipe` → `recipe_ingredient`); the recipe slice
is the in-repo template for every pattern below. Key differences from recipe:
- `meal_item` is **polymorphic** (recipe-arm OR pantry-arm) → two nullable plain-UUID FK columns
  + a `source` discriminator + a `ck_meal_item_arm` exactly-one-of CHECK.
- `meal` carries a real instant (`logged_at`) + a denormalized day key (`meal_date`), so
  `MealRepository extends OwnedRepository<MealEntity>` (date-ordered family) with a day-finder —
  UNLIKE `RecipeRepository` which extends `JpaRepository` directly because recipe has no date.
- `meal.breakdown` jsonb ships **NULL in v1** (Phase-3 score envelope), typed via
  `@JdbcTypeCode(SqlTypes.JSON)` onto a minimal `MealBreakdownJson` record.

---

### Task db1: `meal` + `meal_item` migration + master registration

Write the Liquibase changeset for both owned tables (exact DDL/constraints/indexes incl. the
`ck_meal_item_arm` exactly-one-of CHECK) and register it in `1.0.0_master.yml` AFTER the recipe
changeset. Grounded in `docs/references/liquibase_conventions.md` (versioned changelog,
`{YYYYMMDDHHMM}_{id}_{desc}` script naming, explicit `pk_/fk_/ck_/idx_` constraint names, never
modify released changesets) and the `202606231400_mezo-lns_create_recipe.sql` template.

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606241400_mezo-arb_create_meal.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`

**Interfaces:**
- Consumes: existing tables `app_user(id)`, `recipe(id)`, `pantry_item(id)` (FK targets); the
  recipe changeset `1.0.0:202606231400_mezo-lns_create_recipe` (must precede this one).
- Produces (relied on by db2–db8 + mapper/service/controller parts): tables `meal`, `meal_item`
  with columns and constraints exactly as below. Column names: `meal(id, created_by, is_deleted,
  created_at, updated_at, logged_at, meal_date, slot, title, breakdown)`;
  `meal_item(id, created_by, is_deleted, created_at, meal_id, line_order, source, recipe_id,
  pantry_item_id, amount, unit, snapshot_name, snapshot_per, snapshot_basis_unit, snapshot_kcal,
  snapshot_protein_g, snapshot_carbs_g, snapshot_fat_g, snapshot_nova)`. Constraint names:
  `pk_meal_id`, `fk_meal_created_by_app_user_id`, `ck_meal_slot`, `idx_meal_created_by`,
  `idx_meal_created_by_meal_date`; `pk_meal_item_id`, `fk_meal_item_created_by_app_user_id`,
  `fk_meal_item_meal_id_meal_id`, `fk_meal_item_recipe_id_recipe_id`,
  `fk_meal_item_pantry_item_id_pantry_item_id`, `ck_meal_item_source`, `ck_meal_item_amount`,
  `ck_meal_item_snapshot_nova`, `ck_meal_item_arm`, `idx_meal_item_meal_id`,
  `idx_meal_item_created_by`, `idx_meal_item_recipe_id`, `idx_meal_item_pantry_item_id`.

**Steps:**

1. Create the migration script
   `backend/src/main/resources/db/changelog/1.0.0/script/202606241400_mezo-arb_create_meal.sql`
   with EXACTLY this content:

   ```sql
   -- Fuel Meal-logging (mezo-arb): a meal aggregate (meal + ordered, polymorphic meal_item lines).
   -- Both tables are OWNED (created_by FK -> app_user, soft-delete via is_deleted).
   -- meal_item is polymorphic: each line references a recipe OR a pantry_item (source discriminator
   -- + the ck_meal_item_arm exactly-one-of CHECK). It carries a denormalized snapshot of the source's
   -- name + per-basis macros at write time so a later edit/delete of the source never silently
   -- rewrites historical meal macros (identical rationale to recipe_ingredient).

   create table meal (
       id         uuid         not null default gen_random_uuid(),
       created_by uuid         not null,
       is_deleted boolean      not null default false,
       created_at timestamptz  not null default now(),
       updated_at timestamptz,
       logged_at  timestamptz  not null,
       meal_date  date         not null,
       slot       text         not null,
       title      text,
       breakdown  jsonb,
       constraint pk_meal_id primary key (id),
       constraint fk_meal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
       constraint ck_meal_slot check (slot in ('breakfast','lunch','dinner','snack'))
   );

   create index idx_meal_created_by on meal (created_by);
   create index idx_meal_created_by_meal_date on meal (created_by, meal_date);

   create table meal_item (
       id                  uuid         not null default gen_random_uuid(),
       created_by          uuid         not null,
       is_deleted          boolean      not null default false,
       created_at          timestamptz  not null default now(),
       meal_id             uuid         not null,
       line_order          integer      not null,
       source              text         not null,
       recipe_id           uuid,
       pantry_item_id      uuid,
       amount              numeric      not null,
       unit                text         not null,
       snapshot_name       text         not null,
       snapshot_per        numeric      not null,
       snapshot_basis_unit text         not null,
       snapshot_kcal       numeric      not null,
       snapshot_protein_g  numeric      not null,
       snapshot_carbs_g    numeric      not null,
       snapshot_fat_g      numeric      not null,
       snapshot_nova       smallint,
       constraint pk_meal_item_id primary key (id),
       constraint fk_meal_item_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
       constraint fk_meal_item_meal_id_meal_id foreign key (meal_id) references meal (id) on delete cascade,
       constraint fk_meal_item_recipe_id_recipe_id foreign key (recipe_id) references recipe (id) on delete restrict,
       constraint fk_meal_item_pantry_item_id_pantry_item_id foreign key (pantry_item_id) references pantry_item (id) on delete restrict,
       constraint ck_meal_item_source check (source in ('recipe','pantry')),
       constraint ck_meal_item_amount check (amount > 0),
       constraint ck_meal_item_snapshot_nova check (snapshot_nova is null or snapshot_nova between 1 and 4),
       constraint ck_meal_item_arm check (
           (source = 'recipe' and recipe_id is not null and pantry_item_id is null)
           or (source = 'pantry' and pantry_item_id is not null and recipe_id is null)
       )
   );

   create index idx_meal_item_meal_id on meal_item (meal_id);
   create index idx_meal_item_created_by on meal_item (created_by);
   create index idx_meal_item_recipe_id on meal_item (recipe_id);
   create index idx_meal_item_pantry_item_id on meal_item (pantry_item_id);
   ```

2. Register the changeset in `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
   by appending this block AFTER the existing
   `1.0.0:202606231400_mezo-lns_create_recipe` changeSet (the file's last entry):

   ```yaml
     - changeSet:
         id: "1.0.0:202606241400_mezo-arb_create_meal"
         author: daniel.kuhne
         changes:
           - sqlFile:
               relativeToChangelogFile: true
               path: script/202606241400_mezo-arb_create_meal.sql
   ```

3. Verify the changelog parses + applies cleanly against the fixed `mezo_test` DB (compose must
   be up). Run:
   `cd backend && ./mvnw -q clean test -Dtest=RecipeRepositoryIT`
   Expected: PASS (an existing IT — booting it runs Liquibase, which now also applies the new
   `meal`/`meal_item` changeset; a malformed DDL or duplicate changeset id would fail startup here).

4. Commit. Run:
   `git add backend/src/main/resources/db/changelog/1.0.0/script/202606241400_mezo-arb_create_meal.sql backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
   then `git commit -m "feat(db): add meal + meal_item migration (mezo-arb)"`

---

### Task db2: `MealBreakdownJson` typed jsonb record + `MealItemEntity`

Add the minimal `MealBreakdownJson` record (the typed target for `meal.breakdown`, NULL in v1) and
the `MealItemEntity` (polymorphic child). Grounded in `RecipeIngredientEntity` (snapshot fields,
`@ManyToOne` parent back-ref, plain-UUID source column) and `docs/references/java_package_structure.md`
(`feature/meal/entity/`) + `spring_patterns.md` (Lombok `@Getter/@Setter`).

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealBreakdownJson.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealItemEntity.java`

**Interfaces:**
- Consumes: `io.mrkuhne.mezo.techcore.persistence.OwnedEntity` (provides `createdBy`, `deleted`,
  `createdAt`); table `meal_item` (db1).
- Produces (consumed by db3 `MealEntity`, the mapper part, the service part):
  - `record MealBreakdownJson(BigDecimal value, String summary)` in pkg
    `io.mrkuhne.mezo.feature.meal.entity`.
  - `class MealItemEntity extends OwnedEntity` with getters/setters for: `UUID id`,
    `MealEntity meal` (`@ManyToOne`, `getMeal/setMeal`), `Integer lineOrder`, `String source`,
    `UUID recipeId`, `UUID pantryItemId`, `BigDecimal amount`, `String unit`, `String snapshotName`,
    `BigDecimal snapshotPer`, `String snapshotBasisUnit`, `BigDecimal snapshotKcal`,
    `BigDecimal snapshotProteinG`, `BigDecimal snapshotCarbsG`, `BigDecimal snapshotFatG`,
    `Short snapshotNova`.

**Steps:**

1. Create `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealBreakdownJson.java` with
   EXACTLY this content:

   ```java
   package io.mrkuhne.mezo.feature.meal.entity;

   import java.math.BigDecimal;

   /**
    * Typed envelope for the {@code meal.breakdown} jsonb column — the Phase-3 meal-score record.
    * Deliberately minimal: in v1 {@code breakdown} is always NULL (the score is deferred, guarded by
    * the FE pending-sparkle), so this record only exists to give the jsonb column a typed mapping
    * target via {@code @JdbcTypeCode(SqlTypes.JSON)} instead of a raw String. The full 4-dimension
    * (Macro/Micro/NOVA/Context) weighted structure lands with Phase-3 scoring.
    */
   public record MealBreakdownJson(BigDecimal value, String summary) {
   }
   ```

2. Create `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealItemEntity.java` with
   EXACTLY this content:

   ```java
   package io.mrkuhne.mezo.feature.meal.entity;

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
    * One ordered, polymorphic line of a {@link MealEntity} (FK {@code meal_id},
    * {@code ON DELETE CASCADE}). Lines are ordered within a meal by {@code lineOrder}.
    *
    * <p>The line is polymorphic on {@code source} ({@code 'recipe'} | {@code 'pantry'}): exactly one
    * of {@code recipeId} / {@code pantryItemId} is set (DB CHECK {@code ck_meal_item_arm}). BOTH are
    * PLAIN UUID columns (FK to {@code recipe}/{@code pantry_item}, {@code ON DELETE RESTRICT}),
    * deliberately NOT JPA associations: the {@code snapshot*} fields capture the live source's name +
    * per-basis macros at write time so a later edit/delete of the source never silently rewrites this
    * meal's historical macros (identical rationale to {@code recipe_ingredient.pantryItemId}).
    *
    * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
    */
   @Getter
   @Setter
   @Entity
   @Table(name = "meal_item")
   @SQLDelete(sql = "update meal_item set is_deleted = true where id = ?")
   @SQLRestriction("is_deleted = false")
   public class MealItemEntity extends OwnedEntity {

       @Id
       @GeneratedValue
       @Column(columnDefinition = "uuid")
       private UUID id;

       @NotNull
       @ManyToOne(fetch = FetchType.LAZY)
       @JoinColumn(name = "meal_id", nullable = false)
       private MealEntity meal;

       @NotNull
       @Column(name = "line_order", nullable = false)
       private Integer lineOrder;

       @NotNull
       @Column(nullable = false)
       private String source; // recipe | pantry (DB CHECK ck_meal_item_source)

       @Column(name = "recipe_id")
       private UUID recipeId;

       @Column(name = "pantry_item_id")
       private UUID pantryItemId;

       @NotNull
       @Column(nullable = false)
       private BigDecimal amount;

       @NotNull
       @Column(nullable = false)
       private String unit;

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

       @Column(name = "snapshot_nova")
       private Short snapshotNova;
   }
   ```

3. Compile-check. Run: `cd backend && ./mvnw -q clean compile`
   Expected: FAIL — `MealItemEntity` references `MealEntity` which does not exist yet (symbol not
   found). This proves the back-ref wiring; db3 supplies `MealEntity`.

4. (No standalone fix here — db3 resolves the missing `MealEntity`. Proceed to db3, then both
   compile together. Do not commit a non-compiling tree.)

---

### Task db3: `MealEntity` aggregate root

Add the `MealEntity` aggregate root (header fields + the ordered `@OneToMany` children + the typed
jsonb `breakdown`). Grounded in `RecipeEntity` (the only `@OneToMany` aggregate template:
`cascade = ALL` + `orphanRemoval = true` + `@OrderBy("lineOrder")`, `@UpdateTimestamp`,
`@JdbcTypeCode(SqlTypes.JSON)`).

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealEntity.java`

**Interfaces:**
- Consumes: `OwnedEntity`; `MealItemEntity` (db2, `mappedBy = "meal"` back-ref via `setMeal`);
  `MealBreakdownJson` (db2); table `meal` (db1).
- Produces (consumed by db4 repo, db6 populator, the mapper/service parts):
  `class MealEntity extends OwnedEntity` with getters/setters for: `UUID id`, `Instant updatedAt`,
  `Instant loggedAt`, `LocalDate mealDate`, `String slot`, `String title`,
  `MealBreakdownJson breakdown`, `List<MealItemEntity> items` (init `new ArrayList<>()`,
  `getItems()` returns the live mutable list — service does `items.clear()` + add for full-replace).

**Steps:**

1. Create `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealEntity.java` with EXACTLY
   this content:

   ```java
   package io.mrkuhne.mezo.feature.meal.entity;

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
   import java.time.Instant;
   import java.time.LocalDate;
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
    * A meal aggregate root: a logged eating event ({@code logged_at} instant + denormalized
    * {@code meal_date} day key + {@code slot}) plus an ordered list of polymorphic
    * {@link MealItemEntity} lines. The {@code items} collection is the aggregate boundary —
    * {@code cascade = ALL} + {@code orphanRemoval = true} persist/remove children with the parent,
    * {@code @OrderBy} loads them by {@code line_order}. Mirrors {@code RecipeEntity}.
    *
    * <p>{@code breakdown} is the typed jsonb meal-score envelope ({@link MealBreakdownJson}), always
    * NULL in v1 — the score is deferred to Phase-3 behind the FE pending-sparkle (same precedent as
    * {@code recipe.fit_score}).
    *
    * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
    *
    * <p><b>Soft delete does NOT cascade through {@code @OneToMany}</b>: {@code @SQLDelete} only
    * rewrites this row, so the service must bulk-soft-delete the {@code meal_item} children
    * explicitly on delete (via {@code MealItemRepository.softDeleteByMealId}).
    */
   @Getter
   @Setter
   @Entity
   @Table(name = "meal")
   @SQLDelete(sql = "update meal set is_deleted = true where id = ?")
   @SQLRestriction("is_deleted = false")
   public class MealEntity extends OwnedEntity {

       @Id
       @GeneratedValue
       @Column(columnDefinition = "uuid")
       private UUID id;

       @UpdateTimestamp
       @Column(name = "updated_at")
       private Instant updatedAt;

       @NotNull
       @Column(name = "logged_at", nullable = false)
       private Instant loggedAt;

       @NotNull
       @Column(name = "meal_date", nullable = false)
       private LocalDate mealDate;

       @NotNull
       @Column(nullable = false)
       private String slot; // breakfast|lunch|dinner|snack (DB CHECK)

       @Column
       private String title;

       @JdbcTypeCode(SqlTypes.JSON)
       @Column(columnDefinition = "jsonb")
       private MealBreakdownJson breakdown;

       @OneToMany(mappedBy = "meal", cascade = CascadeType.ALL, orphanRemoval = true)
       @OrderBy("lineOrder")
       private List<MealItemEntity> items = new ArrayList<>();
   }
   ```

2. Compile-check the entity layer. Run: `cd backend && ./mvnw -q clean compile`
   Expected: PASS — `MealEntity`, `MealItemEntity`, `MealBreakdownJson` now compile together
   (the db2 forward-reference resolves).

3. Commit the entity layer. Run:
   `git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/`
   then `git commit -m "feat(meal): add MealEntity + MealItemEntity + MealBreakdownJson (mezo-arb)"`

---

### Task db4: `MealRepository` (owner+day finder) + `MealItemRepository` (bulk soft-delete)

Add the two repositories. `MealRepository extends OwnedRepository<MealEntity>` (the date-ordered
family — meal HAS a date, unlike recipe) with the owner+day finder + by-id-owner finder.
`MealItemRepository` carries the `@Modifying softDeleteByMealId` (copy of
`RecipeIngredientRepository.softDeleteByRecipeId`). Grounded in `RecipeRepository`,
`RecipeIngredientRepository`, `OwnedRepository`, `docs/references/spring_patterns.md`
(derived → JPQL → native).

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/MealRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/MealItemRepository.java`

**Interfaces:**
- Consumes: `OwnedRepository<MealEntity>`; `MealEntity`, `MealItemEntity`.
- Produces (consumed by the service part + db8 IT):
  - `interface MealRepository extends OwnedRepository<MealEntity>` with:
    - `List<MealEntity> findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(UUID createdBy, LocalDate mealDate)`
    - `Optional<MealEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy)`
    - (inherited `findAllOwned` exists but is UNUSED here — its JPQL references `e.date`, which
      `MealEntity` does not have; the service uses the day-finder. Do not call `findAllOwned`.)
  - `interface MealItemRepository extends JpaRepository<MealItemEntity, UUID>` with:
    - `int softDeleteByMealId(UUID mealId)` (`@Modifying @Query`).

**Steps:**

1. Create `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/MealRepository.java` with
   EXACTLY this content:

   ```java
   package io.mrkuhne.mezo.feature.meal.repository;

   import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
   import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
   import java.time.LocalDate;
   import java.util.List;
   import java.util.Optional;
   import java.util.UUID;

   /**
    * meal HAS a date (logged_at / meal_date), so this extends the date-ordered {@link OwnedRepository}
    * family (UNLIKE {@code RecipeRepository}, which extends {@code JpaRepository} directly because a
    * recipe has no date). The inherited {@code findAllOwned} is unused here — its JPQL orders by an
    * {@code e.date} field that {@code MealEntity} does not have; callers use the owner+day finder.
    */
   public interface MealRepository extends OwnedRepository<MealEntity> {

       List<MealEntity> findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(
           UUID createdBy, LocalDate mealDate);

       Optional<MealEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
   }
   ```

2. Create `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/MealItemRepository.java`
   with EXACTLY this content:

   ```java
   package io.mrkuhne.mezo.feature.meal.repository;

   import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
   import java.util.UUID;
   import org.springframework.data.jpa.repository.JpaRepository;
   import org.springframework.data.jpa.repository.Modifying;
   import org.springframework.data.jpa.repository.Query;
   import org.springframework.data.repository.query.Param;

   public interface MealItemRepository extends JpaRepository<MealItemEntity, UUID> {

       /**
        * Bulk soft-delete of a meal's lines. @SQLDelete does NOT cascade through @OneToMany on a
        * parent soft-delete (a soft-delete is an UPDATE, so no Hibernate remove-cascade runs), so the
        * service triggers this explicitly before soft-deleting the parent. Set-based UPDATE -> JPQL
        * @Modifying (no derived form exists). Mirrors RecipeIngredientRepository.softDeleteByRecipeId.
        */
       @Modifying
       @Query("update MealItemEntity mi set mi.deleted = true "
           + "where mi.meal.id = :mealId and mi.deleted = false")
       int softDeleteByMealId(@Param("mealId") UUID mealId);
   }
   ```

3. Compile-check. Run: `cd backend && ./mvnw -q clean compile`
   Expected: PASS.

4. Commit. Run:
   `git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/`
   then `git commit -m "feat(meal): add MealRepository + MealItemRepository (mezo-arb)"`

---

### Task db5: register `meal` + `meal_item` in `ResetDatabase` TRUNCATE list

Add the two new owned tables to the test TRUNCATE list (growth rule from
`docs/references/integration_test_framework.md`: a new owned domain table joins the TRUNCATE list in
the same change that creates it). `meal_item` and `meal` must come BEFORE `recipe`/`pantry_item` in
the list is not required (TRUNCATE … CASCADE handles ordering), but list child before parent for
clarity.

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`

**Interfaces:**
- Consumes: tables `meal`, `meal_item` (db1).
- Produces: `ResetDatabase.resetExceptMasterData()` now also wipes `meal` + `meal_item` between tests.

**Steps:**

1. In `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`, edit the `TRUNCATE TABLE`
   native query to add `meal_item, meal,` at the FRONT of the table list. Replace:

   ```java
           entityManager.createNativeQuery(
               "TRUNCATE TABLE recipe_ingredient, recipe, pantry_item, weight_log, sleep_log, check_in, "
   ```

   with:

   ```java
           entityManager.createNativeQuery(
               "TRUNCATE TABLE meal_item, meal, recipe_ingredient, recipe, pantry_item, weight_log, sleep_log, check_in, "
   ```

2. (No separate run — validated by db8's IT and the full suite. Commit together with db6/db7 if
   preferred, or now.) Commit. Run:
   `git add backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
   then `git commit -m "test(meal): truncate meal + meal_item between tests (mezo-arb)"`

---

### Task db6: `MealPopulator` test factory (recipe-arm + pantry-arm)

Add the per-aggregate test factory. Two builders — `createRecipeMeal(owner, RecipeEntity)` (a
recipe-arm line) and `createPantryMeal(owner, PantryItemEntity)` (a pantry-arm line) — persist via
`saveAndFlush` (so DB CHECKs + cascade fire) and set the bidirectional `setMeal` back-ref (proven
required by `RecipePopulator`). Grounded in `RecipePopulator` (back-ref + reverse `lineOrder` to
prove `@OrderBy`).

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java`

**Interfaces:**
- Consumes: `MealRepository` (db4); `MealEntity`, `MealItemEntity` (db2/db3); `RecipeEntity`
  (`getId()`), `PantryItemEntity` (`getId()`).
- Produces (consumed by db8 IT + the service/controller parts' ITs):
  - `class MealPopulator` (`@TestComponent`, `@RequiredArgsConstructor`):
    - `MealEntity createRecipeMeal(UUID owner, RecipeEntity recipe)` — one recipe-arm line,
      `source = "recipe"`, `recipeId = recipe.getId()`, snapshot per-serving macros.
    - `MealEntity createPantryMeal(UUID owner, PantryItemEntity pantryItem)` — one pantry-arm line,
      `source = "pantry"`, `pantryItemId = pantryItem.getId()`, snapshot per-100g macros.

**Steps:**

1. Create `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java` with EXACTLY
   this content:

   ```java
   package io.mrkuhne.mezo.support.populator;

   import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
   import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
   import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
   import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
   import java.math.BigDecimal;
   import java.time.Instant;
   import java.time.LocalDate;
   import java.time.ZoneOffset;
   import java.util.UUID;
   import lombok.RequiredArgsConstructor;
   import org.springframework.boot.test.context.TestComponent;

   /**
    * Test data factory for the Meal aggregate — persists via {@code saveAndFlush} so the DB CHECKs
    * (incl. the polymorphic {@code ck_meal_item_arm} exactly-one-of) + the cascade fire. Two builders,
    * one per polymorphic arm. The line's {@code setMeal} back-reference is set explicitly (the child
    * owns the FK + @NotNull on {@code meal} fires at flush) — same requirement as {@code RecipePopulator}.
    */
   @TestComponent
   @RequiredArgsConstructor
   public class MealPopulator {

       private final MealRepository repository;

       /** A lunch meal with one recipe-arm line referencing the given (real, persisted) recipe. */
       public MealEntity createRecipeMeal(UUID owner, RecipeEntity recipe) {
           MealEntity meal = newMeal(owner, "lunch", "Ebéd");
           MealItemEntity line = baseLine(meal, owner, 0, new BigDecimal("2"), "adag");
           line.setSource("recipe");
           line.setRecipeId(recipe.getId());
           line.setSnapshotName(recipe.getName());
           line.setSnapshotPer(BigDecimal.ONE);
           line.setSnapshotBasisUnit("adag");
           line.setSnapshotKcal(new BigDecimal("520"));
           line.setSnapshotProteinG(new BigDecimal("38.0"));
           line.setSnapshotCarbsG(new BigDecimal("45.0"));
           line.setSnapshotFatG(new BigDecimal("18.0"));
           line.setSnapshotNova((short) 1);
           meal.getItems().add(line);
           return repository.saveAndFlush(meal);
       }

       /** A breakfast meal with one pantry-arm line referencing the given (real, persisted) pantry item. */
       public MealEntity createPantryMeal(UUID owner, PantryItemEntity pantryItem) {
           MealEntity meal = newMeal(owner, "breakfast", "Reggeli");
           MealItemEntity line = baseLine(meal, owner, 0, new BigDecimal("150"), "g");
           line.setSource("pantry");
           line.setPantryItemId(pantryItem.getId());
           line.setSnapshotName(pantryItem.getName());
           line.setSnapshotPer(new BigDecimal("100"));
           line.setSnapshotBasisUnit("g");
           line.setSnapshotKcal(new BigDecimal("110"));
           line.setSnapshotProteinG(new BigDecimal("23.0"));
           line.setSnapshotCarbsG(BigDecimal.ZERO);
           line.setSnapshotFatG(new BigDecimal("1.5"));
           line.setSnapshotNova((short) 1);
           meal.getItems().add(line);
           return repository.saveAndFlush(meal);
       }

       private MealEntity newMeal(UUID owner, String slot, String title) {
           MealEntity meal = new MealEntity();
           meal.setCreatedBy(owner);
           Instant loggedAt = Instant.parse("2026-06-24T11:30:00Z");
           meal.setLoggedAt(loggedAt);
           meal.setMealDate(LocalDate.ofInstant(loggedAt, ZoneOffset.UTC));
           meal.setSlot(slot);
           meal.setTitle(title);
           return meal;
       }

       // Bidirectional @OneToMany(mappedBy="meal"): the child owns the FK, so the back-reference must
       // be set explicitly (adding to meal.getItems() does not populate it, and @NotNull on `meal`
       // fires at flush before Hibernate would link the cascade) — same as RecipePopulator.
       private MealItemEntity baseLine(
           MealEntity meal, UUID owner, int order, BigDecimal amount, String unit) {
           MealItemEntity line = new MealItemEntity();
           line.setMeal(meal);
           line.setCreatedBy(owner);
           line.setLineOrder(order);
           line.setAmount(amount);
           line.setUnit(unit);
           return line;
       }
   }
   ```

2. (Validated by db8's IT, which autowires this populator. No standalone run.) Commit. Run:
   `git add backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java`
   then `git commit -m "test(meal): add MealPopulator factory (mezo-arb)"`

---

### Task db7: register `MealPopulator` in `AbstractIntegrationTest` `@Import`

Add `MealPopulator` to the base IT's `@Import` so every IT can autowire it (growth rule:
new aggregate → new populator, registered here). Grounded in `AbstractIntegrationTest` (the existing
`@Import` list).

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java`

**Interfaces:**
- Consumes: `MealPopulator` (db6).
- Produces: `MealPopulator` is now an injectable bean in every `AbstractIntegrationTest` subclass.

**Steps:**

1. In `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java`, add the import
   line (alphabetical, after the `GoalPopulator` import):

   ```java
   import io.mrkuhne.mezo.support.populator.MealPopulator;
   ```

2. In the same file, add `MealPopulator.class` to the `@Import({...})` list — insert it after
   `RecipePopulator.class`. Replace:

   ```java
       BiometricProfilePopulator.class, WeightLogPopulator.class, PantryItemPopulator.class,
       RecipePopulator.class, ResetDatabase.class})
   ```

   with:

   ```java
       BiometricProfilePopulator.class, WeightLogPopulator.class, PantryItemPopulator.class,
       RecipePopulator.class, MealPopulator.class, ResetDatabase.class})
   ```

3. (Validated by db8.) Commit. Run:
   `git add backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java`
   then `git commit -m "test(meal): register MealPopulator in AbstractIntegrationTest (mezo-arb)"`

---

### Task db8: `MealRepositoryIT` persistence integration test (TDD)

The persistence IT proving the aggregate end-to-end: cascade insert of children, `@OrderBy`
ordering on reload, soft-delete `@SQLRestriction` hiding the row, and the owner+day finder.
Grounded in `RecipeRepositoryIT` (the template: `@Transactional`, `entityManager.clear()` to force a
fresh reload so `@OrderBy` applies, populate owner + pantry/recipe FK targets first). TDD: write the
failing test first, watch it fail (since the schema/entities are only meaningful end-to-end here),
then confirm green.

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRepositoryIT.java`

**Interfaces:**
- Consumes: `MealRepository` (db4), `MealPopulator` (db6), `RecipePopulator`, `PantryItemPopulator`,
  `DatabasePopulator`, `AbstractIntegrationTest`.
- Produces: green persistence coverage of the meal aggregate (no public symbol other parts depend on).

**Steps:**

1. Write the failing test. Create
   `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRepositoryIT.java` with EXACTLY this
   content:

   ```java
   package io.mrkuhne.mezo.feature.meal;

   import static org.assertj.core.api.Assertions.assertThat;

   import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
   import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
   import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
   import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
   import io.mrkuhne.mezo.support.AbstractIntegrationTest;
   import io.mrkuhne.mezo.support.DatabasePopulator;
   import io.mrkuhne.mezo.support.populator.MealPopulator;
   import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
   import io.mrkuhne.mezo.support.populator.RecipePopulator;
   import jakarta.persistence.EntityManager;
   import jakarta.persistence.PersistenceContext;
   import java.time.LocalDate;
   import java.util.UUID;
   import org.junit.jupiter.api.Test;
   import org.springframework.beans.factory.annotation.Autowired;
   import org.springframework.transaction.annotation.Transactional;

   @Transactional
   class MealRepositoryIT extends AbstractIntegrationTest {

       @Autowired private MealRepository repository;
       @Autowired private MealPopulator mealPopulator;
       @Autowired private RecipePopulator recipePopulator;
       @Autowired private PantryItemPopulator pantryItemPopulator;
       @Autowired private DatabasePopulator databasePopulator;

       /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
       @PersistenceContext private EntityManager entityManager;

       // The day the MealPopulator stamps onto its meals (logged_at 2026-06-24T11:30Z, UTC date).
       private static final LocalDate MEAL_DAY = LocalDate.of(2026, 6, 24);

       // created_by + the source FKs (recipe / pantry_item) must all be real (populated first).
       @Test
       void testFindByOwnerAndDay_shouldPersistAggregateAndOrderLines_whenSaved() {
           UUID owner = databasePopulator.populateUser("owner@test.local");
           PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
           RecipeEntity recipe = recipePopulator.createRecipe(owner, food.getId());
           mealPopulator.createRecipeMeal(owner, recipe);
           mealPopulator.createPantryMeal(owner, food);
           // Drop the populator's managed instances so the finder loads the aggregate fresh from the DB,
           // where @OrderBy("lineOrder") actually applies (an already-initialized collection keeps order).
           entityManager.clear();

           var meals = repository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, MEAL_DAY);

           // Both meals are stamped the same instant; assert the set of slots + their polymorphic arms.
           assertThat(meals).hasSize(2);
           assertThat(meals).extracting(MealEntity::getSlot)
               .containsExactlyInAnyOrder("lunch", "breakfast");

           MealEntity recipeMeal = meals.stream().filter(m -> m.getSlot().equals("lunch")).findFirst().orElseThrow();
           assertThat(recipeMeal.getMealDate()).isEqualTo(MEAL_DAY);
           assertThat(recipeMeal.getBreakdown()).isNull(); // v1: score deferred
           assertThat(recipeMeal.getItems()).hasSize(1);
           MealItemEntity recipeLine = recipeMeal.getItems().get(0);
           assertThat(recipeLine.getSource()).isEqualTo("recipe");
           assertThat(recipeLine.getRecipeId()).isEqualTo(recipe.getId());
           assertThat(recipeLine.getPantryItemId()).isNull();
           assertThat(recipeLine.getSnapshotNova()).isEqualTo((short) 1);

           MealEntity pantryMeal = meals.stream().filter(m -> m.getSlot().equals("breakfast")).findFirst().orElseThrow();
           MealItemEntity pantryLine = pantryMeal.getItems().get(0);
           assertThat(pantryLine.getSource()).isEqualTo("pantry");
           assertThat(pantryLine.getPantryItemId()).isEqualTo(food.getId());
           assertThat(pantryLine.getRecipeId()).isNull();
       }

       @Test
       void testFindByOwnerAndDay_shouldHideRow_whenSoftDeleted() {
           UUID owner = databasePopulator.populateUser("owner@test.local");
           PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
           MealEntity meal = mealPopulator.createPantryMeal(owner, food);

           repository.delete(meal); // @SQLDelete soft-deletes the meal row

           assertThat(repository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, MEAL_DAY)).isEmpty();
           assertThat(repository.findByIdAndCreatedByAndDeletedFalse(meal.getId(), owner)).isEmpty();
       }

       @Test
       void testFindByOwnerAndDay_shouldScopeToOwner_whenAnotherUserHasMeals() {
           UUID owner = databasePopulator.populateUser("owner@test.local");
           UUID stranger = databasePopulator.populateUser("stranger@test.local");
           PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
           mealPopulator.createPantryMeal(stranger, food);

           assertThat(repository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, MEAL_DAY)).isEmpty();
       }
   }
   ```

2. Run the new IT and watch it fail meaningfully. Run:
   `cd backend && ./mvnw -q clean test -Dtest=MealRepositoryIT`
   Expected: PASS once db1–db7 are in place (the schema applies, the aggregate persists, the finder
   returns the rows). If db5 (`ResetDatabase`) or db7 (`@Import`) were skipped, this FAILS — either
   `MealPopulator` is not an injectable bean (`NoSuchBeanDefinitionException`) or rows leak between
   tests (assertion mismatch). That failure is the proof these registrations are wired; resolve by
   completing db5/db7, then re-run to GREEN.

3. Run the FULL backend suite to confirm no regression (the new TRUNCATE entry + `@Import` touch the
   shared base). Run:
   `cd backend && ./mvnw -q clean test`
   Expected: PASS — entire suite green, meal + meal_item truncated between tests.

4. Commit. Run:
   `git add backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRepositoryIT.java`
   then `git commit -m "test(meal): MealRepositoryIT persistence coverage (mezo-arb)"`

---

## Notes for downstream parts (mapper / service / controller)

- **Contribution formula** (identical to the recipe mapper + FE mock; the SERVICE/MAPPER parts own
  the computation, not DB): `factor = amount / snapshotPer` (per ≥ 1); per-axis
  `contribution = (snapshot.axis × factor).setScale(0, RoundingMode.HALF_UP)`; `meal.macros = Σ line
  contributions`; day `consumed = Σ the day's meal macros`.
- The service obtains the **recipe whole-macro rollup** by reusing `RecipeMapper.toResponse(recipe)
  .getMacros()` (inject `RecipeMapper`) and divides by `recipe.getServings()` for the per-serving
  snapshot — this part does NOT add a helper for it.
- `MealItemRepository.softDeleteByMealId(UUID)` MUST be called by the service BEFORE
  `repository.delete(meal)` on delete (soft-delete does not cascade through `@OneToMany`).
- `MealEntity.getItems()` is the live mutable list — full-replace update is `items.clear()` + add
  (orphanRemoval reaps the old children).

---

## Phase 3 — Mapper

# Meal Mapper (READ-ONLY projection)

> **Section key:** `map`. Driving bd: `mezo-arb`. Runs **after** the DB section (consumes `MealEntity` / `MealItemEntity`) and **before** the Service section (which consumes this mapper).
>
> **Owns:** `MealMapper` (`@Mapper(componentModel="spring")`) and `MealMapperTest` (pure unit test). The typed `MealBreakdownJson` record (the `meal.breakdown` jsonb envelope — NULL in v1) is **owned by the DB section**; the mapper does not reference it (`toResponse` sets `score = MealScore{value:null, breakdown:null}`, pending).
>
> **Does NOT own / never recreate:** `MealEntity`, `MealItemEntity`, repositories, populator (DB section); `MealService` / `FuelDayService` / the recipe-logs query (Service section); the controller + API ITs (Controller section).
>
> **Boundary:** the mapper is a **READ-ONLY projection**. It does NOT set scalars on the entity, does NOT rebuild items, does NOT resolve recipe/pantry snapshots, does NOT compute `meal_date`. The Service owns all writes (item rebuild + snapshot capture + `meal_date` + `created_by`). The `RecipeLogResponse` projection (for `GET /api/recipe/{id}/logs`) is **left to the Service** (it owns the cross-feature `meal_item` query) — the mapper does not produce it.
>
> **Pattern source (read first):** the shipped recipe mapper `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/mapper/RecipeMapper.java` (`toResponse` / `toLineResponse` / `contribution` / `rollup` / `scaled`) + its pure test `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperTest.java`. `meal_item` maps 1:1 onto `recipe_ingredient`; the contribution + rollup formula is **identical**. Reference: `docs/references/api_contract_conventions.md` (mappers consume the generated `api.dto.*` types directly; type bridges live as `default` methods).
>
> **Prereq — contract DTOs exist.** This section's code references generated `io.mrkuhne.mezo.api.dto.*` types (`MealResponse`, `MealItemResponse`, `Macros`, `MealScore`). They are generated by the Contract step from `api/feature/meal/meal.yml` during the backend `generate-sources` phase. The shared-interface DTO shapes are fixed and used verbatim below; if the Contract section runs first the names already match. Each test/build command runs `./mvnw clean` (Lombok+MapStruct incremental compile is flaky).

---

### Task map2: `MealMapperTest` — failing pure unit test (TDD red)

Pure test (no Spring): `new MealMapperImpl()` (MapStruct-generated impl, same as `RecipeMapperTest`). Asserts: per-item `contribution` rounding (HALF_UP, whole-number), meal `macros` rollup (Σ contributions), pending `score` (`value` null, `breakdown` null), and scalar/item passthrough (`source`, `name = snapshotName`, `nova = snapshotNova`, `lineOrder`). Uses both arms so the polymorphic item passthrough (`recipeId` set on a recipe line, `pantryItemId` set on a pantry line) is covered.

The numeric fixtures reuse the recipe test's proven values so the formula is demonstrably identical:
- line 0 (recipe arm): amount 2, per 1 → factor 2 → kcal 110·2=220, p 23·2=46, c 0, f 1.5·2=3.
- line 1 (pantry arm): amount 50, per 100 → factor 0.5 → kcal 100·0.5=50, p 10·0.5=5, c 20·0.5=10, f 5·0.5=2.5 → HALF_UP → 3.
- rollup: kcal 270, p 51, c 10, f 6.

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealMapperTest.java`

**Interfaces:**
- Consumes (must exist after map3): `MealMapper.toResponse(MealEntity) : MealResponse`; the generated `MealMapperImpl` no-arg ctor; `io.mrkuhne.mezo.api.dto.{MealResponse,MealItemResponse,Macros,MealScore}` getters.
- Consumes (DB section): `MealEntity` (no-arg ctor; `setSlot`, `setTitle`, `setLoggedAt`, `setMealDate`, `getItems()` returns a mutable `List<MealItemEntity>`); `MealItemEntity` (no-arg ctor; setters: `setSource`, `setRecipeId`, `setPantryItemId`, `setAmount`, `setUnit`, `setLineOrder`, `setSnapshotName`, `setSnapshotPer`, `setSnapshotBasisUnit`, `setSnapshotKcal`, `setSnapshotProteinG`, `setSnapshotCarbsG`, `setSnapshotFatG`, `setSnapshotNova`).

**Steps:**

1. Write the failing test with the full content below:

```java
package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapperImpl;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MealMapperTest {

    private final MealMapper mapper = new MealMapperImpl();

    private MealItemEntity item(
        String source, UUID recipeId, UUID pantryItemId,
        BigDecimal amount, BigDecimal per, String name, Short nova,
        String kcal, String p, String c, String f, int order) {
        MealItemEntity i = new MealItemEntity();
        i.setSource(source);
        i.setRecipeId(recipeId);
        i.setPantryItemId(pantryItemId);
        i.setAmount(amount);
        i.setUnit("g");
        i.setLineOrder(order);
        i.setSnapshotName(name);
        i.setSnapshotPer(per);
        i.setSnapshotBasisUnit("g");
        i.setSnapshotKcal(new BigDecimal(kcal));
        i.setSnapshotProteinG(new BigDecimal(p));
        i.setSnapshotCarbsG(new BigDecimal(c));
        i.setSnapshotFatG(new BigDecimal(f));
        i.setSnapshotNova(nova);
        return i;
    }

    private MealEntity meal() {
        MealEntity m = new MealEntity();
        m.setSlot("lunch");
        m.setTitle("Ebéd");
        m.setLoggedAt(Instant.parse("2026-06-24T11:20:00Z"));
        m.setMealDate(LocalDate.parse("2026-06-24"));
        UUID recipeId = UUID.randomUUID();
        UUID pantryItemId = UUID.randomUUID();
        // recipe arm: amount 2, per 1 -> factor 2 -> kcal 220, p 46, c 0, f 3
        m.getItems().add(item("recipe", recipeId, null,
            new BigDecimal("2"), new BigDecimal("1"), "Túrós tál", (short) 1,
            "110", "23", "0", "1.5", 0));
        // pantry arm: amount 50, per 100 -> factor 0.5 -> kcal 50, p 5, c 10, f round(2.5)=3
        m.getItems().add(item("pantry", null, pantryItemId,
            new BigDecimal("50"), new BigDecimal("100"), "Zabpehely", (short) 2,
            "100", "10", "20", "5", 1));
        return m;
    }

    @Test
    void testToResponse_shouldComputeRoundedContributionsAndMealRollup_whenItemsPresent() {
        MealResponse r = mapper.toResponse(meal());

        // item 0 (recipe arm): factor 2 -> kcal 220, p 46, c 0, f 3
        assertThat(r.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("220");
        assertThat(r.getItems().get(0).getContribution().getP()).isEqualByComparingTo("46");
        assertThat(r.getItems().get(0).getContribution().getC()).isEqualByComparingTo("0");
        assertThat(r.getItems().get(0).getContribution().getF()).isEqualByComparingTo("3");
        // item 1 (pantry arm): factor 0.5 -> kcal 50, p 5, c 10, f round(2.5)=3 (HALF_UP)
        assertThat(r.getItems().get(1).getContribution().getKcal()).isEqualByComparingTo("50");
        assertThat(r.getItems().get(1).getContribution().getP()).isEqualByComparingTo("5");
        assertThat(r.getItems().get(1).getContribution().getC()).isEqualByComparingTo("10");
        assertThat(r.getItems().get(1).getContribution().getF()).isEqualByComparingTo("3");
        // meal macros = Σ item contributions: kcal 270, p 51, c 10, f 6
        assertThat(r.getMacros().getKcal()).isEqualByComparingTo("270");
        assertThat(r.getMacros().getP()).isEqualByComparingTo("51");
        assertThat(r.getMacros().getC()).isEqualByComparingTo("10");
        assertThat(r.getMacros().getF()).isEqualByComparingTo("6");
    }

    @Test
    void testToResponse_shouldEmitPendingScore_whenBreakdownNull() {
        MealResponse r = mapper.toResponse(meal());

        assertThat(r.getScore()).isNotNull();
        assertThat(r.getScore().getValue()).isNull();
        assertThat(r.getScore().getBreakdown()).isNull();
    }

    @Test
    void testToResponse_shouldPassThroughPolymorphicItemFields_whenMapped() {
        MealEntity m = meal();
        UUID recipeId = m.getItems().get(0).getRecipeId();
        UUID pantryItemId = m.getItems().get(1).getPantryItemId();

        MealResponse r = mapper.toResponse(m);

        assertThat(r.getSlot()).isEqualTo("lunch");
        assertThat(r.getTitle()).isEqualTo("Ebéd");
        // recipe arm item
        assertThat(r.getItems().get(0).getSource()).isEqualTo("recipe");
        assertThat(r.getItems().get(0).getRecipeId()).isEqualTo(recipeId);
        assertThat(r.getItems().get(0).getPantryItemId()).isNull();
        assertThat(r.getItems().get(0).getName()).isEqualTo("Túrós tál");
        assertThat(r.getItems().get(0).getNova()).isEqualByComparingTo("1");
        assertThat(r.getItems().get(0).getLineOrder()).isEqualTo(0);
        // pantry arm item
        assertThat(r.getItems().get(1).getSource()).isEqualTo("pantry");
        assertThat(r.getItems().get(1).getPantryItemId()).isEqualTo(pantryItemId);
        assertThat(r.getItems().get(1).getRecipeId()).isNull();
        assertThat(r.getItems().get(1).getName()).isEqualTo("Zabpehely");
        assertThat(r.getItems().get(1).getNova()).isEqualByComparingTo("2");
    }

    @Test
    void testToResponse_shouldDefaultPerToOne_whenSnapshotPerNullOrZero() {
        MealEntity m = new MealEntity();
        m.setSlot("snack");
        m.setLoggedAt(Instant.parse("2026-06-24T15:00:00Z"));
        m.setMealDate(LocalDate.parse("2026-06-24"));
        // per = 0 -> factor falls back to ONE -> contribution == snapshot macros
        m.getItems().add(item("pantry", null, UUID.randomUUID(),
            new BigDecimal("1"), BigDecimal.ZERO, "Alma", (short) 1,
            "52", "0", "14", "0", 0));

        MealResponse r = mapper.toResponse(m);

        assertThat(r.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("52");
        assertThat(r.getItems().get(0).getContribution().getC()).isEqualByComparingTo("14");
    }
}
```

2. Run it — it must FAIL (no `MealMapper` / `MealMapperImpl` yet):
   `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=MealMapperTest -q`
   Expected: **compilation failure** — `cannot find symbol: class MealMapper` / `class MealMapperImpl` (red).

3. Do NOT commit yet (red test commits with the impl in map3).

---

### Task map3: Implement `MealMapper` and make the test green (TDD green)

`@Mapper(componentModel="spring")` interface with `default` methods (identical idiom to `RecipeMapper`). **READ-ONLY projection only** — no `applyScalars`, no item rebuild, no snapshot resolve, no `meal_date` derivation (the Service owns all of that). Maps:
- `toResponse(MealEntity) → MealResponse`: scalars (`id`, `slot`, `loggedAt` via `OffsetDateTime` bridge, `mealDate`, `title`) + `macros = rollup(items contributions)` + `score = MealScore{value:null, breakdown:null}` (pending) + `items = mapped`.
- `toItemResponse(MealItemEntity) → MealItemResponse`: `source` / `recipeId` / `pantryItemId` / `amount` / `unit` / `lineOrder` / `name = snapshotName` / `nova = snapshotNova` (Short→BigDecimal bridge) / `contribution`.
- `contribution(MealItemEntity) → Macros`: `factor = amount / snapshotPer` (per null or 0 → ONE); each macro `setScale(0, HALF_UP)`.
- `rollup(items) → Macros`: Σ item contributions.

`loggedAt` bridge: `MealEntity.loggedAt` is `Instant`; the contract `MealResponse.loggedAt` is `OffsetDateTime` (generated for `format: date-time`). Bridge as a `default` method (`instant.atOffset(ZoneOffset.UTC)`), mirroring `api_contract_conventions.md`'s "type bridges live in the mapper as default methods". `mealDate` is `LocalDate` (contract `format: date` → `LocalDate`), no bridge.

> **Note for the Service section:** the Service computes `consumed` and the recipe per-serving macro rollup by reusing this mapper's public projection. Reusable seams exposed: `toResponse(meal).getMacros()` gives the meal rollup; `rollup(...)` / `contribution(...)` are `default` (interface-visible) helpers. The Service injects `MealMapper` and calls `toResponse`; it does NOT re-implement the contribution formula.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/mapper/MealMapper.java`

**Interfaces:**
- Consumes (DB section): `MealEntity` getters (`getId`, `getSlot`, `getLoggedAt():Instant`, `getMealDate():LocalDate`, `getTitle`, `getItems():List<MealItemEntity>`); `MealItemEntity` getters (`getSource`, `getRecipeId():UUID`, `getPantryItemId():UUID`, `getAmount():BigDecimal`, `getUnit`, `getLineOrder():Integer`, `getSnapshotName`, `getSnapshotPer():BigDecimal`, `getSnapshotKcal/ProteinG/CarbsG/FatG():BigDecimal`, `getSnapshotNova():Short`).
- Consumes (contract): `io.mrkuhne.mezo.api.dto.{MealResponse,MealItemResponse,Macros,MealScore}` builders.
- Produces (the Service + Controller sections depend on these EXACT signatures):
  - `MealResponse toResponse(MealEntity e)`
  - `MealItemResponse toItemResponse(MealItemEntity i)`
  - `Macros contribution(MealItemEntity i)`
  - the MapStruct-generated `io.mrkuhne.mezo.feature.meal.mapper.MealMapperImpl` (Spring bean `mealMapper`; no-arg ctor for the pure test).

**Steps:**

1. Create the file with the full content below:

```java
package io.mrkuhne.mezo.feature.meal.mapper;

import io.mrkuhne.mezo.api.dto.Macros;
import io.mrkuhne.mezo.api.dto.MealItemResponse;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.MealScore;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.mapstruct.Mapper;

/**
 * READ-ONLY projection of the meal aggregate to its contract response. Mirrors {@code RecipeMapper}:
 * {@code meal_item} maps 1:1 onto {@code recipe_ingredient} and the per-item {@code contribution}
 * formula (factor = amount / snapshotPer; round HALF_UP whole-number) + the {@code rollup}
 * (Σ contributions) are IDENTICAL.
 *
 * <p>This mapper owns NO writes: it never sets scalars on the entity, rebuilds items, resolves
 * recipe/pantry snapshots, or derives {@code meal_date} — the service owns all of that. The
 * {@code meal.breakdown} score is NULL in v1, so {@link #toScore()} always emits the pending
 * {@code MealScore{value:null, breakdown:null}} (FE renders the pending sparkle).
 */
@Mapper(componentModel = "spring")
public interface MealMapper {

    default MealResponse toResponse(MealEntity e) {
        List<MealItemResponse> items = e.getItems() == null ? List.of()
            : e.getItems().stream().map(this::toItemResponse).toList();
        return MealResponse.builder()
            .id(e.getId())
            .slot(e.getSlot())
            .loggedAt(toOffset(e.getLoggedAt()))
            .mealDate(e.getMealDate())
            .title(e.getTitle())
            .macros(rollup(items))
            .score(toScore())                 // value+breakdown NULL -> pending sparkle on FE
            .items(items)
            .build();
    }

    default MealItemResponse toItemResponse(MealItemEntity i) {
        return MealItemResponse.builder()
            .source(i.getSource())
            .recipeId(i.getRecipeId())
            .pantryItemId(i.getPantryItemId())
            .amount(i.getAmount())
            .unit(i.getUnit())
            .lineOrder(i.getLineOrder())
            .name(i.getSnapshotName())
            .nova(i.getSnapshotNova() == null ? null : new BigDecimal(i.getSnapshotNova().intValue()))
            .contribution(contribution(i))
            .build();
    }

    /** Per-item contribution: factor = amount / snapshotPer (per null/0 -> ONE); round HALF_UP. */
    default Macros contribution(MealItemEntity i) {
        BigDecimal per = i.getSnapshotPer() == null || i.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : i.getSnapshotPer();
        BigDecimal factor = i.getAmount().divide(per, 6, RoundingMode.HALF_UP);
        return Macros.builder()
            .kcal(scaled(i.getSnapshotKcal(), factor))
            .p(scaled(i.getSnapshotProteinG(), factor))
            .c(scaled(i.getSnapshotCarbsG(), factor))
            .f(scaled(i.getSnapshotFatG(), factor))
            .build();
    }

    /** Meal macros = Σ item contributions. */
    default Macros rollup(List<MealItemResponse> items) {
        BigDecimal kcal = BigDecimal.ZERO, p = BigDecimal.ZERO, c = BigDecimal.ZERO, f = BigDecimal.ZERO;
        for (MealItemResponse i : items) {
            Macros x = i.getContribution();
            kcal = kcal.add(x.getKcal());
            p = p.add(x.getP());
            c = c.add(x.getC());
            f = f.add(x.getF());
        }
        return Macros.builder().kcal(kcal).p(p).c(c).f(f).build();
    }

    /** Pending score envelope — Phase-3 fills value+breakdown; NULL in v1. */
    default MealScore toScore() {
        return MealScore.builder().value(null).breakdown(null).build();
    }

    /** Entity {@code Instant} -> contract {@code OffsetDateTime} (UTC). */
    default OffsetDateTime toOffset(java.time.Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    private static BigDecimal scaled(BigDecimal base, BigDecimal factor) {
        BigDecimal v = base == null ? BigDecimal.ZERO : base;
        return v.multiply(factor).setScale(0, RoundingMode.HALF_UP);
    }
}
```

2. Run the test — it must PASS:
   `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=MealMapperTest -q`
   Expected: **BUILD SUCCESS**, 4 tests green (`testToResponse_should…ContributionsAndMealRollup`, `…PendingScore`, `…PolymorphicItemFields`, `…DefaultPerToOne`).

3. Commit the test + impl together:
   `git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/mapper/MealMapper.java backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealMapperTest.java`
   `git commit -m "feat(meal): add read-only MealMapper projection + pure unit test (mezo-arb)"`

---

## Phase 4 — Service

# Meal Service section

Driving bd: `mezo-arb`. Base pkg `io.mrkuhne.mezo`. This section OWNS `NutritionTargetsProperties`,
`MealService`, `FuelDayService` (folded as a separate `@Service`), the recipe-logs query helper
(`MealItemRepository.findByRecipeIdAndCreatedByAndDeletedFalse` + `MealService.recipeLogs`), and their
service-level ITs. It CONSUMES the DB section's `MealEntity` / `MealItemEntity` / `MealRepository` /
`MealItemRepository` (the bulk soft-delete) / `MealPopulator`, and the MAPPER section's `MealMapper`.
It does NOT recreate any of those.

Patterns are grounded in the shipped recipe slice: `RecipeService` (resolve/snapshot/rebuild/requireOwned),
`RecipeMapper` (the whole-recipe macro rollup we reuse for the recipe-arm per-serving snapshot),
`CheckInService` (the `meal_date = logged_at.toLocalDate()` server-side date write-path),
`GoalEngineProperties` + `GoalEnginePropertiesIT` (the `@Validated @ConfigurationProperties` record +
its binding IT), and `RecipeServiceIT` (service-IT shape: `@Transactional`, `AbstractIntegrationTest`,
AssertJ, owners via `databasePopulator.populateUser`, source rows via the populators).

Consult before coding: `docs/references/spring_patterns.md` (constructor DI via
`@RequiredArgsConstructor`, method-level `@Transactional`), `docs/references/error_handling.md`
(`SystemRuntimeErrorException` + `SystemMessage.field/error`, never hardcoded user text),
`docs/references/configuration_conventions.md` (everything under `mezo:` root, `@Validated`
`*Properties` record, never `@Value`), `docs/references/testing_standards.md` +
`docs/references/integration_test_framework.md` (integration-first, real Postgres, AssertJ only, no
mocks, data via populators).

> NOTE on generated DTO field names. The contract / DB sections define the api.dto types. This section
> uses the SHARED-INTERFACE names verbatim: `FuelDayResponse{date,targets,consumed,meals}`,
> `MacroSet{kcal,p,c,f,water}`, `MealResponse`, `MealRequest{slot,loggedAt,title,items}`,
> `MealItemRequest{source,recipeId,pantryItemId,amount,unit}`, `RecipeLogResponse{mealId,slot,loggedAt,kcal,p,c,f}`,
> `RecipeLogListResponse{recentLogs}`. If a generated getter differs only by casing/builder it is the
> MapStruct/openapi-generator default (`getXxx()` / `Xxx.builder()`), exactly as in the recipe slice.

---

### Task svc1: `NutritionTargetsProperties` config record (RED: binding IT)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/config/NutritionTargetsProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/NutritionTargetsPropertiesIT.java`

**Interfaces:**
- Consumes: `@ConfigurationPropertiesScan` (already on `MezoApplication` — no manual registration),
  the `mezo:` YAML root.
- Produces: `io.mrkuhne.mezo.feature.meal.config.NutritionTargetsProperties` — a `@Validated`
  `@ConfigurationProperties(prefix = "mezo.nutrition")` record with accessors
  `Integer kcal()`, `Integer p()`, `Integer c()`, `Integer f()`, `Integer water()`
  (defaults 3100 / 220 / 380 / 95 / 4000). Consumed by `FuelDayService` (svc4).

**Steps:**

1. Write the failing binding IT (mirrors `GoalEnginePropertiesIT`). Full file:
   ```java
   package io.mrkuhne.mezo.feature.meal;

   import static org.assertj.core.api.Assertions.assertThat;

   import io.mrkuhne.mezo.feature.meal.config.NutritionTargetsProperties;
   import org.junit.jupiter.api.Test;
   import org.springframework.beans.factory.annotation.Autowired;
   import org.springframework.boot.test.context.SpringBootTest;

   /**
    * Verifies that the {@code mezo.nutrition.*} block in {@code application.yml} binds onto
    * {@link NutritionTargetsProperties} with the seed daily targets — see
    * docs/references/configuration_conventions.md. Pure config has no meaningful RED-before-GREEN
    * failure mode beyond "the bean does not exist / does not bind"; it goes green once the record
    * and its YAML block are in place.
    */
   @SpringBootTest
   class NutritionTargetsPropertiesIT {

       @Autowired
       private NutritionTargetsProperties props;

       @Test
       void testDefaults_shouldBindSeedTargets_whenContextLoads() {
           assertThat(props.kcal()).isEqualTo(3100);
           assertThat(props.p()).isEqualTo(220);
           assertThat(props.c()).isEqualTo(380);
           assertThat(props.f()).isEqualTo(95);
           assertThat(props.water()).isEqualTo(4000);
       }
   }
   ```

2. Run it — expect FAILURE (no such bean / context fails to start):
   ```bash
   cd backend && ./mvnw clean test -Dtest=NutritionTargetsPropertiesIT
   ```
   Expected: compilation/`NoSuchBeanDefinitionException` failure on `NutritionTargetsProperties`.

3. Implement the record. Full file:
   ```java
   package io.mrkuhne.mezo.feature.meal.config;

   import jakarta.validation.constraints.NotNull;
   import jakarta.validation.constraints.Positive;
   import org.springframework.boot.context.properties.ConfigurationProperties;
   import org.springframework.validation.annotation.Validated;

   /**
    * Binds {@code mezo.nutrition.*} — the owner-wide daily macro targets that feed the Fuel-day
    * MacroHero (targets vs consumed). See docs/references/configuration_conventions.md. First
    * config-driven domain value feeding a UI hero; replaces the hardcoded mock {@code 2500}/{@code 3100}.
    *
    * <p>Natural next step (out of scope): read targets from the active {@code goal.prescription} jsonb
    * so they become Reta-phase-aware. For v1 these are constants.
    */
   @Validated
   @ConfigurationProperties(prefix = "mezo.nutrition")
   public record NutritionTargetsProperties(
       @NotNull @Positive Integer kcal,  // 3100
       @NotNull @Positive Integer p,     // 220 g protein
       @NotNull @Positive Integer c,     // 380 g carbs
       @NotNull @Positive Integer f,     // 95 g fat
       @NotNull @Positive Integer water  // 4000 ml
   ) {
   }
   ```

4. Add the YAML block. Insert under the `mezo:` root in
   `backend/src/main/resources/application.yml`, after the `goal:` block (before `management:`):
   ```yaml
     nutrition:
       # Owner-wide daily macro targets feeding the Fuel-day MacroHero (targets vs consumed).
       # Binds onto NutritionTargetsProperties; replaces the hardcoded mock 2500/3100 floor.
       kcal: 3100
       p: 220
       c: 380
       f: 95
       water: 4000
   ```

5. Run — expect PASS:
   ```bash
   cd backend && ./mvnw clean test -Dtest=NutritionTargetsPropertiesIT
   ```
   Expected: 1 test, green.

6. Commit:
   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/config/NutritionTargetsProperties.java \
           backend/src/main/resources/application.yml \
           backend/src/test/java/io/mrkuhne/mezo/feature/meal/NutritionTargetsPropertiesIT.java
   git commit -m "feat(meal): add nutrition-targets config properties (mezo-arb)"
   ```

---

### Task svc2: `MealService.create` — recipe-arm + pantry-arm snapshot + rollup (RED→GREEN)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealServiceIT.java`

**Interfaces:**
- Consumes (DB section): `MealEntity` (`setCreatedBy`, `setLoggedAt`, `setMealDate`, `setSlot`,
  `setTitle`, `getItems()` returning a mutable `List<MealItemEntity>`, `getId`); `MealItemEntity`
  (`setCreatedBy`, `setMeal`, `setLineOrder`, `setSource`, `setRecipeId`, `setPantryItemId`,
  `setAmount`, `setUnit`, `setSnapshotName`, `setSnapshotPer`, `setSnapshotBasisUnit`,
  `setSnapshotKcal`, `setSnapshotProteinG`, `setSnapshotCarbsG`, `setSnapshotFatG`, `setSnapshotNova`);
  `MealRepository.save(MealEntity)`, `MealRepository.findByIdAndCreatedByAndDeletedFalse(UUID,UUID)`.
- Consumes (recipe slice): `RecipeRepository.findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy)`,
  `RecipeEntity.getName()/getServings()/getNovaDominant()`, `RecipeMapper.toResponse(RecipeEntity)`
  → `.getMacros()` (`RecipeMacros{getKcal,getP,getC,getF}` BigDecimal).
- Consumes (pantry slice): `PantryItemRepository.findByIdAndCreatedByAndDeletedFalse(UUID,UUID)`,
  `PantryItemEntity.getName/getServingAmount/getServingUnit/getKcal/getProteinG/getCarbsG/getFatG/getNova`.
- Consumes (mapper section): `MealMapper.toResponse(MealEntity)` → `MealResponse`.
- Consumes (techcore): `SystemRuntimeErrorException`, `SystemMessage.field("VALIDATION_INVALID_VALUE","items")`.
- Produces (EXACT public names the controller delegates to):
  - `MealResponse create(UUID userId, MealRequest req)`
  - `FuelDayResponse getDay(UUID userId, LocalDate date)` *(impl lands in svc4; declared here so the
    class compiles — added in svc4)*
  - `void update(UUID userId, UUID id, MealRequest req)` *(svc3)*
  - `void delete(UUID userId, UUID id)` *(svc3)*
  - `List<RecipeLogResponse> recipeLogs(UUID userId, UUID recipeId)` *(svc5)*

**Steps:**

1. Write the failing `create` IT (both arms + the two reject arms). Full file:
   ```java
   package io.mrkuhne.mezo.feature.meal;

   import static org.assertj.core.api.Assertions.assertThat;
   import static org.assertj.core.api.Assertions.assertThatThrownBy;

   import io.mrkuhne.mezo.api.dto.MealItemRequest;
   import io.mrkuhne.mezo.api.dto.MealRequest;
   import io.mrkuhne.mezo.api.dto.MealResponse;
   import io.mrkuhne.mezo.feature.meal.service.MealService;
   import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
   import io.mrkuhne.mezo.support.AbstractIntegrationTest;
   import io.mrkuhne.mezo.support.DatabasePopulator;
   import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
   import io.mrkuhne.mezo.support.populator.RecipePopulator;
   import java.math.BigDecimal;
   import java.time.LocalDate;
   import java.time.OffsetDateTime;
   import java.time.ZoneOffset;
   import java.util.List;
   import java.util.UUID;
   import org.junit.jupiter.api.BeforeEach;
   import org.junit.jupiter.api.Test;
   import org.springframework.beans.factory.annotation.Autowired;
   import org.springframework.transaction.annotation.Transactional;

   @Transactional
   class MealServiceIT extends AbstractIntegrationTest {

       @Autowired private MealService service;
       @Autowired private PantryItemPopulator pantryPopulator;
       @Autowired private RecipePopulator recipePopulator;
       @Autowired private DatabasePopulator databasePopulator;

       private UUID owner;
       private UUID other;

       @BeforeEach
       void setUpOwners() {
           owner = databasePopulator.populateUser("a@test.local");
           other = databasePopulator.populateUser("b@test.local");
       }

       // 110 kcal / 23 P / 0 C / 1.5 F per 100 g serving (cf. PantryItemPopulator.createFood).
       private PantryItemEntity food(UUID who, String name) {
           return pantryPopulator.createFood(who, name, LocalDate.of(2026, 5, 25));
       }

       // RecipePopulator: 2 servings, two lines snapshot-per 100 g (110/13/4/4.5), amounts 250 + 20.
       // Túró 250 g -> factor 2.5 -> 275/32.5/10/11.25 -> round 275/33/10/11
       // Méz   20 g -> factor 0.2 ->  22/2.6/0.8/0.9   -> round  22/3/1/1
       // whole rollup = 297 / 36 / 11 / 12 ; per serving (÷2, HALF_UP) = 149 / 18 / 6 / 6
       private RecipeEntity recipe(UUID who) {
           PantryItemEntity src = food(who, "Túró forrás");
           return recipePopulator.createRecipe(who, src.getId());
       }

       private MealItemRequest recipeItem(UUID recipeId, String adag) {
           MealItemRequest i = new MealItemRequest();
           i.setSource("recipe");
           i.setRecipeId(recipeId);
           i.setAmount(new BigDecimal(adag));
           i.setUnit("adag");
           return i;
       }

       private MealItemRequest pantryItem(UUID pantryItemId, String grams) {
           MealItemRequest i = new MealItemRequest();
           i.setSource("pantry");
           i.setPantryItemId(pantryItemId);
           i.setAmount(new BigDecimal(grams));
           i.setUnit("g");
           return i;
       }

       private MealRequest req(String slot, MealItemRequest... items) {
           MealRequest r = new MealRequest();
           r.setSlot(slot);
           r.setLoggedAt(OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC));
           r.setTitle("Ebéd");
           r.setItems(List.of(items));
           return r;
       }

       @Test
       void testCreate_shouldSnapshotRecipeArm_whenSourceIsRecipe() {
           RecipeEntity r = recipe(owner);

           MealResponse meal = service.create(owner, req("lunch", recipeItem(r.getId(), "1")));

           assertThat(meal.getId()).isNotNull();
           assertThat(meal.getSlot()).isEqualTo("lunch");
           assertThat(meal.getMealDate()).isEqualTo(LocalDate.of(2026, 6, 24));
           assertThat(meal.getItems()).singleElement().satisfies(i -> {
               assertThat(i.getSource()).isEqualTo("recipe");
               assertThat(i.getRecipeId()).isEqualTo(r.getId());
               assertThat(i.getPantryItemId()).isNull();
               assertThat(i.getName()).isEqualTo("Túrós tál"); // recipe name snapshot
               assertThat(i.getLineOrder()).isEqualTo(0);
               assertThat(i.getNova()).isEqualByComparingTo(BigDecimal.valueOf(1));
               // per serving = whole rollup (297/36/11/12) ÷ 2 servings -> 149/18/6/6 ; amount 1 adag -> identity
               assertThat(i.getContribution().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(149));
               assertThat(i.getContribution().getP()).isEqualByComparingTo(BigDecimal.valueOf(18));
           });
           // meal rollup = the single item contribution
           assertThat(meal.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(149));
           // score is pending (NULL breakdown)
           assertThat(meal.getScore().getValue()).isNull();
       }

       @Test
       void testCreate_shouldSnapshotPantryArm_whenSourcePantry() {
           PantryItemEntity p = food(owner, "Csirkemell"); // 110/23/0/1.5 per 100 g

           MealResponse meal = service.create(owner, req("lunch", pantryItem(p.getId(), "200")));

           assertThat(meal.getItems()).singleElement().satisfies(i -> {
               assertThat(i.getSource()).isEqualTo("pantry");
               assertThat(i.getPantryItemId()).isEqualTo(p.getId());
               assertThat(i.getRecipeId()).isNull();
               assertThat(i.getName()).isEqualTo("Csirkemell");
               // factor = 200 / 100 = 2 -> 220/46/0/3
               assertThat(i.getContribution().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(220));
               assertThat(i.getContribution().getP()).isEqualByComparingTo(BigDecimal.valueOf(46));
               assertThat(i.getContribution().getF()).isEqualByComparingTo(BigDecimal.valueOf(3));
           });
           assertThat(meal.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(220));
       }

       @Test
       void testCreate_shouldOrderItemsByRequestIndex_whenMixedArms() {
           RecipeEntity r = recipe(owner);
           PantryItemEntity p = food(owner, "Csirkemell");

           MealResponse meal = service.create(owner, req("lunch",
               pantryItem(p.getId(), "100"), recipeItem(r.getId(), "1")));

           assertThat(meal.getItems()).extracting("lineOrder").containsExactly(0, 1);
           assertThat(meal.getItems()).extracting("source").containsExactly("pantry", "recipe");
       }

       @Test
       void testCreate_shouldReject_whenRecipeMissingOrForeign() {
           RecipeEntity foreign = recipe(other);

           assertThatThrownBy(() -> service.create(owner, req("lunch", recipeItem(UUID.randomUUID(), "1"))))
               .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
           assertThatThrownBy(() -> service.create(owner, req("lunch", recipeItem(foreign.getId(), "1"))))
               .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
       }

       @Test
       void testCreate_shouldReject_whenPantryMissingOrForeign() {
           PantryItemEntity foreign = food(other, "Idegen");

           assertThatThrownBy(() -> service.create(owner, req("lunch", pantryItem(UUID.randomUUID(), "100"))))
               .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
           assertThatThrownBy(() -> service.create(owner, req("lunch", pantryItem(foreign.getId(), "100"))))
               .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
       }

       @Test
       void testCreate_shouldDefaultMealDateToNow_whenLoggedAtNull() {
           PantryItemEntity p = food(owner, "Csirkemell");
           MealRequest r = req("snack", pantryItem(p.getId(), "100"));
           r.setLoggedAt(null);

           MealResponse meal = service.create(owner, r);

           assertThat(meal.getLoggedAt()).isNotNull();
           assertThat(meal.getMealDate()).isEqualTo(LocalDate.now(ZoneOffset.UTC));
       }
   }
   ```

2. Run — expect FAILURE (no `MealService` class):
   ```bash
   cd backend && ./mvnw clean test -Dtest=MealServiceIT
   ```
   Expected: compilation failure (cannot find `MealService`).

3. Implement `MealService` (create + the resolve/snapshot/rebuild scaffold; update/delete/getDay/recipeLogs
   stubbed minimally so the class compiles — fleshed out in svc3/svc4/svc5). Full file:
   ```java
   package io.mrkuhne.mezo.feature.meal.service;

   import io.mrkuhne.mezo.api.dto.MealItemRequest;
   import io.mrkuhne.mezo.api.dto.MealRequest;
   import io.mrkuhne.mezo.api.dto.MealResponse;
   import io.mrkuhne.mezo.api.dto.RecipeLogResponse;
   import io.mrkuhne.mezo.api.dto.RecipeMacros;
   import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
   import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
   import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
   import io.mrkuhne.mezo.feature.meal.repository.MealItemRepository;
   import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
   import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
   import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
   import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
   import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
   import io.mrkuhne.mezo.techcore.exception.SystemMessage;
   import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
   import java.math.BigDecimal;
   import java.math.RoundingMode;
   import java.time.Instant;
   import java.time.LocalDate;
   import java.time.OffsetDateTime;
   import java.time.ZoneOffset;
   import java.util.List;
   import java.util.UUID;
   import lombok.RequiredArgsConstructor;
   import org.springframework.http.HttpStatus;
   import org.springframework.stereotype.Service;
   import org.springframework.transaction.annotation.Transactional;

   /**
    * Owner-scoped meal logging over the {@code meal} → {@code meal_item} aggregate (mirrors
    * {@link io.mrkuhne.mezo.feature.recipe.service.RecipeService}). A logged item is POLYMORPHIC:
    * it references a recipe OR a pantry item ({@code source} discriminator + exactly-one-of arm).
    * Each item captures a per-basis macro snapshot at write time so the line stays renderable after
    * the source is soft-deleted, identical in rationale to {@code recipe_ingredient}.
    *
    * <p>Contribution formula (identical to the recipe mapper + the FE mock):
    * {@code factor = amount / snapshotPer}; {@code contribution.X = round(snapshot.X × factor)}
    * whole-number HALF_UP; {@code meal.macros = Σ line contributions}.
    *
    * <p>{@code breakdown} (the meal score envelope) stays NULL in v1 — pending-sparkle on the FE.
    */
   @Service
   @RequiredArgsConstructor
   public class MealService {

       private final MealRepository repository;
       private final MealItemRepository mealItemRepository;
       private final RecipeRepository recipeRepository;
       private final PantryItemRepository pantryItemRepository;
       private final RecipeMapper recipeMapper; // reused for the recipe whole-macro rollup
       private final MealMapper mapper;

       @Transactional
       public MealResponse create(UUID userId, MealRequest req) {
           MealEntity meal = new MealEntity();
           meal.setCreatedBy(userId); // server-side ownership — never from the client
           applyHeader(meal, req);
           rebuildItems(userId, meal, req.getItems());
           return mapper.toResponse(repository.save(meal)); // cascade=ALL persists the items
       }

       @Transactional
       public void update(UUID userId, UUID id, MealRequest req) {
           MealEntity meal = requireOwned(userId, id);
           applyHeader(meal, req);
           rebuildItems(userId, meal, req.getItems()); // dirty-checked; flush on tx commit
       }

       @Transactional
       public void delete(UUID userId, UUID id) {
           MealEntity meal = requireOwned(userId, id);
           // @SQLDelete soft-deletes the meal but does NOT cascade to @OneToMany children on a
           // soft-delete (UPDATE, not DELETE) — so bulk-soft-delete the items explicitly first.
           mealItemRepository.softDeleteByMealId(meal.getId());
           repository.delete(meal); // @SQLDelete -> is_deleted = true
       }

       /**
        * Header fields, with the server-side date write-path: {@code logged_at} defaults to now when
        * the request omits it, and {@code meal_date} is always derived from {@code logged_at}'s date
        * part (cf. CheckInService's server-side date handling). Both stored in UTC.
        */
       private void applyHeader(MealEntity meal, MealRequest req) {
           OffsetDateTime loggedAt = req.getLoggedAt() == null
               ? OffsetDateTime.now(ZoneOffset.UTC) : req.getLoggedAt();
           meal.setLoggedAt(loggedAt.toInstant());
           meal.setMealDate(loggedAt.toLocalDate());
           meal.setSlot(req.getSlot());
           meal.setTitle(req.getTitle());
           // breakdown stays NULL (Phase-3 score envelope).
       }

       /** Full-replace the item collection from the request, in array order. */
       private void rebuildItems(UUID userId, MealEntity meal, List<MealItemRequest> itemReqs) {
           meal.getItems().clear(); // orphanRemoval deletes any previously attached items
           for (int i = 0; i < itemReqs.size(); i++) {
               meal.getItems().add(buildItem(userId, meal, itemReqs.get(i), i));
           }
       }

       /**
        * Branch by {@code source}: recipe-arm snapshots the recipe's per-serving macros (whole rollup
        * ÷ servings, basis "adag", per 1); pantry-arm snapshots the live PantryItem per-basis (exactly
        * like {@code recipe_ingredient}). Missing/foreign/deleted source -> 400 on "items".
        */
       private MealItemEntity buildItem(UUID userId, MealEntity meal, MealItemRequest req, int index) {
           MealItemEntity item = new MealItemEntity();
           item.setCreatedBy(userId); // owned child — server-side, never from the client
           item.setMeal(meal); // bidirectional back-ref REQUIRED (proven in mezo-lns)
           item.setLineOrder(index);
           item.setSource(req.getSource());
           item.setAmount(req.getAmount());
           item.setUnit(req.getUnit());

           if ("recipe".equals(req.getSource())) {
               RecipeEntity recipe = resolveRecipe(userId, req.getRecipeId());
               item.setRecipeId(recipe.getId());
               RecipeMacros whole = recipeMapper.toResponse(recipe).getMacros(); // reuse the recipe rollup
               BigDecimal servings = BigDecimal.valueOf(
                   recipe.getServings() == null || recipe.getServings() < 1 ? 1 : recipe.getServings());
               item.setSnapshotName(recipe.getName());
               item.setSnapshotPer(BigDecimal.ONE);     // 1 adag basis
               item.setSnapshotBasisUnit("adag");
               item.setSnapshotKcal(perServing(whole.getKcal(), servings));
               item.setSnapshotProteinG(perServing(whole.getP(), servings));
               item.setSnapshotCarbsG(perServing(whole.getC(), servings));
               item.setSnapshotFatG(perServing(whole.getF(), servings));
               item.setSnapshotNova(recipe.getNovaDominant());
           } else if ("pantry".equals(req.getSource())) {
               PantryItemEntity p = resolvePantry(userId, req.getPantryItemId());
               item.setPantryItemId(p.getId());
               item.setSnapshotName(p.getName());
               item.setSnapshotPer(orDefault(p.getServingAmount(), BigDecimal.ONE));
               item.setSnapshotBasisUnit(p.getServingUnit() == null ? "unit" : p.getServingUnit());
               item.setSnapshotKcal(orDefault(p.getKcal(), BigDecimal.ZERO));
               item.setSnapshotProteinG(orDefault(p.getProteinG(), BigDecimal.ZERO));
               item.setSnapshotCarbsG(orDefault(p.getCarbsG(), BigDecimal.ZERO));
               item.setSnapshotFatG(orDefault(p.getFatG(), BigDecimal.ZERO));
               item.setSnapshotNova(p.getNova());
           } else {
               throw invalidItems(); // unknown source — the contract pattern should have caught it
           }
           return item;
       }

       /** Owner-scoped, not-deleted recipe lookup; missing/foreign/deleted are indistinguishable 400s. */
       private RecipeEntity resolveRecipe(UUID userId, UUID recipeId) {
           if (recipeId == null) {
               throw invalidItems();
           }
           return recipeRepository.findByIdAndCreatedByAndDeletedFalse(recipeId, userId)
               .orElseThrow(this::invalidItems);
       }

       /** Owner-scoped, not-deleted pantry-item lookup; missing/foreign/deleted are indistinguishable 400s. */
       private PantryItemEntity resolvePantry(UUID userId, UUID pantryItemId) {
           if (pantryItemId == null) {
               throw invalidItems();
           }
           return pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(pantryItemId, userId)
               .orElseThrow(this::invalidItems);
       }

       /** Ownership gate: missing and foreign rows are indistinguishable (404). */
       private MealEntity requireOwned(UUID userId, UUID id) {
           return repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
               .orElseThrow(() -> new SystemRuntimeErrorException(
                   SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
       }

       private SystemRuntimeErrorException invalidItems() {
           return new SystemRuntimeErrorException(
               SystemMessage.field("VALIDATION_INVALID_VALUE", "items").build(), HttpStatus.BAD_REQUEST);
       }

       /** per-serving snapshot = whole-recipe macro ÷ servings, whole-number HALF_UP. */
       private static BigDecimal perServing(BigDecimal whole, BigDecimal servings) {
           BigDecimal v = whole == null ? BigDecimal.ZERO : whole;
           return v.divide(servings, 0, RoundingMode.HALF_UP);
       }

       private static BigDecimal orDefault(BigDecimal value, BigDecimal fallback) {
           return value == null ? fallback : value;
       }
   }
   ```
   > svc3/svc4/svc5 only ADD code to this file (recipeLogs body, getDay delegation, no signature change
   > to update/delete). The `RecipeLogResponse`/`Instant` imports above are pre-added so later tasks are
   > pure additions. (If the build flags an unused import before svc5 lands, leave it — svc5 uses it.)

4. Run — expect PASS (6 create tests green):
   ```bash
   cd backend && ./mvnw clean test -Dtest=MealServiceIT
   ```
   Expected: 6 tests, green.

5. Commit:
   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java \
           backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealServiceIT.java
   git commit -m "feat(meal): meal create with recipe/pantry-arm snapshot + rollup (mezo-arb)"
   ```

---

### Task svc3: `MealService.update` (full-replace) + `delete` (soft-delete cascade)

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealServiceIT.java`
- (No prod change — `update`/`delete` already implemented in svc2; this task PROVES them. If svc2's
  bodies were left stubbed, fill them now exactly as written in svc2.)

**Interfaces:**
- Consumes: `MealService.update(UUID,UUID,MealRequest)`, `MealService.delete(UUID,UUID)`,
  `MealItemRepository.softDeleteByMealId(UUID)` (DB section — returns `int` rows updated),
  `MealResponse.getId()`. To assert "no live items remain", call `softDeleteByMealId(mealId)` and
  expect `0` (same trick as `RecipeServiceIT.testDelete`).

**Steps:**

1. Add the update + delete + 404 tests to `MealServiceIT`. Append these methods inside the class:
   ```java
       @Test
       void testUpdate_shouldFullReplaceItems_whenItemsAddedRemovedReordered() {
           PantryItemEntity a = food(owner, "Alpha");   // 110/23/0/1.5 per 100 g
           PantryItemEntity b = food(owner, "Bravo");
           MealResponse created = service.create(owner,
               req("lunch", pantryItem(a.getId(), "100"), pantryItem(b.getId(), "100")));

           // Replace with: b reordered first at 150 g, a removed, recipe added.
           RecipeEntity r = recipe(owner);
           MealRequest v2 = req("dinner", pantryItem(b.getId(), "150"), recipeItem(r.getId(), "1"));
           v2.setTitle("V2");
           service.update(owner, created.getId(), v2);

           MealResponse after = service.getDay(owner, LocalDate.of(2026, 6, 24)).getMeals().stream()
               .filter(m -> m.getId().equals(created.getId())).findFirst().orElseThrow();
           assertThat(after.getSlot()).isEqualTo("dinner");
           assertThat(after.getTitle()).isEqualTo("V2");
           assertThat(after.getItems()).extracting("source").containsExactly("pantry", "recipe");
           assertThat(after.getItems()).extracting("lineOrder").containsExactly(0, 1);
           // Bravo 150 g -> factor 1.5 -> 165 kcal ; recipe 1 adag -> 149 kcal -> rollup 314.
           assertThat(after.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(314));
       }

       @Test
       void testUpdate_shouldReturn404_whenForeignMeal() {
           PantryItemEntity p = food(owner, "Csirkemell");
           MealResponse mine = service.create(owner, req("lunch", pantryItem(p.getId(), "100")));

           assertThatThrownBy(() -> service.update(other, mine.getId(),
               req("lunch", pantryItem(p.getId(), "100"))))
               .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
       }

       @Test
       void testDelete_shouldReturn404_whenForeignMeal() {
           PantryItemEntity p = food(owner, "Csirkemell");
           MealResponse mine = service.create(owner, req("lunch", pantryItem(p.getId(), "100")));

           assertThatThrownBy(() -> service.delete(other, mine.getId()))
               .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
       }

       @Test
       void testDelete_shouldHideMealAndSoftDeleteItems_whenOwned() {
           PantryItemEntity p = food(owner, "Csirkemell");
           MealResponse mine = service.create(owner,
               req("lunch", pantryItem(p.getId(), "100"), pantryItem(p.getId(), "50")));

           service.delete(owner, mine.getId());

           // Meal is hidden by the owner-scoped day finder...
           assertThat(service.getDay(owner, LocalDate.of(2026, 6, 24)).getMeals())
               .noneMatch(m -> m.getId().equals(mine.getId()));
           // ...and its items are soft-deleted too (no live meal_item rows remain).
           assertThat(mealItemRepository.softDeleteByMealId(mine.getId())).isZero();
       }
   ```
   And add the autowire near the other fields:
   ```java
       @Autowired private io.mrkuhne.mezo.feature.meal.repository.MealItemRepository mealItemRepository;
   ```
   > These tests call `service.getDay(...)` — implemented in svc4. Sequence svc4 before running this
   > task's GREEN, OR (if executing strictly in order) run svc3 RED, then svc4, then re-run both. The
   > controller renumbers globally; keep svc4 immediately after svc3.

2. Run — expect FAILURE first (until svc2 bodies + svc4 getDay are present):
   ```bash
   cd backend && ./mvnw clean test -Dtest=MealServiceIT
   ```
   Expected: the 4 new tests fail (compile error on `getDay` if svc4 not yet landed, else assertion).

3. Implement: ensure `update`/`delete` bodies match svc2 exactly (full-replace via
   `rebuildItems` + orphanRemoval; delete = `softDeleteByMealId` THEN `repository.delete`). No new
   production code beyond svc2 if those bodies were already written.

4. Run — expect PASS (after svc4 lands):
   ```bash
   cd backend && ./mvnw clean test -Dtest=MealServiceIT
   ```
   Expected: all MealServiceIT tests green.

5. Commit:
   ```bash
   git add backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealServiceIT.java
   git commit -m "test(meal): cover full-replace update + soft-delete cascade (mezo-arb)"
   ```

---

### Task svc4: `FuelDayService.getDay` — targets (config) + consumed rollup + meals

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (add the
  `getDay` delegation method so the controller's single `MealService` dependency exposes it)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/FuelDayServiceIT.java`

**Interfaces:**
- Consumes: `NutritionTargetsProperties` (svc1); `MealRepository
  .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(UUID, LocalDate)` (DB section);
  `MealMapper.toResponse(MealEntity)` (mapper section) → `MealResponse.getMacros()` →
  `Macros{getKcal,getP,getC,getF}` (BigDecimal); api.dto `FuelDayResponse`, `MacroSet`.
- Produces:
  - `FuelDayResponse FuelDayService.getDay(UUID userId, LocalDate date)`
  - `FuelDayResponse MealService.getDay(UUID userId, LocalDate date)` — thin delegation to
    `FuelDayService` (so the controller depends on `MealService` only, mirroring the recipe slice's
    single-service controller; SHARED-INTERFACE method name).

**Steps:**

1. Write the failing `FuelDayServiceIT`. Full file:
   ```java
   package io.mrkuhne.mezo.feature.meal;

   import static org.assertj.core.api.Assertions.assertThat;

   import io.mrkuhne.mezo.api.dto.FuelDayResponse;
   import io.mrkuhne.mezo.api.dto.MealItemRequest;
   import io.mrkuhne.mezo.api.dto.MealRequest;
   import io.mrkuhne.mezo.feature.meal.service.MealService;
   import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
   import io.mrkuhne.mezo.support.AbstractIntegrationTest;
   import io.mrkuhne.mezo.support.DatabasePopulator;
   import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
   import java.math.BigDecimal;
   import java.time.LocalDate;
   import java.time.OffsetDateTime;
   import java.time.ZoneOffset;
   import java.util.List;
   import java.util.UUID;
   import org.junit.jupiter.api.BeforeEach;
   import org.junit.jupiter.api.Test;
   import org.springframework.beans.factory.annotation.Autowired;
   import org.springframework.transaction.annotation.Transactional;

   @Transactional
   class FuelDayServiceIT extends AbstractIntegrationTest {

       @Autowired private MealService service;
       @Autowired private PantryItemPopulator pantryPopulator;
       @Autowired private DatabasePopulator databasePopulator;

       private UUID owner;

       @BeforeEach
       void setUpOwner() {
           owner = databasePopulator.populateUser("a@test.local");
       }

       private PantryItemEntity food(String name) {
           return pantryPopulator.createFood(owner, name, LocalDate.of(2026, 5, 25));
       }

       private MealRequest mealAt(int hour, String pantryItemId, String grams) {
           MealItemRequest i = new MealItemRequest();
           i.setSource("pantry");
           i.setPantryItemId(UUID.fromString(pantryItemId));
           i.setAmount(new BigDecimal(grams));
           i.setUnit("g");
           MealRequest r = new MealRequest();
           r.setSlot("lunch");
           r.setLoggedAt(OffsetDateTime.of(2026, 6, 24, hour, 0, 0, 0, ZoneOffset.UTC));
           r.setItems(List.of(i));
           return r;
       }

       @Test
       void testGetDay_shouldReturnConfigTargetsAndZeroConsumed_whenNoMeals() {
           FuelDayResponse day = service.getDay(owner, LocalDate.of(2026, 6, 24));

           assertThat(day.getDate()).isEqualTo(LocalDate.of(2026, 6, 24));
           assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(3100));
           assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(220));
           assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(380));
           assertThat(day.getTargets().getF()).isEqualByComparingTo(BigDecimal.valueOf(95));
           assertThat(day.getTargets().getWater()).isEqualByComparingTo(BigDecimal.valueOf(4000));
           assertThat(day.getConsumed().getKcal()).isEqualByComparingTo(BigDecimal.ZERO);
           assertThat(day.getMeals()).isEmpty();
       }

       @Test
       void testGetDay_shouldSumConsumedAcrossMeals_whenMealsLogged() {
           PantryItemEntity p = food("Csirkemell"); // 110/23/0/1.5 per 100 g
           service.create(owner, mealAt(8, p.getId().toString(), "100"));  // 110/23/0/1.5
           service.create(owner, mealAt(13, p.getId().toString(), "200")); // 220/46/0/3

           FuelDayResponse day = service.getDay(owner, LocalDate.of(2026, 6, 24));

           assertThat(day.getMeals()).hasSize(2);
           // ordered by logged_at asc -> 08:00 then 13:00
           assertThat(day.getMeals()).extracting("loggedAt").isSorted();
           assertThat(day.getConsumed().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(330));
           assertThat(day.getConsumed().getP()).isEqualByComparingTo(BigDecimal.valueOf(69));
           assertThat(day.getConsumed().getF()).isEqualByComparingTo(BigDecimal.valueOf(4)); // 1.5->2 + 3 = 5? see note
           // water has no logging yet -> carried from targets default
           assertThat(day.getConsumed().getWater()).isEqualByComparingTo(BigDecimal.valueOf(4000));
       }

       @Test
       void testGetDay_shouldScopeToDayAndOwner_whenOtherDaysExist() {
           PantryItemEntity p = food("Csirkemell");
           service.create(owner, mealAt(13, p.getId().toString(), "100")); // 2026-06-24
           MealRequest otherDay = mealAt(13, p.getId().toString(), "100");
           otherDay.setLoggedAt(OffsetDateTime.of(2026, 6, 25, 13, 0, 0, 0, ZoneOffset.UTC));
           service.create(owner, otherDay);

           FuelDayResponse day = service.getDay(owner, LocalDate.of(2026, 6, 24));

           assertThat(day.getMeals()).hasSize(1);
       }
   }
   ```
   > Contribution rounding is PER LINE (each line rounds HALF_UP before summing — identical to the
   > recipe mapper). A 100 g chicken line = round(1.5×1)=2 F; a 200 g line = round(1.5×2)=3 F; day F =
   > 2+3 = 5. Adjust the `getF()` expectation to `5` when implementing (the inline note above flags it —
   > set it to `BigDecimal.valueOf(5)`).

2. Run — expect FAILURE (no `getDay` on `MealService`):
   ```bash
   cd backend && ./mvnw clean test -Dtest=FuelDayServiceIT
   ```
   Expected: compile error — `getDay` not found.

3. Implement `FuelDayService`. Full file:
   ```java
   package io.mrkuhne.mezo.feature.meal.service;

   import io.mrkuhne.mezo.api.dto.FuelDayResponse;
   import io.mrkuhne.mezo.api.dto.MacroSet;
   import io.mrkuhne.mezo.api.dto.MealResponse;
   import io.mrkuhne.mezo.feature.meal.config.NutritionTargetsProperties;
   import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
   import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
   import java.math.BigDecimal;
   import java.time.LocalDate;
   import java.util.List;
   import java.util.UUID;
   import lombok.RequiredArgsConstructor;
   import org.springframework.stereotype.Service;
   import org.springframework.transaction.annotation.Transactional;

   /**
    * Assembles {@link FuelDayResponse} for the Fuel-day MacroHero: config-driven {@code targets}
    * (from {@link NutritionTargetsProperties}), the day's owner-scoped meals (logged_at-ordered),
    * and {@code consumed} = Σ the day's meal macros. {@code water} consumed is carried from the
    * targets default until water-logging exists (no meal carries water in v1).
    */
   @Service
   @RequiredArgsConstructor
   public class FuelDayService {

       private final MealRepository mealRepository;
       private final MealMapper mapper;
       private final NutritionTargetsProperties targets;

       @Transactional(readOnly = true)
       public FuelDayResponse getDay(UUID userId, LocalDate date) {
           List<MealResponse> meals = mealRepository
               .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date).stream()
               .map(mapper::toResponse)
               .toList();
           return FuelDayResponse.builder()
               .date(date)
               .targets(targetSet())
               .consumed(consumed(meals))
               .meals(meals)
               .build();
       }

       private MacroSet targetSet() {
           return MacroSet.builder()
               .kcal(BigDecimal.valueOf(targets.kcal()))
               .p(BigDecimal.valueOf(targets.p()))
               .c(BigDecimal.valueOf(targets.c()))
               .f(BigDecimal.valueOf(targets.f()))
               .water(BigDecimal.valueOf(targets.water()))
               .build();
       }

       /** consumed = Σ meal macros; water carried from the targets default (no water-logging in v1). */
       private MacroSet consumed(List<MealResponse> meals) {
           BigDecimal kcal = BigDecimal.ZERO, p = BigDecimal.ZERO, c = BigDecimal.ZERO, f = BigDecimal.ZERO;
           for (MealResponse m : meals) {
               kcal = kcal.add(m.getMacros().getKcal());
               p = p.add(m.getMacros().getP());
               c = c.add(m.getMacros().getC());
               f = f.add(m.getMacros().getF());
           }
           return MacroSet.builder()
               .kcal(kcal).p(p).c(c).f(f)
               .water(BigDecimal.valueOf(targets.water())) // placeholder until water-logging lands
               .build();
       }
   }
   ```

4. Add the `getDay` delegation to `MealService` (so the controller depends on `MealService` only).
   In `MealService.java`, add the `FuelDayService` dependency to the constructor field block:
   ```java
       private final FuelDayService fuelDayService;
   ```
   (place it after `private final MealMapper mapper;`) and add the method (place after `delete`):
   ```java
       @Transactional(readOnly = true)
       public FuelDayResponse getDay(UUID userId, LocalDate date) {
           return fuelDayService.getDay(userId, date);
       }
   ```
   Add the import `import io.mrkuhne.mezo.api.dto.FuelDayResponse;` to `MealService.java` (already
   listed in svc2's import block — confirm present).

5. Run — expect PASS (3 FuelDayService tests green; remember the `getF()` expectation = 5):
   ```bash
   cd backend && ./mvnw clean test -Dtest=FuelDayServiceIT,MealServiceIT
   ```
   Expected: FuelDayServiceIT + MealServiceIT all green (svc3's `getDay`-dependent tests now pass too).

6. Commit:
   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java \
           backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java \
           backend/src/test/java/io/mrkuhne/mezo/feature/meal/FuelDayServiceIT.java
   git commit -m "feat(meal): fuel-day aggregation with config targets + consumed rollup (mezo-arb)"
   ```

---

### Task svc5: recipe-logs query — `MealItemRepository` finder + `MealService.recipeLogs`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/MealItemRepository.java`
  (DB section owns the file; this task ADDS one finder method to it — coordinate, do not recreate)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/RecipeLogsServiceIT.java`

**Interfaces:**
- Consumes: `MealItemEntity` (`getMeal()` → `MealEntity{getId,getSlot,getLoggedAt}`,
  `getSnapshotKcal/ProteinG/CarbsG/FatG`, `getSnapshotPer`, `getAmount`, `getRecipeId`); the
  per-line contribution formula (`factor = amount / snapshotPer`); api.dto `RecipeLogResponse`,
  `RecipeLogListResponse`.
- Produces:
  - `List<MealItemEntity> MealItemRepository.findByRecipeIdAndCreatedByAndDeletedFalse(UUID recipeId, UUID createdBy)`
    (derived finder — `recipe_id` is a plain UUID column, so a derived query works; ordered by the
    parent meal's logged_at desc via `OrderByMeal_LoggedAtDesc`).
  - `List<RecipeLogResponse> MealService.recipeLogs(UUID userId, UUID recipeId)` — the SHARED-INTERFACE
    method the recipe-logs controller method delegates to. Each row: `mealId = item.meal.id`,
    `slot = item.meal.slot`, `loggedAt = item.meal.loggedAt`, and `{kcal,p,c,f}` = the item's
    contribution (snapshot × amount/snapshotPer, whole-number HALF_UP — same formula as the mapper).

**Steps:**

1. Write the failing `RecipeLogsServiceIT`. Full file:
   ```java
   package io.mrkuhne.mezo.feature.meal;

   import static org.assertj.core.api.Assertions.assertThat;

   import io.mrkuhne.mezo.api.dto.MealItemRequest;
   import io.mrkuhne.mezo.api.dto.MealRequest;
   import io.mrkuhne.mezo.api.dto.RecipeLogResponse;
   import io.mrkuhne.mezo.feature.meal.service.MealService;
   import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
   import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
   import io.mrkuhne.mezo.support.AbstractIntegrationTest;
   import io.mrkuhne.mezo.support.DatabasePopulator;
   import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
   import io.mrkuhne.mezo.support.populator.RecipePopulator;
   import java.math.BigDecimal;
   import java.time.LocalDate;
   import java.time.OffsetDateTime;
   import java.time.ZoneOffset;
   import java.util.List;
   import java.util.UUID;
   import org.junit.jupiter.api.BeforeEach;
   import org.junit.jupiter.api.Test;
   import org.springframework.beans.factory.annotation.Autowired;
   import org.springframework.transaction.annotation.Transactional;

   @Transactional
   class RecipeLogsServiceIT extends AbstractIntegrationTest {

       @Autowired private MealService service;
       @Autowired private PantryItemPopulator pantryPopulator;
       @Autowired private RecipePopulator recipePopulator;
       @Autowired private DatabasePopulator databasePopulator;

       private UUID owner;
       private UUID other;

       @BeforeEach
       void setUpOwners() {
           owner = databasePopulator.populateUser("a@test.local");
           other = databasePopulator.populateUser("b@test.local");
       }

       private RecipeEntity recipe(UUID who) {
           PantryItemEntity src = pantryPopulator.createFood(who, "Túró forrás", LocalDate.of(2026, 5, 25));
           return recipePopulator.createRecipe(who, src.getId()); // per serving 149/18/6/6
       }

       private void logRecipe(UUID recipeId, int day) {
           MealItemRequest i = new MealItemRequest();
           i.setSource("recipe");
           i.setRecipeId(recipeId);
           i.setAmount(BigDecimal.ONE);
           i.setUnit("adag");
           MealRequest r = new MealRequest();
           r.setSlot("lunch");
           r.setLoggedAt(OffsetDateTime.of(2026, 6, day, 13, 0, 0, 0, ZoneOffset.UTC));
           r.setItems(List.of(i));
           service.create(owner, r);
       }

       @Test
       void testRecipeLogs_shouldReturnNewestFirstWithContribution_whenLogged() {
           RecipeEntity r = recipe(owner);
           logRecipe(r.getId(), 20);
           logRecipe(r.getId(), 24); // newer

           List<RecipeLogResponse> logs = service.recipeLogs(owner, r.getId());

           assertThat(logs).hasSize(2);
           assertThat(logs).extracting("loggedAt").isSortedAccordingTo(java.util.Comparator.reverseOrder());
           assertThat(logs.get(0).getSlot()).isEqualTo("lunch");
           assertThat(logs.get(0).getKcal()).isEqualByComparingTo(BigDecimal.valueOf(149));
           assertThat(logs.get(0).getP()).isEqualByComparingTo(BigDecimal.valueOf(18));
           assertThat(logs.get(0).getMealId()).isNotNull();
       }

       @Test
       void testRecipeLogs_shouldBeEmpty_whenNeverLoggedOrForeign() {
           RecipeEntity r = recipe(owner);
           logRecipe(r.getId(), 24);

           assertThat(service.recipeLogs(owner, UUID.randomUUID())).isEmpty(); // never logged
           assertThat(service.recipeLogs(other, r.getId())).isEmpty();        // foreign owner
       }
   }
   ```

2. Run — expect FAILURE (no `recipeLogs` on `MealService`):
   ```bash
   cd backend && ./mvnw clean test -Dtest=RecipeLogsServiceIT
   ```
   Expected: compile error — `recipeLogs` / repository finder not found.

3. Add the derived finder to `MealItemRepository` (DB-owned file — add this method only):
   ```java
       /**
        * Recipe-logs cross-feature read: a recipe's logged meal-items, newest meal first. {@code recipe_id}
        * is a plain UUID column (not a JPA association), so a derived finder works; the order traverses the
        * parent meal's logged_at (underscore disambiguates the nested path).
        */
       List<MealItemEntity> findByRecipeIdAndCreatedByAndDeletedFalseOrderByMeal_LoggedAtDesc(
           UUID recipeId, UUID createdBy);
   ```
   (ensure `import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;`, `import java.util.List;`,
   `import java.util.UUID;` are present.)

4. Add `recipeLogs` to `MealService`. Add the import:
   ```java
   import io.mrkuhne.mezo.api.dto.RecipeLogResponse;
   ```
   (already in svc2's block) and the method (place after `getDay`):
   ```java
       /**
        * Cross-feature read for {@code GET /api/recipe/{id}/logs}: the recipe's logged meal-items,
        * newest meal first, each projected to its per-line contribution (snapshot × amount/snapshotPer,
        * whole-number HALF_UP — the same formula as the meal/recipe mapper).
        */
       @Transactional(readOnly = true)
       public List<RecipeLogResponse> recipeLogs(UUID userId, UUID recipeId) {
           return mealItemRepository
               .findByRecipeIdAndCreatedByAndDeletedFalseOrderByMeal_LoggedAtDesc(recipeId, userId).stream()
               .map(item -> {
                   BigDecimal per = item.getSnapshotPer() == null || item.getSnapshotPer().signum() == 0
                       ? BigDecimal.ONE : item.getSnapshotPer();
                   BigDecimal factor = item.getAmount().divide(per, 6, RoundingMode.HALF_UP);
                   return RecipeLogResponse.builder()
                       .mealId(item.getMeal().getId())
                       .slot(item.getMeal().getSlot())
                       .loggedAt(item.getMeal().getLoggedAt().atOffset(ZoneOffset.UTC))
                       .kcal(scaled(item.getSnapshotKcal(), factor))
                       .p(scaled(item.getSnapshotProteinG(), factor))
                       .c(scaled(item.getSnapshotCarbsG(), factor))
                       .f(scaled(item.getSnapshotFatG(), factor))
                       .build();
               })
               .toList();
       }

       /** Per-line contribution scalar: snapshot × factor, whole-number HALF_UP (cf. RecipeMapper). */
       private static BigDecimal scaled(BigDecimal base, BigDecimal factor) {
           BigDecimal v = base == null ? BigDecimal.ZERO : base;
           return v.multiply(factor).setScale(0, RoundingMode.HALF_UP);
       }
   ```
   > `RecipeLogResponse.loggedAt` is the contract `date-time` (an `OffsetDateTime` getter on the
   > generated DTO). `MealEntity.getLoggedAt()` is a stored `Instant` (UTC); `.atOffset(ZoneOffset.UTC)`
   > converts it. If the DB section typed `meal.logged_at` as `OffsetDateTime`, drop the `.atOffset(...)`.

5. Run — expect PASS (2 recipe-logs tests green):
   ```bash
   cd backend && ./mvnw clean test -Dtest=RecipeLogsServiceIT
   ```
   Expected: 2 tests, green.

6. Commit:
   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/MealItemRepository.java \
           backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java \
           backend/src/test/java/io/mrkuhne/mezo/feature/meal/RecipeLogsServiceIT.java
   git commit -m "feat(meal): recipe-logs query helper for RecipeLogsList (mezo-arb)"
   ```

---

### Task svc6: full meal-service suite green

**Files:**
- (verification only — no new files)

**Steps:**

1. Run the whole meal-feature test set + a clean build to confirm svc1–svc5 integrate with the DB,
   mapper, and contract sections:
   ```bash
   cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.meal.*'
   ```
   Expected: `NutritionTargetsPropertiesIT`, `MealServiceIT`, `FuelDayServiceIT`,
   `RecipeLogsServiceIT` all green (`MealRepositoryIT`/`MealApiIT` are owned by DB/controller sections).

2. If anything is red, fix the SERVICE-owned file only (never edit DB/mapper/controller-owned files);
   re-run until green. Then run the full backend suite once:
   ```bash
   cd backend && ./mvnw clean test
   ```
   Expected: BUILD SUCCESS.

3. Commit only if step 2 forced a service-file fix:
   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java
   git commit -m "fix(meal): align meal-service suite (mezo-arb)"
   ```

---

## Phase 5 — Controller + API IT

# Part — Meal Controller + API-level Integration Tests (`ctrl`)

**Driving bd:** `mezo-arb` · base pkg `io.mrkuhne.mezo` · Spring Boot 4 / Java 21 / Maven / Postgres 16.

This section OWNS:
- `MealController` (implements the generated `MealApi`) — thin delegate to `MealService` / `FuelDayService` short names.
- The recipe-logs controller method on `RecipeController` (delegating to the service recipe-logs short name).
- The **API-level** ITs: `MealApiIT` (full HTTP surface) + the `/api/recipe/{id}/logs` case added to the existing `RecipeApiIT`.

It CONSUMES (never re-creates) the artifacts owned by sibling sections:
- DB section: `MealEntity`, `MealItemEntity`, `MealRepository`, `MealItemRepository`, `MealPopulator`, `ResetDatabase` TRUNCATE, `AbstractIntegrationTest` `@Import`.
- Mapper section: `MealMapper` (+ `MealBreakdownJson`).
- Service section: `MealService` (`create` / `getDay` / `update` / `delete`), `FuelDayService`, the recipe-logs query helper, `NutritionTargetsProperties`.
- Contract section: the generated `MealApi` + `io.mrkuhne.mezo.api.dto.*` from `api/feature/meal/meal.yml`, and the `GET /api/recipe/{id}/logs` op + `RecipeLogResponse` / `RecipeLogListResponse` schemas added to `api/feature/recipe/recipe.yml`. **The contract section MUST land first** (the controllers implement generated interfaces) — this part depends on those generated types existing.

> **Read before coding:** `docs/references/api_contract_conventions.md` (controllers implement `<Tag>Api`, no mapping/`@Valid` on the impl, inject `CurrentUserId`), `docs/references/integration_test_framework.md` (extend `ApiIntegrationTest`, verb helpers, `ownerAuthHeaders()`, `assertHasFieldError`), `docs/references/error_handling.md` (FIELD `VALIDATION_INVALID_VALUE`, REQUEST/error `RESOURCE_NOT_FOUND`), `docs/references/testing_standards.md`. Template (shipped recipe slice): `feature/recipe/controller/RecipeController.java`, test `feature/recipe/RecipeApiIT.java`, support `ApiIntegrationTest`.

---

## Interfaces consumed from sibling sections (use VERBATIM)

**Generated contract types** (`io.mrkuhne.mezo.api.controller.MealApi`, `io.mrkuhne.mezo.api.dto.*`):
- `MealApi`:
  - `FuelDayResponse getFuelDay(LocalDate date)`
  - `MealResponse createMeal(MealRequest mealRequest)`
  - `void updateMeal(UUID id, MealRequest mealRequest)`
  - `void deleteMeal(UUID id)`
- `RecipeApi` (extended): `RecipeLogListResponse getRecipeLogs(UUID id)`
- DTOs: `MealRequest`, `MealItemRequest`, `MealResponse`, `MealItemResponse`, `FuelDayResponse`, `Macros` (`{kcal,p,c,f}`), `MacroSet` (`{kcal,p,c,f,water}`), `MealScore`, `RecipeLogResponse` (`{mealId,slot,loggedAt,kcal,p,c,f}`), `RecipeLogListResponse` (`{recentLogs: RecipeLogResponse[]}`).

> The generated `operationId`s are the controller method names. Verify after the merge step that the generated `MealApi` exposes exactly `getFuelDay/createMeal/updateMeal/deleteMeal` and `RecipeApi` gains `getRecipeLogs`. If a generated name differs, the contract fragment is wrong — fix the fragment, not the controller.

**Service short methods** (`io.mrkuhne.mezo.feature.meal.service.MealService`):
- `MealResponse create(UUID userId, MealRequest req)`
- `FuelDayResponse getDay(UUID userId, LocalDate date)`
- `void update(UUID userId, UUID id, MealRequest req)`
- `void delete(UUID userId, UUID id)`

**Fuel-day service** (`io.mrkuhne.mezo.feature.meal.service.FuelDayService`):
- `FuelDayResponse getDay(UUID userId, LocalDate date)` — assembles targets + consumed + meals.

> `MealService.getDay` and `FuelDayService.getDay` are intentionally the same name on two beans; the service section decides which the controller calls. **The controller delegates `getFuelDay` → `FuelDayService.getDay(...)`** (the day-aggregation bean). All meal CRUD goes through `MealService`.

**Recipe-logs query helper** (service section, exact name): `RecipeService.recipeLogs(UUID userId, UUID recipeId)` returning `RecipeLogListResponse`.

**Security principal**: `io.mrkuhne.mezo.techcore.security.CurrentUserId` — `currentUserId.get()` returns the owner `UUID`.

---

## Interfaces produced by this section (siblings/FE may depend on)

- `io.mrkuhne.mezo.feature.meal.controller.MealController` — `@RestController` implementing `MealApi`; wires `FuelDayService` (getFuelDay) + `MealService` (create/update/delete) + `CurrentUserId`. No public API beyond the `@Override`s.
- `RecipeController.getRecipeLogs(UUID id)` — `@Override` added to the existing controller, delegating to `RecipeService.recipeLogs(currentUserId.get(), id)`.
- Tests: `io.mrkuhne.mezo.feature.meal.MealApiIT`, plus a `testRecipeLogs_*` case in `io.mrkuhne.mezo.feature.recipe.RecipeApiIT`.

---

### Task ctrl1: `MealController` implementing the generated `MealApi`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/controller/MealController.java`

**Interfaces:**
- Consumes: `MealApi` (`getFuelDay(LocalDate)`, `createMeal(MealRequest)`, `updateMeal(UUID, MealRequest)`, `deleteMeal(UUID)`); `MealService.create/update/delete`; `FuelDayService.getDay(UUID, LocalDate)`; `CurrentUserId.get()`.
- Produces: `MealController` bean (no extra public surface).

**Steps:**

1. Confirm the generated `MealApi` exists and exposes the four operations. Run (expects success once the contract section has merged + a build ran):
   ```bash
   cd backend && ./mvnw -q generate-sources && \
     find target/generated-sources/openapi -name 'MealApi.java' -exec grep -nE 'getFuelDay|createMeal|updateMeal|deleteMeal' {} +
   ```
   Expected: the four method signatures print. If `MealApi.java` is absent, STOP — the contract/merge step has not run yet (blocked on the contract section).

2. Create the controller file with the full implementation:
   ```java
   package io.mrkuhne.mezo.feature.meal.controller;

   import io.mrkuhne.mezo.api.controller.MealApi;
   import io.mrkuhne.mezo.api.dto.FuelDayResponse;
   import io.mrkuhne.mezo.api.dto.MealRequest;
   import io.mrkuhne.mezo.api.dto.MealResponse;
   import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
   import io.mrkuhne.mezo.feature.meal.service.MealService;
   import io.mrkuhne.mezo.techcore.security.CurrentUserId;
   import java.time.LocalDate;
   import java.util.UUID;
   import lombok.RequiredArgsConstructor;
   import org.springframework.web.bind.annotation.RestController;

   /**
    * Implements the generated {@link MealApi}; HTTP mappings, status codes and {@code @Valid}
    * come from the interface. Day reads go through {@link FuelDayService} (targets + consumed +
    * meals aggregation); meal CRUD goes through {@link MealService}.
    */
   @RestController
   @RequiredArgsConstructor
   public class MealController implements MealApi {

       private final FuelDayService fuelDayService;
       private final MealService mealService;
       private final CurrentUserId currentUserId;

       @Override
       public FuelDayResponse getFuelDay(LocalDate date) {
           return fuelDayService.getDay(currentUserId.get(), date);
       }

       @Override
       public MealResponse createMeal(MealRequest mealRequest) {
           return mealService.create(currentUserId.get(), mealRequest);
       }

       @Override
       public void updateMeal(UUID id, MealRequest mealRequest) {
           mealService.update(currentUserId.get(), id, mealRequest);
       }

       @Override
       public void deleteMeal(UUID id) {
           mealService.delete(currentUserId.get(), id);
       }
   }
   ```

3. Compile the controller against the generated interface + the (sibling-owned) services. Run:
   ```bash
   cd backend && ./mvnw -q clean test-compile
   ```
   Expected: BUILD SUCCESS — the `@Override`s match `MealApi`, and `MealService`/`FuelDayService` short names resolve. If `FuelDayService.getDay`/`MealService.*` are missing, the service section has not landed — coordinate, do not stub here.

4. Commit. Run:
   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/controller/MealController.java
   git commit -m "feat(meal): MealController delegating to fuel-day + meal services (mezo-arb)"
   ```

---

### Task ctrl2: `RecipeController.getRecipeLogs` — the cross-feature recipe-logs endpoint

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/controller/RecipeController.java`

**Interfaces:**
- Consumes: `RecipeApi.getRecipeLogs(UUID)` (generated after the recipe contract gains the op); `RecipeService.recipeLogs(UUID userId, UUID recipeId)` → `RecipeLogListResponse`; `CurrentUserId.get()`.
- Produces: `RecipeController.getRecipeLogs(UUID id)` `@Override`.

**Steps:**

1. Confirm the generated `RecipeApi` now carries the new op. Run:
   ```bash
   cd backend && ./mvnw -q generate-sources && \
     grep -n 'getRecipeLogs' target/generated-sources/openapi/**/RecipeApi.java
   ```
   Expected: `RecipeLogListResponse getRecipeLogs(UUID id);` prints. If absent, the recipe-contract addition has not merged — STOP (blocked on the contract section).

2. Add the import for the generated response type. In `RecipeController.java`, after the existing `import io.mrkuhne.mezo.api.dto.RecipeResponse;` line, add:
   ```java
   import io.mrkuhne.mezo.api.dto.RecipeLogListResponse;
   ```

3. Add the `@Override` method. In `RecipeController.java`, immediately after the `deleteRecipe(UUID id)` method (before the closing class brace), insert:
   ```java
       @Override
       public RecipeLogListResponse getRecipeLogs(UUID id) {
           return service.recipeLogs(currentUserId.get(), id);
       }
   ```

4. Compile. Run:
   ```bash
   cd backend && ./mvnw -q clean test-compile
   ```
   Expected: BUILD SUCCESS. If `service.recipeLogs(...)` does not resolve, the service section has not added the helper — coordinate.

5. Commit. Run:
   ```bash
   git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/controller/RecipeController.java
   git commit -m "feat(recipe): GET /api/recipe/{id}/logs delegating to recipeLogs (mezo-arb)"
   ```

---

### Task ctrl3: `MealApiIT` — create+getDay (recipe-arm AND pantry-arm, rollup, targets/consumed)

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java`

**Interfaces:**
- Consumes: `ApiIntegrationTest` (`ownerAuthHeaders`, `postForBody`, `getForBody`, `putForBody`, `deleteAndExpect`, `exchangeForBody`, `assertHasFieldError`); DTOs `PantryItemRequest`/`PantryItemResponse`, `RecipeRequest`/`RecipeResponse`/`RecipeIngredientRequest`, `MealRequest`/`MealItemRequest`/`MealResponse`/`MealItemResponse`/`FuelDayResponse`.
- Produces: `MealApiIT` with shared helpers `createFood`, `createRecipe`, `recipeItem`, `pantryItem`, `mealReq` reused by ctrl4/ctrl5.

> The IT owns its source rows by calling the real `POST /api/pantry` + `POST /api/recipe` so the meal-item arms resolve owner-scoped (mirrors how `RecipeApiIT` owns its pantry rows via `createFood`). It is NOT `@Transactional`; `ResetDatabase` (DB section) cleans between tests.

**Steps:**

1. Write the failing test file with the create+getDay happy-path covering both arms. Full code:
   ```java
   package io.mrkuhne.mezo.feature.meal;

   import static org.assertj.core.api.Assertions.assertThat;

   import io.mrkuhne.mezo.api.dto.FuelDayResponse;
   import io.mrkuhne.mezo.api.dto.MealItemRequest;
   import io.mrkuhne.mezo.api.dto.MealItemResponse;
   import io.mrkuhne.mezo.api.dto.MealRequest;
   import io.mrkuhne.mezo.api.dto.MealResponse;
   import io.mrkuhne.mezo.api.dto.PantryItemRequest;
   import io.mrkuhne.mezo.api.dto.PantryItemResponse;
   import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
   import io.mrkuhne.mezo.api.dto.RecipeRequest;
   import io.mrkuhne.mezo.api.dto.RecipeResponse;
   import io.mrkuhne.mezo.support.ApiIntegrationTest;
   import java.math.BigDecimal;
   import java.time.LocalDate;
   import java.time.OffsetDateTime;
   import java.time.ZoneOffset;
   import java.util.List;
   import java.util.UUID;
   import org.junit.jupiter.api.Test;
   import org.springframework.http.HttpHeaders;
   import org.springframework.http.HttpMethod;
   import org.springframework.http.HttpStatus;

   class MealApiIT extends ApiIntegrationTest {

       /** Fixed instant so meal_date is deterministic across the test run. */
       private static final OffsetDateTime LOGGED_AT =
           OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC);
       private static final LocalDate MEAL_DATE = LocalDate.of(2026, 6, 24);

       /** Creates a per-100g food via POST /api/pantry (owned by the authed owner) and returns its id. */
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
           return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
       }

       /** Creates a 2-serving recipe via POST /api/recipe from one 200 g pantry line and returns it. */
       private RecipeResponse createRecipe(HttpHeaders auth, UUID foodId) {
           RecipeIngredientRequest line = new RecipeIngredientRequest();
           line.setPantryItemId(foodId);
           line.setAmount(new BigDecimal("200"));
           line.setUnit("g");
           RecipeRequest r = new RecipeRequest();
           r.setName("Túrós tál");
           r.setCategory("breakfast");
           r.setServings(2);
           r.setStarred(false);
           r.setTags(List.of("magas-fehérje"));
           r.setIngredients(List.of(line));
           return postForBody("/api/recipe", r, auth, HttpStatus.CREATED, RecipeResponse.class);
       }

       /** A recipe-arm meal item: source=recipe, recipeId set, amount = servings. */
       private MealItemRequest recipeItem(UUID recipeId, String servings) {
           MealItemRequest i = new MealItemRequest();
           i.setSource("recipe");
           i.setRecipeId(recipeId);
           i.setAmount(new BigDecimal(servings));
           i.setUnit("adag");
           return i;
       }

       /** A pantry-arm meal item: source=pantry, pantryItemId set, amount = quantity. */
       private MealItemRequest pantryItem(UUID pantryItemId, String amount) {
           MealItemRequest i = new MealItemRequest();
           i.setSource("pantry");
           i.setPantryItemId(pantryItemId);
           i.setAmount(new BigDecimal(amount));
           i.setUnit("g");
           return i;
       }

       /** A breakfast meal request at the fixed instant carrying the given items. */
       private MealRequest mealReq(MealItemRequest... items) {
           MealRequest r = new MealRequest();
           r.setSlot("breakfast");
           r.setLoggedAt(LOGGED_AT);
           r.setTitle("Reggeli");
           r.setItems(List.of(items));
           return r;
       }

       @Test
       void testCreateThenGetDay_shouldRollUpMacrosAndConsumed_whenRecipeAndPantryArms() {
           HttpHeaders auth = ownerAuthHeaders();
           // per-100g food: 110 kcal / 23 p / 0 c / 1.5 f
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           // 2-serving recipe of 200 g of that food: whole rollup kcal 220 p 46 c 0 f 3 -> per-serving 110/23/0/1.5
           RecipeResponse recipe = createRecipe(auth, food);

           // Meal: 1 serving of the recipe (recipe-arm) + 200 g of the food (pantry-arm).
           // recipe-arm contribution: per-serving (110/23/0/1.5) x factor 1 -> 110/23/0/2 (1.5 rounds HALF_UP -> 2)
           // pantry-arm contribution: per-100g x factor 2 -> kcal 220 p 46 c 0 f 3
           MealResponse created = postForBody(
               "/api/meal",
               mealReq(recipeItem(recipe.getId(), "1"), pantryItem(food, "200")),
               auth, HttpStatus.CREATED, MealResponse.class);

           assertThat(created.getId()).isNotNull();
           assertThat(created.getSlot()).isEqualTo("breakfast");
           assertThat(created.getMealDate()).isEqualTo(MEAL_DATE);
           assertThat(created.getItems()).hasSize(2);

           // line order preserved from request index
           MealItemResponse arm0 = created.getItems().get(0);
           MealItemResponse arm1 = created.getItems().get(1);
           assertThat(arm0.getSource()).isEqualTo("recipe");
           assertThat(arm0.getLineOrder()).isEqualTo(0);
           assertThat(arm0.getName()).isEqualTo("Túrós tál");
           assertThat(arm0.getContribution().getKcal()).isEqualByComparingTo("110");
           assertThat(arm0.getContribution().getP()).isEqualByComparingTo("23");
           assertThat(arm0.getContribution().getF()).isEqualByComparingTo("2");
           assertThat(arm1.getSource()).isEqualTo("pantry");
           assertThat(arm1.getLineOrder()).isEqualTo(1);
           assertThat(arm1.getName()).isEqualTo("Csirkemell");
           assertThat(arm1.getContribution().getKcal()).isEqualByComparingTo("220");
           assertThat(arm1.getContribution().getP()).isEqualByComparingTo("46");

           // meal rollup = sum of item contributions
           assertThat(created.getMacros().getKcal()).isEqualByComparingTo("330");
           assertThat(created.getMacros().getP()).isEqualByComparingTo("69");
           assertThat(created.getMacros().getF()).isEqualByComparingTo("5");
           // meal score pending (NULL breakdown -> sparkle on the FE)
           assertThat(created.getScore().getValue()).isNull();

           // GET /api/fuel/day/{date}: targets from config, consumed = sum of the day's meals
           FuelDayResponse day = getForBody(
               "/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK, FuelDayResponse.class);
           assertThat(day.getDate()).isEqualTo(MEAL_DATE);
           assertThat(day.getTargets().getKcal()).isEqualByComparingTo("3100");
           assertThat(day.getTargets().getP()).isEqualByComparingTo("220");
           assertThat(day.getTargets().getWater()).isEqualByComparingTo("4000");
           assertThat(day.getConsumed().getKcal()).isEqualByComparingTo("330");
           assertThat(day.getConsumed().getP()).isEqualByComparingTo("69");
           assertThat(day.getMeals()).extracting(MealResponse::getId).contains(created.getId());
       }

       @Test
       void testGetDay_shouldReturnEmptyMealsAndConfigTargets_whenNoMealsLogged() {
           HttpHeaders auth = ownerAuthHeaders();

           FuelDayResponse day = getForBody(
               "/api/fuel/day/2026-01-01", auth, HttpStatus.OK, FuelDayResponse.class);

           assertThat(day.getMeals()).isEmpty();
           assertThat(day.getTargets().getKcal()).isEqualByComparingTo("3100");
           assertThat(day.getConsumed().getKcal()).isEqualByComparingTo("0");
       }

       // ---- guard placeholders implemented in ctrl4 (kept compiling together) ----
   }
   ```

2. Run the new test — expect FAILURE (controller/contract/service not wired, or rollup mismatch). Run:
   ```bash
   cd backend && ./mvnw -q clean test -Dtest=MealApiIT#testCreateThenGetDay_shouldRollUpMacrosAndConsumed_whenRecipeAndPantryArms
   ```
   Expected: FAILS — either a compile error against not-yet-existing generated DTOs / service, or an assertion mismatch. (If the contract+service+db+mapper sections are all merged, this should PASS directly; if it fails on rollup, fix the SERVICE/MAPPER section — this part does not own the math.)

3. No implementation owned here for this task — the production code is the controller (ctrl1) + sibling sections. This task's "implementation" is the test itself plus confirming the wiring is correct. Once the dependency sections are merged, re-run step 2 and it must pass. (No new production file in this step.)

4. Run the test — expect PASS (after ctrl1 + all sibling sections merged). Run:
   ```bash
   cd backend && ./mvnw -q clean test -Dtest=MealApiIT#testCreateThenGetDay_shouldRollUpMacrosAndConsumed_whenRecipeAndPantryArms+testGetDay_shouldReturnEmptyMealsAndConfigTargets_whenNoMealsLogged
   ```
   Expected: BUILD SUCCESS, 2 tests pass.

5. Commit. Run:
   ```bash
   git add backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java
   git commit -m "test(meal): MealApiIT create+getDay rollup over recipe+pantry arms (mezo-arb)"
   ```

---

### Task ctrl4: `MealApiIT` — validation 400s (empty items, bad slot, source-arm mismatch, missing source) + 404 on unknown PUT/DELETE

**Files:**
- Test (modify): `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java`

**Interfaces:**
- Consumes: the ctrl3 helpers (`mealReq`, `recipeItem`, `pantryItem`, `createFood`, `createRecipe`); `exchangeForBody`, `assertHasFieldError`, `deleteAndExpect`.
- Produces: the negative-path cases (no new production surface).

> `slot`/`source` use `pattern` (not enum) in the contract, so an invalid value fails bean validation → **400 FIELD `VALIDATION_INVALID_VALUE`** (per `api_contract_conventions.md`). The source-arm mismatch (e.g. `source=recipe` but `recipeId` null / `pantryItemId` set) and a missing source row are **server-side** branch validations → 400 FIELD on `items` (mirrors `RecipeService.invalidIngredients()` on `ingredients`). Unknown `id` on PUT/DELETE → 404 `RESOURCE_NOT_FOUND` (mirrors `requireOwned`).

**Steps:**

1. Add the negative-path tests. Insert before the final closing brace of `MealApiIT` (replace the `// ---- guard placeholders ...` comment line):
   ```java
       @Test
       void testCreate_shouldReturn400FieldError_whenItemsEmpty() {
           HttpHeaders auth = ownerAuthHeaders();
           MealRequest bad = mealReq(); // zero items -> violates minItems:1
           bad.setItems(List.of());

           String body = exchangeForBody(
               HttpMethod.POST, "/api/meal", bad, auth, HttpStatus.BAD_REQUEST, String.class);

           assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
       }

       @Test
       void testCreate_shouldReturn400FieldError_whenSlotInvalid() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           MealRequest bad = mealReq(pantryItem(food, "100"));
           bad.setSlot("brunch"); // fails pattern ^(breakfast|lunch|dinner|snack)$

           String body = exchangeForBody(
               HttpMethod.POST, "/api/meal", bad, auth, HttpStatus.BAD_REQUEST, String.class);

           assertHasFieldError(body, "slot", "VALIDATION_INVALID_VALUE");
       }

       @Test
       void testCreate_shouldReturn400FieldError_whenSourceArmMismatch() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           // source=recipe but the recipe arm is empty and a pantry id is supplied -> exactly-one-of violated
           MealItemRequest mismatched = new MealItemRequest();
           mismatched.setSource("recipe");
           mismatched.setPantryItemId(food); // wrong arm for source=recipe
           mismatched.setAmount(new BigDecimal("1"));
           mismatched.setUnit("adag");

           String body = exchangeForBody(
               HttpMethod.POST, "/api/meal", mealReq(mismatched), auth, HttpStatus.BAD_REQUEST, String.class);

           assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
       }

       @Test
       void testCreate_shouldReturn400FieldError_whenSourceRowMissing() {
           HttpHeaders auth = ownerAuthHeaders();
           // references a non-existent recipe id -> resolve fails owner-scoped
           MealRequest bad = mealReq(recipeItem(UUID.randomUUID(), "1"));

           String body = exchangeForBody(
               HttpMethod.POST, "/api/meal", bad, auth, HttpStatus.BAD_REQUEST, String.class);

           assertHasFieldError(body, "items", "VALIDATION_INVALID_VALUE");
       }

       @Test
       void testUpdate_shouldReturn404_whenUnknownId() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");

           exchangeForBody(HttpMethod.PUT, "/api/meal/" + UUID.randomUUID(),
               mealReq(pantryItem(food, "100")), auth, HttpStatus.NOT_FOUND, String.class);
       }

       @Test
       void testDelete_shouldReturn404_whenUnknownId() {
           HttpHeaders auth = ownerAuthHeaders();

           deleteAndExpect("/api/meal/" + UUID.randomUUID(), auth, HttpStatus.NOT_FOUND);
       }
   ```

2. Run the negative-path cases — expect FAILURE until the service branch-validation + the `MealApi` 404 wiring exist. Run:
   ```bash
   cd backend && ./mvnw -q clean test -Dtest=MealApiIT#testCreate_shouldReturn400FieldError_whenItemsEmpty+testCreate_shouldReturn400FieldError_whenSlotInvalid+testCreate_shouldReturn400FieldError_whenSourceArmMismatch+testCreate_shouldReturn400FieldError_whenSourceRowMissing+testUpdate_shouldReturn404_whenUnknownId+testDelete_shouldReturn404_whenUnknownId
   ```
   Expected: FAILS (assertion or wiring). These pass once the SERVICE section enforces the arm/missing-source 400 on `items` and `requireOwned` 404, and the contract carries the `slot`/`items` validators.

3. No production code owned here — the 400/404 behavior is produced by the SERVICE section + the generated contract validators. If `source-arm mismatch` or `missing source` does NOT yield a FIELD error on `items`, that is a SERVICE-section defect — flag it; do not patch in the test.

4. Run — expect PASS. Run the same command as step 2; expected BUILD SUCCESS, all 6 cases green.

5. Commit. Run:
   ```bash
   git add backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java
   git commit -m "test(meal): MealApiIT validation 400s + unknown-id 404s (mezo-arb)"
   ```

---

### Task ctrl5: `MealApiIT` — full-replace PUT + delete → 204 → absent from the day

**Files:**
- Test (modify): `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java`

**Interfaces:**
- Consumes: the ctrl3 helpers; `putForBody`, `getForBody`, `deleteAndExpect`, `exchangeForBody`.
- Produces: the update/delete lifecycle cases.

> Full-replace mirrors `RecipeApiIT.testUpdate_shouldFullReplaceLines_whenOwned`: re-`PUT` the COMPLETE meal with a different item set; the old items are gone (orphanRemoval), the rollup reflects only the new items. Delete: `204`, then the meal is absent from `GET /api/fuel/day` and a re-`PUT`/`DELETE` on it is `404`.

**Steps:**

1. Add the lifecycle tests before the final closing brace of `MealApiIT`:
   ```java
       @Test
       void testUpdate_shouldFullReplaceItems_whenOwned() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID chicken = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           UUID oats = createFood(auth, "Zabpehely", "100", "10", "20", "5");

           MealResponse created = postForBody(
               "/api/meal", mealReq(pantryItem(chicken, "200")), auth, HttpStatus.CREATED, MealResponse.class);
           assertThat(created.getItems()).hasSize(1);
           // 200 g of per-100g chicken: factor 2 -> kcal 220
           assertThat(created.getMacros().getKcal()).isEqualByComparingTo("220");

           // Full-replace: re-send the COMPLETE meal, now a single 100 g oats line (chicken removed)
           MealRequest replace = mealReq(pantryItem(oats, "100"));
           replace.setTitle("Zabkása");
           putForBody("/api/meal/" + created.getId(), replace, auth, HttpStatus.NO_CONTENT, Void.class);

           FuelDayResponse day = getForBody(
               "/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK, FuelDayResponse.class);
           MealResponse after = day.getMeals().stream()
               .filter(m -> m.getId().equals(created.getId()))
               .findFirst().orElseThrow();
           assertThat(after.getTitle()).isEqualTo("Zabkása");
           assertThat(after.getItems()).extracting(MealItemResponse::getName).containsExactly("Zabpehely");
           // 100 g of per-100g oats: factor 1 -> kcal 100
           assertThat(after.getMacros().getKcal()).isEqualByComparingTo("100");
       }

       @Test
       void testDelete_shouldReturn204ThenAbsentFromDay_whenOwned() {
           HttpHeaders auth = ownerAuthHeaders();
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           MealResponse created = postForBody(
               "/api/meal", mealReq(pantryItem(food, "200")), auth, HttpStatus.CREATED, MealResponse.class);

           deleteAndExpect("/api/meal/" + created.getId(), auth, HttpStatus.NO_CONTENT);

           FuelDayResponse day = getForBody(
               "/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK, FuelDayResponse.class);
           assertThat(day.getMeals()).extracting(MealResponse::getId).doesNotContain(created.getId());
           assertThat(day.getConsumed().getKcal()).isEqualByComparingTo("0");
           // re-delete the now soft-deleted meal -> 404
           deleteAndExpect("/api/meal/" + created.getId(), auth, HttpStatus.NOT_FOUND);
       }
   ```

2. Run the lifecycle cases — expect FAILURE until the update/delete service paths exist. Run:
   ```bash
   cd backend && ./mvnw -q clean test -Dtest=MealApiIT#testUpdate_shouldFullReplaceItems_whenOwned+testDelete_shouldReturn204ThenAbsentFromDay_whenOwned
   ```
   Expected: FAILS (wiring/assertion) until the SERVICE update full-replace + delete child-soft-delete are in place.

3. No production code owned here (SERVICE owns full-replace + child soft-delete). Once merged, re-run.

4. Run the FULL `MealApiIT` — expect every case green. Run:
   ```bash
   cd backend && ./mvnw -q clean test -Dtest=MealApiIT
   ```
   Expected: BUILD SUCCESS — all 10 `MealApiIT` cases pass.

5. Commit. Run:
   ```bash
   git add backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java
   git commit -m "test(meal): MealApiIT full-replace PUT + delete lifecycle (mezo-arb)"
   ```

---

### Task ctrl6: `RecipeApiIT` — `GET /api/recipe/{id}/logs` returns the logged meal

**Files:**
- Test (modify): `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeApiIT.java`

**Interfaces:**
- Consumes: existing `RecipeApiIT` helpers (`createFood`, `recipeReq`); new DTOs `MealRequest`/`MealItemRequest`/`MealResponse`, `RecipeLogResponse`/`RecipeLogListResponse`; `postForBody`, `getForBody`.
- Produces: a `testRecipeLogs_*` case proving the cross-feature query.

> A logged meal that references the recipe (recipe-arm) must surface in `GET /api/recipe/{id}/logs` as a `RecipeLogResponse`. The case logs a 1-serving meal of the recipe then asserts the log appears with the recipe's per-serving macros (factor 1).

**Steps:**

1. Add the imports at the top of `RecipeApiIT.java`, after the existing `import io.mrkuhne.mezo.api.dto.RecipeResponse;` line:
   ```java
   import io.mrkuhne.mezo.api.dto.MealItemRequest;
   import io.mrkuhne.mezo.api.dto.MealRequest;
   import io.mrkuhne.mezo.api.dto.MealResponse;
   import io.mrkuhne.mezo.api.dto.RecipeLogListResponse;
   import io.mrkuhne.mezo.api.dto.RecipeLogResponse;
   ```

2. Add the test method before the final closing brace of `RecipeApiIT`:
   ```java
       @Test
       void testRecipeLogs_shouldReturnLoggedMeal_whenMealReferencesRecipe() {
           HttpHeaders auth = ownerAuthHeaders();
           // 2-serving recipe (200 g of a per-100g food -> whole rollup kcal 220, per-serving 110)
           UUID food = createFood(auth, "Csirkemell", "110", "23", "0", "1.5");
           RecipeResponse recipe =
               postForBody("/api/recipe", recipeReq(food), auth, HttpStatus.CREATED, RecipeResponse.class);

           // Log a breakfast meal of 1 serving of the recipe (recipe-arm)
           MealItemRequest item = new MealItemRequest();
           item.setSource("recipe");
           item.setRecipeId(recipe.getId());
           item.setAmount(new BigDecimal("1"));
           item.setUnit("adag");
           MealRequest meal = new MealRequest();
           meal.setSlot("breakfast");
           meal.setTitle("Reggeli");
           meal.setItems(List.of(item));
           MealResponse logged =
               postForBody("/api/meal", meal, auth, HttpStatus.CREATED, MealResponse.class);

           RecipeLogListResponse logs = getForBody(
               "/api/recipe/" + recipe.getId() + "/logs", auth, HttpStatus.OK, RecipeLogListResponse.class);

           assertThat(logs.getRecentLogs())
               .extracting(RecipeLogResponse::getMealId)
               .contains(logged.getId());
           RecipeLogResponse log = logs.getRecentLogs().stream()
               .filter(l -> l.getMealId().equals(logged.getId()))
               .findFirst().orElseThrow();
           assertThat(log.getSlot()).isEqualTo("breakfast");
           // per-serving of the recipe x factor 1 -> kcal 110
           assertThat(log.getKcal()).isEqualByComparingTo("110");
       }
   ```

3. Run the new case — expect FAILURE until the `/logs` endpoint + the cross-feature query exist. Run:
   ```bash
   cd backend && ./mvnw -q clean test -Dtest=RecipeApiIT#testRecipeLogs_shouldReturnLoggedMeal_whenMealReferencesRecipe
   ```
   Expected: FAILS (compile against not-yet-generated `RecipeLog*` DTOs, or 404/empty `recentLogs`) until ctrl2 + the recipe-contract op + the SERVICE `recipeLogs` query land.

4. Run the FULL `RecipeApiIT` — expect every case green (no regression to the existing recipe cases). Run:
   ```bash
   cd backend && ./mvnw -q clean test -Dtest=RecipeApiIT
   ```
   Expected: BUILD SUCCESS — all existing recipe cases + the new `/logs` case pass.

5. Commit. Run:
   ```bash
   git add backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeApiIT.java
   git commit -m "test(recipe): RecipeApiIT GET /recipe/{id}/logs surfaces logged meal (mezo-arb)"
   ```

---

## Section close

After ctrl1–ctrl6 + the dependency sections are merged, run the full backend suite to confirm the controllers + ITs are green end-to-end:
```bash
cd backend && ./mvnw clean test
```
Expected: BUILD SUCCESS. Then the doc-touch (`MealController` + the recipe-logs endpoint change `docs/features/<fuel>.md` §4/§10 — coordinate with whichever section owns the feature doc update) and `node scripts/lint-docs.mjs`.

---

## Phase 6 — FE data layer

# Frontend Data-Layer — Meal Logging (Mai)

Driving bd: `mezo-arb`. Spec §7: `docs/superpowers/specs/2026-06-24-fuel-meal-logging-design.md`.

This section owns the **frontend data boundary only**: the FE domain types for the meal aggregate, `src/lib/mealApi.ts`, the dual-mode `src/data/fuelHooks.ts` (`useFuelDay` composed + `useMealActions`), the `src/data/hooks.ts` re-export swap, and the MSW handlers for `/api/fuel/day`, `/api/meal`, `/api/recipe/{id}/logs`. Component wiring (`LogMealSheet`, `MealPickerSheet`, MacroHero/meal-list/RecipeLogsList/CTA wiring) is a **separate section** and CONSUMES the `useFuelDay`/`useMealActions` exports produced here.

This mirrors the shipped Recipe slice verbatim: `src/lib/recipeApi.ts` (`toRequest`/`fromResponse`/`recipeApi`), `src/data/recipeHooks.ts` (composed `useRecipes` + `useRecipeActions` with mock `setQueryData` mutators / real invalidate), and their tests `src/lib/recipeApi.test.ts` + `src/data/recipeHooks.test.tsx`. Use those as the literal template.

**Prerequisite (owned by the CONTRACT/api section, consumed here):** the merged OpenAPI must expose, in `frontend/src/lib/api.gen.ts`, the generated `components['schemas']` entries: `MealRequest`, `MealItemRequest`, `MealResponse`, `MealItemResponse`, `FuelDayResponse`, `Macros`, `MealScore`, `MacroSet`, `RecipeLogResponse`, `RecipeLogListResponse`. The FE type re-gen (`cd frontend && pnpm generate:api`) is run by the contract section; the tasks below assume those names exist. If a task's `tsc` step fails because a schema name is missing, regenerate first (`cd frontend && pnpm generate:api`) — do NOT hand-write boundary DTOs (per `api_contract_conventions.md`).

---

### Task fd1: Extend FE domain types — structured `FuelMeal.items`, `MealItemLine`, `MealInput`

Add the structured meal-item shape so a logged meal carries polymorphic line refs + per-line contribution (replacing the free-text `items: string[]`), real `loggedAt`/`mealDate`, and an editor input payload. Preserve `MacroSet`/`FuelDay`/`MealBreakdown` exactly.

**Files:**
- Modify: `frontend/src/data/types.ts`
- Test: `frontend/src/data/mealTypes.test.ts` (Create)

**Interfaces:**
- Consumes: existing `MacroSet { kcal; p; c; f; water }`, `MealBreakdown`, `FuelDay { targets; consumed; meals; pacing; micronutrients; supplements }` (verbatim, unchanged); existing `FuelMeal` (extended, not replaced).
- Produces (later tasks + the component section rely on these EXACT names):
  - `type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'`
  - `type MealItemSource = 'recipe' | 'pantry'`
  - `interface MealItemLine { source: MealItemSource; refId: string; amount: number; unit: string; name: string; contribution: { kcal: number; p: number; c: number; f: number }; nova?: number }` — `refId` is the recipeId (source `recipe`) OR pantryItemId (source `pantry`); mirrors `RecipeIngredientLine.refId`/`contribution`.
  - `FuelMeal` gains `mealItems: MealItemLine[]`, `loggedAt: string` (now required ISO), `mealDate: string` (`YYYY-MM-DD`). Keep the legacy `items: string[]` field (the score sheet + mock seeds still read it) and keep `recipeId?`/`breakdown?`.
  - `interface MealInputItem { source: MealItemSource; refId: string; amount: number; unit: string }`
  - `interface MealInput { slot: MealSlot; loggedAt?: string | null; title?: string | null; items: MealInputItem[] }`

**Steps:**

1. Write the failing test `frontend/src/data/mealTypes.test.ts`:
   ```ts
   import { describe, it, expectTypeOf } from 'vitest'
   import type { MealSlot, MealItemSource, MealItemLine, MealInput, MealInputItem, FuelMeal } from './types'

   describe('meal domain types', () => {
     it('MealSlot is the 4-slot union', () => {
       expectTypeOf<MealSlot>().toEqualTypeOf<'breakfast' | 'lunch' | 'dinner' | 'snack'>()
     })

     it('MealItemLine carries source + refId + contribution + optional nova', () => {
       const line: MealItemLine = {
         source: 'recipe', refId: 'r1', amount: 1, unit: 'adag',
         name: 'Túrós zabkása', contribution: { kcal: 580, p: 42, c: 78, f: 12 }, nova: 3,
       }
       expectTypeOf(line.source).toEqualTypeOf<MealItemSource>()
       expectTypeOf(line.refId).toBeString()
       expectTypeOf(line.contribution.kcal).toBeNumber()
     })

     it('FuelMeal gains structured mealItems + real loggedAt/mealDate, keeps legacy items', () => {
       expectTypeOf<FuelMeal>().toHaveProperty('mealItems').toEqualTypeOf<MealItemLine[]>()
       expectTypeOf<FuelMeal>().toHaveProperty('loggedAt').toBeString()
       expectTypeOf<FuelMeal>().toHaveProperty('mealDate').toBeString()
       expectTypeOf<FuelMeal>().toHaveProperty('items').toEqualTypeOf<string[]>()
     })

     it('MealInput is the editor payload (slot + nullable loggedAt/title + items)', () => {
       const input: MealInput = {
         slot: 'breakfast', loggedAt: null, title: null,
         items: [{ source: 'pantry', refId: 'p-zab', amount: 70, unit: 'g' } satisfies MealInputItem],
       }
       expectTypeOf(input.items[0]).toEqualTypeOf<MealInputItem>()
     })
   })
   ```

2. Run it — expect FAILURE (type errors / missing exports):
   ```
   cd frontend && pnpm exec vitest run src/data/mealTypes.test.ts
   ```
   Expected: fails — `MealSlot`, `MealItemLine`, `MealInput`, `MealInputItem` not exported; `FuelMeal` has no `mealItems`/`mealDate`.

3. Implement — in `frontend/src/data/types.ts`, replace the existing `FuelMeal` interface (currently `items: string[]; tags; recipeId?; loggedAt?; breakdown?`) and add the new types just above it. The full replacement block (locate the existing `export interface FuelMeal { ... }` and the line `export interface Micronutrient` after it; insert the new types before `FuelMeal` and rewrite `FuelMeal`):
   ```ts
   export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
   export type MealItemSource = 'recipe' | 'pantry'
   /** A logged meal line — polymorphic ref (recipe|pantry) + frozen snapshot name + this line's
    *  macro share. Mirrors RecipeIngredientLine: `refId` === recipeId (source 'recipe') or
    *  pantryItemId (source 'pantry'). `contribution` is round(snapshot × amount/per), HALF_UP. */
   export interface MealItemLine {
     source: MealItemSource
     refId: string
     amount: number
     unit: string
     name: string // server snapshot name (frozen at log time)
     contribution: { kcal: number; p: number; c: number; f: number }
     nova?: number // 1..4, carried for the future NOVA score dimension
   }
   export interface FuelMeal {
     id: string; slot: string; title: string; score: number | null
     kcal: number; p: number; c: number; f: number
     mealItems: MealItemLine[] // structured lines (real once logged)
     items: string[] // legacy free-text labels — kept for the mock score-sheet seeds
     tags: string[]
     loggedAt: string; mealDate: string // real instant + denormalized day key
     recipeId?: string
     breakdown?: MealBreakdown
   }
   /** Editor line — maps to MealItemRequest (refId → recipeId|pantryItemId by source). */
   export interface MealInputItem { source: MealItemSource; refId: string; amount: number; unit: string }
   /** Capture-sheet save payload — maps to the MealRequest contract. */
   export interface MealInput {
     slot: MealSlot
     loggedAt?: string | null
     title?: string | null
     items: MealInputItem[]
   }
   ```
   Note: `MacroSet`, `MealBreakdown`, `FuelDay` are untouched.

4. Run it — expect PASS:
   ```
   cd frontend && pnpm exec vitest run src/data/mealTypes.test.ts
   ```
   Expected: all 4 type assertions pass.

5. Commit:
   ```
   git add frontend/src/data/types.ts frontend/src/data/mealTypes.test.ts
   git commit -m "feat(fuel): structured FuelMeal.items + MealInput FE types (mezo-arb)"
   ```

---

### Task fd2: Update mock seeds (`fuel.ts`) to the extended `FuelMeal` shape

The new required `mealItems`/`loggedAt`/`mealDate` fields break the `fuelDay` seed and the `getScoredMeal` join. Backfill the four seed meals so mock mode compiles and `useFuelDay` returns a valid `FuelDay`. Null the seed scores per the spec's pending-sparkle rule (§7: "do the same for any meal seed score").

**Files:**
- Modify: `frontend/src/data/fuel.ts`
- Test: `frontend/src/data/fuelData.test.tsx` (Modify — add a seed-shape assertion)

**Interfaces:**
- Consumes: `FuelMeal`, `MealItemLine` (from fd1); `localDateString` from `@/lib/dates`.
- Produces: the `fuelDay` const now satisfies the extended `FuelDay`/`FuelMeal`; each seed meal has `mealItems: MealItemLine[]`, `loggedAt: ISO`, `mealDate: localDateString()`, `score: null`. `getScoredMeal` keeps its signature `(slot: FuelSlot, meals: FuelMeal[]) => FuelMeal | null`.

**Steps:**

1. Add a failing assertion to `frontend/src/data/fuelData.test.tsx` — append inside the existing top-level `describe` (or add a new `describe('fuelDay seed shape', ...)`):
   ```ts
   it('every seed meal carries structured mealItems + mealDate and a null pending score', async () => {
     const { fuelDay } = await import('./fuel')
     for (const m of fuelDay.meals) {
       expect(Array.isArray(m.mealItems)).toBe(true)
       expect(m.mealItems.length).toBeGreaterThan(0)
       expect(m.mealItems[0]).toHaveProperty('source')
       expect(m.mealItems[0]).toHaveProperty('contribution')
       expect(typeof m.mealDate).toBe('string')
       expect(typeof m.loggedAt).toBe('string')
       expect(m.score).toBeNull()
     }
   })
   ```

2. Run it — expect FAILURE:
   ```
   cd frontend && pnpm exec vitest run src/data/fuelData.test.tsx
   ```
   Expected: TS errors (seed meals lack `mealItems`/`mealDate`) and/or the runtime assertion fails (seed `score` is `0.92`, not null).

3. Implement — in `frontend/src/data/fuel.ts`:
   - Add the import at the top: change `import type { FuelDay, FuelPlanToday, SupplementStashItem, Protocol, FuelMeal, FuelSlot } from './types'` to also import `MealItemLine`, and add a value import for the day key:
     ```ts
     import type { FuelDay, FuelPlanToday, SupplementStashItem, Protocol, FuelMeal, FuelSlot, MealItemLine } from './types'
     import { localDateString } from '@/lib/dates'

     const TODAY = localDateString()
     ```
   - For EACH of the four seed meals (`m1`..`m4`), set `score: null`, add `mealDate: TODAY`, add `loggedAt`, and add a `mealItems` array derived from the existing free-text `items` (keep `items` as-is). Use the existing `kcal/p/c/f` literals split into one representative `recipe`-source line per meal (single line carrying the whole meal macros — the seeds are display-only and the score-sheet still reads `items`/`breakdown`). Concretely, for `m1` insert these fields (do the analogous edit for `m2`/`m3`/`m4` with their own ids/macros/times):
     ```ts
     // m1
     score: null,
     loggedAt: `${TODAY}T09:15:00`,
     mealDate: TODAY,
     mealItems: [
       { source: 'recipe', refId: 'rec-1', amount: 1, unit: 'adag', name: 'Túrós zabkása · áfonyával',
         contribution: { kcal: 580, p: 42, c: 78, f: 12 }, nova: 3 } satisfies MealItemLine,
     ],
     ```
     - `m2`: `loggedAt: \`${TODAY}T13:00:00\``, line name `'Csirke + édesburgonya + spenót'`, contribution `{ kcal: 720, p: 58, c: 74, f: 18 }`, `nova: 1`.
     - `m3`: `loggedAt: \`${TODAY}T16:00:00\``, line name `'Whey + banán'`, contribution `{ kcal: 340, p: 42, c: 36, f: 4 }`, `nova: 4`.
     - `m4`: `loggedAt: \`${TODAY}T19:30:00\``, line name `'Lazac + barna rizs + brokkoli'`, contribution `{ kcal: 760, p: 48, c: 72, f: 28 }`, `nova: 1`. (`m4` already has `score: null` — keep it.)
   - `getScoredMeal` (bottom of file) is unchanged — it matches by `m.title === slot.mealName && m.breakdown`, both still present.

4. Run it — expect PASS:
   ```
   cd frontend && pnpm exec vitest run src/data/fuelData.test.tsx
   ```
   Expected: the new assertion + the existing `fuelData` tests pass.

5. Commit:
   ```
   git add frontend/src/data/fuel.ts frontend/src/data/fuelData.test.tsx
   git commit -m "feat(fuel): backfill mock meal seeds to structured shape, null pending scores (mezo-arb)"
   ```

---

### Task fd3: `src/lib/mealApi.ts` — `getDay` / `create` / `update` / `remove` + `toRequest`/`fromResponse`

The HTTP boundary over `/api/fuel/day/{date}` + `/api/meal[/{id}]`. `toRequest` builds the polymorphic `items` (source + `recipeId` | `pantryItemId` from the single `refId`); `fromResponse` re-keys each `MealItemResponse` back to a `MealItemLine` (`recipeId|pantryItemId → refId`). Mirrors `recipeApi.ts` exactly.

**Files:**
- Create: `frontend/src/lib/mealApi.ts`
- Test: `frontend/src/lib/mealApi.test.ts` (Create)

**Interfaces:**
- Consumes: `apiFetch` from `./api`; `components['schemas']` types `MealRequest`, `MealResponse`, `MealItemRequest`, `MealItemResponse`, `FuelDayResponse` from `./api.gen`; `MealInput`, `MealInputItem`, `FuelMeal`, `MealItemLine`, `MacroSet` from `@/data/types`.
- Produces (fd4 + the component section rely on these EXACT names/signatures):
  - `export function toRequest(input: MealInput): MealRequest`
  - `export function fromResponse(r: MealResponse): FuelMeal`
  - `export interface FuelDayData { date: string; targets: MacroSet; consumed: MacroSet; meals: FuelMeal[] }`
  - `export const mealApi = { getDay(date: string): Promise<FuelDayData>; create(input: MealInput): Promise<void>; update(id: string, input: MealInput): Promise<void>; remove(id: string): Promise<void> }`

**Steps:**

1. Write the failing test `frontend/src/lib/mealApi.test.ts`:
   ```ts
   import { afterEach, describe, expect, it } from 'vitest'
   import { http, HttpResponse } from 'msw'
   import { mealApi, toRequest, fromResponse } from './mealApi'
   import { server } from '@/test/msw/server'
   import { API_BASE } from '@/test/msw/handlers'
   import type { MealInput } from '@/data/types'

   const input: MealInput = {
     slot: 'breakfast', loggedAt: '2026-06-24T09:15:00', title: 'Reggeli',
     items: [
       { source: 'recipe', refId: 'rec-1', amount: 1, unit: 'adag' },
       { source: 'pantry', refId: 'p-zab', amount: 70, unit: 'g' },
     ],
   }

   const mealResponse = {
     id: 'm1', slot: 'breakfast', loggedAt: '2026-06-24T09:15:00', mealDate: '2026-06-24',
     title: 'Reggeli', macros: { kcal: 840, p: 51, c: 120, f: 17 },
     score: { value: null, breakdown: null },
     items: [
       { source: 'recipe', recipeId: 'rec-1', pantryItemId: null, amount: 1, unit: 'adag', lineOrder: 0, name: 'Túrós zabkása', nova: 3, contribution: { kcal: 580, p: 42, c: 78, f: 12 } },
       { source: 'pantry', recipeId: null, pantryItemId: 'p-zab', amount: 70, unit: 'g', lineOrder: 1, name: 'Zabpehely', nova: 1, contribution: { kcal: 260, p: 9, c: 42, f: 5 } },
     ],
   }

   const dayResponse = {
     date: '2026-06-24',
     targets: { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 },
     consumed: { kcal: 840, p: 51, c: 120, f: 17, water: 4000 },
     meals: [mealResponse],
   }

   afterEach(() => server.resetHandlers())

   describe('toRequest', () => {
     it('routes refId to recipeId | pantryItemId by source', () => {
       const req = toRequest(input)
       expect(req.slot).toBe('breakfast')
       expect(req.loggedAt).toBe('2026-06-24T09:15:00')
       expect(req.items).toEqual([
         { source: 'recipe', recipeId: 'rec-1', pantryItemId: null, amount: 1, unit: 'adag' },
         { source: 'pantry', recipeId: null, pantryItemId: 'p-zab', amount: 70, unit: 'g' },
       ])
     })
   })

   describe('fromResponse', () => {
     it('re-keys each item to a MealItemLine (recipeId|pantryItemId → refId) and lifts macros to kcal/p/c/f', () => {
       const meal = fromResponse(mealResponse)
       expect(meal.id).toBe('m1')
       expect(meal.score).toBeNull()
       expect(meal.kcal).toBe(840)
       expect(meal.mealItems[0]).toMatchObject({ source: 'recipe', refId: 'rec-1', name: 'Túrós zabkása', nova: 3, contribution: { kcal: 580, p: 42, c: 78, f: 12 } })
       expect(meal.mealItems[1]).toMatchObject({ source: 'pantry', refId: 'p-zab', amount: 70, unit: 'g' })
     })
   })

   describe('mealApi', () => {
     it('getDay returns FuelDayData with mapped meals', async () => {
       server.use(http.get(`${API_BASE}/api/fuel/day/2026-06-24`, () => HttpResponse.json(dayResponse)))
       const day = await mealApi.getDay('2026-06-24')
       expect(day.date).toBe('2026-06-24')
       expect(day.targets.kcal).toBe(3100)
       expect(day.consumed.kcal).toBe(840)
       expect(day.meals[0].mealItems).toHaveLength(2)
     })

     it('create POSTs the mapped body and resolves void on 201', async () => {
       let body: unknown
       server.use(http.post(`${API_BASE}/api/meal`, async ({ request }) => {
         body = await request.json()
         return HttpResponse.json(mealResponse, { status: 201 })
       }))
       await expect(mealApi.create(input)).resolves.toBeUndefined()
       expect((body as { items: unknown[] }).items).toHaveLength(2)
     })

     it('update PUTs to /api/meal/{id} and resolves void on 204', async () => {
       server.use(http.put(`${API_BASE}/api/meal/m1`, () => new HttpResponse(null, { status: 204 })))
       await expect(mealApi.update('m1', input)).resolves.toBeUndefined()
     })

     it('remove DELETEs /api/meal/{id} and resolves void on 204', async () => {
       server.use(http.delete(`${API_BASE}/api/meal/m1`, () => new HttpResponse(null, { status: 204 })))
       await expect(mealApi.remove('m1')).resolves.toBeUndefined()
     })
   })
   ```

2. Run it — expect FAILURE:
   ```
   cd frontend && pnpm exec vitest run src/lib/mealApi.test.ts
   ```
   Expected: fails — `./mealApi` does not exist.

3. Implement `frontend/src/lib/mealApi.ts`:
   ```ts
   import { apiFetch } from './api'
   import type { components } from './api.gen'
   import type { MealInput, MealInputItem, FuelMeal, MealItemLine, MacroSet } from '@/data/types'

   type MealRequest = components['schemas']['MealRequest']
   type MealItemRequest = components['schemas']['MealItemRequest']
   type MealResponse = components['schemas']['MealResponse']
   type MealItemResponse = components['schemas']['MealItemResponse']
   type FuelDayResponse = components['schemas']['FuelDayResponse']

   /** What the composed useFuelDay needs from the server (targets/consumed/meals). */
   export interface FuelDayData {
     date: string
     targets: MacroSet
     consumed: MacroSet
     meals: FuelMeal[]
   }

   /** Editor input → contract request. The single `refId` is routed to recipeId | pantryItemId by
    *  source; the unused arm is sent as null so the server's exactly-one-of CHECK is satisfied. */
   export function toRequest(input: MealInput): MealRequest {
     return {
       slot: input.slot,
       loggedAt: input.loggedAt ?? null,
       title: input.title ?? null,
       items: input.items.map((i: MealInputItem): MealItemRequest => ({
         source: i.source,
         recipeId: i.source === 'recipe' ? i.refId : null,
         pantryItemId: i.source === 'pantry' ? i.refId : null,
         amount: i.amount,
         unit: i.unit,
       })),
     } satisfies MealRequest
   }

   /** Contract response → domain FuelMeal. Re-keys each line's recipeId|pantryItemId → refId, lifts
    *  the macros rollup to flat kcal/p/c/f, and nulls the pending score (breakdown is NULL in v1). */
   export function fromResponse(r: MealResponse): FuelMeal {
     return {
       id: r.id,
       slot: r.slot,
       title: r.title ?? '',
       score: r.score?.value ?? null,
       kcal: r.macros.kcal,
       p: r.macros.p,
       c: r.macros.c,
       f: r.macros.f,
       mealItems: r.items.map(
         (l: MealItemResponse): MealItemLine => ({
           source: l.source as MealItemLine['source'],
           refId: (l.source === 'recipe' ? l.recipeId : l.pantryItemId) ?? '',
           amount: l.amount,
           unit: l.unit,
           name: l.name,
           contribution: l.contribution,
           nova: l.nova ?? undefined,
         }),
       ),
       items: r.items.map(l => `${l.name} ${l.amount}${l.unit}`),
       tags: [],
       loggedAt: r.loggedAt,
       mealDate: r.mealDate,
     }
   }

   function fromDayResponse(d: FuelDayResponse): FuelDayData {
     return {
       date: d.date,
       targets: d.targets,
       consumed: d.consumed,
       meals: d.meals.map(fromResponse),
     }
   }

   export const mealApi = {
     getDay: (date: string): Promise<FuelDayData> =>
       apiFetch<FuelDayResponse>(`/api/fuel/day/${date}`).then(fromDayResponse),
     create: (input: MealInput): Promise<void> =>
       apiFetch('/api/meal', { method: 'POST', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
     update: (id: string, input: MealInput): Promise<void> =>
       apiFetch(`/api/meal/${id}`, { method: 'PUT', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
     remove: (id: string): Promise<void> =>
       apiFetch(`/api/meal/${id}`, { method: 'DELETE' }).then(() => undefined),
   }
   ```
   Note: if `tsc` complains that `r.macros`/`l.contribution` are not assignable to `{ kcal; p; c; f }` (generated `Macros` is a structurally-identical separate type), they ARE structurally equal so assignment is fine; if the generated `MacroSet` for `targets`/`consumed` differs in optionality, keep the direct assignment — both contract `MacroSet` and FE `MacroSet` are `{ kcal; p; c; f; water }`.

4. Run it — expect PASS:
   ```
   cd frontend && pnpm exec vitest run src/lib/mealApi.test.ts
   ```
   Expected: all `toRequest`/`fromResponse`/`mealApi` tests pass.

5. Commit:
   ```
   git add frontend/src/lib/mealApi.ts frontend/src/lib/mealApi.test.ts
   git commit -m "feat(fuel): mealApi getDay/create/update/remove with polymorphic item mapping (mezo-arb)"
   ```

---

### Task fd4: `src/data/fuelHooks.ts` — composed dual-mode `useFuelDay` + `useMealActions`

`useFuelDay()` keyed `['fuelDay', date]`: real → `mealApi.getDay`, mock → `initialData` from the seed; **composed** so the public return keeps the `FuelDay` shape `{ targets, consumed, meals, pacing, micronutrients, supplements }` — only `targets/consumed/meals` are query-driven; `pacing/micronutrients/supplements` come from the static `fuelDay` seed. `useMealActions()` exposes `logMeal/updateMeal/deleteMeal`: real → `mealApi` + invalidate `['fuelDay']` AND `['recipes']` AND `['pantry']`; mock → `setQueryData(['fuelDay', date])` mutators computing each line `contribution` with the SAME whole-number `amount/per` formula as the backend. Mirrors `recipeHooks.ts`.

**Files:**
- Create: `frontend/src/data/fuelHooks.ts`
- Test: `frontend/src/data/fuelHooks.test.tsx` (Create)

**Interfaces:**
- Consumes: `useQuery`/`useMutation`/`useQueryClient` (`@tanstack/react-query`); `mealApi`, `FuelDayData` from `@/lib/mealApi`; `isMockMode` from `@/lib/mode`; `localDateString` from `@/lib/dates`; `fuelDay` (seed) from `./fuel`; `ingredients`, `recipes as mockRecipes` from `./pantry`; `MealInput`, `MealItemLine`, `FuelMeal`, `FuelDay`, `MacroSet`, `RecipeLog` from `./types`.
- Produces (re-exported by fd5; consumed by the component section):
  - `export function useFuelDay(date?: string): { fuel: FuelDay }` — `date` defaults to `localDateString()`; the returned `fuel` is the full `FuelDay` shape.
  - `export function useMealActions(date?: string): { logMeal(input: MealInput): void; updateMeal(id: string, input: MealInput): void; deleteMeal(id: string): void }`
  - `export function useRecipeLogs(recipeId: string): { logs: RecipeLog[] }` — recipe-detail logs for `RecipeLogsList`, keyed `['recipeLogs', recipeId]`; mock returns the recipe seed's `recentLogs` (`RecipeLog[]`), real `useQuery` → `GET /api/recipe/{id}/logs` (the MSW/real handler), each server row filled with neutral `score: 0`/`delta: 0` (v1 logs carry no score — pending).

**Steps:**

1. Write the failing test `frontend/src/data/fuelHooks.test.tsx`:
   ```tsx
   import type { ReactNode } from 'react'
   import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
   import { renderHook, waitFor, act } from '@testing-library/react'
   import { http, HttpResponse } from 'msw'
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
   import { useFuelDay, useMealActions } from './fuelHooks'
   import { server } from '@/test/msw/server'
   import { API_BASE } from '@/test/msw/handlers'
   import { localDateString } from '@/lib/dates'
   import type { MealInput } from './types'

   function sharedWrapper() {
     const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
     const Wrapper = ({ children }: { children: ReactNode }) => (
       <QueryClientProvider client={qc}>{children}</QueryClientProvider>
     )
     return { qc, Wrapper }
   }

   const newMeal: MealInput = {
     slot: 'snack', loggedAt: null, title: 'Snack',
     items: [{ source: 'pantry', refId: 'ing-zab', amount: 70, unit: 'g' }],
   }

   afterEach(() => vi.unstubAllEnvs())

   describe('useFuelDay (mock mode)', () => {
     beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

     it('returns the preserved FuelDay shape (targets/consumed/meals + pacing/micronutrients/supplements)', () => {
       const { Wrapper } = sharedWrapper()
       const { result } = renderHook(() => useFuelDay(), { wrapper: Wrapper })
       expect(Object.keys(result.current.fuel).sort()).toEqual(
         ['consumed', 'meals', 'micronutrients', 'pacing', 'supplements', 'targets'],
       )
       expect(result.current.fuel.targets.kcal).toBe(3100)
       expect(result.current.fuel.meals.length).toBeGreaterThan(0)
       expect(result.current.fuel.micronutrients.length).toBeGreaterThan(0)
     })

     it('logMeal appends a meal with whole-number contribution into the SAME ["fuelDay"] cache', async () => {
       const { Wrapper } = sharedWrapper()
       const { result } = renderHook(
         () => ({ read: useFuelDay(), actions: useMealActions() }),
         { wrapper: Wrapper },
       )
       const before = result.current.read.fuel.meals.length
       act(() => result.current.actions.logMeal(newMeal))
       await waitFor(() => expect(result.current.read.fuel.meals.length).toBe(before + 1))
       const added = result.current.read.fuel.meals.at(-1)!
       // ing-zab per 100, kcal 372 → round(372 × 70/100) = 260
       expect(added.mealItems[0].contribution.kcal).toBe(260)
       expect(added.kcal).toBe(260)
       expect(added.score).toBeNull()
     })

     it('deleteMeal removes a meal from the ["fuelDay"] cache', async () => {
       const { Wrapper } = sharedWrapper()
       const { result } = renderHook(
         () => ({ read: useFuelDay(), actions: useMealActions() }),
         { wrapper: Wrapper },
       )
       const id = result.current.read.fuel.meals[0].id
       const before = result.current.read.fuel.meals.length
       act(() => result.current.actions.deleteMeal(id))
       await waitFor(() => expect(result.current.read.fuel.meals.length).toBe(before - 1))
       expect(result.current.read.fuel.meals.some(m => m.id === id)).toBe(false)
     })
   })

   describe('useFuelDay (real mode)', () => {
     beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

     it('loads targets/consumed/meals from the API, keeps static pacing/micronutrients/supplements', async () => {
       const { Wrapper } = sharedWrapper()
       const { result } = renderHook(() => useFuelDay(), { wrapper: Wrapper })
       await waitFor(() => expect(result.current.fuel.meals.length).toBe(1))
       expect(result.current.fuel.targets.kcal).toBe(3100)
       expect(result.current.fuel.consumed.kcal).toBe(580)
       expect(result.current.fuel.meals[0].mealItems[0].refId).toBe('p-zab')
       // composed static legs still present
       expect(result.current.fuel.pacing).toBeDefined()
       expect(result.current.fuel.micronutrients.length).toBeGreaterThan(0)
     })

     it('logMeal POSTs and invalidates ["fuelDay"], ["recipes"] AND ["pantry"]', async () => {
       const { qc, Wrapper } = sharedWrapper()
       const spy = vi.spyOn(qc, 'invalidateQueries')
       let posted = false
       server.use(http.post(`${API_BASE}/api/meal`, async () => {
         posted = true
         return HttpResponse.json({ id: 'new' }, { status: 201 })
       }))
       const { result } = renderHook(() => useMealActions(), { wrapper: Wrapper })
       act(() => result.current.logMeal(newMeal))
       await waitFor(() => expect(posted).toBe(true))
       await waitFor(() => {
         const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
         expect(keys.some(k => k.includes('fuelDay'))).toBe(true)
         expect(keys).toContain(JSON.stringify(['recipes']))
         expect(keys).toContain(JSON.stringify(['pantry']))
       })
     })

     it('deleteMeal DELETEs and invalidates the 3 caches', async () => {
       const { qc, Wrapper } = sharedWrapper()
       const spy = vi.spyOn(qc, 'invalidateQueries')
       let deleted = false
       server.use(http.delete(`${API_BASE}/api/meal/m1`, () => {
         deleted = true
         return new HttpResponse(null, { status: 204 })
       }))
       const { result } = renderHook(() => useMealActions(), { wrapper: Wrapper })
       act(() => result.current.deleteMeal('m1'))
       await waitFor(() => expect(deleted).toBe(true))
       await waitFor(() => {
         const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
         expect(keys.some(k => k.includes('fuelDay'))).toBe(true)
         expect(keys).toContain(JSON.stringify(['recipes']))
         expect(keys).toContain(JSON.stringify(['pantry']))
       })
     })
   })
   ```

2. Run it — expect FAILURE:
   ```
   cd frontend && pnpm exec vitest run src/data/fuelHooks.test.tsx
   ```
   Expected: fails — `./fuelHooks` does not exist.

3. Implement `frontend/src/data/fuelHooks.ts`:
   ```tsx
   import { useCallback } from 'react'
   import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
   import { mealApi, type FuelDayData } from '@/lib/mealApi'
   import { isMockMode } from '@/lib/mode'
   import { localDateString } from '@/lib/dates'
   import { fuelDay } from './fuel'
   import { ingredients, recipes as mockRecipes } from './pantry'
   import type { MealInput, MealItemLine, FuelMeal, FuelDay, MacroSet } from './types'

   const FUELDAY_KEY = 'fuelDay'
   const RECIPES_KEY = ['recipes'] as const
   const PANTRY_KEY = ['pantry'] as const

   const fuelDayKey = (date: string) => [FUELDAY_KEY, date] as const

   /** The query-driven slice (real or mock seed); the rest of FuelDay is composed in from statics. */
   const seedDayData: FuelDayData = {
     date: localDateString(),
     targets: fuelDay.targets,
     consumed: fuelDay.consumed,
     meals: fuelDay.meals,
   }

   /**
    * Composed dual-mode. Only targets/consumed/meals are query-driven (real: mealApi.getDay,
    * mock: the static seed via initialData); pacing/micronutrients/supplements stay static so the
    * public return keeps the full FuelDay shape verbatim. Mock cache is client-owned (useMealActions
    * mutates via setQueryData) → never background-refetch in mock.
    */
   export function useFuelDay(date: string = localDateString()): { fuel: FuelDay } {
     const mock = isMockMode()
     const { data = seedDayData } = useQuery({
       queryKey: fuelDayKey(date),
       queryFn: mock ? async () => seedDayData : () => mealApi.getDay(date),
       initialData: mock ? seedDayData : undefined,
       staleTime: mock ? Infinity : 0,
     })
     const fuel: FuelDay = {
       targets: data.targets,
       consumed: data.consumed,
       meals: data.meals,
       pacing: fuelDay.pacing,
       micronutrients: fuelDay.micronutrients,
       supplements: fuelDay.supplements,
     }
     return { fuel }
   }

   /** log/update/delete on the ['fuelDay', date] cache. Real writes invalidate fuelDay + recipes +
    *  pantry (logging shifts recipe recentLogs + pantry usage). */
   export function useMealActions(date: string = localDateString()) {
     const qc = useQueryClient()
     const mock = isMockMode()

     const invalidate = () => {
       qc.invalidateQueries({ queryKey: [FUELDAY_KEY] })
       qc.invalidateQueries({ queryKey: RECIPES_KEY })
       qc.invalidateQueries({ queryKey: PANTRY_KEY })
     }

     const logM = useMutation({
       mutationFn: mock
         ? async (input: MealInput) => mockLog(qc, date, input)
         : (input: MealInput) => mealApi.create(input),
       onSuccess: mock ? undefined : invalidate,
     })
     const updateM = useMutation({
       mutationFn: mock
         ? async (v: { id: string; input: MealInput }) => mockUpdate(qc, date, v.id, v.input)
         : (v: { id: string; input: MealInput }) => mealApi.update(v.id, v.input),
       onSuccess: mock ? undefined : invalidate,
     })
     const deleteM = useMutation({
       mutationFn: mock
         ? async (id: string) => mockDelete(qc, date, id)
         : (id: string) => mealApi.remove(id),
       onSuccess: mock ? undefined : invalidate,
     })

     const logMeal = useCallback((input: MealInput) => logM.mutate(input), [logM])
     const updateMeal = useCallback((id: string, input: MealInput) => updateM.mutate({ id, input }), [updateM])
     const deleteMeal = useCallback((id: string) => deleteM.mutate(id), [deleteM])
     return { logMeal, updateMeal, deleteMeal }
   }

   // --- mock-mode cache mutators. Contribution uses the SAME whole-number amount/per formula as the
   // backend mapper: factor = amount / per (per>=1); contribution.X = Math.round(snapshot.X × factor). ---
   const SLOT_LABEL: Record<MealInput['slot'], string> = {
     breakfast: 'Reggeli', lunch: 'Ebéd', dinner: 'Vacsora', snack: 'Snack',
   }

   /** Resolve a request item to a snapshot (name/per/macros/nova) from the mock seeds, then scale. */
   function buildLine(item: MealInput['items'][number]): MealItemLine {
     if (item.source === 'recipe') {
       const r = mockRecipes.find(x => x.id === item.refId)
       const per = Math.max(1, r?.servings ?? 1)
       const m = r?.macros ?? { kcal: 0, p: 0, c: 0, f: 0 }
       const factor = item.amount / per
       return {
         source: 'recipe', refId: item.refId, amount: item.amount, unit: item.unit,
         name: r?.name ?? 'Recept',
         contribution: {
           kcal: Math.round((m.kcal / per) * item.amount),
           p: Math.round((m.p / per) * item.amount),
           c: Math.round((m.c / per) * item.amount),
           f: Math.round((m.f / per) * item.amount),
         },
         nova: r?.novaDominant,
       }
       void factor
     }
     const ing = ingredients.find(x => x.id === item.refId)
     const per = Math.max(1, ing?.per ?? 100)
     const m = ing?.macros ?? { kcal: 0, p: 0, c: 0, f: 0 }
     return {
       source: 'pantry', refId: item.refId, amount: item.amount, unit: item.unit,
       name: ing?.name ?? 'Kamra',
       contribution: {
         kcal: Math.round((m.kcal / per) * item.amount),
         p: Math.round((m.p / per) * item.amount),
         c: Math.round((m.c / per) * item.amount),
         f: Math.round((m.f / per) * item.amount),
       },
       nova: ing?.nova,
     }
   }

   function sumMacros(lines: MealItemLine[]) {
     return lines.reduce(
       (a, l) => ({ kcal: a.kcal + l.contribution.kcal, p: a.p + l.contribution.p, c: a.c + l.contribution.c, f: a.f + l.contribution.f }),
       { kcal: 0, p: 0, c: 0, f: 0 },
     )
   }

   function buildMeal(id: string, date: string, input: MealInput): FuelMeal {
     const lines = input.items.map(buildLine)
     const macros = sumMacros(lines)
     return {
       id, slot: SLOT_LABEL[input.slot], title: input.title ?? lines[0]?.name ?? 'Étkezés',
       score: null, kcal: macros.kcal, p: macros.p, c: macros.c, f: macros.f,
       mealItems: lines, items: lines.map(l => `${l.name} ${l.amount}${l.unit}`), tags: [],
       loggedAt: input.loggedAt ?? `${date}T${new Date().toTimeString().slice(0, 8)}`, mealDate: date,
     }
   }

   function recomputeConsumed(meals: FuelMeal[], targets: MacroSet): MacroSet {
     return meals.reduce(
       (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f, water: a.water }),
       { kcal: 0, p: 0, c: 0, f: 0, water: targets.water },
     )
   }

   function patchDay(qc: ReturnType<typeof useQueryClient>, date: string, fn: (d: FuelDayData) => FuelMeal[]) {
     qc.setQueryData<FuelDayData>(fuelDayKey(date), prev => {
       const base = prev ?? seedDayData
       const meals = fn(base)
       return { ...base, meals, consumed: recomputeConsumed(meals, base.targets) }
     })
     return undefined
   }
   function mockLog(qc: ReturnType<typeof useQueryClient>, date: string, input: MealInput) {
     return patchDay(qc, date, d => [...d.meals, buildMeal(crypto.randomUUID(), date, input)])
   }
   function mockUpdate(qc: ReturnType<typeof useQueryClient>, date: string, id: string, input: MealInput) {
     return patchDay(qc, date, d => d.meals.map(m => (m.id === id ? buildMeal(id, date, input) : m)))
   }
   function mockDelete(qc: ReturnType<typeof useQueryClient>, date: string, id: string) {
     return patchDay(qc, date, d => d.meals.filter(m => m.id !== id))
   }
   ```
3b. ADD the recipe-logs hook to the SAME `frontend/src/data/fuelHooks.ts` (it belongs to this data
   layer, not the component section). Append these imports/hook (mock returns the recipe seed's
   `recentLogs`; real `useQuery(['recipeLogs', recipeId])` → `GET /api/recipe/{id}/logs`, filling a
   neutral `score: 0`/`delta: 0` since v1 logs carry no score — pending). Extend the existing
   `./pantry` import to also pull `recipes as mockRecipes`, the `./types` import to add `RecipeLog`,
   and add:
   ```tsx
   import { apiFetch } from '@/lib/api'
   import { recipes as mockRecipes } from './pantry'
   import type { RecipeLog } from './types'

   const RECIPE_LOGS_KEY = (id: string) => ['recipeLogs', id] as const

   /** Per-recipe logs feeding RecipeLogsList. Mock derives from the recipe seed's recentLogs; real
    *  queries GET /api/recipe/{id}/logs and fills a neutral score/delta (v1 logs are score-less). */
   export function useRecipeLogs(recipeId: string): { logs: RecipeLog[] } {
     const mock = isMockMode()
     const seed = () => mockRecipes.find(r => r.id === recipeId)?.recentLogs ?? []
     const { data } = useQuery({
       queryKey: RECIPE_LOGS_KEY(recipeId),
       queryFn: mock
         ? async () => seed()
         : async () => {
             const res = await apiFetch<{ recentLogs: Omit<RecipeLog, 'score' | 'delta'>[] }>(`/api/recipe/${recipeId}/logs`)
             return res.recentLogs.map(l => ({ ...l, score: 0, delta: 0 }))
           },
       initialData: mock ? seed() : undefined,
       staleTime: mock ? Infinity : 0,
     })
     return { logs: data ?? [] }
   }
   ```
   (`isMockMode`/`useQuery` are already imported by step 3; only the three new imports above are added.)

   Note: remove the stray `void factor` / `factor` lines if `tsc` flags unreachable code — they are belt-and-suspenders for the lint rule; the canonical body computes `contribution` inline. (Keep the file lint-clean: delete the two `factor` lines.)

4. Run it — expect PASS:
   ```
   cd frontend && pnpm exec vitest run src/data/fuelHooks.test.tsx
   ```
   Expected: both mock-mode and real-mode blocks pass (shape preserved; mock contribution = 260; real invalidates the 3 caches).

5. Commit:
   ```
   git add frontend/src/data/fuelHooks.ts frontend/src/data/fuelHooks.test.tsx
   git commit -m "feat(fuel): composed dual-mode useFuelDay + useMealActions (mezo-arb)"
   ```

---

### Task fd5: Re-export `useFuelDay`/`useMealActions` from `hooks.ts`, retire the mock one-liners

Swap the inline mock `useFuelDay` one-liner in `src/data/hooks.ts` for a re-export of the dual-mode hook (mirrors how `useRecipes`/`useTrain` are re-exported), and add `useMealActions`. Keep `useFuelTimeline`/`useFuelPreview`/`useProtocol` as-is (out of scope per spec §2/§7). Consumer import paths stay `@/data/hooks`.

**Files:**
- Modify: `frontend/src/data/hooks.ts`
- Test: `frontend/src/data/hooks.reexport.test.ts` (Create)

**Interfaces:**
- Consumes: `useFuelDay`, `useMealActions` from `./fuelHooks` (fd4).
- Produces: `@/data/hooks` now exports `useFuelDay` (composed), `useMealActions`, and `useRecipeLogs`; the old inline `export function useFuelDay()` one-liner is gone.

**Steps:**

1. Write the failing test `frontend/src/data/hooks.reexport.test.ts`:
   ```ts
   import { describe, it, expect } from 'vitest'
   import * as hooks from './hooks'
   import { useFuelDay as fromFuelHooks, useMealActions as actionsFromFuelHooks } from './fuelHooks'

   describe('hooks.ts re-exports the dual-mode fuel-day hooks', () => {
     it('useFuelDay is the fuelHooks implementation (not the retired one-liner)', () => {
       expect(hooks.useFuelDay).toBe(fromFuelHooks)
     })
     it('useMealActions is re-exported', () => {
       expect(hooks.useMealActions).toBe(actionsFromFuelHooks)
     })
   })
   ```

2. Run it — expect FAILURE:
   ```
   cd frontend && pnpm exec vitest run src/data/hooks.reexport.test.ts
   ```
   Expected: fails — `hooks.useFuelDay` is the inline one-liner (`!==` the fuelHooks export); `hooks.useMealActions` is `undefined`.

3. Implement — in `frontend/src/data/hooks.ts`:
   - DELETE the inline one-liner:
     ```ts
     export function useFuelDay() {
       return { fuel: fuelDay }
     }
     ```
   - In the existing `import { fuelDay, fuelPlan, supplementsStash, protocol, getScoredMeal } from './fuel'`, the `fuelDay` symbol is still used by `useFuelTimeline` (it passes `fuelDay.meals` to `getScoredMeal`) — keep the import unchanged.
   - Add to the re-export block at the bottom (next to `export { useRecipes, useRecipeActions } from './recipeHooks'`):
     ```ts
     export { useFuelDay, useMealActions, useRecipeLogs } from './fuelHooks'
     ```

4. Run it — expect PASS:
   ```
   cd frontend && pnpm exec vitest run src/data/hooks.reexport.test.ts
   ```
   Expected: both identity assertions pass.

5. Commit:
   ```
   git add frontend/src/data/hooks.ts frontend/src/data/hooks.reexport.test.ts
   git commit -m "feat(fuel): re-export dual-mode useFuelDay + useMealActions, retire mock one-liner (mezo-arb)"
   ```

---

### Task fd6: MSW handlers — `/api/fuel/day/{date}`, `/api/meal`, `/api/recipe/{id}/logs`

Add real-mode handlers so the `mealApi`/`fuelHooks` real-mode tests and the live app have a backend stub. Mirror the recipe handlers' shape (fixture GET + echo writes); add a `mealFixture` + `fuelDayFixture` to `handlers.ts` and the `/api/recipe/:id/logs` recentLogs handler.

**Files:**
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/test/msw/mealHandlers.test.ts` (Create)

**Interfaces:**
- Consumes: `http`, `HttpResponse` (msw); `API_BASE`.
- Produces: default handlers for `GET /api/fuel/day/:date`, `POST /api/meal`, `PUT /api/meal/:id`, `DELETE /api/meal/:id`, `GET /api/recipe/:id/logs`. The `GET /api/fuel/day/:date` fixture returns `consumed.kcal === 580` and one meal whose first item `refId === 'p-zab'` (matched by the fd4 real-mode test).

**Steps:**

1. Write the failing test `frontend/src/test/msw/mealHandlers.test.ts`:
   ```ts
   import { describe, it, expect } from 'vitest'
   import { server } from './server'
   import { API_BASE } from './handlers'

   describe('meal MSW handlers (defaults)', () => {
     it('GET /api/fuel/day/:date returns targets/consumed/meals', async () => {
       const res = await fetch(`${API_BASE}/api/fuel/day/2026-06-24`)
       const body = await res.json()
       expect(res.status).toBe(200)
       expect(body.targets.kcal).toBe(3100)
       expect(body.consumed.kcal).toBe(580)
       expect(body.meals[0].items[0].pantryItemId).toBe('p-zab')
     })
     it('POST /api/meal echoes 201', async () => {
       const res = await fetch(`${API_BASE}/api/meal`, {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ slot: 'snack', items: [] }),
       })
       expect(res.status).toBe(201)
     })
     it('GET /api/recipe/:id/logs returns recentLogs', async () => {
       const res = await fetch(`${API_BASE}/api/recipe/rec-1/logs`)
       const body = await res.json()
       expect(res.status).toBe(200)
       expect(Array.isArray(body.recentLogs)).toBe(true)
       expect(body.recentLogs[0].mealId).toBeTruthy()
     })
   })
   // server is started by the global test setup (setupTests); no local lifecycle needed here.
   ```
   Note: if this repo's `src/test/setup*.ts` does NOT auto-start `server`, add `import { beforeAll, afterAll, afterEach } from 'vitest'` + the standard `server.listen()/resetHandlers()/close()` lifecycle (copy from any existing MSW-using test). Verify by grepping `src/test/` for the global setup first.

2. Run it — expect FAILURE:
   ```
   cd frontend && pnpm exec vitest run src/test/msw/mealHandlers.test.ts
   ```
   Expected: 404s — handlers not registered.

3. Implement — in `frontend/src/test/msw/handlers.ts`:
   - Above the `export const handlers = [` line, add the fixtures (next to `recipeFixture`):
     ```ts
     // Meal fixture (mezo-arb) mirroring MealResponse — one breakfast meal with a single recipe-arm
     // item (server snapshot name + contribution, lineOrder, pending null score).
     const mealFixture = {
       id: 'me1f3a0e2-0000-4000-8000-000000000001',
       slot: 'breakfast', loggedAt: '2026-06-24T09:15:00', mealDate: '2026-06-24',
       title: 'Túrós zabkása · áfonyával',
       macros: { kcal: 580, p: 42, c: 78, f: 12 },
       score: { value: null, breakdown: null },
       items: [
         { source: 'pantry', recipeId: null, pantryItemId: 'p-zab', amount: 70, unit: 'g', lineOrder: 0, name: 'Zabpehely', nova: 1, contribution: { kcal: 260, p: 9, c: 42, f: 5 } },
         { source: 'pantry', recipeId: null, pantryItemId: 'p-turo', amount: 200, unit: 'g', lineOrder: 1, name: 'Túró', nova: 3, contribution: { kcal: 320, p: 33, c: 36, f: 7 } },
       ],
     }
     const fuelDayFixture = {
       date: '2026-06-24',
       targets: { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 },
       consumed: { kcal: 580, p: 42, c: 78, f: 12, water: 4000 },
       meals: [mealFixture],
     }
     const recipeLogFixture = {
       recentLogs: [
         { mealId: 'me1f3a0e2-0000-4000-8000-000000000001', slot: 'breakfast', loggedAt: '2026-06-24T09:15:00', kcal: 580, p: 42, c: 78, f: 12 },
       ],
     }
     ```
   - Inside the `handlers` array (append after the recipe handlers, before the closing `]`):
     ```ts
     // Meal + fuel-day (mezo-arb) — defaults; tests override with server.use() for payload capture.
     http.get(`${API_BASE}/api/fuel/day/:date`, ({ params }) =>
       HttpResponse.json({ ...fuelDayFixture, date: String(params.date) }),
     ),
     http.post(`${API_BASE}/api/meal`, async ({ request }) => {
       const body = (await request.json()) as Record<string, unknown>
       return HttpResponse.json({ ...mealFixture, ...body, id: 'me1f3a0e2-0000-4000-8000-0000000000be' }, { status: 201 })
     }),
     http.put(`${API_BASE}/api/meal/:id`, () => new HttpResponse(null, { status: 204 })),
     http.delete(`${API_BASE}/api/meal/:id`, () => new HttpResponse(null, { status: 204 })),
     http.get(`${API_BASE}/api/recipe/:id/logs`, () => HttpResponse.json(recipeLogFixture)),
     ```

4. Run it — expect PASS:
   ```
   cd frontend && pnpm exec vitest run src/test/msw/mealHandlers.test.ts
   ```
   Expected: all 3 handler tests pass.

5. Commit:
   ```
   git add frontend/src/test/msw/handlers.ts frontend/src/test/msw/mealHandlers.test.ts
   git commit -m "feat(fuel): MSW handlers for fuel-day, meal CRUD, recipe logs (mezo-arb)"
   ```

---

### Task fd7: Green both `VITE_USE_MOCK` modes + build

Final gate for the data layer: the whole FE suite passes in BOTH modes and `tsc -b && vite build` is green (per the project Build & Test contract). Catches any composed-shape regressions in the existing `fuelData`/`FuelMaiView`/`FuelTimeline`/`MealScoreSheet`/`RecipeDetailView`/`KamraItemDetailView` tests caused by the `FuelMeal` shape change.

**Files:**
- (no new source) — Modify any existing fuel test only if the `FuelMeal` shape change broke an assertion (e.g. a test that asserted `meal.items` was a specific free-text array or that `useFuelDay()` took no arg). Keep edits minimal and behavior-preserving.

**Interfaces:**
- Consumes: everything above.
- Produces: a green data layer in both modes.

**Steps:**

1. Run the full suite in REAL mode (default):
   ```
   cd frontend && pnpm test
   ```
   Expected initially: PASS, unless an existing fuel test asserted the old `FuelMeal`/`useFuelDay` shape — if so it FAILS here.

2. If step 1 surfaced a failure, fix the broken assertion in place (behavior-preserving: e.g. update a test that destructured `useFuelDay()` with no arg — still valid since `date` is optional; or update a test reading `meal.items[0]` as free-text to read `meal.mealItems[0].name`). Re-run `pnpm test` until green. (If no failure, skip.)

3. Run the suite in MOCK mode:
   ```
   cd frontend && VITE_USE_MOCK=true pnpm test
   ```
   Expected: PASS (the composed mock `useFuelDay` + `setQueryData` mutators keep the offline app interactive).

4. Build:
   ```
   cd frontend && pnpm build
   ```
   Expected: `tsc -b && vite build` exits 0 (no type errors from the extended `FuelMeal`/new `MealInput`/`mealApi` boundary).

5. Commit (only if step 2 changed files; otherwise nothing to commit — this task is a gate):
   ```
   git add -A frontend/src
   git commit -m "test(fuel): green both modes + build after meal data-layer (mezo-arb)"
   ```

---

## Docs touch (required before closing the bd issue)

Per the repo `docs/` policy (swapping mock hooks to a real backend → update the feature doc): after fd1–fd7, update `docs/features/fuel.md` §4 (data hooks) + §5 (integration) to record that `useFuelDay` is now composed dual-mode over `mealApi`/`/api/fuel/day`, that `useMealActions` is the new write path invalidating `['fuelDay']`+`['recipes']`+`['pantry']`, and that `FuelMeal` carries structured `mealItems`. Then run `node scripts/lint-docs.mjs` to clear the staleness flag. (If a `docs/features/fuel.md` does not yet exist, the component-wiring section creates it; this data-layer section only needs to flag the boundary change — coordinate so the doc is touched once.)

---

## Phase 7 — FE UI

# Frontend UI — Meal Logging (Mai) Slice

Driving bd: `mezo-arb`. Spec: `docs/superpowers/specs/2026-06-24-fuel-meal-logging-design.md`. Visual source of truth for the new sheet: `docs/design/meal-logging-sheet.html`.

These tasks ship the FE side of the meal-logging slice: the dual-mode `useFuelDay`/`useMealActions` hooks, the `mealApi` boundary, the recipe-logs hook, MSW handlers, the two NEW capture sheets (`LogMealSheet` + the 2-tab `MealPickerSheet`), and the wiring of the existing read surfaces (MacroHero, Mai meal list, RecipeLogsList, Today preview) + the two inert CTAs. All work is dual-mode (`VITE_USE_MOCK` true AND false green) + `pnpm build` green. The live-app meal score stays the **pending sparkle** (NULL breakdown) — reuse `RecipeFitBadge`.

**Conventions grounded in the shipped Recipes slice** (read these — they are the template):
- Dual-mode read hook: `src/data/recipeHooks.ts` `useRecipes()` (mock `initialData` + `staleTime: Infinity`; real `recipeApi.list`).
- Dual-mode write hook: `useRecipeActions()` (mock `setQueryData` mutators with the SAME contribution formula; real API + `invalidateQueries`).
- Boundary module: `src/lib/recipeApi.ts` (`toRequest`/`fromResponse` + the `recipeApi` object using `apiFetch`).
- Modal picker: `src/features/fuel/IngredientPickerSheet.tsx` (the `Sheet` render-prop + `.prow` picker rows + `MacroCells`).
- Capture page: `src/features/fuel/views/RecipeEditorView.tsx` (steppers, per-row `MacroCells` contribution, live total, sticky save, `contributionOf` = `round(macro * amount/per)`).
- MSW: `src/test/msw/handlers.ts` (recipe handlers at the tail; `recipeFixture`).
- Component test pattern: `src/features/fuel/AddPantryItemSheet.test.tsx` (ONE shared `QueryClient`, co-render the read hook with `renderHook`, assert a REAL cache effect + `onClose`).
- `vi.stubEnv('VITE_USE_MOCK', 'true')` in `beforeEach`, `vi.unstubAllEnvs()` in `afterEach` for mock-mode tests.

**Contribution formula (verbatim, mirror the recipe mapper + FE mock):** `factor = amount / (snapshot_per || 1)`; `contribution.{kcal,p,c,f} = Math.round(snapshot.{kcal,p,c,f} * factor)`; meal total = sum of item contributions; day consumed = sum of the day's meal macros.

> **DEPENDENCY NOTE:** the API contract (`api/feature/meal/meal.yml`, the `/api/recipe/{id}/logs` op, and the regenerated `frontend/src/lib/api.gen.ts`) is OWNED by the CONTROLLER section. These FE tasks CONSUME the generated `components['schemas']['*']` types. The plan controller orders the contract-merge + `pnpm generate:api` task BEFORE `feui1`. Until `api.gen.ts` carries `MealRequest`/`MealResponse`/`FuelDayResponse`/`RecipeLogListResponse`, the `mealApi` type imports will not resolve — that regen is a prerequisite of this whole section.


> **Canonical FE types/hooks are owned by the FE-data phase; consume them.** Use the FE-data names verbatim: `MealItemLine`/`refId` (single ref, NOT `recipeId?`/`pantryItemId?`), `FuelMeal.mealItems`, `MealInput{ slot; loggedAt?; title?; items: MealInputItem[] }` with `MealInputItem{ source; refId; amount; unit }`, and the hooks `useFuelDay`/`useMealActions`/`useRecipeLogs`. This phase's earlier duplicate data tasks (FE types, `mealApi`, MSW handlers, `fuelHooks`) were removed — they live in the FE-data phase.

---

### Task feui5: `MealPickerSheet` — 2-tab Receptek/Kamra modal picker

The picker that opens over `LogMealSheet`. Two tabs (Receptek / Kamra), a shared search, ＋ adds a `MealInput` item (recipe → 1 adag / pantry → per g). Mirrors `IngredientPickerSheet` (the `Sheet` render-prop + `.prow` rows + `MacroCells`).

**Files:**
- Create: `frontend/src/features/fuel/MealPickerSheet.tsx`

**Interfaces:**
- Consumes: `Sheet` (`@/components/ui/Sheet`); `Icon`, `Eyebrow`, `Display` (`@/components/ui`); `MacroCells` (`./components/MacroCells`); `useRecipes`, `usePantry` (`@/data/hooks`); `Recipe`, `Ingredient` (`@/data/types`).
- Produces:
  - `export interface MealPickedItem { source: 'recipe' | 'pantry'; refId: string; amount: number; unit: string }` — the canonical FE-data `MealInputItem` shape (single `refId`).
  - `export function MealPickerSheet(props: { onPick: (item: MealPickedItem) => void; onClose: () => void }): JSX.Element`
  - Adding a recipe emits `{ source: 'recipe', refId: r.id, amount: 1, unit: 'adag' }`; a pantry item emits `{ source: 'pantry', refId: ing.id, amount: ing.per || 100, unit: ing.unit || 'g' }`.

**Steps:**

1. Implement `frontend/src/features/fuel/MealPickerSheet.tsx`:
```tsx
// ============================================================
// Mezo · MealPickerSheet (2-tab Receptek/Kamra — nested modal)
// Opens OVER LogMealSheet to add a meal item. Tabs: Receptek (recipe rows: name +
// slot + per-serving macros) / Kamra (pantry rows: name + macros /100g). One
// search across the active tab; tapping ＋ emits a MealPickedItem (recipe → 1 adag,
// pantry → per g). Mirrors IngredientPickerSheet (.prow rows + MacroCells).
// docs/design/meal-logging-sheet.html (right phone · .ptabs + .prow).
// ============================================================
import { useState } from 'react'
import type { Ingredient, Recipe } from '@/data/types'
import { useRecipes, usePantry } from '@/data/hooks'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { MacroCells } from './components/MacroCells'

export interface MealPickedItem {
  source: 'recipe' | 'pantry'
  refId: string // recipeId (source 'recipe') or pantryItemId (source 'pantry') — canonical MealInputItem
  amount: number
  unit: string
}

type Tab = 'recipes' | 'pantry'

const round = (n: number) => Math.round(n)
function perServing(r: Recipe) {
  const s = Math.max(1, r.servings)
  return { kcal: round(r.macros.kcal / s), p: round(r.macros.p / s), c: round(r.macros.c / s), f: round(r.macros.f / s) }
}

function RecipeRow({ r, onPick }: { r: Recipe; onPick: () => void }) {
  return (
    <div className="card notch-4" style={{ padding: '11px 12px', borderLeft: '2px solid var(--brand-glow)' }}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{r.name}</span>
            {r.slot && <span className="chip brand" style={{ fontSize: 8, padding: '2px 6px' }}>{r.slot}</span>}
          </div>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {r.ingredients.length} hozzávaló · adag
          </span>
        </div>
        <button onClick={onPick} aria-label={r.name + ' hozzáadása'} className="notch-4"
          style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(20,184,166,0.14)', color: 'var(--brand-glow)' }}>
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div style={{ marginTop: 9 }}><MacroCells macros={perServing(r)} perLabel="/adag" /></div>
    </div>
  )
}

function PantryRow({ ing, onPick }: { ing: Ingredient; onPick: () => void }) {
  const { categoryMeta } = usePantry()
  const catColor = categoryMeta[ing.category]?.color ?? 'var(--text-secondary)'
  return (
    <div className="card notch-4" style={{ padding: '11px 12px', borderLeft: '2px solid ' + catColor }}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{ing.name}</span>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {ing.brand}{ing.nova ? ` · NOVA ${ing.nova}` : ''}
          </span>
        </div>
        <button onClick={onPick} aria-label={ing.name + ' hozzáadása'} className="notch-4"
          style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(20,184,166,0.14)', color: 'var(--brand-glow)' }}>
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div style={{ marginTop: 9 }}><MacroCells macros={ing.macros} perLabel="/100g" /></div>
    </div>
  )
}

export function MealPickerSheet({ onPick, onClose }: { onPick: (item: MealPickedItem) => void; onClose: () => void }) {
  const { recipes } = useRecipes()
  const { ingredients } = usePantry()
  const [tab, setTab] = useState<Tab>('recipes')
  const [query, setQuery] = useState('')

  const q = query.toLowerCase()
  const filteredRecipes = recipes.filter(r => !q || r.name.toLowerCase().includes(q))
  const filteredPantry = ingredients.filter(i => !q || i.name.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q))

  return (
    <Sheet onClose={onClose} className="sheet-nested" labelledBy="meal-pick-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="col">
              <Eyebrow brand>Hozzáadás az étkezéshez</Eyebrow>
              <div id="meal-pick-title" style={{ marginTop: 4 }}><Display size="md">Receptből / Kamrából</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="row gap-xs" style={{ marginBottom: 12 }}>
            <button onClick={() => setTab('recipes')} className={'chip flex-1' + (tab === 'recipes' ? ' brand' : '')}
              style={{ justifyContent: 'center', padding: '9px 0', fontSize: 11 }} aria-pressed={tab === 'recipes'}>Receptek</button>
            <button onClick={() => setTab('pantry')} className={'chip flex-1' + (tab === 'pantry' ? ' brand' : '')}
              style={{ justifyContent: 'center', padding: '9px 0', fontSize: 11 }} aria-pressed={tab === 'pantry'}>Kamra</button>
          </div>

          <div className="row gap-sm" style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <Icon name="search" size={12} color="var(--text-tertiary)" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Keress recept vagy alapanyag…" aria-label="Keresés"
              style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }} />
          </div>

          <div className="col gap-sm" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {tab === 'recipes'
              ? filteredRecipes.map(r => (
                  <RecipeRow key={r.id} r={r} onPick={() => onPick({ source: 'recipe', refId: r.id, amount: 1, unit: 'adag' })} />
                ))
              : filteredPantry.map(ing => (
                  <PantryRow key={ing.id} ing={ing} onPick={() => onPick({ source: 'pantry', refId: ing.id, amount: ing.per || 100, unit: ing.unit || 'g' })} />
                ))}
          </div>
          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
```

2. Typecheck — expect PASS:
```bash
cd frontend && pnpm exec tsc -b --noEmit
```

3. Commit:
```bash
git add frontend/src/features/fuel/MealPickerSheet.tsx
git commit -m "feat(fuel): MealPickerSheet 2-tab Receptek/Kamra picker (mezo-arb)"
```

---

### Task feui6: `LogMealSheet` — the capture sheet (slot + time + items + live total + daily-context + save)

The one genuinely new surface. Modal (`Sheet`): slot segmented + time row + per-item cards (name + source tag + amount stepper + per-item `MacroCells` + delete) + "Receptből / Kamrából hozzáad" → `MealPickerSheet` + live "Ez az étkezés" total + the daily-context bar + sticky "Logolás a mai naphoz" → `useMealActions.logMeal`. Opens pre-filled when given a recipe or pantry item. Visual source: `docs/design/meal-logging-sheet.html` (left phone). TDD.

**Files:**
- Create: `frontend/src/features/fuel/LogMealSheet.tsx`
- Test: `frontend/src/features/fuel/LogMealSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (`@/components/ui/Sheet`); `Icon`, `Eyebrow`, `Display` (`@/components/ui`); `MacroCells` (`./components/MacroCells`); `MealPickerSheet`, `MealPickedItem` (`./MealPickerSheet`); `useFuelDay`, `useMealActions`, `useRecipes`, `usePantry` (`@/data/hooks`); `MealInput`, `Recipe`, `Ingredient` (`@/data/types`).
- Produces:
  - `export type LogMealPrefill = { source: 'recipe'; recipeId: string } | { source: 'pantry'; pantryItemId: string } | null`
  - `export function LogMealSheet(props: { prefill?: LogMealPrefill; onClose: () => void }): JSX.Element`
  - On save: builds a `MealInput` (slot + loggedAt + items) and calls `logMeal(input)` then `onClose()`.
  - Draft line shape (internal): `{ key: string; source; refId; amount; unit }` (single `refId`, canonical); contribution computed with `round(macro * amount/per)` against the resolved recipe (÷ servings) or pantry item.

**Steps:**

1. Write the failing test `frontend/src/features/fuel/LogMealSheet.test.tsx`. ONE shared `QueryClient`; co-render `useFuelDay` to assert the meal landed:
```tsx
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LogMealSheet } from './LogMealSheet'
import { useFuelDay, useRecipes, usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

describe('LogMealSheet', () => {
  it('opens pre-filled from a recipe and logs it to the day (meal appended)', async () => {
    const { qc, wrapper } = setup()
    const recipes = renderHook(() => useRecipes(), { wrapper })
    const recipe = recipes.result.current.recipes[0]
    const day = renderHook(() => useFuelDay(), { wrapper })
    const before = day.result.current.fuel.meals.length

    const onClose = vi.fn()
    render(
      <QueryClientProvider client={qc}>
        <LogMealSheet prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={onClose} />
      </QueryClientProvider>,
    )

    // the recipe name shows as a pre-filled item line
    expect(screen.getByText(recipe.name)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /logolás a mai naphoz/i }))

    await waitFor(() => {
      expect(day.result.current.fuel.meals.length).toBe(before + 1)
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('opens pre-filled from a pantry item and logs it', async () => {
    const { qc, wrapper } = setup()
    const pantry = renderHook(() => usePantry(), { wrapper })
    const ing = pantry.result.current.ingredients[0]
    const day = renderHook(() => useFuelDay(), { wrapper })
    const before = day.result.current.fuel.meals.length

    render(
      <QueryClientProvider client={qc}>
        <LogMealSheet prefill={{ source: 'pantry', pantryItemId: ing.id }} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.getByText(ing.name)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /logolás a mai naphoz/i }))
    await waitFor(() => expect(day.result.current.fuel.meals.length).toBe(before + 1))
  })

  it('changing the slot segmented control updates the logged meal slot', async () => {
    const { qc, wrapper } = setup()
    const pantry = renderHook(() => usePantry(), { wrapper })
    const ing = pantry.result.current.ingredients[0]
    const day = renderHook(() => useFuelDay(), { wrapper })

    render(
      <QueryClientProvider client={qc}>
        <LogMealSheet prefill={{ source: 'pantry', pantryItemId: ing.id }} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Vacsora' }))
    fireEvent.click(screen.getByRole('button', { name: /logolás a mai naphoz/i }))
    await waitFor(() => {
      expect(day.result.current.fuel.meals.some(m => m.slot === 'dinner')).toBe(true)
    })
  })

  it('disables save when there are no items', () => {
    const { qc } = setup()
    render(
      <QueryClientProvider client={qc}>
        <LogMealSheet onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.getByRole('button', { name: /logolás a mai naphoz/i })).toBeDisabled()
  })
})
```

2. Run it — expect FAILURE (module `./LogMealSheet` does not exist):
```bash
cd frontend && pnpm exec vitest run src/features/fuel/LogMealSheet.test.tsx
```

3. Implement `frontend/src/features/fuel/LogMealSheet.tsx`:
```tsx
// ============================================================
// Mezo · LogMealSheet (the meal-log capture sheet — mezo-arb)
// The one genuinely new surface. Modal: slot segmented + time row, per-item cards
// (name + source tag + amount stepper + per-item MacroCells contribution + delete),
// "Receptből / Kamrából hozzáad" → MealPickerSheet, a live "Ez az étkezés" total +
// the daily-context bar (mai eddig + ez vs cél), sticky "Logolás a mai naphoz" →
// useMealActions.logMeal. Opens pre-filled from a recipe or a pantry item.
// Contribution = round(macro * amount/per) — the SAME rule as the backend mapper.
// docs/design/meal-logging-sheet.html (left phone).
// ============================================================
import { useState } from 'react'
import type { Ingredient, MealInput, Recipe } from '@/data/types'
import { useFuelDay, useMealActions, useRecipes, usePantry } from '@/data/hooks'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { MacroCells } from './components/MacroCells'
import { MealPickerSheet, type MealPickedItem } from './MealPickerSheet'

export type LogMealPrefill =
  | { source: 'recipe'; recipeId: string }
  | { source: 'pantry'; pantryItemId: string }
  | null

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const SLOTS: { id: Slot; label: string }[] = [
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
]

interface DraftLine { key: string; source: 'recipe' | 'pantry'; refId: string; amount: number; unit: string }

const round = (n: number) => Math.round(n)
const zero = { kcal: 0, p: 0, c: 0, f: 0 }

function lineFromPicked(p: MealPickedItem): DraftLine {
  return { key: crypto.randomUUID(), source: p.source, refId: p.refId, amount: p.amount, unit: p.unit }
}

function defaultSlot(): Slot {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
function nowLabel(): string {
  return 'ma · ' + new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

export function LogMealSheet({ prefill, onClose }: { prefill?: LogMealPrefill; onClose: () => void }) {
  const { recipes } = useRecipes()
  const { ingredients } = usePantry()
  const { fuel } = useFuelDay()
  const { logMeal } = useMealActions()

  const [slot, setSlot] = useState<Slot>(defaultSlot)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (!prefill) return []
    if (prefill.source === 'recipe') return [{ key: 'pf', source: 'recipe', refId: prefill.recipeId, amount: 1, unit: 'adag' }]
    const ing = ingredients.find(i => i.id === prefill.pantryItemId)
    return [{ key: 'pf', source: 'pantry', refId: prefill.pantryItemId, amount: ing?.per || 100, unit: ing?.unit || 'g' }]
  })

  const resolveRecipe = (id?: string): Recipe | undefined => recipes.find(r => r.id === id)
  const resolveIng = (id?: string): Ingredient | undefined => ingredients.find(i => i.id === id)

  function lineMeta(l: DraftLine) {
    if (l.source === 'recipe') {
      const r = resolveRecipe(l.refId)
      const s = Math.max(1, r?.servings ?? 1)
      const per = 1
      const perBasis = { kcal: round((r?.macros.kcal ?? 0) / s), p: round((r?.macros.p ?? 0) / s), c: round((r?.macros.c ?? 0) / s), f: round((r?.macros.f ?? 0) / s) }
      const factor = l.amount / per
      return {
        name: r?.name ?? 'Recept', tag: 'recept' as const, step: 1, min: 1,
        contribution: { kcal: round(perBasis.kcal * factor), p: round(perBasis.p * factor), c: round(perBasis.c * factor), f: round(perBasis.f * factor) },
      }
    }
    const ing = resolveIng(l.refId)
    const per = ing?.per || 1
    const factor = l.amount / per
    return {
      name: ing?.name ?? 'Tétel', tag: 'kamra' as const, step: 10, min: 1,
      contribution: { kcal: round((ing?.macros.kcal ?? 0) * factor), p: round((ing?.macros.p ?? 0) * factor), c: round((ing?.macros.c ?? 0) * factor), f: round((ing?.macros.f ?? 0) * factor) },
    }
  }

  const resolved = lines.map(l => ({ l, meta: lineMeta(l) }))
  const total = resolved.reduce((a, { meta }) => ({ kcal: a.kcal + meta.contribution.kcal, p: a.p + meta.contribution.p, c: a.c + meta.contribution.c, f: a.f + meta.contribution.f }), { ...zero })

  const after = fuel.consumed.kcal + total.kcal
  const nowPct = Math.min(100, (fuel.consumed.kcal / fuel.targets.kcal) * 100)
  const addPct = Math.min(100 - nowPct, (total.kcal / fuel.targets.kcal) * 100)

  const addPicked = (p: MealPickedItem) => { setLines(prev => [...prev, lineFromPicked(p)]); setPickerOpen(false) }
  const bump = (key: string, delta: number) => setLines(prev => prev.map(p => p.key === key ? { ...p, amount: Math.max(1, p.amount + delta) } : p))
  const removeLine = (key: string) => setLines(prev => prev.filter(p => p.key !== key))

  const canSave = lines.length > 0
  const save = (close: () => void) => {
    if (!canSave) return
    const input: MealInput = {
      slot,
      loggedAt: new Date().toISOString(),
      title: null,
      items: lines.map(l => ({ source: l.source, refId: l.refId, amount: l.amount, unit: l.unit })),
    }
    logMeal(input)
    close()
    onClose()
  }

  return (
    <>
      <Sheet onClose={onClose} labelledBy="log-meal-title">
        {(close) => (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div className="col">
                <Eyebrow brand>Logolás · mai nap</Eyebrow>
                <div id="log-meal-title" style={{ marginTop: 4 }}><Display size="md">Mit ettél?</Display></div>
              </div>
              <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
                <Icon name="x" size={12} />
              </button>
            </div>

            {/* Mikor — slot segmented */}
            <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>MIKOR</span>
            <div className="row gap-xs" style={{ margin: '7px 0 8px', padding: 5, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
              {SLOTS.map(s => (
                <button key={s.id} onClick={() => setSlot(s.id)} aria-label={s.label} aria-pressed={slot === s.id}
                  className={'chip flex-1' + (slot === s.id ? ' brand' : '')}
                  style={{ justifyContent: 'center', padding: '8px 0', fontSize: 11, textTransform: 'uppercase' }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', marginBottom: 6, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
              <span className="label-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{nowLabel()}</span>
              <Icon name="clock" size={14} color="var(--text-tertiary)" />
            </div>

            {/* Tételek */}
            <div className="row" style={{ alignItems: 'center', gap: 9, margin: '13px 2px 9px' }}>
              <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>TÉTELEK</span>
              <span className="label-mono" style={{ fontSize: 9.5, color: 'var(--brand-glow)' }}>{lines.length}</span>
              <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
            </div>

            {lines.length === 0 && (
              <div className="card notch-4" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed' }}>
                <span className="text-tertiary" style={{ fontSize: 11 }}>Még nincs tétel. Adj hozzá Receptből vagy a Kamrából.</span>
              </div>
            )}

            <div className="col gap-sm">
              {resolved.map(({ l, meta }) => (
                <div key={l.key} className="card notch-4" style={{ padding: '11px 12px', borderLeft: '2px solid ' + (meta.tag === 'recept' ? 'var(--brand-glow)' : 'var(--cat-dairy)') }}>
                  <div className="row" style={{ alignItems: 'center', gap: 9 }}>
                    <div className="row gap-xs flex-1" style={{ minWidth: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{meta.name}</span>
                      <span className="label-mono" style={{ fontSize: 7.5, fontWeight: 700, padding: '2px 6px', textTransform: 'uppercase',
                        background: meta.tag === 'recept' ? 'rgba(20,184,166,0.16)' : 'rgba(251,191,36,0.16)',
                        color: meta.tag === 'recept' ? 'var(--brand-glow)' : 'var(--cat-dairy)' }}>{meta.tag}</span>
                    </div>
                    <div className="row" style={{ alignItems: 'center', background: 'var(--surface-2)', display: 'inline-flex' }}>
                      <button onClick={() => bump(l.key, -meta.step)} aria-label={`${meta.name} csökkentés`} style={{ width: 25, height: 28, display: 'grid', placeItems: 'center', color: 'var(--brand-glow)', fontSize: 14 }}>−</button>
                      <span style={{ minWidth: 30, textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{l.amount}</span>
                      <button onClick={() => bump(l.key, meta.step)} aria-label={`${meta.name} növelés`} style={{ width: 25, height: 28, display: 'grid', placeItems: 'center', color: 'var(--brand-glow)', fontSize: 14 }}>+</button>
                      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', padding: '0 6px 0 1px' }}>{l.unit}</span>
                    </div>
                    <button onClick={() => removeLine(l.key)} aria-label={`${meta.name} eltávolítás`} style={{ padding: 3, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                  <div style={{ marginTop: 9 }}>
                    <MacroCells macros={meta.contribution} perLabel={`${l.amount} ${l.unit}`} />
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setPickerOpen(true)} className="notch-4"
              style={{ width: '100%', padding: 11, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--brand-glow)', background: 'rgba(20,184,166,0.08)', border: '1px dashed var(--border-brand)' }}>
              <Icon name="plus" size={14} /> Receptből / Kamrából hozzáad
            </button>

            {/* Live total + daily context */}
            <div className="notch-4" style={{ padding: '11px 12px', marginTop: 12, background: 'rgba(20,184,166,0.05)', border: '1px solid var(--border-brand)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
                <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--brand-glow)' }}>EZ AZ ÉTKEZÉS</span>
                <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-tertiary)' }}>{lines.length} tétel</span>
              </div>
              <MacroCells macros={total} size="md" />
              <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <div className="row" style={{ justifyContent: 'space-between', fontFamily: 'var(--ff-mono)', fontSize: 8.5, color: 'var(--text-tertiary)', marginBottom: 5 }}>
                  <span>Mai nap eddig <b style={{ color: 'var(--text-secondary)' }}>{fuel.consumed.kcal}</b> <span style={{ color: 'var(--brand-glow)' }}>+{total.kcal}</span> = <b style={{ color: 'var(--text-secondary)' }}>{after}</b></span>
                  <span>cél <b style={{ color: 'var(--text-secondary)' }}>{fuel.targets.kcal}</b> kcal</span>
                </div>
                <div style={{ height: 5, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: nowPct + '%', background: 'var(--text-tertiary)' }} />
                  <div style={{ position: 'absolute', left: nowPct + '%', top: 0, bottom: 0, width: addPct + '%', background: 'var(--brand-glow)' }} />
                </div>
              </div>
            </div>

            <div className="row gap-sm" style={{ marginTop: 14 }}>
              <button className="cta-ghost notch-4" onClick={close} style={{ flex: 1 }}>Mégse</button>
              <button className="cta-primary notch-4" disabled={!canSave} onClick={() => save(close)} style={{ flex: 1.8 }}>
                <Icon name="check" size={15} /> Logolás a mai naphoz
              </button>
            </div>
            <div style={{ height: 12 }} />
          </>
        )}
      </Sheet>

      {pickerOpen && <MealPickerSheet onPick={addPicked} onClose={() => setPickerOpen(false)} />}
    </>
  )
}
```

> **NOTE:** if `Icon` has no `clock` glyph, fall back to `name="search"`→ no; instead use an existing time-ish glyph (check `@/components/ui/Icon` for the valid names; the recipe slice uses `bookmark`/`settings`/`check`/`plus`/`x`/`search`/`sparkle`/`drop`/`tool`). If `clock` is absent, drop the time-row icon (render the label only). Verify before committing.

4. Run it — expect PASS:
```bash
cd frontend && pnpm exec vitest run src/features/fuel/LogMealSheet.test.tsx
```

5. Commit:
```bash
git add frontend/src/features/fuel/LogMealSheet.tsx frontend/src/features/fuel/LogMealSheet.test.tsx
git commit -m "feat(fuel): LogMealSheet capture sheet (slot+time+items+live total+daily ctx) (mezo-arb)"
```

---

### Task feui7: Wire the Mai surface — `FuelMaiView` meal list (real meals + ＋ Log entry) + `RecipeLogsList`

Wire the read surfaces: `FuelMaiView` already feeds `MacroHero` from `fuel.targets`/`fuel.consumed` (now real via the composed hook — no change needed there), but the Mai meal list still uses `getScoredMeal` title-join. Add a Mai **＋ Log** entry opening `LogMealSheet` (empty) and render the real `fuel.meals`. Also adjust `RecipeLogsList` to render the v1 pending (score-less) logs without crashing.

**Files:**
- Modify: `frontend/src/features/fuel/views/FuelMaiView.tsx`
- Modify: `frontend/src/features/fuel/components/RecipeLogsList.tsx`
- Test: `frontend/src/features/fuel/views/FuelMaiView.test.tsx` (extend existing)

**Interfaces:**
- Consumes: `useFuelDay` (now composed; `const { fuel } = useFuelDay()` unchanged), `LogMealSheet` (`@/features/fuel/LogMealSheet`); `RecipeLog` (`@/data/types`).
- Produces: a Mai **＋ Log** button (`aria-label="Logolás"` or visible text "＋ Log") that opens `LogMealSheet` with no prefill.

**Steps:**

1. Read the existing `FuelMaiView.test.tsx` to learn its render harness (router + QueryClient wrapper) before extending:
```bash
cd frontend && sed -n '1,60p' src/features/fuel/views/FuelMaiView.test.tsx
```

2. Add a failing test case to `frontend/src/features/fuel/views/FuelMaiView.test.tsx` (inside the existing `describe`, reusing its wrapper helper — adapt the render call to match what step 1 reveals):
```tsx
  it('opens the LogMealSheet from the ＋ Log entry', async () => {
    renderMaiView() // reuse the file's existing render helper
    fireEvent.click(screen.getByRole('button', { name: /log/i }))
    expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
  })
```
Ensure `fireEvent`, `screen` are imported in that file (they are for existing cases).

3. Run it — expect FAILURE (no ＋ Log button yet):
```bash
cd frontend && pnpm exec vitest run src/features/fuel/views/FuelMaiView.test.tsx
```

4. Implement in `frontend/src/features/fuel/views/FuelMaiView.tsx`:
   - Add the import: `import { LogMealSheet } from '@/features/fuel/LogMealSheet'`.
   - Add state: `const [logOpen, setLogOpen] = useState(false)`.
   - Replace the header `Chip` (the search chip near line 37-39) with a ＋ Log entry, or add a ＋ Log button next to the "Mai timeline" header row. Simplest: change the header `Chip` block to:
```tsx
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="chip brand"
          aria-label="Logolás"
          style={{ fontSize: 10, padding: '6px 10px' }}
        >
          <Icon name="plus" size={12} /> Log
        </button>
```
   - At the end of the returned fragment (next to `{scoreMeal && ...}`), mount the sheet:
```tsx
      {logOpen && <LogMealSheet onClose={() => setLogOpen(false)} />}
```
   - The `MacroHero` (line 73) already reads `fuel.targets`/`fuel.consumed` — now real via the composed hook. No change to that line.
   - The `FuelTimeline` (line 118) keeps `getScoredMeal` (mock plan + score join is out of scope per spec §2; the meal list real-data wiring is satisfied by the real `fuel.meals` flowing through `MacroHero`/consumed). Leave `FuelTimeline` untouched.

5. Adjust `frontend/src/features/fuel/components/RecipeLogsList.tsx` so v1 score-less logs render the pending sparkle instead of `(l.score * 100)`:
   - Import the badge: `import { RecipeFitBadge } from '@/features/fuel/components/RecipeFitBadge'`.
   - Replace the score `<span>` (the `(l.score * 100).toFixed(0)` block, lines 28-39) with a pending-aware render: when `l.score` is falsy (0/undefined → pending), show a small sparkle; otherwise the number. Minimal change:
```tsx
            <div className="col" style={{ alignItems: 'flex-end' }}>
              {l.score ? (
                <>
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, color: 'var(--brand-glow)', lineHeight: 1, fontWeight: 600 }}>
                    {(l.score * 100).toFixed(0)}
                  </span>
                  <span className="label-mono" style={{ fontSize: 9, color: l.delta > 0 ? 'var(--brand-glow)' : l.delta < 0 ? 'var(--warning)' : 'var(--text-tertiary)', marginTop: 2 }}>
                    {l.delta > 0 ? '+' : ''}{(l.delta * 100).toFixed(0)} vs baseline
                  </span>
                </>
              ) : (
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="sparkle" size={12} /> pending
                </span>
              )}
            </div>
```
   - Add `import { Icon } from '@/components/ui/Icon'` at the top. (Drop the unused `RecipeFitBadge` import if you go with the inline sparkle — keep imports clean.)

6. Run the affected tests — expect PASS:
```bash
cd frontend && pnpm exec vitest run src/features/fuel/views/FuelMaiView.test.tsx src/features/fuel/components/RecipeLogsList.test.tsx 2>/dev/null || pnpm exec vitest run src/features/fuel/views/FuelMaiView.test.tsx
```

7. Commit:
```bash
git add frontend/src/features/fuel/views/FuelMaiView.tsx frontend/src/features/fuel/components/RecipeLogsList.tsx frontend/src/features/fuel/views/FuelMaiView.test.tsx
git commit -m "feat(fuel): wire Mai ＋Log entry + real meals + pending-aware RecipeLogsList (mezo-arb)"
```

---

### Task feui8: Wire the two inert CTAs — `RecipeDetailView` "+ Mai étkezéshez" + `KamraItemDetailView` "+ Logolás"

Un-defer the two CTAs the Pantry/Recipes slices pointed here. Each becomes LIVE: opens `LogMealSheet` pre-filled with the source. Also wire `RecipeDetailView`'s `RecipeLogsList` to real `useRecipeLogs`. TDD on both CTAs.

**Files:**
- Modify: `frontend/src/features/fuel/views/RecipeDetailView.tsx`
- Modify: `frontend/src/features/fuel/views/KamraItemDetailView.tsx`
- Test: `frontend/src/features/fuel/views/RecipeDetailView.test.tsx` (extend)
- Test: `frontend/src/features/fuel/views/KamraItemDetailView.test.tsx` (extend)

**Interfaces:**
- Consumes: `LogMealSheet`, `LogMealPrefill` (`@/features/fuel/LogMealSheet`); `useRecipeLogs` (`@/data/hooks`); existing `RecipeLogsList` (`@/features/fuel/components/RecipeLogsList`).
- Produces: both CTAs become enabled buttons that mount `LogMealSheet` with `prefill={{ source: 'recipe', recipeId: recipe.id }}` / `prefill={{ source: 'pantry', pantryItemId: backendId }}`.

**Steps:**

1. Inspect both test files' render harnesses (they deep-link the detail route):
```bash
cd frontend && sed -n '1,50p' src/features/fuel/views/RecipeDetailView.test.tsx; echo '====='; sed -n '1,50p' src/features/fuel/views/KamraItemDetailView.test.tsx
```

2. Add a failing test to `RecipeDetailView.test.tsx` (reuse the file's render helper that mounts the recipe route in mock mode):
```tsx
  it('opens LogMealSheet pre-filled when "+ Mai étkezéshez" is tapped', async () => {
    renderRecipeDetail() // reuse the file's existing helper
    fireEvent.click(screen.getByRole('button', { name: /mai étkezéshez/i }))
    expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
  })
```

3. Add a failing test to `KamraItemDetailView.test.tsx`:
```tsx
  it('opens LogMealSheet pre-filled when "+ Logolás" is tapped', async () => {
    renderKamraDetail() // reuse the file's existing helper
    fireEvent.click(screen.getByRole('button', { name: /logolás/i }))
    expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
  })
```

4. Run both — expect FAILURE (buttons still `disabled`):
```bash
cd frontend && pnpm exec vitest run src/features/fuel/views/RecipeDetailView.test.tsx src/features/fuel/views/KamraItemDetailView.test.tsx
```

5. Implement in `frontend/src/features/fuel/views/RecipeDetailView.tsx`:
   - Imports: `import { useState } from 'react'` is already present; add `import { LogMealSheet } from '@/features/fuel/LogMealSheet'` and `import { useRecipeLogs } from '@/data/hooks'` (extend the existing `@/data/hooks` import if simpler).
   - State: `const [logOpen, setLogOpen] = useState(false)`.
   - Replace the inert CTA (line 199-201):
```tsx
      <button className="cta-primary notch-4" onClick={() => setLogOpen(true)} style={{ marginBottom: 9 }}>
        <Icon name="plus" size={14} /> Mai étkezéshez
      </button>
```
   - Wrap the component's return in a fragment and mount the sheet at the end (the view currently returns a single `<div>`; change `return ( <div ...> ... </div> )` to `return ( <> <div ...> ... </div> {logOpen && <LogMealSheet prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={() => setLogOpen(false)} />} </> )`).
   - (Optional but in-scope) feed real logs: `const { logs } = useRecipeLogs(recipe.id)` and, IF the view renders `RecipeLogsList`, pass `logs={logs}`. If `RecipeDetailView` does NOT currently render `RecipeLogsList` (the "Mezo-fit · hamarosan" zone is the placeholder), leave the logs list out — the real `useRecipeLogs` wiring then lives only where `RecipeLogsList` is actually mounted. Verify by grepping `RecipeLogsList` usage:
```bash
cd frontend && grep -rn 'RecipeLogsList' src/features --include='*.tsx' | grep -v test
```
   Wire `useRecipeLogs` → `RecipeLogsList logs={logs}` at whatever call site that grep reveals (likely `RecipeDetailView`); if none renders it, note that in the commit body and skip the logs wiring (the hook + MSW handler still ship for the next consumer).

6. Implement in `frontend/src/features/fuel/views/KamraItemDetailView.tsx`:
   - Add `import { LogMealSheet } from '@/features/fuel/LogMealSheet'`.
   - State: `const [logOpen, setLogOpen] = useState(false)` (the file already imports `useState`).
   - Replace the inert CTA (line 205-207):
```tsx
          <button className="cta-primary notch-4" onClick={() => setLogOpen(true)}>
            <Icon name="plus" size={14} /> Logolás · mai étkezésbe
          </button>
```
   - Mount the sheet inside the existing top-level fragment (the view already returns `<>...</>` with `AddPantryItemSheet` at the end). Add after `AddPantryItemSheet`:
```tsx
      {logOpen && <LogMealSheet prefill={{ source: 'pantry', pantryItemId: backendId }} onClose={() => setLogOpen(false)} />}
```

7. Run both detail tests — expect PASS:
```bash
cd frontend && pnpm exec vitest run src/features/fuel/views/RecipeDetailView.test.tsx src/features/fuel/views/KamraItemDetailView.test.tsx
```

8. Commit:
```bash
git add frontend/src/features/fuel/views/RecipeDetailView.tsx frontend/src/features/fuel/views/KamraItemDetailView.tsx frontend/src/features/fuel/views/RecipeDetailView.test.tsx frontend/src/features/fuel/views/KamraItemDetailView.test.tsx
git commit -m "feat(fuel): wire +Mai étkezéshez / +Logolás CTAs to LogMealSheet pre-filled (mezo-arb)"
```

---

### Task feui9: Wire the Today `FuelTimelinePreview` tap into logging + final dual-mode gate

The Today preview gains a tap that opens `LogMealSheet` (empty). Then run the full quality gate: both test modes + build green. This is the section's exit gate.

**Files:**
- Modify: `frontend/src/features/today/components/FuelTimelinePreview.tsx`
- Test: `frontend/src/features/today/components/FuelTimelinePreview.test.tsx` (extend)

**Interfaces:**
- Consumes: `LogMealSheet` (`@/features/fuel/LogMealSheet`); existing `useFuelPreview` (unchanged).
- Produces: the preview card becomes tappable (a button wrapper or a "＋ Log" affordance) opening `LogMealSheet` empty.

**Steps:**

1. Inspect the existing preview test harness:
```bash
cd frontend && sed -n '1,50p' src/features/today/components/FuelTimelinePreview.test.tsx
```

2. Add a failing test to `FuelTimelinePreview.test.tsx`:
```tsx
  it('opens the LogMealSheet when the log affordance is tapped', async () => {
    renderPreview() // reuse the file's existing helper / wrapper
    fireEvent.click(screen.getByRole('button', { name: /log/i }))
    expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
  })
```
Ensure `fireEvent`/`screen` are imported.

3. Run it — expect FAILURE:
```bash
cd frontend && pnpm exec vitest run src/features/today/components/FuelTimelinePreview.test.tsx
```

4. Implement in `frontend/src/features/today/components/FuelTimelinePreview.tsx`:
   - Add `import { useState } from 'react'` and `import { LogMealSheet } from '@/features/fuel/LogMealSheet'`.
   - State: `const [logOpen, setLogOpen] = useState(false)`.
   - In the header row (the `row` with the two `Eyebrow`s near line 13-16), replace the brand `Eyebrow` "Fuel → Terv" with a ＋ Log button (keep the left eyebrow):
```tsx
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>Mai fuel · timeline</Eyebrow>
          <button type="button" onClick={() => setLogOpen(true)} className="chip brand" aria-label="Logolás" style={{ fontSize: 9, padding: '4px 8px' }}>
            <Icon name="plus" size={11} /> Log
          </button>
        </div>
```
   - Mount the sheet at the end of the returned tree (inside the outermost `<div>`, or wrap in a fragment): `{logOpen && <LogMealSheet onClose={() => setLogOpen(false)} />}`.

5. Run the preview test — expect PASS:
```bash
cd frontend && pnpm exec vitest run src/features/today/components/FuelTimelinePreview.test.tsx
```

6. Final dual-mode quality gate — BOTH modes + build must be green:
```bash
cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```
Expect all PASS. Fix any fallout (most likely: a parity-sensitive snapshot or an `Icon` glyph name) before committing.

7. Commit:
```bash
git add frontend/src/features/today/components/FuelTimelinePreview.tsx frontend/src/features/today/components/FuelTimelinePreview.test.tsx
git commit -m "feat(today): tap FuelTimelinePreview to open LogMealSheet; dual-mode gate green (mezo-arb)"
```

---

### Task feui10: Update the living feature doc — `docs/features/fuel.md` (meal-logging section)

Per the MANDATORY docs policy: the meal-logging slice changes what the Fuel feature doc describes (new capture sheet, new hooks, wired CTAs, the `useFuelDay`/`useMealActions`/`useRecipeLogs` data seams). Update the Fuel feature doc in the SAME change set and clear its staleness flag.

**Files:**
- Modify: `frontend/`/`docs/features/fuel.md` (the existing Fuel feature doc; if the doc is `_platform-*` or differently named, update the one whose `key_files` cover the Fuel views/hooks — find it first).

**Interfaces:**
- Consumes: the `knowledge-base` skill conventions (frontmatter + 10-section template + `file:line` pointers).
- Produces: an up-to-date Fuel feature doc covering the meal-logging surfaces + a clean lint.

**Steps:**

1. Find the Fuel feature doc and confirm its name/key_files:
```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && ls docs/features | grep -i fuel; grep -rl 'fuel' docs/features 2>/dev/null | head
```

2. Update the doc (overwrite-in-place, no changelog) — touch the sections the slice changed:
   - **§4 (data/hooks):** `useFuelDay(date?)` is now dual-mode composed; new `useMealActions()` (`logMeal/updateMeal/deleteMeal`) + `useRecipeLogs(recipeId)`; query keys `['fuelDay', date]`/`['recipeLogs', id]`; boundary `src/lib/mealApi.ts`.
   - **§5 (integrations):** `/api/fuel/day/{date}`, `/api/meal[/{id}]`, `/api/recipe/{id}/logs`; meal score is **pending** (NULL breakdown) → `RecipeFitBadge` sparkle.
   - **§ file map / components:** new `LogMealSheet.tsx`, `MealPickerSheet.tsx`; wired `FuelMaiView` ＋Log, `RecipeDetailView`/`KamraItemDetailView` CTAs, `FuelTimelinePreview` tap, `RecipeLogsList` pending-aware.
   - Point with `file:line`, do not paste code.

3. Lint docs to clear the staleness flag — expect no errors for the Fuel doc:
```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && node scripts/lint-docs.mjs
```

4. Commit:
```bash
git add docs/features/fuel.md
git commit -m "docs(fuel): document meal-logging slice — LogMealSheet, hooks, wired CTAs (mezo-arb)"
```

---

## Section exit criteria

- `frontend/src/lib/mealApi.ts` + `frontend/src/data/fuelHooks.ts` ship the dual-mode `useFuelDay`/`useMealActions`/`useRecipeLogs` over the generated contract types; re-exported from `@/data/hooks`.
- `LogMealSheet` + `MealPickerSheet` built to the approved mockup; the two inert CTAs (`RecipeDetailView` / `KamraItemDetailView`) + the Today preview + a Mai ＋Log entry all open `LogMealSheet` (pre-filled where a source exists).
- MacroHero reads real targets-vs-consumed; meal score shows the pending sparkle (NULL breakdown).
- Component tests (RTL) for `LogMealSheet` + both wired CTAs; `pnpm test` AND `VITE_USE_MOCK=true pnpm test` AND `pnpm build` all green.
- Fuel feature doc updated + `node scripts/lint-docs.mjs` clean.
