# Recipe Detail — Two Main Tabs (Részletek / Hozzávalók) — Design

> **Date:** 2026-07-25
> **Status:** Approved (brainstorming + browser mockup) → next: writing-plans
> **Driving issue:** `mezo-n3xa`
> **Mockup:** [`2026-07-25-recipe-detail-tabs-mockup.html`](2026-07-25-recipe-detail-tabs-mockup.html) — approved
> **Scope:** `RecipeDetailPage.tsx` layout restructure only. No data-layer, hook, or contract change; no backend change.

## Problem

The recipe detail page (`frontend/src/features/fuel/pages/RecipeDetailPage.tsx`) is a single
long scroll: hero → macro hero → meta strip → ingredient cards (the longest block — one card
per line with per-line `MacroCells`) → logs → **and only then** the AI evaluation (Mezo ·
sablon-olvasat + PONTSZÁM, `mezo-bw3y`). The AI evaluation is the page's highest-value
content, and reaching it requires scrolling past the entire ingredient list.

## Approved decisions

| Decision | Choice |
|---|---|
| Split | **Hero + macros shared above tabs**; content below splits into two in-page tabs |
| Tabs | **„Részletek”** (default) and **„Hozzávalók · N”** (N = ingredient-line count) |
| Meta strip | **Deleted.** NOVA (its only non-redundant datum) moves into the hero meta line, colored |
| Actions | `+ Mai étkezéshez` CTA + Csillag / Szerkesztés / Törlés stay **below the tab content on both tabs** — in normal page flow at the end of the page (as today), NOT sticky/fixed |
| Tab mechanics | Local `useState`, **not routed** — the `GrowthPage.tsx` `SegButton` tablist pattern (`role="tablist"`/`role="tab"`, `aria-selected`); coral wash for the active tab (Fuel accent, GrowthPage uses lavender) |

## Layout (after)

```
Top bar (‹ vissza · RECEPT)
Hero card        — image band (slot chip, star, RecipeFitBadge) +
                   name + meta line: „2 adag · 12 perc · NOVA 1 · létrehozva …”
                   (NOVA colored via the existing NOVA_COLOR map)
ServingToggle    — 1 adag / egész (basis state unchanged)
Macro hero       — 4 × MacroHeroCell (kcal / Fehérje / Szénh. / Zsír)
──────────── main tabs ────────────
[ RÉSZLETEK ]  [ HOZZÁVALÓK · 5 ]
  Részletek (default):            Hozzávalók:
    Mezo · sablon-olvasat card      ingredient cards (unchanged:
    (pending twinkle / prose +      left category border, SourceBadge,
    fitsFor chips / no-data card)   note, amount, MacroCells row)
    PONTSZÁM section header +
    ScoreBreakdownBody
    LOGOK header + RecipeLogsList
───────────────────────────────────
Actions (both tabs) — CTA + ghost row
```

## Behavior

- **Default tab: Részletek** — after hero + macros the AI evaluation is immediately visible
  (~one screen), which resolves the driving complaint.
- Tab state is component-local and resets to Részletek on every navigation; no deep-link,
  no URL param. `FUEL_TABS` section routing is untouched.
- The three breakdown states move into the Részletek tab unchanged: pending twinkle card,
  prose+PONTSZÁM render, and the „nincs elég adat” fallback card.
- The not-found guard, `useRecipeLogs`/`useRecipeBreakdown` hook-order comment, star/edit/
  delete/log actions, and `LogMealSheet` wiring are all unchanged.
- No scroll management on tab switch — both tab bodies are short.

## Component changes

One file restructured, no new files needed beyond an optional local `SegButton`-style helper
inside `RecipeDetailPage.tsx` (GrowthPage keeps its own local copy too; two local copies are
fine, extraction to `shared/ui` is NOT in scope — the two differ in accent wash):

- `frontend/src/features/fuel/pages/RecipeDetailPage.tsx` — add `tab` state
  (`'reszletek' | 'hozzavalok'`, default `'reszletek'`), render the tab bar after the macro
  hero, wrap the existing section JSX into the two tab bodies, delete the meta-strip block,
  extend the hero meta line with NOVA (reusing `NOVA_COLOR`).
- `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx` — updated (below).

Data layer, `api/`, backend: **no change**.

## Testing

Update `RecipeDetailPage.test.tsx` (both modes must stay green — `pnpm test` and
`VITE_USE_MOCK=true pnpm test`):

- default render shows the Részletek tab: breakdown/PONTSZÁM content present, **no**
  ingredient rows rendered;
- clicking „Hozzávalók” shows the ingredient lines (and hides breakdown content);
- the tab button exposes the ingredient count;
- hero meta line contains `NOVA`; the old meta-strip cells (`Adag`/`Idő` tiles) are gone;
- actions (CTA + Törlés) render on both tabs;
- existing action/state tests (star toggle, delete, log sheet, pending breakdown) keep
  passing with at most tab-switch setup added.

## Docs impact

- `docs/features/fuel.md` — recipe-detail section updated to the two-tab structure (same
  change), then `node scripts/lint-docs.mjs`.
- This spec + the approved mockup are the frozen design artifacts.
