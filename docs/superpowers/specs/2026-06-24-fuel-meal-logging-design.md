# Fuel Meal-Logging (Mai) Slice — Design Spec

**Date:** 2026-06-24
**Driving bd:** `mezo-arb`
**Mirrors:** Recipes slice (`mezo-lns` / spec `2026-06-23-fuel-recipes-design.md`); upsert reference: check-in (`feature/biometrics/checkin`)
**Status:** approved design → ready for implementation plan

---

## 1. Goal & Scope

Back the **100%-mock** meal-logging (Mai/Today) Fuel surface with a real Spring Boot + Postgres backend and dual-mode hooks, and ship the **one genuinely missing UI piece** — a log-meal capture sheet. This un-defers the inert CTAs that the Pantry and Recipes slices both pointed here: Recipe-detail **"+ Mai étkezéshez"** and Kamra-detail **"+ Logolás · mai étkezésbe"**.

**In scope (v1):**
- `meal` + `meal_item` aggregate (owned, soft-deleted); `meal_item` is **polymorphic** — a logged item references a **recipe** OR a **pantry_item**.
- Meal CRUD: list-by-day / create / update (full-replace) / delete, over `/api/meal`, plus a **fuel-day aggregation** endpoint serving `useFuelDay` (targets + consumed + meals).
- `nutrition_targets` as an `@ConfigurationProperties` record (`mezo.nutrition.*`) → makes `MacroHero` targets-vs-consumed real (replacing the hardcoded `2500` floor).
- **Hybrid UI:** wire the existing read surfaces (MacroHero, meal list, `RecipeLogsList`, the Today preview) to real data **without redesign**; build the **new `LogMealSheet`** (chamfer "Deep Current") + the **2-tab Receptek/Kamra picker**; wire the two inert CTAs + a Mai "＋ Log" entry.
- Server-computed day **consumed** rollup + per-recipe **recentLogs** (so `RecipeLogsList` becomes real).
- Dual-mode `useFuelDay` + new `useMealActions`, preserving the `useFuelDay` return shape.

**Out of scope — deferred (NULL/placeholder, exactly like recipe `fit_score`):**
- **Meal score** — `meal.breakdown` jsonb column ships **NULL** behind the **pending-sparkle** placeholder; `MealScoreSheet` already guards on `!meal.breakdown`. The 4-dimension (Macro/Micro/NOVA/Context) weighted scoring is **Phase-3** (Spring AI / pgvector / RAG).
- **Supplement-intake / medication-dose** logging — a different aggregate; belongs to the **Stack slice** (`SupplementItemRow` stays visual-only). The `pantry_item.taken` boolean stays the interim adherence stand-in.
- **Fuel-timeline merged VIEW** (meals + supplement intakes + Train schedule) — `useFuelTimeline` keeps returning the mock plan; its hook signature is unchanged, so the contract never sees it. Depends on supplement-intake + the Train-schedule-ownership decision.
- **FREE/ad-hoc food arm** — `meal_item.source` is a CHECK enum from day one so `'free'` (client-supplied macros) is purely additive later; QuickAdd voice/photo/URL capture is Phase-3.
- **`replan`** apply (still preview-only).

---

## 2. Current State (mock)

- `useFuelDay` / `useFuelTimeline` / `useFuelPreview` / `useProtocol` (`frontend/src/data/hooks.ts:64-71,137-155`) are one-line pass-throughs returning static consts from `frontend/src/data/fuel.ts` — **no `useQuery`/`useMutation`/write path** (unlike `useSleep`/`useCheckins`/`usePeople` which already have `isMockMode()`-gated real branches).
- **No log-meal sheet exists anywhere.** The only interactions are read-only `MealScoreSheet` open/close and a non-mutating `ReplanSheet` preview. Logged meals exist only as pre-baked `fuelDay.meals` entries; `RecipeLogsList` renders `RecipeLog[]` that nothing can create.
- Mock types (`frontend/src/data/types.ts`) — note `Meal`/`MealItem` do **not** exist:
  - `MacroSet` = `{ kcal, p, c, f, water }` (used for both targets AND consumed).
  - `FuelMeal` = `{ id, slot, title, score:number|null, kcal, p, c, f, items:string[], tags, recipeId?, loggedAt?, breakdown?:MealBreakdown }`. `items` is **free-text** (`"Zabpehely 70g"`), NOT structured refs; `recipeId`/`loggedAt` declared but **never populated**; macros are hand-authored literals.
  - `MealBreakdown` = `{ confidence, summary, dimensions:MealDimension[], improve[], tools[] }` — a discriminated union on `id` (`macro`|`micro`|`nova`|`context`), seed weights `.30/.25/.25/.20`. The natural jsonb score envelope.
  - `FuelDay` = `{ targets:MacroSet, consumed:MacroSet, meals:FuelMeal[], pacing, micronutrients[], supplements[] }`. Seed `targets = {kcal:3100,p:220,c:380,f:95,water:4000}`, `consumed = {kcal:1840,...}`. The `2500` is only a hardcoded "kcal floor" label in `FuelMaiView`.
  - `RecipeLog` (derived client-side in `pantry.ts` via a `recipeLinks` map, NOT in `fuel.ts`).
