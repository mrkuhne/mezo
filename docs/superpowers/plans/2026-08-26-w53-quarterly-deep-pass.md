# W5.3 Quarterly Deep Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A quarterly smart-tier pass that compares the just-finished quarter with the one before it, proposes `SEASON` graph candidates into the L2 inbox, feeds a decision-quality trend into the pragmatic profile and re-runs it, plus a `compare_periods` chat tool so Daniel can ask for the same comparison himself.

**Architecture:** A new `feature/companion/quarterly/` subpackage (the `feature/companion/profile/` precedent: feature-scoped `@Validated` properties record + service + cron job). `QuarterlyReviewService.runFor(userId, quarterStart)` gathers the two quarters' `period_summary` month rungs in PURE CODE, makes ONE smart-tier call that only *proposes*, and writes `status=candidate` `SEASON` nodes through the existing `GraphService.createCandidate` — the same L2 idiom W2.3 uses, so the existing `/api/companion/graph/node/candidate` inbox and `LifeEventCandidateService.decide` carry them with no new endpoint. `QuarterlyReviewJob` runs it per user, then calls `ProfileAssembler.rebuild`. The decision-quality trend is a pure-code section appended to `ProfileAssembler`'s payload (so the weekly run benefits too). `compare_periods` is a new `@Tool` on `MemoryTools` over `period_summary` only.

**Tech Stack:** Java 25 / Spring Boot (backend), Liquibase (no migration in this slice — no new table), React + TS + TanStack Query (frontend), OpenAPI contract-first, JUnit5 + Testcontainers integration tests.

## Global Constraints

Copied from spec §11 (`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`) and the house rules; every task's requirements implicitly include these.

- **Contract-first.** `api/feature/...` fragment changes first, then `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. Never hand-write a boundary DTO.
- **Every LLM/embed call site** wraps in `llmCallContextHolder.runWith(new LlmCallContext(feature, operation, entityKind, entityId), () -> …)`. This slice's feature string is `companion_quarterly`.
- **Tiering:** cheap `chat-model` for nightly extraction/structuring; **smart tier only for weekly/quarterly synthesis** — this slice's one call uses `companionLlm.completeSmart(...)`.
- **Config, never code:** no hardcoded thresholds/schedules. `@Validated` `*Properties` record, bound from `application.yml`. Spring `@Value` is banned (ArchUnit `no_spring_value_annotation`).
- **New cron ⇒ techcore switch + SwitchOffIT.** Switch key `mezo.techcore.cron.<job>.enabled`; off ⇒ the job bean does not exist.
- **Integration-first tests.** No new table in this slice, so `ResetDatabase` and the populator list are unchanged (`GraphPopulator`, `PeriodSummaryPopulator`, `FeedbackPopulator`, `JournalPopulator` already cover every row this slice reads/writes).
- **ArchUnit:** `@Service` classes live in a `..service..` package; `@Transactional` is method-level only; no field injection (`@PersistenceContext` in test populators is the documented exception); feature slices stay cycle-free (`companion.quarterly` → `companion.graph`/`companion.profile` is *inside* the companion slice, so no new cycle).
- **IDENT-6:** everything the AI *derives* lands as a `candidate`, never `active`. IDENT-3: every failure path degrades to "nothing proposed", never to an exception escaping the job.
- **Docs in the same change**, then `node scripts/lint-docs.mjs` — new staleness is forbidden. Regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) whenever files are added.
- **Frontend:** `docs/references/frontend_conventions.md` binds; data hooks via the `@/data/hooks` barrel only; dual-mode with honest mock seeds.
- **Commits** carry the driving bd id: `feat(companion): … (mezo-b3pp.20)`.

## Scope decision made before planning

Spec §9.3 says `compare_periods` "reads period_summary + rollups". "Rollups" is ambiguous (W4.2 `feedback_rollup` vs. the weekly/monthly `period_summary` rungs, which are themselves rollups). **Decided with Daniel: the tool reads `period_summary` ONLY.** A "hasonlítsd össze a nyarat a tavasszal" question is about his life, not about how many 👍 the companion's own surfaces collected. The exclusion is stated explicitly in the `@Tool` description (tool-conventions rule 4: no overclaim) and in `docs/features/companion.md`. `feedback_rollup` still feeds the quarterly job and the profile — just not the chat tool.

## File Structure

**Backend — created**

| File | Responsibility |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/config/QuarterlyProperties.java` | `mezo.companion.quarterly.*` knobs (`@Validated`, feature-scoped — the `ProfileProperties` precedent). |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/Quarters.java` | Pure calendar helper: quarter start/end/label, parse `2026-Q3`. Shared by the job, the profile trend and the chat tool. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/SeasonSuggestion.java` | The model's per-season JSON shape (`title`, `summary`). |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuarterlyReviewService.java` | Gather → ONE smart call → 0..N `SEASON` candidates. Gates + degrade rules live here. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuarterlyReviewJob.java` | The cron: per-user, per-phase isolated (season candidates, then `ProfileAssembler.rebuild`). |

**Backend — modified**

| File | Change |
|---|---|
| `.../techcore/configuration/FeaturesConfiguration.java` | `QUARTERLY_REVIEW_JOB_SWITCH`. |
| `backend/src/main/resources/application.yml` | `mezo.techcore.cron.quarterly-review-job.enabled` + the `mezo.companion.quarterly` block. |
| `.../companion/graph/repository/GraphNodeRepository.java` | `countQuarterlyNodesOnQuarter` — the quarter gate, native + `is_deleted`-blind (the W2.3 day-gate idiom). |
| `.../journal/repository/DecisionEntryRepository.java` | `findByCreatedByAndReviewedAtBetweenAndOutcomeRatingIsNotNullAndDeletedFalse` — the trend input. |
| `.../companion/profile/service/ProfileAssembler.java` | `DÖNTÉSI MINŐSÉG` payload section (pure code, quarter-over-quarter). |
| `.../companion/tools/MemoryTools.java` | `compare_periods` `@Tool`. |
| `.../companion/service/ChatService.java` | `[Eszköz-útmutató]` line for `compare_periods`. |
| `.../companion/llm/FakeCompanionLlm.java` | `SEASON_MARKER_MIRROR` branch + `[fake-season:…]` / `[fake-season-broken]` sentinels. |

**Contract / frontend — modified**

| File | Change |
|---|---|
| `api/feature/knowledge-graph/knowledge-graph.yml` | Candidate endpoint summaries: LIFE_EVENT **and SEASON**. |
| `frontend/src/data/types.ts` | `LifeEventCandidate.kind` (`'LIFE_EVENT' \| 'SEASON'`). |
| `frontend/src/data/insights/graphApi.ts` | Map `kind` through. |
| `frontend/src/data/insights/graph.ts` | Mock seed gains a SEASON candidate + `CANDIDATE_COPY` kind→copy table. |
| `frontend/src/features/insights/components/LifeEventCandidateCard.tsx` | Kind-aware provenance sentence. |
| `frontend/src/features/insights/pages/KnowledgeListPage.tsx` | Group candidates by kind, kind-aware eyebrow. |

**Docs — modified**: `docs/features/companion.md`, `docs/features/insights.md`, `docs/CODEMAP.md` (generated).

---

### Task 1: Quarterly config, feature switch, and the calendar helper

Foundation only — nothing behaves differently yet, but every later task binds to these names.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/config/QuarterlyProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/Quarters.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/QuarterlyPropertiesIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuartersTest.java`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `QuarterlyProperties(String cron, int maxCandidates, int maxPeriodLines, int renderMaxChars)` — bound at `mezo.companion.quarterly`.
  - `FeaturesConfiguration.QUARTERLY_REVIEW_JOB_SWITCH` = `"mezo.techcore.cron.quarterly-review-job.enabled"`.
  - `Quarters.startOf(LocalDate date) -> LocalDate` (first day of that date's quarter)
  - `Quarters.previous(LocalDate quarterStart) -> LocalDate`
  - `Quarters.endOf(LocalDate quarterStart) -> LocalDate` (inclusive last day)
  - `Quarters.label(LocalDate quarterStart) -> String` (`"2026-Q3"`)
  - `Quarters.parse(String text) -> LocalDate` (accepts `"2026-Q3"` and `"2026-07"`, returns the period's first day; `null` when unparseable)

- [ ] **Step 1: Write the failing unit test for the calendar helper**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuartersTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Pure calendar arithmetic (W5.3, mezo-b3pp.20) — the GraphEdgeLineRendererTest idiom. */
class QuartersTest {

    @Test
    void testStartOf_shouldReturnFirstDayOfQuarter_whenAnyDayGiven() {
        assertThat(Quarters.startOf(LocalDate.of(2026, 8, 26))).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(Quarters.startOf(LocalDate.of(2026, 1, 1))).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(Quarters.startOf(LocalDate.of(2026, 12, 31))).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void testPrevious_shouldCrossTheYearBoundary_whenQ1Given() {
        assertThat(Quarters.previous(LocalDate.of(2026, 1, 1))).isEqualTo(LocalDate.of(2025, 10, 1));
        assertThat(Quarters.previous(LocalDate.of(2026, 7, 1))).isEqualTo(LocalDate.of(2026, 4, 1));
    }

    @Test
    void testEndOf_shouldReturnInclusiveLastDay_whenQuarterStartGiven() {
        assertThat(Quarters.endOf(LocalDate.of(2026, 7, 1))).isEqualTo(LocalDate.of(2026, 9, 30));
        assertThat(Quarters.endOf(LocalDate.of(2026, 1, 1))).isEqualTo(LocalDate.of(2026, 3, 31));
    }

    @Test
    void testLabel_shouldRenderIsoQuarter_whenQuarterStartGiven() {
        assertThat(Quarters.label(LocalDate.of(2026, 7, 1))).isEqualTo("2026-Q3");
        assertThat(Quarters.label(LocalDate.of(2025, 10, 1))).isEqualTo("2025-Q4");
    }

    @Test
    void testParse_shouldAcceptQuarterAndMonth_whenWellFormed() {
        assertThat(Quarters.parse("2026-Q3")).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(Quarters.parse("2026-q3")).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(Quarters.parse(" 2026-07 ")).isEqualTo(LocalDate.of(2026, 7, 1));
    }

    @Test
    void testParse_shouldReturnNull_whenUnparseable() {
        assertThat(Quarters.parse(null)).isNull();
        assertThat(Quarters.parse("")).isNull();
        assertThat(Quarters.parse("tavaly nyar")).isNull();
        assertThat(Quarters.parse("2026-Q5")).isNull();
        assertThat(Quarters.parse("2026-13")).isNull();
    }

    @Test
    void testIsQuarter_shouldDistinguishQuarterFromMonth_whenParsed() {
        assertThat(Quarters.isQuarter("2026-Q3")).isTrue();
        assertThat(Quarters.isQuarter("2026-07")).isFalse();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && ./mvnw -q test -Dtest='QuartersTest'`
