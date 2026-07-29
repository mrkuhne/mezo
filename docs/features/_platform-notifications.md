---
title: Push Notifications Platform
type: feature-platform
status: mixed
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
related: [proactive, today, ritual, me, _platform-api-backend]
---

# Push Notifications Platform — Feature Documentation

> Cross-cutting delivery layer, no route/tab of its own (the FE surface lives at `/me/ertesitesek`,
> documented from Me's side in [`me.md`](me.md)). **Status: N1 only — ✅ delivery spine shipped
> (subscribe/unsubscribe/test-push); 🔴 N2 (dispatcher + categories 1–9) and N3 (FE-scheduled
> categories 10–11 + preview header) are NOT built.** No push has ever been delivered to a real
> device yet — see §9.

## 1. Summary

mezo's proactive layer (`briefing`/`heartbeat_note`/`weekly_suggestion`/`memoir`, see
[`proactive.md`](proactive.md)) generates content on crons but had no way to reach Daniel with the
app closed. This platform layer is that delivery infra: a Web Push (RFC 8030/8291/8292) stack the
backend owns end to end, plus the FE opt-in surface and service-worker handlers.

**Driving spec:** [`docs/superpowers/specs/2026-07-29-push-notifications-design.md`](../superpowers/specs/2026-07-29-push-notifications-design.md)
(§3 architecture, §4 `techcore/webpush`, §5 data model, §6 the 11-category catalog + copy rules, §7
frontend, §8 timezone, §9 switches, §13 risks). **ADR:** [`0014-own-webpush-implementation.md`](../decisions/0014-own-webpush-implementation.md)
(why the protocol is hand-rolled). **Driver:** `mezo-h4wp.6` → slice `mezo-h4wp.6.1` (N1).

**Status per layer — N1 only:**
- **Backend `techcore/webpush`:** ✅ done — VAPID ES256 signing, RFC 8291 `aes128gcm` encryption,
  the outbound HTTP client. Zero new Maven dependencies.
- **Backend `feature/notification`:** ✅ done — `push_subscription` table + upsert/soft-delete
  service + a dev-only "send test push" fan-out endpoint. **No dispatcher exists.** No
  `@Scheduled` bean was added in N1 (see §9 switches).
- **Frontend:** ✅ done — the service-worker `push`/`notificationclick` handlers, the
  `usePushSubscription()` data hook, and the Me → **Értesítések** opt-in page (iOS install-gate +
  master toggle + test-push button).
- **N2 (dispatcher, `notification_pref`, `push_log`, categories 1–9, the settings category list)
  and N3 (`notification_schedule`, categories 10–11, the volume-preview header) are NOT built.**
  There is no `notification_pref`/`push_log`/`notification_schedule` table, no
  `NotificationDispatchJob`, no `DueEvaluator`, and no per-category preference in the product today.
  A subscribed device only ever receives the one hand-triggered test push.

## 2. User-facing behavior

**Route:** `/me/ertesitesek` (`NotificationsPage.tsx`, `ME_TABS` entry `notifications` — the 8th Me
tab, appended after `Tudás`). Full page-level description (layout, states, copy) is in
[`me.md`](me.md) §2 "`Értesítés`" — this doc covers the platform mechanics the page sits on top of.

**In short:** the page renders **only** an iOS "add to home screen" instruction
(`PushInstallGate.tsx`) when the PWA is not running standalone or the browser lacks Push support —
never a toggle that cannot work. Once standalone + supported, a master `Toggle` subscribes/
unsubscribes this device, and — once enabled — a dev-only **"Teszt értesítés küldése"** button
fires one fixed test push to every one of the account's registered devices and reports
`{attempted, sent}` inline. There is no category list, no lead-time control, no schedule editor in
N1 — those are N2/N3 per §9.

## 3. Architecture & data flow

