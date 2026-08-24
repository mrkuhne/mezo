# W3.2 Consolidation ladder — implementation plan (bd `mezo-b3pp.13`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Weekly and monthly `period_summary` rows are generated + embedded from the fine-grained
memory (daily summaries → weeks → months), and ambient recall shadows old `daily_summary` hits with
their covering weekly/monthly rows — nothing is ever deleted.

**Architecture:** Design of record: [`2026-08-18-phase5-deep-memory-personalization-design.md`](../specs/2026-08-18-phase5-deep-memory-personalization-design.md)
§4.3 + §7.2. One new table (`period_summary`), one service (`PeriodSummaryService`, deterministic
gather + one cheap-tier LLM call, idempotent per `(granularity, period_start)`), one cron bean
(`ConsolidationJob`, weekly Monday dawn + monthly 1st dawn, both backfilling), one new
`MemoryEmbeddingWriter.writePeriodSummary` method (the single write path stays single), and a
coverage filter inside `PromptMemoryAssembler` (daily-kind ANN query gets an `occurred_on >= cutoff`
metadata filter; a new unrestricted weekly/monthly group takes over beyond the cutoff).

**Tech stack:** Spring Boot 3 / Java 21, JPA + Liquibase (`sqlFile` changesets), pgvector, JUnit 5 +
Testcontainers integration tests, `companion-fake` profile for provider-free LLM/embed.

## Global constraints (spec §11)

- Contract-first — **not applicable**: this slice adds no REST surface, no DTO, no FE change.
- Every LLM/embed call wrapped in `LlmCallContextHolder.runWith(new LlmCallContext(feature,
  operation, entityKind, entityId), …)`; this slice's feature tag is `companion_consolidation`
  (operations `weekly` / `monthly`); the embed hop rides the existing `embed_memory` tag inside
  `MemoryEmbeddingWriter`.
- **Cheap tier** (`chat-model`) for the condensation calls — weekly/monthly *condensation* here is
  mechanical summarization of already-generated prose, not the smart-tier synthesis the memoir does.
- New cron in a free dawn slot: taken today are 02:20 (daily-summary), 02:40 (patterns), 03:00 SUN
  (hypotheses), 03:10 (feedback-learning), 03:20 (graph maintenance), 03:40 (llm-log retention).
  **This slice takes 03:30 (weekly, MON) and 03:50 (monthly, day 1).** Techcore switch +
  SwitchOffIT.
- Integration-first tests; new table → `ResetDatabase` truncate list + `PeriodSummaryPopulator`.
- Docs in the same change: `docs/features/companion.md`; `node scripts/lint-docs.mjs` after; and
  `node scripts/gen-codemap.mjs` (CI-gated, never hand-edited).
- `@Validated` config records only — the new knobs are a nested `@Valid` record in
  `CompanionProperties`.
- Nothing is deleted: consolidation shadows fine-grained rows, never removes them (spec §12).

---

## File structure

**Create**
- `backend/src/main/resources/db/changelog/1.0.0/script/202608231400_mezo-b3pp.13_create_period_summary.sql`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/PeriodSummaryEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/PeriodSummaryRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PeriodSummaryService.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ConsolidationJob.java`
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/PeriodSummaryPopulator.java`
- ITs: `PeriodSummaryPersistenceIT`, `PeriodSummaryServiceIT`, `ConsolidationJobIT`,
  `ConsolidationJobSwitchOffIT`, `ConsolidationPropertiesIT`, `PromptMemoryAssemblerShadowIT`
  (all under `backend/src/test/java/io/mrkuhne/mezo/feature/companion/`)

**Modify**
- `db/changelog/1.0.0/1.0.0_master.yml` — the new changeset
- `MemoryEmbeddingEntity` — `KIND_MONTHLY_SUMMARY` constant
- `MemoryEmbeddingWriter` — `writePeriodSummary(PeriodSummaryEntity)`
- `MemoryEmbeddingAnnQuery` — `nearestInKindsSince(…, LocalDate notBefore)`
- `PromptMemoryAssembler` — period-summary group + daily-kind coverage cutoff
- `CompanionProperties` — `Consolidation` record; `AmbientRecall` gains `capPeriodSummary`,
  `weeklyShadowDays`
- `FeaturesConfiguration` — `CONSOLIDATION_JOB_SWITCH`
- `application.yml` — `mezo.companion.consolidation.*`, the two new ambient-recall keys, the
  techcore cron switch
