# Scoring v1 — 8-Dimension Meal/Recipe Evaluation — Design

> **Date:** 2026-07-25
> **Status:** Approved (brainstorming; user pre-approved spec → plan → subagent implementation)
> **Driving issue:** `mezo-7797`
> **Scope:** Extend the deterministic scoring engine (`MealScoringService`, ADR 0006 / `mezo-yta`, template side `mezo-bw3y`) from 4 to 8 dimensions, on BOTH surfaces (meal score + recipe template breakdown). Contract-first change (`api/feature/meal/meal.yml` id pattern) + FE render extension + prose-prompt extension. No DB migration (jsonb envelopes are schemaless; old envelopes stay valid).

## Problem

The recipe/meal evaluation scores 4 dimensions (Macro .30 · Micro .25 · NOVA .25 · Context .20).
The user wants richer, guideline-grounded feedback: portion sizing, WHO/USDA compliance, fat
quality — plus recommended additions. The current Micro dimension conflates a fiber TARGET with
sugar/salt/satFat LIMITS, which blocks adding a WHO dimension without double-counting.

## Approved decisions

| Decision | Choice |
|---|---|
| Scope | **Both surfaces** — meal score AND recipe template share the new dimension set (one engine); Adag-arány is template-only (meals already score slot-share in Context) |
| Fact redistribution | **Clean redistribution — 1 fact scores in exactly 1 dimension.** Micro reduces to fiber-only; sugar+salt move to WHO; satFat moves to Zsírminőség |
| Extra dimensions | **Növényi diverzitás** + **Energia-sűrűség** accepted; protein density REJECTED (would double-count the Macro P-share signal) |
| Weights | Config-driven initial proposal (below), sum = 1.0 per surface |

## 1. The dimension set

All new dimensions follow the existing honesty rules: zero input coverage → `weight 0, score 0`,
"Nincs adat" detail, total renormalizes, confidence drops via coverage.

| # | id | Label (HU) | Scores | Formula (subscores average unless noted) |
|---|---|---|---|---|
| 1 | `macro` | Kcal & makró arány | unchanged | unchanged (P/C/F kcal-share total-variation vs `mezo.nutrition` targets) |
| 2 | `micro` | Rost & mikro | fiber ONLY | `min(1, fiber / (fiberG × kcalShare))` — the existing fiber term alone; sugar/salt/satFat rows REMOVED from this dim |
| 3 | `who` | Ajánlások · WHO | sugar energy-share + salt allotment | `limitSub(sugarEnergyShare / 0.10)` where `sugarEnergyShare = sugar×4 / kcal` (WHO free-sugar strong rec ≤10 E%); `limitSub(salt / (saltLimitG × kcalShare))` (WHO 5 g/day scaled) |
| 4 | `fat_quality` | Zsírminőség | satFat energy-share + sat share of total fat | `limitSub(satFatEnergyShare / 0.10)` where `satFatEnergyShare = satFat×9 / kcal` (WHO ≤10 E%); `limitSub(satShare / 0.33)` where `satShare = satFat / f` (balanced-thirds SFA reference). Degrades when `f == 0` or satFat fact missing |
| 5 | `nova` | Feldolgozottság · NOVA | unchanged | unchanged (kcal-weighted NOVA class distribution) |
| 6 | `plant_diversity` | Növényi diverzitás | distinct plant categories | `min(1, distinctPlantCats / 3)` — categories from the pantry `category` field restricted to the configured plant set (vegetables, fruits, grains, legumes, nuts/seeds enum values — exact strings resolved from the category value set at implementation); the "30 plants/week" gut heuristic at recipe scale |
| 7 | `energy_density` | Energia-sűrűség | kcal per 100 g | `density = totalKcal / totalGrams × 100` over gram/ml lines only; score 1.0 at ≤ `goodKcalPer100g` (150), linear to 0 at ≥ `badKcalPer100g` (400). Discrete-unit (db) lines are excluded → coverage = gram-line kcal share |
| 8a | `context` | Időzítés & kontextus | **meal only**, unchanged | unchanged (timing + slot-share + protein subscores) |
| 8b | `portion` | Adag-arány | **recipe template only** | `rel = perServingKcal / (targets.kcal × slotShare(recipe.slot))`; `score = max(0, 1 − max(0, |rel − 1| − slotShareTolerance))` (the Context shareSub shape, reusing the existing tolerance). Recipe without slot → configurable `defaultShare` (0.30). Replaces the current weight-0 degraded context placeholder in the template |

`limitSub` is the existing helper (1.0 inside the allotment, linear to 0 at 2×).

## 2. Weights (config, `application.yml` → `mezo.fuel.scoring.weights`)

| macro | micro | who | fat-quality | nova | plant-diversity | energy-density | context | portion |
|---|---|---|---|---|---|---|---|---|
| .22 | .10 | .14 | .10 | .18 | .08 | .06 | .12 | .12 |

- **Meal** uses all except `portion` → sums to 1.0.
- **Template** uses all except `context` → sums to 1.0.
- The `Weights` record + its `isNormalized` validation extend accordingly (validate BOTH sums).
- Existing renormalization over degraded dimensions is unchanged.

## 3. Engine & carrier changes (backend)

- **`ScoredLine` gains two fields:** `String category` (nullable — pantry category; null on
  FK-less estimate lines) and `BigDecimal amountG` (nullable — the line amount converted to grams
  for `g`/`ml` units, ~1 ml ≈ 1 g; null for discrete units). Both composers populate them:
  `RecipeService.fitLines` (pantry item `p` is already in scope) and the meal-side composer in
  `MealService`.
