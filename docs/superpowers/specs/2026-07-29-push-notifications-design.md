# Push notifications (H2) — iOS Web Push delivery for the proactive layer · Design spec

**Date:** 2026-07-29
**Status:** approved (brainstorming 2026-07-29), writing-plans next
**Driver:** `mezo-h4wp.6` (roadmap §H2, deferred 2026-07-07, picked up here) · slices `mezo-h4wp.6.1` → `.2` → `.3`
**Companion mockup:** [`2026-07-29-push-notifications-mockup.html`](2026-07-29-push-notifications-mockup.html) (notification copy per category + the three settings directions; direction **C** approved)
**Predecessors:** [`2026-07-06-proactive-layer-design.md`](2026-07-06-proactive-layer-design.md) §H2 · [`2026-07-06-proactive-roadmap.md`](../plans/2026-07-06-proactive-roadmap.md) §H2

---

## 1. Goal and scope

**Goal:** the companion reaches Daniel's iPhone **with the app closed** — both the prose it already generates and the time-anchored reminders his own data already implies.

The proactive epic is complete: `briefing`, `heartbeat_note`, `weekly_suggestion`, `memoir` are generated on crons and rendered in-app. H2 was deferred as *"pure delivery infra"*. This spec is that infra — plus the second feed the brainstorming surfaced, which H2's original brief did not contain.

**v1 scope (approved):** **one delivery layer, two feeds.**

- **Feed A — proactive prose:** the already-generated content, delivered at Daniel's **personal anchors** rather than at generation time.
- **Feed B — time-anchored reminders:** gym start, sleep wind-down + lights-out, the Napzárás window, the Reta injection day, the 4 daily check-ins, and the fuel/stack slots.

**Volume policy (approved):** **per-category toggle + adjustable lead**, with conservative v1 defaults. 7 of 11 categories default ON ≈ 6-7 pushes/day. The user tunes volume at runtime; no designed-in cap, no priority-drop.

**Out of v1 (deliberate):**

- **Quiet hours** — the per-category toggles already cover the need; a night-time category is either off or wanted.
- **A designed daily cap / priority-drop** — rejected in brainstorming: silently dropping a notification works against IDENT-3 ("never silent, honestly").
- **Coalescing / digest windows** — deferred; the settings preview header (§7) makes dense windows *visible*, which is the cheaper 80%.
- **State-driven (reactive) pushes** — expiring quests, at-risk streaks, validated predictions, level-ups. Rejected for v1: unpredictable timing, and streak/quest nagging collides with ADR 0010 ("no punishment, no streak anxiety").
- **Multi-device fan-out tuning** — the schema supports N subscriptions; no per-device preferences.

**Non-goal:** replacing any in-app surface. Push is a **channel**. Everything it delivers stays visible in-app (Today cards, check-in strip, `RitualCard`, Insights tabs). A category toggled off loses its push, never its content.

---

## 2. Why not the weekly-planner architecture

The `weekly-planner` project solved this problem already, and its shape is instructive **because most of it does not transfer**:

| weekly-planner | Why it was that way | mezo |
|---|---|---|
| Deno backend function on base44 | No own backend | **Own Spring Boot backend** |
| External cron (cron-job.org) hitting a public endpoint every minute | base44 charged 1 integration credit per automation run (~1440/day) | **`@Scheduled`** — 18 such jobs already run; scheduling is free |
| `X-Cron-Secret` shared secret on an internet-reachable endpoint | Consequence of the external cron | **No public trigger endpoint at all** — the attack surface disappears |
| `npm:web-push` | Node ecosystem | **Own `techcore/webpush`** (§4) |

What **does** transfer, and is adopted verbatim:

- The **`dueBlocks` formula** with a catch-up window: `(anchorMin − lead) − nowMin ∈ [0, catchUp)`, `catchUp = 2`. Catches a missed cron minute; double-send is prevented by the log, not by the window.
- The **`PushLog` dedup** idiom: one row per `(date, dedupKey)`, written *before* the send.
- **Spike-first ordering** (§10) — the first task sends one real push to a real device before any dispatcher is built.
- The **iOS install-gate** in the opt-in UI.

---

## 3. Architecture and data flow

