# Recipe from a logged meal — design (mezo-n9wgg)

Owner request 2026-09-24: "Lehessen egy logolt ételből utána egy gombbal receptet készíteni."
Owner decisions (brainstorm, same day): **A** prefilled form (not an instant save) · **A** the
form is the **Receptműhely** (it holds estimate lines honestly) · **A** recipe lines expand, and a
meal that is exactly one recipe line gets "Megnyitom a receptet" instead.

## Behaviour

1. **Entry — `FuelMealDetailPage`**, next to the existing `fmx-edit-door` ("Javítom ezt az étkezést"),
   one more quiet door of the same class:
   - meal has **no** `mealItems` → no door;
   - meal is **exactly one line with `source: 'recipe'`** → "Megnyitom a receptet" →
     `/fuel/recipes/<refId>`;
   - otherwise → "Mentsük receptként" → `/fuel/recipes/muhely?fromMeal=<id>[&d=<day>]`.
2. **Seed — `RecipeWorkshopPage`** reads `fromMeal` (+ `d`), resolves the meal exactly like the
   detail page (`useFuelDay(d)` + `meals.find`), and seeds the draft **once** via a pure
   `mealToDraft(meal, recipes)` (new, in `data/fuel/workshopState.ts`, beside `recipeToDraft`):
   - `name` = `mealDisplayName(meal) ?? 'Új recept'`; `category` = `mealSlotKey(meal) ?? 'snack'`;
     `servings` = 1; `steps` = [];
   - **pantry** line → `{source:'pantry', refId, name, amount, unit}`;
   - **estimate** line → `{source:'estimate', refId:null, name, amount, unit, est: contribution}`;
   - **recipe** line → the recipe's ingredients, each `amount × (loggedAmount / recipe.servings)`
     (rounded to 1 decimal), as pantry lines. Recipe not in the list (deleted) → one estimate
     line from the logged line (name, amount, unit, `est` = contribution) — nothing is lost.
   - pantry lines with the **same `refId` and unit** merge (amounts summed), first position kept.
   - `sourceRecipeId` stays `null` ⇒ save is a **create** (existing save path, toast, navigate).
   - Seeding waits for the meal and — only when the meal has a recipe line — for the recipe list
     (`useRecipes().pending` false). Guarded by a `seededFrom` key like the `?recipeId` seed.
   - `?recipeId` wins if both params are present (not a real flow; defined for determinism).
   - Meal not found → the Workshop opens empty (today's behaviour), no error.
3. The logged meal is **never modified**; no meal↔recipe link is written.

Out of scope (owner-confirmed): duplicate-recipe detection; linking the meal to the new recipe;
recipe-line ingredient overrides (mezo-ormb) — `mealApi.fromResponse` drops them today, so an
expanded recipe line uses the recipe as written.

## Prior art

- **Adopted — MacroFactor** (whole logged group → "Create recipe" → prefilled editor):
  https://help.macrofactorapp.com/en/articles/14-create-recipes-from-foods-on-your-food-timeline
- **Adopted — Cronometer** (prefilled recipe editor; the diary entry is *not* relinked or changed):
  https://forums.cronometer.com/discussion/1025/create-custom-recipe-from-multiselect
- **Rejected — MyFitnessPal "Save as…" overwrite / separate "Meals" concept**: a second concept and a
  duplicate guard the owner scoped out.
  https://support.myfitnesspal.com/hc/en-us/articles/360032625331-Create-find-and-log-your-saved-meals
- No source solves estimate / quick-add lines; our answer is the Workshop's existing estimate→pantry
  "Csere" + save gate.

## Codebase terrain

- FE-only. Host: `frontend/src/features/fuel/pages/FuelMealDetailPage.tsx` (the `toEdit` door
  pattern). Target: `frontend/src/features/fuel/pages/RecipeWorkshopPage.tsx` (`?recipeId` seed,
  estimate "Csere", `draftToInput` save gate). Pure mapper beside `recipeToDraft` in
  `frontend/src/data/fuel/workshopState.ts`.
- Wire facts: `MealItemLine.refId` is `''` for estimates; a recipe line's amount is in servings
  (`adag`); `useRecipes().recipes` carries `ingredients` in both modes; `RecipeIngredientRequest`
  requires a `pantryItemId` (hence the gate).
- Traps: seed after data arrives (not in `useState` initialisers — mezo-eoc4); don't copy the bespoke
  `['recipe', id]` query (mezo-2z6g); mock rec-4/rec-5 piece units (mezo-ob1aw); the mock day has no
  pantry-sourced meal, so tests build their own fixture; run FE tests in both `VITE_USE_MOCK` modes.

## Testing

- `workshopState.test.ts`: `mealToDraft` — pantry 1:1, estimate carries `est`, recipe expansion
  scales by `amount/servings`, missing recipe → estimate, same-ref merge, name/category fallbacks.
- `FuelMealDetailPage.test.tsx`: the three door states and their targets (incl. `&d=`).
- `RecipeWorkshopPage.test.tsx`: `?fromMeal` seeds the canvas; save stays gated while an estimate
  line exists; an all-pantry seed saves via `create` (not `update`).
