# LLM Audit Log Retention Implementation Plan (mezo-1y3p)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nightly job that NULLs the 4 payload columns of `llm_log_history` rows older than 90 days while keeping all cost/token metadata forever, with an honest "scrubbed" state on the `/me/ai-usage` detail page.

**Architecture:** One new `payload_scrubbed_at timestamptz` column + one idempotent bulk-UPDATE repository method, driven by a `@Scheduled` `LlmLogRetentionJob` on the house techcore-cron pattern. Contract-first `payloadScrubbedAt` on the call-detail DTO; FE renders an explicit retention notice.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven, Liquibase, Spring Data JPA (`@Modifying` JPQL), MapStruct-style default-method mapper, OpenAPI contract-first, React 19 + vitest + msw.

**Spec:** `docs/superpowers/specs/2026-08-18-llm-log-retention-design.md`

## Global Constraints

- Branch: `feat/llm-log-retention` (exists), driving bd id `mezo-1y3p` in every commit subject.
- Backend tests: ALWAYS `./mvnw clean test` (Lombok+MapStruct incremental compile is flaky); run from `backend/`. Focused runs: `./mvnw clean test -Dtest=ClassName`.
- Integration-first: extend `AbstractIntegrationTest` (service/repo level) or `ApiIntegrationTest` (HTTP level), AssertJ only, `test{Method}_should{Result}_when{Condition}` naming, no mocks/H2.
- Liquibase: never modify released changesets; new script `202608181100_mezo-1y3p_llm_log_payload_scrubbed_at.sql` + a `1.0.0_master.yml` entry.
- Config: everything under the `mezo:` root, `@Validated` properties records, never `@Value`.
- Contract-first: edit `api/feature/llm-usage/llm-usage.yml` BEFORE backend/FE code; merge with `cd api/generate && npm run generate:api`; FE types with `cd frontend && pnpm generate:api`; backend Java DTOs regenerate inside `./mvnw` runs.
- Frontend: read `docs/references/frontend_conventions.md` before touching `frontend/src`; gate = `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green).
- Everything runs in the worktree `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/phase-3-status-b1a9fa` — never cd to the primary repo.

---

### Task 1: The scrub primitive — migration, entity column, repository method

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608181100_mezo-1y3p_llm_log_payload_scrubbed_at.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append at end)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/entity/LlmLogEntity.java` (payload section, after `payloadBytes`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/LlmLogPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRetentionScrubIT.java` (create)

**Interfaces:**
- Consumes: existing `LlmLogPopulator.logAt(...)` back-dating trick (`jdbcTemplate` rewrite of `created_at`).
- Produces: `int LlmLogRepository.scrubPayloadsOlderThan(Instant cutoff, Instant now)`; `Instant LlmLogEntity.getPayloadScrubbedAt()`; `LlmLogPopulator.logPayloadAt(Instant createdAt, UUID createdBy, String feature, String systemPrompt, String userMessage, String responseText)` — Task 2 and 3 rely on all three.

- [ ] **Step 1: Add the payload-carrying populator overload**

In `LlmLogPopulator`, after `logAt(...)`:

```java
    /**
     * Payload-carrying, back-dated row for the retention tests (mezo-1y3p) — the scrub target:
     * all four payload columns filled, cost metadata present, created_at rewritten into the past.
     */
    public LlmLogEntity logPayloadAt(Instant createdAt, UUID createdBy, String feature,
            String systemPrompt, String userMessage, String responseText) {
        LlmLogEntity entity = new LlmLogEntity();
        entity.setCreatedBy(createdBy);
        entity.setCallKind(CallKind.CHAT);
        entity.setFeature(feature);
        entity.setRequestedModel("gemini-2.5-flash");
        entity.setServedModel("gemini-2.5-flash");
        entity.setStatus(CallStatus.SUCCESS);
        entity.setLatencyMs(100);
        entity.setPromptTokens(10);
        entity.setCandidatesTokens(5);
        entity.setTotalTokens(15);
        entity.setCostUsd(new BigDecimal("0.000123"));
        entity.setSystemPrompt(systemPrompt);
        entity.setConversationHistory("korábbi körök");
        entity.setUserMessage(userMessage);
        entity.setResponseText(responseText);
        entity.setPayloadBytes(64);
        LlmLogEntity saved = llmLogRepository.saveAndFlush(entity);
        jdbcTemplate.update("update llm_log_history set created_at = ? where id = ?",
            Timestamp.from(createdAt), saved.getId());
        return saved;
    }
```

- [ ] **Step 2: Write the failing IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRetentionScrubIT.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** The mezo-1y3p scrub primitive: payload leaves, cost metadata stays, the stamp is honest. */
class LlmLogRetentionScrubIT extends AbstractIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-08-18T02:40:00Z");
    private static final Instant CUTOFF = NOW.minus(90, ChronoUnit.DAYS);

    @Autowired private LlmLogRepository llmLogRepository;

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldNullPayloadAndKeepCost_whenRowOlderThanCutoff() {
        UUID owner = ownerId();
        LlmLogEntity old = llmLogPopulator.logPayloadAt(CUTOFF.minus(1, ChronoUnit.DAYS), owner,
            "companion_chat", "sys", "user", "resp");

        int scrubbed = llmLogRepository.scrubPayloadsOlderThan(CUTOFF, NOW);

        assertThat(scrubbed).isEqualTo(1);
        LlmLogEntity reloaded = llmLogRepository.findById(old.getId()).orElseThrow();
        assertThat(reloaded.getSystemPrompt()).isNull();
        assertThat(reloaded.getConversationHistory()).isNull();
        assertThat(reloaded.getUserMessage()).isNull();
        assertThat(reloaded.getResponseText()).isNull();
        assertThat(reloaded.getPayloadScrubbedAt()).isEqualTo(NOW);
        // the founding purpose survives: cost/token metadata is forever
        assertThat(reloaded.getCostUsd()).isEqualByComparingTo(new BigDecimal("0.000123"));
        assertThat(reloaded.getPromptTokens()).isEqualTo(10);
        assertThat(reloaded.getTotalTokens()).isEqualTo(15);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldLeaveRowUntouched_whenInsideWindow() {
        LlmLogEntity fresh = llmLogPopulator.logPayloadAt(CUTOFF.plus(1, ChronoUnit.DAYS), ownerId(),
            "companion_chat", "sys", "user", "resp");

        int scrubbed = llmLogRepository.scrubPayloadsOlderThan(CUTOFF, NOW);

        assertThat(scrubbed).isZero();
        LlmLogEntity reloaded = llmLogRepository.findById(fresh.getId()).orElseThrow();
        assertThat(reloaded.getSystemPrompt()).isEqualTo("sys");
        assertThat(reloaded.getPayloadScrubbedAt()).isNull();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldNotRestamp_whenRowAlreadyScrubbed() {
        LlmLogEntity old = llmLogPopulator.logPayloadAt(CUTOFF.minus(2, ChronoUnit.DAYS), ownerId(),
            "companion_chat", "sys", "user", "resp");
        llmLogRepository.scrubPayloadsOlderThan(CUTOFF, NOW);

        Instant later = NOW.plus(1, ChronoUnit.DAYS);
        int second = llmLogRepository.scrubPayloadsOlderThan(CUTOFF, later);

        assertThat(second).isZero();
        assertThat(llmLogRepository.findById(old.getId()).orElseThrow().getPayloadScrubbedAt())
            .isEqualTo(NOW); // the first stamp is stable — idempotence
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldSkipRow_whenNoPayloadEverExisted() {
        // an embed-style row: no payload columns were ever written
        LlmLogEntity embed = llmLogPopulator.logAt(CUTOFF.minus(3, ChronoUnit.DAYS), ownerId(),
            CallKind.EMBED_DOC, "memory_embedding", "gemini-embedding-001", 0, 0, null, null);

        int scrubbed = llmLogRepository.scrubPayloadsOlderThan(CUTOFF, NOW);

        assertThat(scrubbed).isZero();
        assertThat(llmLogRepository.findById(embed.getId()).orElseThrow().getPayloadScrubbedAt())
            .isNull(); // the stamp means "something was removed here" — never set vacuously
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldScrubErrorRow_whenOlderThanCutoff() {
        LlmLogEntity error = llmLogPopulator.logError(ownerId(), CallKind.CHAT, "companion_chat",
            "gemini-2.5-flash", "429");
        // logError has no payload — write one, then back-date, mirroring a failed call whose
        // request-side prompt WAS captured (ADR 0014: request facts survive on ERROR rows)
        jdbcTemplate.update(
            "update llm_log_history set user_message = 'lost prompt', created_at = ? where id = ?",
            java.sql.Timestamp.from(CUTOFF.minus(1, ChronoUnit.DAYS)), error.getId());

        int scrubbed = llmLogRepository.scrubPayloadsOlderThan(CUTOFF, NOW);

        assertThat(scrubbed).isEqualTo(1);
        assertThat(llmLogRepository.findById(error.getId()).orElseThrow().getUserMessage()).isNull();
    }
}
```

Notes for the implementer: `AbstractIntegrationTest` already exposes the populators and `ownerId()`/`jdbcTemplate` — check its fields; if `llmLogPopulator` or `jdbcTemplate` is not already a protected member, `@Autowired` them locally in this test class the way `LlmLogRepositoryIT` does. Adjust only wiring, not assertions.

- [ ] **Step 3: Run the IT — expect compile failure**

```bash
cd backend && ./mvnw clean test -Dtest=LlmLogRetentionScrubIT
```

Expected: compile error — `scrubPayloadsOlderThan` and `getPayloadScrubbedAt` do not exist.

- [ ] **Step 4: Migration + master changelog entry**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202608181100_mezo-1y3p_llm_log_payload_scrubbed_at.sql`:

```sql
-- mezo-1y3p: retention scrub stamp. NULL = payload intact (or never present — embed rows);
-- non-null = the 4 payload columns were hard-removed by retention at this instant. The column
-- is the honest marker the /me/ai-usage detail view renders. Cost/token metadata is never
-- scrubbed — ADR 0014's founding purpose (cost attribution) is retention-proof.
alter table llm_log_history add column payload_scrubbed_at timestamptz;
```

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202608181100_mezo-1y3p_llm_log_payload_scrubbed_at"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608181100_mezo-1y3p_llm_log_payload_scrubbed_at.sql
```

- [ ] **Step 5: Entity field**

In `LlmLogEntity`, at the end of the `── payload ──` section (after `payloadBytes`):

```java
    /**
     * mezo-1y3p retention stamp: when the nightly job hard-removed the four payload columns.
     * Null = payload intact, or never present (embed rows) — the honest distinction the
     * detail view renders. Never set vacuously: only rows that actually lost text get stamped.
     */
    @Column(name = "payload_scrubbed_at")
    private Instant payloadScrubbedAt;
```

(`java.time.Instant` is already imported for `createdAt`.)

- [ ] **Step 6: Repository method**

In `LlmLogRepository`, add imports `org.springframework.data.jpa.repository.Modifying` and add at the end of the interface:

```java
    /**
     * The mezo-1y3p retention primitive: one idempotent bulk UPDATE that NULLs the four payload
     * columns of every row older than {@code cutoff} and stamps {@code payloadScrubbedAt}. The
     * payload-presence predicate keeps the stamp honest (embed rows are never stamped) and the
     * {@code payloadScrubbedAt is null} guard makes re-runs free. Everything else on the row —
     * cost, tokens, pricing snapshot, attribution — is deliberately untouched, forever.
     */
    @Modifying(clearAutomatically = true)
    @Query("""
        update LlmLogEntity l
        set l.systemPrompt = null,
            l.conversationHistory = null,
            l.userMessage = null,
            l.responseText = null,
            l.payloadScrubbedAt = :now
        where l.createdAt < :cutoff
          and l.payloadScrubbedAt is null
          and (l.systemPrompt is not null
            or l.conversationHistory is not null
            or l.userMessage is not null
            or l.responseText is not null)
        """)
    int scrubPayloadsOlderThan(@Param("cutoff") Instant cutoff, @Param("now") Instant now);
```

Also update the interface javadoc line "Retention pruning arrives with a later task." → "Retention scrubbing: {@link #scrubPayloadsOlderThan} (mezo-1y3p)."

Note: a Spring Data `@Modifying` query outside a caller transaction needs one — the repository method will be invoked from the job's `@Transactional` method (Task 2). In this IT, call it directly; if Spring throws `TransactionRequiredException`, wrap the call in the test with `TransactionTemplate` (`@Autowired PlatformTransactionManager` → `new TransactionTemplate(txManager).execute(s -> llmLogRepository.scrubPayloadsOlderThan(cutoff, now))`). Use whichever the framework requires — assertions stay identical.

- [ ] **Step 7: Run the IT — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest=LlmLogRetentionScrubIT
```

Expected: all 5 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(llmlog): payload_scrubbed_at column + idempotent scrub primitive (mezo-1y3p)"
```

---

### Task 2: Config + the nightly LlmLogRetentionJob

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/config/LlmLogProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (near `LLM_LOG_SWITCH`, ~line 153)
- Modify: `backend/src/main/resources/application.yml` (two spots: `mezo.techcore.cron` block + `mezo.llm-log` block)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRetentionJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRetentionJobIT.java` (create)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRetentionJobSwitchOffIT.java` (create)

**Interfaces:**
- Consumes: `LlmLogRepository.scrubPayloadsOlderThan(Instant, Instant)` and `LlmLogPopulator.logPayloadAt(...)` from Task 1.
- Produces: `LlmLogRetentionJob.run()` (public, no args); `LlmLogProperties.retention().payloadDays()`; constant `FeaturesConfiguration.LLM_LOG_RETENTION_JOB_SWITCH`.

- [ ] **Step 1: Write the two failing ITs**

`backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRetentionJobIT.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** mezo-1y3p: the nightly job end-to-end — 90-day window from live config, scrub through the bean. */
class LlmLogRetentionJobIT extends AbstractIntegrationTest {

    @Autowired private LlmLogRetentionJob llmLogRetentionJob;
    @Autowired private LlmLogRepository llmLogRepository;

    @Test
    void testRun_shouldScrubOldAndSpareFresh_whenWindowIs90Days() {
        LlmLogEntity old = llmLogPopulator.logPayloadAt(
            Instant.now().minus(91, ChronoUnit.DAYS), ownerId(), "companion_chat", "s", "u", "r");
        LlmLogEntity fresh = llmLogPopulator.logPayloadAt(
            Instant.now().minus(89, ChronoUnit.DAYS), ownerId(), "companion_chat", "s", "u", "r");

        llmLogRetentionJob.run();

        assertThat(llmLogRepository.findById(old.getId()).orElseThrow().getPayloadScrubbedAt())
            .isNotNull();
        assertThat(llmLogRepository.findById(fresh.getId()).orElseThrow().getPayloadScrubbedAt())
            .isNull();
    }
}
```

`backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRetentionJobSwitchOffIT.java` (mirrors `DailySummaryJobSwitchOffIT`):

```java
package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Job switch off ⇒ the cron bean does not exist (no scheduled scrub can ever fire). */
@TestPropertySource(properties = "mezo.techcore.cron.llm-log-retention-job.enabled=false")
class LlmLogRetentionJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanProvider(LlmLogRetentionJob.class).getIfAvailable()).isNull();
    }
}
```

(Same populator-wiring note as Task 1 Step 2 applies.)

- [ ] **Step 2: Run them — expect compile failure**

```bash
cd backend && ./mvnw clean test -Dtest='LlmLogRetentionJob*IT'
```

Expected: compile error — `LlmLogRetentionJob` does not exist.

- [ ] **Step 3: Properties record**

In `LlmLogProperties`: add `import jakarta.validation.constraints.NotBlank;`, extend the record signature with a fourth component `@NotNull @Valid Retention retention`, and add the nested record after `Executor`:

```java
    /**
     * mezo-1y3p payload retention: the four payload columns are NULLed after {@code payloadDays};
     * cost/token metadata is kept forever (the ADR 0014 founding purpose is retention-proof).
     */
    public record Retention(@Positive int payloadDays, @NotBlank String cron) {}
```

- [ ] **Step 4: Switch constant**

In `FeaturesConfiguration`, directly under the `LLM_LOG_SWITCH` block (~line 153):

```java
    /** mezo-1y3p LLM-log payload retention cron — off ⇒ the LlmLogRetentionJob bean does not exist.
     *  Deliberately independent of {@link #LLM_LOG_SWITCH}: payload already on disk keeps aging
     *  even while recording is off. */
    public static final String LLM_LOG_RETENTION_JOB_SWITCH =
        "mezo.techcore.cron.llm-log-retention-job.enabled";
```

- [ ] **Step 5: application.yml — two blocks**

In the `mezo.techcore.cron` block (after the `notification-dispatch-job` entry):

```yaml
      # mezo-1y3p LLM-log payload retention (schedule: mezo.llm-log.retention.cron);
      # off = the LlmLogRetentionJob bean does not exist. Deliberately independent of
      # mezo.feature.llm-log.enabled: already-written payload keeps aging while recording is off.
      llm-log-retention-job:
        enabled: true
```

In the `mezo.llm-log` block (after `executor`):

```yaml
    # mezo-1y3p payload retention — the 4 payload columns are NULLed after this many days;
    # cost/token metadata is kept forever (cost attribution, ADR 0014). 03:40 is a verified-free
    # slot: the dawn cron cluster sits at 02:20/02:40/03:00(SUN), the proactive block starts 05:45.
    retention:
      payload-days: 90
      cron: "0 40 3 * * *"
```

- [ ] **Step 6: The job**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRetentionJob.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The mezo-1y3p nightly retention scrub: NULLs the four payload columns of audit rows older than
 * {@code mezo.llm-log.retention.payload-days}, stamping {@code payload_scrubbed_at}. Hard and
 * irreversible by design — ADR 0014's standing exception to soft delete; no row is ever deleted,
 * so cost history (and the {@code created_by on delete set null} property) is untouched.
 *
 * <p>Deliberately NOT conditioned on {@code mezo.feature.llm-log.enabled}: the write switch and
 * the retention switch are independent — payload already on disk keeps aging while recording
 * is off.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LLM_LOG_RETENTION_JOB_SWITCH, havingValue = "true")
