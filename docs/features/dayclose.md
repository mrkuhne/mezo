---
title: Day close — the Boop evening close record
type: feature-domain
status: done
updated: 2026-11-13
tags: [backend, ios, boop, dayclose, biometrics, data-layer]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/dayclose
  - api/feature/dayclose/dayclose.yml
  - backend/src/main/resources/db/changelog/1.1.0/script/202611121120_mezo-r36n9.13_day_close.sql
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/DayCloseLlmAdapter.java
  - ios/BoopKit/Sources/BoopCore/Ritmus/RitmusClient.swift
  - ios/Boop/Ritmus/EsteFlow.swift
related: [boop-ios, ritual, intention, journal, companion, today]
---

# Day close — the Boop evening close record — Feature Documentation

> **2026-11-13 — Boop B4 Étel (`mezo-r36n9.14`): a new tenant of the outbox, one transcoder change; no day-close change.** `RitmusClient.send` routes the new `OutboxKind.mealDraft` to `MealDraftSender` (offline meal captures share the same queue, backoff and order-group machinery as the close, journal and check-in; see [`boop-ios.md`](boop-ios.md) §2 *The Étel room*). The generated client's date encoder now writes the **phone's UTC offset instead of `Z`** for every date-time (`FlexibleISO8601Transcoder`); for the close nothing changes — `DayCloseService.put` maps `capturedAt` through `OffsetDateTime::toInstant`, so the instant is identical and the offset never reaches a date decision (the day is the `date` field). The four `RitmusClientTests` that asserted a literal `Z` now compare instants.

> Backend feature, no web route; its only client is **Boop** (the iPhone app, evening close *Esti levezetés*). Backend ✅ done (2026-11-12, `mezo-r36n9.13`) · iOS ✅ done (offline-first, see [`boop-ios.md`](boop-ios.md)) · web FE: none (a day closed on the web still reads through the fallback below).

## 1. Summary

One **`day_close`** record per owner and date — the single source of truth for how the owner closed a day: the day rating (1–5), the evening energy, the day's goal and whether it worked out (`done` / `partial` / `no`), Boop's own plan goals as seen at close, the link to the journal entry that holds the evening text, and Boop's one-sentence reply. It exists because the evening used to be spread over three stores (the Napzárás ritual, the day intention's reflection, the 20:00 check-in) and Boop closes the day in one minute, offline-first. The close is **dual-written** into those legacy stores in the same transaction so every existing reader keeps working. Spec: [`2026-11-11-boop-b3-napi-ritmus-design.md`](../superpowers/specs/2026-11-11-boop-b3-napi-ritmus-design.md) §7.4; plan [`2026-11-11-boop-b3-napi-ritmus.md`](../superpowers/plans/2026-11-11-boop-b3-napi-ritmus.md).

## 2. User-facing behavior

