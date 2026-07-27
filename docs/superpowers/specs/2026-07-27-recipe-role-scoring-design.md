# Recipe meal-role in the template score + visible re-evaluation

- **Date:** 2026-07-27
- **Driving issue:** mezo-uavr
- **Status:** design approved (implementation pending)
- **Extends:** `2026-07-27-training-aware-meal-scoring-design.md` (mezo-ta8p — the role rubric on the LOGGED-meal surface), `2026-07-05-fuel-p7-meal-scoring-design.md` (the deterministic v0 engine, ADR 0006)
- **Related:** mezo-bw3y (the lazy recipe breakdown + AI prose this makes role-aware)

## 1. Context & problem

Two separate gaps, one user-visible symptom each. They are specified together because a role switch on a recipe MUST trigger a re-evaluation, and today that re-evaluation is invisible.

**(a) The recipe template score is role-blind.** Since mezo-ta8p a *logged* meal is scored under a training `MealRole` (`standard` / `pre_workout` / `post_workout`), which swaps in role-specific macro targets, a relaxed WHO sugar limit and softened NOVA class scores — fast carbs before a workout are fuel, not a dietary sin. The *recipe* surface never got that: `MealScoringService.recipeTemplateBreakdown(slot, perServingLines)` (`:149`) and its `recipeFit` delegate (`:135`) always use the base rubric (`targets.p/c/f`, `props.who()`, `props.nova()`). Consequence: a recipe deliberately built as pre-workout fuel shows a low `mezoFit` badge and a breakdown that scolds it for sugar and NOVA — the number is measuring it against the wrong yardstick.

**(b) Re-evaluation is silent, and shows a stale reading while it runs.** The deterministic numbers are recomputed on every read (`RecipeBreakdownService:49`), so they never go stale server-side. The **LLM prose** (`summary`, per-dim `detail`, `improve[]`, `fitsFor[]`) is cached in `recipe.breakdown` and regenerated when either the recipe was edited (`RecipeService.java:170` nulls the cache) or the fresh numbers no longer match the persisted ones (`RecipeBreakdownService.matches`). That regeneration is a blocking, LLM-seconds `GET`. On the frontend, `useRecipeBreakdown`'s `pending` is `isPending`, which is true only when the cache holds **no** data at all. After an edit the query is invalidated but the previous data stays, so the detail page renders the **pre-edit** prose and dimension cards with no indication, then silently swaps. There is no manual re-trigger anywhere either.

## 2. Decision summary

Agreed with the owner:

1. **Explicit role field on the recipe** — `role: standard | pre_workout | post_workout`, default `standard`, set by the user in the editor. Not derived from tags/name (a score must not hinge on a typo) and no auto-suggestion (a wrong guess would silently move the number).
2. **Goal is a fair single number**, not discovery. We do NOT compute or display all three role readings side by side, and we do not add role-based filtering. That is a separate, later slice if it ever earns its place.
3. **The recipe role does NOT leak into the logged-meal score.** A logged meal keeps deriving its role from the actual training windows (mezo-ta8p). Physically honest: a pre-workout recipe eaten on a rest day was not a pre-workout meal. Zero regression on the log surface.
4. **Re-evaluation stays automatic**, but becomes visible: the detail page shows an honest "re-evaluating" state instead of stale prose. No manual force-refresh button in v1 (every real staleness cause is already covered automatically).

## 3. The role on the recipe

`RecipeEntity.role` — `MealRole` (`feature/nutrition/service/MealRole.java`, already the logged-meal enum; `feature/recipe` already depends on `feature/nutrition` for scoring, so no new coupling), `@Enumerated(EnumType.STRING)`, `NOT NULL DEFAULT 'STANDARD'`.

Every existing recipe becomes `standard` → identity overlay → **byte-for-byte the current fit numbers**. That is the regression guard, asserted in tests.

The role is a *template* declaration ("this recipe is built as pre-workout fuel"), not a claim about any particular eating occasion.

## 4. Scoring change

`MealScoringProperties.roles` already carries the `pre` / `post` `RoleRubric` bundles (`application.yml:517-540`: macro targets, `who.sugar-energy-share-limit`, `nova` group scores). **No new config, no new constants** — the template surface reuses the exact bundles the logged surface uses.

- `MealScoringService.recipeTemplateBreakdown(String slot, List<ScoredLine> lines, MealRole role)` — new 3-arg form; the existing 2-arg overload delegates with `MealRole.STANDARD`.
- `MealScoringService.recipeFit(String slot, List<ScoredLine> lines, MealRole role)` — same shape, same delegation.
- The overlay selection currently inlined in `scoreMeal` (`:100-108`) is extracted into one private `rubricFor(MealRole)` helper returning the `(p, c, f, who, nova)` bundle, and **both** `scoreMeal` and `recipeTemplateBreakdown` call it. The two surfaces can then never drift apart.

Role-sensitive dimensions on the template surface are exactly the three that are role-sensitive on the meal surface: `macro`, `who`, `nova`. `micro` (fiber), `fat_quality`, `plant_diversity`, `energy_density` stay role-independent.

