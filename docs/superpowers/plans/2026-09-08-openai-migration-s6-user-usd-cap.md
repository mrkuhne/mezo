# S6 — Per-user rolling USD cap with graded degradation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Driving issue:** `mezo-ozri.6` (epic `mezo-ozri`)
**Spec:** [`docs/superpowers/specs/2026-09-06-openai-migration-design.md`](../specs/2026-09-06-openai-migration-design.md) §2 C1/C2/L1, §5, §7
**Branch:** `feat/llm-budget-cap`

**Goal:** Give every account a configurable rolling USD ceiling on LLM spend ($5 / 30 days by
default) that degrades service in three graded steps — cheaper model, suspended expensive
background generators, full AI pause — instead of silently running up an unbounded bill.

**Architecture:** The measurement already exists (`llm_log_history` + `LlmActorResolver` +
`UserFanOut`). S6 adds (a) one scalar repository read, `sumCostSince(userId, since)`, plus the
composite index it needs; (b) an `LlmBudgetGate` port in `feature/llmlog/context` implemented by
`LlmBudgetService` in `feature/llmlog/service`, which turns "spend so far vs. cap" into an
`LlmBudgetLevel`; (c) the decision itself inside `LlmCallContextHolder.runWith` — spec §C2's single
pre-flight chokepoint, through which all 56 tagged calls pass with the feature slug known and the
call not yet sent. `runWith` resolves the level **once per tagged operation** and binds it to the
thread beside the context, so `LlmModelRouter` can read it for free and route a degraded call onto
the cheap tier without a second database round trip.

**Tech Stack:** Java 21 records, Spring Boot 3 (`@ConfigurationProperties` + jakarta validation),
Spring Data JPA/HQL, Liquibase, JUnit 5 + AssertJ, Testcontainers-backed `AbstractIntegrationTest`.

## Global Constraints

- **Every tunable number lives in `application.yml`** and binds through a `@ConfigurationProperties`
  record. `@Value("${...}")` is banned by ArchUnit (`no_spring_value_annotation`).
- **Pricing / map keys in YAML are bracket-quoted** (`"[gpt-5.6-luna]"`) — the binder splits map
  keys on dots. Applies to any new map key introduced here.
- **No raw generic exceptions outside techcore** (ArchUnit `no_raw_generic_exceptions_outside_techcore`):
  every app-path failure is a `SystemRuntimeErrorException` carrying a `SystemMessage`.
- **`@Transactional` is method-level only**, never class-level (ArchUnit).
- **Feature slices stay cycle-free** (ArchUnit frozen rule). New code lives inside `feature/llmlog`
  and `feature/companion`; `companion → llmlog` is a pre-existing edge, `llmlog → companion` must
  never be introduced.
- **Prompt text must not be re-ordered** anywhere — `FakeCompanionLlm` dispatches on prompt
  prefixes (`CompanionMessageGenerator:75,100,114,139`) and the whole 178-IT fake surface rides on it.
  This slice touches no prompt.
- **`docs/CODEMAP.md` is generated and CI-gated**: after adding/renaming files under
  `backend/src/main/java/.../feature/**`, regenerate with `node scripts/gen-codemap.mjs` in the SAME
  change. Focused ITs do not run that gate locally.
- **Local runs are focused only.** The full backend IT suite is the CI job on the self-PR, not a
  local command. Where a local integration test is unavoidable, run it with
  `-Dmezo.test.use-testcontainers=true`.
- **No API-contract change in this slice** — no OpenAPI edit, no generated-client regeneration, no
  frontend change. (The FE-facing error copy is deliberately deferred; see Task 9.)

## Design decisions taken here (and why)

These are refinements the spec's §7 sketch did not settle. They follow the spec's own §7 amendment
of 2026-09-07 (model ids are provider-scoped), so they extend the design rather than contradict it.

| # | Decision | Why |
|---|---|---|
| D1 | The cycle is a **rolling window of `cycle-days` (default 30)**, not a calendar month. | The epic title says "rolling". A calendar month hands a heavy user a clean slate on the 1st regardless of how the previous 31 days went; a rolling window keeps the ceiling continuously true. One config key, one `Instant.now().minus(...)`. |
| D2 | The degrade target is **per provider**, not one flat `degrade-model` key: `<provider>.degrade-model`, empty ⇒ that provider's own `chat-model`. | The spec's §7 amendment (S4) established that a model id only means something to the vendor that serves it, and the Gemini block stays load-bearing under `provider: openai` (audio, vision, fallback). A flat key could hand the Gemini client a GPT id on a delegated transcribe call. |
| D3 | Degrading **ignores `feature-models`** (a preference) but still honours `call-kind-models` (a capability). | Same precedence argument the router already documents: dropping a vision override on a degraded turn would break the turn, not make it cheaper. |
| D4 | The 90% step **suspends a configured list of expensive features** rather than rate-limiting them. | Spec §C1 says "ritkítás" of the expensive proactive crons. There is no per-user cron scheduler to thin; every one of those jobs is an idempotent catch-up wrapped in `UserFanOut`'s per-user try/catch, so refusing the call at the chokepoint IS skipping that run, with no job-by-job code change. Documented as an amendment. |
| D5 | The cap **never applies to an unattributable call** (`created_by` null — no JWT principal and no `LlmActorContext`). | Nothing to bill it to and nothing to measure it against; failing such a call would break background work for a reason that cannot be reported to anybody. |
| D6 | With `mezo.feature.llm-log.enabled=false` the cap is **inert, and says so once at WARN**. | Spec §10.2 / L1: "aki kikapcsolja a logot, a capet is kikapcsolja — explicit, dokumentált következmény". Fail-closed was explicitly rejected. The one-time WARN is what makes it explicit rather than silent. |
| D7 | Failed calls (`status = ERROR`) **do not consume budget**. | bd `mezo-ozri.6`: "Provider-hiba és belső retry nem fogyaszt user-egységet". Mirrors `aggregateByFeatureSinceForUser`'s existing exclusion. |
| D8 | `admin_replay` is **exempt by default** (config list). | `LlmCallContext.FEATURE_ADMIN_REPLAY` is the owner's dry-run inspection tool; it bills the inspected user's spend but must not be blocked by that user's ceiling, or the owner loses the ability to inspect exactly the accounts that matter most. |

---

## File Structure

**Create**
| File | Responsibility |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetLevel.java` | The four graded states, plus `atLeast()`. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetGate.java` | Consumer-side port `LlmBudgetLevel levelFor(String feature)`, with an `OPEN` no-op constant. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetService.java` | The port's live implementation: actor → rolling spend → percentage → level; enforcement predicate. |
| `backend/src/main/resources/db/changelog/1.0.0/script/202609081100_mezo-ozri6_llm_log_created_by_index.sql` | `(created_by, created_at)` composite index the per-user rolling sum needs. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetServiceTest.java` | Unit: threshold arithmetic, exemptions, disabled states. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetPropertiesTest.java` | Unit: threshold-ordering validation. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetCapIT.java` | IT: one user crosses all three thresholds; the three steps fire in order. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetLogDisabledIT.java` | IT: `llm-log` off ⇒ the cap is inert (D6). |

**Modify**
| File | Change |
|---|---|
| `.../feature/llmlog/config/LlmLogProperties.java` | `+ @NotNull @Valid Budget budget` component + the `Budget` record. |
| `.../feature/llmlog/repository/LlmLogRepository.java` | `+ sumCostSince(userId, since, excluded)`. |
| `.../feature/llmlog/context/LlmCallContextHolder.java` | Gate consulted in `runWith`; second thread-local carrying the resolved level; `budgetLevel()` accessor. |
| `.../feature/companion/config/CompanionProperties.java` | `Llm.Tier` gains `String degradeModel`. |
| `.../feature/companion/llm/LlmModelRouter.java` | Degraded calls resolve to the degrade model. |
| `backend/src/main/resources/application.yml` | `mezo.llm-log.budget` block; `degrade-model` under both provider tiers. |
| `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` | Include the new changeset. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepositoryIT.java` | Coverage for `sumCostSince`. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmCallContextHolderTest.java` | Coverage for gate + level binding. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/LlmModelRouterTest.java` | Coverage for degraded routing. |
| `docs/decisions/0035-multi-user-account-model.md` | L1/L2 amendment. |
| `docs/features/companion.md` | The cap's behaviour + config surface. |
| `docs/CODEMAP.md` | Regenerated. |

---

### Task 1: `sumCostSince` — the per-user rolling spend scalar

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepository.java` (beside `aggregateByFeatureSinceForUser`, ~`:100`)
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609081100_mezo-ozri6_llm_log_created_by_index.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepositoryIT.java`

