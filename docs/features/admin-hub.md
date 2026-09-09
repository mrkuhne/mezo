---
title: Admin hub — owner console
type: feature-domain
status: done
updated: 2026-09-09
tags: [me, auth, admin, llmlog, backend, frontend, data-layer, design]
key_files:
  - api/feature/admin/admin.yml
  - api/feature/admin-insights/admin-insights.yml
  - api/feature/admin-data/admin-data.yml
  - api/feature/llm-usage/llm-usage.yml
  - api/feature/ai-drafts/ai-drafts.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/admin
  - frontend/src/features/admin
  - frontend/src/data/admin
related: [_platform-auth-security, me, _platform-api-backend, _platform-data-layer, _platform-design-system, admin-memory-explorer]
---

# Admin hub — Feature Documentation

> One-line: the owner's full console at `/admin/*` (desktop, OWNER-only, gated by
> `mezo.feature.admin-insights.enabled`) — a value dashboard (Pulzus · Emberek · Funkciók ·
> Költés · Memória · Meghívók) plus a "Nyers adatok" data-browser tool, built around six owner
> questions rather than a raw table dump.
> **Status: ✅ backend · ✅ FE real · ✅ FE mock.** `mezo-l096` (value-dashboard redesign of the
> original `mezo-d5iy` admin hub), part 1 of the admin/observability platform series.

## 1. Summary

During the beta the owner needs six questions answered without opening pgAdmin: *is anything
broken right now* (Pulzus), *who are my testers and are they engaged* (Emberek), *which features
are worth keeping* (Funkciók), *where is the AI budget going* (Költés), *is the companion's
memory healthy* (Memória), and *who has access* (Meghívók). A seventh, "Nyers adatok", is a
drill-through tool, not a destination — a generic `information_schema`-driven row browser kept
for edge cases the six pages don't cover. Beta testers have given signed consent to admin
visibility of their data for the duration of the beta, so cross-user reads are an explicit,
documented product decision — see [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md),
which extends the *Ownership exception* precedent in [`_platform-auth-security.md`](_platform-auth-security.md)
§4.

`/admin` is a **second top-level route entry**, a sibling of the mobile `AppLayout` tree, not a
child of it — its own `AdminLayout` (left rail, full-width 12-column mosaic, no `TabBar`, no
`PhoneFrame`) and its own `React.lazy` chunk (the codebase's first). The mobile PWA never
downloads it. Everything is gated server-side by the existing `OWNER` role via
`currentUser.requireOwner()` — no new `ADMIN` role — and the whole slice is feature-flagged off
by default (`mezo.feature.admin-insights.enabled`, `FeaturesConfiguration.ADMIN_INSIGHTS_SWITCH`,
explicitly `true` in `k8s/backend/deployment.yaml`). **Read-only**: the data browser and every
insights endpoint edit nothing; the account actions (status toggle, password reset, invites)
predate this epic and are unchanged.

This doc's predecessor covered the original `mezo-d5iy` build (Áttekintés/Userek/Feature-
használat/Adatböngésző + the moved Költés/Meghívók pages); `mezo-l096` replaced that IA with the
six-question value dashboard below, kept the moved pages' contracts (`AdminApi`, most of
`LlmUsage`), and added three new backend slices (`AdminFeatureService` for Funkciók,
`AdminAlertQuery`/`AdminAlertService` for the Pulzus status band, `AiDraftOutcomeRepository`
reads for `acceptedShare`).

## 2. User-facing behavior

Left rail (`AdminRail`, clay icons, one item per section), full-width content, no bottom TabBar.
A non-OWNER hitting any `/admin/*` path gets a Hungarian toast (`Ehhez a felülethez nincs
jogosultságod.`) and is bounced to `/` — cosmetic only, since `currentUser.requireOwner()` on the
backend is the real gate.

**Rail order** (`AdminRail.tsx`): Pulzus → Emberek → Funkciók → Költés → Memória → Meghívók és
fiókok, then a separate "Eszközök" (tools) group at the rail foot holding only **Nyers adatok** —
the data browser is deliberately NOT a peer of the six main sections (it moved out of the main
list in the `mezo-l096` redesign).

- **`/admin` — Pulzus.** *Is anything broken right now?* A status band (`AdminStatusBand`,
  driven by `GET /api/admin/alerts`) plus a 12-column mosaic: a **Rendszer** KPI that counts ONLY
  actionable alerts (`bad`/`warn` severities — an info-only alert set, e.g. a lone
  `tester_quiet`, must never read as "N figyelmeztetés" on a coral wash) with a plain sage
  "all clear" ring when there is nothing actionable; **Költés ma** (today's cost + a Δ against
  the trailing 7-day average, `deltaVsTrailingAvg` — never a guessed delta); **Aktív ma** (active
  today / total, with 7d/30d context); **Memória** (item + vector counts, an "elakadva" tag when
  the alerts feed carries `memory_stuck` — never a fabricated health percentage); a 30-day cost
  trend with a per-feature legend; a 30-day activity trend with a per-domain legend; and three
  top-N tiles — "Kik viszik a költést · 7 nap" (→ `/admin/users`), "Mire megy a pénz · 7 nap" (→
  `/admin/cost`), "Csendes tesztelők" (→ `/admin/users`). Every tile combining more than one
  query ORs their `isError`/`isPending` into a shared `AdminTileQuery` so one failing endpoint
  degrades only the tile(s) that actually depend on it.
