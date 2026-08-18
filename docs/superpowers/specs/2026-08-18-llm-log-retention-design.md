# LLM audit log retention — payload scrub, cost forever (mezo-1y3p)

- **Date:** 2026-08-18
- **Driver:** bd `mezo-1y3p`
- **Status:** approved design, pre-implementation
- **Parent decision:** [ADR 0014](../../decisions/0014-llm-call-audit-log.md) — its Consequences
  section names retention as the first follow-up: "The table only grows. Nothing prunes it yet,
  and prompts/responses are stored."

## 1. Problem

`llm_log_history` is INSERT-only by design and nothing prunes it. Each row can carry up to
4×64 000 characters of payload (`system_prompt`, `conversation_history`, `user_message`,
`response_text`; cap `mezo.llm-log.max-payload-chars`), and the prod key writes ~100 calls/day —
roughly 1–5 MB/day of payload growth on the VPS, all of it also flowing into the nightly
Postgres backups (ADR 0009). Since `mezo-uakh` the rows are browsable at `/me/ai-usage`, so the
payload is now a user-facing surface, not just forensic sediment.

## 2. Decisions

Resolving the four open questions filed in `mezo-1y3p`:

1. **Two-tier policy: payload is scrubbed, cost metadata lives forever.** After the retention
   window the four payload columns are set to NULL; every other column — token counters,
   `cost_usd`, `pricing_snapshot`, error fields, image/embed request counters, attribution
   (`feature`/`operation`/`entity_*`) — is kept indefinitely. Cost attribution was the feature's
   founding purpose (ADR 0014 Context); the metadata residue is ~36k small rows/year, which is
   noise next to the payload. Full-row DELETE was rejected because it truncates the cost history;
   a third very-old-row DELETE tier was rejected as YAGNI for a single-user app.
2. **Window: 90 days**, config not code (`mezo.llm-log.retention.payload-days`). Covers the
   realistic debug horizon ("why did it say that last month?") and several cycles of the weekly
   crons (hypothesis, memoir) while keeping the payload working set around 100–450 MB.
3. **Runs as an app-side `@Scheduled` job** on the established techcore-cron pattern (13 existing
   jobs). A DB-side job (pg_cron) would add a new infra dependency for a one-statement UPDATE;
   lazy scrub-on-read would hide a write side effect inside a GET and never run if the page is
   not visited. Both rejected.
4. **The scrub is a hard, irreversible data removal via UPDATE** — restating ADR 0014's standing
   exception: the table has no `is_deleted` and never will; rows leave (or here: shed payload)
   only via retention. No row is deleted, so the `created_by ... on delete set null` property —
   user deletion never takes cost history with it — is untouched.

## 3. Design

### 3.1 Migration

`202608181000_mezo-1y3p_llm_log_payload_scrubbed_at.sql` — one new column:

```sql
alter table llm_log_history add column payload_scrubbed_at timestamptz;
```

NULL = payload untouched (or the row never had one — see 3.2 for how those are told apart).
Non-null = "payload was removed by retention at this instant". The existing `truncated` flag is
unrelated (it records write-time capping) and stays as-is.

### 3.2 Scrub semantics

One bulk UPDATE per run:

```sql
update llm_log_history
set system_prompt = null,
    conversation_history = null,
    user_message = null,
    response_text = null,
    payload_scrubbed_at = now()
where created_at < :cutoff          -- now() - payload-days
  and payload_scrubbed_at is null
  and (system_prompt is not null
    or conversation_history is not null
    or user_message is not null
    or response_text is not null);
```

- The last predicate keeps the stamp honest: `payload_scrubbed_at` is only set where something
  was actually removed. Embed rows (payload never written) stay NULL-stamped forever.
- Status is irrelevant on purpose: ERROR/CANCELLED rows age out the same way.
- Idempotent by construction (`payload_scrubbed_at is null` guard); re-runs and overlapping
  runs are harmless.
