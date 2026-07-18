# Fuel — AI-ételnaplózás: szöveg + fotó → meal draft → confirm — design

**Date:** 2026-07-18 · **bd:** `mezo-78rn` · **Sibling:** [URL-scrape import](2026-07-18-fuel-url-scrape-import-design.md)
(same brainstorm session; shares the draft→confirm + confidence/needsReview idiom) ·
**LLM seam:** [ADR 0008](../../decisions/0008-companion-llm-spring-ai-2-gemini.md) ·
**Meal aggregate:** [Fuel P7 / ADR 0006 scoring](2026-07-05-fuel-p6-pantry-import-design.md)

## Goal

Log a meal by **free text** ("ettem egy csirkés wrapot és egy lattét") **and/or a photo**: one
LLM call parses the food items AND matches them against the user's own pantry catalog +
recipes; matched lines reference known items (accurate macros), unmatched lines land as
**estimated** lines with LLM macros. The user confirms an editable draft; the confirm goes
through the **existing** meal write path, so the deterministic 4-dim scoring (P7) runs
unchanged. The photo is **ephemeral** — extraction only, never stored.

## Decisions (settled in brainstorm, 2026-07-18)

| Decision | Choice | Why |
|---|---|---|
| Matching strategy | **Hybrid: match + estimate fallback** | reuses the curated 147-item catalog's accurate macros; restaurant/street food still loggable |
| Matching mechanism | **the LLM matches, in the same call** — prompt carries the catalog (id, name, brand, serving; ~147 rows + recipe names) | one call = parse + match; Hungarian inflection/synonyms beat deterministic fuzzy; backend only validates ids |
| Ad-hoc lines | **new `meal_item.source` value `estimate`** — both FKs null, the already-NOT-NULL `snapshot_*` columns carry the estimated macros | zero new columns; scoring reads snapshots anyway |
| Entry UX | **`AiLogSheet` on the Mai view**, next to the existing meal logging | deterministic sheet flow, house pattern; chat write-tool is a separate policy decision (out of scope) |
| Photo | **ephemeral** — multipart in, memory to the Gemini call, dropped; provenance records origin only | the app has NO binary storage today and this slice does not introduce one |
| Draft persistence | **stateless draft** — `POST /api/meal/ai-draft` persists nothing; confirm = existing `POST /api/meal` | no draft table, no cleanup job; the FE holds the draft |
| Provenance | **`meal.provenance` jsonb**, typed `MealProvenanceJson { origin: manual\|ai-text\|ai-photo, model?, confidence?, rawText? }` | house typed-jsonb pattern; null for manual/legacy rows, no backfill |
| LLM tier | **cheap tier** (Gemini Flash class is multimodal) | single-meal extraction is classifier-grade; smart tier stays for weekly pipelines |
| Port extension | **multimodal overload on `CompanionLlm`** (`complete(system, user, imageBytes, mimeType)`); Gemini adapter via Spring AI `Media`, Fake returns canned JSON | the port stays the single seam (ADR 0008); no provider types above it |
| Feature switch | **new `mezo.feature.meal-ai-log.enabled`**, independent of companion chat | LLM cost gate; ai-log can be off while chat is on and vice versa |
| Suspicious numbers | Atwater check on estimate lines → per-line `confidence` + server-side `needsReview` verdict | same idiom as the scrape sibling; FE never duplicates the threshold config |

## Contract (extend `api/feature/meal/meal.yml` — no new fragment)

- **`POST /api/meal/ai-draft`** (`draftMealFromAi`) — `multipart/form-data`: `text?` (string),
  `photo?` (binary), `date` (required). At least one of `text`/`photo` required → else 400.
  → `MealAiDraftResponse`:
  - `slot` (suggested `breakfast|lunch|dinner|snack`), `title` (suggested), `note?`
  - `items[]`: `source` (`pantry|recipe|estimate`), `pantryItemId?`/`recipeId?` (validated),
    `name`, `amount`, `unit`, per-line snapshot macros (`per`, `basisUnit`, `kcal`, `proteinG`,
    `carbsG`, `fatG`), `confidence` (0–1), `needsReview` (boolean, server verdict)
  - empty `items` = nothing recognized (honest empty, NOT an error)
- **`POST /api/meal`** (existing `createMeal`): item `source` enum gains `estimate` (snapshot
  fields supplied by the client from the draft; FKs absent) + optional `provenance` envelope.

Contract-first order: fragment → `api/generate` merge → FE `pnpm generate:api` → backend
generated types via `./mvnw generate-sources`.

## Backend (`feature/meal`)

