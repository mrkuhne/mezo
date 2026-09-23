# A napom: live day view, overnight close, own tab

**Date:** 2026-09-24 · **Status:** approved design (owner, 2026-09-24) · **Prototype:**
[`docs/design_2.0/prototypes/uveg-napod.html`](../../design_2.0/prototypes/uveg-napod.html)
(https://claude.ai/artifact/P4JxxR4tZx5WtDaBYPChbZ, v2: placement **C**, layout **2**)

## Problem

The day page behind the header's day orb (`/me/week/napok/:date`, `WeekDayPage`) reads as
scattered. The owner wants it to become a central surface of the app:

1. **Layout.** `BoopNavigation`'s "Összes funkció / Heti" rows sit on top of it. The `DayCells`
   strip at the bottom collides with the FAB. Mozaik light-wash rules on a dark app.
2. **A past day is empty until opened.** Its prose is generated lazily on the first GET, a
   synchronous LLM call ("számolom · az értékelés készül").
3. **Today is not live.** No logging mutation invalidates `['dayEvaluation', …]` or
   `['meWeek', …]`. The page refreshes only on remount or window focus after the 30 s
   `staleTime`.
4. **Hard to reach.** The only ways in are the header orb, a Heti tile and `BoopNavigation`.

## Owner decisions (2026-09-24)

| Question | Decision |
| --- | --- |
| Where does the day view live? | **Its own bottom tab, "A napom", in the Nap domain, replacing the Napzárás tab** |
| When is a day closed? | **Overnight, ~03:00 Europe/Budapest.** A later log for that day triggers one re-write of the review |
| Morning vs. daytime | **Morning shows yesterday's review first (until seen), then today live** |
| Day page layout | **Segmented ring + one-line reading + "most érdemes" card + six dimension rows (variant 2)** |
| Live updates | Immediately after any log, plus a 60 s refresh while the page is open (decided by the agent) |

The Napzárás ritual itself is unchanged. It stays reachable from the evening Rutin row
(`habitAction.ts`), from the Mai next-step logic (`nextStep.ts`), from the page index, and from
the day view's evening "most érdemes" card.

## Design

### 1. Overnight close (backend, invisible)

- **`DayReviewWarmupJob`** in `feature/companion/service`, modelled on `DailySummaryJob`:
  - Cron `${mezo.companion.day-review-warmup.cron:0 0 3 * * *}`.
  - `@ConditionalOnProperty` on `COMPANION_SWITCH`, `DAY_REVIEW_SWITCH` and a new
    `mezo.techcore.cron.day-review-warmup.enabled` switch (constant in `FeaturesConfiguration`).
  - Runs `userFanOut.forEachActiveUser`. For each user it calls `DayReviewService.assemble(user,
    d)` for `d` in yesterday and the 2 days before (a catch-up window, not configurable yet),
    with try/catch around each user × date pair.
- `assemble` already hashes the day's dimensions and facts and upserts `day_review` on a miss.
  Pre-warming therefore needs **no new persistence**. The morning GET is a zero-LLM cache hit.
- **A late log re-writes the review.** It changes the hash. The next read, or the next night's
  catch-up window, regenerates the review exactly once. This is the owner's "egyszer újraírjuk".
- **Budget.** Add `day_review` to the LLM budget `throttled-features` list. The slug must match
  `LlmCallContext`'s first argument exactly.
- **Ordering.** 03:00 runs after the post-midnight chain (quest 00:05, habit 00:10, life-goal
  00:20) that writes XP and habit completions into `DayInputs`, and before graph (03:20) and
  reflection (03:40). The scheduler pool is 4.
- **States already exist.** `scored` / `thin` / `empty` / `future` / `in_progress` stay as they
  are. `thin` and `empty` render the honest "kevés az adat" page instead of an empty shell.
- Fix the stale javadocs at `DayReviewService.java:172-184` (the `logging` NO_DATA note and the
  "no live day page" note).

### 2. "A napom" tab and route (frontend)

- `navModel.ts`, Nap domain: tab 2 becomes `{ label: 'A napom', route: '/nap/napom', icon: 'i-heti' }`. The order is Mai · A napom · Beszélgetés · Rutin, and Napzárás leaves
  the bar. The domain keeps exactly four tabs.
- Routes: `/nap/napom` shows today, `/nap/napom/:date` shows a given day. `/me/week/napok/:date`
  redirects to `/nap/napom/:date` so push deep links and Heti tiles keep working. The Heti hub
  and the days mosaic stay under Én and link to the new route.
- The header day orb navigates to `/nap/napom`.
- **Morning mode.** Morning mode is on when yesterday's evaluation is `scored` and carries a
  `reviewId`, and the user has not opened it yet (a per-device `localStorage` key
  `napom.seen.<date>`, read and written inside try/catch). In morning mode:
  - the tab shows a lavender dot;
  - `/nap/napom` opens on yesterday;
  - the closed-day page ends with a "Tovább a mai napra ›" card.

  Opening yesterday marks it seen. Morning mode lasts for the current calendar day only.
- `BoopNavigation`'s `/me/week` content rows no longer appear on this page, because the page
  now lives under `/nap`.

### 3. The day page (üveg re-dress, variant 2)

This page is taken **out of U6's scope** (`mezo-me75u.6` lists `me/week/napok(+/:date)`). Record
that on U6. The page follows the üveg bible: rose/coral accents, a frameless halo hero, glass
rows, dashed rows for empty or open dimensions, no glass inside glass, Titanium 3D icons, and
reduced-motion branches.

From top to bottom:

1. **Header row and week strip.** The "A NAPOM" eyebrow and the week range, then a 7-day strip
   (H…V). Each day carries a state mark (scored = lavender→gold, thin = dashed, today = coral,
   future = dimmed). Tapping a day opens it. This replaces "‹ Napok" and `DayCells`.
2. **Hero.** Day name and date, a status line ("ÉLŐ · FRISSÜLT hh:mm" for today, "LEZÁRVA ·
   HAJNALI 3:04" for a closed day), and a **six-segment ring**, one segment per engine dimension
   in its accent, filled by that dimension's progress or sub-score.
   - Today's centre reads `N/6 · TERÜLET KÉSZ`. An open day never gets an overall number.
   - A closed day's centre shows the score as a gradient numeral with its label, plus
     "alap X · a Mezo szerint ±Y".
3. **Today only:**
   - **The reading.** One upright Geist sentence (no italic, see below), built by a pure rule function
     `dayReading(dims, now)`, never by an LLM. Example: "Fehérjéből már csak 18 g hiányzik, az
     edzés még hátravan." Below it: "Napközben nincs pontszám…".
   - **The "most érdemes" card.** A pure `nextBestAction(dims, now)` that returns one
     glass card with a CTA: the planned workout, then an evening check-in, then Napzárás.
4. **Closed day only.** The **Mezo jegyzete** card: the existing `DayReviewCard` prose and
   feedback vote, re-dressed. The line "Ha utólag beírsz még valamit…, egyszer újraírom" sits
   below the rows.
5. **The six dimension rows.** Each row has a lit well with a 3D icon, the label, a one-line
   fact (for example "2 060 / 2 782 kcal · fehérje 148 / 166 g"), a bar (nutrition also gets a
   goal tick), and at the end a big value plus a status word (ÚTON / KÉSZ / NYITVA).
   - Open or no-data rows are dashed.
   - Icon and colour: Tápanyag `t-bowl`/sage, Minőség `t-sprout`/amber, Edzés
     `t-dumbbell`/coral, Alvás `t-sleep`/lavender, Logolás `t-checkin`/sky, Ritmus
     `t-chain`/rose.
6. **Thin or empty day.** A dashed "Erre a napra kevés az adat" card with the existing
   `DAY_COPY` text. Rows with data stay glass; the others are dashed "nincs adat" rows.
7. **Bottom clearance.** The last element clears both the FAB and the floating tab bar
   (`--screen-bottom-pad`, bible rule 9).

### 4. Live today (frontend)

- **Invalidate on log.** Every logging mutation that feeds `DayInputs` also invalidates
  `['dayEvaluation', today]` and `['meWeek', mondayOf(today)]`. That covers fuel meal and quick
  log, workout finish and sport log, check-in, sleep, weight, water and habit ticks. Use one
  shared helper (`invalidateTodayDay(queryClient)`) so the list lives in one place.
- **Poll while open.** `useDayEvaluation` gets `refetchInterval: 60_000` for today only, in
  real mode only (the precedent is `feedHooks.ts:45`). Mock mode keeps `staleTime: Infinity`.
- **"Frissült hh:mm".** This is the query's `dataUpdatedAt`. When a value changes on refetch,
  its row gets a one-shot coral pulse, with a reduced-motion branch.
- The header orb's tone reads the same query, so it becomes live too.

### 5. Closed day: every review layer, upright type

- **Owner decision (2026-09-24): no italic serif for Mezo's text.** The Fraunces italic "voice
  copy" (üveg bible §5) is unreadable at paragraph length. All Mezo prose on this page (the
  reading, the narrative, the dimension notes) is upright Geist: 15px/1.6 for the narrative,
  14px/1.55 for notes. Record this in the üveg bible appendix as a slice lesson.
- The closed-day page shows **every `DayReviewJson` layer** (prototype v3):
  - `adjustment`: a "alap X · a Mezo szerint ±Y ▾" pill under the ring. Tapping it expands the
    reason.
  - `narrative` + `highlights` (key / pattern / win as flat cells, not glass) + the feedback vote
    ("Segített?") + "Beszélgess a napról ›" in the "Mezo · a napodról" card.
  - `dimensionNotes`: the six "Miből jött össze" rows show score, weight % and the fact line.
    Tapping a row expands its metric chips and the note, so six notes never render at once.
  - `context`: flat chips under "A nap körülményei · nem számít a pontba".
- **Warmer voice, approved by the owner (2026-09-24).** The review prompt is rewritten to the
  prototype's "Emberibb hang": the same facts, told shorter and plainer, in second person.
  - No passive bureaucratic phrasing ("került rögzítésre"), no engine vocabulary (base, nova,
    dimenzió, Q7, "kontextus").
  - Numbers stay but are rounded and humanised ("4 g-mal maradt el a céltól").
  - The narrative is at most 2 short paragraphs: what went well, then the one thing to change
    today.
  - Notes are one or two sentences each; the adjustment reason is one sentence in the first
    person ("Levontam 2 pontot, mert…"); highlights are plain phrases.
  - This is a prompt-only change. The envelope shape is unchanged, the model tier is
    unchanged, and cached reviews regenerate only on their next hash miss.

## Out of scope

- The Heti hub, the days mosaic and the weekly score (they only get the new link target).
- Napzárás semantics. `closed` stays calendar-based (`date < today`).
- Push notifications for the morning recap.
- Light mode.

## Testing

- **Backend.**
  - `DayReviewWarmupJobIT` calls `run()` directly (scheduling is off in tests). It checks that
    one LLM call fills `day_review` for yesterday, that a second run makes no call (hash hit),
    that a late log makes exactly one re-write, and that a failure for one user does not stop
    the others.
  - `DayReviewWarmupJobSwitchOffIT` covers the switch.
  - Run the full suite with `-Dmezo.test.use-testcontainers=true` and regenerate CODEMAP.
- **Frontend unit.** Cover `dayReading`, `nextBestAction` and the morning-mode predicate across
  the time-of-day boundaries, and the invalidation helper's key list.
- **Frontend component.**
  - The day page in all five states (today, scored, thin, empty, future) and with the tab dot.
  - Nav: four Nap tabs, A napom active on `/nap/napom/*`, and the redirect from
    `/me/week/napok/:date`.
  - The orb-tone test layers (`today.md:233-236`, `AppHeader.dayOrbTone.test.tsx`) still pass.
- **Both modes.** Run with `VITE_USE_MOCK=false` explicitly for the polling and invalidation
  paths.
- **Layout.** `tests/layout` at 320 px: no sideways scroll, and the last row sits above the
  bar and the FAB.

## Slices

1. **Overnight close** (backend only). The job, the switch, the budget slug and the javadoc
   fixes. It ships first and removes "számolom" on its own.
2. **A napom tab and day page re-dress.** Routes, nav, redirect, morning mode and the variant-2
   page.
3. **Live today.** The invalidation helper wired into the logging mutations, polling and the
   pulse.
4. **Warmer review voice.** Rewrite the `DayReviewLlm` prompt with golden examples from the
   prototype, plus a prompt test that bans the listed phrases.

## Prior art

Source: researcher recon report, 2026-09-24.

- **WHOOP, two clocks.** Strain is recalculated live all day; recovery is scored once at wake
  and then fixed. Each cycle carries a `SCORED` / `PENDING_SCORE` / `UNSCORABLE` status. We
  **adopt** the split: today is rule-based and live, and the close is written once, re-opened
  only by an edit. Our existing `scored` / `thin` / `empty` states already give the honest
  "unscorable" page. We **reject** a waking-to-waking day, because logs are keyed by calendar
  date. https://developer.whoop.com/docs/developing/user-data/cycle/
- **Oura Today tab.** Its "one big thing" lead changes with the time of day, and it has a
  shortcut row. We **adopt** the lead as the "most érdemes" card. We **reject** a full
  timeline for v1. https://ouraring.com/blog/new-app-design/
- **Garmin Morning Report.** A recap timed to waking. We **adopt** it as morning mode: yesterday
  first until it is seen. The delayed 03:00 close follows its warning about late logging.
  https://www8.garmin.com/manuals/webhelp/GUID-EECCAC99-90D6-4AB1-9A3A-EC433D3365E2/EN-US/GUID-4D26FDDC-63BD-4910-95B8-98937FEC2545.html
- **MacroFactor dashboard.** A week strip with the day in progress outlined, and a tap opens
  any day. We **adopt** the week strip. The cheap-live versus expensive-at-close split is kept,
  so the LLM never runs on a live refresh.
  https://help.macrofactorapp.com/en/articles/22-get-to-know-your-dashboard
- **Gentler Streak.** A one-line daily message above the main visual. We **adopt** it as the
  rule-based reading. We **reject** home-screen widgets, because the app is a PWA.
  https://docs.gentler.app/understanding-your-activity-path/interpret-the-activity-path

## Codebase terrain

Source: investigator recon report, 2026-09-24.

- **Day page.**
  - Page and states: `frontend/src/features/me/pages/WeekDayPage.tsx:190-399`. The ring words
    are at :240-244, `DayChips` at :114-134, `DayCells` at :139-155 and :383.
  - Parts: `features/me/components/week/*`.
  - Logic: `features/me/logic/weekDay.ts` (`DAY_DIMENSIONS`, `dayState`, `DAY_COPY`).
  - Styles: `styles/prototype.css:~7228-7500` (`wkd-*`, `dayev-*`). This is still Mozaik
    light-wash. New rules go in a `── uveg napom (` block at the end, scoped to the page root.
- **Chrome.**
  - The orb: `app/AppHeader.tsx:65,176-181` and `shared/ui/DayOrb.tsx`, with its fill logic in
    `features/today/logic/useDayOrbFill.ts`.
  - The page wrapper: `app/AppLayout.tsx:57,80,112` (`BoopNavigation`, `QuickLogFab`).
  - `features/insights/components/BoopNavigation.tsx:8` decides when the `/me/week` rows show.
  - The tab matrix: `app/navModel.ts:42-50`, the frozen 5×4.
  - Routes: `app/router.tsx:510-511`.
- **Data.**
  - `data/me/dayEvaluationHooks.ts:33-83`: key `['dayEvaluation', date]`, deliberately not
    `useDualQuery`.
  - `data/me/meWeekHooks.ts:39-46`: `['meWeek', start]`, shared with `fuelHorizonHooks`.
  - Global defaults: `app/providers/QueryProvider.tsx`.
  - The live-poll precedent: `data/today/feedHooks.ts:45`.
- **Backend.**
  - `companion/service/DayReviewService.java`: `assemble` at :145-167, the states at :186-198,
    lazy `prose()` at :281-312.
  - `DayScoreService.inputsFor`, `DayEvaluationEngine`, and `llm/DayReviewLlmAdapter`, which
    exists only when both switches are on.
  - The job template: `companion/service/DailySummaryJob.java`. Fan-out goes through
    `auth/service/UserFanOut.forEachActiveUser`.
  - Schedules, switches and `throttled-features` are in `application.yml`.
  - Existing ITs: `DayEvaluationApiIT` and `DayEvaluationSwitchOffApiIT`.
- **Napzárás entry points without the tab:** `features/today/logic/habitAction.ts`,
  `nextStep.ts`, `todayItems.ts`, `app/pageIndex.ts`.
- **Traps.**
  - ArchUnit layers: the job goes in `service`.
  - CODEMAP must be regenerated in the same change and after every merge.
  - Contract drift: no API change is planned. If one appears, change `me-week.yml` first.
  - `VITE_USE_MOCK` unset means mock mode.
  - The orb-tone regression net has four layers.
  - `useDayOrbFill.test.tsx` mocks `useDayEvaluation`, so changing that hook's signature
    ripples into it.
  - A `.uv-halo` hero must be clipped at 320 px (`overflow-x: clip`).
  - Header chip rows must wrap.
  - `PageHead` / `PageHero` are shared across Én, Train and Fuel (rule 21). Extend them with a
    variant prop rather than copying the Nap markup a third time.
  - Open bugs: `mezo-jcpt.16` (tile "tanulom" vs. page "nincs adat") and `mezo-jcpt.18` (an
    empty review shell when prose is missing). A failed warm-up makes jcpt.18 more common, so
    the day page must hide the jegyzet card when there is no prose.