Expected: FAIL — `Quarters` does not exist (compilation error).

- [ ] **Step 3: Write the calendar helper**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/Quarters.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly.service;

import java.time.LocalDate;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * W5.3 (bd mezo-b3pp.20, spec §9.3) — the slice's calendar arithmetic in one place. A "quarter"
 * here is always the CALENDAR quarter keyed by its first day (Jan/Apr/Jul/Oct 1st), the same way
 * {@code period_summary.period_start} keys a week by its Monday and a month by its 1st: one
 * identity per period, so a quarter can never be reviewed twice under two different keys.
 *
 * <p>Pure static helper (the {@code ToolText}/{@code GraphEdgeLineRenderer} idiom) — three
 * callers need it and none of them owns it: the quarterly job (which quarter just finished),
 * {@code ProfileAssembler} (the decision-quality trend window) and the {@code compare_periods}
 * tool (parsing what the model asked for).
 */
public final class Quarters {

    /** {@code 2026-Q3} (case-insensitive) or {@code 2026-07} — the two period spellings the
     *  {@code compare_periods} tool accepts. Anything else is not a period. */
    private static final Pattern QUARTER = Pattern.compile("(\\d{4})-[Qq]([1-4])");
    private static final Pattern MONTH = Pattern.compile("(\\d{4})-(0[1-9]|1[0-2])");

    private Quarters() {
    }

    /** The first day of the calendar quarter {@code date} falls in. */
    public static LocalDate startOf(LocalDate date) {
        int firstMonth = ((date.getMonthValue() - 1) / 3) * 3 + 1;
        return LocalDate.of(date.getYear(), firstMonth, 1);
    }

    /** The quarter before {@code quarterStart} — crosses the year boundary for Q1. */
    public static LocalDate previous(LocalDate quarterStart) {
        return quarterStart.minusMonths(3);
    }

    /** The INCLUSIVE last day of the quarter starting at {@code quarterStart}. */
    public static LocalDate endOf(LocalDate quarterStart) {
        return quarterStart.plusMonths(3).minusDays(1);
    }

    /** {@code 2026-Q3} — the label the prompt, the candidate title and the tool output all use. */
    public static String label(LocalDate quarterStart) {
        return quarterStart.getYear() + "-Q" + ((quarterStart.getMonthValue() - 1) / 3 + 1);
    }

    /** Whether {@code text} spells a QUARTER (as opposed to a month) — the tool renders a quarter
     *  from its three month rungs, a month from its own. */
    public static boolean isQuarter(String text) {
        return text != null && QUARTER.matcher(text.strip()).matches();
    }

    /**
     * The first day of the period {@code text} names, or {@code null} when it names none. Never
     * throws: this parses MODEL-SUPPLIED text, and an unparseable argument must reach the tool's
     * honest "nincs adat" branch, not a TOOL_FAILED stack trace.
     */
    public static LocalDate parse(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String trimmed = text.strip();
        Matcher quarter = QUARTER.matcher(trimmed);
        if (quarter.matches()) {
            int q = Integer.parseInt(quarter.group(2));
            return LocalDate.of(Integer.parseInt(quarter.group(1)), (q - 1) * 3 + 1, 1);
        }
        Matcher month = MONTH.matcher(trimmed.toLowerCase(Locale.ROOT));
        if (month.matches()) {
            return LocalDate.of(Integer.parseInt(month.group(1)), Integer.parseInt(month.group(2)), 1);
        }
        return null;
    }
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `cd backend && ./mvnw -q test -Dtest='QuartersTest'`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing properties IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/QuarterlyPropertiesIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.quarterly.config.QuarterlyProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W5.3 (mezo-b3pp.20): the quarterly knobs bind from yml — schedule + caps, config not code. */
class QuarterlyPropertiesIT extends AbstractIntegrationTest {

    @Autowired private QuarterlyProperties properties;

    @Test
    void testConfig_shouldBindQuarterlyBlock_whenContextStarts() {
        assertThat(properties.cron()).isEqualTo("0 0 4 1 1,4,7,10 *");
        assertThat(properties.maxCandidates()).isEqualTo(2);
        assertThat(properties.maxPeriodLines()).isEqualTo(6);
        assertThat(properties.renderMaxChars()).isEqualTo(400);
    }
}
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && ./mvnw -q test -Dtest='QuarterlyPropertiesIT'`
Expected: FAIL — `QuarterlyProperties` does not exist.

- [ ] **Step 7: Write the properties record**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/config/QuarterlyProperties.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * W5.3 (bd mezo-b3pp.20, spec §9.3) — the quarterly deep pass's knobs.
 *
 * <p>Feature-scoped record rather than another {@code CompanionProperties} nested component: the
 * {@code ProfileProperties}/{@code FeedbackLearningProperties} precedent ({@code
 * CompanionProperties} is already 18 components deep and every new one widens a file every
 * companion session must read). Picked up by {@code @ConfigurationPropertiesScan}.
 *
 * @param cron            the quarterly run (server zone) — the 1st of Jan/Apr/Jul/Oct, AFTER that
 *                        dawn's 03:50 monthly consolidation rung, which is this job's input.
 * @param maxCandidates   how many SEASON candidates ONE run may propose (the model is told the
 *                        same number; anything beyond it is dropped, never merged).
 * @param maxPeriodLines  how many month rungs per side enter the prompt — a quarter has 3, the
 *                        cap is the guard against a mis-set window flooding the payload.
 * @param renderMaxChars  per-rung character cap in the {@code compare_periods} tool output (the
 *                        {@code recall.render-max-chars} idiom: a tool result is a prompt budget).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.quarterly")
public record QuarterlyProperties(
        @NotBlank String cron,
        @Min(0) @Max(10) int maxCandidates,
        @Min(1) @Max(24) int maxPeriodLines,
        @Min(50) @Max(4000) int renderMaxChars) {
}
```

- [ ] **Step 8: Add the feature switch constant**

In `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`, immediately after the `GRAPH_MAINTENANCE_JOB_SWITCH` block, add:

```java
    /** Phase 5 W5.3 (mezo-b3pp.20) quarterly deep pass — techcore cron zone. Off ⇒ the
     *  QuarterlyReviewJob bean does not exist; no season candidates, no quarterly profile rerun
     *  (the WEEKLY profile job is independent and keeps running). */
    public static final String QUARTERLY_REVIEW_JOB_SWITCH =
        "mezo.techcore.cron.quarterly-review-job.enabled";
```

- [ ] **Step 9: Add the yml cron switch entry**

In `backend/src/main/resources/application.yml`, inside the `mezo.techcore.cron:` block, directly after the `consolidation-job` entry, add:

```yaml
      # W5.3 (mezo-b3pp.20) quarterly deep pass (schedule: mezo.companion.quarterly.cron);
      # off = the QuarterlyReviewJob bean does not exist (no season candidates, no quarterly
      # profile rerun; the weekly profile job is independent and unaffected)
      quarterly-review-job:
        enabled: true
```

- [ ] **Step 10: Add the quarterly tuning block**

In `backend/src/main/resources/application.yml`, in the `mezo.companion:` block, directly AFTER the `profile:` block (they are read in that order at dawn), add:

```yaml
    # W5.3 (mezo-b3pp.20, spec §9.3): the quarterly deep pass — season-over-season comparison.
    quarterly:
      # 04:00 on the 1st of Jan/Apr/Jul/Oct — after that dawn's 03:50 monthly consolidation rung
      # (this job's input) and clear of every other dawn slot (02:20 summary, 02:40 patterns,
      # 03:00 SUN hypotheses, 03:05 hourly flags, 03:10 feedback-learning, 03:20 graph,
      # 03:30 MON weekly rung, 03:40 llm-log retention, 03:45 MON profile, 03:50 monthly rung).
      cron: "0 0 4 1 1,4,7,10 *"
      # Max SEASON candidates ONE run may propose into the L2 inbox (IDENT-6: proposals only).
      max-candidates: 2
      # Month rungs per side that enter the prompt — a quarter has 3; the cap is the flood guard.
      max-period-lines: 6
      # Per-rung character cap in the compare_periods tool output (a tool result is prompt budget).
      render-max-chars: 400
```

- [ ] **Step 11: Run the properties IT to verify it passes**

Run: `cd backend && ./mvnw -q test -Dtest='QuarterlyPropertiesIT,QuartersTest'`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly
git commit -m "feat(companion): quarterly deep-pass config, switch and calendar helper (mezo-b3pp.20)"
```

---

### Task 2: `QuarterlyReviewService` — SEASON candidates from a season-over-season comparison

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/SeasonSuggestion.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuarterlyReviewService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphNodeRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/QuarterlyReviewServiceIT.java`

**Interfaces:**
- Consumes: `Quarters`, `QuarterlyProperties` (Task 1); `GraphService.createCandidate(UUID userId, String kind, String title, String summary, String sourceKind, LocalDate occurredOn, Map<String,Object> meta)`; `PeriodSummaryRepository.findByCreatedByAndGranularityAndPeriodStartBetweenOrderByPeriodStartAsc(UUID, String, LocalDate, LocalDate)`; `FeedbackRollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(UUID)`.
- Produces:
  - `QuarterlyReviewService.SOURCE_QUARTERLY` = `"quarterly"` (the `knowledge_node.source_kind` of everything this service writes).
  - `QuarterlyReviewService.SEASON_MARKER` = `"NEGYEDEVES-SZEZON-FELADAT"`.
  - `QuarterlyReviewService.runFor(UUID userId, LocalDate quarterStart) -> int` (candidates created; 0 on every gate/failure).
  - `SeasonSuggestion(String title, String summary)`.
  - `GraphNodeRepository.countQuarterlyNodesOnQuarter(UUID createdBy, LocalDate occurredOn) -> long`.
  - `FakeCompanionLlm.SEASON_SENTINEL` (`[fake-season:[…]]`), `FakeCompanionLlm.SEASON_BROKEN` (`[fake-season-broken]`).

- [ ] **Step 1: Write the failing service IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/QuarterlyReviewServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W5.3 (mezo-b3pp.20, spec §9.3) — the quarterly pass proposes, never activates (IDENT-6), pays
 * for nothing when there is nothing to compare, and never re-proposes a quarter it already
 * touched (the W2.3 day-gate idiom, one rung up).
 */
@ActiveProfiles("companion-fake")
class QuarterlyReviewServiceIT extends AbstractIntegrationTest {