```
[FE opt-in — Me → Értesítések]
    Notification.requestPermission()
    → navigator.serviceWorker.ready → reg.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: VITE_VAPID_PUBLIC })
    → POST /api/notification/subscription {endpoint, p256dh, auth, userAgent}   → push_subscription

[FE app-open — N3]
    PUT /api/notification/schedule  (the FULL recurring weekly set, per category)
    → notification_schedule   (fuel slot/stack + check-in: weekday, time, title, body, deeplink)

[NotificationDispatchJob]  @Scheduled(cron = "${mezo.notification.dispatch-cron}")   # 0 * * * * *
    server zone = Europe/Budapest (k8s/backend/deployment.yaml:34 pins TZ) — see §8
    1. load notification_pref            → disabled category: skipped before any computation
    2. DueEvaluator (PURE)  →  due items from THREE sources:
         a) backend-native anchors   gym_schedule_slot / sport_schedule · RitualService
                                     (opensAt / prepStartsAt / bedTime) · medication cadence
         b) prose readiness          a briefing / heartbeat_note / weekly_suggestion / memoir row
                                     EXISTS **and** its personal anchor minute has arrived
         c) FE snapshot              today's notification_schedule rows (weekday match or null)
    3. push_log dedup on (date, dedupKey)  → already sent: skip
    4. techcore/webpush → send to every live push_subscription
    5. response 404 / 410  → soft-delete that subscription (dead device drops out by itself)

[Service worker — public/push-sw.js, imported by the generateSW worker]
    'push'              → showNotification(title, {body, icon, badge, tag, data: url})
    'notificationclick' → focus an existing window, else openWindow(data.url)
```

**Generation and delivery are separated.** The 18 existing crons keep writing content on their own schedule, untouched; the dispatcher decides *when it leaves*. Zero changes to `BriefingJob`, `HeartbeatJob`, `WeeklySuggestionJob`, `MemoirJob`.

**Package:** a new `feature/notification/{controller,service,repository,entity,dto,mapper}` per `java_package_structure.md`, plus `techcore/webpush` for the protocol (infra, not a feature).

---

## 4. `techcore/webpush` — the protocol, zero new dependencies

**Decision:** implement Web Push in-house rather than take `nl.martijndwars:web-push`.

*Rationale:* that library is effectively unmaintained (last release ~2022, no Spring Boot 4 / Java 21 validation) and drags in BouncyCastle + jose4j — three dependencies and a heavy CVE surface for ~250 lines of standard-primitive assembly. This is **not** inventing cryptography: RFC 8291 has **published test vectors**, so correctness is provable by unit test.

| Class | Responsibility |
|---|---|
| `VapidSigner` | ES256 JWT — `aud` = push-service origin, `exp` ≤ 24h, `sub` = `mailto:`. JDK `Signature("SHA256withECDSA")` + **DER → JOSE `r‖s`** conversion (the classic trap: JOSE wants fixed 64 raw bytes, the JDK emits DER). |
| `Aes128GcmEncryptor` | ECDH P-256 against the subscription's `p256dh` → **HKDF-SHA256** (hand-rolled over `Mac`, ~20 lines — the JDK `KDF` API is 24+, this project is on 21) → AES-128-GCM → **RFC 8188 `aes128gcm`** body framing (salt ‖ rs ‖ idlen ‖ keyid ‖ ciphertext). |
| `WebPushClient` | `RestClient` POST with `Authorization: vapid …`, `Content-Encoding: aes128gcm`, `TTL`, `Urgency`, `Topic`. Maps 201 → sent, **404/410 → GONE** (caller soft-deletes), 413 → payload too large, 429 → retry-after (logged, not retried in v1). |
| `WebPushProperties` | `@Validated` record on `mezo.webpush.*` — `subject`, `public-key`, `private-key`, `default-ttl`. **Never `@Value`** (`configuration_conventions.md`). |

**Proof of correctness:** an `Aes128GcmEncryptorTest` pinning the **RFC 8291 §5 test vector** (fixed keys + salt → bit-exact ciphertext), and a `VapidSignerTest` verifying the emitted JWT against the public key + asserting a 64-byte JOSE signature. No device, no network, no LLM. HTTP behaviour (201/410/413) is covered by a WireMock IT — the `jsoup`/WireMock precedent already in the pom.

