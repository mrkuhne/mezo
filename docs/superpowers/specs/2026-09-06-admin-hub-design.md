# Admin hub — design spec (mezo-d5iy)

- **Issue:** mezo-d5iy · **Date:** 2026-09-06 · **Round:** superpowers:brainstorming + brainstorm-recon
- **Prototype (to be drawn in slice 3):** `docs/design_2.0/prototypes/admin-hub.html`
- **Series:** part 1 of the admin/observability platform. Agreed order: **admin hub → RAG explorer
  → infra observability (VictoriaMetrics/VictoriaLogs/Grafana) → feature telemetry**. Each part gets
  its own spec; this one covers the admin hub only.

## Problem

During the beta the owner needs to see, without opening pgAdmin: how many users there are, who
they are, what they do and how often, how much data each of them holds, which features they use,
and how much LLM cost they generate. The pieces that exist today are scattered owner-only pages
inside the mobile app (`me/beallitasok/admin`, `me/ai-usage`) and cover only invites/accounts and
LLM cost. There is no per-user activity or data-volume view, no feature-usage view, and no way
to browse a user's rows.

Beta testers have signed consent to admin visibility of their data for the duration of the beta,
so cross-user reads are an explicit, documented product decision (see *Ownership exception* in
`docs/features/_platform-auth-security.md` §4 for the precedent).

## Product decisions (Daniel, 2026-09-06)

1. **Placement — option C:** an `/admin/*` route family inside the existing React app, with its
   own chrome (`AdminLayout`, no TabBar), loaded as one lazy chunk. Not a separate SPA: same
   build, same auth, no new deploy unit or ingress. The mobile PWA never downloads the chunk.
2. **Desktop-first, full width.** The admin is used on a laptop. Same design 2.0 language, wider
   canvas (12-column mosaic). Not optimised for phones.
3. **Role:** the existing `OWNER` role gates everything. No new `ADMIN` role.
4. **Read-only.** v1 edits nothing on another user's behalf. The existing account actions
   (status toggle, password reset, invites) are the only writes and stay as they are.
5. **No export** in v1.
6. **Feature usage without telemetry.** Derived from the domain tables (what was logged when),
   plus the `llm_log_history` feature labels. A general event log is part 4 of the series and may
   never be needed.
7. **Data browser now, free SQL later.** A generic read-only table browser with "convenience
   views" ships in this spec. A free-form SQL box is a follow-up slice that requires a SELECT-only
   Postgres role and a second datasource (see *Follow-ups*).
8. **The two existing owner pages move** under `/admin`; the old routes redirect.
9. **On-demand computation.** No nightly snapshot tables at beta scale. The overview page is the
   one place that reads many tables at once; if it ever slows down, it gets a materialized view.

## Architecture

```
/admin/*   React lazy chunk · AdminLayout (left rail + full-width mosaic) · no TabBar
   │  same JWT bearer client as the app
   ▼
/api/admin/**   generated AdminApi (existing) + AdminInsightsApi + AdminDataApi (new)
   │  first line of every controller method: currentUser.requireOwner()
   ▼
feature/admin (NEW backend slice)
   ├─ AdminOverviewService      installation-wide counters + 30-day series
   ├─ AdminUserService          user list with footprint, user detail
   ├─ AdminUsageService         feature × day matrix, user × feature cost matrix
   └─ AdminDataBrowserService   information_schema-driven read-only row browser
        ├─ JdbcClient native SQL over the owned tables (allowlisted names)
        ├─ LlmLogRepository   (feature/llmlog)  → cost aggregates
        └─ AppUserRepository  (feature/auth)    → users, status
```

Dependency direction: `admin → llmlog, auth`. Nothing depends on `admin`, so the frozen
`feature_slices_are_cycle_free` ArchUnit rule is untouched. The existing `AdminController` /
`AdminService` (invites, accounts) stay in the `auth` slice; only their frontend moves.

### Why native SQL in one slice (approach A)

- The browser and the footprint counters must work for **every** owned table, including ones
  added later, without touching ten feature slices. `information_schema.columns where
  column_name = 'created_by'` is the inventory; the `ResetDatabase` TRUNCATE list
  (`docs/CODEMAP.md` §ResetDatabase) is the cross-check.
- Rejected B (per-feature admin aggregator services): typed and clean but ten slices to touch
  and every new table is manual work. Rejected C (Liquibase `admin_*` views): pushes logic into
  migrations that are hard to test here and cannot power a generic browser.
- Trap accepted knowingly: native SQL bypasses JPA's `@SQLRestriction` soft-delete filter.
  Every query therefore carries an explicit `is_deleted = false` unless `includeDeleted=true`
  is requested — which is also a feature: the admin can see reaped rows on demand.

## Backend contract

