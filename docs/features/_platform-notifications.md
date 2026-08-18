---
title: Push Notifications Platform
type: feature-platform
status: mixed
updated: 2026-08-18
tags: [platform, notification, backend, frontend, pwa, proactive, security]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/techcore/webpush
  - backend/src/main/java/io/mrkuhne/mezo/feature/notification
  - backend/src/main/java/io/mrkuhne/mezo/feature/appnotification
  - api/feature/notification/notification.yml
  - frontend/public/push-sw.js
  - frontend/src/data/notification
  - frontend/src/features/notification
  - frontend/src/data/notification/feedHooks.ts
  - frontend/src/features/me/pages/NotificationsPage.tsx
  - backend/src/main/resources/db/changelog/1.0.0/script/202607291000_mezo-h4wp.6.1_create_push_subscription.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607291400_mezo-h4wp.6.2_create_notification_pref_and_push_log.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607291500_mezo-h4wp.6.3_create_notification_schedule.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202608181400_mezo-gzhp.1_create_app_notification.sql
related: [proactive, today, ritual, me, fuel, insights, _platform-api-backend]
---

# Push Notifications Platform — Feature Documentation

> Cross-cutting delivery layer, no route/tab of its own (the FE surface lives at `/me/ertesitesek`,
> documented from Me's side in [`me.md`](me.md)). **Push (N1/N2/N3): DONE** — N1 delivery spine + N2
> dispatcher/prefs + N3 FE-schedule/preview are all shipped; all 20 categories are live (11 at N3
> ship, +3 companion-feed categories — `evening`/`sleep_reaction`/`weight_reaction` — once
> `AnchorResolver`'s five prose anchors moved onto the unified `companion_message` table,
> mezo-gst9; +6 feed-anchored categories — `pattern`/`knowledge`/`prediction`/`experiment`/
> `challenge`/`memory` — once the in-app feed was wired as a push source, mezo-gzhp.3). A real Web Push
> reached Daniel's iPhone from the k3s backend on 2026-07-29 (N1's exit criterion, confirmed by
> Daniel — bd `mezo-h4wp.6.1`) — real-world delivery is proven, not just unit-tested. This is the
> slice that completes the `mezo-h4wp` proactive epic's long-deferred **H2** item — see
> [`proactive.md`](proactive.md) and [`roadmap.md`](../milestones/roadmap.md).
>
> **In-app feed (F1/F2/F3, bd `mezo-gzhp`): F1 + F2 + F3 all DONE.** A second, sibling
> delivery layer sits alongside push: an `app_notification` outbox table + a bell/panel FE surface
> in `AppHero`, fed by the AI-brain "pattern engine"/companion/proactive/insights domains rather
> than by `AnchorResolver`'s anchors — the whole in-app-feed backend now lives in its own
> **`feature/appnotification`** package (moved out of `feature/notification` during F2 to break a
> `companion`↔`notification`↔`proactive` package cycle, bd `mezo-gzhp.1`/`mezo-gzhp.2`). F1
> (2026-08-18) shipped the outbox, the feed API, the bell+panel UI, and the first **3 pattern-family
> emit sites** (`pattern_inbox`/`pattern_signal`/`fact_reinforced` — see [`insights.md`](insights.md)
> §5). **F2** (2026-08-18, bd `mezo-gzhp.2`) wired the remaining **9 emit sites** across
> `FactExtractionService`, `HypothesisPipelineService`, `MemoirGenerator`, `PredictionGenerator`,
> `PredictionValidationService`, `ExperimentProposalGenerator`, `ExperimentOutcomeService`,
> `ChallengeGenerator`, `ChallengeOutcomeEvaluator` and `DailySummaryService` — **all 12
> `AppNotificationKind`s now emit** (§3a/§4/§5). **F3** (2026-08-18, bd `mezo-gzhp.3`) wired the
> remaining piece: the `NotificationCategory` catalog grew **14→20** (6 new feed-anchored, family-level
> categories — `pattern`/`knowledge`/`prediction`/`experiment`/`challenge`/`memory`, all default ON,
> lead 0, not `feWritten`) and `AnchorResolver.feedAnchors(...)` now maps every one of today's
> `app_notification` rows onto a push anchor (minute = max(event minute, wake minute), so the
> overnight 02:20-03:00 pattern-motor run defers to wake while daytime events push on their own
> minute), reusing the row's own stored title/body verbatim (§2/§3/§3a/§4/§9 below).

## 1. Summary

mezo's proactive layer (`companion_message`/`weekly_suggestion`/`memoir` — `companion_message`
replaced the retired `briefing`/`heartbeat_note` tables, `mezo-gst9`; see
[`proactive.md`](proactive.md)) generates content on crons (+ two event-triggered kinds); this
platform layer delivers it — plus a
second feed of time-anchored reminders the app's own data already implies (gym start, sleep wind-down
+ lights-out, the medication cycle day, the 4 daily check-ins, the fuel/stack slots) — to Daniel's
iPhone **with the app closed**. It is a Web Push (RFC 8030/8291/8292) stack the backend owns end to
end, plus the FE opt-in/settings surface and service-worker handlers.

**Driving spec:** [`docs/superpowers/specs/2026-07-29-push-notifications-design.md`](../superpowers/specs/2026-07-29-push-notifications-design.md)
(§3 architecture, §5 data model, §6 the (now 20-)category catalog + copy rules, §7 frontend, §9 switches,
§13 risks). **ADR:** [`0014-own-webpush-implementation.md`](../decisions/0014-own-webpush-implementation.md)
(why the protocol is hand-rolled). **Driver:** `mezo-h4wp.6` — N1 `mezo-h4wp.6.1`, N2 `mezo-h4wp.6.2`,
N3 `mezo-h4wp.6.3` — all three slices shipped.

**The in-app feed is a separate initiative, driving spec + driver:**
[`docs/superpowers/specs/2026-08-18-notification-center-design.md`](../superpowers/specs/2026-08-18-notification-center-design.md)
(approved 2026-08-18, A-variant mockup approved) / plan
[`docs/superpowers/plans/2026-08-18-notification-center.md`](../superpowers/plans/2026-08-18-notification-center.md).
**Driver:** `mezo-gzhp` — F1 `mezo-gzhp.1`, F2 `mezo-gzhp.2` and F3 `mezo-gzhp.3` (this update) all
shipped; the epic is complete.

**Status per layer:**
- **Backend `techcore/webpush`:** done (unchanged since N1) — VAPID ES256 signing, RFC 8291
  `aes128gcm` encryption, the outbound HTTP client. Zero new Maven dependencies.
- **Backend `feature/notification`:** done — three tables beyond N1's `push_subscription`:
  `notification_pref` + `push_log` (N2), `notification_schedule` (N3). The `NotificationCategory`
  enum (§4) is the **20-key catalog** (11 at N3 ship, +`evening`/`sleep_reaction`/`weight_reaction`
  mezo-gst9, +6 feed-anchored categories mezo-gzhp.3 — `pattern`/`knowledge`/`prediction`/
  `experiment`/`challenge`/`memory`). **`DueEvaluator`** (pure) + **`AnchorResolver`** (impure, reads
  three anchor sources — `AnchorResolver.feedAnchors(...)`, F3's `app_notification` reader, folds
  into `backendAnchors` rather than adding a fourth list) feed **`NotificationDispatchJob`**, a
  per-minute cron that hands the actual
  send to **`PushDispatchExecutor`**'s `@Async` method (§9 — the single most important gotcha in
  this feature). One `NotificationController` implements all six operations (subscribe/unsubscribe/
  test-push/pref-get/pref-put/schedule-put) — `openapi-generator` emits one interface per tag, so
  there is no per-slice controller to split this across.