**Payload budget:** push payloads must stay under ~4 KB. Bodies are truncated to 300 chars server-side (`notification_schedule.body` is `varchar(300)`); prose pushes take the **first sentence or 160 chars** of the generated text, never a re-generation.

---

## 5. Data model — four new tables

All follow the house rules: `UUID` PK (`gen_random_uuid()`), `created_by uuid` set server-side from the principal, `is_deleted` + `@SQLRestriction`/`@SQLDelete`, explicit constraint names. Liquibase scripts named `202607xxxxxx_mezo-h4wp.6_*.sql` (12-digit UTC prefix + driving bd id).

### `push_subscription` (N1)

| Column | Notes |
|---|---|
| `endpoint text NOT NULL` | the push service URL |
| `p256dh varchar(120) NOT NULL` | subscription public key, base64url |
| `auth varchar(40) NOT NULL` | subscription auth secret, base64url |
| `user_agent varchar(300)` | device identification |
| `last_success_at timestamptz` | last 201; a diagnostic, not a gate |

`uq_push_subscription_created_by_endpoint` — partial unique on live rows (re-subscribing the same device must not duplicate).

### `notification_pref` (N2)

| Column | Notes |
|---|---|
| `category varchar(24) NOT NULL` | the §6 catalog key; CHECK-pinned |
| `enabled boolean NOT NULL` | |
| `lead_minutes int NOT NULL DEFAULT 0` | CHECK `between 0 and 240` |

`uq_notification_pref_created_by_category`. **Rows are seeded lazily:** a missing row means "the code default" (§6 table), so a fresh install needs no migration data and a newly added category arrives with its intended default rather than as OFF. Seed data, when needed, is Java `@Profile("demodata")` — never SQL.

### `notification_schedule` (N3)

| Column | Notes |
|---|---|
| `weekday smallint` | 1-7 ISO, **NULL = every day** (CHECK `between 1 and 7`) |
| `time varchar(5) NOT NULL` | `HH:mm`, the existing `gym_schedule_slot.time` / `check_in.slot_time` convention |
| `category varchar(24) NOT NULL` | CHECK-pinned to the FE-authoritative subset |
| `title varchar(120) NOT NULL` · `body varchar(300)` | **the FE writes the copy too** |
| `deeplink varchar(200) NOT NULL` | in-app route the tap opens |
| `source varchar(24) NOT NULL` | provenance, e.g. `buildProtocol`, `checkinSlots` |

Replacement is **per category**: soft-delete the category's live rows + insert the new set in one transaction (the `briefing` regeneration precedent — a soft-deleted row never blocks reinsertion).

### `push_log` (N2)

| Column | Notes |
|---|---|
| `date date NOT NULL` | the local day |
| `dedup_key varchar(80) NOT NULL` | `"{category}:{anchorHHmm}"`, e.g. `gym:17:00` |
| `category varchar(24) NOT NULL` · `sent_at timestamptz NOT NULL` | |

`uq_push_log_created_by_date_dedup_key`. **The row is written before the send** — a send failure must not re-fire the same notification on the next minute; a lost notification is strictly better than a duplicated one.

**Retention:** `push_log` grows ~7 rows/day (~2.5k/year, single user) — no pruning job in v1. Revisit if it passes 100k rows.

---

## 6. The 11 categories

| # | Category key | Anchor | Source of truth | v1 default |
|---|---|---|---|---|
| 1 | `briefing` | `SleepAnchorPort.resolve(user).wake()` | `briefing` row exists | **ON** |
| 2 | `gym` | slot − lead (**30 min**) | `gym_schedule_slot.time` / `sport_schedule.time` | **ON** |
| 3 | `medication` | `mezo.notification.medication-time` (**08:00**) on a cycle day | `medication.cadence` + jsonb cycle envelope | **ON** |
| 4 | `ritual` | ritual `opensAt` | `RitualService` (`RitualService.java:72`) | **ON** |
| 5 | `lights_out` | `sleep_goal.anchor_time` | `RitualService` `bedTime` (`:71`) | **ON** |
| 6 | `weekly` | Monday, wake anchor | `weekly_suggestion` row exists | **ON** |
| 7 | `memoir` | Sunday 19:00 | `memoir` row exists | **ON** |
| 8 | `wind_down` | ritual `prepStartsAt` (bed − `mezo.ritual.prep-lead-min`, **45**) | `RitualService` (`:73`) | OFF |
| 9 | `midday` | 12:30 | `heartbeat_note` midday row | OFF |
| 10 | `checkin` | 4× daily | FE snapshot (`data/today/checkins.ts`) | OFF |
| 11 | `fuel_slot` | 6 slots/day | FE snapshot (`buildProtocol`) | OFF |

