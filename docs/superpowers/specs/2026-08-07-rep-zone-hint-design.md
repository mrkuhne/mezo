# Rep-zone distribution hint — design

**Date:** 2026-08-07 · **Driving issue:** `mezo-oyhy.4` (child of the guided-meso-building epic) ·
**Status:** approved by Daniel (brainstorm 2026-08-07)

## Context

RP's weekly rep-zone guidance (`docs/research/concepts/program-design-rules.md`): per muscle
per week aim for ~25% heavy (5–10 rep) · ~50% moderate (10–20) · ~25% light (20–30) working
sets; side/rear delts may skew light, hip-hinge muscles may skew heavy. mezo's structure-lint
layer (`mezo-oyhy.2`) is the natural home: soft, explained, never blocking.

## Decisions (brainstorm)

1. **Surface: structureLint rule 9 (`rep-zone`)** on the existing Struktúra card — no new UI
   (`StructureLintCard` renders findings generically). Rejected: an extra three-segment
   zone-mix strip on SetBudgetCard rows (the row already carries 🔥/🌿 + % — a third number
   system is noise).
2. **Trigger: mono-zone only.** Flags a muscle group only when ≥80% of its weekly sets sit
   in ONE zone (and the group has ≥6 weekly sets). Rejected: deviation-from-25/50/25
   thresholds (most realistic plans would flag constantly — noisy).

## The rule

- **Zone of an exercise** (from its rep range, plyo excluded as everywhere):
  `repMax ≤ 10` → heavy · `repMin ≥ 20` → light · otherwise moderate.
- **Aggregation:** per budget group, weekly non-plyo working sets per zone.
- **Gate:** total ≥ `REP_ZONE_MIN_WEEKLY_SETS` (6).
- **Trigger:** dominant zone share ≥ `REP_ZONE_MONO_SHARE` (0.8).
- **Exceptions (`REP_ZONE_SKEW_OK: Record<group, zone>`):** `shoulder`→light, `ham`→heavy,
  `glute`→heavy — the pair (group, dominant zone) matching the table stays silent.
- **Scope:** weekly finding (no `day`), appended after the existing weekly rules.
- `StructureRuleId` gains `'rep-zone'`. Constants exported next to the other thresholds.

## Copy (Hungarian, final)

- label: `{Izom}: a heti szettek {pct}%-a {zóna} zónában.` (zone names: `nehéz` / `közepes` /
  `könnyű`; pct integer)
- detail: `Az arany arány ~25% nehéz (5–10) · 50% közepes (10–20) · 25% könnyű (20–30 rep) — vegyíts a hiányzó zónákból.`

## Testing

Classification boundaries (repMax 10 vs 11; repMin 19 vs 20), gate (5 vs 6 sets), mono
threshold (just below vs at 80%), exceptions (shoulder-light silent, shoulder-heavy flags,
ham-heavy silent), plyo exclusion, clean-week fixture REBALANCED (its default 8–10 rep
ranges are all heavy-zone, so chest/back/quad would legitimately mono-flag: give the Csü
day's exercises `repMin: 12, repMax: 15` so every gated group splits heavy/moderate below
80% — verified side-effect-free on R1–R8, session estimate stays in band at ~68 min), rule
ordering (weekly, after ham-quad). Full gate + train.md +
lint-docs. MesoEditor is not a visual-golden screen — no baseline impact expected.

## Non-goals

- No zone-mix visualization (possible later child if wanted).
- No per-exercise zone editing aids; no generator integration (that is `mezo-oyhy.6`).
- Thresholds not user-tunable.
