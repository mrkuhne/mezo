# Boop Étel — „Ezt főztem": recipe from what I cooked

- **Issue:** `mezo-r36n9.63` (epic `mezo-r36n9`), supersedes `mezo-umn8u`
- **Date:** 2026-11-17 · **Surface:** Boop (iPhone) + backend. The web app is not touched.
- **Size:** a project (new backend operation + matcher + quick-add, new iOS entrance, extended shared review).

## 1. Intent

The owner cooks, then wants the dish as a recipe without typing a form. In his words: he tells the app by
voice / text and with photos what he cooked from and how much of each; the app matches that intelligently
against his pantry and builds the recipe; anything not in the pantry gets a „+" to add it quickly.

Today no flow does this. The Receptműhely *invents or modifies* recipes in a text chat. Recipe import
(link / text / one photo) copies a *written* recipe and matches by exact name only; an unmatched line is
silently left out of the saved recipe (`mezo-umn8u`), so the saved numbers look authoritative and are wrong.

## 2. Goals, non-goals, anti-goals

**Goals**
1. One capture screen: typed text, dictation and up to 6 photos, combinable; one „Elemzés" tap.
2. Smart matching: "csirkemell" finds „Csirkemell filé, friss"; Hungarian, brands, spoken quantities.
3. Three row states on the review: **megvan** · **erősítsd meg** · **nincs a kamrában (+)**.
4. One-tap „+" on a missing row — the „okos lépcső" (owner decision 2026-11-17, §5).
5. The „+" and the confirm states also serve the existing import and workshop reviews (same screen).
6. Exits „Mentés" and „Mentés és rögzítés mára".

