---
title: Admin hub — owner console
type: feature-domain
status: done
updated: 2026-09-07
tags: [me, auth, admin, llmlog, backend, frontend, data-layer, design]
key_files:
  - api/feature/admin/admin.yml
  - api/feature/admin-insights/admin-insights.yml
  - api/feature/admin-data/admin-data.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/admin
  - frontend/src/features/admin
  - frontend/src/data/admin
related: [_platform-auth-security, me, _platform-api-backend, _platform-data-layer, _platform-design-system]
---

# Admin hub — Feature Documentation

> One-line: the owner's full console at `/admin/*` (desktop, OWNER-only, gated by
> `mezo.feature.admin-insights.enabled`) — installation overview, per-user activity/footprint/
> cost, feature-usage and cost matrices, a generic `information_schema`-driven row browser, and
> the pre-existing invite/account console + AI-napló, moved in under the same shell.
> **Status: ✅ backend · ✅ FE real · ✅ FE mock.** `mezo-d5iy`, part 1 of the admin/observability
> platform series.

## 1. Summary

During the beta the owner needs to see, without opening pgAdmin, how many users there are, who
they are, what they do and how often, how much data each of them holds, which features they use,
and how much LLM cost they generate. Beta testers have given signed consent to admin visibility
of their data for the duration of the beta, so cross-user reads are an explicit, documented
product decision — see [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md), which
extends the *Ownership exception* precedent in [`_platform-auth-security.md`](_platform-auth-security.md)
§4.

`/admin` is a **second top-level route entry**, a sibling of the mobile `AppLayout` tree, not a
child of it — its own `AdminLayout` (left rail, full-width 12-column mosaic, no `TabBar`, no
`PhoneFrame`) and its own `React.lazy` chunk, the codebase's first (`adminRoutes.tsx`). The
mobile PWA never downloads it. Everything is gated server-side by the existing `OWNER` role via
`currentUser.requireOwner()` — no new `ADMIN` role — and the whole slice is feature-flagged off
by default (`mezo.feature.admin-insights.enabled`, `FeaturesConfiguration.ADMIN_INSIGHTS_SWITCH`,
explicitly `true` in `k8s/backend/deployment.yaml`). **v1 is read-only**: the data browser edits
nothing; the account actions (status toggle, password reset, invites) predate this epic and are
unchanged.

This doc supersedes `beta-admin.md`, which covered only the invite/account console and the
owner-gated LLM-usage page (S3 of the multi-user epic, `mezo-qw37.3`) — both of those surfaces
now live under `/admin` as `AdminAccountsPage` and `AdminCostPage`/`AdminCostDetailPage`, moved
verbatim (same mobile-shaped bodies, only their routing changed) rather than rewritten.

## 2. User-facing behavior

Left rail (`AdminRail`, clay icons, one per section), full-width content, no bottom TabBar. A
non-OWNER hitting any `/admin/*` path gets a Hungarian toast (`Ehhez a felülethez nincs
jogosultságod.`) and is bounced to `/` — cosmetic only, since `currentUser.requireOwner()` on the
backend is the real gate.