- **Frontend:** done — `usePushSubscription()` (N1, device-owned, unchanged) +
  `useNotificationPrefs()` (N2, **server-owned**, `useDualQuery` — unlike N1's hook) +
  `useScheduleSnapshotWriter()` (N3, write-only, fire-and-forget, wired into `AppLayout.tsx`) feed
  the full `NotificationsPage` settings screen: the live volume-preview header + the iOS install-gate
  + a **three-section**, per-category toggle list with lead chips where meaningful — the third
  section, "Az agy eseményei" (F3, bd `mezo-gzhp.3`), holds the 6 feed-anchored family toggles.
- **Real-world delivery:** proven end to end, not merely unit-tested — a real push reached Daniel's
  iPhone from the k3s backend on 2026-07-29 (N1's exit criterion; bd `mezo-h4wp.6.1` notes "confirmed
  by Daniel"). N2/N3 build the dispatcher and the last two categories' feed on top of that proven
  path.
- **In-app feed `feature/appnotification` (F1 bd `mezo-gzhp.1` + F2 bd `mezo-gzhp.2`, new package,
  new table, new switch):** **done** — `app_notification` outbox (§4), the 12-kind
  `AppNotificationKind` catalog (§4), `AppNotificationService` (emit/feed/markAllRead, gated on
  `NOTIFICATION_FEED_SWITCH`), and the always-on `AppNotificationEmitter` facade every producer
  injects (§9). **All 12 kinds now emit** — F1 wired the 3 pattern-family sites (§3a/§5), F2 wired
  the remaining 9 across the proactive/companion generators (§3a/§5). **F3 (bd `mezo-gzhp.3`) is also
  done** — every `familyKey` now maps onto one of the 6 new push categories and
  `AnchorResolver.feedAnchors(...)` pushes each of today's rows (§3a/§4/§9). The package was moved out of
  `feature/notification` into its own `feature/appnotification` during F2, to break a
  `companion`↔`notification`↔`proactive` dependency cycle the new producers would otherwise have
  created. The push-category mapping (F3, bd `mezo-gzhp.3`) is now also built (§3b/§4).
- **Frontend in-app feed (F1):** done — `useNotificationFeed()`/`useNotificationFeedActions()`
  (`useDualQuery`, §6) feed a new `features/notification/` bell + dropdown panel, wired as the 4th
  `AppHero` counter chip (§2).

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
3. **The category list**, now **three sections** (mockup direction C, extended by F3 bd
   `mezo-gzhp.3`), rendered in this order: **"Mezo megszólal"** (the prose
   categories — `briefing`/`midday`/`evening`/`weekly`/`memoir`/`sleep_reaction`/`weight_reaction`,
   mezo-gst9 added the last three), **"Az agy eseményei"** (F3 — the 6 feed-anchored, family-level
   categories — `pattern`/`knowledge`/`prediction`/`experiment`/`challenge`/`memory` — one toggle per
   `AppNotificationKind` family, `NOTIFICATION_CATEGORY_META`'s `section: 'brain'` entries), and
   **"Emlékeztetők"** (the reminder
   categories — `gym`/`medication`/`ritual`/`lights_out`/`wind_down`/`checkin`/`fuel_slot`). Each row
   (`NotificationCategoryRow.tsx`) is a toggle + a live, per-day sub-line derived from data the page
   already holds (e.g. `"ma 17:00 · Láb nap"` for `gym`, `"szerda · D3"` for `medication`) — falling
   back to the static `NOTIFICATION_CATEGORY_META` description when the day genuinely has no anchor
   (no session today, not a dose day). The 6 "Az agy eseményei" rows have no per-day derivation (an
   in-app-feed event has no daily schedule to preview), so they always show the static description.
   **Only `gym` shows a lead-minute chip** (`"−30 perc"`) — it is
   the sole category with a non-zero `leadMinutes`; a chip on any other row would expose a number the
   backend ignores (dishonest control, spec §6/§9).

**Honest limits, stated plainly:** the mockup's single "Heti terv + memoir" settings row is actually
**two independent rows/categories** (`weekly`, `memoir`) in the real 20-key catalog — the mockup
compressed them for space, the catalog does not. `midday` and `memoir` keep the mockup's **fixed
static sub-lines** (their anchors are not per-day data, so there is nothing to derive). **Known
15-minute drift in that FE copy:** since the prose-generation grace (§9 trap #6) moved the real
anchors to 12:45 / 19:15, `memoir`'s `NOTIFICATION_CATEGORY_META.description` (`"Vasárnap este
19:00"`) and `notificationForecast.ts`'s `MIDDAY_HHMM`/`MEMOIR_HHMM` preview constants now name a
minute 15 minutes before the push actually arrives. `midday`/`weekly`/`briefing` copy is vague
enough ("Dél körül", "Hétfő reggel, ébredéskor") to stay true, and the preview's sparkline buckets by
hour so it is unaffected — only `memoir`'s literal `19:00` and the dense-window minutes are off.
Left deliberately unchanged in the fix wave (backend-config-derived minutes should not be
re-hardcoded on the FE); the honest fix is to serve the resolved anchor rather than mirror it. Several mockup copy specifics were **deliberately dropped** because
supplying them would mean inventing a number the spec's §6 copy rules forbid — e.g. the napzárás
notification's XP total is tracked as a separate follow-up bd issue, not fabricated here.

### 2a. In-app feed: bell + panel (F1, bd `mezo-gzhp.1`)

**No route of its own — lives in the `AppHero` header, on every one of the 5 sections.**
`NotificationBell.tsx` is the **4th `.counters` chip** (after 🔥 streak, ⚡ quest, 🪙 coins), so it
renders once per app session, not per tab. Tap → snapshot which ids are currently unread (for the
open panel's dots), fire `markAllRead()`, then open `NotificationPanel.tsx` — **classic bell
semantics**: the badge clears the moment the panel opens, but the dots on the just-read rows persist
until the panel closes (the snapshot, not the live cache, drives the dot). The panel is the A-variant
mockup direction (approved 2026-08-18): an `SubNavDropdown`-style dropdown with a lazy backdrop
portalled into `.phone-screen`, grouped **Ma / Tegnap / Korábban** (`groupByDay.ts`, pure, day-bucketed
off `occurredAt`), each row showing the kind's emoji/tint (`APP_NOTIFICATION_KIND_META`), title, body,
and a relative time; tapping a row closes the panel and `navigate(deeplink)`s. **There is no per-item
read endpoint** — opening the panel is the only "read" action, by design (§9).

## 3. Architecture & data flow

```
[FE opt-in — Me → Értesítések, unchanged from N1]
    Notification.requestPermission() → …pushManager.subscribe(…)
    → POST /api/notification/subscription   → push_subscription

[FE app-open — N3, useScheduleSnapshotWriter(), wired into AppLayout.tsx (the root route element,
 mounts exactly once per app session)]
    buildScheduleEntries(checkins, slots)   — checkin + fuel_slot only (slots: StackDaySlot[], mezo-vx9v)
    → PUT /api/notification/schedule { categories: [...derived from entries], entries }
    → notification_schedule (per-category full replace: soft-delete the category's live rows,
      insert the new set)

[NotificationDispatchJob]  @Scheduled(cron = "${mezo.notification.dispatch-cron}")  # every minute
    for every AppUser (per-user try/catch — one broken user never aborts the run):
    1. AnchorResolver.resolve(owner, today)       → AnchorSet{backendAnchors, proseAnchors, scheduleAnchors}
         a) backend-native   gym_schedule_slot/sport_schedule_slot · medication cycle ·
                              RitualService (opensAt/prepStartsAt/bedTime), optional via ObjectProvider
         b) prose readiness  companion_message(morning/midday/evening/sleep/weight) row EXISTS for
                              the day (mezo-gst9 — replaced the briefing/heartbeat_note reads) OR
                              weekly_suggestion/memoir row EXISTS → excerpted (never a new LLM
                              call); the cron-anchored ones (morning/midday/evening/weekly/memoir)
                              are pushed PAST their own generator's cron minute when the two
                              collide (§9 trap #6); the event-kind ones (sleep_reaction/
                              weight_reaction) anchor on the row's OWN generation minute instead —
                              there is no generator cron to collide with
         c) FE snapshot       today's live notification_schedule rows (weekday match or NULL=every day),
                              each row's category + time individually guarded (§9 trap #7)
    2. NotificationPrefService.effectiveFor(owner)  → all 20 categories, stored row or code default
    3. DueEvaluator.due(nowMinute, prefs, anchors, catchUpMinutes)   — PURE, no collaborators
         fires when nowMinute − (anchorMinute − leadMinutes) ∈ [0, catchUpMinutes)
         — a BACKWARD window: on time, plus (catchUpMinutes − 1) recovered LATE minutes
    4. push_log dedup on (created_by, log_date, dedup_key)  → already sent today: skip
    5. writeLog(...) THEN pushDispatchExecutor.dispatch(...)   — log BEFORE the async send, always
    6. [PushDispatchExecutor, @Async, separate bean]  → PushSender.sendToAllDevices(...) → WebPushClient

[Service worker — public/push-sw.js, unchanged from N1]
    'push'              → showNotification(title, {body, icon, badge, tag, data: url})
    'notificationclick' → focus an existing window, else openWindow(data.url)
```

**Generation and delivery stay separate.** The 18+ existing proactive/habit crons keep writing
content on their own schedule, untouched; `NotificationDispatchJob` only decides *when it leaves*.
Zero changes to `BriefingJob`/`HeartbeatJob`/`WeeklySuggestionJob`/`MemoirJob`/`CompanionMessageJob`
themselves — mezo-gst9 only repointed `AnchorResolver`'s five prose reads at `companion_message`
(the `CompanionMessageJob`'s output table, `feed.{morning,midday,evening}-cron` + sleep/weight
event triggers — see [`proactive.md`](proactive.md)); `BriefingJob`/`HeartbeatJob` keep running in
parallel for now (both switches stay on) and are retired in a later task.

**The scheduler-pool-of-1 + async handoff is the load-bearing shape of this whole slice** — see §9
for why `PushDispatchExecutor` must be a separate `@Component`, not a private method.

### 3a. In-app feed emit flow (F1 bd `mezo-gzhp.1` + F2 bd `mezo-gzhp.2`) — a separate, simpler pipeline

No cron, no scheduler-pool concern — a producer emits **synchronously, inline**, at the moment the
event happens. F1 wired one producer (`PatternDetectionService`); F2 wired the other nine
`feature/companion`/`feature/proactive` generators, so all 12 `AppNotificationKind`s now have a live
emit site:

```
[Producer — F1: PatternDetectionService, feature/companion/service/]
    upsert(...)             → new/re-detected pattern passes the strength gate
        → AppNotificationEmitter.emit(owner, PATTERN_INBOX, title, body, deeplink, refId,
                                       "pattern_inbox:{pairKey}")
    recordSnapshot(...)     → a band crossing (|r| crosses 0.3/0.6) on a still-undecided
                               (proposed/monitoring) row
        → AppNotificationEmitter.emit(owner, PATTERN_SIGNAL, ..., "pattern_signal:{pairKey}:{date}")
    reinforcePromotedFact(...) → a CONFIRMED pattern re-detected in the same direction
        → AppNotificationEmitter.emit(owner, FACT_REINFORCED, ..., "fact_reinforced:{factId}:{count}")

[Producers — F2, feature/companion/service/ + feature/proactive/service/]
    FactExtractionService         → a new learned-fact candidate persists
        → emit(FACT_CANDIDATE, ..., "fact_candidate:{candidateId}")
    FactExtractionService         → the chat re-confirms an already-CONFIRMED fact (a SECOND,
                                     independent FACT_REINFORCED source alongside
                                     PatternDetectionService.reinforcePromotedFact above)
        → emit(FACT_REINFORCED, ..., "fact_reinforced:{factId}:{reinforcementCount}")
    HypothesisPipelineService     → a new AI hypothesis persists
        → emit(HYPOTHESIS_NEW, ..., "hypothesis_new:{pairKey}")
    MemoirGenerator                → the weekly memoir persists
        → emit(MEMOIR_READY, ..., "memoir_ready:{weekStart}")
    PredictionGenerator            → each new prediction persists
        → emit(PREDICTION_NEW, ..., "prediction_new:{predictionId}")
    PredictionValidationService    → a prediction closes (validated or missed)
        → emit(PREDICTION_OUTCOME, ..., "prediction_outcome:{predictionId}")
    ExperimentProposalGenerator    → each new experiment proposal persists
        → emit(EXPERIMENT_PROPOSED, ..., "experiment_proposed:{experimentId}")
    ExperimentOutcomeService       → an experiment closes
        → emit(EXPERIMENT_CLOSED, ..., "experiment_closed:{experimentId}")
    ChallengeGenerator             → a workout micro-challenge is proposed
        → emit(CHALLENGE_EVENT, ..., "challenge_proposed:{challengeId}")
    ChallengeOutcomeEvaluator      → a challenge resolves (both the inconclusive-timeout path and
                                     the hit/miss path)
        → emit(CHALLENGE_EVENT, ..., "challenge_closed:{challengeId}")
    DailySummaryService            → the daily narrative persists and is embedded
        → emit(MEMORY_NOTE, ..., "memory_note:{date}")

[AppNotificationEmitter — the ALWAYS-ON facade, every producer injects this, never the service —
 feature/appnotification/service/ (moved out of feature/notification in F2, §9)]
    catches EVERYTHING (including the service bean not existing when the switch is off)
    → AppNotificationService.emit(...)   [@Transactional(REQUIRES_NEW)]
         exists-check on (created_by, dedup_key) → true: no-op, return
         else: INSERT, catching DataIntegrityViolationException from the partial unique index
               (the cron-vs-lazy-GET race — same event generated twice concurrently)
    → app_notification row (kind/title/body/deeplink/ref_id/dedup_key/occurred_at)

[FE — GET /api/notification/feed on demand]
    useNotificationFeed()   — useDualQuery, real pre-resolve = empty list, refetches on window
                              focus / app open (TanStack default, no polling)
    NotificationBell open   → POST /api/notification/feed/read-all  (markAllRead, optimistic)
```

**`CHALLENGE_EVENT` is the one kind with two independent producers for two different lifecycle
moments** — `ChallengeGenerator` fires it when a challenge is *proposed*, `ChallengeOutcomeEvaluator`
fires the same kind when it is *closed*, distinguished only by the `challenge_proposed:`/
`challenge_closed:` dedup-key prefix (not a separate kind — both moments deeplink to the same
`/train`). **`FACT_REINFORCED` similarly now has two independent producers**
(`PatternDetectionService.reinforcePromotedFact` and `FactExtractionService`'s chat-side
reinforcement branch) sharing one dedup-key shape (`"fact_reinforced:{factId}:{count}"`), so the two
sources can never double-notify the same reinforcement count.

**Copy is composed once, at emit time, in the producer** (Hungarian, following the same §6 copy
rules as push) — never re-derived on read. This is deliberate: **F3** (bd `mezo-gzhp.3`) has the push
dispatcher send this **same stored `body`** verbatim (`AnchorResolver.feedAnchors(...)`, below), so
the in-app feed and its push for the same event can never say two different things.

### 3b. F3 — feed rows as a push source (bd `mezo-gzhp.3`)

`AnchorResolver.feedAnchors(owner, date)` reads today's `app_notification` rows and turns each into
a push `AnchoredEvent`, folded into `backendAnchors` (§3):

```
for each app_notification row occurring today:
    kind = AppNotificationKind.fromKey(row.kind)
    skip if kind unknown (forward-compat) OR kind.familyKey() == null (memoir_ready — the
         existing `memoir` category already covers that event, §4)
    category = NotificationCategory.fromKey(kind.familyKey())   # pattern/knowledge/prediction/
                                                                  # experiment/challenge/memory
    minute = max(row.occurredAt's own minute, wake minute)       # overnight 02:20-03:00 pattern-
                                                                  # motor events defer to wake (the
                                                                  # briefing precedent); daytime
                                                                  # events push on their own minute
    dedupSuffix = "HH:mm:" + first 8 chars of row.id             # NOT "{category}:{HHmm}" — that
                                                                  # would collapse same-family
                                                                  # wake-deferred events into one
                                                                  # push; every event must push
                                                                  # (user decision)
    url = row.deeplink + ("?" or "&") + "n=" + first 8 chars of row.id   # push-sw.js uses the url
                                                                  # as the notification tag — a
                                                                  # shared deeplink would replace
                                                                  # an undismissed push (the
                                                                  # check-in bug class, §9)
    title, body = row.title, row.body verbatim                  # single copy source (§3a)
```

No new content is generated on the push path — the row's own copy is reused verbatim, the same
"excerpt, never regenerate" discipline the prose anchors already follow (§9).

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
(`NotificationCategory.defaultEnabled()`/`defaultLeadMinutes()`) for every one of the 20 keys, always
— so a fresh install needs no seed data and a future 21st category ships with its intended default
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
| `deeplink varchar(200) not null` · `source varchar(24) not null` | provenance, e.g. `projectStackDay` (was `buildProtocol` — mezo-vx9v Task 9), `checkinSlots` |

**Deliberately no unique index** — `idx_notification_schedule_created_by_category` is a plain index;
a category legitimately holds many rows at once (one per weekday × time). Replace is per-category:
soft-delete the category's live rows + insert the new set in one `@Transactional` (the briefing
regeneration precedent — a soft-deleted row never blocks reinsertion). **Only
`NotificationCategory.feWritten()` categories are accepted** (`checkin`, `fuel_slot`) — checked on
both the `categories` list and every entry, in `NotificationScheduleService.requireFeWritten`
(`feature/notification/service/NotificationScheduleService.java:73-79`) — letting a client write a
backend-native category's schedule (`gym`, `ritual`, …) would create a second source of truth for a
minute the backend already owns.

### `NotificationCategory` — the 20-key catalog (`feature/notification/domain/NotificationCategory.java`)

The single source of truth for which categories exist, their default enabled/lead, and which are
FE-written — pinned by `NotificationCategoryTest` against spec §6. The last 6 rows (bd
`mezo-gzhp.3`) are the feed-anchored, family-level categories: they carry no anchor of their own in
`AnchorResolver`'s backend-native sense — their "anchor" is whichever `app_notification` row of that
family occurred today, wake-deferred (`AnchorResolver.feedAnchors(...)`, §3b):

| # | Key | Default | Lead | FE-written | Anchor |
|---|---|---|---|---|---|
| 1 | `briefing` | ON | 0 | no | `SleepAnchorPort.resolve(user).wake()`; body from `companion_message` kind=`morning` (was `briefing` table — mezo-gst9), title `"Mezo · reggeli eligazítás"` |
| 2 | `gym` | ON | **30 min** | no | `gym_schedule_slot.time` / `sport_schedule_slot.time` |
| 3 | `medication` | ON | 0 | no | `mezo.notification.medication-time` (08:00) on a cycle day |
| 4 | `ritual` | ON | 0 | no | `RitualService` `opensAt` |
| 5 | `lights_out` | ON | 0 | no | `RitualService` `bedTime` |
| 6 | `weekly` | ON | 0 | no | Monday, wake anchor — **or `weekly.cron` + grace when wake lands at/before it** (→ 06:15 for a default 06:00 waker; §9 trap #6) |
| 7 | `memoir` | ON | 0 | no | Sunday, **`memoir.cron` + grace = 19:15** (preferred slot 19:00) |
| 8 | `wind_down` | OFF | 0 | no | `RitualService` `prepStartsAt` |
| 9 | `midday` | OFF | 0 | no | **`feed.midday-cron` + grace = 12:45** (preferred slot 12:30); `companion_message` kind=`midday` (was `heartbeat_note` — mezo-gst9) |
| 10 | `checkin` | OFF | 0 | **yes** | FE snapshot (`data/today/checkins.ts`) |
| 11 | `fuel_slot` | OFF | 0 | **yes** | FE snapshot (`projectStackDay` — the living-protocol zone-timeline projection, was `buildProtocol` before mezo-vx9v Task 9) |
| 12 | `evening` | ON | 0 | no | **`feed.evening-cron` + grace = 20:45** (preferred slot 20:30); `companion_message` kind=`evening`, title `"Mezo · napzárás"` (mezo-gst9) |
| 13 | `sleep_reaction` | ON | 0 | no | `companion_message` kind=`sleep` row's OWN `generatedAt` minute — no cron/grace, it fires off a sleep-log event, title `"Mezo · alvás"` (mezo-gst9) |
| 14 | `weight_reaction` | ON | 0 | no | `companion_message` kind=`weight` row's OWN `generatedAt` minute — no cron/grace, it fires off a weight-log event, title `"Mezo · testsúly"` (mezo-gst9) |
| 15 | `pattern` | ON | 0 | no | a feed-sor saját perce, wake-halasztással — `AppNotificationKind.PATTERN_INBOX`/`PATTERN_SIGNAL`/`HYPOTHESIS_NEW`'s `app_notification` rows (mezo-gzhp.3) |
| 16 | `knowledge` | ON | 0 | no | a feed-sor saját perce, wake-halasztással — `AppNotificationKind.FACT_CANDIDATE`/`FACT_REINFORCED`'s `app_notification` rows (mezo-gzhp.3) |
| 17 | `prediction` | ON | 0 | no | a feed-sor saját perce, wake-halasztással — `AppNotificationKind.PREDICTION_NEW`/`PREDICTION_OUTCOME`'s `app_notification` rows (mezo-gzhp.3) |
| 18 | `experiment` | ON | 0 | no | a feed-sor saját perce, wake-halasztással — `AppNotificationKind.EXPERIMENT_PROPOSED`/`EXPERIMENT_CLOSED`'s `app_notification` rows (mezo-gzhp.3) |
| 19 | `challenge` | ON | 0 | no | a feed-sor saját perce, wake-halasztással — `AppNotificationKind.CHALLENGE_EVENT`'s `app_notification` rows (mezo-gzhp.3) |
| 20 | `memory` | ON | 0 | no | a feed-sor saját perce, wake-halasztással — `AppNotificationKind.MEMORY_NOTE`'s `app_notification` rows (mezo-gzhp.3) |

**`memoir_ready` deliberately has no row here** — its `familyKey()` is `null`, so it never reaches
`feedAnchors(...)`; the existing `memoir` category (row 7) already covers that event as a push, and
giving it a second category would double-notify the same moment (§4/§9, `AppNotificationKindTest`
pins the null).

**Only `gym` carries a non-zero `defaultLeadMinutes()`.** The ritual-family categories
(`ritual`/`lights_out`/`wind_down`) resolve their windows through `RitualService`, which already owns
`mezo.ritual.lead-min`/`prep-lead-min` — duplicating those offsets under `mezo.notification` would be
a second source of truth for the same minute (class javadoc, `NotificationCategory.java:12-17`).

### `feature/notification` classes

| Class | Responsibility |
|---|---|
| `NotificationCategory` | the 20-key catalog enum (above) |
| `DueEvaluator` | **pure**, no collaborators — a **backward** window: `nowMinute − (anchorMinute − lead) ∈ [0, catchUpMinutes)`, i.e. on time plus one recovered late minute at the default width 2 (§9). Deliberately does not normalize a negative fire minute into the previous evening — the honest answer for such a combination is that it never fires |
| `AnchorResolver` | the impure half — resolves all 20 categories' anchors for one owner+day into an `AnchorSet`; see §9 for its seven documented traps |
| `NotificationDispatchJob` | the per-minute `@Scheduled` cron — DB-only on the scheduler thread, hands the send to `PushDispatchExecutor` |
| `PushDispatchExecutor` | the `@Async` send handoff — a **separate bean** (§9) |
| `NotificationPrefService` | `effectiveFor` (all 20, code-default fallback) + `upsert` (per-category, blind-insert-safe) |
| `NotificationScheduleService` | `replace` (per-category full replace, `feWritten`-gated) + `liveFor` (the dispatcher's read) |
| `NotificationController` | implements `NotificationApi` — all six push operations, thin delegation |
| `PushSubscriptionService` / `PushSender` | N1, unchanged |

### `feature/appnotification` classes (F1 bd `mezo-gzhp.1` + F2 bd `mezo-gzhp.2`)

Moved out of `feature/notification` in F2 to break a `companion`↔`notification`↔`proactive` package
cycle once both domains needed to inject the emitter (§9).

| Class | Responsibility |
|---|---|
| `AppNotificationKind` | the 12-kind in-app catalog (§4) — all 12 wired to a producer as of F2 |
| `AppNotificationService` | `emit` (`REQUIRES_NEW`, dedup-idempotent), `feed(limit)`, `markAllRead` — gated on `NOTIFICATION_FEED_SWITCH` |
| `AppNotificationEmitter` | the always-on facade every producer injects — absorbs every exception (§9) |
| `NotificationFeedController` | implements `NotificationFeedApi` — the two feed operations, thin delegation |

### `app_notification` (F1, bd `mezo-gzhp.1`)

Migration: [`202608181400_..._create_app_notification.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608181400_mezo-gzhp.1_create_app_notification.sql).

| Column | Notes |
|---|---|
| `kind varchar(32) not null` | the `AppNotificationKind` wire key; no DB CHECK — validated in code |
| `title varchar(120) not null` · `body varchar(300)` | composed once, at emit time, by the producer (§3a) |
| `deeplink varchar(200) not null` | one tap target, same §6 copy rule as push |
| `ref_id uuid` | nullable — the domain row the notification is about (a pattern id, a fact id, …) |
| `dedup_key varchar(80) not null` | the occurrence identity, e.g. `pattern_inbox:{pairKey}`, `pattern_signal:{pairKey}:{date}`, `fact_reinforced:{factId}:{count}` |
| `occurred_at timestamptz not null default now()` | drives feed order and Ma/Tegnap/Korábban grouping |
| `read_at timestamptz` | null = unread; stamped in bulk by `markAllRead` (classic bell — no per-item read) |

`uq_app_notification_created_by_dedup_key` (partial, live rows only) — makes `emit` **idempotent**
across the cron-vs-lazy-GET double-generation race a future producer may have (F1's own producer,
`PatternDetectionService`, runs inline rather than on a cron, so it does not itself hit this race
today — the index is there because a later F2 producer will). `idx_app_notification_created_by_occurred_at`
serves the feed read (`created_by, occurred_at desc`).

### `AppNotificationKind` — the 12-kind catalog (`feature/appnotification/domain/AppNotificationKind.java`)

The single source of truth for the in-app feed's kind key, its push `familyKey`, and its
deeplink base — pinned by `AppNotificationKindTest`. **All 12 rows are wired to a producer as of F2**
(bd `mezo-gzhp.2`), and **every non-null `familyKey` now maps onto a live push category as of F3**
(bd `mezo-gzhp.3`, §3b/§4) — the catalog is complete end to end.

| Key | familyKey (→ push category, F3) | Deeplink base | Producer |
|---|---|---|---|
| `pattern_inbox` | `pattern` | `/insights/patterns/{pairKey}` | F1 — `PatternDetectionService.upsert` |
| `pattern_signal` | `pattern` | `/insights/patterns/{pairKey}` | F1 — `PatternDetectionService.recordSnapshot` |
| `hypothesis_new` | `pattern` | `/insights` | F2 — `HypothesisPipelineService` |
| `fact_candidate` | `knowledge` | `/insights/knowledge` | F2 — `FactExtractionService` |
| `fact_reinforced` | `knowledge` | `/insights/knowledge` | F1 — `PatternDetectionService.reinforcePromotedFact`; **also F2** — `FactExtractionService`'s chat-side reinforcement branch (two independent producers, one dedup-key shape, §3a) |
| `memoir_ready` | **null** | `/insights/memoir` | F2 — `MemoirGenerator` — familyKey is null *by design*: the existing `memoir` push category already covers this event, so a second push category would double-notify |
| `prediction_new` | `prediction` | `/insights/predictions` | F2 — `PredictionGenerator` |
| `prediction_outcome` | `prediction` | `/insights/predictions` | F2 — `PredictionValidationService` |
| `experiment_proposed` | `experiment` | `/insights/experiments` | F2 — `ExperimentProposalGenerator` |
| `experiment_closed` | `experiment` | `/insights/experiments` | F2 — `ExperimentOutcomeService` |
| `challenge_event` | `challenge` | `/train` | F2 — `ChallengeGenerator` (proposed) **and** `ChallengeOutcomeEvaluator` (closed) — one kind, two lifecycle moments, distinguished only by dedup-key prefix (§3a) |
| `memory_note` | `memory` | `/insights/memoria` | F2 — `DailySummaryService` |

### API contract (`api/feature/notification/notification.yml`)

| Verb | Path | Slice | Notes |
|---|---|---|---|
| `POST`/`DELETE` | `/api/notification/subscription` | N1 | unchanged |
| `POST` | `/api/notification/test` | N1, dev-only | unchanged |
| `GET` | `/api/notification/pref` | N2 | all 20 categories, always complete — a category with no stored row reports its code default |
| `PUT` | `/api/notification/pref` | N2 | upsert one or more; `400 NOTIFICATION_UNKNOWN_CATEGORY` on an unrecognized key |
| `PUT` | `/api/notification/schedule` | N3 | replaces the named categories' live rows; `400 NOTIFICATION_UNKNOWN_CATEGORY` on an unrecognized key **or a known-but-backend-native one** |
| `GET` | `/api/notification/feed?limit=` | F1 | `limit` 1..100, default 50; newest first; items `id`/`kind`/`title`/`body`/`deeplink`/`occurredAt`/`readAt` |
| `POST` | `/api/notification/feed/read-all` | F1 | `204`; marks every unread row read — no per-item read endpoint (§9) |

**All six push operations live on one `NotificationController`** — `openapi-generator` emits one
interface per OpenAPI `tag`, and every push path in `notification.yml` shares the `Notification` tag,
so there is no natural per-slice controller boundary to split N1/N2/N3 across. **The two feed
operations get their own `NotificationFeed` tag → `NotificationFeedController`** — a deliberately
separate tag/controller pair, since the feed is a different resource (`/api/notification/feed`, not
`/api/notification/{pref,schedule}`) with its own switch (`NOTIFICATION_FEED_SWITCH`).

**`NOTIFICATION_UNKNOWN_CATEGORY` (400) is a single message code doing two jobs, deliberately.** On
`pref`, any of the 20 keys is valid (every category — backend-native or FE-written — has a
preference), so the code fires only on a genuinely unrecognized string
(`NotificationController.toCategoryPref`). On `schedule`, the code fires on an unrecognized string
**or** a recognized-but-not-`feWritten` one (`gym`, `ritual`, …) — the security boundary that stops a
client from owning a minute the backend owns. Same wire error, two different validation rules behind
it, matched to what each endpoint is actually allowed to accept. **The feed endpoints have no
equivalent validation code** — `kind` is a plain string on the wire (§3a), and `limit` is bounded by
the OpenAPI schema itself (1..100).

## 5. Integrations

- **Proactive** ([`proactive.md`](proactive.md)) — **now wired.** `AnchorResolver` reads
  `CompanionMessageRepository` (kinds `morning`/`midday`/`evening`/`sleep`/`weight` — replaced the
  retired `BriefingRepository`/`HeartbeatNoteRepository` reads, mezo-gst9; those two tables/repos
  still exist and are still written by `BriefingJob`/`HeartbeatJob` running in parallel, but
  `AnchorResolver` no longer reads them, and they are slated for retirement in a later task) plus
  `WeeklySuggestionRepository`/`MemoirRepository` directly: a prose category's anchor exists
  **only** when that day's content row already exists — a missing row is an honest absence, never
  a placeholder — and its push body is an **excerpt** of the already-generated text
  (`AnchorResolver.excerptProse`, word-boundary + surrogate-safe cut, reusing
  `PushSender.truncateBody`), never a second LLM call.
- **Today / Ritual / Train** ([`today.md`](today.md), [`ritual.md`](ritual.md), [`train.md`](train.md))
  — **now wired.** `gym`/sport anchors read `GymScheduleSlotRepository`/`SportScheduleSlotRepository`
  + `WorkoutService.findPlannedTemplateForDate` (never `getToday`, §9); `ritual`/`lights_out`/
  `wind_down` read `RitualService.getDay(owner, date).getWindow()`, injected via `ObjectProvider`
  because the whole bean disappears when `RITUAL_SWITCH` is off.
- **Medication** (`feature/medication`) — **now wired.** `medication` reads
  `MedicationRepository` + `MedicationCycleService.derive(...)`; `cycleDay == 0` (no dose logged yet
  — since `mezo-lwmq` the standing state, as the owner tracks no medication) is treated as "no
  anchor today", never as cycle day zero.
- **Fuel** ([`fuel.md`](fuel.md)) — **new seam, both directions; re-platformed onto the living-occurrence Stack (mezo-vx9v Task 9).** Fuel's own `frontend/src/features/fuel/logic/buildProtocol.ts` exports `deriveBlocks` (today's gym/sport/run blocks; moved out of `data/fuel/timelineHooks.ts`, which re-exports it for backward compatibility) and `PRE_WORKOUT_STACK_LEAD_MIN` — the **one canonical** "40 minutes before today's first training block" offset. Three callers now share the SAME `projectStackDay({occurrences, stash, intakes, wake, bed, mealsPerDay, blocks})` projection (each composing its own hooks inline, not via `useStackDay()` — the writer needs `useSleepGoal().isPending` for its fire-once gate, `NotificationsPage` needs the raw `blocks[]` for its gym sub-line): Fuel's own `useFuelTimeline`, this platform's `useScheduleSnapshotWriter` (the `fuel_slot` schedule rows), and `NotificationsPage`'s preview header — so the pre-workout stack time the Fuel/Stack page shows, the time persisted to `notification_schedule`, and the time the settings preview forecasts can never quietly disagree (a fix-round decision, `mezo-h4wp.6.3`, superseded onto occurrences by Task 9). The retired selection-based `buildProtocol()` builder and its `deriveProtocolAnchors`-mediated anchor derivation are gone from this path; `FUEL_WINDOW_LABEL` (`notificationScheduleWriter.ts`) is now keyed by the 8 `StackZoneKey` zone keys, not the old label set. Since the stim-aware split (mezo-j6c9) a day with ≥2 distinct-time training blocks can project TWO `pre_workout` slots (stim-free-named items anchor to the LAST block), so the writer emits up to two `fuel_slot` "edzés előtti" entries at their own times — per-slot emission handles this with no writer change.
- **Me** ([`me.md`](me.md) §2 "`Értesítés`") — the FE consumer: the settings page owns no
  notification data itself beyond composing `usePushSubscription()` + `useNotificationPrefs()` +
  the pure `notificationForecast.ts` + `projectStackDay`'s zoned slots.
- **`_platform-api-backend.md`** — same contract-first pipeline + platform conventions as every
  other feature; the notification endpoint table now lists all six push operations (§5c there).
- **Insights / pattern engine** ([`insights.md`](insights.md) §5) — **F1's producer, unchanged.**
  `PatternDetectionService` (`feature/companion/service/`) emits: a new strong pattern →
  `pattern_inbox`, a band crossing on an undecided pattern → `pattern_signal`, a re-detected
  `CONFIRMED` pattern → `fact_reinforced` (§3a/§4). `NotificationFeedProperties`'
  `inboxMinAbsR`/`inboxMaxP`/`bandPromising`/`bandStrong` MUST mirror Insights' own `STRONG_SIGNAL`
  constant and `strengthWord` bands (`data/insights/insights.ts`, `features/insights/logic/findings.ts`)
  — pinned by tests on **both** sides, so the bell can never disagree with what the Insights dashboard
  itself calls "strong".
- **Companion (knowledge/hypothesis) + Proactive (memoir/prediction/experiment/challenge/daily
  summary)** — **new in F2 (bd `mezo-gzhp.2`).** Nine more `feature/companion`/`feature/proactive`
  generators each gained a one-line `AppNotificationEmitter.emit(...)` at the point their own content
  persists — `FactExtractionService` (`fact_candidate`, plus a second `fact_reinforced` source
  alongside `PatternDetectionService`), `HypothesisPipelineService` (`hypothesis_new`),
  `MemoirGenerator` (`memoir_ready`), `PredictionGenerator`/`PredictionValidationService`
  (`prediction_new`/`prediction_outcome`), `ExperimentProposalGenerator`/`ExperimentOutcomeService`
  (`experiment_proposed`/`experiment_closed`), `ChallengeGenerator`/`ChallengeOutcomeEvaluator`
  (`challenge_event`, both lifecycle moments), `DailySummaryService` (`memory_note`) — see §3a for the
  full per-producer dedup-key shapes. **All 12 `AppNotificationKind`s now emit, and F3 (bd
  `mezo-gzhp.3`) wired the push-category mapping on top — see §3b/§4.**

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
deterministic `notificationPrefSeed`, all 20 at spec defaults, synchronously; real fetches
`GET /api/notification/pref` and returns the same seed as the honest pre-resolve ghost, since the
backend's own "no stored row = code default" rule means the seed already IS the correct fallback).
`setPref` is a **per-category** upsert (mirrors the backend's own per-category PUT semantics — never
a full-list replace, so a concurrent edit to a different category can never be clobbered), optimistic
via `onMutate`/`onError` rollback.

**Backend:** a new anchor source follows the `AnchorResolver` pattern — a private method appending
`AnchoredEvent`s to one of the three lists in `resolve(...)`, never reaching into `DueEvaluator`
(which stays collaborator-free) or `NotificationPrefService` directly.

**In-app feed (F1):**

```ts
import { useNotificationFeed, useNotificationFeedActions } from '@/data/hooks'

function NotificationBell() {
  const { items, isPending } = useNotificationFeed()
  const { markAllRead } = useNotificationFeedActions()
  const unread = items.filter((n) => !n.readAt).length
  // open panel → void markAllRead() (classic bell: badge clears, panel keeps its own read-snapshot)
}
```

`useNotificationFeed()` (`data/notification/feedHooks.ts`) is a `useDualQuery` whose real pre-resolve
value is the **honest empty list**, never the mock seed — a badge must never flash a fabricated count
at a live user before the first real fetch lands. `useNotificationFeedActions().markAllRead()` is
optimistic (`onMutate` flips every row's `readAt` in the cache immediately, `onError` rolls back).

**Backend (adding a new emit site):** inject `AppNotificationEmitter` (never
`AppNotificationService` directly — the emitter is the only thing that survives the feed switch being
off) and call `.emit(owner, kind, title, body, deeplink, refId, dedupKey)` at the point the event
happens; compose the Hungarian copy inline, following the §6 copy rules verbatim, and pick a
`dedupKey` that is stable across a retry of the same logical event (§3a/§4). **If the producer's own
IT test carries a class-level `@Transactional`, remove it** — `emit`'s `REQUIRES_NEW` transaction
will FK-deadlock against the test's own not-yet-committed rows otherwise (§9's F1/F2 gotcha; every
one of the 12 current producer IT classes had to have this annotation dropped).

## 7. How to extend it (adding a 21st category)

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
- `DueEvaluatorTest` (pure, no Spring) — the **backward** catch-up window as a table (exact minute
  fires; one minute **late** fires; `now == fireMinute + catchUpMinutes`, the far edge, does not;
  one minute **early** does not), plus two named regression tests for the two halves of the
  forward-window bug (`testDue_shouldStillFire_whenTheTickWasMissedAndNowIsOneMinutePastTheFireMinute`,
  `testDue_shouldNotFire_whenNowIsOneMinuteBeforeTheFireMinute`), disabled category, lead applied,
  empty day, the negative-fire-minute non-wraparound.
- `NotificationCategoryTest` — pins the 20-key catalog (keys, defaults, leads, `feWritten`) against
  spec §6.
- `AnchorResolverIT` + `AnchorResolverRitualSwitchOffIT` — per-category anchor resolution against a
  real Postgres, including the ritual-family absence when `RITUAL_SWITCH` is off. Trap #6 is covered
  from all five sides: `...shouldPushTheWeeklyAnchorPastTheGenerator_whenTheWakeTimeLandsOnTheWeeklyCronMinute`,
  `...shouldLeaveTheWeeklyAnchorOnWake_whenTheWakeTimeIsWellAfterTheWeeklyCronMinute`,
  `...shouldAnchorMemoirAfterItsGenerator_whenTheMemoirRowExistsForTheWeek`,
  `...shouldAnchorMiddayAfterItsGenerator_whenTheMiddayCompanionMessageExists`,
  `...shouldAnchorEveningAfterItsGenerator_whenTheEveningCompanionMessageExists`, plus
  `...shouldLeaveTheBriefingAnchorOnWake_whenItsGeneratorAlreadyRunsBeforeWake` pinning the safe
  pattern as a deliberate no-op. The two event-kind anchors get their own cases —
  `...shouldAnchorSleepReactionOnItsOwnGenerationMinute_...`/
  `...shouldAnchorWeightReactionOnItsOwnGenerationMinute_...` — seeded via
  `CompanionMessagePopulator`'s explicit-`generatedAt` overload (avoids `Instant.now()` flakiness
  at a minute boundary). Trap #7 by
  `...shouldSkipOnlyTheBadRow_whenAScheduleRowCarriesAnUnparseableTime` (asserts the *other*
  categories still resolve for that user) and
  `...shouldSkipTheRow_whenAScheduleRowNamesABackendNativeCategory`.
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
  separately-maintained list), mock mode never reaching the network, and the **distinct per-slot
  `/today?checkin=HH:mm` deeplinks** that stop the service worker's `tag` from collapsing the four
  daily check-ins into one.
- `features/me/logic/notificationForecast.test.ts` — table-driven, deterministic (no `new Date()`
  inside): per-category anchor resolution, weekday gating (`weekly`=Monday only, `memoir`=Sunday
  only), the dense-window grouping.
- `features/me/components/NotificationCategoryRow.test.tsx` / `NotificationPreviewHeader.test.tsx` —
  the lead-chip-only-for-`gym` rule, the sub-line fallback, the sparkline + dense-window note.
- `features/me/pages/NotificationsPage.test.tsx` — the two-section category list, per-row toggle
  wiring, the preview header's inputs.
- `features/fuel/logic/buildProtocol.test.ts` — trimmed to `deriveBlocks`/`deriveProtocolAnchors` since mezo-vx9v Task 9 retired `buildProtocol()` itself; `features/fuel/logic/projectStackDay.test.ts` covers the zoned-timeline projection all three notification call sites now share.
- A real fix during implementation, worth knowing: the optimistic-update tests initially used a
  **stateless** fake PUT/GET pair, and `onSettled`'s real-mode `invalidateQueries` refetch always
  re-served the pristine seed, silently reverting the optimistic flip — fixed by making the test
  fixture's fake backend stateful (GET reflects the last PUT), matching what a real backend does.
- Commands: `cd frontend && pnpm test` and `VITE_USE_MOCK=true pnpm test` (both must stay green) +
  `pnpm build`.

**In-app feed (F1 bd `mezo-gzhp.1` + F2 bd `mezo-gzhp.2`) — backend:**
- `AppNotificationRepositoryIT` (2) — the dedup partial-unique + the ordered feed query.
- `AppNotificationServiceIT` (5) — same-dedup-key double-emit persists one row
  (`testEmit_shouldPersistOneRow_whenCalledTwiceWithSameDedupKey`), title/body truncation to the
  column budget, `markAllRead` stamps only the unread rows, `feed` caps at the configured limit and
  orders newest-first, and the **deterministic emitter-absorption pin**
  (`testEmit_shouldNotPropagateToCaller_whenPersistFailsInsideTheService`) — asserts a failing
  persist inside the service never surfaces to the caller.
- `NotificationFeedApiIT` (3) — own-rows-only newest-first, `read-all` stamps every row, `401` when
  unauthenticated.
- `AppNotificationKindTest` — pins the 12-key catalog (keys, familyKey, deeplink) against the spec.
- `PatternEmitIT` (2, F1) — `PatternDetectionService.upsert` emits exactly one `pattern_inbox` row for
  a new strong pattern, and running detection twice emits only one row (dedup holds across a
  re-detection).
- **F2 — no new IT classes; the existing producer IT suites gained `AppNotificationRepository`-backed
  emit assertions directly** (each producer's own IT is the natural place to assert its emit, rather
  than a parallel `*EmitIT` per producer): `FactExtractionServiceIT` (`fact_candidate` +
  `fact_reinforced` from the chat-reinforcement branch), `HypothesisPipelineServiceIT`
  (`hypothesis_new`), `MemoirGeneratorIT` (`memoir_ready`, plus a double-generate-stays-single-row
  dedup case), `PredictionGeneratorIT`/`PredictionValidationIT` (`prediction_new`/
  `prediction_outcome`), `ExperimentProposalGeneratorIT`/`ExperimentOutcomeIT`
  (`experiment_proposed`/`experiment_closed`), `ChallengeGeneratorIT`/`ChallengeOutcomeIT`
  (`challenge_event`, both lifecycle moments), `DailySummaryServiceIT` (`memory_note`). **All ten of
  these IT classes lost their class-level `@Transactional`** — see §9's F1/F2 gotcha.
- **Honest note:** none of the above emit-reachable IT suites could be run on this machine (they need
  the full Testcontainers backend stack, which OOM-dies under swap thrash here per
  `docs/infrastructure/local-dev-testing.md`) — they execute for the first time in CI.
- Data via `support/populator/AppNotificationPopulator.java`; `app_notification` joined the
  `ResetDatabase` TRUNCATE list alongside the N-slice tables.
- Commands: `cd backend && ./mvnw clean test -Dtest='AppNotification*,NotificationFeedApiIT,PatternEmitIT,FactExtractionServiceIT,HypothesisPipelineServiceIT,MemoirGeneratorIT,PredictionGeneratorIT,PredictionValidationIT,ExperimentProposalGeneratorIT,ExperimentOutcomeIT,ChallengeGeneratorIT,ChallengeOutcomeIT,DailySummaryServiceIT'`.

**In-app feed (F1) — frontend:**
- `data/notification/feedHooks.test.tsx` (4, both mock/real modes) — the honest-empty real
  pre-resolve, the mapped view shape, `markAllRead`'s optimistic flip + rollback.
- `features/notification/logic/groupByDay.test.ts` (2) — the Ma/Tegnap/Korábban bucketing, pure and
  deterministic (`today` injected, no `new Date()` inside).
- `features/notification/components/NotificationBell.test.tsx` (3) — the seed unread badge count,
  opening shows the Ma/Tegnap groups and clears the badge, tapping an item deeplinks and closes the
  panel.
- `AppHero.test.tsx` — extended to assert the bell renders as the 4th counter chip.
- Commands: `cd frontend && pnpm test` and `VITE_USE_MOCK=true pnpm test` (both modes).

## 9. Decisions, gotchas & deferred

- **Real-world delivery is proven, not just unit-tested.** A real Web Push reached Daniel's iPhone
  from the k3s backend on 2026-07-29 (N1's exit criterion — bd `mezo-h4wp.6.1`: "confirmed by
  Daniel"). N2's dispatcher and N3's FE feed both build on that proven platform path, not on an
  unverified assumption.
- **The scheduler pool is shared by every `@Scheduled` method in the app — this is the most
  important gotcha in the whole feature.** `NotificationDispatchJob` is the app's **first per-minute**
  cron; every other job anchors on a rare fixed time. `SchedulingConfiguration` defines no
  `TaskScheduler`, so the pool is Boot's, sized by `spring.task.scheduling.pool.size` — and at Boot's
  default of **1** every job serializes against every other: the nightly summary, the dawn
  companion-feed generation, the habit close. That default is why `mezo-y33b` **widened the pool to
  4** (`application.yml`, `spring.task.scheduling`): the dispatcher is the app's only
  latency-sensitive job, and a tick delayed past `mezo.notification.catch-up-minutes` (2) by a
  minutes-long LLM generation cron drops that minute's pushes permanently. Spring never re-enters a
  single `@Scheduled` method concurrently, so widening only lets *different* (already per-user
  idempotent) jobs overlap. The offload below is unchanged and still required — a wider pool bounds
  the queueing, it does not make a blocking HTTP send on a scheduler thread acceptable.
  **`NotificationDispatchJob` therefore does DB-only due-computation on the scheduler thread and
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
- **`DueEvaluator`'s catch-up window looks BACKWARD, never forward.** It fires when
  `nowMinute − (anchorMinute − leadMinutes) ∈ [0, catchUpMinutes)` — the fire minute itself, plus
  the `catchUpMinutes − 1` minutes **after** it (default width 2 = "on time, or one minute late").
  The window exists because this job shares a **size-1 scheduler thread** with 18 other crons, so a
  slow LLM job straddling two ticks is a realistic way to lose a minute. A forward window
  (`fireMinute − now ∈ [0, catchUp)`) — which is what shipped in N2 and was caught in the final
  whole-branch review — gets **both** halves wrong: every push goes out **one minute early** (and
  the `push_log` dedup then suppresses the on-time minute, so the early send is the only send), and
  the genuinely-missed case `now == fireMinute + 1` **never fires at all**, dropping that anchor for
  the whole day. **Do not "fix" a perceived double-send by narrowing this window** — the half-open
  `[0, catchUpMinutes)` shape is deliberate and `push_log` is what prevents a double-send.
- **`AnchorResolver`'s seven documented traps** (each one a real, verified bug class, not a
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
  5. **`medication`'s `cycleDay == 0` is `MedicationCycleService`'s honest "no dose logged yet" state**
     (since `mezo-lwmq` the standing state, as the owner tracks no medication) and is treated as
     "no anchor today", never as cycle day zero.
  6. **A prose anchor must never land on (or before) the minute its own content generator runs.**
     Because a prose anchor exists *only* when the content row exists, and both jobs queue on the
     **same size-1 scheduler thread** with an LLM call inside each generator, an anchor on the
     generator's own minute provably finds no row — so the category **never fires, silently, with
     nothing in the log to explain it**. As shipped in N2 this hit two **default-ON** categories:
     `memoir` (19:00 anchor vs `mezo.proactive.memoir.cron` `0 0 19 * * SUN`) and `weekly` (wake
     anchor, config-default **06:00**, vs `mezo.proactive.weekly.cron` `0 0 6 * * MON`), plus
     default-OFF `midday` (12:30 vs `feed.midday-cron`, was `heartbeat.midday-cron` pre-mezo-gst9).
     `briefing` was the one safe category (generates 05:45, anchors at wake ≈06:00) — and it is the
     pattern `midday`/`evening` (the new mezo-gst9 category, `feed.evening-cron` `0 30 20 * * *`
     vs preferred 20:30 — also collides, graced to 20:45) now copy. The two mezo-gst9 event-kind
     categories (`sleep_reaction`/`weight_reaction`) are **exempt from this trap entirely**: their
     anchor is the row's own `generatedAt` minute, not a preferred-constant-vs-generator-cron
     comparison, so there is nothing for them to collide with.
     **The fix:** every cron-anchored prose category goes through `AnchorResolver.anchorAfterGeneration(...)`, which
     pushes the anchor to `generatorMinute + mezo.notification.prose-generation-grace-min`
     (**15**) whenever the preferred anchor lands at or before the generator's minute; otherwise the
     preferred anchor is left untouched. Two rules make this maintainable: the offset is **config,
     never a magic number** (do not "tidy" it away), and the generator's minute is read from the
     generator's **own cron** (`mezo.proactive.*`) via `CronExpression` — the
     `ProactiveHeartbeatService` precedent — so 06:00/12:30/19:00 are never hardcoded in a second
     place. For `weekly` this matters especially: the wake anchor is user-configurable, so the grace
     is relative to the **cron minute**, never blindly added to wake (an 08:20 waker keeps 08:20).
  7. **One malformed `notification_schedule` row must never silence the whole user.** `resolve()`
     used to call `LocalTime.parse(row.time)` unguarded, so a single bad `time` threw **before any
     anchor was returned** — the dispatcher's per-user catch then logged a stack trace **1440×/day**
     and that user received **nothing at all, from any category, forever**. The contract permits it
     (`notification.yml` constrains `time` only to `minLength/maxLength: 5`, so `"aa:bb"` validates)
     and there is no DB CHECK. Each row's `time` parse is now wrapped per-row (`warn` + `continue`),
     the same defense the `category` lookup already had. The `category` guard additionally rejects a
     **recognized-but-backend-native** key as defense-in-depth — `NotificationScheduleService`'s
     `requireFeWritten` is still the real boundary; this only covers a row that arrived some other
     way (e.g. a manual DB fix).
- **Prose anchors excerpt, never regenerate.** `briefing`/`midday`/`evening`/`sleep_reaction`/
  `weight_reaction`/`weekly`/`memoir` exist only when their content row already exists for the day
  (honest absence, not a placeholder); their push body is a word-boundary, surrogate-safe cut of
  the already-generated text (`AnchorResolver.excerptProse`, reusing `PushSender.truncateBody`) —
  no LLM call happens on the push path at all (spec §6).
- **Every check-in slot carries a DISTINCT deeplink, because `push-sw.js` uses `data.url` as the
  notification `tag`.** A shared tag makes the browser **replace** an already-shown notification, so
  with a bare `/today` on all four slots the 10:00 check-in silently wiped an undismissed 06:30 one
  (and collided with `briefing`/`wind_down`/`midday`, which also deeplink to `/today`). The writer
  therefore emits `/today?checkin=HH:mm` (`notificationScheduleWriter.ts`). **The param is a tag
  discriminator, not a feature** — `useTodayScenario` reads only its own named params
  (`day`/`medCycleDay`/`niggle`/`vulnerable`/`ritual`) and React Router matches on the path, so
  `?checkin=` is harmlessly ignored; having it open the check-in sheet would be genuinely useful and
  is a deliberate non-goal here. Fixing this by changing the worker's tag strategy was rejected as
  the larger, riskier change.
- **The per-minute dispatch summary logs only when something was dispatched** — at 1440 runs/day an
  unconditional `info` line adds 1440 lines/day forever and buries the lines that matter
  (`NotificationDispatchJob.runOnce`, gated on `dispatched > 0`). And `run()` takes **one**
  `LocalDateTime.now()` and derives both the date and the minute from it: two separate `now()` calls
  could tear across midnight and log a `00:00` anchor under the previous `log_date`.
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
- **`PRE_WORKOUT_STACK_LEAD_MIN`/`deriveBlocks` are the one canonical derivation of "pre-workout minus 40
  minutes"** (`frontend/src/features/fuel/logic/buildProtocol.ts`, §5) — since mezo-vx9v Task 9, applied
  primarily inside the shared `projectStackDay` projection rather than through the retired
  `deriveProtocolAnchors`/`ProtocolAnchors` shape (kept, but with no production caller left). Fuel's
  own timeline, this platform's schedule writer, and the settings preview all feed `projectStackDay`
  the same anchors/blocks, so they can never disagree on the same slot's time — a second independent
  derivation of that offset is exactly the kind of drift this design was shaped to avoid.
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

**In-app feed (F1 bd `mezo-gzhp.1` + F2 bd `mezo-gzhp.2`) gotchas:**
- **An emit-reachable service's IT class must never carry class-level `@Transactional` — this is a
  standing rule now, not a one-off fix.** `AppNotificationEmitter.emit(...)` always opens its own
  `REQUIRES_NEW` transaction (§3a). When the calling IT method itself runs inside a class-level
  `@Transactional` (the common integration-test shape: seed data in the same rollback-only
  transaction as the assertions), that seed data — e.g. the test user row `emit`'s FK points at — is
  **uncommitted** from any other transaction's point of view. `REQUIRES_NEW` suspends the outer
  transaction and opens a genuinely separate one on a second connection, so its `INSERT` blocks
  waiting to see a row the outer, still-open transaction will never commit — a real Postgres **FK-wait
  deadlock**, not a flaky timing issue, and it reproduces on every run. F1 hit this first
  (`PatternDetectionServiceIT`, `PatternEmitIT`); F2 turned nine more services emit-reachable and
  dropped the same class-level annotation from their IT classes too — ten in total across both
  slices: `FactExtractionServiceIT`, `HypothesisPipelineServiceIT`, `MemoirGeneratorIT`,
  `PredictionGeneratorIT`, `PredictionValidationIT`, `ExperimentProposalGeneratorIT`,
  `ExperimentOutcomeIT`, `ChallengeGeneratorIT`, `ChallengeOutcomeIT`, `DailySummaryServiceIT`. **The
  rule for the next emit site:** if the producer's own IT test has a class-level `@Transactional`,
  remove it and let the test commit its fixtures for real (`saveAndFlush` + `ResetDatabase` between
  tests, the house pattern) before asserting against `AppNotificationRepository` — do not add a
  `REQUIRES_NEW`-avoiding workaround inside `emit` itself, the isolation the outbox needs from its
  caller's transaction is the point, not the bug.
- **`AppNotificationEmitter` is the ALWAYS-ON facade every producer injects — never
  `AppNotificationService` directly.** It absorbs every exception, including the feed switch being
  off entirely (the service bean then does not exist — `ObjectProvider.getIfAvailable()` returns
  `null`, and `emit` is a no-op). **A notification failure must never break a producer.** The one
  documented subtlety: when the emitter's own `try/catch` swallows a `DataIntegrityViolationException`
  thrown *inside* a transaction the producer already marked rollback-only for an unrelated reason,
  Spring can still surface an `UnexpectedRollbackException` at the enclosing `@Transactional`'s
  commit boundary — because `emit` runs in its **own** `REQUIRES_NEW` transaction (§3a), that
  exception belongs to the *outer* transaction's own rollback-only state, not to the notification
  attempt, so the emitter's absorption is by design one layer removed from where such an exception
  can appear. `AppNotificationServiceIT`'s
  `testEmit_shouldNotPropagateToCaller_whenPersistFailsInsideTheService` pins the direct case
  deterministically (no reliance on inducing a real Postgres race).
- **`emit` is idempotent by construction, not by caller discipline.** Two independent guards stack:
  an `existsByCreatedByAndDedupKeyAndDeletedFalse` check up front (catches the common re-run), and the
  partial unique index catching a genuine race between two concurrent generation paths (a cron and a
  lazy GET producing the same logical event at once) via a caught `DataIntegrityViolationException`.
  Either way the second attempt is a silent no-op — never an error surfaced to the producer.
- **`memoir_ready`'s `familyKey` is `null` on purpose, not an oversight.** The existing `memoir` push
  category (N-slice catalog, §4) already delivers that event as a push; giving `memoir_ready` a
  familyKey too would double-notify the same moment through two different categories now that F3 has
  wired the mapping. `AppNotificationKindTest` pins this null.
- **Classic bell semantics, deliberately simple: opening the panel marks EVERYTHING read.** There is
  no per-item read endpoint (§4) — the panel's own open-time snapshot (`NotificationBell`'s
  `snapshotRef`) is what keeps the just-read rows' dots visible while the panel stays open, so the
  UI doesn't need a "half-read" server state to look right. A finer-grained per-item read model was
  considered and rejected as unneeded complexity for a single-user app.
- **`NotificationFeedProperties`' inbox/band thresholds are a cross-stack pinned mirror, same shape
  as the N-slice `bandPromising`/`bandStrong` mirroring `strengthWord` (§5).** They must never drift
  from Insights' own `STRONG_SIGNAL`/`strengthWord` constants without updating both sides' tests.
- **The `feature/appnotification` package split (F2) exists to break a real dependency cycle, not for
  tidiness.** Once `feature/companion` and `feature/proactive` producers both needed
  `AppNotificationEmitter`/`AppNotificationKind`, keeping those classes inside `feature/notification`
  (which itself has no reason to depend on `companion`/`proactive`) would have created a
  `companion`↔`notification`↔`proactive` package cycle. The in-app-feed classes (`AppNotificationKind`,
  `AppNotificationEntity`, `AppNotificationRepository`, `AppNotificationService`,
  `AppNotificationEmitter`, `NotificationFeedController`, `NotificationFeedProperties`) moved to their
  own `feature/appnotification` package so both `companion` and `proactive` can depend on it without
  either depending on `notification` (the push slice) at all — the two delivery layers (push vs.
  in-app feed) no longer share a package, only the design intent (§1).
- **F3 (bd `mezo-gzhp.3`) — the feed-row dedup key MUST carry the row id, never bare
  `{category}:{HHmm}`.** The N-slice `push_log` dedup key form (§4/§9) collapses two anchors that
  land on the same category+minute into one send — exactly right for a single backend-native anchor
  per category, but WRONG here: `feedAnchors(...)`'s wake-deferral (§3b) can put several distinct
  `app_notification` rows of the same family on the SAME wake minute on a busy night (e.g. two
  `pattern_inbox` rows both deferred to 06:00), and the design intent is that **every feed event
  pushes** (spec §1) — a shared key would silently drop all but one. The fix: F3's dedup suffix is
  `"HH:mm:" + the row id's first 8 hex chars`, so `push_log`'s
  `(created_by, log_date, dedup_key)` uniqueness can never conflate two different rows.
  **The `?n={idFragment}` query param on the push `url` is a second, independent fix for a related
  but distinct problem** — `push-sw.js`'s `'push'` handler uses `data.url` as the OS notification
  `tag` (§9's N-slice check-in gotcha), so two feed pushes that happen to deeplink to the same route
  (e.g. two `pattern_inbox` events both linking `/insights/patterns/{pairKey}` for the *same* pair)
  would still make the phone **replace** the first with the second even though `push_log` correctly
  sent both. `?n=` makes every feed push's url — and therefore its tag — unique, so N distinct sends
  produce N distinct notifications on the phone, not just N distinct `push_log` rows. **Do not
  "simplify" either of these back to the plain `{category}:{HHmm}`/bare-deeplink forms** — that
  reintroduces the exact collapse class the N-slice check-in fix (§9) already had to solve once, this
  time at the family/wake-deferral level instead of the four-slots-a-day level.

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
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/config/NotificationProperties.java` — `mezo.notification.{body-max-chars,medication-time,prose-excerpt-chars,dispatch-cron,catch-up-minutes,prose-generation-grace-min}` (the last one reads the generator crons from `mezo.proactive.*` — see §9 trap #6)
- Migrations: `202607291000_mezo-h4wp.6.1_create_push_subscription.sql`, `202607291400_mezo-h4wp.6.2_create_notification_pref_and_push_log.sql`, `202607291500_mezo-h4wp.6.3_create_notification_schedule.sql` (all under `db/changelog/1.0.0/script/`, registered in `1.0.0/1.0.0_master.yml`)
- `backend/src/main/resources/messages.properties` — `WEBPUSH_KEY_INVALID`/`WEBPUSH_SIGN_FAILED`/`WEBPUSH_ENCRYPT_FAILED`/`NOTIFICATION_UNKNOWN_CATEGORY`
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `NOTIFICATION_SWITCH`, `NOTIFICATION_DISPATCH_JOB_SWITCH`
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/{AnchorResolverIT,AnchorResolverRitualSwitchOffIT,DueEvaluatorTest,NotificationApiIT,NotificationCategoryTest,NotificationDispatchJobIT,NotificationPrefApiIT,NotificationPrefRepositoryIT,NotificationScheduleApiIT,PushSenderIT,PushSubscriptionRepositoryIT,PushSubscriptionServiceIT}.java`, `feature/notification/service/{AnchorResolverExcerptTest,PushSenderTruncationTest}.java`; `support/populator/NotificationPopulator.java`; `support/ResetDatabase.java` (`notification_pref`/`push_log`/`notification_schedule` in the TRUNCATE list)

**Backend — `feature/appnotification` in-app feed (F1 bd `mezo-gzhp.1` + F2 bd `mezo-gzhp.2`; moved
out of `feature/notification` in F2 to break a `companion`↔`notification`↔`proactive` package
cycle, §9)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/domain/AppNotificationKind.java` — the 12-kind catalog (§4)
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/entity/AppNotificationEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/repository/AppNotificationRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/service/{AppNotificationService,AppNotificationEmitter}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/controller/NotificationFeedController.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/config/NotificationFeedProperties.java` — `mezo.notification.feed.{limit,inbox-min-abs-r,inbox-max-p,band-promising,band-strong}` (the last four MUST mirror the FE Insights constants, §5/§9)
- Migration: `202608181400_mezo-gzhp.1_create_app_notification.sql` (`db/changelog/1.0.0/script/`, registered in `1.0.0/1.0.0_master.yml`)
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `NOTIFICATION_FEED_SWITCH` (`mezo.feature.notification-feed.enabled`)
- The 11 producers (all live outside `feature/appnotification`, injecting `AppNotificationEmitter`, §3a/§5):
  - F1: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionService.java` — `upsert`/`recordSnapshot`/`reinforcePromotedFact`
  - F2, `feature/companion/service/`: `FactExtractionService.java` (`fact_candidate` + a second `fact_reinforced` source), `HypothesisPipelineService.java` (`hypothesis_new`), `DailySummaryService.java` (`memory_note`)
  - F2, `feature/proactive/service/`: `MemoirGenerator.java` (`memoir_ready`), `PredictionGenerator.java` (`prediction_new`), `PredictionValidationService.java` (`prediction_outcome`), `ExperimentProposalGenerator.java` (`experiment_proposed`), `ExperimentOutcomeService.java` (`experiment_closed`), `ChallengeGenerator.java` (`challenge_event`, proposed), `ChallengeOutcomeEvaluator.java` (`challenge_event`, closed)
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/appnotification/{AppNotificationRepositoryIT,AppNotificationServiceIT,NotificationFeedApiIT,AppNotificationKindTest,PatternEmitIT}.java`; per-producer emit assertions added directly to `feature/companion/{FactExtractionServiceIT,HypothesisPipelineServiceIT,DailySummaryServiceIT}.java` and `feature/proactive/{MemoirGeneratorIT,PredictionGeneratorIT,PredictionValidationIT,ExperimentProposalGeneratorIT,ExperimentOutcomeIT,ChallengeGeneratorIT,ChallengeOutcomeIT}.java` (all ten dropped class-level `@Transactional`, §9); `support/populator/AppNotificationPopulator.java`; `support/ResetDatabase.java` (`app_notification` in the TRUNCATE list)

**API contract**
- `api/feature/notification/notification.yml` → merged `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts` + generated `io.mrkuhne.mezo.api.controller.{NotificationApi,NotificationFeedApi}` / `io.mrkuhne.mezo.api.dto.{PushSubscriptionRequest,PushTestResponse,NotificationPref,NotificationPrefListRequest,NotificationPrefListResponse,NotificationScheduleEntry,NotificationScheduleRequest,NotificationFeedItem,NotificationFeedResponse}` (the last two DTOs are F1's `NotificationFeed` tag, §4)

**Frontend — service worker + PWA build (N1, unchanged)**
- `frontend/public/push-sw.js`, `frontend/vite.config.ts` (`workbox.importScripts`), `frontend/.env.example` (`VITE_VAPID_PUBLIC`), `.github/workflows/deploy.yml` (same variable in `build-frontend`'s `env:`)

**Frontend — data layer**
- `frontend/src/data/notification/{notificationApi,notificationMock,notificationHooks,notificationPrefHooks,notificationScheduleWriter}.ts` — `usePushSubscription()` (N1) + `useNotificationPrefs()` (N2) + `useScheduleSnapshotWriter()`/`buildScheduleEntries()` (N3), all re-exported from `frontend/src/data/hooks.ts`
- `frontend/src/data/notification/{feedApi,feedMock,feedHooks}.ts` (F1) — `useNotificationFeed()` + `useNotificationFeedActions()`, re-exported from `frontend/src/data/hooks.ts` (§6)
- `frontend/src/data/types.ts` — `PushSubscriptionState`/`PushErrorCode` (N1); `NotificationCategoryKey`/`NOTIFICATION_CATEGORIES`/`NotificationPrefView`/`NotificationCategoryMeta`/`NOTIFICATION_CATEGORY_META` (N2, the 20-key HU copy catalog); `AppNotificationKindKey`/`AppNotificationView`/`APP_NOTIFICATION_KIND_META` (F1, the 12-key catalog)
- `frontend/src/app/AppLayout.tsx` — calls `useScheduleSnapshotWriter()` once per app-session mount

**Frontend — Me surface (documented from Me's side in [`me.md`](me.md) §2/§10)**
- `frontend/src/features/me/pages/NotificationsPage.tsx` (route `/me/ertesitesek`)
- `frontend/src/features/me/components/{PushInstallGate,NotificationPreviewHeader,NotificationCategoryRow}.tsx`
- `frontend/src/features/me/logic/notificationForecast.ts` — the pure `forecastToday(...)` preview computation

**Frontend — in-app feed surface (F1, bd `mezo-gzhp.1`, new feature dir — no route, lives in `AppHero`)**
- `frontend/src/features/notification/components/{NotificationBell,NotificationPanel}.tsx`
- `frontend/src/features/notification/logic/groupByDay.ts` — the pure Ma/Tegnap/Korábban day-bucketer
- `frontend/src/features/progression/components/AppHero.tsx` — mounts `<NotificationBell/>` as the 4th `.counters` chip (§2a)
- `frontend/src/styles/prototype.css` — the `.nf-bell`/`.nf-panel` CSS block

**Cross-feature — the shared Fuel anchor derivation + zone projection (§5/§9)**
- `frontend/src/features/fuel/logic/buildProtocol.ts` — `deriveBlocks`/`PRE_WORKOUT_STACK_LEAD_MIN`/`deriveProtocolAnchors` (moved here from `data/fuel/timelineHooks.ts`, which re-exports `deriveBlocks` for backward compatibility; `buildProtocol()` itself retired mezo-vx9v Task 9)
- `frontend/src/features/fuel/logic/projectStackDay.ts` — the pure occurrence→zoned-timeline projection all three notification call sites (`useFuelTimeline`, `useScheduleSnapshotWriter`, `NotificationsPage`) now share (mezo-vx9v Task 9)

**Docs (link, don't duplicate)**
- Push spec: [`docs/superpowers/specs/2026-07-29-push-notifications-design.md`](../superpowers/specs/2026-07-29-push-notifications-design.md)
- In-app feed spec (F1/F2/F3): [`docs/superpowers/specs/2026-08-18-notification-center-design.md`](../superpowers/specs/2026-08-18-notification-center-design.md) · plan: [`docs/superpowers/plans/2026-08-18-notification-center.md`](../superpowers/plans/2026-08-18-notification-center.md)
- ADR: [`docs/decisions/0014-own-webpush-implementation.md`](../decisions/0014-own-webpush-implementation.md)
- Infra: [`docs/infrastructure/deployment-k3s-argocd.md`](../infrastructure/deployment-k3s-argocd.md) (VAPID secret + egress + `TZ`)
- References: [`docs/references/`](../references/) (`configuration_conventions`, `liquibase_conventions`, `api_contract_conventions`, `spring_patterns`, `testing_standards`)
- Roadmap: [`docs/milestones/roadmap.md`](../milestones/roadmap.md) — Phase-4's Web Push line is now shipped, not deferred
- Epic: [`docs/features/proactive.md`](proactive.md) — the `mezo-h4wp` epic-status table's H2 row
- Integration: [`docs/features/insights.md`](insights.md) §5 — the pattern engine's F1 emit sites
