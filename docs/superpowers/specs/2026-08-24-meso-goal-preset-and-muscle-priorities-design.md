---
title: Meso goal preset + muscle priority tiers
type: spec
status: approved
created: 2026-08-24
driver: mezo-dq60 (slice 1); slice 2 gets its own bd issue
related: [2026-08-24-volume-engine-weekly-distribution-design.md]
---

# Meso goal preset + muscle priority tiers

Two stacked slices that finish what `mezo-gbo7` started. The volume engine now
dictates the weekly set count and the template's `workingSets` is only a
weighting — so the builder should stop asking the user for numbers the engine
overrides, and the budget display should stop measuring every muscle against
the same ceiling.

**Slice 1 (`mezo-dq60`)** — persist the wizard's goal choice as a machine key
and use it to auto-fill sets/reps/RIR when an exercise is picked.
**Slice 2 (new issue)** — per-muscle priority tiers (Emphasize / Grow /
Maintain) that retarget the weekly ramp, reframe the budget card, and drive a
time-based "does this fit" signal in the builder.

Slice 1 lands first: it is small, self-contained, and slice 2's wizard step
and card rework touch the same surfaces.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| **GD1** | The goal is persisted as a preset id (`goalPreset`: `hypertrophy` / `strength` / `cut-prep` / `recovery` / `sport` / `erohipertrofia`), not recognized from the free-text `goal` | The wizard already makes this choice; today it survives only as prose. A dropdown beats text-matching for robustness; the free-text `goal` stays untouched as the human description. |
| **GD2** | Picker auto-fill reads the generator's existing `SCHEMES` table keyed by `goalPreset` | One source of truth; a hand-added exercise gets the same scheme as its generated neighbours. No preset (NULL) → `hypertrophy` fallback. |
| **GD3** | Priority tiers are a per-coarse-muscle-group map, default **Grow**, stored sparsely (only non-Grow entries) | 1–2 Emphasize picks + optional Maintain marks is the whole UX; ten explicit decisions per meso would be new admin burden. |
| **GD4** | A tier changes ONLY the ramp ceiling and ramp on/off in `VolumeDecider`: Emphasize→MRV, Grow→MAV, Maintain→hold at MEV | The MEV/MAV/MRV landmarks already exist per muscle; the tier picks which one is "100%". Grind/early-deload/deload-fraction logic is untouched. |
| **GD5** | The budget card measures each group against its OWN tier target | "Hát · Emphasize · 84%" and "Farizom · Maintain · 100%" are both meaningful; the old single-ceiling percentage made Maintain muscles look permanently behind. |
| **GD6** | "Does it fit" is computed from TIME: project the PEAK week's tier targets onto the template days and run `estimateSessionMinutes`; flag days leaving the 45–90 min band | Matches how the user actually experiences capacity; the estimator and the band already exist (`sessionLength.ts`, structureLint R8). A raw weekly set cap would be arbitrary and insensitive to compound-vs-isolation cost. |
| **GD7** | Mid-cycle tier edits take effect at the next weekly rollover; nothing is rewritten retroactively | Same lazy-rollover contract the engine already has (DA3 idempotency). |

## Slice 1 — goal preset + picker auto-fill (`mezo-dq60`)

### Data model + contract

- `mesocycle.goal_preset` and `meso_template.goal_preset` — nullable text, no
  DB CHECK (the preset list is FE-owned; a CHECK would demand a migration per
  new preset).
- Contract: optional `goalPreset` string on `MesocycleResponse`,
  `MesoTemplateResponse`, `MesoTemplateUpsertRequest`, and the mesocycle
  create/update paths. Regenerate the merged `api/openapi.yml` before
  `pnpm generate:api` (the frontend generator reads the bundle).
- **Backfill** (Liquibase, same pattern as the mezo-gbo7 backfill): map the
  existing `goal` text to a preset id via the `GOAL_PRESETS[].description`
  strings, hardcoded in the migration as a point-in-time snapshot. No match →
  NULL. The live "Shoulder & Back Mezo #1" carries the hypertrophy preset's
  description verbatim, so it backfills to `hypertrophy`.