```
[Browser, standalone PWA]
  Notification.requestPermission()
  → navigator.serviceWorker.ready → reg.pushManager.subscribe({ userVisibleOnly: true,
        applicationServerKey: <VITE_VAPID_PUBLIC> })
  → POST /api/notification/subscription { endpoint, p256dh, auth, userAgent }
       (frontend/src/data/notification/notificationHooks.ts:usePushSubscription)

[NotificationController]  (backend/.../feature/notification/controller/NotificationController.java)
  registerPushSubscription → PushSubscriptionService.register   (upsert on created_by+endpoint)
  unregisterPushSubscription → PushSubscriptionService.unregister (no-op if unknown)
  sendTestPush → PushSender.sendToAllDevices(owner, "Mezo · teszt", "...", "/today")
       → PushSubscriptionService.liveFor(owner)  — every live device
       → WebPushClient.send(keys, payloadJson)   — per device, never throws
             VapidSigner.authorizationHeader(pushOrigin, now)   — VAPID ES256 JWT
             Aes128GcmEncryptor.encrypt(p256dh, auth, plaintext) — RFC 8291 aes128gcm body
             RestClient POST endpoint, Authorization: vapid ..., Content-Encoding: aes128gcm
       → 200/201/202 SENT → markSuccess(id)
       → 404/410        GONE  → markGone(id)      — soft-delete, dead device drops out
       → 413             TOO_LARGE
       → 429             THROTTLED
       → anything else   FAILED (logged, endpoint scrubbed — see §9 gotchas)

[Service worker — frontend/public/push-sw.js, imported via vite.config.ts workbox.importScripts]
  'push'              → showNotification(title, {body, icon, badge, tag: url, data: {url}})
  'notificationclick' → focus an existing window and navigate it, else openWindow(url)
```

**What N2/N3 will add on top (not present today):** a per-minute `NotificationDispatchJob` +
`DueEvaluator` that decides *when* a push leaves (reading `notification_pref` +
`notification_schedule` + the proactive tables), with `push_log` dedup. **Generation and delivery
are meant to stay separate** — the 18 existing proactive/habit crons are untouched by this layer;
N1 only ships the manual/dev-triggered send path (`POST /api/notification/test`) and the raw
transport. See spec §3/§10 for the full target architecture.

## 4. Data model & API

### `push_subscription` (N1 — the only table that exists)

