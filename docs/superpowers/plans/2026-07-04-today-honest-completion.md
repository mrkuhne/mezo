# Today honest completion — implementation plan (Slice T, `mezo-t16y.3`)

> Executes [`specs/2026-07-04-today-honest-completion-design.md`](../specs/2026-07-04-today-honest-completion-design.md).
> Branch `feat/today-honest-completion`. FE-only (the check-in GET already exists in the contract).

## Tasks

1. **`data/today/todayHooks.ts` — dual-mode `useToday` + new hooks**
   - `useToday()`: mock returns the byte-identical statics; real composes `useTrain()` + real date
     (`huMonthDay`, HU full weekday) into `today`/`user`; `workout` = Train's today plan (`null` = hidden);
     additive fields `briefingDemo`, `workoutTime`, `prediction`, `volleyballNote`.
   - `useQuickStats()`: mock = the three static stats; real = sleep + weight derived, no HRV cell.
   - `useInsightsTeaser()`: mock = static demo copy; real = top proposed pattern or `null`.
   - Mock-only demo copy (`prediction`, `volleyballNote`) moves into `data/today/today.ts`.
   - Barrel: re-export the two new hooks from `data/hooks.ts`.
2. **`data/today/checkinHooks.ts` — read path**: real-mode `useQuery(['checkins', date])` →
   4-slot overlay (server rows + wall-clock derivation + local optimistic layer); save invalidates.
3. **Components** (`features/today/components/`): `WorkoutTeaser` (time/prediction props, niggle-banner
   guard on `niggleWarning`, `Workout | WorkoutPlan` prop), `VolleyballCard` (`note` prop, generic title),
   `QuickStatsRow` (renders `useQuickStats()`), `InsightsTeaser` (renders `useInsightsTeaser()`, hides on
   `null`, navigates `/insights`), `BriefingCard` (`demo` label prop), `DateMesoHeader` (nullable-safe
   chips/suffix), `TodayPage` (wiring + conditional teaser).
4. **Tests** — both modes green: extend `checkinHooks.test.tsx` (real read overlay), new
   `todayHooks.test.tsx` (real composition off the MSW train fixtures; mock byte parity), update
   component tests (mode-stubbed where output diverges).
5. **Gates + docs**: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`;
   `docs/features/today.md` rewrite of the changed sections; milestone row; `node scripts/lint-docs.mjs`;
   `--no-ff` merge; push; `bd close mezo-t16y.3`.
