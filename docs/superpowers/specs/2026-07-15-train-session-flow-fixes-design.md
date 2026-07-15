# Train session flow fixes — design (RIR display · free navigation · explicit finish · done-day review)

**Date:** 2026-07-15 · **bd issue:** `mezo-cd8s` · **Status:** approved (brainstorm 2026-07-15, browser mockups)

## Goal

Fix four user-reported problems in the active-workout / gym-day flow:

1. **Logged sets don't show their RIR** — the read-only set list under the execution card
   shows a ✓ icon on done rows but hides the logged RIR value.
2. **No way to browse exercises mid-workout** — the session is a linear cursor; when a
   machine is occupied you cannot jump ahead/back or even look at other exercises.
3. **No explicit "finish workout"** — the recap auto-appears only when everything is
   resolved, `finishWorkout` fires *before* the user sees the recap, and a started-then-
   abandoned workout already shows as KÉSZ (done-state = "≥1 logged set").
4. **A finished day can be restarted** — after completing today's workout the prep screen
   is reachable again ("Kezdjük el" creates a *second* instance for the same day) and
   challenges reappear; instead, a completed day should be reviewable (read-only) and the
   next start should only be next week's occurrence.

All four were designed together because they share one semantic root: **what "done" means
for a gym day**.

## Decisions (locked at brainstorm — browser mockups approved)

1. **KÉSZ = explicitly finished.** A gym day counts as done only when its workout instance
   has `status = 'completed'` (the user pressed the closing button). The `≥1 logged set`
   done-semantics is retired everywhere it is consumed: weekly done-marks, Insights weekly
   counts, quests, discipline trait, companion `get_recent_workouts`.
2. **Exercise navigation = "C" concept, pager bar placement "B".** Swipe on the execution
   card **+** a two-way pager bar under the card (extends the current one-way `Következő`
   row: `‹ Előző · name · n/m` | `Következő · name · n/m ›`) **+** a header overview list
   (tap the `n/m gyakorlat` counter → full exercise list with per-exercise status, tap to
   jump) **+** tappable header exercise-dots. **The viewed exercise is the logging
   target** — `Szett kész ✓` always logs into the exercise on screen. Chevrons must never
   overlay card content (the mid-card floating arrows of mockup v1 were rejected).
3. **Explicit finish via a summary screen.** When every exercise is resolved — or earlier
   via a new `⋯` menu row **"Edzés befejezése…"** — the session lands on a **WorkoutSummary**
   screen: day stats (sets / volume / exercises), **challenge outcomes** (megcsináltad ✓ /
   nem jött össze ◯ / skippelted ⊘), per-exercise recap (skipped struck through), optional
   note, and the primary CTA **"Edzés lezárása ✓"**. Only that CTA calls `finishWorkout`
   (level-up overlay follows it, as today). Leaving without pressing it keeps the instance
   open: the Mai hero shows **"● Folyamatban" + "Folytassuk →"** and the weekly row shows an
   in-progress mark, not KÉSZ.
4. **Stale open instances auto-close lazily.** On the next `getToday` after the workout's
   calendar day has passed: an abandoned `active` instance with ≥1 non-skipped logged set is
   closed as `completed` (its date becomes retroactively done; the logged weights feed next
   week's prescription and "múlt héten"), with 0 logged sets it becomes `skipped` (never
   done). User picked this over strict-manual-only and over an "ask me" prompt.
5. **Completed day = review, no restart.** With a completed instance for today's template
   day, the Mai hero flips to **"✓ Kész" + "Megnézem →"**, `GymDaySheet` gates its
   "Indítsuk · most" the same way, and `/train/session` redirects to the review instead of
   the prep screen. The next start is naturally next week (template days are
   weekday-bound). **Option B approved:** any completed day of the current week is
   reviewable from the weekly rows too — this needs a new workout-detail endpoint.
