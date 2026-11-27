# Boop Étel Ma újratervezés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, the munkamenet default) to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Étel Ma tab becomes the accepted three-tier page (hero ring card + curve page → one card per meal
window → small cards), on the lighter „világos 2” green sky; a logged meal opens its own page with Boop's evaluation;
a logged meal can be fully corrected (the composer, pre-filled) or deleted (detail button, row swipe, context menu)
with a few seconds of „Visszavonás”.

**Architecture:** iOS only — the server already has `PUT /api/meal/{id}` (`updateMeal`, full replace, re-scores,
publishes `MealSavedEvent`, keeps the photo and the stored plan window when `window` is absent) and
`DELETE /api/meal/{id}` (`deleteMeal`, soft delete + photo bytes). The phone gains the two calls in `FoodClient`, a
`MealDraft(editing:)` seed, an edit mode in `MealComposerModel` (saver routed to update), a deferred-delete in
`EtelStore` (hide now, call the server when the toast expires), a production `MealDetailPage`, and the spike's
`EtelMa` layout rebuilt from `spike/boop-etel-ma` (look reference; **not merged** — this branch starts from main).

**Tech Stack:** SwiftUI iOS 26, Swift Testing, swift-openapi-generator (operation filter in
`ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`), Napkelte kit (`BoopDesign/Napkelte/`).

**Spec:** `docs/superpowers/specs/2026-11-27-boop-etel-ma-ujratervezes-design.md` · decisions #119, #120, #122, #123 ·
bd `mezo-r36n9.184` (acceptance = the *Kész, ha…* list at the end).

## Global Constraints

- Napkelte canon: dark glass, colour only in the sky, the orbs, the ring and key numbers; no emoji; never „Mezo”.
- Over budget is a negative number in the normal colour („−120 kcal”), never red, no streaks.
- Kímélő day (`fuelMode == "GUIDANCE"`): ring replaced by „ma nincs keret” + eaten kcal; macro bars show eaten only;
  no Kihagyom.
- Every block still loads and fails on its own (`NKBlockState` semantics, now inside a card).
- Swipe is never the only route: context menu (Megnyitás · Javítás · Törlés) and the detail page's buttons too.
- Edit and delete need the net: offline → the buttons stay visible but disabled with the calm line
  „Javítani és törölni net kell — most nincs.” (no outbox path for them in this slice).
- Javítás keeps the meal's time: the update sends `capturedAt = meal.loggedAt` (the server's `momentOf` otherwise
  stamps "now"), the slot, the title; `window` omitted (server keeps the stored window).
- Delete is deferred: the meal disappears at once (day numbers, curve, window card), toast „Töröltem: <név>” with
  **Visszavonás** for 5 s; the server call fires when the toast expires; a failed call puts the meal back with
  „Nem sikerült törölni — visszatettem.” Leaving the room / backgrounding fires the pending delete immediately.
- The lighter sky applies to the Étel room pages only (`NKAreaPage` / `NKAreaSubPage` with `.fuel`); the Fuel orb
  elsewhere keeps its colours.
- §9 bar: Dynamic Type XXXL (ring centre and window totals scale, rows wrap), VoiceOver labels on ring, bars, rows,
  swipe and menu actions; iPhone SE width; reduced motion (ring drawn without animation, no page auto-advance);
  cached day shows instantly.

## Review Focus

1. **Update loses data** — an `estimate` line must round-trip its macros (per = amount, basis = unit, macros =
   contribution + nutrients); a recipe line must carry its `ingredientOverrides`; a pantry line its `pantryItemId`.
   → Task 1 tests.
2. **Update moves the meal in time or window** — `capturedAt` = original `loggedAt`; `window` absent. → Task 1 test
   on the PUT body.
3. **Deleting then undoing** never calls the server; deleting twice (swipe + menu) issues one call. → Task 3 tests.
4. **A failed delete** restores the meal and the numbers exactly. → Task 3 test.
5. **The composer in edit mode** never creates a duplicate (no `createMeal` call), never parks an outbox card. →
   Task 2 test.

---

### Task 1: BoopCore — update / delete calls and the edit seed

**Files:**
- Modify: `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` (add `updateMeal`, `deleteMeal` under
  `filter.operations`, next to `createMeal`)
- Modify: `ios/BoopKit/Sources/BoopCore/Etel/FoodModels.swift` (`MealItem` += `pantryItemId: UUID?`,
  `fiberG/sugarG/saltG/saturatedFatG: Double?`, `ingredientOverrides: [MealIngredientOverride]`; new
  `MealIngredientOverride` mirroring the response shape; `DraftItem` += `ingredientOverrides` defaulting to `[]`)
- Modify: `ios/BoopKit/Sources/BoopCore/Etel/FoodClient.swift` (`map(MealResponse)` fills the new fields;
  `itemRequest` sends overrides; new `update` / `delete`)
- Modify: `ios/BoopKit/Sources/BoopCore/Etel/MealDraft.swift` (`MealDraft.init(editing: Meal)`)
- Modify: the app's preview transport (`ios/Boop/…/PreviewTransport*.swift`) — answer `PUT`/`DELETE /api/meal/{id}`
  with 204 and drop / replace the meal in its in-memory day
