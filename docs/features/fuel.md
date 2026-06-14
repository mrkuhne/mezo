# Fuel (Nutrition) — Feature Documentation

> The `/fuel` tab — meal pacing, supplement stack/protocol, pantry (Kamra), recipes, and a weekly fuel rhythm. **Status: 🔶 mock-only** (Phase 1 FE done; Phase 2 backend **Slice C · Fuel not started**; AI scoring/replan/import is 🟣 Phase-3-planned, simulated client-side today).

## 1. Summary

Fuel is mezo's nutrition domain: five sub-views under the bottom-nav route `/fuel` covering today's meal/supplement **pacing** (`"Mai"`), the weekly **plan/rhythm** (`"Terv"`), an AI supplement-**protocol** builder (`"Stack"`), a **recipe** library (`"Receptek"`), and a **pantry/shelf** (`"Kamra"`). It exists to turn training + medication context (notably the **Retatrutide** appetite-cycle) into appetite-aware, time-boxed nutrition guidance.

**Status per layer:**
- **FE mock:** ✅ complete — all five views, all sheets, all nine hooks (`frontend/src/data/hooks.ts:164-198`) return static mock data synchronously.
- **FE real:** ❌ none — there is no `isMockMode()` branch, no `fuelApi.ts` client, no TanStack `useQuery` for any Fuel hook (contrast `useGoals`/`useSleep` at `hooks.ts:80-129`, which do branch).
- **Backend:** ❌ none — `backend/.../feature/` has only `auth`, `biometrics`, `train`; `api/feature/` has no `fuel` fragment. The only nutrition references in backend/API are forward-looking comments (`ProvenanceEnvelope.java:10`: "Fuel reuses this pattern for meal score"; `api/openapi.yml` `mealToSleep` "always 0 until Fuel lands").

Driving design: **[`docs/superpowers/specs/2026-06-10-phase2-backend-design.md`](../superpowers/specs/2026-06-10-phase2-backend-design.md)** (Slice C · Fuel: `food_item`/`meal`/`meal_item`/`recipe`/`supplement_intake`/`medication(_dose)`/`nutrition_targets` + a fuel-timeline **view**, wiring these same nine hooks). Fuel is sequenced **after** Train deliberately because Train de-risks the typed-jsonb provenance-envelope pattern (`@JdbcTypeCode(SqlTypes.JSON)`) that Fuel's meal `score` will reuse. Roadmap: **[`docs/milestones/roadmap.md`](../milestones/roadmap.md)**.

## 2. User-facing behavior

`/fuel` renders `FuelScreen.tsx` with a sub-nav (`FuelSubNav.tsx`); routes declared in `frontend/src/app/router.tsx`:

| Route | Sub-nav label (HU) | View | What the user does |
|---|---|---|---|
| `/fuel` (index) | `"Mai"` | `FuelMaiView` | Today's pacing |
| `/fuel/plan` | `"Terv"` | `FuelPlanView` | Weekly rhythm |
| `/fuel/stack` | `"Stack"` | `FuelStackView` | Supplement protocol |
| `/fuel/recipes` | `"Receptek"` | `FuelRecipesView` | Recipe library |
| `/fuel/kamra` | `"Kamra"` | `FuelKamraView` | Pantry / shelf |

**`"Mai"` (`FuelMaiView`):** eyebrow `"Fuel · Mai"` / title `"Pacing"`; a `RetaPhaseBar` (Reta-cycle phase); a context strip of `StatCell`s (gym/volleyball/coffee-cutoff/kitchen-close); a `MacroHero` (targets vs consumed); a `PacingCard`; a protocol-meta row showing `Stack · v{protocol.version} · {builtAt}` with a **Replan** button; the meal+supplement **`FuelTimeline`** (each slot a `TimelineSlot`). Tapping a scored meal calls `getScoredMeal(slot)` and opens the **`MealScoreSheet`** (the 0–1 AI score broken into 4 dimensions — see §4). Bottom: weekly micronutrient `ProgressBar`s. The Replan button opens **`ReplanSheet`**.

**`"Terv"` (`FuelPlanView`):** weekly stats card (kcal avg, protein-hit days, stack adherence, gym+sport count); a `RetaWeekStrip` (7-day Reta cycle, `currentDay={3}` hardcoded); the **`WeekRhythmGrid`** — a 24h-axis week grid merging gym sessions + volleyball per day with coffee-cutoff (14:00) and kitchen-close markers; recurring `PatternRow`s; a `WeeklySupplementGrid`. Gym times are editable via **`GymScheduleSheet`** (`onSave` lifts edits into local state; **no persistence**). Title `"Máj 18 – 24"` is hardcoded.