- Inert: `RecipeDetailView.tsx:199` (`+ Mai étkezéshez · hamarosan`), `KamraItemDetailView.tsx:205` (`+ Logolás`), `SupplementItemRow` done-checkbox (no handler), `RecipeLogsList` empty-state, `fuel.ts:622 getScoredMeal` joins slot→meal by **title-string equality** (brittle).

---

## 3. UI/UX (approved)

Hybrid: **wire the existing read surfaces; build one new capture sheet.** Mockup: `docs/design/meal-logging-sheet.html`.

### 3.1 New: `LogMealSheet` (modal, chamfer "Deep Current")
- Opens from: Recipe-detail **"+ Mai étkezéshez"** (pre-filled with that recipe, 1 adag), Kamra-detail **"+ Logolás"** (pre-filled with that pantry item), and a Mai **"＋ Log"** entry (empty).
- **Mikor:** slot segmented (Reggeli/Ebéd/Vacsora/Snack) + time (`logged_at`, default now, editable).
- **Tételek:** per-item card — name + a **source tag** (`recept` brand-glow / `kamra` category-tint), an **amount stepper** (recipe → *adag*, pantry → *g/unit*), per-item **`MacroCells`** contribution (reuses the shared component), delete. **"Receptből / Kamrából hozzáad"** → the picker.
- **Élő összeg:** "Ez az étkezés" `MacroCells` total **+ a daily-context bar** (*mai eddig 1840 + ez 400 = 2240 / cél 3100 kcal*, with a thin progress bar). **(approved — keep the daily-context bar)**.
- **No score** in the sheet (pending; the score lands on the meal later via Phase-3).
- Sticky save: **Mégse** / **Logolás a mai naphoz**.

### 3.2 New: 2-tab ingredient/recipe picker (modal over the sheet)
- Tabs **Receptek** (recipe rows: name + slot + per-serving macros) / **Kamra** (pantry rows: name + macros `/100g`). Search across both; ＋ adds.
- Reuses the established picker/`MacroCells` patterns from the Recipes slice.

### 3.3 Wire (no redesign)
- **MacroHero** ← real `targets` (config) vs server-computed `consumed`.
- **Mai meal list** ← real `meals` (replaces `getScoredMeal` title-join with a real id relation).
- **`RecipeLogsList`** ← real per-recipe `recentLogs`.
- The two CTAs become live (open `LogMealSheet` pre-filled); the Today `FuelTimelinePreview` gains a tap into logging.
- **Score display** (`MealScoreSheet` / the meal card fit number) → **pending-sparkle** while `breakdown` is NULL (same `RecipeFitBadge` pattern; reuse it).

---

## 4. Data Model

Two owned tables + a config record. Both tables: UUID PK `gen_random_uuid()`, `created_by`/`is_deleted`/`created_at`, `@SQLDelete`/`@SQLRestriction`.

### `meal` (parent aggregate)
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `created_by` | uuid NOT NULL | `fk_meal_created_by_app_user_id → app_user(id) ON DELETE CASCADE` |
| `is_deleted` / `created_at` / `updated_at` | | owned + `@UpdateTimestamp` |
| `logged_at` | timestamptz NOT NULL | real instant (NOT the display string); FE derives "ma · 13:20" |
| `meal_date` | date NOT NULL | denormalized day key for owner+day queries / consumed rollup |
| `slot` | text NOT NULL | `ck_meal_slot in ('breakfast','lunch','dinner','snack')` |
| `title` | text | optional; defaults from first item / recipe name |
| `breakdown` | jsonb | typed `MealBreakdownJson` envelope, **NULL in v1** (Phase-3) |

