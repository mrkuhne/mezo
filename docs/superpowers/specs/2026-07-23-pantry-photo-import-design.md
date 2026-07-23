# Fuel — Pantry photo import: nutrition-label photo → AI draft → confirm — design

**Date:** 2026-07-23 · **bd:** `mezo-d8tr` · **Siblings:** [URL-scrape import](2026-07-18-fuel-url-scrape-import-design.md)
(the draft→confirm + confidence/needsReview idiom this slice reuses wholesale) ·
[AI meal log](2026-07-18-fuel-ai-meal-log-design.md) (the multipart-photo + ephemeral-image precedent) ·
**LLM seam:** [ADR 0008](../../decisions/0008-companion-llm-spring-ai-2-gemini.md) ·
**Port ownership:** ADR 0012 (consumer-owned LLM ports) ·
**Macro-basis convention:** `mezo-y9ga` ([fuel.md §9](../../features/fuel.md)) — per-100 g macros, everything dosed in grams

## Goal

Add a Kamra item by **photographing the product's nutrition label** (and optionally the front
of the package for the name/brand): one multimodal LLM call extracts name, category, and the
full nutrition panel into the **same draft shape the URL-scrape import produces**, normalized
to the house **per-100 g + grams** basis. The user confirms an editable preview; the confirm
goes through the **existing** `POST /api/pantry-import` write path. The photo is
**ephemeral** — extraction only, never stored. This activates the `ImportItemSheet`'s inert
"Címke fotó" chip as a real third import mode (Keresés OFF · Link · **Fotó**).

## Decisions (settled in brainstorm, 2026-07-23)