**Missing-anchor fallbacks — corrected against the code (2026-07-29).** The wake/bed anchor is **owned by `SleepAnchorPort.resolve(userId)`** (`feature/biometrics/sleep`), returning `SleepAnchor(LocalTime wake, LocalTime bed)`. It **never returns empty**: an absent `sleep_goal` row falls back to `SleepGoalProperties` (`mezo.sleep.default-*`). So `mezo.notification.default-wake` is unnecessary and must NOT be introduced — it would be a third source of truth for a value that already has an authoritative resolver with its own default.

> ⚠️ **`goal.wake_time` / `goal.bed_time` are retired columns.** `GoalService` still writes them, but every live consumer (`RitualService`, `HabitTargets`, `BiometricsTools`, `ContextSnapshotAssembler`) reads `SleepAnchorPort` — see the explicit note at `ContextSnapshotAssembler.java:194`. An earlier draft of this spec named `goal.wake_time` as the briefing anchor; that was wrong. The dispatcher uses `SleepAnchorPort`.

What genuinely can be absent: `RitualService` is gated on `RITUAL_SWITCH` and **the whole bean disappears when the switch is off**, so the `ritual` / `wind_down` categories must inject it optionally (`ObjectProvider`) and yield **no due item** when it is missing — never a fabricated window. `medication` has no time column, hence the config'd `medication-time`; `MedicationCycleService.derive(...)` answers which cycle day it is, and `retaDay == 0` is its honest "no dose logged yet" state, which must not be treated as a dose day. A category whose anchor is unavailable is skipped silently by `DueEvaluator`, never defaulted into a wrong minute.

**Copy rules** (the mockup is the reference; the notification text is part of the contract):

- **Never a reproach.** ADR 0010 governs push too: the Napzárás notification reads *"Ma 180 XP gyűlt össze. Nézzük meg együtt."* — **not** *"4 nyitott hurok vár"*. A missed thing is never reported as a failure.
- **Never a fabricated number.** A prose push **excerpts the already-generated honest text**; it never asks the LLM for new words and never invents a figure. No LLM call happens on the push path at all.
- **One tap target.** Every notification carries exactly one `deeplink` and promises exactly that.
- **The `medication` push never suggests a dose** — it reminds. The clinical guard that every generator prompt inherits applies to hand-written copy as well.

---

## 7. Frontend

- **Data layer:** `data/notification/notificationHooks.ts` → `usePushSubscription()` (supported / standalone / permission / enabled / subscribe / unsubscribe), `useNotificationPrefs()`, `useNotificationSchedule()`. Exposed through the `@/data/hooks` barrel only. Dual-mode: mock returns a deterministic seed and never touches `Notification`/`PushManager`.
- **Pages/components** (`frontend_conventions.md` taxonomy): `features/me/pages/NotificationsPage.tsx` at `/me/ertesitesek` (an `<Outlet>` leaf under `MeSection`), with `features/me/components/NotificationPreviewHeader.tsx` + `NotificationCategoryRow.tsx`.
- **Settings shape — direction C** (approved): a live volume preview header (daily count + hourly sparkline) + the iOS install-gate, then the editable category list in two sections ("Mezo megszólal" / "Emlékeztetők") with per-row toggle and, where meaningful, a lead-minute chip.
- **The preview header needs no new endpoint.** The FE already knows today's gym time, bed anchor and ritual window from existing hooks; the daily count and sparkline are **derived client-side** from prefs + schedule + those anchors. A pure `logic/notificationForecast.ts` with table-driven unit tests.
- **Service worker:** `vite.config.ts` gains `workbox: { importScripts: ['push-sw.js'] }` and `public/push-sw.js` carries the `push` + `notificationclick` handlers. **The `generateSW` strategy is kept** — switching to `injectManifest` would mean owning the whole worker (precache manifest, autoUpdate, the woff2 globs) for two event listeners. Smallest safe change to a working PWA setup.
- **iOS install-gate:** when `matchMedia('(display-mode: standalone)')` is false, the master toggle is **replaced** by the instruction (Apple grants Web Push to home-screen PWAs only). Not a warning next to a live toggle — a toggle that cannot work must not be offered.
- **VAPID public key** ships as `VITE_VAPID_PUBLIC` (public by design) and is documented in `frontend/.env.example`.