New fragments `api/feature/admin-insights/admin-insights.yml` (tag `AdminInsights`) and
`api/feature/admin-data/admin-data.yml` (tag `AdminData`), both appended to
`api/generate/merge.yml`. The existing `api/feature/admin/admin.yml` (tag `Admin`) is unchanged.

| Endpoint | Returns |
|---|---|
| `GET /api/admin/overview` | `userCount`, `activeToday/7d/30d` (by `last_seen_at`), per-domain "logged today" counts (train, food, sleep, journal, habits, chat turns), `costTodayUsd`, `memoryItemCount`, `vectorCount`, and 30-day daily series for active users, logs per domain, cost |
| `GET /api/admin/users?q=&sort=&dir=` | existing `AdminUserResponse` fields + `rowCount`, `vectorCount`, `cost30dUsd`, `activeDays30d`, `lastActivityAt` |
| `GET /api/admin/users/{id}` | 90-day activity series (per domain per day), data inventory (`table`, `rowCount`, `deletedCount`, `lastCreatedAt`), feature usage 30d, cost by feature 30d |
| `GET /api/admin/usage/features?period=7d\|30d\|90d` | feature × day counts, LLM and non-LLM features in one matrix, plus totals |
| `GET /api/admin/usage/cost-matrix?period=` | user × feature `cost_usd` sums; a synthetic **"Háttér"** user column for rows with null `created_by` (cron/stream); `status='ERROR'` rows excluded from sums; null `cost_usd` reported as `unknownCalls`, never as 0 |
| `GET /api/admin/data/tables` | browsable tables and their columns (name, type, `isForeignKey`, `referencesTable`), from `information_schema` filtered to tables that have a `created_by` column, minus the exclusions below |
| `GET /api/admin/data/tables/{table}/rows?userId=&page=&size=&sort=&dir=&includeDeleted=` | paginated rows (`size` ≤ 200), jsonb returned as raw JSON, `total` count |
| `GET /api/admin/data/views` | the convenience views: id, label, table, default sort, optional fixed filter |

**Exclusions (never browsable):** `app_user.password_hash` (and any column whose name matches
`password|secret|token|hash`), plus all non-owned tables except `app_user` and `llm_log_history`
(which have a userId filter path via `id` / `created_by` respectively). `invite`'s secret column
is `code`, not `token`; it is deliberately NOT excluded because the owner-facing Admin API already
returns it (`InviteResponse.code`) so the owner can send it on to a beta tester.

**Convenience views (v1):** mezociklusok (`mesocycle`), edzések (`workout_session`, by
`started_at desc`), gyakorlatok (`exercise_set`, joined display of exercise name), minták
(`pattern` + `pattern_event`), LLM-history (`llm_log_history` by `created_at desc`),
memória-elemek (`memory_item`). Declared in code as a list, not in the DB.

**Feature-usage map (config, `mezo.admin.feature-map`):** a `@Validated` properties record
mapping feature key → (table, timestamp column). Initial entries, column names to be confirmed
against the schema at plan time: `train` → `workout_session.started_at`,
`food` → `meal.logged_at`, `sleep` → `sleep_log.date`, `journal` → `journal_entry.created_at`,
`habits` → `habit_day.date`, `water` → `water_log.created_at`, `weight` → `weight_log.created_at`.
LLM-backed features come from `llm_log_history.feature` (30 labels already in use, e.g.
`companion_chat`, `companion_recall`, `meal_draft`, `train_meso_plan`). A feature appears in the
matrix if it is in either source.

**Data volume definition:** row count per owned table per `created_by`, `is_deleted = false` by
default, plus `memory_vector` + `memory_embedding` counts reported separately as the RAG
footprint. No byte estimate in v1 — Postgres cannot attribute bytes to a user cheaply.

**Safety of dynamic SQL:** table and column identifiers never come from the request into SQL.
The request names are matched against the allowlist loaded from `information_schema` (cached,
refreshed on demand); sort columns must exist in that table; page size is capped; every
`JdbcClient` call runs with `SET LOCAL statement_timeout = '5s'`. Unknown names → 400 with
`ADMIN_TABLE_UNKNOWN` / `ADMIN_COLUMN_UNKNOWN` (`SystemMessage`, `messages.properties`).

**Config:** `mezo.feature.admin-insights.enabled` (registered in `FeaturesConfiguration`,
default off, explicitly `true` in `k8s/backend/deployment.yaml`), `mezo.admin.feature-map.*`,
`mezo.admin.browser.max-page-size` (200).

## Frontend

### Routes (`frontend/src/app/router.tsx`, full-screen sibling idiom, one `lazy()` import)

