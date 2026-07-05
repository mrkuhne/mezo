# Fuel P7 — Deterministic Meal-Scoring v0 (design spec)

- **Date:** 2026-07-05 · **bd:** `mezo-yta` · **Driving ADR:** [0006](../../decisions/0006-meal-score-jsonb-envelope.md)
- **Roadmaps:** [fuel §P7](../plans/2026-06-26-fuel-completion-roadmap.md) · [phase2 §F-P7](../plans/2026-07-04-phase2-completion-roadmap.md)
- **Folds in:** `mezo-2dy` (NOVA contract type drift) · `mezo-0xh.30` (NOVA palette parity) · `mezo-24j` (MSW p-turo fixture drift)

## 1. Goal

Turn the inert pending-sparkle on every logged meal + recipe fit into a real, explainable,
**deterministic** 4-dimension score. Zero new UI — the entire read surface (`MealScoreSheet`,
`ScoreHero`, `DimensionCard`, the 4 panels, `RecipeFitBadge`, `RecipeLogsList`) exists and waits for
data. Prose (`summary`, `improve[]`, calibrated confidence narrative) stays **null/empty** — P8.

## 2. Decisions (in-slice, per ADR 0006 frame)

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | When is a meal scored? | **At write** (create/update), inside the same transaction. `ScoringService` is the single writer of `meal.score` (new numeric column) + `meal.breakdown` (full typed jsonb). Existing rows stay NULL → honest pending sparkle; no backfill pass (no fixture meals exist). |
| D2 | Micro data source | **No new snapshot columns.** Scoring runs at write time, where the live `PantryItemEntity` / recipe-ingredient pantry rows are resolvable; the computed micro rows are FROZEN into the breakdown jsonb itself — the envelope *is* the snapshot. Reality check: the 147-item catalog has **0** `micros` (vitamin) entries but **144/147** carry fiber/sugar/salt/satFat → the Micro dimension v0 is a **nutrition-quality** score over those four facts; vitamin rows would be fabrication. |
| D3 | Envelope shape | Entity record `MealBreakdownJson` becomes the full envelope mirroring FE `MealBreakdown` **minus `color`** (a CSS `var(--…)` string is presentation — the FE mapper injects the constant per-dimension colors). `summary: null`, `improve: []` (P8); `tools[]` = honest deterministic provenance (`compute:` entries describing what the scorer actually did). Envelope also carries `value` (ADR 0006: the scalar column duplicates it by design). |
| D4 | Contract | `meal.yml` `MealScore.breakdown` tightened from `additionalProperties: true` to a typed `MealBreakdown` schema (flattened `MealScoreDimension` with optional per-kind payloads — OpenAPI-friendly instead of oneOf). `RecipeLogResponse` gains nullable `score`. **mezo-2dy:** `recipe.yml` `novaDominant` converges `number → integer`. |
| D5 | Recipe fit | **Computed at read** in `RecipeService` (same `ScoringService`, context dimension excluded, weights renormalized). Read-time = retroactive (all existing recipes light up) + always fresh vs pantry edits. The existing `recipe.fit_score` column stays NULL/unused — reserved for P8 calibrated fit (documented here, no schema change). `fitsFor` stays as-is. |
| D6 | Degraded dimensions | A dimension with **zero input coverage** (e.g. no line carries NOVA, or no nutrition facts at all) is emitted with `weight: 0, score: 0` + an honest `detail` („nincs adat"), and the total renormalizes over the remaining weights. Never a fabricated neutral score. |
| D7 | Confidence | Numeric only: `confidence = Σ wᵢ·coverageᵢ` (macro/context coverage = 1, micro/nova = kcal-share of lines that carried the fact). |
| D8 | Config | All tunables under **`mezo.fuel.scoring.*`** → `@Validated MealScoringProperties` record (feature/meal/config, next to `NutritionTargetsProperties`, which supplies the macro/kcal targets). No feature switch — scoring is core write-path behavior. |
| D9 | mezo-0xh.30 | **Accept the consolidated NovaDot palette** (the issue's recommended option) + fix the non-theming hardcoded `NOVA_META[1]` hex `#34D399` → `var(--cat-response)`. |
| D10 | mezo-24j | The two MSW fixtures share one `P_TURO` macro source in `handlers.ts`. |

## 3. The four dimensions (deterministic formulas)

Scores are 0..1, 2 decimals. Weights (config): **macro .30 · micro .25 · nova .25 · context .20**.
Total `value = Σ wᵢ·scoreᵢ / Σ wᵢ` (renormalized when a dimension degrades to weight 0).

**Macro (.30)** — kcal-share fit vs the config targets (`mezo.nutrition`: 220p/380c/95f @ 3100).
Target shares from p×4/c×4/f×9 normalized. `deviation = Σ|share_meal − share_target| / 2` (total
variation, 0..1); `score = max(0, 1 − deviation × macro-deviation-slope)` (slope config, 2.0).
Detail payload: `macroRatio` (meal shares %), `macroTargets` (target-share strings, e.g. `"~27%"`),
`kcalShareOfDay = meal.kcal / targets.kcal × 100`. `notes: null` (P8 prose; panel already guards).

**Micro (.25)** — nutrition-quality over fiber/sugar/salt/satFat summed from live sources at write
(pantry arm: the item's facts × amount/per; recipe arm: Σ ingredient-line facts ÷ servings × adag).
Per-meal reference = daily ref × the meal's kcal-share (proportional allotment; daily refs config:
fiber 38 g **target**, sugar 78 g / salt 6 g / satFat 34 g **limits**).
Fiber subscore = `min(1, fiber/ref)`; limit subscores = `1` while under the allotment, then linear
to 0 at 2× (`max(0, 1−(ratio−1))`). Dimension score = mean of available subscores.
Rows (`micros[]`): `{name: "Rost", value: "9.5 g", pct: round(ratio×100), status}` — status
good/ok/low per config thresholds (fiber: ≥80/≥50 good/ok; limits: ≤100/≤150 good/ok — for limit
rows `pct` = % of the allotment used, `low` = over). Coverage = kcal-share of lines whose source
carried any of the four facts.

**NOVA (.25)** — kcal-weighted over per-line `snapshot_nova`.
`score = Σ share_g · groupScore(g)` (config: NOVA1 1.0 · 2 0.85 · 3 0.55 · 4 0.20).
`dominant` = largest-share group; `stack` = the 4 groups with pct + joined item-name label (`"—"`
at 0); `items` = `{name: "{snapshotName} {amount}{unit}", nova, warning: nova==4}`.
Coverage = kcal-share of NOVA-carrying lines; null-NOVA lines are excluded from shares.

**Context (.20)** — deterministic slot/timing fit from data the meal feature owns (no Train/Reta
cross-reads — the mock's training/Reta rows are P8 territory):
- *Időzítés:* logged **local** hour (from the request's offset-bearing `loggedAt`, before the UTC
  conversion; server-now default → UTC) vs the slot window (config: breakfast 05–10, lunch 11–15,
  dinner 17–22; snack = always fits). In-window 1.0, else linear 0 at 3h outside.
- *Slot-arány:* meal kcal vs slot-expected share of the daily target (config: .25/.35/.30/.10),
  1.0 within ±40% relative tolerance, linear to 0 at 2× outside.
- *Fehérje:* meal protein vs slot-share of the daily protein target — `min(1, p/ref)`.
Score = mean; rows = the three `{label, value}` pairs with honest computed values.

**Recipe fit** = same engine on the per-serving profile, macro+micro+nova only (no logged time/slot
context), weights renormalized (.30/.25/.25 ÷ .80). Emitted per read in `RecipeResponse.mezoFit.score`.

## 4. Boundary changes

- `meal.yml`: typed `MealBreakdown` (+`MealScoreDimension`, `MealMacroDetail`, `MealMicroRow`,
  `MealNovaDetail`, `MealNovaStackRow`, `MealNovaItemRow`, `MealContextRow`, `MealImproveRow`,
  `MealToolRow`); `RecipeLogResponse.score` (nullable). `recipe.yml`: `novaDominant: integer`.
- Migration `2026-07-05 mezo-yta`: `ALTER TABLE meal ADD COLUMN score numeric` (nullable, no index —
  only day-scoped reads).
- FE: `mealApi.fromResponse` maps `score.breakdown` → `FuelMeal.breakdown` (reconstructs the
  discriminated union + injects the constant dimension colors); `FuelMeal.score` ← `score.value`
  (unchanged); recipe-log mapping carries `score`; `MealBreakdown.summary` widens to
  `string | null` + `MealScoreSheet` hides the summary block when null; `RecipeLogsList` computes
  the delta from its (until-now unused) `baselineScore` prop. Hook signatures unchanged.

## 5. Out of scope (P8 / proactive epic)

`summary`/`improve[]` prose, calibrated confidence narrative, Train/Reta context rows, vitamin
micros (needs data), `fitsFor` generation, recipe `fit_score` persistence, weekly micronutrient
ProgressBars (static mock), re-scoring old meals.
