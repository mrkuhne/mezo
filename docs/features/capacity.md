---
title: Capacity (day load vs. what the owner can carry)
type: feature-domain
status: in-progress
updated: 2026-11-25
tags: [capacity, boop, b7-kapacitas, backend, ai, calendar, energy-curve, wearable]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/capacity
  - backend/src/main/java/io/mrkuhne/mezo/feature/boop
  - backend/src/main/java/io/mrkuhne/mezo/feature/wearable
  - backend/src/main/resources/db/changelog/1.1.0/script/202611211210_mezo-r36n9.17_capacity.sql
  - api/feature/boop/boop.yml
  - api/feature/wearable/wearable.yml
  - api/feature/capacity/capacity.yml
  - ios/Boop/Nap/DayCapacity.swift
related: [boop-ios, companion, _platform-language, train]
---

# Capacity — how much the day demands vs. how much he can carry

> **2026-11-25 — reviewed after the workout-end kcal (`mezo-r36n9.170`, no capacity change).** `feature/wearable` gained `WatchWorkoutEnergyAdapter`, train's port for a gym session's watch kcal (the same `WorkoutReconciler` match the day load uses); capacity's own reads are unchanged.

> **2026-11-24 — reviewed after Boop's drink slot and gym catch-up (`mezo-r36n9.160`–`.161`, no capacity change).** `BoopDayAssembler.meals` now skips `drink` meals (Boop's meal rules see meals only); the two Liquibase changesets of the day (`meal` CHECK, `workout_session.client_ref`) touch nothing the capacity block reads.