Migration: [`202607291000_mezo-h4wp.6.1_create_push_subscription.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607291000_mezo-h4wp.6.1_create_push_subscription.sql).

| Column | Notes |
|---|---|
| `endpoint text not null` | the push service URL — a capability URL, never logged in full (§9) |
| `p256dh varchar(120) not null` | subscription public key, base64url |
| `auth varchar(40) not null` | subscription auth secret, base64url |
| `user_agent varchar(300)` | device identification |
| `last_success_at timestamptz` | diagnostic only (last 201), never a delivery gate |

`uq_push_subscription_created_by_endpoint` — **partial unique** on `(created_by, endpoint) where
is_deleted = false` (re-subscribing the same device refreshes key material in place instead of
duplicating; a soft-deleted row never blocks re-registration — the briefing partial-unique idiom).
Entity: `PushSubscriptionEntity` (`feature/notification/entity/`), `extends OwnedEntity`,
`@SQLDelete`/`@SQLRestriction` soft-delete. Repository: `PushSubscriptionRepository` — plain
`JpaRepository` (no `date` column, so not `OwnedRepository`).

**Not built yet (N2/N3 — see spec §5):** `notification_pref` (per-category enabled + lead-minutes),
`push_log` (send dedup on `(date, dedup_key)`), `notification_schedule` (the FE-authoritative
weekly recurring set for categories 10–11).

### `techcore/webpush` — the protocol package

| Class | Responsibility |
|---|---|
| `WebPushProperties` | `@Validated` `@ConfigurationProperties("mezo.webpush")` record: `subject`, `publicKey`, `privateKey`, `defaultTtlSeconds`, **`timeoutMs`** (connect+read timeout on the outbound POST — added in N1, not in the original spec's field list; **never `@Value`**). |
| `VapidSigner` | ES256 JWT (`aud`=push-service origin, `exp`≤24h, `sub`=`mailto:`) — JDK `Signature("SHA256withECDSA")` + hand-rolled **DER→JOSE `r‖s`** conversion. Also the key codec: `encodePublicKey`/`encodePrivateKey`/`decodePublicKey`/`decodePrivateKey`. |
| `Aes128GcmEncryptor` | ECDH P-256 → hand-rolled HKDF-SHA256 → AES-128-GCM → RFC 8188 `aes128gcm` framing (`salt‖rs‖idlen‖keyid‖ciphertext`). Max plaintext 4079 bytes at the default 4096-byte record size. |
| `WebPushClient` | `RestClient` POST with the VAPID `Authorization` header + `Content-Encoding: aes128gcm`; maps the response to `WebPushResult`. |
| `WebPushResult` | enum `SENT \| GONE \| TOO_LARGE \| THROTTLED \| FAILED`. |
| `WebPushSubscriptionKeys` | `record(endpoint, p256dh, auth)` — the one device-identity shape threaded through the send path. |

**Correctness is pinned by RFC test vectors, not by trust:** `Aes128GcmEncryptorTest` reproduces the
**RFC 8291 §5 "Push Message Encryption Example"** byte-for-byte (transcribed from the RFC text
independently, then hand-verified against a throwaway Python replay before any Java was written).
`VapidSignerCodecTest` runs a **25-combo deterministic matrix** over the DER↔JOSE padding edge cases
(short `r`/`s`, the DER high-bit sign byte, zero-length elements) — this is the test that catches
the classic "looks fine with one keypair, breaks 1-in-400 times in production" bug class; it was
mutation-tested (a deliberate right-pad regression was reintroduced and confirmed caught) before
being trusted. This is the whole basis for building Web Push in-house rather than taking a
third-party library — see [ADR 0014](../decisions/0014-own-webpush-implementation.md).

### `feature/notification`

| Class | Responsibility |
|---|---|
| `PushSubscriptionService` | `register` (upsert by `created_by`+`endpoint`), `unregister` (no-op if unknown), `liveFor(owner)`, `markGone` (soft-delete), `markSuccess` (sets `lastSuccessAt`). Gated `@ConditionalOnProperty(NOTIFICATION_SWITCH)`. |
| `PushSender` | `sendToAllDevices(owner, title, body, url) -> PushFanOut(attempted, sent)`. Builds the `{title,body,url}` JSON payload via the injected Jackson 3 `ObjectMapper` (never string concatenation — HU text carries accents/quotes), truncates `body` to `NotificationProperties.bodyMaxChars` (300), fans out over every live device, and never lets one bad device (or a bookkeeping failure) abort the loop over the rest. |
| `NotificationController` | implements the generated `NotificationApi` — thin delegation, no business logic. |
| `NotificationProperties` | `mezo.notification.body-max-chars` (300) — N2 extends this same record. |

### API contract (`api/feature/notification/notification.yml`)

| Verb | Path | Slice | Notes |
|---|---|---|---|
| `POST` | `/api/notification/subscription` | N1 | `PushSubscriptionRequest {endpoint, p256dh, auth, userAgent?}`, all string fields `minLength:1` — 204 |
| `DELETE` | `/api/notification/subscription?endpoint=` | N1 | idempotent — unknown endpoint is also 204 |
| `POST` | `/api/notification/test` | N1, dev-only, switch-gated | → `PushTestResponse {attempted, sent}` — 200, never errors even when nothing is reachable |
| `GET`/`PUT` | `/api/notification/pref` | N2 | not built |
| `PUT` | `/api/notification/schedule` | N3 | not built |

**Known and accepted: the unsubscribe endpoint travels in a query string.** A push endpoint is a
**capability URL** (§9 — whoever holds one can put notifications on the owner's lock screen), and
query strings are the part of a URL most likely to end up in an access log, a proxy trace or a
browser history entry. Realized exposure is low today (HTTPS end to end, single user, and no
component in this repo logs request URLs), so it was **deliberately left as-is in N1** rather than
taken as a contract change on the way out the door. **Planned for N2**, when the contract is next
touched anyway: move the endpoint into a `DELETE` request body (or a `POST .../unsubscribe`), which
is the same one-line change on both sides once `pref`/`schedule` are being added.

## 5. Integrations

- **Proactive** ([`proactive.md`](proactive.md)) — the intended consumer: N2's `DueEvaluator` will
  read `briefing`/`heartbeat_note`/`weekly_suggestion`/`memoir` readiness as one of its three due-
  item sources. **Not wired yet** — N1 has no reader of those tables at all.
- **Today / Ritual** ([`today.md`](today.md), [`ritual.md`](ritual.md)) — N2's backend-native
  anchors (gym/sport schedule, `RitualService` open/prep/bed times) are the second due-item source.
  **Not wired yet.**
- **Me** ([`me.md`](me.md) §2 "`Értesítés`", §5.8) — the only FE consumer today: the opt-in page
  owns no notification data itself, it only drives `usePushSubscription()`.
- **`_platform-api-backend`** ([`_platform-api-backend.md`](_platform-api-backend.md)) — follows
  the same contract-first pipeline (`api/feature/notification/notification.yml` → merge →
  generated `NotificationApi` + `api.gen.ts`) and the same `OwnedEntity`/`SystemMessage` platform
  conventions as every other feature.

## 6. How to use it (consume)

```ts
import { usePushSubscription } from '@/data/hooks'

function Example() {
  const push = usePushSubscription()
  // push: { supported, standalone, permission, enabled, busy, error, subscribe, unsubscribe, sendTest }

  if (!push.supported || !push.standalone) return <PushInstallGate />
  // ... render a toggle bound to push.enabled / push.subscribe / push.unsubscribe
  // ... AND render push.error — a consumer that ignores it reintroduces the silent-snap-back bug
}
```

**`error: PushErrorCode | null` is not optional garnish — render it.** `subscribe()` resolves
`false` on every failure, so a page that only watches `enabled` shows a toggle flipping back to off
with the status line still reading „Nincs engedélyezve", i.e. exactly what a tap that never
registered looks like. The three codes (`data/types.ts`) map to distinct copy in
`NotificationsPage`'s `PUSH_ERROR_COPY`:

| code | means | why it is separate |
|---|---|---|
| `vapid-missing` | the bundle was built without `VITE_VAPID_PUBLIC` | a **build** misconfiguration — the state a fresh deploy hits; retrying is pointless, so the copy says so. Guarded *before* any browser call, so no permission prompt is spent and `pushManager.subscribe()` is never handed the zero-length `applicationServerKey` that makes it reject with `InvalidAccessError`. |
| `register-failed` | the browser subscribed, the backend did not record it | the split state that would otherwise report „iPhone · engedélyezve" forever while `/test` answers `0 próbálkozás`. Deliberately **not** rolled back — the mount effect self-heals it (below). |
| `failed` | anything else on the browser side | generic, retryable |

**Mount-time self-heal.** When `getSubscription()` finds an existing browser subscription, the hook
**re-`register()`s it** rather than only trusting it. `POST /api/notification/subscription` is an
idempotent upsert, so this is free, and it repairs both ways the browser and the server can drift
apart: a `register()` that failed after a successful `subscribe()`, and a row a 404/410 prune
soft-deleted. Mock mode still short-circuits before any of it.

`usePushSubscription()` (`frontend/src/data/notification/notificationHooks.ts`) is deliberately
**not** a `useDualQuery` — the source of truth for `enabled` is the **browser**
(`registration.pushManager.getSubscription()`), never the server. `supported`/`standalone` are
derived from real browser globals in **both** test modes (so `pnpm test` and
`VITE_USE_MOCK=true pnpm test` agree in jsdom, where neither exists); only the **actions**
(subscribe/unsubscribe/mount-probe) branch on `isMockMode()`, so mock mode never calls
`Notification`/`serviceWorker`/`PushManager` even on a capable real browser. Mock mode is backed
by `notificationMock.ts`'s `mockPushState`.

Backend consumers of `PushSubscriptionService`/`PushSender` (N2's dispatcher will be the first)
should call `liveFor(owner)` → build a `WebPushSubscriptionKeys` per device → `WebPushClient.send`;
never call `techcore/webpush` classes directly with hand-assembled endpoints — always go through a
`PushSubscriptionEntity` so `markGone`/`markSuccess` stay wired to the actual row.

## 7. How to extend it (N2/N3 recipe)

1. **Contract-first**: extend `api/feature/notification/notification.yml` with the `pref`/
   `schedule` paths (see spec §11), merge (`cd api/generate && npm run generate:api`), regenerate
   FE types (`cd frontend && pnpm generate:api`).
2. **Backend**: new Liquibase migrations for `notification_pref` / `push_log` /
   `notification_schedule` (never edit the N1 changeset — append new ones, per
   [`liquibase_conventions.md`](../references/liquibase_conventions.md)); a pure `DueEvaluator`
   (no Spring — see spec §12 for its test matrix) feeding a new `NotificationDispatchJob` gated by
   the **already-reserved** `mezo.techcore.cron.notification-dispatch-job.enabled` switch (see §9).
3. **Reuse, don't duplicate, the delivery primitives**: `PushSubscriptionService.liveFor` +
   `WebPushClient.send` are the fan-out this doc already ships — the dispatcher calls the same
   `PushSender`-style loop, it does not reinvent transport.
4. **Frontend**: the settings category list + volume-preview header are new components under
   `features/me/components/`; the schedule PUT is a new hook beside `usePushSubscription()` in
   `data/notification/`. Both FE test modes must stay green.
5. **Copy**: any new notification text — prose excerpt or hand-written reminder — MUST follow the
   §6 copy rules below, verbatim. This is the regression guardrail; a new category is not exempt.

## 8. Testing

**Backend (integration-first, Postgres):**
- `Aes128GcmEncryptorTest` — the RFC 8291 §5 vector (headline), plus 8 supporting tests (isolation
  via independent CEK/nonce decryption, RFC 8188 header field-by-field, the production overload's
  own ephemeral key, a size matrix `{0,1,17,41,1000,4079}`, the `WEBPUSH_KEY_INVALID`/400 vs
  `WEBPUSH_ENCRYPT_FAILED`/500 split). Mutation-tested (6 deliberate bugs, each caught by ≥3 tests).
- `VapidSignerTest` (the brief's JWT round-trip) + `VapidSignerCodecTest` (the 25-combo DER/JOSE
  matrix, mutation-tested).
- `WebPushClientIT` (16 tests, WireMock) — 201/404/410/413/429 mapping, timeout enforcement (a
  200ms client against a 3s-delayed stub returns `FAILED` in <2s), the oversized-payload
  short-circuit to `TOO_LARGE` before any wire call, the capability-URL log-scrub test
  (`testSend_shouldNotLeakTheEndpointInLogs_whenTransportFails`, a Logback `ListAppender`
  assertion), and **both sides of the prune boundary** — a `WEBPUSH_KEY_INVALID` cause yields `GONE`,
  a `WEBPUSH_SIGN_FAILED` cause yields `FAILED` (§9; getting the second one wrong empties the device
  table).
- `WebPushPropertiesTest` — the `subject` `mailto:`/`https:` pattern, and that a blank VAPID key
  normalises to the yml placeholder (so the context still boots) while still raising
  `WEBPUSH_SIGN_FAILED` on the first send.
- `PushSenderTruncationTest` — the surrogate-pair boundary of `PushSender.truncateBody` (a plain
  unit test: it is a pure function, nothing about it needs a context).
- `PushSubscriptionRepositoryIT`, `PushSubscriptionServiceIT` (upsert, soft-delete-is-genuinely-
  soft via a raw JDBC count, no-op unregister, **and the lockout invariant: re-registering the same
  endpoint after a soft delete must succeed** — the partial unique index is what makes turning push
  back on possible at all), `PushSenderIT` (fan-out survives every device failing; prunes only the
  device with unusable key material), `NotificationApiIT` (HTTP-level:
  register/re-register-refreshes/unregister/test-push honest counts). Data via
  `support/populator/NotificationPopulator.java` — which now carries **real** RFC 8291 §5 key
  material (`VALID_P256DH`/`VALID_AUTH`) plus a `MALFORMED_P256DH`, because fake-but-plausible keys
  now prune the fixture device (§9). Send-path fixtures use `http://localhost:1` rather than a fake
  DNS name so a CI resolver that blackholes unknown hosts cannot make each send burn the full 5 s
  connect timeout.
- Commands: `cd backend && ./mvnw clean test -Dtest='*WebPush*,VapidSigner*,Aes128Gcm*,Notification*,PushSub*,PushSender*'`.

**Frontend (Vitest + RTL + MSW, both modes):**
- `data/notification/notificationHooks.test.tsx` (10 tests) — unsupported-in-jsdom in both modes,
  `subscribe()` resolves `false` when unsupported, mock mode never reports a live subscription,
  denied permission never throws, the `toJSON().keys` flattening (the "classic bug" — sending the
  nested shape instead of the flat wire body), mock mode never touches
  `Notification`/`serviceWorker`/`PushManager` even on a capable browser, plus the three failure
  paths §6 describes: the blank-`VITE_VAPID_PUBLIC` guard (no `subscribe()` attempt at all), a
  failing `register()` after a successful browser subscribe (surfaced, never reported as enabled),
  and the mount-time re-register self-heal. Real-mode tests `vi.stubEnv('VITE_VAPID_PUBLIC', …)` —
  `.env` ships it blank on purpose, so without the stub they would exercise the guard instead of the
  flow they claim to test.
- `features/me/pages/NotificationsPage.test.tsx` (13 tests) — the install-gate vs. toggle branch,
  denied/busy states render a genuinely `disabled` switch (not just visually), the test-push
  button's visibility/disabled rules, and one test per error code (the `vapid-missing` line must
  name the build, not blame the device).
