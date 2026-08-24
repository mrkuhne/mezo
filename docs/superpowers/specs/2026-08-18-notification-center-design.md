# Notification Center — in-app harang + AI-brain esemény-push (design)

- **Date:** 2026-08-18
- **Driver:** bd `mezo-gzhp`
- **Status:** approved design (brainstorm 2026-08-18, Daniel)
- **Mockup:** [`2026-08-18-notification-center-mockup.html`](2026-08-18-notification-center-mockup.html) — **A variáns** (lenyíló panel) approved
- **Related:** [`2026-07-29-push-notifications-design.md`](2026-07-29-push-notifications-design.md) (the delivery platform this builds on), [`docs/features/_platform-notifications.md`](../../features/_platform-notifications.md), [`docs/features/insights.md`](../../features/insights.md), [`docs/features/proactive.md`](../../features/proactive.md)

## 1. Problem & goal

The AI brain (pattern motor, knowledge base, memoir, predictions, experiments, memory pipeline)
produces events on overnight/weekly crons and post-chat async listeners — and the user learns about
none of them unless they happen to open the right Insights tab. There is **no in-app notification
mechanic at all** (no unread/seen state anywhere in the app), and the Web Push catalog covers none
of the pattern/knowledge/prediction/experiment events (state-driven pushes were deliberately
deferred out of push v1).

Goal: one **`app_notification` outbox** as the single source of truth; a **bell chip + dropdown
panel** in `AppHero` (all 5 sections inherit it); and **push for every event kind** through the
existing dispatcher, so what the bell shows is exactly what the phone receives.