**Interfaces:**
- Produces: `BigDecimal LlmLogRepository.sumCostSince(Instant since, UUID userId, CallStatus excluded)` — never null (coalesced to `0`).

- [ ] **Step 1: Write the failing test**

Append to `LlmLogRepositoryIT`:

```java
    /**
     * The cap's only read (mezo-ozri.6): one user's priced spend inside the rolling window.
     * ERROR rows are excluded — a provider failure is not the user's money (bd mezo-ozri.6) — and
     * an unpriced row contributes nothing rather than making the whole sum null, because the cap
     * has to answer with a number on every call.
     */
    @Test
    void testSumCostSince_shouldCountOnlyThisUsersPricedSuccesses_whenTheWindowIsOpen() {
        UUID user = ownerId();
        UUID other = userPopulator.createUser("llm-budget-other@test.hu").getId();
        Instant since = Instant.now().minus(java.time.Duration.ofDays(30));

        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", 10, 5, null, new BigDecimal("1.50"));
        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", 10, 5, null, new BigDecimal("0.75"));
        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", 10, 5, null, null);
        llmLogPopulator.error(user, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", "RuntimeException", "boom");
        llmLogPopulator.log(other, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", 10, 5, null, new BigDecimal("9.99"));

        assertThat(llmLogRepository.sumCostSince(since, user, CallStatus.ERROR)).isEqualByComparingTo("2.25");
    }

    /** Rows older than the window are outside this cycle — the whole point of a rolling cap. */
    @Test
    void testSumCostSince_shouldIgnoreRowsOlderThanTheWindow_whenTheyPredateIt() {
        UUID user = ownerId();
        LlmLogEntity old = llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", 10, 5,
            null, new BigDecimal("4.00"));
        llmLogPopulator.backdate(old.getId(), Instant.now().minus(java.time.Duration.ofDays(40)));

        assertThat(llmLogRepository.sumCostSince(
            Instant.now().minus(java.time.Duration.ofDays(30)), user, CallStatus.ERROR))
            .isEqualByComparingTo("0");
    }

    /** No priced row at all is a confident ZERO here, not "unknown": a cap must decide. */
    @Test
    void testSumCostSince_shouldReturnZero_whenTheUserHasNoRows() {
        assertThat(llmLogRepository.sumCostSince(
            Instant.now().minus(java.time.Duration.ofDays(30)), UUID.randomUUID(), CallStatus.ERROR))
            .isEqualByComparingTo("0");
    }
```

Add the field `@Autowired private LlmLogPopulator llmLogPopulator;` and the imports
(`java.time.Instant`, `io.mrkuhne.mezo.support.populator.LlmLogPopulator`) if not present.

Inspect `LlmLogPopulator` first: it already has `log(...)` overloads. If it has no `error(...)` and
no `backdate(...)`, add them there in this task (the populator is test support for exactly this
aggregate):

```java
    /** An ERROR row: no tokens, no snapshot, no cost — the shape a failed provider call leaves. */
    public LlmLogEntity error(UUID createdBy, CallKind kind, String feature, String servedModel,
            String errorClass, String errorCode) {
        LlmLogEntity entity = new LlmLogEntity();
        entity.setCreatedBy(createdBy);
        entity.setCallKind(kind);
        entity.setFeature(feature);
        entity.setRequestedModel(servedModel);
        entity.setServedModel(servedModel);
        entity.setStatus(CallStatus.ERROR);
        entity.setErrorClass(errorClass);
        entity.setErrorCode(errorCode);
        return llmLogRepository.saveAndFlush(entity);
    }

    /** Moves a row's server-stamped created_at — @CreationTimestamp cannot be set through JPA. */
    public void backdate(UUID id, Instant createdAt) {
        jdbcTemplate.update("update llm_log_history set created_at = ? where id = ?",
            Timestamp.from(createdAt), id);
    }
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw -q test -Dtest=LlmLogRepositoryIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — `sumCostSince` does not exist (compilation error).

- [ ] **Step 3: Add the query**

In `LlmLogRepository`, directly after `aggregateByFeatureSinceForUser`:

```java
    /**
     * ONE user's priced spend inside the rolling budget window (mezo-ozri.6) — the only read the
     * per-user USD cap makes, and it makes it on the pre-flight path of every tagged LLM call, so
     * it must stay a single indexed scalar (idx_llm_log_history_created_by_created_at).
     *
     * <p>{@code coalesce} to zero rather than null on purpose: everywhere else in this repository a
     * null cost honestly means "unknown", but a cap has to DECIDE on every call, and "unknown"
     * would either block a user who has spent nothing or wave through one who has spent everything.
     * Unpriced rows therefore contribute nothing and the sum stays a number.
     *
     * <p>ERROR rows are excluded (bd mezo-ozri.6): a provider failure or an internal retry is not
     * the user's money.
     */
    @Query("""
        select coalesce(sum(coalesce(l.costUsd, 0)), 0)
        from LlmLogEntity l
        where l.createdAt >= :since and l.createdBy = :userId and l.status <> :excluded
        """)
    BigDecimal sumCostSince(@Param("since") Instant since, @Param("userId") UUID userId,
            @Param("excluded") CallStatus excluded);
```

- [ ] **Step 4: Add the index changeset**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202609081100_mezo-ozri6_llm_log_created_by_index.sql`:

```sql
-- mezo-ozri.6: the per-user rolling USD cap reads sum(cost_usd) for ONE account inside a moving
-- window on the PRE-FLIGHT path of every tagged LLM call. The table's existing indexes are all
-- (created_at) or (dimension, created_at); none of them leads with created_by, so that read would
-- degrade to a scan of the whole audit history as the log grows.
create index idx_llm_log_history_created_by_created_at
    on llm_log_history (created_by, created_at);
```

Register it in `1.0.0_master.yml`, copying the exact shape of the neighbouring `include:` entries
(open the file and mirror the last llm_log entry's formatting — `changelog-8z79`-style id, author,
`sqlFile` path — rather than inventing one).

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd backend && ./mvnw -q test -Dtest=LlmLogRepositoryIT -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepository.java \
        backend/src/main/resources/db/changelog backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepositoryIT.java \
        backend/src/test/java/io/mrkuhne/mezo/support/populator/LlmLogPopulator.java
git commit -m "feat(llmlog): per-user rolling spend scalar + its index (mezo-ozri.6)"
```

---

### Task 2: `LlmBudgetProperties` — every number from YAML

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/config/LlmLogProperties.java`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.llm-log:` block, after `retention:`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetPropertiesTest.java`

**Interfaces:**
- Produces: `LlmLogProperties.Budget` with accessors `enabled()`, `hardCapUsd()`, `cycleDays()`,
  `degradeAtPercent()`, `throttleAtPercent()`, `stopAtPercent()`, `throttledFeatures()`,
  `exemptFeatures()`; and `LlmLogProperties.budget()`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetPropertiesTest.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.context;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties.Budget;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * The cap's config contract (mezo-ozri.6). The three thresholds are only meaningful in ascending
 * order — a config that degrades at 90 and stops at 70 would jump straight to the pause and the
 * "cheaper model" step would never be reachable — and jakarta's per-field annotations cannot say
 * that, so the ordering is a cross-field @AssertTrue and this test is what proves it fails BOOT
 * rather than surfacing as a mysterious runtime behaviour.
 */
class LlmBudgetPropertiesTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private static Budget budget(int degrade, int throttle, int stop) {
        return new Budget(true, new BigDecimal("5.00"), 30, degrade, throttle, stop, Set.of(), Set.of());
    }

    @Test
    void testValidate_shouldAccept_whenTheThresholdsAscend() {
        assertThat(validator.validate(budget(70, 90, 100))).isEmpty();
    }

    @Test
    void testValidate_shouldReject_whenDegradeIsNotBelowThrottle() {
        assertThat(validator.validate(budget(95, 90, 100))).isNotEmpty();
    }

    @Test
    void testValidate_shouldReject_whenThrottleIsNotBelowStop() {
        assertThat(validator.validate(budget(70, 100, 100))).isNotEmpty();
    }

    /** Omitted lists bind as null; the compact constructor must make them empty, not NPE later. */
    @Test
    void testConstruct_shouldDefaultTheListsToEmpty_whenTheYamlOmitsThem() {
        Budget budget = new Budget(true, new BigDecimal("5.00"), 30, 70, 90, 100, null, null);

        assertThat(budget.throttledFeatures()).isEmpty();
        assertThat(budget.exemptFeatures()).isEmpty();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw -q test -Dtest=LlmBudgetPropertiesTest
```

Expected: FAIL — `LlmLogProperties.Budget` does not exist.

- [ ] **Step 3: Add the `Budget` record**

In `LlmLogProperties`, add the component `@NotNull @Valid Budget budget` to the record header (after
`retention`) and this nested record (imports: `jakarta.validation.constraints.AssertTrue`,
`jakarta.validation.constraints.DecimalMin`, `jakarta.validation.constraints.Max`,
`jakarta.validation.constraints.Min`, `java.math.BigDecimal`, `java.util.Set`):

```java
    /**
     * The per-user rolling USD cap (mezo-ozri.6, spec §C1). Reverses ADR 0035 §L1, which shipped
     * cost VISIBILITY only and explicitly rejected a per-account quota; §4 of the migration spec is
     * why — a heavy user costs ~$51/month against $10.46 of net revenue, so the ceiling is not
     * optional. Every number here is YAML, including the three thresholds and the cycle length,
     * because the honest p95 is not known until the beta produces one.
     */
    public record Budget(
        /** Master switch. Off ⇒ the gate answers OK for everyone and no spend read is issued. */
        boolean enabled,
        /** The ceiling for ONE account across ONE cycle, in the pricing block's currency. */
        @NotNull @DecimalMin("0.01") BigDecimal hardCapUsd,
        /**
         * The cycle is a ROLLING window of this many days ending now, not a calendar month: a
         * calendar reset would hand an account that burned the ceiling on the 31st a clean slate on
         * the 1st, and the ceiling exists precisely to stop that.
         */
        @Min(1) @Max(3650) int cycleDays,
        /** % of the cap at which calls route onto the cheap tier (spec §C1: 70). */
        @Min(1) @Max(100) int degradeAtPercent,
        /** % at which {@code throttledFeatures} are suspended (spec §C1: 90). */
        @Min(1) @Max(100) int throttleAtPercent,
        /** % at which every capped call is refused until the window rolls (spec §C1: 100). */
        @Min(1) @Max(1000) int stopAtPercent,
        /**
         * {@code LlmCallContext.feature()} slugs suspended from the throttle step up. The expensive
         * background generators, whose value is "nice to have tomorrow" rather than "the user is
         * waiting" — every one of them is an idempotent catch-up wrapped in {@code UserFanOut}'s
         * per-user try/catch, so refusing the call simply skips that run.
         */
        Set<String> throttledFeatures,
        /**
         * Slugs the cap never applies to. {@code admin_replay} by default: the owner's dry-run
         * inspection bills the INSPECTED user's spend, and blocking it would make exactly the
         * accounts worth inspecting the ones that cannot be inspected.
         */
        Set<String> exemptFeatures
    ) {
        /** The binder hands a record component null for an omitted key AND for an empty one. */
        public Budget {
            throttledFeatures = throttledFeatures == null ? Set.of() : Set.copyOf(throttledFeatures);
            exemptFeatures = exemptFeatures == null ? Set.of() : Set.copyOf(exemptFeatures);
        }

        /** Cross-field: the steps only mean anything ascending, and jakarta cannot say so per field. */
        @AssertTrue(message = "degrade-at-percent < throttle-cron-at-percent < stop-at-percent required")
        public boolean isThresholdsAscending() {
            return degradeAtPercent < throttleAtPercent && throttleAtPercent < stopAtPercent;
        }
    }
```

- [ ] **Step 4: Add the YAML block**

In `backend/src/main/resources/application.yml`, inside `mezo.llm-log:` after the `retention:` block
and before `pricing:`:

```yaml
    # mezo-ozri.6 per-user rolling USD cap (spec §C1/§C2). REVERSES ADR 0035 §L1, which shipped cost
    # visibility only: at the migration spec's §4 numbers a heavy account costs ~$51/month against
    # $10.46 of net revenue, so the ceiling is not optional. Enforced pre-flight in
    # LlmCallContextHolder.runWith — the one point where the feature is known and the call has not
    # gone out yet. NOTE (spec §L1): with mezo.feature.llm-log.enabled=false nothing is recorded, so
    # the cap has nothing to read and is INERT — turning the audit log off turns the cap off too.
    budget:
      enabled: true
      # The ceiling for one account per cycle. $5 (not the research's $4): the standard COGS is
      # $2.13-3.11, so $4 is scarcity rather than headroom; $5 leaves ~1.6-2.3x until the beta
      # produces a real p95.
      hard-cap-usd: 5.00
      # ROLLING window ending now, in days — not a calendar month (a calendar reset would clear an
      # account that burned the ceiling on the 31st).
      cycle-days: 30
      # The three graded steps, as a percentage of hard-cap-usd. Must ascend (validated at boot).
      degrade-at-percent: 70          # everything routes onto the provider's cheap tier
      throttle-cron-at-percent: 90    # the expensive background generators below are suspended
      stop-at-percent: 100            # every capped call is refused until the window rolls
      # Suspended from the throttle step up: the expensive generators nobody is waiting on. Each is
      # an idempotent catch-up inside UserFanOut's per-user try/catch, so a refusal just skips a run.
      throttled-features:
        - proactive_memoir
        - proactive_diagnosis
        - proactive_prediction
        - proactive_experiment
        - proactive_challenge
        - companion_weekly_review
        - companion_quarterly_review
      # Never capped: the owner's admin dry-run replay bills the INSPECTED user but must stay usable
      # exactly on the accounts that hit their ceiling (LlmCallContext.FEATURE_ADMIN_REPLAY).
      exempt-features:
        - admin_replay
```

**Before committing, verify every slug above against the real call sites** — grep the codebase for
`new LlmCallContext("` and confirm each `throttled-features` entry matches a literal slug. A slug
that matches nothing is a silent no-op, which is the worst failure mode this config has:

```bash
grep -rho 'new LlmCallContext("[a-z_]*"' backend/src/main/java | sort -u
```

Correct the list to the real slugs before moving on.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend && ./mvnw -q test -Dtest=LlmBudgetPropertiesTest
cd backend && ./mvnw -q test -Dtest=LlmPricingPropertiesBindingTest
```

Expected: PASS both.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/config/LlmLogProperties.java \
        backend/src/main/resources/application.yml \
        backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetPropertiesTest.java
git commit -m "feat(llmlog): bind the per-user USD cap config (mezo-ozri.6)"
```

---

### Task 3: `LlmBudgetLevel` + `LlmBudgetGate` — the port

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetLevel.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetGate.java`

**Interfaces:**
- Produces: `enum LlmBudgetLevel { OK, DEGRADED, THROTTLED, STOPPED }` with
  `boolean atLeast(LlmBudgetLevel other)`.
- Produces: `interface LlmBudgetGate { LlmBudgetLevel levelFor(String feature); LlmBudgetGate OPEN = feature -> LlmBudgetLevel.OK; }`

There is no test of its own for this task — the enum and the one-method port carry no behaviour
beyond `atLeast`, which Task 4's and Task 5's tests exercise directly. Fold it into Task 4's commit.

- [ ] **Step 1: Write `LlmBudgetLevel`**

```java
package io.mrkuhne.mezo.feature.llmlog.context;

/**
 * How much of an account's rolling USD ceiling is gone, as the graded service level that follows
 * from it (mezo-ozri.6, spec §C1). Ordinal order IS severity order — {@link #atLeast} depends on
 * it — so new states must be inserted in the right place, never appended.
 */
public enum LlmBudgetLevel {

    /** Below every threshold, or not measurable at all: full service. */
    OK,

    /** Past degrade-at-percent: every call routes onto the provider's cheap tier. */
    DEGRADED,

    /** Past throttle-cron-at-percent: the configured expensive generators are suspended too. */
    THROTTLED,

    /** Past stop-at-percent: every capped call is refused until the rolling window moves on. */
    STOPPED;

    /** True when this level is {@code other} or worse — the severity comparison, spelled out. */
    public boolean atLeast(LlmBudgetLevel other) {
        return ordinal() >= other.ordinal();
    }
}
```

- [ ] **Step 2: Write `LlmBudgetGate`**

```java
package io.mrkuhne.mezo.feature.llmlog.context;

/**
 * The pre-flight budget question, asked by {@link LlmCallContextHolder#runWith} once per tagged
 * operation (mezo-ozri.6, spec §C2).
 *
 * <p>A port rather than a direct dependency for two reasons: it keeps {@code llmlog.context} free of
 * a repository edge, and it lets {@link LlmCallContextHolder}'s nineteen unit-test construction
 * sites keep saying {@code new LlmCallContextHolder()} without pulling in a database.
 */
@FunctionalInterface
public interface LlmBudgetGate {

    /** The gate that never says no — the no-arg holder constructor's default, for unit tests. */
    LlmBudgetGate OPEN = feature -> LlmBudgetLevel.OK;

    /**
     * The level THIS call has to live with. Never null: an unmeasurable call (no actor, cap
     * disabled, audit log off) is {@link LlmBudgetLevel#OK} — a ceiling that cannot see spend must
     * not invent it.
     */
    LlmBudgetLevel levelFor(String feature);
}
```

---

### Task 4: `LlmBudgetService` — spend → level

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetServiceTest.java`

**Interfaces:**
- Consumes: `LlmLogRepository.sumCostSince` (Task 1), `LlmLogProperties.Budget` (Task 2),
  `LlmBudgetGate` / `LlmBudgetLevel` (Task 3).
- Produces: `LlmBudgetService implements LlmBudgetGate` — the single `LlmBudgetGate` bean.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetServiceTest.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

/**
 * The cap's arithmetic (mezo-ozri.6). Pure unit: the repository is a stub, so what is under test is
 * only "spend + config -> level", which is the part a misconfiguration silently gets wrong.
 */
class LlmBudgetServiceTest {

    private static final UUID USER = UUID.randomUUID();

    private final LlmLogRepository repository = mock(LlmLogRepository.class);

    private static LlmLogProperties properties(boolean enabled) {
        return new LlmLogProperties(64000, ZoneId.of("Europe/Budapest"),
            new LlmLogProperties.Executor(1, 2, 500),
            new LlmLogProperties.Retention(90, "0 40 3 * * *"),
            new LlmLogProperties.Budget(enabled, new BigDecimal("5.00"), 30, 70, 90, 100,
                Set.of("proactive_memoir"), Set.of("admin_replay")));
    }

    @SuppressWarnings("unchecked")
    private LlmBudgetService service(boolean enabled, boolean auditOn) {
        ObjectProvider<EventPublishingLlmCallRecorder> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(
            auditOn ? mock(EventPublishingLlmCallRecorder.class) : null);
        return new LlmBudgetService(repository, properties(enabled), provider);
    }

    private void spent(String usd) {
        when(repository.sumCostSince(any(Instant.class), eq(USER), eq(CallStatus.ERROR)))
            .thenReturn(new BigDecimal(usd));
    }

    private LlmBudgetLevel levelAs(UUID actor, String feature, LlmBudgetService service) {
        return LlmActorContext.runAs(actor, () -> service.levelFor(feature));
    }

    @Test
    void testLevelFor_shouldReportOk_whenSpendIsBelowEveryThreshold() {
        spent("3.49");
        assertThat(levelAs(USER, "companion_chat", service(true, true))).isEqualTo(LlmBudgetLevel.OK);
    }

    @Test
    void testLevelFor_shouldReportDegraded_whenSpendReachesSeventyPercent() {
        spent("3.50"); // exactly 70% of 5.00 — the threshold is inclusive
        assertThat(levelAs(USER, "companion_chat", service(true, true))).isEqualTo(LlmBudgetLevel.DEGRADED);
    }

    @Test
    void testLevelFor_shouldReportThrottled_whenSpendReachesNinetyPercent() {
        spent("4.50");
        assertThat(levelAs(USER, "companion_chat", service(true, true))).isEqualTo(LlmBudgetLevel.THROTTLED);
    }

    @Test
    void testLevelFor_shouldReportStopped_whenSpendReachesTheCap() {
        spent("5.00");
        assertThat(levelAs(USER, "companion_chat", service(true, true))).isEqualTo(LlmBudgetLevel.STOPPED);
    }

    /** An exempt feature is never capped, and must not even pay for the spend read. */
    @Test
    void testLevelFor_shouldReportOkWithoutReading_whenTheFeatureIsExempt() {
        LlmBudgetService service = service(true, true);

        assertThat(levelAs(USER, "admin_replay", service)).isEqualTo(LlmBudgetLevel.OK);
        verify(repository, never()).sumCostSince(any(), any(), any());
    }

    /**
     * No actor = a background call nobody can be billed for. Capping it would break background work
     * for a reason that cannot be reported to any user (spec §D5).
     */
    @Test
    void testLevelFor_shouldReportOkWithoutReading_whenThereIsNoActor() {
        LlmBudgetService service = service(true, true);

        assertThat(service.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.OK);
        verify(repository, never()).sumCostSince(any(), any(), any());
    }

    @Test
    void testLevelFor_shouldReportOkWithoutReading_whenTheCapIsDisabled() {
        spent("99.00");
        LlmBudgetService service = service(false, true);

        assertThat(levelAs(USER, "companion_chat", service)).isEqualTo(LlmBudgetLevel.OK);
        verify(repository, never()).sumCostSince(any(), any(), any());
    }

    /**
     * Spec §L1: turning the audit log off turns the cap off. Nothing is recorded, so the ceiling has
     * nothing to read; fail-closed was explicitly rejected in the brainstorm.
     */
    @Test
    void testLevelFor_shouldReportOkWithoutReading_whenTheAuditLogIsOff() {
        spent("99.00");
        LlmBudgetService service = service(true, false);

        assertThat(levelAs(USER, "companion_chat", service)).isEqualTo(LlmBudgetLevel.OK);
        verify(repository, never()).sumCostSince(any(), any(), any());
    }

    @Test
    void testAllows_shouldRefuseAThrottledFeature_whenThrottled() {
        LlmBudgetService service = service(true, true);

        assertThat(service.allows("proactive_memoir", LlmBudgetLevel.THROTTLED)).isFalse();
        assertThat(service.allows("companion_chat", LlmBudgetLevel.THROTTLED)).isTrue();
        assertThat(service.allows("proactive_memoir", LlmBudgetLevel.DEGRADED)).isTrue();
    }

    @Test
    void testAllows_shouldRefuseEverything_whenStopped() {
        LlmBudgetService service = service(true, true);

        assertThat(service.allows("companion_chat", LlmBudgetLevel.STOPPED)).isFalse();
        assertThat(service.allows("proactive_memoir", LlmBudgetLevel.STOPPED)).isFalse();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw -q test -Dtest=LlmBudgetServiceTest
```

Expected: FAIL — `LlmBudgetService` does not exist.

- [ ] **Step 3: Write `LlmBudgetService`**

```java
package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetGate;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The per-user rolling USD ceiling (mezo-ozri.6, spec §C1) — turns "what has this account spent in
 * the last {@code cycle-days} days" into the graded {@link LlmBudgetLevel} the call has to live
 * with. Reverses ADR 0035 §L1, which shipped cost visibility only.
 *
 * <p><b>Read per tagged operation, not per query.</b> {@link io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder#runWith}
 * asks once and binds the answer to the thread, so a chat turn that fans out into several LLM calls
 * pays for one indexed scalar read, not one per call.
 *
 * <p><b>Why not an in-memory counter.</b> The audit row is written asynchronously, so a burst can
 * overshoot the ceiling by whatever it issues before the writer catches up. That is accepted: the
 * writer's lag is milliseconds while an LLM call is seconds, and the $5 ceiling carries 1.6-2.3x of
 * headroom by construction (spec §4). A cache would trade that bounded overshoot for a staleness
 * window that behaves worse under exactly the burst it exists to catch.
 *
 * <p><b>Never invents a number.</b> An unattributable call (no actor), a disabled cap and a disabled
 * audit log all answer {@link LlmBudgetLevel#OK} without touching the database.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LlmBudgetService implements LlmBudgetGate {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final LlmLogRepository llmLogRepository;
    private final LlmLogProperties llmLogProperties;
    /** The audit-switch probe: the recorder bean's presence IS the switch (no @Value, ArchUnit). */
    private final ObjectProvider<EventPublishingLlmCallRecorder> auditRecorder;

    /** The blind-cap warning is worth saying, and worth saying ONCE per boot. */
    private final AtomicBoolean blindWarningLogged = new AtomicBoolean();

    @Override
    @Transactional(readOnly = true)
    public LlmBudgetLevel levelFor(String feature) {
        LlmLogProperties.Budget budget = llmLogProperties.budget();
        if (!budget.enabled() || budget.exemptFeatures().contains(feature)) {
            return LlmBudgetLevel.OK;
        }
        if (auditRecorder.getIfAvailable() == null) {
            warnBlindOnce();
            return LlmBudgetLevel.OK;
        }
        UUID actor = LlmActorContext.capture();
        if (actor == null) {
            return LlmBudgetLevel.OK;
        }

        Instant since = Instant.now().minus(Duration.ofDays(budget.cycleDays()));
        BigDecimal spent = llmLogRepository.sumCostSince(since, actor, CallStatus.ERROR);
        BigDecimal percent = spent
            .multiply(HUNDRED)
            .divide(budget.hardCapUsd(), 4, RoundingMode.HALF_UP);

        LlmBudgetLevel level = levelOf(percent, budget);
        if (level != LlmBudgetLevel.OK) {
            log.info("LLM budget {} for user {}: ${} of ${} in {}d ({}%)",
                level, actor, spent, budget.hardCapUsd(), budget.cycleDays(),
                percent.setScale(1, RoundingMode.HALF_UP));
        }
        return level;
    }

    /**
     * May {@code feature} still go out at {@code level}? Kept beside the level so the two halves of
     * one policy cannot drift: DEGRADED is a routing decision (every call still goes out, on the
     * cheap tier), THROTTLED additionally suspends the configured background generators, and
     * STOPPED refuses everything the cap can see.
     */
    public boolean allows(String feature, LlmBudgetLevel level) {
        if (level.atLeast(LlmBudgetLevel.STOPPED)) {
            return false;
        }
        if (level.atLeast(LlmBudgetLevel.THROTTLED)) {
            return !llmLogProperties.budget().throttledFeatures().contains(feature);
        }
        return true;
    }

    /** Thresholds are INCLUSIVE: "70% spent" is already the degraded state, not the last OK one. */
    private static LlmBudgetLevel levelOf(BigDecimal percent, LlmLogProperties.Budget budget) {
        if (percent.compareTo(BigDecimal.valueOf(budget.stopAtPercent())) >= 0) {
            return LlmBudgetLevel.STOPPED;
        }
        if (percent.compareTo(BigDecimal.valueOf(budget.throttleAtPercent())) >= 0) {
            return LlmBudgetLevel.THROTTLED;
        }
        if (percent.compareTo(BigDecimal.valueOf(budget.degradeAtPercent())) >= 0) {
            return LlmBudgetLevel.DEGRADED;
        }
        return LlmBudgetLevel.OK;
    }

    private void warnBlindOnce() {
        if (blindWarningLogged.compareAndSet(false, true)) {
            log.warn("mezo.llm-log.budget.enabled=true but the audit log is OFF "
                + "(mezo.feature.llm-log.enabled=false) — the per-user USD cap has nothing to read "
                + "and is INERT (spec §L1: turning the log off turns the cap off).");
        }
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw -q test -Dtest=LlmBudgetServiceTest
```

Expected: PASS. If `LlmActorContext.runAs` has a `Runnable`-only signature, adapt `levelAs` in the
test to capture into a local array instead of returning a value — read `LlmActorContext` first.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetLevel.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/LlmBudgetGate.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetServiceTest.java
git commit -m "feat(llmlog): grade a user's rolling LLM spend into a budget level (mezo-ozri.6)"
```

---

### Task 5: Enforce at the chokepoint — `LlmCallContextHolder.runWith`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/LlmCallContextHolder.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmCallContextHolderTest.java`

**Interfaces:**
- Consumes: `LlmBudgetGate`, `LlmBudgetLevel` (Task 3).
- Produces: `LlmCallContextHolder(LlmBudgetGate)` (the `@Autowired` constructor),
  `LlmCallContextHolder()` (no-arg, gate = `LlmBudgetGate.OPEN`), and
  `LlmBudgetLevel budgetLevel()` — never null, `OK` off a bound scope.
- Produces: error codes `LLM_BUDGET_EXHAUSTED` (stopped) and `LLM_BUDGET_THROTTLED` (suspended
  feature), both `HttpStatus.TOO_MANY_REQUESTS`.

- [ ] **Step 1: Write the failing test**

Append to `LlmCallContextHolderTest` (add imports `io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException`
and a `java.util.concurrent.atomic.AtomicInteger`), and change the existing field to
`new LlmCallContextHolder(LlmBudgetGate.OPEN)`:

```java
    /**
     * The cap's whole enforcement contract sits in runWith (mezo-ozri.6, spec §C2): the one place
     * where the feature slug is known and the call has NOT gone out yet.
     */
    @Test
    void testRunWith_shouldRefuseTheCall_whenTheBudgetIsExhausted() {
        LlmCallContextHolder stopped = new LlmCallContextHolder(feature -> LlmBudgetLevel.STOPPED);
        AtomicInteger bodyRuns = new AtomicInteger();

        assertThatThrownBy(() -> stopped.runWith(OUTER, () -> {
            bodyRuns.incrementAndGet();
            return "answer";
        })).isInstanceOf(SystemRuntimeErrorException.class);

        assertThat(bodyRuns.get()).isZero(); // pre-flight: the LLM was never called
        assertThat(stopped.get()).isEqualTo(LlmCallContext.UNKNOWN); // and the thread is left clean
    }

    /** DEGRADED is a ROUTING decision, not a refusal — the call still goes out, on a cheaper model. */
    @Test
    void testRunWith_shouldRunTheBodyAndBindTheLevel_whenDegraded() {
        LlmCallContextHolder degraded = new LlmCallContextHolder(feature -> LlmBudgetLevel.DEGRADED);

        LlmBudgetLevel seen = degraded.runWith(OUTER, degraded::budgetLevel);

        assertThat(seen).isEqualTo(LlmBudgetLevel.DEGRADED);
        assertThat(degraded.budgetLevel()).isEqualTo(LlmBudgetLevel.OK); // unbound again
    }

    /** The bound level must nest exactly like the context, or an inner scope would leak its level. */
    @Test
    void testRunWith_shouldRestoreTheOuterLevel_whenNested() {
        LlmCallContextHolder holder = new LlmCallContextHolder(
            feature -> "inner_feature".equals(feature) ? LlmBudgetLevel.OK : LlmBudgetLevel.DEGRADED);

        holder.runWith(OUTER, () -> {
            assertThat(holder.budgetLevel()).isEqualTo(LlmBudgetLevel.DEGRADED);
            holder.runWith(INNER, () -> null);
            assertThat(holder.budgetLevel()).isEqualTo(LlmBudgetLevel.DEGRADED);
            return null;
        });

        assertThat(holder.budgetLevel()).isEqualTo(LlmBudgetLevel.OK);
    }

    /** An untagged thread has no level either — budgetLevel() must never be null. */
    @Test
    void testBudgetLevel_shouldReportOk_whenNothingIsBound() {
        assertThat(holder.budgetLevel()).isEqualTo(LlmBudgetLevel.OK);
    }
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw -q test -Dtest=LlmCallContextHolderTest
```

Expected: FAIL — no `LlmCallContextHolder(LlmBudgetGate)` constructor, no `budgetLevel()`.

- [ ] **Step 3: Implement the enforcement**

Replace `LlmCallContextHolder` with:

```java
package io.mrkuhne.mezo.feature.llmlog.context;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Carries the ambient {@link LlmCallContext} from a call site down to the LLM adapter without
 * threading it through every port signature (mezo-2zyu), and — since mezo-ozri.6 — is where the
 * per-user USD cap is enforced. Thread-bound: the adapter reads it on the SAME thread that made the
 * call, before the record is handed to the async writer.
 *
 * <p>Always prefer {@link #runWith} — it guarantees the unbind that keeps a pooled request thread
 * from leaking one feature's context into the next call, and it is the ONLY place the budget is
 * checked (spec §C2). That is not an accident of convenience: it is the single point through which
 * all 56 tagged calls pass with the feature slug already known and the provider not yet called, so
 * a refusal costs nothing and a degradation can still change the model.
 */
@Component
public class LlmCallContextHolder {

    private static final ThreadLocal<LlmCallContext> CONTEXT = new ThreadLocal<>();
    /** The budget level resolved for the innermost tagged scope — read by the model router. */
    private static final ThreadLocal<LlmBudgetLevel> BUDGET = new ThreadLocal<>();

    private final LlmBudgetGate llmBudgetGate;

    @Autowired
    public LlmCallContextHolder(LlmBudgetGate llmBudgetGate) {
        this.llmBudgetGate = llmBudgetGate;
    }

    /** The uncapped holder — for unit tests that exercise tagging, not spend. */
    public LlmCallContextHolder() {
        this(LlmBudgetGate.OPEN);
    }

    public void set(LlmCallContext context) {
        CONTEXT.set(context);
    }

    /** Never null: an unset thread reports {@link LlmCallContext#UNKNOWN}. */
    public LlmCallContext get() {
        LlmCallContext context = CONTEXT.get();
        return context != null ? context : LlmCallContext.UNKNOWN;
    }

    /**
     * The budget level of the enclosing tagged scope — never null, {@link LlmBudgetLevel#OK} off one.
     * Resolved ONCE in {@link #runWith} so the model router can degrade a call's model without a
     * second spend read.
     */
    public LlmBudgetLevel budgetLevel() {
        LlmBudgetLevel level = BUDGET.get();
        return level != null ? level : LlmBudgetLevel.OK;
    }

    public void clear() {
        CONTEXT.remove();
        BUDGET.remove();
    }

    /**
     * Runs {@code body} with {@code context} bound to this thread, restoring the PREVIOUS binding on
     * the way out (even on failure) — and refusing to run it at all when {@code context}'s feature
     * has spent through the account's ceiling (mezo-ozri.6).
     *
     * <p>Save+restore, not blanket clear: a nested {@code runWith} (an outer tagged operation calling
     * into an inner one on the same thread) would otherwise unbind the outer context when the inner
     * returns, and every subsequent call in the outer scope would silently record under the wrong
     * feature. Restoring null degrades to a clear, so the top-level scope still leaves the pooled
     * thread clean. The budget level is bound and restored in exact lockstep with the context, for
     * the same reason.
     *
     * <p>The refusal is thrown BEFORE the binding is installed: nothing was tagged, nothing was
     * sent, nothing is logged — there is no call to attribute. Cron callers are unaffected by the
     * throw ({@code UserFanOut} isolates every user), and a request caller gets 429.
     */
    public <T> T runWith(LlmCallContext context, Supplier<T> body) {
        LlmBudgetLevel level = llmBudgetGate.levelFor(context.feature());
        refuseIfOverBudget(context.feature(), level);

        LlmCallContext previousContext = CONTEXT.get();
        LlmBudgetLevel previousLevel = BUDGET.get();
        set(context);
        BUDGET.set(level);
        try {
            return body.get();
        } finally {
            if (previousContext != null) {
                set(previousContext);
            } else {
                CONTEXT.remove();
            }
            if (previousLevel != null) {
                BUDGET.set(previousLevel);
            } else {
                BUDGET.remove();
            }
        }
    }

    /**
     * 429, not 402 or 503: the account is over its allowance for THIS window and the same request
     * will work again once the window rolls — which is exactly what Too Many Requests means. The two
     * codes are distinct on purpose; "your AI budget is spent" and "this background feature is
     * paused to protect what is left" are different things to tell a user.
     */
    private void refuseIfOverBudget(String feature, LlmBudgetLevel level) {
        if (level.atLeast(LlmBudgetLevel.STOPPED)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("LLM_BUDGET_EXHAUSTED").build(), HttpStatus.TOO_MANY_REQUESTS);
        }
        if (level.atLeast(LlmBudgetLevel.THROTTLED) && llmBudgetGate.isThrottled(feature)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("LLM_BUDGET_THROTTLED").build(), HttpStatus.TOO_MANY_REQUESTS);
        }
    }
}
```

Add the throttle predicate to the port (`LlmBudgetGate`), keeping the whole policy behind one
interface so the holder never learns the config shape:

```java
    /** True when {@code feature} is one of the expensive generators the throttle step suspends. */
    default boolean isThrottled(String feature) {
        return false;
    }
```

and implement it in `LlmBudgetService` by delegating to the config:

```java
    @Override
    public boolean isThrottled(String feature) {
        return llmLogProperties.budget().throttledFeatures().contains(feature);
    }
```

Then simplify `LlmBudgetService.allows` to use it, so the two never drift:

```java
    public boolean allows(String feature, LlmBudgetLevel level) {
        if (level.atLeast(LlmBudgetLevel.STOPPED)) {
            return false;
        }
        return !(level.atLeast(LlmBudgetLevel.THROTTLED) && isThrottled(feature));
    }
```

**Note:** `LlmBudgetGate.OPEN` is a lambda and now targets a two-method interface — one abstract,
one `default` — so it still compiles as `@FunctionalInterface`. Keep the annotation.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw -q test -Dtest='LlmCallContextHolderTest+LlmBudgetServiceTest'
```

Expected: PASS. If the compiler complains that the 19 `new LlmCallContextHolder()` sites are
ambiguous, they are not — the no-arg constructor still exists; the failure would be an import.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/llmlog \
        backend/src/test/java/io/mrkuhne/mezo/feature/llmlog
git commit -m "feat(llmlog): refuse and grade LLM calls at the pre-flight chokepoint (mezo-ozri.6)"
```

---

### Task 6: Degraded routing — the cheap tier under pressure

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LlmModelRouter.java`
- Modify: `backend/src/main/resources/application.yml` (both provider tiers)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/LlmModelRouterTest.java`

**Interfaces:**
- Consumes: `LlmCallContextHolder.budgetLevel()` (Task 5).
- Produces: `CompanionProperties.Llm.Tier.degradeModel()` — blank/absent ⇒ that tier's `chatModel()`.

- [ ] **Step 1: Write the failing test**

The `Tier` record gains a component, so the test's `tier(...)` helper changes. Open
`LlmModelRouterTest`, extend the helper to pass `null` for `degradeModel` in the existing cases, and
append:

```java
    /**
     * The 70% step (mezo-ozri.6): a degraded call drops onto the provider's cheap tier even when it
     * asked for the smart one. Same token price per token, an order of magnitude fewer dollars.
     */
    @Test
    void testModelFor_shouldFallToTheCheapTier_whenTheBudgetIsDegraded() {
        LlmCallContextHolder degraded = new LlmCallContextHolder(feature -> LlmBudgetLevel.DEGRADED);
        LlmModelRouter router = new LlmModelRouter(tier(Map.of(), Map.of()), tier(Map.of(), Map.of()), degraded);

        String model = degraded.runWith(new LlmCallContext("companion_weekly_review", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART));

        assertThat(model).isEqualTo("luna");
    }

    /**
     * A feature override states a PREFERENCE and is dropped under budget pressure — keeping it would
     * let one yml line make the degrade step a no-op. A call-kind override states a CAPABILITY and
     * survives: dropping a vision model on a degraded turn breaks the turn, it does not save money.
     */
    @Test
    void testModelFor_shouldDropFeatureOverridesButKeepCallKindOnes_whenDegraded() {
        LlmCallContextHolder degraded = new LlmCallContextHolder(feature -> LlmBudgetLevel.DEGRADED);
        LlmModelRouter router = new LlmModelRouter(
            tier(Map.of(), Map.of()),
            tier(Map.of("companion_chat", "terra"), Map.of(CallKind.VISION, "luna-vision")),
            degraded);

        assertThat(degraded.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT))).isEqualTo("luna");
        assertThat(degraded.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.VISION))).isEqualTo("luna-vision");
    }

    /** An explicit degrade-model wins over the cheap-tier default — provider-scoped, per spec §7. */
    @Test
    void testModelFor_shouldUseTheDegradeModel_whenOneIsConfigured() {
        LlmCallContextHolder degraded = new LlmCallContextHolder(feature -> LlmBudgetLevel.DEGRADED);
        LlmModelRouter router = new LlmModelRouter(
            tier(Map.of(), Map.of()),
            new Tier("luna", "terra", "luna-mini", Map.of(), Map.of(), null),
            degraded);

        assertThat(degraded.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART))).isEqualTo("luna-mini");
    }
```

(Adjust the `new Tier(...)` argument order in the last test to whatever position `degradeModel`
actually takes in the record header you write in Step 3 — put it third, right after `smartModel`.)

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw -q test -Dtest=LlmModelRouterTest
```

Expected: FAIL — `Tier` has no `degradeModel` component.

- [ ] **Step 3: Add `degradeModel` and the degraded branch**

In `CompanionProperties.Llm.Tier`, insert after `smartModel`:

```java
            /**
             * Where a budget-degraded call lands (mezo-ozri.6, spec §C1's 70% step). Blank or absent
             * ⇒ this provider's own {@code chatModel}. Per PROVIDER, never one flat key: a model id
             * only means something to the vendor that serves it, and the Gemini block still answers
             * the audio and vision calls the OpenAI adapter delegates here.
             */
            String degradeModel,
```

and extend the compact constructor's normalisation is not needed (a null string is read with
`StringUtils.hasText`). In `LlmModelRouter.modelFor`:

```java
    /** Never null and never blank: the tier default is the floor. */
    public String modelFor(LlmProvider provider, ModelTier tier, CallKind kind) {
        CompanionProperties.Llm.Tier config = configOf(provider);
        String byKind = config.callKindModels().get(kind);
        if (StringUtils.hasText(byKind)) {
            return byKind.trim();
        }
        // mezo-ozri.6: past the degrade threshold the cheap tier is the ONLY answer. Feature
        // overrides are skipped deliberately — a feature entry is a preference, and honouring one
        // here would let a single yml line turn the degrade step into a no-op. The call-kind branch
        // above still wins, because that one states a capability the model must have.
        if (llmCallContextHolder.budgetLevel().atLeast(LlmBudgetLevel.DEGRADED)) {
            return StringUtils.hasText(config.degradeModel())
                ? config.degradeModel().trim() : config.chatModel();
        }
        String byFeature = config.featureModels().get(llmCallContextHolder.get().feature());
        if (StringUtils.hasText(byFeature)) {
            return byFeature.trim();
        }
        return tier == ModelTier.SMART ? config.smartModel() : config.chatModel();
    }
```

Import `io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel`.

- [ ] **Step 4: Add the YAML keys**

Under `mezo.companion.llm.gemini:` and `mezo.companion.llm.openai:`, after `smart-model:`:

```yaml
        # mezo-ozri.6: where a budget-degraded call lands (mezo.llm-log.budget.degrade-at-percent).
        # Empty = this provider's own chat-model, which is already the cheap tier.
        degrade-model:
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend && ./mvnw -q test -Dtest='LlmModelRouterTest+LlmModelRoutingIT'
```

Expected: PASS. `LlmModelRoutingIT` boots a context, so run it with
`-Dmezo.test.use-testcontainers=true` if it extends `AbstractIntegrationTest`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/main/resources/application.yml \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/LlmModelRouterTest.java
git commit -m "feat(companion): route budget-degraded calls onto the cheap tier (mezo-ozri.6)"
```

---

### Task 7: The end-to-end proof — one user crosses all three thresholds

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetCapIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmBudgetLogDisabledIT.java`

**Interfaces:**
- Consumes: everything from Tasks 1-6.

This is the task the bd acceptance criteria name directly: *"Egy user átlépi a küszöböket egy IT-ben
és a három fokozat sorra aktiválódik; a hard cap és minden küszöb application.yml-ből állítható
újrafordítás nélkül; llm-log kikapcsolt állapotban a viselkedés explicit és tesztelt."*

- [ ] **Step 1: Write the failing test**

Read `LlmLogRecorderWiringIT` and `LlmLogRetentionJobSwitchOffIT` first to copy this repo's exact
`AbstractIntegrationTest` + `@TestPropertySource` idiom, then create `LlmBudgetCapIT`:

```java
package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.companion.llm.LlmModelRouter;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * The per-user rolling USD cap end to end (mezo-ozri.6, spec §C1) — the three graded steps fire in
 * order as ONE account's logged spend climbs, with every threshold coming from properties rather
 * than from code. The cap is pinned to $1.00 here purely so the arithmetic in the test reads as
 * cents rather than as a table of fractions; the shipped ceiling is $5.00.
 */
@TestPropertySource(properties = {
    "mezo.feature.llm-log.enabled=true",
    "mezo.llm-log.budget.enabled=true",
    "mezo.llm-log.budget.hard-cap-usd=1.00",
    "mezo.llm-log.budget.cycle-days=30",
    "mezo.llm-log.budget.degrade-at-percent=70",
    "mezo.llm-log.budget.throttle-cron-at-percent=90",
    "mezo.llm-log.budget.stop-at-percent=100",
    "mezo.llm-log.budget.throttled-features[0]=proactive_memoir",
    "mezo.companion.llm.openai.chat-model=gpt-5.6-luna",
    "mezo.companion.llm.openai.smart-model=gpt-5.6-terra"
})
class LlmBudgetCapIT extends AbstractIntegrationTest {

    @Autowired private LlmBudgetService llmBudgetService;
    @Autowired private LlmCallContextHolder llmCallContextHolder;
    @Autowired private LlmModelRouter llmModelRouter;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private static final LlmCallContext CHAT = new LlmCallContext("companion_chat", "turn", null, null);
    private static final LlmCallContext MEMOIR = new LlmCallContext("proactive_memoir", "generate", null, null);

    private void spend(UUID user, String usd) {
        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-terra", 1000, 100,
            null, new BigDecimal(usd));
    }

    /**
     * The whole ladder on ONE account and ONE fixture, in order: full service, then the cheap-tier
     * fallback, then the suspended generator, then the pause. Split into four tests it would still
     * pass with a threshold comparison that reads the wrong way round, because each would only ever
     * see its own state.
     */
    @Test
    void testCap_shouldActivateTheThreeStepsInOrder_whenOneUserSpendsThroughTheCeiling() {
        UUID user = userPopulator.createUser("llm-budget-cap@test.hu").getId();

        LlmActorContext.runAs(user, () -> {
            // ---- below every threshold: full service, smart tier intact
            spend(user, "0.50");
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.OK);
            assertThat(llmCallContextHolder.runWith(CHAT,
                () -> llmModelRouter.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART)))
                .isEqualTo("gpt-5.6-terra");

            // ---- 70%: the call still goes out, on the cheap tier
            spend(user, "0.25");
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.DEGRADED);
            assertThat(llmCallContextHolder.runWith(CHAT,
                () -> llmModelRouter.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART)))
                .isEqualTo("gpt-5.6-luna");

            // ---- 90%: the expensive generator is suspended, the user's own turn is not
            spend(user, "0.20");
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.THROTTLED);
            assertThatThrownBy(() -> llmCallContextHolder.runWith(MEMOIR, () -> "generated"))
                .isInstanceOf(SystemRuntimeErrorException.class);
            assertThat(llmCallContextHolder.runWith(CHAT, () -> "answered")).isEqualTo("answered");

            // ---- 100%: everything the cap can see is refused
            spend(user, "0.10");
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.STOPPED);
            assertThatThrownBy(() -> llmCallContextHolder.runWith(CHAT, () -> "answered"))
                .isInstanceOf(SystemRuntimeErrorException.class);
            return null;
        });
    }

    /**
     * The ceiling is PER ACCOUNT. A second user with an exhausted budget must not cost the first one
     * anything — otherwise "per-user cap" is really a global one wearing the wrong name.
     */
    @Test
    void testCap_shouldNotLeakAcrossAccounts_whenAnotherUserIsExhausted() {
        UUID spender = userPopulator.createUser("llm-budget-spender@test.hu").getId();
        UUID quiet = userPopulator.createUser("llm-budget-quiet@test.hu").getId();
        spend(spender, "5.00");

        assertThat(LlmActorContext.runAs(quiet, () -> llmBudgetService.levelFor("companion_chat")))
            .isEqualTo(LlmBudgetLevel.OK);
        assertThat(LlmActorContext.runAs(spender, () -> llmBudgetService.levelFor("companion_chat")))
            .isEqualTo(LlmBudgetLevel.STOPPED);
    }

    /**
     * Background traffic nobody can be billed for is never capped (spec §D5): there is no account to
     * measure it against, and failing it would break the work for a reason no user could be told.
     */
    @Test
    void testCap_shouldStayOpen_whenTheCallHasNoActor() {
        assertThat(llmCallContextHolder.runWith(CHAT, () -> "answered")).isEqualTo("answered");
    }
}
```

Then `LlmBudgetLogDisabledIT`:

```java
package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Spec §L1's documented consequence, made explicit and testable (bd mezo-ozri.6): with the audit log
 * off nothing is recorded, so the cap has nothing to read and is INERT — a user far past the ceiling
 * still gets full service. Fail-closed was considered and rejected in the brainstorm: a cap that
 * blocks everything the moment its measurement is switched off turns one config mistake into a total
 * outage. Turning the log off IS turning the cap off, and the service says so once at WARN.
 */
