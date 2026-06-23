# Fuel Recipes (Receptek) Slice — Design Spec

**Date:** 2026-06-23
**Driving bd:** `mezo-lns`
**Mirrors:** Pantry slice (`mezo-9xu` / spec `2026-06-22-fuel-pantry-design.md`)
**Status:** approved design → ready for implementation plan

---

## 1. Goal & Scope

Back the existing **mock** Recipes (Receptek) Fuel sub-view with a real Spring Boot + Postgres backend and dual-mode TanStack-Query hooks, **without changing the public `useRecipes()` shape**, and ship the approved **editorial UI redesign** in the same slice. Recipe ingredients reference `pantry_item` rows.

**In scope (v1):**
- `recipe` + `recipe_ingredient` tables (owned, soft-deleted); ingredients reference `pantry_item`.
- Real CRUD: list / get-by-id / create / update / delete over `/api/recipe`.
- `RecipeDetailView` (edit / star / delete **live**), `RecipeEditorView` (create = edit), `IngredientPickerSheet` wired to the real create/update.
- Dual-mode `useRecipes()` + new `useRecipeActions()` (mock cache mutators / real API + invalidate).
- The editorial UI redesign (§3).

**Out of scope — deferred (defaulted like Pantry's `usedInRecipes(0)`/`lastUsed('—')`):**
- **Mezo-fit scoring** — `fit_score`/`fits_for` columns exist but stay NULL; `mezoFit` returns a placeholder; the card/detail show the **P2 "pending" signal**. Real scoring = Phase-3 (Spring AI / pgvector / RAG).
- **Meal-logging** — `timesLogged`/`avgScore`/`lastLogged`/`recentLogs`/`templateBreakdown` return defaults; the "Mai étkezéshez" CTA stays inert. Needs a future `meal`/`meal_item` slice.
- **Cooking steps / instructions** — no such field exists in the mock; not added.
- **Recipe images** — the CSS "FOOD" placeholder stays; upload/AI-image is later.

---

## 2. Current State (mock)

- `useRecipes()` (`frontend/src/data/hooks.ts:154`) is a mock one-liner returning the static `recipes` array from `frontend/src/data/pantry.ts` (6 recipes `rec-1..rec-6`) plus pantry `ingredients/sources/categoryMeta`. No query, no dual-mode, no mutations — the only Fuel hook still mock-only.
- Mock `Recipe` type (`frontend/src/data/types.ts:108`): `id, name, slot, category('breakfast'|'lunch'|'dinner'|'snack'), createdDate, timesLogged, avgScore, lastLogged, servings, prepMins, cookMins, tags[], ingredients:[{refId, amount, unit, note?}], macros{kcal,p,c,f}, novaDominant, mezoFit{score, fitsFor[]}, starred, recentLogs?, templateBreakdown?`. `refId` is a `pantry_item` id; macros are **whole-recipe** totals.
- Inert: `NewRecipeSheet` Save = `onClose` only; `RecipeDetailSheet` 3 CTAs (add-to-meal / star / edit) have no handlers; "Avg fit 0.89" is a hardcoded literal; `mezoFit`/`templateBreakdown`/`recentLogs` are fixtures.

---

## 3. UI/UX Redesign (approved via mockup brainstorm)

All surfaces keep the **"Deep Current" chamfer** design system (clip-path notches, square dots, Antonio/Inter/JetBrains Mono). Mockups live in `docs/design/recipes-*` (exported from the brainstorm; see "Mockup provenance" below).

### 3.1 Library (`FuelRecipesView`)
- **Editorial cards** (image-forward): full-width image band with overlaid name (Antonio), slot tag + star top-left, **fit badge top-right**; below the band a 4-cell macro chip row (kcal/P/C/F) + a meta line (N hozzávaló · idő · NOVA).
- **Segmented filter** (the Kamra `typebar`): Mind / Reggeli / Ebéd / Vacsi / ★ — replaces the old chip row.
- Header sub shows real counts ("6 recept · 2 csillagos"). The fake "Avg fit 0.89" stat is **removed**.

### 3.2 Mezo-fit badge — pending vs scored (**P2 sparkle**)
- The fit number's slot is **stable** (top-right of the band / detail hero). 
- **Pending (v1):** a pulsing **✦ sparkle** + "Mezo" micro-label (`fit_score == null`) — signals "AI score coming."
- **Scored (Phase-3):** the same slot shows the Antonio number (e.g. `92`) + "fit" label. No layout shift between states.

### 3.3 Detail (`RecipeDetailView`) — **full PAGE** (route `/fuel/recipes/:id`)
Consistent with the Kamra detail being a page. Single scroll, **v1-honest** (ingredients are the star):
- Editorial hero (image band, name, slot tag, star, P2 fit badge), top bar with back + overflow.
- **Macro hero** with **/adag ↔ egész** segmented toggle (servings is real); 4 big cells kcal/Fehérje/Szénh./Zsír.
- Meta strip: adag / idő / NOVA / hozzávaló-szám.
- **Hozzávalók** list: per-ingredient row with category accent, source, amount, and **per-line contribution** (kcal + P/C/F) in macro cells.
- **"Mezo-fit · hamarosan" sparkle zone** (replaces the 3 empty tabs Score-bontás/Logok).
- Actions: **Szerkesztés / Csillag / Törlés live**; "＋ Mai étkezéshez" shown but disabled ("hamarosan").

### 3.4 Editor (`RecipeEditorView`) — **full PAGE**, create = edit (routes `/fuel/recipes/new`, `/fuel/recipes/:id/edit`)
- Full page (back-nav + sticky **Mentés** bar), not a drawer. Captures **all real fields**: név, slot (segmented), csillag toggle, **adag / elő- + főzési idő** (steppers), **címkék** (chips), hozzávalók.
- **Live macro total** card with the same **/adag ↔ egész** toggle (defaults to **/adag**), plus a footer line showing the other basis.
- **Picked-ingredient rows** use the **same macro-cell layout** as the picker, showing the line's **contribution at its current amount** (leading label = amount, e.g. "160 g"), live-updating via the per-row stepper + delete.
- "Kamrából hozzáad" opens the picker **modal**.

### 3.5 Ingredient picker (`IngredientPickerSheet`) — stays a **modal** (sheet over the editor page)
- Search + category filter chips. Each card: name + source badge + brand/NOVA subline + a **macro strip showing kcal + all macros / 100g** in clean cells (no cramped P/C/F row). ＋ button adds to the recipe.

### 3.6 Shared pieces to extract
- `MacroCells` (the kcal/P/C/F chamfer-cell strip; used by editor rows, picker rows, detail).
- `RecipeFitBadge` (pending sparkle / scored number states).
- `ServingToggle` (/adag ↔ egész) — used by detail + editor.

---

## 4. Data Model

Two tables, both **owned** (`created_by`, `is_deleted`, `created_at`) + UUID PK `gen_random_uuid()`, soft-delete via `@SQLDelete`/`@SQLRestriction`. **This is the codebase's first parent/child `@OneToMany` and first cross-domain reference.**

### `recipe`
| column | type | notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `created_by` | uuid NOT NULL | `fk_recipe_created_by_app_user_id → app_user(id) ON DELETE CASCADE` |
| `is_deleted` | boolean NOT NULL default false | |
| `created_at` | timestamptz NOT NULL default now() | |
| `updated_at` | timestamptz | `@UpdateTimestamp` |
| `name` | text NOT NULL | |
| `slot` | text | free label (e.g. "post-workout · ebéd") |
| `category` | text NOT NULL | `ck_recipe_category in ('breakfast','lunch','dinner','snack')` |
| `servings` | integer NOT NULL default 1 | `ck_recipe_servings: servings >= 1` |
| `prep_mins` | integer | `ck`: null or >= 0 |
| `cook_mins` | integer | `ck`: null or >= 0 |
| `tags` | jsonb | `List<String>` via `@JdbcTypeCode(SqlTypes.JSON)` |
| `starred` | boolean NOT NULL default false | |
| `nova_dominant` | smallint | `ck`: null or 1..4 — derived & persisted at write (dominant NOVA across lines) |
| `fit_score` | numeric | NULL in v1 (Phase-3) |
| `fits_for` | jsonb | NULL in v1 |

Indexes: `idx_recipe_created_by`, `idx_recipe_created_by_category`.
**Not stored** (derived → mapper defaults): `timesLogged`(0), `avgScore`(0), `lastLogged`('—'), `recentLogs`([]), `templateBreakdown`(null). **Macros are not a stored `recipe` column** — computed from the lines at read (§6.3).

### `recipe_ingredient` (child)
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `created_by` | uuid NOT NULL | `fk → app_user(id) ON DELETE CASCADE` (reuses OwnedEntity machinery) |
| `is_deleted` | boolean NOT NULL default false | |
| `created_at` | timestamptz NOT NULL default now() | |
| `recipe_id` | uuid NOT NULL | `fk_recipe_ingredient_recipe_id_recipe_id → recipe(id) ON DELETE CASCADE` |
| `pantry_item_id` | uuid NOT NULL | `fk_recipe_ingredient_pantry_item_id_pantry_item_id → pantry_item(id) ON DELETE RESTRICT` — **plain UUID column, NOT a JPA `@ManyToOne`** (so a soft-deleted pantry item can't hide a recipe line via `@SQLRestriction`) |
| `amount` | numeric NOT NULL | `ck`: amount > 0 — the line's quantity |
| `unit` | text NOT NULL | `g` / `ml` / `db` … |
| `note` | text | optional |
| `line_order` | integer NOT NULL | preserves ordering; server-assigned from request array index |
| `snapshot_name` | text NOT NULL | captured at compose time (renderable if the pantry item is later soft-deleted) |
| `snapshot_per` | numeric NOT NULL | the pantry item's `per` basis (e.g. 100) at compose time |
| `snapshot_basis_unit` | text NOT NULL | the pantry item's basis unit at compose time |
| `snapshot_kcal` | numeric NOT NULL | per-`snapshot_per` macros — the **stable basis** for contribution |
| `snapshot_protein_g` | numeric NOT NULL | |
| `snapshot_carbs_g` | numeric NOT NULL | |
| `snapshot_fat_g` | numeric NOT NULL | |

Indexes: `idx_recipe_ingredient_recipe_id`, `idx_recipe_ingredient_created_by`, `idx_recipe_ingredient_pantry_item_id`.

**Snapshot = per-basis, not pre-multiplied.** We store the pantry item's `per`/macros basis at compose time, and compute each line's contribution at **read** time from `amount` + the snapshot (§6.3). Rationale: (a) editing the amount recomputes correctly even if the pantry item later changes or is soft-deleted; (b) the recipe stays renderable and macro-stable independent of live pantry edits (decision **c** = FK + snapshot). The live `pantry_item_id` FK is kept for source/category resolution and future `usedInRecipes` counting; `ON DELETE RESTRICT` (not CASCADE) because pantry uses soft-delete, so a hard cascade would never fire and an accidental hard-delete must not silently shred recipes.

---

## 5. API Contract (`api/feature/recipe/recipe.yml`, tag `Recipe`)

Contract-first: edit the fragment, merge (`api/generate`), regen FE + backend types. Endpoints:

- `GET /api/recipe` → `200 RecipeListResponse { recipes: RecipeResponse[] }`
- `GET /api/recipe/{id}` → `200 RecipeResponse` / `404` (detail page deep-link / hard-reload refetch)
- `POST /api/recipe` (`RecipeRequest`) → `201`
- `PUT /api/recipe/{id}` (`RecipeRequest`) → `204` / `404`
- `DELETE /api/recipe/{id}` → `204` / `404`

**`RecipeRequest`**
```
name        string  (required, minLength 1)
slot        string  (nullable)
category    string  (required, enum breakfast|lunch|dinner|snack — pattern, not enum, to fail as 400 not 500)
servings    integer (minimum 1, default 1)
prepMins    integer (nullable, minimum 0)
cookMins    integer (nullable, minimum 0)
tags        string[] (default [])
starred     boolean (default false)
ingredients RecipeIngredientRequest[] (minItems 1)
```
**`RecipeIngredientRequest`**: `pantryItemId` (uuid, required), `amount` (number, exclusiveMinimum 0), `unit` (string, required), `note` (string, nullable). `lineOrder` is server-assigned from array index (not client-supplied).

**`RecipeResponse`** = request fields + `id`, `createdDate`, `novaDominant` (number), `macros {kcal,p,c,f}` (whole-recipe, computed), `mezoFit {score (nullable), fitsFor: string[]}`, `timesLogged` (0), `avgScore` (0), `lastLogged` ('—'), `ingredients: RecipeIngredientResponse[]`.
**`RecipeIngredientResponse`**: `pantryItemId`, `amount`, `unit`, `note`, `lineOrder`, `name` (snapshot), `contribution {kcal,p,c,f}` (this line at its amount). The FE maps `pantryItemId ↔ refId` and resolves source/category from its in-memory pantry list (falling back to `name` if the pantry item is gone).

> Contract gotchas inherited from Slice-A/Pantry: prefer `pattern` over `enum` on request strings (invalid enum → Jackson 500; pattern → 400); `NotBlank` has no OpenAPI form (`required` + `minLength:1` → Size → `VALIDATION_INVALID_VALUE`).

---

## 6. Backend Design (`feature/recipe/`, mirrors Pantry)

### 6.1 Files
`entity/RecipeEntity.java`, `entity/RecipeIngredientEntity.java`, `repository/RecipeRepository.java`, `service/RecipeService.java`, `mapper/RecipeMapper.java`, `controller/RecipeController.java` (implements generated `RecipeApi`). Follow `docs/references/` exactly (package layout, Spring patterns, error handling, Liquibase, testing, configuration, api-contract).

### 6.2 Entities
- `RecipeEntity extends OwnedEntity`: `@OneToMany(mappedBy="recipe", cascade=ALL, orphanRemoval=true) @OrderBy("lineOrder") List<RecipeIngredientEntity> lines`; `tags` + `fitsFor` jsonb via `@JdbcTypeCode(SqlTypes.JSON)`; `@UpdateTimestamp updatedAt`.
- `RecipeIngredientEntity extends OwnedEntity`: `@ManyToOne RecipeEntity recipe`; `pantryItemId` as a plain `UUID` column (no association); snapshot fields.

### 6.3 Service (`@Transactional`, owner-scoped)
- **create**: for each request line (in array order) resolve the `pantry_item` owner-scoped & not-deleted → 400 `VALIDATION_INVALID_VALUE` if missing/foreign/deleted; capture the snapshot (name, per, basis-unit, per-basis macros) from the live `PantryItem`; set `line_order = index`; set `created_by` on recipe **and** each line server-side; derive `nova_dominant`; save (cascade persists lines).
- **update** (`requireOwned` → 404 `RESOURCE_NOT_FOUND`): **full-replace of the aggregate** — clear the line collection and rebuild from the request (orphanRemoval deletes removed lines), re-resolving snapshots. The editor always sends the **complete** recipe (all fields + all lines), so this is **not** the lossy-input bug `mezo-dh6` flags for Pantry; document this explicitly.
- **delete** (`requireOwned` → 404): soft-delete the recipe **and explicitly bulk-soft-delete its `recipe_ingredient` children** — `@SQLDelete` does **not** cascade through `@OneToMany`.
- **read**: compute per-line contribution and whole-recipe macros (§ formula) + `mezoFit` placeholder + derived defaults in the mapper.

**Contribution formula (must match FE mock exactly, both modes green):**
`factor = amount / snapshot_per` (snapshot_per defaults to 1 for discrete units so `amount/1 = amount`). `contribution.{kcal,p,c,f} = round(snapshot.{…} * factor)`. `recipe.macros = Σ line contributions` (whole-recipe). Per-serving (UI) = whole / `servings`. The FE's existing `NewRecipeSheet` ad-hoc rule (`unit==='g' ? amount/per : 1`) is **replaced** by this uniform `amount/per` rule in both the real mapper and the mock hook.

### 6.4 Tests
Integration-first (`ApiIntegrationTest`, Testcontainers/fixed `mezo_test`): CRUD happy paths, ownership 404 (IDOR), nested-ingredient resolution + snapshot capture, macro rollup correctness, soft-delete cascades to children, `pantry_item` RESTRICT, full-replace update (lines added/removed/reordered). New `RecipeIngredientPopulator`/`RecipePopulator`; add `recipe` + `recipe_ingredient` to the `ResetDatabase` TRUNCATE list.

---

## 7. Frontend Design (dual-mode, hook shape preserved)

### 7.1 Data layer
- `src/lib/recipeApi.ts` — `list/get/create/update/remove` over `/api/recipe[/{id}]`; `toRequest(input)` maps `refId → pantryItemId`, casts contract enums; list-response cast (domain `NovaGroup` vs generated number), mirroring `pantryApi.ts`.
- `src/data/recipeHooks.ts` — `useRecipes()` (`useQuery(['recipes'])`, mock `initialData` + `staleTime:Infinity` / real `queryFn = recipeApi.list`) **composed** with pantry-sourced `ingredients/sources/categoryMeta` so the public return stays `{recipes, ingredients, sources, categoryMeta}`; `useRecipeActions()` (`create/update/remove`) — mock branch = `setQueryData(['recipes'])` cache mutators, real branch = API call + **invalidate both `['recipes']` and `['pantry']`** (recipe writes affect pantry `usedInRecipes`). Re-export both from `src/data/hooks.ts`.
- `src/test/msw/handlers.ts` — add `/api/recipe` handlers.

### 7.2 Routes & components
- Router (`src/app/router.tsx`): add `recipes/:id` (detail page), `recipes/new`, `recipes/:id/edit` (editor pages) under fuel. Detail/editor route guards must distinguish **pending vs not-found** (TanStack `isPending`) per the query-guard rule, so hard-reload deep links survive.
- **New pages:** `RecipeDetailView`, `RecipeEditorView` (create = edit).
- **Reworked:** `FuelRecipesView` (editorial + segmented filter + P2 badge), `RecipeCard` (editorial).
- **Kept as modal:** `IngredientPickerSheet` (macro-cell cards).
- **Retired:** `RecipeDetailSheet` → `RecipeDetailView`; `NewRecipeSheet` → `RecipeEditorView` (port the live-total + picker wiring). Old `*.test.tsx` migrate accordingly.
- **Shared:** `MacroCells`, `RecipeFitBadge`, `ServingToggle`.
- FE `Recipe`/ingredient types extend to carry per-line `name` + `contribution`; the editor computes contributions live with the same `amount/per` formula.

### 7.3 Gates
`pnpm test` REAL + `VITE_USE_MOCK=true pnpm test` both green; `pnpm build`; `pantryData.test.tsx` (asserts the 6-recipe shape) stays green or is updated for the new shape.

---

## 8. New Ground vs Pantry (risks to watch in the plan)
1. First `@OneToMany(cascade=ALL, orphanRemoval=true)` + `@OrderBy` + `@ManyToOne` — set conventions fresh.
2. First cross-domain reference (`pantry_item`) — plain-UUID column + Liquibase FK `ON DELETE RESTRICT`, snapshot for stability.
3. Child ownership — child carries its own `created_by` (reuses `requireOwned`/`@SQLRestriction` unchanged).
4. Aggregate soft-delete — `@SQLDelete` doesn't cascade `@OneToMany`; service bulk-soft-deletes children.
5. Nested payload mapping — resolve/validate each `pantryItemId` in the **service** (not the mapper).
6. Macro rollup — new server-side computation; must match the FE mock bit-for-bit.
7. Dual-cache invalidation — recipe writes invalidate `['recipes']` **and** `['pantry']`.
8. Composed hook — `useRecipes()` blends one dual-mode domain (`recipes`) with static/pantry config.
9. Detail + editor become **routed pages** (not sheets) — route guards, deep-link refetch.

---

## 9. Mockup provenance
The approved mockups were produced in the brainstorm visual companion (`.superpowers/brainstorm/`, gitignored) and **exported to `docs/design/` for durable reference**:
- `recipes-library.html` — editorial cards + segmented filter + P2 fit badge (pending/scored).
- `recipes-detail.html` — full-page detail (the "A" phone) + the sheet alternative for reference.
- `recipes-editor.html` — full-page editor with macro-cell pick-rows + /adag toggle, alongside the modal picker (`/100g` cells). Use these as the visual source of truth when building the components.

---

## 10. Open questions
None blocking. The five scope decisions (scoring defer, star/edit/delete live + meal-log defer, no steps, FK+snapshot, compute-don't-store macros) and all UI decisions (editorial library, P2 sparkle, full-page detail & editor, modal picker, macro cells, /adag toggle, per-ingredient contribution) are settled. Proceed to `writing-plans`.