**Non-goals**
- No web UI. No change to the Receptműhely chat itself (no mic, no photos there).
- No multi-photo on the existing import routes. No storing of the capture photos (AI-only, like import).
- No vector index / embeddings for matching (pantry scale: ~450 catalog rows).
- **No finished-dish weight in v1** (session's call, owner informed): the recipe model has no such field today
  (it exists only on the import draft as a read-only note), so a typed weight would be dropped at save. Storing it
  and logging by cooked grams is its own follow-up issue. Servings are the portion model, as everywhere else.
- No automatic unit conversion from spoons/containers to grams beyond what the existing parser does.

**Anti-goals** (failure even if it "works")
- A non-exact match bound without the owner's tap. A wrong food silently writes wrong macros — the ruled
  reason matching is strict today (`PantryNameIndex` javadoc, `2026-09-01-meal-ai-pantry-name-match-design.md`).
- The AI inventing a food id, or an AI-estimated food that looks like a measured one.
- A preview that writes to the shelf (a discarded draft must leave nothing behind — except a „+" the owner tapped).

## 3. Approaches

| | Approach | Trade-off |
|---|---|---|
| A | Add mic + photos to the Receptműhely chat | Smallest UI, but the workshop's job is to invent; its prompt and validator drop or estimate lines, and its match-time auto-add leaves shelf rows after a discarded draft. Wrong tool. |
| **B (chosen)** | **New „Ezt főztem" entrance → new stateless backend operation → the shared `RecipeReview`** | Reuses the import's read-only preview, per-line review, save path and allergen warning; the review gains states that fix the two older entrances too. Costs a new operation and a matcher. |
| C | Reuse the meal AI draft (`MealAiDraftService`) and "save meal as recipe" | Already takes text + one photo, but it auto-adds at match time, estimates macros for unmatched lines, and `feature/recipe` may not import `feature/meal` (frozen ArchUnit cycle). |

The owner handed over the how; B is the session's call. The „+" behaviour is his decision (§5).

## 4. What the owner sees (Boop, Napkelte look)

**Entrance.** Étel → Receptek → section „ÚJ RECEPT": a new first row **„Ezt főztem"** above the existing three
(link — with its text mode chip —, photo, műhely).

**Capture screen** (a sheet like the import sheet):
- a text field („Miből főztél, és mennyit használtál?"), with a mic control: dictation is transcribed on the
  phone into the same field and stays editable;
- a photo strip: camera or library, up to 6 (packaging, a scale display, a handwritten note, the counter);
- **Elemzés** — enabled with any text or at least one photo. The text also corrects the photos
  ("a képen tej van, de zabitalt használtam").
- States: working · nothing readable („Ebből nem tudtam hozzávalókat kiolvasni") · failed with retry · AI off.

**Review** — the existing `RecipeReview`, with these row faces (the spoken/typed phrase is always shown):

```
Csirkés rizs · 4 adag
✓  Csirkemell filé, friss     500 g   „fél kiló csirkemell"
✓  Jázmin rizs                300 g   „30 deka rizs"            · felveszem a kamrádba
?  Olívaolaj extra szűz        20 g   „2 evőkanál olaj"         [Ez az] [Másik]
+  Kurkuma                      5 g   „egy teáskanál kurkuma"   [+ Kamrába] [Másik]
```

- **✓ megvan** — exact name match. If the food is in the shared list but not on his shelf, the row says
  „felveszem a kamrádba" (it reaches the shelf at save, as import does today).
- **? erősítsd meg** — the AI's pick, or an exact match whose amount/unit is doubtful. „Ez az" confirms;
  „Másik" opens up to 3 alternatives plus a search of his pantry / the shared list. A **„Mind rendben"**
  control confirms every `?` row at once. Unconfirmed `?` rows hold the save (existing rule).
- **+ nincs a kamrában** — „+ Kamrába" adds the food in one tap (§5) and the row becomes ✓, tagged
  **becsült** when the facts are an AI estimate; „Másik" links it to an existing food instead. A row left as
  `+` is left out of the saved recipe with the existing warning and acknowledgement.
- **The amount is editable on every row, in every state** (owner, 2026-11-17 on the spike: „most a gramm fix
  mindenhol"). **The unit follows the food** (found while planning — the spike's free unit menu is NOT built): a
  saved line's numbers are `amount ÷ the food's basis amount × its facts`, whatever the unit says
  (`RecipeService.buildLine`), so „2 ek" saved against a per-100-g food would silently count as 2 g. Rule, for
  every entrance: **once a row has a food, its unit is that food's basis unit** (shown as a fixed label), and the
  server converts what was said into it (§6.2 step 8). What converts cleanly is filled in; what does not
  (a piece, a can, spoons of a food measured in grams) is prefilled where a rough rule exists, marked
  **mennyiség?**, and needs his look. A row with no food yet keeps the unit as said.
- **A food added by „+ Kamrába" lets him type its facts — on demand** (owner, 2026-11-17 on the spike: „legyen
  megadható a kcal, makró stb.", then „nem kell kiírni felvétel után a makrót és kcalt"): after the add the row
  shows only the **becsült** tag and a quiet „Tápérték megadása" link — **no numbers are printed on the row**.
  The link opens a small block — kcal, fehérje, szénhidrát, zsír per 100 g — prefilled with the estimate; typing
  any of them turns the tag into **saját adat** and saves the food through the update route (§6.3,
  `source = manual`, draft → verified). „Kész" folds it back to the link; „Minden adat a kamrában" opens the
  full shared confirm form (fibre, sugar, salt, serving, …). The add itself stays one tap.
- Exits: **Mentés a Receptek közé** · **Mentés és rögzítés mára** (saves, then logs one serving through the
  existing one-tap recipe log — `EtelRoom.logRecipe`, toast — no new confirmation screen).

**Kamra.** A food added by estimate carries a **becsült** tag on its row and page, with a „Pontosítom" door:
the existing three *readers* (barcode lookup, label photo, typed facts) fill the shared confirm form, and the
save **updates the same food** (§6.3) — it never creates a second one. The owner's recipes that use the food
get the precise numbers; meals already logged keep what they were logged with.

A throwaway **simulator spike** of the capture screen and the four row faces gets the owner's OK before the
build (Boop rule: no HTML prototype).

## 5. The „+" — „okos lépcső" (owner decision)

One tap, no form. Server-side, in order:
1. the name equals a verified shared-catalog food (normalised, `PantryNameIndex` rules) → put it on his shelf;
2. otherwise the AI estimates generic per-100 g facts (kcal, protein, carbs, fat, fibre, sugar, salt,
   saturated fat; NOVA and allergens stay **absent = no data**, never guessed) → an unreviewed food is created
   through `PantryCatalogService.findOrCreate(userId, candidate, trusted=false)` (lands `status=draft`,
   `source` = a new `ai_estimate` value) and put on his shelf.

Rejected by the owner: always-estimate (guesses even when exact data exists) and always-precise-add (3–4
missing spices after cooking breaks the flow).

## 6. Backend design

**Pattern (kept):** the LLM proposes, deterministic code decides; stateless preview; nothing persists until
the normal recipe create. Contract-first; consumer-owned LLM ports with adapters in `feature/companion/llm`.

### 6.1 `POST /api/recipe/cooked` (new fragment `api/feature/recipe/recipe-cooked.yml`)
- `multipart/form-data`: `text?` (≤ 4 000 chars), `photos[]?` (0–6; JPEG/PNG/WebP; per-photo and total size
  caps from properties). At least one of the two, else 400. Photos go only to the AI; never stored.
- Response: the existing `RecipeImportResponse` (`result: null` = honest empty). `RecipeImportMatch` grows,
  additively: `state` (`matched | confirm | missing`), `onShelf` (boolean), `alternatives[]`
  (`{catalogId, name, brand?, basisUnit}`, ≤ 3), `amountDoubt` (boolean), `basisUnit` (the matched food's). The older import routes fill `state` from their existing confidence
  (1.0 → matched, 0.5 → confirm, 0 → missing) and send no alternatives.
- Switch `mezo.feature.recipe-cooked.enabled` (off ⇒ 404); AI off ⇒ 503 `RECIPE_COOKED_LLM_UNAVAILABLE`;
  unreadable AI answer ⇒ 502. `LlmCallContext("recipe_cooked", "extract" | "match")`. Sentences in the
  `UserMessages` bundle, HU + EN.

### 6.2 Pipeline (`RecipeCookedService`, in `feature/recipe`)
1. **Extract** (one vision-capable call): text + photos → `{name?, servings?, steps[],
   lines[{sourceText, name, amount?, unit?}]}`. The model only transcribes what was said or shown; the user
   text and anything read off a photo are untrusted data inside a fenced block (same neutralisation as import).
   A missing dish name falls back to a bundle default; category defaults by the existing rule.
2. **Parse** each line with `RecipeJsonLdParser.parseIngredient` (units, fractions, dkg/dl/ek/tk).
3. **Exact match** with `PantryNameIndex.matchByName` over verified foods **plus the owner's own draft
   foods** (so an estimated food he added yesterday matches today) → `matched` (or `confirm` when the unit
   does not agree / no amount stated — the import's 0.5 rule).
4. **Shortlist** for every still-unmatched line: a deterministic lexical ranking (normalised token overlap,
   own-shelf rows first) over the same pool, top 8 candidates per line (`PantryMatcher`, pure, in
   `feature/pantry` so meal can reuse it later without a `recipe → meal` edge).
5. **Select** (one text call for all open lines): for each line the model returns one candidate id or
   `none`, plus up to 2 runner-up ids. The validator accepts only ids that were in that line's shortlist; a
   line with an empty shortlist skips the call and is `missing`.
6. **Decide:** an AI-selected food is **always `confirm`** (confidence 0.5, `needsReview`), with the
   runners-up as `alternatives`. `none` / invalid → `missing` (confidence 0), runners-up — if any — still
   offered under „Másik". Amount and unit stay exactly as said when the unit does not agree with the food.
7. Read-only: `match.catalogId` only; the shelf is touched at recipe save (existing) or by a „+" tap.
8. **Amount into the food's basis unit** (`PantryUnits`, pure, in `feature/pantry`), for every row with a food:
   same unit → as is; `kg/dkg→g`, `l/dl/cl→ml` → exact; `ek`=15 ml, `tk`=5 ml → exact when the basis is ml;
   ml↔g (incl. spoons against a gram food) → prefilled 1:1 and the row is `confirm` with `amountDoubt=true`;
   `db` / a container / no amount → amount left as said (or 0) and `confirm` with `amountDoubt=true`. The
   response line carries the converted `amount`, `unit` = the basis unit, and `sourceText` keeps what he said.
   The older import routes get the same step (it replaces "keeps the amount and unit as the source wrote them").

Limits: per-photo bytes and MIME types reuse `RecipeImportProperties`; new properties for max photos and total
  bytes (check the servlet multipart limit); lines reuse the workshop's 30, shortlist size, select timeout.
If the select call fails, the draft is still returned with those lines `missing` (degrade, do not fail).

### 6.3 `POST /api/pantry/items/quick-add` (in `api/feature/pantry/pantry.yml`)
- Request `{name (1–120)}` → `PantryItemResponse` (existing shape, includes the catalog id) +
  `estimated: boolean`. Idempotent on (owner, normalised name): a second tap returns the same row.
- Steps as §5. Estimate behind a pantry-owned `PantryEstimateLlm` port; the validator clamps every figure to
  plausible per-100 g ranges and rejects an answer whose macro kcal disagrees with its stated kcal by more
  than a property tolerance (then: 502, the row stays `+`, the phone shows a retry line).
- Liquibase: extend `ck_pantry_catalog_source` with `ai_estimate`. `PantryItemResponse`/catalog responses
  expose `estimated` (= `source == ai_estimate && status == draft`). `PantrySource` is a closed enum in the
  contract and in generated Swift: the plan must check that no shelf / search path can hand `ai_estimate` to
  an older phone build before the new build is installed (ship the phone build with the backend).
- **„Pontosítom" = the existing update route** (`updatePantryItem`, which already promotes draft → verified,
  `PantryService.java:153-160`), extended to accept a new `source` (the reader's: `openfoodfacts` / `photo` /
  `manual`) and the reader's barcode. It must NOT go through `findOrCreate` (a natural-key hit there keeps
  non-null estimated macros — `PantryCatalogService.java:93-156`). After the update, the frozen snapshots of
  **the owner's recipe lines** on that food are rebuilt (one `rebuildLines` per affected recipe, so the
  allergen roll-up follows); logged meals are history and are not touched (ADR 0026 stands for them).
- **Name collisions** (the catalog's unique key is `lower(trim(name))` + brand, blind to kind, status, owner
  and deletion): quick-add binds only a **live, `kind=food`** row that is **verified or the owner's own**. A
  hit on anything else (a supplement, another user's draft, a soft-deleted row) answers 409
  `PANTRY_QUICK_ADD_NAME_TAKEN`; the phone then opens the normal add sheet prefilled with the name. No
  revival, no foreign bind.
- **One normalisation:** step 1 and the idempotency check both use `PantryNameIndex`'s key (diacritics,
  punctuation and pack size folded; an ambiguous key matches nothing and falls to step 2 / 409). No
  `clientRef` on this operation — the name key is the idempotency.
- Switch `mezo.feature.pantry-quick-add.enabled`; AI off ⇒ step 1 still works, step 2 answers 503.

### 6.4 Save
Unchanged path: `createRecipe` with `catalogId` per line (`RecipeService.resolveLineItem` already binds a
live catalog entry that is verified or the owner's own draft — `RecipeService.java:235-247`).
`mezo-dguzv` (no `clientRef` on recipe create → a retry duplicates) is fixed here, because „Mentés és
rögzítés" makes a double tap likelier.

## 7. iOS design

- **Core (tested, `BoopCore/Etel`):** `CookedCaptureModel` (stages input / working / review / empty / failed;
  text, photos, dictation state; `canAnalyse`), `FoodClient.cooked(text:photos:)` and
  `FoodClient.quickAddPantry(name:)` with `PreviewTransport` fixtures; `ImportedLine` gains `state`,
  `onShelf`, `alternatives` (`sourceText` is already there).
- **`RecipeReview` (shared by every entrance):** `ReviewLine.Mark` keeps its three cases but is driven by
  `state`; new operations `confirmAll()`, `relink(line, to:)`, `quickAdded(line, row:)` (row becomes matched
  + `estimated`). There is no unlink / re-pick today — `relink` is new. A workshop row has no
  `RecipeImportMatch` (the phone synthesises it from `pantryItemId`, `RecipeImport.swift:63-69`): its state
  stays phone-derived (shelf id → matched, none → missing), and after „+" / „Másik" the row carries the
  **catalog id** (`request()` already prefers it). The workshop contract does not change.
- **„Másik" picker:** the line's `alternatives`, then a search over the owner's shelf (finds his own drafts)
  and `searchPantryCatalog` (verified only). The left-out warning and acknowledgement rules stay.
- **Screens (`ios/Boop/Etel`):** `CookedCapture.swift` (sheet; Napkelte kit; `PhotoCapture` is single-pick
  today — multi-select with the 6-cap is new), row faces and the „Másik" picker inside the review body, the **becsült** tag and
  „Pontosítom" in Kamra (`PantryConfirm` is a private struct driven by the add model in `PantryAdd.swift:263`;
  reuse means lifting it out with a save closure). DEBUG launch flag for the sheet and each state.
- **Dictation:** on-device speech from `BoopCore/Ritmus/VoiceJournal.swift` (`OnDeviceSpeech`,
  `SystemAudioRecorder`), which records to a file and transcribes **after stop** (not live): the
  transcript is **appended** to the field when the owner stops; mic / speech permission denied →
  the mic control explains and the field still works. No audio leaves the phone.
- **Generator:** add `cookedRecipe` and `quickAddPantryItem` to `filter.operations`
  (`ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`) — a shared hot spot, one writer at a time.
- Offline: capture needs the network (AI). Offline → a plain line, the typed text is kept; no outbox.

## 8. Prior art

Source check: MacroFactor and the Cronometer forum thread were read directly; the others are known from
search summaries only and are used as direction, not quoted fact.

- **MacroFactor „Import Recipes with AI"** — photo and/or text on one screen, "Analyze", result lands in the
  normal editable recipe form, exits "Create" / "Create & Add". **Adopted** (capture shape, the two exits,
  text as the correction channel). <https://help.macrofactorapp.com/en/articles/398-import-recipes-with-ai>
- **MyFitnessPal Recipe Importer** — per-line matched / pick-it-yourself status. **Adopted** as the list
  shape; **rejected** its binary split (a confident tick on a wrong food is the known complaint) in favour of
  three states with the original phrase always visible.
  <https://support.myfitnesspal.com/hc/en-us/articles/360032271592-How-does-the-Recipe-Importer-on-the-website-work>
- **Cronometer raw vs cooked weight** — recipes are raw weights, portions are cooked; an optional cooked
  total fixes it. **Deferred** (the recipe has no such field today; a follow-up issue), servings stay the model.
  <https://forums.cronometer.com/discussion/3915/custom-recipe-raw-vs-cooked-weight>
- **Research pipelines (NDS, FoodOntoRAG)** — structured parse → candidate retrieval → listwise selection
  → explicit abstain. **Adopted** reduced to pantry scale: selection only from supplied ids, "no match" is a
  first-class answer, model confidence not trusted. **Rejected:** embeddings and rank fusion (over-engineering
  for a few hundred rows). <https://arxiv.org/abs/2608.10363>
- **ingredient-parser-nlp** — name / amount / unit / preparation as separate fields. **Adopted** as shape
  only (our deterministic parser already splits them); the library is English-only Python.
  <https://ingredient-parser.readthedocs.io/en/latest/>

## 9. Codebase terrain

- **Affected:** `feature/recipe` (new `RecipeCookedService`, port `RecipeCookedLlm`, controller),
  `feature/pantry` (`PantryMatcher`, quick-add service, `PantryEstimateLlm`, source value),
  `feature/companion/llm` (two adapters), `api/feature/recipe/recipe-cooked.yml`, `recipe-import.yml`
  (additive match fields), `pantry.yml`; iOS `ios/Boop/Etel/{CookedCapture,RecipeImport,EtelReceptek,
  EtelKamra,PantryAdd}.swift`, `BoopCore/Etel/{FoodClient,FoodModels}.swift`.
- **Key anchors:** `RecipeImportService.java:84-228` (the flow to mirror: `fromExtracted`, `toDraft`,
  `withMatch`), `PantryNameIndex.java` (strict matcher; stays the first step), `RecipeWorkshopValidator`
  (`sanitize(..., keepUnmatched=true)`), `RecipeService.rebuildLines/resolveLineItem` (save + allergen
  roll-up), `PantryCatalogService.findOrCreate/ensureItem`, `ios/Boop/Etel/RecipeImport.swift:9-140`
  (`ReviewLine`, `RecipeReview`), `:225-300` (`RecipeImportModel`), `EtelReceptek.swift:83` („ÚJ RECEPT").
- **Patterns:** LLM proposes / code decides; consumer-owned port (ADR 0012); stateless draft → review →
  normal save; honest nulls; server sentences in both languages; iOS logic in `BoopCore`, one shared review,
  one shared pantry confirm.
- **Traps:** `feature/recipe` must not import `feature/meal` (frozen cycle; focused ITs skip ArchUnit — run
  `ArchitectureTest`); the name index is verified-only today (own drafts must be added to the pool on
  purpose); the catalog's natural key ignores `kind` (a food/supplement name collision — quick-add must
  match `kind=food` only); a saved line must have a food (400 otherwise); every vision endpoint takes one
  photo today (multi-photo is new contract surface); the iOS generator allow-list; contract-drift gate;
  Liquibase `?` in jsonb; backend ITs need Testcontainers; regenerate `docs/CODEMAP.md`; LuLu blocks network
  from the simulator app (live AI calls are checked on the phone).
- **Known open bugs in the area, not fixed here unless hit:** `mezo-gbrw`, `mezo-7sk5`, `mezo-jk5w`.
- **Doc debt paid with this work:** handbook pages `06-etel/05-receptek.md` and `06-kamra.md` still say
  „Tervezve" and describe import as not existing.

## 10. Kész, ha… (draft; the plan carries the final list)

- Étel → Receptek shows „Ezt főztem"; the capture sheet takes text, dictation and up to 6 photos; every
  state (empty input, working, nothing readable, failed, AI off, mic denied, offline) is drawn.
- The review shows the three row faces with the original phrase; „Ez az", „Másik", „Mind rendben",
  „+ Kamrába" work; a non-exact match never saves without a tap (pinned by a test on both sides).
- „+" adds a shared-list food when one exists, otherwise an estimated food tagged **becsült**; a second tap
  does not duplicate; the Kamra shows the tag and „Pontosítom" clears it.
- The link / text / photo import and the workshop review show the same „+" and confirm faces (`mezo-umn8u`
  closed).
- Save and „Mentés és rögzítés mára" (one serving, one-tap log) work; a double tap saves once.
- „Pontosítom" on a becsült food updates the same food, and a recipe saved on the estimate shows the precise
  numbers afterwards; a name collision opens the normal add sheet instead of binding a wrong row.
- Gates: backend focused ITs + `ArchitectureTest` (Testcontainers), contract drift, `BoopKit` tests, app
  build; codemap + docs lint; `docs/features/{recipe,pantry,boop-ios}.md`, feature index, milestone log.
- Shipped: merged, deploy green, the new operations answer in production, installed on the phone and one
  real dish captured end to end with the owner's own pantry.
- Notion: ticket row, decision row („okos lépcső"), handbook pages, release row; `check` exits 0.

## 11. Left to the builder

Prompt wording; the lexical ranking's exact scoring; property names and default caps; the estimate
validator's ranges; where the mic control sits in the Napkelte composer; fixture content.
