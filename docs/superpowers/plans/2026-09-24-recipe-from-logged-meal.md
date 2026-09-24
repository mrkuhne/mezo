# Recipe from a logged meal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged meal's detail page gets a "Mentsük receptként" door that opens the Receptműhely prefilled with the meal's lines (spec: `docs/superpowers/specs/2026-09-24-recipe-from-logged-meal-design.md`, bd `mezo-n9wgg`).

**Architecture:** FE-only. A pure `mealToDraft` mapper beside `recipeToDraft` in `workshopState.ts`; the Workshop page reads a new `?fromMeal=<id>[&d=<day>]` param and seeds once; the detail page renders the door (or "Megnyitom a receptet" for a single-recipe meal).

**Tech Stack:** React 18 + react-router 6 + TanStack Query, Vitest + Testing Library.

## Global Constraints

- Hungarian UI copy exactly: `Mentsük receptként`, `Megnyitom a receptet`, fallback name `Új recept`.
- Reuse the `fmx-edit-door` class — no new CSS.
- Seed after data arrives, never in `useState` initialisers (mezo-eoc4); no bespoke query keys (mezo-2z6g).
- Tests in both modes: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test` and `CI=true VITE_USE_MOCK=false pnpm test` (file filters don't scope — the full suite runs).
- Commit subjects carry `(mezo-n9wgg)`.

---

### Task 1: `mealToDraft` pure mapper

**Files:**
- Modify: `frontend/src/data/fuel/workshopState.ts` (after `recipeToDraft`)
- Test: `frontend/src/data/fuel/workshopState.test.ts`

**Interfaces:**
- Produces: `mealToDraft(meal: FuelMeal, recipes: Recipe[], pool: PickableIngredient[]): WorkshopDraft`

Rules: name = `mealDisplayName(meal) ?? 'Új recept'`; category = `mealSlotKey(meal) ?? 'snack'`; servings 1; steps [].
pantry → pantry line; estimate → `{source:'estimate', refId:null, name, amount, unit, est: contribution}`;
recipe → found: each ingredient `{source:'pantry', refId, name: i.name ?? pool name ?? refId, amount: round1(i.amount × amount / max(1, servings)), unit}`; not found → estimate line from the logged line.
Pantry lines with equal `refId`+`unit` merge (sum, round1), first position kept.

- [ ] Step 1: failing tests — pantry 1:1; estimate keeps `est`; recipe expansion scaled (servings 2, logged 1 adag → halves); missing recipe → estimate; merge of same ref+unit; name/category fallbacks.
- [ ] Step 2: run `CI=true VITE_USE_MOCK=true pnpm vitest run src/data/fuel/workshopState.test.ts` → FAIL (not exported).
- [ ] Step 3: implement.
- [ ] Step 4: rerun → PASS.
- [ ] Step 5: commit `feat(fuel): mealToDraft — a logged meal as a workshop draft (mezo-n9wgg)`.

### Task 2: Workshop `?fromMeal` seed

**Files:**
- Modify: `frontend/src/features/fuel/pages/RecipeWorkshopPage.tsx` (seed block ~:103-152)
- Test: `frontend/src/features/fuel/pages/RecipeWorkshopPage.test.tsx`

**Interfaces:** Consumes `mealToDraft`; `useFuelDay(d ?? undefined)` from `@/data/hooks`; `useRecipes().pending`.

Seed only when `!seedId`, the meal is found, and (meal has no recipe line or `!pending`). Guard with `seededFrom === 'meal:<id>'`. `sourceRecipeId` stays null (create).

- [ ] Step 1: failing tests (mock mode, `useFuelDay` mocked to a day with a pantry+estimate meal and an all-pantry meal): `?fromMeal=` seeds the name + rows, gate holds while an estimate exists; the all-pantry meal saves via `createSpy` (not `updateSpy`) with the seeded `pantryItemId`s.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run → PASS (existing workshop tests too).
- [ ] Step 5: commit `feat(fuel): the Műhely seeds from a logged meal via ?fromMeal (mezo-n9wgg)`.

### Task 3: The door on the meal detail page

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMealDetailPage.tsx` (beside `fmx-edit-door`, header comment)
- Test: `frontend/src/features/fuel/pages/FuelMealDetailPage.test.tsx`

- [ ] Step 1: failing tests: mixed meal → "Mentsük receptként" → `/fuel/recipes/muhely?fromMeal=meal-1`; with `?d=` → `&d=`; single-recipe meal → "Megnyitom a receptet" → `/fuel/recipes/rec-9`; empty-lines meal → neither door.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: PASS.
- [ ] Step 5: commit `feat(fuel): Mentsük receptként — the recipe door on a logged meal (mezo-n9wgg)`.

### Task 4: Docs, gates, merge

- [ ] Update `docs/features/recipe.md` and `docs/features/fuel.md` (entry point + `?fromMeal`); `node scripts/gen-codemap.mjs --check` (regenerate if needed).
- [ ] Full FE suite both modes + `pnpm build`; typecheck.
- [ ] Merge per AGENTS.md (detached HEAD, `--no-ff`, push main), close mezo-n9wgg, tracker backup.
