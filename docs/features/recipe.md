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

## 1. Summary

`RecipeEntity` (`recipe`: name, slot, category `breakfast|lunch|dinner|snack`, servings, prepMins, tags/fitsFor jsonb, `nova_dominant`, `role`, `updated_at`) is the aggregate root over `RecipeIngredientEntity` (`recipe_ingredient`: `pantry_item_id` — a plain UUID FK, `ON DELETE RESTRICT` — amount, unit, note, `line_order`, plus a frozen `snapshot_*` set of `name`/`per`/`basisUnit`/`kcal`/`protein`/`carbs`/`fat` and `fiber`/`sugar`/`salt`/`saturatedFat`). This is the first true `@OneToMany` aggregate in the codebase (`cascade = ALL`, `orphanRemoval = true`, `@OrderBy("line_order")`); soft delete does **not** cascade automatically — `RecipeService.delete` bulk-soft-deletes the lines itself.

Driving specs: [`2026-06-23-fuel-recipes-design.md`](../superpowers/specs/2026-06-23-fuel-recipes-design.md), [`2026-07-19-recipe-ai-breakdown-design.md`](../superpowers/specs/2026-07-19-recipe-ai-breakdown-design.md), [`2026-07-25-recipe-scoring-dimensions-design.md`](../superpowers/specs/2026-07-25-recipe-scoring-dimensions-design.md), [`2026-07-27-recipe-role-scoring-design.md`](../superpowers/specs/2026-07-27-recipe-role-scoring-design.md), [`2026-07-30-recipe-ingredient-overrides-design.md`](../superpowers/specs/2026-07-30-recipe-ingredient-overrides-design.md), [`2026-08-11-recipe-meal-nutrient-freeze-design.md`](../superpowers/specs/2026-08-11-recipe-meal-nutrient-freeze-design.md) ([ADR 0026](../decisions/0026-today-ios-list-language.md) is unrelated to the freeze — the freeze ADR is referenced from the spec itself), [`2026-09-01-receptmuhely-design.md`](../superpowers/specs/2026-09-01-receptmuhely-design.md) (`mezo-92pb`).

## 2. User-facing behavior

- **`FuelRecipesPage`** (`/fuel/recipes`) — the library, each card carrying the recipe's mezo-fit badge.
- **`RecipeDetailPage`** (`/fuel/recipes/:id`) — tabs, the AI breakdown prose, a **„Logolás"** action into meal-logging.
- **`RecipeEditorPage`** (`/fuel/recipes/new`, `/fuel/recipes/:id/edit`) — line editing via `IngredientPickerSheet` sourced from the Kamra, a save bar.
- **`RecipeWorkshopPage`** (`/fuel/recipes/muhely[?recipeId=]`) — the „✨ Műhely" chat-driven recipe builder: goals `high_protein|pre_workout|post_workout|before_bed|breakfast`, a diff view over the working draft, **„Frissítettem a vázlatot."** as the fallback reply when the model changes nothing narratable, and Save routes through the normal editor path.

**Since S4:** a Workshop line the LLM could not link to a `pantryItemId` (`null` or hallucinated) but whose stated name matches an entry in the SHARED pantry catalog now arrives on the draft as a `source: "pantry"` line — and that match automatically puts the matched definition on the caller's shelf (`PantryCatalogService.ensureItem`), so the line resolves to a real owned `pantry_item` the moment the recipe is saved.

## 3. Architecture & data flow

**FE:** `useRecipes()`/`useRecipeActions()` (`useDualQuery`, key `['recipes']`, `realEmpty: []`), `RECIPE_BREAKDOWN_KEY(id)` for the lazily-fetched breakdown cache, `recipeApi` (`list/get/create/update/remove/getBreakdown`, with a `refId ↔ pantryItemId` re-key between the wire shape and the FE domain type).

**Backend (`RecipeService`):** `create/get/list/update/delete`. Every write calls `rebuildLines`, which re-resolves **every** line owner-scoped via `PantryItemRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)` — a missing, foreign, or soft-deleted pantry item is a 400 (`invalidIngredients`) — and freezes the snapshot facts from `item.getCatalog()` at that moment (ADR-0026-referenced freeze design). `nova_dominant` is re-derived from the LIVE pantry NOVAs of the request's lines, not the frozen snapshot.

