# Fuel · AI recipe template breakdown — „Pontszám" a RecipeDetailPage-en (design spec)

- **Date:** 2026-07-19 · **bd:** `mezo-bw3y` · **Driving ADRs:** [0006](../../decisions/0006-meal-score-jsonb-envelope.md) (envelope-is-snapshot) · [0012](../../decisions/0012-consumer-owned-llm-ports.md) (consumer-owned LLM port)
- **Source:** the 2026-07-18 iOS feature handover „Recept részlap: Pontszám & Logok" (Mezo Prototype). The handover's *essence* — AI-backed template scoring — is in scope; its sheet/tab anatomy is **not** (decisions below).
- **Decided with Daniel in-session** (4 explicit choices, 2026-07-19).

## 1. Goal

The recipe detail's „Mezo-fit · indoklás hamarosan" sparkle zone becomes a real, explainable
**template breakdown**: the deterministic P7 numbers get a per-recipe AI prose layer
(sablon-olvasat `summary`, per-dimension `detail`, `improve[]`, `fitsFor[]`) — the project's
**third LLM-backed endpoint**. Zero scoring-formula change: every number the UI shows is the
existing deterministic engine's output.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | AI vs deterministic split | **Hybrid.** The P7 engine produces all numbers (dimension scores, weights, total, confidence); the LLM produces ONLY prose: `summary`, per-dimension `detail`, `improve[]` (text + qualitative impact tag), `fitsFor[]`. Reproducible numbers, cheap single LLM call, matches ADR 0006 and the handover formula (Σ dim.score × weight). |
| D2 | When the LLM runs | **Lazy, first breakdown read + persistent cache.** New `GET /api/recipe/{recipeId}/breakdown`: build the deterministic envelope fresh; if the cached `recipe.breakdown` jsonb matches numerically (same `value` + per-dimension scores), return the cache (prose intact). Otherwise run the flag-gated LLM prose enrichment, persist, return. Retroactive for every recipe, zero save-latency, pays only for viewed recipes. (The handover's „futás recept-mentéskor" open point is resolved this way deliberately.) |
| D3 | Dimension set | **3 live dimensions + degraded context card.** The fit number does NOT change anywhere (RecipeCard badges, hero). Envelope = macro/micro/nova with the P7-renormalized weights (.30/.25/.25 ÷ .80 → .375/.3125/.3125) + a **D6-degraded context dimension** (`weight 0, score 0`, honest detail: template has no logging-time context; evaluated on the Logok side). `recipeFit` is refactored to delegate to the envelope builder so hero score ≡ envelope `value` by construction. |
| D4 | UI shape | **Single scroll stays; new sections replace the sparkle zone.** (a) „Mezo · sablon-olvasat" card — sparkle + `summary` prose + `fitsFor[]` chips, hidden while summary is null; (b) „PONTSZÁM" section — mono header row (`{n} szempont · megbízh. {c}%`) + the reused dimension cards + „Lehetne jobb" + „Hogyan számoltam". The shared body (dimensions + improve + tools) is extracted from `MealScoreSheet` into `ScoreBreakdownBody` and reused by both surfaces. No tabs, no sheet, hero untouched. |
| D5 | Cache invalidation | `RecipeService.update` nulls `breakdown` + `fits_for` (edit → certain regenerate, catches renames the numeric compare can't see). Pantry-drift is caught by D2's numeric compare (macros shift → numbers differ → regenerate). Only successfully prose-enriched envelopes are persisted — a prose-less run (flag off / companion off / LLM error) returns the deterministic envelope unpersisted, so prose self-heals on a later read. |
| D6 | Degradation ladder | Feature flag `mezo.feature.recipe-ai-score.enabled` OFF, or companion OFF, or LLM error → the endpoint still returns the **deterministic envelope with `summary: null`** (the P7 status quo, no 503 — unlike scrape/ai-draft, the deterministic core works without AI). The FE renders the cards regardless; the olvasat card hides. |
| D7 | fitsFor persistence | The LLM's `fitsFor[]` is persisted into the **existing, until-now reserved `recipe.fits_for` jsonb** column (`RecipeMapper` already reads it into `mezoFit.fitsFor`), AND returned on the breakdown response so the detail page needs no `['recipes']` refetch. |
| D8 | Contract reuse | `recipe.yml` `$ref`s the meal fragment's `MealBreakdown` schema (cross-fragment ref resolved at merge — the established `SystemMessage` common-schema precedent). Response = `RecipeBreakdownResponse { breakdown: MealBreakdown, fitsFor: string[] }`. |
| D9 | Mock parity | Mock mode serves the ALREADY-EXISTING seed `Recipe.templateBreakdown` (pantry.ts mirrors the prototype: latest linked log's breakdown, standalone breakdowns for orphan recipes) + `mezoFit.fitsFor` — synchronous, no LLM theater. The mock's 4-live-dim shape (inherited from logs) intentionally differs from real's 3+degraded; both are valid `MealBreakdown`s. |

## 3. Backend design

**`feature/nutrition` — envelope builder.** `MealScoringService` gains
`MealBreakdownJson recipeTemplateBreakdown(List<ScoredLine> perServingLines)`: the existing
private `macroDim`/`microDim`/`novaDim` machinery with context excluded, weights renormalized over
the present dimensions, a degraded context `Dimension` appended (`weight 0, score 0`,
`detail` = honest „nincs sablon-szintű időzítési adat" copy, `context: []`), `value` = renormalized
weighted total, `confidence` = Σ wᵢ·coverageᵢ (P7 D7, renormalized weights), `summary: null`,
`improve: []`, `tools` = honest `compute:` provenance rows. Returns `null` exactly when the current
`recipeFit` does (kcal ≤ 0 / zero weight). **`recipeFit` becomes a thin delegate**
(`recipeTemplateBreakdown(...).value()`), guaranteeing hero ≡ breakdown.

**`feature/recipe` — orchestration.**
- `RecipeBreakdownLlm` port (consumer-owned, ADR 0012): `String complete(String systemPrompt, String userMessage)`.
- `RecipeBreakdownService.getOrGenerate(UUID recipeId)`:
  1. load owned recipe + lines (404 otherwise), build per-serving `ScoredLine`s (the `RecipeService.fitLines` logic, shared);
  2. `fresh = recipeTemplateBreakdown(lines)`; when `fresh == null` (no kcal — the same condition under which the fit badge shows the pending sparkle today) → 200 `{ breakdown: null, fitsFor: [] }`, no LLM, nothing persisted;
  3. cache valid (`stored != null` ∧ `stored.value == fresh.value` ∧ per-dim scores equal) → return stored + stored fitsFor;
  4. else prose enrichment via `ObjectProvider<RecipeBreakdownProseEnricher>` (bean gated on the NEW `FeaturesConfiguration.RECIPE_AI_SCORE_SWITCH = "mezo.feature.recipe-ai-score.enabled"`; the enricher resolves `ObjectProvider<RecipeBreakdownLlm>` — companion off → skip): strict-JSON prompt (Hungarian output; recipe name/slot/servings, per-serving macros, ingredient lines with NOVA, micro rows, the deterministic dim scores + details, daily targets) → `{summary, fitsFor[], details:{macro,micro,nova}, improve:[{text,impact}]}` parsed with the brace-substring + Jackson idiom (`ScrapeExtractionService` precedent); merge prose into the envelope (replace the 3 live dims' `detail`, set `summary`/`improve`, append an `llm` tool row);
  5. enrichment succeeded → persist `recipe.breakdown` + `recipe.fits_for` (short `@Transactional` write, LLM call OUTSIDE any tx); failed/skipped → return deterministic envelope unpersisted (D5/D6). LLM/parse errors are logged + swallowed into the deterministic fallback — never a 5xx.
- `RecipeController` implements the regenerated `RecipeApi` method. Concurrent first-opens may both generate; last write wins (idempotent-ish content, accepted).
- `RecipeService.update(...)` additionally `setBreakdown(null)` + `setFitsFor(null)`.

**`feature/companion`** — `RecipeBreakdownLlmAdapter` (`@ConditionalOnProperty(COMPANION_SWITCH)`), delegates to `CompanionLlm.complete` (cheap tier `gemini-2.5-flash`, no own model config).

**Persistence.** Migration `2026-07-19 mezo-bw3y`: `ALTER TABLE recipe ADD COLUMN breakdown jsonb` (nullable). `RecipeEntity.breakdown` maps it as `@JdbcTypeCode(SqlTypes.JSON) MealBreakdownJson` (the `MealEntity.breakdown` precedent). No new table → no `ResetDatabase` change.

**Config.** `application.yml`: `mezo.feature.recipe-ai-score.enabled: true`. No other tunables (prompt constants in-code like the two existing AI services); scoring numbers keep coming from `mezo.fuel.scoring.*` / `mezo.nutrition.*`.

## 4. Contract (contract-first)

`api/feature/recipe/recipe.yml`:
- `GET /api/recipe/{recipeId}/breakdown` (tag Recipe, operationId `getRecipeBreakdown`) → 200 `RecipeBreakdownResponse`, 404 unknown/foreign id (standard `SystemMessage` errors).
- `RecipeBreakdownResponse`: `breakdown` (`$ref MealBreakdown`, nullable — null exactly when the fit is null/pending) + `fitsFor` (string[], required, may be empty).
- No change to `RecipeResponse` (`mezoFit.fitsFor` starts carrying real data once persisted — shape untouched).

## 5. Frontend design

- **`data/fuel/recipeApi.ts`**: `getBreakdown(id)` → `GET /api/recipe/{id}/breakdown`; reuses the meal-side breakdown mapper (extracted/shared from `mealApi.fromResponse`'s breakdown branch — same generated shape structurally) to rebuild the FE `MealBreakdown` union + inject the constant dimension colors. Returns `{ breakdown: MealBreakdown | null, fitsFor: string[] }`.
- **`data/fuel/recipeHooks.ts`**: `useRecipeBreakdown(recipeId)` — dual-mode query `['recipeBreakdown', id]`: mock `initialData` = seed lookup (`recipes.find(id)` → `{ breakdown: templateBreakdown ?? null, fitsFor: mezoFit.fitsFor }`, synchronous); real = `recipeApi.getBreakdown`, while pending returns `{ breakdown: null, fitsFor: [], pending: true }` (no mock fallback in real mode). `useRecipeActions.update/remove` additionally invalidate `['recipeBreakdown']`.
- **`features/fuel/components/ScoreBreakdownBody.tsx`** (extracted from `MealScoreSheet`): renders dimension cards + „Lehetne jobb" + „Hogyan számoltam" from a `MealBreakdown`; `MealScoreSheet` delegates to it (behavior-identical refactor).
- **`RecipeDetailPage`**: the sparkle zone is replaced by (order): the olvasat card (`summary` + `fitsFor` chips; hidden while `summary` null) → „PONTSZÁM" mono section header with `{dimensions.length} szempont · megbízh. {round(confidence×100)}%` → `ScoreBreakdownBody`. While `pending` (real cold load / first generation): a small twinkle card „Mezo értékeli a receptet…". When `breakdown` resolves null (no kcal / pending fit): the honest „nincs elég adat a pontszámhoz" card.
- Hook barrel: re-export from `@/data/hooks` only; page imports from there.

## 6. Testing

- **Backend IT** (`ApiIntegrationTest`, recipe populator; LLM faked the same way the meal-ai/scrape ITs fake their port — a test-config `RecipeBreakdownLlm` bean returning canned strict-JSON):
  flag on → enriched envelope (summary/detail/improve/fitsFor present, numbers deterministic), persisted (2nd GET returns cache, fake called once); numeric drift (pantry macro edit) → regenerate; recipe update → cache nulled; flag off (property override) → deterministic `summary: null` envelope, nothing persisted; LLM throwing → deterministic fallback 200; foreign/unknown id → 404.
- **Backend unit-ish IT** for `recipeTemplateBreakdown`: value ≡ `recipeFit`, weights renormalized, degraded context present, confidence per D7.
- **FE**: `useRecipeBreakdown` hook test (mock sync seed; real via a new MSW handler); `RecipeDetailPage` test extended (olvasat card + dimension cards render from the mock seed); `MealScoreSheet` tests keep passing (refactor is behavior-identical). Both modes green.

## 7. Out of scope

The handover's tabbed sheet anatomy + ring Score Hero + „utolsó log" hero row (design-only, current page layout retained by decision); template-level deterministic context scoring (would change every fit number); re-scoring stored meals; weekly/monthly log views (Insights); calibrated confidence narrative; prompt/config tunables beyond the flag; streaming/async generation UX beyond the pending card.