- Test: `ios/BoopKit/Tests/BoopCoreTests/FoodClientTests.swift` (+ `MealDraftEditTests.swift`)

**Interfaces — Produces:**
- `FoodClient.update(_ mealId: UUID, with draft: MealDraft, at loggedAt: Date) async throws` — builds
  `MealRequest(slot: draft.slot, title: draft.title, items: …, capturedAt: loggedAt)`; 204 → return; 400 →
  `.rejected`; 401 → `.unauthorized`; 404 → `.gone` (new case, or `.rejected` if adding a case ripples too far);
  network → `.offline`.
- `FoodClient.delete(_ mealId: UUID) async throws` — 204 / 404 both succeed (already gone); 401 → `.unauthorized`.
- `MealDraft(editing m: Meal)` — `date = m.mealDate`, `slot = m.slot`, `title = m.title`, `draftId = nil`,
  `photo = nil` (the stored photo stays on the server); items: `source = DraftSource(rawValue: m.source) ?? .estimate`,
  `pantryItemId`, `recipeId`, `recipeName`, `name`, `amount`, `unit`, `per = amount`, `basisUnit = unit`,
  macros = `contribution`, nutrients, `nova`, `confidence = 1`, `needsReview = false`, overrides.

- [ ] Write failing tests: PUT body carries `capturedAt` = the meal's `loggedAt`, no `window`, every item field
      incl. `pantryItemId` and overrides; 204 returns; 400 throws `.rejected`; DELETE hits `/api/meal/<id>`, 404 is
      success; `MealDraft(editing:)` round-trips an estimate line (scaling `amount` ×2 doubles kcal via the
      existing per-basis maths) and keeps a recipe line's overrides.
- [ ] Add the two operations to the generator filter; build BoopKit so the generated client has them.
- [ ] Implement the model fields, mapping, `update`, `delete`, `init(editing:)`; preview transport handlers.
- [ ] `cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package …` (README command) → green.
- [ ] Commit `feat(boop): FoodClient update/delete + edit seed (mezo-r36n9.184)`.

### Task 2: Composer edit mode

**Files:**
- Modify: `ios/Boop/Etel/Composer.swift` (`MealStart` += `editing: BoopCore.Meal?`, `Entrance.edit`;
  `MealComposerModel` += `editingId`/`editingAt`, an `updater` closure; the host opens straight on `.draft`)
- Test: `ios/BoopTests/MealComposerTests.swift`

**Interfaces — Consumes:** Task 1 `update`, `MealDraft(editing:)`.
**Produces:** `MealStart(entrance: .edit, editing: meal)`; in edit mode `save()` calls the updater, never the saver,
never `ensureParked()` / the outbox; success toast „<cím> javítva · <kcal> kcal”; the sheet title is „Javítás”;
the photo step is hidden (the stored photo stays; replacing it is out of scope); cancel changes nothing.

- [ ] Failing tests: edit-mode save calls the updater once with the meal id and original `loggedAt`; the saver and
      the outbox are untouched; a rejected update shows `rejectedSaveLine`; add / remove / re-amount items before
      save is reflected in the sent draft.
- [ ] Implement; `MealComposerModel(food:…)` convenience init wires the updater to `food.update`.
- [ ] Boop app tests (README command, `-only-testing:BoopTests/MealComposerTests`) → green. Commit.

### Task 3: EtelStore deferred delete + undo

**Files:**
- Modify: `ios/Boop/Etel/EtelRoom.swift` (`EtelStore`: `removeLocally(_:)`, `restore(_:)`, `pendingDelete`,
  `commitDelete(food:)`; the room's toast gains an action button — reuse `nkToast` if it supports one, else add
  an additive `nkToast(_:action:)` variant in the kit)
- Test: `ios/BoopTests/EtelStoreTests.swift`

**Produces:** `removeLocally(meal)` drops the meal from `day.meals`, subtracts its macros from `day.consumed`, adds
them back to `plan.remaining`, drops its id from the window's `loggedMealIds` (recomputing that window's `state`
is left to the server's next load), and keeps a snapshot; `restore` puts the snapshot back exactly;
`commitDelete` calls `food.delete` once, then reloads the day; on failure restores and returns the failure line.
A second `removeLocally` of the same id is a no-op. A new delete while one is pending commits the older first.

- [ ] Failing tests for: numbers after remove; undo restores byte-equal day/plan; commit calls delete once; failure
      restores; double delete one call; pending delete committed on `scenePhase != .active` / room disappear.
- [ ] Implement; wire the toast (5 s, „Visszavonás”) in `EtelRoom`. Tests green. Commit.

### Task 4: Lighter Étel sky (#123) and the meal detail page

**Files:**
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Tokens.swift` (`Hue.roomSky` / `roomTop`: `.fuel` →
  `0x4A8796 / 0xA8D9CB / 0xF6F9E8`, top `0x3D5F5C`; every other hue = `sky` / `top`)
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Area.swift` (`NKAreaPage` and `NKAreaSubPage` paint with
  `roomSky` / `roomTop`; the orbs keep `sky`)
