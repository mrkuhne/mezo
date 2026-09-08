# Admin value dashboard — Slice 1: Pulzus alerts backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /api/admin/alerts` — the owner's status band: server-evaluated rules returning Hungarian alerts with deep links, tunable via `mezo.admin.alerts.*`.

**Architecture:** One new operation on the existing `AdminInsights` contract, implemented in `AdminInsightsController` (keeps the existing `@ConditionalOnProperty` gate). A new `AdminAlertService` evaluates five data-derived rules — no job beans are ever autowired — reading `LlmLogRepository` (cost + a new error-rate query), a new fixed-SQL `AdminAlertQuery` (install-wide memory health + nightly-job freshness maxes), and `AdminInsightsQuery.lastSeen` patterns. All day-bucketing in `properties.reportZone()` (Europe/Budapest).

**Tech Stack:** Spring Boot 4 / Java 21, contract-first OpenAPI codegen, JdbcClient native SQL + JPA `@Query`, Testcontainers pgvector ITs.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` §1 Pulzus (status band). Epic **mezo-l096**.

## Global Constraints

- `currentUser.requireOwner()` is the FIRST statement of the controller method, outside any transaction.
- Every timestamp→day computation uses `properties.reportZone()`; never the system zone.
- The evaluator is purely data-derived: never autowire `@Scheduled` job beans (test profile disables them). Companion-owned reads must tolerate the companion feature being OFF (skip those rules, still 200).
- Native SQL: fixed identifiers only, values bound; `SET LOCAL statement_timeout` first inside the read-only transaction (follow `AdminMemoryService`'s use of `AdminRowQuery.applyStatementTimeout` / `statementTimeoutSql()`).
- Contract-drift gate: regenerate BOTH `api/openapi.yml`-driven backend stubs (`npm run generate:api` from repo root) and FE `api.gen.ts` (`pnpm generate:api` in frontend/), commit generated files.
- Backend focused tests only, locally: `./mvnw test -Dtest=<ITClass> -Dmezo.test.use-testcontainers=true` from `backend/`. **NEVER run the full `./mvnw test` or `./mvnw clean test` locally** — 16 GB machine, the suite OOMs; CI is the full-suite gate (ArchUnit runs there).
- Conventional commits with the slice id (created in Task 0), e.g. `feat(admin): ... (mezo-XXXX)`.
- Branch `feat/admin-slice1-alerts` off up-to-date main (slice 0 must be merged first).

---

### Task 0: Branch + bd bookkeeping

- [ ] **Step 1:** `bd create --title="admin slice 1: Pulzus alerts backend (GET /api/admin/alerts)" --type=task --priority=1` → `<ID>`; `bd update <ID> --claim`.
- [ ] **Step 2:** `git checkout main && git pull --rebase && git checkout -b feat/admin-slice1-alerts`.

### Task 1: Contract + generated code

**Files:**
- Modify: `api/feature/admin-insights/admin-insights.yml`
- Generated (commit them): `api/openapi.yml`, backend generated `AdminInsightsApi`, `frontend/src/data/api.gen.ts`

**Interfaces:**
- Produces: operation `getAdminAlerts` → `AdminAlertsResponse { generatedAt: date-time, alerts: AdminAlert[] }`, `AdminAlert { key: string, severity: enum[info,warn,bad], title: string, detail: string, link: string }`. Later slices (2: Pulzus UI) consume these generated types from `api.gen.ts`.

- [ ] **Step 1:** Append to `admin-insights.yml` following the file's existing operation shape (tag `AdminInsights`, 401/403 → `SystemMessageList` refs exactly as the neighbouring ops do):

```yaml
  /api/admin/alerts:
    get:
      tags: [AdminInsights]
      operationId: getAdminAlerts
      summary: Owner status band — evaluated alert rules
      responses:
        '200':
          description: Evaluated alerts (empty list = all good)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminAlertsResponse'
        # copy the 401/403 blocks verbatim from the neighbouring operation