- **`/admin/users` — Emberek.** *Who are my testers and are they engaged?* Defaults to a card
  grid, one `TesterCard` per account, grouped by a derived risk status (`aktív` · `csendesedik` ·
  `lemorzsolódott` · `még nem aktív`, `testerStatus()` in `adminViz.ts`) with clickable summary
  chips that filter the grid; sortable by kockázat (quiet-first, a never-active user sorts
  first) or by 30-day cost; searchable (debounced ~300ms, `q`). The owner's own card is excluded
  from the two churn buckets' counts (their own activity isn't a churn signal about the tester
  base) but is not force-shown once a status filter is active. The status filter (and its
  `?filter=` URL reflection, see §9) only affects the card grid — a "Táblázat nézet" chip toggles
  to the original dense sortable table (server-side `sort`/`dir` via `listAdminUserInsights`),
  which shows every search-matched row regardless of any active status filter.
- **`/admin/users/:id` — Tesztelő részlet.** A ring gauge for the 30-day active-day share, then
  six tabs: **Aktivitás** (90-day per-domain heat strip), **Adatok** (data inventory + an
  embedded per-table row browser, same `DataTable` component as Nyers adatok, scoped to this
  user — `useAdminRows({ table, userId, ... })`), **Funkciók** (30-day feature adoption list +
  a "still undiscovered" section from the SAME feature board endpoint the Funkciók page uses,
  its own independent query so a board failure never blanks the Aktivitás tab), **Költség**
  (30-day cost by feature), **Visszajelzések** (per-surface companion feedback + recall quality,
  `GET /api/admin/users/{id}/feedback` — null when the companion switch is off, an honest empty
  list when on but this user cast no votes), and **Memória** (navigates to
  `/admin/users/:id/memory`, part 2 of the series — see
  [`admin-memory-explorer.md`](admin-memory-explorer.md)).
- **`/admin/features` — Funkciók.** *Which features are worth keeping?* Replaces the old
  Feature-használat matrix page (`/admin/usage` is now a client-side redirect to `/admin/features`,
  preserving old bookmarks). A summary strip (active feature count, count with any feedback
  source, total cost) → a period toggle (30d/90d) → a value/cost quadrant (`ValueCostQuadrant`) →
  a sortable scorecard list (érték · költség · használat), non-system rows first, system rows
  (the `unknown`/`admin_replay` slugs) grouped under a muted divider → a supporting "Képernyők ·
  megnyitások" top-8 tile (`GET /api/admin/usage/screens`, its own independent query) with a
  collapsible full list.
- **`/admin/features/:key` — Funkció részlet.** One feature's usage-by-week sparkline, adoption
  funnel (kipróbálta/visszatért/rendszeres, with the tried-user name chips), feedback trend +
  down-reasons (null when companion-off, empty list when on but unmapped), reliability
  (error %, p50/p90 latency, top error codes), cost by served model, and top-spending users. The
  **acceptedShare** figure ("Elfogadási arány") is read off the SAME period's board row
  (`useAdminFeatureBoard`), not the detail response itself — the detail contract carries no such
  field — and renders "még nem mérjük" rather than a fabricated 0% when there are zero recorded
  draft outcomes. An unknown `:key` renders "Ismeretlen funkció." (folded into the honest
  `key === ''` empty shape, same idiom as the memory explorer's degraded tile).
- **`/admin/cost` — Költés.** *Where is the AI budget going?* Rebuilt on the pre-existing
  `LlmUsage` contract (mezo-pfdv), not merely moved: a calendar-month KPI strip (`vs előző hónap
  azonos napja`, honest "nincs előző havi adat" when the prior month has no priced row) → top-5
  feature/model/user cost cards → a model-mix table with prompt/total token columns → a rolling
  30-day cost trend with anomaly-dot markers → a URL-param-driven call list (`?day`, `?feature`,
  `?status`, `?user` — the deep-link contract every alert/legend click writes into, see §4) → a
  cost-matrix toggle (`useAdminCostMatrix`, the `Háttér` bucket for ownerless cron rows).
  Calendar-month tiles and rolling-30-day tiles are never mixed in one tile — each says which
  window it is in its own copy.
- **`/admin/cost/:id` — Költség részlet.** One audited LLM call's full detail (`AdminCostDetailPage`,
  the pre-existing `AiCallDetailPage` under a new route) — request/response text (scrubbed after
  the retention job runs), token/latency/pricing-snapshot breakdown.