- `FakeCompanionLlm` — consolidation marker dispatch + `[fake-period:…]` sentinel
- `ResetDatabase` — `period_summary` in the truncate list
- `docs/features/companion.md`, `docs/CODEMAP.md` (generated)

---

## Task 1: `period_summary` table + entity + repository + populator

**Files:**
- Create: migration `202608231400_mezo-b3pp.13_create_period_summary.sql`, `PeriodSummaryEntity`,
  `PeriodSummaryRepository`, `PeriodSummaryPopulator`
- Modify: `1.0.0_master.yml`, `ResetDatabase.java:40`
- Test: `feature/companion/PeriodSummaryPersistenceIT.java`

**Interfaces produced:**
- `PeriodSummaryEntity` (extends `OwnedEntity`): `granularity` (`week`|`month`, constants
  `GRANULARITY_WEEK`/`GRANULARITY_MONTH`), `periodStart` (`LocalDate`), `summaryText` (`String`).
- `PeriodSummaryRepository extends JpaRepository<PeriodSummaryEntity, UUID>`:
  - `Optional<PeriodSummaryEntity> findByCreatedByAndGranularityAndPeriodStart(UUID, String, LocalDate)`
  - `List<PeriodSummaryEntity> findByCreatedByAndGranularityAndPeriodStartBetweenOrderByPeriodStartAsc(UUID, String, LocalDate, LocalDate)`
- `PeriodSummaryPopulator.periodSummary(UUID createdBy, String granularity, LocalDate periodStart)`
  and a 4-arg overload taking the text.

- [ ] **Step 1: Write the failing persistence IT** — `PeriodSummaryPersistenceIT`:
  uq `(created_by, granularity, period_start)` rejects a duplicate; a soft-deleted row disappears
  from the repository read; `granularity='year'` violates `ck_period_summary_granularity`.
- [ ] **Step 2: Run it, expect compile failure / red**
- [ ] **Step 3: Write the migration** (§4.3 verbatim, explicit constraint names, `idx_` on
  `(created_by, granularity, period_start)`), register the changeset, write entity + repository +
  populator, add `period_summary` to the `ResetDatabase` truncate list.
- [ ] **Step 4: Run** `./mvnw test -Dtest='PeriodSummaryPersistenceIT' -Dmezo.test.use-testcontainers=true` — PASS
- [ ] **Step 5: Commit** `feat(companion): period_summary table + entity (mezo-b3pp.13)`

## Task 2: `MemoryEmbeddingWriter.writePeriodSummary` + `KIND_MONTHLY_SUMMARY`

**Files:**
- Modify: `MemoryEmbeddingEntity`, `MemoryEmbeddingWriter`
- Test: extend `embedding/MemoryEmbeddingWriterIT`

**Interfaces produced:**
- `MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY = "monthly_summary"`
- `MemoryEmbeddingWriter.writePeriodSummary(PeriodSummaryEntity summary)` — kind
  `weekly_summary`/`monthly_summary` from the row's granularity, `ref_id` = the row id,
  `occurred_on` = `period_start`, re-embeds IN PLACE (`upsert`, so a regenerated period text
  refreshes the vector instead of orphaning it).

- [ ] **Step 1:** IT: writing a `week` row yields a `weekly_summary` vector at `occurred_on =
  period_start`; a second call with edited text updates content in place (still one row).
- [ ] **Step 2:** Run — red.
- [ ] **Step 3:** Implement (reuse the private `upsert`).
- [ ] **Step 4:** Run `-Dtest='MemoryEmbeddingWriterIT'` — PASS
- [ ] **Step 5:** Commit `feat(companion): embed period summaries (mezo-b3pp.13)`

## Task 3: `PeriodSummaryService` — weekly + monthly condensation

**Files:**
- Create: `PeriodSummaryService`
- Modify: `FakeCompanionLlm` (marker dispatch + `[fake-period:…]` sentinel, default
  `FAKE-KONSZOLIDACIO`)
- Test: `PeriodSummaryServiceIT`

**Interfaces produced:**
- `PeriodSummaryService.WEEKLY_MARKER = "HETI-KONSZOLIDACIO-FELADAT"`,
  `MONTHLY_MARKER = "HAVI-KONSZOLIDACIO-FELADAT"`
- `PeriodSummaryEntity generateWeek(UUID userId, LocalDate weekStart)` — `null` when the week
  `[weekStart, +6]` has no daily summaries; returns the existing row untouched (no LLM call) when
  one exists; otherwise one cheap-tier call under
  `LlmCallContext("companion_consolidation", "weekly", null, null)`.
