# Cross-day workout start — design (mezo-p7rp)

**Date:** 2026-07-17 · **Driving issue:** `mezo-p7rp` · **Status:** approved (mockup round 2)

## Problem

The whole gym start chain is keyed to the calendar day: `GET /workouts/today` resolves the
template day by TODAY's HU weekday label only, `/train/session` is driven solely by that
response, and every FE entry point gates its start CTA on `day.current`. Thursday's missed
workout cannot be started on Friday; Saturday's cannot be pulled forward.

## Approved UX (mockup variant A, four states)

Browser mockup (round 2, four states): claude.ai artifact `40eaec9d` — GymDaySheet footer on
each non-completed gym day of the current week:

1. **Past, missed day** — amber `⚠ Elmaradt` header chip + `CtaPrimary` **„Indítsuk · ma"** +
   mono hint line („Csütörtöki terv → ma indul · Péntek jelölődik késznek").
2. **Future day pulled forward** — same CTA, no chip, hint line names the source day.
3. **Template day already completed this week (any date)** — sage `✓ Lenyomva · {dow}` chip,
   footer flips to the review CTA („Kész {dow} · Megnézem →"); no restart.
4. **Another workout open** — no start anywhere else; footer note names the running day
   („● Folyamatban: {title} — fejezd be, mielőtt másik napot indítasz"). The open day's own
   sheet offers **„Folytassuk →"**.

Today's own sheet keeps the existing `Indítsuk · most` label.

## Decisions

- **D1** Every non-completed gym day of the current week gets the CTA — past (catch-up,
  `Elmaradt` chip) and future (pull-forward, no chip).
- **D2** Done-marking stays **instance-date based**: the ✓ lands on the date you actually
  trained (Friday catch-up → Friday ✓, Thursday row stays empty). `weekDoneDates` unchanged.
- **D3** Mai-tab weekly rows stay inert for non-today days — follow-up `mezo-j3x0`.
- **D4** `getToday` becomes day-flexible (below); `completedWorkout` becomes week-scoped.
- **D5** **Once per week per template day**: a template day with a completed instance this
  Mon–Sun week (any date) is not restartable — its sheet/`/train/session` route to the review.
- **D6** **One open workout at a time**: while any instance is active, no other day can start.
  Server-enforced: the open instance always wins day resolution, and `startWorkout` 409s.

## Contract changes (`api/feature/train/train.yml`)

- `GET /api/train/workouts/today` gains an optional query param **`templateSessionId`** (uuid).
  Day resolution order (server): **open instance > param > today's weekday label**. The open
  instance always wins — a deep link to another day while a workout runs resumes the running one.
- `WorkoutTodayResponse.completedWorkout` semantic: the resolved day's most recent **completed
  instance of this Mon–Sun week** (was: dated today). Drives D5 gating + the review redirect.
- `WorkoutSummaryResponse` gains optional **`templateSessionId`** — lets the FE map
  "template day → completed instance this week" from the existing `useWeekWorkouts` list.
- `POST /workouts/start` documents two new 409s: `TRAIN_DAY_DONE_THIS_WEEK` (D5),
  `TRAIN_WORKOUT_OPEN_ELSEWHERE` (D6). Same-template open instance still resumes (200-path).

## Backend (`WorkoutService`)

- `getToday(createdBy, templateSessionId?)`:
  1. `autoCloseStale` (unchanged — after it, only today-dated instances can be active);
  2. day = template of the **global** open instance (new repo lookup, template-agnostic) —
     else the **param** template (owned, template row, else 404) — else weekday label;
  3. `completedWorkout` = day's completed instance in Mon–Sun window (new repo method).
- `startWorkout` guards (after the same-template resume branch): any other active instance →
  409 `TRAIN_WORKOUT_OPEN_ELSEWHERE`; completed instance of the template this week →
  409 `TRAIN_DAY_DONE_THIS_WEEK`.
- New `WorkoutSessionRepository` methods: global-active lookup
  (`...StatusAndTemplateSessionIdIsNotNull...`), completed-in-range lookup
  (`...TemplateSessionIdAndStatusAndDateBetween...`).

## Frontend

- `trainApi.workoutToday(templateSessionId?)`; `useTrain(opts?: { workoutDay?: string | null })`
  threads the param into the `['train','workoutToday', day]` query (prefix invalidation keeps
  working). All existing callers stay param-less.
- `ActiveWorkoutPage` reads **`/train/session?day={templateDayId}`** (useSearchParams) and
  passes it to `useTrain`. The existing completed→review redirect + resume flow then cover
  states 3/4 automatically (server-side day resolution).
- `GymDaySheet` renders the four states from new props: `openWorkout` (global, from
  `todaySession`), `openWorkoutTitle`, `completedThisWeek` (from `useWeekWorkouts` +
  `templateSessionId`). Non-today start navigates with `?day=`.
- `GymPage` builds the per-day completed map and passes the props. Mock mode: no open/completed
  state exists → every gym day renders the start CTA (mock writes still no-op).

## Out of scope

Mai-tab weekly-row entry point + rest-day hero resume (`mezo-j3x0`); starting NEXT week's days
early; multiple workouts per day (blocked by D5+D6 by design).