> **2026-11-21 — reviewed after Boop B6 Évad S4 (`mezo-r36n9.16`).** The shared changelog folder gained `season_experiment` (the season's experiments); nothing in capacity changed.

> Boop B7 (epic `mezo-r36n9`, issue `mezo-r36n9.17`). **K1 "Alap" shipped on the server + phone sync: ✅ backend, 🔶 phone shows nothing yet (the verdict is drawn from K2).** **K2 Task 9 (on `feat/b7-k2`):** the morning verdict in Ma's plan card, the day page's capacity blocks and the event label (`PUT /api/capacity/event-feedback`). The rest of K2 (Évad chart, AI context), K3 (Átrendezés, `day_adjustment` readers) and K4 (outcomes, patterns, Sunday job) are not built.

## 1. Summary

Capacity answers two numbers per day: **demand** (calendar events scored for mental / social / physical load, plus the planned or logged training) and **capacity** (a personal base scaled by sleep, resting HR, HRV, yesterday's load, fuel, kímélő mode, the morning check-in). Their ratio gives a verdict word `laza | rendben | szoros | tulSok`. Everything numeric is **pure and deterministic**; the model only labels events (and may rephrase the reason line).

K1 ships: the phone sends every calendar field; a **background** model scoring of events with a rule fallback; the load model and learning state; a nullable `capacity` block on the Boop brief; the K3/K4 tables (created now, empty). Driving spec: [`2026-11-21-boop-kapacitas-design.md`](../superpowers/specs/2026-11-21-boop-kapacitas-design.md) §5.1–5.4; plan [`2026-11-21-boop-kapacitas.md`](../superpowers/plans/2026-11-21-boop-kapacitas.md) Tasks 1–6.

Feature flag: `mezo.capacity.enabled` (default true); off → the brief carries `capacity: null`.

## 2. User-facing behavior

**K2 Task 9:** Ma's open plan card (*A mai terved*) leads with the verdict row — a still orb filled by the ratio, the verdict word (*Laza nap · Rendben lesz · Szoros, de belefér · Túl sok lenne*), the reason line (+ „naptár nélkül" when the calendar is unknown) and a chevron into the day page; the folded plan line starts with the verdict word. With `capacity: null` Ma is exactly as before. The day page (`DaySheet`) takes the verdict as its title and gets, under the curve, *Mennyit bírsz ma* / *Mi visz el ma energiát* / *Amiből gazdálkodsz* (the energy curve is bent by demand since K1). A tap on a calendar row opens „Hogy hat rád?" with three chips *Merít · Semleges · Feltölt*; the choice is stored (no model call), the row shows „te: feltölt" at once and the brief reloads. Training rows carry no key and are not tappable. *Mit tennél át?* stays hidden until K3. While the learning state is on the owner will see "Még tanulom, mennyit bírsz". Handbook page: [`napi-kapacitas-atrendezes`](../boop-handbook/02-ma/napi-kapacitas-atrendezes.md).

**K2 final fix (2026-11-21):** his label comes back on the demand item (`effect` drains|neutral|feeds, null when unlabelled — carried from `EventScoringService.applyFeedback` through `EventScore.feedback` → `TimedDemand`/`DemandItem.feedback` → `BoopCapacityPort.Item.effect`), so the row still reads „te: merít / semleges / feltölt" after a relaunch and the sheet pre-selects it; the brief hash covers it. Labels reload the brief once per run of taps (`KapacitasReloadGate`: after the sheet has stayed closed 2 s, or when the page goes away), not per tap. With no server reason and no calendar the reason line reads just „naptár nélkül". The Évad *Teher és pihenés* read (`SeasonLoadService`) counts the current week's lived days only (load and recovery up to today; the rest of the week never makes it red — `SeasonLoadModel.weekRecovery` is now the sum over the lived days), and „túl sok nap az elmúlt 4 hétben" reads its own window (`today-28 .. today-1`, one batched history read from `min(season start Monday, today-28)` to today) whatever the season's age. A lone lived week's recovery is a short tick (`NKSeasonLoadChart.recoveryRuns`); the footnote says „A(z) N. hét után a terv, halványan: csak az edzés." with the article from `hungarianArticle`. The companion's capacity lines (`CapacityContextAdapter`) run `@Transactional(NOT_SUPPORTED, readOnly)`: a database fault inside them is swallowed to "" without poisoning the caller's writing transaction — so the test reset (`ResetDatabase`) now commits its TRUNCATEs on their own connection, and a test that wants the line to see its fixtures must not be `@Transactional` (`CapacityToolsIT`).

## 3. Architecture & data flow

```
phone (EventKit) → PUT /api/wearable/calendar-days → CalendarSnapshotService.replace  (upsert by external_id, soft delete)
        └ publishes CalendarDaysReplacedEvent (in tx) ─AFTER_COMMIT, @Async→ EventScoringRunner.scoreAhead(owner)
              today..today+8 → EventScoringService.scoresFor → ONE cheap-tier CompanionLlm call (45 s) → calendar_event_score (source llm | rule)

GET /api/boop/brief → BoopBriefService → BoopCapacityPort.read → BoopCapacityAdapter → CapacityDayService.day
      events (stored-or-rule score, NEVER a model call) → DemandCalculator → demand units + hourly[19]
      sleep/metrics/train/checkin/meal ports → CapacityCalculator → capacity units + factors → Verdicts.word
```

- **No model call on a request thread.** `CapacityDayService.build` reads `storedOrRule` scores only and calls `EventScoringRunner.requestIfUnscored`, which starts a background run (throttled to once per 10 min per owner) and returns at once. The first read of an unscored day shows rule scores; the next read shows the model's.
- **Single-flight per owner**: a trigger while a run is in flight flags one extra pass instead of starting a second run (the extra pass finds cached scores, so it only calls the model for events changed meanwhile). Failures are logged and swallowed; a stored `rule` row is re-asked by the next run.
- **Failure isolation**: `BoopBriefService` catches any capacity failure, logs a warning and serves the brief with `capacity: null`; the model timeout (45 s) only ever blocks the background thread.
- **Ports/adapters**: capacity reads other features only through `capacity/port/*` implemented by `capacity/service/Capacity*Adapter`; the brief reaches capacity through `BoopCapacityPort` (implemented by `BoopCapacityAdapter`). `wearable` imports nothing from capacity (it only publishes the event).
- **Load model** (spec §5.3): per event a duration-weighted sum of mental/social/physical (`RuleEventScore` when no model score); events clipped to the day's own hours (midnight-crossing events count only their hours on each day); a back-to-back block of ≥ `sequence-block-min` minutes costs ×`sequence-factor`, a gap ≥ `gap-credit-min` earns a small credit; `restores` events subtract half. Training counts as planned (type, duration), then as logged (volume/RPE). Capacity = base (28-day median of his demand on days rated ≥ 4, else his median day, else `default-base-units`) × `headroom` × the factor multipliers (sleep vs need, RHR vs baseline, HRV, yesterday's load, fuel, kímélő floor, check-in). Verdict from demand / capacity at the `verdict.*` thresholds. **Learning** (`LearningState`): fewer than `learning.min-days` full-signal days or `learning.min-labels` labelled days → `tanulo = true`.

## 4. Data model & API

**Config `mezo.capacity.*`** (`CapacityProperties`, defaults in `application.yml`): `enabled`, `verdict.laza|rendben|szoros` (0.6 / 0.9 / 1.0), `headroom` 1.25, `sequence-factor` 1.3, `sequence-block-min` 90, `gap-credit-min` 15, `learning.min-days` 14, `learning.min-labels` 5, `notes-max-chars` 2000, `default-base-units` 6.0; reserved for K3/K4: `proposals.max-per-week` 5, `live.min-interval` PT3H, `sunday.cron` (Sunday 18:00).

**Tables** (changesets `202611211200_…calendar_event_fields.sql`, `202611211210_…capacity.sql`):

| Table | Role | K1 state |
|---|---|---|
| `calendar_event` (+ `attendee_count`, `attendee_names`, `organizer_is_me`, `location`, `recurring`, `availability`, `notes`) | the phone's events, all fields | written |
| `calendar_event_score` | per event + input hash: `mental/social/physical 0–3`, `restores`, `kind`, `confidence`, `source llm\|rule` | written by the runner |
| `capacity_event_feedback` | the owner's "drains / neutral / feeds" correction per event key | written by `EventFeedbackService` (native upsert on `(created_by, event_key)`, revives a soft-deleted row) |
| `day_adjustment` | the ledger: one row per accepted step (K3) | written by `DayAdjustmentService` |
| `capacity_proposal`, `capacity_pattern` | K3/K4 proposals, patterns | proposals: status/decided_at set on accept/undo; patterns: repo only |

**Contract.** `api/feature/wearable/wearable.yml` — calendar events gain `attendeeCount`, `attendeeNames` (≤ 50), `organizerIsMe`, `location`, `recurring`, `availability` (`busy|free|tentative|unavailable`), `notes` (≤ 2000); the per-request cap is 31 days. `api/feature/boop/boop.yml` — the brief gains nullable `capacity: BoopCapacity` = `verdict`, `reason`, `ratio`, `tanulo`, `labelledDays`, `calendarKnown`, `demand[]` (`label`, `start`, `kind`, `level` kicsi/kozepes/nagy/tolt, `eventKey`, nullable `effect` drains/neutral/feeds = his stored label), `factors[]` (`key`, `label`, `value`, `effect` jo/semleges/rossz). Demand items carry `eventKey` = the calendar `external_id` without the trailing `|occurrence` (`EventScoringService.eventKey`), null for training. `api/feature/capacity/capacity.yml` — **`PUT /api/capacity/event-feedback`** (`putCapacityEventFeedback`, body `{eventKey ≤ 200, effect drains|neutral|feeds}`, 204; blank/long key or unknown effect = 400 `VALIDATION_INVALID_VALUE`). The key travels in the body, not the path: device ids carry `/` and `:` (an encoded `/` in a path is refused by the servlet firewall); the server stores it as sent (it never strips again — a device id may itself contain `|`). The label overrides the event's components at read time (`applyFeedback`). The brief's input hash covers the capacity ratio (steps of 0.05), the factors and **each demand item's key + level + label** (so a label regenerates the brief even when the day's units round the same); the demand-bent hourly energy replaces the plain curve (`EnergyCurveModel.hourly` with `capacity.hourly19()`).