@TestPropertySource(properties = {
    "mezo.feature.llm-log.enabled=false",
    "mezo.llm-log.budget.enabled=true",
    "mezo.llm-log.budget.hard-cap-usd=1.00"
})
class LlmBudgetLogDisabledIT extends AbstractIntegrationTest {

    @Autowired private LlmBudgetService llmBudgetService;
    @Autowired private LlmCallContextHolder llmCallContextHolder;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testCap_shouldStayInert_whenTheAuditLogIsDisabled() {
        UUID user = userPopulator.createUser("llm-budget-blind@test.hu").getId();
        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-terra", 1000, 100,
            null, new BigDecimal("99.00"));

        LlmActorContext.runAs(user, () -> {
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.OK);
            assertThat(llmCallContextHolder.runWith(
                new LlmCallContext("companion_chat", "turn", null, null), () -> "answered"))
                .isEqualTo("answered");
            return null;
        });
    }
}
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd backend && ./mvnw -q test -Dtest='LlmBudgetCapIT+LlmBudgetLogDisabledIT' -Dmezo.test.use-testcontainers=true
```

Expected: FAIL initially only if something in Tasks 1-6 is wrong. If they pass first time, prove the
tests are real by temporarily inverting one comparison in `LlmBudgetService.levelOf` and confirming
`LlmBudgetCapIT` goes red — then revert.

- [ ] **Step 3: Fix whatever the ITs surface**

No new production code is planned here; this task's purpose is the proof. Expected friction points,
each with its fix:
- **`LlmActorContext.runAs` signature** — if it takes a `Runnable`, wrap the assertions in a
  `runAs(user, () -> { ... })` block without a return value and drop the trailing `return null`.
- **`AbstractIntegrationTest` context caching** — the two ITs use different property sets, so each
  boots its own context. That is normal in this repo (see `LlmLogRetentionJobSwitchOffIT`).
- **`LlmLogPopulator` is a `@TestComponent`** — confirm how existing ITs import it (there is likely
  a `@Import` on the base class); copy that, do not invent one.
- **Zone/rounding** — `cycle-days` is a duration, not a calendar cut, so there is no midnight
  fragility here by construction. Do not introduce a `LocalDate` anywhere in this path.

- [ ] **Step 4: Run them to verify they pass**

```bash
cd backend && ./mvnw -q test -Dtest='LlmBudgetCapIT+LlmBudgetLogDisabledIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service
git commit -m "test(llmlog): prove the three cap steps end to end (mezo-ozri.6)"
```

---

### Task 8: Documentation, ADR amendment, CODEMAP

**Files:**
- Modify: `docs/decisions/0035-multi-user-account-model.md`
- Modify: `docs/features/companion.md`
- Modify: `docs/CODEMAP.md` (generated)

- [ ] **Step 1: Amend ADR 0035**

The ADR's §L1 row records "Monthly quota (L2) … not adopted — only cost *visibility* shipped".
Do NOT rewrite history: append a dated amendment at the end of the document, in the file's own
style (open it and match how earlier amendments, if any, are formatted):

```markdown
## Amendment — 2026-09-08 (mezo-ozri.6): L2 adopted after all