**Out of scope (deliberate):** digest/coalescing of dense mornings (per-category toggles are the
v1 volume control; a later slice may add "3 minta-esemény ma éjjel" merging), a full `/notifications`
page (the panel is self-contained), retention pruning (single user, ~10 rows/day — the `push_log`
precedent), read-state for pushes themselves (the panel's `read_at` is the only read model).

## 2. Event catalog → `AppNotificationKind` (12 kinds)

The enum is the single source of truth (the `NotificationCategory` pattern): kind → family (push
category), deeplink template, copy composer. All kinds emit into the feed AND push (user decision:
"mindegyikre push"), with one exception noted at #6.

| # | Kind | Emit site | Trigger | Push category | Deeplink |
|---|---|---|---|---|---|
| 1 | `pattern_inbox` | `PatternDetectionService.upsert` — new row passing the strength gate | nightly 02:40 | `pattern` | `/insights/patterns/{pairKey}` |
| 2 | `pattern_signal` | `PatternDetectionService.recordSnapshot` — **band crossing only** | nightly 02:40 | `pattern` | `/insights/patterns/{pairKey}` |
| 3 | `hypothesis_new` | `HypothesisPipelineService.persist` | Sunday 03:00 | `pattern` | `/insights` |
| 4 | `fact_candidate` | `FactExtractionService` (candidate created) | post-chat async | `knowledge` | `/insights/knowledge` |
| 5 | `fact_reinforced` | `PatternDetectionService.reinforcePromotedFact` + `FactExtractionService` (dedup-reinforce) | nightly / post-chat | `knowledge` | `/insights/knowledge` |
| 6 | `memoir_ready` | `MemoirGenerator.generate` (new row only) | Sunday 19:00 + lazy GET | **none — the existing `memoir` category already pushes**; feed row only (a second category would double-notify) | `/insights/memoir` |
| 7 | `prediction_new` | `PredictionGenerator` | Monday 06:30 + lazy GET | `prediction` | `/insights/predictions` |
| 8 | `prediction_outcome` | `PredictionValidationService` (validated/missed) | daily 06:15 | `prediction` | `/insights/predictions` |
| 9 | `experiment_proposed` | `ExperimentProposalGenerator` | Monday 06:45 + lazy GET + on-demand propose | `experiment` | `/insights/experiments` |
| 10 | `experiment_closed` | `ExperimentOutcomeService` (completed, any outcome) | daily 06:20 | `experiment` | `/insights/experiments` |
| 11 | `challenge_event` | `ChallengeGenerator` / `ChallengeOutcomeEvaluator` | daily 06:25 | `challenge` | `/train` |
| 12 | `memory_note` | `DailySummaryService` (summary generated) | nightly 02:20 | `memory` | `/insights/memoria` |

**Noise rules:**
- `pattern_signal` fires only when consecutive snapshots cross a confidence band
  (bizonytalan ↔ ígéretes ↔ megbízható) — never on every nightly snapshot. The band thresholds
  mirror the FE `confidenceMeta` bands; both sides pin them with tests so the bell can never
  disagree with the dashboard.
- `pattern_inbox` fires only when the new statistical row passes the strength gate (the FE
  `STRONG_SIGNAL` display gate: `|r| ≥ 0.3 && p ≤ 0.15`). Backend constants, pinned by tests on
  both sides against drift. `hypothesis_new` is deliberately **ungated** — it fires for every new
  hypothesis row (weekly cron, a handful of rows at most; the body names the confidence band
  honestly).
- **User-action echoes never notify** (own confirm/reject/accept/dismiss decisions) — what the user
  did needs no announcement.

**Copy:** the backend composes the Hungarian `title`/`body` **at emit time** and stores it — one
copy source; push sends the stored text verbatim, the bell renders the same. The push spec's §6
copy rules are inherited wholesale: never a reproach, never a fabricated number (bodies compose
from real r/n/reinforcement counts in the `findingSentence` voice), exactly one tap target.

## 3. Data model

### `app_notification` (new table; house rules: UUID PK, `created_by`, soft delete, audit columns)

| Column | Notes |
|---|---|
| `kind varchar(32) not null` | code-validated (`AppNotificationKind.fromKey`), no DB CHECK — the `notification_pref` precedent |
| `title varchar(120) not null` | same budget as push titles |
| `body varchar(300)` | same budget as `mezo.notification.body-max-chars` — push sends this verbatim |
| `deeplink varchar(200) not null` | exactly one tap target |
| `ref_id uuid` | the subject row (pattern/fact/prediction/experiment id); nullable |
| `dedup_key varchar(80) not null` | occurrence identity, e.g. `fact_reinforced:{factId}:{count}`, `prediction_outcome:{id}` |
| `occurred_at timestamptz not null` | event time (the push anchor derives from it) |
| `read_at timestamptz` | null = unread |

Constraints/indexes (explicit names per liquibase conventions):
- `uq_app_notification_created_by_dedup_key` — **partial unique on live rows** → `emit` is
  idempotent. This is load-bearing: memoir/prediction/experiment have BOTH a cron and a lazy-GET
  generation path; without it the double-run would double-notify.
- `idx_app_notification_created_by_occurred_at` — the feed read (`occurred_at desc`).

Changeset: `{YYYYMMDDHHMM}_mezo-gzhp_create_app_notification.sql` under `db/changelog/1.0.0/`.
New table joins the `ResetDatabase` TRUNCATE list; new `AppNotificationPopulator`.

### Retention
None in v1 (~10 rows/day, single user — the `push_log` precedent). The feed read caps at
`mezo.notification.feed.limit` (default 50).

## 4. Backend

### `feature/notification` additions

| Class | Responsibility |
|---|---|
| `AppNotificationKind` | the 12-kind catalog enum: key, family (push category or none), copy composer hook |
| `AppNotificationEntity` / `AppNotificationRepository` | the outbox row |
| `AppNotificationService` | `emit(owner, kind, args…)` — composes HU copy, builds dedup key, idempotent insert (unique-violation-safe); `feed(owner, limit)`; `markAllRead(owner)`. **No-op when the feature switch is off** so producers never break on it |
| `AppNotificationCopy` | pure HU copy composition per kind (unit-testable without Spring) |

### Emit sites (12 call sites, all thin `appNotificationService.emit(...)` calls)

`PatternDetectionService.upsert` + `.recordSnapshot` + `.reinforcePromotedFact`,
`HypothesisPipelineService.persist`, `FactExtractionService` (candidate + dedup-reinforce),
`MemoirGenerator.generate`, `PredictionGenerator`, `PredictionValidationService`,
`ExperimentProposalGenerator`, `ExperimentOutcomeService`,
`ChallengeGenerator`/`ChallengeOutcomeEvaluator`, `DailySummaryService`.

Lazy-GET generation paths flow through the same generators — the dedup key absorbs the double
path. `AppNotificationService` is injected by plain constructor injection everywhere, with the
switch-guard **inside `emit`** (no-op when `mezo.feature.notification-feed.enabled` is off) — one
uniform rule, no per-site `ObjectProvider` ceremony.

### Push integration

- **6 new `NotificationCategory` entries** (family-level, all default ON): `pattern`, `knowledge`,
  `prediction`, `experiment`, `challenge`, `memory` — catalog grows 14 → 20.
  `NotificationCategoryTest` pins the extended catalog. None are `feWritten`.
- **`AnchorResolver` new source:** reads today's `app_notification` rows for the owner; each maps
  to an `AnchoredEvent` with **anchor = max(occurredAt minute, wake minute)** — overnight events
  (02:20–03:00 motor runs) defer to the `SleepAnchorPort` wake anchor (the `briefing` precedent);
  daytime events (post-chat) push on their own minute. One uniform rule, no per-kind exceptions.
- **`push_log` dedup key gets an id suffix:** `{category}:{HHmm}:{notificationId-short}` for the
  feed-driven categories. The inherited `{category}:{HHmm}` form would collapse same-family
  wake-deferred events into a single push; the user explicitly wants each event pushed.
- **Service-worker tag collision:** `push-sw.js` uses `data.url` as the notification tag — two
  pushes deeplinking to the same `/insights/predictions` would replace each other on the phone
  (the check-in bug class). The **push** deeplink therefore carries an `?n={id}` discriminator
  (router ignores it — the established recipe); the **feed** row's stored deeplink stays clean.
- `memoir_ready` deliberately has **no** feed-driven push category — the existing `memoir`
  category (anchor: `memoir.cron` + grace = 19:15) keeps owning that push.

### Known accepted trade-off — dense Monday mornings

Monday after wake: briefing + weekly (existing) + prediction_new (06:30) + experiment_proposed
(06:45) + challenge (06:25) + memory_note + the night's pattern events at wake ⇒ realistically
6–8 pushes within an hour. Accepted explicitly by Daniel (2026-08-18) with per-category toggles as
the volume control; digest/coalescing is a possible later slice, not v1.

### Config & switches

- `mezo.feature.notification-feed.enabled` — `FeaturesConfiguration` constant +
  `@ConditionalOnProperty` on the new beans; `emit` no-ops when off.
- `mezo.notification.feed.*` `@Validated` properties record: `limit` (50), the `pattern_signal`
  band thresholds and the `pattern_inbox` strength gate (`min-abs-r` 0.3, `max-p` 0.15) — config,
  never magic numbers, FE constants pinned against them by test.

## 5. API contract (contract-first)

`api/feature/notification/notification.yml` gains a **new `NotificationFeed` tag** →
openapi-generator emits a separate `NotificationFeedApi` interface → new
`NotificationFeedController` (thin delegation), keeping the existing 6-operation
`NotificationController` untouched.

| Verb | Path | Notes |
|---|---|---|
| `GET` | `/api/notification/feed?limit=50` | newest-first list: `id, kind, title, body, deeplink, occurredAt, readAt`. FE derives the unread count |
| `POST` | `/api/notification/feed/read-all` | sets `read_at = now()` on every unread row; 204 |

No per-item read endpoint — panel-open marks everything read (classic bell semantics).

## 6. Frontend

### Components — new `features/notification/` feature dir

- **`components/NotificationBell.tsx`** — 4th chip in `AppHero`'s `.counters` row (🔔 + unread
  badge; `aria-label="Értesítések, N olvasatlan"`). Added inside `AppHero.tsx` itself → all 5
  sections inherit it with one edit.
