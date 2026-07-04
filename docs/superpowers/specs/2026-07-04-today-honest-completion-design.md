# Today honest completion — design (Slice T, `mezo-t16y.3`)

> **Point-in-time design artifact** (2026-07-04) for the Phase-2 roadmap slice
> [`2026-07-04-phase2-completion-roadmap.md` §T](../plans/2026-07-04-phase2-completion-roadmap.md).
> Living reference: [`docs/features/today.md`](../../features/today.md).

## Goal

The landing screen (`/today`) shows **only real data in real mode** — every section is either
backend-backed, deterministically composed from existing real reads (`buildDayPlan` precedent), or an
explicit honest state. Mock mode stays byte-identical (parity + component tests untouched). **Near-zero
new backend**: the check-in `GET` already exists in the contract (`listCheckInsForDay`) — this slice is
FE-only.

## Per-section decisions

| Section | Real-mode source | Honest state when empty |
|---|---|---|
| `DateMesoHeader` | real date (HU weekday + `huMonthDay`), `useTrain().workout?.title`, active meso `currentWeek`/`phaseCurve[currentWeek-1]`/`title`; `dayInWeek` = ISO weekday (Mon=1) | chips/suffix hidden when no active meso / no session |
| `WorkoutTeaser` | `useTrain().workout` (today's planned session); eyebrow time from `gymSchedule.weeklyTimes[today].time` | whole teaser hidden when no planned session; niggle banner only when `workout.niggleWarning` exists (real: never — proactive epic); fabricated "Prediction · 0.72" row becomes a data prop → hidden in real mode |
| `VolleyballCard` | `useTrain().sport.schedule.volleyball.sessions` (real `today:true` derived from weekday) | hidden when no session today (existing behavior); the hardcoded "Stacked day" AI note becomes a data prop → mock keeps the demo copy, real hides it; title drops the hardcoded club (`Röplabda`, court stays in the subtitle) |
| `QuickStatsRow` | new `useQuickStats()`: sleep = `useSleep().lastNight.duration` (delta vs previous night), weight = `useWeight().weightLog` last value (delta vs previous) | **HRV cell dropped in real mode** (no data source — strip philosophy); missing sleep/weight → `—` value, empty delta |
| Check-in strip | `useCheckins` gains the **read path**: `GET /api/biometrics/checkin?date=today` overlays 4 fixed slots | slot without a server row derives from wall-clock: past window → `skipped`, current window → `now`, future → `pending` |
| `InsightsTeaser` | new `useInsightsTeaser()`: top `proposed` pattern from the real `usePatterns()` (fallback: first pattern); card navigates to `/insights` | hidden when none/degraded; `confidence` absent → „tanulom" eyebrow (patterns precedent) |
| `BriefingCard` | prose **stays static** (generated briefing = proactive epic) | real mode replaces the fabricated "Confidence 88%" with an honest **„Demo tartalom"** label (decision: label, not trim — the card is the screen's anchor) |
| `RetaPhaseSection`, `useTodayScenario` | already real (`useMedication().cycle`, mezo-d94); `?day=/?niggle=/?vulnerable=/?retaDay=` URL demo params **survive in real mode** (documented dev affordance) | — |
| `FuelTimelinePreview` | already real (`useFuelPreview` → dual-mode `useFuelTimeline`, mezo-9ys) | — |

## Check-in read-model (in-slice decision)

4 fixed canonical slots (`06:30 · 10:00 · 14:00 · 20:00`). Server rows (matched by `slotTime`)
overlay state/values/note/savedAt. A slot with no row derives its state from local wall-clock:
current window (slot time ≤ now < next slot time) → `now`; past → `skipped` (honest missed, renders
`—`); future → `pending`. Local optimistic overrides stay on top (existing save flow); the save
invalidates the day query. Mock mode keeps `initialCheckins` untouched.

## Out / deferred (unchanged from the roadmap)

Generated briefing prose, AnchorMode from real signals, real `vulnerable`/`niggle` sources,
predictions engine (all → proactive epic); QuickInputSheet re-mount (own decision later);
`useProfile`/`user` statics (slice E's decision — Today only renders meso-derived user fields, which
go real here).

## Hook-signature stability

`useToday()` keeps `{ today, user, briefing, workout, volleyballSessions, fuelToday }` and gains
additive fields: `briefingDemo: boolean`, `workoutTime: string | null`,
`prediction: WorkoutPrediction | null`, `volleyballNote: string | null`. `workout` widens to
`Workout | WorkoutPlan | null` (real mode serves the Train plan; `null` = rest day → teaser hidden).
`useCheckins()` keeps `{ checkins, saveCheckIn }`. New hooks: `useQuickStats()`, `useInsightsTeaser()`
(exported via the `data/hooks.ts` barrel).