1. **`MealAiDraftService`** (`@ConditionalOnProperty(MEAL_AI_LOG_SWITCH)`):
   - assembles the catalog context from the user's own rows (pantry id/name/brand/serving +
     recipe id/name) — **via the existing meal→pantry/recipe read seam** (the `ah18.16`
     cycle-resolution structure; do NOT reintroduce a package cycle, ArchUnit is frozen),
   - builds a strict schema-first prompt ("null when absent, NEVER invent ids; unknown food →
     estimate with macros"), one `CompanionLlm` call — text-only or multimodal overload,
   - Jackson-parses the JSON; unparseable → `MEAL_AI_EXTRACT_FAILED` (502),
   - **validates ids**: returned pantry/recipe ids must exist AND be owned; hallucinated id →
     demote the line to `estimate` + warn log (never 500, never silent data corruption),
   - Atwater sanity + range clamps on estimate lines → `confidence`/`needsReview`,
   - matched lines get their snapshot macros **from the DB row, not the LLM** (the LLM only
     picks the id + amount; numbers come from our data).
2. **Photo intake**: multipart size cap + mime whitelist from `MealAiLogProperties` (reject →
   400); bytes live only for the request lifetime.
3. **Confirm path**: `MealService.createMeal` extended to accept `estimate` lines (skip FK
   resolution, take snapshots verbatim) + persist `provenance`. `MealScoringService` runs
   unchanged — estimate lines score via their snapshots; the NOVA dimension treats them like
   any line without pantry NOVA data (existing null-handling).
4. **Cross-feature edge**: `meal → companion.CompanionLlm` one-way import (same note as the
   scrape sibling: verify ArchUnit; extracting the port is its own follow-up if ever needed).
   Switch on but no `CompanionLlm` bean → clean 503 `SystemMessage` (`ObjectProvider`).

## DB

Two small changesets (`{ts}_mezo-78rn_*.sql`):
1. extend `ck_meal_item_source` CHECK: `recipe | pantry | estimate`;
2. `meal.provenance jsonb NULL` (typed `MealProvenanceJson` on the entity,
   `@JdbcTypeCode(SqlTypes.JSON)`).

## Configuration

`mezo.feature.meal-ai-log.enabled` (+ `FeaturesConfiguration` constant) and `@Validated`
`MealAiLogProperties`: `max-photo-bytes`, `allowed-mime-types`, `confidence-threshold`,
`max-items`. No `@Value`.

## Frontend

New **`AiLogSheet`** (`features/fuel/sheets/`), opened from the Mai view next to the existing
meal logging: text field + photo picker (`accept="image/*" capture`), **client-side resize**
(canvas → ~1024px JPEG) before upload; submit → draft list with per-line badges (**Kamra** /
**Recept** / **Becslés**, yellow „ellenőrizd" hint on `needsReview`), editable amounts,
deletable lines, slot selector; confirm via the existing `useMealActions` create path with
`provenance`. Data layer: `draftMealFromAi` in `data/fuel/mealApi.ts`; mock mode returns one
canonical draft synchronously. Request bodies `satisfies` the generated types.

## Error handling (honest-empty rules)

| Case | Behaviour |
|---|---|
| LLM unavailable (companion off / no bean) | 503 `SystemMessage`, feature visibly degraded |
| LLM output unparseable | `MEAL_AI_EXTRACT_FAILED` (502) |
| photo too big / wrong mime / neither text nor photo | 400 |
| nothing recognized | empty `items` draft — „nem ismertem fel ételt" + manual CTA |
| hallucinated match-id | line demoted to `estimate` + warn log |
| Atwater mismatch on estimate line | line returned with low `confidence` → `needsReview` |

## Testing

- **IT (`ApiIntegrationTest`):** `FakeCompanionLlm` canned JSON fixtures — text-only, photo
  (fake ignores the bytes), hallucinated-id (→ demotion asserted), nothing-recognized; confirm
  path persists `estimate` lines + provenance and scoring runs; multipart 400s (size/mime/
  neither-input); switch-off → 404; no-LLM-bean → 503.
- **Unit:** prompt-context assembler (catalog rendering, caps), validator (Atwater edges,
  id-demotion).
- **FE:** both modes green + build; sheet tests (text path, photo path, badges, needsReview
  hint, error → manual CTA).
- **Live smoke** at branch end: one real food photo + one Hungarian free-text sentence against
  the running stack.

## Risks / out of scope

- **Estimation accuracy** is inherently fuzzy — mitigated by the editable draft-confirm step
  and `needsReview`; portions from photos are guesses by design.
- **Prompt size**: catalog grows over time; `max-items`/row-cap in the context assembler, and
  if the catalog ever outgrows the prompt, a retrieval step is a follow-up (pgvector exists).
- **Out of scope:** companion chat write-tool (separate policy decision), photo storage (pure
  ephemeral — no photoRef reserved), barcode-from-photo, streaming draft, multi-meal batch
  from one photo.

## Implementation deviations (2026-07-18)

What actually shipped differs from the design above on a few points (the design is left intact as
the point-in-time artifact; these are the corrections):

- **Consumer-owned `MealDraftLlm` port, not a direct `meal → companion.CompanionLlm` import.** The
  Backend §4 "one-way import" would have formed an ArchUnit feature-slice cycle (companion already
  depends transitively on meal: `companion → meal`). Resolved with the pattern the scrape sibling
  established the same day — meal **owns the port** (`MealDraftLlm` in `feature/meal/service`, a
  text-only `complete` + the multimodal overload) and companion provides `MealDraftLlmAdapter`
  (`feature/companion/llm`, `@ConditionalOnProperty(COMPANION_SWITCH)`) delegating to `CompanionLlm`.
  So the only cross-feature edge runs companion → meal and ArchUnit stays green; meal reaches the
  port via `ObjectProvider<MealDraftLlm>`, so companion-off → no adapter bean → the endpoint's clean
  503. See **[ADR 0012](../../decisions/0012-consumer-owned-llm-ports.md)** — which the URL-scrape
  ADR already anticipated would govern this feature, superseding this spec's "meal → companion edge".
- **`ck_meal_item_arm` ALSO widened.** The DB §1 note listed only `ck_meal_item_source`. But the
  original `meal_item` also carried an arm CHECK (`ck_meal_item_arm`) forbidding both FKs null — a
  FK-less `estimate` line violated it. The changeset drops+re-adds BOTH: `source` gains `estimate`,
  and the arm gains `(source = 'estimate' and recipe_id is null and pantry_item_id is null)`.
- **Switch-off is a 405, not the 404 the spec's Testing section assumed.** Unlike
  `/api/pantry-import/scrape` (a leaf path → 404 when its controller is gone), `/api/meal/ai-draft`
  collides with the `/api/meal/{id}` path-variable pattern; with the `@ConditionalOnProperty`
  controller dropped, the surviving `POST /api/meal/{id}` route yields `405`. A NEW techcore handler
  (`GlobalExceptionHandler.handleMethodNotAllowed`, `HttpRequestMethodNotSupportedException` → a
  clean `METHOD_NOT_ALLOWED` SystemMessage) replaces what was a stack-trace-noisy generic 500 — a
  small platform improvement that outlives this feature. `MealAiDraftSwitchOffApiIT` asserts the
  generic `METHOD_NOT_ALLOWED` body (not a `MEAL_AI_*` code — the handler/service never ran).
- **The `FakeCompanionLlm` meal sentinel is GREEDY** (`\[fake-meal:(\{.*})]`), unlike the scrape
  sentinel's reluctant `(\{.*?})`. The meal draft payload `{"slot":…,"items":[{…},{…}]}` nests
  objects inside `items`, so a reluctant match would stop at the first `}]` and truncate the JSON;
  the match must run to the LAST brace. The fake matches it in BOTH the user text and the
  UTF-8-decoded image bytes, so photo-only ITs drive canned JSON through the real multipart plumbing.
- **Estimate-line macro basis: `per = amount`, not per-100g.** An estimate line's LLM macros are for
  the stated portion, so the snapshot stores `per = amount` (whole-portion totals) and the read-time
  `factor = amount/per` is exactly 1 — matching how the FE `buildLine` and the confirm path scale it.
- **Boundary-INCLUSIVE confidence.** `needsReview` fires on `confidence <= confidence-threshold`
  (not `<`): a >30%-off Atwater draft scores **exactly** the 0.6 threshold in IEEE-754 and must be
  reviewed. Same idiom as the scrape sibling; a demoted (hallucinated-id) line always forces review
  regardless. `MealAiDraftValidator` accumulates the penalty and subtracts ONCE (`1.0 − (a+b)`) to
  avoid IEEE-754 compounding (`1.0−0.3−0.2 = 0.49999…` vs the exact `0.5`).
- **Shared Jackson-3 `ObjectMapper`.** `MealAiDraftService` injects the Boot-managed
  `tools.jackson.databind.ObjectMapper` (Jackson 3, `tools.jackson.*`) rather than instantiating
  one — consistent with the scrape extractor and the rest of the Boot 4 stack.