§L1 rejected a monthly per-account cost cap and shipped cost *visibility* only. The OpenAI
migration's unit economics reversed that: at the migration spec's §4 numbers a heavy account costs
~$51/month against $10.46 of net revenue per subscription, so an unbounded ceiling is a business
risk rather than a theoretical one.

What shipped is not the L2 that was rejected. L2 was a hard monthly quota — one line between full
service and none. This is a **rolling $5 / 30-day ceiling with three graded steps**: at 70% every
call routes onto the provider's cheap tier, at 90% the expensive background generators are suspended,
and only at 100% do capped calls stop. The deterministic engine — logging, scoring, plans, every
non-LLM surface — is untouched at every step; that was the objection to L2 and it still stands.

Enforcement is a single pre-flight point, `LlmCallContextHolder.runWith`, which every tagged call
already passes through. All numbers are `mezo.llm-log.budget.*` in `application.yml`.
The measurement §L1 *did* adopt (per-user cost on the admin page) is exactly what this reads.
```

- [ ] **Step 2: Document the behaviour in the feature doc**

Add a subsection to `docs/features/companion.md` — find the section that covers the LLM/cost layer
(grep for `llm_log_history` and `AI-napló` in that file) and place it there, matching the file's
10-section structure. Content to cover, in this repo's documentation voice:
- the three steps and what a user actually experiences at each (cheaper answers → the weekly memoir
  and the diagnoses stop arriving → the assistant declines with a 429 while everything deterministic
  keeps working);
- the config surface, `mezo.llm-log.budget.*`, with the shipped values;
- the two error codes, `LLM_BUDGET_EXHAUSTED` and `LLM_BUDGET_THROTTLED`;
- the §L1 consequence: the audit log off ⇒ the cap inert;
- the honest limit: the audit row is written asynchronously, so a burst can overshoot slightly —
  bounded by concurrency, not by time, and well inside the $5 headroom.

- [ ] **Step 3: Regenerate the codemap**

```bash
node scripts/gen-codemap.mjs
git diff --stat docs/CODEMAP.md
```

Expected: `docs/CODEMAP.md` gains `LlmBudgetService`, `LlmBudgetGate`, `LlmBudgetLevel` and the new
tests. If the diff is empty, the generator did not see the new files — investigate before committing.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs(llmlog): amend ADR 0035 for the per-user USD cap (mezo-ozri.6)"
```