Indexes: `idx_meal_created_by`, `idx_meal_created_by_meal_date`. Macros are **computed at read** from the lines (no stored rollup). **Pure-create** (no `UNIQUE(created_by,meal_date,slot)` — multiple meals/snacks per slot allowed).

### `meal_item` (polymorphic child)
| column | type | notes |
|---|---|---|
| `id` / owned cols | | |
| `meal_id` | uuid NOT NULL | `fk_meal_item_meal_id_meal_id → meal(id) ON DELETE CASCADE` |
| `line_order` | integer NOT NULL | server-assigned from request index |
| `source` | text NOT NULL | `ck_meal_item_source in ('recipe','pantry')` — discriminator |
| `recipe_id` | uuid | `fk → recipe(id) ON DELETE RESTRICT`; set iff `source='recipe'` |
| `pantry_item_id` | uuid | `fk → pantry_item(id) ON DELETE RESTRICT`; set iff `source='pantry'` |
| `amount` | numeric NOT NULL | `ck > 0` — servings (recipe) / qty (pantry) |
| `unit` | text NOT NULL | |
| `snapshot_name` | text NOT NULL | frozen at write (renderable after source soft-delete) |
| `snapshot_per` | numeric NOT NULL | basis (recipe → 1 serving; pantry → serving_amount) |
| `snapshot_basis_unit` | text NOT NULL | |
| `snapshot_kcal/protein_g/carbs_g/fat_g` | numeric NOT NULL | per-basis macros (recipe → per-serving; pantry → per-serving_amount) |
| `snapshot_nova` | smallint | `ck null or 1..4` — carried for the future NOVA score dimension |

**Exactly-one-of CHECK** (`ck_meal_item_arm`): `(source='recipe' AND recipe_id IS NOT NULL AND pantry_item_id IS NULL) OR (source='pantry' AND pantry_item_id IS NOT NULL AND recipe_id IS NULL)`.
Indexes: `idx_meal_item_meal_id`, `idx_meal_item_created_by`, `idx_meal_item_recipe_id`, `idx_meal_item_pantry_item_id`. `@Modifying softDeleteByMealId` (copy `RecipeIngredientRepository`).

**Snapshot = per-basis, computed contribution at read** (identical rationale + formula to `recipe_ingredient`): `factor = amount / snapshot_per`; `contribution.X = round(snapshot.X × factor)` (whole-number, HALF_UP — same as the recipe mapper / FE mock); `meal.macros = Σ line contributions`; **day `consumed` = Σ the day's meal macros**.

### `nutrition_targets` — config record (not a table in v1)
`@Validated @ConfigurationProperties(prefix="mezo.nutrition")` with `kcal/p/c/f/water` (per `configuration_conventions.md`). Owner-wide constants. *(Natural next step, out of scope: read targets from the active `goal.prescription` jsonb so they become Reta-phase-aware.)*

---

## 5. API Contract (`api/feature/meal/meal.yml`, tag `Meal`)

- `GET /api/fuel/day/{date}` → `200 FuelDayResponse` — aggregation feeding `useFuelDay`.
- `POST /api/meal` (`MealRequest`) → `201 MealResponse`.
- `PUT /api/meal/{id}` (`MealRequest`) → `204` / `404` — full-replace.
- `DELETE /api/meal/{id}` → `204` / `404`.
- `GET /api/recipe/{id}/logs` → `200 { recentLogs: RecipeLogResponse[] }` *(feeds `RecipeLogsList`; lives in the recipe contract, queries `meal_item`)*.

**`MealRequest`**: `slot` (required, pattern `^(breakfast|lunch|dinner|snack)$`), `loggedAt` (date-time, nullable → server defaults to now), `title` (nullable), `items` (`MealItemRequest[]`, minItems 1).
**`MealItemRequest`**: `source` (required, pattern `^(recipe|pantry)$`), `recipeId` (uuid, nullable), `pantryItemId` (uuid, nullable), `amount` (number, exclusiveMinimum 0), `unit` (required). Exactly-one-of `recipeId`/`pantryItemId` per `source` — validated server-side → 400 `VALIDATION_INVALID_VALUE` on `items`.
**`MealResponse`**: `id, slot, loggedAt, mealDate, title, macros{kcal,p,c,f}` (rollup), `score{value: nullable number, breakdown: nullable}` (pending), `items: MealItemResponse[]`.
**`MealItemResponse`**: `source, recipeId?, pantryItemId?, amount, unit, lineOrder, name` (snapshot), `nova?`, `contribution{kcal,p,c,f}`.
**`FuelDayResponse`**: `date, targets{kcal,p,c,f,water}, consumed{kcal,p,c,f,water}, meals: MealResponse[]`.

