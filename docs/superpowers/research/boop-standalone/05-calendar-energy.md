# 05 — Calendar + energy budgeting (mapper report)

**TL;DR**
1. Calendar integration is **iOS EventKit only** → `PUT /api/wearable/calendar-days` → table `calendar_event`. No Google Calendar anywhere (web, backend or ios). Web frontend has zero calendar code.
2. Only today + tomorrow are synced, as a per-day snapshot (hard delete + insert). **No history** — past days' calendars are gone, so no learning "how did meeting-heavy days feel".
3. **There is no AI scoring of events** (no mental load, social drain, activity score). `calendar_event` has only title/start/end/all_day/calendar_name. No classification column, no prompt.
4. Calendar is consumed by exactly one reader: `BoopDayAssembler` → busy-slot ribbon, one rule-based "workout vs last meeting" conflict, a prompt line with count/spans/busy minutes (titles deliberately never sent to the LLM).
5. The "energy curve" (`EnergyCurveModel`) is a **fixed circadian template** scaled by Forma, plus lunch-late and session tweaks. **It ignores the calendar entirely** and is explicitly "a model, not a measurement".
6. No "units / spoons / budget / capacity" concept exists in code. Closest ingredients: Forma score (0.45 sleep + 0.35 pulse + 0.20 yesterday load), check-in scales (energy, stress, mental, connection), people affect trends.
7. Proactive/companion/chat tools do not see wearable or calendar data at all (grep: only `boop` imports `feature.wearable`).
8. Core item 7 is therefore **~15% done**: the capacity side (Forma) and the calendar plumbing exist; the demand side (scoring), the comparison, the doability prediction and change suggestions are missing.
9. Production shape: 9 calendar rows (2 days: today/tomorrow), 1 boop_brief row, 61 daily_metric days, 59 sleep nights, 41 check-ins (last 2026-10-11, pre-Boop web).
10. Biggest design risk: privacy (titles) vs scoring need; and a snapshot that discards history.

## 1. Scope

Covered: calendar ingestion (ios `BoopCore/Calendar`, backend `feature/wearable`), calendar consumption (`feature/boop`), energy curve + scores (`BoopScores`, `EnergyCurveModel`, `RuleVerdicts`, `BoopVerdictWriter`/`BoopPrompts`), iOS rendering (`ios/Boop/Nap/DaySheet.swift`, `MaiPath`), check-in energy/stress/mental/connection items, people feature (social), proactive feature (reaction to calendar), companion flags with "energy" in them, and read-only prod DB shapes. Docs: `docs/features/boop-ios.md`, `docs/CODEMAP.md` (boop, wearable). Code wins; no doc/code drift found for these areas.

## 2. What exists

### Calendar ingestion
- iOS reader: `ios/BoopKit/Sources/BoopCore/Calendar/CalendarKitReader.swift` — `EKEventStore.requestFullAccessToEvents()` (l.20), `predicateForEvents(... calendars: nil)` (l.25) = **all** device calendars, read-only; `CalendarReader.swift` protocol; `CalendarSnapshotBuilder.swift` builds today + tomorrow as two `CalendarDayIn` (events overlapping a day listed on it; empty day sent empty to clear stale rows; blank title -> "(cím nélkül)", cut to 200 UTF-16 units). Calendars of Google/iCloud/Exchange appear only if the user added them to the iPhone — that is the only "Google Calendar" path.
- Triggers: foreground return (10-min debounce) and calendar-change notification (`ios/Boop/RootView.swift:54-63`, `HealthLink.calendarChanged`). Permission flow in `ios/Boop/Connect/PermissionsStep.swift`.
- Backend: `wearable/controller/WearableController.java` (`PUT /api/wearable/calendar-days`, contract `api/feature/wearable/wearable.yml`), `wearable/service/CalendarSnapshotService.java` (replace per day, caps `maxCalendarDays` <=31, `maxEventsPerDay` <=1000 via `WearableProperties`), entity `CalendarEventEntity` (`calendar_event`), repo with native hard `deleteDay` + `findByCreatedByAndDateOrderByStartAt`. Liquibase `db/changelog/1.1.0/script/202611092310_mezo-r36n9.2_wearable_tables.sql` (cols: date, title<=200, start_at, end_at, all_day, calendar_name<=80; index owner+date; no score/category columns).
- Tests: `WearableContractIT`, `WearableServiceIT` (backend), `CalendarSnapshotTests` (ios).