- `PeriodSummaryEntity generateMonth(UUID userId, LocalDate monthStart)` — same shape over the
  month's `week` rows, operation `monthly`.

- [ ] **Step 1:** IT: week with 3 daily summaries → row + `weekly_summary` vector; idempotent
  second call (same id, LLM call count unchanged); empty week → `null` + no row; month over two
  weekly rows → `month` row + `monthly_summary` vector; month with no weekly rows → `null`.
- [ ] **Step 2:** Run — red.
- [ ] **Step 3:** Implement (deterministic gather = dated lines of the source prose; LLM = pure
  prose, NFR-M-4).
- [ ] **Step 4:** Run `-Dtest='PeriodSummaryServiceIT'` — PASS
- [ ] **Step 5:** Commit `feat(companion): weekly/monthly consolidation service (mezo-b3pp.13)`

## Task 4: `ConsolidationJob` + config + switch (backfill on every run)

**Files:**
- Create: `ConsolidationJob`, `ConsolidationJobSwitchOffIT`, `ConsolidationPropertiesIT`,
  `ConsolidationJobIT`
- Modify: `CompanionProperties` (`Consolidation`), `FeaturesConfiguration`, `application.yml`

**Interfaces produced:**
- `FeaturesConfiguration.CONSOLIDATION_JOB_SWITCH = "mezo.techcore.cron.consolidation-job.enabled"`
- `CompanionProperties.Consolidation(String weeklyCron, String monthlyCron, int backfillWeeks,
  int backfillMonths)` — yml `0 30 3 * * MON` / `0 50 3 1 * *` / `8` / `3`
- `ConsolidationJob.runWeekly()` / `runMonthly()` — per-user isolation, backfill over the window.

- [ ] **Step 1:** ITs: `runWeekly` fills every week in the backfill window that has daily
  summaries and skips the ones that don't; a second run adds nothing (idempotent); one failing user
  does not abort the run; switch off ⇒ no bean; properties bind from yml.
- [ ] **Step 2:** Run — red.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `-Dtest='ConsolidationJobIT,ConsolidationJobSwitchOffIT,ConsolidationPropertiesIT'` — PASS
- [ ] **Step 5:** Commit `feat(companion): consolidation cron + config (mezo-b3pp.13)`

## Task 5: Recall shadowing in `PromptMemoryAssembler`

**Files:**
- Modify: `MemoryEmbeddingAnnQuery`, `PromptMemoryAssembler`, `CompanionProperties.AmbientRecall`,
  `application.yml`
- Test: `PromptMemoryAssemblerShadowIT`, extend `PromptMemoryAssemblerTest` (render labels)

**Interfaces produced:**
- `MemoryEmbeddingAnnQuery.nearestInKindsSince(UUID userId, Collection<String> kinds, String
  queryVector, int k, LocalDate notBefore)` — same savepoint contract, `occurred_on >= :notBefore`.
- `AmbientRecall.capPeriodSummary` (default 2) and `weeklyShadowDays` (default 30).
- `PromptMemoryAssembler.KINDS_PERIOD_SUMMARY = [weekly_summary, monthly_summary]`, queried
  unrestricted; the daily-summary group queried with `notBefore = today - weeklyShadowDays`.

- [ ] **Step 1:** IT: a 60-day-old `daily_summary` and its covering `weekly_summary` both seeded ⇒
  the block carries the weekly line and NOT the old daily one, while the old daily row still exists
  in the table (nothing deleted); a 5-day-old daily hit still renders; `capPeriodSummary=0` ⇒ the
  group is not queried.
- [ ] **Step 2:** Run — red.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `-Dtest='PromptMemoryAssembler*'` — PASS
- [ ] **Step 5:** Commit `feat(companion): weekly shadowing in ambient recall (mezo-b3pp.13)`

## Task 6: Docs + codemap + full focused gate

**Files:** `docs/features/companion.md`, `docs/CODEMAP.md` (generated)

- [ ] **Step 1:** companion.md: new `### Backend tables (W3.2 consolidation ladder, ✅ mezo-b3pp.13)`
  block (table + job + shadowing rule + "nothing deleted"), config keys, §8 testing entries, §10 key
  files, §9 decisions (occurred_on = period_start; cheap tier; cutoff semantics).
- [ ] **Step 2:** `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs` — no new staleness.
- [ ] **Step 3:** `./mvnw clean test -Dtest='<all slice ITs + ArchUnitTest + LiquibaseIT>'` — PASS
- [ ] **Step 4:** Commit `docs(companion): W3.2 consolidation ladder (mezo-b3pp.13)`