6. **Challenges only for the live occurrence.** Challenge generation is guarded server-side:
   no new challenges are generated for a (templateSessionId, date) whose instance is already
   completed. Existing rows still return (the review screen shows their outcomes). The
   FE gating (no prep screen on a completed day) hides the carousel anyway; the guard is the
   backend safety. Outcome evaluation needs **no change**: `ChallengeOutcomeEvaluator`
   already resolves hit/miss once the instance is `completed` (lazy, on the next challenge
   list read).

Mockups (approved, session artifacts under `.superpowers/brainstorm/53141-1784110268/content/`,
git-ignored): `exercise-nav.html` (concept C), `exercise-nav-v2.html` (pager bar B),
`finish-screen.html`, `done-day-review.html` (option B).

## Out of scope

- Editing a logged/completed workout (in-place set edit) — separate follow-up (`mezo-0p3`
  covers the sport analogue).
- A second gym session on the same calendar day (double sessions) — explicitly gated off by
  design decision 5.
- Persisting the summary screen's free-text workout note (the field stays presentational,
  as it is today; no DB home for a workout-level note).
- Rest-timer, voice tool, PR-detection engine — untouched Phase-3 items.

## 1 · Contract changes (`api/feature/train/train.yml` — contract-first)

- **`WorkoutTodayResponse` + `completedWorkout`** (nullable `WorkoutInstanceResponse`): the
  most recent `completed` instance of today's template day dated **today**. Drives the hero
  KÉSZ state, the day-sheet gating and the session-route redirect without a second fetch.
- **New endpoint `GET /api/train/workouts/{workoutId}`** → `WorkoutDetailResponse` — the
  review screen's data source (weekly rows, Mai "Megnézem"):
  - `id`, `templateSessionId`, `date`, `status`, `title` (instance `type`), `dayLabel`,
    `durationEst`
  - `exercises: WorkoutDetailExercise[]` — the template day's exercises joined with this
    instance's logged sets: `exerciseId`, `name`, `muscle`, `type`, `warmupSets`,
    `workingSets`, `repMin`, `repMax`, `targetRIR`, `skipped` (true when a skip-marker set
    exists), `sets: ExerciseSetResponse[]` (non-skipped, setIndex order).
  - Ownership: foreign/missing id or a template row (`templateSessionId == null`) → **404**
    (existing `TRAIN_WORKOUT_NOT_FOUND` semantics).
- **`weekDoneDates` semantics change** (no schema change): dates with a **completed**
  instance this week (was: ≥1 logged set). Same field, new meaning — documented in the
  fragment description.
- **`ChallengeResponse` (proactive.yml) gains the structured targets** (`targetWeightKg`,
  `targetReps`, `targetSets`, `targetRir` — optional, nullable, additive): the FE
  pre-finish outcome preview needs the numeric targets, not just the display `target`
  string. The entity already stores them; MapStruct maps by name.
- No DDL. The `status` column and the `planned|active|completed|skipped` enum already exist.

## 2 · Backend

- **`WorkoutSessionRepository`**: switch `findDoneInstanceDates` / `findDoneInstancesBetween`
  from the "exists ≥1 non-skipped set" predicate to `status = 'completed'`. Consumers
  (QuestEvaluator, TrainingCommitmentCalculator, Insights `listWorkouts`, companion tools)
  follow automatically — this is the agreed semantic shift. `lastWeekRefs` and
  `SetRecommendationService` already read completed-only history: no change.
- **Stale auto-close** (new small service method, own `@Transactional`, invoked from
  `getToday` like the closing-block ensure): for the owner's `active` instances with
  `date < today` → ≥1 non-skipped set ⇒ `status='completed'`; none ⇒ `status='skipped'`.
  Idempotent; after it runs, at most today's instance can be `active`, so `openWorkout`
  can never resurrect last week's abandoned session.