```

and to its `components.schemas`:

```yaml
    AdminAlertsResponse:
      type: object
      required: [generatedAt, alerts]
      properties:
        generatedAt: { type: string, format: date-time }
        alerts:
          type: array
          items: { $ref: '#/components/schemas/AdminAlert' }
    AdminAlert:
      type: object
      required: [key, severity, title, detail, link]
      properties:
        key: { type: string, description: 'stable rule key, e.g. cost_spike' }
        severity: { type: string, enum: [info, warn, bad] }
        title: { type: string, description: 'Hungarian, owner-facing' }
        detail: { type: string, description: 'Hungarian, one sentence' }
        link: { type: string, description: 'in-admin deep link with query params' }
```

- [ ] **Step 2:** Regenerate: `npm run generate:api` (repo root) and `cd frontend && pnpm generate:api`. Backend now FAILS to compile (`AdminInsightsController` doesn't implement the new op) — that is this task's RED; confirm with `cd backend && ./mvnw compile -q` showing the missing-method error.
- [ ] **Step 3:** Add a minimal compiling override in `AdminInsightsController` (gate first, service call stubbed to empty list via the service added in Task 3 — for THIS commit return `new AdminAlertsResponse().generatedAt(OffsetDateTime.now(properties.reportZone())).alerts(List.of())` inline so the commit compiles standalone):

```java
@Override
public ResponseEntity<AdminAlertsResponse> getAdminAlerts() {
    currentUser.requireOwner();
    return ResponseEntity.ok(adminAlertService.alerts());
}
```

(If wiring `AdminAlertService` in the same commit is simpler, create it in skeleton form returning the empty response — Task 3 fills the rules; choose whichever keeps every commit compiling.)

- [ ] **Step 4:** `./mvnw compile -q` passes. Commit: `feat(api): admin alerts contract + skeleton endpoint (<ID>)`.

### Task 2: Alert properties record

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/config/AdminProperties.java` (nested record — follow its existing nested-record style; if a sibling record file fits the file layout better, `AdminAlertProperties.java` beside it)
- Modify: `backend/src/main/resources/application.yml` (defaults under `mezo.admin.alerts`)
- Test: extend the existing `AdminPropertiesTest` (same package) with binding assertions.

**Interfaces:**
- Produces: `properties.alerts()` → record `Alerts(double costSpikeFactor, java.math.BigDecimal costSpikeMinUsd, int llmErrorRatePct, int llmErrorMinCalls, int jobMissedAfterHours, int testerQuietDays)` with `@DefaultValue`-style yml defaults: 2.0 / 0.50 / 20 / 5 / 26 / 7, validated `@Positive`.