---

### Task 9: Follow-ups, gates, and the self-PR

**Files:** none in the repo beyond the tracker.

- [ ] **Step 1: File the deferred work as bd issues**

```bash
bd create "FE: dedikált üzenet az AI-költségkeret kimerülésekor (LLM_BUDGET_EXHAUSTED)" \
  -p 2 -l frontend,companion,llmlog \
  -d "S6 (mezo-ozri.6) bevezette az LLM_BUDGET_EXHAUSTED / LLM_BUDGET_THROTTLED hibakódokat (HTTP 429) a chat és minden LLM-es felületen. A FE ma generikus hibát mutat rájuk. Kell: a chatHooks.ts COMPANION_EMPTY_ANSWER-mintájára egy felismerés + emberi magyar szöveg ('elfogyott a havi AI-kereted, X nap múlva újraindul'), és ugyanez a proaktív felületeken."
bd create "Cap-állapot láthatóvá tétele a felhasználónak (hány % fogyott el)" \
  -p 3 -l backend,frontend,llmlog \
  -d "S6 (mezo-ozri.6) backend-only: a fokozatok csendben aktiválódnak. Érdemes egy /api/llm-usage-kiterjesztés + FE jelzés, hogy a user lássa, miért lettek olcsóbbak a válaszai, mielőtt teljesen elfogy a keret."
```