- **`getToday`**: after auto-close, also resolve `completedWorkout` (most recent completed
  instance of today's template day with `date = today`).
- **`getWorkoutDetail(createdBy, workoutId)`**: instance lookup (owned, instance-only) →
  template-day exercises (`findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc` on the
  instance's `templateSessionId`) → sets grouped per exercise; skip-markers set the
  `skipped` flag and are excluded from `sets`. Pure read, no `@Transactional`.
- **`ProactiveChallengeService.getChallenges`**: extend the lazy-generation condition —
  generate only when `rows.isEmpty() && date == today` **and** the day's instance is not
  completed (reuse the evaluator's instance lookup). One guard, no new endpoint.
- **`ChallengeOutcomeEvaluator` micro-fix**: when the instance is `completed` but the
  challenge's exercise has zero logged sets, resolve to `inconclusive` immediately instead
  of waiting for the day to pass (today the `logged.isEmpty() && !dayPassed` branch leaves
  it accepted, which would show a stale "accepted" state on the post-finish summary).

## 3 · Frontend — session model & navigation

- **`workoutState.ts`**: free navigation support, staying pure.
  - `completeSet(s, id, set)` — appends to the *given* exercise (the viewed one), replacing
    the current-exercise-only variant; the scalar `Session.setIdx` cursor is removed, the
    per-exercise cursor is derived: `nextSetIdx(s, id) = s.logged[id]?.length ?? 0`.
  - `currentExerciseId` (first unfinished in order) stays — it seeds the initial view and
    backs `nextUnfinishedAfter(s, id)` (auto-advance target after a debrief/skip; summary
    phase when none remains).
  - `seedFromOpen`/`mergePlan`/`addExtraSet`/`skipExercise` unchanged apart from the
    removed `setIdx`.
- **`ActiveWorkoutPage`**: a `viewedId` state owns which exercise the single `.excard`
  shows; the prefill effect re-keys on `[viewedId, nextSetIdx]`. Navigation surfaces:
  - **swipe** left/right on the card (pointer-events threshold + slide transition; no new
    dependency),
  - **two-way pager bar** under the card (replaces the `Következő` row; each side shows the
    neighbour's name + `n/m` progress; ends disabled at the list edges),
  - **header overview list**: tapping the `n/m gyakorlat` counter opens a `Sheet` listing
    `session.order` with status (✓ kész / ● folyamatban `n/m` / ○ hátravan / ⊘ kihagyva),
    tap → jump,
  - **exercise-dots** become tappable (same jump).
  - Logging into the viewed exercise; the debrief (`FeedbackModal`) still fires when the
    viewed exercise's last set completes, then auto-advances to `nextUnfinishedAfter`.
  - The `⋯` sheet gains **"Edzés befejezése…"** → summary phase. Reorder/skip/add-set/note
    rows unchanged (they operate on the viewed exercise).
- **Logged-set RIR (fix 1)**: in the read-only set list, done working rows render an
  `RIR {logged}` chip (from `session.logged`), done warmup rows none. The same treatment
  appears in the review screen's per-set lines (`w×r @RIR n`).

## 4 · Frontend — summary, review, gating

- **`WorkoutSummary`** (new component, replaces `WorkoutComplete`): two modes.
  - `closing` (pre-finish): stats row (szett `done/total`, volumen, gyakorlat `done/total`),
    **Kihívások** section — accepted challenges get an FE-computed preview outcome via a new
    pure `logic/challengeOutcome.ts` mirroring the evaluator's rules (PR: any set ≥ target
    weight&reps · Depth: last set RIR ≤ target · Volume: set count ≥ target); dismissed ones
    show "skippelted" — per-exercise recap (skipped struck), note field, primary
    **"Edzés lezárása ✓"** + ghost "← Vissza az edzéshez".
  - `closed` (read-only): same layout, "Lezárva · {date}" eyebrow, server challenge
    outcomes, no closing CTA — used post-finish and by the review route.
  - Finish flow: CTA → `finishWorkout(workoutId)` → `onSuccess` level-up overlay (unchanged
    host) → component flips to `closed`. The old auto-finish in
    `advanceAfterFeedback`/`handleSkip` is removed — those paths now `setPhase('summary')`.
- **Review route `/train/review/:workoutId`** (sibling route, TabBar stays visible): fetches
  the new detail endpoint via `useWorkoutDetail(id)` (new hook in `data/train`, re-exported
  from `data/hooks.ts`) + `useChallenges(templateSessionId, date)` for outcomes, renders
  `WorkoutSummary closed`. Duration line derived from set `doneAt` timestamps when present,
  omitted otherwise.
- **Mai (`TrainTodayPage`) gym hero — three states:** `completedWorkout` → `✓ Kész` chip +
  summary line (set count + volume computed from `completedWorkout.sets`; close time only if
  derivable from set `doneAt` — there is no stored finish timestamp) + **"Megnézem →"**
  (navigate to review); else `openWorkout` → `● Folyamatban`
  chip + `n/m szett` + **"Folytassuk →"** (into the session); else **"Indítsuk →"**.
  `WeeklyDayRow`: a completed gym day's `kész` chip becomes tappable → review (instance id
  resolved from a week-range `listWorkouts` call, existing endpoint, small
  `useWeekWorkouts` hook); today-with-open-instance shows a `folyamatban` mark.
- **`GymDaySheet`**: `canStart` additionally requires no completed instance today; when
  completed, the footer CTA becomes "Kész · Megnézem →".
- **`ActiveWorkoutPage` guard**: `completedWorkout && !openWorkout` → `Navigate` to the
  review route (prep screen unreachable ⇒ no restart, no challenge carousel).
- **Mock mode**: keeps Phase-1 behavior (no gating — `completedWorkout` null, writes no-op,
  mock finish returns the seeded level-up). `useWorkoutDetail`/`useWeekWorkouts` get static
  fixtures so the review screen renders in mock/Playwright. Both test modes must stay green.

## 5 · Error handling

- Detail endpoint: foreign/missing/template id → 404 `TRAIN_WORKOUT_NOT_FOUND`; no new
  SystemMessage codes otherwise.
- `finishWorkout` on an already-completed instance keeps its existing behavior (409
  `TRAIN_WORKOUT_NOT_ACTIVE` path untouched); the FE disables the closing CTA while the
  mutation is pending to avoid double-fire.
- Review route with a bad id: error state + back to `/train` (standard ghost/error idiom).
- `startWorkout` keeps its resume-or-create semantics server-side — the restart gate is
  deliberately FE-level (single-user app; the session-route redirect + hero/day-sheet gating
  cover every UI path). No new 409 code.

## 6 · Testing

- **Backend ITs** (`ApiIntegrationTest` style, populators): done-semantics switch
  (active-with-sets no longer in `weekDoneDates`; completed is), stale auto-close (yesterday
  active+sets → completed; 0 sets → skipped; today's active untouched), `completedWorkout`
  in `getToday`, workout-detail endpoint (happy, 404 foreign, 404 template row, skipped
  flag), challenge generation guard (completed day generates nothing; existing rows still
  listed), evaluator zero-set completed → inconclusive.
- **Frontend**: `workoutState` unit tests (completeSet-by-id, nextUnfinishedAfter, no
  setIdx), `challengeOutcome` preview unit tests (three rules, parity with evaluator),
  `ActiveWorkoutPage` flow (jump + log into viewed exercise; summary phase before finish;
  finish CTA calls mutation once), Mai hero three states, review page render, GymDaySheet
  gating — in **both** modes (`pnpm test` + `VITE_USE_MOCK=true pnpm test`) + build.
- Visual verification by running the app (per `mezo-verify-ui-by-running-app` memory).

## 7 · Documentation obligations (same change)

- `docs/features/train.md`: §2 active-workout (navigation, summary phase, three hero
  states, review route), §4 (detail endpoint, `completedWorkout`, done-semantics), §5
  (challenge seam note), §9 as needed.
- `docs/features/proactive.md`: generation guard + evaluator micro-fix.
- `docs/features/insights.md` touch: weekly "done" counts now mean completed.
- `node scripts/lint-docs.mjs` clean.
