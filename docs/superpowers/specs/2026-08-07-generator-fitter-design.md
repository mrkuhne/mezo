# Generator fitter — generateProgram applies the rule engine — design

**Date:** 2026-08-07 · **Driving issue:** `mezo-oyhy.6` (final child of the guided-meso-building
epic) · **Status:** approved by Daniel (brainstorm 2026-08-07)

## Context

`generateProgram` (`frontend/src/features/train/logic/planner.ts`) assembles fixed
`SPLIT_TEMPLATES` exercise lists and stamps a uniform per-goal `SCHEMES` set/rep/RIR scheme.
The guidance layers built by this epic then judge the result — and today they judge it
badly: a 6-day PPL generates 22 failure-style weekly back sets (~183% budget) and 16 chest
sets (133%); uniform rep ranges mono-flag the rep-zone rule. The generator must apply the
rule engine so a fresh plan starts green.

## Decisions (brainstorm)

1. **Scope A — full deterministic fitter + invariant test** over every goal × split × day
   combination. Rejected: minimal MEV-top-up-only (generated plans would still show red).
2. **Volume target: MEV floor + safe ceiling.** Every trained group lands at
   `sets ≥ GROUP_MEV` and budget below the near threshold where the template's slot
   structure allows (RP week-1 semantics — the phase curve raises volume later).

## Architecture — `programFit.ts`

New pure module `frontend/src/features/train/logic/programFit.ts`:
`fitProgram(days: PlannerDay[], goalId: string): PlannerDay[]` — deterministic, no
randomness; applied by `generateProgram` as its final step on BOTH return paths (template
weekdays and selected-weekday placement). Off/sport/custom (exercise-less) days pass through
untouched; plyo exercises are never modified; `warning` fields and exercise identity/order
are preserved (single last-resort exception below); `warmupSets` untouched.

### Phase 1 — rep-zone variation

Per muscle group, in week-encounter order of its non-plyo exercises (slots):
- slot 0 keeps the goal scheme's rep range;
- later slots get a range from a shifted palette that guarantees the first two slots sit in
  DIFFERENT zones: base zone heavy → `12-15` (moderate); base moderate → compound `6-9`
  (heavy) / isolation `20-25` (light); shoulder-group isolation slots ≥1 always `20-25`
  (RP side-delt light);
- slots ≥2 cycle the palette.

Why this suffices: the rep-zone rule gates at ≥6 weekly sets; a single slot maxes at 4 sets,
so every gated group has ≥2 slots, and two zones across the first two slots caps the
dominant share at ≤4/6 ≈ 67% < 80%. RIR stays the scheme's per-kind value (budget style
unchanged by phase 1).

### Phase 2 — volume fit to `[MEV, ceiling)`

Compute `muscleBudgets`. Per trained group (has `GROUP_MEV` entry; traps/core skipped):
- **Under MEV:** repeatedly +1 working set on the group's slot with the fewest sets
  (ties → earlier day), respecting `SETS_PER_EXERCISE` kind caps (compound 4 / isolation 3),
  the 11-set session group cap, and the 90-min day estimate; stop at MEV or saturation.
- **Over ceiling (0.85):** repeatedly −1 from the slot with the most sets (ties → later
  day), floor 2. If every slot is at floor and budget ≥ 0.85 still: **last resort**, remove
  ONE duplicate exercise instance (the group's highest-set later-day slot) but only when the
  removal keeps (a) ≥1 exercise of that group on each of its training days (frequency),
  (b) ≥2 distinct weekly names (variety), (c) the day's exercise count ≥5 (session size).
  When no removal is legal, stop — the hard ceiling below still holds.

### Phase 3 — session-length guard

Per training day, after phase 2: estimate > 90 min → −1 set from the day's largest-set
non-plyo slot whose group stays ≥ MEV (repeat; floor 2); estimate < 45 min → +1 set on the
day's slot whose group has the most budget headroom, within all caps (repeat until ≥45 or
saturated).

### Guarantees (the invariant test's assertions)