- `shared/ui/Toggle.test.tsx` — the `disabled` prop added for this page (default `false`, every
  other call site unaffected).
- Commands: `cd frontend && pnpm test` and `VITE_USE_MOCK=true pnpm test` (both must stay green) +
  `pnpm build`.

## 9. Decisions, gotchas & deferred

- **N1 is delivery spine only — no push has ever reached a real device yet.** The end-to-end
  real-iPhone spike (spec §10, "N1's first task") requires a VAPID keypair sealed into the cluster
  and a physical device; it is a separate, not-yet-executed task and cannot be done by an agent.
  Do not read the green test suite as proof of real-world delivery — it proves the crypto and the
  transport mapping, not the platform path (spec §13).
- **The dummy default now fails loudly, not silently.** Before a fix-round hardening,
  `VapidSigner.decodePrivateKey` accepted any byte length and any scalar value, so a missing
  `VAPID_PRIVATE` (`application.yml`'s `dummy-vapid-private` default) produced a **well-formed but
  cryptographically useless** JWT — every push would have 401'd forever with no diagnostic. It now
  rejects a scalar that is not exactly 32 bytes, is zero, or is ≥ the curve order, at first use
  (lazy, not at context-startup, so the dummy default still keeps the app bootable with the feature
  switched off). A misconfigured deploy now fails loudly on the first real send instead of quietly
  producing tokens no push service will ever honor.
- **Two failure codes are a deliberate split, not an accident.** `messages.properties`:
  `WEBPUSH_KEY_INVALID` (400) is **reserved for material that arrived from a client** — a
  subscription's `p256dh`/`auth` — never for server config. `WEBPUSH_SIGN_FAILED` (500) covers VAPID
  config problems and our own DER/JOSE encoding faults. `WEBPUSH_ENCRYPT_FAILED` (500) covers our own
  RFC 8188 framing faults on the payload side. Getting this split right matters because a 400
  vs 500 tells the caller whether *their* subscription is broken or *the server* is — conflating
  them (as an early draft did for an off-curve public key, caught by review) would misdirect
  debugging. Any new push code must sort into this same three-way split, never invent a fourth.
- **Push endpoints are capability URLs and must never be logged in full.** `WebPushClient` scrubs
  every `https?://\S+` substring out of a caught exception's message (`Pattern` `URL_PATTERN`)
  before logging — because Spring's `ResourceAccessException` (timeout/connection-refused/DNS
  failure) embeds the **complete** endpoint in its own message, defeating a naive "log only the
  first 40 chars" truncation one line below it. This is a real security property, not incidental
  hygiene: whoever holds an endpoint can send pushes that show up on the owner's lock screen (VAPID
  is a per-*sender* identity, not a per-endpoint secret — the `auth`/`p256dh` pair is the actual
  device secret). **It is easy to accidentally undo**: any new log line on the send path that
  includes `e.getMessage()` or the throwable object directly (rather than the scrubbed string) would
  quietly leak endpoints into logs again. Pinned by
  `testSend_shouldNotLeakTheEndpointInLogs_whenTransportFails` (a Logback `ListAppender`
  assertion — no future refactor should be able to remove the scrub without a red test).
  `WebPushProperties.privateKey` follows the same rule via SealedSecret, never a committed literal
  — see [`deployment-k3s-argocd.md`](../infrastructure/deployment-k3s-argocd.md).
  Off-curve public-key points are also a related, closed gap: the JDK's `KeyFactory` happily builds
  an `ECPublicKey` from coordinates that fail the curve equation (`VapidSigner.decodePublicKey` is
  **not** a curve-membership validator); the actual RFC 8291 §7-mandated rejection happens inside
  `KeyAgreement.doPhase` in `Aes128GcmEncryptor`, mapped to the client-facing `WEBPUSH_KEY_INVALID`.
