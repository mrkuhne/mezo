---
title: Push Notifications Platform
type: feature-platform
status: done
updated: 2026-07-29
tags: [platform, notification, backend, frontend, pwa, proactive, security]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/techcore/webpush
  - backend/src/main/java/io/mrkuhne/mezo/feature/notification
  - api/feature/notification/notification.yml
  - frontend/public/push-sw.js
  - frontend/src/data/notification
  - frontend/src/features/me/pages/NotificationsPage.tsx
  - backend/src/main/resources/db/changelog/1.0.0/script/202607291000_mezo-h4wp.6.1_create_push_subscription.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607291400_mezo-h4wp.6.2_create_notification_pref_and_push_log.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607291500_mezo-h4wp.6.3_create_notification_schedule.sql
related: [proactive, today, ritual, me, fuel, _platform-api-backend]
---

# Push Notifications Platform — Feature Documentation

> Cross-cutting delivery layer, no route/tab of its own (the FE surface lives at `/me/ertesitesek`,
> documented from Me's side in [`me.md`](me.md)). **Status: DONE — N1 delivery spine + N2 dispatcher/
> prefs + N3 FE-schedule/preview are all shipped; all 11 categories are live.** A real Web Push
> reached Daniel's iPhone from the k3s backend on 2026-07-29 (N1's exit criterion, confirmed by
> Daniel — bd `mezo-h4wp.6.1`) — real-world delivery is proven, not just unit-tested. This is the
> slice that completes the `mezo-h4wp` proactive epic's long-deferred **H2** item — see
> [`proactive.md`](proactive.md) and [`roadmap.md`](../milestones/roadmap.md).

## 1. Summary

mezo's proactive layer (`briefing`/`heartbeat_note`/`weekly_suggestion`/`memoir`, see
[`proactive.md`](proactive.md)) generates content on crons; this platform layer delivers it — plus a
second feed of time-anchored reminders the app's own data already implies (gym start, sleep wind-down
+ lights-out, the medication cycle day, the 4 daily check-ins, the fuel/stack slots) — to Daniel's
iPhone **with the app closed**. It is a Web Push (RFC 8030/8291/8292) stack the backend owns end to
end, plus the FE opt-in/settings surface and service-worker handlers.

**Driving spec:** [`docs/superpowers/specs/2026-07-29-push-notifications-design.md`](../superpowers/specs/2026-07-29-push-notifications-design.md)
(§3 architecture, §5 data model, §6 the 11-category catalog + copy rules, §7 frontend, §9 switches,
§13 risks). **ADR:** [`0014-own-webpush-implementation.md`](../decisions/0014-own-webpush-implementation.md)
(why the protocol is hand-rolled). **Driver:** `mezo-h4wp.6` — N1 `mezo-h4wp.6.1`, N2 `mezo-h4wp.6.2`,
N3 `mezo-h4wp.6.3` — all three slices shipped.

**Status per layer — all shipped:**
- **Backend `techcore/webpush`:** done (unchanged since N1) — VAPID ES256 signing, RFC 8291
  `aes128gcm` encryption, the outbound HTTP client. Zero new Maven dependencies.
- **Backend `feature/notification`:** done — three tables beyond N1's `push_subscription`:
  `notification_pref` + `push_log` (N2), `notification_schedule` (N3). The `NotificationCategory`
  enum (§4) is the 11-key catalog. **`DueEvaluator`** (pure) + **`AnchorResolver`** (impure, reads
  three anchor sources) feed **`NotificationDispatchJob`**, a per-minute cron that hands the actual
  send to **`PushDispatchExecutor`**'s `@Async` method (§9 — the single most important gotcha in
  this feature). One `NotificationController` implements all six operations (subscribe/unsubscribe/
  test-push/pref-get/pref-put/schedule-put) — `openapi-generator` emits one interface per tag, so
  there is no per-slice controller to split this across.