**The day-adjustment ledger (K3, `DayAdjustmentService`).** The one list of this week's accepted changes; readers consult it, it never writes `gym_schedule_slot`, the mesocycle, the goal or the season. `applyBundle(owner, proposalId, clientRef)` parses the proposal's `bundle` (`{"steps":[{kind, payload}]}` — `AdjustmentDraft.toBundle/fromBundle`) into typed `AdjustmentPayload` records, validates every step, then writes all rows in one transaction with one `bundle_id` and sets the proposal `accepted` + `decided_at`. Replaying a `clientRef` returns the rows already written (step 0 carries the `clientRef`, step *i* a name-UUID derived from it — the table's unique key is per row). Not `open` → 409 `CAPACITY_PROPOSAL_STALE`. Days are the owner's (`mezo.wearable.zone`, injected `Clock`); a day *has started* when it is past, or today with its session running/done. Rules: `MOVE_SESSION_DAY` only within the from-day's Mon–Sun week (422 `CAPACITY_MOVE_OTHER_WEEK`) onto a day with no gym in the raw plan (slot or meso day label), none done, and no other live move there (422 `CAPACITY_MOVE_NOT_EMPTY_DAY`); a running template → 409 `TRAIN_DAY_WORKOUT_RUNNING` (train's rule); a past day → 409 `CAPACITY_DAY_STARTED`. `SKIP_SESSION` goes through `PlannedSkipService.upsert` (`CapacitySkipPort`) with reason `KAPACITAS` — excused like advice, never the weekly pass. `MOVE_MEAL_ENERGY` `slotKcal` = signed deltas summing to 0 (else 400). `CALENDAR_TODO` rows start `waiting`. `undo` takes back the whole live bundle (skip removed; proposal `undone`) until any of its days started (409 `CAPACITY_DAY_STARTED`; settled → 409 `CAPACITY_ADJUSTMENT_NOT_UNDOABLE`). `expireStale(owner, today)`: a live move whose target gains a planned gym before the day → `expired`; done on its new day, or its target day passed (trained or not — the re-dating stays in history) → `done`; a waiting to-do past its day → `expired`. Reads: `activeFor/activeForRange` (states `active|waiting|done`; a move counts on both days), `list` (any state). The ledger's train checks read the RAW plan through `CapacityTrainPort.gymPlanned/plannedTemplate` — a ledger-aware train reader must never feed back into them. HTTP: `GET /api/capacity/adjustments?from&to` (≤ 62 days), `DELETE /api/capacity/adjustments/{id}` (204).