- **`GONE` soft-deletes the device**, `THROTTLED`/`TOO_LARGE`/`FAILED` do not prune anything — a
  transient failure must not silently unregister a device that will recover. `GONE` is reached two
  ways: an HTTP **404/410** from the push service, and — since a fix round — a **thrown
  `WEBPUSH_KEY_INVALID`**, which is the one exception cause that is both permanent *and* the
  device's own fault. Register-time validation of `p256dh`/`auth` is only `minLength:1`, so without
  that mapping a malformed key row could never deliver and could never be removed; N2's per-minute
  job would warn-log it forever. **The boundary is load-bearing and easy to get catastrophically
  wrong:** `WEBPUSH_SIGN_FAILED`/`WEBPUSH_ENCRYPT_FAILED` must stay `FAILED`, because they are *our*
  misconfiguration and fire for **every** device at once — the `dummy-vapid-private` default raises
  `WEBPUSH_SIGN_FAILED`, so pruning on it would wipe the whole `push_subscription` table on the
  first push after a deploy that forgot the secret. `WebPushClient.resultFor` switches on the
  `SystemMessage` **code**, never on `HttpStatus` (no status reaches `GlobalExceptionHandler` on this
  outbound path). Both directions are pinned:
  `WebPushClientIT.testSend_shouldReturnGone_whenSubscriptionKeyMaterialIsMalformed` and
  `…_shouldReturnFailed_whenOurOwnVapidKeyIsMisconfigured`, plus
  `PushSenderIT.testSendToAllDevices_shouldPruneOnlyTheDeviceWithUnusableKeyMaterial_whenKeysAreMalformed`.
  A consequence worth knowing when writing tests: fixture subscriptions now need **real** key
  material (`NotificationPopulator.VALID_P256DH`/`VALID_AUTH`, the RFC 8291 §5 vector), or the
  fixture device prunes itself and a "send failed" test quietly becomes a "device deleted" test.
