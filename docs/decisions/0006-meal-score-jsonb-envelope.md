# 0006 — Meal-score breakdown as typed jsonb envelope (+ denormalized numeric score)

- **Status:** Accepted
- **Date:** 2026-07-02
- **Driver:** mezo-ut1 (Fuel roadmap P0c) — implemented by P7 (`mezo-yta`)

## Context

Every logged meal ships a NULL score today, guarded by the FE pending-sparkle. The read surface
(`MealScoreSheet`, `ScoreHero`, `DimensionCard`, `RecipeFitBadge`, `RecipeLogsList`) is complete
and waits only for data. The `meal` table already has a `breakdown jsonb` column mapped onto a
deliberately-minimal `MealBreakdownJson(value, summary)` record. Train de-risked the pattern:
`ProvenanceEnvelope` is a typed object mapped via `@JdbcTypeCode(SqlTypes.JSON)` (`mezo-be4`
proved the serialization). The FE `MealBreakdown` type defines the target shape: `confidence`,
`summary`, `dimensions[]` (4 weighted kinds), `improve[]`, `tools[]`.

## Decision

1. **Reuse Train's typed-jsonb envelope pattern**: `meal.breakdown` maps onto a full typed
   `MealBreakdownJson` mirroring the FE `MealBreakdown` (4 dimensions, weights, details) —
   never a raw String, never `additionalProperties: true` in the contract (P7 tightens `meal.yml`).
2. **4-dimension weighted model is canonical**: Macro .30 · Micro .25 · NOVA .25 · Context .20.
3. **Deterministic-v0 / AI split**: P7 computes the four NUMERIC dimensions + weighted total +
   numeric confidence from data/config; the `summary`/`improve[]` prose + calibrated confidence
   narrative are Phase-3 (`P8`) and stay null/empty until then — the FE renders what exists,
   never fabricated prose.
4. **Add a denormalized `meal.score numeric` column alongside the jsonb** (P7 migration):
   list surfaces (`RecipeLogsList`, day view, future queries/aggregates) read the scalar without
   parsing jsonb; the write path sets both atomically in `ScoringService`. The jsonb stays the
   source of detail, the column is a read-optimization only.

## Consequences

- P7 replaces the placeholder `MealBreakdownJson` record with the full envelope — an additive
  jsonb-shape change (existing rows are NULL, so no data migration).
- Recipe fit-score (`recipe.mezoFit.score`) shares the same `ScoringService` and dimension model.
- The scalar column duplicates `breakdown.value` by design; `ScoringService` is the single writer,
  so drift is not reachable in normal paths.
- NOVA-dimension fold-ins surface at P7: `mezo-2dy` (contract type drift), `mezo-0xh.30`
  (palette parity), `mezo-24j` (fixture macro drift).

## Alternatives considered

- **jsonb only, no scalar column** — rejected: every list/aggregate read pays jsonb extraction;
  the day view + recipe logs are the hottest read paths.
- **Fully-relational dimension tables** — rejected: the breakdown is a write-once display
  artifact, not a queried relation; jsonb envelope is the house pattern (Train precedent).
- **String jsonb (raw)** — rejected by house rule (`@JdbcTypeCode(SqlTypes.JSON)` onto typed
  objects is mandated in CLAUDE.md).