- [ ] **Step 1:** Failing test in `AdminPropertiesTest`: bind a properties map overriding `mezo.admin.alerts.cost-spike-factor=3.0` and assert `alerts().costSpikeFactor() == 3.0` plus defaults for the untouched fields (copy the class's existing binding-test idiom exactly).
- [ ] **Step 2:** Run: `cd backend && ./mvnw test -Dtest=AdminPropertiesTest` → RED (no such accessor).
- [ ] **Step 3:** Add the nested record + yml block:

```yaml
    alerts:
      cost-spike-factor: 2.0
      cost-spike-min-usd: 0.50
      llm-error-rate-pct: 20
      llm-error-min-calls: 5
      job-missed-after-hours: 26
      tester-quiet-days: 7
```

- [ ] **Step 4:** `./mvnw test -Dtest=AdminPropertiesTest` → GREEN. Commit: `feat(admin): alert rule thresholds config (<ID>)`.

### Task 3: Data queries + rule evaluation + ITs

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/repository/AdminAlertQuery.java`
- Create/extend: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminAlertService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepository.java` (one new aggregate)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/admin/controller/AdminAlertsIT.java`, `AdminAlertsCompanionOffIT.java`

**Interfaces:**
- Consumes: `LlmLogRepository.aggregatePerDaySince(Instant, String zone)` (existing, ERROR-excluded — correct for cost), `AdminInsightsQuery` last-seen patterns (`AdminInsightsQuery.java:58-78`), `AdminProperties.alerts()` from Task 2.
- Produces: `AdminAlertService.alerts(): AdminAlertsResponse`; `LlmLogRepository.aggregateErrorRateByFeatureSince(Instant): List<LlmFeatureErrorRow>` where `LlmFeatureErrorRow { String feature; long total; long errors; }` (projection interface or record in the repository package, matching the file's existing row-type style).

- [ ] **Step 1: Write the failing ITs first** (`AdminAlertsIT extends ApiIntegrationTest`, Testcontainers pgvector; copy `AdminOverviewIT`'s auth/registration idiom — remember only authenticated calls stamp `last_seen_at`). Cases, each seeding through existing populators/repositories:
  - `all_quiet_returns_empty_alerts`: fresh owner, a call to `/api/auth/me` for both users today → `alerts` is empty, `generatedAt` present.
  - `cost_spike_fires`: seed llm_log rows (use the same helper/populator `AiUsage`/llmlog ITs use — find `LlmLog` seeding in the existing admin cost/usage ITs and reuse it verbatim) with 7 prior days ≈ $0.10/day and yesterday $1.00 (all in `Europe/Budapest` day terms) → alert `key=cost_spike`, `severity=warn`, `link` contains `/admin/cost?day=<yesterday ISO>`.
  - `cost_spike_respects_min_floor`: yesterday $0.30 vs prior ~$0.05/day (6× but under 0.50 floor) → no cost_spike.
  - `llm_errors_fires`: seed ≥5 calls for one feature in last 24h with >20% `status=ERROR` → `key=llm_errors`, detail contains the feature slug, `severity=bad`.
  - `llm_errors_needs_min_calls`: 3 calls, 2 errors → no alert.
  - `memory_stuck_fires`: use `MemoryItemPopulator`/`MemoryEmbeddingPopulator` (see `AdminMemory*IT`s) to create a `memory_vector` with `status='failed'` → `key=memory_stuck`, `severity=bad`, `link` contains `/admin/users/`.
  - `tester_quiet_fires_info`: registered non-owner user whose `last_seen_at` is set 8 days back (update via repository) → `key=tester_quiet`, `severity=info`, detail names the user.
  - `job_missed_skips_when_no_rows_ever`: with zero `daily_summary` rows the job_missed rule stays silent (no false alarm on fresh installs).
  - `non_owner_403`: standard.
- [ ] **Step 2:** Run: `./mvnw test -Dtest=AdminAlertsIT -Dmezo.test.use-testcontainers=true` → RED (compilation/assertion failures expected — skeleton returns empty).
- [ ] **Step 3: Implement.**
  - `LlmLogRepository` new query (style-match the file's existing `@Query` aggregates):

```java
interface LlmFeatureErrorRow { String getFeature(); long getTotal(); long getErrors(); }

@Query("""
    select l.feature as feature,
           count(l) as total,
           sum(case when l.status = io.mrkuhne.mezo.feature.llmlog.entity.CallStatus.ERROR then 1 else 0 end) as errors
    from LlmLogEntity l
    where l.createdAt >= :since
    group by l.feature
    """)
List<LlmFeatureErrorRow> aggregateErrorRateByFeatureSince(@Param("since") Instant since);
```

  (Adjust the enum reference/JPQL case syntax to the file's established style; if the existing aggregates are native SQL, write this one native too, matching them.)
  - `AdminAlertQuery` (fixed-identifier native SQL via the same JdbcClient/NamedParameterJdbcTemplate the admin slice already uses; apply the statement timeout like `AdminRowQuery`):

```java
/** Install-wide freshness/health counts for the alert rules (mezo-l096 slice 1).
 *  Fixed table names only — this class never interpolates request input. */
@Repository
public class AdminAlertQuery {
    // memory_vector.status='failed' count (no created_by filter — install-wide)
    public long failedMemoryVectors() { ... "select count(*) from memory_vector where status = 'failed'" ... }
    // ready-but-stale: embedded_content_hash <> content_hash join memory_item (copy predicate from MemoryHealthQuery:56-61, drop the userId filter)
    public long staleMemoryVectors() { ... }
    // newest daily_summary row — the nightly cluster's canary (MemoryHealthQuery.jobs() precedent, install-wide max)
    public Optional<Instant> newestDailySummaryAt() { ... "select max(created_at) from daily_summary" ... }
}
```

  - `AdminAlertService`: `@Transactional(readOnly = true)`, evaluates in fixed order (cost_spike, llm_errors, memory_stuck, job_missed, tester_quiet), Hungarian copy, links as the IT expects. Core shapes:

```java
// cost_spike — aggregatePerDaySince over 8 report-zone days; yesterday vs avg(prior 7, missing days count as 0)
LocalDate today = LocalDate.now(properties.reportZone());
LocalDate yesterday = today.minusDays(1);
// fire when yesterdayUsd >= costSpikeMinUsd && avg > 0 && yesterdayUsd > costSpikeFactor * avg
// (avg == 0 && yesterdayUsd >= costSpikeMinUsd) also fires — a first-spend day of real size is a spike from zero
new AdminAlert().key("cost_spike").severity(WARN)
    .title("Tegnapi AI-költés kiugróan magas")
    .detail("Tegnap $%.2f ment el — a korábbi 7 nap átlaga $%.2f volt.".formatted(yUsd, avg))
    .link("/admin/cost?day=" + yesterday);

// llm_errors — aggregateErrorRateByFeatureSince(now - 24h); per feature with total >= llmErrorMinCalls
// and errors * 100 > llmErrorRatePct * total → severity BAD
//   detail: "A(z) %s funkció hívásainak %d%%-a hibázott az elmúlt 24 órában (%d/%d)."
//   link: "/admin/cost?feature=" + feature  — one alert per offending feature, feature slug in detail

// memory_stuck — via ObjectProvider<AdminAlertQuery-backed reads>? No: AdminAlertQuery is admin-owned and
// always present; instead gate the RULE on the companion switch:
//   @Value("${" + FeaturesConfiguration.COMPANION_SWITCH_PROPERTY + ":false}") boolean companionEnabled
//   (use the exact constant/property name FeaturesConfiguration exposes — read that class first)
// when off → skip memory_stuck and job_missed rules entirely.
// fire when failed > 0 (BAD) — stale>0 alone is WARN with its own copy:
//   failed: title "Elakadt emlék-feldolgozás", detail "%d emlék beágyazása hibára futott.", link "/admin/memory"
//   NOTE: /admin/memory ships in slice 7; until then link to "/admin/users" — put the final link in ONE
//   constant with a TODO-free comment naming slice 7 so slice 7's plan flips it.

// job_missed — newestDailySummaryAt(); empty → silent; older than jobMissedAfterHours → WARN
//   title "Kimaradt az éjszakai feldolgozás", detail "Az utolsó napi összegzés %s készült.", link "/admin"

// tester_quiet — reuse AdminInsightsQuery's last_seen access (or AppUserRepository.findAll + filter, matching
// AdminUserService.java:57,96): non-owner users with last_seen_at older than testerQuietDays → ONE aggregated
// INFO alert listing names: title "Csendes tesztelők", detail "Ők 7+ napja nem jártak itt: Anna, Béla.",
// link "/admin/users?filter=quiet"
```

- [ ] **Step 4:** `./mvnw test -Dtest=AdminAlertsIT -Dmezo.test.use-testcontainers=true` → GREEN. Commit: `feat(admin): alert rule evaluation — cost spike, llm errors, memory, jobs, quiet testers (<ID>)`.
- [ ] **Step 5: Companion-off IT** (`AdminAlertsCompanionOffIT`, copy the switch-off idiom from `AdminMemoryHealthGraphOffIT`): companion disabled → endpoint still 200, no memory_stuck/job_missed keys in the response, other rules unaffected. RED first is unnecessary here (behavior already implemented) — write it, run `./mvnw test -Dtest=AdminAlertsCompanionOffIT -Dmezo.test.use-testcontainers=true`, GREEN. Commit: `test(admin): alerts endpoint honest when companion is off (<ID>)`.

### Task 4: FE mock + MSW seed (data layer only — UI is slice 2)

**Files:**
- Modify: `frontend/src/data/admin/adminInsightsApi.ts`, `adminInsightsHooks.ts`, `adminInsightsMock.ts`
- Modify: `frontend/src/test/msw/handlers.ts` (handler beside the overview one, `handlers.ts:357-362`)
- Test: extend `frontend/src/data/admin/adminInsightsHooks.test.tsx` with a `useAdminAlerts` case in the file's existing style.

**Interfaces:**
- Produces: `useAdminAlerts()` (useDualQuery, `enabled: isOwner`, mock seed exports `ADMIN_ALERTS_MOCK` with 2 alerts: a warn cost_spike and a bad memory_stuck, so slice 2's UI has realistic mock data). Types come from the regenerated `api.gen.ts` (`components['schemas']['AdminAlertsResponse']`).

- [ ] **Step 1:** Failing hook test (mock mode): `useAdminAlerts` returns the seed's 2 alerts; follow the neighbouring hook test verbatim (including `staleTime` handling per the repo's mock-cache rule).
- [ ] **Step 2:** `cd frontend && pnpm vitest run src/data/admin/adminInsightsHooks.test.tsx` → RED.
- [ ] **Step 3:** Implement api fn (`GET /api/admin/alerts`), hook via `useDualQuery` with `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS` and mock `staleTime` matching the file's pattern; mock seed; MSW handler returning the same seed for real-mode tests.
- [ ] **Step 4:** Run the file's tests in BOTH modes (`pnpm vitest run src/data/admin` and `VITE_USE_MOCK=false pnpm vitest run src/data/admin`) → GREEN. Commit: `feat(admin): alerts data layer — hook, mock seed, msw (<ID>)`.

### Task 5: Gates + ship

- [ ] **Step 1:** Focused backend re-run of BOTH IT classes with Testcontainers; frontend `pnpm vitest run src/features/admin src/data/admin` in both modes; `pnpm build`; `node scripts/gen-codemap.mjs --check` (regenerate+commit if stale); verify `git status` shows no unexpected `archunit-store` change.
- [ ] **Step 2:** Contract-drift self-check: `git status` must show committed `api/openapi.yml` + `api.gen.ts`; if the repo has a drift-check script in package.json/scripts, run it.
- [ ] **Step 3:** Ship per house flow (push, self-PR, CI green, `gh workflow run premerge.yml -f pr=<n>`, local `--no-ff` merge after `git pull --rebase`, push, delete branch, `bd close <ID>`). Known pre-existing local failures (mezo-c4ib: chatApi transcribe, TutorialProvider) are NOT ours — do not chase them locally; CI is authoritative.

## Self-review notes

- Spec §1 coverage: 5 rules ✔, config record ✔, HU copy server-side ✔, deep links ✔ (memory link temporarily `/admin/users` until slice 7 — recorded in code comment and here), green/empty state = empty list ✔ (band copy is slice 2).
- Types consistent: `AdminAlertsResponse/AdminAlert` (Task 1) consumed by Tasks 3–4; `LlmFeatureErrorRow` named once.
- Deliberate scope cuts: no per-rule enable flags (YAGNI — thresholds suffice); tester_quiet aggregated into one alert (avoids N alert rows for N testers).