### Behaviour

- **Wizard:** step 1's goal choice writes `goalPreset` into the saved
  template/run alongside the prose `goal`.
- **Editor:** a "Cél" dropdown in the meso/template settings sets the preset
  after the fact; the free-text `goal` is not modified by it.
- **Picker fill:** `libraryToGymExercise` takes the context's preset and
  fills from `SCHEMES[preset]` by exercise type; plyo gets `3×5`, zero warmup
  sets, and `countsTowardVolume: false`. Warmup sets come from the existing
  `warmupSuggest` logic instead of a hardcoded 2. Call sites: `MesoExercises`
  (meso editor), `MesocyclePlannerPage` (wizard), `CustomWorkoutBuilderPage`
  (no meso context → hypertrophy fallback).

### Testing

Picker fill per preset (vitest); preset persistence round-trip (IT); backfill
SQL test executing the shipped migration statement (the
`MesoTemplateVolumeBackfillSqlIT` pattern); both FE modes; contract-drift
regeneration.

## Slice 2 — muscle priority tiers (new issue)

### Data model + contract

- `mesocycle.muscle_priorities` and `meso_template.muscle_priorities` — jsonb
  map `{"back":"emphasize","glute":"maintain"}`; absent key = Grow; empty/NULL
  map = all Grow (the backfill leaves everything NULL, so live behaviour does
  not jump on deploy — the current engine never ramped past MAV inside a
  6-week block anyway).
- Contract: optional `musclePriorities` object on the same schemas as
  `goalPreset`. The template→run stamp carries it — with a dedicated test on
  the stamp path (the mezo-gbo7 final review found exactly this path
  re-arming a defect).

### Engine

One coupling point. `VolumeDecider.decide` receives the tier-resolved ceiling
instead of raw `mrv`, and Maintain disables the RAMP branch:

| Tier | Ramp | Ceiling | Deload |
|---|---|---|---|
| Emphasize | +step/week (unchanged) | MRV | unchanged (×0.5) |
| Grow (default) | +step/week | **MAV** | unchanged |
| Maintain | none — holds MEV | MEV | unchanged |

`plannedScaffold` (the Volumen view's planned curve) uses the same ceiling so
the chart shows the tier's target. Grind and early-deload logic untouched.
Groups without a volume-log row (core/traps) are unaffected — no row, no tier.

Note: Grow's MAV ceiling is a real behaviour change from today's MRV ceiling.
It is the intended semantics — MRV is for the block's focus, not for every
muscle — and the deferred-start effect is nil for typical 5–6-week blocks
(the +2/week ramp from MEV reaches MAV around week 3–4 and previously kept
climbing; now it holds).

### UI

- **Wizard focus step** (after Split): "Mire gyúr ez a blokk?" — pick 1–2
  Emphasize groups, optionally mark Maintain, everything else Grow. The same
  control lives in the meso/template editor for later changes.
- **Budget card:** pills become `Hát · Emphasize · 84%` — percent of the
  TIER's target (MRV / MAV / MEV respectively), colored against that target.
  `structureLint`'s frequency and variety rules go silent for Maintain
  groups (one weekly session is defensible maintenance).
- **Fit signal:** the builder projects the PEAK week's tier targets onto the
  template days (an FE mirror of the engine's proportional distributor —
  `setBudget` already carries half of it), runs `estimateSessionMinutes` per
  day, and flags any day leaving 45–90 min: "Csúcshéten ~104 perc — vegyél
  el, vagy tedd át." Recomputes live on add/remove.

### Testing

`VolumeDecider` tier matrix (IT); stamp carry-over (IT); scaffold curve per
tier; FE: pill render for all three tiers, deterministic peak-week projection
fixture; both FE modes.

## Out of scope

- Auto-suggesting tiers from the exercise list (reverse of the intended flow).
- Any change to grind / early-deload / deload-fraction logic.
- Per-exercise (rather than per-group) priorities.
- The `programFit` / `MesoEditor` literal-plyo cleanup — that is `mezo-yqpf`.
