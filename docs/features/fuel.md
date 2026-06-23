---
title: Fuel (Nutrition)
type: feature-domain
status: partial-backend
updated: 2026-06-23
tags: [fuel, frontend, data-layer]
key_files:
  - frontend/src/features/fuel
  - frontend/src/data/fuel.ts
  - frontend/src/data/pantryHooks.ts
  - frontend/src/lib/pantryApi.ts
  - frontend/src/data/recipeHooks.ts
  - frontend/src/data/recipeMacros.ts
  - frontend/src/lib/recipeApi.ts
  - frontend/src/app/router.tsx
related: [_platform-data-layer, _platform-design-system, train, today]
---

# Fuel (Nutrition) — Feature Documentation

> The `/fuel` tab — meal pacing, supplement stack/protocol, pantry (Kamra), recipes, and a weekly fuel rhythm. **Status: 🔶 mostly mock** (Phase 1 FE done; Phase 2 backend **Slice C · Fuel — Pantry (Kamra) AND Recipes (Receptek) sub-slices now backend-backed**, the rest of Fuel still mock-only; AI scoring/replan/import is 🟣 Phase-3-planned, simulated client-side today). The Pantry inventory (`usePantry`/`usePantryActions`, mezo-9xu) is real dual-mode CRUD against `/api/pantry`; the scrape-feed (`imports`) and `suggestions` stay mock/deferred. **Recipes (`useRecipes`/`useRecipeActions`, mezo-lns)** are real dual-mode CRUD against `/api/recipe` — a `recipe` + `recipe_ingredient` aggregate whose lines reference `pantry_item`, with per-line `name`/`contribution` macros computed at read time. The owner's prod pantry is seeded with a **146-item imported catalog** (`seed/pantry-catalog.json` → idempotent `@Profile("demodata")` `PantryCatalogLoader`, mezo-zza); that slice also extended `pantry_item` with preserved nutrition facts (`fiber_g/sugar_g/salt_g/saturated_fat_g`), a **`category` enum** (18 values: vegetables…supplement/other) and additional **`source`** vendors (lidl/nutriversum/herbahaz/nutrifit/decathlon).

## 1. Summary

Fuel is mezo's nutrition domain: five sub-views under the bottom-nav route `/fuel` covering today's meal/supplement **pacing** (`"Mai"`), the weekly **plan/rhythm** (`"Terv"`), an AI supplement-**protocol** builder (`"Stack"`), a **recipe** library (`"Receptek"`), and a **pantry/shelf** (`"Kamra"`). It exists to turn training + medication context (notably the **Retatrutide** appetite-cycle) into appetite-aware, time-boxed nutrition guidance.

**Status per layer:**
- **FE mock:** ✅ complete — all five views, all sheets return static mock data synchronously; the Fuel hooks in `frontend/src/data/hooks.ts` are mock-only **except** the Pantry pair (`usePantry`/`usePantryActions` in `data/pantryHooks.ts`), which are dual-mode (mock returns the static seed synchronously via `initialData`).
- **FE real:** 🔶 **Pantry only** — `usePantry`/`usePantryActions` branch on `isMockMode()` and hit `lib/pantryApi.ts` (`/api/pantry`) in real mode (the `useWeight` dual-mode pattern). The rest of Fuel still has no real path — no `fuelApi.ts`, no `useQuery` for the other Fuel hooks.
- **Backend:** 🔶 **Pantry only** — `backend/.../feature/pantry` (single-table `pantry_item`, Model B, `kind` discriminator) + the `api/feature/pantry/pantry.yml` contract fragment (mezo-9xu) are live. The rest of Fuel backend is ❌ none; `train`/`biometrics`/`auth`/`pantry` are the only backend features. Other nutrition references remain forward-looking comments (`ProvenanceEnvelope.java:10`: "Fuel reuses this pattern for meal score"; `api/openapi.yml` `mealToSleep` "always 0 until Fuel lands").

Driving design: **[`docs/superpowers/specs/2026-06-10-phase2-backend-design.md`](../superpowers/specs/2026-06-10-phase2-backend-design.md)** (Slice C · Fuel: `food_item`/`meal`/`meal_item`/`recipe`/`supplement_intake`/`medication(_dose)`/`nutrition_targets` + a fuel-timeline **view**, wiring these same nine hooks). Fuel is sequenced **after** Train deliberately because Train de-risks the typed-jsonb provenance-envelope pattern (`@JdbcTypeCode(SqlTypes.JSON)`) that Fuel's meal `score` will reuse. Roadmap: **[`docs/milestones/roadmap.md`](../milestones/roadmap.md)**.

## 2. User-facing behavior

`/fuel` renders `FuelScreen.tsx` with a sub-nav (`FuelSubNav.tsx`); routes declared in `frontend/src/app/router.tsx` (Fuel owns only the `/fuel` tab block — full-screen builder/wizard siblings like `train/mesocycles/new` or `me/goals/new` live outside any tab tree):

| Route | Sub-nav label (HU) | View | What the user does |
|---|---|---|---|
| `/fuel` (index) | `"Mai"` | `FuelMaiView` | Today's pacing |
| `/fuel/plan` | `"Terv"` | `FuelPlanView` | Weekly rhythm |
| `/fuel/stack` | `"Stack"` | `FuelStackView` | Supplement protocol |
| `/fuel/recipes` | `"Receptek"` | `FuelRecipesView` | Recipe library |
| `/fuel/kamra` | `"Kamra"` | `FuelKamraView` | Pantry / shelf |
| `/fuel/kamra/:id` | `"Kamra · tétel"` | `KamraItemDetailView` | Pantry item detail (full page) |

