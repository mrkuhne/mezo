# Boop B4 — Étel (the food room, native)

- **Status:** draft for the owner's OK · **Date:** 2026-11-13 · **Issue:** `mezo-r36n9.14` · **Epic:** `mezo-r36n9`
- **Parent spec:** `2026-11-11-boop-standalone-design.md` §3.1 (Étel room feature list, owner-approved), §4 (reuse map), §5 (B4 row).
- **Builds on:** B2 Gerinc (shell, `NKDrillPage` with inner tabs, proposal card, `+` sheet) and B3 Napi ritmus
  (`mezo-r36n9.13`, branch `feat/boop-b3-napi-ritmus` — the offline `Outbox`, `DayLedger`, `CapturePick`, the day close).
  **B4's build starts when B3 is on main.**
- **Research:** `docs/superpowers/research/boop-standalone/02-fuel-food.md`; recon of 2026-11-13 (below, §3–§4).
- **Owner decisions:** `docs/superpowers/research/boop-standalone/14-decisions.md` rows 8–14 (added by this slice).

## 1. Intent

The Étel room becomes a **complete food app inside Boop's spine** — logging, judging, planning, recipes, pantry —
on the backend engines that already exist. The owner logs food mostly by photo or a few words; the AI drafts, he
confirms. Logging died in October because there was no internet, and because the web surface is a large,
scattered UI. B4 fixes both: **everything captures offline**, and everything lives in one room with four inner
tabs.

What the owner must be able to do when B4 ships: photograph or say a meal anywhere (plane, abroad, no signal) and
have it land correctly; scan a barcode; see at a glance how much of the day is left and what to eat next; keep a
recipe library that is big enough to be suggested from; be warned about lactose and about processed food without
being nagged; and tick his supplements in one tap.

## 2. Owner decisions (2026-11-13) — do not re-litigate

| # | Decision | Chosen | Consequence |
|---|---|---|---|
| 8 | Sensitivities | **Lactose = intolerance; everything above processing level 2 = avoid** | A three-level sensitivity model (allergia / intolerancia / kerülöm). Lactose is NOT the EU "milk" allergen — lactose-free dairy is fine. NOVA 3–4 is an "avoid" rule: Boop only suggests NOVA 1–2; logging a 3–4 item gets one quiet line, never a block, never red. |
| 9 | Offline photo capture | **Phone keeps it, Boop computes later, owner approves** | A photo/text meal captured without network waits in the outbox with its captured-at moment; when the network returns the AI draft runs and a card asks for one tap. Nothing is saved without that tap. |
| 10 | The day's food plan | **Full, server-side** | Meal windows from wake/bed/workouts, a per-window budget, and a recipe suggestion per open window — computed by the backend, not the client. This is the biggest piece of B4. |
| 11 | Supplements | **List grouped by daypart + one tap per group** | A "Reggeli kiegészítők · 4" row on Ma's timeline; one tap ticks the whole group, with a way to drop one item. No placement editor. |
| 12 | The verdict after logging | **All eight dimensions always visible; tapping one opens its explanation** | No collapsed single-sentence verdict: the eight scores are on the meal card as a compact row, and each opens its own detail (why this score, what would raise it). |
| 13 | Recipe library | **Boop may grow it** | Import from a URL, import from a photo of a recipe, and the workshop inventing recipes under the owner's rules (pantry, budget, lactose, NOVA 1–2). Always reviewed line by line before saving. |
| 14 | Meal photos | **Stored** | The photo is kept (downscaled) with the meal and shown on the meal card, in Napló and in the week; deletable per meal and in bulk. Nothing in the system stores images today — this is a new capability. |
| 15 | The three features missing from the first draft | **All three are in B4** | Diet settings editor (macro split, protein tier, water, fibre), meal skip with reason + kímélő fuel mode, and the glucose tip on the meal card. Accepted as a few days more work. |
| 16 | Suggestions while the library is small | **A seeding round** | When the room ships, Boop helps assemble ~25–30 recipes (workshop + imports) under the owner's rules; he approves each. The suggestion then works from day one. |
| 17 | The processed-food line | **Only when it dominates the plate** | The quiet line fires when NOVA 3 and NOVA 4 together carry **more than half** of the meal's kcal, not per ingredient; an exact half stays silent, and the line is gated on the owner's NOVA rule being enabled. (`NovaDetail.dominant` is the single largest NOVA group, not this — the NOVA kcal stack is the right input.) |
| 18 | Supplements | **Editable on the phone** | Add, remove and set the dose in Boop (the stack is stale: 17 items, no intakes in 30 days). The placement engine stays server-side and uneditable. |
| 19 | Photo retention | **Forever** | No auto-deletion; the owner deletes per meal or in bulk when he wants. |
| 20 | Recipe photos | **Both sources** | An imported recipe keeps the image that came with it; the owner can replace it with his own photo of the cooked dish at any time. |
| 21 | Default day rhythm | **3 meals + 2 snacks** | The starting rhythm for the window planner, editable in the settings; windows are then placed around wake, bed and the day's workouts. |

