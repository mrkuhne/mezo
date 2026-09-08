# Fuel exploration coverage — mezo-88jw.3

This is an isolated Design 3.0 mock exploration. Production frontend, backend and contracts remain unchanged. The two warm themes share functional state; the companion variant adds a conversational introduction and a contextual dinner invitation, while Mérték leads with the daily totals.

## Audit and adaptation

Orientation started in [CODEMAP](../CODEMAP.md) Fuel, Pantry and Recipe blocks, then [Fuel](../features/fuel.md), [Pantry](../features/pantry.md) and [Recipe](../features/recipe.md) sections 2 and 10. Read-only production references were `FuelMaiPage.tsx`, `LogFlowPage.tsx`, `KamraItemDetailPage.tsx`, and `RecipeDetailPage.tsx` under `frontend/src/features/fuel/pages/`.

| Existing behavior / evidence | Prototype adaptation |
| --- | --- |
| Fuel hub owns the daily energy/macro overview; meals live on a separate logging route. | Daily center shows energy, three macro targets, logged meals and water; one prominent logging entry. The complete meal list stays directly visible. |
| MealComposer unifies pantry, recipes and AI draft entry, followed by review. | Dedicated text, illustrated photo-example and pantry modes all reach the same editable quantity review. Correcting a saved meal replaces its row in the shared daily log. |
| Production scoring decomposes macros, composition and contextual dimensions. | Meal detail opens a distinct narrative evaluation with nutrient, time and ingredient context, an actionable recipe suggestion, source and uncertainty. No invented numeric AI score. |
| Pantry item detail connects definition, stock, edit, logging and recipe references. | Search/filter inventory, item detail, editable macros/stock/expiry/notes, manual add and bulk stock check. Recipe references and logging consume the same pantry identities. |
| Recipes expose portions, ingredients, favorites, editing and meal logging. | Visual recipe library, available/quick/favorite filters, portion scaling, full editor, pantry availability, shopping shortages and one-step-at-a-time cooking. |
| Production also carries protocol/medication, historical day navigation, weekly planning, import/catalog ownership and AI workshop paths. | Outside this food/pantry/recipe slice. The prototype has a simple editable current-day rhythm and manual goals, not the production placement engine or multi-user catalog. |

The daily center follows the requested Yazio-inspired hierarchy; recipes and evaluation remain distinct destinations. Cooking adopts the requested Nike-style guided progression, while Mezo notes and evidence context follow the requested Bevel-inspired direction. These are adaptation directions supplied for this exploration, not claims of live external-product research.

## Routes and working interactions

All routes are exported from [FuelFlow.jsx](prototypes/src/flows/FuelFlow.jsx) as `FUEL_ROUTES` and reached from the hub hierarchy.

| Route | Interaction |
| --- | --- |
| `fuel` | Live meal totals, target progress, meal details, water +250 ml, recipe/pantry/shopping/plan/settings doors. |
| `fuel-log` | Text recognition of known pantry names and grams; labelled simulated photo example; pantry picker; recipe prefill. |
| `fuel-review` | Change name, time, meal slot, ingredient grams; add/remove ingredients; add a missing pantry food; live nutrition; save or replace meal. |
| `fuel-meal` | Saved nutrition, ingredient-to-pantry links, correction and evaluation. |
| `fuel-evaluation` | Derived meal context, explicit mock sources/uncertainty, recipe suggestion, contextual Mezo conversation. |
| `fuel-pantry` | Search, categories, low-stock filter; add/edit/stock-check and availability links. |
| `fuel-item` | Stock, expiry, notes, nutrient provenance, dependent recipes and logging. |
| `fuel-item-edit` | Add/edit a food and all four nutrient values per 100 g; update stock, expiry and notes. |
| `fuel-stock` | Edit multiple pantry quantities, save, then browse newly available recipes. |
| `fuel-recipes` | Search, under-15-minute, all-ingredients-available and favorite filters; recipe creation. |
| `fuel-recipe` | Favorite toggle, half-serving increments, scaled nutrition and shortages, ingredient links, cooking and meal review. |
| `fuel-recipe-edit` | Edit/create recipe name, description, category, servings, time, ingredient quantities and written steps. |
| `fuel-cook` | Previous/next step, selected quantities, finish with explicit optional stock deduction, then log the portion eaten. |
| `fuel-shopping` | Add recipe shortages without duplicate rows, manual +100 g items, remove rows, mark purchased to replenish pantry, clear completed rows. |
| `fuel-plan` | Current-day meal time and recipe editor; explicit save; recipe links. Planning does not fabricate eaten meals. |
| `fuel-settings` | Editable daily energy, macro and water targets; Fuel hub uses them immediately. |

## State and seams

[createFuelState](prototypes/src/flows/fuel-state.mjs) returns `{pantry, recipes, shopping, draft, cooked, plan, targets}`. Pantry has nine editable food definitions and gram stocks; recipes have four sample recipes. Ingredient rows use stable pantry IDs and grams. Recipe ingredient quantities refer to the whole recipe; portion scaling divides by `servings`.

The root owns persistence, theme switching and navigation. Fuel uses `api.update('fuel', updater)`, root-owned `state.meals` via `api.addMeal` and `api.update('meals', updater)`, `api.nutrition`, `state.water`, `api.water`, `api.ask`, and `api.celebrate`. New meal IDs supplied to `api.addMeal` must be retained because the next route opens that ID. Root responses that describe a calorie remainder should read `state.fuel.targets.kcal` to match the editable hub target.

## Mock boundaries and verification

Text interpretation only matches known pantry names/aliases and gram quantities; an unrecognized meal stays empty for manual correction rather than being replaced by a different food. The photo route uses an existing SVG food illustration and an explicitly labelled preset, without camera permission, upload or image recognition. Nutrition is calculated from editable sample data, never a verified nutrient service. Evaluation is deterministic copy, not a remote model or medical assessment.

Shopping purchases are user-confirmed mock stock changes, not orders. Cooking does not run a timer or call a device, and its current guided step is local UI state. Stock is deducted only at cooking completion when the user leaves the checkbox enabled and all ingredients are available. Meal logging itself does not deduct stock. Root persistence covers saved data; unsaved pantry/recipe/plan editor forms and cooking steps do not survive route remounts. Historical/weekly nutrition and automatic protocol placement are not reproduced here.

TDD evidence: `node --test docs/design_3.0/prototypes/src/flows/fuel-state.test.mjs` first failed with the missing state module, then passed six behavioral tests: quantity correction and nutrition, honest unknown text, scaled recipe shortages with idempotent shopping/restock, atomic stock consumption, pantry reference-preserving edits and recipe validation. A focused Vite build with `src/flows/FuelFlow.jsx` as its entry compiles the actual flow. Integrated visual/mobile QA belongs to the root task.