- **`VITE_VAPID_PUBLIC` is baked in at frontend BUILD time.** The public half becomes
  `pushManager.subscribe()`'s `applicationServerKey`, so sealing the keypair into the cluster does
  **not** reach the browser — the value must be present in the `build-frontend` job's `env:` block
  in `.github/workflows/deploy.yml` (repo variable, alongside `VITE_OWNER_*`). Blank ⇒ a zero-length
  key ⇒ every `subscribe()` rejects with `InvalidAccessError`. The hook now refuses to call
  `subscribe()` at all in that state and reports `vapid-missing` instead (§6), so the failure is at
  least legible; the fix is still a rebuild with the variable set.
- **A blank VAPID env value must not take the application down.** `${VAPID_PRIVATE:dummy-vapid-private}`
  substitutes its default only when the variable is **absent**; a present-but-empty value (an easy
  SealedSecret slip) binds as `""`, trips `@NotBlank` and aborts **context startup for the whole
  app** — every unrelated feature with it, even with notifications switched off. `WebPushProperties`'
  compact constructor therefore normalises a blank `public-key`/`private-key` to the same
  `dummy-vapid-*` placeholder the yml default uses, so an empty value behaves exactly like a missing
  one. This is not tolerance: the placeholder is not a valid P-256 scalar, so the loud failure simply
  moves from "no application" to "the send that needed the key" (`WEBPUSH_SIGN_FAILED` → `FAILED`,
  pruning nothing). `@NotBlank` still guards a genuinely `null` binding. `subject` gained
  `@Pattern("^(mailto:|https://).+")` — RFC 8292 §2.1 allows only those two forms, and since the
  value is spliced unescaped into the signed JWT claims, validating it is also what makes that
  splice safe. Pinned by `WebPushPropertiesTest`.
