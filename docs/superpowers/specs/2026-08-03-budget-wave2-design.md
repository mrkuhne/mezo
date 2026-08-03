# Set-budget wave 2 — plyo exclusion · daily breakdown · warm-up prescription

- **Date:** 2026-08-03
- **Driving issues:** mezo-0znc (plyo exclusion) · mezo-smhn (daily breakdown, variant A) · mezo-dnln (warm-up)
- **Status:** approved (Daniel: daily-card variant A + adaptive warm-up default + "mehet a roadmap")
- **Research base:** `docs/research/queries/2026-08-03-warmup-protocol.md`, `docs/research/concepts/program-design-rules.md`, `docs/research/concepts/set-volume-landmarks.md`
- **Sibling spec:** [2026-08-03-daily-session-breakdown-design.md](2026-08-03-daily-session-breakdown-design.md) (binding for the daily card's visuals; mockup asset committed)

## F1 — Plyo exclusion from the hypertrophy budget (mezo-0znc)

**Rule:** exercises with `type === 'plyo'` leave `muscleBudgets` and `sessionCapWarnings` math
entirely (they are explosive quality work, not hypertrophy volume). Their working sets surface
separately:

- `MuscleBudgetRow` gains `plyoSets: number` (sets excluded for that group).
- `SetBudgetCard` expanded rows append a neutral `+n plyo` suffix to the mono value when
  `plyoSets > 0` (collapsed pills unchanged — percent only).
- The daily breakdown card (F2) shows the same suffix on its rows.
- Live effect on Daniel's plan: quad 19→9 (75%, green), calf 10→8, Dead Hang's 10 back-wide sets
  drop out (typed plyo); the 45° Back Extension (isolation, back-lower, 10 sets/week) **stays
  counted** — decided with Daniel; a future "prehab" flag may join, out of scope now.

## F2 — Daily per-muscle session breakdown (mezo-smhn, variant A)

Per the sibling spec, binding: dedicated "Ma · izmonként" card between `MesoEditorHero` and
`SetBudgetCard` for the active day — per-group rows (rail, `n / 11` mono, mini bar with marked cap
line at 11, over rows error-colored), amber warning line naming the least-loaded compatible
training day to move sets to, and a faint `var(--error)` border on exercise rows feeding an
over-cap group. New pure helper `daySessionBreakdown(day: MesoDay): { group, label, colorMuscle,
sets, plyoSets, over }[]` in `setBudget.ts` (plyo excluded per F1). "Least-loaded compatible day" =
the training day (non-off) with the fewest working sets for that group (ties → fewest total sets);
suffix the warning with `(pl. {DAY})` only when such a day exists.

## F3 — Warm-up prescription (mezo-dnln, adaptive)

### Execution side (backend — the ramp engine already exists)

`SetRecommendationService` already emits warmup `PrescribedSet`s from `HypertrophyProperties.warmupRamp`
(currently a single 2-entry list, `Math.min` index-clamped). Change to **count-keyed ladders**:

- `mezo.hypertrophy.warmup-ladders` — map from warmup-set count (1..3) to a ramp list:
  - `1: [{pct: 0.70, reps: 4}]` (feeder)
  - `2: [{pct: 0.50, reps: 8}, {pct: 0.75, reps: 3}]`
  - `3: [{pct: 0.50, reps: 8}, {pct: 0.70, reps: 4}, {pct: 0.90, reps: 2}]`
  - counts > 3 reuse the 3-ladder, extra sets repeat its first entry (ramp stays ascending).
- Ramp entries switch from `repsFactor` (× repMax — gives silly 15-rep warm-ups at high repMax) to
  **absolute `reps`** per the research (8 → 4-5 → 1-3).
- Weight = `pct × base`, existing `roundClamp` (2.5 kg) keeps rounding; null base keeps emitting
  weight-less rows (existing behavior).
- Old `warmup-ramp` key is replaced (config + `HypertrophyProperties` record + validation);
  Liquibase untouched (config-only), contract untouched (`PrescribedSet` shape unchanged).

### Planning side (frontend — adaptive warmupSets suggestion)

New pure helper `suggestedWarmupSets(day: MesoDay, exId: string): number` in
`features/train/logic/warmupSuggest.ts`:

- exercise is `plyo` or bodyweight-ish (no anchor and repMax ≥ 15) → **0**
- first `compound` for its budget-group in the day's order → **3** (2 when `anchorWeightKg`
  known and < 60) — "first" counts only non-plyo exercises
- later `compound` of an already-hit group → **1**
- `isolation` whose group was already hit earlier that day → **0**; isolation that OPENS its
  group → **1**
- `libraryToGymExercise` keeps `warmupSets: 2` as the neutral DB default; `MesoEditor`'s add path
  overrides it with the suggestion at insert time; the accordion's Bemelegítő stepper shows a small
  `↺ javaslat: n` affordance when the manual value differs (tap → apply suggestion).

## Out of scope

- Prehab flag / Back Extension reclassification (noted in F1).
- The guided-building epic's zones/lint (mezo-oyhy) — next wave.
- Any workout-logging UI change beyond what the backend ladder change produces automatically.

## Testing

- FE: `setBudget` plyo-exclusion cases (mixed plyo+hypertrophy group; plyo-only group emits no
  budget row but daily row shows plyoSets), `daySessionBreakdown`, `warmupSuggest` (all branch
  rules), `DayBreakdownCard` states, MesoEditor integration (card renders, row highlight,
  add-path warmup override); both modes + build.
- BE (focused only): `SetRecommendationServiceIT` warm-up cases — count 1/2/3 ladders, pct math +
  rounding, absolute reps, >3 repeat rule, null-base rows. Full suite stays CI's job.
- Docs: train.md §4 (budget: plyo exclusion + daily breakdown), §4.4/recommendation (new ladder),
  file map; lint-docs.
