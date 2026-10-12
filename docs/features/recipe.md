---
title: Recipes (Receptek)
type: feature-domain
status: done
updated: 2026-10-12
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

> One-line: the recipe library at `/fuel/recipes` (Fuel → tab **Konyha** → the „Receptek" row of the Konyha hub; the Konyha tab owns `/fuel/recipes*`) — an owned `recipe` + `recipe_ingredient` aggregate whose lines reference the user's `pantry_item` rows with a frozen per-basis macro/nutrient snapshot, a deterministic mezo-fit score at read, a lazily-materialized AI breakdown, and the stateless Receptműhely AI turn. **Status: ✅ backend + FE dual-mode done.**
>
> **Look and language: Folyadék, bilingual (slice F5, `mezo-n4wf5.5`, 2026-10-12).** The list, the recipe page, its score page, the editor, the Műhely and the ingredient picker are drawn with the Folyadék kit and read in Hungarian and English — see §2 *Folyadék (F5)*. The list is **one recipe per row with per-serving protein / carb / fat grams** (`macros ÷ max(1, servings)`) and per-serving kcal (owner decision of 2026-09-23, kept).
>
> **2026-09-24 — Recipe from a logged meal (`mezo-n9wgg`).** A logged meal's detail page (`/fuel/etkezes/:id`) carries a quiet „Mentsük receptként" door → `/fuel/recipes/muhely?fromMeal=<id>[&d=]`. The Műhely seeds once via `workshopState.mealToDraft`: pantry lines 1:1, estimate lines stay estimates (the save gate makes you „Csere" them), a recipe line expands into its ingredients scaled by `amount / servings` (a since-deleted recipe survives as an estimate), same pantry item + unit merges. Save is a **create**; the logged meal is never touched. A meal that is exactly one recipe line gets „Megnyitom a receptet" instead. Spec: [`2026-09-24-recipe-from-logged-meal-design.md`](../superpowers/specs/2026-09-24-recipe-from-logged-meal-design.md).

## 1. Summary

`RecipeEntity` (`recipe`: name, slot, category `breakfast|lunch|dinner|snack`, servings, prepMins, tags/fitsFor jsonb, `nova_dominant`, `role`, `updated_at`) is the aggregate root over `RecipeIngredientEntity` (`recipe_ingredient`: `pantry_item_id` — a plain UUID FK, `ON DELETE RESTRICT` — amount, unit, note, `line_order`, plus a frozen `snapshot_*` set of `name`/`per`/`basisUnit`/`kcal`/`protein`/`carbs`/`fat` and `fiber`/`sugar`/`salt`/`saturatedFat`). This is the first true `@OneToMany` aggregate in the codebase (`cascade = ALL`, `orphanRemoval = true`, `@OrderBy("line_order")`); soft delete does **not** cascade automatically — `RecipeService.delete` bulk-soft-deletes the lines itself.

Driving specs: [`2026-06-23-fuel-recipes-design.md`](../superpowers/specs/2026-06-23-fuel-recipes-design.md), [`2026-07-19-recipe-ai-breakdown-design.md`](../superpowers/specs/2026-07-19-recipe-ai-breakdown-design.md), [`2026-07-25-recipe-scoring-dimensions-design.md`](../superpowers/specs/2026-07-25-recipe-scoring-dimensions-design.md), [`2026-07-27-recipe-role-scoring-design.md`](../superpowers/specs/2026-07-27-recipe-role-scoring-design.md), [`2026-07-30-recipe-ingredient-overrides-design.md`](../superpowers/specs/2026-07-30-recipe-ingredient-overrides-design.md), [`2026-08-11-recipe-meal-nutrient-freeze-design.md`](../superpowers/specs/2026-08-11-recipe-meal-nutrient-freeze-design.md) ([ADR 0026](../decisions/0026-freeze-nutrient-facts-per-line.md) — note there is a second, unrelated ADR 0026 in this repo, `0026-today-ios-list-language.md`; a known number collision tracked in `mezo-gkic`), [`2026-09-01-receptmuhely-design.md`](../superpowers/specs/2026-09-01-receptmuhely-design.md) (`mezo-92pb`).

## 2. User-facing behavior

### Folyadék (F5, `mezo-n4wf5.5`, 2026-10-12)

Every recipe screen follows the Folyadék page skeleton (title bar → back pill → ONE hero with a verdict sentence and one primary button → numbered card sections). Kit: `@/shared/ui/folyadek`; Fuel-shared liquid pieces: `@/features/fuel/components/folyadek` (mapping table in its `README.md`); area stylesheet **`frontend/src/styles/folyadek-fuel-recept.css`, class prefix `.fc-`** (shared Fuel rules: `folyadek-fuel-kozos.css`, `.fx-`); words: catalog area **`fuelRecept`** (`shared/i18n/messages/fuel-recept.{hu,en}.ts`), shared label maps in `fuelLogika` (`recipeRole`, `recipeSlotFace`). Build target: `docs/design_2.0/prototypes/vilagos/fuel.js`, routes `#w-fuel-receptek`, `recept.<id>`, `recept-uj`, `muhely`, `score.r-<id>`.

| Route · page | Hero (label → graphic → verdict → button) | Numbered sections |
|---|---|---|
| `/fuel/recipes` · `FuelRecipesPage` | „Receptek · amit a legtöbbször ettél": up to four ranked rows (`.fc-top`), each a button to its recipe with a `Level` filled to `timesLogged ÷ the favourite's timesLogged`; nothing eaten yet → the empty `Pot`. Verdict from `useRecipes()` („N recepted van, a kedvencedet M alkalommal etted." / „Még egyik receptedet sem etted." / „Még nincs recepted."). Button „+ Új recept" → `/fuel/recipes/new` | **1 Szűrés** — `Pills` (Mind · the four meal categories from `recipeSlotFace` · Csillagos), each with its count; kalauz anchor `receptek-tabs`. **2 Receptjeid** — one `ItemRow` per recipe: the category glyph, name, a sub-line (meal · minutes · role, never for „Általános" · servings), per-serving kcal, `M3` per-serving macros, a „csillagos" mark and the rating on the ten scale (`St`; „értékelés folyamatban" while `mezoFit.score` is null); empty list / empty filter → `Empty` with „save one" |
| `/fuel/recipes/:id` · `RecipeDetailPage` | Label says the basis (one serving of N / the whole recipe); graphic `NumG` = a `Pot` filled to **one serving's share of the pot** (`100 ÷ servings`, 100 % on the whole basis) beside the kcal of the basis, with servings · time · NOVA and the creation date; verdict = how often and when it was eaten (`timesLogged`, `lastLogged`) or „még nem etted"; button „Ma ettem" opens `LogFlowPage` prefilled; link „Mezo értékelése 9,2 ›" → the score page. `ServingToggle` (per serving / whole) under the text **only when `servings > 1`** | **1 Makrók** (`FuelMacroShareSection`), **2 Hozzávalók** (`FuelIngredientSection`, rows not tappable), **3 Minőség és mikrotápanyagok** (`FuelQualitySection` + `FuelMicroSection`), **4 Mezo jegyzete** (the lazy AI prose through `SafeMarkdown`, the first `fitsFor` chip, the rating row → `/fuel/recipes/:id/ertekeles`), **5 Mit tehetsz vele** (log · „Tovább alakítom a Műhelyben" · today's logs sheet · Szerkesztés · star · two-step delete) |
| `/fuel/recipes/:id/ertekeles` · `FuelRecipeScorePage` | the shared `FuelScoreSurface` (see [`fuel.md`](fuel.md) §2): the eight dimensions as eight vials, the weakest amber; header kcal is **per serving** | dimension sheets; not-found and „még nincs" / „készül" faces |
| `/fuel/recipes/new`, `/fuel/recipes/:id/edit` · `RecipeEditorPage` | `NumG` with a `Pot`: „A fazék még üres." / „Egy adag az egész fazék." / „Egy adag a fazék fele / N-ed része."; the numbers are computed from the lines | **1 Alapok** (név, **Étkezés** — the former „Slot" —, csillag, szerep, adag, idők), **2 Hozzávalók (n)** (`EditLine` rows, amounts through `useAmountText`; „+ hozzávaló" opens `IngredientPickerSheet`), **3 Címkék** (a removable `Pill` per tag + the inline tag input, Enter adds). Save bar = the kit `Page foot` (`.fo-page.has-foot > .fo-foot`): Mégse · Mentés |
| `/fuel/recipes/muhely[?recipeId=｜?fromMeal=&d=]` · `RecipeWorkshopPage` | empty canvas: the empty `Pot` and the „how we work" section; with a draft: `Pot` filled to **the share of lines that already come from the pantry**, verdict = the save gate in words („N sor még becslés, addig nem menthető." · „Adj nevet…" · „Menthető: minden sor a kamrádból jön." · „Menthető: a recepted frissül, nem másolódik."); **save sits on the hero** („Mentés a Receptek közé") | **Hozzávalók (n)** (`WorkshopIngredientRow`: pantry / estimate tags, „Csere" → the picker; a line the last turn changed keeps an amber edge for 2,6 s), **Makrók és minőség** (the same `FuelQualityBlocks` sections as the recipe page, computed from the draft), the steps as an open list, **Kérj módosítást** — `WorkshopChatDock` is a CARD of the page (goal pills, the request's pantry context as `RemoveChips`, the composer with the mic tile, the last reply, „open the thread") — there is no floating bar |