**`"Stack"` (`FuelStackView`):** an AI supplement-protocol builder. Default selection = all non-medication stash items; toggling chips re-runs `buildProtocol(selectedIds, stash)`. Sections: context summary (`StatCell`s + `ToolChipRow`), a Mezo narrative, the active stack (`SelectedChip`s + **`StackPickerSheet`**), AI-generated timing (`ProtocolSlot`s), reasoning (`ReasoningRow`s), recommendations (`RecommendationCard`s), meal matches (`MealMatchRow`s). The CTA `"Bekapcsolás · ma"` toasts `v{protocol.version + 1}` but **does not mutate** any global protocol (intentionally inert).

**`"Receptek"` (`FuelRecipesView`):** `"Saját szakácskönyv"` — controlled search + filter chips (`all/breakfast/lunch/dinner/snack/starred`), a `RecipeCard` list, empty-state. `RecipeCard` → **`RecipeDetailSheet`** with three tabs: **Score-bontás** (`DimensionCard`s), **Hozzávalók** (`RecipeIngredientList`), **Logok** (`RecipeLogsList`), plus a baseline-vs-log score-delta hero. **`NewRecipeSheet`** composes a recipe from Kamra ingredients with live macro totals (grams scale by `amount/per`) via a nested `IngredientPickerSheet` — **Save is a skeleton** (`onClose()` only). `"Avg fit 0.89"` is hardcoded.

**`"Kamra"` (`FuelKamraView`):** the pantry. `buildKamraItems(ingredients, stash)` produces a unified `PantryItem[]` (food + supplements + stimulants + medication). Type filters (`all/food/supplement/stim/med`) + source filters (`all/kifli.hu/myprotein.hu/tesco.hu/manual`) + search; cards grouped by category. Stats: total items, food count, low-expiry, low-stock. A scrape-feed card shows the last 3 imports; `SuggestionCard`s surface `pantrySuggestions`. A card opens **`IngredientDetailSheet`** (macro hero OR supplement protocol, micro-density bars, stock+price, used-in-recipes list, scrape footer; actions inert). **`ImportItemSheet`** is a 3-phase scrape wizard (input → scraping with auto-advancing steps → preview of a **hardcoded fixture** `"Görög joghurt 10%"`); `"Polcra"` just closes.

## 3. Architecture & data flow

The single FE↔data boundary is `frontend/src/data/hooks.ts`. For Fuel the path **stops at mock data** — no API, no `isMockMode()`, no TanStack Query:

```
View (features/fuel/views/*.tsx)
  → useFuelDay / useFuelTimeline / useStack / useProtocol / usePantry
    / useRecipes / useFuelWeek / useReplanScenarios / useStackRecommendations   (hooks.ts:164-198)
      → returns imported static consts:
          data/fuel.ts        (fuelDay, fuelPlan, supplementsStash, protocol, getScoredMeal)
          data/pantry.ts      (ingredients, recipes[derived], pantryCategoryMeta, pantryImports, pantrySuggestions)
          data/pantrySources.ts (pantrySources)
          data/fuelWeek.ts    (retaWeek, gymSchedule, weeklySupplements, recurringPatterns,
                               weeklyStats, replanScenarios, stackRecommendations)
      → NO isMockMode(), NO apiFetch, NO useQuery
```

Each Fuel hook is a one-liner spread of imported consts — e.g. `useFuelDay()` is just `{ fuel: fuelDay }` (`hooks.ts:165`); `useFuelTimeline()` returns `{ plan: fuelPlan.today, getScoredMeal: (s) => getScoredMeal(s, fuelDay.meals) }` (`hooks.ts:169`). Compare `useGoals` (`hooks.ts:80-102`), which branches `mock ? initialWeightLog : weightApi.list` inside `useQuery`. **When Slice C lands the seam is exactly these nine hooks** — they gain the `isMockMode() ? mockConst : fuelApi.x()` branch + `useQuery`/`useMutation` (+ `initialData` for mock parity), identical in shape to `useGoals`. **View and component signatures must not change** — that is the Phase-2 contract.