Then link both to the epic (`bd dep add <new-id> mezo-ozri` or the equivalent this repo uses — check
`bd prime` output for the exact subcommand).

- [ ] **Step 2: Run the focused gates**

```bash
cd backend && ./mvnw -q test -Dtest='LlmBudget*+LlmCallContextHolderTest+LlmModelRouter*+LlmLogRepositoryIT+LlmPricingPropertiesBindingTest+LlmLogRecorderWiringIT+LlmCallContextTaggingIT+ChatModelQualifierIT+OpenAiProviderWiringIT' -Dmezo.test.use-testcontainers=true
```

Plus the ArchUnit + codemap gates the focused ITs skip:

```bash
cd backend && ./mvnw -q test -Dtest=ArchitectureTest
node scripts/gen-codemap.mjs && git diff --exit-code docs/CODEMAP.md
```

Expected: all green, and the codemap diff empty (already committed in Task 8).

- [ ] **Step 3: Refresh the tracker backup and push**

```bash
node scripts/check-beads-backup.mjs --fix
git add .beads/issues.jsonl && git commit -m "chore(beads): refresh the tracker export after the USD-cap slice"
git push -u origin feat/llm-budget-cap
```

- [ ] **Step 4: Open the self-PR (the CI gate)**

```bash
gh pr create --fill --title "feat(llmlog): per-user rolling USD cap with graded degradation (mezo-ozri.6)"
```

