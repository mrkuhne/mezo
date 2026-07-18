# Fuel — Kamra URL-import: LLM scrape → pantry draft — design

**Date:** 2026-07-18 · **bd:** `mezo-8vum` · **Extends:** [P6 pantry import](2026-07-05-fuel-p6-pantry-import-design.md)
(this slice IS the "per-vendor scrape is brittle + needs an AI extractor → P8" deferral from the
P6 decisions table, filed as its own slice) · **LLM seam:** [ADR 0008](../../decisions/0008-companion-llm-spring-ai-2-gemini.md)

## Goal

Add a pantry item by **pasting a product URL** (myprotein.hu, gymbeam.hu, kifli.hu, any webshop):
the backend fetches the page, an LLM extracts name / serving / kcal / macros (+ fiber, sugar,
salt, saturated fat) **plus category, NOVA estimate and price**, and the user confirms an
editable draft — landing in the **existing** P6 confirm path (`POST /api/pantry-import` →
`pantry_item` + `pantry_import` feed row). Full enrichment on purpose: category + NOVA + price
are what the Kamra suggestion engine (cheaper-alt / low-NOVA swap) is starving for (`mezo-32ko`).

## Decisions (settled in brainstorm, 2026-07-18)

| Decision | Choice | Why |
|---|---|---|
| Destination | **Kamra draft only** (existing preview→confirm flow) | YAGNI: one path, one sheet; meal logging is its own upcoming feature |
| Extraction | **LLM over stripped HTML** (no per-site parsers, no JSON-LD branch) | works on any shop, zero per-vendor code; JSON-LD rarely carries nutrition anyway; preview-confirm guards hallucination |
| Extraction depth | **Full enrichment**: nutrition + category + NOVA + price/priceUnit | feeds the honest-empty suggestion engine; `pantry_item` already has every column |
| Entry UX | **Paste-URL "Link" mode in ImportItemSheet** | smallest surface, follows the P6 wizard; PWA share-target deferred (iOS doesn't support it anyway) |
| Scrape verb | **`POST /api/pantry-import/scrape`** with `{ url }` body | URL as query param is an encoding swamp; POST body is clean; not idempotent-critical |
| LLM tier | **cheap tier** (`CompanionLlm.complete()`) | single-page extraction is a classifier-grade task; smart tier is for weekly pipelines |
| Source derivation | **backend derives `source` from the URL domain**, never the client | provenance must be trustworthy; unknown domain → new `web` value |
| New `source` values | **`gymbeam.hu` + `web`** in lockstep: contract enums + DB CHECK (if any) + FE `PantrySourceKey` | the mezo-w3o lockstep rule; `kifli.hu`/`myprotein.hu`/`tesco.hu`/`auchan.hu` already exist |
| Feature switch | **new `mezo.feature.pantry-scrape.enabled`**, independent of `pantry-import` | LLM cost gate; OFF lookup must stay usable with scrape off |
| HTML stripping | **jsoup** (new dependency, main scope) | raw HTML is too big/noisy for a prompt; jsoup is the JVM standard |
| Suspicious numbers | **Atwater consistency check** (kcal ≈ 4·P + 4·C + 9·F) → low `confidence` → import lands as `status: manual-review` | reuses the P6 feed status enum verbatim; honest about uncertainty instead of blocking |
| Bot-blocked shops | browser-like UA + Accept-Language; if still blocked → honest fetch error, that vendor stays on OFF/manual | no headless browser in scope; personal single-user volume |

## Contract (extend `api/feature/pantry/pantry.yml` — no new fragment)

Under the existing **`PantryImport`** tag (keeps the `@ConditionalOnProperty` bean-gating story):

- **`POST /api/pantry-import/scrape`** (`scrapePantryItem`) → body `PantryScrapeRequest { url }`
  → `PantryScrapeResponse`:
  - `result` (nullable): the P6 `PantryLookupResult` field set (`name`, `brand?`, `per`, `unit`,
    `kcal?`, `proteinG?`, `carbsG?`, `fatG?`, `fiberG?`, `sugarG?`, `saltG?`, `saturatedFatG?`,
    `nova?`) **extended with** `category?` (existing 18-value enum), `priceHuf?`, `priceUnit?`,
    `source` (derived), `sourceUrl`, `confidence` (number 0–1) and `needsReview` (boolean —
    the server-side threshold verdict, so the FE never duplicates the config value).
  - `result: null` = the page loaded but carries no nutrition facts (honest empty, NOT an error).
- **`POST /api/pantry-import`** gains optional `sourceUrl` + accepts the two new `source` values;
  a `confidence` below the configured threshold (or absent nutrition) persists the feed row as
  `manual-review` instead of `synced`. Otherwise unchanged.

Contract-first order: edit fragment → `api/generate` merge → FE `pnpm generate:api` → backend
generated types via `./mvnw generate-sources`.

## Backend (`feature/pantry`, OffClient pattern throughout)

1. **`WebPageClient`** (`service/`, `@ConditionalOnProperty(PANTRY_SCRAPE_SWITCH)`) — RestClient
   GET with browser-like `User-Agent` + `Accept-Language: hu,en`, timeout + **max-bytes cap**
   from `PantryScrapeProperties`; non-2xx / timeout / oversize → `PANTRY_SCRAPE_FETCH_FAILED`
   (502 via `SystemRuntimeErrorException`). Only http/https URLs accepted (400 otherwise);
   resolved private/loopback addresses rejected (SSRF guard — single-user app, but the endpoint
   is authenticated HTTP all the same).
2. **HTML stripping** — jsoup: drop `script/style/nav/footer/iframe`, keep visible text + table
   semantics (nutrition tables flattened to `label: value` lines), cap the prompt payload.
3. **`ScrapeExtractionService`** — builds a strict system prompt (Hungarian labels irrelevant to
   the model; schema-first JSON with explicit "null when absent, NEVER invent numbers" rule),
   one `CompanionLlm.complete()` call, Jackson-parses the JSON (the companion V1.2 extraction
   pipeline is the in-repo precedent for parse-or-fail handling). Unparseable →
   `PANTRY_SCRAPE_EXTRACT_FAILED` (502).
4. **Validation + confidence** — range clamps (kcal 0–900/100g, macros ≥ 0, NOVA 1–4) and the
   Atwater check; each violation lowers `confidence`. Serving normalization follows the P6
   convention (`per`/`unit`, default 100 g/ml).
5. **`PantryImportService`** — reuses the P6 transaction; only additions: `sourceUrl` column
   passthrough + the `manual-review` status decision.
6. **Dependency note:** `pantry → companion.CompanionLlm` is a new one-way package edge — verify
   ArchUnit stays green; if it ever cycles, extracting the port is its own follow-up. When the
   scrape switch is on but no `CompanionLlm` bean exists (companion off), the endpoint answers a
   clean 503 `SystemMessage` (`ObjectProvider` lookup), never a 500.

## DB

One changeset (`{ts}_mezo-8vum_pantry_import_source_url.sql`): `pantry_import.source_url text
NULL`; extend the `source` CHECK constraint (if present) with `gymbeam.hu` + `web` — lockstep
with the contract enums and FE `PantrySourceKey`.

## Configuration

`mezo.feature.pantry-scrape.enabled` (+ `FeaturesConfiguration` constant) and `@Validated`
`PantryScrapeProperties`: `timeout-ms`, `max-body-bytes`, `user-agent`, `accept-language`,
`confidence-threshold`. No `@Value` anywhere.

## Frontend

`ImportItemSheet` gets a third mode: **Keresés | Vonalkód | Link**. Link mode = URL field +
„Beolvasás" button → the existing preview/confirm step, all fields editable, plus a yellow
„ellenőrizd a számokat" hint when `needsReview` is true. Data layer: `scrapePantryItem` in
`data/fuel/pantryApi.ts`, wired through the existing `usePantryActions`; mock mode returns one
canonical scrape draft synchronously. Request bodies `satisfies` the generated types.

## Error handling (honest-empty rules)

| Case | Behaviour |
|---|---|
| fetch fail / timeout / bot-blocked / oversize | `PANTRY_SCRAPE_FETCH_FAILED` (502) — FE offers manual entry |
| LLM output unparseable | `PANTRY_SCRAPE_EXTRACT_FAILED` (502) |
| page has no nutrition facts | `result: null` — „nem találtam tápértéket" + manual entry CTA |
| LLM unavailable (companion off) | 503 `SystemMessage`, feature visibly degraded |
| Atwater mismatch / clamped values | result returned with low `confidence` → feed row `manual-review` |

## Testing

- **IT (`ApiIntegrationTest`):** WireMock serves 3 canned product-page HTML fixtures
  (myprotein-, gymbeam-, kifli-shaped) + `FakeCompanionLlm` (companion-fake profile) returns
  canned JSON per fixture — full path scrape → preview → import → feed row, zero network/LLM.
  Error ITs: 404 page, timeout, garbage LLM output, switch-off → 404-not-405 (P6 rule), no-LLM →
  503, bad URL → 400.
- **Unit:** HTML stripper (table flattening, size cap) + validator (Atwater edges, clamps).
- **FE:** both modes green + build; Link-mode tests (paste → preview → confirm, low-confidence
  hint, fetch-error → manual CTA).
- **Live smoke** at branch end: one real myprotein.hu URL against the running stack.

## Risks / out of scope

- **Cloudflare-class bot protection** (kifli.hu likely): accepted risk — honest error, no
  headless browser, no CAPTCHA evasion. That vendor keeps OFF/manual paths.
- **Out of scope:** PWA share-target (own follow-up), basket/multi-item scrape, per-site
  parsers, immediate meal logging from scrape (that's the AI food-logging feature), price
  tracking over time.

## Implementation deviations (2026-07-18)

What actually shipped differs from the design above on four points (the design is left intact
as the point-in-time artifact; these are the corrections):

- **Consumer-owned `ScrapeLlm` port, not direct `CompanionLlm` injection.** The Backend §6
  "`pantry → companion.CompanionLlm` one-way edge" would have formed **3 ArchUnit feature-slice
  cycles** (companion already depends transitively on pantry: `companion → fuel`/`meal → pantry`).
  Resolved with a consumer-owned port — `ScrapeLlm` in `feature/pantry/service` + a companion-side
  `PantryScrapeLlmAdapter` (`feature/companion/llm`) that delegates to `CompanionLlm` — so the only
  cross-feature edge runs companion → pantry and ArchUnit stays 11/11 green. Companion-off →
  no adapter bean → the endpoint's clean 503 (via `ObjectProvider<ScrapeLlm>`). See
  **[ADR 0012](../../decisions/0012-consumer-owned-llm-ports.md)** (the pattern is now prescribed
  for mezo-78rn's meal AI-log too, superseding that spec's "meal → companion edge" line).
- **Boundary-INCLUSIVE confidence.** `needsReview` / `manual-review` fire on
  `confidence <= threshold` (not `<`): a >30%-off Atwater draft scores **exactly** the 0.6
  threshold in IEEE-754 (`1.0 − 0.4`) and must be reviewed. Both the scrape verdict
  (`PantryScrapeService`) and the import persistence (`PantryImportService#isManualReview`) use `<=`.
- **Two-segment ImportItemSheet toggle, not three.** The design proposed `Keresés | Vonalkód |
  Link`; barcode is not a separate mode — the OFF search field already accepts a typed barcode
  (all-digit ≥8 → v2 fetch), so the sheet ships a **`Keresés (OFF) | Link`** toggle and keeps the
  barcode-scanner chip as an inert P8+ affordance inside Keresés.
- **Jackson 3 shared `ObjectMapper` bean.** `ScrapeExtractionService` injects the shared
  Boot-managed `tools.jackson.databind.ObjectMapper` (Jackson 3, `tools.jackson.*`) rather than
  instantiating one — one configured mapper, consistent with the rest of the Boot 4 stack.