For EVERY goal (6) × split × valid day count (`SPLITS[].days`) combination, the generated
program satisfies:
- **Hard:** `structureLint(days) === []`; every trained group `sets ≥ GROUP_MEV[group]`;
  every group `budget ≤ 1.0` (never `over`); no plyo/off-day mutation; custom split emits
  exercise-less days untouched.
- **Soft (also asserted, with a documented allowlist):** budget < 0.85 for every group
  EXCEPT combinations where the template's floor structure makes it impossible. Known
  irreducible case, derived: 6-day PPL back = 6 slots (3 per Pull day × 2), floors 2 each =
  12 failure-style sets = exactly 100% — the last-resort removal is ILLEGAL there because
  each Pull day has exactly 5 exercises (rule c would drop a day to 4), so the combo lands
  at `near` (100%), which `budgetLevel` still accepts (≤ 1.0, no lint finding, no red).
  Such combos join an explicit `NEAR_ALLOWED` list in the invariant test with a comment
  deriving the arithmetic — an amber "near" pill on a deliberately maximal split is
  truthful signal, not a defect.
- Niggle warnings survive fitting (spot assertion on the shoulder-niggle path).

## Copy

No new UI copy — the generator's output simply stops triggering the existing warnings.
`GOAL_HINTS`, wizard steps, `MesocyclePlannerPage` call sites unchanged.

## Testing

- `programFit.test.ts` — unit: phase-1 palette (zones differ on first two slots; shoulder
  light; plyo untouched), phase-2 add/trim mechanics on crafted fixtures (MEV top-up honors
  kind caps and session cap; trim floors; last-resort removal legality checks), phase-3 both
  directions.
- `planner.test.ts` — the invariant suite looping `GOAL_PRESETS × SPLITS × days` (skip
  custom split for lint assertions; assert passthrough instead), plus existing tests: the
  suite's current exact-value assertions (sets/reps from SCHEMES) WILL need updating to the
  fitted values — update with hand-derived numbers and comments, never by pasting observed
  output blindly (derive at least the PPL-5 hypertrophy case fully by hand; spot-check
  others against the invariants).
- Full gate both modes + train.md + lint-docs. `MesocyclePlannerPage.test.tsx` re-run (it
  renders generated output — its `1 gyakorlat` regex and custom-split tests should hold;
  update only if a fitted number leaks into an assertion).

## Non-goals

- No exercise-catalog-driven selection (templates keep their movement lists).
- No user-facing fitter controls; no persistence/API change.
- No RIR reassignment (budget styles stay scheme-driven).
- Deload/phase-curve week scaling (the fitter fits week-1; in-cycle progression is the
  landmark engine's job, spec D4).

## Amendment (2026-08-07, after invariant-suite findings — approved by Daniel)

The first invariant run proved the original "lint === [] everywhere" goal partly wrong:
several lint findings encode SPLIT-INHERENT trade-offs (1× leg frequency on 3-day
Upper/Lower; sport-split leg frequency) that the user's split choice causes and the lint
exists to surface — hiding them would be dishonest. Others were TEMPLATE defects (single
calf/biceps movement names, missing Full-body B-variant list, strength scheme 5 sets vs the
2–4 band, MEV-unreachable slot structures). Resolution:

1. **Template curation (planner.ts data):** distinct variant names where a movement repeats
   (Standing/Seated Calf Raise), a real `Full · B` exercise list, `SCHEMES.strength.compound.sets`
   5 → 4, a second biceps slot where the split can host it (PPL Pull B, Upper B), a second
   glute slot on Legs days. Curation is normal template maintenance; movement lists remain
   hand-curated (still no catalog-driven selection).
2. **Calibrated invariants:** fitter-addressable rule families (`rep-zone`,
   `sets-per-exercise`, `session-size`, `session-length`, `exercises-per-muscle`) must be
   clean EVERYWHERE; `budget ≤ 1.0` everywhere; `sets ≥ MEV` OR every slot saturated at its
   kind cap with the combo+group in `MEV_ALLOWED` (arithmetic comment required);
   split-inherent `frequency`/`variety`/`push-pull`/`ham-quad` findings go to a
   `STRUCTURAL_ALLOWED` list keyed per combo+rule with a comment naming the trade-off —
   these stay visible to users by design. Soft ceiling `NEAR_ALLOWED` unchanged.