- **Frontend:** done — `usePushSubscription()` (N1, device-owned, unchanged) +
  `useNotificationPrefs()` (N2, **server-owned**, `useDualQuery` — unlike N1's hook) +
  `useScheduleSnapshotWriter()` (N3, write-only, fire-and-forget, wired into `AppLayout.tsx`) feed
  the full `NotificationsPage` settings screen: the live volume-preview header + the iOS install-gate
  + a two-section, per-category toggle list with lead chips where meaningful.
- **Real-world delivery:** proven end to end, not merely unit-tested — a real push reached Daniel's
  iPhone from the k3s backend on 2026-07-29 (N1's exit criterion; bd `mezo-h4wp.6.1` notes "confirmed
  by Daniel"). N2/N3 build the dispatcher and the last two categories' feed on top of that proven
  path.

## 2. User-facing behavior

**Route:** `/me/ertesitesek` (`NotificationsPage.tsx`, `ME_TABS` entry `notifications`). Full
page-level description (layout, states, copy) is in [`me.md`](me.md) §2 "`Értesítés`" — this doc
covers the platform mechanics the page sits on top of.

**iOS install-gate first, unchanged from N1.** When the PWA is not running standalone or the browser
lacks Push support, the page renders **only** `PushInstallGate.tsx` — never a toggle, preview, or
settings list beside it that cannot work.

**Once available**, three things now stack above each other:
1. **`NotificationPreviewHeader`** — the "Napi terhelés" dark preview card: today's push count +
   an hourly sparkline (`notificationForecast.ts`, §4/§6) + a "Sűrű ablak" warning when ≥2 pushes
   land within 15 minutes of each other. Needs no endpoint — the FE already knows today's anchors.
2. **The N1 master toggle + dev "Teszt értesítés küldése" button** — unchanged.
3. **The category list**, two sections (mockup direction C): **"Mezo megszólal"** (the prose
   categories — `briefing`/`midday`/`weekly`/`memoir`) and **"Emlékeztetők"** (the reminder
   categories — `gym`/`medication`/`ritual`/`lights_out`/`wind_down`/`checkin`/`fuel_slot`). Each row
   (`NotificationCategoryRow.tsx`) is a toggle + a live, per-day sub-line derived from data the page
   already holds (e.g. `"ma 17:00 · Láb nap"` for `gym`, `"szerda · D3"` for `medication`) — falling
   back to the static `NOTIFICATION_CATEGORY_META` description when the day genuinely has no anchor
   (no session today, not a dose day). **Only `gym` shows a lead-minute chip** (`"−30 perc"`) — it is
   the sole category with a non-zero `leadMinutes`; a chip on any other row would expose a number the
   backend ignores (dishonest control, spec §6/§9).

**Honest limits, stated plainly:** the mockup's single "Heti terv + memoir" settings row is actually
**two independent rows/categories** (`weekly`, `memoir`) in the real 11-key catalog — the mockup
compressed them for space, the catalog does not. `midday` and `memoir` keep the mockup's **fixed
static sub-lines** (their anchors are backend CONSTANTS — 12:30, Sunday 19:00 — not per-day data, so
there is nothing to derive). Several mockup copy specifics were **deliberately dropped** because
supplying them would mean inventing a number the spec's §6 copy rules forbid — e.g. the napzárás
notification's XP total is tracked as a separate follow-up bd issue, not fabricated here.

## 3. Architecture & data flow

```
[FE opt-in — Me → Értesítések, unchanged from N1]
    Notification.requestPermission() → …pushManager.subscribe(…)
    → POST /api/notification/subscription   → push_subscription

[FE app-open — N3, useScheduleSnapshotWriter(), wired into AppLayout.tsx (the root route element,
 mounts exactly once per app session)]
    buildScheduleEntries(checkins, protocolSlots)   — checkin + fuel_slot only
    → PUT /api/notification/schedule { categories: [...derived from entries], entries }
    → notification_schedule (per-category full replace: soft-delete the category's live rows,
      insert the new set)

[NotificationDispatchJob]  @Scheduled(cron = "${mezo.notification.dispatch-cron}")  # every minute
    for every AppUser (per-user try/catch — one broken user never aborts the run):
    1. AnchorResolver.resolve(owner, today)       → AnchorSet{backendAnchors, proseAnchors, scheduleAnchors}
         a) backend-native   gym_schedule_slot/sport_schedule_slot · medication cycle ·
                              RitualService (opensAt/prepStartsAt/bedTime), optional via ObjectProvider
         b) prose readiness  briefing/heartbeat_note(midday)/weekly_suggestion/memoir row EXISTS
                              for the day → excerpted (never a new LLM call)
         c) FE snapshot       today's live notification_schedule rows (weekday match or NULL=every day)
    2. NotificationPrefService.effectiveFor(owner)  → all 11 categories, stored row or code default
    3. DueEvaluator.due(nowMinute, prefs, anchors, catchUpMinutes)   — PURE, no collaborators
         fires when (anchorMinute − leadMinutes) − nowMinute ∈ [0, catchUpMinutes)
    4. push_log dedup on (created_by, log_date, dedup_key)  → already sent today: skip
    5. writeLog(...) THEN pushDispatchExecutor.dispatch(...)   — log BEFORE the async send, always
    6. [PushDispatchExecutor, @Async, separate bean]  → PushSender.sendToAllDevices(...) → WebPushClient

[Service worker — public/push-sw.js, unchanged from N1]
    'push'              → showNotification(title, {body, icon, badge, tag, data: url})
    'notificationclick' → focus an existing window, else openWindow(data.url)
```

**Generation and delivery stay separate.** The 18+ existing proactive/habit crons keep writing
content on their own schedule, untouched; `NotificationDispatchJob` only decides *when it leaves*.
Zero changes to `BriefingJob`/`HeartbeatJob`/`WeeklySuggestionJob`/`MemoirJob`.

**The scheduler-pool-of-1 + async handoff is the load-bearing shape of this whole slice** — see §9
for why `PushDispatchExecutor` must be a separate `@Component`, not a private method.

## 4. Data model & API

### `push_subscription` (N1 — unchanged)

See N1's own migration
[`202607291000_..._create_push_subscription.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607291000_mezo-h4wp.6.1_create_push_subscription.sql).
`endpoint`/`p256dh`/`auth`/`user_agent`/`last_success_at`, partial-unique on
`(created_by, endpoint)`. Entity `PushSubscriptionEntity`, service `PushSubscriptionService`.

### `notification_pref` (N2)

Migration: [`202607291400_..._create_notification_pref_and_push_log.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607291400_mezo-h4wp.6.2_create_notification_pref_and_push_log.sql).

| Column | Notes |
|---|---|
| `category varchar(24) not null` | the catalog key; no DB CHECK — validated in code (`NotificationCategory.fromKey`) |
| `enabled boolean not null` | |
| `lead_minutes integer not null default 0` | CHECK `between 0 and 240` |

`uq_notification_pref_created_by_category` (partial, live rows only). **A missing row is never
"off"** — `NotificationPrefService.effectiveFor` reports the category's code default
(`NotificationCategory.defaultEnabled()`/`defaultLeadMinutes()`) for every one of the 11 keys, always
— so a fresh install needs no seed data and a future 12th category ships with its intended default
instead of silently arriving OFF (`feature/notification/service/NotificationPrefService.java:32-44`).

### `push_log` (N2)

Same migration as above. `log_date date`, `dedup_key varchar(80)` (`"{category}:{anchorHHmm}"`, e.g.
`gym:10:00` — built from the **anchor** time, never the fire time, so changing a category's lead
cannot re-fire something already sent today for the same anchor), `category`, `sent_at`.
`uq_push_log_created_by_log_date_dedup_key` (partial, live rows only). **Written before the send**
(§9). No pruning job in v1 (~7 rows/day, single user — spec §5 retention note).

### `notification_schedule` (N3)

Migration: [`202607291500_..._create_notification_schedule.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607291500_mezo-h4wp.6.3_create_notification_schedule.sql).

| Column | Notes |
|---|---|
| `weekday smallint` | **nullable = every day** (CHECK `between 1 and 7` when present — NULL is never FALSE in SQL, so the CHECK doesn't fire); ISO 1=Mon..7=Sun |
| `time varchar(5) not null` · `category varchar(24) not null` | |
| `title varchar(120) not null` · `body varchar(300)` | the FE writes this copy too |
| `deeplink varchar(200) not null` · `source varchar(24) not null` | provenance, e.g. `buildProtocol`, `checkinSlots` |

**Deliberately no unique index** — `idx_notification_schedule_created_by_category` is a plain index;
a category legitimately holds many rows at once (one per weekday × time). Replace is per-category:
soft-delete the category's live rows + insert the new set in one `@Transactional` (the briefing
regeneration precedent — a soft-deleted row never blocks reinsertion). **Only
`NotificationCategory.feWritten()` categories are accepted** (`checkin`, `fuel_slot`) — checked on
both the `categories` list and every entry, in `NotificationScheduleService.requireFeWritten`
(`feature/notification/service/NotificationScheduleService.java:73-79`) — letting a client write a
backend-native category's schedule (`gym`, `ritual`, …) would create a second source of truth for a
minute the backend already owns.

### `NotificationCategory` — the 11-key catalog (`feature/notification/domain/NotificationCategory.java`)

The single source of truth for which categories exist, their default enabled/lead, and which are
FE-written — pinned by `NotificationCategoryTest` against spec §6:

| # | Key | Default | Lead | FE-written | Anchor |
|---|---|---|---|---|---|
| 1 | `briefing` | ON | 0 | no | `SleepAnchorPort.resolve(user).wake()` |
| 2 | `gym` | ON | **30 min** | no | `gym_schedule_slot.time` / `sport_schedule_slot.time` |
| 3 | `medication` | ON | 0 | no | `mezo.notification.medication-time` (08:00) on a cycle day |
| 4 | `ritual` | ON | 0 | no | `RitualService` `opensAt` |
| 5 | `lights_out` | ON | 0 | no | `RitualService` `bedTime` |
| 6 | `weekly` | ON | 0 | no | Monday, wake anchor |
| 7 | `memoir` | ON | 0 | no | Sunday 19:00 |
| 8 | `wind_down` | OFF | 0 | no | `RitualService` `prepStartsAt` |
| 9 | `midday` | OFF | 0 | no | 12:30 |
| 10 | `checkin` | OFF | 0 | **yes** | FE snapshot (`data/today/checkins.ts`) |
| 11 | `fuel_slot` | OFF | 0 | **yes** | FE snapshot (`buildProtocol`) |

**Only `gym` carries a non-zero `defaultLeadMinutes()`.** The ritual-family categories
(`ritual`/`lights_out`/`wind_down`) resolve their windows through `RitualService`, which already owns
`mezo.ritual.lead-min`/`prep-lead-min` — duplicating those offsets under `mezo.notification` would be
a second source of truth for the same minute (class javadoc, `NotificationCategory.java:12-17`).

### `feature/notification` classes

| Class | Responsibility |
|---|---|
| `NotificationCategory` | the 11-key catalog enum (above) |
| `DueEvaluator` | **pure**, no collaborators — `(anchorMinute − lead) − nowMinute ∈ [0, catchUpMinutes)`. Deliberately does not normalize a negative fire minute into the previous evening — the honest answer for such a combination is that it never fires (`DueEvaluator.java:28-32`) |
| `AnchorResolver` | the impure half — resolves all 11 categories' anchors for one owner+day into an `AnchorSet`; see §9 for its five documented traps |
| `NotificationDispatchJob` | the per-minute `@Scheduled` cron — DB-only on the scheduler thread, hands the send to `PushDispatchExecutor` |
| `PushDispatchExecutor` | the `@Async` send handoff — a **separate bean** (§9) |
| `NotificationPrefService` | `effectiveFor` (all 11, code-default fallback) + `upsert` (per-category, blind-insert-safe) |
| `NotificationScheduleService` | `replace` (per-category full replace, `feWritten`-gated) + `liveFor` (the dispatcher's read) |
| `NotificationController` | implements `NotificationApi` — all six operations, thin delegation |
| `PushSubscriptionService` / `PushSender` | N1, unchanged |

### API contract (`api/feature/notification/notification.yml`)

| Verb | Path | Slice | Notes |
|---|---|---|---|
| `POST`/`DELETE` | `/api/notification/subscription` | N1 | unchanged |
| `POST` | `/api/notification/test` | N1, dev-only | unchanged |
| `GET` | `/api/notification/pref` | N2 | all 11 categories, always complete — a category with no stored row reports its code default |
| `PUT` | `/api/notification/pref` | N2 | upsert one or more; `400 NOTIFICATION_UNKNOWN_CATEGORY` on an unrecognized key |
| `PUT` | `/api/notification/schedule` | N3 | replaces the named categories' live rows; `400 NOTIFICATION_UNKNOWN_CATEGORY` on an unrecognized key **or a known-but-backend-native one** |

**All six operations live on one `NotificationController`** — `openapi-generator` emits one interface
per OpenAPI `tag`, and every path in `notification.yml` shares the `Notification` tag, so there is no
natural per-slice controller boundary to split N1/N2/N3 across.

**`NOTIFICATION_UNKNOWN_CATEGORY` (400) is a single message code doing two jobs, deliberately.** On
`pref`, any of the 11 keys is valid (every category — backend-native or FE-written — has a
preference), so the code fires only on a genuinely unrecognized string
(`NotificationController.toCategoryPref`). On `schedule`, the code fires on an unrecognized string
**or** a recognized-but-not-`feWritten` one (`gym`, `ritual`, …) — the security boundary that stops a
client from owning a minute the backend owns. Same wire error, two different validation rules behind
it, matched to what each endpoint is actually allowed to accept.

## 5. Integrations

- **Proactive** ([`proactive.md`](proactive.md)) — **now wired.** `AnchorResolver` reads
  `BriefingRepository`/`HeartbeatNoteRepository`/`WeeklySuggestionRepository`/`MemoirRepository`
  directly: a prose category's anchor exists **only** when that day's content row already exists —
  a missing row is an honest absence, never a placeholder — and its push body is an **excerpt** of
  the already-generated text (`AnchorResolver.excerptProse`, word-boundary + surrogate-safe cut,
  reusing `PushSender.truncateBody`), never a second LLM call.
- **Today / Ritual / Train** ([`today.md`](today.md), [`ritual.md`](ritual.md), [`train.md`](train.md))
  — **now wired.** `gym`/sport anchors read `GymScheduleSlotRepository`/`SportScheduleSlotRepository`
  + `WorkoutService.findPlannedTemplateForDate` (never `getToday`, §9); `ritual`/`lights_out`/
  `wind_down` read `RitualService.getDay(owner, date).getWindow()`, injected via `ObjectProvider`
  because the whole bean disappears when `RITUAL_SWITCH` is off.
- **Medication** (`feature/medication`) — **now wired.** `medication` reads
  `MedicationRepository` + `MedicationCycleService.derive(...)`; `retaDay == 0` (no dose logged yet)
  is treated as "no anchor today", never as cycle day zero.
- **Fuel** ([`fuel.md`](fuel.md)) — **new seam, both directions.** Fuel's own
  `frontend/src/features/fuel/logic/buildProtocol.ts` now exports `deriveBlocks`/
  `deriveProtocolAnchors` (moved out of `data/fuel/timelineHooks.ts`, which re-exports `deriveBlocks`
  for backward compatibility) as the **one canonical** derivation of "40 minutes before today's first
  training block". Three callers share it: Fuel's own `useFuelTimeline`, this platform's
  `useScheduleSnapshotWriter` (the `fuel_slot` schedule rows), and `NotificationsPage`'s preview
  header — so the pre-workout stack time the Fuel/Stack page shows, the time persisted to
  `notification_schedule`, and the time the settings preview forecasts can never quietly disagree
  (a fix-round decision, `mezo-h4wp.6.3`).
- **Me** ([`me.md`](me.md) §2 "`Értesítés`") — the FE consumer: the settings page owns no
  notification data itself beyond composing `usePushSubscription()` + `useNotificationPrefs()` +
  the pure `notificationForecast.ts` + `buildProtocol`'s anchors.
- **`_platform-api-backend.md`** — same contract-first pipeline + platform conventions as every
  other feature; the notification endpoint table now lists all six operations (§5c there).

## 6. How to use it (consume)

```ts
import { usePushSubscription, useNotificationPrefs } from '@/data/hooks'

function Example() {
  const push = usePushSubscription()
  const { prefs, isPending, setPref } = useNotificationPrefs()

  if (!push.supported || !push.standalone) return <PushInstallGate />
  // render prefs, one NotificationCategoryRow per entry, onToggle={() => setPref(category, { enabled: !enabled })}
}
```

**`useNotificationPrefs()` (`data/notification/notificationPrefHooks.ts`) IS a `useDualQuery`** —
unlike N1's `usePushSubscription()`. The prefs are **server-owned** data (mock seeds the
deterministic `notificationPrefSeed`, all 11 at spec defaults, synchronously; real fetches
`GET /api/notification/pref` and returns the same seed as the honest pre-resolve ghost, since the
backend's own "no stored row = code default" rule means the seed already IS the correct fallback).
`setPref` is a **per-category** upsert (mirrors the backend's own per-category PUT semantics — never
a full-list replace, so a concurrent edit to a different category can never be clobbered), optimistic
via `onMutate`/`onError` rollback.

**Backend:** a new anchor source follows the `AnchorResolver` pattern — a private method appending
`AnchoredEvent`s to one of the three lists in `resolve(...)`, never reaching into `DueEvaluator`
(which stays collaborator-free) or `NotificationPrefService` directly.

## 7. How to extend it (adding a 12th category)

1. **Catalog first** — add the key to `NotificationCategory` (`defaultEnabled`/`defaultLeadMinutes`/
   `feWritten`) and to spec §6's table; `NotificationCategoryTest` pins the catalog against the spec,
   so update both together.
2. **Anchor source** — backend-native: add a resolver method to `AnchorResolver`, appending to
   `backendAnchors`/`proseAnchors`. FE-written: mark `feWritten=true` and have the FE's schedule
   builder (`notificationScheduleWriter.ts`'s `buildScheduleEntries`) emit rows for it —
   `NotificationScheduleService.requireFeWritten` then accepts the category automatically.
3. **Contract** — `NotificationCategory`'s wire key needs no OpenAPI change (categories are
   `type: string` on the wire, validated server-side); only add fields if the new category needs a
   new DTO shape.
4. **Copy** — any new notification text, prose excerpt or hand-written, **MUST** follow the §6 copy
   rules verbatim (below) — never a reproach, never a fabricated number, one tap target, no dose
   suggestion for anything clinical.
5. **Tests** — a `DueEvaluatorTest` case for the new anchor's fire window, an `AnchorResolverIT` case
   for its resolution, a `NotificationCategoryTest` catalog assertion, and — if it has a settings-row
   sub-line — a `NotificationsPage.test.tsx`/`NotificationCategoryRow.test.tsx` case. Both FE test
   modes must stay green.

## 8. Testing

**Backend (integration-first, Postgres) — the N1 webpush-protocol suite is unchanged; N2/N3 add:**
- `DueEvaluatorTest` (pure, no Spring) — exact minute, catch-up window, outside window, disabled
  category, lead applied, empty day, weekday match, `weekday=null` every-day rows.
- `NotificationCategoryTest` — pins the 11-key catalog (keys, defaults, leads, `feWritten`) against
  spec §6.
- `AnchorResolverIT` + `AnchorResolverRitualSwitchOffIT` — per-category anchor resolution against a
  real Postgres, including the ritual-family absence when `RITUAL_SWITCH` is off.
- `service/AnchorResolverExcerptTest` — the word-boundary + surrogate-safe prose-excerpt cut, as a
  plain unit test (package-private `excerptProse(text, maxChars)` needs no Spring context).
- `NotificationDispatchJobIT` — driven directly through `runOnce(date, minute)`, never a real cron
  tick: write-log-then-async-send ordering (asserts `applicationTaskExecutor`'s completed-task
  counter moves — the self-invocation-trap regression test), the `push_log` dedup (same minute
  called twice dispatches once), the per-category disabled gate, and per-user failure isolation (one
  broken user's `medication` data must not swallow a healthy user's dispatch). Re-enables the
  dispatch-job switch via its own `@TestPropertySource` and pins `dispatch-cron` to `0 0 5 31 2 ?`
  (February 31st — legal-but-unmatchable) so the `@Scheduled` method is wired but can never actually
  fire mid-test (§9).
- `NotificationPrefApiIT` / `NotificationPrefRepositoryIT` — the code-default fallback, per-category
  upsert, `400 NOTIFICATION_UNKNOWN_CATEGORY` on a bad key.
- `NotificationScheduleApiIT` — full-replace semantics, and the `feWritten` rejection of a
  backend-native category on both `categories` and `entries`.
- `NotificationApiIT` (N1, unchanged) + `PushSubscriptionRepositoryIT`/`PushSubscriptionServiceIT`/
  `PushSenderIT` (N1, unchanged).
- Data via `support/populator/NotificationPopulator.java` — gained `pref`/`pushLog`/`schedule`
  factory methods alongside N1's `subscription`. New tables joined the `ResetDatabase` TRUNCATE list
  (`notification_pref`, `push_log`, `notification_schedule`).
- Commands: `cd backend && ./mvnw clean test -Dtest='*Notification*,DueEvaluator*,AnchorResolver*'`.

**Frontend (Vitest + RTL + MSW, both modes) — N2/N3 add:**
- `data/notification/notificationPrefHooks.test.tsx` — the optimistic per-category upsert + rollback,
  the code-default seed as the pre-resolve ghost.
- `data/notification/notificationScheduleWriter.test.ts` — `buildScheduleEntries` (checkin + fuel_slot
  entries), the write-once-per-mount guard, `categories` derived from the entries (never a
  separately-maintained list), mock mode never reaching the network.
- `features/me/logic/notificationForecast.test.ts` — table-driven, deterministic (no `new Date()`
  inside): per-category anchor resolution, weekday gating (`weekly`=Monday only, `memoir`=Sunday
  only), the dense-window grouping.
- `features/me/components/NotificationCategoryRow.test.tsx` / `NotificationPreviewHeader.test.tsx` —
  the lead-chip-only-for-`gym` rule, the sub-line fallback, the sparkline + dense-window note.
- `features/me/pages/NotificationsPage.test.tsx` — the two-section category list, per-row toggle
  wiring, the preview header's inputs.
- `features/fuel/logic/buildProtocol.test.ts` — the extracted `deriveBlocks`/`deriveProtocolAnchors`
  (moved from `timelineHooks.ts` — same behavior, now shared).
- A real fix during implementation, worth knowing: the optimistic-update tests initially used a
  **stateless** fake PUT/GET pair, and `onSettled`'s real-mode `invalidateQueries` refetch always
  re-served the pristine seed, silently reverting the optimistic flip — fixed by making the test
  fixture's fake backend stateful (GET reflects the last PUT), matching what a real backend does.
- Commands: `cd frontend && pnpm test` and `VITE_USE_MOCK=true pnpm test` (both must stay green) +
  `pnpm build`.

## 9. Decisions, gotchas & deferred

- **Real-world delivery is proven, not just unit-tested.** A real Web Push reached Daniel's iPhone
  from the k3s backend on 2026-07-29 (N1's exit criterion — bd `mezo-h4wp.6.1`: "confirmed by
  Daniel"). N2's dispatcher and N3's FE feed both build on that proven platform path, not on an
  unverified assumption.
- **The scheduler pool is size 1, shared by every `@Scheduled` method in the app — this is the most
  important gotcha in the whole feature.** `NotificationDispatchJob` is the app's **first per-minute**
  cron; every other job anchors on a rare fixed time. `SchedulingConfiguration` defines no
  `TaskScheduler` and nothing widens `spring.task.scheduling.pool.size`, so Boot's default pool size
  of 1 serializes it against the nightly summary, the dawn briefing, the habit close — every other
  cron. **`NotificationDispatchJob` therefore does DB-only due-computation on the scheduler thread and
  hands the actual outbound HTTP send to `PushDispatchExecutor`**, a **separate `@Component`**
  (`service/PushDispatchExecutor.java`) whose `@Async` method runs on Boot's own
  `applicationTaskExecutor` pool instead. It must be a separate bean: `@Async` only takes effect
  through Spring's proxy, so a same-bean `this.dispatch(...)` call from `NotificationDispatchJob`
  would run synchronously on the scheduler thread — exactly what this split exists to avoid. **Do not
  "simplify" this by inlining the send** — it would silently starve every other cron in the app.
  `NotificationDispatchJobIT` proves the offload genuinely happens (asserts
  `applicationTaskExecutor`'s completed-task counter moves after `runOnce()` returns).
- **`push_log` is written on the calling thread, before the async handoff — never the other way
  around.** A failed send must not re-fire the same notification the next minute; a lost notification
  is strictly better than a duplicated one (`NotificationDispatchJob.java:36-40`). The dedup key is
  built from the **anchor's** time (`"{category}:{anchorHHmm}"`), never the computed fire minute — so
  changing a category's `leadMinutes` mid-day can never cause something already sent today to
  re-fire under a "new" key.
- **`AnchorResolver`'s five documented traps** (each one a real, verified bug class, not a
  hypothetical):
  1. **Two weekday schemes, converted explicitly, never "harmonised".**
     `gym_schedule_slot`/`sport_schedule_slot.dayOfWeek` is legacy **0=Mon..6=Sun**; the FE-written
     `notification_schedule.weekday` is **ISO 1=Mon..7=Sun**. `AnchorResolver` converts one, compares
     the other directly, and comments both sites (`AnchorResolver.java:131-133`, `:312-314`).
  2. **`WorkoutService.getToday(...)` must never be called from a cron.** It hardcodes
     `LocalDate.now()` and triggers three nested `@Transactional` **writes** (autoClose/rollover/
     closing exercises) — a per-minute job doing that per user would be a write storm. The resolver
     only calls the pure read `WorkoutService.findPlannedTemplateForDate(owner, date)`.
  3. **`RitualService` is optional**, injected via `ObjectProvider` — the whole bean disappears when
     `RITUAL_SWITCH` is off, and when it is absent the resolver yields **no** `ritual`/`wind_down`/
     `lights_out` anchor for the day, never a fabricated window.
  4. **Wake/bed anchor comes only from `SleepAnchorPort.resolve(owner)`**, which never returns
     empty (falls back to `SleepGoalProperties` defaults). The **retired** `goal.wake_time`/
     `goal.bed_time` columns are never read — `GoalService` still writes them, but every live
     consumer, including this one, reads `SleepAnchorPort`.
  5. **`medication`'s `retaDay == 0` is `MedicationCycleService`'s honest "no dose logged yet" state**
     and is treated as "no anchor today", never as cycle day zero.
- **Prose anchors excerpt, never regenerate.** `briefing`/`midday`/`weekly`/`memoir` exist only when
  their content row already exists for the day (honest absence, not a placeholder); their push body
  is a word-boundary, surrogate-safe cut of the already-generated text
  (`AnchorResolver.excerptProse`, reusing `PushSender.truncateBody`) — no LLM call happens on the
  push path at all (spec §6).
- **This is the app's first per-minute cron, and it has a test-side consequence worth knowing.**
  Leaving the dispatch-job switch on for the whole test context lets the **real** scheduler thread
  tick mid-suite and race an unrelated test class's `ResetDatabase` TRUNCATE — verified as a genuine
  Postgres deadlock (`[scheduling-1]` firing at the real wall-clock minute). The switch is therefore
  **off test-wide** (`backend/src/test/resources/application.properties`); `NotificationDispatchJobIT`
  re-enables it via its own `@TestPropertySource` (own cached context) **and additionally pins
  `dispatch-cron` to `0 0 5 31 2 ?`** (February 31st — `CronExpression` accepts it as
  legal-but-unmatchable) so the `@Scheduled` method is wired but can never fire even inside that one
  class's own isolated run — a narrower time window alone was empirically observed to still race in
  several separate `clean test` invocations, so only an unreachable cron removes it. **This is a
  test-fixture artifact, not a production hazard** — `TRUNCATE` exists nowhere in `src/main`.
- **All six operations live on one `NotificationController`, by construction.** `openapi-generator`
  emits one interface per OpenAPI tag, and every notification path shares the `Notification` tag, so
  there is no natural per-slice controller split — N1/N2/N3 all implement the same generated
  `NotificationApi`.
- **`NOTIFICATION_UNKNOWN_CATEGORY` (400) is one message code enforcing two different rules** — see
  §4's API-contract note. On `pref` it only catches a genuinely unrecognized key (every real category
  has a preference); on `schedule` it also catches a recognized-but-backend-native key
  (`NotificationScheduleService.requireFeWritten`) — the security boundary that stops a client from
  owning a minute the backend already owns (e.g. writing its own `gym` schedule row would let a
  compromised or buggy client override `AnchorResolver`'s own gym-slot anchor).
- **`useNotificationPrefs()` is a `useDualQuery`, unlike N1's `usePushSubscription()`.** N1's hook is
  deliberately device-owned (the browser is the source of truth for `enabled`); N2's prefs are
  server-owned data with a well-defined code-default fallback, so the normal dual-mode read pattern
  applies without exception.
- **`deriveProtocolAnchors`/`deriveBlocks` are the one canonical derivation of "pre-workout minus 40
  minutes"**, moved into `frontend/src/features/fuel/logic/buildProtocol.ts` (§5) specifically so
  Fuel's own timeline, this platform's schedule writer, and the settings preview can never disagree
  on the same slot's time. A second independent derivation of that offset is exactly the kind of
  drift this design was shaped to avoid.
- **Honest limits of the N3 preview/settings surface** (§2): the mockup's single "Heti terv + memoir"
  row is two real categories; the lead chip shows only for `gym`; `midday`/`memoir` sub-lines are
  fixed constants, not derived; several mockup copy specifics were dropped rather than fabricated
  (the napzárás XP total is a separate bd follow-up, not invented here).
- **N1 gotchas — unchanged, still load-bearing, kept condensed here** (full detail was already
  captured and remains accurate): the dummy VAPID default now fails loudly at first use, not
  silently; the `WEBPUSH_KEY_INVALID`/`WEBPUSH_SIGN_FAILED`/`WEBPUSH_ENCRYPT_FAILED` three-way error
  split (client-fault vs our-fault); push endpoints are capability URLs and are never logged in full
  (`WebPushClient`'s log-scrub, pinned by a `ListAppender` test); `GONE` soft-deletes the device,
  `FAILED`/`THROTTLED`/`TOO_LARGE` never prune anything; `VITE_VAPID_PUBLIC` is baked in at FE
  **build** time; a blank VAPID secret must not take the whole application down
  (`WebPushProperties`'s blank-to-placeholder normalization); `generateSW` is deliberately kept over
  `injectManifest`; the payload budget (`body-max-chars` 300, surrogate-safe truncation).
- **Deferred — deliberately out of v1, not a gap in this slice** (spec §1): quiet hours, a designed
  daily cap / priority-drop, coalescing/digest windows, state-driven (reactive) pushes
  (expiring quests, at-risk streaks, level-ups), multi-device fan-out tuning. None of these are
  "N2/N3 unfinished" — they were explicitly scoped out of v1 in the design brainstorm.

### The §6 copy rules (verbatim from the design spec — the guardrail a later slice must not regress)

> - **Never a reproach.** ADR 0010 governs push too: the Napzárás notification reads *"Ma 180 XP
>   gyűlt össze. Nézzük meg együtt."* — **not** *"4 nyitott hurok vár"*. A missed thing is never
>   reported as a failure.
> - **Never a fabricated number.** A prose push **excerpts the already-generated honest text**; it
>   never asks the LLM for new words and never invents a figure. No LLM call happens on the push
>   path at all.
> - **One tap target.** Every notification carries exactly one `deeplink` and promises exactly
>   that.
> - **The `medication` push never suggests a dose** — it reminds. The clinical guard that every
>   generator prompt inherits applies to hand-written copy as well.

These rules are enforced by convention + this doc, not by a runtime check — a new category's copy
(hand-written reminder or prose excerpt) has no excuse to invent one.

## 10. Key files

**Backend — `techcore/webpush` (the protocol, zero new dependencies, unchanged since N1)**
- `backend/src/main/java/io/mrkuhne/mezo/techcore/webpush/{WebPushProperties,VapidSigner,Aes128GcmEncryptor,WebPushClient,WebPushResult,WebPushSubscriptionKeys}.java`
- `backend/src/test/java/io/mrkuhne/mezo/techcore/webpush/{VapidSignerTest,VapidSignerCodecTest,Aes128GcmEncryptorTest,WebPushClientIT,WebPushPropertiesTest,TestWebPush}.java`

**Backend — `feature/notification`**
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/{NotificationCategory,AnchorSet,CategoryPref,DueItem,ScheduleEntry}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/{DueEvaluator,AnchorResolver,NotificationDispatchJob,PushDispatchExecutor,NotificationPrefService,NotificationScheduleService,PushSubscriptionService,PushSender}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/entity/{PushSubscriptionEntity,NotificationPrefEntity,PushLogEntity,NotificationScheduleEntity}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/repository/{PushSubscriptionRepository,NotificationPrefRepository,PushLogRepository,NotificationScheduleRepository}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/controller/NotificationController.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/config/NotificationProperties.java` — `mezo.notification.{body-max-chars,medication-time,prose-excerpt-chars,dispatch-cron,catch-up-minutes}`
- Migrations: `202607291000_mezo-h4wp.6.1_create_push_subscription.sql`, `202607291400_mezo-h4wp.6.2_create_notification_pref_and_push_log.sql`, `202607291500_mezo-h4wp.6.3_create_notification_schedule.sql` (all under `db/changelog/1.0.0/script/`, registered in `1.0.0/1.0.0_master.yml`)
- `backend/src/main/resources/messages.properties` — `WEBPUSH_KEY_INVALID`/`WEBPUSH_SIGN_FAILED`/`WEBPUSH_ENCRYPT_FAILED`/`NOTIFICATION_UNKNOWN_CATEGORY`
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `NOTIFICATION_SWITCH`, `NOTIFICATION_DISPATCH_JOB_SWITCH`
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/{AnchorResolverIT,AnchorResolverRitualSwitchOffIT,DueEvaluatorTest,NotificationApiIT,NotificationCategoryTest,NotificationDispatchJobIT,NotificationPrefApiIT,NotificationPrefRepositoryIT,NotificationScheduleApiIT,PushSenderIT,PushSubscriptionRepositoryIT,PushSubscriptionServiceIT}.java`, `feature/notification/service/{AnchorResolverExcerptTest,PushSenderTruncationTest}.java`; `support/populator/NotificationPopulator.java`; `support/ResetDatabase.java` (`notification_pref`/`push_log`/`notification_schedule` in the TRUNCATE list)

**API contract**
- `api/feature/notification/notification.yml` → merged `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts` + generated `io.mrkuhne.mezo.api.controller.NotificationApi` / `io.mrkuhne.mezo.api.dto.{PushSubscriptionRequest,PushTestResponse,NotificationPref,NotificationPrefListRequest,NotificationPrefListResponse,NotificationScheduleEntry,NotificationScheduleRequest}`

**Frontend — service worker + PWA build (N1, unchanged)**
- `frontend/public/push-sw.js`, `frontend/vite.config.ts` (`workbox.importScripts`), `frontend/.env.example` (`VITE_VAPID_PUBLIC`), `.github/workflows/deploy.yml` (same variable in `build-frontend`'s `env:`)

**Frontend — data layer**
- `frontend/src/data/notification/{notificationApi,notificationMock,notificationHooks,notificationPrefHooks,notificationScheduleWriter}.ts` — `usePushSubscription()` (N1) + `useNotificationPrefs()` (N2) + `useScheduleSnapshotWriter()`/`buildScheduleEntries()` (N3), all re-exported from `frontend/src/data/hooks.ts`
- `frontend/src/data/types.ts` — `PushSubscriptionState`/`PushErrorCode` (N1); `NotificationCategoryKey`/`NOTIFICATION_CATEGORIES`/`NotificationPrefView`/`NotificationCategoryMeta`/`NOTIFICATION_CATEGORY_META` (N2, the 11-key HU copy catalog)
- `frontend/src/app/AppLayout.tsx` — calls `useScheduleSnapshotWriter()` once per app-session mount

**Frontend — Me surface (documented from Me's side in [`me.md`](me.md) §2/§10)**
- `frontend/src/features/me/pages/NotificationsPage.tsx` (route `/me/ertesitesek`)
- `frontend/src/features/me/components/{PushInstallGate,NotificationPreviewHeader,NotificationCategoryRow}.tsx`
- `frontend/src/features/me/logic/notificationForecast.ts` — the pure `forecastToday(...)` preview computation

**Cross-feature — the shared Fuel anchor derivation (§5/§9)**
- `frontend/src/features/fuel/logic/buildProtocol.ts` — `deriveBlocks`/`deriveProtocolAnchors` (moved here from `data/fuel/timelineHooks.ts`, which re-exports `deriveBlocks` for backward compatibility)

**Docs (link, don't duplicate)**
- Spec: [`docs/superpowers/specs/2026-07-29-push-notifications-design.md`](../superpowers/specs/2026-07-29-push-notifications-design.md)
- ADR: [`docs/decisions/0014-own-webpush-implementation.md`](../decisions/0014-own-webpush-implementation.md)
- Infra: [`docs/infrastructure/deployment-k3s-argocd.md`](../infrastructure/deployment-k3s-argocd.md) (VAPID secret + egress + `TZ`)
- References: [`docs/references/`](../references/) (`configuration_conventions`, `liquibase_conventions`, `api_contract_conventions`, `spring_patterns`, `testing_standards`)
- Roadmap: [`docs/milestones/roadmap.md`](../milestones/roadmap.md) — Phase-4's Web Push line is now shipped, not deferred
- Epic: [`docs/features/proactive.md`](proactive.md) — the `mezo-h4wp` epic-status table's H2 row
