# Feature telemetry (screen events) — design spec

- **Date**: 2026-09-07
- **Issue**: filed at implementation start (part 4 of the admin/observability series)
- **Status**: designed autonomously by the orchestrator run (Daniel opted into delivering all
  4 parts; the admin-hub spec's stance was "only if screen-level behaviour is needed" — this
  spec resolves the tension by shipping the leanest useful version, **default OFF**, so the
  cost of having it is one switch and one table).

## 1. Problem

The admin hub's Feature-használat page derives usage from domain tables (`mezo.admin.feature-map`)
and `llm_log_history`. That answers *"did they log meals?"* but not *"which screens do people
actually open, and which shipped surfaces are dead?"*. Part 4 closes exactly that gap — nothing
more. No click streams, no funnels, no third-party analytics.

## 2. Product decisions (made autonomously, logged in the delivery decision log)

- **T1 — Screen views only.** One event kind (`view`), emitted on route change. No clicks,
  no dwell time, no custom events in v1. A `meta jsonb` column exists so a later kind can ride
  the same table, but the contract only accepts `view`.
- **T2 — Default OFF end to end.** Backend switch `mezo.feature.screen-telemetry.enabled`
  (FeaturesConfiguration constant, `@ConditionalOnProperty`) defaults `false`; ingest and read
  endpoints 404 when off. The k8s deployment enables it explicitly. The FE fails silent on
  404/network error — telemetry must never degrade the app.
- **T3 — Screen ids are route patterns, not URLs.** The FE reports the matched route pattern
  (`/admin/users/:id`, not `/admin/users/42`) — no PII-bearing path params ever leave the client.
  Query strings are never sent.
- **T4 — Batched fire-and-forget ingest.** The FE buffers events and flushes on interval and
  on `visibilitychange→hidden` (fetch `keepalive: true`). Loss is acceptable; ordering is not
  guaranteed; the server trusts client `occurredAt` but clamps it to `now ± 24h`.
- **T5 — Owner-only reads, self-writes.** Any authenticated user's client writes its own events
  (`created_by` from the JWT, never from the payload). Reads live under `/api/admin/**` behind
  `requireOwner()` like every other admin endpoint (ADR 0038 consent scope applies).
- **T6 — Mock mode is a no-op** for ingest; the admin read hooks get MSW fixtures like every
  other admin surface.

## 3. Data model

One table, one Liquibase changeSet:

```sql
CREATE TABLE screen_event (
    id          uuid PRIMARY KEY,
    created_by  uuid        NOT NULL,          -- owner pattern (OwnedEntity)
    screen      varchar(120) NOT NULL,          -- matched route pattern
    event       varchar(24)  NOT NULL DEFAULT 'view',
    occurred_at timestamptz  NOT NULL,
    meta        jsonb        NULL,
    created_at  timestamptz  NOT NULL
);
CREATE INDEX idx_screen_event_user_time ON screen_event (created_by, occurred_at);
CREATE INDEX idx_screen_event_screen_time ON screen_event (screen, occurred_at);
```

No soft delete — rows are disposable; a retention job hard-deletes past
`mezo.telemetry.retention-days`. The table gains browsability in the admin data browser for
free (it has `created_by`).

## 4. Contract (`api/feature/telemetry/telemetry.yml`, tag `Telemetry` → `TelemetryApi`;
admin read on tag `AdminInsights` extension or its own `AdminTelemetry` tag → decided at plan time)

| Op | Path | Notes |
|----|------|-------|
| `ingestScreenEvents` | `POST /api/telemetry/screen-events` | body `{events:[{screen, occurredAt, meta?}]}`, max `mezo.telemetry.batch-max` items, 202 on accept, per-user rate limit → 429 |
| `getAdminScreenUsage` | `GET /api/admin/usage/screens?period=7d\|30d\|90d` | `requireOwner()`; rows `{screen, views, uniqueUsers, lastSeenAt}` + a dense daily series for sparklines (reuse `AdminSeries.dense`) |

## 5. Backend (`feature/telemetry` slice)

```
feature/telemetry/
  config/TelemetryProperties.java      @Validated record, prefix mezo.telemetry
  controller/TelemetryController.java  implements TelemetryApi; ingest only
  entity/ScreenEventEntity.java        extends OwnedEntity
  repository/ScreenEventRepository.java  + native batch insert (JdbcClient) if JPA
                                          per-row insert is measurably silly for batches
  service/ScreenEventService.java      clamp occurredAt, cap batch, rate limit
  service/ScreenEventRetentionJob.java @Scheduled, cron from properties
```
Admin read side goes in `feature/admin` (AdminUsageService gains a screens query) so the
dependency stays `admin → telemetry` — telemetry never imports admin (ArchUnit).

Rate limiting: a tiny in-memory token bucket per user (this is a single-replica deployment;
no distributed limiter). Config: `mezo.telemetry.rate-limit-per-minute`.

### application.yml (every tunable — Daniel's requirement)

```yaml
mezo:
  feature:
    screen-telemetry:
      enabled: false           # true only in k8s/backend/deployment.yaml
  telemetry:
    retention-days: 90
    retention-cron: "0 40 3 * * *"
    batch-max: 50
    rate-limit-per-minute: 120
    occurred-at-clamp-hours: 24
```

## 6. Frontend

- `frontend/src/data/telemetry/telemetryClient.ts` — buffer + flush (interval
  `TELEMETRY_FLUSH_MS` FE constant, and on `visibilitychange`), `keepalive` fetch, swallow all
  errors, hard no-op when `isMockMode()`.
- `frontend/src/app/useScreenTracking.ts` — router-level hook resolving the matched route
  pattern (react-router `useMatches`/route id), called once in `AppLayout` and once in
  `AdminLayout`.
- Admin: Feature-használat page (`AdminUsagePage`) gains a "Képernyők" segment — table
  (screen · megnyitások · userek · utoljára) + sparkline, reusing `DataTable`/`Sparkline`,
  data via new `useAdminScreenUsage` hook (`useDualQuery`, `enabled: isOwner`, explicit
  `realStaleTime`), MSW fixture included.

## 7. Testing

- IT: ingest happy path; batch cap → 400; rate limit → 429; occurredAt clamp; switch off → 404;
  non-owner on admin read → 403; retention job deletes old rows only.
- FE: buffer/flush unit test (fake timers), mock-mode no-op guard, AdminUsagePage "Képernyők"
  render in both modes.

## 8. Explicit non-goals

Click/interaction events, session stitching, funnels, A/B, external analytics, per-user opt-out
UI (the beta consent of ADR 0038 covers owner visibility; revisit at GA together with that ADR).

## 9. ADR

`docs/decisions/00xx-lean-screen-telemetry.md` — why a single-table, default-off event log was
chosen over both "no telemetry" (Daniel asked for part 4) and a generic event pipeline (YAGNI;
the admin-hub spec explicitly warned a general event log "may never be needed").