**Two pure "AI" helpers** carry the simulated intelligence (deterministic, not data):
- `features/fuel/buildProtocol.ts` — `buildProtocol(selectedIds, stash): BuiltProtocol`. Builds timed `slots`, `reasoning[]`, and a fixed `mealMatches[]` from the selected stash ids. Reta/meso context is **hardcoded into the strings**; the only live input is the selection. Pre-snack slot is gated on `items.length > 0` so an **empty selection yields zero slots** (`buildProtocol.ts:46`, test-enforced).
- `features/fuel/kamraItems.ts` — `buildKamraItems(ingredients, stash): PantryItem[]`. Merges scraped food ingredients + the supplement stash into one `PantryItem[]`, **de-duping** stash items already present as an ingredient via `Ingredient.stashRefId` (`kamraItems.ts:17-18`; `ing-whey`/`ing-kreatin`/`ing-aakg` carry a `stashRefId` to avoid double cards).

**Derived data — `recipes` is NOT a plain const.** In `data/pantry.ts:548-573`, `recipesBase` is enriched at module load: each recipe gets `recentLogs` (mirrored from logged `fuelDay.meals` via the recipe-link mapping) and a `templateBreakdown` (the linked meal's breakdown, or a standalone `recipeTemplateBreakdowns[rec-3/5/6]`). This couples `data/pantry.ts` → `data/fuel.ts` (it imports `fuelDay`). A real backend must reproduce this recipe↔log linkage server-side.

## 4. Data model & API

**No tables, DTOs, or endpoints exist yet.** All Fuel types are FE TypeScript in `frontend/src/data/types.ts`. Key shapes:

- **`FuelSlot`** (`types.ts:19-30`): one timeline entry — `kind: FuelKind` (`'wake'|'meal'|'midday'|'snack'|'preworkout'|'workout'|'sport'|'evening'`), `state: 'done'|'now'|'pending'`, optional `mealName`/`mezoNote`/`windowTip`, macros, `items: SlotItem[]` (`SlotItem` = `{type:'supplement', refId, label, done, primary?, note?}`).
- **`FuelPlanToday`** (`types.ts:31-36`): `workout`/`volleyball` blocks, `bedtime`/`kitchenClose`/`caffeineCutoff`, `slots[]`.
- **`MealDimension`** discriminated union (`types.ts:39-45`) — the four weighted scoring dimensions: `MacroDimension` (macroRatio/macroTargets/kcalShareOfDay), `MicroDimension` (`micros[]` with `MicroStatus 'good'|'ok'|'low'`), `NovaDimension` (food-processing class `NovaGroup 1|2|3|4`), `ContextDimension`. All share `MealDimensionBase` (label/weight/score/color/detail).
- **`MealBreakdown`** (`types.ts:46-52`): `confidence`, `summary`, `dimensions[]`, `improve[]`, `tools[]` (`ToolType 'read'|'compute'|'write'` — the transparency list). **This is the natural jsonb envelope** when Fuel lands (the `MealBreakdown` ⇒ meal `score` typed-jsonb mapping reuses Train's `ProvenanceEnvelope` pattern).
- **`FuelMeal`** (`types.ts:53-59`), **`FuelDay`** (`types.ts:62-68`): `targets`/`consumed` (`MacroSet` incl. `water`), `meals[]`, `pacing`, `micronutrients`, `supplements` (`FuelSummary`).
- **`SupplementStashItem`** (`types.ts:70-74`): `type 'supplement'|'stimulant'|'medication'`, category, dose, form, stock, protocol, timing, taken, `caffeine?`.
- **`Protocol`** (`types.ts:75-79`): `version`/`builtAt`/`source`/`status`/`itemCount`/`confidence`/`lastReplanReason`/`history[]`.
- **Pantry:** `Ingredient` (`stashRefId?`, `nova`, `micros`, `source: PantrySourceKey`), `Recipe` (incl. derived `recentLogs?`/`templateBreakdown?`), `RecipeLog`, `PantryImport`/`PantrySuggestion`, unified **`PantryItem`** (`kind 'food'|'supplement'|'stim'|'med'`).
- **Weekly:** `RetaPhase`/`RetaDayCell`, `GymScheduleDay`, `WeeklySupplementRow`, `RecurringPattern`, `ReplanScenario`/`ReplanCascade` (cascade `system: 'Fuel'|'Train'|'Sleep'|'Insights'`, `types.ts:304`), `StackRecommendation`.
- **Stack builder:** `ProtocolSlotItem`/`ProtocolSlotData`, `Reasoning` (`kind 'physiology'|'timing'|'interaction'|'sleep'`), `MealMatch`, `BuiltProtocol`.
- Supporting: `data/nova.ts` (`NovaGroup`, `NOVA_META`, `STATUS_COLOR`), `data/pantrySources.ts` (`PantrySourceKey = 'kifli.hu'|'myprotein.hu'|'tesco.hu'|'auchan.hu'|'manual'`).

**Where the backend plugs in (planned, contract-first):** a new `api/feature/fuel/fuel.yml` fragment → merged `api/openapi.yml` → FE types in `frontend/src/lib/api.gen.ts` + BE `io.mrkuhne.mezo.api` interfaces/DTOs. Expected endpoints `GET/POST /api/fuel/*` (day, timeline, pantry, recipes, stack, protocol) per **[`docs/references/api_contract_conventions.md`](../references/api_contract_conventions.md)**. Tables per the design spec: `food_item`/`meal`/`meal_item`/`recipe`/`supplement_intake`/`medication(_dose)`/`nutrition_targets` + a fuel-timeline view, UUID PKs, `OwnedEntity` + `created_by`, soft delete, meal `score` as typed jsonb.

## 5. Integrations

Fuel is the most cross-coupled mock domain. Each seam below names the **contract** (the type/shape that crosses):

- **Today → Fuel preview (Today consumes Fuel).** `useFuelPreview` (`hooks.ts:67-74`) slices `fuelToday.slots` (the next 3 from `state==='now'`) + finds the next pending supplement stack — consumed by the Today screen's fuel card. Crossing type: `FuelSlot[]`. Note `fuelToday` is re-exported from `data/today.ts` (which re-exports it from `data/fuel.ts`) and surfaced by `useToday()` (`hooks.ts:37-39`), so Today's barrel and Fuel share the **same object**.
- **Today scenario → Fuel Mai (Mai consumes Today).** `FuelMaiView` calls `useTodayScenario()` for `retaDay` (URL-param driven, `hooks.ts:21-30`) and `useToday()` for `today.workoutType`. Crossing types: `TodayScenario`, `TodayMeta`. The URL knobs `?retaDay=` and `?day=` therefore change the Mai view's Reta bar.
- **Me/Goals → Fuel Stack (Stack consumes Me + Goals).** `FuelStackView` reads `useProfile().user.weekInMeso` and `useGoals().linkedMesocycles` (the active mesocycle's `shortTitle`) for the `"Meso W{n}"` context cell. Crossing types: `UserMeta`, the linked-mesocycle map.
- **Train (gym) ↔ Fuel (Fuel owns a private copy).** Fuel's weekly plan models gym sessions (`gymSchedule`, `data/fuelWeek.ts`) and pulls `volleyballSessions` (from `data/today.ts`). These are **Fuel's own copy** of the training schedule, NOT read from the Train domain's mesocycle data. `WeekRhythmGrid` overlays both and derives meal/caffeine/supplement timing from gym times (prose only). Crossing types: `GymScheduleDay`, `VolleyballSession`.
- **Reta (medication) → cross-cutting.** `retaWeek`/`retaDay` is a Fuel-owned concept (the 7-day Retatrutide kinetic cycle: D1-2 Peak → D3-5 Stable → D6-7 Trough) but is surfaced on Today and across all Fuel sub-views. `retaDay` arrives via `useTodayScenario`.
- **Replan cascade → Sleep / Insights / Train (Fuel exposes the ripple model).** `ReplanScenario.cascades[].system` is typed `'Fuel'|'Train'|'Sleep'|'Insights'` (`types.ts:304`); `ReplanSheet` color-codes per system. This is the explicit "context change ripples across domains" model — all simulated prose in `data/fuelWeek.ts`.
- **Supplements ↔ Pantry (internal seam).** `supplementsStash` (`data/fuel.ts`) feeds `useStack`/`useProtocol` AND `usePantry` (`hooks.ts:181`); the Kamra merges the stash into pantry items, de-duping via `Ingredient.stashRefId` (`kamraItems.ts:17-18`).
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

**To make Fuel real (Phase-2 Slice C), use the biometrics slice as the template** (`useGoals` + `frontend/src/lib/biometricsApi.ts` are the proven pattern). Recipe:

1. **Contract-first** (**[`api_contract_conventions.md`](../references/api_contract_conventions.md)**): add `api/feature/fuel/fuel.yml` (endpoints + DTO schemas: FuelDay, MealBreakdown, PantryItem, Recipe, Protocol…). Merge: `cd api/generate && npm run generate:api`; regenerate FE types: `cd frontend && pnpm generate:api`; backend DTOs regenerate in `./mvnw generate-sources`.
2. **Backend** under `io.mrkuhne.mezo.feature.fuel/{controller,service,repository,entity,dto,mapper}` per **[`java_package_structure.md`](../references/java_package_structure.md)** + **[`spring_patterns.md`](../references/spring_patterns.md)**. Entities: `food_item`/`meal`/`meal_item`/`recipe`/`supplement_intake`/`medication(_dose)`/`nutrition_targets` + a fuel-timeline view. UUID PKs, `OwnedEntity` + `created_by`, `@SQLDelete`/`@SQLRestriction`. **Meal `score` → typed jsonb** via `@JdbcTypeCode(SqlTypes.JSON)` onto a typed record — reuse the Train `ProvenanceEnvelope` pattern (`MealBreakdown` is the natural envelope).
3. **Liquibase** (**[`liquibase_conventions.md`](../references/liquibase_conventions.md)**): changesets `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`, explicit constraint names, **seed data in Java `@Profile("demodata")`** (never SQL). Add new tables to the `ResetDatabase` TRUNCATE list and add a populator per aggregate (**[`integration_test_framework.md`](../references/integration_test_framework.md)**).
4. **FE client:** add `frontend/src/lib/fuelApi.ts` mirroring `biometricsApi.ts` (`apiFetch`, `satisfies` on request bodies, contract types from `api.gen.ts`).
5. **Hooks:** rewrite the nine Fuel hooks in `hooks.ts:164-198` to branch `isMockMode() ? mockConst : fuelApi.x()` with `useQuery`/`useMutation` + `initialData` for synchronous mock parity — **copy `useGoals` (`hooks.ts:80-102`) exactly. Do not touch view/component signatures.**
6. **Config** (**[`configuration_conventions.md`](../references/configuration_conventions.md)**): scoring dimension weights, the kcal floor (hardcoded `2500` in `FuelMaiView`), and `weeklyStats` factors must become `mezo.*` `@Validated` properties — never `@Value`, never literals.
7. **Tests** (**[`testing_standards.md`](../references/testing_standards.md)** + **[`integration_test_framework.md`](../references/integration_test_framework.md)**): integration-first (`@SpringBootTest` + Testcontainers PG, AssertJ, populators), an ownership-isolation test per owned entity. FE: add MSW handlers for real-mode hook tests; keep **both** mock and real modes green.
8. **Docs:** an **ADR** in `docs/decisions/` for the scoring/jsonb-envelope decision; update **[`docs/milestones/roadmap.md`](../milestones/roadmap.md)** when the slice lands.

**Within the mock layer** (no backend), the established recipes are: add a logged metric → extend the type in `data/types.ts` + the const in `data/fuel.ts`/`fuelWeek.ts`/`pantry.ts`; add a Stack reasoning branch → extend `buildProtocol.ts` (keep the empty-selection-yields-zero-slots invariant); add a pantry source → extend `PantrySourceKey` + `pantrySources` (`data/pantrySources.ts`); add a sub-tab → add a route child in `router.tsx`, a label in `FuelSubNav.tsx`, and a view in `views/`.

## 8. Testing

Fuel ships ~26 test files (data + views + components + sheets + helpers), all run against mock data (no MSW yet, since hooks are mock-only). Notable:
- `features/fuel/buildProtocol.test.ts` — asserts non-empty selection yields `slots`/`reasoning`/`mealMatches > 0`, and **empty selection → 0 slots** (the empty-selection contract).
- `features/fuel/kamraItems.test.ts` — unified-item merge + stash de-dup.
- View tests: `views/Fuel{Mai,Plan,Stack,Recipes,Kamra}View.test.tsx`.
- Sheet tests: `MealScoreSheet`, `ReplanSheet`, `RecipeDetailSheet`, `NewRecipeSheet`, `StackPickerSheet`, `ImportItemSheet`, `IngredientDetailSheet`, `GymScheduleSheet`.
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
- **Hardcoded literals (deliberate prototype fidelity).** kcal floor `2500` (`FuelMaiView`), week title `"Máj 18 – 24"`, `RetaWeekStrip currentDay={3}`, `"conf 0.86"`, `"Avg fit 0.89"`, the import preview fixture `"Görög joghurt 10%"`. These become config/data in Slice C.
- **`recipes` is module-load-derived, not static** — couples `data/pantry.ts` → `data/fuel.ts` (`recentLogs`/`templateBreakdown` from `fuelDay.meals` + `recipeTemplateBreakdowns`, `pantry.ts:548-573`). The backend must reproduce this recipe↔log linkage server-side.
- **Fuel owns a private copy of the training/volleyball schedule** (`gymSchedule`, `volleyballSessions`) — NOT sourced from the Train backend. Slice C must decide whether to read Train's real schedule or keep Fuel-local.
- **Reta (Retatrutide) cycle** is a load-bearing cross-cutting concept (appetite-aware planning) modeled only as `retaWeek` cells + a `retaDay` scenario param; no real medication-dose tracking yet (planned `medication(_dose)` tables).
- **`DAYS_HU` quirk** (`data/fuelWeek.ts:22`): `['H','K','Sz','Cs','P','Sz','V']` has a duplicate `'Sz'` (Szerda + Szombat) — index-based, matches the prototype.
- **`getScoredMeal` matches by `mealName` string, not id** — fragile if titles diverge between `fuelPlan.slots.mealName` and `fuelDay.meals.title`.

## 10. Key files

- **Views** (`frontend/src/features/fuel/views/`): `FuelMaiView.tsx` (today pacing), `FuelPlanView.tsx` (weekly rhythm), `FuelStackView.tsx` (protocol builder), `FuelRecipesView.tsx` (recipe library), `FuelKamraView.tsx` (pantry).
- **Screen / nav:** `features/fuel/FuelScreen.tsx`, `features/fuel/FuelSubNav.tsx`; routes in `frontend/src/app/router.tsx`.
- **Sheets** (`features/fuel/`): `MealScoreSheet.tsx`, `ReplanSheet.tsx`, `RecipeDetailSheet.tsx`, `NewRecipeSheet.tsx`, `IngredientPickerSheet.tsx`, `StackPickerSheet.tsx`, `ImportItemSheet.tsx`, `IngredientDetailSheet.tsx`, `GymScheduleSheet.tsx`.
- **Logic helpers:** `features/fuel/buildProtocol.ts` (deterministic protocol builder), `features/fuel/kamraItems.ts` (unified pantry-item merge), `data/fuel.ts` `getScoredMeal`.
- **Components** (`features/fuel/components/`): `FuelTimeline.tsx`/`TimelineSlot.tsx`, `MacroHero.tsx`, `MacroPanel/MicroPanel/NovaPanel/ContextPanel.tsx` (score dimensions), `DimensionCard.tsx`, `ScoreHero.tsx`, `PacingCard.tsx`, `KamraCard.tsx`, `RecipeCard.tsx`/`RecipeIngredientList.tsx`/`RecipeIngredientRow.tsx`/`RecipeLogsList.tsx`, `ProtocolSlot.tsx`, `ReasoningRow.tsx`, `RecommendationCard.tsx`, `MealMatchRow.tsx`, `SelectedChip.tsx`, `SuggestionCard.tsx`, `SupplementItemRow.tsx`, `SlotCard.tsx`, `PatternRow.tsx`, `RetaWeekStrip.tsx`, `WeekRhythmGrid.tsx`, `WeeklySupplementGrid.tsx`.
- **Mock data:** `frontend/src/data/fuel.ts`, `data/pantry.ts`, `data/pantrySources.ts`, `data/fuelWeek.ts`, `data/nova.ts`; types in `data/types.ts` (lines ~17-80, 93-139, 289-347).
- **Hook boundary:** `frontend/src/data/hooks.ts:164-198` (the nine Fuel hooks) + `useFuelPreview` (`hooks.ts:67-74`).
- **Patterns to follow for Slice C:** `frontend/src/lib/biometricsApi.ts`, `data/hooks.ts:80-129` (`useGoals`/`useSleep`/`useCheckins`), `backend/.../feature/train/entity/ProvenanceEnvelope.java`, the `docs/references/*.md` house standards.
- **Backend (planned, not present):** `backend/.../feature/fuel/`, `api/feature/fuel/fuel.yml`, `frontend/src/lib/fuelApi.ts`; spec **[`docs/superpowers/specs/2026-06-10-phase2-backend-design.md`](../superpowers/specs/2026-06-10-phase2-backend-design.md)** (Slice C).
