# Fuel P6 — Kamra Import (OpenFoodFacts) + heuristic Suggestions — design

**Date:** 2026-07-05 · **bd:** `mezo-bka` (folds in bugfix `mezo-w3o`) · **Roadmaps:**
[fuel §P6](../plans/2026-06-26-fuel-completion-roadmap.md), [phase2 §F-P6](../plans/2026-07-04-phase2-completion-roadmap.md)

## Goal

Add a pantry item by **external lookup** (OpenFoodFacts — deterministic HTTP, NOT AI) instead of
typing macros; surface an **imports activity feed** and **heuristic "swap this" suggestions**.
Zero LLM. `usePantry().imports`/`.suggestions` go real dual-mode.

## Decisions (open items from the roadmap, settled here)

| Decision | Choice | Why |
|---|---|---|
| OFF-only vs URL-scrape | **OFF only** | roadmap recommendation; per-vendor scrape is brittle + needs an AI extractor → P8 |
| One item per import vs basket | **one item** | matches the sheet's preview→confirm flow; basket adds state for no v1 value |
| ImportItemSheet chips | **typed text/barcode search**; camera/OCR/mic chips stay inert | roadmap: scan affordances are P8+; typed barcode lookup is fine |
| Lookup verb | **`GET /api/pantry-import/lookup?q=`** | read-only proxy, idempotent; barcode auto-detected server-side (all-digit query ≥8 chars) |
| Suggestions persistence | **computed at read, no table** | deterministic over the user's own rows; nothing worth persisting |
| Suggestion semantics | **swap-framed** (cheaper-alt + low-NOVA within a category the user owns) | the only deterministic v1 source is the user's own 147-item catalog; "add this from the web" needs P8 reasoning |
| SuggestionCard CTA | **"Polcra" button hidden in v1** (render only when an `onAdd` is wired) | a swap suggestion references an item already on the shelf — an inert/false CTA violates the honesty rule |
| New `source` value | **`openfoodfacts`** added in lockstep: contract enums + DB CHECK + FE `PantrySourceKey` | the mezo-w3o lockstep rule |
| mezo-w3o fix | **defensive enum mapping** in `PantryMapper` (unknown → `manual` + warn log), even though lockstep is kept | a widening source enum is exactly the trigger the bug predicted; read path must never 500 |
| External-HTTP testing | **WireMock (`wiremock-standalone`, test scope)** wired as a `support/` concern | `integration_test_framework.md` §Deliberately-NOT-adopted says: bring WireMock in with the FIRST real external API — this is it |

## Contract (extend `api/feature/pantry/pantry.yml` — no new fragment)

New tag **`PantryImport`** → generated `PantryImportApi` (separate interface so the whole import
feature can be bean-gated via `@ConditionalOnProperty` without touching `PantryApi`):

- **`GET /api/pantry-import/lookup?q={text}`** (`lookupPantryItem`) → `PantryLookupResponse { results[] }`.
  Proxies OFF: all-digit `q` (≥8) → barcode product fetch, else text search. Each
  `PantryLookupResult`: `name`, `brand?`, `barcode?`, `per` (100), `unit` (g/ml), `kcal?`,
  `proteinG?`, `carbsG?`, `fatG?`, `fiberG?`, `sugarG?`, `saltG?`, `saturatedFatG?`, `nova?`
  (OFF `nova_group` passthrough — the one place NOVA arrives for free).
- **`POST /api/pantry-import`** (`importPantryItem`, 201) → `PantryImportRequest`
  (= the confirmed draft: same field set as `PantryLookupResult` + user-editable `name`,
  optional `category`) → creates a `pantry_item` (kind `food`, source `openfoodfacts`) **and**
  a `pantry_import` feed row in one transaction → returns `PantryItemResponse`.
- **`PantryResponse` gains `imports[]` + `suggestions[]`** (both `required` — always present,
  honest-empty arrays):
  - `PantryImportEntryResponse { id, source, when (date-time), items (int), status (synced|manual-review), ofWhat }`
    — pins the FE `PantryImport` shape; v1 rows are always `items:1`, `status:synced`.
  - `PantrySuggestionResponse { name, source, price, reason }` — pins the FE `PantrySuggestion` shape.
- `source` enums (IngredientResponse, SupplementStashResponse, PantryItemRequest) + the two new
  schemas gain `openfoodfacts`.

## Backend

- **`pantry_import` table** (`202607051415_mezo-bka_pantry_import.sql`): `id` uuid pk, `created_by`
  fk→app_user, `is_deleted`, `source` varchar CHECK (same value set as pantry_item.source),
  `item_name`, `item_count` int default 1, `status` CHECK (`synced|manual-review`) default synced,
  `barcode` varchar null, `pantry_item_id` uuid null fk→pantry_item (ON DELETE SET NULL — feed
  survives item deletion), `imported_at` timestamptz. Same migration widens
  `ck_pantry_item_source` with `openfoodfacts` (mezo-zza drop+re-add pattern).
