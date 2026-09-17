# Companion turn planner + executor (S9.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The smart model can SAY which tool reads a question needs (a structured plan), pure Java validates and executes that plan in parallel through the existing audit machinery — shipped dark: nothing in the live turn changes until S9.5 wires the answerer.

**Architecture:** Four new collaborators in `feature/companion/service/`: `TurnPlanParser` (LLM JSON → `TurnPlan`), `ToolCatalogue` (renders the tool list for the planner prompt from the LIVE registry so it cannot drift), `PlanValidator` (drops unknown tools/params against the live schemas), `PlanExecutor` (invokes `RecordingToolCallback`s directly and in parallel, returns plan-ordered `ToolOutcome`s), orchestrated by `TurnPlanner` (one tool-free `completeSmart` call + a bounded repair lap). `ToolCallAudit` becomes thread-safe because parallel execution breaks its documented sequential assumption.

**Tech Stack:** Java 21, Spring Boot 4.x, Spring AI 2.0.1 (`ToolCallback.call(String, ToolContext)` direct invocation), Jackson 3 (`tools.jackson.databind`), JUnit 5 + AssertJ, Testcontainers Postgres.

**Spec:** `docs/superpowers/specs/2026-09-16-companion-plan-execute-answer-design.md` §6.2–6.4, §8, §9 — slice **S9.4 only**. S9.5 (answerer + replan + live wiring) is the next plan.

**Driving issue:** `mezo-rj214.7`. Branch: `feat/companion-turn-planner`. Commit subjects carry the id.

## Global Constraints