Contract-first: edit `api/feature/meal/meal.yml`, append to `api/generate/merge.yml`, merge, regen FE + backend types. `pattern` (not enum) on request strings; `minItems:1`.

---

## 6. Backend Design (`feature/meal/`, mirrors Recipe)

### 6.1 Files
`entity/MealEntity.java`, `entity/MealItemEntity.java`, `repository/MealRepository.java` (+ `MealItemRepository` for the bulk child soft-delete), `service/MealService.java`, `service/FuelDayService.java` (assembles `FuelDayResponse`), `mapper/MealMapper.java`, `controller/MealController.java` (implements generated `MealApi`), `config/NutritionTargetsProperties.java`. Plus the recipe contract gains a `GET /api/recipe/{id}/logs` op + a small `RecipeLog` projection from `meal_item`.

### 6.2 Entities
- `MealEntity extends OwnedEntity`: `@OneToMany(mappedBy="meal", cascade=ALL, orphanRemoval=true) @OrderBy("lineOrder") List<MealItemEntity> items`; `breakdown` jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto a typed `MealBreakdownJson` (nullable); `@UpdateTimestamp`.
- `MealItemEntity extends OwnedEntity`: `@ManyToOne MealEntity meal`; `recipeId` + `pantryItemId` as **plain UUID columns** (no JPA association — snapshot is the durable record, same as `recipe_ingredient.pantryItemId`); `source` String; snapshot fields.
- `MealRepository extends OwnedRepository<MealEntity>` (date-ordered, unlike `RecipeRepository`): owner+day finder `findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(UUID, LocalDate)` + `findByIdAndCreatedByAndDeletedFalse`.

### 6.3 Service (`@Transactional`, owner-scoped)
- **create**: `setCreatedBy` server-side; `meal_date = logged_at` (date part, server-side); `rebuildItems` → for each request item **branch by `source`**:
  - `source='recipe'`: resolve recipe owner-scoped & not-deleted (`recipeRepository.findByIdAndCreatedByAndDeletedFalse`) → 400 if missing/foreign/deleted; snapshot `name = recipe.name`, `per = 1`, basis-unit `"adag"`, per-serving macros = `recipe whole-macro rollup / recipe.servings`, `nova = recipe.nova_dominant`. `amount` = servings.
  - `source='pantry'`: resolve pantry_item owner-scoped & not-deleted → 400; snapshot `name/per(serving_amount)/basis_unit(serving_unit)/macros/nova` from the live `PantryItem` (identical to `recipe_ingredient`).
  - set `created_by`/`line_order`/`setMeal(meal)` (bidirectional back-ref — proven needed in mezo-lns); save (cascade). `breakdown` stays NULL.
