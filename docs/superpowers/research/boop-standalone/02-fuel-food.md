# 02 — Fuel / food / meals / recipes / pantry / nutrition (code map for the Boop standalone re-plan)

Issue `mezo-r36n9.9`, date 2026-11-10. Research only. Paths are relative to the repo root; BE = `backend/src/main/java/io/mrkuhne/mezo/feature`, FE = `frontend/src`.

## TL;DR

1. Food logging is **mature and AI-heavy**: free text / photo -> `POST /api/meal/ai-draft` (one LLM call, DB-matched against the user's pantry + recipes) -> confirm -> `POST /api/meal`. 104 of 183 prod meals (57%) were AI-logged (80 text, 24 photo); recipe/ingredient pickers and "usuals" are the other paths.
2. **Meal evaluation is deterministic first, AI prose second**: `MealScoringService` (940 lines) scores 8 weighted dimensions (macro 0.22, NOVA 0.18, WHO 0.14, context 0.12, portion, fiber, fat quality, plant diversity, energy density) against the **day's goal-derived macro targets**; an async "meal coach" LLM only writes prose + glucose tips. Every prod meal has a score+breakdown (183/183); 63 have the AI verdict.
3. Targets come from the **active weight goal** (`DayTargetProjector`: base + logged movement + goal balance, BMR floor, split from `diet_settings`), falling back to static `mezo.nutrition` config. The meal score IS already goal-aware, incl. kímélő mode and training-role rubrics (pre/post workout).
4. **Allergen / intolerance flags do NOT exist** (item 2): no column, enum, filter or prompt input on pantry/recipe/meal. The only trace is free-text recipe `tags` jsonb (1 of 11 recipes uses it) and a free-text personal fact. The meal-coach prompt even **forbids** naming food sensitivities.
5. **Diet plans, "only these N recipes for 4 weeks", meal plans, shopping lists do NOT exist** (item 3). Closest: `diet_settings` (macro split/protein tier/water/fiber, 1 row in prod), meal-slot templates (0 rows), a client-side day planner (`buildDayPlan.ts`, 724 lines) that suggests recipes per slot. FE source literally notes "B15 bevásárlólista: nem létezik".
6. **Web import is ingredient-only**: product URL scrape (`/api/pantry-import/scrape`, SSRF-guarded, LLM extracts per-100g facts) + nutrition-label photo extract + (backend-only, no FE caller) OpenFoodFacts barcode/text lookup. There is **no recipe URL import**. Prod catalog: 412 food rows; 99 `web`, 10 `photo`, 0 OFF.
7. **Effect tracking of foods on biomarkers does not exist.** `effect_link` (companion) measures people/event-type vs mental/energy/stress only; food detectors (late eating, comfort eating, food-digestion, macro adherence) are correlation signals in the character engine, not per-item biomarker effects.
8. Much food logic lives **only in the web FE** and would have to move for Boop: day planner/timeline, slot-template compile, usual-meals ranking, glycemic band, meal forecast, energy breakdown. Boop's current meal surface is read-only (morning brief `meals[]`, kcal/protein from `FuelDayResponse`).
9. Big adjacent clutter: supplement stack/protocol/placement engine, medication cycle, learned-expenditure learning page, skip/kímélő — real, tested, but unrelated to "food" core; candidates to leave out of Boop v1.
10. Quality: backend is well-tested (92 BE test classes in these 5 slices, 150 FE fuel tests), contract-first OpenAPI; main debts are doc drift, formula-version rescoring machinery, and the 3-way duplicated "extract draft" LLM pattern.

---

## 1. Scope

Covered: BE `fuel`, `meal`, `recipe`, `pantry`, `nutrition` (+ touch-points in `companion/tools/FuelTools`, `companion/llm/*Adapter`, `character/detector/*food*`, `boop/service/BoopDayAssembler`); contracts `api/feature/{fuel,meal,pantry,recipe,diet-settings,fuel-settings,medication}`; FE `features/fuel`, `features/quickinput`, `data/fuel`; docs `docs/features/{fuel,recipe,pantry}.md`; `ios/BoopKit` meal usage; read-only prod DB shape queries (counts only). Not covered in depth: goal engine internals (other mapper), train, companion chat core.

## 2. What exists

### 2.1 Meal logging (BE `feature/meal`, FE `features/fuel`)

| Capability | Where |
|---|---|
| Create/update/delete meal (header + polymorphic lines `recipe`/`pantry`/`estimate` with FROZEN per-line snapshot of macros + fiber/sugar/salt/satFat/NOVA) | `meal/service/MealService.java:90,103,113`; entities `MealEntity`, `MealItemEntity` (`snapshot_*` cols); `POST /api/meal`, `PUT/DELETE /api/meal/{id}` (`api/feature/meal/meal.yml:25-60`) |
| Day / week views (targets, consumed, meals, pacing, energy breakdown, skips, kímélő) | `meal/service/FuelDayService.java:84 (getDay), :128 (getWeek)`; `GET /api/fuel/day/{date}`, `/api/fuel/week/{start}` |
| **AI draft from text and/or photo** (multipart `date`, `text<=2000`, `photo`) | `meal/service/MealAiDraftService.java` (prompt `SYSTEM_PROMPT_HEAD` :58-95), validator `MealAiDraftValidator` (deterministic `confidence`/`needsReview`), `POST /api/meal/ai-draft`; provenance `{origin: manual|ai-text|ai-photo, model, confidence, rawText}` (`entity/MealProvenanceJson.java`); outcome feedback `POST /api/ai-drafts/{draftId}/outcome` |
| Recipe-sourced logging (a recipe line scores per-ingredient, not as a collapsed composite, `FORMULA_VERSION 6`) | `MealService.scoringLines`, `MealCompositeLines.java`; `RecipeOverrideRow` FE (per-line overrides, `MealItemRecipeOverrideJson`) |
| Ingredient-sourced logging (pantry picker, catalog search) | FE `IngredientPickerSheet`, `KamraPickSheet`, `ReceptPickSheet`, `CatalogSearchSheet`; `MealComposer.tsx` (980 lines — the composer for all paths) |
| 4 log entrances: Fotó · Kamra · Recept · Szokásosak (+ always-visible text field, voice transcript lands as text) | FE `components/FuelLogModes.tsx`, `pages/FuelLogNewPage.tsx`, `pages/LogFlowPage.tsx`, `logic/usualMeals.ts` (ranks the user's own history) |
| Quick-log FAB: meal tile opens `/fuel/log/uj?w=<window>` | FE `features/quickinput/QuickLogSurface.tsx` (9 tiles: water/sport/weight/sleep/journal/check-in/meal...) |
| Water log | `meal/service/WaterLogService.java`, `POST /api/water-log`, `DELETE /api/water-log/{id}`; FE `sheets/WaterLogSheet.tsx` (39 rows prod) |
| Meal skip ("Kihagyom/Kihagytam", reason chips) + kímélő-mód fuel (no kcal target while ill/travelling; skipped kcal leave the budget) | `FuelDayService.skippedKcal/isUnjudgedDay` :316,343; FE `sheets/MealSkipSheet.tsx`, `logic/mealSkips.ts`, `logic/fuelMode.ts`; train-owned `PlannedSkipService` |
| Meal timing: slot (breakfast/lunch/dinner/snack) + planner window + eating-time placement | `MealEntity.slot/window_from/window_to`; FE `logic/eatingTimePlacement.ts`, `defaultMealSlot.ts`, `components/MealClock*.tsx` |
| Recipe log history (`GET /api/recipe/{id}/logs`) | `MealService.recipeLogs` :178 |
| Maintenance runners: rescore all meals when the formula version bumps; saturated-fat backfill | `MealRescoreRunner.java`, `MealSaturatedFatBackfillRunner.java`, `PantryTwinSaturatedFatRunner.java` |

### 2.2 AI meal evaluation (BE `nutrition`, `meal`)

* **Deterministic engine** `nutrition/service/MealScoringService.java` (`FORMULA_VERSION = 6`, :99ff): 8 dimensions, weights in `application.yml:2704-2713` (macro .22, micro/fiber .10, WHO .14, fat quality .10, NOVA .18, plant diversity .08, energy density .06, context .12 [meal surface] / portion .12 [recipe template surface]; both subsets sum to 1.0, validated at startup in `MealScoringProperties`). Honesty rules: a dimension with no input coverage degrades to weight 0 / "Nincs adat" and the total renormalises; no kcal -> null score, never fabricated. Role overlay (`MealRole` STANDARD/PRE_WORKOUT/POST_WORKOUT, classified from the day's workout windows `MealScoringService.classifyRole`) swaps absolute macro bundles + WHO + NOVA scores (`mezo.fuel.scoring.roles`). Context dimension is day-aware (remaining budget over remaining slots, `DayContext`, `FuelDayService.dayContext` :390).
* **Scored against:** `FuelDayService.dailyTargets(userId, date)` (:358) -> `DailyTargets{kcal,p,c,f,source goal|config,energy}`; `MealService.applyScore` :250 binds it with the day's workout windows. Results stored in `meal.score` + `meal.breakdown` (jsonb `MealBreakdownJson`).
* **AI prose layer (never changes numbers):**
  * `MealCoachService` (405 lines; prompt :60-116, Hungarian, tegeződő): per meal `tagline` (<=60 chars), `summary`, `improve[<=3]`, per-dimension notes, 0-2 **glucose tips** ("legközelebb laposabb"). Fired **eagerly, async after commit** by `MealCoachEagerListener` on `MealSavedEvent` (cheap-tier model; any failure persists nothing, lazy retry on next sheet open). Prompt context built by `MealCoachPrompt` (317 lines) + `MealCoachContextReader`: **PERSON block** (sex, age, height, weight as-of that day, **active goal trajectory + guards**, sleep, medication, check-ins up to that meal's time), day targets, workouts, the day state *as of that meal's log time*. Endpoints `GET /api/meal/{id}/coach`, `GET /api/meal/coach?date=`.
  * `RecipeBreakdownProseService` (recipe template surface: summary + `fitsFor[]` + per-dimension details + improve), lazily materialised by `GET /api/recipe/{id}/breakdown`.
  * `SlotPlanEvaluationService` (`POST /api/fuel/slot-templates/evaluate`, marker `SLOT-TERV-ERTEKELES`): judges a draft meal-slot split vs goal balance + training placement; stateless.
* **Glucose response band** (alacsony/közepes/magas) is computed in the FE (`logic/glycemicBand.ts`, owner-locked thresholds) AND mirrored byte-for-byte in BE `MealCoachPrompt.glucoseBand` :85 — a deliberate twin, drift risk.
* Prod: 183/183 meals have `score` + `breakdown`; 63 have a coach `summary` (lazy/eager gap, older meals never opened).

### 2.3 Targets (calories / macros / water / fibre)

* Source of truth = **active goal's recept segment** (goal engine; see mapper for goal): `nutrition/service/DayTargetProjector.java:61-` `target = max(BMR, base + Σ net kcal of LOGGED sessions + goalBalance)`; protein from the segment; carbs absorb every kcal delta (`/4`); fat from the segment. `DailyTargets.Energy` always closes (`base + planned + extra + balance = target`). `base` = learned expenditure when available, else BMR×NEAT (`EnergyBase`).
* Static fallback `mezo.nutrition.*` (`NutritionTargetsProperties`: kcal/p/c/f/water; used per field when no goal/segment).
* **`diet_settings`** (one row per user; `DietSettingsEntity`): `split_preset` balanced|low_fat|low_carb|high_carb|custom, `protein_pct_x10/carbs/fat` (custom), `protein_tier` low|moderate|high (1.6/2.0/2.2 g/kg BW), `water_ml`, `fiber_g`, `day_type_shift_kcal`, `learning_enabled`. `GET/PUT /api/diet/settings` + `POST /api/diet/settings/preview` (live draft projection through the SAME projector). Saving re-evaluates the active goal (7th recompute trigger). Resolved by `DietPreferencesResolver` (ungated, implements goal's `DietPreferencesPort`).
* **`fuel_settings`** (mealsPerDay 3..6, caffeineCutoff) `GET/PUT /api/fuel/settings`; **`meal_slot_template`** per day type rest|training_am|training_pm, `slots` jsonb, `PUT/DELETE /api/fuel/slot-templates/{dayType}` (0 rows in prod).
* Kímélő-mode: GUIDANCE (no target), ESTIMATE (informational), MAINTENANCE (deficit dropped) — `DayTargetProjector.project(..., dropDeficit)`.
* Goal side effects: `GoalDailyIntakeAdapter`, `GoalIntakeAdherenceAdapter` feed intake history to the goal engine (adaptive review).

### 2.4 Recipes (BE `feature/recipe`)

* Entities `RecipeEntity` (name, `category` breakfast|lunch|dinner|snack, `servings`, prep/cook mins, **`tags` jsonb (free-text)**, `starred`, `role` MealRole, `nova_dominant`, `fit_score`, `fits_for` jsonb, `breakdown` jsonb) + `RecipeIngredientEntity` (line -> `pantry_item`, amount/unit, frozen per-basis macro/nutrient snapshot). Prod: 11 recipes, 74 lines, 11 with breakdown, 0 with `fit_score`, 2 starred, 1 with tags; roles 8 standard / 2 pre / 1 post.
* CRUD `GET/POST /api/recipe`, `GET/PUT/DELETE /api/recipe/{id}` (`RecipeService`, `RecipeMapper`); deterministic mezo-fit score on read; `GET /api/recipe/{id}/breakdown`.
* **Receptműhely** (recipe workshop): `POST /api/recipe/workshop/turn` (`RecipeWorkshopService`, prompt :54-72) — stateless chat; client sends history + current draft, LLM returns prose + FULL updated draft; goal directives `high_protein|pre_workout|post_workout|before_bed|breakfast`; ingredients matched to pantry ids (never invented), `RecipeWorkshopValidator` sanitises; saving goes through normal CRUD. FE `pages/RecipeWorkshopPage.tsx`, `components/workshop/*`.
* FE: `FuelRecipesPage`, `RecipeDetailPage`, `RecipeEditorPage`, `FuelRecipeScorePage`, `RecipeFitBadge`, `RecipeLogsList`.
* No dietary tags/allergens, no "from URL", no steps column surfaced beyond workshop `steps` in the AI draft (check before relying on it).

### 2.5 Pantry / ingredients (BE `feature/pantry`)

* Two-layer model: shared **`pantry_catalog`** (master content, `created_by NULL` for the 147 seeded rows loaded by `PantryCatalogLoader` from `seed/pantry-catalog.json`; user imports are user-owned) and per-user **`pantry_item`** (stock qty/unit/expiry, price HUF + unit, dose/protocol/timing/taken for supplements). Catalog columns: kind food|supplement|stim|med, name, brand, source, status, category (vegetables…other, 18 values), serving amount/unit, kcal/protein/carbs/fat/fiber/sugar/salt/satFat, `micros` jsonb, `nova`, `form`, `caffeine`, `package_label`. **No allergen columns.** Prod: 442 catalog rows (412 food, 28 supplement, 2 stim), 309 pantry items; NOVA on 420, satFat on 411 (backfilled/modelled — `PantryCatalogLoader` javadoc says saturated fat is *modelled, not measured*).
* Endpoints: `GET/POST /api/pantry`, `PUT/DELETE /api/pantry/{id}`, `GET /api/pantry/catalog?q=`, `POST /api/pantry/items/from-catalog`; `PantrySuggestionService` (cheaper alternative within category/price unit; low-NOVA swap) rides `GET /api/pantry`.
* **Import paths (each its own feature switch, all ON in prod):**
  * **URL scrape** `POST /api/pantry-import/scrape` — `PantryScrapeService` -> `WebPageClient` (SSRF guard: http/https only, public hosts only, no redirects, capped body) -> `HtmlNutritionStripper` (<=24k chars) -> `ScrapeExtractionService` LLM ("per 100 g/ml, never invent, NOVA estimate, category enum, price") -> `ScrapeDraftValidator` (Atwater-consistency -> `confidence`, `needsReview` at <=threshold). Known domains map to `source` (kifli/tesco/auchan/myprotein/gymbeam), else `web`. Honest-empty `result:null`.
  * **Label photo** `POST /api/pantry-import/photo` (`PantryPhotoService`; nutrition-label shot + optional front-of-pack; per-100g forced). 10 prod rows.
  * **OpenFoodFacts** `GET /api/pantry-import/lookup?q=` (barcode if >=8 digits else text) via `OffClient`; **no FE caller** (grep of `data/fuel` finds none; sheet only has Link/Fotó) -> dormant, barcode scan is a ready-made backend for iOS.
  * Confirm for all three: `POST /api/pantry-import` (`PantryImportService.importItem`, `pantry_import` audit table — 35 rows, 2026-09-02..22, activity stopped).
* FE: `FuelKamraPage`, `KamraItemDetailPage`, `AddPantryItemSheet`, `ImportItemSheet`, `CatalogSearchSheet`, `CategoryFilterSheet`, `logic/kamraItems.ts`, `pantryProvenance.ts`.

### 2.6 Neighbours living in `fuel` (not food, but part of the Fuel UI)

* **Supplement protocol / stack**: `protocol`, `protocol_item` (occurrences w/ zone, pinned, placement source), `supplement_intake`; `ProtocolService` (340), `PlacementEngine` (4-stage: rule table -> LLM `StackPlacementLlm` -> user -> fallback), `PlacementRules`; endpoints `/api/fuel/protocol[/items[/{id}]]`, `/api/fuel/intake`. Prod: 53 protocol items, 17 intakes. FE `FuelStackPage`, `projectStackDay.ts`, `doseAdvice.ts`, `matchMealsToStack.ts`. (`ProtocolSeedData` is demo-fixtures only.)
* **Medication cycle** (`feature/medication`; endpoints `/api/medication`; GLP-1-style peak/stable/trough phases): 0 rows in prod (owner tracks none). FE `FuelMedicationPage`.
* **Learned expenditure** ("Hogy tanultam?") — goal-owned, surfaced via Fuel (`LearningPage`, `WeeklyLearningSheet`, `LearnedBase*`).
* **Companion tools**: `FuelTools` — `get_fuel_log` (day/week kcal+protein vs target), `get_protocol`, `get_recipes`, `get_pantry` (`companion/tools/FuelTools.java:76,238,361,552`); chat system prompt routes "recept, mit főzzek -> get_recipes | mi van a kamrában -> get_pantry | napi/heti étkezés, makró, víz -> get_fuel_log" (`ChatService.java:158-159`).
* **Character detectors touching food** (`feature/character/detector`): `MacroAdherenceDetector`, `ProteinTrainingMismatchDetector`, `LateEatingPatternDetector`, `ComfortEatingDetector`, `CravingTriggerDetector`, `FoodDigestionDetector`, `StackSkipPatternDetector`, `UnderLoggingDetector`, `HydrationConsistencyDetector`, `MedCycleCovarianceDetector`.
* **Boop already touches food (read-only):** `boop/service/BoopDayAssembler.java:133-135` reads `FuelDayService.getDay` -> `BoopBriefMapper` fuel metric (kcal so far vs target) -> iOS `MorningBrief` `Day.meals[]`, `PathBuilder.fuel()` (`ios/BoopKit/Sources/BoopCore/Morning/PathBuilder.swift:140`).

## 3. How it works (main flows)

**A. Photo/text meal.** FE `MealComposer.runAiWith` resizes photo -> `POST /api/meal/ai-draft` -> `MealAiDraftService` builds `SYSTEM_PROMPT_HEAD + CATALOG (id | name | brand | serving rows of the user's pantry + recipes)` -> cheap LLM returns JSON lines; matched lines (valid ids) take macros from the DB row, unknown/malformed ids demote to `estimate` lines; LLM also estimates fiber/sugar/salt/satFat; `MealAiDraftValidator` derives `confidence`/`needsReview` deterministically -> user edits/confirms (nothing saves unconfirmed) -> `POST /api/meal` with provenance -> `MealService.create`: header (logged_at offset-aware, meal_date derived), `rebuildItems` (freeze snapshots), `applyScore` (role from workouts, goal targets, day context) -> save -> `MealSavedEvent` -> async coach prose.

**B. Recipe / ingredient meal.** Same composer; lines `source=recipe|pantry`, amount in the item's unit (recipe = servings). Recipe lines expand to per-ingredient scoring lines at score time but the displayed macros come from the frozen snapshot.

**C. Day shape (FE-only today).** `buildDayPlan.ts` (724 lines) places meal windows around wake/bed + real workouts (or replays a slot template via `compileTemplate.ts`), splits the day's kcal/macro budget per slot, suggests a recipe per open slot (`suggestedRecipeId`) and marks slots done/now/pending/missed; `FuelMaiPage` renders it. The server serves only targets/consumed/meals (`FuelDayResponse`).

**D. Web ingredient import.** FE `ImportItemSheet` (Fotó/Link) -> scrape or photo endpoint -> draft with `confidence`/`needsReview` -> user confirm -> `POST /api/pantry-import` -> catalog row (user-owned, `source=web|photo|<shop>`) + `pantry_item`.

**E. Targets.** Goal engine prescribes a weekly segment -> `DayTargetProjector` projects it per date with logged movement -> served to FE hero, scorer, coach prompt, Boop brief.

## 4. Quality assessment

**Solid:** contract-first API; meal write path single-sourced (create/update/rescore share `applyScore`); frozen snapshots protect history; numbers never come from the LLM (matched ids from DB, prose-only coach); honest-empty everywhere; kímélő/skip awareness; role-aware scoring; SSRF guard on scrape; per-fact coverage so unknown data does not silently score 100; bilingual (hu/en) prompts. Tests: 14 fuel / 35 meal / 13 recipe / 24 pantry / 6 nutrition BE test classes; 150 FE test files under `features/fuel` + `data/fuel`.

**Half-built / dormant:**
* OFF barcode/text lookup: backend + switch on, no UI.
* `recipe.fit_score` is null for all 11 prod recipes (computed on read; stored column unused) and `meal_slot_template` has 0 rows, `medication` 0 rows — features built for use the owner does not do.
* Coach verdict only 63/183 (eager path added late; old meals lazy).
* Pantry import activity stopped 2026-09-22; 11 recipes total — the recipe library is small; the owner's logging is mostly AI text/photo + estimates (102 of 544 lines are `estimate`, 399 pantry, 43 recipe).

**Duplicated / heavy:**
* Three near-identical "LLM extract draft" services (meal draft, URL scrape, photo extract) + three "ObjectProvider<…Llm> port + adapter" pairs in `companion/llm/*Adapter` (ADR 0012).
* Glycemic band and slot/window logic duplicated FE<->BE by design (byte-for-byte twin comment); formula-version + rescore runners are a recurring maintenance tax (6 generations).
* Fuel doc (`docs/features/fuel.md`, 768 lines) carries Titanium/Üveg/Folyadék layers; feature index status lags (project memory notes 3-week doc drift). The `fuel.md` §1 still says most Fuel types are "FE-only TypeScript" while most are now backend-backed (stale in §4 text).
* FE fuel is the largest UI in the repo: ~130 non-test files (82 components/sheets, 50+ logic modules). Most of it is presentation for the web Folyadék look.

**Risky:** `FuelDayService` uses `ZoneId.systemDefault()` for meal local time (server zone assumption; documented trap). Meal coach prompt is Hungarian-first; English variant strips only the language demand.

## 5. Reuse for native iOS

**Call as-is (stable contracts, JWT same as Boop already uses):**
`GET /api/fuel/day/{date}` + `/week/{start}` (targets, consumed, meals, energy), `POST/PUT/DELETE /api/meal`, **`POST /api/meal/ai-draft`** (multipart photo+text — maps directly to an iOS camera/dictation flow), `GET /api/meal/{id}/coach` and `/coach?date=`, `POST /api/water-log`, `GET/POST /api/recipe`, `GET /api/recipe/{id}`, `/breakdown`, `POST /api/recipe/workshop/turn`, `GET /api/pantry`, `/pantry/catalog`, `POST /api/pantry/items/from-catalog`, `POST /api/pantry-import/{scrape,photo}`, `GET /api/pantry-import/lookup` (barcode!), `POST /api/pantry-import`, `GET/PUT /api/diet/settings` (+`/preview`), `POST /api/ai-drafts/{id}/outcome`.

**Needs a Boop-shaped API (today logic is client-composed on the web):**
* **Day plan**: windows, per-slot budgets, "what to eat next", recipe suggestion (`buildDayPlan`, `compileTemplate`, `resolveDayType`, `mealWindow`, `defaultMealSlot`, `eatingTimePlacement`). Boop S3 already has `nextMealTip` + `Day.meals[]` in `boop` — move the planner server-side (and item 12's live re-adjust needs it server-side anyway).
* **Usuals** ranking (`usualMeals.ts`), **glucose band + forecast** (`glycemicBand.ts`, `mealForecast.ts` — BE has the band twin in `MealCoachPrompt`), **energy breakdown** presentation (`buildEnergyBreakdown.ts`), **score arithmetic** helpers (`scoreArithmetic.ts`, `mealQualityTruth.ts`).
* A compact "meal + verdict" DTO (tagline, score, 1 improve line) instead of the full `MealBreakdownJson` dimension tree.

**Leave behind in v1 (candidates):** supplement protocol/placement engine and Stack UI, medication cycle, learned-expenditure learning page, pantry price/stock/expiry UI + suggestions, slot-template editor, Receptműhely chat UI (the endpoint is reusable if wanted).

## 6. Gaps vs. the owner's core

| # | Item | Status | Reason |
|---|---|---|---|
| 2 | Meal logging (AI photo, free text, recipe, ingredient) | **Exists & good** | All four paths + voice-as-text, provenance, confidence/needsReview, outcome feedback. Photo path is the least covered by FE tests (needs a quick prod-model check). |
| 2 | AI meal evaluation | **Exists & good** | Deterministic 8-dim score + async coach prose; person/goal/sleep/med/check-in aware. Owner may want a simpler single verdict; the dimension tree is web-heavy. |
| 2 | **Allergen/intolerance flags on recipes & ingredients** | **Missing** | Nothing modelled. Needs: allergen set on `pantry_catalog` (EU-14 + lactose/FODMAP style enum or jsonb), derived rollup on `recipe` (from lines), a per-user `intolerances` profile, and use in (a) draft matching, (b) scoring/coach, (c) plan generation filter, (d) scrape/photo/OFF import (OFF returns `allergens_tags`; LLM extractors would need a new key). Also the coach prompt currently says "never name a food sensitivity" and `FoodDigestionDetector` disclaims intolerance — policy must change. |
| 3 | Weight goal -> meal evaluation against it | **Exists & good** | Scoring uses goal-derived targets, trajectory/guards in the coach prompt, kímélő handling. |
| 3 | Pre-calibrated diet plans ("only these X recipes/Y ingredients for 4 weeks"), several plans, plan rules in chat context | **Missing** | No plan entity at all: no recipe/ingredient allow-list, no date-bounded plan, no plan-to-chat injection (chat sees tools `get_recipes`/`get_pantry`, not a plan). `diet_settings` is a single macro-split singleton; weight-goal "plans" page links existing mesocycle/running lanes only. |
| 3 | Training/running plans + AI trainer/dietitian | Out of this area (train mapper) | Note: food side has `role` pre/post workout and `MesoContextAssembler`/train windows already feed scoring. |
| 3 | Long-term effect of recipes/ingredients and a new item on biomarkers | **Missing** | `effect_link` is people/event x mental/energy/stress (companion reflection, nightly Cliff's delta); no food/ingredient subject kind, no biomarker (HRV/sleep/glucose) metric, no "new item introduced" marker. Meal-level data is rich enough (snapshots, item ids, timestamps) to build it. |
| 5 | Sport plans context-coordinated with meal plan & weight goal | **Partly exists** | Meal scorer + day planner read the day's real workout windows and logged movement into the kcal target; no meal *plan* to coordinate with, and coordination is per-day, not plan-level (no mesocycle-aware fuelling). |
| 12 | AI re-examines each day live and adjusts food (extra/less food) | **Exists, needs fixing** | Targets already move with logged movement and kímélő; coach is retrospective per meal; `nextMealTip` exists in Boop brief; no server-side live "remaining budget -> concrete next-meal suggestion" loop (planner is FE-only). |
| 1 | (context) Apple Health -> food | n/a | Food is manual-only; no dietary energy import path checked here. |
| — | Web ingredient import | **Exists & good (URL scrape), half-built (OFF)** | See 2.5; no recipe-URL import. |
| — | Shopping list / meal plan | **Missing** | Confirmed absent in BE, API and FE (FE comment `FuelKonyhaPage.tsx:18`). |

## 7. Open questions / risks for the re-plan

1. **Allergen model & liability**: structured allergen/intolerance profile per user (lactose, gluten...) vs. per-ingredient flags; who is the source of truth (catalog seed, OFF `allergens_tags`, LLM guess with `needsReview`)? Reverse the coach/detector "no intolerance talk" rule deliberately.
2. **What is a "diet plan"?** Proposed minimal entity: plan(name, start/end, weight-goal ref, allowed recipe set + allowed ingredient set, macro split, linked training plan) with a generator ("only these N recipes") and a rule summary injected into chat/coach context. Decide whether the recipe library (11 rows) must first grow (AI recipe generation under constraints is the natural feeder; Receptműhely is the seed).
3. **Where the planner lives**: moving `buildDayPlan` & friends server-side is a prerequisite for Boop *and* for item 12; sizeable (724 + templates + timing logic, FE tests to port).
4. **Biomarker effect tracking** needs the wearable data model (other mapper) + a subject kind for food/ingredient + an "introduced on date" marker; decide statistical gate (existing Cliff's delta engine reusable).
5. **Catalog strategy**: 442 catalog rows incl. 99 scraped `web` items and 147 modelled-satFat seeds; barcode/OFF lookup exists but unused — decide whether Boop gets a barcode scan (cheap win) and whether scrape stays.
6. **AI cost/latency**: every logged meal triggers two LLM calls (draft + eager coach); fine for one user, re-check model tiers for a standalone app.
7. **Doc/code drift** to fix when re-planning: `fuel.md` 'FE-only' statements, feature-index statuses; do not trust Titanium/Üveg sections for current behaviour.
8. **Time zone**: server `systemDefault()` used for meal local time; a travelling iPhone user with an offset-bearing `loggedAt` is handled on create but not on rescore.
