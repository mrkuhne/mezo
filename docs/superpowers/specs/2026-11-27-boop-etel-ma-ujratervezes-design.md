# Boop Étel Ma — újratervezés: vezetett szem, étkezés saját oldala, javítás és törlés

> bd `mezo-r36n9.184` · epic `mezo-r36n9` · B4 Étel · decisions #119, #120 (+ #121 below) · 2026-11-27

## 1. Intent — why

The owner, 2026-11-27: „nagyon egybefolyik az egész, nincs vezetve a szemem… csak ömlesztett szöveget érzek meg
listákat." The Ma tab (`ios/Boop/Etel/EtelMa.swift`) is ten identical `NKBare` blocks (hue tick + small caps label,
no surface) stacked: Ma eddig · A nap menete · Makrók · A mai étkezések · Italok · Víz · Kiegészítők · ask row. No
element outranks another, so nothing leads the eye. Benchmark: Yazio — one dominant number, macros, then the logged
meals, each section on its own surface. Two functional gaps ride along: a logged meal has no page of its own (its
details expand in place, Boop's evaluation squeezed into the row), and a logged meal cannot be corrected or removed.

## 2. Goals · non-goals · anti-goals

**Goals**
1. A three-tier page (#120): hero → meal cards → small cards; kcal, macros and logged meals in focus.
2. A lighter page that keeps the green hue (#121).
3. A logged meal opens its own detail page with Boop's evaluation; Javítás · Törlés at the bottom (#116 look-first).
4. **Javítás = full correction** (#121): the familiar composer opens pre-filled — amounts, add/remove items, time,
   window; saving re-scores (server `updateMeal` already re-scores and publishes `MealSavedEvent`).
5. **Törlés** from the detail page and by swiping a row left; no confirm dialog — a few seconds of „Visszavonás".

**Non-goals:** the Hét / Receptek / Kamra tabs (they follow later on the same rule); new backend scoring; the
composer's own capture flows; drinks get the same row → detail → edit/delete path but no new drink features.

**Anti-goals:** the retired no-card / „kevés kártya, sok egymondatos tény" layout (#119); red or judging colour
for over-budget (stays a negative number in the normal colour, no streaks); emoji; the word „Mezo".

## 3. Constraints

- Napkelte canon: dark glass, painted sky, colour only in the sky, the orbs and the key numbers; shared kit
  (`BoopDesign/Napkelte/`). New kit pieces are additive (other rooms still use `NKBare` until they move).
- Every block loads and fails on its own (`NKBlockState` semantics stay, now inside a card).
- Offline: correction and delete go through the existing food outbox pattern, or are disabled with a calm line when
  offline — the builder picks per the outbox's capabilities (§6).
- Playbook §9 bar: Dynamic Type XXXL, VoiceOver on ring / bars / rows / swipe (swipe never the only route), smallest
  iPhone width, reduced motion (ring fills without animation), cached day shows instantly.

## 4. Approaches (owner picked A — three tiers, curve swipeable)

| | What | Cost |
|---|---|---|
| **A (picked)** | Hero card: kcal ring + 3 macro bars; page 2 of the hero = the day's curve. Meal cards. Small cards. | Curve one swipe away. |
| B | Same, curve as its own card under the hero. | Longer page, meals pushed down. |

Correction: **1 (picked) full composer** vs 2 quick sheet (portion / time / window only — cannot fix a misread item).

## 5. Design

### 5.1 Page order (top → bottom)

1. **Pending draft cards** (unchanged `PendingMealCards`) and the **kímélő highlight** (unchanged) when present.
2. **Hero glass card** (paged, two dots):
   - *Page 1:* a large kcal ring (eaten / budget) with **„még 1 240 kcal"** (például) as the one dominant number in the
     centre, „1 860 / 3 100 megvan" under it; to the right or below, three slim macro bars (Fehérje highlighted
     first, Szénhidrát, Zsír) with „még N g". Over budget: the ring closes, the centre reads „−120 kcal", normal
     colour. Kímélő day (GUIDANCE): no budget — the ring is replaced by „ma nincs keret" + the eaten kcal; macro bars
     show eaten only.
   - *Page 2:* the day's curve (today's `NKCurve` + legend + note), same card size.
3. **Capture row** — Fotó (primary) · Leírom · Szokásos, unchanged behaviour, sits right under the hero.
4. **Meal cards — one glass card per plan window** (Reggeli, Ebéd, …):
   - Header: window name + time span, the window's kcal total right-aligned (or „0 / 650 kcal" budget when empty),
     a „+" that opens the composer for that window.
   - Body: logged meals as rows (thumbnail, name, time, score chip, kcal + protein, chevron →). **Tap pushes the
     meal detail page.** Swipe left → Törlés; long-press context menu → Megnyitás · Javítás · Törlés.
   - The open-now window keeps Boop's suggestion + Megeszem / Kihagyom inside its card; a skipped window shows its
     skipped state + undo; later empty windows are a quiet one-line card body.
5. **Small cards row(s):** Víz (+250 / +500, progress), Kiegészítők (Bevettem), Italok (when any; rows push the same
   detail page). Smaller type, compact height.
6. **Ask row** „Kérdezd meg Boopot az étkezésedről" (unchanged).

Section labels stay small caps but now sit **on** their card's header, so the card edge does the separating.

### 5.2 Lighter, still green (#121)

The painted sky's green is desaturated and lifted (brighter, less dense band), the glass cards go neutral (white
tint, not green-tinted), green stays on the ring, the key numbers, the primary capture tile and the sky's top. The
spike shows **two lightness steps side by side**; the owner picks one. Implemented as an Étel-room hue/sky
parameter, not a global change.

### 5.3 Meal detail page (pushed, `NKAreaSubPage`)

Top → bottom: the photo as a hero band (or the bowl glyph medallion), name, window · time, score ring; a macro
strip (kcal · F · Sz · Zs) as a small graphic; ingredients grouped by recipe with amount and kcal; **Boop's
evaluation** — the eight dimensions grid (tap explains one, as today), Boop's words, glucose tips. Bottom action
bar: **Javítás** (primary) · **Törlés** (secondary, destructive tint). Loading the coach text shows the cached
envelope first, as today's `MealDetail` does.

### 5.4 Javítás

Opens the composer at its draft-review stage pre-filled from the meal (items with amounts, time, window, photo
kept). Saving calls `updateMeal` (same id, so no duplicate); the page and the day refresh, the score and Boop's
words update. Cancel changes nothing.

### 5.5 Törlés

Detail page button or row swipe → the meal disappears at once, a toast „Töröltem: <név>" with **Visszavonás** for
~5 s; the server delete fires when the toast expires (or immediately with a re-create on undo — §6). The day's
numbers and curve update immediately.

## 6. Left to the builder

- iOS `FoodClient.update/delete` wrappers over the generated `updateMeal` / `deleteMeal` (+ the photo on delete).
- Undo strategy: deferred delete vs delete + re-create (re-create loses the id and the photo link — prefer deferred).
- Composer edit mode: a `MealStart` seeded from a `Meal` → `MealDraft`; save routed to update.
- Offline behaviour of edit/delete given the existing `FoodOutbox`.
- `swipeActions` outside `List` needs a recent iOS; otherwise a custom swipe or the context menu as the route.

## 7. Prior art

Yazio diary (help centre): per-meal categories each with „+", swipe-left deletes instantly, entries open their own
screen with a trash icon. Pattern across Yazio / Lifesum / Lose It!: one hero (kcal ring or remaining figure) + three
slim macro bars, then meal cards with right-aligned per-meal totals, secondary text small and grey; Cronometer's
density kept off the today screen and moved to the detail page. Apple HIG / WWDC25: push for drill-down, sheet for a
focused task, destructive swipe on the trailing edge and never the only route (context menu / detail button too),
glass reserved for the control layer. Sources: help.yazio.com articles 360002407038, 360000530018;
developer.apple.com/videos/play/wwdc2025/323.

## 8. Codebase terrain

- `ios/Boop/Etel/EtelMa.swift` — the page (blocks, `mealRow` with in-place expand, `openRow`/`skippedRow`/`quietRow`,
  water, supplements).
- `ios/Boop/Etel/MealCard.swift` — `MealDetail`, `DimensionGrid` (reuse on the detail page).
- `ios/Boop/Etel/Composer.swift` — `MealStart`, `MealComposerModel` (saver closure → needs an update path).
- `ios/BoopKit/Sources/BoopCore/Etel/FoodClient.swift` — no `updateMeal`/`deleteMeal` calls yet.
- `ios/BoopKit/Sources/BoopDesign/Napkelte/Area*.swift`, `Etel.swift` — kit (`NKBare`, `NKCurve`, `NKStatRow`, `NKAreaSubPage`).
- Backend `MealController.updateMeal/deleteMeal` exist; `MealService.update` re-scores and publishes `MealSavedEvent`.
- Handbook `docs/boop-handbook/06-etel/01-etel-szoba-ma.md`, `02/03` — rewrite on ship.