- **update** (`requireOwned` → 404): full-replace via `items.clear()` + orphanRemoval + re-resolve snapshots (editor sends the COMPLETE aggregate; intentional full-replace, NOT lossy `mezo-dh6`).
- **delete** (`requireOwned` → 404): **explicit bulk soft-delete of children** (`mealItemRepository.softDeleteByMealId`) THEN `repository.delete` (since `@SQLDelete` doesn't cascade `@OneToMany`).
- `FuelDayService.getDay(userId, date)`: targets from `NutritionTargetsProperties`; `meals` = mapped list; `consumed` = Σ meal macros (+ `water` from targets default until water-logging exists).

### 6.4 Tests
ITs (`AbstractIntegrationTest`/`ApiIntegrationTest`, Testcontainers/`mezo_test`): create with recipe-arm + pantry-arm snapshot + rollup; exactly-one-of CHECK / source-mismatch → 400; missing/foreign source → 400; list-by-day owner-scoping; full-replace update; soft-delete cascade to children; fuel-day aggregation (targets+consumed); `/api/recipe/{id}/logs`. New `MealPopulator`; add `meal` + `meal_item` to `ResetDatabase` TRUNCATE.

---

## 7. Frontend Design (dual-mode, `useFuelDay` shape preserved)

- `src/lib/mealApi.ts` — `getDay(date)` / `create` / `update` / `remove` over `/api/fuel/day/{date}` + `/api/meal[/{id}]`; `toRequest` builds the polymorphic `items` (source + recipeId|pantryItemId).
- `src/data/fuelHooks.ts` — `useFuelDay()` dual-mode (`useQuery(['fuelDay', date])`, mock `initialData` / real `mealApi.getDay`) **composed** so the public return keeps the `FuelDay` shape `{targets, consumed, meals, pacing, micronutrients, supplements}` — only `targets/consumed/meals` become real; `pacing/micronutrients/supplements` stay from the mock/static config (supplements = Stack slice). `useMealActions()` (`logMeal/updateMeal/deleteMeal`) — mock `setQueryData` mutators / real API + invalidate `['fuelDay']` **and** `['recipes']` **and** `['pantry']` (logging affects recipe `recentLogs` + pantry usage). Re-export from `src/data/hooks.ts`; retire the mock one-liners.
- FE types: extend `FuelMeal` to carry structured `items` (the `MealItem` refs + `contribution`) + real `loggedAt`/`mealDate`; add `MealInput`. Preserve `MacroSet`/`FuelDay`/`MealBreakdown`.
- **New components:** `LogMealSheet` (the capture sheet), the 2-tab `MealPickerSheet` (Receptek/Kamra). Reuse `MacroCells`/`RecipeFitBadge` (pending) from the Recipes slice. Model the write flow on the proven Train `RunLogSheet → onSave` pattern.
- Wire: `MacroHero`, the Mai meal list, `RecipeLogsList`, the Today preview, and the two CTAs (`RecipeDetailView`/`KamraItemDetailView`) — open `LogMealSheet` pre-filled.
- MSW `/api/fuel/day` + `/api/meal` handlers; mock `logMeal` computes contribution with the SAME whole-number `amount/per` formula as the backend. Both `pnpm test` modes + `pnpm build` green; the live-app score shows the **pending sparkle** (mock seed scores already nulled for recipes — do the same for any meal seed score).

---

## 8. New Ground vs Recipe (risks for the plan)
1. **Polymorphic line** — first multi-arm reference (recipe|pantry): two nullable FK arms + `source` discriminator + exactly-one-of CHECK + a **branching** resolve/snapshot (recipe-arm reads the recipe macro rollup ÷ servings; pantry-arm reads `PantryItem` per-basis). No existing template covers multi-arm resolve.
2. **Timestamp + day key** — `logged_at` + `meal_date`; `MealRepository extends OwnedRepository` (date-ordered), real id relation replaces `getScoredMeal` title-join.
3. **Pure-create + full-replace** (POST 201) chosen over upsert — multiple meals per slot allowed.
4. **Day rollup across heterogeneous items** + targets-vs-consumed (`FuelDayService`).
5. **Cross-feature read** — `GET /api/recipe/{id}/logs` queries `meal_item` from the recipe feature (the first cross-feature query).
6. **Composed `useFuelDay`** — blends real (targets/consumed/meals) with static (pacing/micronutrients/supplements), preserving the `FuelDay` shape.
7. **Score envelope jsonb on the parent** (`meal.breakdown`, typed, NULL) — richer than recipe's scalar `fit_score` but same pending-sparkle precedent.
8. **`@ConfigurationProperties` targets** — first config-driven domain value feeding a UI hero.

---

## 9. Mockup provenance
The approved capture-sheet design is exported to `docs/design/meal-logging-sheet.html` (log-meal sheet — slot+time, recipe/pantry items with `MacroCells`, live total + daily-context bar; the 2-tab Receptek/Kamra picker). Visual source of truth for the new sheet; the wired read surfaces keep their current design.

---

## 10. Open questions
None blocking. Settled: loggable = recipe+pantry (polymorphic, defer free), grouping = slot-with-N-items pure-create, UI = hybrid (wire + one new sheet), score = defer (NULL+pending sparkle), targets = config record, supplement-intake/timeline-merge = deferred, daily-context bar = keep, source-pre-fill from the CTAs = yes. Proceed to `writing-plans`.
