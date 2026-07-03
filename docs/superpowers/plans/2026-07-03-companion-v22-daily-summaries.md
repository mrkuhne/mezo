# Companion V2.2 — Daily summaries + embedding pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the narrative memory fills itself daily — a nightly job turns each finished day's L0 data into a short Hungarian past-tense `daily_summary` narrative (LLM behind the port), and an embed pipeline writes both daily summaries and chat turns into `memory_embedding` (the V2.1 vector layer), idempotently, with catch-up for missed days.

**Architecture:** a `DailySummaryService` composes a deterministic per-day digest from existing L0 reads (the V0.3 snapshot precedent, but date-scoped and past-tense), one cheap-tier `CompanionLlm.complete()` call turns it into narrative, and a `MemoryEmbeddingWriter` embeds + persists (kind=`daily_summary`). The **first `@Scheduled` job in the codebase** (`DailySummaryJob`, new techcore `SchedulingConfiguration` with `@EnableScheduling`) runs nightly and is **idempotent per date** with a catch-up window (missed nights self-heal; this doubles as the roadmap's "backfill command" — no separate CLI). Chat turns embed asynchronously after commit (`TurnEmbeddingListener` on the existing `ChatTurnCompleted` event — the V1.2 extraction-listener idiom), one vector per turn (user+assistant condensed, ref_id = assistant message id). Everything switch-gated; embedding failures never break a turn or the job run.

**Tech Stack:** Spring Boot 4 `@Scheduled` + `@EnableScheduling` (new), `@TransactionalEventListener(AFTER_COMMIT)` + `@Async` (existing idiom), `CompanionLlm` + `EmbeddingPort` (V2.1) with the `companion-fake` profile fakes, Liquibase (one new table), no contract change (backend-only slice — FE untouched).

**Driver:** bd `mezo-fnnq.10` · roadmap §V2.2 · spec §7 (embed narrative units, not raw rows) · living doc `docs/features/companion.md`.

## Global Constraints

- Branch `feat/companion-v22`; conventional commits carrying `(mezo-fnnq.10)`.
- Backend gate: `cd backend && ./mvnw clean test` (ALWAYS `clean`; compose Postgres up). No FE gate (no FE change).
- No LLM/embedding network in tests — `companion-fake` profile (`FakeCompanionLlm` echo + `FakeEmbeddingAdapter`).
- Config under `mezo.companion.summary.*` (values) + `mezo.techcore.cron.daily-summary-job.enabled` (job switch, `FeaturesConfiguration` constant); never `@Value`.
- New table → `ResetDatabase` TRUNCATE list + `DailySummaryPopulator` + `@Import` growth rules, same change.
- A summary/embedding failure must NEVER break anything user-facing: the job logs+skips the failed date (next night retries it via catch-up); the turn listener logs+swallows (extraction precedent).
- Scheduler tested by invoking the job bean method directly in ITs (no cron waiting); cron/config binding asserted separately.

## Decisions locked (V2.2)

1. **Summary day = finished days only** (yesterday and older); "today" stays the V0.3 snapshot's job. The job processes every date in `[today − catch-up-days, yesterday]` that has L0 data and no `daily_summary` row — idempotent catch-up IS the backfill (roadmap's separate "backfill command" dropped as redundant).
2. **Digest is deterministic code, narrative is LLM** (NFR-M-4: a step is pure-compute or pure-LLM, never both). `digest(userId, date)` composes date-scoped reads: workouts/sport/run that day, FuelDay rollup, sleep of that night, weight log(s), medication doses + retaDay, check-in. Empty day (no L0 rows at all) ⇒ no summary row (nothing to remember), logged.
3. **Narrative prompt is marker-prefixed** (`SUMMARY_MARKER`, the `EXTRACTION_MARKER` precedent) so the fake dispatches deterministically: fake answers `[fake-summary:…]` sentinel payload when present in the digest, else a deterministic `ÖSSZEFOGLALÓ(…)` echo of the digest — ITs assert real day-facts land in the narrative without any LLM.
4. **Embedding unit + refs:** summaries → kind=`daily_summary`, ref_id = `daily_summary.id`, content = narrative, occurred_on = summary_date. Chat turns → kind=`chat_turn`, **one vector per turn** (`Daniel: {user}\nMezo: {assistant}` condensed, capped at `embed-max-chars`), ref_id = **assistant** `ai_message.id`, occurred_on = message date. `uq_memory_embedding_kind_ref_id` + exists-check = idempotence.
5. **Both halves of a turn embed as ONE unit** (roadmap's "user turns only vs both" decision): the question gives the episode its topic, the answer its content — recall wants both; separate vectors would double rows for no recall gain at this scale.
6. **Turn embedding is post-commit async** on the existing `ChatTurnCompleted` event (new `TurnEmbeddingListener` beside `FactExtractionListener`, gated on its own toggle `mezo.companion.embedding.embed-chat-turns`); the nightly job also **catch-up-embeds** un-embedded turns in the window (covers listener-off periods, crashes, and pre-V2.2 history — same idempotence).
7. **First scheduler infra:** `techcore/configuration/SchedulingConfiguration` (`@Configuration @EnableScheduling`) — techcore because it is feature-agnostic plumbing; the job bean itself lives in `feature/companion/summary/` and is gated `@ConditionalOnProperty({COMPANION_SWITCH, DAILY_SUMMARY_JOB_SWITCH})`. Cron expression is config (`mezo.companion.summary.cron`, default `0 20 2 * * *` — 02:20, after the day is truly over), zone = server default (single-user, server already Europe/Berlin-adjacent; revisit if hosting moves).
8. **No ShedLock** — single instance by design (spec §2 table); revisit only if replicas ever >1.
9. **daily_summary is regenerable data** — soft-delete + `uq(created_by, summary_date)`; regeneration path (delete row → next night regenerates) documented, no admin endpoint yet.
10. **Model tier:** summaries use the **cheap chat tier** (`llm.chat-model`) — a few sentences of past-tense HU needs no Pro; V3.2 critique is where `smart-model` debuts.

## File map

**Backend main:** `feature/companion/summary/` (new subpackage) → `DailySummaryService.java` (digest + narrative + persist), `DailySummaryJob.java` (`@Scheduled`, catch-up loop, turn-embedding catch-up); `feature/companion/embedding/` (new) → `MemoryEmbeddingWriter.java` (embed + idempotent persist), `TurnEmbeddingListener.java`; `entity/DailySummaryEntity.java`; `repository/DailySummaryRepository.java` (+`MemoryEmbeddingRepository` exists-finders); `service/ChatTurnCompleted.java` (+assistantMessageId + occurred date if missing); `config/CompanionProperties.java` (+Summary group, +Embedding.embedChatTurns/embedMaxChars); `llm/FakeCompanionLlm.java` (SUMMARY_MARKER branch); `techcore/configuration/SchedulingConfiguration.java` (new), `FeaturesConfiguration.java` (+DAILY_SUMMARY_JOB_SWITCH); `application.yml` (+summary block + techcore.cron block); migration `1.0.0/script/{ts}_mezo-fnnq.10_create_daily_summary.sql` + master registration.

**Backend test:** `feature/companion/summary/DailySummaryServiceIT`, `DailySummaryJobIT` (idempotence, catch-up, empty-day skip, failure-isolation), `feature/companion/embedding/TurnEmbeddingListenerIT`, `MemoryEmbeddingWriterIT`; `CompanionPropertiesIT` (+summary/embedding binding), switch-off ITs; `support/populator/DailySummaryPopulator` + `ResetDatabase` + `AbstractIntegrationTest` growth.

**Docs:** `docs/features/companion.md` (§1 V2.2 block, status row, §4 table+config, §5 seams), `docs/milestones/roadmap.md` row, this plan.

---

### Task 1: `daily_summary` table + entity + repo + test-infra growth

- [ ] Migration `{ts}_mezo-fnnq.10_create_daily_summary.sql`: house columns + `summary_date date not null` + `narrative text not null`, `uq_daily_summary_created_by_summary_date`, `idx_daily_summary_created_by_summary_date desc`; register in `1.0.0_master.yml`.
- [ ] `DailySummaryEntity` (OwnedEntity, soft-delete, mirrors) + `DailySummaryRepository` (`existsByCreatedByAndSummaryDate`, `findByCreatedByAndSummaryDate`).
- [ ] `ResetDatabase` TRUNCATE + `DailySummaryPopulator` + `@Import`; persistence round-trip IT case.

### Task 2: config + switches + scheduling infra

- [ ] `CompanionProperties`: `Summary(cron, catchUpDays 7 @Min(1)@Max(60))` + `Embedding` grows `embedChatTurns boolean`, `embedMaxChars int (2000)`; yml blocks with comments; `FeaturesConfiguration.DAILY_SUMMARY_JOB_SWITCH = "mezo.techcore.cron.daily-summary-job.enabled"` + explicit yml `enabled: true`.
- [ ] `SchedulingConfiguration` (`@EnableScheduling`) in techcore.
- [ ] `CompanionPropertiesIT` binding asserts.

### Task 3: digest + narrative (`DailySummaryService`)

- [ ] `digest(userId, date)` — deterministic date-scoped HU block (train/fuel/sleep/weight/meds/check-in reads; `nincs adat` absences; returns empty marker when the day has zero L0 rows).
- [ ] `SUMMARY_MARKER` prompt + `generate(userId, date)`: digest → `CompanionLlm.complete(cheap tier)` → persist `daily_summary` (skip when exists / empty day).
- [ ] `FakeCompanionLlm` SUMMARY_MARKER branch (`[fake-summary:…]` sentinel, else deterministic digest echo).
- [ ] `DailySummaryServiceIT`: populator-seeded day → narrative persisted carrying day facts; empty day ⇒ no row; existing row ⇒ untouched (idempotent); LLM failure ⇒ no row, no throw.

### Task 4: embed pipeline (`MemoryEmbeddingWriter` + `TurnEmbeddingListener`)

- [ ] `MemoryEmbeddingWriter.writeSummary(summary)` / `writeTurn(userMsgContent, assistantMessage)` — `EmbeddingPort.embedDocuments`, exists-check idempotence, cap content at `embed-max-chars`, failures logged+swallowed.
- [ ] Wire summary generation → `writeSummary` (same flow, after persist).
- [ ] `TurnEmbeddingListener` (`AFTER_COMMIT @Async`, own toggle) → `writeTurn`; extend `ChatTurnCompleted` if the assistant message id is missing from the event.
- [ ] ITs: turn completed ⇒ `memory_embedding(kind=chat_turn)` row with fake vector + correct ref/occurred_on; duplicate event ⇒ single row; toggle off ⇒ no row; writer failure isolation.

### Task 5: the nightly job (`DailySummaryJob`)

- [ ] `@Scheduled(cron = "${mezo.companion.summary.cron}")` run: for each date in `[today−catchUpDays, yesterday]` → `generate` + `writeSummary`; then catch-up-embed un-embedded turns in the window. Per-date try/catch (one bad date must not kill the run).
- [ ] `DailySummaryJobIT` (invoke `run()` directly): fills missing dates only; second run no-ops; turn catch-up embeds pre-existing un-embedded turns; job switch off ⇒ bean absent.

### Task 6: gates + docs + close

- [ ] `./mvnw clean test` green; lint-docs + lint-liquibase PASS.
- [ ] `companion.md` V2.2 sections + roadmap milestone row.
- [ ] Review workflow on the diff → fix confirmed findings → `--no-ff` merge → push → live verify → `bd close mezo-fnnq.10` with notes.