**Readers honour the ledger (K3 Task 15).** An accepted change shows everywhere and never in the plan. The reader features own their ports (`train/port/TrainDayAdjustmentPort`, `meal/port/MealDayAdjustmentPort`, `season/port/SeasonAdjustmentPort`, `boop/port/BoopDayAdjustmentPort`); one capacity adapter, `LedgerReadAdapter`, implements all four and depends **only on `DayAdjustmentRepository`** — `DayAdjustmentService` reaches train's services, so the adapter must not, or `WorkoutService → port → … → train` would be a circular bean graph. Rows read: `active`, plus `done` moves (a carried-out move keeps the session on its new day, otherwise past weeks would count it missed); `undone`, `expired` and `waiting` are invisible, and calendar to-dos never touch a reader. What each reader does:
- **Train.** `WorkoutService.findPlannedTemplateForDate(owner, date)` and `getToday` use `effectiveTemplate`: a moved-in session resolves on its new day, a moved-away day is empty (so quest, readiness, proactive, companion and the brief follow too). `getToday` applies today's `LIGHTEN_SESSION` (`round(sets × factor)`, ≥ 1, after the legacy `workout_day_adjustment` delta) and `SHORTEN_SESSION` (`durationEst`). No exercise is dropped. `WorkoutWindowQueryService` (`windowsFor`, `movementBetween`) re-dates the gym slots: a moved-away day has no gym window and no pending gym (unless a workout was logged there anyway), a moved-in day takes the plan day's slot times. `SHIFT_SESSION_TIME` moves the earliest start and `SHORTEN_SESSION` the window length and pending minutes.
- **Effective planned session / days.** `train/service/EffectivePlanService` is the one helper for the read-only prose and flag readers. `plannedSession(owner, date)` returns the template, the label (the actual weekday when moved in), the plan day's slot time, the ledger time (it wins over a one-day override), shortened minutes and sets with lighten. `plannedGymDates` (and its pure static twin) gives the slot weekdays with the moves applied. Users:
  - `BoopDayAssembler` and `BoopDayContext` (the chat AI's "Ma" sessions).
  - `ContextSnapshotAssembler.dayLine`.
  - `MissedWorkoutsRule`, `MomentumAtRiskRule` and `HydrationShortfallProbe`: a moved-away day is not planned, a moved-in day is.

  `PlannedSkipService` gives a moved-in day the virtual kímélő RECOVERY skip, and a moved-away day none. `startWorkout` stamps today's weekday label on an instance of a session moved onto today. `getToday` applies today's lighten/shorten only when the resolved template is today's effective one.
- **Fuel.** No `FuelDayService` change: `pendingMovementKcal` comes from `movementOn`, so the expected extra follows the session. The target still rises only on a logged session (mezo-tb3s2). A session logged on its new day counts as *planned* there.
- **Day plan.** `DayPlanService.moveEnergy` adds each slot's `MOVE_MEAL_ENERGY` delta to that slot's first budgeted window (carbs follow at 4 kcal/g, floored at 0 g) in both `plan` and `skeleton`. The day total is unchanged. That night's `SHIFT_BEDTIME` replaces the anchor's bed time, so the last window and the bedtime gate move with it. The move applies whole or not at all: if a slot is missing or a window would go below 0 kcal, nothing changes.
- **Brief.** `BoopDayAssembler`: `bedtimeTarget` is the `SHIFT_BEDTIME` of the night starting that day. The session's planned time comes from the plan day's slot. `SHIFT_SESSION_TIME` **wins over** the older `workout_time_override` (both are read, no migration). Lines and minutes follow lighten/shorten.
- **Season.** `AdherenceService.withMoves`: the gym session leaves its old day and is planned on its new one, so it counts once.
- Deliberately unread: `SWAP_SESSION_KIND`. No reader shows a walk or mobility session instead of the gym, and the generator does not produce it. The chat context's bedtime chip still shows the sleep goal: companion cannot read boop's port. `SKIP_SESSION` needs no reader: it is a real planned skip.

### Proposals: generator, cross-effects, words (K3)

- **`ProposalGenerator.forWeek(WeekPicture, patterns, props)`** is pure. `WeekPictureService.picture(owner, monday)` reads the week: the load model's seven days, the train windows split into gym sessions (with the raw plan's template) and sport slots, the calendar, started days, whether a kímélő day touches the week, the raw-plan facts the accept rules need (raw gym days, live move targets/origins, skipped days) and the bedtime in effect per night plus the `SleepNeedRule` need.
- **Rules.** Only `szoros` / `túl sok` days, worst day first; at most `proposals.max-per-week`, ranked by relief = Σ over touched days of (ratio − `verdict.rendben`)⁺ before minus after (a matching pattern adds up to 0.1 and lends its `line` to the why lines).
  - `MOVE_SESSION_DAY` → the lightest empty, open day of the same week whose verdict stays `laza`/`rendben`, not next to a heavy session of the same region (heavy = the load model's heavy lower-body label), preferring a target that leaves ≥ 1 rest day before every sport slot; no two moves to one day.
  - No target, or a kímélő week (never adds load: any draft that raises a touched day's ratio is dropped) → `SHORTEN_SESSION` to ⅔ (5-minute steps); on a `túl sok` day shortening cannot fix → `SKIP_SESSION`.
  - `SHIFT_BEDTIME` + linked `SHIFT_SESSION_TIME`: an event ending after 21:00 and a session before 08:00 next day → bed 90 min after the event (quarter hour up), the session after 15 min falling asleep + the need + 30 min to get going; dropped when it would hit the next day's first event.
  - `MOVE_MEAL_ENERGY` (+200 lunch / −200 dinner) on a `túl sok` day with ≥ `sequence-block-min` back-to-back meetings inside 12:00–18:00.
  - `CALENDAR_TODO`: a meeting ≤ 60 min ending < 30 min before a session → one hour earlier, when that hour is free and starts at 08:00 or later.
  - Never `SWAP_SESSION_KIND` (no reader) or `LIGHTEN_SESSION` (the load model has no sets, so it relieves nothing).
  - Every draft passes `AdjustmentRules.check` — the pure accept rules `DayAdjustmentService` itself throws from (extracted in K3), with the picture as the plan view.
- **`DraftWeek.apply`** (pure) re-prices the touched days: a leaving session takes its demand item's units, an arriving or shortened one is priced by `DemandCalculator.training`; capacity stays as computed. Training items take no part in the sequence factor or gap credit, so the "after" ratio equals what `CapacityDayService` shows once the row is in the ledger (`CrossEffectCalculatorIT` checks this).
- **`CrossEffectCalculator.effects`** → `Effects`: per touched day verdict/ratio before → after and the fuel day's `pendingMovementKcal` before → after (the session's own figure from `WorkoutWindowQueryService.plannedGymKcal`, the same model and body the preview uses, moves with it); changed rest days before sport; the night's bedtime + need; week totals (gym sessions, Σ served targets + expected extras, 7 × need hours); the active season's goal target date (read via `CapacitySeasonPort.targetDate`, never recomputed).
- **`ProposalWordingWriter`**: `template(draft, effects)` builds title, from → to line, 3–4 effect lines and why lines in the spike's phrasing; the kcal line always says the extra comes with the logged session. `word(draft, effects)` lets the cheap tier rephrase title/effects/why (llm-log feature `capacity_proposal_words`, 45 s) and keeps it only if the line counts hold and every digit run is already in the template or facts (`techcore/text/DigitGuard`, shared with the brief's capacity reason). It blocks, so only background paths call it; request paths use `word(…, true)` (template only).