### Calendar consumption (boop)
- `boop/service/BoopDayAssembler.java:362-388` `calendar()` -> `BoopDay.Calendar(count, 72 quarter-hour busy flags 06:00-24:00, items{title,start,end,allDay})` (`BoopDay.java:55-97`). Zone = `mezo.wearable.zone`.
- `RuleVerdicts.conflict()` (`RuleVerdicts.java:237-258`): last timed meeting that starts before the session and ends <45 min before it → suggest meeting end + SUGGEST_AFTER_MIN rounded up to :00/:30. Pure rule; LLM never decides it. Accept/undo through `SessionTimeService` (`PUT/DELETE /api/boop/session-time`, table `workout_time_override`) — only moves the time of the day, does not touch the plan.
- `BoopPrompts.calendar()` (`BoopPrompts.java:129-140`): count + time spans + busy minutes, never titles ("titles are private and would land in the LLM log").
- `BoopBriefService.inputHash` (l.202-): count and events in the cache hash so a changed calendar regenerates.
- iOS: busy ribbon + conflict card in `DaySheet.swift` (magnifier), "Sűrű megbeszélés-sáv" breath station and "Megbeszélések · n esemény" station in `PathBuilder.swift:168-190`.

### Energy / scores
- `boop/service/BoopScores.java` — five scores: Alvás (0.7 duration/target + 0.3 quality), Pulzus (70 + (baselineRHR - RHR)*6), Mozgás (steps/goal), Fuel (kcal so far vs expected share of 07-21 span), **Forma** = 0.45 Alvás + 0.35 Pulzus + 0.20 (100 - min(60, yesterday workout minutes/2)); null until `nightsNeeded` (14) nights. No HRV (not collected), no calendar term.
- `boop/service/EnergyCurveModel.java` — 19 hourly values: anchor template {6:.35, 10-11:.82, 14-15:.38, 17-18:.66, 24:.2}, scale 0.6+0.4*forma/100 (0.8 unknown), -0.05 at 14-15 if lunch after 13:30, session hour +0.06 then -0.08, -0.08. `BoopBriefMapper.energy()` derives `dipHour` = lowest point 12-18. Invoked at `BoopBriefService.java:125`.
- `BoopVerdictWriter` + `BoopPrompts`: one cheap-tier LLM call (feature `boop_brief`) turns the numbers into Hungarian verdicts, spoken brief, tonight/next-meal tips; per-field fallback to `RuleVerdicts`; 8 s timeout. Model never scores.
- Cache/limits: `boop_brief` per user+day with input hash, 3 manual regenerations/day.

### Related ingredients elsewhere (not calendar-aware)
- Check-ins (`biometrics/checkin/service/CheckInItem.java:17-52`): energy, mood, stress, body, mental ("Fejtisztaság"), rested, soreness, pain, motivation, hunger, craving, digestion, connection ("Kapcsolódás"), day rating. These are the only subjective capacity/drain signals; web-collected only so far (Boop S4 not built).
- Flags: `companion/flags/.../EnergyDipMealTimingRule` (afternoon check-in energy vs lunch time correlation, report-only), `SustainedStressRule`, `PoorRestednessRule`, `SleepDebtRule`, `AcuteBadDayRule`, `RecoveryNeededRule`, `MotivationSlumpRule`, `LoadFuelMismatchRule` — rule engine over web data; none read the calendar or wearable tables.
- `DayEvaluationEngine` / `DayReviewService` (companion): the web day score; Boop deliberately mirrors only its sleep dimension.
- People (social): `feature/people` — mentions detected in text, `PersonAffectTrend` weekly tone arcs (1..5), person facts, chat context. **Not linked to calendar events** (no attendee ingestion — EventKit attendee data is not read). `grep` for "social battery / spoon / mental load / cognitive load" in backend finds nothing relevant.
- Proactive (`feature/proactive`): scheduled jobs (daily card, weekly review, prediction, experiments, memoir, setup-check, `PlanFeasibilityCalculator` = weight-plan feasibility, not day load). Zero calendar reaction.
- `train/service/ActivityEnergyModel` — "energy" there is kcal expenditure, unrelated to the curve.

## 3. How it works (end to end)
Phone → EventKit (all calendars, today+tomorrow, ≥ app open or calendar change) → `PUT calendar-days` (replace snapshot) → on `GET /api/boop/brief?date=` the assembler reads events, builds 72 busy flags + titled items → scores → template energy curve → rules detect session conflict → LLM only verbalises (count/spans/busy minutes, no titles) → cached payload → iOS draws ribbon over the curve, conflict card, path stations. Nothing flows back from the calendar into the numbers: the curve and scores are identical with an empty or a packed calendar (only the conflict sentence and prose change).