Sheets, all `<Sheet className="fo-sheet" labelledBy>` + `FoSheetHead` (no glass variant): the recipe's logs (`fc-logsheet`, `RecipeLogsList` — today's logs only, with the per-log overrides), the Műhely thread (`fc-thread`), the ingredient picker (`fo-sheet sheet-nested fc-pick`: search, kind pills, rows with the square „+").

States drawn and tested: list empty / empty filter / loading (`RecipesSkeleton`); recipe not found, whole basis, rating pending („Mezo értékeli"), re-rating in the background (the stale prose is NOT shown as ready), no reading, never eaten, delete armed; editor empty / edit / whole basis / not found; Műhely empty, busy, error + retry, context chips, an unresolved pantry line, `?fromMeal`.

**Kept behaviours worth pinning.** `RecipeEditorPage` create = edit on one full page; edit-save and the Műhely's „Recept frissítése" pop back onto the recipe, create-saves and delete replace the entry with `/fuel/recipes` (`useLeaveAfterMutation`, §9); the Műhely seeds once from `?recipeId` / `?fromMeal` and saves through the normal editor path (an estimate line blocks the save until swapped); goals `high_protein | pre_workout | post_workout | before_bed | breakfast`; **„Frissítettem a vázlatot."** is the fallback reply when the model changes nothing narratable; ingredient rows are not tappable; a saved recipe shows no „becslés" row.

**Wording changed with the look** (prototype = build target): recipe field „SLOT" → **„Étkezés"** / "Meal"; filter and editor „Vacsi" · „Snack" → „Vacsora" · „Uzsonna"; row „Pontszám" / „AI értékelés" → **„Mezo értékelése"** / "Mezo's rating"; „Iterálás a Műhelyben" → „Tovább alakítom a Műhelyben"; „Mentés a Receptkönyvbe" → „Mentés a Receptek közé"; „kamra-item" → „kamra-tétel", „patch" → „javítás"; picker head „Kamra · pick" → „Kamra · hozzávaló".

**Deliberate deviations from the prototype:** the recipe hero carries the link „Mezo értékelése 9,2 ›" instead of a score chip; the basis switch shows only above one serving; the Műhely dock is a page card, its steps an open list and save is on the hero's liquid; the composer text is 16 px (no zoom on focus); the amber „changed line" mark is kept. The quick-log button of the shell is hidden on the editor routes (the floating foot owns that corner).

**Not converted / leftovers:** the mic tile inside the composer is the shared `VoiceField` (old look, Hungarian aria — F8); `components/RecipeFitBadge.tsx` (+ its test) has no importer left and waits for the F9 sweep (the list prints the rating as text). In English mode recipe, ingredient and tag names, notes and an already-written AI note stay as written; `RecipeResponse.createdDate` is an ISO instant the client formats (`fmtDate`), `lastLogged` is formatted on the client too — the mock must return the same shapes ([`_platform-language.md`](_platform-language.md) §3 *Mock mode*).

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

**Companion source access:** Chat can read complete recipe records and ingredient snapshots through the full-source reader. Summary tools explicitly report partial list coverage. See [companion source access](companion.md#complete-personal-source-access-mezo-rj21410) for ownership, pagination and continuation rules.

- **Pantry** — every line FK's `pantry_item`; definition reads (name/macros/NOVA/category at score time) go through `item.getCatalog()`. Deleting a pantry item is RESTRICTed by the FK (a live recipe line blocks a hard delete); soft-delete only hides the item from new line resolution — an existing line's frozen snapshot survives, but the fit score degrades honestly once the item can no longer be re-resolved. See [`pantry.md`](pantry.md) §5. **Macros are honestly nullable (`mezo-6omv`, `mezo-xaq5`)** — `PantryMacros`' fields are nullable on the wire and the read model no longer fabricates `""`/`0` defaults for a definition that simply has no value, so a recipe line built on an unmeasured item renders „nincs adat" instead of a plausible-looking zero. Consumers (including `RecipeEditorPage`) must null-guard rather than arithmetic on a missing macro.
- **Meal** — `MealService`'s recipe arm computes the per-serving rollup (`MealService.perServing`), applies `recipe_overrides` keyed by `lineOrder` with a `pantryItemId` consistency check, and drives `RecipeLogs`.
- **Nutrition** — `MealScoringService.recipeFit`/`ScoredLine` (shared with the logged-meal scorer, see [`fuel.md`](fuel.md) §9).
- **Companion** — every LLM call is behind a consumer-owned port ([ADR 0012](../decisions/0012-consumer-owned-llm-ports.md)); `LlmCallContextHolder` feeds the llm-usage audit log.
- **The frozen `meal ↔ recipe` ArchUnit cycle** (`archunit-store`) — `feature/recipe` must never import `feature/meal`. This is exactly why `PantryNameIndex` moved from `feature/meal` to `feature/pantry` in S4: both `MealAiDraftService` and `RecipeWorkshopService` need the same name-match logic, and pantry is the only slice both can depend on without creating a `recipe → meal` edge.

## 6. How to use it (consume)

`useRecipes()`/`useRecipeActions()` from `@/data/hooks`; `recipeMacros.ts` pure helpers (`computeRecipeMacros`, `computeRecipeNutrients`, `lineContribution`, `factsOf`) for FE-side derived totals; `pantryImpact.ts`'s `recipesUsingPantryItem`/`movesRecipeScores` is the rule `usePantryActions` uses to decide which recipe/breakdown caches a pantry write must invalidate (see [`pantry.md`](pantry.md) §3).

## 7. How to extend it

Contract-first as always. A new line field = migration + `RecipeIngredientEntity` + `RecipeMapper` + `recipeApi.fromResponse`. A new scoring dimension goes in `MealScoringService` (see [`fuel.md`](fuel.md) §9 for the shared meal/recipe rubric). A new Workshop rule belongs in `RecipeWorkshopValidator` (pure, unit-tested) — never encode a new invariant in the prompt alone.

## 8. Testing

Backend: `RecipeApiIT`, `RecipeServiceIT`, `RecipeRepositoryIT`, `RecipeMapperTest`, `RecipeMapperOverrideRollupTest`, `RecipeBreakdownApiIT`, `RecipeBreakdownFallbackApiIT`, `RecipeBreakdownProseServiceTest`, `RecipeWorkshopApiIT` (+ `RecipeWorkshopLlmUnavailableApiIT`, `RecipeWorkshopSwitchOffApiIT`), `RecipeWorkshopValidatorTest`. FE: `recipeHooks.test.tsx`, `recipeApi.test.ts`, `recipeMacros.test.ts`, the page tests (`FuelRecipesPage`, `RecipeDetailPage`, `RecipeEditorPage`, `RecipeWorkshopPage` — they assert the Folyadék structure: the hero, the numbered sections, `.fo-foot` for the editor's bar, `fo-sheet` for the three sheets) and `pages/RecipePages.en.test.tsx` (English render + a runtime switch on one node). Structure guards outside the feature: `shared/ui/sheetGlassGuard.test.ts` (the recipe sheets carry no glass class), `tests/layout/layout.spec.ts`. Both frontend modes must stay green (`VITE_USE_MOCK=false pnpm test` and `VITE_USE_MOCK=true pnpm test`).

## 9. Decisions, gotchas & deferred

- **Back control = „vissza oda, ahonnan jöttél" (Folyadék F1, `mezo-n4wf5.1`, 2026-10-09).** This area's pure-navigation back handlers (`PageHead` / `FrameBack`) now pass `history` + a `fallback` route (the route the page used to hard-code): inside the app frame the shell title bar draws the back control and it pops history when there is in-app history, else goes to the fallback; the page draws its own button only where no title bar is mounted, so back-chip labels in this doc describe that fallback button. Stateful backs (wizards, replace/state navigations, inline closers) keep their own handler. See [`_platform-design-system.md`](_platform-design-system.md) §3 *The frame*.

- **After a save or a delete the form does not stay behind the user (Folyadék F1 final review, `mezo-n4wf5.1`, 2026-10-09).** With a history-based back, a post-mutation `navigate(...)` that PUSHED left the editor — or the deleted record — one Vissza away. The leave now replaces the current entry or pops (`useLeaveAfterMutation` in `shared/hooks/useBackNav.ts`, rules in `shared/lib/backNav.ts`; see [`_platform-design-system.md`](_platform-design-system.md)). Destinations are unchanged. `RecipeEditorPage` edit-save and `RecipeWorkshopPage` „Recept frissítése" POP back onto the recipe's page they are only ever opened from (`leave.back`), so one Vissza from there is the list; the create-saves and `RecipeDetailPage`'s delete REPLACE the current entry with `/fuel/recipes`. Pinned by `tests/layout/navigation.spec.ts` („Vissza after a save or a delete…").

- **For how these screens LOOK, the canon is the Folyadék style bible** ([`2026-10-09-folyadek-style-bible.md`](../design_2.0/2026-10-09-folyadek-style-bible.md), appendix F5) and the prototype's Fuel file; §2 *Folyadék (F5)* maps each screen to its pieces. The earlier skins (Titanium, the restored Mozaik/Clay world, Üveg) changed no route, hook, contract, mutation or state machine and are superseded.

- **Snapshot freeze (mezo-m6uv) vs. live NOVA/category** — a deliberate split: macros/nutrients are frozen at save time so a recipe's numbers never silently drift when the pantry item's facts change, but NOVA/category are read live because they gate the fit rubric's ultra-processed-food dimension, which the design wants reactive to a pantry correction.
- **Fit is computed at READ, not persisted** — `recipe.fit_score` is reserved but unused; recomputing on every read keeps it consistent with any live-input drift without a cache-invalidation protocol.
- **`servings` is clamped 1..12 in the Workshop**; `maxLines`/`maxSteps`/`maxHistoryTurns` come from `RecipeWorkshopProperties`.
- **The S4 auto-add-at-turn-time trade-off**: like the Meal AI draft (see [`pantry.md`](pantry.md) §9), a Workshop turn that matches a catalog name puts the definition on the caller's shelf immediately — a discarded draft still leaves that shelf row behind.
- A literal `"Daniel:"` string that used to live in `buildUserMessage` was removed in S6's persona work ([`_platform-auth-security.md`](_platform-auth-security.md) §4) — every prompt site now carries `{{NÉV}}` via `PromptPersona`.
- **Deferred:** nothing epic-scale is currently deferred on the recipe side beyond the general Phase-3 AI-brain items tracked in [`insights.md`](insights.md).

- **Server words follow the account language (slice F5, `mezo-n4wf5.5`).** The workshop's fallback reply and the default draft name are bundle keys (`RECIPE_WORKSHOP_REPLY_FALLBACK`, `RECIPE_WORKSHOP_DEFAULT_NAME`); the three `RECIPE_WORKSHOP_*` error codes had no bundle sentence at all (the client received the bare code as `message`) and now have one in both languages. The template score's labels and sentences come from `MealScoringService` (`FUEL_SCORE_*`, rendered on read). The workshop and the breakdown-prose prompts send an English account a variant without the demand for Hungarian (`SYSTEM_PROMPT_HEAD_NEUTRAL`, `SYSTEM_PROMPT_NEUTRAL`). A recipe's cached AI envelope (`recipe.breakdown`, `fits_for`) stays in the language it was written in until its numbers change. `RecipeResponse.createdDate` is an ISO instant and `lastLogged` a constant „—": the client formats. Pattern: [`_platform-language.md`](_platform-language.md) §3 *Server-written sentences*.

## 10. Key files

- **Backend:** `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/{entity/RecipeEntity,entity/RecipeIngredientEntity,repository/RecipeRepository,repository/RecipeIngredientRepository,mapper/RecipeMapper,service/RecipeService,service/RecipeBreakdownService,service/RecipeBreakdownProseService,service/RecipeWorkshopService,service/RecipeWorkshopValidator,controller/RecipeController,controller/RecipeWorkshopController}.java`
- **Contract:** `api/feature/recipe/recipe.yml`
- **Design source:** the Folyadék prototype `docs/design_2.0/prototypes/vilagos/fuel.js` (routes `receptek`, `recept.<id>`, `recept-uj`, `muhely`, `score.r-<id>`); the build plan [`2026-10-12-folyadek-f5-fuel.md`](../superpowers/plans/2026-10-12-folyadek-f5-fuel.md) (area H); the pre-Folyadék editor mock is archived at `docs/archive/design-v1/recipes-editor.html`.
- **FE data:** `frontend/src/data/fuel/{recipeApi,recipeHooks,recipeMacros,pantryImpact,queryKeys}.ts`
- **FE views/sheets/components:** `frontend/src/features/fuel/pages/{FuelRecipesPage,RecipesSkeleton,RecipeDetailPage,RecipeEditorPage,RecipeWorkshopPage,FuelRecipeScorePage}.tsx`; `components/{RecipeLogsList,RecipeOverrideRow,ServingToggle,FuelQualityBlocks,FuelScoreSurface}.tsx`, `components/workshop/{WorkshopChatDock,WorkshopIngredientRow}.tsx`; `sheets/{IngredientPickerSheet,ReceptPickSheet}.tsx`; the Fuel-shared liquid pieces `components/folyadek/` (`Pot`, `NumG`, `M3`, `ItemRow`, `EditLine`); `logic/{recipeRole,recipeSlotFace}.ts`. Dead, left for F9: `components/RecipeFitBadge.tsx`. (`RecipeCard`, `RecipeIngredientList` / `Row`, `RecipeScoreSheet` are deleted.)
- **FE style / words:** `frontend/src/styles/folyadek-fuel-recept.css` (`.fc-`), `frontend/src/styles/folyadek-fuel-kozos.css` (`.fx-`); `frontend/src/shared/i18n/messages/fuel-recept.{hu,en}.ts`.
- **Tests:** `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/*.java`; `frontend/src/features/fuel/pages/{FuelRecipesPage,RecipeDetailPage,RecipeEditorPage,RecipeWorkshopPage}.test.tsx`, `RecipePages.en.test.tsx`
- **Docs/specs:** [`pantry.md`](pantry.md), [`fuel.md`](fuel.md), the six driving specs listed in §1, [ADR 0012](../decisions/0012-consumer-owned-llm-ports.md)
