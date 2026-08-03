# Active workout — exercise context + visual refresh (mezo-8xmf)

- **Date:** 2026-08-03
- **Driving issue:** mezo-8xmf
- **Status:** approved (Daniel: variant B → v2 structured card → v4 table set-list; "na ez tetszik! mehetünk")
- **Binding mockups:** [`assets/2026-08-03-workout-card-mockup.html`](assets/2026-08-03-workout-card-mockup.html) (execution card v2) · [`assets/2026-08-03-workout-setlist-mockup.html`](assets/2026-08-03-workout-setlist-mockup.html) (set list v4)
- **Research base:** `docs/research/concepts/set-volume-landmarks.md`, `docs/research/queries/2026-08-03-warmup-protocol.md`

## Problem

`ActiveWorkoutPage`'s execution card shows only muscle + name + last-week line; the plan's rich
context (failure/volume style, rep RANGE, target RIR, type, warm-up %) never reaches the lifter,
and the surface is visually dry (white cards, coral-only accents). All required data is already on
`LoggedWorkoutExercise` (muscle, type, repMin/repMax, targetRIR, prescribedSets, lastWeek,
progression) — **render-only change, no API/data work**.

## Design (binding = the two mockups; key rules)

### Execution card (v2)

- **Muscle-family theming** per exercise via `muscleColor(ex.muscle)`: card
  `linear-gradient(180deg, <fam.wash-equivalent> 0%, var(--surface-1) ~50%)` + 5px left rail
  (`fam.rail`) + radial glow top-right; the CTA (`Szett kész ✓`), active RIR pill, and current
  set-dot glow all take the family color (wash/deep pairs; contrast text `var(--text-inverse)`).
  The card re-themes on every exercise change.
- **Session progress bar** under the header: one segment per exercise, flex-weighted by its
  planned set count, colored by that exercise's family; opacity 1 = done, 0.45 = current,
  0.25 = upcoming.
- **Structured zones** (order): ① eyebrow `{idx}/{n} · {izomlabel} · {type}` + name;
  ② **stat-strip** — 3 labeled cells with dividers: `Stílus` (🔥 Failure coral-deep / 🌿 Volume
  sage-deep from `setStyle(targetRIR)` + RIR number), `Rep-cél` (`repMin–repMax` mono),
  `Szett` (`done/working` mono); ③ **múlt+javaslat subrow** (top border): left `múlt héten:
  {w} kg × {r} @{rir}` mono, right `↗ ma: {targetW} kg` sage when progression suggests;
  ④ set-dots (B-dots amber; working dots family color; current glow) + mono note for the last
  warmup: `B1 = {pct}% · {kg} ✓` where `pct = round(warmupTarget / firstWorkingTarget × 100)`;
  ⑤ steppers ~25% smaller than today (value ≈21px, buttons ≈29px); ⑥ RIR row: fixed-width small
  pills + inline right hint — failure: `🔥 bukásig!` (amber-deep), volume: `🌿 hagyj 2 rep
  tartalékot` — hidden on warmup sets (RIR row already hidden there).

### Set list (v4 — strict table)

- **Exercise-level constants appear ONCE**: list header row = eyebrow `Szettek` + right target
  pill `cél: {repMin}–{repMax} rep · RIR {t} {🔥|🌿}` (family wash/deep).
- **Real table**: header `SZETT · KG · ISM · RIR · (status)`; fixed column widths; mono numerals
  right-aligned. Rows: marker circle (B-n amber filled / working family-filled / current outlined
  +glow / pending plain); pending rows ghost-colored with TARGET values (`{w}` and `{repMin}–{repMax}`).
- **Status column**: `✓` sage when logged reps within `[repMin, repMax]`; `▼ cél alatt` /
  `▲ cél felett` amber-deep when outside; `MOST ↑` (family deep) on the current row; warmups: ✓
  when logged. Row washes: warmup rows faint amber; current row faint family wash.
- **Footer** (3 divided cells): `Volumen` = Σ(weight×reps) of logged sets (mono, kg);
  `vs múlt hét` = top-set weight delta vs `lastWeek.weightKg` as ±% (sage/amber; cell hidden or
  `–` when no lastWeek); `Átl. RIR` = mean logged working RIR (1 decimal).
- **Interaction unchanged**: row tap opens the existing `SetEditSheet`; no new gestures.

## Scope & constraints

- FE-only: `ActiveWorkoutPage.tsx` (+test), `prototype.css` (`.excard`/set-list/stepper/RIR
  class families + any new classes), optionally `SetStepper.tsx` sizing (+test). New pure helpers
  (status/tonnage/pct) colocated in `features/train/logic/` if nontrivial.
- Tokens only; `setStyle` from `@/features/train/logic/setBudget`; `muscleColor` families. But
  note `muscleColor` returns css-var refs (`fam.wash`/`fam.deep`) — usable directly in inline
  styles/gradients.
- Prep/summary phases, workoutState model, hooks, API: untouched.
- Both test modes + build green; `ActiveWorkoutPage.test.tsx` assertions updated for the new
  structure (adapted, not weakened — keep mutation evidence: logging a set still flows).
- test-visual goldens WILL move (this is a deliberate redesign) — regenerate per ship-flow memory
  (linux via workflow, darwin locally) scoped to the active-workout screens.

## Out of scope

- Prep phase & WorkoutSummary redesign; RestTimerBar; per-set rest-period hints (rest-hint idea
  from research parked); WorkoutReviewPage.
