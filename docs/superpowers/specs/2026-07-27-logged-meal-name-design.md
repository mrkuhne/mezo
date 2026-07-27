# Logged-meal name — display + capture (design)

- **Date:** 2026-07-27
- **Driving issue:** mezo-u68c
- **Status:** design approved (implementation pending)
- **Scope:** frontend only (`frontend/src`). No backend/API/DB change.

## 1. Problem (root cause, confirmed on live DB)

Real-mode logged meals render with a **blank title** in the Fuel timeline. Two compounding defects:

1. **The title is never captured on the manual log path.** `LogMealSheet.save()` hard-codes `title: null` (`sheets/LogMealSheet.tsx:126`); there is no name input, and a recipe's name is never carried onto the meal. The backend faithfully stores that null (`MealService.java:151`, no fallback). Mock mode masks it — `data/fuel/fuelHooks.ts:230` synthesizes `title ?? lines[0]?.name ?? 'Étkezés'` — so the bug is real-mode-only.
2. **The render layer can't recover.** `data/fuel/mealApi.ts:145` coerces a null title to `''`, and `components/SlotCard.tsx:62` uses `slot.mealName ?? slot.label` — `??` does not fall through on an empty string, so even the slot label ("Reggeli"/"Vacsora") doesn't show → a blank card.

Live DB evidence: a recipe-logged meal (`PB Banana Toast Pre-workout`) and a pantry-assembled meal (4 items) both have `title = ''`.

## 2. Decisions (agreed)

- **Editable name field with a smart default** in `LogMealSheet` (owner chose this over auto-only or manual-only). The default derives from the meal's lines; the user can override before saving.
- **Derived default format:** the line names joined with `", "`, whole names accumulated up to a length cap, then `"…"` if more remain. A single recipe line therefore yields the recipe name; pantry items yield the joined item names. (One unified rule — no recipe/pantry special-casing.)
- **Display fallback** so nothing is ever blank AND existing title-less meals de-blank without a backfill: display name = `meal.title` (if non-empty) → else `deriveMealName(meal.mealItems)` → else the slot label.
- **Frontend only.** `MealInput.title` is already plumbed to the backend (`req.getTitle()` → `meal.setTitle()`), so capturing a real title needs no backend change. The existing blank meals are de-blanked at render (they carry `mealItems` with frozen `name`s — `types.ts:71-78`).

## 3. The shared helper

`frontend/src/features/fuel/logic/deriveMealName.ts`

```
deriveMealName(names: string[]): string
```
- Filters falsy names; returns `''` when none.
- Accumulates whole names joined by `", "` while the running length stays within `MAX_DERIVED_NAME_LEN` (a module const, ~56); when the next name would overflow and names remain, returns the accumulated prefix + `"…"`.
- Pure, deterministic, unit-tested. Used by BOTH the `LogMealSheet` default and the `buildDayPlan` display fallback (DRY — one rule everywhere).

## 4. Touch points

- **New:** `features/fuel/logic/deriveMealName.ts` (+ colocated test).
- **`sheets/LogMealSheet.tsx`:** add a name `<input>` whose shown value is `userEdited ?? deriveMealName(resolved line names)` (derived-until-touched — re-derives as lines change until the user types, then their value sticks); `save()` sends `title = shownName.trim() || null` (was `null`).
- **`logic/buildDayPlan.ts`:** at the logged-slot / surplus-logged sites (`mealName` ~`:324`,`:368`; `label` ~`:364`) use a local `displayName(m) = m.title || deriveMealName(m.mealItems.map(l => l.name)) || undefined` instead of the bare `m.title`.
- **`components/SlotCard.tsx:62`:** `slot.mealName ?? slot.label` → `slot.mealName || slot.label` (defensive: empty never wins over the label).

## 5. Testing

Both modes must stay green (`pnpm test` and `VITE_USE_MOCK=true pnpm test`) + `pnpm build`.
- `deriveMealName` unit: single recipe → recipe name; several pantry names → joined; overflow → prefix + "…"; single item → its name; empty → "".
- `LogMealSheet`: default shown from prefill lines; user edit overrides; `save()` payload carries the derived/edited `title` (not null); empty-after-clear → null.
- `buildDayPlan`: a logged meal with an empty `title` but non-empty `mealItems` → slot `mealName` is the derived name (not `''`/blank); with a title → the title.
- `SlotCard`: empty `mealName` falls back to `slot.label`.

## 6. Out of scope

- The training-aware scoring (mezo-ta8p, shipped) and its follow-ups (mezo-tm76).
- Any backend title-derive fallback — not needed (FE render-derive covers existing meals; capture stores real titles for new ones).
- Renaming an already-logged meal (edit flow) — not requested; the capture default + display fallback cover the reported cases.