**`"Mai"` (`FuelMaiView`):** eyebrow `"Fuel · Mai"` / title `"Pacing"`; a `RetaPhaseBar` (Reta-cycle phase); a context strip of `StatCell`s (gym/volleyball/coffee-cutoff/kitchen-close); a `MacroHero` (targets vs consumed); a `PacingCard`; a protocol-meta row showing `Stack · v{protocol.version} · {builtAt}` with a **Replan** button; the meal+supplement **`FuelTimeline`** (each slot a `TimelineSlot`). Tapping a scored meal calls `getScoredMeal(slot)` and opens the **`MealScoreSheet`** (the 0–1 AI score broken into 4 dimensions — see §4). Bottom: weekly micronutrient `ProgressBar`s. The Replan button opens **`ReplanSheet`**.

**`"Terv"` (`FuelPlanView`):** weekly stats card (kcal avg, protein-hit days, stack adherence, gym+sport count); a `RetaWeekStrip` (7-day Reta cycle, `currentDay={3}` hardcoded); the **`WeekRhythmGrid`** — a 24h-axis week grid merging gym sessions + volleyball per day with coffee-cutoff (14:00) and kitchen-close markers; recurring `PatternRow`s; a `WeeklySupplementGrid`. Gym times are editable via **`GymScheduleSheet`** (`onSave` lifts edits into local state; **no persistence**). Title `"Máj 18 – 24"` is hardcoded.

**`"Stack"` (`FuelStackView`):** an AI supplement-protocol builder. Default selection = all non-medication stash items; toggling chips re-runs `buildProtocol(selectedIds, stash)`. Sections: context summary (`StatCell`s + `ToolChipRow`), a Mezo narrative, the active stack (`SelectedChip`s + **`StackPickerSheet`**), AI-generated timing (`ProtocolSlot`s), reasoning (`ReasoningRow`s), recommendations (`RecommendationCard`s), meal matches (`MealMatchRow`s). The CTA `"Bekapcsolás · ma"` toasts `v{protocol.version + 1}` but **does not mutate** any global protocol (intentionally inert).

**`"Receptek"` (`FuelRecipesView`):** the **editorial library redesign** (`docs/design/recipes-library.html`, mezo-lns). The view reads real `recipes` from the dual-mode `useRecipes()`, renders directly into the app-shell `.screen-content`, and shows a **segmented typebar** (`Mind / Reggeli / Ebéd / Vacsi / ★` with live per-filter counts, the Kamra typebar pattern) — the old search + filter-chip row is gone. The header sub shows real counts (`"{n} recept · {s} csillagos"`); the fake **`"Avg fit 0.89"`** stat strip is removed. `RecipeCard` is now an **editorial card**: a 118px image band (diagonal-stripe gradient + bottom fade) with the Antonio name overlaid, a slot tag + bookmark star top-left, and the `RecipeFitBadge` top-right (v1 `mezoFit.score` is `null` → the P2 pending sparkle "Mezo"; a real score later swaps into the same slot with no layout shift); the body is a whole-recipe `MacroCells` strip + a meta line (`N hozzávaló · {prep+cook} perc · NOVA {n}`). The card button carries an `aria-label` of the recipe name. Tapping a card navigates to **`/fuel/recipes/:id`**; the page-header **`＋ Új`** chip navigates to **`/fuel/recipes/new`** (those routed pages land in Phase 7c — the old `RecipeDetailSheet` / `NewRecipeSheet` overlays remain mounted until 7c retires them). The nested **`IngredientPickerSheet`** (still a modal) was reworked to per-row **`/100g` `MacroCells` cards** (`docs/design/recipes-editor.html`): name + `SourceBadge` + brand/NOVA subline + a `＋` add button, category-accented left border.

**`"Kamra"` (`FuelKamraView`):** the pantry, **redesigned to Direction A** (`docs/design/kamra-mockup-v3-A.html`, mezo-9xu) with a **detail/edit/filter UX iteration** (`docs/design/kamra-detail-edit-v1.html`, mezo-4ag). `buildKamraItems(ingredients, stash)` produces a unified `PantryItem[]` (food + supplements + stimulants + medication). The primary axis is a **type segmented switcher** (`Mind/Étel/Supp/Stim` with live counts). Below it a **compact filter bar** = the search input + a **`⚙ Szűrők`** button carrying a badge with the active category-filter count; tapping it opens **`CategoryFilterSheet`** (a `Sheet` bottom-sheet listing only the categories **present** in the current items, each with a count, as multi-select chamfer chips + a clear + an apply showing the resulting tally). Applied categories render as **removable chamfer pills** above the list; the list filter **ANDs** type AND selected categories AND search (`matches(it, cats)` in `FuelKamraView`). The 18 categories are deliberately **not** inline. Items render in **type-grouped sections** (a colored square nub divider per kind) as lighter design-system **meal-card** `KamraCard`s (44px stock slot · Antonio name · source/brand · `P/C/F · NOVA · lejár` · right kcal/dose; supplement/stim get a left inset tint; **padding 16px, name→source 7px / source→macro 9px breathing room** per mezo-4ag). A 4-cell stats strip (total / food / low-expiry / low-stock) + a **needs-attention strip** (when something expires < 3 days) sit above; an **empty-state** CTA shows when the pantry is empty (real mode starts empty). The view renders directly into the app-shell `.screen-content`. The page-header **`＋ Új tétel`** chip opens **`AddPantryItemSheet`** (manual add). **Placeholder/mock UI removed:** the scrape-feed card + `ImportItemSheet`, the `SuggestionCard` feed (`pantrySuggestions`), and the scrape-vendor source filters — `imports`/`suggestions` are already `[]` in real mode.

