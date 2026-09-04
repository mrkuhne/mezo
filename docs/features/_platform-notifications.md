---
title: Push Notifications Platform
type: feature-platform
status: mixed
updated: 2026-09-04
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
  - frontend/src/features/me/pages/NotificationFeedPage.tsx
  - frontend/src/features/me/pages/NotificationsPage.tsx
  - frontend/src/shared/lib/toastBus.ts
  - frontend/src/shared/ui/ToastProvider.tsx
  - backend/src/main/resources/db/changelog/1.0.0/script/202607291000_mezo-h4wp.6.1_create_push_subscription.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607291400_mezo-h4wp.6.2_create_notification_pref_and_push_log.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607291500_mezo-h4wp.6.3_create_notification_schedule.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202608181400_mezo-gzhp.1_create_app_notification.sql
related: [proactive, today, ritual, me, fuel, insights, journal, companion, _platform-api-backend]
---

# Push Notifications Platform — Feature Documentation

> Cross-cutting delivery layer, no route/tab of its own (the FE surface lives at `/me/ertesitesek`,
> documented from Me's side in [`me.md`](me.md)). **Push (N1/N2/N3): DONE** — N1 delivery spine + N2
> dispatcher/prefs + N3 FE-schedule/preview are all shipped; all 22 categories are live (11 at N3
> ship, +3 companion-feed categories — `evening`/`sleep_reaction`/`weight_reaction` — once
> `AnchorResolver`'s five prose anchors moved onto the unified `companion_message` table,
> mezo-gst9; +6 feed-anchored categories — `pattern`/`knowledge`/`prediction`/`experiment`/
> `challenge`/`memory` — once the in-app feed was wired as a push source, mezo-gzhp.3; +1
> backend-anchored category — `decision_review` — once the Journal domain's decision journal + review
> loop shipped, mezo-b3pp.4, §3c/§4; **not** a feed-anchored category despite sharing §3b's dedup
> shape, see §3c; +1 backend-anchored category — `intervention` — once the JITAI-lite composite-flag
> intervention slice shipped, mezo-b3pp.19, §3d/§4 — likewise not feed-anchored, and the first
> category to consult a do-not-disturb window: `mezo.notification.quiet-hours` defers, never drops,
> a non-exempt fire to the window's end, §3d). A real Web Push
> reached Daniel's iPhone from the k3s backend on 2026-07-29 (N1's exit criterion, confirmed by
> Daniel — bd `mezo-h4wp.6.1`) — real-world delivery is proven, not just unit-tested. This is the
> slice that completes the `mezo-h4wp` proactive epic's long-deferred **H2** item — see
> [`proactive.md`](proactive.md) and [`roadmap.md`](../milestones/roadmap.md).
>
> **In-app feed (F1/F2/F3, bd `mezo-gzhp`): F1 + F2 + F3 all DONE.** A second, sibling
> delivery layer sits alongside push: an `app_notification` outbox table + an FE feed surface —
> today the shell header's 3-row peek plus the full `/me/ertesitesek` feed page, §2a — fed by the
> AI-brain "pattern engine"/companion/proactive/insights domains rather
> than by `AnchorResolver`'s anchors — the whole in-app-feed backend now lives in its own
> **`feature/appnotification`** package (moved out of `feature/notification` during F2 to break a
> `companion`↔`notification`↔`proactive` package cycle, bd `mezo-gzhp.1`/`mezo-gzhp.2`). F1
> (2026-08-18) shipped the outbox, the feed API, the bell+panel UI, and the first **3 pattern-family
> emit sites** (`pattern_inbox`/`pattern_signal`/`fact_reinforced` — see [`insights.md`](insights.md)
> §5). **F2** (2026-08-18, bd `mezo-gzhp.2`) wired the remaining **9 emit sites** across
> `FactExtractionService`, `HypothesisPipelineService`, `MemoirGenerator`, `PredictionGenerator`,
> `PredictionValidationService`, `ExperimentProposalGenerator`, `ExperimentOutcomeService`,
> `ChallengeGenerator`, `ChallengeOutcomeEvaluator` and `DailySummaryService` — the original **12
> `AppNotificationKind`s all emit** (§3a/§4/§5). Later slices added `weekly_review_ready`,
> `life_goal_plan`, and the feed-only `goal_suggestion`, bringing the live catalog to 15 kinds.
> **F3** (2026-08-18, bd `mezo-gzhp.3`) wired the
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
(§3 architecture, §5 data model, §6 the (now 21-)category catalog + copy rules, §7 frontend, §9 switches,
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
  enum (§4) is the **22-key catalog** (11 at N3 ship, +`evening`/`sleep_reaction`/`weight_reaction`
  mezo-gst9, +6 feed-anchored categories mezo-gzhp.3 — `pattern`/`knowledge`/`prediction`/
  `experiment`/`challenge`/`memory`, +1 backend-anchored category mezo-b3pp.4 — `decision_review`,
  reading `decision_entry` directly, §3c; +1 backend-anchored category mezo-b3pp.19 —
  `intervention`, reading `companion_message` directly, quiet-hours-deferred, §3d). **`DueEvaluator`**
  (pure) + **`AnchorResolver`** (impure, reads
  four anchor sources — `AnchorResolver.feedAnchors(...)`, F3's `app_notification` reader, folds
  into `backendAnchors` rather than adding its own list; `decisionReviewAnchors(...)`, W1.4's
  `decision_entry` reader, also folds into `backendAnchors`, §3c; `interventionAnchors(...)`, W5.2's
  `companion_message` reader, likewise folds into `backendAnchors` rather than adding a fourth
  `AnchorSet` list, §3d) feed **`NotificationDispatchJob`**, a
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
  new table, new switch):** **done** — `app_notification` outbox (§4), the 15-kind
  `AppNotificationKind` catalog (§4), `AppNotificationService` (emit/feed/markAllRead, gated on
  `NOTIFICATION_FEED_SWITCH`), and the always-on `AppNotificationEmitter` facade every producer
  injects (§9). **All 15 kinds emit** — F1 wired the 3 pattern-family sites (§3a/§5), F2 wired
  the original remaining 9 across the proactive/companion generators (§3a/§5), and later slices
  added weekly-review, life-goal-plan, and committed goal-suggestion producers (§4/§5). **F3 (bd `mezo-gzhp.3`) is also
  done** — every `familyKey` now maps onto one of the 6 new push categories and
  `AnchorResolver.feedAnchors(...)` pushes each of today's rows (§3a/§4/§9). The package was moved out of
  `feature/notification` into its own `feature/appnotification` during F2, to break a
  `companion`↔`notification`↔`proactive` dependency cycle the new producers would otherwise have
  created. The push-category mapping (F3, bd `mezo-gzhp.3`) is now also built (§3b/§4).
- **Frontend in-app feed (F1):** done — `useNotificationFeed()`/`useNotificationFeedActions()`
  (`useDualQuery`, §6) feed the header bell's peek popover **and** the full-page feed at
  `/me/ertesitesek` (`NotificationFeedPage.tsx`, mezo-nol0, §2a).

## 2. User-facing behavior

**In-app toast action contract (`mezo-ubxd`).** The global host also supports an optional action on a simple toast: `SimpleToast.action?: { label: string; onClick: () => void | Promise<void> }`. Stack uses this for the intake confirmation's **Visszavonás** button. It remains a simple success toast — the `RewardToast` shape and progression presentation are unchanged. Invoking the action dismisses that toast immediately; if its Promise rejects, the global TanStack `MutationCache.onError` emits the normal error toast. Queue capacity, kind-specific timers, newest-first order, per-item `role="status"`, close control and live-region behavior are unchanged.

**Route:** `/me/ertesitesek` is now the in-app notification **feed** (`NotificationFeedPage.tsx`,
§2a) — the settings surface described below moved one level down, to
`/me/ertesitesek/beallitasok` (`NotificationsPage.tsx`, mezo-nol0). Full page-level description
(layout, states, copy) is in [`me.md`](me.md) §2 "`Értesítés`" — this doc covers the platform
mechanics both pages sit on top of.

**iOS install-gate first, unchanged from N1.** When the PWA is not running standalone or the browser
lacks Push support, the page renders **only** `PushInstallGate.tsx` — never a toggle, preview, or
settings list beside it that cannot work.

**Once available**, three things now stack above each other:
1. **`NotificationPreviewHeader`** — the "Napi terhelés" dark preview card: today's push count +
   an hourly sparkline (`notificationForecast.ts`, §4/§6) + a "Sűrű ablak" warning when ≥2 pushes
   land within 15 minutes of each other. Needs no endpoint — the FE already knows today's anchors.
2. **The N1 master toggle + dev "Teszt értesítés küldése" button** — unchanged.
3. **The category list**, now **three sections** (mockup direction C, extended by F3 bd
   `mezo-gzhp.3`, then by W1.4 bd `mezo-b3pp.4`, then by W5.2 bd `mezo-b3pp.19`), rendered in this
   order: **"Mezo megszólal"** (the
   prose categories — `briefing`/`midday`/`evening`/`weekly`/`memoir`/`sleep_reaction`/`weight_reaction`,
   mezo-gst9 added the last three), **"Az agy eseményei"** (F3's 6 feed-anchored, family-level
   categories — `pattern`/`knowledge`/`prediction`/`experiment`/`challenge`/`memory` — one toggle per
   `AppNotificationKind` family, **plus W1.4's `decision_review` and W5.2's `intervention`** appended
   last, in that order — all 8 share
   `NOTIFICATION_CATEGORY_META`'s `section: 'brain'` grouping, matching the shape `NotificationsPage.tsx`
   already uses for every backend/companion-derived event with no FE-forecastable anchor, even though
   `decision_review` and `intervention` are each resolved by their OWN **different** backend path
   than the 6 feed-anchored ones — and than each other (§3c/§3d — grouped by FE
   section for UI consistency, not by anchor mechanism), and
   **"Emlékeztetők"** (the reminder
   categories — `gym`/`medication`/`ritual`/`lights_out`/`wind_down`/`checkin`/`fuel_slot`). Each row
   (`NotificationCategoryRow.tsx`) is a toggle + a live, per-day sub-line derived from data the page
   already holds (e.g. `"ma 17:00 · Láb nap"` for `gym`, `"szerda · D3"` for `medication`) — falling
   back to the static `NOTIFICATION_CATEGORY_META` description when the day genuinely has no anchor
   (no session today, not a dose day). The 8 "Az agy eseményei" rows have no per-day derivation (an
   in-app-feed event, a decision's `review_due`, or a flag raise, has no daily schedule to preview
   the way `gym` does), so they always show the static description — `decision_review`'s AND
   `intervention`'s
   `backendAnchorMinute` cases in `notificationForecast.ts` both honestly return `null`, the same
   contract
   `sleep_reaction`/`weight_reaction` already use (`intervention`'s reason is a compound one: the
   anchor is BOTH event-born — a flag raise the FE cannot predict — AND, once it exists,
   quiet-hours-deferrable — neither fact is knowable client-side, §3d). **Only `gym` shows a lead-minute chip** (`"−30 perc"`) — it is
   the sole category with a non-zero `leadMinutes`; a chip on any other row would expose a number the
   backend ignores (dishonest control, spec §6/§9).

**Honest limits, stated plainly:** the mockup's single "Heti terv + memoir" settings row is actually
**two independent rows/categories** (`weekly`, `memoir`) in the real 22-key catalog — the mockup
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

### 2a. In-app feed: header peek + full feed page (F1, bd `mezo-gzhp.1`; feed page mezo-nol0)

**Two surfaces share one `useNotificationFeed()` cache.** The shell header's bell
(`app/AppHeader.tsx`, `.nap-ntfmenu`, [today.md](today.md#the-header-is-the-shells-not-the-hubs))
gives a lightweight **3-row peek** — the newest three notifications, each row navigating to its
`deeplink`, with an `Összes értesítés ›` foot. That foot is the only route the peek needs: it takes
the noun and goes to `/me/ertesitesek`, the full-page feed (`NotificationFeedPage.tsx`, mezo-nol0).
Settings live one level below, at `/me/ertesitesek/beallitasok` (`NotificationsPage.tsx`).

**Opening the feed page is the app's only reachable `markAllRead()` call site.** Before mezo-nol0,
no code path in the tree ever called it, so the header badge could light up but never clear
(bd `mezo-61w0`, a real P2). `NotificationFeedPage` fires `markAllRead()` exactly once, in a `useEffect`
gated by a `marked` ref, the moment it has a non-empty snapshot to act on — so the badge (shared
cache, same unread count the header reads) goes dark as soon as the page mounts.

**The rows stay highlighted anyway, because the page reads an OPEN-TIME snapshot, not the live
cache.** On first render with data, it captures `new Set(items.filter(readAt === null).map(id))`
into a `useRef` and keeps rendering `.unread`/`.nf-dot` off that frozen set for the rest of the
page's lifetime — never off the live `readAt`, which `markAllRead`'s optimistic cache flip has
already stamped. This is deliberate, classic-bell-style behavior carried over from the retired
`NotificationBell`/`NotificationPanel` dropdown (mezo-gzhp.1, now deleted — mezo-h682): the badge
clears immediately, but *while you're looking at the page* you can still see what was new. While the
real-mode feed is still on its cold fetch (`useDualQuery`'s `realEmpty: []` is indistinguishable
from a genuinely empty list), the page shows a 3-row skeleton instead of either the ghost "nincs
értesítésed" state or a mistaken 0-count hero — both would flash a lie the resolved fetch
immediately contradicts.

**Day grouping is `groupByDay.ts`** (pure, day-bucketed off `occurredAt`, sorted newest-first inside
and across groups) — **Ma** and **Tegnap** as before, but every older day now gets **its own dated
label** (`aug. 15.`, `aug. 14.`, …) instead of being swept into one `Korábban` bucket: a dropdown's
three rows tolerated a single catch-all, a full page of two weeks did not (mezo-nol0). Each group's
identity is its `day` field (a stable `YYYY-MM-DD`), not its label — used as the React key, so a
label format change can never silently merge or split groups. Each row shows the kind's clay icon +
tint (`APP_NOTIFICATION_KIND_META`, which carries `clay` alongside `emoji`/`tint` — the feed renders
the clay icon, `emoji` stays for other call sites), title, body, and a time-of-day label; tapping a
row navigates to `deeplink`. **There is still no per-item read endpoint** — opening the feed page is
the only "read" action, by design (§9).

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
                              RitualService (opensAt/prepStartsAt/bedTime), optional via ObjectProvider ·
                              decision_entry.review_due (mezo-b3pp.4, §3c — unreviewed decisions due today)
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
    2. NotificationPrefService.effectiveFor(owner)  → all 22 categories, stored row or code default
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
`feature/companion`/`feature/proactive` generators, so the original 12 `AppNotificationKind`s all have a live
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
    NotificationFeedPage open → POST /api/notification/feed/read-all  (markAllRead, optimistic)
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

### 3c. `decision_review` — a backend-native anchor over `decision_entry` (bd `mezo-b3pp.4`)

**Not part of §3b's `feedAnchors(...)` pipeline, despite living in the same "Az agy eseményei" FE
section (§2).** `decision_review` is the Journal domain's (`feature/journal`) decision journal +
review loop reaching its reminder day — it has no `app_notification` row and no `AppNotificationKind`
at all. `AnchorResolver.decisionReviewAnchors(owner, date)` reads `DecisionEntryRepository` directly
— a fourth backend-native anchor source, folded into `backendAnchors` alongside gym/medication/ritual
(§3), not alongside the feed:

```
for each decision_entry row owned by the user, unreviewed, with review_due == date:
    # NOT <= date — an already-overdue decision (review_due in the past, still unreviewed) never
    # fires again; the /me/naplo "Nézd vissza" chip (journal.md §2) carries that state instead, so
    # the push never nags on every day past the due date (a deliberate product decision)
    minute = minuteOfDay(mezo.notification.decision-review-time)   # fixed 09:00, independently
                                                                     # tunable from medication-time
    dedupSuffix = "HH:mm:" + first 8 chars of decision.id           # SAME shape as §3b's — needed
                                                                     # for the same reason: two
                                                                     # decisions can share a review_due
                                                                     # day (and therefore the same fixed
                                                                     # 09:00 anchor), so a bare "HH:mm"
                                                                     # suffix would collapse them into
                                                                     # one push via push_log's
                                                                     # day-scoped dedup (§4/§9)
    url = "/me/naplo"                                                # always the journal page, not a
                                                                     # specific decision — no per-item
                                                                     # deeplink exists for a decision
    title = "Hogyan sült el?"
    body  = excerptProse(decision.decisionText)                     # the decision's own text, never
                                                                     # the context snapshot or outcome
```

The dedup suffix shape is identical to §3b's, but the *reason* to reach for it is the same collision
class re-derived independently — not a re-use of `feedAnchors`. `AnchorSet`'s own javadoc on
`AnchoredEvent.dedupSuffix` names all **8** categories (the 6 feed-anchored ones, `decision_review`,
**and, since W5.2, `intervention`**) that need the `HH:mm:{id8}` shape; `decision_review` and
`intervention` each get there via their own direct read (`decision_entry` / `companion_message`)
rather than an `app_notification` row.

**Gotcha — `decisionReviewAnchors` is gated on `NOTIFICATION_SWITCH` alone, not `JOURNAL_SWITCH`.**
With `mezo.feature.journal.enabled=false` but notifications on, `DecisionEntryRepository` is still a
live bean (only `JournalController`/`DecisionService` are switch-gated, not the repository), so an
existing unreviewed decision whose `review_due` lands on today still produces a `decision_review`
push — whose `/me/naplo` deeplink then 404s (journal disabled). Honest in the sense that the anchor
data itself is real, not fabricated, but worth naming: this is the one push category that can point
at a currently-unreachable page.

### 3d. `intervention` + quiet hours — a backend-native anchor over `companion_message` (bd `mezo-b3pp.19`)

**Also not part of §3b's `feedAnchors(...)` pipeline** — like `decision_review` (§3c), `intervention`
folds into `backendAnchors` via its own resolver method, `AnchorResolver.interventionAnchors(owner,
date)`, reading `CompanionMessageRepository` directly (kind = `intervention`, [`proactive.md`](proactive.md)
§3/§4) rather than `app_notification`. Two things set it apart from every other backend-native
category, though: **the anchor is event-born** (a flag raise fires the card — [companion.md](companion.md)
§4/§5.8 — there is no fixed clock time the way `decision-review-time`/`medication-time` are), and
**it is the first (and, today, only) category `AnchorResolver` defers rather than simply anchors**:

```
interventionAnchors(owner, date):
    for cardDate in [date - 1, date]:                    # a deferred-from-yesterday card can land
                                                            # on TODAY — see below
        card = companion_message row, owner, cardDate, kind=intervention   (at most one, the
                                                                              partial-unique index)
        if no card, or card's library entry is gone, or entry.channel == "feed":
            skip                                          # channel gate — honest absence, no push
                                                            # for a feed-only or retired entry
        minute = interventionFireMinute(card.generatedAt, date,
                                         entry.quietHoursExempt, quietStart, quietEnd)
        if minute present:
            emit AnchoredEvent(INTERVENTION, minute, "HH:mm:" + card.id[0:8],
                                "Mezo · észrevétel", excerptProse(card.body),
                                "/nap/uzenetek?n=" + card.id + "&d=" + card.messageDate)
```

**`interventionFireMinute` (`AnchorResolver`, pure, no Spring — `InterventionFireMinuteTest`) — defer,
never drop:**

- Not exempt AND generated inside `[quietStart, quietEnd)` (wrap-aware — the default 22:00→07:00
  window crosses midnight) ⇒ the fire minute becomes `quietEnd`, on the day the window ends (the
  NEXT calendar day when the window itself wraps past midnight and generation landed before
  midnight; the SAME day when generation landed after midnight, already inside the wrapped window).
  Every other combination fires at the card's own `generatedAt` minute, unchanged — the
  `sleep_reaction`/`weight_reaction` precedent.
- The boundary is asymmetric BY DESIGN: `quietStart` itself is INSIDE the window (a card generated
  at exactly 22:00 defers), `quietEnd` itself is OUTSIDE it (a card generated at exactly 07:00 fires
  immediately) — the `[start, end)` half-open convention, pinned by
  `InterventionFireMinuteTest`'s two boundary cases.
- `quietHoursExempt` (per library entry, `mezo.companion.interventions[].quiet-hours-exempt`) skips
  the whole check — an exempt entry always fires on its own generation minute.
- `quietStart == quietEnd` (an operator setting `mezo.notification.quiet-hours` to a zero-width
  window) disables deferral entirely — never a division-by-zero or an all-day defer.
- Because a deferral can push the fire minute onto the NEXT calendar day, `interventionAnchors`
  resolves for BOTH yesterday's and today's card — a card generated at 23:10 yesterday, deferred to
  07:00, must still surface when `AnchorResolver.resolve` is asked for TODAY.

**`mezo.notification.quiet-hours` (`NotificationProperties.QuietHours`, `{start, end}`, default
`22:00`/`07:00`) — the platform's first do-not-disturb window, and, deliberately, a NARROW one.**
Every other push category already has an implicit "quiet enough" property (a `gym` reminder fires
30 minutes before a real slot, `medication` at a fixed 08:00, prose categories on their own
generation minute during the day) — `intervention` is the first category whose trigger (a flag
raise) can land at ANY hour, so it is the first to need an explicit window. **Widening quiet hours
to every category is a later, deliberate decision, not a drive-by** (`NotificationProperties`'s own
class javadoc says so) — today `DueEvaluator` and every other `AnchorResolver` method are entirely
unaware quiet hours exist. **Defer, never drop** is the load-bearing design choice: a suppressed
push is a silently lost intervention (the whole point of a JITAI-lite nudge is timeliness, but a
LATE nudge that arrives at 07:00 is still worth more than one that never arrives at all) — contrast
this with `decision_review`'s "arrived at its day or didn't, no urgency window" (§3c) and `gym`'s
lead-minute EARLY nudge; `intervention` is the one category that reschedules LATE.

**Fixed (mezo-b3pp.36) — the deeplink never worked, and not only for the reason the bd named.**
The bd that opened this work described a single defect: a cross-midnight-deferred card's
`message_date` stays the GENERATION day while the push announcing it arrives the next morning, so
the feed the deeplink implicitly targeted (the caller's local-today) never held the card. That is
real, but chasing it in isolation would have "fixed" a link that still went nowhere — the deeplink
had **three other, independent defects**, none named by the bd:

1. **Wrong route.** The url pointed at `/today?n=…`. `/today` is a LEGACY path — `router.tsx`'s
   `LegacyPathRedirect` sends it to `/nap`, the Nap **hub** (`NapHubPage`), which renders the
   mosaic of daypart tiles, not the companion thread. The thread — and the „Segített?"
   `FeedbackChips` the push exists to surface — lives on `NapMezoPage` at `/nap/uzenetek`
   ([today.md §3](today.md)). Even a same-day, full-id, unbroken `?n=` would have landed a page
   away from its target.
2. **No consumer.** Before this slice, nothing in the frontend read `?n=` at all — zero
   occurrences of the param anywhere under `frontend/src/`. The url carried a discriminator that
   no component looked for.
3. **Truncated id.** The url's `?n=` carried `card.id[0:8]`, the SAME 8-character prefix used for
   the push dedup key (below) — not because the page needed a short id, but because no page-side
   consumer had ever been written to require the full one. A consumer could only prefix-match,
   never exact-match, a `FeedMessage.id`.
4. **The date boundary the bd named.** Covered above: a quiet-hours-deferred card's `message_date`
   names the generation day, not the push-arrival day, and the feed reads local-today.

**The fix, and what it deliberately left alone:**
- The url now targets `URL_THREAD = "/nap/uzenetek"` with the card's **full** `id` and its own
  `messageDate`: `` `/nap/uzenetek?n=${msg.getId()}&d=${msg.getMessageDate()}` ``
  (`AnchorResolver.interventionAnchors`, backend). `NapMezoPage` reads `n`/`d`
  (`useSearchParams`); when `d` names a day other than local-today it calls `useCompanionFeed(d)` —
  a second, per-date cache entry, not a duplicate of today's own poll — finds the one row matching
  `n`, and renders it alongside (never in place of) today's own thread, `scrollIntoView`'d into
  view, with the same `useFeedback` chip wiring as any other persisted row ([today.md §3](today.md)
  for the page-side detail). A stale or unknown id degrades silently — no card renders, nothing
  throws.
- **No API contract change was needed.** `GET /api/proactive/feed` already accepted a `date` query
  parameter ([`proactive.md`](proactive.md) §5) — the fix is a caller finally passing it, not a new
  endpoint or field.
- **The push_log dedup key is deliberately UNCHANGED — still the 8-char fragment, not the full
  id.** `AnchoredEvent.dedupSuffix` stays `hhmm(minute) + ":" + card.id[0:8]`; only the url's `n=`
  grew to the full uuid. `push_log`'s day-scoped dedup keys off `dedupSuffix`
  (`"{category}:{HH:mm}:{id8}"`, §4 below) — widening its shape to the full id would change what
  counts as "already sent" and risks re-delivering a push already on the device. The full id and
  the dedup fragment are now two independently-sourced substrings of the same `card.id`, pinned
  apart by its own IT case (`AnchorResolverInterventionIT
  #testInterventionEvent_shouldKeepTheDedupKeyUnchanged_whenTheUrlGainsTheFullId`).
- **Still open, its own issue:** the OTHER `?n=` producer — §3b's `feedAnchors(...)`, which appends
  `n=` to each `app_notification` row's own arbitrary deeplink — remains just as unconsumed on the
  frontend as `intervention`'s was before this slice. This slice only wired a consumer for the
  `intervention` case; it did not audit or fix the feed-anchored one.

**Gotcha — `interventionAnchors` is gated on `NOTIFICATION_SWITCH` alone, not `INTERVENTION_SWITCH`
(the `decision_review`/`JOURNAL_SWITCH` gap of §3c, re-derived here).** `AnchorResolver` is a single
bean behind one `@ConditionalOnProperty(NOTIFICATION_SWITCH)`; `CompanionMessageRepository` has no
switch of its own. With `mezo.feature.intervention.enabled=false` but notifications on, an
already-existing `intervention`-kind card (delivered before the flip, or by any other still-running
path) is still read by `interventionAnchors` and still pushes — `InterventionService` stops minting
NEW cards the moment the switch is off, but `AnchorResolver` does not know the switch exists and
keeps anchoring whatever rows are already there. Same shape as §3c's gap, same fix if it's ever
worth closing: an explicit second switch check in `interventionAnchors` itself.

## 4. Data model & API

### `push_subscription` (N1 — unchanged)

See N1's own migration
[`202607291000_..._create_push_subscription.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607291000_mezo-h4wp.6.1_create_push_subscription.sql).
`endpoint`/`p256dh`/`auth`/`user_agent`/`last_success_at`, partial-unique on
`(created_by, endpoint)`. Entity `PushSubscriptionEntity`, service `PushSubscriptionService`.
Since S6 (`mezo-qw37.6`) `register` first soft-deletes any other account's live row for the same
endpoint — one browser = one account.

### `notification_pref` (N2)

Migration: [`202607291400_..._create_notification_pref_and_push_log.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607291400_mezo-h4wp.6.2_create_notification_pref_and_push_log.sql).

| Column | Notes |
|---|---|
| `category varchar(24) not null` | the catalog key; no DB CHECK — validated in code (`NotificationCategory.fromKey`) |
| `enabled boolean not null` | |
| `lead_minutes integer not null default 0` | CHECK `between 0 and 240` |

`uq_notification_pref_created_by_category` (partial, live rows only). **A missing row is never
"off"** — `NotificationPrefService.effectiveFor` reports the category's code default
(`NotificationCategory.defaultEnabled()`/`defaultLeadMinutes()`) for every one of the 22 keys, always
— so a fresh install needs no seed data and a future 23rd category ships with its intended default
instead of silently arriving OFF (`feature/notification/service/NotificationPrefService.java:32-44`,
javadoc: "All 22 categories" — `decision_review` was the 21st to land (mezo-b3pp.4) and
  `intervention` the 22nd (mezo-b3pp.19)).

### `push_log` (N2)

Same migration as above. `log_date date`, `dedup_key varchar(80)` (`"{category}:{anchorHHmm}"`, e.g.
`gym:10:00` — built from the **anchor** time, never the fire time, so changing a category's lead
cannot re-fire something already sent today for the same anchor), `category`, `sent_at`. **8**
categories key off a different, more specific form of the same shape instead —
`"{category}:{HHmm}:{id8}"` (e.g. `pattern:06:00:3f9a1c02`, `decision_review:09:00:7c1e02aa`,
`intervention:07:00:3f9a1c02`): the 6
feed-anchored categories (F3, bd `mezo-gzhp.3`) append the source `app_notification` row's id, so two
same-family events wake-deferred onto the same minute never collapse into one push (§3b/§9);
`decision_review` (W1.4, bd `mezo-b3pp.4`) appends the source `decision_entry` row's id for the exact
same reason at a fixed anchor instead of a wake-deferred one — two decisions can share a `review_due`
day, and both land on the same fixed `decision-review-time` minute, so a bare `HH:mm` suffix would
collapse them into one push (§3c/§9); `intervention` (W5.2, bd `mezo-b3pp.19`) appends the source
`companion_message` row's id for a THIRD independently-derived instance of the same collision — a
quiet-hours-deferred card generated YESTERDAY can land on the exact same target-day minute as
today's own card once both resolve through `interventionFireMinute` (§3d), so the bare `HH:mm` form
would collapse the two into one push. Neither `decision_review` nor `intervention` is feed-anchored
(§3c/§3d) — each merely needed the identical collision fix independently.
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

### `NotificationCategory` — the 22-key catalog (`feature/notification/domain/NotificationCategory.java`)

The single source of truth for which categories exist, their default enabled/lead, and which are
FE-written — pinned by `NotificationCategoryTest` against spec §6. Rows 15–20 (bd
`mezo-gzhp.3`) are the feed-anchored, family-level categories: they carry no anchor of their own in
`AnchorResolver`'s backend-native sense — their "anchor" is whichever `app_notification` row of that
family occurred today, wake-deferred (`AnchorResolver.feedAnchors(...)`, §3b). **Rows 21–22,
`decision_review` (bd `mezo-b3pp.4`) and `intervention` (bd `mezo-b3pp.19`), are each genuinely
backend-native** — they read `decision_entry` / `companion_message` directly (§3c/§3d), not
`app_notification` — but are listed here after the feed-anchored rows because they landed after
them and share no mechanism with rows 15–20 beyond the dedup-suffix shape (nor, beyond that shape,
with each other — §3d):

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
| 21 | `decision_review` | ON | 0 | no | `mezo.notification.decision-review-time` (09:00) on an unreviewed decision's own `review_due` day — never `<=` (mezo-b3pp.4, §3c) |
| 22 | `intervention` | ON | 0 | no | the `companion_message` kind=`intervention` row's OWN `generatedAt` minute — no cron/grace, it fires off a flag raise; non-exempt fires inside `mezo.notification.quiet-hours` DEFER to the window's end (never dropped); `channel: feed` (or a retired key) yields no anchor at all (mezo-b3pp.19, §3d) |

**`memoir_ready` deliberately has no row here** — its `familyKey()` is `null`, so it never reaches
`feedAnchors(...)`; the existing `memoir` category (row 7) already covers that event as a push, and
giving it a second category would double-notify the same moment (§4/§9, `AppNotificationKindTest`
pins the null).

**Only `gym` carries a non-zero `defaultLeadMinutes()`.** The ritual-family categories
(`ritual`/`lights_out`/`wind_down`) resolve their windows through `RitualService`, which already owns
`mezo.ritual.lead-min`/`prep-lead-min` — duplicating those offsets under `mezo.notification` would be
a second source of truth for the same minute (class javadoc, `NotificationCategory.java:12-17`).
`decision_review` similarly carries lead `0` — a decision review has no urgency window the way `gym`
does; it either has arrived at its `review_due` day or it hasn't.

### `feature/notification` classes

| Class | Responsibility |
|---|---|
| `NotificationCategory` | the 22-key catalog enum (above) |
| `DueEvaluator` | **pure**, no collaborators — a **backward** window: `nowMinute − (anchorMinute − lead) ∈ [0, catchUpMinutes)`, i.e. on time plus one recovered late minute at the default width 2 (§9). Deliberately does not normalize a negative fire minute into the previous evening — the honest answer for such a combination is that it never fires |
| `AnchorResolver` | the impure half — resolves all 22 categories' anchors for one owner+day into an `AnchorSet`; see §9 for its seven documented traps |
| `NotificationDispatchJob` | the per-minute `@Scheduled` cron — DB-only on the scheduler thread, hands the send to `PushDispatchExecutor` |
| `PushDispatchExecutor` | the `@Async` send handoff — a **separate bean** (§9) |
| `NotificationPrefService` | `effectiveFor` (all 21, code-default fallback) + `upsert` (per-category, blind-insert-safe) |
| `NotificationScheduleService` | `replace` (per-category full replace, `feWritten`-gated) + `liveFor` (the dispatcher's read) |
| `NotificationController` | implements `NotificationApi` — all six push operations, thin delegation |
| `PushSubscriptionService` / `PushSender` | N1, unchanged |

### `feature/appnotification` classes (F1 bd `mezo-gzhp.1` + F2 bd `mezo-gzhp.2`)

Moved out of `feature/notification` in F2 to break a `companion`↔`notification`↔`proactive` package
cycle once both domains needed to inject the emitter (§9).

| Class | Responsibility |
|---|---|
| `AppNotificationKind` | the 15-kind in-app catalog (§4) — all 15 wired to producers |
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
| `occurred_at timestamptz not null default now()` | drives feed order and the Ma/Tegnap/dated-day grouping (`groupByDay.ts`, §2a) |
| `read_at timestamptz` | null = unread; stamped in bulk by `markAllRead` (classic bell — no per-item read) |

`uq_app_notification_created_by_dedup_key` (partial, live rows only) — makes `emit` **idempotent**
across the cron-vs-lazy-GET double-generation race a future producer may have (F1's own producer,
`PatternDetectionService`, runs inline rather than on a cron, so it does not itself hit this race
today — the index is there because a later F2 producer will). `idx_app_notification_created_by_occurred_at`
serves the feed read (`created_by, occurred_at desc`).

### `AppNotificationKind` — the 15-kind catalog (`feature/appnotification/domain/AppNotificationKind.java`)

The single source of truth for the in-app feed's kind key, its push `familyKey`, and its
deeplink base — pinned by `AppNotificationKindTest`. **All 15 rows are wired to producers**
(the original 12 by F2, plus three later domain slices), and **every non-null `familyKey` now maps onto a live push category as of F3**
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
| `weekly_review_ready` | **null** | `/me/week` | `mezo-p2tr` — `WeeklyReviewGenerator` |
| `life_goal_plan` | **null** | `/me/goals/{goalId}` | `mezo-iizd.7` — `LifeGoalTriggerService` |
| `goal_suggestion` | **null** | `/me/goals/weight/suggestions/{suggestionId}` | `mezo-ricj.4` — `GoalSuggestionNotificationListener`, after a committed `GoalSuggestionProposedEvent` |

### API contract (`api/feature/notification/notification.yml`)

| Verb | Path | Slice | Notes |
|---|---|---|---|
| `POST`/`DELETE` | `/api/notification/subscription` | N1 | unchanged |
| `POST` | `/api/notification/test` | N1, dev-only | unchanged |
| `GET` | `/api/notification/pref` | N2 | all 22 categories, always complete — a category with no stored row reports its code default |
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
`pref`, any of the 22 keys is valid (every category — backend-native or FE-written — has a
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
- **Journal** ([`journal.md`](journal.md) §5, W1.4 bd `mezo-b3pp.4`) — **new, wired, one-way IN.**
  `decision_review` reads `DecisionEntryRepository` directly (§3c) — a fourth backend-native anchor
  source, distinct from every category above it in that it belongs to a domain outside `Today`/
  `Ritual`/`Train`/`Fuel`/`Medication`. `feature/journal` has no knowledge of `feature/notification` —
  the dependency runs the usual direction, `AnchorResolver` reading the owning feature's repository,
  same shape as the gym/medication/ritual reads above it.
- **Companion + Proactive (intervention delivery, W5.2 bd `mezo-b3pp.19`)** —
  **new, wired, one-way IN.** `intervention` reads `CompanionMessageRepository` directly (§3d) — a
  FIFTH backend-native anchor source, and the first one whose upstream trigger is itself an
  event chain across two OTHER features: a companion `FlagRaisedEvent` ([companion.md](companion.md)
  §4/§5.8) is turned into a `proactive`-owned `companion_message` row by
  `feature.proactive.service.InterventionService` ([`proactive.md`](proactive.md) §3/§4) BEFORE
  `AnchorResolver` ever sees it — this platform never touches `FlagRaisedEvent` or
  `feature.companion.flags` at all, only the resulting card. `mezo.notification.quiet-hours` (§3d) is
  this platform's own config, read by nobody outside `feature/notification`.
- **Fuel** ([`fuel.md`](fuel.md)) — **new seam, both directions; re-platformed onto the living-occurrence Stack (mezo-vx9v Task 9).** Fuel's own `frontend/src/features/fuel/logic/buildProtocol.ts` exports `deriveBlocks` (today's gym/sport/run blocks; moved out of `data/fuel/timelineHooks.ts`, which re-exports it for backward compatibility) and `PRE_WORKOUT_STACK_LEAD_MIN` — the **one canonical** "40 minutes before today's first training block" offset. Three callers now share the SAME `projectStackDay({occurrences, stash, intakes, wake, bed, mealsPerDay, blocks})` projection (each composing its own hooks inline, not via `useStackDay()` — the writer needs `useSleepGoal().isPending` plus `useStack()`/`useProtocol()`'s `pending`/`error` flags for its fire-once gate (§9 trap #8, `mezo-b6q0`), `NotificationsPage` needs the raw `blocks[]` for its gym sub-line): Fuel's own `useFuelTimeline`, this platform's `useScheduleSnapshotWriter` (the `fuel_slot` schedule rows), and `NotificationsPage`'s preview header — so the pre-workout stack time the Fuel/Stack page shows, the time persisted to `notification_schedule`, and the time the settings preview forecasts can never quietly disagree (a fix-round decision, `mezo-h4wp.6.3`, superseded onto occurrences by Task 9). The retired selection-based `buildProtocol()` builder and its `deriveProtocolAnchors`-mediated anchor derivation are gone from this path; `FUEL_WINDOW_LABEL` (`notificationScheduleWriter.ts`) is now keyed by the 8 `StackZoneKey` zone keys, not the old label set. Since the stim-aware split (mezo-j6c9) a day with ≥2 distinct-time training blocks can project TWO `pre_workout` slots (stim-free-named items anchor to the LAST block), so the writer emits up to two `fuel_slot` "edzés előtti" entries at their own times — per-slot emission handles this with no writer change.
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
  full per-producer dedup-key shapes. **All original 12 `AppNotificationKind`s emit, and F3 (bd
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
deterministic `notificationPrefSeed`, all 22 at spec defaults, synchronously; real fetches
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

function NotificationFeedPage() {
  const { items, isPending } = useNotificationFeed()
  const { markAllRead } = useNotificationFeedActions()
  // open-time snapshot of unread ids drives the highlight; effect fires markAllRead() once
  // (classic bell: badge clears immediately, page keeps its own read-snapshot for the highlight)
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

## 7. How to extend it (adding a 23rd category)

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
- `NotificationCategoryTest` — pins the 22-key catalog (keys, defaults, leads, `feWritten`) against
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
- `AnchorResolverDecisionIT` (W1.4, bd `mezo-b3pp.4`, §3c) — `decision_review`'s own case, kept
  separate from `AnchorResolverIT` since it drives `DecisionEntryRepository`/`JournalPopulator`
  fixtures the other categories don't touch: fires on the `review_due` day, suppressed once already
  reviewed, suppressed once the due day has passed (`review_due < today`, never `<=`), and two
  decisions due on the same day produce two anchors with distinct `HH:mm:{id8}` dedup suffixes.
- `AnchorResolverInterventionIT` (W5.2, bd `mezo-b3pp.19`, §3d) — `intervention`'s own case, kept
  separate for the same reason as `AnchorResolverDecisionIT`: it drives
  `CompanionMessagePopulator`'s explicit-`generatedAt` seeding (avoids `Instant.now()` flakiness at
  a minute boundary), not the other categories' fixtures. A `both`-channel card anchors on its own
  generation minute in daytime; a `both`-channel card generated in quiet hours DEFERS ACROSS THE DAY
  BOUNDARY (asserted by resolving for TOMORROW, the case §3d calls out); a `feed`-channel card's
  library entry yields no anchor; a card whose key has been retired from the library also yields
  none. `AnchorResolverIT`/`AnchorResolverFeedIT` are re-run alongside it in this slice's Task 9
  gate as a REGRESSION guard on the shared `AnchorResolver.resolve` entry point — neither gained new
  W5.2 cases; they simply must stay green after the `interventionAnchors`/`backendAnchors` edit.
- `service/InterventionFireMinuteTest` (W5.2, bd `mezo-b3pp.19`, pure, no Spring, §3d) —
  `interventionFireMinute` as a table: same-day fire in daytime; defer to the NEXT day's quiet-end
  when generated late evening; defer to the SAME day's quiet-end when generated early morning
  (already inside the wrapped window); the quiet-start boundary is INSIDE the window, the quiet-end
  boundary is OUTSIDE it (`[start, end)`, asymmetric by design); immediate fire when
  `quietHoursExempt`; never defers when `start == end`.
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
- Commands: `cd backend && ./mvnw clean test -Dtest='*Notification*,DueEvaluator*,AnchorResolver*,InterventionFireMinuteTest'` (the last is added by name — its `service/` package doesn't match the other three globs).

**Frontend (Vitest + RTL + MSW, both modes) — N2/N3 add:**
- `shared/ui/ToastProvider.test.tsx` + `shared/lib/toastBus.test.ts` — optional simple-toast action rendering, Promise invocation, immediate dismissal and unchanged reward/queue behavior (`mezo-ubxd`).
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
- `AppNotificationKindTest` — pins the 15-key catalog (keys, familyKey, deeplink) against the spec.
- `GoalSuggestionNotificationIT` (`feature/goal`, `mezo-ricj.4`) — pins the AFTER_COMMIT `goal_suggestion` producer, suggestion-id dedup, rollback safety and owner isolation.
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

**In-app feed (F1/mezo-nol0) — frontend:**
- `data/notification/feedHooks.test.tsx` (both mock/real modes) — the honest-empty real
  pre-resolve, the mapped view shape, `markAllRead`'s optimistic flip + rollback.
- `features/notification/logic/groupByDay.test.ts` — Ma/Tegnap plus every older day getting its own
  dated label (no `Korábban` bucket any more), newest-first sorting, pure and deterministic (`today`
  injected, no `new Date()` inside).
- `features/me/pages/NotificationFeedPage.test.tsx` — the hero shows the open-time unread count (not
  a live 0), items land in Ma vs. dated older groups, a row tap navigates to its `deeplink`,
  open-time-unread rows stay highlighted for the rest of the page's life, the Beállítások button
  goes to `/me/ertesitesek/beallitasok`.
- `features/me/pages/NotificationFeedPage.empty.test.tsx` — genuinely empty feed shows the ghost
  state with no day-label header; a real-mode cold fetch (`isPending: true`, `items: []`) shows
  neither the ghost text nor a false empty state.
- Commands: `cd frontend && VITE_USE_MOCK=true pnpm test` and `VITE_USE_MOCK=false pnpm test` (both
  modes explicitly — an unset `VITE_USE_MOCK` silently means mock mode).

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
  8. **The FE snapshot must only be written from SETTLED reads — an unresolved `realEmpty` is not
     real data.** `useScheduleSnapshotWriter` used to gate on `useSleepGoal().isPending` alone, so
     an app open where the (heaviest) pantry query was still unresolved — while the protocol query
     already had its occurrences — projected every occurrence against an empty stash and persisted
     `projectStackDay`'s `'(törölt Kamra-item)'` fallback as every `fuel_slot` body, which the
     dispatcher then pushed **verbatim** ("Stack · reggeli slot" → "(törölt Kamra-item) + …") until
     a later open happened to win the race; opens where the protocol was *also* unresolved replaced
     only the `checkin` category, so the poisoned `fuel_slot` rows survived them (`mezo-b6q0`). The
     gate now also waits for `useStack()`/`useProtocol()` to settle **successfully** (their new
     `pending`/`error` flags, real-mode only) — a terminally errored read skips the write entirely
     for the session (the failed-PUT rule already accepts "this open wrote nothing; the next one
     retries"). The remaining, deliberate gap: `useIntakes`/`useFuelSettings`/`useTrain`/
     `useRunning` still expose no pending flag, so slot TIMES can snapshot a beat stale — stale
     times degrade gracefully; fallback names were garbage, hence the gate.
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
- **Classic bell semantics, deliberately simple: opening the feed page marks EVERYTHING read.** There
  is no per-item read endpoint (§4) — the page's own open-time snapshot (`NotificationFeedPage`'s
  `snapshot` ref) is what keeps the just-read rows' highlight/dot visible while you're on the page,
  so the UI doesn't need a "half-read" server state to look right. A finer-grained per-item read
  model was considered and rejected as unneeded complexity for a single-user app. Before mezo-nol0
  this contract lived on the header's dropdown panel (`NotificationBell`/`NotificationPanel`, now
  deleted, mezo-h682); moving it onto a full page changed the surface, not the semantics.
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

**W1.4 (bd `mezo-b3pp.4`) — `decision_review` gotchas:**
- **`decision_review` needed the SAME `HH:mm:{id8}` dedup-suffix fix as F3's feed rows, for a
  DIFFERENT reason — arrived at independently, not by re-reading §3b's rationale into a shared
  helper.** F3's collision is wake-deferral putting several distinct rows on one minute; W1.4's is
  simpler — `decision_review` has one fixed anchor (`mezo.notification.decision-review-time`, 09:00),
  so any two decisions that happen to share a `review_due` day land on the exact same minute by
  construction, every time, not just on a busy night. A bare `{category}:{HHmm}` key would silently
  drop the second decision's push. **Do not read this as "reuse `feedAnchors`'s dedup logic"** —
  `decisionReviewAnchors` (§3c) builds its own suffix the same way, independently, because it has no
  `app_notification` row to key off of; `AnchorSet`'s own `AnchoredEvent.dedupSuffix` javadoc names
  all 8 categories that need this shape (the 6 feed-anchored ones, `decision_review`, **and**, since
  W5.2, `intervention`) precisely
  so a future reader doesn't assume the shape is F3-only.
- **The `review_due == date` firing rule is `==`, never `<=`, by deliberate product decision — do not
  "fix" it to also catch overdue decisions.** An unreviewed decision whose `review_due` has already
  passed does not keep re-firing a push every day thereafter. This was chosen over the more "helpful"
  looking `<=` specifically because a decision review, unlike a scheduled event, has no natural
  end-of-window — an ever-growing backlog of overdue reviews would either nag daily forever or need
  its own suppression logic layered on top. The `/me/naplo` „Nézd vissza" chip
  ([`journal.md`](journal.md) §2) already surfaces every overdue decision whenever the user opens the
  page, so the push's job is only to prompt the FIRST look, not to chase.
- **`decision_review` is grouped in the FE's "Az agy eseményei" section (§2) despite being
  backend-native, not feed-anchored.** This is a UI-consistency choice (`NOTIFICATION_CATEGORY_META`'s
  `section: 'brain'`), not a claim that it shares a resolution mechanism with `pattern`/`knowledge`/
  etc. — see §3c for why it's actually a fourth `AnchorResolver.backendAnchors` source, alongside gym/
  medication/ritual, not a `feedAnchors(...)` consumer.

**W5.2 (bd `mezo-b3pp.19`) — `intervention` + quiet hours gotchas:**
- **Quiet hours is scoped to ONE category on purpose — not a placeholder for "not done yet."**
  `NotificationProperties`'s own class javadoc says the widening is "a later, deliberate decision,
  not a drive-by" (§3d). `DueEvaluator` (the backward catch-up window) and every OTHER
  `AnchorResolver` method are entirely unaware `mezo.notification.quiet-hours` exists — a `gym`
  reminder at 22:30 or a `briefing` at 05:45 fires exactly as it always has. Do not read
  `intervention`'s deferral as evidence the platform is "moving toward" a global quiet window;
  widening it is its own future decision with its own tradeoffs (e.g. `gym`'s lead-minute EARLY
  nudges have no analogous "defer" concept).
- **Defer, never drop, is the opposite instinct from `decision_review`'s `==`-not-`<=` rule right
  above, and deliberately so — they're solving different problems.** `decision_review` suppresses a
  RECURRING nag (an overdue review would otherwise re-fire daily forever); `intervention` defers a
  ONE-SHOT card that only ever fires once, on the day it was generated (§4's partial-unique index
  already guarantees at most one `intervention` row per user per day) — there is no "forever" to
  suppress, only a single push to reschedule into an allowed window. Applying `decision_review`'s
  "just don't fire it" instinct to `intervention` would silently discard the day's only nudge.
- **`interventionFireMinute` resolves the SAME card for two different `date` arguments across a
  midnight boundary — this is not a bug in the `for cardDate in [date-1, date]` loop, it is the
  point.** A card generated at 23:10 that defers to 07:00 the next morning does not "belong" to
  either calendar day in the usual sense (`message_date`/`generatedAt` both still say yesterday);
  `AnchorResolver.resolve(owner, TODAY)` must still surface it, which is why `interventionAnchors`
  is the one resolver method in this class that reads yesterday's row as well as today's. Every
  other backend-native/prose anchor in this doc resolves strictly within the day it's asked about.
- **The channel gate (`channel: feed` ⇒ no anchor) reads `mezo.companion.interventions` LIVE, at
  resolve time, not from anything frozen on the card.** A library entry's `channel` can change
  between when a card was generated and when `AnchorResolver` resolves today's push (a config
  redeploy) — the card's `interventionKey` is the only thing persisted; the channel decision is
  always the CURRENT config's. A key removed from the library entirely (`entry.isEmpty()`) is
  treated identically to `channel: feed` — honest absence, never a stale push for a retired entry.

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
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/config/NotificationProperties.java` — `mezo.notification.{body-max-chars,medication-time,decision-review-time,prose-excerpt-chars,dispatch-cron,catch-up-minutes,prose-generation-grace-min,quiet-hours.{start,end}}` (`decision-review-time` is W1.4, bd `mezo-b3pp.4`, default 09:00, §3c/§4; `prose-generation-grace-min` reads the generator crons from `mezo.proactive.*` — see §9 trap #6; `quiet-hours` is W5.2, bd `mezo-b3pp.19`, default `22:00`/`07:00`, the nested `QuietHours` record, §3d/§4 — today only `intervention` consults it)
- Migrations: `202607291000_mezo-h4wp.6.1_create_push_subscription.sql`, `202607291400_mezo-h4wp.6.2_create_notification_pref_and_push_log.sql`, `202607291500_mezo-h4wp.6.3_create_notification_schedule.sql` (all under `db/changelog/1.0.0/script/`, registered in `1.0.0/1.0.0_master.yml`)
- `backend/src/main/resources/messages.properties` — `WEBPUSH_KEY_INVALID`/`WEBPUSH_SIGN_FAILED`/`WEBPUSH_ENCRYPT_FAILED`/`NOTIFICATION_UNKNOWN_CATEGORY`
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `NOTIFICATION_SWITCH`, `NOTIFICATION_DISPATCH_JOB_SWITCH`
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/{AnchorResolverIT,AnchorResolverRitualSwitchOffIT,AnchorResolverDecisionIT,AnchorResolverInterventionIT,DueEvaluatorTest,NotificationApiIT,NotificationCategoryTest,NotificationDispatchJobIT,NotificationPrefApiIT,NotificationPrefRepositoryIT,NotificationScheduleApiIT,PushSenderIT,PushSubscriptionRepositoryIT,PushSubscriptionServiceIT}.java` (`AnchorResolverDecisionIT` is W1.4, bd `mezo-b3pp.4`, §3c/§8; `AnchorResolverInterventionIT` is W5.2, bd `mezo-b3pp.19`, §3d/§8 — each is the only file in this list owned by its own driving slice, not the N/F slices), `feature/notification/service/{AnchorResolverExcerptTest,InterventionFireMinuteTest,PushSenderTruncationTest}.java`; `support/populator/NotificationPopulator.java`; `support/ResetDatabase.java` (`notification_pref`/`push_log`/`notification_schedule` in the TRUNCATE list)

**Backend — `feature/appnotification` in-app feed (F1 bd `mezo-gzhp.1` + F2 bd `mezo-gzhp.2`; moved
out of `feature/notification` in F2 to break a `companion`↔`notification`↔`proactive` package
cycle, §9)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/domain/AppNotificationKind.java` — the 15-kind catalog (§4)
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/entity/AppNotificationEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/repository/AppNotificationRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/service/{AppNotificationService,AppNotificationEmitter}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/controller/NotificationFeedController.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/config/NotificationFeedProperties.java` — `mezo.notification.feed.{limit,inbox-min-abs-r,inbox-max-p,band-promising,band-strong}` (the last four MUST mirror the FE Insights constants, §5/§9)
- Migration: `202608181400_mezo-gzhp.1_create_app_notification.sql` (`db/changelog/1.0.0/script/`, registered in `1.0.0/1.0.0_master.yml`)
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `NOTIFICATION_FEED_SWITCH` (`mezo.feature.notification-feed.enabled`)
- Producers (all live outside `feature/appnotification`, injecting `AppNotificationEmitter`, §3a/§5):
  - F1: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionService.java` — `upsert`/`recordSnapshot`/`reinforcePromotedFact`
  - F2, `feature/companion/service/`: `FactExtractionService.java` (`fact_candidate` + a second `fact_reinforced` source), `HypothesisPipelineService.java` (`hypothesis_new`), `DailySummaryService.java` (`memory_note`)
  - F2, `feature/proactive/service/`: `MemoirGenerator.java` (`memoir_ready`), `PredictionGenerator.java` (`prediction_new`), `PredictionValidationService.java` (`prediction_outcome`), `ExperimentProposalGenerator.java` (`experiment_proposed`), `ExperimentOutcomeService.java` (`experiment_closed`), `ChallengeGenerator.java` (`challenge_event`, proposed), `ChallengeOutcomeEvaluator.java` (`challenge_event`, closed)
  - Later slices: `feature/proactive/service/WeeklyReviewGenerator.java` (`weekly_review_ready`), `feature/lifegoal/service/LifeGoalTriggerService.java` (`life_goal_plan`), and `feature/goal/service/{GoalSuggestionService,GoalSuggestionProposedEvent,GoalSuggestionNotificationListener}.java` (`goal_suggestion`, AFTER_COMMIT and feed-only).
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/appnotification/{AppNotificationRepositoryIT,AppNotificationServiceIT,NotificationFeedApiIT,AppNotificationKindTest,PatternEmitIT}.java`; per-producer emit assertions added directly to `feature/companion/{FactExtractionServiceIT,HypothesisPipelineServiceIT,DailySummaryServiceIT}.java` and `feature/proactive/{MemoirGeneratorIT,PredictionGeneratorIT,PredictionValidationIT,ExperimentProposalGeneratorIT,ExperimentOutcomeIT,ChallengeGeneratorIT,ChallengeOutcomeIT}.java` (all ten dropped class-level `@Transactional`, §9); `feature/goal/GoalSuggestionNotificationIT.java`; `support/populator/AppNotificationPopulator.java`; `support/ResetDatabase.java` (`app_notification` in the TRUNCATE list)

**API contract**
- `api/feature/notification/notification.yml` → merged `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts` + generated `io.mrkuhne.mezo.api.controller.{NotificationApi,NotificationFeedApi}` / `io.mrkuhne.mezo.api.dto.{PushSubscriptionRequest,PushTestResponse,NotificationPref,NotificationPrefListRequest,NotificationPrefListResponse,NotificationScheduleEntry,NotificationScheduleRequest,NotificationFeedItem,NotificationFeedResponse}` (the last two DTOs are F1's `NotificationFeed` tag, §4)

**Frontend — service worker + PWA build (N1, unchanged)**
- `frontend/public/push-sw.js`, `frontend/vite.config.ts` (`workbox.importScripts`), `frontend/.env.example` (`VITE_VAPID_PUBLIC`), `.github/workflows/deploy.yml` (same variable in `build-frontend`'s `env:`)

**Frontend — data layer**
- `frontend/src/shared/lib/toastBus.ts` + `frontend/src/shared/ui/ToastProvider.tsx` — the global simple/reward toast bus and host; simple toasts alone may carry the optional Promise-capable action (§2).
- `frontend/src/data/notification/{notificationApi,notificationMock,notificationHooks,notificationPrefHooks,notificationScheduleWriter}.ts` — `usePushSubscription()` (N1) + `useNotificationPrefs()` (N2) + `useScheduleSnapshotWriter()`/`buildScheduleEntries()` (N3), all re-exported from `frontend/src/data/hooks.ts`
- `frontend/src/data/notification/{feedApi,feedMock,feedHooks}.ts` (F1) — `useNotificationFeed()` + `useNotificationFeedActions()`, re-exported from `frontend/src/data/hooks.ts` (§6)
- `frontend/src/data/types.ts` — `PushSubscriptionState`/`PushErrorCode` (N1); `NotificationCategoryKey`/`NOTIFICATION_CATEGORIES`/`NotificationPrefView`/`NotificationCategoryMeta`/`NOTIFICATION_CATEGORY_META` (N2, the 22-key HU copy catalog — `decision_review` appended, mezo-b3pp.4, then `intervention` last, mezo-b3pp.19); `AppNotificationKindKey`/`AppNotificationView`/`APP_NOTIFICATION_KIND_META` (the 15-key catalog)
- `frontend/src/app/AppLayout.tsx` — calls `useScheduleSnapshotWriter()` once per app-session mount

**Frontend — Me surface (documented from Me's side in [`me.md`](me.md) §2/§10)**
- `frontend/src/features/me/pages/NotificationsPage.tsx` (route `/me/ertesitesek/beallitasok`)
- `frontend/src/features/me/components/{PushInstallGate,NotificationPreviewHeader,NotificationCategoryRow}.tsx`
- `frontend/src/features/me/logic/notificationForecast.ts` — the pure `forecastToday(...)` preview computation

**Frontend — in-app feed surface (F1 bd `mezo-gzhp.1`, feed page mezo-nol0, §2a)**
- `frontend/src/features/me/pages/NotificationFeedPage.tsx` (route `/me/ertesitesek`) — the full feed
  page; the only `markAllRead()` call site
- `frontend/src/features/notification/logic/groupByDay.ts` — the pure day-bucketer (Ma/Tegnap, then
  one dated label per older day)
- `frontend/src/app/AppHeader.tsx` — `.nap-ntfmenu`, the shell header's 3-row peek popover into the
  same feed cache
- `frontend/src/styles/prototype.css` — the `.nf-*` feed-page CSS rules (the retired
  `NotificationBell`/`NotificationPanel` dropdown's `.nf-bell`/`.nf-panel` rules were removed with
  those components, mezo-h682)

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
- Integration: [`docs/features/journal.md`](journal.md) §5 — the decision journal (W1.4, bd `mezo-b3pp.4`) that sources `decision_review` (§3c/§4); plan: [`docs/superpowers/plans/2026-08-20-w1-4-decision-journal.md`](../superpowers/plans/2026-08-20-w1-4-decision-journal.md)
- Integration: [`docs/features/companion.md`](companion.md) §4/§5.8/§9 — the W5.1 composite-flag evaluator + `FlagRaisedEvent` that trigger `intervention` (§3d/§4), and the selection/config side (`mezo.companion.interventions`); [`docs/features/proactive.md`](proactive.md) §3/§4/§10 — the sixth `companion_message` kind `intervention` sources this platform's row read (§3d)