## 5. Integrations

| Seam | Contract |
|---|---|
| wearable → capacity | `CalendarDaysReplacedEvent(owner, dates)` published by `CalendarSnapshotService.replace`; `CapacityCalendarPort` reads events back |
| capacity → sleep / train / metrics / fuel / check-in | `CapacitySleepPort`, `CapacityTrainPort`, `CapacityMetricsPort`, `CapacityMealPort`, `CapacityCheckinPort` |
| capacity → train (write) | `CapacitySkipPort` → `PlannedSkipService` (reason `KAPACITAS`); the only write outside capacity's tables |
| boop → capacity | `BoopCapacityPort.read(owner, date)` → `capacity` block, demand-bent curve, `withCapacityReason` rule words; the verdict writer may rephrase the reason only |
| capacity → companion | `CompanionLlm` calls, llm-log features `capacity_event_score` and `capacity_proposal_words`, booked to the owner via `LlmActorContext` |
| capacity → train / fuel / season (K3 reads) | `CapacityTrainPort.plannedGymKcal` (→ `WorkoutWindowQueryService.plannedGymKcal`), `CapacityMealPort.FuelDay.pendingMovementKcal`, `CapacitySleepPort.usualBedtime`, `CapacitySeasonPort.targetDate` |
| iOS | calendar sends yesterday…today+8 with all fields — see [`boop-ios.md`](boop-ios.md) |

