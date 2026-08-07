# 0021. Weekly volume counts direct (primary-muscle) sets only

Date: 2026-08-07 · Status: accepted · Driving issue: `mezo-oyhy.5`

## Context

Every guidance layer built by the guided-meso-building epic — the weekly set budget
(`setBudget.ts`, 12/20 style caps), the optimal-zone bands (`GROUP_MEV`), the live zone rows
(`weekZone.ts`) and the structure lint — aggregates "weekly sets per muscle group" from each
exercise's single `muscle` field. The experts disagree on whether synergist work should count
(`docs/research/concepts/program-design-rules.md` §The counting controversy):

- **RP / Israetel:** direct sets only — a row is back work, the biceps ride along for free.
- **Helms:** synergists count **0.5** — a row is 1.0 back + 0.5 biceps.
- **Ethier / BWS:** synergists count **1.0** — a bench press is 1 chest + 1 triceps set.

Whichever model an app picks changes every budget/zone/lint number it shows, so the epic
required a conscious, recorded decision plus a user-visible explanation.

## Decision

**mezo counts direct sets only** (the RP model). A set contributes to exactly one muscle
group: the one in the exercise's `muscle` field.

The choice is explained to the user in the UI: the expanded `SetBudgetCard` carries a
footnote — *„Csak a fő izom szettjei számítanak — a szinergista munka (pl. fekvenyomás →
tricepsz) nem."*

## Rationale

1. **The data model has no synergist knowledge.** Exercises carry a single head-specific
   `muscle` key (ADR 0013); fractional counting needs a synergist map across the whole
   exercise catalog — a new data layer touching the API contract, every guidance surface,
   and the MEV calibration. That is an epic-sized addition, not a counting-mode switch.
2. **Internal consistency.** The MEV table (`GROUP_MEV`) was taken from RP's landmarks,
   which are themselves direct-counting numbers. Mixing Helms-style 0.5 credits with
   RP-calibrated floors would silently double-count against the wrong reference.
3. **Explainability.** Whole sets against one muscle stay legible in every surface
   (`8🔥+8🌿`, `4/10`); fractional tallies (`7.5 szett`) cost more confusion than accuracy.

## Consequences

- Indirect work is invisible: a pressing-heavy week under-reports triceps volume, a
  row-heavy week under-reports biceps. The under-volume (`↓`) signal can therefore
  over-warn on arm groups for users who train them mostly indirectly — the UI footnote
  is the mitigation.
- If fractional counting is ever wanted, the prerequisite is a synergist catalog:
  tracked as backlog issue `mezo-oyhy.5a` (create on demand) — per-exercise secondary
  muscle lists with weights, then a counting-mode decision revisit.
- The generator (`mezo-oyhy.6`) must keep assigning the primary muscle per exercise
  knowing the guidance layers read exactly that field.