- Create: `ios/Boop/Etel/MealDetailPage.swift` (from `MealDetailSpike.swift`: numbers strip, ingredients grouped by
  recipe via `recipePartGroups`, „BOOP ÉRTÉKELÉSE” with `MealDetail(showNumbers: false)`, bottom bar Javítás ·
  Törlés; the composer sheet in edit mode is presented **from this page**; after a save the page re-reads the meal
  from `store.day` by id; Törlés closes the page then starts the deferred delete)
- Modify: `ios/Boop/Etel/MealCard.swift` (`MealDetail.showNumbers`)

- [ ] Implement; offline → both buttons disabled + the calm line; VoiceOver labels; XXXL check in the simulator.
- [ ] Commit.

### Task 5: The three-tier Ma page

**Files:**
- Modify: `ios/Boop/Etel/EtelMa.swift` — port from the spike: `heroCard` (paged `TabView`, two dots; page 1 ring +
  „még N kcal fér bele” + megetted / fehérje stats + three macro bars; page 2 `NKCurve` + legend + note), capture row
  right under the hero, `windowCard` per `etelWindowItems` (header: name, MOST badge, time span, total or budget,
  „+” opening the composer **for that window's slot**), `mealRow` (tap → detail via `fullScreenCover`, the house
  pattern of `MezoDetailPage`; `.swipeActions` trailing Törlés where the row sits in a list-like container, else a
  custom trailing swipe; context menu Megnyitás · Javítás · Törlés), `openBody`, skipped and quiet bodies; small
  cards Víz · Kiegészítők · Italok (drinks push the same detail page); the ask row last. Remove the old in-place
  expand (`opened`) and `NKBare` blocks of this tab.
- Modify: `ios/Boop/Etel/EtelRoom.swift` — Ma head „Most: <ablak>” + that window's suggestion as the sentence (spike);
  other tabs unchanged.
- Test: `ios/BoopTests/EtelMaTests.swift` (pure helpers: window total / budget text, ring fraction and centre text
  incl. over budget „−120” and GUIDANCE, slot label of a meal).

- [ ] Failing helper tests → implement → green.
- [ ] Simulator walk: `-preview shell -previewHome etel`, normal / over budget / kímélő / empty day / offline /
      error states, iPhone SE width, XXXL, VoiceOver on ring + rows + menu, reduced motion. Screenshots in the
      scratchpad for the report.
- [ ] Commit.

### Task 6: Docs, gates, ship

- [ ] `docs/features/boop-ios.md` (Étel Ma section + milestone line), handbook `docs/boop-handbook/06-etel/01-etel-szoba-ma.md`
      rewritten (+ `02`/`03` where they describe the meal row), `_jegyek.json` row state, `_kiadasok.json` row on merge,
      `_funkciok.json` (meal update / delete → app).
- [ ] `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0 errors / 0 stale.
- [ ] Full `xcodebuild test` BoopKit + Boop (README commands) green.
- [ ] Final fresh-context review (most capable model) on the diff against Review Focus.
- [ ] Merge (`--no-ff`, detached HEAD from the worktree), push, install on the phone, walk through: open a meal, read
      the evaluation, correct an amount (score changes), delete with undo, delete for real (production DB shows
      `is_deleted = true` for that row), Notion sync via a sonnet worker, Hungarian report.

## Kész, ha…

- [ ] Ma tab = hero (ring + 3 bars, swipe to curve) → capture row → one card per window → Víz / Kiegészítők / Italok
      cards → ask row; matches spike round 1 (`etel-ma-proba-1.jpg`) on the „világos 2” sky.
- [ ] Over budget shows „−N kcal” in the normal colour; kímélő day shows „ma nincs keret”; empty / loading / error /
      offline states per block; never emoji, never „Mezo”.
- [ ] Tapping a logged meal (or a drink) opens its own page with numbers, ingredients and Boop's evaluation (cached
      words first, the dimension grid explains on tap).
- [ ] Javítás opens the composer pre-filled; changing amounts / adding / removing items saves to the same meal, the
      time and window stay, the score and Boop's words update; cancel changes nothing.
- [ ] Törlés from the detail page, the swipe and the context menu; the meal disappears at once, Visszavonás for 5 s
      brings it back without a server call; a failed delete puts it back with a calm line.
- [ ] Offline: edit and delete visibly disabled with a reason; nothing lost.
- [ ] Parity: every control and data field of the old Ma tab still reachable (pending cards, kímélő highlight,
      Megeszem / Kihagyom / undo skip, water +250/+500, supplements Bevettem, drinks, ask row).
- [ ] §9: Dynamic Type XXXL, VoiceOver on ring / bars / rows / swipe / menu, iPhone SE width, reduced motion, smooth
      scroll on a day with many meals, cached day instant.
- [ ] Gates: BoopKit + Boop `xcodebuild test` green; codemap regenerated; lint-docs 0/0.
- [ ] Docs: `boop-ios.md`, feature index row, milestone, handbook pages, `_funkciok.json`.
- [ ] Shipped: merged to main, installed on the phone and walked through; a real delete visible in the production DB.