Tapping a card now **navigates to `/fuel/kamra/:id`** — the item detail is a full **page** (`KamraItemDetailView`), not a bottom-sheet drawer. This kills the old "drawer-in-drawer" edit problem (the editor drawer used to open over a detail drawer). The page reads `usePantry()` + `buildKamraItems(...)`, finds the item by `useParams().id` (a small "nincs ilyen tétel" + back if absent), and lays out: back (‹) + eyebrow → source pill → big Antonio name → category label (from `categoryMeta`) · NOVA → **Makrók** (4 `notch-4` cells: kcal/P/C/F) → **Tápanyag** (4 cells: Rost/Cukor/Tel.zsír/Só from `item.fiberG/sugarG/saturatedFatG/saltG`, `—` when null; section rendered only when the item has macros) → **Készlet · ár** → actions: **`＋ Logolás`** (disabled — no logging slice), **`✎ Szerkesztés`** (opens `AddPantryItemSheet` in edit mode, hosted by the page), **`Törlés`** (`deleteItem(backendId)` then `navigate('/fuel/kamra')`). The `'stash-'` id-prefix strip to the `backendId` + the `inputFromItem(item)` edit-input derivation **moved here** from the retired `IngredientDetailSheet` (deleted). **`AddPantryItemSheet`** (real `Sheet` shell) is the full add/edit form (mezo-4ag): sectioned **Alap** (Típus/Kategória/Forrás selects + Név + Adag) / **Makrók** (kcal/P/C/F) / **Tápanyag** (Rost/Cukor/Tel.zsír/Só → `fiberG/sugarG/saturatedFatG/saltG`) / **Készlet · ár** (stockQty+unit, price), with `Dózis` replacing the macro sections for supplement/stim/med; `submit()` builds a complete `PantryItemInput` from all state and calls `updateItem(editId)` / `addItem`. The mock `applyIngredientUpdate` (`pantryHooks.ts`) now also persists the extended-nutrition + price fields so an edit round-trips in mock mode. (**`ImportItemSheet`** — the 3-phase scrape wizard — still exists but is unmounted; it returns when scrape/import lands.)

## 3. Architecture & data flow

The single FE↔data boundary is `frontend/src/data/hooks.ts`. For most of Fuel the path **stops at mock data** — no API, no `isMockMode()`, no TanStack Query. **Exception — Pantry (Kamra):** `usePantry`/`usePantryActions` moved to `frontend/src/data/pantryHooks.ts` (re-exported from `hooks.ts`) and are now dual-mode TanStack Query hooks (mezo-9xu). `usePantry` keeps its exact return shape `{ ingredients, stash, sources, categoryMeta, imports, suggestions }`: in **mock mode** it returns the static seed via `initialData` (synchronous first render; `staleTime: Infinity` so `usePantryActions` mock cache edits via `setQueryData` are not clobbered by a refetch); in **real mode** `ingredients`/`stash` come from `pantryApi.list()` (`GET /api/pantry`), while `imports`/`suggestions` are `[]` (deferred) and `sources`/`categoryMeta` stay static config. `usePantryActions` exposes `{ addItem, updateItem, deleteItem }` — mock mode mutates the `['pantry']` cache, real mode calls `pantryApi.create/update/remove` and invalidates (the `useWeight` dual-mode pattern).

**Exception — Recipes (Receptek):** `useRecipes`/`useRecipeActions` moved to `frontend/src/data/recipeHooks.ts` (re-exported from `hooks.ts`, mezo-lns) and are also dual-mode. `useRecipes()` **preserves its exact return shape `{ recipes, ingredients, sources, categoryMeta }`** — only `recipes` is dual-mode (a `useQuery({ queryKey: ['recipes'] })`: mock `initialData` + `staleTime: Infinity`, real `queryFn: recipeApi.list` → `GET /api/recipe`); `ingredients`/`sources`/`categoryMeta` stay pantry-sourced static config. `useRecipeActions()` exposes `{ create, update, remove }`: mock mode mutates the `['recipes']` cache via `setQueryData`, real mode calls `recipeApi.create/update/remove` then invalidates **BOTH `['recipes']` AND `['pantry']`** (a recipe references pantry items, so a write shifts the pantry `usedInRecipes` rollup). **Mock/real parity is exact:** each line's `name` + `contribution{kcal,p,c,f}` and the whole-recipe `macros` are computed by the shared `frontend/src/data/recipeMacros.ts` formula (`factor = amount / per`, per→1 for discrete units; each macro `= roundMacro(snapshot × factor)` rounded to a **whole number** — `Math.round`, matching the backend `RecipeMapper.setScale(0, RoundingMode.HALF_UP)`; whole-recipe = Σ contributions) — the SAME formula the backend `RecipeMapper` runs at read time. `recipeApi` (`frontend/src/lib/recipeApi.ts`) re-keys each contract line's `pantryItemId → refId` (`fromResponse`) and maps the editor `RecipeInput` back (`toRequest`). The FE `Recipe.mezoFit.score` widened to `number | null` (server recipes have no score yet); `RecipeIngredientLine` gained optional `name`/`contribution`.

Any component reading `usePantry`/`useRecipes` (`FuelKamraView`, `KamraItemDetailView`, `KamraCard`, `RecipeCard`, `NewRecipeSheet`, `RecipeDetailSheet`, `FuelRecipesView`) now needs a `QueryClientProvider` in tests (plus a router context for `KamraItemDetailView`/`FuelKamraView`, which use `useParams`/`useNavigate`). The rest of Fuel:

```
View (features/fuel/views/*.tsx)
  → useFuelDay / useFuelTimeline / useStack / useProtocol
    / useFuelWeek / useReplanScenarios / useStackRecommendations   (hooks.ts)
      (usePantry/usePantryActions — dual-mode, data/pantryHooks.ts; see prose above)
      (useRecipes/useRecipeActions — dual-mode, data/recipeHooks.ts; see prose above)
      → returns imported static consts:
          data/fuel.ts        (fuelDay, fuelPlan, supplementsStash, protocol, getScoredMeal)
          data/pantry.ts      (ingredients, recipes[derived], pantryCategoryMeta, pantryImports, pantrySuggestions)
          data/pantrySources.ts (pantrySources)
          data/fuelWeek.ts    (retaWeek, gymSchedule, weeklySupplements, recurringPatterns,
                               weeklyStats, replanScenarios, stackRecommendations)
      → NO isMockMode(), NO apiFetch, NO useQuery
```

Each Fuel hook is a one-liner spread of imported consts — e.g. `useFuelDay()` is just `{ fuel: fuelDay }`; `useFuelTimeline()` returns `{ plan: fuelPlan.today, getScoredMeal: (s) => getScoredMeal(s, fuelDay.meals) }`. Compare `useWeight` (`weightHooks.ts:11`), which branches `mock ? initialWeightLog : weightApi.list` inside `useQuery`. **When Slice C lands the seam is exactly these nine hooks** — they gain the `isMockMode() ? mockConst : fuelApi.x()` branch + `useQuery`/`useMutation` (+ `initialData` for mock parity), identical in shape to `useWeight`. **View and component signatures must not change** — that is the Phase-2 contract.

**Two pure "AI" helpers** carry the simulated intelligence (deterministic, not data):
- `features/fuel/buildProtocol.ts` — `buildProtocol(selectedIds, stash): BuiltProtocol`. Builds timed `slots`, `reasoning[]`, and a fixed `mealMatches[]` from the selected stash ids. Reta/meso context is **hardcoded into the strings**; the only live input is the selection. Pre-snack slot is gated on `items.length > 0` so an **empty selection yields zero slots** (`buildProtocol.ts:46`, test-enforced).
- `features/fuel/kamraItems.ts` — `buildKamraItems(ingredients, stash): PantryItem[]`. Merges scraped food ingredients + the supplement stash into one `PantryItem[]`, **de-duping** stash items already present as an ingredient via `Ingredient.stashRefId` (`kamraItems.ts:17-18`; `ing-whey`/`ing-kreatin`/`ing-aakg` carry a `stashRefId` to avoid double cards). Stash cards get a **`'stash-'`-prefixed `id`** (`kamraItems.ts:25`) to stay collision-free against food ingredient ids in the unified list — so `KamraItemDetailView` strips that prefix to a `backendId` before any mutation (edit/delete), since the mock cache mutators match on the raw stash id and the real `PUT`/`DELETE` target the raw UUID (mezo-9xu; without stripping, every stash delete/update was a silent no-op).