---

## 8. Time zone — no per-user timezone

mezo has **no `Profile.timezone`**: the codebase uses `ZoneId.systemDefault()` (with one `Europe/Budapest` literal in `TrainingStreakCalculator.java:25`), and `k8s/backend/deployment.yaml:34` pins `TZ=Europe/Budapest`. Single-user app ⇒ **server zone is the user's zone**, and the dispatcher follows the existing convention rather than introducing a timezone layer.

*Consequence to keep in mind:* this is now load-bearing for notification timing, not just for date bucketing. The deployment doc gets an explicit note that changing or unsetting `TZ` silently shifts every notification.

---

## 9. Feature switches

Following the proactive three-switch idiom (`configuration_conventions.md`):

- `mezo.feature.notification.enabled` — the whole feature; off ⇒ no beans ⇒ `/api/notification/*` 404s.
- `mezo.techcore.cron.notification-dispatch-job.enabled` — the dispatcher bean alone (so the API can live without sending, which is exactly what the N1 spike needs).

Values live under the `mezo:` root in `application.yml`: `mezo.notification.dispatch-cron` (`0 * * * * *`), `catch-up-minutes` (2), `default-gym-lead-min` (30), `medication-time` (`08:00`), `body-max-chars` (300), `prose-excerpt-chars` (160). No hardcoded tunables. **No `default-wake`** — the wake anchor has an authoritative resolver with its own default (§6).

The `ritual` / `wind_down` / `lights_out` anchors carry **no notification-side lead** — their offsets already live in `mezo.ritual.lead-min` (75) / `prep-lead-min` (45) and are read through `RitualService`. Duplicating them under `mezo.notification` would create a second source of truth for the same minute.

---

## 10. Slices

| Slice | bd | Content | Exit criterion |
|---|---|---|---|
| **N1 · Delivery spine** | `mezo-h4wp.6.1` | `techcore/webpush` + RFC 8291 test vector · `push_subscription` + subscribe/unsubscribe · `push-sw.js` · master toggle + install-gate · a dev-only "test push" action | **A real push appears on the iPhone** |
| **N2 · Dispatcher + backend feeds** | `mezo-h4wp.6.2` | `notification_pref` + `push_log` + `NotificationDispatchJob` + pure `DueEvaluator` · categories 1-9 · the settings category list | The 7 default-ON categories work end-to-end |
| **N3 · FE snapshot feed** | `mezo-h4wp.6.3` | `notification_schedule` + `PUT /api/notification/schedule` + FE upsert-on-open · categories 10-11 · the preview header | All 11 categories live |

**N1's first task is an end-to-end spike:** one hard-coded push from the real backend to Daniel's real iPhone, before the dispatcher exists. This is the weekly-planner lesson — VAPID + `aes128gcm` + iOS standalone delivery is where this class of feature actually fails, and the RFC test vector proves the crypto but not the platform.

---

## 11. Contract-first

Per `api_contract_conventions.md`, the fragment `api/feature/notification/notification.yml` is written **before** any code, then merged (`cd api/generate && npm run generate:api`), backend implements the generated `NotificationApi`, FE types come from `src/data/_client/api.gen.ts`:

| Verb | Path | Slice |
|---|---|---|
| `POST` | `/api/notification/subscription` | N1 |
| `DELETE` | `/api/notification/subscription` | N1 |
| `POST` | `/api/notification/test` (dev-only, switch-gated) | N1 |
| `GET` · `PUT` | `/api/notification/pref` | N2 |
| `PUT` | `/api/notification/schedule` | N3 |