| Decision | Choice | Why |
|---|---|---|
| Photo flow | **1 photo + optional 2nd** (front-of-pack) | the label usually suffices; when the name is missing/uncertain the user edits it in the preview OR adds a front photo and re-extracts — no forced two-shot capture |
| 2nd photo semantics | **re-extraction with both images in one call** (no client merge, no partial fill) | one code path, deterministic; the LLM sees label + front together |
| Draft shape | **reuse `PantryScrapeResponse`/`PantryScrapeResult` verbatim** (`result: null` = no nutrition facts found) | FE `fromScrapeResult` mapping + Link-mode preview render unchanged |
| Macro basis | prompt **forces per-100 g, `per=100`, `unit='g'`**; missing field = null, never a guessed number | mezo-y9ga convention enforced at the source; partially addresses mezo-0gjr (user can't enter a wrong basis when AI fills it) |
| Confidence | **`ScrapeDraftValidator` unchanged** (deterministic Atwater, no LLM self-assessment) | proven, testable, explainable — identical review semantics as Link mode |
| Provenance | **new `photo` value in `PantrySource`** (contract enum + `ck_pantry_item_source`/`ck_pantry_import_source` CHECK widening + FE `pantrySources` badge) | honest origin; drift-safe via the defensive mapper (mezo-w3o); migration follows the mezo-8vum widening precedent |
| Confirm path | existing `POST /api/pantry-import` + **optional `origin` marker** (`^photo$`) on `PantryImportRequest` | today's source derivation is two-armed (sourceUrl→domain, else openfoodfacts) — photo fits neither; the marker adds the third arm server-side |
| Photo | **ephemeral** — multipart in, memory to the LLM call, dropped | no binary storage in the app; meal-AI precedent |
| LLM port | pantry-owned **`PhotoExtractLlm`** (`complete(system, user, List<Image>)`, nested `record Image(byte[] bytes, String mimeType)`); companion provides `PantryPhotoLlmAdapter` | ADR 0012 — the only cross-feature edge stays companion → pantry; ArchUnit cycle rule green |
| CompanionLlm extension | **multi-image overload** `complete(system, user, List<InlineImage>)`; the existing single-image method becomes a default delegating to it; Gemini (Spring AI multi-`Media`) + Fake updated | the port stays the single seam (ADR 0008); single-image callers (meal-AI) untouched |
| LLM tier | cheap tier (Gemini Flash class, multimodal) | label extraction is classifier-grade work |
| Feature switch | **`mezo.feature.pantry-photo.enabled`** + `FeaturesConfiguration` constant; independent of pantry-scrape and meal-ai-log | per-feature LLM cost gate, house pattern |
| Switch-off behavior | clean **404** (`@ConditionalOnProperty` controller; no path-variable collision under `/api/pantry-import/*`) | mirrors pantry-scrape, not meal-AI's 405 special case |
| Companion-off axis | empty `ObjectProvider<PhotoExtractLlm>` → **503** | mirrors `PantryScrapeLlmUnavailableApiIT` semantics |
| Upload limits | `PantryPhotoProperties` `@Validated` record: `max-photo-bytes: 5000000`, `allowed-mime-types: [image/jpeg, image/png, image/webp]` | meal-AI mirror; iOS converts HEIC→JPEG on file inputs, so no HEIC handling needed |
| Price | **not extracted** (labels don't carry price); `priceHuf`/`priceUnit` stay null | honest; user adds price later via edit if wanted |

## Architecture & data flow

```
ImportItemSheet "Fotó" mode
  └─ file input (accept="image/*" capture="environment", 1 + optional 2nd image)
      └─ POST /api/pantry-import/photo   (multipart, ≤5 MB/image, jpeg/png/webp)
          └─ PantryPhotoController        (@ConditionalOnProperty mezo.feature.pantry-photo.enabled)
              └─ PantryPhotoService
                  ├─ size/mime validation → SystemMessage-bearing 400
                  ├─ PhotoExtractLlm port ── PantryPhotoLlmAdapter (companion) ──> CompanionLlm (vision, cheap tier)
                  │     system prompt: extract per-100 g basis, grams only, null for unknowns
                  ├─ JSON → ExtractedDraft   (ScrapeExtractionService's parse path, made reusable)
                  └─ ScrapeDraftValidator → confidence / needsReview  (UNCHANGED)
          └─ 200 PantryScrapeResponse      (result: null when no nutrition facts found)
      └─ preview phase (SHARED with Link mode) → edit name/category → "Polcra"
          └─ POST /api/pantry-import  { ...draft, origin: 'photo' }   (existing confirm path)
```

## API contract (contract-first — `api/feature/pantry/pantry.yml` edited FIRST)

```yaml
/api/pantry-import/photo:
  post:
    tags: [PantryPhoto]                 # new tag → generated PantryPhotoApi interface
    operationId: photoExtractPantryItem
    requestBody:
      content:
        multipart/form-data:
          schema:
            type: object
            required: [photo]
            properties:
              photo:  { type: string, format: binary }   # nutrition label (required)
              photo2: { type: string, format: binary }   # optional front-of-pack (name/brand)
    responses:
      '200':  # reuses PantryScrapeResponse — result nullable
```

- `PantrySource` enum: `+ photo`. Draft `source='photo'`, no `sourceUrl`.
- `PantryImportRequest`: `+ origin` (optional, pattern `^photo$`). `PantryImportService`
  source derivation becomes three-armed: `sourceUrl` present → domain; `origin=photo` →
  `photo`; neither → `openfoodfacts` (unchanged).

## Backend

| Element | Plan |
|---|---|
| Config | `PantryPhotoProperties` under the `mezo:` root (`max-photo-bytes`, `allowed-mime-types`, `confidence-threshold: 0.6` — own property, not a cross-feature reference to `mezo.pantry-scrape.*`); switch `mezo.feature.pantry-photo.enabled` + `FeaturesConfiguration` constant. Never `@Value`. |
| Controller | `PantryPhotoController implements PantryPhotoApi`, `@ConditionalOnProperty`. Off → clean 404. |
| Service | `PantryPhotoService`: (1) size/mime check → `SystemRuntimeErrorException` + `SystemMessage` (`PANTRY_PHOTO_TOO_LARGE`, `PANTRY_PHOTO_UNSUPPORTED_TYPE`, keys in `message.properties`); (2) LLM call via port; (3) parse through `ScrapeExtractionService`'s JSON→`ExtractedDraft` path (small refactor exposing the parse step; scrape behavior unchanged); (4) `ScrapeDraftValidator.confidence`; `needsReview = confidence <= threshold` — **boundary-inclusive**, exactly the scrape's IEEE-754-motivated semantics (`PantryScrapeService.java:72-75`). |
| LLM port | `PhotoExtractLlm` in `feature/pantry/service`; adapter `PantryPhotoLlmAdapter` in `feature/companion/llm`. Unavailable → 503. |
| CompanionLlm | + `complete(String, String, List<InlineImage>)` (nested record `InlineImage(byte[] bytes, String mimeType)`); existing single-image method becomes a default delegating to the list overload; `GeminiCompanionLlm` maps to Spring AI multi-`Media`; `FakeCompanionLlm` gains canned multi-image support. |
| Prompt | Forces per-100 g macros (`per=100`, `unit='g'`), grams everywhere, null for unreadable/missing fields (never fabricated numbers), NOVA estimate only when the ingredient list is legible. |
| Migration | `{YYYYMMDDHHMM}_mezo-d8tr_pantry_photo_source.sql` — widen both source CHECKs with `photo` (mezo-8vum widening precedent; released changesets untouched). |
| Upload safety net | global `GlobalExceptionHandler.handleMaxUploadSize` already degrades container-cap breaches to a clean 400. |

## Frontend

| Element | Plan |
|---|---|
| Mode toggle | third chip **"Fotó"** next to Keresés (OFF) / Link. The inert "Címke fotó" chip is REMOVED from the HAMAROSAN quick-import card (realized; barcode + dictation remain). |
| Input phase | `<input type="file" accept="image/*" capture="environment">` (mobile → camera, desktop → picker), thumbnail preview, "+ előlap fotó" secondary add, client-side 5 MB pre-check, "Beolvasás" CTA. |
| Searching phase | existing spinner phase, `SourceBadge source="photo"`. |
| Preview phase | the Link-mode preview UNCHANGED (name/category edit, per-100 g StatCells, `needsReview` warning) + "+ előlap fotó" re-extract affordance when the name is empty or uncertain. Save: `importItem({ ...draft, origin: 'photo' })`. |
| Data layer | `pantryApi.photoExtract(photos: File[])` — `FormData` multipart (mealApi precedent: `apiFetch` omits the JSON Content-Type for FormData). `usePantryActions` gains `photoExtract`. |
| Mock mode | `MOCK_PHOTO_DRAFT` fixture (MOCK_SCRAPE_DRAFT mirror) — demo works without backend; both test modes green. |
| Types | `PantryScrapeDraft` reused; `PantrySourceKey` union + `pantrySources` map gain a `photo` entry (badge). |

## Error handling (Hungarian copy, Link-mode idiom)

- `result: null` → „Nem találtam tápértéket a fotón — próbáld élesebb/közelebbi képpel, vagy vidd fel kézzel."
- 400 size/mime → „A kép túl nagy vagy nem támogatott formátumú (JPEG/PNG/WebP, max 5 MB)."
- 503 (LLM off) / 404 (feature off) → the existing generic „próbáld később" copy.
- `needsReview` → the existing „Az AI nem teljesen biztos a számokban…" warning.

## Testing (integration-first, house standards)

- **Backend IT trio (scrape mirror):** `PantryPhotoApiIT` (happy path via `companion-fake`
  canned JSON → 200 draft + confidence; oversized → 400 SystemMessage; bad mime → 400; missing
  `photo` part → 400) · `PantryPhotoDisabledApiIT` (404) · `PantryPhotoLlmUnavailableApiIT` (503).
- **Confirm-path IT:** `PantryImportApiIT` extension — `origin='photo'` → `pantry_item.source='photo'`
  + feed row `source='photo'`.
- `FakeCompanionLlm`: canned multi-image response.
- **FE:** `ImportItemSheet.test.tsx` (photo-mode render, extract flow with mocked action, save
  carries `origin`), both vitest modes green; contract-drift regen committed.
- **Docs:** this spec is the frozen artifact; `docs/features/fuel.md` §2/§4/§9/§10 update rides
  the implementation change.

## Out of scope (deferred)

- Barcode scanner + dictation quick-import chips (stay inert HAMAROSAN).
- Price extraction from shelf/receipt photos.
- Multi-item photos (one product per capture).
- Native HEIC support (iOS converts to JPEG on file inputs).
- The broader mezo-0gjr manual-form UX fix (basis/serving-size conflation) — separate issue;
  this slice only removes the risk for AI-filled items.