**`portionDim` (Adag-arány) stays role-independent** (owner's call): the role moves the *nutrient* rubric, not the portion size — how big a serving should be is already keyed on the recipe's `category` budget share. A pre-workout snack that wants a smaller budget expresses that through `category: snack`.

## 5. The prose must know the role

`RecipeBreakdownProseService` builds the LLM prompt from the recipe + the deterministic envelope. It gets the role, and the prompt states it explicitly (Hungarian, e.g. *"Ez a recept edzés előtti üzemanyagnak készült — a gyors szénhidrát itt cél, nem hiba."*). Without this the prose keeps writing "sok a hozzáadott cukor" underneath a number that already treats that sugar as fuel — the two halves of the same card contradicting each other.

`fitsFor[]` stays as it is (free-form "mire jó" labels); the role is a separate, structured fact.

## 6. Cache invalidation on a role change

Already covered twice over, by design:

1. `RecipeService.update` nulls `recipe.breakdown` on every edit (`:170`) — a role change is an edit.
2. Even without that, the role changes the deterministic numbers, so `RecipeBreakdownService.matches(stored, fresh)` fails → regenerate.

A role change on a recipe whose numbers happen to be identical under both rubrics (possible: a plain-chicken-and-rice recipe may score the same) regenerates anyway via (1). No new invalidation machinery.

## 7. Contract (`api/feature/recipe/recipe.yml`)

Contract-first, per `api_contract_conventions.md`:

- `RecipeRequest.role` — `{ type: string, pattern: '^(standard|pre_workout|post_workout)$', default: standard }`, optional; absent ⇒ `standard`, so an older client payload stays valid.
- `RecipeResponse.role` — same, **required** (always populated).

The `pattern`-constrained string mirrors the neighbouring `category` field (`recipe.yml:127`) rather than an OpenAPI `enum`, deliberately: it is the established house shape here, it keeps the generated Java/TS types plain `String`, and it avoids a third enum type (generated DTO enum ↔ `MealRole` ↔ FE union) in the mapping path. The wire values are snake_case (`pre_workout`); `RecipeMapper` converts wire ↔ `MealRole` in one place (`MealRole.valueOf(role.toUpperCase())` / `name().toLowerCase()`), rejecting an unknown value as a 400 via the pattern before it reaches code. The frontend casts to a `RecipeRole` union exactly as it already casts `category`.

Then `cd api/generate && npm run generate:api`, `cd frontend && pnpm generate:api`; backend Java types regenerate in the Maven build.

## 8. Frontend

- **`RecipeEditorPage`** — a „Szerep" segmented row next to the existing slot segments, three options: **Általános** / **Edzés előtt** / **Edzés után**. State seeded from `editing?.role ?? 'standard'`, written into `RecipeInput.role`.
- **`recipeToInput` (`RecipeDetailPage.tsx`) must carry `role`.** It is reused by the star toggle and by the editor prefill — omitting the field would silently reset a pre-workout recipe to Általános the next time the user stars it. Explicit test.
- **`RecipeDetailPage`** — a role chip in the hero meta line when `role !== 'standard'` (e.g. „edzés előtt"), and the PONTSZÁM section header names the rubric in use, so the number is self-explaining.
- **`RecipeCard`** (library list) — the same small role tag when non-standard; without it a lifted badge number is unexplainable in the list.
- **Mock layer** — `mockRecipes` seed entries get a `role` (at least one non-standard, so mock mode exercises the chip), and mock create/update round-trip it.

## 9. Visible re-evaluation

- `useRecipeBreakdown` returns an additional **`refreshing: !mock && isFetching && !isPending`**.
- `RecipeDetailPage` renders the existing twinkle card (`np-twinkle`) when `pending || refreshing`, with the copy switching to **„Mezo újraértékeli a receptet…"** in the refreshing case. While it shows, the stale olvasat + dimension cards are NOT rendered — they would display the pre-edit reading.
- This covers every automatic regeneration path: recipe edit, role change, pantry macro drift.
- Deliberately no manual re-trigger button (§2.4). If prose quality ever needs a reroll, that is its own issue.

## 10. Testing

Per `testing_standards.md` / `integration_test_framework.md` — integration-first, fixed `mezo_test` DB, AssertJ, `*Populator` data, no mocks/H2.

- **Unit (pure, no DB):** a fixed carb-heavy per-serving line set scored via `recipeTemplateBreakdown` under `PRE_WORKOUT` lifts the `macro`/`who`/`nova` dimension scores versus `STANDARD`; `POST_WORKOUT` lifts them differently; **`STANDARD` equals the current 2-arg output exactly** (regression guard).
- **Integration:** create a recipe with `role: pre_workout` → `RecipeResponse.role` round-trips and `mezoFit.score` is higher than the same recipe stored as `standard`; `PUT` changing only the role nulls `recipe.breakdown` and the next `GET /breakdown` returns a regenerated envelope whose numbers match the new rubric; an omitted request `role` persists `STANDARD`.
- **Frontend (both modes):** editor writes the role and it round-trips; `recipeToInput` preserves the role across a star toggle; the detail page shows the twinkle with the „újraértékeli" copy while `refreshing` and hides the stale prose.

## 11. Out of scope (explicit)

- **All three role readings shown at once / role-based filtering & recommendation** — the "discovery" direction. Separate slice if it earns its place.
- **Manual „Újraértékelés" button** (and any `force` contract parameter).
- **Any change to the logged-meal surface** — role derivation there stays purely training-window based.
- **Role-dependent `portionDim`** (§4).
- **Auto-suggesting a role** from name/tags/macros.