- **`feature/pantry` additions** (house layout): `entity/PantryImportEntity`,
  `repository/PantryImportRepository`, `service/OffClient` (Spring `RestClient` — the project's
  first outbound HTTP client; UA header from config; timeout from config),
  `service/PantryImportService` (lookup mapping + import tx), `service/PantrySuggestionService`
  (heuristics), `controller/PantryImportController implements PantryImportApi`
  (`@ConditionalOnProperty(FeaturesConfiguration.PANTRY_IMPORT_SWITCH)`).
- **Config:** `PantryImportProperties` (`mezo.pantry-import`: `base-url`, `timeout-ms`,
  `user-agent`, `search-page-size`) + `PantrySuggestionProperties` (`mezo.pantry-suggestion`:
  `max-items`, `cheaper-ratio`); switch `mezo.feature.pantry-import.enabled` in
  `FeaturesConfiguration` + `application.yml` (both states IT-tested: off → 404).
- **Errors:** OFF unreachable/timeout/non-2xx → `PANTRY_IMPORT_LOOKUP_FAILED` (502 BAD_GATEWAY);
  OFF barcode not found → empty `results[]` (not an error). New codes in `messages.properties`.
- **Suggestion heuristics** (`PantrySuggestionService`, all config-tunable, capped `max-items`):
  1. **Cheaper alternative:** within a category, for the priciest owned item(s) with a comparable
     basis (same `priceUnit`, both priced), surface the cheapest same-category item when
     `cheap.price <= expensive.price * cheaper-ratio`. Reason: `"Olcsóbb, mint a(z) {name} ({-N%})"`.
  2. **Low-NOVA swap:** for an owned item with `nova >= 3`, surface a same-category item with
     `nova <= 2`. Reason: `"NOVA {hi} → {lo} csere a(z) {name} helyett"`.
  - Live-data honesty: catalog NOVA is currently all-NULL (`mezo-32ko`), so heuristic 2 yields `[]`
    live until the backfill lands — the section hides (honest-empty), tests prove the math with
    populated fixtures. NOVA backfill stays a separate issue (mezo-32ko), NOT folded in.
- **mezo-w3o:** `PantryMapper` gains a defensive `toSourceEnum` helper (try `fromValue`, fallback
  `manual` + warn) used by both response mappers; kind/type mapping stays strict (CHECK-locked).

## Frontend

- **`pantryApi`**: `lookup(q)` → typed `PantryLookupResponse`; `importItem(draft)` `satisfies
  PantryImportRequest`; `list` maps `imports[]` (ISO `when` → the FE display string via
  `huMonthDayDow`-style util) + `suggestions[]` passthrough.
- **`usePantry`**: `imports`/`suggestions` come from the SAME `['pantry']` dual query (they ride
  `PantryResponse`); mock mode keeps the `pantryImports`/`pantrySuggestions` seeds byte-identical.
- **`usePantryActions`** gains `importItem` (mock: cache-append ingredient + feed row; real:
  `POST /api/pantry-import` → invalidate `['pantry']`).
- **`ImportItemSheet` rework** (same 3-phase skeleton): input = one search field (name OR barcode)
  + inert camera/OCR/mic chips; phase 2 = real lookup (mock: canned fixture + the demo timeout);
  preview = result list → tap picks a draft card (name editable, category select) → **"Polcra"**
  runs the import mutation and closes. Vendor chips (kifli/myprotein/tesco) are removed — source
  is always `openfoodfacts` (manual entry lives in `AddPantryItemSheet`).
- **`FuelKamraPage`**: header gains an **Import** chip (opens the sheet); a **"Mezo javaslatok"**
  section (SuggestionCards) and a **"Legutóbbi importok"** feed section render only when non-empty
  (honest-empty hidden). `PantrySourceKey` + `pantrySources` gain `openfoodfacts` (label
  "OpenFoodFacts", short "OFF").
- **MSW**: `/api/pantry-import/lookup` + `/api/pantry-import` handlers; pantry list default gains
  `imports: [], suggestions: []`; the two real-mode "deferred → []" assertions in
  `pantryHooks.test.tsx` flip to real-mapping assertions.

## Out / deferred

Per-vendor HTML scrape wizard → P8 · stack-fit/recipe-fit reasoned suggestions → P8 ·
restock/consumption-rate suggestions → dropped while stock is parked (`mezo-6nu`) ·
camera/OCR/barcode-scan → inert chips stay · catalog NOVA backfill → `mezo-32ko` ·
OFF image/thumbnail → skipped (CSP + no design slot).

## Test plan (integration-first)

- **BE:** `PantryImportApiIT` (WireMock-stubbed OFF): lookup by text + by barcode (mapping incl.
  nova passthrough), OFF 5xx → 502 `PANTRY_IMPORT_LOOKUP_FAILED`, empty search → `[]`, import
  201 → pantry_item + feed row (ownership set server-side), 401 without token, switch-off → 404,
  ownership isolation (other user's imports invisible). `PantrySuggestionServiceIT`: both
  heuristics + cap + "no comparable basis → no suggestion". `PantryApiIT` extended: `imports`/
  `suggestions` arrays present. `PantryMapperTest`-style unit for the w3o fallback.
  New `PantryImportPopulator`; `pantry_import` into `ResetDatabase`.
- **FE:** both modes green: hooks (real mapping + mock seed parity), reworked sheet test
  (search → preview → import mutation), Kamra page sections (hidden when empty, rendered when
  fed), MSW handlers.