- Scale: single-user, ~100 rows/day → the daily increment is ~100 rows and the very first run's
  backlog is a few thousand (the table exists since 2026-07-28). No batching, no pagination.
  The `idx` on `created_at` (created for exactly this in ADR 0014) carries the WHERE.

### 3.3 Job

`feature/llmlog/service/LlmLogRetentionJob` mirroring `DailySummaryJob`:

- `@Component` + `@RequiredArgsConstructor`, `@ConditionalOnProperty` on
  `FeaturesConfiguration.LLM_LOG_RETENTION_JOB_SWITCH`
  (`mezo.techcore.cron.llm-log-retention-job.enabled`, default `true`) — off ⇒ the bean does
  not exist, per the house cron pattern.
- **Deliberately NOT conditioned on `mezo.feature.llm-log.enabled`**: the write switch and the
  retention switch are independent — payload already on disk keeps aging even while recording
  is off (locally `llm-log.enabled` is `false` yet the dev DB can hold synced prod rows).
- `@Scheduled(cron = "${mezo.llm-log.retention.cron}")`, default `0 40 3 * * *` — verified
  free: the dawn cluster sits at 02:20/02:40/03:00(SUN) and the proactive block starts 05:45.
- The UPDATE runs through a `@Modifying` JPQL method on `LlmLogRepository`
  (`scrubPayloadsOlderThan(Instant cutoff, Instant now)`), method-level `@Transactional` on the
  job's single public method per `spring_patterns.md`. The job logs the affected-row count.

### 3.4 Config

`LlmLogProperties` grows a validated sub-record:

```yaml
mezo:
  llm-log:
    retention:
      # Payload columns are NULLed after this many days; cost/token metadata is kept forever
      payload-days: 90
      # After the 03:00 cron cluster, in the dead zone
      cron: "0 40 3 * * *"
  techcore:
    cron:
      # mezo-1y3p payload retention; off = the LlmLogRetentionJob bean does not exist
      llm-log-retention-job:
        enabled: true
```

`Retention(@Positive int payloadDays, @NotBlank String cron)` — everything under the `mezo:`
root, `@Validated` properties record, never `@Value` (configuration_conventions.md).

### 3.5 API + UI honesty (`/me/ai-usage`)

Contract-first: the call-detail response in the `api/feature/llm-usage` fragment gains
`payloadScrubbedAt` (nullable date-time); regenerate merged `openapi.yml` + FE types.
The FE detail view distinguishes three payload states:

- payload present → render as today;
- `payloadScrubbedAt != null` → explicit honest state: „A payload a 90 napos retention szerint
  törölve" (with the timestamp), not silently empty fields;
- payload absent and not scrubbed (embed rows) → current empty rendering unchanged.

### 3.6 Tests

Integration-first per `testing_standards.md` / `integration_test_framework.md` (extend
`AbstractIntegrationTest`; rows via the llmlog populator or direct repository writes):

1. old row (beyond cutoff) → payload columns NULL, `payloadScrubbedAt` set, token counters,
   `costUsd` and `pricingSnapshot` intact;
2. fresh row (inside window) → untouched;
3. already-scrubbed row → not re-stamped (timestamp stable ⇒ idempotence);
4. embed row with no payload → stays `payloadScrubbedAt = null`;
5. ERROR row beyond cutoff → scrubbed like any other;
6. API: call detail exposes `payloadScrubbedAt`.

### 3.7 Docs

- ADR 0014: Consequences — mark retention as shipped (this spec), keep the exception wording;
- `docs/features/companion.md` LLM-audit section: retention behavior + the new column;
- roadmap milestone log entry;
- `node scripts/lint-docs.mjs` to clear staleness.

## 4. Out of scope

- Budget alerting, admin views beyond the existing usage page (separate bd issues).
- Any DELETE tier for ancient metadata rows — revisit only if the metadata residue ever
  becomes measurable.
- Backfill-aware variable windows (e.g. keeping ERROR payloads longer) — YAGNI.