    private static final LocalDate Q3 = LocalDate.of(2026, 7, 1);
    private static final LocalDate Q2 = LocalDate.of(2026, 4, 1);

    @Autowired private QuarterlyReviewService quarterlyReviewService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    /** Both quarters' month rungs, with the script planted in the PREVIOUS quarter's April rung
     *  (the [fake-period:…] channel idiom — plant it in what the pure-code gather actually
     *  renders). Planting it on the previous-quarter side is deliberate: it makes every test in
     *  this class depend on the season-over-season gather being real, and gives
     *  {@code testRunFor_shouldRenderThePreviousQuarterIntoThePrompt…} its assertion. */
    private UUID seedBothQuarters(String script) {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                Q2, "Áprilisi hónap. " + script);
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                Q2.plusMonths(1), "Májusi hónap.");
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                Q3, "Júliusi hónap.");
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                Q3.plusMonths(1), "Augusztusi hónap.");
        return owner;
    }

    @Test
    void testRunFor_shouldCreateCandidatesNotActives_whenBothQuartersHaveRungs() {
        UUID owner = seedBothQuarters(
                "[fake-season:[{\"title\":\"Nyári alapozás\",\"summary\":\"A nyár a volumenről szólt.\"}]]");

        int created = quarterlyReviewService.runFor(owner, Q3);

        assertThat(created).isEqualTo(1);
        List<GraphNodeEntity> nodes = nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE);
        assertThat(nodes).singleElement().satisfies(n -> {
            assertThat(n.getKind()).isEqualTo(GraphNodeEntity.KIND_SEASON);
            assertThat(n.getTitle()).isEqualTo("Nyári alapozás");
            assertThat(n.getSummary()).isEqualTo("A nyár a volumenről szólt.");
            assertThat(n.getSourceKind()).isEqualTo(QuarterlyReviewService.SOURCE_QUARTERLY);
            assertThat(n.getOccurredOn()).isEqualTo(Q3);
        });
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE)).isEmpty();
    }

    @Test
    void testRunFor_shouldRenderThePreviousQuarterIntoThePrompt_whenItHasRungs() {
        // seedBothQuarters plants its script in the APRIL rung — a PREVIOUS-quarter row. The
        // sentinel can only match if the gather actually rendered the previous quarter into the
        // user message, so a candidate here is proof the season-OVER-season comparison is real
        // and not a single-quarter read. (Every other test in this class would pass either way.)
        UUID owner = seedBothQuarters(
                "[fake-season:[{\"title\":\"Elozobol jott\",\"summary\":\"Az elozo negyedev szovegebol.\"}]]");

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE))
                .singleElement()
                .satisfies(n -> assertThat(n.getTitle()).isEqualTo("Elozobol jott"));
    }

    @Test
    void testRunFor_shouldCapCandidates_whenModelProposesMoreThanTheConfiguredMax() {
        UUID owner = seedBothQuarters("[fake-season:["
                + "{\"title\":\"Egy\",\"summary\":\"a\"},"
                + "{\"title\":\"Kettő\",\"summary\":\"b\"},"
                + "{\"title\":\"Három\",\"summary\":\"c\"}]]");

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(2);   // max-candidates: 2
    }

    @Test
    void testRunFor_shouldSkipEntirely_whenTheQuarterHasNoRungs() {
        UUID owner = userPopulator.createUser().getId();
        int before = fakeCompanionLlm.completeCallCount();

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();

        // The emptiness gate is BEFORE any spend: a quarter with nothing in it costs no call.
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE)).isEmpty();
    }

    @Test
    void testRunFor_shouldStillRun_whenOnlyTheCurrentQuarterHasRungs() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, Q3,
                "Júliusi hónap. [fake-season:[{\"title\":\"Első szezon\",\"summary\":\"Nincs mihez mérni.\"}]]");

        // No previous quarter is an honest "nincs mit összehasonlítani" IN THE PROMPT, not a
        // reason to skip: the first quarter of a user's history still deserves a season reading.
        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
    }

    @Test
    void testRunFor_shouldNotReProposeTheQuarter_whenItWasAlreadyProcessed() {
        UUID owner = seedBothQuarters(
                "[fake-season:[{\"title\":\"Nyári alapozás\",\"summary\":\"A nyár a volumenről szólt.\"}]]");
        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
        int afterFirst = fakeCompanionLlm.completeCallCount();

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(afterFirst);   // gate before spend
    }

    @Test
    void testRunFor_shouldNotResurrectARejectedQuarter_whenTheCandidateWasSoftDeleted() {
        UUID owner = seedBothQuarters(
                "[fake-season:[{\"title\":\"Nyári alapozás\",\"summary\":\"A nyár a volumenről szólt.\"}]]");
        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
        GraphNodeEntity candidate = nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE).getFirst();
        nodeRepository.delete(candidate);   // @SQLDelete soft delete — the reject path

        // The gate counts soft-deleted rows too; a rejected quarter must never come back.
        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();
    }

    @Test
    void testRunFor_shouldDegradeToZero_whenTheModelAnswerIsUnparseable() {
        UUID owner = seedBothQuarters(FakeCompanionLlm.SEASON_BROKEN);

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE)).isEmpty();
    }

    @Test
    void testRunFor_shouldDegradeToZero_whenTheModelCallFails() {
        UUID owner = seedBothQuarters(FakeCompanionLlm.FAIL_COMPLETE);

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();
    }

    @Test
    void testRunFor_shouldDropBlankTitles_whenTheModelProposesThem() {
        UUID owner = seedBothQuarters("[fake-season:["
                + "{\"title\":\"   \",\"summary\":\"üres\"},"
                + "{\"title\":\"Jó szezon\",\"summary\":\"ez marad\"}]]");

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE))
                .singleElement()
                .satisfies(n -> assertThat(n.getTitle()).isEqualTo("Jó szezon"));
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ./mvnw -q test -Dtest='QuarterlyReviewServiceIT'`
Expected: FAIL — `QuarterlyReviewService` does not exist.

- [ ] **Step 3: Add the quarter gate query**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphNodeRepository.java`, append inside the interface (after `countExtractorNodesOnDay`):

```java
    /**
     * W5.3's per-quarter idempotence probe (mezo-b3pp.20) — the {@link #countExtractorNodesOnDay}
     * idiom one rung up: has the quarterly pass ALREADY processed this quarter for this user?
     * Deliberately native and deliberately blind to {@code is_deleted}, for the same reason: a
     * season candidate the user REJECTED is soft-deleted, and a JPA finder (which
     * {@code @SQLRestriction} filters) would report the quarter as unprocessed and resurrect the
     * same rejected guess on the next run.
     *
     * <p>The literal {@code 'quarterly'} below MUST stay equal to {@code
     * QuarterlyReviewService.SOURCE_QUARTERLY} — a native query cannot reference the Java
     * constant, so a rename on one side silently breaks the gate on the other;
     * {@code QuarterlyReviewServiceIT} pins the two together.
     */
    @Query(value = """
        select count(*) from knowledge_node
        where created_by = :createdBy and source_kind = 'quarterly' and occurred_on = :occurredOn
        """, nativeQuery = true)
    long countQuarterlyNodesOnQuarter(@Param("createdBy") UUID createdBy,
        @Param("occurredOn") LocalDate occurredOn);
```

- [ ] **Step 4: Add the suggestion record**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/SeasonSuggestion.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly.service;

import tools.jackson.annotation.JsonIgnoreProperties;

