# Optimal-zone bands in the weekly set-budget card — design

**Date:** 2026-08-03 · **Driving issue:** child of `mezo-oyhy` (guided meso building epic) ·
**Status:** approved by Daniel (brainstorm 2026-08-03)

## Context

mezo's planning-time set-budget layer (`mezo-7rdg`, spec 2026-08-01) only warns on *excess*:
over the failure/volume weekly budget (12/20 caps) and over the 11-set single-session cap.
The guided-building epic's vision is to *guide toward* the optimal plan, not just police its
ceiling. Market research (`docs/research/comparisons/plan-builder-guidance-ux.md`) shows no
app combines a live per-muscle green optimal-zone visualization with threshold warnings and
why-explanations — this child delivers the first and most visible piece: the **green
MEV→100% zone band** and the **under-volume signal** on `SetBudgetCard`.

Rule base: `docs/research/concepts/program-design-rules.md` (RP MEV/MAV/MRV rows) and
`docs/research/concepts/set-volume-landmarks.md` (the existing 12/20/11 budget model).

## Decisions (made during brainstorm, in choice order)

1. **Epic sequencing:** this child first; then structure lint → session-length estimate →
   rep-zone hint → generator upgrade; fractional counting is a decision-child (see §Non-goals).
2. **Zone model — muscle-specific MEV projected onto the existing budget-% bar.** One visual
   language (the % bar stays); the green zone's lower edge comes from the RP MEV table
   per budget group, projected into budget-% space with the group's *current style mix*:
   `zoneStartPct = budget × MEV / workingSets` (e.g. 3 volume-style ham sets = 15% budget,
   MEV 4 → green zone starts at 20%). Rejected: uniform muscle-agnostic threshold (breaks the
   per-muscle promise), separate set-count landmark scale (two parallel number systems).
3. **Visual — variant A, green zone-underlay** (mockup 2026-08-03, three variants shown):
   a translucent sage band on the track from `zoneStartPct` to 100%, the muscle-colored fill
   running over it. Rejected: threshold ticks only (zone not visible as a band), fully
   segmented Fitbod-style track (densest, departs from the current bar language).

## MEV table (per budget group)

Lower edge of the RP intermediate MEV ranges — conservative on purpose (fewer false alarms).
Single source of truth: one exported constant in `setBudget.ts`.

| group | MEV | group | MEV |
|---|---|---|---|
| chest | 4 | shoulder | 6 |
| back | 10 | biceps | 8 |
| quad | 4 | triceps | 4 |
| ham | 2 | calf | 4 |
| glute | 6 | traps, core | — (no lower bound) |

Traps/core get no under-volume signal: RP treats their MEV as ~0 (covered indirectly by
rows/deadlifts/compounds). RP calls all of these "starting points, not gospel" — the table
is data, adjustable in one place.

## Behavior

- **New `BudgetLevel: 'under'`** — a group is under when its non-plyo weekly
  `workingSets < MEV`. Raw set count comparison (MEV is a set count), not budget-%.
- Applies **only to groups present in the plan** (>0 working sets). Entirely missing muscles
  are the structure-lint child's job (frequency/balance checks), not this layer's.
- `MuscleBudgetRow` gains `mev: number | null`, `zoneStartPct: number | null`,
  `setsToZone: number` (= max(0, MEV − workingSets)).
- Plyo sets stay excluded (existing rule); all-plyo groups keep reporting but get no zone.
- **`defaultOpen` unchanged:** only over-budget/session-cap force the card open. Under-volume
  is a soft nudge, never an alarm.

## UI (`SetBudgetCard.tsx`)

- **Expanded row:** sage underlay band on the track (`zoneStartPct→100%`, ~28% opacity rail
  color); under-state renders the fill in `--text-tertiary` gray with hint line
  `↓ MEV alatt — még +N szett a zónáig`; in-zone rows get a discreet `✓ optimális zónában`
  in `--sage-deep`; over-state unchanged (coral→error gradient).
- **Collapsed pill, under-state:** gray (`--surface-2`), dashed `--text-tertiary` border,
  `↓` prefix (e.g. `Hamstring ↓15%`).
- **Under-volume explanation row** (below the bars, with the existing warning rows): neutral
  `--surface-2` background — explicitly NOT red/amber (MacroFactor principle: explain, don't
  scold). Copy pattern:
  > ↓ **{Izom}: {n} szett — a minimum-hatásos mennyiség (MEV ≈ {mev}) alatt.** Ennyi inkább
  > csak szinten tart; +{k} szett már növekedést hozna — pl. {nap}-en.
  The day suggestion reuses `leastLoadedDayFor` (least-loaded training day for the group).

## Architecture

Pure client-side derivation, mock- and real-mode identical, no backend/API/persistence
change. Touched files:

- `frontend/src/features/train/logic/setBudget.ts` — MEV constant, `'under'` level,
  row fields, projection helper
- `frontend/src/features/train/components/SetBudgetCard.tsx` — zone underlay, under pill,
  hint + explanation rows
- `frontend/src/features/train/logic/setBudget.test.ts`, `SetBudgetCard.test.tsx` — see below
- `docs/features/train.md` §4 — budget-layer description update

## Testing

- `setBudget.test.ts`: under detection at the MEV boundary (workingSets = MEV−1 / = MEV);
  zone projection math per style mix (pure volume, pure failure, mixed); plyo exclusion from
  the MEV comparison; traps/core never under; `setsToZone` values.
- `SetBudgetCard.test.tsx`: under pill rendering (↓, dashed), zone underlay present with
  correct start, hint copy, explanation row with `leastLoadedDayFor` day, defaultOpen NOT
  forced by under-only states.
- Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` + `node scripts/lint-docs.mjs`.

## Non-goals (conscious v1 boundaries)

- **Volume counting stays direct-only.** The fractional/indirect question (Helms 0.5 vs
  Ethier 1.0 per synergist set) changes every budget number and is a separate decision-child
  of the epic (ADR + UI explanation when tackled).
- **No zone on `DayBreakdownCard`:** MEV is a weekly concept; the session card keeps its
  11-set cap semantics only.
- No per-muscle user intent (prioritize/maintain/ignore à la RP) — future epic material.
- No backend persistence of landmarks; constants live in the frontend logic layer.