Owner-visible only through Boop: *Lezárom a napot* in the evening flow writes the close; Napló's 14-day list shows each day's close (rating orbs, goal and outcome, journal text, Boop's line); Boop answers a close with one sentence (cheap model tier, online only — offline the calm placeholder stays and the line is asked for later). A day closed on the **web** appears in Napló too, marked `source: web`, with no rating when the web evening had none. Re-closing a day replaces the earlier close.

## 3. Architecture & data flow

`EsteFlow` (iOS) → ledger (pending) → outbox `dayClose` item → `RitmusClient.putDayClose` → `DayCloseController` → `DayCloseService.put` → `day_close` upsert + legacy dual-write + `DayClosedEvent`. Lines: `generateDayCloseLine` / `generateCheckInLine` → `DayCloseService.dayLine` / `checkInLine` → `DayCloseLineWriter` (one cheap-tier call, prompt hash as the cache key) through the `DayCloseLlm` port, adapted in companion by `DayCloseLlmAdapter` (companion off ⇒ no bean ⇒ 503, the phone retries).

- **`put` is an idempotent upsert** (natural key owner + date; `INSERT … ON CONFLICT DO NOTHING` then fill, so a concurrent first PUT cannot 500). Window **today − 7 … today + 1 in the owner zone** (`mezo.wearable.zone`, via biometrics' `OwnerZoneProperties`; `+1` because a phone east of the owner zone dates its day ahead); anything else is a 400 on `date`. A `capturedAt` more than 5 minutes in the future is a 400. "Now" is the application `Clock` bean when present, never the server's `LocalDate.now()`.
- **Dual-write (same transaction):** the goal outcome → `daily_intention.reflection` (`done`→`yes`, `partial`→`partial`, `no`→`no`; left alone when the goal was not judged); `ritual_day.closed_at` through `RitualService.closeOn` (the web's `reflection_text` is never written or cleared — the evening text lives only in the journal); the **20:00 check-in** is merged through `CheckInService.mergeEvening` (`energy` = the evening energy, or the slot's existing energy when Boop has none; `day_rating` = rating × 2). Ritual, intention and journal are switchable features — with one off, its write is skipped.
- **The journal text** is stored once, as a `journal_entry` with `source = boop` (the transcript or typed line; `clientRef` makes its creation idempotent). The close carries `journalClientRef`; the server resolves it to `journal_entry_id` when the entry has arrived — an unknown ref is ignored, a later PUT links it, a PUT without a ref keeps the link. That is why the phone syncs **close → journal → relink**. The transcript is never copied into `day_close`.
- **Web-closed fallback:** `get` / `list` with no `day_close` row but `ritual_day.closed_at` set build a `source: web` response from the legacy stores; `dayRating` is the 20:00 `day_rating` ÷ 2 rounded, or **null** (never an invented value) — the contract's `dayRating` is nullable for that reason, and the line prompt omits a null rating.
- **Lines:** a close's line is stored on its row (`boop_line` + `boop_line_hash`; a re-close with other inputs drops it). Lines without a row of their own — after a check-in (`POST /api/day-close/{date}/checkin-line`, body `{slot}`) and for a web-closed day — live in **`day_close_line_cache`** keyed by the hash of every input the prompt was built from, so the same inputs never call the model twice. The model call runs outside any transaction. No model, a failure or a blank answer → 503 `DAY_CLOSE_LINE_UNAVAILABLE`, nothing cached. Lines are cut to `mezo.dayclose.line-max-chars` (300).
- **`DayClosedEvent(owner, date)`** is published inside the close's transaction on every successful PUT; nothing listens yet (kept for B8). The existing `RitualClosedEvent` listeners (people mentions, reflection embedding) tolerate past days.

## 4. Data model & API

Contract fragment [`api/feature/dayclose/dayclose.yml`](../../api/feature/dayclose/dayclose.yml) (tag `DayClose`):

| Operation | Endpoint | Notes |
|---|---|---|
| `putDayClose` | `PUT /api/day-close/{date}` | body `DayCloseRequest` (`capturedAt`, `clientRef`, `dayRating` 1–5, `eveningEnergy` 1–10 nullable, `goalText`, `goalOutcome`, `planGoals[]`, `journalClientRef`); 400 outside the window |
| `getDayClose` | `GET /api/day-close/{date}` | 404 `DAY_CLOSE_NOT_FOUND` when not closed; web fallback |
| `listDayCloses` | `GET /api/day-close?from&to` | newest first, Boop closes + web-only days; range ≤ `max-range-days` (92) else 400 |
| `generateDayCloseLine` | `POST /api/day-close/{date}/line` | Boop's sentence about the closed day; 404 not closed, 503 model unavailable |
| `generateCheckInLine` | `POST /api/day-close/{date}/checkin-line` | Boop's sentence after a done check-in slot; 400 empty / not-done slot, 503 |

Tables (migration `202611121120_mezo-r36n9.13_day_close.sql`): **`day_close`** (`close_date`, `closed_at`, `evening_energy`, `day_rating` 1–5, `goal_text`, `goal_outcome`, `plan_goals` jsonb, `journal_entry_id` FK `ON DELETE SET NULL`, `boop_line`, `boop_line_hash`, `client_ref`; unique live row per `(created_by, close_date)`) and **`day_close_line_cache`** (`input_hash`, `line`; unique per `(created_by, input_hash)`). Properties `mezo.dayclose.{max-past-days=7, max-range-days=92, line-max-chars=300}` (`DayCloseProperties`).

## 5. Integrations

- **ritual** — `RitualService.closeOn` sets `closed_at` for a past day (and `listClosed` feeds the web fallback); [`ritual.md`](ritual.md).
- **intention** — `IntentionService.reflect` gets the outcome; the goal text of a web-closed day is its first focus; [`intention.md`](intention.md).
- **check-in** (biometrics) — `CheckInService.mergeEvening` and `listForDay`; dayclose → biometrics is cycle-safe (dayclose is the leaf).
- **journal** — `findByClientRef` / `findText`; [`journal.md`](journal.md).
- **companion** — `DayCloseLlmAdapter` implements the dayclose-owned `DayCloseLlm` port; `BoopDayContext` reads the close for the chat's "Ma" block; [`companion.md`](companion.md).
- **boop-ios** — the only client; the outbox sync order and Újra rows are in [`boop-ios.md`](boop-ios.md) §3.

## 6. How to use it (consume)

Clients call the operations above; there is no web hook. To read a day's close from backend code inject `DayCloseService` and use `get(owner, date)` (returns the web fallback too) — a listener for `DayClosedEvent` is the hook for later readers.

## 7. How to extend it

Contract first (`api/feature/dayclose/dayclose.yml`, `scripts/gen` regenerates DTOs and the iOS spec copy; add the `operationId` to the iOS generator filter), then service + a Liquibase changeset under `db/changelog/1.1.0/` (keep `ResetDatabase` in sync for a new table). Do **not** add new writers of the legacy evening stores — the planned direction is the opposite (`mezo-r36n9.26`).

## 8. Testing

`DayCloseServiceIT` (upsert idempotency and race, window, dual-write, journal link, web fallback, line cache and invalidation, event), `DayCloseApiIT` (HTTP contract, validation, 503 without a model; `checkInLineIsCachedAndRejectsAnEmptySlot` is flaky, `mezo-r36n9.30`), `CheckInBoopIT` (the 20:00 merge), `BoopDayContextIT`. Run with `-Dmezo.test.use-testcontainers=true`, e.g. `./mvnw test -Dtest='DayClose*IT,CheckInBoopIT' -Dmezo.test.use-testcontainers=true`. iOS side: `RitmusClientTests`, `RitmusSyncTests`, `EsteFlowTests`.

## 9. Decisions, gotchas & deferred

- **Dual-write is a bridge.** Readers of the evening (ritual recap, insights, proactive) still read the legacy stores; **`mezo-r36n9.26`** migrates them to `day_close` and retires the legacy writes. Until then `day_close` and the legacy rows must never disagree — the PUT writes both in one transaction.
- **Transcript only in `journal_entry`** (`source = boop`); the web's `reflection_text` is never touched.
- **`dayRating` nullable** for web-closed days: Boop must not cite a rating the owner never gave.
- **Window + 1 day ahead** accepted for a phone east of the owner zone (travel); a deliberately mis-dated tomorrow entry would be accepted, the `capturedAt` check still blocks a real-future capture.
- Deferred minors: the 503 path has no companion-off test; the line is truncated mid-word; a soft-deleted row holding the unique key could 500 (pre-existing pattern).

## 10. Key files

Backend: `backend/src/main/java/io/mrkuhne/mezo/feature/dayclose/{controller/DayCloseController,service/DayCloseService,service/DayCloseLineWriter,service/DayCloseLlm,service/DayClosedEvent,entity/DayCloseEntity,entity/DayCloseLineCacheEntity,repository/*,mapper/DayCloseMapper,config/DayCloseProperties}.java` · `…/feature/companion/llm/DayCloseLlmAdapter.java` · migration `202611121120_mezo-r36n9.13_day_close.sql` · contract `api/feature/dayclose/dayclose.yml`. iOS: `ios/BoopKit/Sources/BoopCore/Ritmus/RitmusClient.swift` · `ios/Boop/Ritmus/EsteFlow.swift`. Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/dayclose/*IT.java`.