**`withFit`** computes the mezo-fit score DETERMINISTICALLY AT READ (`MealScoringService.recipeFit`, package-private `fitLines`): macros and the frozen nutrition facts come from each line's snapshot (scaled by amount ÷ servings), while **NOVA and category are LIVE reads** off the catalog via `pantryItemRepository.findAllWithCatalogByIdIn` — so a pantry item's classification can move a recipe's score even though its macros never do (§9).

**`RecipeBreakdownService`/`RecipeBreakdownProseService`** materialize and cache the envelope + AI Hungarian prose behind the `RecipeBreakdownLlm` port. **`RecipeWorkshopService.turn`** runs one stateless call over the `RecipeWorkshopLlm` port (`LlmCallContext("recipe_workshop", "turn")`), then `RecipeWorkshopValidator.sanitize` resolves each raw line by id (owner-scoped pantry lookup) or, since S4, by a `PantryNameIndex.of(pantryCatalogRepository.findByDeletedFalseOrderByNameAsc())` name match over the WHOLE global catalog — a hit resolves through `PantryCatalogService.ensureItem(userId, catalogEntry.getId())`, turning a name match directly into an owned shelf row.

## 4. Data model & API

Tables: `recipe` (`202606231400_mezo-lns_create_recipe.sql`) + `recipe_ingredient` with its snapshot columns added by `202608111200_mezo-m6uv_recipe_ingredient_nutrient_snapshot.sql`. `recipe_ingredient.pantry_item_id` is unaffected by the S4 pantry split (it still points at `pantry_item.id`, which the migration preserved — see [`pantry.md`](pantry.md) §1/§4).