public class LlmLogRetentionJob {

    private final LlmLogRepository llmLogRepository;
    private final LlmLogProperties properties;

    @Transactional
    @Scheduled(cron = "${mezo.llm-log.retention.cron}")
    public void run() {
        Instant now = Instant.now();
        Instant cutoff = now.minus(Duration.ofDays(properties.retention().payloadDays()));
        int scrubbed = llmLogRepository.scrubPayloadsOlderThan(cutoff, now);
        if (scrubbed > 0) {
            log.info("LLM-log retention: scrubbed payload of {} row(s) older than {}", scrubbed, cutoff);
        }
    }
}
```

- [ ] **Step 7: Run the ITs — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest='LlmLogRetentionJob*IT'
```

Expected: both classes PASS. (If the whole-context boot fails on property binding, the yml indentation in Step 5 is the first suspect.)

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(llmlog): nightly LlmLogRetentionJob behind techcore-cron switch (mezo-1y3p)"
```

---

### Task 3: Contract + mapper — `payloadScrubbedAt` on the call detail

**Files:**
- Modify: `api/feature/llm-usage/llm-usage.yml` (`LlmCallDetailResponse.properties`)
- Regenerate: `api/openapi.yml` (via `cd api/generate && npm run generate:api`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/mapper/LlmLogMapper.java`
- Regenerate: `frontend/src/data/_client/api.gen.ts` (via `cd frontend && pnpm generate:api`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmCallDetailIT.java` (extend)

**Interfaces:**
- Consumes: `LlmLogEntity.getPayloadScrubbedAt()` (Task 1); existing `toOffset(Instant)` mapper helper (null-safe).
- Produces: `LlmCallDetailResponse.payloadScrubbedAt` (`OffsetDateTime`, nullable) in the generated backend DTO and `payloadScrubbedAt?: string | null` in the FE `api.gen.ts` — Task 4 reads it.

- [ ] **Step 1: Contract edit FIRST**

In `api/feature/llm-usage/llm-usage.yml`, inside `LlmCallDetailResponse.properties`, directly after the `payloadBytes` line:

```yaml
        payloadScrubbedAt: { type: string, format: date-time, nullable: true, description: "when the mezo-1y3p retention job hard-removed the payload columns; null = payload intact or never present (embed rows)" }
```

- [ ] **Step 2: Merge the contract**

```bash
cd api/generate && npm run generate:api
```

Expected: `api/openapi.yml` regenerated, diff shows the new property.

- [ ] **Step 3: Extend the failing backend IT**

In `LlmCallDetailIT`, add (follow the file's existing helper/auth idiom — it extends `ApiIntegrationTest`; reuse its populator wiring and GET helper exactly as the neighboring tests do):

```java
    @Test
    void testGetCallDetail_shouldExposeScrubStamp_whenPayloadScrubbed() {
        LlmLogEntity old = llmLogPopulator.logPayloadAt(
            Instant.now().minus(91, ChronoUnit.DAYS), ownerId(), "companion_chat", "s", "u", "r");
        llmLogRetentionJob.run();

        LlmCallDetailResponse detail = getForObject(
            "/api/llm-usage/calls/" + old.getId(), LlmCallDetailResponse.class);

        assertThat(detail.getPayloadScrubbedAt()).isNotNull();
        assertThat(detail.getSystemPrompt()).isNull();
        assertThat(detail.getResponseText()).isNull();
        assertThat(detail.getCostUsd()).isNotNull(); // cost metadata survives on the wire too
    }
```

Adjust the HTTP-helper call shape (`getForObject` vs the class's actual verb helper + `ownerAuthHeaders()`) to match the existing tests in that file — assertions stay identical. `@Autowired LlmLogRetentionJob llmLogRetentionJob;` into the class.

- [ ] **Step 4: Run it — expect FAIL**

```bash
cd backend && ./mvnw clean test -Dtest=LlmCallDetailIT
```

Expected: compile error on `getPayloadScrubbedAt()` until `generate-sources` picks up the merged contract (the mvn run regenerates DTOs first — then the assertion fails because the mapper never sets the field, `payloadScrubbedAt` is null... actually the row IS scrubbed and the mapper omits the field ⇒ null ⇒ `isNotNull()` FAILS. Either failure mode is the expected red.)

- [ ] **Step 5: Mapper line**

In `LlmLogMapper.toDetail(...)`, after `.payloadBytes(e.getPayloadBytes())`:

```java
            .payloadScrubbedAt(toOffset(e.getPayloadScrubbedAt()))
```

- [ ] **Step 6: Run it — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest=LlmCallDetailIT
```

Expected: PASS (all tests in the class, old and new).

- [ ] **Step 7: FE types**

```bash
cd frontend && pnpm generate:api
```

Expected: `src/data/_client/api.gen.ts` diff contains `payloadScrubbedAt`.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(api): payloadScrubbedAt on the LLM call detail contract (mezo-1y3p)"
```

---

### Task 4: FE — honest scrubbed state on AiCallDetailPage

**Read `docs/references/frontend_conventions.md` before this task.**

**Files:**
- Modify: `frontend/src/features/me/pages/AiCallDetailPage.tsx` (payload card, ~line 99-108)
- Test: `frontend/src/features/me/pages/AiCallDetailPage.test.tsx` (extend)

**Interfaces:**
- Consumes: `data.payloadScrubbedAt` (`string | null | undefined`) from the regenerated `api.gen.ts` detail type; existing `formatDateTime` already imported in the page.

- [ ] **Step 1: Write the failing test**

In `AiCallDetailPage.test.tsx` there is a real-mode describe block using `server.use(http.get(...))` with a detail payload (find it — the mock-mode block shown at the top of the file has a real-mode sibling; if none exists, add one following `AiCallRow.test.tsx`'s msw idiom). Add:

```tsx
  it('shows the retention notice instead of silent empty payload when scrubbed', async () => {
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/${LLM_CALL_DETAIL_MOCK.id}`, () =>
        HttpResponse.json({
          ...LLM_CALL_DETAIL_MOCK,
          systemPrompt: null,
          userMessage: null,
          responseText: null,
          payloadScrubbedAt: '2026-08-18T02:40:00Z',
        }),
      ),
    )
    renderDetail()
    expect(await screen.findByText(/retention törölte/)).toBeInTheDocument()
  })
```

(If the file's real-mode block stubs `VITE_USE_MOCK` to `'false'` in its own `beforeEach`, put the test there; keep `afterEach(() => vi.unstubAllEnvs())` behavior intact.)

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && pnpm vitest run src/features/me/pages/AiCallDetailPage.test.tsx
```

Expected: FAIL — the notice text does not exist.

- [ ] **Step 3: Implement the notice**

In `AiCallDetailPage.tsx`, inside the payload card, directly after the `{data.truncated && (...)}` block:

```tsx
        {data.payloadScrubbedAt && (
          <p className="text-tertiary" style={{ fontSize: 10, fontWeight: 700, marginTop: 8 }}>
            A prompt/válasz szövegét a retention törölte — {formatDateTime(data.payloadScrubbedAt)}.
            A költség- és token-adatok megmaradtak.
          </p>
        )}
```

(Config-agnostic copy on purpose — no hardcoded "90 nap", the window is config. This is a deliberate small deviation from the spec's sample copy.)

- [ ] **Step 4: Run — expect PASS, then both full gates**

```bash
cd frontend && pnpm vitest run src/features/me/pages/AiCallDetailPage.test.tsx
```

Expected: PASS. Then the full FE gate:

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: build green, both modes green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(me): honest retention-scrubbed state on the AI call detail (mezo-1y3p)"
```

---

### Task 5: Docs, full gates, ship

**Files:**
- Modify: `docs/decisions/0014-llm-call-audit-log.md` (Consequences bullet "The table only grows…")
- Modify: `docs/features/companion.md` (LLM audit log section — find with `grep -n "llm_log_history" docs/features/companion.md`)
- Modify: `docs/milestones/roadmap.md` (Milestone log table, new top row)
- Modify: `CLAUDE.md` — no change needed here; skip.

- [ ] **Step 1: ADR 0014 Consequences update**

Replace the bullet:

> - **The table only grows.** Nothing prunes it yet, and prompts/responses are stored (capped at `mezo.llm-log.max-payload-chars`, with the true pre-truncation byte size kept in `payload_bytes` so the cut is visible). Retention is the first follow-up.

with:

> - **Retention (mezo-1y3p, 2026-08-18): payload ages out, cost never does.** The nightly `LlmLogRetentionJob` NULLs the four payload columns of rows older than `mezo.llm-log.retention.payload-days` (90) and stamps `payload_scrubbed_at`; token counters, `cost_usd` and `pricing_snapshot` are kept forever. The scrub is a hard UPDATE — this ADR's soft-delete exception stands; no row is deleted, so `created_by on delete set null` semantics are untouched. Design: [`2026-08-18-llm-log-retention-design.md`](../superpowers/specs/2026-08-18-llm-log-retention-design.md).

- [ ] **Step 2: companion.md LLM-audit section**

In the section describing `llm_log_history`, add one sentence describing retention (payload NULLed after 90 days by `LlmLogRetentionJob`, `payload_scrubbed_at` stamp, cost metadata forever, detail view renders the honest scrubbed state) and add `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRetentionJob.java` to the section's file pointers if it lists key files.

- [ ] **Step 3: Roadmap milestone row**

New top row in the Milestone log table of `docs/milestones/roadmap.md`:

```markdown
| 2026-08-18 | **LLM audit log retention — payload scrub, cost forever (`mezo-1y3p`)** — the ADR 0014 "table only grows" follow-up ships: nightly `LlmLogRetentionJob` (03:40, techcore-cron switch, independent of the llm-log write switch) NULLs the 4 payload columns of `llm_log_history` rows older than 90 days (`mezo.llm-log.retention.payload-days`) via one idempotent bulk UPDATE, stamping the new `payload_scrubbed_at`; token/cost/pricing-snapshot metadata is kept forever (cost attribution is retention-proof). Contract: `payloadScrubbedAt` on the call-detail; `/me/ai-usage` detail renders an explicit "retention törölte" state instead of silent empty payload. Spec: `2026-08-18-llm-log-retention-design.md`. |
```

- [ ] **Step 4: Docs lint**

```bash
node scripts/lint-docs.mjs
```

Expected: no NEW failures (4 pre-existing stale docs are known — bd `mezo-74iz`).

- [ ] **Step 5: Full backend focused gate + commit**

```bash
cd backend && ./mvnw clean test -Dtest='LlmLog*IT,LlmCall*IT,LlmUsage*IT'
```

Expected: PASS.

```bash
git add -A && git commit -m "docs: LLM-log retention — ADR 0014 consequences + feature doc + roadmap (mezo-1y3p)"
```

- [ ] **Step 6: Ship per house git workflow**

```bash
git push -u origin feat/llm-log-retention
```

Open the self-PR (CI gate — CI runs the FULL backend suite that this machine's plan-tasks only ran focused):

```bash
gh pr create --title "feat(llmlog): payload retention — scrub after 90 days, cost forever (mezo-1y3p)" --body "Implements docs/superpowers/specs/2026-08-18-llm-log-retention-design.md — nightly LlmLogRetentionJob NULLs payload columns older than 90 days, stamps payload_scrubbed_at, keeps all cost/token metadata; honest scrubbed state on /me/ai-usage detail.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Wait for CI green, then merge locally per CLAUDE.md (`git pull --rebase` on main FIRST, then `--no-ff` merge, push). Close the bd issue:

```bash
bd close mezo-1y3p && bd dolt push
```

---

## Self-Review Notes (done at plan-writing time)

- Spec coverage: §3.1→Task 1 Step 4, §3.2→Task 1 Steps 2/6, §3.3→Task 2 Steps 4/6, §3.4→Task 2 Steps 3/5, §3.5→Tasks 3+4, §3.6 tests 1–5→Task 1 IT + Task 2 JobIT, test 6→Task 3 Step 3, §3.7→Task 5.
- Deviation from spec, deliberate: FE copy is config-agnostic („retention törölte" + timestamp) instead of the spec's "90 napos" sample — the window is config, hardcoded copy would go stale.
- Type consistency: `scrubPayloadsOlderThan(Instant cutoff, Instant now)` used identically in Tasks 1/2/3; `payloadScrubbedAt` spelled identically in entity/JPQL/contract/mapper/FE.
- Known wiring unknowns are called out inline (populator field vs local `@Autowired`; `@Modifying` transaction requirement; the detail IT's verb-helper shape) with exact fallback instructions.