/**
 * One SEASON the quarterly model proposes (W5.3, bd mezo-b3pp.20) — the {@code
 * LifeEventSuggestion} shape, minus edges: a season is a period reading, not a causal claim, so
 * this slice proposes no graph edges at all (the L2 accept path materialises none).
 *
 * <p>Unknown properties are ignored: a chatty model adding a field must not fail the whole parse.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SeasonSuggestion(String title, String summary) {
}
```

**Note for the implementer:** this repo uses **Jackson 3** (`tools.jackson.*`, see `LifeEventExtractionService`'s `tools.jackson.databind.ObjectMapper` import). If `tools.jackson.annotation.JsonIgnoreProperties` does not resolve, check how `LifeEventSuggestion` handles it and copy that exactly — match the neighbour, do not invent an import.

- [ ] **Step 5: Write the service**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuarterlyReviewService.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphProposedEdge;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.quarterly.config.QuarterlyProperties;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * W5.3 quarterly deep pass (bd mezo-b3pp.20, spec §9.3): ONE smart-tier pass per quarter that
 * reads the just-finished quarter's {@code period_summary} month rungs against the previous
 * quarter's, plus the W4.2 feedback rollups, and proposes 0..N {@code SEASON} **candidates**.
 * Nothing here ever becomes active (IDENT-6): {@code LifeEventCandidateService.decide} — the
 * existing L2 confirm inbox, which is kind-agnostic — remains the only path from a proposal to
 * durable graph structure. A season proposes NO edges ({@code meta.proposedEdges} is empty): a
 * season is a reading of a period, not a causal claim.
 *
 * <p><b>Smart tier, deliberately.</b> The consolidation ladder condenses on the cheap tier
 * because it only shortens prose; this pass genuinely SYNTHESISES across two quarters, which is
 * exactly the weekly/quarterly case spec §11 reserves the smart tier for (the memoir/profile
 * precedent).
 *
 * <p><b>Two gates, both before any spend:</b> (1) the quarter already processed — {@link
 * GraphNodeRepository#countQuarterlyNodesOnQuarter} counts soft-deleted rows too, so a rejected
 * quarter is never re-proposed; (2) the quarter carries no month rungs at all — a quarter with
 * nothing consolidated in it costs no LLM call. A MISSING PREVIOUS quarter is NOT a gate: the
 * first quarter of a history still deserves a season reading, the prompt just says honestly that
 * there is nothing to compare it against.
 *
 * <p>IDENT-3: a failed, empty or unparseable model answer means zero candidates, logged and
 * swallowed — never an exception out of {@link #runFor}. The same holds for the persistence side:
 * {@link #runFor} carries no {@code @Transactional} (each quarterly call for a user is its own
 * unit of work), so the writes are pulled into {@link #persistCandidates} and invoked through
 * {@link #self}, the injected proxy — plain {@code this} self-invocation bypasses the proxy and
 * gets no transactional advice at all (the {@code LifeEventExtractionService} idiom). That one
 * transaction covers every candidate the quarter proposes: a persistence failure on suggestion N
 * rolls back 1..N too, so the quarter ends with zero candidates rather than a half-written one
 * and the gate then still finds nothing, leaving the quarter cleanly re-runnable.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class QuarterlyReviewService {

    /** Dispatch key for FakeCompanionLlm (the {@code EXTRACTOR_MARKER} idiom). */
    public static final String SEASON_MARKER = "NEGYEDEVES-SZEZON-FELADAT";

    /** {@code knowledge_node.source_kind} for everything this service writes. MUST stay equal to
     *  the literal in {@link GraphNodeRepository#countQuarterlyNodesOnQuarter}'s native query. */
    public static final String SOURCE_QUARTERLY = "quarterly";

    private static final String SYSTEM_PROMPT = SEASON_MARKER + """


        Te Daniel személyes társának a negyedéves olvasata vagy. Bemenet: a most lezárult
        negyedév havi összefoglalói, az azt megelőző negyedévé, és az AI-felületek
        visszajelzés-statisztikái. Feladat: megnevezni, MILYEN SZEZON volt ez a negyedév —
        egy-egy visszatérő ív, ami a hónapokon átnyúlik, és amit az előző negyedévhez képest
        látni lehet.

        Egy szezon nem esemény és nem tanács: a periódus olvasata.

        Válasz KIZÁRÓLAG JSON tömb, magyarázat nélkül:
        [{"title": "rövid magyar cím", "summary": "2-3 mondat, múlt idő"}]

        - Legfeljebb %d szezont javasolj; ha a negyedév nem áll össze ilyenné, a válasz: []
        - Csak a megadott szövegekre támaszkodj, semmit ne találj ki
        - Ne szólítsd meg Danielt, és ne adj javaslatot a jövőre
        """;

    private final CompanionLlm companionLlm;
    private final GraphService graphService;
    private final GraphNodeRepository nodeRepository;
    private final PeriodSummaryRepository periodSummaryRepository;
    private final FeedbackRollupRepository feedbackRollupRepository;
    private final QuarterlyProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    // Self-injected proxy (ObjectProvider defers resolution, so this is safe despite the apparent
    // circularity) — see the class javadoc for why persistCandidates is invoked through this
    // proxy instead of `this`.
    private final ObjectProvider<QuarterlyReviewService> self;

    /**
     * @param quarterStart the first day of the quarter being reviewed (see {@link Quarters}).
     * @return how many SEASON candidates were created (0 on either gate, on an empty answer, on
     *     any model/parse failure, or — atomically — on any candidate-persistence failure).
     */
    public int runFor(UUID userId, LocalDate quarterStart) {
        if (nodeRepository.countQuarterlyNodesOnQuarter(userId, quarterStart) > 0) {
            return 0;   // already processed (accepted, pending, or rejected) — never re-proposed
        }
        List<PeriodSummaryEntity> current = monthRungs(userId, quarterStart);
        if (current.isEmpty()) {
            log.debug("No month rungs in quarter {} for {} — no quarterly pass", quarterStart, userId);
            return 0;   // emptiness gate — an unconsolidated quarter costs no LLM call
        }
        List<PeriodSummaryEntity> previous = monthRungs(userId, Quarters.previous(quarterStart));
        List<SeasonSuggestion> suggestions;
        try {
            String prompt = SYSTEM_PROMPT.formatted(properties.maxCandidates());
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("companion_quarterly", "season_candidates", "quarter", null),
                () -> companionLlm.completeSmart(prompt, buildUserMessage(userId, quarterStart, current, previous)));
            suggestions = parse(raw).stream()
                .filter(Objects::nonNull)
                .filter(s -> s.title() != null && !s.title().isBlank())
                .limit(properties.maxCandidates())
                .toList();
        } catch (Exception e) {
            log.warn("Quarterly season proposal failed for {} on {}", userId, quarterStart, e);
            return 0;
        }
        if (suggestions.isEmpty()) {
            return 0;
        }
        try {
            return self.getObject().persistCandidates(userId, quarterStart, suggestions);
        } catch (Exception e) {
            log.warn("Quarterly candidate persistence failed for {} on {} — degrading to zero so "
                + "the quarter stays reprocessable", userId, quarterStart, e);
            return 0;
        }
    }

    /** Every proposal of the quarter, in ONE transaction (see the class javadoc). Called only
     *  through {@link #self} — plain {@code this} self-invocation gets no transactional advice. */
    @Transactional
    public int persistCandidates(UUID userId, LocalDate quarterStart, List<SeasonSuggestion> suggestions) {
        int created = 0;
        for (SeasonSuggestion suggestion : suggestions) {
            graphService.createCandidate(userId, GraphNodeEntity.KIND_SEASON,
                truncateTitle(suggestion.title().strip()), suggestion.summary(),
                SOURCE_QUARTERLY, quarterStart, Map.of(GraphProposedEdge.META_KEY, List.of()));
            created++;
        }
        return created;
    }

    private List<PeriodSummaryEntity> monthRungs(UUID userId, LocalDate quarterStart) {
        return periodSummaryRepository
            .findByCreatedByAndGranularityAndPeriodStartBetweenOrderByPeriodStartAsc(
                userId, PeriodSummaryEntity.GRANULARITY_MONTH, quarterStart, Quarters.endOf(quarterStart))
            .stream()
            .limit(properties.maxPeriodLines())
            .toList();
    }

    /** Pure-code gather — the two quarters side by side, then the feedback rollups. Honest about
     *  absence: a quarter with no rungs renders the sentence rather than an empty heading. */
    private String buildUserMessage(UUID userId, LocalDate quarterStart,
            List<PeriodSummaryEntity> current, List<PeriodSummaryEntity> previous) {
        LocalDate previousStart = Quarters.previous(quarterStart);
        StringBuilder sb = new StringBuilder();
        sb.append("EZ A NEGYEDÉV (").append(Quarters.label(quarterStart)).append("):\n");
        appendRungs(sb, current);
        sb.append("\nAZ ELŐZŐ NEGYEDÉV (").append(Quarters.label(previousStart)).append("):\n");
        if (previous.isEmpty()) {
            sb.append("- nincs adat, ez az első ilyen negyedév\n");
        } else {
            appendRungs(sb, previous);
        }
        List<String> feedback = feedbackRollupRepository
            .findByCreatedByAndDeletedFalseOrderByScopeAsc(userId).stream()
            .filter(r -> r.getStats() != null && r.getStats().total() != null && r.getStats().total() > 0)
            .map(r -> "- " + r.getScope() + ": " + r.getStats().up() + " tetszik / "
                + r.getStats().down() + " nem tetszik")
            .toList();
        if (!feedback.isEmpty()) {
            sb.append("\nVISSZAJELZÉSEK AZ AI-FELÜLETEKRŐL:\n").append(String.join("\n", feedback)).append('\n');
        }
        return sb.toString();
    }

    private static void appendRungs(StringBuilder sb, List<PeriodSummaryEntity> rungs) {
        for (PeriodSummaryEntity rung : rungs) {
            sb.append("- ").append(rung.getPeriodStart()).append(": ").append(rung.getSummaryText()).append('\n');
        }
    }

    private List<SeasonSuggestion> parse(String raw) throws Exception {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return List.of();
        }
        return objectMapper.readValue(raw.substring(start, end + 1),
            objectMapper.getTypeFactory().constructCollectionType(List.class, SeasonSuggestion.class));
    }

    /** knowledge_node.title is varchar(120); a chatty model can exceed it. */
    private static String truncateTitle(String text) {
        return text.length() <= 120 ? text : text.substring(0, 117) + "…";
    }
}
```

**Watch out:** `FeedbackRollupRepository` is a plain `JpaRepository` with no feature switch, but `FeedbackRollupEntity` may only be readable when the feedback slice is on. Verify by reading `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/repository/FeedbackRollupRepository.java` — if the repository interface carries no `@ConditionalOnProperty` (repositories never do), direct injection is safe.

- [ ] **Step 6: Add the fake-LLM branch**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`, add the sentinels next to the `LIFE_EVENTS_SENTINEL` declarations:

```java
    /** Scripted season proposal (W5.3): [fake-season:[…]] planted in a month rung's text (the
     *  gather renders every rung verbatim, so that is this pipeline's sentinel-planting channel). */
    public static final Pattern SEASON_SENTINEL =
            Pattern.compile("\\[fake-season:(\\[.*])]", Pattern.DOTALL);

    /** Scripted BROKEN season answer (W5.3) — matching brackets, invalid JSON inside, so ITs
     *  exercise the catch-and-log degrade instead of the "empty answer" path. */
    public static final String SEASON_BROKEN = "[fake-season-broken]";
```

and the dispatch branch immediately AFTER the `LifeEventExtractionService.EXTRACTOR_MARKER` branch in `complete(String, List<Turn>, String, List<ToolCallback>, Map)`:

```java
        if (systemPrompt.startsWith(QuarterlyReviewService.SEASON_MARKER)) {
            if (userMessage.contains(SEASON_BROKEN)) {
                // matching brackets, invalid JSON inside — the catch-and-log path, not "empty"
                return "[{\"title\":\"Törött\",\"summary\":}]";
            }
            Matcher m = SEASON_SENTINEL.matcher(userMessage);
            // default = no seasons: an un-scripted quarter proposes nothing
            return m.find() ? m.group(1) : "[]";
        }
```

Add the import `io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewService;` next to the existing `LifeEventExtractionService` import.

**Important:** `completeSmart(String, String)` defaults to `complete(systemPrompt, userMessage)` → `complete(systemPrompt, userMessage, List.of(), Map.of())` → the 5-arg method above, so this one branch covers the smart-tier call with no extra override.

- [ ] **Step 7: Run the IT to verify it passes**

Run: `cd backend && ./mvnw -q test -Dtest='QuarterlyReviewServiceIT'`
Expected: PASS (10 tests). `fakeCompanionLlm.completeCallCount()` is a process-wide monotonic counter, so the gate tests compare it against a value captured immediately before the call — never against an absolute number.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly
git commit -m "feat(companion): quarterly SEASON candidate proposal service (mezo-b3pp.20)"
```

---

### Task 3: Decision-quality trend in the pragmatic profile

Spec §9.3: "decision-quality observations (reviewed `decision_entry` outcomes trend) appended to the profile input". Implemented as a PURE-CODE payload section on `ProfileAssembler`, so the weekly run gets it too — the quarterly job's contribution is that it re-runs the assembler right after the season pass.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/DecisionEntryRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssembler.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssemblerIT.java` (extend)

**Interfaces:**
- Consumes: `Quarters` (Task 1).
- Produces: `ProfileAssembler.renderPayload(...)` gains a `DÖNTÉSI MINŐSÉG:` section; `DecisionEntryRepository.findByCreatedByAndReviewedAtBetweenAndOutcomeRatingIsNotNullAndDeletedFalse(UUID createdBy, Instant from, Instant to)`.

- [ ] **Step 1: Read the existing IT so the new tests match its fixtures**

Run: `sed -n '1,80p' backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssemblerIT.java`

Note how it seeds users and decisions (it already exercises the `ÉRTÉKELT DÖNTÉSEK` section) and reuse the same populator calls verbatim.

- [ ] **Step 2: Write the failing tests**

Append to `backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssemblerIT.java` (adapt the seeding lines to the fixtures you just read — the assertions are what matter):

```java
    @Test
    void testRenderPayload_shouldCompareQuarters_whenBothHaveReviewedDecisions() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate thisQuarter = LocalDate.now();
        LocalDate lastQuarter = Quarters.previous(Quarters.startOf(thisQuarter)).plusDays(10);
        // two reviewed decisions this quarter (4 and 5), one last quarter (2)
        reviewedDecision(owner, thisQuarter, (short) 4);
        reviewedDecision(owner, thisQuarter, (short) 5);
        reviewedDecision(owner, lastQuarter, (short) 2);

        profileAssembler.rebuild(owner);

        String payload = lastPayloadFor(owner);
        assertThat(payload).contains("DÖNTÉSI MINŐSÉG:")
                .contains("ez a negyedév: 4,5/5 (2 értékelt döntés)")
                .contains("előző negyedév: 2,0/5 (1 értékelt döntés)");
    }

    @Test
    void testRenderPayload_shouldOmitThePreviousQuarter_whenItHasNoReviewedDecisions() {
        UUID owner = userPopulator.createUser().getId();
        reviewedDecision(owner, LocalDate.now(), (short) 3);

        profileAssembler.rebuild(owner);

        String payload = lastPayloadFor(owner);
        assertThat(payload).contains("ez a negyedév: 3,0/5 (1 értékelt döntés)")
                .doesNotContain("előző negyedév");
    }

    @Test
    void testRenderPayload_shouldOmitTheWholeSection_whenNothingIsReviewed() {
        UUID owner = userPopulator.createUser().getId();
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Késői evés rontja az alvást");

        profileAssembler.rebuild(owner);

        assertThat(lastPayloadFor(owner)).doesNotContain("DÖNTÉSI MINŐSÉG");
    }
```

**Implementer note on the two helpers used above:**
- `reviewedDecision(UUID owner, LocalDate decidedOn, short rating)` — if the existing IT already has an equivalent helper, use it; otherwise write it in the test class using the same repository/populator the existing decision test uses, setting `reviewedAt = decidedOn.atStartOfDay(ZoneId.systemDefault()).toInstant()` and `outcomeRating = rating`.
- `lastPayloadFor(UUID owner)` — the existing IT already needs a way to see the payload. If it asserts on the payload via a direct `profileAssembler.renderPayload(...)` call (it is package-private for exactly that reason), call `renderPayload` directly instead and drop the `rebuild` line. **Read the file first and follow whichever way it already does it — do not add a second mechanism.**

- [ ] **Step 3: Run to verify failure**

Run: `cd backend && ./mvnw -q test -Dtest='ProfileAssemblerIT'`
Expected: FAIL — no `DÖNTÉSI MINŐSÉG` section in the payload.

- [ ] **Step 4: Add the repository query**

In `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/DecisionEntryRepository.java`, add (and add `import java.time.Instant;` if absent):

```java
    /** W5.3 (mezo-b3pp.20): reviewed decisions whose REVIEW landed inside a window, rating
     *  present — the profile's decision-quality trend input. Windowed by {@code reviewedAt}
     *  (not {@code decidedOn}) on purpose: the trend is about how his judgement is turning out
     *  as he learns the outcomes, not about when he happened to write the decision down. */
    List<DecisionEntryEntity> findByCreatedByAndReviewedAtBetweenAndOutcomeRatingIsNotNullAndDeletedFalse(
        UUID createdBy, Instant from, Instant to);
```

- [ ] **Step 5: Render the section in `ProfileAssembler`**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssembler.java`:

1. Add imports: `io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters`, `java.time.LocalDate`, `java.time.ZoneId`, `java.util.Locale`, `java.util.OptionalDouble`.
2. In `rebuild`, pass the user id into the payload renderer: change `String payload = renderPayload(rollups, decisions, nodes);` to `String payload = renderPayload(userId, rollups, decisions, nodes);`.
3. Change the signature to `String renderPayload(UUID userId, List<FeedbackRollupEntity> rollups, List<DecisionEntryEntity> decisions, List<GraphNodeEntity> nodes)` and append, right after the `ÉRTÉKELT DÖNTÉSEK` block:

```java
        String quality = decisionQuality(userId);
        if (!quality.isEmpty()) {
            out.append("\nDÖNTÉSI MINŐSÉG:\n").append(quality).append('\n');
        }
```

4. Add the two private methods:

```java
    /**
     * W5.3 (mezo-b3pp.20, spec §9.3): the decision-quality trend — this calendar quarter's mean
     * outcome rating against the previous quarter's, computed in PURE CODE (NFR-M-4: never derive
     * and narrate in one step; the model gets the observation, not the arithmetic).
     *
     * <p>Honest absence, both halves: a quarter with no reviewed decision contributes no line at
     * all, and with neither quarter present the whole section stays out of the payload rather
     * than telling the model "0,0/5", which would read as terrible judgement instead of no data.
     */
    private String decisionQuality(UUID userId) {
        LocalDate currentStart = Quarters.startOf(LocalDate.now());
        String current = quarterLine("ez a negyedév", userId, currentStart);
        String previous = quarterLine("előző negyedév", userId, Quarters.previous(currentStart));
        if (current.isEmpty()) {
            return "";   // nothing reviewed this quarter — a lone historical line is not a trend
        }
        return previous.isEmpty() ? current : current + "\n" + previous;
    }

    /** "- ez a negyedév: 4,5/5 (2 értékelt döntés)" — empty when the quarter has none. */
    private String quarterLine(String label, UUID userId, LocalDate quarterStart) {
        ZoneId zone = ZoneId.systemDefault();
        List<DecisionEntryEntity> reviewed = decisionRepository
                .findByCreatedByAndReviewedAtBetweenAndOutcomeRatingIsNotNullAndDeletedFalse(
                        userId,
                        quarterStart.atStartOfDay(zone).toInstant(),
                        Quarters.endOf(quarterStart).plusDays(1).atStartOfDay(zone).toInstant());
        OptionalDouble mean = reviewed.stream().mapToInt(DecisionEntryEntity::getOutcomeRating).average();
        if (mean.isEmpty()) {
            return "";
        }
        return String.format(Locale.forLanguageTag("hu"), "- %s: %.1f/5 (%d értékelt döntés)",
                label, mean.getAsDouble(), reviewed.size());
    }
```

5. Update the class javadoc's input list to name the decision-quality trend (one clause is enough — say it is quarter-over-quarter and pure-code).

**Watch out:** the existing `renderPayload` is package-private and called from `ProfileAssemblerCapTest`/`ProfileAssemblerIT`. Adding the `userId` parameter changes those call sites — fix them in the same step.

- [ ] **Step 6: Run the profile tests**

Run: `cd backend && ./mvnw -q test -Dtest='ProfileAssemblerIT,ProfileAssemblerCapTest,ProfileAssemblerJobIT'`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile
git commit -m "feat(companion): decision-quality quarter trend in the profile payload (mezo-b3pp.20)"
```

---

### Task 4: `QuarterlyReviewJob` — the cron

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuarterlyReviewJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/QuarterlyReviewJobIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/QuarterlyReviewJobSwitchOffIT.java`

**Interfaces:**
- Consumes: `QuarterlyReviewService.runFor` (Task 2), `ProfileAssembler.rebuild(UUID) -> Optional<UUID>` (existing), `Quarters` (Task 1), `QuarterlyProperties.cron()` (Task 1), `FeaturesConfiguration.QUARTERLY_REVIEW_JOB_SWITCH` (Task 1).
- Produces: `QuarterlyReviewJob.run()`.

- [ ] **Step 1: Write the failing switch-off IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/QuarterlyReviewJobSwitchOffIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Job switch off ⇒ the quarterly cron bean does not exist (mezo-b3pp.20). */
@TestPropertySource(properties = "mezo.techcore.cron.quarterly-review-job.enabled=false")
class QuarterlyReviewJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanProvider(QuarterlyReviewJob.class).getIfAvailable()).isNull();
    }
}
```