## 6. How to use it (consume)

Server-side only: inject `CapacityDayService` (`day(owner, date)`, `week(owner, monday)`) — never call `EventScoringService.scoresFor` from a request path. Clients read the brief's `capacity` block and must treat it as nullable.

## 7. How to extend it

K2 rest: the label as a few-shot example for the scoring model, the Évad series, an AI-context renderer. K3: proposal generator over `CapacityDayService.week`, `day_adjustment` readers in train/fuel/boop. K4: outcomes, `capacity_pattern`, the Sunday job. Contract-first (`api/feature/…`), Liquibase for schema, messages in both `messages_*.properties` (the five `CAPACITY_*` keys already exist).

## 8. Testing

Unit: `DemandCalculatorTest`, `CapacityCalculatorTest`, `RuleEventScoreTest`, `LearningStateTest`, `VerdictsTest`, `BoopCapacityAdapterTest`, `CapacityDayServiceTest`, `BoopBriefHashTest`, `BoopCapacityReasonTest`, `ProposalGeneratorTest`, `ProposalWordingWriterTest`, `EnergyCurveModelTest`. ITs (Testcontainers, `-Dmezo.test.use-testcontainers=true`): `CapacityRepositoryIT`, `EventScoringServiceIT`, `EventScoringBackgroundIT` (slow fake model: day read returns first, async upgrade, single-flight), `CapacityFeedbackIT` (label re-scores the event, replace, 400s), `DayAdjustmentServiceIT` (week/empty-day/zone/started/running rules, staleness, bundle undo, idempotent `clientRef`, skip path), `CapacityAdjustmentApiIT`, `LedgerReadersIT` (one test per reader + undone rows ignored), `CrossEffectCalculatorIT` (kcal / verdict "after" equal the engines once the move is in the ledger; sleep need; season date), `CapacityDayServiceIT`, `BoopBriefCapacityIT`, `BoopBriefCapacityOffIT`, `WearableContractIT`. iOS: `CalendarSnapshotTests`, `HealthSyncTests` (re-backfill key), `KapacitasLogicTests`, `KapacitasClientTests`. Simulator review: `-preview shell -previewHome nap -previewPhase reggel -previewCapacity szoros|tulSok|laza|rendben|nocal` (+ `-previewSheet day -previewDetent large`, `-previewDayBottom YES`, `-previewCapacityPick YES`); screenshots in `docs/superpowers/specs/assets/kapacitas/built/`.