Contract (`api/feature/recipe/recipe.yml`):

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/api/recipe` | list / create |
| GET / PUT / DELETE | `/api/recipe/{id}` | detail / update / delete |
| GET | `/api/recipe/{id}/breakdown` | lazily materialized AI breakdown envelope |
| POST | `/api/recipe/workshop/turn` | `WorkshopTurnRequest{message, history[], draft?, goal?}` → `WorkshopTurnResponse{reply, draft}`; `WorkshopDraftLine{source: pantry\|estimate, pantryItemId?, name, amount, unit, kcal?, …}` |
| GET | `/api/recipe/{id}/logs` | lives in `meal.yml`, not `recipe.yml` |

Error codes: `RECIPE_WORKSHOP_LLM_UNAVAILABLE` (503, companion off), `RECIPE_WORKSHOP_EXTRACT_FAILED` (502), `RECIPE_WORKSHOP_DRAFT_SERIALIZE_FAILED` (500).

## 5. Integrations

- **Pantry** — every line FK's `pantry_item`; definition reads (name/macros/NOVA/category at score time) go through `item.getCatalog()`. Deleting a pantry item is RESTRICTed by the FK (a live recipe line blocks a hard delete); soft-delete only hides the item from new line resolution — an existing line's frozen snapshot survives, but the fit score degrades honestly once the item can no longer be re-resolved. See [`pantry.md`](pantry.md) §5.
- **Meal** — `MealService`'s recipe arm computes the per-serving rollup (`MealService.perServing`), applies `recipe_overrides` keyed by `lineOrder` with a `pantryItemId` consistency check, and drives `RecipeLogs`.
- **Nutrition** — `MealScoringService.recipeFit`/`ScoredLine` (shared with the logged-meal scorer, see [`fuel.md`](fuel.md) §9).
- **Companion** — every LLM call is behind a consumer-owned port ([ADR 0012](../decisions/0012-consumer-owned-llm-ports.md)); `LlmCallContextHolder` feeds the llm-usage audit log.
- **The frozen `meal ↔ recipe` ArchUnit cycle** (`archunit-store`) — `feature/recipe` must never import `feature/meal`. This is exactly why `PantryNameIndex` moved from `feature/meal` to `feature/pantry` in S4: both `MealAiDraftService` and `RecipeWorkshopService` need the same name-match logic, and pantry is the only slice both can depend on without creating a `recipe → meal` edge.

## 6. How to use it (consume)

`useRecipes()`/`useRecipeActions()` from `@/data/hooks`; `recipeMacros.ts` pure helpers (`computeRecipeMacros`, `computeRecipeNutrients`, `lineContribution`, `factsOf`) for FE-side derived totals; `pantryImpact.ts`'s `recipesUsingPantryItem`/`movesRecipeScores` is the rule `usePantryActions` uses to decide which recipe/breakdown caches a pantry write must invalidate (see [`pantry.md`](pantry.md) §3).

## 7. How to extend it

Contract-first as always. A new line field = migration + `RecipeIngredientEntity` + `RecipeMapper` + `recipeApi.fromResponse`. A new scoring dimension goes in `MealScoringService` (see [`fuel.md`](fuel.md) §9 for the shared meal/recipe rubric). A new Workshop rule belongs in `RecipeWorkshopValidator` (pure, unit-tested) — never encode a new invariant in the prompt alone.

## 8. Testing

Backend: `RecipeApiIT`, `RecipeServiceIT`, `RecipeRepositoryIT`, `RecipeMapperTest`, `RecipeMapperOverrideRollupTest`, `RecipeBreakdownApiIT`, `RecipeBreakdownFallbackApiIT`, `RecipeBreakdownProseServiceTest`, `RecipeWorkshopApiIT` (+ `RecipeWorkshopLlmUnavailableApiIT`, `RecipeWorkshopSwitchOffApiIT`), `RecipeWorkshopValidatorTest`. FE: `recipeHooks.test.tsx`, `recipeApi.test.ts`, `recipeMacros.test.ts`, plus the four page tests. Both frontend modes must stay green (`VITE_USE_MOCK=false pnpm test` and `VITE_USE_MOCK=true pnpm test`).

## 9. Decisions, gotchas & deferred

- **Snapshot freeze (mezo-m6uv) vs. live NOVA/category** — a deliberate split: macros/nutrients are frozen at save time so a recipe's numbers never silently drift when the pantry item's facts change, but NOVA/category are read live because they gate the fit rubric's ultra-processed-food dimension, which the design wants reactive to a pantry correction.
- **Fit is computed at READ, not persisted** — `recipe.fit_score` is reserved but unused; recomputing on every read keeps it consistent with any live-input drift without a cache-invalidation protocol.
- **`servings` is clamped 1..12 in the Workshop**; `maxLines`/`maxSteps`/`maxHistoryTurns` come from `RecipeWorkshopProperties`.
- **The S4 auto-add-at-turn-time trade-off**: like the Meal AI draft (see [`pantry.md`](pantry.md) §9), a Workshop turn that matches a catalog name puts the definition on the caller's shelf immediately — a discarded draft still leaves that shelf row behind.
- A literal `"Daniel:"` string that used to live in `buildUserMessage` was removed in S6's persona work ([`_platform-auth-security.md`](_platform-auth-security.md) §4) — every prompt site now carries `{{NÉV}}` via `PromptPersona`.
- **Deferred:** nothing epic-scale is currently deferred on the recipe side beyond the general Phase-3 AI-brain items tracked in [`insights.md`](insights.md).

## 10. Key files

- **Backend:** `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/{entity/RecipeEntity,entity/RecipeIngredientEntity,repository/RecipeRepository,repository/RecipeIngredientRepository,mapper/RecipeMapper,service/RecipeService,service/RecipeBreakdownService,service/RecipeBreakdownProseService,service/RecipeWorkshopService,service/RecipeWorkshopValidator,controller/RecipeController,controller/RecipeWorkshopController}.java`
- **Contract:** `api/feature/recipe/recipe.yml`
- **FE data:** `frontend/src/data/fuel/{recipeApi,recipeHooks,recipeMacros,pantryImpact,queryKeys}.ts`
- **FE views/sheets/components:** `frontend/src/features/fuel/pages/{FuelRecipesPage,RecipeDetailPage,RecipeEditorPage,RecipeWorkshopPage}.tsx`, `RecipeCard`, `RecipeFitBadge`, `RecipeIngredientList`/`Row`, `RecipeLogsList`, `RecipeOverrideRow`, `RecipeScoreSheet`, `IngredientPickerSheet`
- **Tests:** `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/*.java`
- **Docs/specs:** [`pantry.md`](pantry.md), [`fuel.md`](fuel.md), the six driving specs listed in §1, [ADR 0012](../decisions/0012-consumer-owned-llm-ports.md)