- **`/admin` — Áttekintés.** Installation-wide counters (user count, active today/7d/30d by
  `last_seen_at`, rows logged today per domain, today's LLM cost, memory-item and vector counts)
  as StatCells, plus 30-day sparklines for active users, per-domain logs, and cost. Every tile
  fails independently ("nem elérhető" + retry) rather than failing the whole page — the overview
  is many independent reads.
- **`/admin/users` — Userek.** One row per account: the existing identity fields plus footprint
  (`rowCount`, `vectorCount`), `cost30dUsd`, `activeDays30d`, `lastActivityAt`. Searchable
  (`q`), sortable (`name`/`createdAt`/`lastActivityAt`/`rowCount`/`cost30dUsd`/`activeDays30d`,
  `asc`/`desc`).
- **`/admin/users/:id` — User részlet.** One account's 90-day per-domain activity series, a data
  inventory (table → row count, deleted count, last-created timestamp), 30-day feature usage, and
  30-day cost by feature.
- **`/admin/usage` — Feature-használat.** A feature × day matrix (`7d`/`30d`/`90d`) combining
  domain features (train, food, sleep, journal, habits, water, weight — derived from when those
  tables were written) and LLM-backed features (`llm_log_history.feature` labels, e.g.
  `companion_chat`, `meal_draft`).
- **`/admin/cost` / `/admin/cost/:id` — Költség.** The moved `AiUsagePage`/`AiCallDetailPage`:
  model/feature cost breakdown, per-account chip filter (`Mindenki` / one chip per account / a
  non-clickable `Háttér` background bucket), call list and detail. Same behavior as before the
  move — see §9 for what stayed the same.
- **`/admin/data` — Adatböngésző.** A user + table picker (or a named convenience view:
  *Mezociklusok*, *Edzések*, *Gyakorlatok*, *Minták*, *LLM-history*, *Memória-elemek*), a dense
  row table, jsonb cells that expand on click, FK cells that link to the referenced row, and a
  "Törölt sorok" toggle (`includeDeleted`).
- **`/admin/accounts` — Meghívók és fiókok.** The moved `AdminAccountsPage` (formerly
  `BetaAdminPage`): mint/list/delete invite codes, per-account temp-password reset
  (`TempPasswordSheet`), enable/disable toggle. Unchanged behavior — see §9.

**Redirects** (`app/router.tsx`): `me/beallitasok/admin` → `/admin/accounts`;
`me/ai-usage/*` → `/admin/cost/*` (`LegacyPathRedirect`, prefix-preserving so
`/me/ai-usage/:id` lands on `/admin/cost/:id`). The Beállítások page's admin row now points at
`/admin` directly instead of `/me/beallitasok/admin`.

## 3. Architecture & data flow

```
/admin/*  React.lazy chunk · AdminLayout (left rail + Outlet, MosaicDesktop content)
   │  same JWT bearer client as the mobile app; useMe().role === 'OWNER' gates client-side (cosmetic)
   ▼
/api/admin/**  AdminApi (existing, invites/accounts) + AdminInsightsApi + AdminDataApi (new)
   │  first statement of every controller method: currentUser.requireOwner()
   ▼
feature/admin (NEW backend slice; dependency direction admin → llmlog, auth — nothing depends on admin)
   ├─ AdminOverviewService      installation-wide counters + 30-day series
   ├─ AdminUserService          user list with footprint, user detail
   ├─ AdminUsageService         feature × day matrix, user × feature cost matrix (Háttér bucket)
   ├─ AdminDataBrowserService   information_schema-driven read-only row browser
   ├─ AdminTableCatalog         the allowlist — built once from information_schema, cached
   ├─ AdminSqlDialect           quote()s catalog identifiers into SQL text; day-bucketing expr
   └─ AdminConvenienceViews     the six named views, declared in code
        ├─ AdminInsightsQuery / AdminRowQuery / AdminCatalogQuery  (JdbcClient native SQL)
        ├─ LlmLogRepository   (feature/llmlog)  → cost aggregates, feature/model/user grouping
        └─ AppUserRepository  (feature/auth)    → users, status, existing Admin invite/account API
```

**Why native SQL in one slice, not ten.** The browser and the footprint counters must work for
every owned table, including ones added later, without touching every feature slice for each new
table. `AdminTableCatalog.load()` reads `information_schema.columns`/`.key_column_usage` once
(cached, `refresh()`-able) and is the single source of truth for what is browsable — see §9 for
the rejected alternatives.

**FE data layer** (`frontend/src/data/admin/`): `adminInsights{Api,Hooks,Mock}.ts` and
`adminData{Api,Hooks,Mock}.ts` sit beside the pre-existing `admin{Api,Hooks,Mock}.ts`
(invites/accounts). Every hook is `useDualQuery` with `enabled: isOwner` and an explicit
`realStaleTime: DEFAULT_QUERY_STALE_TIME_MS` (an omitted value would overwrite the client default
and leave the query permanently stale — `useDualQuery.ts:36-45`). `useAdminRows` additionally
sets `keepPreviousRealData: true` so paging/sorting/toggling "Törölt sorok" never blanks the
table for the width of a round-trip, and folds `params.table === ''` (every picker on this
surface starts unselected) into `enabled` rather than leaving it for the caller. All reads and
mutations barrel through `@/data/hooks`; MSW handlers for every new path live in
`frontend/src/test/msw/handlers.ts`.

## 4. Data model & API

No new tables. `AdminProperties` (`@ConfigurationProperties(prefix = "mezo.admin")`) carries
`reportZone` (`Europe/Budapest` — the zone every day-bucketing expression in this slice shifts
into before grouping), `browser.maxPageSize` (200) and `featureMap` (`Map<String,
FeatureSource(table, timestampColumn)>`) — the non-LLM feature → (owned table, timestamp/date
column) map, e.g. `train` → `workout_session.started_at`, `food` → `meal.logged_at`, `sleep` →
`sleep_log.date`, `journal` → `journal_entry.occurred_on`, `habits` → `habit_day.habit_date`,
`water` → `water_log.log_date`, `weight` → `weight_log.date`. LLM-backed features come from
`llm_log_history.feature` instead; a feature appears in the usage matrix if it is in either
source.

**Contracts** — the pre-existing `api/feature/admin/admin.yml` (tag `Admin`) is unchanged; two
new fragments:

`api/feature/admin-insights/admin-insights.yml` (tag `AdminInsights` → `AdminInsightsApi`):

| Op | Path | → |
|---|---|---|
| `getAdminOverview` | `GET /api/admin/overview` | `AdminOverviewResponse{userCount, activeToday/7d/30d, loggedToday{domain→count}, costTodayUsd, memoryItemCount, vectorCount, activeUserSeries, domainSeries, costSeries}` |
| `listAdminUserInsights` | `GET /api/admin/users-insight?q=&sort=&dir=` | `AdminUserInsightResponse[]` — identity fields + `rowCount, vectorCount, cost30dUsd, activeDays30d, lastActivityAt` |
| `getAdminUserInsight` | `GET /api/admin/users/{id}/insight` | `AdminUserDetailResponse{user, activitySeries, inventory: AdminTableFootprint[], featureUsage30d, costByFeature30d}` (404 `ADMIN_USER_NOT_FOUND`) |
| `getAdminFeatureUsage` | `GET /api/admin/usage/features?period=7d\|30d\|90d` | `AdminFeatureUsageResponse{period, days, features: AdminDaySeries[]}` |
| `getAdminCostMatrix` | `GET /api/admin/usage/cost-matrix?period=` | `AdminCostMatrixResponse{period, users, features, cells: AdminCostMatrixCell[], totalUsd}` — a cell's `userId: null` is the `Háttér` bucket |

`api/feature/admin-data/admin-data.yml` (tag `AdminData` → `AdminDataApi`):

| Op | Path | → |
|---|---|---|
| `listAdminTables` | `GET /api/admin/data/tables` | `AdminTableListResponse{tables: AdminTableDescriptor[]}` — name, `ownerColumn` (`created_by`, or `id` for `app_user`), `softDeletable`, columns (name/type/`foreignKey`/`referencesTable`) |
| `listAdminViews` | `GET /api/admin/data/views` | `AdminViewDescriptor[]` — id, label, table, `defaultSort`, `defaultDir` |
| `getAdminTableRows` | `GET /api/admin/data/tables/{table}/rows?userId=&page=&size=&sort=&dir=&includeDeleted=` | `AdminRowPageResponse{table, page, size, total, columns, rows: object[]}` — `size` **clamped** to `maxPageSize`, never rejected |

Every operation on both new tags is 401/403 (`AUTH_FORBIDDEN`) like the rest of the platform;
`getAdminTableRows` additionally 400s (`ADMIN_TABLE_UNKNOWN` / `ADMIN_COLUMN_UNKNOWN`) on an
unrecognized name and 504s (`ADMIN_QUERY_TIMEOUT`) on a statement-timeout cancellation.

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
transaction (`AdminRowQuery`, `SET LOCAL` only affects the current transaction); Postgres
SQLSTATE `57014` (statement-timeout cancellation) is translated to `QueryTimeoutException` →
`ADMIN_QUERY_TIMEOUT` (504) rather than a generic 500.

**The cost matrix's opinionated bits** (`AdminUsageService`, `mezo-qw37.3`/`mezo-d5iy.6`): a null
`created_by` is real cost (cron/stream traffic) reported as a single synthetic user labelled
`"Háttér"` with a null id — never dropped, never merged into a named user;
`status = ERROR` rows are excluded entirely (a failed call is not cost); a row with a null
`cost_usd` is counted into `unknownCalls`, never folded into the sum as zero.

## 5. Integrations

- **← auth**: `CurrentUser.requireOwner()` is the whole authorization story for every endpoint in
  all three admin tags — see [`_platform-auth-security.md`](_platform-auth-security.md) §4's
  *Ownership exception* and [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md).
  `AppUserRepository` supplies user identity/status for both the existing account console and
  the new insights.
- **← llmlog**: `LlmLogRepository` aggregations feed today's cost, the cost matrix, and the
  `Háttér` bucket; `LlmActorContext`/`UserFanOut` (S6, `mezo-qw37.6`) are what make a cron-driven
  LLM call attributable to a user instead of landing in `Háttér` in the first place — see
  [`_platform-auth-security.md`](_platform-auth-security.md) §4.
- **← every owned-table slice, implicitly**: `AdminTableCatalog` discovers any table with a
  `created_by` column through `information_schema`, so a new feature's table becomes browsable
  and counted in the overview/footprint without a code change here — the trade the native-SQL
  approach was chosen for (§9).
- **me**: the Beállítások admin row now links to `/admin` instead of opening a `/me/*` page; the
  two moved pages (`AdminAccountsPage`, `AdminCostPage`/`AdminCostDetailPage`) keep their
  original mobile-shaped bodies.
- **companion / llmlog (`mezo-ozri.5`)**: `AiUsageHero` carries a THIRD figure beside the call
  count and the estimated cost — the prompt-cache hit ratio, `N% gyorsítótárból`, computed as
  `LlmUsageTotals.cachedTokens / promptTokens` (raw provider counts; cached is a SUBSET of prompt,
  summed by `LlmLogRepository.aggregateByStatusSince`). Cached input bills at a tenth of the normal
  rate, so this is the number that says whether the stable-prefix prompt order is paying off — see
  [`companion.md`](companion.md) §3 "Prompt assembly" for the split it measures. A period whose rows
  reported no prompt token HIDES the figure rather than showing 0%: no data and no hits are
  different statements.
- **design system**: `AdminLayout`/`AdminRail`/`MosaicDesktop` extend the shared
  `mozaik`/`clay` kit (`frontend/src/shared/ui/{mozaik,clay}`) for a wider, desktop 12-column
  canvas rather than forking it — see [`_platform-design-system.md`](_platform-design-system.md).

## 6. How to use it (consume)

```ts
import {
  useAdminOverview, useAdminUserInsights, useAdminUserDetail,
  useAdminFeatureUsage, useAdminCostMatrix,
  useAdminTables, useAdminViews, useAdminRows,
  useAdminInvites, useAdminUsers, useAdminActions, useMe,
} from '@/data/hooks'

const isOwner = useMe().data?.role === 'OWNER'
const { data: overview, isPending, isError, refetch } = useAdminOverview(isOwner)
const { data: rows } = useAdminRows({ table: 'workout_session', page: 0, size: 50 }, isOwner)
```
Every hook takes (or closes over) `isOwner` and passes it straight through as `enabled` — a
non-owner never fires an admin request even if a page somehow renders for one. Backend: any
owner-only endpoint starts with `currentUser.requireOwner()`, called from the controller layer
(never inside an already-open `@Transactional` method — it issues a `last_seen_at` write, per
`CurrentUser`'s class Javadoc).

## 7. How to extend it

- **A new insights field or matrix**: contract-first in `admin-insights.yml` →
  `npm run generate:api` + `pnpm generate:api` → `AdminOverviewService`/`AdminUserService`/
  `AdminUsageService` method → `AdminInsightsController` override (gate first) → IT under
  `feature/admin/controller/` → `adminInsightsApi`/`adminInsightsHooks`/mock seed → MSW handler →
  page → both-mode tests → this doc §4/§10.
- **A new browsable table**: nothing to do — `AdminTableCatalog` picks up any table with a
  `created_by` column automatically on the next cache load (`refresh()` after a migration, or a
  restart). Add a convenience view only if the table deserves a named shortcut
  (`AdminConvenienceViews.VIEWS`).
- **A new non-LLM feature in the usage matrix**: add one entry to `mezo.admin.feature-map` in
  `application.yml` (`table` + `timestampColumn`) — no code change.
- **A new LLM feature**: nothing to do — it appears the moment a row with that `feature` label
  lands in `llm_log_history`.

## 8. Testing

Backend (`-Dmezo.test.use-testcontainers=true`, Testcontainers `pgvector/pgvector:pg16`):
`AdminOverviewIT`, `AdminUserDetailIT`, `AdminUserInsightIT`, `AdminUsageIT` (feature matrix +
cost matrix, `Háttér` bucket, `ERROR` exclusion, `unknownCalls`), `AdminDataBrowserIT` (allowlist
rejection on table/column/excluded-column, soft-delete toggle, page-size clamp, statement
timeout), `AdminPropertiesTest`, `AdminTableCatalogIT` (the `information_schema` inventory
against the `ResetDatabase` TRUNCATE list, guarding against a silently un-browsable new table),
plus the pre-existing `AdminInviteIT`/`AdminUserIT` (invites/accounts) and
`LlmUsageControllerIT`/`LlmActorContextTest`/`LlmActorResolverTest`. Every new endpoint has a
non-owner 403 case. `ArchitectureTest` (full `./mvnw test` only — focused `-Dtest=` runs skip
it) enforces `feature/admin`'s layer packages and the cycle-free dependency direction
(`admin → llmlog, auth`; nothing depends on `admin`).

Frontend (both `pnpm test` [mock] and `VITE_USE_MOCK=false pnpm test` [real] — see the
`AGENTS.md` Build & Test gate for why the flag direction matters): a render test per admin page
in both modes, redirect tests for the two moved routes and the non-owner bounce, plus the
pre-existing `adminHooks.test.tsx`, `AdminAccountsPage.test.tsx` (renamed from
`BetaAdminPage.test.tsx`), `AiCallFilters/AiCallRow/AiFeatureBreakdown/AiModelBreakdown/
AiUsageHero/AiUserFilter.test.tsx`, `AdminLayout.test.tsx`, `Sparkline.test.tsx`,
`adminInsightsHooks.test.tsx`, `hooks.reexport.test.ts`, `dualMode.guard.test.ts`.

**Gates**: contract-drift (`api/openapi.yml` + `api.gen.ts` committed), codemap regeneration
(`node scripts/gen-codemap.mjs`), visual goldens for the new desktop mosaic surfaces.

## 9. Decisions, gotchas & deferred

- **Read-only in v1, no export, no new role** — see [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md)
  for the full rationale and the rejected alternatives (per-feature admin aggregator services,
  Liquibase `admin_*` views, a separate admin SPA).
- **The consent behind this whole slice is time-boxed to the beta.** ADR 0038 must be revisited
  before general availability, not treated as a permanent schema-level exception like the shared
  catalogs (`exercise_catalog`/`pantry_catalog`).
- **`useLlmUsageSummary` no longer mounts for a `USER`** — this doc's predecessor (`beta-admin.md`)
  carried an open item claiming it still fired unconditionally on Beällítások for a plain
  account; `useDualQuery`'s `enabled: isOwner` on that hook already closed it before this task.
- **The two moved pages are a move, not a rewrite** (v1 judgement call, Task 13): `AiUsagePage`/
  `AiCallDetailPage`/`BetaAdminPage` keep their original mobile-shaped bodies under new names
  (`AdminCostPage`, `AdminCostDetailPage`, `AdminAccountsPage`) and new routes; giving them the
  desktop mosaic treatment is a follow-up, not required for v1.
- **`pgvector` columns and credential-shaped columns are dropped from the catalog, not just
  hidden** — they cannot be selected, sorted, or filtered on at all, the same defence-in-depth
  posture as the identifier allowlist itself.
- **Page size is clamped, not rejected** — an oversized `size` silently becomes
  `maxPageSize` (200) rather than a 400, since a slightly-too-eager UI request shouldn't error.
- **Deferred (own specs/issues, per the design spec's Follow-ups):** a free-form SQL box
  (SELECT-only Postgres role, second read-only datasource); the RAG explorer — **now shipped**,
  see [`admin-memory-explorer.md`](admin-memory-explorer.md) (part 2 of the admin/observability
  series, launched from a user's "Memória" tab); infra observability — done separately, see
  [ADR 0037](../decisions/0037-observability-stack-victoriametrics.md); feature telemetry (part 4,
  only if screen-level behavior tracking is ever needed); byte-level per-user footprint if row
  counts stop being enough signal.

## 10. Key files

- Contracts: `api/feature/admin/admin.yml`, `api/feature/admin-insights/admin-insights.yml`,
  `api/feature/admin-data/admin-data.yml`, `api/generate/merge.yml`
- Backend: `feature/admin/controller/{AdminInsightsController,AdminDataController}.java`,
  `feature/admin/service/{AdminOverviewService,AdminUserService,AdminUsageService,
  AdminDataBrowserService,AdminTableCatalog,AdminSqlDialect,AdminConvenienceViews,
  AdminSeries}.java`, `feature/admin/repository/{AdminInsightsQuery,AdminRowQuery,
  AdminCatalogQuery}.java`, `feature/admin/config/AdminProperties.java`,
  `techcore/configuration/FeaturesConfiguration.java` (`ADMIN_INSIGHTS_SWITCH`); pre-existing
  `feature/auth/{service/AdminService,controller/AdminController}.java`,
  `feature/llmlog/{controller/LlmUsageController,service/LlmUsageService}.java`,
  `techcore/security/LlmActorContext.java`
- Backend tests: `feature/admin/config/AdminPropertiesTest.java`,
  `feature/admin/controller/{AdminDataBrowserIT,AdminOverviewIT,AdminUsageIT,
  AdminUserDetailIT,AdminUserInsightIT}.java`, `feature/admin/service/AdminTableCatalogIT.java`,
  `feature/auth/{AdminInviteIT,AdminUserIT}.java`,
  `feature/llmlog/controller/LlmUsageControllerIT.java`
- Frontend: `features/admin/{AdminLayout,AdminRail,adminRoutes}.tsx`,
  `features/admin/components/{AdminTile,DataTable,JsonCell,MatrixGrid,Sparkline,TablePicker,
  UserPicker,Ai*}.tsx`, `features/admin/pages/{AdminOverviewPage,AdminUsersPage,
  AdminUserDetailPage,AdminUsagePage,AdminDataPage,AdminCostPage,AdminCostDetailPage,
  AdminAccountsPage}.tsx`, `data/admin/{adminApi,adminHooks,adminMock,adminInsightsApi,
  adminInsightsHooks,adminInsightsMock,adminDataApi,adminDataHooks,adminDataMock}.ts`,
  `app/router.tsx` (redirects), `test/msw/handlers.ts`
- Docs: this file, [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md),
  [`_platform-auth-security.md`](_platform-auth-security.md) §4,
  `docs/superpowers/specs/2026-09-06-admin-hub-design.md`