```
/admin                → Áttekintés
/admin/users          → Userek
/admin/users/:id      → User részlet (tabs: Aktivitás · Adatok · Feature-ök · Költség)
/admin/usage          → Feature-használat
/admin/cost           → LLM költség       (AiUsagePage + AiCallDetailPage moved)
/admin/data           → Adatböngésző     (user + table picker, or a convenience view)
/admin/accounts       → Meghívók és fiókok (BetaAdminPage moved)
me/beallitasok/admin  → redirect /admin/accounts
me/ai-usage(/…)       → redirect /admin/cost(/…)
```

`AdminLayout`: left rail with clay icons (one per section), full-width content, no TabBar.
A non-OWNER hitting `/admin` gets the standard 403 toast (`handleAuthFailure`, never a sign-out)
and is sent to `/`. The backend is the real gate; the UI check (`useMe().data?.role === 'OWNER'`)
is cosmetic. The "Admin" entry in `BeallitasokPage` now points at `/admin`.

### Design 2.0 on a desktop canvas

Same language, wider canvas: a 12-column mosaic where tiles span 3/4/6/12, poster anatomy kept
(eyebrow + spot graphic + one big numeral), domain-colour washes per section, two-layer shadows,
one-shot entrance choreography. Áttekintés is StatCells + sparklines only. The data browser is
the single tabular surface: dense rows inside a tile, jsonb cells expand on click, FK cells
link to the referenced row. The prototype `admin-hub.html` is drawn first (slice 3) so the
desktop grid is designed once before it becomes components; the shared kit gains a
`MosaicDesktop` (12-col) wrapper rather than forking the mobile `Mosaic`.

### Data layer

`frontend/src/data/admin/` grows `adminInsights{Api,Hooks,Mock}.ts` and
`adminData{Api,Hooks,Mock}.ts`; types from `api.gen.ts` `components['schemas']`; every read via
`useDualQuery` with `enabled: isOwner`; barrel re-export in `data/hooks.ts`; MSW handlers for
every new path in `frontend/src/test/msw/handlers.ts`; `dualMode.guard` stays green.

## Error handling

- Backend: unknown table/column → 400 `ADMIN_*`; oversized page → clamped, not rejected;
  statement timeout → 504 with `ADMIN_QUERY_TIMEOUT`; non-owner → 403 `AUTH_FORBIDDEN` (existing).
- Frontend: per-tile error state (tile shows "nem elérhető" with retry) rather than a page-level
  failure, since the overview is many independent queries.

## Testing

- **Backend ITs** (Testcontainers `pgvector/pgvector:pg16`, `-Dmezo.test.use-testcontainers=true`):
  allowlist rejection (table, column, excluded column), soft-delete toggle, page-size clamp,
  "Háttér" bucket and ERROR exclusion in the cost matrix, feature map picks up a row logged
  today, non-owner 403 on every new endpoint, `information_schema` inventory equals the
  `ResetDatabase` list minus documented exclusions (guards against silently missing tables).
- **ArchUnit** runs in plain `./mvnw test` (focused `-Dtest=` runs skip it — run the full
  command once before the PR).
- **Frontend:** render test per page in both `VITE_USE_MOCK=true` and `=false`, redirect tests
  for the two moved routes, non-owner redirect test.
- **Gates:** contract-drift (`api/openapi.yml` + `api.gen.ts` committed), codemap regeneration
  (`node scripts/gen-codemap.mjs`) — a new backend package and a new `features/admin` dir both
  change the map.

## Slices

1. **Backend insights** — `feature/admin` slice, `AdminInsightsApi` contract, overview / users /
   user detail / usage endpoints, feature map config, ITs.
2. **Backend data browser** — `AdminDataApi`, information_schema inventory, allowlist, paging,
   convenience views, ITs.
3. **Prototype + shell + core pages** — `admin-hub.html` prototype, `AdminLayout`, `MosaicDesktop`,
   Áttekintés, Userek, User részlet.
4. **Data browser UI** — `/admin/data`, table/user picker, convenience views, jsonb/FK cells,
   embedded as the "Adatok" tab of User részlet.
5. **Move + docs** — AiUsage and BetaAdmin pages under `/admin`, redirects, `beta-admin.md`
   → `admin-hub.md` (10-section feature doc), codemap, `_platform-auth-security.md` ownership
   exception note, ADR for the cross-user read decision.

## Follow-ups (own specs / issues)

- **Free SQL box:** SELECT-only Postgres role via Liquibase, second read-only datasource,
  `statement_timeout`, row cap, results in the same table view.
- **RAG explorer** (part 2 of the series): launched from `/admin/users/:id` → "Memória" tab.
- **Infra observability** (part 3): VictoriaMetrics k8s-stack + VictoriaLogs + Grafana behind
  Tailscale; `/actuator/prometheus` on a separate management port, cluster-internal only.
- **Feature telemetry** (part 4): only if screen-level behaviour is needed.
- **Byte-level footprint** per user if the beta grows beyond what row counts explain.

## Prior art

Researcher report (2026-09-06), filtered:

- **Adopted — admin as an in-app owner-scoped route, Grafana for infra only.** The per-user
  activity, data-volume and cost views need joins on application tables that already sit in
  Postgres; an in-app route keeps the design 2.0 language and reuses auth. Grafana stays for
  infrastructure and aggregate metrics (part 3).
- **Adopted — Langfuse's data model, not its deployment.** Langfuse's trace → generation →
  usage → cost grouping by `user_id`/feature is the reference shape for the cost matrix; mezo's
  `llm_log_history` already holds exactly those columns, so no new store.
  https://langfuse.com/self-hosting
- **Adopted for part 3 — OTel GenAI conventions:** token/duration histograms keyed by feature
  and model, never by user (cardinality). Per-user cost stays a DB row.
  https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-metrics.md
- **Rejected — self-hosted Langfuse** (six services, ClickHouse ≥ 2 GB) on an 8 GB node.
- **Deferred to part 3 —** `victoria-metrics-k8s-stack` with VLSingle/VLAgent as the metrics +
  logs stack (~1–1.5 GB) over kube-prometheus-stack (1.5–3 GB) or Loki+Alloy (~0.7 GB, higher
  query latency). https://docs.victoriametrics.com/helm/victoria-metrics-k8s-stack/ ,
  https://blog.rommelporras.com/loki-alloy/
- **Deferred to part 2 —** UMAP-projected embeddings + `react-force-graph` with pinned
  coordinates for the RAG explorer. https://github.com/vasturiano/react-force-graph/issues/522

## Codebase terrain

Investigator report (2026-09-06), filtered to what this spec touches:

- **Roles / gate:** `AppUserEntity` `UserRole { OWNER, USER }`; `CurrentUser.requireOwner()` is
  the whole authorization story and must be called from the controller layer, never inside a
  `@Transactional(readOnly)` method (it issues a `touchLastSeen` UPDATE). `SecurityConfig` has no
  role URL rules. Owner seed: `OwnerSeedData` (`demodata` profile).
- **Existing owner surfaces to move:** `frontend/src/features/me/pages/BetaAdminPage.tsx`
  (route `me/beallitasok/admin`), `AiUsagePage.tsx` + `AiCallDetailPage.tsx` + `components/Ai*`
  (route `me/ai-usage`); data in `frontend/src/data/admin/` and `data/me/llmUsage*`.
- **Cost source:** `feature/llmlog` — `LlmLogEntity` (`llm_log_history`, `created_by` nullable,
  `feature`/`operation` attribution, `cost_usd numeric(12,6)`, camelCase `pricing_snapshot`
  jsonb), `LlmLogRepository.aggregateBy{Feature,Model,User}Since`, `LlmUsageService`. A
  user × feature matrix is one new `@Query`. Null `created_by` rows are real cost (cron) →
  "Háttér" bucket (`docs/features/beta-admin.md` §9).
- **Per-user footprint:** every owned table extends `OwnedEntity` (`created_by`, `is_deleted`,
  `created_at`); the `ResetDatabase` TRUNCATE list in `docs/CODEMAP.md` is the 107-table
  inventory. `memory_vector` / `memory_embedding` (`vector(768)`) give the RAG footprint.
- **Contract chain:** fragment under `api/feature/<x>/` → append to `api/generate/merge.yml` →
  `npm run generate:api` → `pnpm generate:api` → backend `openapi-generator-maven-plugin`
  emits `<Tag>Api`; ArchUnit rejects any `@RestController` not implementing a generated Api.
- **Patterns to follow:** owner-less reads for installation-wide data (`LlmLogRepository`
  precedent); `@Validated *Properties` records under `mezo:` (never `@Value`); feature switches
  in `FeaturesConfiguration` + `@ConditionalOnProperty`; errors via
  `SystemRuntimeErrorException` + `SystemMessage`; FE page scaffold
  `MozaikPage/PageHead/PageHero/PageBody` + `EntranceGroup`; `useDualQuery` with `enabled`.
- **Traps:** ArchUnit stereotype packages + no field injection + no class-level
  `@Transactional`; contract-drift gate; codemap gate; `VITE_USE_MOCK` unset ⇒ mock (run both
  modes explicitly); ITs need `-Dmezo.test.use-testcontainers=true`; `GraphController` and
  similar are `@ConditionalOnProperty` — a disabled feature is a 404, not an error; the TabBar is
  fixed at five tabs (ADR 0032) so admin is a hidden route family, not a sixth tab.
- **Staleness found in passing (fix in slice 5 docs pass):** `beta-admin.md` §open-items claims
  `useLlmUsageSummary` still mounts for USER — `useDualQuery.enabled` already fixed it;
  `k8s/pgadmin/*.yaml` comments still say "no Ingress" although the Tailscale ingress exists;
  the deployment doc topology says CX32 while the live table says CX33.