- **Jackson 3**: `tools.jackson.databind.ObjectMapper` / `JsonNode` — NOT `com.fasterxml`. Inject the `ObjectMapper`; the house LLM-JSON idiom is first-`{`/last-`}` substring (no fence helper exists; `TurnVerdictCheck.java:88-102` is the precedent).
- **Every new bean is gated** `@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")` — an ungated bean depending on `CompanionLlm`/`CompanionToolRegistry` breaks every `*SwitchOffIT` context (this exact regression shipped and was caught in S9.1–S9.3's final review; `GearClassifier.java:25-27` is the pattern).
- **No behavior change on the live turn.** `ChatService`/`ChatStreamService` are NOT touched. The full companion suite must stay green with zero fixture edits.
- Base package `io.mrkuhne.mezo`; new classes in `feature/companion/service/`; no `@Value`; constructor injection; AssertJ only; `test{Method}_should{Result}_when{Condition}`; English javadoc; TDD per task.
- `./mvnw clean test` always; ITs need `-Dmezo.test.use-testcontainers=true`. Focused runs locally, CI is the full gate. Run `ArchitectureTest` whenever a new class lands (focused ITs miss ArchUnit).
- **Never bare `git stash`** (shared stash stack) — use a WIP commit to set work aside.
- Machine-facing prompts are `static final String` constants on the owning class with a **public marker prefix** for `FakeCompanionLlm` dispatch (`GearClassifier.PROMPT`, `TurnVerdictCheck.VERDICT_MARKER` precedents). No `PromptPersona.render` for prompts without `{{NÉV}}`.
- Honest nulls / no fabricated data (ADR 0010): a failed or timed-out step becomes an explicit Hungarian outcome string, never an invented result.

## Two scope decisions made here, not left open

**Per-gear reasoning-effort keys (spec §9 `planner.effort {lookup, analysis}`, `answerer.effort` map) are NOT added.** Per-call effort override does not exist on the LLM seam (effort is per-tier config), and S9.1–S9.3 already shipped one documented-scaffolding key (`answerer.chat-effort`); adding more dead keys invites drift. The planner runs at the SMART tier's configured effort. Deferred to S9.5's budget task, where the seam widening can carry it. Record this deviation in the feature doc when Task 8 touches it.

**The executor does not capture `LlmActorContext`.** The recon-flagged trap applies to async work that makes LLM calls; `PlanExecutor` invokes DB-read tools only (internal-sphere, ArchUnit-enforced), which take their identity from the `ToolContext`'s `userId`, not from the actor holder. A one-line comment in `PlanExecutor` records this reasoning.

---

### Task 1: `TurnPlan` + `TurnPlanParser`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnPlan.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnPlanParser.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnPlanParserTest.java`

**Interfaces:**
- Consumes: `tools.jackson.databind.ObjectMapper` (injected).
- Produces: `record TurnPlan(boolean needsData, List<PlanStep> steps)` with nested `record PlanStep(String tool, Map<String, Object> args, String why)`; `Optional<TurnPlan> TurnPlanParser.parse(String raw)` — empty means unusable reply; a returned plan is NORMALIZED (never-null steps list, never-null args map, never-null why). Tasks 4, 6, 7 rely on exactly these shapes.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class TurnPlanParserTest {

    private final TurnPlanParser parser = new TurnPlanParser(new ObjectMapper());

    @Test
    void testParse_shouldReturnPlan_whenReplyIsCleanJson() {
        String raw = """
            {"needsData":true,"steps":[{"tool":"get_fuel_log","args":{"range":"day"},"why":"mai étkezés"}]}""";

        TurnPlan plan = parser.parse(raw).orElseThrow();

        assertThat(plan.needsData()).isTrue();
        assertThat(plan.steps()).hasSize(1);
        assertThat(plan.steps().getFirst().tool()).isEqualTo("get_fuel_log");
        assertThat(plan.steps().getFirst().args()).isEqualTo(Map.of("range", "day"));
        assertThat(plan.steps().getFirst().why()).isEqualTo("mai étkezés");
    }

    @Test
    void testParse_shouldStripSurroundingProse_whenModelWrapsTheJson() {
        String raw = "Rendben, íme a terv:\n```json\n{\"needsData\":false,\"steps\":[]}\n```\nKész.";

        TurnPlan plan = parser.parse(raw).orElseThrow();

        assertThat(plan.needsData()).isFalse();
        assertThat(plan.steps()).isEmpty();
    }

    @Test
    void testParse_shouldNormalizeNulls_whenFieldsAreOmitted() {
        // steps omitted entirely; a step with no args and no why
        TurnPlan noSteps = parser.parse("{\"needsData\":false}").orElseThrow();
        TurnPlan bareStep = parser.parse(
            "{\"needsData\":true,\"steps\":[{\"tool\":\"get_pantry\"}]}").orElseThrow();

        assertThat(noSteps.steps()).isNotNull().isEmpty();
        assertThat(bareStep.steps().getFirst().args()).isNotNull().isEmpty();
        assertThat(bareStep.steps().getFirst().why()).isEmpty();
    }

    @Test
    void testParse_shouldBeEmpty_whenReplyHasNoJsonOrGarbage() {
        assertThat(parser.parse(null)).isEmpty();
        assertThat(parser.parse("nem tudok tervezni")).isEmpty();
        assertThat(parser.parse("{needsData:maybe}")).isEmpty();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=TurnPlanParserTest
```
Expected: FAIL — compilation error, the classes do not exist.

- [ ] **Step 3: Write minimal implementation**

`TurnPlan.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import java.util.List;
import java.util.Map;

/**
 * What the planner asked for (spec 2026-09-16 §6.2): a structured list of tool reads, never an
 * answer. {@code needsData=false} with empty steps is the planner overruling the gear downward —
 * the turn needs none of the user's data after all.
 */
public record TurnPlan(boolean needsData, List<PlanStep> steps) {

    /** One requested tool read. {@code why} is half a sentence of provenance, shown to the user later (S9.7). */
    public record PlanStep(String tool, Map<String, Object> args, String why) {}
}
```

`TurnPlanParser.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Parses the planner LLM's reply into a {@link TurnPlan}. House idiom for LLM JSON: the
 * first-'{'-to-last-'}' substring is the fence stripper ({@code TurnVerdictCheck} precedent).
 * Empty result means the reply is unusable — the CALLER decides between a repair lap and the
 * legacy fallback (spec §8); the parser never throws.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class TurnPlanParser {

    private final ObjectMapper objectMapper;

    public Optional<TurnPlan> parse(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        try {
            TurnPlan plan = objectMapper.readValue(raw.substring(start, end + 1), TurnPlan.class);
            return Optional.of(normalize(plan));
        } catch (Exception e) {
            log.warn("Turn plan unparseable: {}", raw, e);
            return Optional.empty();
        }
    }

    /** Jackson leaves omitted fields null; downstream code must never see a null list/map/why. */
    private static TurnPlan normalize(TurnPlan plan) {
        List<TurnPlan.PlanStep> steps = plan.steps() == null ? List.of() : plan.steps().stream()
            .filter(step -> step != null && step.tool() != null && !step.tool().isBlank())
            .map(step -> new TurnPlan.PlanStep(
                step.tool(),
                step.args() == null ? Map.of() : step.args(),
                step.why() == null ? "" : step.why()))
            .toList();
        return new TurnPlan(plan.needsData(), steps);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=TurnPlanParserTest
```
Expected: PASS, 4 tests green. (If Jackson 3 rejects the record's `Map<String,Object>` binding, the failure surfaces here — fix the binding, not the test.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnPlan.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnPlanParser.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnPlanParserTest.java
git commit -m "feat(companion): turn plan record + tolerant parser (mezo-rj214.7)"
```

---

### Task 2: `ToolCatalogue`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ToolCatalogue.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ToolCatalogueIT.java`

**Interfaces:**
- Consumes: `CompanionToolRegistry.callbacks(ToolCallAudit)` + `newTurnAudit()` (`tools/CompanionToolRegistry.java:39-50`); `ToolDefinition.name()/description()/inputSchema()`.
- Produces: `String ToolCatalogue.render()` — the `[Eszköz-katalógus]` block for the planner's STABLE prompt half. Task 7 concatenates it after the planner prompt.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class ToolCatalogueIT extends AbstractIntegrationTest {

    @Autowired
    private ToolCatalogue catalogue;

    @Test
    void testRender_shouldListEveryRegisteredTool_whenRenderedFromTheLiveRegistry() {
        String text = catalogue.render();

        // One line per registered tool — the registry IT pins the full set of 18; spot-check
        // representatives from different toolsets plus the header.
        assertThat(text).startsWith("[Eszköz-katalógus]");
        assertThat(text).contains("- get_fuel_log:").contains("- get_recovery:")
            .contains("- get_training_log:").contains("- get_life_goals:")
            .contains("- find_similar_past_days:").contains("- compare_periods:");
    }

    @Test
    void testRender_shouldCarryParamNames_whenTheSchemaHasProperties() {
        String text = catalogue.render();

        // get_recovery's schema is pinned to expose date/from/to (CompanionToolRegistryIT).
        assertThat(text).contains("date").contains("from").contains("to");
        // The framework-internal context param must never leak into the model-facing catalogue.
        assertThat(text).doesNotContain("toolContext");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=ToolCatalogueIT -Dmezo.test.use-testcontainers=true
```
Expected: FAIL — `ToolCatalogue` does not exist.

- [ ] **Step 3: Write minimal implementation**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Renders the planner's tool catalogue from the LIVE registry — never a hand-maintained list, so
 * it cannot drift the way the [Eszköz-útmutató] block once did (spec §6.2; tool-convention rule 4
 * is inherited automatically because the text IS the @Tool/@ToolParam descriptions).
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class ToolCatalogue {

    private final CompanionToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    public String render() {
        // Throwaway audit: the catalogue only reads definitions, no call is ever made through it.
        StringBuilder sb = new StringBuilder("[Eszköz-katalógus]\n");
        for (ToolCallback callback : toolRegistry.callbacks(toolRegistry.newTurnAudit())) {
            ToolDefinition def = callback.getToolDefinition();
            sb.append("- ").append(def.name()).append(": ").append(def.description()).append('\n');
            appendParams(sb, def.name(), def.inputSchema());
        }
        return sb.toString();
    }

    /** One indented line per schema property: name, type, and the @ToolParam description. */
    private void appendParams(StringBuilder sb, String toolName, String inputSchema) {
        try {
            JsonNode properties = objectMapper.readTree(inputSchema).path("properties");
            properties.properties().forEach(entry -> {
                if ("toolContext".equals(entry.getKey())) {
                    return;
                }
                JsonNode prop = entry.getValue();
                sb.append("    · ").append(entry.getKey())
                    .append(" (").append(prop.path("type").asString("?")).append(")");
                String description = prop.path("description").asString("");
                if (!description.isBlank()) {
                    sb.append(": ").append(description);
                }
                sb.append('\n');
            });
        } catch (Exception e) {
            // A generated schema failing to parse is a bug elsewhere; the catalogue stays useful
            // with name+description only, and the log points at the offending tool.
            log.warn("Tool schema unparseable for {}", toolName, e);
        }
    }
}
```

**Jackson 3 API note:** `JsonNode.properties()` returns the entry set in Jackson 3; if the exact accessor differs on this classpath (`propertyNames()`/iterator), adapt to what `tools.jackson.databind.JsonNode` actually offers — check by compiling, and prefer the idiom another repo usage employs if you find one (`grep -rn "readTree" backend/src/main`). Same for `asString(...)` vs `asText(...)` — Jackson 3 renamed `asText` to `asString`; verify against the jar and use the compiling variant. Do not silently switch to `com.fasterxml`.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=ToolCatalogueIT,ArchitectureTest -Dmezo.test.use-testcontainers=true
```
Expected: PASS — catalogue renders all 18 tools; no ArchUnit violation (service→tools import is intra-slice).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ToolCatalogue.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ToolCatalogueIT.java
git commit -m "feat(companion): planner tool catalogue rendered from the live registry (mezo-rj214.7)"
```

---

### Task 3: Config — `Turn.Planner` + `Turn.Executor`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java:475-484` (the `Turn` record)
- Modify: `backend/src/main/resources/application.yml:820-829` (the `turn:` block)
- Modify: every test constructing `CompanionProperties.Turn` (grep `new CompanionProperties.Turn(` — expect `CompanionPropertiesFixtures` plus the 5 ripple test files from S9.1–S9.3)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/config/CompanionTurnPropertiesIT.java` (extend)

**Interfaces:**
- Produces: `properties.turn().planner().repairAttempts() → int` (Task 7); `properties.turn().executor().parallelism() → int` and `.stepTimeoutMs() → long` (Task 6).

- [ ] **Step 1: Write the failing test (extend the existing IT)**

Add to `CompanionTurnPropertiesIT`:

```java
    @Test
    void testTurn_shouldBindPlannerAndExecutorDefaults_whenApplicationYmlIsLoaded() {
        assertThat(properties.turn().planner().repairAttempts()).isEqualTo(1);
        assertThat(properties.turn().executor().parallelism()).isEqualTo(4);
        assertThat(properties.turn().executor().stepTimeoutMs()).isEqualTo(15000L);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=CompanionTurnPropertiesIT -Dmezo.test.use-testcontainers=true
```
Expected: FAIL — compilation error, `Turn` has no `planner()`/`executor()`.

- [ ] **Step 3: Write minimal implementation**

Replace the `Turn` record body (`CompanionProperties.java:475-484`) with:

```java
    /**
     * How one chat turn is shaped (spec 2026-09-16). Gear + CHAT-branch effort landed with
     * S9.1–S9.3; planner and executor land dark with S9.4 and become operative in S9.5.
     * Per-gear reasoning-effort keys are DEFERRED to S9.5 (no per-call effort override exists on
     * the LLM seam yet; see the S9.4 plan's scope decisions).
     */
    public record Turn(
        @NotNull @Valid Gear gear,
        @NotNull @Valid Planner planner,
        @NotNull @Valid Executor executor,
        @NotNull @Valid Answerer answerer
    ) {
        /** Whether an UNSURE turn may spend one cheap call on a classifier, or falls straight to ANALYSIS. */
        public record Gear(boolean classifierEnabled) {}

        /** How many repair laps an unparseable/fully-rejected plan earns before the caller falls back (spec §6.3). */
        public record Planner(@Min(0) @Max(3) int repairAttempts) {}

        /** Parallel fan-out width and the per-step wait before a read is declared timed out (spec §6.4). */
        public record Executor(@Min(1) @Max(16) int parallelism,
                               @Min(100) @Max(60_000) long stepTimeoutMs) {}

        /** Reasoning effort per gear. Only the CHAT branch exists in this slice. */
        public record Answerer(@NotBlank String chatEffort) {}
    }
```

(Ensure `jakarta.validation.constraints.Min`/`Max` are already imported in the file — they are used by sibling records.)

In `application.yml`, extend the `turn:` block (`:820-829`) between `gear:` and `answerer:`:

```yaml
      planner:
        # One repair lap: an unparseable or fully-rejected plan gets a single corrected retry
        # before the caller falls back to the legacy tool-loop path (spec §8).
        repair-attempts: 1
      executor:
        # Independent reads fan out in parallel; a step that misses the deadline becomes an
        # honest "időtúllépés" outcome instead of stalling the turn (spec §6.4).
        parallelism: 4
        step-timeout-ms: 15000
```

Update every `new CompanionProperties.Turn(...)` call site to the 4-arg shape, inserting real values in positional order (gear, planner, executor, answerer):

```java
        CompanionProperties.Turn turn = new CompanionProperties.Turn(
            new CompanionProperties.Turn.Gear(true),
            new CompanionProperties.Turn.Planner(1),
            new CompanionProperties.Turn.Executor(4, 15_000L),
            new CompanionProperties.Turn.Answerer("high"));
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=CompanionTurnPropertiesIT,TurnGearRouterTest -Dmezo.test.use-testcontainers=true
```
Expected: PASS — new bindings green, router unit test still green on the updated fixture. Then compile the whole test tree to flush every ripple call site:
```bash
./mvnw clean test-compile
```
Expected: BUILD SUCCESS with zero remaining 2-arg `Turn` constructors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/main/resources/application.yml backend/src/test/java
git commit -m "feat(companion): planner + executor config under mezo.companion.turn (mezo-rj214.7)"
```

---

### Task 4: `PlanValidator`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ValidatedPlan.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PlanValidator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PlanValidatorTest.java`

**Interfaces:**
- Consumes: `TurnPlan`/`PlanStep` (Task 1); `properties.turn()` is NOT needed — the step cap comes from `properties.tools().maxCallsPerTurn()`; `ToolCallback.getToolDefinition().inputSchema()`.
- Produces: `record ValidatedPlan(List<TurnPlan.PlanStep> steps, List<String> rejections)`; `ValidatedPlan PlanValidator.validate(TurnPlan plan, List<ToolCallback> callbacks)`. Contract Tasks 6–7 rely on: `steps` are exactly the accepted steps in plan order; `rejections` are Hungarian one-liners; a plan whose every step was rejected has empty `steps` and non-empty `rejections`.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.DefaultToolDefinition;
import org.springframework.ai.tool.definition.ToolDefinition;
import tools.jackson.databind.ObjectMapper;

class PlanValidatorTest {

    private static final String FUEL_SCHEMA = """
        {"type":"object","properties":{
          "range":{"type":"string","description":"day vagy week"},
          "date":{"type":"string"},"days":{"type":"integer"}}}""";

    /** Definition-only stub: the validator must never invoke a callback. */
    private static ToolCallback stub(String name, String schema) {
        ToolDefinition def = DefaultToolDefinition.builder()
            .name(name).description("stub").inputSchema(schema).build();
        return new ToolCallback() {
            @Override public ToolDefinition getToolDefinition() { return def; }
            @Override public String call(String toolInput) { throw new AssertionError("validator must not call tools"); }
            @Override public String call(String toolInput, ToolContext ctx) { throw new AssertionError("validator must not call tools"); }
        };
    }

    private final PlanValidator validator = new PlanValidator(new ObjectMapper(),
        CompanionPropertiesFixtures.withGearClassifier(true));

    private final List<ToolCallback> callbacks = List.of(stub("get_fuel_log", FUEL_SCHEMA));

    @Test
    void testValidate_shouldAcceptStep_whenToolAndArgsMatchTheSchema() {
        TurnPlan plan = new TurnPlan(true, List.of(
            new TurnPlan.PlanStep("get_fuel_log", Map.of("range", "day"), "mai étkezés")));

        ValidatedPlan validated = validator.validate(plan, callbacks);

        assertThat(validated.steps()).hasSize(1);
        assertThat(validated.rejections()).isEmpty();
    }

    @Test
    void testValidate_shouldRejectStep_whenToolIsUnknown() {
        TurnPlan plan = new TurnPlan(true, List.of(
            new TurnPlan.PlanStep("log_meal", Map.of(), "írjuk fel")));

        ValidatedPlan validated = validator.validate(plan, callbacks);

        assertThat(validated.steps()).isEmpty();
        assertThat(validated.rejections()).singleElement().asString().contains("log_meal").contains("ismeretlen eszköz");
    }

    @Test
    void testValidate_shouldRejectStep_whenAnArgIsNotInTheSchema() {
        TurnPlan plan = new TurnPlan(true, List.of(
            new TurnPlan.PlanStep("get_fuel_log", Map.of("range", "day", "grams", true), "mai étkezés")));

        ValidatedPlan validated = validator.validate(plan, callbacks);

        assertThat(validated.steps()).isEmpty();
        assertThat(validated.rejections()).singleElement().asString().contains("grams").contains("ismeretlen paraméter");
    }

    @Test
    void testValidate_shouldCapSteps_whenThePlanExceedsTheToolBudget() {
        List<TurnPlan.PlanStep> many = java.util.stream.IntStream.range(0, 20)
            .mapToObj(i -> new TurnPlan.PlanStep("get_fuel_log", Map.of("range", "day"), "lépés " + i))
            .toList();

        ValidatedPlan validated = validator.validate(new TurnPlan(true, many), callbacks);

        // The fixture's tools budget is maxCallsPerTurn=15 (mirrors application.yml).
        assertThat(validated.steps()).hasSize(15);
        assertThat(validated.rejections()).hasSize(5);
        assertThat(validated.rejections().getFirst()).contains("lépéskeret");
    }
}
```

Also extend `CompanionPropertiesFixtures.withGearClassifier` to carry a real `Tools` record: replace the positional `null` for the `tools` component (4th component of `CompanionProperties`) with

```java
        new CompanionProperties.Tools(15, 30, 26, 10)
```

(component order per `CompanionProperties.Tools`'s record declaration at `config/CompanionProperties.java:460-469` — verify the positional order there: maxCallsPerTurn, maxWindowDays, maxTrendWeeks, maxRefsPerTurn — and adjust to the actual declaration if it differs).

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=PlanValidatorTest
```
Expected: FAIL — `ValidatedPlan`/`PlanValidator` do not exist. (If `DefaultToolDefinition.builder()` has a different shape in Spring AI 2.0.1, use `ToolDefinition.builder()` — the recon confirmed the static `builder()` exists on `ToolDefinition`; use whichever compiles and note it.)

- [ ] **Step 3: Write minimal implementation**

`ValidatedPlan.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import java.util.List;

/**
 * The executable subset of a {@link TurnPlan}, validated against the LIVE tool registry
 * (spec §6.3 / P3): unknown tools and unknown parameters are dropped with a recorded reason,
 * never executed blind. Two spec-listed checks are deliberately DELEGATED rather than repeated
 * here: enumerated VALUES (scope words) are prose in the @ToolParam descriptions, and WINDOW
 * bounds are clamped inside every tool via ToolText.clamp — both already have safe in-tool
 * fallbacks (mezo-xk54 item 6 pins the garbage-scope behavior), so re-validating them would be
 * a second source of truth that can drift.
 */
public record ValidatedPlan(List<TurnPlan.PlanStep> steps, List<String> rejections) {

    public boolean isEmpty() {
        return steps.isEmpty();
    }
}
```

`PlanValidator.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * "The model phrases, code decides" — the registry, not the planner, is the authority on what
 * may run ({@code TestPlanValidator} precedent). Pure and side-effect free: never invokes a
 * callback, never throws on model garbage.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class PlanValidator {

    private final ObjectMapper objectMapper;
    private final CompanionProperties properties;

    public ValidatedPlan validate(TurnPlan plan, List<ToolCallback> callbacks) {
        Map<String, Set<String>> knownParams = schemaParams(callbacks);
        int budget = properties.tools().maxCallsPerTurn();
        List<TurnPlan.PlanStep> accepted = new ArrayList<>();
        List<String> rejections = new ArrayList<>();
        for (TurnPlan.PlanStep step : plan.steps()) {
            if (accepted.size() >= budget) {
                rejections.add(step.tool() + ": a lépéskeret (" + budget + ") betelt");
                continue;
            }
            Set<String> known = knownParams.get(step.tool());
            if (known == null) {
                rejections.add(step.tool() + ": ismeretlen eszköz");
                continue;
            }
            List<String> unknown = step.args().keySet().stream()
                .filter(key -> !known.contains(key))
                .toList();
            if (!unknown.isEmpty()) {
                rejections.add(step.tool() + ": ismeretlen paraméter " + unknown);
                continue;
            }
            accepted.add(step);
        }
        return new ValidatedPlan(List.copyOf(accepted), List.copyOf(rejections));
    }

    private Map<String, Set<String>> schemaParams(List<ToolCallback> callbacks) {
        Map<String, Set<String>> params = new HashMap<>();
        for (ToolCallback callback : callbacks) {
            Set<String> names = new HashSet<>();
            try {
                JsonNode properties = objectMapper
                    .readTree(callback.getToolDefinition().inputSchema()).path("properties");
                properties.properties().forEach(entry -> names.add(entry.getKey()));
            } catch (Exception e) {
                // Generated schema failing to parse is a bug elsewhere; an empty param set means
                // only arg-less steps for this tool pass, which is the safe direction.
                log.warn("Tool schema unparseable for {}", callback.getToolDefinition().name(), e);
            }
            params.put(callback.getToolDefinition().name(), names);
        }
        return params;
    }
}
```

(The same Jackson 3 `JsonNode.properties()` note as Task 2 applies.)

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=PlanValidatorTest,TurnGearRouterTest
```
Expected: PASS — validator green, and the fixture change did not disturb the router test.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ValidatedPlan.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PlanValidator.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PlanValidatorTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/CompanionPropertiesFixtures.java
git commit -m "feat(companion): plan validated against the live tool registry (mezo-rj214.7)"
```

---

### Task 5: `ToolCallAudit` thread safety

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAudit.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAuditConcurrencyTest.java`

**Interfaces:**
- Consumes/produces: no signature changes. The CONTRACT changes: the audit becomes safe for concurrent `recordCall`/`recordResult`/`addRef`/`budgetExhausted` from executor threads (Task 6's prerequisite). The class javadoc's "no synchronization is needed" sentence (`ToolCallAudit.java:18-19`) must be rewritten — it becomes false the moment S9.4 lands.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;

class ToolCallAuditConcurrencyTest {

    @Test
    void testRecordCallAndResult_shouldLoseNothing_whenHammeredFromManyThreads() throws Exception {
        int calls = 64;
        ToolCallAudit audit = new ToolCallAudit(calls, 10);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(8)) {
            List<Future<?>> futures = java.util.stream.IntStream.range(0, calls)
                .<Future<?>>mapToObj(i -> pool.submit(() -> {
                    start.await();
                    int index = audit.recordCall("get_fuel_log", "{\"i\":" + i + "}");
                    audit.recordResult(index, "eredmény " + i);
                    audit.addRef("FuelDay", "2026-09-" + (i % 28 + 1));
                    return null;
                }))
                .toList();
            start.countDown();
            for (Future<?> f : futures) {
                f.get();
            }
        }

        assertThat(audit.callCount()).isEqualTo(calls);
        // Every call index got its own result — nothing lost, nothing cross-wired.
        assertThat(audit.toolOutcomes()).hasSize(calls)
            .allSatisfy(outcome -> {
                String i = outcome.args().replaceAll("\\D", "");
                assertThat(outcome.result()).isEqualTo("eredmény " + i);
            });
    }

    @Test
    void testBudget_shouldNeverOvershoot_whenCheckedConcurrently() throws Exception {
        int budget = 5;
        ToolCallAudit audit = new ToolCallAudit(budget, 10);
        try (ExecutorService pool = Executors.newFixedThreadPool(8)) {
            List<Future<Boolean>> futures = java.util.stream.IntStream.range(0, 32)
                .mapToObj(i -> pool.submit(() -> {
                    if (audit.budgetExhausted()) {
                        return false;
                    }
                    audit.recordCall("get_pantry", "{}");
                    return true;
                }))
                .toList();
            long recorded = futures.stream().filter(f -> {
                try { return f.get(); } catch (Exception e) { throw new RuntimeException(e); }
            }).count();
            // The check-then-record pair is not atomic across callers by design (same as the
            // Spring AI loop today); the invariant is that the AUDIT ITSELF never corrupts —
            // callCount equals the number of successful recordCall returns.
            assertThat(audit.callCount()).isEqualTo(recorded);
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=ToolCallAuditConcurrencyTest
```
Expected: FAIL or FLAKY-FAIL — unsynchronized `ArrayList` under 8 threads loses/corrupts entries (an `ArrayIndexOutOfBoundsException` or a size mismatch). If it happens to pass on one run, run it 5×: `-Dsurefire.rerunFailingTestsCount=0` and repeat the command; document the observed failure in the report. The RED here demonstrates the race is real, which is the whole justification for the change.

- [ ] **Step 3: Write minimal implementation**

In `ToolCallAudit.java`: add `synchronized` to every state-touching public method — `recordCall`, `recordResult`, `addRef` (both overloads if two exist), `budgetExhausted`, `callCount`, `toolOutcomes`, `toToolCallsEnvelope`, `toRefsEnvelope`, and `onCall` (it registers the consumer that `recordCall` invokes; keep the consumer INVOCATION outside the lock if straightforward — if not, keep it inside and note that consumers must be cheap, which the SSE tool-event emitter is). Rewrite the class javadoc's threading sentence to:

```java
 * <p>Thread-safety: originally the Spring AI loop executed a turn's tool calls sequentially and
 * this class assumed it. Since S9.4 the {@code PlanExecutor} invokes callbacks in PARALLEL, so
 * every state-touching method is synchronized. Contention is negligible: a turn records at most
 * {@code maxCallsPerTurn} entries.
```

Do not change any method signature, return type, or the `ToolOutcome` record.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=ToolCallAuditConcurrencyTest,ToolCallAuditTest,RecordingToolCallbackTest
```
Expected: PASS — the concurrency test green 5× in a row, and the two pre-existing audit tests untouched and green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAudit.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAuditConcurrencyTest.java
git commit -m "fix(companion): ToolCallAudit is thread-safe for the parallel executor (mezo-rj214.7)"
```

---

### Task 6: `PlanExecutor`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PlanExecutor.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PlanExecutorTest.java`

**Interfaces:**
- Consumes: `ValidatedPlan` (Task 4); `CompanionToolRegistry.callbacks(audit)/toolContext(userId, audit)`; `properties.turn().executor()` (Task 3); thread-safe `ToolCallAudit` (Task 5); the injected executor follows the house pattern — copy the exact injection style from `MemoryQueryEmbedder.java:54-55` (`@Qualifier("applicationTaskExecutor")` on the constructor-injected `AsyncTaskExecutor` field).
- Produces: `List<ToolCallAudit.ToolOutcome> PlanExecutor.execute(ValidatedPlan plan, UUID userId, ToolCallAudit audit)` — outcomes in PLAN ORDER (deterministic for the S9.5 answerer digest), one per step, timeout/failure as explicit Hungarian text. Public constants `STEP_TIMEOUT` and `STEP_FAILED` (tests and S9.5 assert on them).

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.DefaultToolDefinition;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import tools.jackson.databind.ObjectMapper;

/**
 * Unit test with stub callbacks and a real pool — the end-to-end run against the real registry
 * happens in TurnPipelineIT (Task 8). NOTE ON MOCKS: the house testing standard forbids mocks in
 * INTEGRATION tests; this is a plain unit test of orchestration logic, where a stubbed registry
 * is the only way to script slow/failing tools deterministically.
 */
class PlanExecutorTest {

    private final ThreadPoolTaskExecutor pool = new ThreadPoolTaskExecutor();
    private final ObjectMapper objectMapper = new ObjectMapper();

    { pool.setCorePoolSize(4); pool.initialize(); }

    @AfterEach
    void shutDown() { pool.shutdown(); }

    private static ToolCallback tool(String name, java.util.function.Function<String, String> body) {
        ToolDefinition def = DefaultToolDefinition.builder()
            .name(name).description("stub").inputSchema("{\"type\":\"object\",\"properties\":{}}").build();
        return new ToolCallback() {
            @Override public ToolDefinition getToolDefinition() { return def; }
            @Override public String call(String toolInput) { return body.apply(toolInput); }
            @Override public String call(String toolInput, ToolContext ctx) { return body.apply(toolInput); }
        };
    }

    private PlanExecutor executor(long stepTimeoutMs, ToolCallback... tools) {
        CompanionToolRegistry registry = Mockito.mock(CompanionToolRegistry.class);
        Mockito.when(registry.callbacks(Mockito.any())).thenReturn(List.of(tools));
        Mockito.when(registry.toolContext(Mockito.any(), Mockito.any())).thenReturn(Map.of());
        return new PlanExecutor(registry, objectMapper,
            CompanionPropertiesFixtures.withExecutor(4, stepTimeoutMs), pool);
    }

    private static TurnPlan.PlanStep step(String tool) {
        return new TurnPlan.PlanStep(tool, Map.of(), "teszt");
    }

    @Test
    void testExecute_shouldReturnOutcomesInPlanOrder_whenStepsFinishOutOfOrder() throws Exception {
        CountDownLatch releaseSlow = new CountDownLatch(1);
        ToolCallback slow = tool("slow_tool", in -> {
            try { releaseSlow.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return "lassú kész";
        });
        ToolCallback fast = tool("fast_tool", in -> { releaseSlow.countDown(); return "gyors kész"; });
        PlanExecutor executor = executor(5_000, slow, fast);

        List<ToolCallAudit.ToolOutcome> outcomes = executor.execute(
            new ValidatedPlan(List.of(step("slow_tool"), step("fast_tool")), List.of()),
            UUID.randomUUID(), new ToolCallAudit(15, 10));

        assertThat(outcomes).extracting(ToolCallAudit.ToolOutcome::name)
            .containsExactly("slow_tool", "fast_tool");
        assertThat(outcomes).extracting(ToolCallAudit.ToolOutcome::result)
            .containsExactly("lassú kész", "gyors kész");
    }

    @Test
    void testExecute_shouldReportTimeoutHonestly_whenAStepMissesTheDeadline() {
        CountDownLatch never = new CountDownLatch(1);
        ToolCallback hanging = tool("hang_tool", in -> {
            try { never.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return "soha";
        });
        PlanExecutor executor = executor(200, hanging, tool("ok_tool", in -> "rendben"));

        List<ToolCallAudit.ToolOutcome> outcomes = executor.execute(
            new ValidatedPlan(List.of(step("hang_tool"), step("ok_tool")), List.of()),
            UUID.randomUUID(), new ToolCallAudit(15, 10));

        never.countDown();
        assertThat(outcomes.getFirst().result()).isEqualTo(PlanExecutor.STEP_TIMEOUT);
        assertThat(outcomes.get(1).result()).isEqualTo("rendben");
    }

    @Test
    void testExecute_shouldReportFailureHonestly_whenSubmissionItselfBreaks() {
        // A tool that is in the plan but not in the registry's callback list: validator normally
        // prevents this, but the executor must not throw if reality diverges.
        PlanExecutor executor = executor(1_000, tool("present_tool", in -> "megvan"));

        List<ToolCallAudit.ToolOutcome> outcomes = executor.execute(
            new ValidatedPlan(List.of(step("missing_tool"), step("present_tool")), List.of()),
            UUID.randomUUID(), new ToolCallAudit(15, 10));

        assertThat(outcomes.getFirst().result()).isEqualTo(PlanExecutor.STEP_FAILED);
        assertThat(outcomes.get(1).result()).isEqualTo("megvan");
    }
}
```

Add to `CompanionPropertiesFixtures`:

```java
    static CompanionProperties withExecutor(int parallelism, long stepTimeoutMs) {
        CompanionProperties.Turn turn = new CompanionProperties.Turn(
            new CompanionProperties.Turn.Gear(true),
            new CompanionProperties.Turn.Planner(1),
            new CompanionProperties.Turn.Executor(parallelism, stepTimeoutMs),
            new CompanionProperties.Turn.Answerer("high"));
        return new CompanionProperties(null, null, null, new CompanionProperties.Tools(15, 30, 26, 10),
            null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, java.util.List.of(), turn);
    }
```

(Positional slots must match the current 20-component declaration — copy the null layout from the existing fixture method and swap in the `Tools` + `Turn` values.)

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=PlanExecutorTest
```
Expected: FAIL — `PlanExecutor` does not exist.

- [ ] **Step 3: Write minimal implementation**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Executes a validated plan with PURE JAVA — no model in the loop, so nothing can misread or
 * skip a step (spec §6.4 / X1). Independent reads fan out in parallel through the SAME
 * {@link io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback} wrappers the Spring AI
 * loop uses, so audit, refs, budget and the internal-sphere ArchUnit guarantee all hold
 * unchanged. Outcomes return in PLAN ORDER regardless of completion order.
 *
 * <p>No {@code LlmActorContext} capture: the executor makes no LLM calls, and the tools take
 * their identity from the ToolContext's userId, not from the actor holder.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PlanExecutor {

    /** Honest missing-result texts (ADR 0010): shown to the model, never fabricated data. */
    public static final String STEP_TIMEOUT = "Nem érkezett meg időben az adat (időtúllépés).";
    public static final String STEP_FAILED = "Nem sikerült elindítani a lekérdezést (belső hiba).";

    private final CompanionToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;
    private final CompanionProperties properties;
    private final AsyncTaskExecutor applicationTaskExecutor;

    public PlanExecutor(CompanionToolRegistry toolRegistry, ObjectMapper objectMapper,
                        CompanionProperties properties,
                        @Qualifier("applicationTaskExecutor") AsyncTaskExecutor applicationTaskExecutor) {
        this.toolRegistry = toolRegistry;
        this.objectMapper = objectMapper;
        this.properties = properties;
        this.applicationTaskExecutor = applicationTaskExecutor;
    }

    public List<ToolCallAudit.ToolOutcome> execute(ValidatedPlan plan, UUID userId, ToolCallAudit audit) {
        List<ToolCallback> callbacks = toolRegistry.callbacks(audit);
        Map<String, ToolCallback> byName = callbacks.stream()
            .collect(java.util.stream.Collectors.toMap(cb -> cb.getToolDefinition().name(), Function.identity()));
        ToolContext toolContext = new ToolContext(toolRegistry.toolContext(userId, audit));
        long timeoutMs = properties.turn().executor().stepTimeoutMs();
        Semaphore permits = new Semaphore(properties.turn().executor().parallelism());

        List<Submitted> submitted = new ArrayList<>();
        for (TurnPlan.PlanStep step : plan.steps()) {
            String args = argsJson(step.args());
            ToolCallback callback = byName.get(step.tool());
            if (callback == null) {
                // The validator prevents this; if reality diverges, report instead of throwing.
                submitted.add(new Submitted(step, args, null));
                continue;
            }
            try {
                permits.acquire();
                Future<String> future = applicationTaskExecutor.submit(() -> {
                    try {
                        return callback.call(args, toolContext);
                    } finally {
                        permits.release();
                    }
                });
                submitted.add(new Submitted(step, args, future));
            } catch (Exception e) {
                permits.release();
                log.warn("Plan step submission failed for {}", step.tool(), e);
                submitted.add(new Submitted(step, args, null));
            }
        }

        List<ToolCallAudit.ToolOutcome> outcomes = new ArrayList<>(submitted.size());
        for (Submitted entry : submitted) {
            outcomes.add(new ToolCallAudit.ToolOutcome(entry.step().tool(), entry.args(), collect(entry, timeoutMs)));
        }
        return List.copyOf(outcomes);
    }

    private String collect(Submitted entry, long timeoutMs) {
        if (entry.future() == null) {
            return STEP_FAILED;
        }
        try {
            // RecordingToolCallback already converts tool exceptions to its TOOL_FAILED text,
            // so an ExecutionException here is infrastructure, not domain.
            return entry.future().get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            entry.future().cancel(true);
            log.warn("Plan step timed out after {} ms: {}", timeoutMs, entry.step().tool());
            return STEP_TIMEOUT;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return STEP_FAILED;
        } catch (Exception e) {
            log.warn("Plan step failed: {}", entry.step().tool(), e);
            return STEP_FAILED;
        }
    }

    private String argsJson(Map<String, Object> args) {
        try {
            return objectMapper.writeValueAsString(args);
        } catch (Exception e) {
            return "{}";
        }
    }

    private record Submitted(TurnPlan.PlanStep step, String args, Future<String> future) {}
}
```

**Timeout semantics note for the implementer:** `collect` walks entries in plan order and gives EACH step up to `stepTimeoutMs` of additional wait at collection time; because execution is concurrent, total wall time stays bounded near the slowest step, not the sum. That is intended and matches the test.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=PlanExecutorTest,ToolCallAuditConcurrencyTest,ArchitectureTest -Dmezo.test.use-testcontainers=true
```
Expected: PASS — all three green (ArchUnit re-run because a new bean class landed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PlanExecutor.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PlanExecutorTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/CompanionPropertiesFixtures.java
git commit -m "feat(companion): parallel plan executor over the recorded tool callbacks (mezo-rj214.7)"
```

---

### Task 7: `TurnPlanner` + fake dispatch

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnPlanner.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (the `completeSmart` override, `:1170-1183`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnPlannerTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlmPlanTest.java`

**Interfaces:**
- Consumes: `CompanionLlm.completeSmart(String systemPrompt, String turnContext, List<Turn> history, String userMessage)` (tool-free smart, `CompanionLlm.java:134-138`); `TurnPlanParser` (Task 1); `ToolCatalogue` (Task 2); `PlanValidator` (Task 4); `CompanionToolRegistry`; `properties.turn().planner().repairAttempts()` (Task 3).
- Produces: `public static final String PROMPT_MARKER = "TERV-FELADAT."` (the fake dispatches on it); `Optional<ValidatedPlan> TurnPlanner.plan(List<Turn> history, String userMessage, LocalDate today)` — empty = the planner could not produce a usable plan and the caller (S9.5) falls back to the legacy path; a PRESENT plan with ZERO steps = the planner ruled no data is needed. `FakeCompanionLlm` gains the `[fake-plan:<json>]` scripting sentinel.

- [ ] **Step 1: Write the failing tests**

`TurnPlannerTest.java` — pure unit test with a scripted `CompanionLlm` lambda over stub callbacks:

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.DefaultToolDefinition;
import org.springframework.ai.tool.definition.ToolDefinition;
import reactor.core.publisher.Flux;
import tools.jackson.databind.ObjectMapper;

class TurnPlannerTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 17);

    /** Minimal scripted port: answers completeSmart from a queue, records the prompts it saw. */
    private static final class ScriptedLlm implements CompanionLlm {
        final List<String> systemPrompts = new ArrayList<>();
        final List<String> userMessages = new ArrayList<>();
        private final java.util.Deque<String> replies;
        ScriptedLlm(String... replies) { this.replies = new java.util.ArrayDeque<>(List.of(replies)); }

        @Override public String completeSmart(String systemPrompt, String turnContext,
                                              List<Turn> history, String userMessage) {
            systemPrompts.add(systemPrompt);
            userMessages.add(userMessage);
            return replies.pop();
        }
        // Unused port surface:
        @Override public String complete(String s, List<Turn> h, String u,
                                         List<org.springframework.ai.tool.ToolCallback> t, Map<String, Object> c) {
            throw new UnsupportedOperationException();
        }
        @Override public Flux<String> stream(String s, List<Turn> h, String u,
                                             List<org.springframework.ai.tool.ToolCallback> t, Map<String, Object> c) {
            throw new UnsupportedOperationException();
        }
        @Override public String complete(String s, String u, List<InlineImage> i) { throw new UnsupportedOperationException(); }
        @Override public String complete(String s, String u, InlineAudio a) { throw new UnsupportedOperationException(); }
    }

    private static ToolCallback stub(String name) {
        ToolDefinition def = DefaultToolDefinition.builder().name(name).description("stub")
            .inputSchema("{\"type\":\"object\",\"properties\":{\"range\":{\"type\":\"string\"}}}").build();
        return new ToolCallback() {
            @Override public ToolDefinition getToolDefinition() { return def; }
            @Override public String call(String in) { throw new AssertionError("planner must not call tools"); }
            @Override public String call(String in, ToolContext ctx) { throw new AssertionError("planner must not call tools"); }
        };
    }

    private TurnPlanner planner(ScriptedLlm llm) {
        CompanionToolRegistry registry = Mockito.mock(CompanionToolRegistry.class);
        Mockito.when(registry.callbacks(Mockito.any())).thenReturn(List.of(stub("get_fuel_log")));
        Mockito.when(registry.newTurnAudit()).thenReturn(new io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit(15, 10));
        ObjectMapper mapper = new ObjectMapper();
        ToolCatalogue catalogue = new ToolCatalogue(registry, mapper);
        return new TurnPlanner(llm, new TurnPlanParser(mapper), new PlanValidator(mapper,
            CompanionPropertiesFixtures.withExecutor(4, 1000)), catalogue, registry,
            CompanionPropertiesFixtures.withExecutor(4, 1000));
    }

    @Test
    void testPlan_shouldReturnValidatedSteps_whenTheModelPlansCleanly() {
        ScriptedLlm llm = new ScriptedLlm(
            "{\"needsData\":true,\"steps\":[{\"tool\":\"get_fuel_log\",\"args\":{\"range\":\"day\"},\"why\":\"mai étkezés\"}]}");

        ValidatedPlan plan = planner(llm).plan(List.of(), "Mit ettem ma?", TODAY).orElseThrow();

        assertThat(plan.steps()).hasSize(1);
        assertThat(llm.systemPrompts.getFirst()).startsWith(TurnPlanner.PROMPT_MARKER)
            .contains("[Eszköz-katalógus]").contains("get_fuel_log");
    }

    @Test
    void testPlan_shouldRepairOnce_whenTheFirstPlanIsRejected() {
        ScriptedLlm llm = new ScriptedLlm(
            "{\"needsData\":true,\"steps\":[{\"tool\":\"log_meal\",\"args\":{},\"why\":\"írd fel\"}]}",
            "{\"needsData\":true,\"steps\":[{\"tool\":\"get_fuel_log\",\"args\":{\"range\":\"day\"},\"why\":\"mai étkezés\"}]}");

        ValidatedPlan plan = planner(llm).plan(List.of(), "Mit ettem ma?", TODAY).orElseThrow();

        assertThat(plan.steps()).hasSize(1);
        assertThat(llm.userMessages).hasSize(2);
        assertThat(llm.userMessages.get(1)).contains("[JAVÍTÁS]").contains("ismeretlen eszköz");
    }

    @Test
    void testPlan_shouldBeEmpty_whenRepairAlsoFails() {
        ScriptedLlm llm = new ScriptedLlm("zagyvaság", "még mindig zagyvaság");

        assertThat(planner(llm).plan(List.of(), "Mit ettem ma?", TODAY)).isEmpty();
        assertThat(llm.userMessages).hasSize(2);
    }

    @Test
    void testPlan_shouldReturnZeroSteps_whenTheModelSaysNoDataNeeded() {
        ScriptedLlm llm = new ScriptedLlm("{\"needsData\":false,\"steps\":[]}");

        ValidatedPlan plan = planner(llm).plan(List.of(), "Mit gondolsz a kreatinról?", TODAY).orElseThrow();

        assertThat(plan.steps()).isEmpty();
        assertThat(plan.rejections()).isEmpty();
    }

    @Test
    void testPlan_shouldNotRepair_whenOnlySomeStepsWereRejected() {
        ScriptedLlm llm = new ScriptedLlm(
            "{\"needsData\":true,\"steps\":[{\"tool\":\"get_fuel_log\",\"args\":{\"range\":\"day\"},\"why\":\"ok\"},"
                + "{\"tool\":\"log_meal\",\"args\":{},\"why\":\"rossz\"}]}");

        ValidatedPlan plan = planner(llm).plan(List.of(), "Mit ettem ma?", TODAY).orElseThrow();

        // A partially valid plan runs as-is; the rejection travels with it for provenance.
        assertThat(plan.steps()).hasSize(1);
        assertThat(plan.rejections()).hasSize(1);
        assertThat(llm.userMessages).hasSize(1);
    }
}
```

`FakeCompanionLlmPlanTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.TurnPlanner;
import java.util.List;
import org.junit.jupiter.api.Test;

class FakeCompanionLlmPlanTest {

    private final FakeCompanionLlm fake = new FakeCompanionLlm();

    @Test
    void testCompleteSmart_shouldReturnScriptedPlan_whenMessageCarriesTheSentinel() {
        String scripted = "{\"needsData\":true,\"steps\":[{\"tool\":\"get_pantry\",\"args\":{},\"why\":\"kamra\"}]}";

        String answer = fake.completeSmart(TurnPlanner.PROMPT_MARKER + " katalógus...", "",
            List.of(), "Mi van a kamrában? [fake-plan:" + scripted + "]");

        assertThat(answer).isEqualTo(scripted);
    }

    @Test
    void testCompleteSmart_shouldReturnNoDataPlan_whenNoSentinelIsScripted() {
        String answer = fake.completeSmart(TurnPlanner.PROMPT_MARKER + " katalógus...", "",
            List.of(), "Szia!");

        assertThat(answer).isEqualTo("{\"needsData\":false,\"steps\":[]}");
    }

    @Test
    void testCompleteSmart_shouldKeepTheGearEcho_whenThePromptIsNotAPlannerPrompt() {
        String answer = fake.completeSmart("HANG", "KONTEXTUS", List.of(), "Szia!");

        assertThat(answer).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=TurnPlannerTest,FakeCompanionLlmPlanTest
```
Expected: FAIL — `TurnPlanner` does not exist.

- [ ] **Step 3: Write minimal implementation**

`TurnPlanner.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The strong model decides WHAT to fetch — by SAYING it, never by calling a tool (spec §6.2 /
 * P1+P2): the planning call carries no tool schemas, so provider-side reasoning is legal, and
 * the catalogue travels as prompt text rendered from the live registry. Machine-facing prompt:
 * no PromptPersona, ASCII-Hungarian, marker-prefixed for the fake's dispatch.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class TurnPlanner {

    /** Public so FakeCompanionLlm can dispatch on the prompt prefix. */
    public static final String PROMPT_MARKER = "TERV-FELADAT.";

    static final String PROMPT = PROMPT_MARKER + """
         Te a felhasznalo szemelyes egeszseg-tarsanak ADATTERVEZOJE vagy. NEM valaszolsz a kerdesre:
        kizarolag azt mondod meg, mely lekerdezesek kellenek a megvalaszolasahoz.
        A hasznalhato lekerdezesek neve, leirasa es parameterei a lenti katalogusban vannak.
        Valaszolj KIZAROLAG ezzel a JSON objektummal, magyarazat nelkul:
        {"needsData":true|false,"steps":[{"tool":"<nev>","args":{...},"why":"<fel mondat magyarul>"}]}
        Szabalyok: csak katalogusbeli nevet hasznalj; csak a katalogusban felsorolt parametereket add at;
        ha a kerdeshez nem kell a felhasznalo sajat adata, needsData=false es ures steps;
        legfeljebb 15 lepes; ugyanazt a lekerdezest ne ismeteld.

        """;

    static final String REPAIR_PREFIX = "[JAVÍTÁS] Az előző terved hibás volt (";
    static final String REPAIR_SUFFIX = "). Adj érvényes tervet ugyanerre a kérdésre, kizárólag a katalógus eszközeivel.";

    private final CompanionLlm companionLlm;
    private final TurnPlanParser parser;
    private final PlanValidator validator;
    private final ToolCatalogue catalogue;
    private final CompanionToolRegistry toolRegistry;
    private final CompanionProperties properties;

    /**
     * Empty = no usable plan after the repair budget — the caller falls back to the legacy
     * tool-loop path (spec §8). Present with zero steps = the planner ruled no data is needed.
     */
    public Optional<ValidatedPlan> plan(List<CompanionLlm.Turn> history, String userMessage, LocalDate today) {
        // Stable half: prompt + catalogue (identical across turns => cacheable prefix).
        String system = PROMPT + catalogue.render();
        String turnContext = "\n\nMa: " + today + "\n";
        // Definitions only — no call ever goes through these callbacks here.
        List<ToolCallback> callbacks = toolRegistry.callbacks(toolRegistry.newTurnAudit());

        String message = userMessage;
        int attempts = properties.turn().planner().repairAttempts();
        for (int round = 0; round <= attempts; round++) {
            String raw = companionLlm.completeSmart(system, turnContext, history, message);
            Optional<TurnPlan> parsed = parser.parse(raw);
            if (parsed.isPresent()) {
                TurnPlan turnPlan = parsed.get();
                if (!turnPlan.needsData() || turnPlan.steps().isEmpty()) {
                    return Optional.of(new ValidatedPlan(List.of(), List.of()));
                }
                ValidatedPlan validated = validator.validate(turnPlan, callbacks);
                if (!validated.isEmpty()) {
                    // Partially rejected plans run as-is; the rejections travel for provenance.
                    return Optional.of(validated);
                }
                message = userMessage + "\n\n" + REPAIR_PREFIX
                    + String.join("; ", validated.rejections()) + REPAIR_SUFFIX;
            } else {
                message = userMessage + "\n\n" + REPAIR_PREFIX
                    + "nem volt értelmezhető JSON" + REPAIR_SUFFIX;
            }
        }
        log.warn("Turn planner produced no usable plan after {} repair attempt(s)", attempts);
        return Optional.empty();
    }
}
```

In `FakeCompanionLlm.java`, inside the `completeSmart` override (`:1170-1183`), AFTER the existing failure-sentinel handling and BEFORE the gear echo, add:

```java
        if (systemPrompt.startsWith(io.mrkuhne.mezo.feature.companion.service.TurnPlanner.PROMPT_MARKER)) {
            java.util.regex.Matcher plan = FAKE_PLAN.matcher(userMessage);
            return plan.find() ? plan.group(1) : "{\"needsData\":false,\"steps\":[]}";
        }
```

with the pattern next to the other sentinels:

```java
    /** Scripts the planner's reply: [fake-plan:{...json...}] anywhere in the user message. */
    private static final java.util.regex.Pattern FAKE_PLAN =
        java.util.regex.Pattern.compile("\\[fake-plan:(\\{.*})]", java.util.regex.Pattern.DOTALL);
```

(Keep the existing import style of the file — top-level imports rather than inline qualification if that is what the file does; follow the file.)

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=TurnPlannerTest,FakeCompanionLlmPlanTest,FakeCompanionLlmGearTest,ChatServiceGearIT,ChatStreamServiceGearIT -Dmezo.test.use-testcontainers=true
```
Expected: PASS — planner unit green, fake plan dispatch green, and the three pre-existing gear tests prove the fake's CHAT echo behavior is undisturbed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnPlanner.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnPlannerTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlmPlanTest.java
git commit -m "feat(companion): turn planner with repair lap + fake plan scripting (mezo-rj214.7)"
```

---

### Task 8: `TurnPipelineIT` + docs

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnPipelineIT.java`
- Modify: `docs/features/companion.md` (§3: planner/executor components shipped dark; §4: the new config keys; note the deferred per-gear effort keys)
- Modify: `docs/CODEMAP.md` (regenerated)

**Interfaces:**
- Consumes: everything from Tasks 1–7, against the REAL registry and REAL data.
- Produces: the slice's end-to-end proof: scripted plan → validation → parallel execution over real tools → plan-ordered Hungarian outcomes + a filled audit.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** The S9.4 slice end-to-end, DARK: planner (fake, scripted) → validator → executor → outcomes. */
@Transactional
@ActiveProfiles("companion-fake")
class TurnPipelineIT extends AbstractIntegrationTest {

    @Autowired private TurnPlanner turnPlanner;
    @Autowired private PlanExecutor planExecutor;
    @Autowired private io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry toolRegistry;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    @Test
    void testPipeline_shouldExecuteScriptedPlanOverRealTools_whenDataExists() {
        UUID userId = databasePopulator.populateUser("pipeline@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.5"), 2);

        String scripted = """
            [fake-plan:{"needsData":true,"steps":[\
            {"tool":"get_recovery","args":{"scope":"sleep","days":3},"why":"alvás"},\
            {"tool":"get_pantry","args":{},"why":"kamra"}]}]""";
        ValidatedPlan plan = turnPlanner
            .plan(List.of(), "Hogy aludtam, és mi van a kamrában? " + scripted, LocalDate.now())
            .orElseThrow();

        assertThat(plan.steps()).hasSize(2);
        assertThat(plan.rejections()).isEmpty();

        ToolCallAudit audit = toolRegistry.newTurnAudit();
        List<ToolCallAudit.ToolOutcome> outcomes = planExecutor.execute(plan, userId, audit);

        assertThat(outcomes).extracting(ToolCallAudit.ToolOutcome::name)
            .containsExactly("get_recovery", "get_pantry");
        // Real rendered Hungarian from the real tools, not stub text. The pantry is EMPTY for
        // this user, so assert honesty (a real render, no failure text), not specific content.
        assertThat(outcomes.getFirst().result()).contains("7,5");
        assertThat(outcomes.get(1).result()).isNotBlank()
            .isNotEqualTo(PlanExecutor.STEP_FAILED)
            .isNotEqualTo(PlanExecutor.STEP_TIMEOUT);
        // The audit is the same choke point the live loop uses — envelopes fill identically.
        assertThat(audit.callCount()).isEqualTo(2);
        assertThat(audit.toToolCallsEnvelope()).isNotNull();
    }

    @Test
    void testPipeline_shouldSurviveAnUnknownStep_whenTheScriptIsPartiallyBroken() {
        UUID userId = databasePopulator.populateUser("pipeline-broken@test.local");

        String scripted = """
            [fake-plan:{"needsData":true,"steps":[\
            {"tool":"log_meal","args":{},"why":"nem létezik"},\
            {"tool":"get_pantry","args":{},"why":"kamra"}]}]""";
        ValidatedPlan plan = turnPlanner
            .plan(List.of(), "kamra? " + scripted, LocalDate.now())
            .orElseThrow();

        assertThat(plan.steps()).singleElement()
            .extracting(TurnPlan.PlanStep::tool).isEqualTo("get_pantry");
        assertThat(plan.rejections()).singleElement().asString().contains("log_meal");

        List<ToolCallAudit.ToolOutcome> outcomes =
            planExecutor.execute(plan, userId, toolRegistry.newTurnAudit());
        assertThat(outcomes).hasSize(1);
    }
}
```

(If the sleep line renders `7.5` differently — `ToolText.huHours` uses one decimal with a Hungarian comma — adjust the asserted fragment to what `get_recovery`'s compact line actually emits for 7.5 hours; `CompanionToolsRenderIT` shows the exact format. Assert on a STABLE fragment, not the whole line.)

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=TurnPipelineIT -Dmezo.test.use-testcontainers=true
```
Expected: FAIL only if Tasks 1–7 left a wiring gap (bean not found, fake dispatch order wrong) — that is exactly what this IT exists to catch. If it passes first try, note that in the report; the RED step for an integration capstone is best-effort.

- [ ] **Step 3: Make it pass** (fix whatever the IT surfaces — typically bean gating or fake dispatch order; no new production features).

- [ ] **Step 4: Full-package verification**

Run:
```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**' -Dmezo.test.use-testcontainers=true
```
Expected: GREEN across the whole package (~1825+ tests, ~7.5 min). The zero-behavior-change constraint means zero pre-existing test edits in this whole plan — if any existing test fails, the slice broke its dark-shipping promise; fix the production code, never the fixture.

- [ ] **Step 5: Docs + codemap**

- `docs/features/companion.md`: §3 — describe the dark-shipped planner pipeline (TurnPlanner → PlanValidator → PlanExecutor, repair lap, plan-ordered outcomes, thread-safe audit) and state plainly that NOTHING invokes it on the live turn until S9.5; §4 — add `mezo.companion.turn.planner.repair-attempts`, `…executor.parallelism`, `…executor.step-timeout-ms` with defaults; note the per-gear effort keys as deliberately deferred to S9.5. Update the `ToolCallAudit` threading description if §3 mentions it.
- `node scripts/gen-codemap.mjs` then `node scripts/gen-codemap.mjs --check` (clean) and `node scripts/lint-docs.mjs` (companion.md not stale; 17 pre-existing stale docs stay — mezo-74iz).

- [ ] **Step 6: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnPipelineIT.java docs/features/companion.md docs/CODEMAP.md
git commit -m "test(companion): dark end-to-end turn pipeline + docs (mezo-rj214.7)"
```

---

## Done criteria for this plan

1. Full companion package green locally with Testcontainers; zero edits to pre-existing tests (dark shipping).
2. `TurnPipelineIT` proves: scripted plan → validated → executed in parallel over REAL tools → plan-ordered Hungarian outcomes + filled audit envelopes.
3. The planner prompt carries the live-rendered catalogue; no hand-maintained tool list anywhere new.
4. `ToolCallAudit` is thread-safe with a test that demonstrably failed before the fix.
5. Branch pushed, self-PR, CI green, `premerge.yml` against current main, `--no-ff` merge (detached-HEAD flow), CODEMAP regenerated after the merge.