**Derived data — the mock `recipes` seed is NOT a plain const.** In `data/pantry.ts`, `recipesBase` is enriched at module load: each recipe gets `recentLogs` (mirrored from logged `fuelDay.meals` via the recipe-link mapping), a `templateBreakdown` (the linked meal's breakdown, or a standalone `recipeTemplateBreakdowns[rec-3/5/6]`), and — since mezo-lns — each ingredient line is run through `enrichLine` (snapshot `name` + `contribution`) with the whole-recipe `macros` **recomputed** from those contributions via `computeRecipeMacros`, so the mock seed equals what `GET /api/recipe` returns. This couples `data/pantry.ts` → `data/fuel.ts` (it imports `fuelDay`) and → `data/recipeMacros.ts`. The backend reproduces the contribution/rollup math in `RecipeMapper`; the recipe↔log linkage (`recentLogs`/`templateBreakdown`) is still mock-only and a real backend must reproduce it server-side.

## 4. Data model & API

**Most Fuel types are still FE-only TypeScript in `frontend/src/data/types.ts`** (no tables/DTOs/endpoints). **Backend-backed exceptions:** Pantry (`/api/pantry`, `pantry_item`, mezo-9xu) and **Recipes (`/api/recipe`, `recipe` + `recipe_ingredient`, mezo-lns)**. The Recipe contract lives in `api/feature/recipe/recipe.yml` → merged `api/openapi.yml` → FE types in `frontend/src/lib/api.gen.ts` (`Recipe{Request,Response,ListResponse,IngredientRequest,IngredientResponse,Macros,Contribution,MezoFit}`) + BE `RecipeApi`/`api.dto`. Endpoints: `GET /api/recipe` (list), `GET /api/recipe/{id}`, `POST /api/recipe`, `PUT /api/recipe/{id}` (full-replace), `DELETE /api/recipe/{id}` (soft-delete cascade). `recipe_ingredient` references `pantry_item` by a plain-UUID FK (`ON DELETE RESTRICT`) plus a per-basis macro snapshot; macros are computed at read time (contribution = `amount/snapshot_per × snapshot macros`; whole-recipe = Σ contributions). Key FE shapes:

- **`FuelSlot`** (`types.ts:19-30`): one timeline entry — `kind: FuelKind` (`'wake'|'meal'|'midday'|'snack'|'preworkout'|'workout'|'sport'|'evening'`), `state: 'done'|'now'|'pending'`, optional `mealName`/`mezoNote`/`windowTip`, macros, `items: SlotItem[]` (`SlotItem` = `{type:'supplement', refId, label, done, primary?, note?}`).
- **`FuelPlanToday`** (`types.ts:31-36`): `workout`/`volleyball` blocks, `bedtime`/`kitchenClose`/`caffeineCutoff`, `slots[]`.
- **`MealDimension`** discriminated union (`types.ts:39-45`) — the four weighted scoring dimensions: `MacroDimension` (macroRatio/macroTargets/kcalShareOfDay), `MicroDimension` (`micros[]` with `MicroStatus 'good'|'ok'|'low'`), `NovaDimension` (food-processing class `NovaGroup 1|2|3|4`), `ContextDimension`. All share `MealDimensionBase` (label/weight/score/color/detail).
- **`MealBreakdown`** (`types.ts:46-52`): `confidence`, `summary`, `dimensions[]`, `improve[]`, `tools[]` (`ToolType 'read'|'compute'|'write'` — the transparency list). **This is the natural jsonb envelope** when Fuel lands (the `MealBreakdown` ⇒ meal `score` typed-jsonb mapping reuses Train's `ProvenanceEnvelope` pattern).
- **`FuelMeal`** (`types.ts:53-59`), **`FuelDay`** (`types.ts:62-68`): `targets`/`consumed` (`MacroSet` incl. `water`), `meals[]`, `pacing`, `micronutrients`, `supplements` (`FuelSummary`).
- **`SupplementStashItem`** (`types.ts:70-74`): `type 'supplement'|'stimulant'|'medication'`, category, dose, form, stock, protocol, timing, taken, `caffeine?`.
- **`Protocol`** (`types.ts:75-79`): `version`/`builtAt`/`source`/`status`/`itemCount`/`confidence`/`lastReplanReason`/`history[]`.
- **Pantry:** `Ingredient` (`stashRefId?`, `nova`, `micros`, `source: PantrySourceKey`), `PantryImport`/`PantrySuggestion`, unified **`PantryItem`** (`kind 'food'|'supplement'|'stim'|'med'`).
- **Recipe** (`types.ts`): `Recipe` with `ingredients: RecipeIngredientLine[]` (`{refId, amount, unit, note?, name?, contribution?}` — `refId === pantryItemId`, `name`/`contribution` server-computed), `macros`, `novaDominant`, `mezoFit.score: number | null`, `starred`, derived `recentLogs?`/`templateBreakdown?` (mock-only). **`RecipeInput`** is the editor save payload (`ingredients[].pantryItemId` lines) → `recipeApi.toRequest` → `RecipeRequest`. `RecipeLog` is the per-meal log shape on `recentLogs`.
- **Weekly:** `RetaPhase`/`RetaDayCell`, `GymScheduleDay`, `WeeklySupplementRow`, `RecurringPattern`, `ReplanScenario`/`ReplanCascade` (cascade `system: 'Fuel'|'Train'|'Sleep'|'Insights'`, `types.ts:304`), `StackRecommendation`.
- **Stack builder:** `ProtocolSlotItem`/`ProtocolSlotData`, `Reasoning` (`kind 'physiology'|'timing'|'interaction'|'sleep'`), `MealMatch`, `BuiltProtocol`.
- Supporting: `data/nova.ts` (`NovaGroup`, `NOVA_META`, `STATUS_COLOR`), `data/pantrySources.ts` (`PantrySourceKey = 'kifli.hu'|'myprotein.hu'|'tesco.hu'|'auchan.hu'|'manual'`).

**Where the backend plugs in (planned, contract-first):** a new `api/feature/fuel/fuel.yml` fragment → merged `api/openapi.yml` → FE types in `frontend/src/lib/api.gen.ts` + BE `io.mrkuhne.mezo.api` interfaces/DTOs. Expected endpoints `GET/POST /api/fuel/*` (day, timeline, pantry, recipes, stack, protocol) per **[`docs/references/api_contract_conventions.md`](../references/api_contract_conventions.md)**. Tables per the design spec: `food_item`/`meal`/`meal_item`/`recipe`/`supplement_intake`/`medication(_dose)`/`nutrition_targets` + a fuel-timeline view, UUID PKs, `OwnedEntity` + `created_by`, soft delete, meal `score` as typed jsonb.

## 5. Integrations

Fuel is the most cross-coupled mock domain. Each seam below names the **contract** (the type/shape that crosses):

- **Today → Fuel preview (Today consumes Fuel).** `useFuelPreview` (`hooks.ts:67-74`) slices `fuelToday.slots` (the next 3 from `state==='now'`) + finds the next pending supplement stack — consumed by the Today screen's fuel card. Crossing type: `FuelSlot[]`. Note `fuelToday` is re-exported from `data/today.ts` (which re-exports it from `data/fuel.ts`) and surfaced by `useToday()` (`hooks.ts:37-39`), so Today's barrel and Fuel share the **same object**.
- **Today scenario → Fuel Mai (Mai consumes Today).** `FuelMaiView` calls `useTodayScenario()` for `retaDay` (URL-param driven, `hooks.ts:21-30`) and `useToday()` for `today.workoutType`. Crossing types: `TodayScenario`, `TodayMeta`. The URL knobs `?retaDay=` and `?day=` therefore change the Mai view's Reta bar.
- **Me/Goals → Fuel Stack (Stack consumes Me + Goals).** `FuelStackView` reads `useProfile().user.weekInMeso` and `useGoal().linkedMesocycles` (the active mesocycle's `shortTitle`) for the `"Meso W{n}"` context cell — the consumer was updated from `useGoals` to `useGoal` in the G1 split (`mezo-2hp`). Crossing types: `UserMeta`, the linked-mesocycle map.
- **Train (gym) ↔ Fuel (Fuel owns a private copy).** Fuel's weekly plan models gym sessions (`gymSchedule`, `data/fuelWeek.ts`) and pulls `volleyballSessions` (from `data/today.ts`). These are **Fuel's own copy** of the training schedule, NOT read from the Train domain's mesocycle data. `WeekRhythmGrid` overlays both and derives meal/caffeine/supplement timing from gym times (prose only). Crossing types: `GymScheduleDay`, `VolleyballSession`.
- **Reta (medication) → cross-cutting.** `retaWeek`/`retaDay` is a Fuel-owned concept (the 7-day Retatrutide kinetic cycle: D1-2 Peak → D3-5 Stable → D6-7 Trough) but is surfaced on Today and across all Fuel sub-views. `retaDay` arrives via `useTodayScenario`.
- **Replan cascade → Sleep / Insights / Train (Fuel exposes the ripple model).** `ReplanScenario.cascades[].system` is typed `'Fuel'|'Train'|'Sleep'|'Insights'` (`types.ts:304`); `ReplanSheet` color-codes per system. This is the explicit "context change ripples across domains" model — all simulated prose in `data/fuelWeek.ts`.
- **Supplements ↔ Pantry (internal seam).** `supplementsStash` (`data/fuel.ts`) feeds `useStack`/`useProtocol` AND `usePantry` (the mock-mode `stash`, now via `data/pantryHooks.ts`); the Kamra merges the stash into pantry items, de-duping via `Ingredient.stashRefId` (`kamraItems.ts:17-18`). In real mode the `stash` comes from `pantryApi.list()` instead.
- **Recipes ↔ FuelDay (internal seam).** `data/pantry.ts` imports `fuelDay` to derive recipe `recentLogs` from logged meals — so scoring a meal and viewing a recipe's log history share one source (`pantry.ts:548-573`).
- **Shared design primitives.** Fuel reuses `frontend/src/components/ui/` heavily: `Sheet`, `StatCell`, `ProgressBar`, `Eyebrow`, `PageTitle`, `Chip`, `Icon`, `ScoreRing`, `RetaPhaseBar`, `ToolChipRow`, `SourceBadge`, `NovaDot`, `MacroRow`, `SafeMarkdown`, `Toggle` — all "Deep Current v2" tokens from `frontend/src/styles/prototype.css`.

## 6. How to use it (consume)

Import any of the nine Fuel hooks from the single boundary `@/data/hooks`:

```ts
import {
  useFuelDay, useFuelTimeline, useStack, useProtocol,
  usePantry, useRecipes, useFuelWeek,
  useReplanScenarios, useStackRecommendations,
} from '@/data/hooks'

const { fuel } = useFuelDay()                       // FuelDay: targets/consumed/meals/pacing/micronutrients/supplements
const { plan, getScoredMeal } = useFuelTimeline()   // plan: FuelPlanToday; getScoredMeal(slot) → FuelMeal|null
const { stash } = useStack()                        // SupplementStashItem[]
const { protocol } = useProtocol()                  // Protocol
const { ingredients, stash, sources, categoryMeta, imports, suggestions } = usePantry()
const { recipes, ingredients, sources, categoryMeta } = useRecipes()
const { retaWeek, gymSchedule, weeklySupplements, patterns, weeklyStats, volleyball } = useFuelWeek()
const { scenarios } = useReplanScenarios()          // ReplanScenario[]
const { recommendations } = useStackRecommendations()
```

Pure helpers to reuse: `buildProtocol(selectedIds, stash)` (`features/fuel/buildProtocol.ts`), `buildKamraItems(ingredients, stash)` (`features/fuel/kamraItems.ts`), `getScoredMeal(slot, meals)` (`data/fuel.ts`). To embed a full sub-view, render the route component (e.g. `<FuelMaiView />`) under a `<MemoryRouter>`/router context, since views read `useTodayScenario` (URL params). For a lighter Today-style preview, use `useFuelPreview()` (`hooks.ts:67`) → `{ visible: FuelSlot[], nextStack }`.

## 7. How to extend it

**To make Fuel real (Phase-2 Slice C), use the biometrics slice as the template** (`useWeight` + `frontend/src/lib/biometricsApi.ts` are the proven pattern). Recipe:

1. **Contract-first** (**[`api_contract_conventions.md`](../references/api_contract_conventions.md)**): add `api/feature/fuel/fuel.yml` (endpoints + DTO schemas: FuelDay, MealBreakdown, PantryItem, Recipe, Protocol…). Merge: `cd api/generate && npm run generate:api`; regenerate FE types: `cd frontend && pnpm generate:api`; backend DTOs regenerate in `./mvnw generate-sources`.
2. **Backend** under `io.mrkuhne.mezo.feature.fuel/{controller,service,repository,entity,dto,mapper}` per **[`java_package_structure.md`](../references/java_package_structure.md)** + **[`spring_patterns.md`](../references/spring_patterns.md)**. Entities: `food_item`/`meal`/`meal_item`/`recipe`/`supplement_intake`/`medication(_dose)`/`nutrition_targets` + a fuel-timeline view. UUID PKs, `OwnedEntity` + `created_by`, `@SQLDelete`/`@SQLRestriction`. **Meal `score` → typed jsonb** via `@JdbcTypeCode(SqlTypes.JSON)` onto a typed record — reuse the Train `ProvenanceEnvelope` pattern (`MealBreakdown` is the natural envelope).
3. **Liquibase** (**[`liquibase_conventions.md`](../references/liquibase_conventions.md)**): changesets `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`, explicit constraint names, **seed data in Java `@Profile("demodata")`** (never SQL). Add new tables to the `ResetDatabase` TRUNCATE list and add a populator per aggregate (**[`integration_test_framework.md`](../references/integration_test_framework.md)**).
4. **FE client:** add `frontend/src/lib/fuelApi.ts` mirroring `biometricsApi.ts` (`apiFetch`, `satisfies` on request bodies, contract types from `api.gen.ts`).
5. **Hooks:** rewrite the nine Fuel hooks in `hooks.ts` to branch `isMockMode() ? mockConst : fuelApi.x()` with `useQuery`/`useMutation` + `initialData` for synchronous mock parity — **copy `useWeight` (`weightHooks.ts:11`) exactly. Do not touch view/component signatures.**
6. **Config** (**[`configuration_conventions.md`](../references/configuration_conventions.md)**): scoring dimension weights, the kcal floor (hardcoded `2500` in `FuelMaiView`), and `weeklyStats` factors must become `mezo.*` `@Validated` properties — never `@Value`, never literals.
7. **Tests** (**[`testing_standards.md`](../references/testing_standards.md)** + **[`integration_test_framework.md`](../references/integration_test_framework.md)**): integration-first (`@SpringBootTest` + Testcontainers PG, AssertJ, populators), an ownership-isolation test per owned entity. FE: add MSW handlers for real-mode hook tests; keep **both** mock and real modes green.
8. **Docs:** an **ADR** in `docs/decisions/` for the scoring/jsonb-envelope decision; update **[`docs/milestones/roadmap.md`](../milestones/roadmap.md)** when the slice lands.

**Within the mock layer** (no backend), the established recipes are: add a logged metric → extend the type in `data/types.ts` + the const in `data/fuel.ts`/`fuelWeek.ts`/`pantry.ts`; add a Stack reasoning branch → extend `buildProtocol.ts` (keep the empty-selection-yields-zero-slots invariant); add a pantry source → extend `PantrySourceKey` + `pantrySources` (`data/pantrySources.ts`); add a sub-tab → add a route child in `router.tsx`, a label in `FuelSubNav.tsx`, and a view in `views/`.

## 8. Testing

Fuel ships ~26 test files (data + views + components + sheets + helpers), all run against mock data (no MSW yet, since hooks are mock-only). Notable:
- `features/fuel/buildProtocol.test.ts` — asserts non-empty selection yields `slots`/`reasoning`/`mealMatches > 0`, and **empty selection → 0 slots** (the empty-selection contract).
- `features/fuel/kamraItems.test.ts` — unified-item merge + stash de-dup.
- View tests: `views/Fuel{Mai,Plan,Stack,Recipes,Kamra}View.test.tsx` (the Kamra test covers navigate-on-card-click + the category-filter sheet AND-filtering) and `views/KamraItemDetailView.test.tsx` (renders macros+nutrients, missing-id fallback, Szerkesztés opens the editor, Törlés deletes via the unprefixed backend id for both food and stash and navigates back).
- Sheet tests: `MealScoreSheet`, `ReplanSheet`, `RecipeDetailSheet`, `NewRecipeSheet`, `StackPickerSheet`, `ImportItemSheet`, `AddPantryItemSheet` (real `usePantry` cache append on add; edit round-trips name + extended-nutrition + price), `GymScheduleSheet`.
- Component tests: `FuelTimeline`, `MacroHero`, `RecipeCard`, `RetaWeekStrip`, `WeekRhythmGrid`, `kamraCards`, `weekWidgets`, `FuelSubNav`.
- Data tests: `data/fuelData.test.tsx`, `data/pantryData.test.tsx`, `data/fuelWeekData.test.tsx`.

Commands (from `frontend/`):
```bash
pnpm test                       # vitest — REAL mode default
VITE_USE_MOCK=true pnpm test    # mock mode — BOTH modes must be green
pnpm parity                     # Playwright parity screenshots vs the prototype
```
When Slice C lands, add MSW handlers so real-mode hook tests exercise `fuelApi`, and add backend ITs per the references above.

## 9. Decisions, gotchas & deferred

- **Everything is mock; the "AI" is theater.** `buildProtocol` is deterministic; meal scores, NOVA classifications, improve-suggestions, replan cascades, and scrape previews are pre-written prose/fixtures. Real intelligence is **🟣 Phase 3** (Spring AI / pgvector / RAG), not in scope for Slice C.
- **Inert mutations.** Stack `"Bekapcsolás · ma"`, Replan apply, New Recipe save, Import `"Polcra"`, Ingredient `"Log"`, and Recipe-detail actions all show UI feedback (toast / phase change / local state) but **never persist**. Stack/Replan deliberately do NOT mutate the global `protocol` (the prototype mutated it; ported here as a read-only `version + 1` display).
- **Hardcoded literals (deliberate prototype fidelity).** kcal floor `2500` (`FuelMaiView`), week title `"Máj 18 – 24"`, `RetaWeekStrip currentDay={3}`, `"conf 0.86"`, the import preview fixture `"Görög joghurt 10%"`. These become config/data in Slice C.
- **`recipes` is module-load-derived, not static** — couples `data/pantry.ts` → `data/fuel.ts` (`recentLogs`/`templateBreakdown` from `fuelDay.meals` + `recipeTemplateBreakdowns`, `pantry.ts:548-573`). The backend must reproduce this recipe↔log linkage server-side.
- **Fuel owns a private copy of the training/volleyball schedule** (`gymSchedule`, `volleyballSessions`) — NOT sourced from the Train backend. Slice C must decide whether to read Train's real schedule or keep Fuel-local.
- **Reta (Retatrutide) cycle** is a load-bearing cross-cutting concept (appetite-aware planning) modeled only as `retaWeek` cells + a `retaDay` scenario param; no real medication-dose tracking yet (planned `medication(_dose)` tables).
- **`DAYS_HU` quirk** (`data/fuelWeek.ts:22`): `['H','K','Sz','Cs','P','Sz','V']` has a duplicate `'Sz'` (Szerda + Szombat) — index-based, matches the prototype.
- **`getScoredMeal` matches by `mealName` string, not id** — fragile if titles diverge between `fuelPlan.slots.mealName` and `fuelDay.meals.title`.

## 10. Key files

- **Views** (`frontend/src/features/fuel/views/`): `FuelMaiView.tsx` (today pacing), `FuelPlanView.tsx` (weekly rhythm), `FuelStackView.tsx` (protocol builder), `FuelRecipesView.tsx` (recipe library), `FuelKamraView.tsx` (pantry list), `KamraItemDetailView.tsx` (pantry item detail page · `/fuel/kamra/:id`).
- **Screen / nav:** `features/fuel/FuelScreen.tsx`, `features/fuel/FuelSubNav.tsx`; routes in `frontend/src/app/router.tsx`.
- **Sheets** (`features/fuel/`): `MealScoreSheet.tsx`, `ReplanSheet.tsx`, `RecipeDetailSheet.tsx`, `NewRecipeSheet.tsx`, `IngredientPickerSheet.tsx`, `StackPickerSheet.tsx`, `ImportItemSheet.tsx`, `AddPantryItemSheet.tsx` (full sectioned add/edit form → `usePantryActions`), `CategoryFilterSheet.tsx` (multi-select pantry category bottom-sheet), `GymScheduleSheet.tsx`. (`IngredientDetailSheet.tsx` was **retired** — the pantry-item detail is now the `KamraItemDetailView` page.)
- **Logic helpers:** `features/fuel/buildProtocol.ts` (deterministic protocol builder), `features/fuel/kamraItems.ts` (unified pantry-item merge), `data/fuel.ts` `getScoredMeal`.
- **Components** (`features/fuel/components/`): `FuelTimeline.tsx`/`TimelineSlot.tsx`, `MacroHero.tsx`, `MacroPanel/MicroPanel/NovaPanel/ContextPanel.tsx` (score dimensions), `DimensionCard.tsx`, `ScoreHero.tsx`, `PacingCard.tsx`, `KamraCard.tsx`, `RecipeCard.tsx`/`RecipeIngredientList.tsx`/`RecipeIngredientRow.tsx`/`RecipeLogsList.tsx`, `ProtocolSlot.tsx`, `ReasoningRow.tsx`, `RecommendationCard.tsx`, `MealMatchRow.tsx`, `SelectedChip.tsx`, `SuggestionCard.tsx`, `SupplementItemRow.tsx`, `SlotCard.tsx`, `PatternRow.tsx`, `RetaWeekStrip.tsx`, `WeekRhythmGrid.tsx`, `WeeklySupplementGrid.tsx`.
- **Recipe data layer (backend-backed, mezo-lns):** `frontend/src/lib/recipeApi.ts` (`list/get/create/update/remove` + `toRequest`/`fromResponse`, `refId↔pantryItemId` re-key), `frontend/src/data/recipeHooks.ts` (dual-mode `useRecipes`/`useRecipeActions`, `['recipes']` + dual-cache invalidate), `frontend/src/data/recipeMacros.ts` (shared `roundMacro`/`lineContribution`/`enrichLine`/`computeRecipeMacros` — the FE half of the mock/real parity contract), `data/nova.ts` `deriveNovaDominant`. MSW: `frontend/src/test/msw/handlers.ts` `/api/recipe` handlers.
- **Mock data:** `frontend/src/data/fuel.ts`, `data/pantry.ts` (recipe seed enriched via `recipeMacros`), `data/pantrySources.ts`, `data/fuelWeek.ts`, `data/nova.ts`; types in `data/types.ts` (lines ~17-80, 93-139, 289-347).
- **Hook boundary:** `frontend/src/data/hooks.ts` (the Fuel hooks + the `usePantry`/`usePantryActions` and `useRecipes`/`useRecipeActions` re-exports) + `useFuelPreview`.
- **Patterns to follow for Slice C:** `frontend/src/lib/biometricsApi.ts`, `data/weightHooks.ts:11` (`useWeight`) / `data/hooks.ts:79` (`useSleep`) / `hooks.ts:40` (`useCheckins`), `backend/.../feature/train/entity/ProvenanceEnvelope.java`, the `docs/references/*.md` house standards.
- **Backend (Recipes, present, mezo-lns):** `backend/.../feature/recipe/{controller,service,repository,entity,dto,mapper}`, `api/feature/recipe/recipe.yml`; spec **[`docs/superpowers/specs/2026-06-23-fuel-recipes-design.md`](../superpowers/specs/2026-06-23-fuel-recipes-design.md)**.
- **Backend (rest of Fuel, planned, not present):** `backend/.../feature/fuel/`, `api/feature/fuel/fuel.yml`, `frontend/src/lib/fuelApi.ts`; spec **[`docs/superpowers/specs/2026-06-10-phase2-backend-design.md`](../superpowers/specs/2026-06-10-phase2-backend-design.md)** (Slice C).