## 4. Quality assessment
- Solid: ingestion plumbing (caps, hard-fail oversize, ownership server-side, clears stale days), privacy stance on titles, deterministic conflict rule, brief caching/concurrency tests (7 IT + 6 unit in `feature/boop`), per-field LLM fallback.
- Half-built / misleading: the energy curve is a static template (documented as a model); the busy ribbon is drawn *next to* it, which can look like the curve reacts to meetings — it does not. Forma has no HRV, no calendar load, and only yesterday's workout minutes as load.
- Missing entirely: event scoring, history, per-event classification, units model, prediction.
- Data loss by design: past calendars are deleted by `deleteDay`/never sent; only 2 days exist in prod (9 events, one calendar). The wearable/calendar tables are read only by `boop`; AI chat/proactive cannot answer "what is my day like".
- Prod shape (counts only): `calendar_event` 9 rows / 2 dates (2026-11-10..11); `boop_brief` 1 row, 0 regenerations; `daily_metric` 61 days (steps 61, resting HR 26 — only 26 days have RHR, so the Pulzus score is often null); `sleep_log` 59; `check_in` 41 rows, 40 with energy/stress/mental, only 4 with connection, latest 2026-10-11 (web check-ins stopped at the Boop pivot — a thin training set for calibrating capacity vs check-in).

## 5. Reuse for native iOS
- As-is: `PUT /api/wearable/calendar-days`, EventKit reader/builder, `GET /api/boop/brief`, session-time endpoints, the busy-slot/magnifier UI.
- Needs Boop-shaped additions for item 7: (a) widen sync window (e.g. 7-14 days ahead, and keep past days instead of delete-only; or add a retention table), (b) send attendees count / organizer-is-me / location / recurrence / availability (EventKit exposes them) as scoring features, (c) a scoring endpoint/field and a per-event score store, (d) a "day budget" block in the brief payload.
- Logic only on web: none relevant (web has no calendar/energy-curve code). Web check-in flags/day evaluation are backend already, reusable by Boop if exposed.

## 6. Gaps vs the owner's core
- **7 (event AI scoring → units needed vs capacity → doable-day prediction + suggestions): missing** in demand scoring, comparison, prediction, suggestion; **half** on capacity (Forma exists, but it is a 0-100 readiness score, not units, and ignores HRV/stress/check-ins). Concretely missing: scoring prompt + schema, `calendar_event_score` (mental, social, physical, recovery-needed, confidence), a units conversion (e.g. Forma + sleep debt + stress -> capacity units; events + training + commute -> demand units), a day-ahead job (evening for tomorrow, morning refresh) and suggestion actions (move/shorten workout — `SessionTimeService` is the only existing actuator —, add recovery block, shift meal, decline/shift meeting as advice only since Boop is read-only on the calendar).
- **12 (AI re-examines the day live and adjusts): missing.** Today the brief regenerates when inputs hash changes (time bucket 3×/day), but it produces prose only; the single executable adjustment is the session-time move. Food/workout length/movement changes are not modelled. Web `proactive` Advice cards + `AdviceActionCatalog`/`LightenTomorrowAdapter` show a working "suggest + apply" pattern backend-side that Boop could reuse (not wired to wearable data).
- 11 (check-in snapshot of watch biomarkers): out of scope here but relevant — energy/stress/mental scales exist; no biomarker snapshot is stored with them.
- Social side of 7: people feature has tone arcs but no link to events/attendees; "social battery" would need attendee names -> person matching (EventKit gives attendee names/emails).

## 7. Open questions / risks
1. **Privacy vs scoring:** scoring needs titles/attendees; the current rule is "never titles to the LLM". Decide: on-device scoring (Apple Foundation Models), redacted features only, or explicit opt-in sending titles. LLM log would store prompts.
2. **History:** to calibrate "units" against reality (check-in energy at the end of heavy days) we need past calendars + scores; change the snapshot to append/retain.
3. **Unit calibration** without ground truth: 41 old check-ins; need S4 check-ins and a day-close rating (core 10) to fit weights; start with transparent heuristics + owner-tunable coefficients.
4. **HRV/ring/watch dependence:** Forma currently has no HRV; capacity quality depends on the watch/ring roadmap, and RHR is present on only 26/61 days.
5. **Curve honesty:** either make the curve use the day's demand (so it earns the calendar overlay) or relabel it; today it can mislead.
6. **Calendar sources:** "Google Calendar" is only reachable via the iPhone's accounts; confirm that is acceptable (no server OAuth needed).
7. Backend `boop` is a leaf module with an ArchUnit-enforced layout; a scoring service belongs in `feature/boop` (or a new `feature/dayload`) reading `wearable` repos; LLM calls must go through `CompanionLlm` + `LlmCallContext` for the log/usage tracking.