- **`components/NotificationPanel.tsx`** — the approved **A-variant** dropdown: backdrop portaled
  into `.phone-screen` at z44, panel inside the hero's z45 stacking context (the `SubNavDropdown`
  recipe verbatim). Ma/Tegnap/Korábban groups (`logic/groupByDay.ts`), per-family tinted icon,
  title + 2-line clamped body + timestamp, unread = coral dot + tint. Item tap →
  `navigate(deeplink)` + close. Panel scrolls internally up to the 50-row limit; no separate
  full page.
- **Empty state:** honest "Még nincs értesítés." row; **degraded** (real-mode fetch failure): the
  panel renders the standard retry `GhostState` row, badge hides rather than showing a stale count.

### Data layer — `data/notification/feedHooks.ts` (barrel-exported)

- `useNotificationFeed()` — `useDualQuery`, key `['notification-feed']`; real: `GET /feed`; mock:
  deterministic seed (the mockup's items). Refresh: `refetchOnWindowFocus` + app-open — no
  aggressive polling (a push arrival brings the user via a focus event anyway).
- `useNotificationFeedActions().markAllRead()` — real: `POST /read-all` + optimistic cache write
  with rollback; mock: cache mutation. Mock queries carry `staleTime` + non-cache-first `queryFn`
  (the mock-cache-clobber trap).

### Read semantics

Panel open → `markAllRead()` immediately (badge clears); a local snapshot keeps the unread
dots/tint visible inside the open panel until it closes — the user still sees what was new.

## 7. Testing

**Backend:**
- `AppNotificationKindTest` — pins the 12-kind catalog (keys, families, deeplinks) against §2.
- `AppNotificationCopyTest` — pure copy composition per kind (no Spring).
- `AppNotificationServiceIT` — emit idempotency (same dedup key twice → one row), switch-off no-op,
  feed ordering/limit, markAllRead.
- Producer ITs extended: one representative emit assertion per producer family (pattern detection
  creates `pattern_inbox` when gated in / doesn't when gated out; band-crossing fires
  `pattern_signal`, non-crossing doesn't; reinforcement, candidate, prediction outcome, experiment
  close, memoir, summary).
- `AnchorResolverIT` cases: overnight event anchors at wake; daytime event anchors on its own
  minute; the `{category}:{HHmm}:{id}` dedup key shape; `NotificationCategoryTest` pins the 20-key
  catalog.
- `NotificationFeedApiIT` — both endpoints, ownership filtering.
- Strength-gate/band constants pinned against config on the backend and against `insights.ts`
  constants on the FE (both directions of the drift).

**Frontend (both modes green + build):**
- `feedHooks.test.tsx` — dual-mode read, optimistic markAllRead + rollback (stateful fake backend —
  the notificationPrefHooks lesson).
- `NotificationBell.test.tsx` / `NotificationPanel.test.tsx` — badge count, open → markAllRead,
  day grouping, deeplink navigation + close, unread-snapshot styling, empty/degraded states.
- `AppHero.test.tsx` extended for the 4th chip.

## 8. Slices (implementation order)

1. **F1 — outbox + feed API + FE bell/panel** (mock + real): table, `AppNotificationService`,
   the 2 endpoints, `NotificationBell`/`NotificationPanel`, hooks, tests. Emit sites: pattern
   family only (inbox/signal/reinforced) — the richest source proves the shape.
2. **F2 — remaining emit sites**: knowledge/candidate, memoir, prediction, experiment, challenge,
   memory + their producer-IT assertions.
3. **F3 — push wiring**: 6 new categories, `AnchorResolver` source + wake-deferral, dedup-key
   suffix, `?n=` discriminator, `NotificationsPage` settings rows for the new categories.

Each slice: own bd child issue under `mezo-gzhp`, own branch/self-PR/CI-green/`--no-ff` merge, and
the `docs/features/` updates in the same change (`_platform-notifications.md` + `insights.md` §
integrations; new §feature doc section for the bell).