- [ ] **Step 2: Write the failing job IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/QuarterlyReviewJobIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewJob;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W5.3 (mezo-b3pp.20): the cron reviews the JUST-FINISHED quarter for every user, then re-runs
 * the profile — per-user AND per-phase isolated (the GraphMaintenanceJob idiom).
 */
@ActiveProfiles("companion-fake")
class QuarterlyReviewJobIT extends AbstractIntegrationTest {

    @Autowired private QuarterlyReviewJob quarterlyReviewJob;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    /** The quarter the job will pick up: the one before the quarter we are standing in. */
    private static LocalDate lastFinishedQuarter() {
        return Quarters.previous(Quarters.startOf(LocalDate.now()));
    }

    @Test
    void testRun_shouldProposeSeasonsAndRebuildProfile_whenTheFinishedQuarterHasRungs() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate quarter = lastFinishedQuarter();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, quarter,
                "A negyedév első hónapja. [fake-season:[{\"title\":\"Nyugodt szezon\",\"summary\":\"Kiegyensúlyozott negyedév volt.\"}]]");

        quarterlyReviewJob.run();

        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE))
                .anySatisfy(n -> assertThat(n.getKind()).isEqualTo(GraphNodeEntity.KIND_SEASON));
        // Phase 2: the profile singleton exists because the pass re-ran the assembler — the
        // graph nodes alone are signal enough for ProfileAssembler to write it.
        assertThat(nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                owner, ProfileAssembler.SOURCE_PROFILE, owner)).isPresent();
    }

    @Test
    void testRun_shouldNotThrow_whenAUserHasNothingToReview() {
        userPopulator.createUser();

        assertThatCode(() -> quarterlyReviewJob.run()).doesNotThrowAnyException();
    }
}
```

- [ ] **Step 3: Run both to verify they fail**

Run: `cd backend && ./mvnw -q test -Dtest='QuarterlyReviewJobIT,QuarterlyReviewJobSwitchOffIT'`
Expected: FAIL — `QuarterlyReviewJob` does not exist.

- [ ] **Step 4: Write the job**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuarterlyReviewJob.java`:

```java
package io.mrkuhne.mezo.feature.companion.quarterly.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The W5.3 quarterly cron (bd mezo-b3pp.20, spec §9.3) — the {@code GraphMaintenanceJob} idiom:
 * per-user isolation, and PHASE isolation inside a user (a failed season pass must not cost that
 * same user their profile refresh). Two phases, in this order:
 * (1) {@link QuarterlyReviewService#runFor} for the JUST-FINISHED quarter — "finished" is the
 * same convention {@code DailySummaryJob}/{@code ConsolidationJob} use one rung down: the newest
 * period the job ever touches is the one that has actually ended;
 * (2) {@link ProfileAssembler#rebuild} — the quarterly refresh spec §9.3 asks for, run AFTER the
 * season pass so a freshly proposed season is at least visible in the same dawn's graph state.
 *
 * <p>Scheduled at 04:00 on the 1st of Jan/Apr/Jul/Oct, after that dawn's 03:50 monthly
 * consolidation rung, which completes the quarter's last month — the input this job reads.
 *
 * <p>Gated on {@code COMPANION_SWITCH} ∧ {@code KNOWLEDGE_GRAPH_SWITCH} ∧
 * {@code QUARTERLY_REVIEW_JOB_SWITCH} — both collaborators already require the first two
 * themselves, so direct constructor injection is safe: whenever this bean exists, so do theirs.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH,
            FeaturesConfiguration.QUARTERLY_REVIEW_JOB_SWITCH},
        havingValue = "true")
public class QuarterlyReviewJob {

    private final AppUserRepository appUserRepository;
    private final QuarterlyReviewService quarterlyReviewService;
    private final ProfileAssembler profileAssembler;

    @Scheduled(cron = "${mezo.companion.quarterly.cron}")
    public void run() {
        LocalDate quarter = Quarters.previous(Quarters.startOf(LocalDate.now()));
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                int candidates = quarterlyReviewService.runFor(user.getId(), quarter);
                log.info("Quarterly season pass for user {} on {}: {} candidate(s)",
                    user.getId(), Quarters.label(quarter), candidates);
            } catch (Exception e) {
                log.warn("Quarterly season pass failed for user {} on {}", user.getId(), quarter, e);
            }
            try {
                profileAssembler.rebuild(user.getId())
                    .ifPresentOrElse(
                        id -> log.info("Quarterly profile rebuild for user {} (node {})", user.getId(), id),
                        () -> log.info("No profile signal for user {} — quarterly rebuild skipped", user.getId()));
            } catch (Exception e) {
                log.warn("Quarterly profile rebuild failed for user {} — the sweep continues",
                    user.getId(), e);
            }
        }
    }
}
```

- [ ] **Step 5: Run the ITs to verify they pass**

Run: `cd backend && ./mvnw -q test -Dtest='QuarterlyReviewJobIT,QuarterlyReviewJobSwitchOffIT'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly
git commit -m "feat(companion): quarterly review cron with per-phase isolation (mezo-b3pp.20)"
```

---

### Task 5: The `compare_periods` chat tool

Reads `period_summary` ONLY (see "Scope decision" above). Accepts `2026-Q3` (a quarter, rendered from its month rungs) and `2026-07` (a month, rendered from its own rung).

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/MemoryTools.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/MemoryToolsRenderIT.java` (extend)

**Interfaces:**
- Consumes: `Quarters` (Task 1), `QuarterlyProperties.renderMaxChars()` (Task 1), `PeriodSummaryRepository` (existing), `ToolContexts.userId/audit`, `ToolText.NO_DATA`.
- Produces: `MemoryTools.comparePeriods(String periodA, String periodB, ToolContext ctx) -> String`, registered as `@Tool(name = "compare_periods")`.

- [ ] **Step 1: Write the failing tool ITs**

Append to `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/MemoryToolsRenderIT.java` (add the imports `io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity`, `io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator` and the `@Autowired private PeriodSummaryPopulator periodSummaryPopulator;` field):

```java
    @Test
    void testComparePeriods_shouldRenderBothQuarters_whenRungsExist() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 7, 1), "Júliusban sok volt a volumen.");
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 4, 1), "Áprilisban visszafogtam.");

        String out = memoryTools.comparePeriods("2026-Q3", "2026-Q2", ctx(owner));

        assertThat(out).contains("2026-Q3")
                .contains("Júliusban sok volt a volumen.")
                .contains("2026-Q2")
                .contains("Áprilisban visszafogtam.");
        assertThat(audit.toRefsEnvelope().refs())
                .anySatisfy(ref -> {
                    assertThat(ref.kind()).isEqualTo("Memory");
                    assertThat(ref.id()).isEqualTo("2026-07-01");
                });
    }

    @Test
    void testComparePeriods_shouldAcceptMonths_whenSpelledAsYyyyMm() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 7, 1), "Júliusi hónap.");

        String out = memoryTools.comparePeriods("2026-07", "2026-06", ctx(owner));

        assertThat(out).contains("2026-07").contains("Júliusi hónap.")
                .contains("2026-06").contains("nincs adat");
    }

    @Test
    void testComparePeriods_shouldRenderHonestNoData_whenAPeriodHasNoRungs() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 7, 1), "Júliusi hónap.");

        String out = memoryTools.comparePeriods("2026-Q3", "2025-Q1", ctx(owner));

        assertThat(out).contains("2025-Q1").contains("nincs adat");
    }

    @Test
    void testComparePeriods_shouldRenderNoData_whenAnArgumentIsUnparseable() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(memoryTools.comparePeriods("tavaly nyáron", "2026-Q2", ctx(owner)))
                .isEqualTo("Időszak-összehasonlítás: nincs adat");
        assertThat(memoryTools.comparePeriods(null, null, ctx(owner)))
                .isEqualTo("Időszak-összehasonlítás: nincs adat");
    }

    @Test
    void testComparePeriods_shouldNotLeakAnotherUsersPeriods_whenOwnershipDiffers() {
        UUID owner = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(other, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 7, 1), "IDEGEN-SZOVEG");

        String out = memoryTools.comparePeriods("2026-Q3", "2026-Q2", ctx(owner));

        assertThat(out).doesNotContain("IDEGEN-SZOVEG");
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && ./mvnw -q test -Dtest='MemoryToolsRenderIT'`
Expected: FAIL — `comparePeriods` does not exist.

- [ ] **Step 3: Implement the tool**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/MemoryTools.java`, add the imports (`io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity`, `io.mrkuhne.mezo.feature.companion.quarterly.config.QuarterlyProperties`, `io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters`, `io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository`, `java.time.LocalDate`), the two new constructor fields (`private final PeriodSummaryRepository periodSummaryRepository;`, `private final QuarterlyProperties quarterlyProperties;`), and the tool method:

```java
    @Tool(name = "compare_periods", description = "Két KORÁBBI IDŐSZAK összevetése a heti/havi "
            + "összefoglalókból: mi jellemezte az egyiket, mi a másikat. periodA és periodB "
            + "formátuma negyedév (pl. 2026-Q3) vagy hónap (pl. 2026-07); a negyedév a benne lévő "
            + "havi összefoglalókból áll össze. Használd, amikor a user két időszakot hasonlít "
            + "össze ('mi változott a nyár óta', 'milyen volt a tavasz a nyárhoz képest', "
            + "'jobb negyedév volt ez, mint az előző?'). Csak a saját időszak-összefoglalóit "
            + "adja vissza — az AI-üzenetekre adott visszajelzéseket (tetszik/nem tetszik) NEM "
            + "tartalmazza. Ha egy időszakról nincs összefoglaló, azt őszintén kimondja.")
    public String comparePeriods(
            @ToolParam(description = "Az első időszak: 2026-Q3 (negyedév) vagy 2026-07 (hónap)") String periodA,
            @ToolParam(description = "A második időszak, ugyanabban a formátumban") String periodB,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        LocalDate startA = Quarters.parse(periodA);
        LocalDate startB = Quarters.parse(periodB);
        // 'required' only shapes the advertised schema — the model can still omit/garble an arg.
        if (startA == null || startB == null) {
            return "Időszak-összehasonlítás: " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Időszak-összehasonlítás:");
        renderPeriod(b, userId, periodA.strip(), startA, toolContext);
        renderPeriod(b, userId, periodB.strip(), startB, toolContext);
        return b.toString();
    }

    /** One side of the comparison: a quarter renders its month rungs, a month its own. Every
     *  rendered rung adds a {@code Memory} ref (the {@code find_similar_past_days} idiom), so the
     *  FE chips show exactly which periods the answer was built from. */
    private void renderPeriod(StringBuilder b, UUID userId, String label, LocalDate start,
            ToolContext toolContext) {
        LocalDate end = Quarters.isQuarter(label) ? Quarters.endOf(start) : start;
        List<PeriodSummaryEntity> rungs = periodSummaryRepository
                .findByCreatedByAndGranularityAndPeriodStartBetweenOrderByPeriodStartAsc(
                        userId, PeriodSummaryEntity.GRANULARITY_MONTH, start, end);
        b.append("\n\n").append(label).append(':');
        if (rungs.isEmpty()) {
            b.append(' ').append(ToolText.NO_DATA);
            return;
        }
        int cap = quarterlyProperties.renderMaxChars();
        for (PeriodSummaryEntity rung : rungs) {
            ToolContexts.audit(toolContext).addRef("Memory", rung.getPeriodStart().toString());
            String text = rung.getSummaryText().length() > cap
                    ? rung.getSummaryText().substring(0, cap) + "…"
                    : rung.getSummaryText();
            b.append("\n").append(rung.getPeriodStart()).append(": ").append(text);
        }
    }
```

**Watch out:** `MemoryTools` is `@ConditionalOnProperty(COMPANION_SWITCH)` while `QuarterlyProperties` is a plain `@ConfigurationProperties` bean (always present) — injecting it is safe. `ToolText.NO_DATA` is package-private and `MemoryTools` is in the same package, so it resolves.

