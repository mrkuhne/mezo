# Admin value dashboard — Slice 3: Funkciók backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The value-analytics backend: `GET /api/admin/features` (scorecard), `GET /api/admin/features/{key}` (detail), `GET /api/admin/feedback/summary` — joining usage, feedback, cost and reliability per feature — plus the artifact-kind↔feature-slug mapping config. FE data layer included; UI is slice 4.

**Architecture:** Three new ops on the `AdminInsights` contract, implemented in `AdminInsightsController`, delegating to a new `AdminFeatureService`. Data comes from: `LlmLogRepository` existing aggregates (+ two new grouped queries: per-feature-per-user usage, per-feature p90 latency via `percentile_cont`), `AdminInsightsQuery`-style catalog-quoted counts for the 7 domain features, and net-new live aggregates over `message_feedback` / `memory_retrieval_feedback` (the nightly `feedback_rollup` is per-user, snapshot-only and misses two kinds — unusable here). The artifact↔slug map is admin config with the 7 verified pairs as defaults. Companion-gated panels skip via the slice-1 `CompanionFeatureFlag` in-method.

**Tech Stack:** Spring Boot 4 / Java 21, OpenAPI codegen, JPA `@Query` + `NamedParameterJdbcTemplate` native SQL, Testcontainers pgvector ITs.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` §3 Funkciók + §6.3. Epic **mezo-l096**.

## Global Constraints

- `currentUser.requireOwner()` first statement, outside transactions; ops join `AdminInsightsController` (existing `@ConditionalOnProperty` gate).
- All day/week bucketing in `properties.reportZone()`; weeks are ISO weeks.
- Native SQL: fixed identifiers (or `AdminSqlDialect`-quoted catalog names for featureMap tables); values bound; `applyStatementTimeout` first inside the read-only transaction; explicit `is_deleted = false` on every native read of soft-deleted tables (`message_feedback`!).
- `llm_log_history`: ERROR rows excluded from cost/usage sums but included in error-rate denominators; null `cost_usd` → `unknownCalls`; null `created_by` → excluded from adoption/user counts (cron traffic is not a user) but kept in cost totals as the Háttér bucket.
- Companion switch off → feedback + recall panels are `null`s, endpoints still 200 (in-method `CompanionFeatureFlag` skip; IT proves it).
- Focused local tests only (`./mvnw test -Dtest=<IT> -Dmezo.test.use-testcontainers=true`); NEVER the full backend suite locally; contract-drift + codemap gates; commits carry the Task-0 id.
- Branch `feat/admin-slice3-features-backend` off main AFTER slice 2 merges.

## Rulings (bind the implementer)

- **Helped-ratio = current state** (live `message_feedback` rows per mapped feature: up count, down count). **Feedback trend = bucketed on `updated_at`** ("legutóbbi vélemények" semantics — a flipped vote re-dates; documented in the service javadoc and the yml description).
- **Funnel definitions:** tried = ≥1 use in 90d; repeated = uses on ≥2 distinct days; habit = active in ≥3 of the last 4 ISO weeks. Computed per user from the per-feature-per-user usage query (LLM side) or the domain-table equivalent.
- **Acceptance column ships as `null`** for every feature until slice 8's `ai_draft_outcome` exists — the contract carries the field now (`acceptedShare: number|null, nullable`), the service returns null, the yml description says why.
- **Verbatim artifact samples are OUT** (joining 7 artifact tables generically is not worth it now) — file a bd follow-up; the detail endpoint returns aggregates only.
- **Scorecard row set** = union of the feature-map domain keys and every feature slug seen in `llm_log_history` in the period; `unknown` and `admin_replay` rows included but flagged `kind: system` so the UI can de-emphasize.

---

### Task 0: Branch + bd bookkeeping

- [ ] `bd create --title="admin slice 3: Funkciók backend — scorecard, detail, feedback summary" --type=task --priority=1` → `<ID>`; claim; `git checkout main && git pull --rebase && git checkout -b feat/admin-slice3-features-backend`.

### Task 1: Contract + mapping config + skeletons

**Files:** `api/feature/admin-insights/admin-insights.yml` (+regenerated files), `AdminProperties.java` (+`artifactFeatureMap`), `application.yml`, `AdminInsightsController.java`, new `AdminFeatureService.java` (skeleton), `AdminPropertiesTest`.

**Interfaces (binding names):**
- `GET /api/admin/features?period=30d|90d` → `AdminFeatureBoardResponse { period, rows: AdminFeatureRow[] }`; `AdminFeatureRow { key, kind: enum[ai,domain,both,system], uniqueUsers, usesPerWeek: int[] (12, oldest→newest), habitUserShare: number, helped: {up:int, down:int}|null, acceptedShare: number|null, costUsd, costPerUse: number|null, unknownCalls: int, errorPct: number|null, p90LatencyMs: int|null, screenViews: int|null }`
- `GET /api/admin/features/{key}?period=` → `AdminFeatureDetailResponse { key, kind, usageByWeek: int[], funnel: {tried:int, repeated:int, habitual:int, triedUsers: string[] (names, beta-scale)}, feedbackTrend: {week:string, up:int, down:int}[], downReasons: {reason:string, count:int}[], reliability: {errorPct, p90LatencyMs, p50LatencyMs, topErrors: {code:string,count:int}[]}, costByModel: {model:string, costUsd, calls}[], topUsers: {name:string, costUsd, uses}[] }` (feedback/recall fields nullable, companion-off).
- `GET /api/admin/feedback/summary?period=` → per-feature `{key, up, down, reasons: {reason,count}[]}[]` + `recall: {useful:int, irrelevant:int, suppress:int}|null`.
- Config: `mezo.admin.artifact-feature-map` → `Map<String,String>` in `AdminProperties` with yml defaults: `chat_message: companion_chat, feed_message: proactive_feed, weekly_suggestion: proactive_weekly, weekly_review: proactive_weekly_review, memoir: proactive_memoir, prediction: proactive_prediction, day_review: day_review` (all seven verified at generation call sites — recon 2026-09-08).

- [ ] Steps: yml ops mirroring `getAdminAlerts`'s shape → regenerate both sides → properties binding test RED/GREEN → controller overrides calling skeleton service (empty rows/nulls) so every commit compiles → commit `feat(api): admin features/feedback contract + artifact-feature map (<ID>)`.

### Task 2: Queries — usage, latency, feedback aggregates

**Files:** `LlmLogRepository.java` (2 new queries), new `feature/admin/repository/AdminFeatureQuery.java`, new `feature/companion/feedback/repository/...` — NO: feedback aggregates go in `AdminFeatureQuery` as native SQL (admin→companion table read, explicit `is_deleted = false`), keeping companion's repos untouched.

**Interfaces:**
- `LlmLogRepository.aggregateByFeatureAndUserSince(Instant): List<LlmFeatureUserRow { feature, createdBy (nullable), calls, firstAt, lastAt }>` (JPQL grouped, excludes nothing by status? — count all statuses as "uses"? Ruling: uses = non-ERROR calls; add `status <> ERROR` filter).
- `AdminFeatureQuery` (NamedParameterJdbcTemplate, timeout-first):
  - `p90LatencyByFeature(Instant since): Map<String,int[]>` — one native query: `select feature, percentile_cont(0.5) within group (order by latency_ms) p50, percentile_cont(0.9) within group (order by latency_ms) p90 from llm_log_history where created_at >= :since group by feature` (cast to int).
  - `feedbackByFeature(Instant since, Map<String,String> kindToSlug)` — native over `message_feedback` (`is_deleted = false`): group by artifact_kind × verdict (+ reason histogram); service maps kinds→slugs.
  - `feedbackTrendByKind(String kind, Instant since)` — ISO-week buckets on `updated_at`.
  - `recallFeedbackTotals(Instant since)` — `memory_retrieval_feedback` grouped by action.
  - `domainFeatureUserStats(table, timestampColumn, Instant since)` — catalog-quoted (AdminSqlDialect idiom): per `created_by`: count, min/max timestamp, distinct active ISO weeks in last 4 — one query per featureMap entry.
  - `weeklyUsage(table?, …)` — reuse `AdminUsageService`'s day-matrix machinery bucketed to weeks in the service instead of new SQL where possible.

- [ ] TDD via the Task 3/4 ITs (repos are IT-tested through endpoints here, matching the alerts slice); a focused `AdminFeatureQueryIT` for percentile + feedback SQL alone is REQUIRED (seed llm rows with known latencies → assert p50/p90 exact; seed feedback incl. a soft-deleted row → excluded). Commit `feat(admin): feature analytics queries — usage, p90, feedback (<ID>)`.

### Task 3: Scorecard service + IT

- [ ] `AdminFeatureService.board(period)`: row-set union ruling; per row wire the aggregates (usesPerWeek 12 ISO weeks dense-filled; habitUserShare = habit users / tried users, 0 when none; costPerUse = costUsd / non-ERROR calls, null when 0 calls; errorPct from `aggregateErrorRateByFeatureSince` with min 1 call; screenViews only where a screen maps — SKIP for now, return null, slice 4 decides).
- [ ] `AdminFeatureBoardIT` cases: seeded llm rows for 2 features + 1 domain feature (meal rows) → row set correct incl. kinds; uses exclude ERROR; null created_by excluded from uniqueUsers but present in cost; feedback up/down mapped through artifact map (seed message_feedback rows for chat_message → shows under companion_chat); habit share computed from a user with 3-of-4 active weeks; unknown slug row flagged system; non-owner 403; companion-off → helped null, endpoint 200 (`AdminFeaturesCompanionOffIT`).
- [ ] Commit `feat(admin): feature scorecard aggregation (<ID>)`.

### Task 4: Detail + feedback summary + ITs

- [ ] `detail(key, period)`: usageByWeek (12w), funnel per rulings (names via AppUserRepository, deleted users → id-string fallback like `AdminUsageService:229`), feedbackTrend + downReasons for mapped kinds (else empty), reliability (p50/p90 + top error codes from a small grouped query on `error_code`), costByModel (filtered to the feature via a new small `@Query` or native — group model where feature=:key), topUsers.
- [ ] `feedbackSummary(period)`: per-mapped-feature up/down/reasons + recall totals (companion-gated).
- [ ] `AdminFeatureDetailIT`: funnel counts against a hand-built fixture (1 user tried-once, 1 repeated, 1 habitual), trend buckets on updated_at (flip a vote, assert it re-dates — documenting the ruling), unknown key → 404 with `SystemMessage` error (follow the repo's 404 idiom), non-owner 403.
- [ ] Commit `feat(admin): feature detail + feedback summary (<ID>)`.

### Task 5: FE data layer (no UI)

- [ ] `adminInsightsApi/Hooks/Mock` + MSW: `useAdminFeatureBoard(period)`, `useAdminFeatureDetail(key, period)`, `useAdminFeedbackSummary(period)`; mock seeds with REAL slugs (companion_chat, meal_draft, meal_coach, train_meso_plan, proactive_feed + domain keys) and internally consistent numbers (helped ratios, 12-length week arrays, one `system`-kind row); both-mode hook tests per the established idiom. Commit `feat(admin): features data layer — hooks, mocks, msw (<ID>)`.

### Task 6: Gates + ship

- [ ] Focused ITs re-run; FE both modes + build; codemap regen; contract-drift check; ship per house flow (self-PR → CI → premerge → `--no-ff` merge, watching for CONFLICTING-PR silence); `bd close <ID>`; file the verbatim-samples follow-up bd issue.

## Self-review notes

- Spec §3 backend coverage: scorecard ✔ detail ✔ feedback summary ✔ mapping ✔; screenViews deferred to slice 4 decision (null now); acceptance null until slice 8 (contract-ready) — both recorded as rulings.
- Traps carried from recon: rollup unusable (live aggregation chosen), updated_at trend ruling, soft-delete on native reads, null created_by, percentile_cont is new SQL (dedicated IT), proactive imports avoided (feedback read via native SQL on the table, not proactive entities).