- **Switches** (`configuration_conventions.md` three-switch idiom):
  `mezo.feature.notification.enabled` (**true**) gates the whole `/api/notification/*` surface (off
  ⇒ no beans ⇒ 404). `mezo.techcore.cron.notification-dispatch-job.enabled` (**false**) is the
  dispatcher-bean switch — **already reserved in `FeaturesConfiguration` and `application.yml`,
  but N1 registers no `@Scheduled` bean at all**; the constant exists purely so N2 can flip it on
  without a further config-plumbing change. Values: `mezo.webpush.*` (`subject`, `public-key`,
  `private-key`, `default-ttl-seconds`, `timeout-ms`), `mezo.notification.body-max-chars` (300).
  N2 adds `dispatch-cron`, `catch-up-minutes`, `default-gym-lead-min`, `medication-time`,
  `default-wake`, `prose-excerpt-chars` onto the same `mezo.notification` root (spec §9) — none of
  these exist yet.
- **`timeoutMs` was added to `WebPushProperties` beyond the original spec's field list** — the
  spec named only `subject`/`publicKey`/`privateKey`/`defaultTtlSeconds`, but
  `configuration_conventions.md` forbids hardcoded tunables, and a hung push service must not hold
  a caller's thread once N2's per-minute dispatch job exists. `@Min(100) @Max(30_000)`, default
  `5000` ms.
- **The `generateSW` Workbox strategy is deliberately kept** (spec §7) — `push`/`notificationclick`
  live in the separate plain file `public/push-sw.js`, wired in via `vite.config.ts`'s
  `workbox.importScripts: ['push-sw.js']`, so the plugin still owns the precache manifest,
  `autoUpdate`, and the woff2 globs. Switching to `injectManifest` would mean owning the whole
  worker for two event listeners — not worth it for this feature.
- **Payload budget**: push bodies must stay under the payload ceiling implied by
  `Aes128GcmEncryptor`'s 4096-byte record size (4079 plaintext bytes max); `PushSender` truncates
  the notification body to `mezo.notification.body-max-chars` (300) before encrypting, well under
  that ceiling. The truncation is **surrogate-safe** (`PushSender.truncateBody`): cutting between the
  two halves of an emoji leaves a lone surrogate, which UTF-8 encoding turns into a stray `?` on the
  lock screen, so the boundary backs off one UTF-16 unit rather than splitting a pair. Inert in N1
  (the only body is a fixed literal), live the moment N2 generates bodies —
  `PushSenderTruncationTest` pins both sides of the boundary.
- **iOS constraint** (spec §13, `me.md` §2): Apple only grants Web Push to home-screen-installed
  PWAs, and even then does not guarantee prompt delivery — the in-app surface stays the source of
  truth; push is a channel, never push-only.
- **Deferred to N2:** `notification_pref`, `push_log`, `NotificationDispatchJob`, the pure
  `DueEvaluator`, categories 1–9, the settings category list. **Deferred to N3:**
  `notification_schedule`, `PUT /api/notification/schedule`, categories 10–11, the volume-preview
  header. See spec §6 for the full 11-category catalog and their default-on/off state — none of it
  is live yet. `docs/features/proactive.md`'s "H2 deferred" status and
  `docs/milestones/roadmap.md`'s Phase-4 "Web Push infra H2 DEFERRED" line are **intentionally
  left unchanged by this doc** — they flip in N3, when all 11 categories are live and H2 is
  genuinely finished; flipping them at N1 would claim a capability that does not exist.

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