- [ ] **Step 4: Add the routing-hint line**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`, in the `[Eszköz-útmutató]` block, add a line immediately after the `find_similar_past_days` line (mind the `"""` text block — the last line currently ends with `""";`):

```
            - hasonló korábbi nap → find_similar_past_days
            - két időszak összevetése (negyedév/hónap) → compare_periods""";
```

- [ ] **Step 5: Run the tool ITs plus the registry IT**

Run: `cd backend && ./mvnw -q test -Dtest='MemoryToolsRenderIT,CompanionToolRegistryIT,ChatServiceIT'`
Expected: PASS. `CompanionToolRegistryIT` may assert a tool COUNT — if it fails on the count, update the expected number (the new tool is intentional) and read the surrounding assertions so the tool-name list stays complete.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools
git commit -m "feat(companion): compare_periods chat tool over the consolidation ladder (mezo-b3pp.20)"
```

---

### Task 6: Contract + frontend — a kind-aware L2 candidate inbox

SEASON candidates ride the EXISTING `/api/companion/graph/node/candidate` endpoint (`GraphService.listCandidates` is kind-agnostic). Today the FE hard-codes life-event copy ("Életesemény-jelöltek", "Ezt a napod szövegeiből szűrtem ki"), which would be dishonest above a season card. This task makes the surface kind-aware.

**Files:**
- Modify: `api/feature/knowledge-graph/knowledge-graph.yml`
- Regenerate: `frontend/src/data/_client/api.gen.ts` (and the backend generated API)
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/insights/graphApi.ts`
- Modify: `frontend/src/data/insights/graph.ts`
- Modify: `frontend/src/features/insights/components/LifeEventCandidateCard.tsx`
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx`
- Test: `frontend/src/data/insights/graphHooks.test.tsx`

**Interfaces:**
- Consumes: `GraphNodeResponse.kind` (already in the contract's enum).
- Produces: `LifeEventCandidate.kind: 'LIFE_EVENT' | 'SEASON'`; `CANDIDATE_COPY: Record<'LIFE_EVENT' | 'SEASON', { eyebrow: string; provenance: string }>` exported from `frontend/src/data/insights/graph.ts`.

- [ ] **Step 1: Update the contract summaries**

In `api/feature/knowledge-graph/knowledge-graph.yml`, change the two candidate operation summaries:

```yaml
      summary: >-
        Pending (undecided) graph candidates, newest first — LIFE_EVENT rows from the nightly
        extractor (W2.3) and SEASON rows from the quarterly deep pass (W5.3)
```

and

```yaml
      summary: >-
        Decide a candidate (W2.3 life event / W5.3 season) — accept activates the node and creates
        its proposed edges, reject soft-deletes it. One decision per candidate; confirm is an
        explicit L2 action.
```

- [ ] **Step 2: Regenerate both sides of the contract**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

Expected: `frontend/src/data/_client/api.gen.ts` and the backend `io.mrkuhne.mezo.api` sources update; the summary text is the only semantic change.

- [ ] **Step 3: Write the failing FE test**

In `frontend/src/data/insights/graphHooks.test.tsx`, extend the existing candidate test's wire fixture with `kind: 'SEASON'` for a second row and assert the mapping. Read the file first; the existing fixture at line ~40 already builds a `LIFE_EVENT` row. Add:

```tsx
  it('a jelölt kind-ját átviszi a domain típusra (W5.3 szezon-jelöltek)', async () => {
    server.use(
      http.get('*/api/companion/graph/node/candidate', () =>
        HttpResponse.json([
          {
            id: 'n1', kind: 'LIFE_EVENT', title: 'Új munkahely', summary: 'Első hét.',
            status: 'candidate', occurredOn: '2026-08-21', proposedEdgeCount: 1,
            createdAt: '2026-08-22T03:20:00Z', updatedAt: '2026-08-22T03:20:00Z',
          },
          {
            id: 'n2', kind: 'SEASON', title: 'Nyári alapozás', summary: 'A nyár a volumenről szólt.',
            status: 'candidate', occurredOn: '2026-07-01', proposedEdgeCount: 0,
            createdAt: '2026-10-01T04:00:00Z', updatedAt: '2026-10-01T04:00:00Z',
          },
        ])),
    )

    const { result } = renderHook(() => useLifeEventCandidates(), { wrapper })

    await waitFor(() => expect(result.current.candidates).toHaveLength(2))
    expect(result.current.candidates.map((c) => c.kind)).toEqual(['LIFE_EVENT', 'SEASON'])
  })
```

**Implementer note:** match the file's existing imports, `wrapper`, and `server.use` idiom exactly — read the top of the file and copy how the other tests set up MSW. Do not introduce a second MSW pattern.

- [ ] **Step 4: Run it to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test -- graphHooks`
Expected: FAIL — `kind` is `undefined` on the mapped candidates.

- [ ] **Step 5: Carry `kind` through the domain type and the mapper**

In `frontend/src/data/types.ts`, extend the interface:

```ts
export interface LifeEventCandidate {
  id: string
  /** W5.3 (mezo-b3pp.20): a jelölt fajtája — az éjszakai kiszűrő életeseményt, a negyedéves
   *  mélyfutam szezont javasol. Ugyanaz az L2 inbox hordozza mindkettőt, de a copy nem közös. */
  kind: 'LIFE_EVENT' | 'SEASON'
  title: string
  summary: string | null
  /** A nap, amiről az esemény szól (ISO date). */
  occurredOn: string | null
  /** Hány kapcsolat jönne létre, ha elfogadod. */
  proposedEdgeCount: number
}
```

In `frontend/src/data/insights/graphApi.ts`, in `toLifeEventCandidate`, add as the second property:

```ts
    // A backend enum hat kind-ot ismer, de az L2 inboxba csak ez a kettő kerülhet (W2.3 + W5.3);
    // bármi más ismeretlen jelölt volna, amire nincs őszinte copy — LIFE_EVENT a biztonságos default.
    kind: n.kind === 'SEASON' ? 'SEASON' : 'LIFE_EVENT',
```

- [ ] **Step 6: Run the FE test to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test -- graphHooks`
Expected: PASS.

- [ ] **Step 7: Add the kind→copy table and a season mock seed**

In `frontend/src/data/insights/graph.ts`, add `kind: 'LIFE_EVENT'` to the existing seed entry, append a season seed, and export the copy table:

```ts
export const lifeEventCandidateSeed: LifeEventCandidate[] = [
  {
    id: 'le-1',
    kind: 'LIFE_EVENT',
    title: 'Új munkahely első hete',
    summary: 'A naplód szerint hétfőn kezdtél az új helyen, és a hét végére kimerültél.',
    occurredOn: '2026-08-21',
    proposedEdgeCount: 1,
  },
  {
    id: 'se-1',
    kind: 'SEASON',
    title: 'Nyári alapozás',
    summary: 'A nyár a volumenről szólt: több gym nap, kevesebb futás, stabil alvás.',
    occurredOn: '2026-07-01',
    proposedEdgeCount: 0,
  },
]

/**
 * W5.3 (mezo-b3pp.20): jelölt-fajtánkénti copy. Egy szezon NEM a napod szövegeiből jött, hanem
 * két negyedév összevetéséből — közös kártya, de a provenienciát fajtánként kell kimondani
 * (IDENT-6: a megerősítés sosem néma, és sosem hazudik arról, honnan jött a javaslat).
 */
export const CANDIDATE_COPY: Record<LifeEventCandidate['kind'], { eyebrow: string; provenance: string }> = {
  LIFE_EVENT: {
    eyebrow: 'Életesemény-jelöltek',
    provenance: 'Ezt a napod szövegeiből szűrtem ki — csak akkor kerül a gráfba, ha elfogadod.',
  },
  SEASON: {
    eyebrow: 'Szezon-jelöltek',
    provenance: 'Ezt a negyedév és az előző negyedév összefoglalóiból olvastam ki — csak akkor '
      + 'kerül a gráfba, ha elfogadod.',
  },
}
```

- [ ] **Step 8: Make the card kind-aware**

In `frontend/src/features/insights/components/LifeEventCandidateCard.tsx`, import the table and replace the hard-coded provenance line:

```tsx
import { CANDIDATE_COPY } from '@/data/insights/graph'
```

```tsx
      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>
        {CANDIDATE_COPY[candidate.kind].provenance}
      </p>
```

Also update the component's javadoc comment to say it renders BOTH candidate kinds (W2.3 life events and W5.3 seasons).

- [ ] **Step 9: Group the inbox by kind**

In `frontend/src/features/insights/pages/KnowledgeListPage.tsx`, replace the single hard-coded block (currently around line 99-112) with a per-kind grouping:

```tsx
      {(['LIFE_EVENT', 'SEASON'] as const).map((kind) => {
        const group = lifeEvents.filter((c) => c.kind === kind)
        if (group.length === 0) return null
        return (
          <div key={kind} className="col gap-sm">
            <span className="eyebrow" style={{ color: 'var(--amber-deep)' }}>
              {CANDIDATE_COPY[kind].eyebrow} · {group.length}
            </span>
            {group.map((c) => (
              <LifeEventCandidateCard
                key={c.id}
                candidate={c}
                onDecide={(decision) => decideLifeEvent(c.id, decision)}
              />
            ))}
          </div>
        )
      })}
```

Add `import { CANDIDATE_COPY } from '@/data/insights/graph'` and **read the surrounding JSX first** — the wrapper `div`'s className/style must match what the removed block used, so the layout does not shift for the life-event case.

- [ ] **Step 10: Run the full FE gates**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: both modes green, build clean. If the Tudástár visual golden fails because the mock now shows a second candidate section, that is a LEGITIMATE movement — regenerate with `pnpm test:visual:update` and commit the updated baselines (the linux baselines are refreshed on the branch later, see the ship step).

- [ ] **Step 11: Commit**

```bash
git add api/feature/knowledge-graph/knowledge-graph.yml frontend/src backend/src/main/java/io/mrkuhne/mezo/api
git commit -m "feat(insights): kind-aware L2 candidate inbox for season candidates (mezo-b3pp.20)"
```

---

### Task 7: Documentation, codemap, and the full focused gate

**Files:**
- Modify: `docs/features/companion.md`
- Modify: `docs/features/insights.md`
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Document the slice in `docs/features/companion.md`**

Add a `### W5.3 quarterly deep pass (✅ mezo-b3pp.20, spec §9.3)` section immediately after the `### W5.2 intervention delivery` section (around line 1905). It must cover:

- **What runs when:** cron `0 0 4 1 1,4,7,10 *` (1st of Jan/Apr/Jul/Oct, 04:00), switch `mezo.techcore.cron.quarterly-review-job.enabled`, gated on companion ∧ knowledge-graph ∧ the cron switch. Say WHY 04:00: after the 03:50 monthly rung that completes the quarter's last month.
- **Phase 1 — season candidates:** `QuarterlyReviewService.runFor` reads the finished quarter's `period_summary` MONTH rungs + the previous quarter's + the W4.2 rollups, makes ONE **smart-tier** call (`companion_quarterly` / `season_candidates`), and writes 0..N `knowledge_node(kind=SEASON, status=candidate, source_kind='quarterly', occurred_on=<quarter start>)`. No edges are proposed (`meta.proposedEdges = []`) — a season is a period reading, not a causal claim.
- **The two gates:** the quarter gate (native, `is_deleted`-blind, so a rejected quarter never returns — name the `'quarterly'` literal/constant coupling and that `QuarterlyReviewServiceIT` pins it) and the emptiness gate (an unconsolidated quarter costs no call). A missing PREVIOUS quarter is explicitly NOT a gate.
- **Phase 2 — profile refresh:** `ProfileAssembler.rebuild` re-run per user, phase-isolated from phase 1.
- **Decision-quality trend:** the new `DÖNTÉSI MINŐSÉG` payload section — quarter-over-quarter mean `outcome_rating`, pure code, windowed by `reviewed_at`, whole section omitted when this quarter has nothing reviewed (and why: `0,0/5` would read as terrible judgement, not as no data).
- **The L2 inbox is shared:** no new endpoint; SEASON candidates surface in the existing `/api/companion/graph/node/candidate` list and are decided by `LifeEventCandidateService.decide` (kind-agnostic).
- **`compare_periods` tool:** add a row to the tool catalog table (§ "The V0.5 tool catalog") and to the routing-hint description; state the **deliberate exclusion** of `feedback_rollup` and why (a period comparison is about his life; the rollups feed the quarterly job and the profile instead).
- **Config keys:** a `mezo.companion.quarterly.*` block in the config-keys section (`cron`, `max-candidates`, `max-period-lines`, `render-max-chars`), noting it binds to the feature-scoped `QuarterlyProperties` (the `ProfileProperties` precedent), not to `CompanionProperties`.
- **Testing:** list `QuarterlyReviewServiceIT`, `QuarterlyReviewJobIT`, `QuarterlyReviewJobSwitchOffIT`, `QuarterlyPropertiesIT`, `QuartersTest`, the extended `ProfileAssemblerIT` and `MemoryToolsRenderIT` in §8.
- **Key files:** add the five new `feature/companion/quarterly/**` files to §10.
- **Decisions/gotchas (§9):** record the "rollups" ambiguity in spec §9.3 and that it was resolved with Daniel as period_summary-only for the tool.

- [ ] **Step 2: Document the FE change in `docs/features/insights.md`**

In §2.4 (`KnowledgeListPage`), update the candidate-inbox paragraph: the inbox now carries TWO candidate kinds, grouped with per-kind eyebrow and per-kind provenance copy from `CANDIDATE_COPY` (`data/insights/graph.ts`); mock mode seeds one of each. Add `CANDIDATE_COPY` to §10 key files if that section enumerates exports.

- [ ] **Step 3: Regenerate the codemap and lint the docs**

```bash
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs
```

Expected: CODEMAP picks up `feature/companion/quarterly/**`; lint-docs reports **no new** staleness/broken links. Fix anything it flags that this change introduced.

- [ ] **Step 4: Run the full focused backend gate**

```bash
docker compose up -d
cd backend && ./mvnw clean test -Dtest='QuartersTest,QuarterlyPropertiesIT,QuarterlyReviewServiceIT,QuarterlyReviewJobIT,QuarterlyReviewJobSwitchOffIT,ProfileAssemblerIT,ProfileAssemblerCapTest,ProfileAssemblerJobIT,ProfileAssemblerJobSwitchOffIT,MemoryToolsRenderIT,CompanionToolRegistryIT,ChatServiceIT,ArchitectureTest,GraphCandidateApiIT,LifeEventExtractionServiceIT,ConsolidationJobIT'
```

Expected: all green. `ArchitectureTest` is in the list deliberately — it is the layer/cycle/`@Value` guard the new subpackage must satisfy, and focused runs otherwise skip it.

- [ ] **Step 5: Run the full focused frontend gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: both modes green.

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs(companion,insights): W5.3 quarterly deep pass + kind-aware candidate inbox (mezo-b3pp.20)"
```

---

## Ship (house git-flow)

- [ ] `git push -u origin feat/quarterly-deep-pass`
- [ ] `gh pr create` (self-PR = the CI gate)
- [ ] `gh pr checks <PR#> --watch` until green. If visual goldens moved legitimately: `pnpm test:visual:update` (darwin) + commit, then `gh workflow run update-visual-baselines.yml -r feat/quarterly-deep-pass` (linux bot commit) → `git fetch` → merge the **origin** branch (the bot commit exists only there). Approve an `action_required` bot run with `gh api -X POST repos/mrkuhne/mezo/actions/runs/<run-id>/approve`.
- [ ] `git -C /Users/mrkuhne/Applications/Personal/Mezo/mezo pull --rebase` → merge `--no-ff` → push
- [ ] `bd close mezo-b3pp.20 && bd dolt push`
- [ ] Delete the branch locally and on the remote; `git status` clean and up to date in both checkouts.

## Self-Review

**Spec §9.3 coverage:**

| Spec requirement | Task |
|---|---|
| Quarterly smart-tier job, cron switch `quarterly-review-job` | 1 (switch/config), 4 (job) |
| Season-over-season comparison (this quarter's period_summaries + rollups vs previous) | 2 |
| → 0–N SEASON node **candidates** into the L2 inbox | 2 (writer), 6 (surface) |
| Decision-quality observations appended to the profile input | 3 |
| Re-runs `ProfileAssembler` | 4 |
| New chat tool `compare_periods(periodA, periodB)`, refs accordingly | 5 |
| Registered in the `[Eszköz-útmutató]` routing table per `companion_tool_conventions.md` | 5 |
| **Acceptance:** quarterly run produces candidates not actives | 2 (`testRunFor_shouldCreateCandidatesNotActives…`) |
| **Acceptance:** compare_periods renders an honest "nincs adat" for missing periods | 5 (`testComparePeriods_shouldRenderHonestNoData…`) |

Spec §11 conventions: contract-first (Task 6), `LlmCallContextHolder` tagging (Task 2), `@Validated` config record (Task 1), integration-first tests (all), new cron in a dawn dead zone with a switch + SwitchOffIT (Tasks 1/4), docs in the same change (Task 7). **No new table**, so the "new table → ResetDatabase + populator" clause does not apply — stated explicitly in Global Constraints so no one goes looking for a migration.

**Type consistency check:** `Quarters.startOf/previous/endOf/label/parse/isQuarter` are declared in Task 1 and used with those exact names in Tasks 2, 3, 4, 5. `QuarterlyProperties.cron/maxCandidates/maxPeriodLines/renderMaxChars` declared Task 1, used Tasks 2/4/5. `QuarterlyReviewService.SOURCE_QUARTERLY`/`SEASON_MARKER`/`runFor` declared Task 2, used Tasks 2/4 and mirrored in `GraphNodeRepository.countQuarterlyNodesOnQuarter` (Task 2) and `FakeCompanionLlm` (Task 2). `CANDIDATE_COPY` declared Task 6 step 7, used steps 8/9. `LifeEventCandidate.kind` declared Task 6 step 5, used steps 6/7/8/9.