- **`/admin/memory` — Memória (entry).** *Is the companion's memory healthy, installation-wide?*
  Four KPI posters (kész/elakadt/elavult vektor, emlékek összesen) from the NEW
  `getAdminMemoryHealth`-style install-wide read (§4), a relative "utolsó éjszakai feldolgozás"
  line (warns past 26h — the nightly job's own SLO), and a tester picker that jumps straight into
  a given user's `/admin/users/:id/memory` explorer. One companion-off gate for the whole KPI row
  (a degraded read blanks all four posters together, since they're meaningless without it); the
  tester picker still works, since it depends on a different, non-degradable endpoint. Part 2 of
  the series — full detail in [`admin-memory-explorer.md`](admin-memory-explorer.md).
- **`/admin/data` — Nyers adatok.** A user + table picker (or a named convenience view:
  *Mezociklusok*, *Edzések*, *Gyakorlatok*, *Minták*, *LLM-history*, *Memória-elemek*), a dense
  row table, jsonb cells that expand on click, FK cells that link to the referenced row
  (`?table=&rowId=`), and a "Törölt sorok" toggle (`includeDeleted`). A drill-through **tool**,
  not a rail destination — every "N sikertelen" style number elsewhere in the hub that links here
  (Rétegek's linked StatCells, the memory entry page's "problémák" strip) treats the count as a
  guide, never a working filter: the data browser has no arbitrary-condition filter.
- **`/admin/accounts` — Meghívók és fiókok.** The moved `AdminAccountsPage` (formerly
  `BetaAdminPage`): mint/list/delete invite codes, per-account temp-password reset
  (`TempPasswordSheet`), enable/disable toggle. Unchanged behavior — this page and its route
  predate the `mezo-l096` redesign and were not touched by it.

**Deep-link contract** (owner questions must be one click from the alert/legend that raised
them, see §5): `/admin/cost?day=&feature=&status=&user=` (`AdminCostPage`'s `useSearchParams`
state, written by the Pulzus alert band's `cost_spike`/`llm_errors` links and by every legend
click on the Pulzus/Cost trend tiles); `/admin/users/:id/memory?view=runs|graph|map|layers&sel=`
(part 2, see that doc); `/admin/data?table=&userId=` or `?table=&rowId=` (every FK cell and every
linked count in the memory explorer's Rétegek view and the user-detail Adatok tab).

**Redirects** (`app/router.tsx`, `adminRoutes.tsx`): `me/beallitasok/admin` → `/admin/accounts`;
`me/ai-usage/*` → `/admin/cost/*` (`LegacyPathRedirect`, prefix-preserving); `/admin/usage` →
`/admin/features` (client-side `<Navigate>`, bookmark-preserving after the Funkciók rebuild
replaced the old matrix page). The Beállítások page's admin row points at `/admin` directly.

## 3. Architecture & data flow

```
/admin/*  React.lazy chunk · AdminLayout (left rail + Outlet, MosaicDesktop content)
   │  same JWT bearer client as the mobile app; useMe().role === 'OWNER' gates client-side (cosmetic)
   ▼
/api/admin/**  AdminApi (invites/accounts) + AdminInsightsApi + AdminDataApi + AdminMemoryApi
   │           (this doc: the first two + AdminDataApi; AdminMemoryApi → admin-memory-explorer.md)
   │  first statement of every controller method: currentUser.requireOwner()
   ▼
feature/admin (backend slice; dependency direction admin → llmlog, auth, companion — nothing
│               depends on admin; the admin → companion edge is owned by admin-memory-explorer.md)
   ├─ AdminOverviewService      installation-wide counters + 30-day series (Pulzus)
   ├─ AdminUserService          user list with footprint, user detail, user feedback (Emberek)
   ├─ AdminUsageService         feature × day matrix, user × feature cost matrix, screen usage
   ├─ AdminFeatureService       Funkciók scorecard/detail/feedback-summary aggregation (mezo-l096)
   ├─ AdminAlertService         Pulzus status-band alert rules (mezo-kjwa)
   ├─ AdminDataBrowserService   information_schema-driven read-only row browser (Nyers adatok)
   ├─ AdminTableCatalog         the allowlist — built once from information_schema, cached
   ├─ AdminSqlDialect           quote()s catalog identifiers into SQL text; day-bucketing expr
   └─ AdminConvenienceViews     the six named views, declared in code
        ├─ AdminInsightsQuery / AdminRowQuery / AdminCatalogQuery / AdminFeatureQuery / AdminAlertQuery
        │     (JdbcClient native SQL — AdminAlertQuery ALSO backs the memory explorer's
        │     install-wide health op, see admin-memory-explorer.md §4)
        ├─ LlmLogRepository / AiDraftOutcomeRepository  (feature/llmlog)  → cost, error-rate,
        │     token and draft-outcome aggregates
        └─ AppUserRepository   (feature/auth)    → users, status, existing Admin invite/account API
```

**Why native SQL in one slice, not ten.** The browser and the footprint counters must work for
every owned table, including ones added later, without touching every feature slice for each new
table. `AdminTableCatalog.load()` reads `information_schema.columns`/`.key_column_usage` once
(cached, `refresh()`-able) and is the single source of truth for what is browsable — see §9 for
the rejected alternatives.

**FE data layer** (`frontend/src/data/admin/`): `adminInsights{Api,Hooks,Mock}.ts` and
`adminData{Api,Hooks,Mock}.ts` sit beside the pre-existing `admin{Api,Hooks,Mock}.ts`
(invites/accounts) and `adminMemory{Api,Hooks,Mock}.ts` (part 2). Every hook is `useDualQuery`
with `enabled: isOwner` and an explicit `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS` (an omitted
value would overwrite the client default and leave the query permanently stale —
`useDualQuery.ts:36-45`). `useAdminRows` additionally sets `keepPreviousRealData: true` so
paging/sorting/toggling "Törölt sorok" never blanks the table for the width of a round-trip, and
folds `params.table === ''` (every picker on this surface starts unselected) into `enabled`
rather than leaving it for the caller. All reads and mutations barrel through `@/data/hooks`;
MSW handlers for every new path live in `frontend/src/test/msw/handlers.ts`.

## 4. Data model & API

No new tables. `AdminProperties` (`@ConfigurationProperties(prefix = "mezo.admin")`) carries:

- `reportZone` (`Europe/Budapest`) — the zone every day-bucketing expression in this slice shifts
  into before grouping.
- `statementTimeout` (`5s`) — `SET LOCAL statement_timeout` for every native/dynamic query the
  admin hub itself runs (`AdminRowQuery`/`AdminFeatureQuery`/`AdminAlertQuery`); the RAG explorer
  keeps its own separate `mezo.admin.memory.statement-timeout` knob.
- `browser.maxPageSize` (200) — the data browser's page-size clamp.
- `featureMap` (`Map<String, FeatureSource(table, timestampColumn)>`) — the non-LLM feature →
  (owned table, timestamp/date column) map, e.g. `train` → `workout_session.started_at`, `food` →
  `meal.logged_at`, `sleep` → `sleep_log.date`, `journal` → `journal_entry.occurred_on`, `habits`
  → `habit_day.habit_date`, `water` → `water_log.log_date`, `weight` → `weight_log.date`.
  LLM-backed features come from `llm_log_history.feature` instead; a feature appears in the
  Funkciók board if it is in either source, OR has any `ai_draft_outcome` row in the trailing
  12-week trend window (§9).
- `artifactFeatureMap` (`Map<String, String>`) — for every companion-feedback `artifact_kind`,
  which feature slug it counts under on the Funkciók scorecard, e.g. `message_feedback` rows with
  `artifact_kind=chat_message` roll up under `companion_chat`. Nine pairs today (`chat_message`,
  `feed_message`, `weekly_suggestion`, `weekly_review`, `memoir`, `prediction`, `day_review`,
  `meal_coach`, `recipe_breakdown`), each verified against the real generation call sites.
- `alerts` — the Pulzus status-band rule thresholds: `costSpikeFactor` (2.0), `costSpikeMinUsd`
  ($0.50), `llmErrorRatePct` (20), `llmErrorMinCalls` (5), `jobMissedAfterHours` (26),
  `testerQuietDays` (7).

**Contracts** — the pre-existing `api/feature/admin/admin.yml` (tag `Admin`, invites/accounts) is
unchanged; `api/feature/llm-usage/llm-usage.yml` (tag `LlmUsage`) is unchanged in shape (it
predates this epic — see `beta-admin.md`'s history) but is now consumed exclusively by
`AdminCostPage`/`AdminCostDetailPage`; three fragments below are new/current for this epic.

`api/feature/admin-insights/admin-insights.yml` (tag `AdminInsights` → `AdminInsightsApi`):

| Op | Path | → |
|---|---|---|
| `getAdminOverview` | `GET /api/admin/overview` | `AdminOverviewResponse{userCount, activeToday/7d/30d, loggedToday{domain→count}, costTodayUsd, memoryItemCount, vectorCount, activeUserSeries, domainSeries, costSeries}` |
| `listAdminUserInsights` | `GET /api/admin/users-insight?q=&sort=&dir=` | `AdminUserInsightResponse[]` — identity + `rowCount, vectorCount, cost30dUsd, activeDays30d, activityByDay, feedbackUp, feedbackDown, lastActivityAt` |
| `getAdminUserInsight` | `GET /api/admin/users/{id}/insight` | `AdminUserDetailResponse{user, activitySeries, inventory: AdminTableFootprint[], featureUsage30d, costByFeature30d}` (404 `ADMIN_USER_NOT_FOUND`) |
| `getAdminUserFeedback` | `GET /api/admin/users/{id}/feedback` | `AdminUserFeedbackResponse{surfaces, recall}` — `surfaces` null when companion-off, empty when on but no votes; `recall` null when companion-off (404 `ADMIN_USER_NOT_FOUND`) |
| `getAdminFeatureUsage` | `GET /api/admin/usage/features?period=7d\|30d\|90d` | `AdminFeatureUsageResponse{period, days, features: AdminDaySeries[]}` |
| `getAdminCostMatrix` | `GET /api/admin/usage/cost-matrix?period=` | `AdminCostMatrixResponse{period, users, features, cells: AdminCostMatrixCell[], totalUsd}` — a cell's `userId: null` is the `Háttér` bucket |
| `getAdminScreenUsage` | `GET /api/admin/usage/screens?period=7d\|30d\|90d` | `AdminScreenUsageResponse{period, days, screens: AdminScreenUsageRow[]}` — from the lean `screen_event` log |
| `getAdminAlerts` | `GET /api/admin/alerts` | `AdminAlertsResponse{generatedAt, alerts: AdminAlert[]}` — empty list = all good; five rules, fixed evaluation order (see §5) |
| `getAdminFeatureBoard` | `GET /api/admin/features?period=30d\|90d` | `AdminFeatureBoardResponse{period, rows: AdminFeatureRow[]}` — one row per feature (usage, `usesPerWeek` fixed-12-week trend, `habitUserShare`, `helped`, `acceptedShare`, cost, `errorPct`, `p90LatencyMs`, `screenViews`) |
| `getAdminFeatureDetail` | `GET /api/admin/features/{key}?period=30d\|90d` | `AdminFeatureDetailResponse{key, kind, usageByWeek, funnel, feedbackTrend, downReasons, reliability, costByModel, topUsers}` (404 `ADMIN_FEATURE_NOT_FOUND`) |
| `getAdminFeedbackSummary` | `GET /api/admin/feedback/summary?period=30d\|90d` | `AdminFeedbackSummaryResponse{period, features, recall}` — both panels companion-gated |

`api/feature/admin-data/admin-data.yml` (tag `AdminData` → `AdminDataApi`):

| Op | Path | → |
|---|---|---|
| `listAdminTables` | `GET /api/admin/data/tables` | `AdminTableListResponse{tables: AdminTableDescriptor[]}` — name, `ownerColumn` (`created_by`, or `id` for `app_user`), `softDeletable`, columns (name/type/`foreignKey`/`referencesTable`) |
| `listAdminViews` | `GET /api/admin/data/views` | `AdminViewDescriptor[]` — id, label, table, `defaultSort`, `defaultDir` |
| `getAdminTableRows` | `GET /api/admin/data/tables/{table}/rows?userId=&page=&size=&sort=&dir=&includeDeleted=` | `AdminRowPageResponse{table, page, size, total, columns, rows: object[]}` — `size` **clamped** to `maxPageSize`, never rejected |

`api/feature/ai-drafts/ai-drafts.yml` (tag `AiDrafts`, mezo-76f6 — the write side of
`acceptedShare`):

| Op | Path | → |
|---|---|---|
| `recordAiDraftOutcome` | `POST /api/ai-drafts/{draftId}/outcome` | 204, upserts `(user, draftId) → outcome` (`accepted\|edited\|discarded`) — last signal wins; `feature` is a free slug, not checked against a fixed list; the admin scorecard is the only reader |

Every operation on the three OWNER-only tags above (`AdminInsights`, `AdminData`, and part 1's
pre-existing `Admin`/`LlmUsage`) is 401/403 (`AUTH_FORBIDDEN`) like the rest of the platform;
`getAdminTableRows` additionally 400s (`ADMIN_TABLE_UNKNOWN` / `ADMIN_COLUMN_UNKNOWN`) on an
unrecognized name and 504s (`ADMIN_QUERY_TIMEOUT`) on a statement-timeout cancellation.
`AiDrafts` is different in kind, not just in response codes — it is the ordinary user-facing write
side of `acceptedShare` (any signed-in user records their OWN draft outcomes), so it carries no
owner gate and no 403 at all: 204 on success, 400 on validation (unknown outcome, blank/oversized
`feature`), 401 on a missing/invalid token.

**`acceptedShare`'s upsert semantics (load-bearing).** `(accepted+edited)/total` over
`ai_draft_outcome` rows for a feature in the selected period; a row counts in the period its
FIRST signal was recorded in — a later cross-period flip (discarded then re-opened and accepted)
still counts in the original period, not the one the flip happened in. `null` when the feature
has zero recorded outcomes (never a fabricated 0%).

**Safety of the dynamic SQL (load-bearing).** Table and column identifiers named in a request
are never concatenated into SQL — `AdminTableCatalog.require`/`.requireColumn` resolve them
against the allowlist and the *catalog's own* strings are what `AdminSqlDialect.quote(...)`
emits. Columns whose name matches `password|secret|token|hash` (any table) and columns whose
`information_schema` type is `USER-DEFINED` (pgvector — not human-legible, no default JDBC
mapping) are **dropped from the catalog entirely**, so they can never be selected, sorted, or
filtered on. `invite.code` is deliberately **not** excluded despite looking secret-shaped — the
existing owner-facing `AdminApi` already returns it (`InviteResponse.code`) so the owner can hand
it to a beta tester. Native SQL bypasses JPA's `@SQLRestriction`, so every row query carries an
explicit `is_deleted = false` predicate unless `includeDeleted=true` is requested. Every
`JdbcClient` call opens with `SET LOCAL statement_timeout = '5s'` inside the read-only
transaction; Postgres SQLSTATE `57014` (statement-timeout cancellation) is translated to
`QueryTimeoutException` → `ADMIN_QUERY_TIMEOUT` (504) rather than a generic 500.

**The cost matrix's opinionated bits** (`AdminUsageService`): a null `created_by` is real cost
(cron/stream traffic) reported as a single synthetic user labelled `"Háttér"` with a null id —
never dropped, never merged into a named user; `status = ERROR` rows are excluded entirely (a
failed call is not cost); a row with a null `cost_usd` is counted into `unknownCalls`, never
folded into the sum as zero. The Funkciók board and detail reuse the same exclusion/`unknownCalls`
rules.

**Label-dictionary rule + completeness gate (`frontend/src/features/admin/lib/labels.ts`).** No
raw slug/table/screen/reason/surface/memory-term key may render on a default admin view — every
render goes through a `*Label()` helper (`featureLabel`, `screenLabel`, `tableLabel`,
`feedbackReasonLabel`, `surfaceLabel`, `memoryTermLabel`). An unknown key comes back as
`{ label: key, missing: true }` so the UI shows the raw key WITH a visible "(nincs címke)" marker
rather than silently lying about it. `labels.completeness.test.ts` fails CI the moment a new
backend `LlmCallContext` feature slug ships with no Hungarian entry — it scans
`backend/src/main/java` for `new LlmCallContext("...")` call sites (plus the named-constant
variant) and asserts every discovered slug is a `FEATURE_LABELS` key.

**Honesty rules** (repeated across every admin surface, not just this doc's pages): `null` and
`0` are never conflated — a `null` `errorPct`/`p90LatencyMs`/`acceptedShare`/`costPerUse` means
"no data below the floor", never "zero"; a `missing: true` label renders its raw key WITH the
"(nincs címke)" marker, never a silently-translated guess; a degraded (feature-off) 404 renders
its own "ki van kapcsolva" tile, distinct from a genuine error tile; every derived metric that
looks like a percentage but is actually a guess/estimate (e.g. a becsült map centroid in the
memory explorer) says so in its own copy.

## 5. Integrations

- **← auth**: `CurrentUser.requireOwner()` is the whole authorization story for every endpoint in
  all four admin tags — see [`_platform-auth-security.md`](_platform-auth-security.md) §4's
  *Ownership exception* and [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md).
  `AppUserRepository` supplies user identity/status for both the existing account console and
  the new insights.
- **← llmlog**: `LlmLogRepository` aggregations feed today's cost, the cost matrix, the Funkciók
  board/detail cost+reliability panels, and the `Háttér` bucket; `AiDraftOutcomeRepository` feeds
  `acceptedShare`; `LlmActorContext`/`UserFanOut` are what make a cron-driven LLM call
  attributable to a user instead of landing in `Háttér` in the first place — see
  [`_platform-auth-security.md`](_platform-auth-security.md) §4.
- **← every owned-table slice, implicitly**: `AdminTableCatalog` discovers any table with a
  `created_by` column through `information_schema`, so a new feature's table becomes browsable
  and counted in the overview/footprint without a code change here — the trade the native-SQL
  approach was chosen for (§9).
- **← companion (message_feedback)**: `AdminFeatureService`/`AdminUserService` read
  `message_feedback` live-state (current up/down, never windowed) through `artifactFeatureMap` for
  the Funkciók `helped` column, the feedback-summary op, and the per-user Visszajelzések tab;
  gated entirely on `CompanionFeatureFlag` (`mezo.feature.companion.enabled`) — off means `null`,
  never a fabricated zero.
- **me**: the Beállítások admin row now links to `/admin` instead of opening a `/me/*` page; the
  two moved pages (`AdminAccountsPage`, `AdminCostPage`/`AdminCostDetailPage`) keep the moved-in
  `AdminAccountsPage`'s original mobile-shaped body; `AdminCostPage` was subsequently rebuilt
  (mezo-pfdv) on the same `LlmUsage` contract into the section template described in §2.
- **companion / llmlog**: `AiUsageHero`'s prompt-cache hit ratio panel (`N% gyorsítótárból`,
  `LlmUsageTotals.cachedTokens / promptTokens`) lives on the `/admin/cost` KPI strip — cached
  input bills at a tenth of the normal rate, so this is the number that says whether the
  stable-prefix prompt order is paying off — see [`companion.md`](companion.md) §3 "Prompt
  assembly" for the split it measures. A period whose rows reported no prompt token HIDES the
  figure rather than showing 0%.
- **design system**: `AdminLayout`/`AdminRail`/`MosaicDesktop` extend the shared
  `mozaik`/`clay` kit (`frontend/src/shared/ui/{mozaik,clay}`) for a wider, desktop 12-column
  canvas rather than forking it — see [`_platform-design-system.md`](_platform-design-system.md).
- **admin-memory-explorer (part 2)**: shares this doc's layout kit, the 6th "Memória" user-detail
  tab, `AdminAlertQuery` (the memory-explorer's install-wide health op reads the SAME install-wide
  vector/item counts the `memory_stuck`/`job_missed` alerts already compute from), and the Rétegek
  view's deep links into `/admin/data`.

## 6. How to use it (consume)

```ts
import {
  useAdminOverview, useAdminAlerts, useAdminUserInsights, useAdminUserDetail, useAdminUserFeedback,
  useAdminFeatureBoard, useAdminFeatureDetail, useAdminFeedbackSummary,
  useAdminCostMatrix, useAdminScreenUsage,
  useAdminTables, useAdminViews, useAdminRows,
  useAdminInvites, useAdminUsers, useAdminActions, useMe,
} from '@/data/hooks'

const isOwner = useMe().data?.role === 'OWNER'
const { data: overview, isPending, isError, refetch } = useAdminOverview(isOwner)
const { data: board } = useAdminFeatureBoard('30d', isOwner)
const { data: rows } = useAdminRows({ table: 'workout_session', page: 0, size: 50 }, isOwner)
```
Every hook takes (or closes over) `isOwner` and passes it straight through as `enabled` — a
non-owner never fires an admin request even if a page somehow renders for one. Backend: any
owner-only endpoint starts with `currentUser.requireOwner()`, called from the controller layer
(never inside an already-open `@Transactional` method — it issues a `last_seen_at` write, per
`CurrentUser`'s class Javadoc).

## 7. How to extend it

- **A new insights field or matrix**: contract-first in `admin-insights.yml` →
  `npm run generate:api` + `pnpm generate:api` → an `AdminOverviewService`/`AdminUserService`/
  `AdminUsageService`/`AdminFeatureService` method → an `AdminInsightsController` override (gate
  first) → an IT under `feature/admin/controller/` → `adminInsightsApi`/`adminInsightsHooks`/mock
  seed → an MSW handler → a page tile → both-mode tests → this doc §4/§10.
- **A new browsable table**: nothing to do — `AdminTableCatalog` picks up any table with a
  `created_by` column automatically on the next cache load (`refresh()` after a migration, or a
  restart). Add a convenience view only if the table deserves a named shortcut
  (`AdminConvenienceViews.VIEWS`).
- **A new non-LLM feature in the Funkciók board**: add one entry to `mezo.admin.feature-map` in
  `application.yml` (`table` + `timestamp-column`) — no code change.
- **A new LLM feature**: nothing to do for the board itself — it appears the moment a row with
  that `feature` label lands in `llm_log_history` OR `ai_draft_outcome`. It DOES need a Hungarian
  entry in `FEATURE_LABELS` (`labels.ts`) — `labels.completeness.test.ts` fails CI otherwise.
- **A new feedback surface for the Funkciók `helped` column**: add its `artifact_kind` →
  feature-slug pair to `mezo.admin.artifact-feature-map`.
- **A new owner alert rule**: add a method to `AdminAlertService.alerts()` (fixed evaluation
  order — append at the end unless the new rule must outrank an existing one), a threshold field
  to `AdminProperties.Alerts` if it needs tuning, and a query to `AdminAlertQuery` if it needs a
  new install-wide count.

## 8. Testing

Backend (`-Dmezo.test.use-testcontainers=true`, Testcontainers `pgvector/pgvector:pg16`):
`AdminOverviewIT`, `AdminUserDetailIT`, `AdminUserInsightIT`, `AdminUserFeedbackIT` +
`AdminUserFeedbackCompanionOffIT`, `AdminUsageIT` (feature matrix + cost matrix, `Háttér` bucket,
`ERROR` exclusion, `unknownCalls`), `AdminScreenUsageIT`, `AdminFeatureBoardIT` +
`AdminFeatureDetailIT` (Funkciók scorecard/detail, incl. the `ai_draft_outcome` row-set union and
`acceptedShare`), `AdminFeaturesCompanionOffIT` (board/detail/feedback-summary with the companion
switch off), `AdminFeatureQueryIT` (the repository layer under the service tests),
`AdminAlertsIT` + `AdminAlertsCompanionOffIT` (all five rules, fixed order, the two
companion-dependent rules gated separately from the other three), `AdminDataBrowserIT` (allowlist
rejection on table/column/excluded-column, soft-delete toggle, page-size clamp, statement
timeout), `AdminPropertiesTest`, `AdminTableCatalogIT` (the `information_schema` inventory
against the `ResetDatabase` TRUNCATE list, guarding against a silently un-browsable new table),
plus the pre-existing `AdminInviteIT`/`AdminUserIT` (invites/accounts) and
`LlmUsageControllerIT`/`LlmActorContextTest`/`LlmActorResolverTest`. Every new endpoint has a
non-owner 403 case. `ArchitectureTest` (full `./mvnw test` only — focused `-Dtest=` runs skip
it) enforces `feature/admin`'s layer packages and the cycle-free dependency direction
(`admin → llmlog, auth, companion`; nothing depends on `admin`).

Frontend (both `pnpm test` [mock] and `VITE_USE_MOCK=false pnpm test` [real] — see the
`AGENTS.md` Build & Test gate for why the flag direction matters): a render test per admin page
in both modes, redirect tests for the moved/renamed routes (`/admin/usage` → `/admin/features`,
`/me/beallitasok/admin` → `/admin/accounts`, `/me/ai-usage/*` → `/admin/cost/*`) and the
non-owner bounce (`adminRedirects.test.tsx`), plus `adminHooks.test.tsx`,
`AdminAccountsPage.test.tsx`, `AiCallFilters/AiCallRow/AiFeatureBreakdown/AiModelBreakdown/
AiUsageHero/AiUserFilter.test.tsx`, `AdminLayout.test.tsx`, `Sparkline.test.tsx`,
`adminInsightsHooks.test.tsx`, `hooks.reexport.test.ts`, `dualMode.guard.test.ts`,
`labels.test.ts`/`labels.completeness.test.ts`, `FeatureScoreRow.test.tsx`,
`ValueCostQuadrant.test.tsx`, `TesterCard.test.tsx`.

**Gates**: contract-drift (`api/openapi.yml` + `api.gen.ts` committed), codemap regeneration
(`node scripts/gen-codemap.mjs`), visual goldens for the desktop mosaic surfaces.

## 9. Decisions, gotchas & deferred

- **Read-only, no export, no new role** — see [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md)
  for the full rationale and the rejected alternatives (per-feature admin aggregator services,
  Liquibase `admin_*` views, a separate admin SPA).
- **The consent behind this whole slice is time-boxed to the beta.** ADR 0038 must be revisited
  before general availability, not treated as a permanent schema-level exception like the shared
  catalogs (`exercise_catalog`/`pantry_catalog`).
- **`AdminCostPage`/`AdminCostDetailPage` are a rebuild (mezo-pfdv), not a straight move** — the
  original v1 judgement call moved `AiUsagePage`/`AiCallDetailPage` in verbatim with their
  mobile-shaped bodies; the section template described in §2 (KPI strip, top-5 cards, model-mix
  table, anomaly-dot trend, URL-param call list) replaced that body on the same `LlmUsage`
  contract. `AdminAccountsPage` (Meghívók) is still the original verbatim move.
- **`pgvector` columns and credential-shaped columns are dropped from the catalog, not just
  hidden** — they cannot be selected, sorted, or filtered on at all, the same defence-in-depth
  posture as the identifier allowlist itself.
- **Page size is clamped, not rejected** — an oversized `size` silently becomes
  `maxPageSize` (200) rather than a 400, since a slightly-too-eager UI request shouldn't error.
- **The Funkciók board's row set is wider than "used in the selected period"** — a feature idle
  for the whole selected period but used at some point in the trailing 12-ISO-week trend window
  still gets a row (all period-scoped numbers zero, `usesPerWeek` non-zero) — deliberate, so a
  feature's usage tails off toward zero on the sparkline instead of vanishing abruptly.
- **`/admin/users?filter=quiet`** (the `tester_quiet` alert's link target) lands pre-filtered:
  `AdminUsersPage` reads `?filter=` on mount and maps the alert's `quiet` alias to the
  `lemorzsolodott` status bucket — the SAME 7+-day boundary `mezo.admin.alerts.tester-quiet-days`
  fires on (`statusFromFilterParam`, `AdminUsersPage.tsx`). Clicking any summary-strip chip also
  writes the real status key back into `?filter=` (never the `quiet` alias) and clears it on
  toggle-off, so a reload or a shared link reproduces exactly what's on screen **in the card
  view** (mezo-wg4x fix round) — the "Táblázat nézet" table ignores the status filter (and thus
  `?filter=`) entirely, per §2.
- **Deferred (own specs/issues):** a free-form SQL box (SELECT-only Postgres role, second
  read-only datasource); infra observability — done separately, see
  [ADR 0037](../decisions/0037-observability-stack-victoriametrics.md); byte-level per-user
  footprint if row counts stop being enough signal.

## 10. Key files

- Contracts: `api/feature/admin/admin.yml`, `api/feature/admin-insights/admin-insights.yml`,
  `api/feature/admin-data/admin-data.yml`, `api/feature/llm-usage/llm-usage.yml`,
  `api/feature/ai-drafts/ai-drafts.yml`, `api/generate/merge.yml`
- Backend: `feature/admin/controller/{AdminInsightsController,AdminDataController}.java`,
  `feature/admin/service/{AdminOverviewService,AdminUserService,AdminUsageService,
  AdminFeatureService,AdminAlertService,AdminDataBrowserService,AdminTableCatalog,AdminSqlDialect,
  AdminConvenienceViews,AdminSeries}.java`, `feature/admin/repository/{AdminInsightsQuery,
  AdminRowQuery,AdminCatalogQuery,AdminFeatureQuery,AdminAlertQuery}.java`,
  `feature/admin/config/AdminProperties.java`,
  `techcore/configuration/FeaturesConfiguration.java` (`ADMIN_INSIGHTS_SWITCH`); pre-existing
  `feature/auth/{service/AdminService,controller/AdminController}.java`,
  `feature/llmlog/{controller/LlmUsageController,service/LlmUsageService,
  repository/AiDraftOutcomeRepository}.java`, `techcore/security/LlmActorContext.java`
- Backend tests: `feature/admin/config/AdminPropertiesTest.java`,
  `feature/admin/controller/{AdminDataBrowserIT,AdminOverviewIT,AdminUsageIT,AdminScreenUsageIT,
  AdminUserDetailIT,AdminUserInsightIT,AdminUserFeedbackIT,AdminUserFeedbackCompanionOffIT,
  AdminFeatureBoardIT,AdminFeatureDetailIT,AdminFeaturesCompanionOffIT,AdminAlertsIT,
  AdminAlertsCompanionOffIT}.java`, `feature/admin/repository/AdminFeatureQueryIT.java`,
  `feature/admin/service/AdminTableCatalogIT.java`,
  `feature/auth/{AdminInviteIT,AdminUserIT}.java`,
  `feature/llmlog/controller/LlmUsageControllerIT.java`
- Frontend: `features/admin/{AdminLayout,AdminRail,adminRoutes}.tsx`,
  `features/admin/components/{AdminTile,AdminStatusBand,DataTable,JsonCell,MatrixGrid,Sparkline,
  TablePicker,UserPicker,TesterCard,FeatureScoreRow,ValueCostQuadrant,ScreenUsageTable,
  TopListTile,Ai*}.tsx`, `features/admin/pages/{AdminOverviewPage,AdminUsersPage,
  AdminUserDetailPage,AdminFeaturesPage,AdminFeatureDetailPage,AdminMemoryEntryPage,AdminDataPage,
  AdminCostPage,AdminCostDetailPage,AdminAccountsPage}.tsx`, `features/admin/lib/{labels,
  adminViz}.ts`, `data/admin/{adminApi,adminHooks,adminMock,adminInsightsApi,adminInsightsHooks,
  adminInsightsMock,adminDataApi,adminDataHooks,adminDataMock}.ts`, `data/me/llmUsage{Api,Hooks}.ts`,
  `app/router.tsx` (redirects), `test/msw/handlers.ts`
- Docs: this file, [`admin-memory-explorer.md`](admin-memory-explorer.md) (part 2),
  [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md),
  [`_platform-auth-security.md`](_platform-auth-security.md) §4,
  `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md`,
  `docs/superpowers/plans/2026-09-09-admin-value-dashboard-slice9.md`,
  `docs/design_2.0/prototypes/admin-pulzus.html` (the approved "A irány — Pulzus" design record)
