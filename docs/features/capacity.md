---
title: Capacity (day load vs. what the owner can carry)
type: feature-domain
status: in-progress
updated: 2026-11-24
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
| `day_adjustment`, `capacity_proposal`, `capacity_pattern` | K3/K4 ledger, proposals, patterns | tables + repos only |

**Contract.** `api/feature/wearable/wearable.yml` — calendar events gain `attendeeCount`, `attendeeNames` (≤ 50), `organizerIsMe`, `location`, `recurring`, `availability` (`busy|free|tentative|unavailable`), `notes` (≤ 2000); the per-request cap is 31 days. `api/feature/boop/boop.yml` — the brief gains nullable `capacity: BoopCapacity` = `verdict`, `reason`, `ratio`, `tanulo`, `labelledDays`, `calendarKnown`, `demand[]` (`label`, `start`, `kind`, `level` kicsi/kozepes/nagy/tolt, `eventKey`, nullable `effect` drains/neutral/feeds = his stored label), `factors[]` (`key`, `label`, `value`, `effect` jo/semleges/rossz). Demand items carry `eventKey` = the calendar `external_id` without the trailing `|occurrence` (`EventScoringService.eventKey`), null for training. `api/feature/capacity/capacity.yml` — **`PUT /api/capacity/event-feedback`** (`putCapacityEventFeedback`, body `{eventKey ≤ 200, effect drains|neutral|feeds}`, 204; blank/long key or unknown effect = 400 `VALIDATION_INVALID_VALUE`). The key travels in the body, not the path: device ids carry `/` and `:` (an encoded `/` in a path is refused by the servlet firewall); the server stores it as sent (it never strips again — a device id may itself contain `|`). The label overrides the event's components at read time (`applyFeedback`). The brief's input hash covers the capacity ratio (steps of 0.05), the factors and **each demand item's key + level + label** (so a label regenerates the brief even when the day's units round the same); the demand-bent hourly energy replaces the plain curve (`EnergyCurveModel.hourly` with `capacity.hourly19()`).

## 5. Integrations

| Seam | Contract |
|---|---|
| wearable → capacity | `CalendarDaysReplacedEvent(owner, dates)` published by `CalendarSnapshotService.replace`; `CapacityCalendarPort` reads events back |
| capacity → sleep / train / metrics / fuel / check-in | `CapacitySleepPort`, `CapacityTrainPort`, `CapacityMetricsPort`, `CapacityMealPort`, `CapacityCheckinPort` |
| boop → capacity | `BoopCapacityPort.read(owner, date)` → `capacity` block, demand-bent curve, `withCapacityReason` rule words; the verdict writer may rephrase the reason only |
| capacity → companion | one `CompanionLlm` call, llm-log feature `capacity_event_score`, booked to the owner via `LlmActorContext` |
| iOS | calendar sends yesterday…today+8 with all fields — see [`boop-ios.md`](boop-ios.md) |

## 6. How to use it (consume)

Server-side only: inject `CapacityDayService` (`day(owner, date)`, `week(owner, monday)`) — never call `EventScoringService.scoresFor` from a request path. Clients read the brief's `capacity` block and must treat it as nullable.

## 7. How to extend it

K2 rest: the label as a few-shot example for the scoring model, the Évad series, an AI-context renderer. K3: proposal generator over `CapacityDayService.week`, `day_adjustment` readers in train/fuel/boop. K4: outcomes, `capacity_pattern`, the Sunday job. Contract-first (`api/feature/…`), Liquibase for schema, messages in both `messages_*.properties` (the five `CAPACITY_*` keys already exist).

## 8. Testing

Unit: `DemandCalculatorTest`, `CapacityCalculatorTest`, `RuleEventScoreTest`, `LearningStateTest`, `VerdictsTest`, `BoopCapacityAdapterTest`, `CapacityDayServiceTest`, `BoopBriefHashTest`, `BoopCapacityReasonTest`, `EnergyCurveModelTest`. ITs (Testcontainers, `-Dmezo.test.use-testcontainers=true`): `CapacityRepositoryIT`, `EventScoringServiceIT`, `EventScoringBackgroundIT` (slow fake model: day read returns first, async upgrade, single-flight), `CapacityFeedbackIT` (label re-scores the event, replace, 400s), `CapacityDayServiceIT`, `BoopBriefCapacityIT`, `BoopBriefCapacityOffIT`, `WearableContractIT`. iOS: `CalendarSnapshotTests`, `HealthSyncTests` (re-backfill key), `KapacitasLogicTests`, `KapacitasClientTests`. Simulator review: `-preview shell -previewHome nap -previewPhase reggel -previewCapacity szoros|tulSok|laza|rendben|nocal` (+ `-previewSheet day -previewDetent large`, `-previewDayBottom YES`, `-previewCapacityPick YES`); screenshots in `docs/superpowers/specs/assets/kapacitas/built/`.

## 9. Decisions, gotchas & deferred

- Decisions 2026-11-21 (spec §2): learns from everything; moves only with approval and never touch the Évad plan; the calendar is never written; the model sees all fields.
- **Gotcha:** scoring is async — the first read after a calendar change shows rule scores; tests must use Awaitility. A 3-day timed event loads a middle day with 24 h worth (clipping, not capped to waking hours).
- Deferred: the rest of K2, K3, K4 (`mezo-r36n9.17` follow-ups).
- The *Mennyit bírsz ma* bar's two marks (szoros 0.9/1.2, határ 1.0/1.2) are unlabelled, as in the approved spike: their words collide 8 % apart.

## 10. Key files

- Backend: `backend/src/main/java/io/mrkuhne/mezo/feature/capacity/service/` (`CapacityDayService`, `DemandCalculator`, `CapacityCalculator`, `EventScoringService`, `EventScoringRunner`, `RuleEventScore`, `LearningState`, `Verdicts`, `BoopCapacityAdapter`), `…/capacity/config/CapacityProperties.java`, `…/capacity/entity`, `…/capacity/port`, `…/wearable/service/CalendarDaysReplacedEvent.java`, `…/boop/service/BoopBriefService.java`.
- Contract: `api/feature/wearable/wearable.yml`, `api/feature/boop/boop.yml`, `api/feature/capacity/capacity.yml`.
- Migrations: `backend/src/main/resources/db/changelog/1.1.0/script/202611211200_mezo-r36n9.17_calendar_event_fields.sql`, `…/202611211210_mezo-r36n9.17_capacity.sql`.
- iOS: `ios/BoopKit/Sources/BoopCore/Calendar/`, `…/Health/HealthSync.swift`, `…/BoopCore/Kapacitas/` (`KapacitasLogic`, `KapacitasWire`, `KapacitasClient`), `ios/Boop/Nap/DayCapacity.swift`, `MaPhases.swift`, `DaySheet.swift`.
- Backend K2: `…/capacity/controller/CapacityController.java`, `…/capacity/service/EventFeedbackService.java`.
- Docs: spec and plan above; [`boop-ios.md`](boop-ios.md).