Wait for `ci.yml` green. Then, **before merging**, re-check the merge result against current main:

```bash
gh workflow run premerge.yml -f pr=<number>
```

- [ ] **Step 5: Merge and close**

```bash
git fetch origin && git pull --rebase
# worktree: main is checked out elsewhere — merge detached and push HEAD:main
git checkout --detach origin/main
git merge --no-ff feat/llm-budget-cap -m "Merge branch 'feat/llm-budget-cap' — per-user rolling USD cap (mezo-ozri.6)"
git push origin HEAD:main
git push origin --delete feat/llm-budget-cap
bd close mezo-ozri.6
bd dolt push
```

---

## Self-Review

**Spec coverage.** §C1 (the $5 cap and its three steps) → Tasks 2, 4, 5, 6, 7. §C2 (the `runWith`
chokepoint) → Task 5. §L1 (log off ⇒ cap inert, explicit) → Tasks 4, 7, 8. §5's "`sumCostSince`
beside the existing aggregation" → Task 1. §7's config sketch → Task 2, with D1/D2/D4 recorded as
amendments in the table above. §6's "S6 uses S4's router for the degradation" → Task 6. bd's "ADR
0035 amendelendő" → Task 8. bd's "provider-hiba és belső retry nem fogyaszt user-egységet" → Task 1
(ERROR rows excluded). bd's acceptance criteria, all three clauses → Task 7.

**Deliberately out of scope**, with a filed issue instead of a silent gap: the user-facing copy for
the two new error codes, and any UI that shows an account how much of its ceiling is gone (Task 9).
`mezo-cxr8` (spec §9's cost leak that the cap would *mask*) is not touched here either — it is a
separate open issue and closing it inside this slice would hide a real bug behind a new ceiling.

**Placeholders:** none — every step carries the code or the exact command. Where a step depends on a
repo idiom I have not read line-by-line (`1.0.0_master.yml`'s include shape, `LlmActorContext.runAs`'s
signature, the `LlmLogPopulator` import idiom), the step says to read the neighbouring example first
rather than guessing, and names the file to read.

**Type consistency:** `LlmBudgetLevel` / `LlmBudgetGate.levelFor(String)` / `isThrottled(String)` /
`LlmBudgetService.allows(String, LlmBudgetLevel)` / `LlmCallContextHolder.budgetLevel()` /
`LlmLogRepository.sumCostSince(Instant, UUID, CallStatus)` / `Tier.degradeModel()` are used with the
same names and signatures in every task that references them.