- **`MealScoringService`**: `microDim` shrinks to fiber-only; new private methods `whoDim`,
  `fatQualityDim`, `plantDiversityDim`, `energyDensityDim`, `portionDim(slot, kcal)`;
  `scoreMeal` assembles 8 dims (macro, micro, who, fatQuality, nova, plantDiversity,
  energyDensity, context); `recipeTemplateBreakdown` assembles 8 live dims (same minus context
  plus portion — portion is a REAL dimension now, the degraded context placeholder row is
  REMOVED); `recipeFit` stays a thin delegate. The `recipeTemplateBreakdown` signature gains the
  recipe `slot` parameter (nullable).
- **`MealScoringProperties`**: `Weights` gains 5 keys (validated double-sum); new nested records
  `WhoRefs(sugarEnergyShareLimit, saltLimitG)`, `FatQualityRefs(satFatEnergyShareLimit,
  satFatShareRef)`, `PlantDiversityRefs(targetCategories, plantCategories: List<String>)`,
  `EnergyDensityRefs(goodKcalPer100g, badKcalPer100g)`, `PortionRefs(defaultShare)`. The
  `micro` record loses its three limit keys (they move to who/fat-quality). All values in
  `application.yml` under `mezo.fuel.scoring.*` — never hardcoded (house config convention).
- **Detail payloads:** the new dimensions reuse the EXISTING generic label/value row shape
  (`ContextRow` / contract `MealContextRow`) — no new jsonb/DTO shapes. Rows per dim:
  who → "Cukor", "Só"; fat_quality → "Telített E%", "Telített/összzsír"; plant_diversity →
  one row per found plant category + "Összesen"; energy_density → "Sűrűség", "Lefedettség";
  portion → "Adag kcal", "Slot-büdzsé". `tools()` provenance gains matching compute rows.

## 4. Contract + FE

- **`api/feature/meal/meal.yml`:** `MealScoreDimension.id` pattern widens to
  `^(macro|micro|nova|context|who|fat_quality|plant_diversity|energy_density|portion)$`; the
  `context` field's description generalizes to "generic label/value rows (context, who,
  fat_quality, plant_diversity, energy_density, portion)". Merge + regenerate both sides
  (contract-first: edit the fragment BEFORE code).
- **FE `data/types.ts`:** `MealDimensionBase.id` union widens; one new interface
  `RowsDimension extends MealDimensionBase { id: 'who' | 'fat_quality' | 'plant_diversity' |
  'energy_density' | 'portion'; context: { label: string; value: string }[] }` (same payload
  shape as `ContextDimension`); `MealDimension` union extends.
- **FE `mealApi.ts`:** `DIMENSION_COLOR` map gains the 5 new ids (presentation-only, spec D3 rule
  unchanged). Palette: who → `var(--sky-deep)` if exists else an existing token; fat_quality →
  `var(--amber-deep)`; plant_diversity → `var(--sage-deep)`; energy_density →
  `var(--lav-deep)`; portion → `var(--coral-deep)` (exact tokens confirmed against
  `prototype.css` at implementation; tokens only, no raw hex).
- **FE `DimensionCard.tsx`:** new ids render the generic rows panel (the `ContextPanel`
  label/value renderer — reuse or a thin shared rows panel); no layout change.
- **Compatibility:** old persisted meal envelopes (4-dim) keep rendering — the change is
  additive; the FE never assumes a fixed dimension count.

## 5. Prose (LLM) layer

`RecipeBreakdownProseService` prompt: the dimension list it narrates extends to the new ids with
one-line Hungarian scoring semantics each, so per-dim `detail` prose + `improve[]` suggestions
cover them. The LLM response schema is keyed by dimension id — extends mechanically. No new
endpoint, flag (`mezo.feature.recipe-ai-score.enabled`) unchanged.

## 6. Caching / invalidation

No migration needed: `RecipeBreakdownService.matches()` compares dimension count + ids + scores —
every cached envelope mismatches the fresh 8-dim run on first read → regenerates (incl. prose)
lazily. Meal envelopes are immutable history: old meals keep their 4-dim breakdown (honest
point-in-time), new logs score 8-dim. `recipe.fit_score`/`mezoFit.score` self-update at read as
today.

## 7. Testing

- **Engine unit tests** (pure math, no Spring): per new dimension — happy path, boundary values
  (limits at 1×/2×, density at 150/400, diversity 0..3+), coverage degradation (missing facts /
  db-only lines / no category), weight-sum validation both surfaces, template portion with and
  without slot.
- **ITs:** breakdown endpoint returns 8 dims with renormalized weights; a stale 4-dim cached
  envelope regenerates on read; meal POST persists the 8-dim envelope; old envelope rows
  unaffected.
- **FE:** both modes green; `DimensionCard` renders a rows panel for a new id; mock seed
  (`templateBreakdown`) extended to the new shape so mock mode exercises the new dims.
- **Docs-lint** green after the doc updates.

## 8. Docs impact

- This spec (frozen) + implementation plan.
- `docs/features/fuel.md` — scoring paragraphs (P7 engine + recipe breakdown) updated to the
  8-dimension model in the same change.
- ADR 0006 stays (the engine architecture is unchanged — this extends its dimension set; the
  spec records the reasoning).