---

## 12. Testing

- **Pure unit (no Spring):** `DueEvaluatorTest` — exact minute, catch-up window, outside window, disabled category, lead applied, empty day, weekday match, `weekday=null` every-day rows. `Aes128GcmEncryptorTest` / `VapidSignerTest` — RFC vectors. FE `notificationForecast.test.ts`.
- **Integration (`ApiIntegrationTest`, real Postgres):** subscribe → duplicate subscribe is idempotent → unsubscribe; pref read/write with lazy defaults; schedule replace leaves exactly the new set live; `push_log` blocks the second send in the same day; a `410` response soft-deletes the subscription. New tables join the `ResetDatabase` TRUNCATE list; a `NotificationPopulator` is added.
- **No mocks in integration tests** (`testing_standards.md`) — the push service is faked at the HTTP boundary with WireMock, not with `@MockBean`.
- **FE:** both modes green (`pnpm test` and `VITE_USE_MOCK=true pnpm test`) + `pnpm build`. The new settings page gets a visual golden **only if** it proves stable; a per-minute-derived sparkline is a flaky-golden risk, so the forecast is unit-tested and the golden, if added, uses a frozen clock.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| **iOS does not guarantee delivery.** Apple throttles and delays Web Push, and only for home-screen PWAs. | The in-app surface stays the source of truth (IDENT-3). Push is a channel; nothing is push-only. Documented in the feature doc, not hidden. |
| **`aes128gcm` implemented wrong** → the push service answers 400 and nothing arrives. | RFC 8291 test vector in a unit test — caught at build time, not in production. The N1 spike then proves the platform path. |
| **A per-minute job joins 18 existing crons**, and push sending is HTTP I/O. **Audited 2026-07-29 — the risk is real, not hypothetical:** `SchedulingConfiguration` defines *no* `TaskScheduler` bean and `application.yml` sets no `spring.task.scheduling.pool.size`, so all **18 `@Scheduled` methods share a single thread** (Spring Boot's default pool size of 1). A dispatcher doing per-user outbound HTTP inline would starve every other cron. | The scheduled method does **DB-only due-computation** on the scheduler thread and hands the actual sending to the existing async executor (`techcore/configuration/AsyncConfiguration`), so it returns in milliseconds. **The scheduler pool is deliberately left at 1** — the 18 existing jobs have always run serialized and may implicitly depend on it; widening it to fix a new job's problem would change their concurrency semantics as a side effect. `WebPushClient` already bounds each send with `mezo.webpush.timeout-ms`. |
| **FE snapshot staleness** (N3) — weeks without opening the app leave categories 10-11 on an old pattern. | It degrades gracefully (a recurring weekly pattern, not per-day rows); the settings page shows the last-updated date. |
| **Permission revoked on device** | The subscription dies with 410 → soft-deleted → the settings page honestly falls back to "request permission". |
| **VAPID private key leak** | SealedSecret in git (encrypted), never in the FE bundle. A leak allows spoofed pushes **to Daniel's own devices only**; rotation = new keypair + re-subscribe. |
| **Notification copy drifting into nagging** as categories are added | The §6 copy rules are part of the contract; the feature doc carries them so a later slice cannot quietly regress ADR 0010. |

---

## 14. Documentation obligations

- **New living feature doc** `docs/features/_platform-notifications.md` (platform-level `_` prefix — it has no tab of its own and serves every domain), covering the delivery layer, the category catalog, the copy rules, and the iOS constraints.
- **`docs/features/proactive.md`** — H2 stops being deferred; the epic status table and §1 header get updated.
- **`docs/milestones/roadmap.md`** — the Phase-4 line's "**Web Push infra H2 DEFERRED**" becomes shipped.
- **`docs/infrastructure/deployment-k3s-argocd.md`** — the VAPID SealedSecret, the `TZ` dependency (§8), and the egress requirement to `*.push.apple.com` / `fcm.googleapis.com` (no NetworkPolicy today; this must not break silently when one lands).
- **ADR** — `0014-own-webpush-implementation.md`: why in-house over `nl.martijndwars:web-push` (§4).
- `node scripts/lint-docs.mjs` after each slice.