Carried in from the programme: Napkelte look; one voice (Boop); nothing changes without the owner's tap; no emoji;
free Apple team rules until the paid team is active.

## 3. Prior art (recon, 2026-11-13)

Adopted:

- **Barcode: `DataScannerViewController`** (VisionKit, iOS 16+), restricted to EAN-8/EAN-13/UPC-E, with a typed
  fallback field — it brings its own highlight overlay, guidance and zoom
  (https://developer.apple.com/videos/play/wwdc2022/10025/). A custom `AVCaptureSession` was **rejected**: more
  code, no user-visible gain.
- **Unknown barcode → photograph the label** (MacroFactor's label scanner,
  https://help.macrofactorapp.com/en/articles/213-label-scanner): the code is carried along and the label photo
  fills the macros. We **add** what they lack: a serving confirmation (per 100 g / per serving / grams) before
  the item is saved, because OpenFoodFacts serving data is often per container.
- **Allergen states from OpenFoodFacts** (https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/explain-product-attributes/):
  `allergens_tags` ("contains") and `traces_tags` ("may contain") kept apart, over the EU-14 taxonomy, with
  *unknown* as a third state that is never treated as safe. Their four-level user preference maps onto our three
  levels (§2 row 8). Their own docs contradict themselves on whether traces pass a "mandatory" filter, so our rule
  is written explicitly here: **allergia warns on traces too, intolerancia does not.**
- **Recipe import chain** (MacroFactor https://macrofactor.com/version-5-2-2/, Cronometer
  https://cronometer.com/blog/recipe-importer/): schema.org/Recipe JSON-LD → LLM fallback → paste-the-text
  fallback, always ending in a **per-ingredient review** with low-confidence rows marked (Cronometer reports ~92%
  auto-match, i.e. roughly one wrong line per 12-ingredient recipe). Silent saving was **rejected**.
- **Adherence-neutral remaining budget** (https://macrofactor.com/dashboard-revamp/): remaining kcal and macros as
  plain facts, overage as a negative number, no red states, no streaks, no policing. The "next meal" tip is an
  offer shown at most once per natural moment. No primary source shows a real next-meal suggestion in the
  reference apps, so ours is designed from the owner's own data rather than copied.

## 4. Codebase terrain (recon, 2026-11-13)

Verified against the current code; `02-fuel-food.md` is accurate except where noted.

**Call as-is from Swift** (none of these are in the iOS generator filter yet —
`ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` filters by **operationId**): `getFuelDay`,
`getFuelWeek`, `createMeal`/`updateMeal`/`deleteMeal`, `draftMealFromAi` (multipart text+photo),
`getMealCoach`/`getMealCoachForDay`, `logWater`, `recipeLogs`, the `Recipe` + `RecipeWorkshop` ops,
the `Pantry` ops, `lookupPantryItem` (OpenFoodFacts; barcode when the query is ≥ 8 digits),
`scrapePantryItem`, `photoExtractPantryItem`, `importPantryItem`, `getDietSettings`/`setDietSettings`/`previewDietSettings`,
`getFuelSettings`, the `fuel` protocol/intake ops, and the MEAL branch of `upsertPlannedSkip`.

Key anchors: `FuelDayService.java:84,316,358,390` (day view, skipped kcal, targets, "consumed before T") —
the natural home of the day budget; `MealAiDraftService.java` (the draft; barcode and sensitivity matching hook in
here); `PantryImportService.java:59-80` and `OffClient.java:35,107` (the OFF field list has no allergens today);
`PantryScrapeService` + `WebPageClient` + `ScrapeExtractionService` (the SSRF-guarded fetch + LLM extraction
template for recipe URL import); `RecipeWorkshopService`; `ios/Boop/Nap/MaDrill.swift`;
`BoopDesign/Napkelte/Drill.swift:8-18` (`NKDrillPage(tabs:selectedTab:)`, unused so far).

**Gaps that B4 must fill:**

- No allergen/intolerance data anywhere: no column, enum or changeset on `pantry_catalog`, `pantry_item`,
  `recipe` or `meal`. The only trace is free-text `RecipeEntity.tags`.
- The coach is told **not** to name sensitivities — `MealCoachService.java:115-116` inside the Hungarian
  `SYSTEM_PROMPT`; `SYSTEM_PROMPT_NEUTRAL` is derived from it by `.replace`, so one edit changes both. No test
  pins the string. `FoodDigestionDetector.java:77` carries the same disclaimer.
- `nextMealTip` is effectively protein-gap only: `RuleVerdicts.java:219`'s "next unlogged meal" branch can never
  fire because `BoopDayAssembler.meals()` (:301-317) marks every meal `logged=true` and knows no planned windows.
- The day plan lives only in the web frontend: `buildDayPlan.ts` (`placeWindows` :189, `splitBudget` :267,
  `pickRecipe` :324, `buildDayPlan` :368), `compileTemplate.ts:67`, `resolveDayType.ts:11`, `usualMeals.ts:59`,
  `glycemicBand.ts:138` (byte-for-byte twin of `MealCoachPrompt.glucoseBand`), `mealForecast.ts:29`.
- Recipe **steps are not persisted** (the workshop produces them, `RecipeEntity` drops them) and there is no
  source URL column. Barcodes live only on the import audit row (`PantryImportEntity.java:57`), so scanning the
  same product twice creates a duplicate catalog row.
- **Nothing stores images.** Decision 14 needs a new store.
- iOS has no Étel room and no food client; the Fuel orb opens the generic `MaDrill`. The `+` chips
  (`CaptureSheet.swift`) and the lens quick actions (`LensActionRow.swift:13-16`) are toast placeholders.

**Traps:** B3 owns `CaptureSheet.swift`, `openapi-generator-config.yaml`, `api/openapi.yml`, `merge.yml`,
`1.1.0_master.yml`, `ResetDatabase.java`, `BoopDayAssembler.java` until it merges. ArchUnit: controllers implement
the generated API, slices stay cycle-free (`meal↔recipe` is a tolerated existing cycle; current directions
pantry → auth/llmlog, recipe → nutrition/pantry, nutrition → goal/train, boop → meal), no class-level
`@Transactional`. Changing `PantryItemResponse` / `RecipeResponse` / `FuelDayResponse` also hits the web frontend
and its mocks, so the FE gates run in both modes. Meal local time uses `ZoneId.systemDefault()`
(`MealService.java:157`) while Boop uses the owner zone. iOS needs `FlexibleISO8601Transcoder`; the simulator's
network is blocked by LuLu, so a DEBUG `PreviewTransport` must answer every new operation. Backend ITs need
`-Dmezo.test.use-testcontainers=true`; iOS is not built in CI.

**Production shape (counts only):** 183 meals (12 in the last 30 days, the last on 2026-11-04), 11 recipes,
309 pantry items, 442 catalog rows, 39 water logs (last 2026-09-29), 35 pantry imports, 2 meal skips,
17 supplement protocol items with 0 intakes in the last 30 days, 0 OpenFoodFacts-sourced rows.

**Staleness corrected:** the parent spec says the stack has "53 items" — production has 17 items and no recent
intakes; decision 11 is written with that in mind. `docs/features/fuel.md:446` still calls most Fuel types
"FE-only"; `docs/features/boop-ios.md` §5 still says the phone uses the Boop account (B1 changed that).

## 5. Goals, non-goals

**Goals**

1. Every capture path works offline and syncs itself: photo, text, barcode, recipe, pantry item, usuals, water,
   skip, supplement tick.
2. One Étel room with four inner tabs (`Ma · Receptek · Kamra · Hét`) carrying every "keep, native" feature of
   parent spec §3.1.
3. A server-computed day plan: windows, per-window budget, remaining budget, and one next-meal tip.
4. A sensitivity model (lactose + NOVA avoidance + the EU-14 frame) that reaches drafting, suggestions, imports
   and the coach's words.
5. Barcode scanning that ends in a correct serving.
6. A recipe library Boop can grow (URL, photo, workshop) and suggest from.
7. The owner's own meal photos kept and shown.

**Non-goals (B4)**

- The Plan (diet plan "only these recipes for N weeks", shopping list) — B6.
- Live re-planning and new proposal kinds — B7; effect tracking of foods on biomarkers — B6/B8.
- Medication cycle, pantry prices/stock, the meal-slot template editor, the "Hogy tanultam?" page, the supplement
  placement editor (the engine stays server-side).
- Watch food logging, App Intents / Siri capture, widgets (gated on the paid team).
- Any change to the web frontend's food UI beyond what a changed shared DTO forces.

## 6. The experience

> The simulator spike is **on hold** until the B3/b "Képek" photo guideline lands (owner, 2026-11-13); the room is
> designed here in words and will be shown in the simulator before any product code. Photos are planned in from
> the start: the owner's own meal photos and recipe photos are the obvious case.

### 6.0 Photos (Képek guideline, 2026-11-13)

B4 is built **photo-first** per `2026-11-13-boop-kepek-design.md`: a photo in the sky, a photo on the card,
nothing in between. In this room that means the head carries the Fuel world's mood photo (herbs / kitchen) under
the hue's own sky gradient; a logged meal's card carries **the owner's own photo** of that meal; recipe cards and
pantry rows carry a photo of the thing; numbers, the orb, the score tiles and the buttons carry none. Every photo
is toned (saturation 0.8, brightness −0.06), white type sits only over a gradient, no photo detail sits behind the
orb, and every screen is correct with no photo at all (the painted landscape is the fallback — the barcode
scanner uses it). Where the owner has no photo of his own, the CC0 library's food photo stands in; decision 14
(stored meal photos) is what lets his own pictures take over.

### 6.1 The room skeleton

The Étel room opens from the Fuel orb's lens, from a timeline meal row, from the `+` sheet or from a "miért?".
It is an `NKDrillPage` in the Fuel hue with inner tabs — the first use of `NKDrillPage(tabs:selectedTab:)`. The
verdict block above the tabs is the day in one sentence ("Még 1 530 kcal fér bele — a fehérje van a legmesszebb").

### 6.2 `Ma`

1. **A szint** — the day's budget: remaining kcal as the big number, remaining protein / carbs / fat under it.
   Over budget shows a negative number, never red (prior art §3).
2. **A nap terve** — the window list from the server: each window with its clock range, its budget, what was
   logged in it (with the owner's photo), or, for an open window, Boop's suggested recipe and a *Megeszem* /
   *Kihagyom* pair. The window that is current now is marked.
3. **A következő étkezés** — the tip, at most once per natural moment (opening the room, or after a meal is
   saved), drawn from the owner's recipes and pantry, filtered by his sensitivities, phrased as an offer.
4. **Víz** — the day's water as a level, +250 ml in one tap.
5. **Kiegészítők** — the dayparts with their items; one tap ticks a group, a long row opens the group to drop one.

Each logged meal is a card: the photo, the name, the time, kcal and macros, the **eight dimension scores as a
compact row**, and Boop's lines. Tapping a dimension opens its own explanation (what it measures, why this score,
what would raise it). Tapping the card opens the meal for editing or deleting.

### 6.3 Capture (from `+`, from a window, from the room)

One composer, five entrances, all offline-capable:

- **Fotó** — camera or library; the photo is stored with the meal (decision 14). Online: the AI draft comes back
  in a few seconds and the owner confirms. Offline: a "Nincs net · a telefonon van" chip, and when the network
  returns Boop computes and a card asks for one tap (decision 9).
- **Szöveg / hang** — free text, dictation lands as text (B3's recogniser).
- **Vonalkód** — `DataScannerViewController`; a hit from OpenFoodFacts or from our own catalog opens the serving
  confirmation (per 100 g / per serving / grams), then the composer. A miss offers "fotózd le a címkét", carrying
  the barcode. Offline: the code and the label photo wait in the outbox.
- **Recept** — the owner's recipes, with servings.
- **Kamra / szokásosak** — the pantry picker and the ranked usual meals (both work from cached data).

Every line in the composer can be edited before saving; nothing is ever saved without the owner's confirmation.
A line whose item carries a sensitivity or a NOVA 3–4 flag shows its quiet badge here too.

### 6.4 `Receptek`

The library is **one recipe per row** (owner, 2026-11-13, after seeing the spike): a thumbnail, the full name with
its sensitivity badge beside it, and kcal / protein / servings in full underneath. A two-column card grid cut both
the name and the numbers. A
recipe page shows its ingredients, its steps (new), its score breakdown and its log history, and logs it in one
tap. Three ways in, all ending in a reviewed draft: **link**, **fotó** (a recipe photographed from a book or
screen) and **Receptműhely** (chat; Boop proposes under the owner's rules). Imports show a per-ingredient review
with unmatched or low-confidence rows marked, the cooked-weight field, and the allergen states that came with
the recipe.

### 6.5 `Kamra`

The pantry list with search, category filter and the catalog. Add by **barcode**, by **link**, by **címkefotó** or
by hand; every path ends in the same confirm screen. An item page shows its per-100 g facts, its NOVA level, its
sensitivity states (with "nincs adat" where unknown) and its provenance. Prices, stock levels and expiry are not
ported.

### 6.6 `Hét`

Seven days against the targets: kcal per day with the target waterline, protein, the day scores, skipped meals and
kímélő days, plus the week's totals. Tapping a day opens it.

### 6.7 Beállítások (inside the room)

- **Amit kerülök** — the EU-14 list plus free-text sensitivities, each at one of three levels, and the NOVA rule
  as a switch with its threshold.
- **Étrend-beállítások** (decision 15) — macro split preset or custom, protein tier, water and fibre targets,
  with the live preview the web editor already has (`previewDietSettings`): the owner sees the projected day
  targets before saving. Saving re-evaluates the active goal, as today.
- **Napi ritmus** (decision 21) — meals per day (default 3 + 2 snacks) and the caffeine cut-off (`fuel_settings`).

### 6.8 Skipping and kímélő mode (decision 15)

A planned window's *Kihagyom* asks for a reason from the existing chips (plus free text) and writes the MEAL skip
record, so the skipped kcal leave the day's budget exactly as on the web. A day can be put into **kímélő fuel
mode** (illness, stomach bug, travel) from the room: the day stops being judged, the targets become guidance
only, and the week marks it. Coming back out is one tap; the recovery/comeback logic is the existing server one.

### 6.9 The recipe seeding round (decision 16)

Shipping the room includes one guided session: Boop proposes recipes in the workshop under the owner's rules
(pantry, budget, lactose-free, NOVA 1–2) and offers the imports; the owner approves each one, aiming at ~25–30
recipes. Until the library passes a usable size the day plan still shows an ingredient-level tip rather than an
empty row. This is part of the slice's "done", not a later chore.

## 7. How it works

### 7.1 Sensitivity model

- `pantry_catalog` gains allergen state per EU-14 key: `contains` / `traces` / `unknown` (jsonb map; unknown is
  the default and is never silently treated as free-of). Sources, in order: OpenFoodFacts `allergens_tags` and
  `traces_tags` (the `OffClient` field list is widened), the label/URL extractor (a new key, `needsReview` as
  everywhere), and the owner's own edit, which always wins.
- `recipe` carries a **derived** rollup: the union of its ingredients' states, with `unknown` propagating upward.
  Stored and recomputed when a line changes, so suggestions can filter without reading every line.
- The user profile gains a sensitivity list: `{key or free text, level: allergia|intolerancia|kerülöm, note}` plus
  the NOVA rule `{maxLevel: 2, enabled}`. Placed to avoid a new ArchUnit cycle (checked before the slice starts;
  the likely home is `nutrition`, which already owns `diet_settings`).
- **Rules:** *allergia* — never suggested, warns on `traces` too; *intolerancia* — never suggested, warns on
  `contains` only, names the ingredient; *kerülöm* — suggestions avoid it, a logged item gets one quiet line.
  The NOVA rule behaves as *kerülöm*. Nothing is ever blocked.
- The coach policy is reversed: `MealCoachService`'s prompt is changed to name sensitivities **from the structured
  profile only**, never to diagnose a new one, and a test pins the new wording. `FoodDigestionDetector`'s
  disclaimer is softened the same way.

### 7.2 The day plan and the budget (server-side)

A new `nutrition`/`meal` service ports `buildDayPlan` and friends: windows placed from the day's wake/bed and the
real workout windows (or the slot template when one exists), the day's budget split per window, done/now/missed
state, and a recipe suggestion per open window filtered by the sensitivity rules. Served as one read model
(`GET /api/fuel/plan/{date}`) carrying the windows, the remaining budget and the next-meal tip. The web
frontend's copies stay where they are in B4 (its own refactor is out of scope); the glycemic band twin is left
alone.

`nextMealTip` in the Boop brief is rewired onto this service, which also fixes the dead "next unlogged meal"
branch. The tip is text only and contains no judgement; it is omitted late in the day and after a skip.

### 7.3 Barcode

`lookupPantryItem` gains the allergen fields and returns our own catalog row when the barcode is already known —
so `pantry_catalog` gains a `barcode` column with an index, filled on every import. The serving confirmation is
client-side arithmetic over the returned per-100 g facts.

### 7.4 Recipe import

A new endpoint next to `PantryScrapeService`, reusing `WebPageClient` (SSRF guard) : JSON-LD/microdata first, LLM
fallback on the stripped HTML, and a paste-text variant. The draft reuses the workshop's shape (so the review
screen and the save path are shared) and matches ingredient lines to catalog rows by the existing matcher, marking
unmatched and low-confidence rows. `recipe` gains `steps` and `source_url`; a photo-of-a-recipe import runs the
same chain from `photoExtractPantryItem`'s sibling.

### 7.5 Photos

A new image store (table + file store on the same server, decided in the plan), referenced from the meal and from
the recipe. Images are downscaled on the phone before upload (long edge ~1600 px, JPEG), carried in the outbox
when offline, served back through an authenticated endpoint, deletable per meal and in bulk. They never leave the
owner's own server except as the AI draft call that already happens today.

### 7.6 Offline

Everything reuses B3's `Outbox` / `DayLedger`: each capture carries a client id and the captured-at instant, the
room reads local state first, and the server upserts idempotently by client id. A photo meal captured offline is
held as "draft pending" until the network returns; the resulting draft becomes a confirmation card on Ma and in
the room. A queued item older than 7 days is shown as failed with its values, never dropped.

### 7.7 Supplements

The protocol is read as today and grouped by daypart; one tap writes an intake per item in the group (one request,
offline-capable). No placement editing.

## 8. Risks and open points

- **B3 owns the shared hot spots** until it merges; B4's build starts after that, and the `+` sheet's meal chips
  are written on top of B3's `CapturePick`.
- **The day plan is the big piece.** If it threatens the slice, the fallback is windows + budget without the
  per-window recipe suggestion (the tip still works) — flagged to the owner before it happens, not after.
- **Allergen data quality:** most catalog rows will stay `unknown` for a long time. The UI must say "nincs adat"
  rather than imply safety.
- **Placement of the sensitivity profile** must not create an ArchUnit cycle; verified before coding.
- **Photo storage** is a new capability: size limits, backup impact and a delete path are part of the plan.
- **Shared DTO changes** ripple into the web frontend's types and mocks; both FE modes gate the merge.
- Time-zone handling of meals (`systemDefault()`) is pre-existing; B4 does not fix it but must not make it worse
  (an offline meal synced after midnight keeps its own date, as in B3).

## 8.1 Calls made by this spec (builder check, 2026-11-13)

Settled here rather than put to the owner; each is reversible and changes nothing he sees:

- **Photos in the outbox** are stored beside the queue and referenced by id, not inlined in B3's JSON payload.
  `createMeal`, `logWater` and `logIntake` gain an **optional** client-ref field (additive, no web impact) so the
  offline upserts are idempotent the same way B3's are.
- **Usual-meal ranking** moves server-side into the day-plan service (not into Swift), next to the ported planner.
- **Free-text sensitivities** match by name over catalog and recipe line names only, and the UI says so; the
  structured EU-14 keys are the reliable path.
- **Per-dimension explanations** (decision 12) use `MealBreakdownJson.Dimension`'s existing deterministic
  `detail`, `coverage` and typed sub-rows; the coach's LLM note appears when it arrives, so a just-synced offline
  meal shows the deterministic text first.
- **Cross-slice surfaces** (the supplements row on Ma's timeline, photos in Napló and the week) land as small
  additive edits **after B3 merges**, listed as such in the plan.
- **Skipping a window the owner never planned** still writes a normal skip record (the windows are generated
  from his default rhythm, decision 21, so they are the plan); the reason chips are the existing ones.
- **Photo storage sizing** follows decision 19 (keep forever): long edge ~1600 px JPEG, a hard per-file cap below
  the servlet's 6 MB limit, and a bulk-delete path in the settings.

## 9. What the builder decides

Endpoint names and payload shapes; the exact image store (table vs filesystem) and its limits; where the
sensitivity profile lives; whether the window planner is one service or two; the SwiftUI decomposition of the
room; test boundaries. The *Kész, ha…* list goes in the plan (`docs/superpowers/plans/`), derived from §6 and §7.
