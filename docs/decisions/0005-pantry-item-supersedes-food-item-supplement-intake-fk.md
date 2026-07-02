# 0005 — pantry_item supersedes food_item; supplement_intake FKs pantry_item; nutrition targets stay config

- **Status:** Accepted
- **Date:** 2026-07-02
- **Driver:** mezo-ut1 (Fuel roadmap P0b)

## Context

The Phase-2 master design spec (`2026-06-10-phase2-backend-design.md`, Slice C) named a
`food_item` catalog table, a `supplement_intake` event table, a `nutrition_targets` table and
`medication(_dose)`. Implementation diverged while shipping:

- The pantry slice (`mezo-9xu`) shipped **`pantry_item`** — Model B, one table for
  food/supplement/stim/med shelf items with a `kind` discriminator — which recipes
  (`recipe_ingredient`, `mezo-lns`) and meals (`meal_item`, `mezo-arb`) already FK.
- `nutrition_targets` shipped as `@ConfigurationProperties` (`NutritionTargetsProperties`),
  not a table — single-user, one target set.
- Retatrutide shipped as first-class **`medication` + `medication_dose`** (`mezo-d94`) with a
  server-derived cycle — NOT a `pantry_item` row (the earlier "Reta keeps a pantry shelf card,
  de-dup via `stashRefId`" idea is superseded).

Open half: what does the P2 `supplement_intake` event reference?

## Decision

1. **`pantry_item` officially supersedes the spec's `food_item`.** No separate food catalog table.
2. **`supplement_intake` FKs the `pantry_item` supplement/stim row** (`ON DELETE RESTRICT`,
   dose snapshot at intake time) — supplements already live in `pantry_item`; no second
   supplement catalog.
3. **`nutrition_targets` stays config** (`@Validated` properties) until multi-profile/adaptive
   targets (Phase 3 goal engine) force a table.
4. (Recorded, already shipped:) **medication is first-class** (`medication` + `medication_dose`);
   medication intake events live in `medication_dose`, never in `supplement_intake`.

## Consequences

- P2's `supplement_intake` is an append-only ledger mirroring the `medication_dose` precedent
  (`taken_at` + derived day key, snapshot fields), joinable to the pantry for display.
- Soft-deleting a pantry supplement keeps historical intakes valid (RESTRICT + `is_deleted`).
- The P5 timeline joins meals + `supplement_intake` + `medication_dose` + Train blocks — three
  event sources, one shelf catalog.
- If Phase-3 adaptive targets arrive, `nutrition_targets` migrates config → table as its own slice.

## Alternatives considered

- **Dedicated `supplement` catalog table** — rejected: duplicates `pantry_item kind='supplement'`;
  the Kamra already manages these rows.
- **Intake as a boolean `taken` on `pantry_item`** — rejected: loses history/time, breaks weekly
  adherence and the P5 timeline.
- **`nutrition_targets` table now** — rejected: YAGNI single-user; config round-trips are free.