These rules have no enforcement mechanism today (N2/N3 own the categories they'd apply to) — they
are recorded here so the first category that writes notification copy has no excuse to invent one.

## 10. Key files

**Backend — `techcore/webpush` (the protocol, zero new dependencies)**
- `backend/src/main/java/io/mrkuhne/mezo/techcore/webpush/{WebPushProperties,VapidSigner,Aes128GcmEncryptor,WebPushClient,WebPushResult,WebPushSubscriptionKeys}.java`
- `backend/src/test/java/io/mrkuhne/mezo/techcore/webpush/{VapidSignerTest,VapidSignerCodecTest,Aes128GcmEncryptorTest,WebPushClientIT,WebPushPropertiesTest,TestWebPush}.java`

**Backend — `feature/notification`**
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/{config/NotificationProperties,entity/PushSubscriptionEntity,repository/PushSubscriptionRepository,service/PushSubscriptionService,service/PushSender,controller/NotificationController}.java`
- `backend/src/main/resources/db/changelog/1.0.0/script/202607291000_mezo-h4wp.6.1_create_push_subscription.sql`, registered in `1.0.0/1.0.0_master.yml`
- `backend/src/main/resources/messages.properties` — `WEBPUSH_KEY_INVALID`/`WEBPUSH_SIGN_FAILED`/`WEBPUSH_ENCRYPT_FAILED`
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `NOTIFICATION_SWITCH`, `NOTIFICATION_DISPATCH_JOB_SWITCH`
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/{PushSubscriptionRepositoryIT,PushSubscriptionServiceIT,PushSenderIT,NotificationApiIT}.java`, `feature/notification/service/PushSenderTruncationTest.java`; `support/populator/NotificationPopulator.java`; `support/ResetDatabase.java` (`push_subscription` in the TRUNCATE list)

**API contract**
- `api/feature/notification/notification.yml` → registered in `api/generate/merge.yml` → merged `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts` + generated `io.mrkuhne.mezo.api.controller.NotificationApi` / `io.mrkuhne.mezo.api.dto.{PushSubscriptionRequest,PushTestResponse}`

**Frontend — service worker + PWA build**
- `frontend/public/push-sw.js` — `push` + `notificationclick` handlers
- `frontend/vite.config.ts` — `workbox.importScripts: ['push-sw.js']` (the `generateSW` strategy kept)
- `frontend/.env.example` — `VITE_VAPID_PUBLIC` (blank by default); `.github/workflows/deploy.yml` — the same variable in the `build-frontend` job's `env:` block, without which the deployed bundle can never subscribe (§9)

**Frontend — data layer**
- `frontend/src/data/notification/{notificationApi,notificationMock,notificationHooks}.ts` — `usePushSubscription()`, re-exported from `frontend/src/data/hooks.ts`
- `frontend/src/data/types.ts` — `PushSubscriptionState`, `PushErrorCode`

**Frontend — Me surface (documented from Me's side in [`me.md`](me.md) §2/§10)**
- `frontend/src/features/me/pages/NotificationsPage.tsx` (route `/me/ertesitesek`)
- `frontend/src/features/me/components/PushInstallGate.tsx`
- `frontend/src/features/me/pages/tabs.ts` (`ME_TABS` entry `notifications`), `frontend/src/app/router.tsx` (the `ertesitesek` child route)
- `frontend/src/shared/ui/Toggle.tsx` — gained an optional `disabled` prop for this page (default `false`, every prior call site unaffected)

**Docs (link, don't duplicate)**
- Spec: [`docs/superpowers/specs/2026-07-29-push-notifications-design.md`](../superpowers/specs/2026-07-29-push-notifications-design.md)
- ADR: [`docs/decisions/0014-own-webpush-implementation.md`](../decisions/0014-own-webpush-implementation.md)
- Infra: [`docs/infrastructure/deployment-k3s-argocd.md`](../infrastructure/deployment-k3s-argocd.md) (VAPID secret + egress + `TZ`)
- References: [`docs/references/`](../references/) (`configuration_conventions`, `liquibase_conventions`, `api_contract_conventions`, `spring_patterns`, `testing_standards`)
- Roadmap: [`docs/milestones/roadmap.md`](../milestones/roadmap.md) — Phase-4 "Web Push infra" line stays DEFERRED until N3 (deliberately not flipped by this doc, see §9)