## 9. Decisions, gotchas & deferred

- Decisions 2026-11-21 (spec §2): learns from everything; moves only with approval and never touch the Évad plan; the calendar is never written; the model sees all fields.
- **Gotcha:** scoring is async — the first read after a calendar change shows rule scores; tests must use Awaitility. A 3-day timed event loads a middle day with 24 h worth (clipping, not capped to waking hours).
- Deferred: the rest of K2, K3, K4 (`mezo-r36n9.17` follow-ups).
- The *Mennyit bírsz ma* bar's two marks (szoros 0.9/1.2, határ 1.0/1.2) are unlabelled, as in the approved spike: their words collide 8 % apart.

## 10. Key files

- Backend: `backend/src/main/java/io/mrkuhne/mezo/feature/capacity/service/` (`CapacityDayService`, `DemandCalculator`, `CapacityCalculator`, `EventScoringService`, `EventScoringRunner`, `RuleEventScore`, `LearningState`, `Verdicts`, `BoopCapacityAdapter`, `DayAdjustmentService`, `AdjustmentRules`, `LedgerReadAdapter`, `WeekPictureService`, `ProposalGenerator`, `DraftWeek`, `CrossEffectCalculator`, `ProposalWordingWriter`), `…/capacity/config/CapacityProperties.java`, `…/capacity/entity`, `…/capacity/port`, `…/wearable/service/CalendarDaysReplacedEvent.java`, `…/boop/service/BoopBriefService.java`.
- Contract: `api/feature/wearable/wearable.yml`, `api/feature/boop/boop.yml`, `api/feature/capacity/capacity.yml`.
- Migrations: `backend/src/main/resources/db/changelog/1.1.0/script/202611211200_mezo-r36n9.17_calendar_event_fields.sql`, `…/202611211210_mezo-r36n9.17_capacity.sql`.
- iOS: `ios/BoopKit/Sources/BoopCore/Calendar/`, `…/Health/HealthSync.swift`, `…/BoopCore/Kapacitas/` (`KapacitasLogic`, `KapacitasWire`, `KapacitasClient`), `ios/Boop/Nap/DayCapacity.swift`, `MaPhases.swift`, `DaySheet.swift`.
- Backend K2: `…/capacity/controller/CapacityController.java`, `…/capacity/service/EventFeedbackService.java`.
- Docs: spec and plan above; [`boop-ios.md`](boop-ios.md).
