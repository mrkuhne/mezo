# Companion turn answerer + live pipeline wiring (S9.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LOOKUP/ANALYSIS turns go live on plan → execute → answer: the smart model answers from the raw tool outcomes with reasoning on, can ask once for more data (ANALYSIS), and every failure falls back to today's tool-loop — behind a config kill switch.

**Architecture:** `ToolOutcomeDigest` moves to `service/` and becomes the answerer's outcomes block (big budgets). A new `TurnAnswerer` builds the volatile half (turn context + digest + replan-offer on ANALYSIS) and calls the tool-free smart entry points. `ChatService`/`ChatStreamService` branch LOOKUP/ANALYSIS through planner→executor→answerer when `turn.pipeline-enabled`; planner failure → legacy branch unchanged; clinical-only advisor review on pipeline answers. **Test-migration strategy:** `FakeCompanionLlm`'s planner default becomes UNPARSEABLE, so every unscripted data turn falls back to the legacy path — the ~20 existing IT files keep their exact behavior; the pipeline is covered by new, `[fake-plan:…]`-scripted ITs.

**Tech Stack:** Java 21, Spring Boot 4.x, Spring AI 2.0.1, Jackson 3 (`tools.jackson`), Reactor, JUnit 5 + AssertJ, Testcontainers.

**Spec:** `docs/superpowers/specs/2026-09-16-companion-plan-execute-answer-design.md` §6.5, §8, §9 — slice **S9.5**. Phase SSE events are S9.6; provenance persistence/UI is S9.7; advisor removal + prompt rewrite is S9.8.

**Driving issue:** `mezo-rj214.7`. Branch: `feat/companion-turn-answerer`.

## Global Constraints

- **Dark-until-scripted in tests:** with the fake's new planner default, every pre-existing IT must stay green WITHOUT edits (the unscripted data turn falls back to legacy). If an existing test needs an edit, that is a design smell to report, not a fixture to patch silently. Exception: `FakeCompanionLlmPlanTest`'s default-branch test (its pinned default changes by design).
- Jackson 3 only; no `@Value`; constructor injection; AssertJ; `test{Method}_should{Result}_when{Condition}`; English javadoc; TDD per task; ArchUnit re-run when classes move or land.
- New pipeline ITs that let `PlanExecutor` touch the DB must NOT be `@Transactional` (pool threads use their own connections; `TurnPipelineIT` precedent) — cleanup is `ResetDatabase`.
- Fixture-gear hygiene: any new fixture message must satisfy `PromptOrderFixtureGearGuardTest` (data-bearing literal, or `// gear-audited: <reason>` within 5 lines).
- Budget seam (docs/features/companion.md "Three seams"): the wiring must cap the plan at `tools.maxCallsPerTurn − audit.callCount()` before executing (we keep ONE audit per turn for the envelopes).
- The stable/volatile prompt contract: everything per-turn (digest, replan blocks) goes in the VOLATILE half; `stableSystemPrompt` stays byte-identical.
- LLM tagging: every new model round runs inside `llmCallContextHolder.runWith(new LlmCallContext("companion_chat", "<operation>", "conversation", conversationId))` — operations: `plan`, `answer`, `plan_replan`, `answer_replan` (nested rebinds are the advisor-chain precedent).
- Always `./mvnw clean test`; ITs need `-Dmezo.test.use-testcontainers=true`. NEVER bare `git stash`.

## Scope decisions made here, not left open

1. **Streamed ANALYSIS turns answer sync-then-emit.** A replan marker must never flash to the client, and a Reactor hold-back gate is state-machine complexity S9.6's phase events will obsolete. So: LOOKUP streams the answerer natively (no replan there by spec); ANALYSIS computes the answer via `completeSmart` (replan resolved server-side) and emits it as ONE delta before `done`. Perceived latency is S9.6's job (phase events); correctness first.
2. **Per-gear reasoning-effort keys are deferred AGAIN** (third time, consistently): no per-call effort override exists on the seam, planner+answerer run at the SMART tier's configured effort. `answerer.chat-effort` stays scaffolding. A dedicated tuning slice after real-traffic measurement owns this.
3. **`completeChat`/`reviewChat` (clinical-only advisor) are REUSED for pipeline turns without renaming.** Renaming would ripple through S9.1–S9.3 tests for zero behavior; a javadoc line on each noting "CHAT gear + pipeline answers" is enough.
4. **ToolSelectionEvalIT is NOT touched.** It is double-opt-in (`@Tag("eval")` surefire-excluded + API-key condition) and not in CI; under the live pipeline its `assertServedModel` single-model expectation is stale by design. The close-out task files the re-baseline note into the tracker (mezo-ozri.3 territory).

---

### Task 1: Move `ToolOutcomeDigest` to `service/` (public)

**Files:**
- Move: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/ToolOutcomeDigest.java` → `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ToolOutcomeDigest.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/TurnVerdictCheck.java` (import)
- Move: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/advisor/ToolOutcomeDigestTest.java` → `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ToolOutcomeDigestTest.java`

**Interfaces:**
- Produces: `public final class ToolOutcomeDigest` in `feature.companion.service` with the UNCHANGED API: `public static String render(List<ToolCallAudit.ToolOutcome> outcomes, int maxCharsPerResult, int maxCharsTotal)` and the public marker constants `NONE` (`"ESZKÖZHÍVÁSOK: nincs"`), `HEADER` (`"ESZKÖZHÍVÁSOK ÉS A KIMENETÜK:"`), `TRUNCATED`, `OMITTED`, `UNKNOWN`. Tasks 3–6 and the fake all key on `"ESZKÖZHÍVÁSOK"` being present in every rendered digest (both NONE and HEADER start with it).

- [ ] **Step 1: Move the class** — `git mv` both files, change `package` lines to `…feature.companion.service`, make the class and its constants/`render` `public` (it was package-private), add one javadoc sentence: "Moved from advisor/ in S9.5: the digest is now primarily the ANSWERER's data block; the verdict judge is its secondary consumer." Update `TurnVerdictCheck`'s import to `io.mrkuhne.mezo.feature.companion.service.ToolOutcomeDigest`.

- [ ] **Step 2: Run the affected tests**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=ToolOutcomeDigestTest,TurnVerdictCheckIT,CompanionAdvisorChainIT,ArchitectureTest -Dmezo.test.use-testcontainers=true
```
Expected: PASS — pure move, no behavior change; ArchUnit clean (service→tools and advisor→service are intra-slice).

- [ ] **Step 3: Commit**

```bash
git add -A backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "refactor(companion): ToolOutcomeDigest moves to service, public (mezo-rj214.7)"
```

---

### Task 2: Config — answerer budgets, replan, kill switch

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java:477-495` (the `Turn` record)
- Modify: `backend/src/main/resources/application.yml:820-838` (the `turn:` block)
- Modify: every `new CompanionProperties.Turn(` call site (grep — fixtures + the ripple test files)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/config/CompanionTurnPropertiesIT.java` (extend)

**Interfaces:**
- Produces: `Turn(boolean pipelineEnabled, Gear gear, Planner planner, Executor executor, Answerer answerer, Replan replan)` — `pipelineEnabled` FIRST, `Replan` LAST; `Answerer(String chatEffort, int outcomeMaxCharsPerResult, int outcomeMaxCharsTotal)`; `record Replan(@Min(0) @Max(2) int maxLaps)`. Accessors Tasks 4–6 read: `turn().pipelineEnabled()`, `turn().answerer().outcomeMaxCharsPerResult()/.outcomeMaxCharsTotal()`, `turn().replan().maxLaps()`.

- [ ] **Step 1: Write the failing test (extend the IT)**

```java
    @Test
    void testTurn_shouldBindPipelineAnswererAndReplanDefaults_whenApplicationYmlIsLoaded() {
        assertThat(properties.turn().pipelineEnabled()).isTrue();
        assertThat(properties.turn().answerer().outcomeMaxCharsPerResult()).isEqualTo(8000);
        assertThat(properties.turn().answerer().outcomeMaxCharsTotal()).isEqualTo(40000);
        assertThat(properties.turn().replan().maxLaps()).isEqualTo(1);
    }
```

- [ ] **Step 2: Run to verify RED** (compile error: no such accessors).

- [ ] **Step 3: Implement**

`Turn` record becomes:

```java
    public record Turn(
        boolean pipelineEnabled,
        @NotNull @Valid Gear gear,
        @NotNull @Valid Planner planner,
        @NotNull @Valid Executor executor,
        @NotNull @Valid Answerer answerer,
        @NotNull @Valid Replan replan
    ) {
        /** Whether an UNSURE turn may spend one cheap call on a classifier, or falls straight to ANALYSIS. */
        public record Gear(boolean classifierEnabled) {}

        /** How many repair laps an unparseable/fully-rejected plan earns before the caller falls back (spec §6.3). */
        public record Planner(@Min(0) @Max(3) int repairAttempts) {}

        /** Parallel fan-out width and the per-step wait before a read is declared timed out (spec §6.4). */
        public record Executor(@Min(1) @Max(16) int parallelism,
                               @Min(100) @Max(60_000) long stepTimeoutMs) {}

        /**
         * The answerer's outcome-digest budgets (spec §6.5) — NOT the advisor's 700/3000: here the
         * digest is the answer's whole basis. chatEffort stays scaffolding (per-gear effort keys
         * deferred until the seam carries a per-call override; third deferral, deliberate).
         */
        public record Answerer(@NotBlank String chatEffort,
                               @Min(500) @Max(60_000) int outcomeMaxCharsPerResult,
                               @Min(2_000) @Max(200_000) int outcomeMaxCharsTotal) {}

        /** Data-gap laps an ANALYSIS answer may request (spec A2). 0 disables replan entirely. */
        public record Replan(@Min(0) @Max(2) int maxLaps) {}
    }
```

yml (`turn:` block): add `pipeline-enabled: true` as the FIRST key with the comment `# Kill switch: false sends every LOOKUP/ANALYSIS turn down the legacy tool-loop unchanged.`; extend `answerer:` with `outcome-max-chars-per-result: 8000` and `outcome-max-chars-total: 40000`; append `replan:` / `max-laps: 1`.

Ripple: update every `new CompanionProperties.Turn(...)` to the 6-component shape:

```java
        new CompanionProperties.Turn(true,
            new CompanionProperties.Turn.Gear(true),
            new CompanionProperties.Turn.Planner(1),
            new CompanionProperties.Turn.Executor(4, 15_000L),
            new CompanionProperties.Turn.Answerer("high", 8000, 40000),
            new CompanionProperties.Turn.Replan(1));
```

- [ ] **Step 4: Verify** — `-Dtest=CompanionTurnPropertiesIT,TurnGearRouterTest,PlanValidatorTest,PlanExecutorTest,TurnPlannerTest -Dmezo.test.use-testcontainers=true` green, then `./mvnw clean test-compile` (zero leftover old-shape constructors).

- [ ] **Step 5: Commit** — `feat(companion): pipeline kill switch + answerer/replan config (mezo-rj214.7)`

---

### Task 3: `FakeCompanionLlm` — fallback default, answerer echo, data-gap scripting

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (`completeSmart` ~:1176-1192, `streamSmart` ~:1200-1211, sentinel constants)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlmPlanTest.java` (the default-branch test)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlmAnswerTest.java` (new)

**Interfaces:**
- Produces (public constants Tasks 5–6 tests assert on):
  - `PLANNER_NO_SCRIPT = "FAKE-PLANNER: nincs szkriptelt terv"` — the planner branch's new default (UNPARSEABLE: no `{`), so `TurnPlanner.plan(...)` returns `Optional.empty()` and the wiring falls back to legacy. `[fake-plan:{…}]` scripting unchanged.
  - `ANSWER_SENTINEL = "FAKE-ANSWER"` — `completeSmart`/`streamSmart` return `ANSWER_SENTINEL + " " + PREFIX + " system=[" + joined + "] history=[…] user=[…]"` when the VOLATILE half contains `"ESZKÖZHÍVÁSOK"` (the digest header prefix — present on every answerer call, never on CHAT-gear calls).
  - `FAKE_DATAGAP` scripting: if the user message contains `[fake-datagap:<reason>]` AND the volatile half contains `"[Adathiány]"` (the DATA-GAP OFFER block Task 4 defines — present only on ANALYSIS lap 1), return exactly `"[TOVÁBBI-ADAT: <reason>]"`. This is the honest simulation: a real model can only use the marker when the offer was made. LOOKUP calls (no offer) and lap-2 calls (offer replaced by `[PÓTLÁS]`) fall through to the ANSWER_SENTINEL echo automatically — no `[PÓTLÁS]` check needed.
  - Failure sentinels (`FAIL_COMPLETE`/`EMPTY_ANSWER`/`FAIL_STREAM`) keep priority over everything.

Dispatch order inside `completeSmart`: failure sentinels → `TurnPlanner.PROMPT_MARKER` branch (scripted plan / `PLANNER_NO_SCRIPT`) → `ESZKÖZHÍVÁSOK` branch (datagap check, then answer echo) → CHAT-gear echo (unchanged). `streamSmart` mirrors: answerer branch returns `Flux.just(completeSmart(...))`.

- [ ] **Step 1: Write the failing tests**

`FakeCompanionLlmAnswerTest`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class FakeCompanionLlmAnswerTest {

    private final FakeCompanionLlm fake = new FakeCompanionLlm();
    private static final String OUTCOMES_CTX = "\n\nMa: 2026-09-17\n\nESZKÖZHÍVÁSOK ÉS A KIMENETÜK:\n- get_pantry {} -> Kamra: nincs adat\n";
    private static final String OUTCOMES_WITH_OFFER = OUTCOMES_CTX + "\n[Adathiány] Ha a fenti eszköz-eredmények nem elegendők…\n";

    @Test
    void testCompleteSmart_shouldEchoWithAnswerSentinel_whenVolatileHalfCarriesOutcomes() {
        String answer = fake.completeSmart("HANG", OUTCOMES_CTX, List.of(), "Mit ettem ma?");

        assertThat(answer).startsWith(FakeCompanionLlm.ANSWER_SENTINEL + " " + FakeCompanionLlm.PREFIX);
        assertThat(answer).contains("ESZKÖZHÍVÁSOK").contains("user=[Mit ettem ma?]");
        assertThat(answer).doesNotContain(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }

    @Test
    void testCompleteSmart_shouldReturnDataGapMarker_whenScriptedAndOfferPresent() {
        String answer = fake.completeSmart("HANG", OUTCOMES_WITH_OFFER, List.of(),
            "Miért fáradt vagyok mostanában? [fake-datagap:alvásnapló]");

        assertThat(answer).isEqualTo("[TOVÁBBI-ADAT: alvásnapló]");
    }

    @Test
    void testCompleteSmart_shouldAnswer_whenScriptedButNoOffer() {
        // LOOKUP lap (never offered) and ANALYSIS lap 2 ([PÓTLÁS] instead of the offer) both
        // look like this: outcomes present, no [Adathiány] block -> the sentinel is inert.
        String answer = fake.completeSmart("HANG", OUTCOMES_CTX + "\n[PÓTLÁS] a kért adatok fent vannak\n",
            List.of(), "Miért fáradt vagyok mostanában? [fake-datagap:alvásnapló]");

        assertThat(answer).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
    }

    @Test
    void testCompleteSmart_shouldKeepChatGearEcho_whenNoOutcomesBlock() {
        String answer = fake.completeSmart("HANG", "\n\nMa: 2026-09-17\n", List.of(), "Szia!");

        assertThat(answer).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }
}
```

Update `FakeCompanionLlmPlanTest`'s default-branch test: the planner prompt without a `[fake-plan:…]` sentinel now returns `FakeCompanionLlm.PLANNER_NO_SCRIPT` (assert equality), with a comment: "unscripted data turns must fall back to the legacy path — a parseable default would silently reroute every existing IT through the pipeline."

- [ ] **Step 2: RED** — `-Dtest=FakeCompanionLlmAnswerTest,FakeCompanionLlmPlanTest` fails (constants missing; old default).

- [ ] **Step 3: Implement** per the interface block above. Keep the file's top-level import style; put the two new constants beside `CHAT_GEAR_SENTINEL`; the datagap pattern:

```java
    /** Scripts a lap-1 data-gap reply from the answerer: [fake-datagap:<reason>] in the user message. */
    private static final Pattern FAKE_DATAGAP = Pattern.compile("\\[fake-datagap:([^\\]]+)]");
```

- [ ] **Step 4: GREEN + no-regression** — `-Dtest=FakeCompanionLlmAnswerTest,FakeCompanionLlmPlanTest,FakeCompanionLlmGearTest,ChatServiceGearIT,ChatStreamServiceGearIT,TurnPipelineIT -Dmezo.test.use-testcontainers=true`. NOTE: `TurnPipelineIT` scripts its plans, so it stays green; the gear ITs' CHAT cases are untouched (no outcomes block on the CHAT branch).

- [ ] **Step 5: Commit** — `test(companion): fake speaks the pipeline — fallback default, answer echo, data-gap scripting (mezo-rj214.7)`

---

### Task 4: `TurnAnswerer`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnAnswerer.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnAnswererTest.java`

**Interfaces:**
- Consumes: `CompanionLlm.completeSmart/streamSmart(system, turnContext, history, user)`; `ToolOutcomeDigest.render(outcomes, perResult, total)` (Task 1); `properties.turn().answerer()/.replan()` (Task 2); `TurnGear`.
- Produces:
  - `public static final String DATA_GAP_MARKER = "[TOVÁBBI-ADAT:"`
  - `String buildVolatile(String turnContext, List<ToolCallAudit.ToolOutcome> outcomes, TurnGear gear, boolean replanStillAllowed)` — turnContext + `"\n\n"` + digest + (ANALYSIS && replanStillAllowed ? the DATA-GAP OFFER block : "") ; lap 2 callers pass `replanStillAllowed=false` AND append the `[PÓTLÁS]` block themselves via `buildReplanVolatile(...)` below.
  - `String buildReplanVolatile(String turnContext, List<ToolCallAudit.ToolOutcome> mergedOutcomes)` — same, no offer, plus `REPLAN_DONE_BLOCK`.
  - `String answer(String systemPrompt, String volatileHalf, List<Turn> history, String userMessage)` — one `completeSmart` call, nothing else (tagging is the caller's job).
  - `Flux<String> answerStream(String systemPrompt, String volatileHalf, List<Turn> history, String userMessage)` — `streamSmart`.
  - `static Optional<String> dataGapReason(String answer)` — non-empty iff the TRIMMED answer STARTS WITH `DATA_GAP_MARKER`; returns the reason up to the closing `]` (missing `]` → everything after the marker, trimmed).

The two prompt blocks (exact strings, Tasks 3/5/6 depend on the bracketed tokens):

```java
    static final String DATA_GAP_OFFER = """


        [Adathiány] Ha a fenti eszköz-eredmények nem elegendők a kérdés megválaszolásához, a teljes \
        válaszod legyen KIZÁRÓLAG egyetlen sor, pontosan ebben a formában: [TOVÁBBI-ADAT: mi hiányzik]. \
        Ha elegendők, válaszolj normálisan, és ezt a jelölőt soha ne írd le.""";

    static final String REPLAN_DONE_BLOCK = """


        [PÓTLÁS] A kért kiegészítő adatok fent vannak az eszköz-eredmények között. Most válaszolj a \
        kérdésre; a [TOVÁBBI-ADAT jelölő többé nem használható.""";
```

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import java.util.List;
import org.junit.jupiter.api.Test;

class TurnAnswererTest {

    private static final List<ToolCallAudit.ToolOutcome> OUTCOMES = List.of(
        new ToolCallAudit.ToolOutcome("get_fuel_log", "{\"range\":\"day\"}", "2026-09-17: 1800 kcal"));

    private final RecordingLlm llm = new RecordingLlm();
    private final TurnAnswerer answerer = new TurnAnswerer(llm,
        CompanionPropertiesFixtures.withExecutor(4, 15_000L));

    /** Records the prompts; answers a constant. */
    private static final class RecordingLlm implements CompanionLlm {
        String lastSystem; String lastVolatile; String lastUser;
        @Override public String completeSmart(String s, String v, List<Turn> h, String u) {
            lastSystem = s; lastVolatile = v; lastUser = u; return "válasz";
        }
        @Override public String complete(String s, List<Turn> h, String u,
                List<org.springframework.ai.tool.ToolCallback> t, java.util.Map<String, Object> c) {
            throw new UnsupportedOperationException();
        }
        @Override public reactor.core.publisher.Flux<String> stream(String s, List<Turn> h, String u,
                List<org.springframework.ai.tool.ToolCallback> t, java.util.Map<String, Object> c) {
            throw new UnsupportedOperationException();
        }
        @Override public String complete(String s, String u, List<InlineImage> i) { throw new UnsupportedOperationException(); }
        @Override public String complete(String s, String u, InlineAudio a) { throw new UnsupportedOperationException(); }
    }

    @Test
    void testBuildVolatile_shouldCarryDigestAndOffer_whenAnalysisWithReplanAllowed() {
        String v = answerer.buildVolatile("\n\nMa: 2026-09-17\n", OUTCOMES, TurnGear.ANALYSIS, true);

        assertThat(v).contains("Ma: 2026-09-17");
        assertThat(v).contains(ToolOutcomeDigest.HEADER).contains("1800 kcal");
        assertThat(v).contains("[Adathiány]").contains(TurnAnswerer.DATA_GAP_MARKER);
    }

    @Test
    void testBuildVolatile_shouldOmitOffer_whenLookupGear() {
        String v = answerer.buildVolatile("ctx", OUTCOMES, TurnGear.LOOKUP, true);

        assertThat(v).doesNotContain("[Adathiány]");
    }

    @Test
    void testBuildVolatile_shouldRenderNoneDigest_whenNoOutcomes() {
        String v = answerer.buildVolatile("ctx", List.of(), TurnGear.LOOKUP, false);

        assertThat(v).contains(ToolOutcomeDigest.NONE);
    }

    @Test
    void testBuildReplanVolatile_shouldCarryPotlasAndNoOffer_whenLapTwo() {
        String v = answerer.buildReplanVolatile("ctx", OUTCOMES);

        assertThat(v).contains("[PÓTLÁS]").doesNotContain("[Adathiány]");
    }

    @Test
    void testDataGapReason_shouldParseMarker_whenAnswerIsMarkerOnly() {
        assertThat(TurnAnswerer.dataGapReason("  [TOVÁBBI-ADAT: alvásnapló kedd óta]  "))
            .contains("alvásnapló kedd óta");
        assertThat(TurnAnswerer.dataGapReason("Rendes válasz [TOVÁBBI-ADAT: x]")).isEmpty();
        assertThat(TurnAnswerer.dataGapReason(null)).isEmpty();
    }

    @Test
    void testAnswer_shouldDelegateToCompleteSmart_whenCalled() {
        String out = answerer.answer("HANG", "VOLATILIS", List.of(), "kérdés");

        assertThat(out).isEqualTo("válasz");
        assertThat(llm.lastSystem).isEqualTo("HANG");
        assertThat(llm.lastVolatile).isEqualTo("VOLATILIS");
    }
}
```

(Extend `CompanionPropertiesFixtures.withExecutor` in Task 2's ripple so the `Answerer`/`Replan` values above are real: 8000/40000/1.)

- [ ] **Step 2: RED** (class missing). **Step 3: Implement** — `@Component`, `@ConditionalOnProperty(COMPANION_SWITCH)`, `@RequiredArgsConstructor(CompanionLlm, CompanionProperties)`; `buildVolatile` = `turnContext + "\n\n" + ToolOutcomeDigest.render(outcomes, answerer().outcomeMaxCharsPerResult(), answerer().outcomeMaxCharsTotal()) + (gear == TurnGear.ANALYSIS && replanStillAllowed ? DATA_GAP_OFFER : "")`; `dataGapReason` per the contract above.

- [ ] **Step 4: GREEN** — `-Dtest=TurnAnswererTest,ArchitectureTest -Dmezo.test.use-testcontainers=true`.

- [ ] **Step 5: Commit** — `feat(companion): turn answerer — outcomes digest + data-gap contract (mezo-rj214.7)`

---

### Task 5: Sync wiring (`ChatService`) + `ChatServicePipelineIT`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` (`sendMessage` :251-323; new private helpers)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatServicePipelineIT.java` (new; NOT `@Transactional`)

**Interfaces:**
- Consumes: `TurnPlanner.plan(history, userMessage, today) → Optional<ValidatedPlan>`; `PlanExecutor.execute(plan, userId, audit)`; `TurnAnswerer` (Task 4); `properties.turn().pipelineEnabled()/replan().maxLaps()`; `chain.reviewChat(...)` (read its exact signature in `CompanionAdvisorChain` before wiring — it is the clinical-only review the CHAT stream branch already uses).
- Produces: private `String pipelineAnswer(UUID userId, UUID conversationId, RoutedContext routed, List<Turn> history, String content, LocalDate today, ToolCallAudit audit)` returning the final answer, or `null` when the planner failed (caller falls back to legacy). Also private `ValidatedPlan capToRemainingBudget(ValidatedPlan plan, ToolCallAudit audit)`. Task 6 reuses BOTH (make them package-private or move to a tiny shared helper if ChatStreamService cannot reach them — ChatStreamService already calls package-private ChatService members via injection; follow how prepareTurn/completeTurn are exposed and do the same).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The LIVE pipeline on the sync path. Deliberately NOT @Transactional: PlanExecutor's pool
 * threads read with their own connections (TurnPipelineIT precedent); cleanup is ResetDatabase.
 */
@ActiveProfiles("companion-fake")
class ChatServicePipelineIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    private static final String PLAN_SLEEP =
        " [fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_recovery\",\"args\":{\"scope\":\"sleep\",\"days\":3},\"why\":\"alvás\"}]}]";

    private MessageResponse send(UUID userId, String content) {
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        return chatService.sendMessage(userId, conversation.getId(),
            SendMessageRequest.builder().content(content).build());
    }

    @Test
    void testSendMessage_shouldAnswerFromExecutedPlan_whenPlanIsScripted() {
        UUID userId = databasePopulator.populateUser("pipe-sync@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.5"), 2);

        MessageResponse answer = send(userId, "Hogy aludtam mostanában?" + PLAN_SLEEP);

        // The answerer echo proves: tool-free smart call whose volatile half carried the digest
        // with the REAL rendered sleep line.
        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
        assertThat(answer.getContent()).contains(ToolOutcomeDigest.HEADER).contains("7,5");
        // The audit choke point still fills the envelopes.
        assertThat(answer.getToolCalls().getCalls()).hasSize(1);
        assertThat(answer.getToolCalls().getCalls().getFirst().getName()).isEqualTo("get_recovery");
    }

    @Test
    void testSendMessage_shouldFallBackToLegacy_whenPlannerIsUnscripted() {
        UUID userId = databasePopulator.populateUser("pipe-fallback@test.local");

        MessageResponse answer = send(userId, "Mennyit aludtam kedden?");

        // Legacy echo shape: no answer sentinel, no digest — the old tool-loop path answered.
        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(answer.getContent()).doesNotContain(FakeCompanionLlm.ANSWER_SENTINEL)
            .doesNotContain("ESZKÖZHÍVÁSOK");
    }

    @Test
    void testSendMessage_shouldAnswerWithoutData_whenPlanSaysNoDataNeeded() {
        UUID userId = databasePopulator.populateUser("pipe-nodata@test.local");

        MessageResponse answer = send(userId,
            "Mit gondolsz az edzésről? [fake-plan:{\"needsData\":false,\"steps\":[]}]"); // gear-audited: data-bearing (edzésről)

        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
        assertThat(answer.getContent()).contains(ToolOutcomeDigest.NONE);
    }

    @Test
    void testSendMessage_shouldRunOneReplanLap_whenAnswererSignalsDataGap() {
        UUID userId = databasePopulator.populateUser("pipe-replan@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("6.0"), 4);

        // ANALYSIS-shaped question; lap 1 scripts a data gap; the replanned planner call gets the
        // SAME scripted plan (the sentinel stays in the user message), lap 2 answers.
        MessageResponse answer = send(userId,
            "Miért alszom rosszul mostanában? [fake-datagap:alvásnapló]" + PLAN_SLEEP);

        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
        assertThat(answer.getContent()).contains("[PÓTLÁS]");
        assertThat(answer.getContent()).doesNotContain(TurnAnswerer.DATA_GAP_MARKER);
        // Two executed steps: lap 1 + the replan lap re-executed the scripted plan.
        assertThat(answer.getToolCalls().getCalls()).hasSize(2);
    }

    @Test
    void testSendMessage_shouldNeverReplan_whenLookupGear() {
        UUID userId = databasePopulator.populateUser("pipe-lookup@test.local");

        // LOOKUP-shaped ("mennyit"): the offer block is absent, so even a scripted datagap
        // sentinel cannot fire (the fake only emits the marker when the offer could exist —
        // but the wiring must ALSO ignore a marker on LOOKUP defensively).
        MessageResponse answer = send(userId, "Mennyit aludtam kedden? [fake-datagap:x]" + PLAN_SLEEP);

        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
        assertThat(answer.getContent()).doesNotContain("[PÓTLÁS]");
    }
}
```

Plus a kill-switch IT in the same file? No — separate tiny class so `@TestPropertySource` scopes cleanly:

```java
@ActiveProfiles("companion-fake")
@org.springframework.test.context.TestPropertySource(properties = "mezo.companion.turn.pipeline-enabled=false")
class ChatServicePipelineSwitchOffIT extends AbstractIntegrationTest {
    // one test: scripted [fake-plan] message still answers via the LEGACY echo (no ANSWER_SENTINEL)
}
```

(Write the body analogous to the fallback test above.)

- [ ] **Step 2: RED** — the pipeline branch does not exist; scripted-plan test falls to legacy echo.

- [ ] **Step 3: Implement.** In `sendMessage`, replace the non-CHAT else-branches (:291-301) with:

```java
        } else {
            String pipelined = properties.turn().pipelineEnabled()
                ? llmCallContextHolder.runWith(turnContext,
                    () -> pipelineAnswer(userId, conversationId, routed, history, request.getContent(), today, audit))
                : null;
            if (pipelined != null) {
                answer = pipelined;
                if (chain != null) {
                    AdvisedAnswer advised = llmCallContextHolder.runWith(turnContext,
                        () -> chain.reviewChat(routed.systemPrompt(), routed.turnContext(), history,
                            request.getContent(), pipelined));
                    answer = advised.answer();
                    degraded = advised.degraded();
                }
            } else if (chain != null) {
                ... existing chain.complete legacy branch, unchanged ...
            } else {
                ... existing companionLlm.complete legacy branch, unchanged ...
            }
        }
```

(ADAPT to the file's real local names/structure — `routed`, `turnCtx`, `history` etc. are whatever `sendMessage` actually has after S9.1–S9.4; the shape above is the contract, the identifiers come from the file. `reviewChat`'s real signature governs — read it first; if it only takes `(answer, turnContext …)` shapes, call it accordingly.)

`pipelineAnswer` (new, next to `routeAndAssemble`):

```java
    /**
     * The live plan→execute→answer path (spec §5). Returns null when the planner produced no
     * usable plan — the caller falls back to the legacy tool-loop (spec §8: degraded, but an
     * answer). One turn = one audit: the plan is capped to the REMAINING budget (companion.md,
     * "Three seams") so the envelopes stay within max-calls-per-turn.
     */
    private String pipelineAnswer(UUID userId, UUID conversationId, RoutedContext routed,
                                  List<Turn> history, String content, LocalDate today,
                                  ToolCallAudit audit) {
        Optional<ValidatedPlan> planned = llmCallContextHolder.runWith(
            new LlmCallContext("companion_chat", "plan", "conversation", conversationId),
            () -> turnPlanner.plan(history, content, today));
        if (planned.isEmpty()) {
            return null;
        }
        ValidatedPlan plan = capToRemainingBudget(planned.get(), audit);
        List<ToolCallAudit.ToolOutcome> outcomes = planExecutor.execute(plan, userId, audit);
        boolean replanAllowed = routed.gear() == TurnGear.ANALYSIS
            && properties.turn().replan().maxLaps() > 0;
        String volatileHalf = turnAnswerer.buildVolatile(routed.turnContext(), outcomes,
            routed.gear(), replanAllowed);
        String answer = llmCallContextHolder.runWith(
            new LlmCallContext("companion_chat", "answer", "conversation", conversationId),
            () -> turnAnswerer.answer(routed.systemPrompt(), volatileHalf, history, content));

        Optional<String> gap = TurnAnswerer.dataGapReason(answer);
        if (gap.isEmpty() || !replanAllowed) {
            // A marker on a gear that never offered it is model noise; the defensive read is to
            // treat it as the answer text minus nothing — never loop.
            return answer;
        }
        String hint = content + "\n\n[KIEGÉSZÍTÉS] Az előző körből hiányzó adat: " + gap.get();
        Optional<ValidatedPlan> replanned = llmCallContextHolder.runWith(
            new LlmCallContext("companion_chat", "plan_replan", "conversation", conversationId),
            () -> turnPlanner.plan(history, hint, today));
        List<ToolCallAudit.ToolOutcome> merged = new ArrayList<>(outcomes);
        if (replanned.isPresent()) {
            ValidatedPlan second = capToRemainingBudget(replanned.get(), audit);
            merged.addAll(planExecutor.execute(second, userId, audit));
        }
        String lapTwoVolatile = turnAnswerer.buildReplanVolatile(routed.turnContext(), merged);
        return llmCallContextHolder.runWith(
            new LlmCallContext("companion_chat", "answer_replan", "conversation", conversationId),
            () -> turnAnswerer.answer(routed.systemPrompt(), lapTwoVolatile, history, content));
    }

    private ValidatedPlan capToRemainingBudget(ValidatedPlan plan, ToolCallAudit audit) {
        int remaining = Math.max(0, properties.tools().maxCallsPerTurn() - audit.callCount());
        if (plan.steps().size() <= remaining) {
            return plan;
        }
        List<String> rejections = new ArrayList<>(plan.rejections());
        plan.steps().stream().skip(remaining)
            .forEach(step -> rejections.add(step.tool() + ": a körre jutó keret betelt"));
        return new ValidatedPlan(List.copyOf(plan.steps().subList(0, remaining)), List.copyOf(rejections));
    }
```

New injected fields: `TurnPlanner turnPlanner`, `PlanExecutor planExecutor`, `TurnAnswerer turnAnswerer` — all `ObjectProvider`-free direct injections are fine (same switch gates them and ChatService). NOTE the LOOKUP defensive rule: `gap` is only honored when `replanAllowed` (the IT pins it).

- [ ] **Step 4: GREEN + regression belt**

```bash
./mvnw clean test -Dtest=ChatServicePipelineIT,ChatServicePipelineSwitchOffIT,ChatServiceIT,ChatServiceGearIT,CompanionAdvisorChainIT,PromptOrderFixtureGearGuardTest,ArchitectureTest -Dmezo.test.use-testcontainers=true
```
ALL green — the legacy suite must not notice the wiring (fallback default). If `ChatServiceIT` breaks, STOP and report: the fallback contract failed, do not patch fixtures.

- [ ] **Step 5: Commit** — `feat(companion): pipeline live on the sync path with legacy fallback + replan (mezo-rj214.7)`

---

### Task 6: Stream wiring (`ChatStreamService`) + `ChatStreamPipelineIT`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java` (`streamMessage` :63-153)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` (only if helper visibility must widen for reuse)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamPipelineIT.java` (new; NOT `@Transactional`; copy `ChatStreamServiceIT`'s `@TestPropertySource(serving-mode=OLD)` trait if its fixtures require it — check)

**Interfaces:**
- Consumes: everything from Task 5 (reuse `pipelineAnswer`-equivalent logic — extract the shared part rather than duplicating: the planner+executor+lap logic must exist ONCE; the stream path differs only in HOW the final text reaches the client).
- Produces: streamed pipeline behavior — LOOKUP: planner+executor run BEFORE the Flux subscribes (tool events buffered by the unicast sink, arriving before the first delta), answer streams natively via `answerStream`, no replan. ANALYSIS: full sync `pipelineAnswer`, final text emitted as ONE delta then done. Planner failure or switch off → legacy stream branch unchanged. Clinical-only `reviewChat` in the trailing Mono for pipeline turns (skip the full `chain.review`).

- [ ] **Step 1: Write the failing IT** — mirror `ChatStreamServiceIT`'s fixture mechanics (`databasePopulator.populateUser`, `conversationPopulator.conversation`, `.collectList().block()` over `ServerSentEvent<Object>`), with these tests:

```java
    @Test // LOOKUP: scripted plan; tool event arrives BEFORE the first delta; done row carries the answer echo
    void testStreamMessage_shouldEmitToolEventsBeforeDeltas_whenPipelineExecutesPreStream() { ... }

    @Test // ANALYSIS + [fake-datagap]: no marker text ever reaches a delta; done row contains [PÓTLÁS]
    void testStreamMessage_shouldResolveReplanServerSide_whenAnalysisSignalsGap() { ... }

    @Test // unscripted: legacy stream shape (tool events only if [fake-tool] scripted; done row has PREFIX echo, no ANSWER_SENTINEL)
    void testStreamMessage_shouldFallBackToLegacyStream_whenPlannerIsUnscripted() { ... }
```

Write the three bodies concretely: for the first, find the index of the first `"tool"` event and the first `"delta"` event and assert `toolIdx < deltaIdx`, plus `((MessageResponse) doneEvent.data()).getContent()` starts with `ANSWER_SENTINEL`; for the second, assert NO delta's text contains `DATA_GAP_MARKER` and the done content contains `"[PÓTLÁS]"`; for the third, done content starts with `FakeCompanionLlm.PREFIX` and lacks `ANSWER_SENTINEL`. Fixture messages: `"Mennyit aludtam mostanában?" + PLAN_SLEEP` (LOOKUP) and `"Miért alszom rosszul mostanában? [fake-datagap:alvásnapló]" + PLAN_SLEEP` (ANALYSIS) — both data-bearing for the gear guard.

- [ ] **Step 2: RED.** **Step 3: Implement.** Shape inside `streamMessage`, replacing the non-CHAT `rawDeltas` assignment:

```java
        // PIPELINE (LOOKUP/ANALYSIS): plan+execute run HERE, before the Flux assembles — the
        // unicast sink buffers the executor's tool events, so the client sees the chips before
        // the first delta (S9.6's phase events will narrate the gap properly).
        PipelineResult pipe = (prepared.gear() != TurnGear.CHAT && properties.turn().pipelineEnabled())
            ? llmCallContextHolder.runWith(streamContext, () -> runPipelinePreStream(prepared, userId))
            : PipelineResult.legacy();
```

where `PipelineResult` is a tiny private record `(Mode mode, String syncAnswer, String volatileHalf)` with `Mode { LEGACY, STREAM_ANSWER, SYNC_ANSWER }`:
- planner empty / switch off → `LEGACY` → existing `companionLlm.stream(...)` branch untouched;
- LOOKUP → executor ran, `STREAM_ANSWER` with the built volatile half → `rawDeltas = turnAnswerer.answerStream(prepared.systemPrompt(), volatileHalf, prepared.history(), prepared.userContent())`;
- ANALYSIS → the full sync lap logic (shared with Task 5 — extract `pipelineAnswer` so both call it; for the stream path pass the prepared fields) → `SYNC_ANSWER` → `rawDeltas = Flux.just(syncAnswer)`.

Trailing Mono: for pipeline modes call `chain.reviewChat(...)` (clinical-only) instead of `chain.review(...)`; LEGACY keeps today's calls exactly. Blank-answer guard, ref merge, `completeTurn`, `done` unchanged for all modes.

- [ ] **Step 4: GREEN + regression belt**

```bash
./mvnw clean test -Dtest=ChatStreamPipelineIT,ChatStreamServiceIT,ChatStreamServiceGearIT,ChatStreamAdvisorIT,CompanionStreamApiIT,PromptOrderFixtureGearGuardTest -Dmezo.test.use-testcontainers=true
```
ALL green with zero edits to the pre-existing four.

- [ ] **Step 5: Commit** — `feat(companion): pipeline live on the streamed path — pre-stream execution, server-side replan (mezo-rj214.7)`

---

### Task 7: Full-package gate, docs, close-out

**Files:**
- Modify: `docs/features/companion.md` (§3 pipeline section: DARK → LIVE, the resolved seam choices, replan contract, kill switch; §4: new keys)
- Modify: `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Full-package gate**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**' -Dmezo.test.use-testcontainers=true
```
GREEN, with ZERO edits to tests that existed before this branch (except `FakeCompanionLlmPlanTest`'s pinned default — the one sanctioned change). Also run `-Dtest=ArchitectureTest` and `-Dtest=CharacterPromptWiringIT` (the out-of-package data-turn IT the recon flagged).

- [ ] **Step 2: Docs** — companion.md §3: the pipeline paragraph flips to LIVE for LOOKUP/ANALYSIS with: fallback rule (planner failure → legacy, `degraded` NOT set — fallback is silent by design, note why: the legacy answer is a full answer, not a degraded one), replan contract (`[TOVÁBBI-ADAT:` marker, ANALYSIS only, max-laps, `[PÓTLÁS]` lap-2 block, streamed ANALYSIS = sync-then-emit until S9.6), budget cap at the call site (seam 1 RESOLVED — update the "Three seams" paragraph accordingly), clinical-only advisor on pipeline answers, `turn.pipeline-enabled` kill switch. §4: the four new keys with defaults. Then `node scripts/gen-codemap.mjs`, `--check` clean, `node scripts/lint-docs.mjs` (companion.md clean; pre-existing stale set is mezo-74iz's).

- [ ] **Step 3: Commit** — `docs(companion): pipeline live — replan contract, kill switch, seam resolutions (mezo-rj214.7)`

*(The controller session handles: bd notes incl. the ToolSelectionEvalIT re-baseline note for mezo-ozri.3, tracker backup, PR/CI/premerge/merge.)*

---

## Done criteria for this plan

1. Full companion package green with zero pre-existing-test edits (one sanctioned fake-default pin change) — the fallback contract holds.
2. `ChatServicePipelineIT`/`ChatStreamPipelineIT` prove: scripted plan → real tools → answerer with the raw digest; fallback on unscripted; no-data plans answer with `NONE`; ANALYSIS replan runs exactly once, marker never reaches the client; LOOKUP never replans; kill switch reverts to legacy.
3. Tool events precede deltas on streamed pipeline turns (the chips cover the pre-answer gap until S9.6).
4. Docs updated (LIVE, seams resolved); CODEMAP regenerated.
5. Branch pushed, self-PR, CI green, premerge re-check, `--no-ff` detached-HEAD merge, CODEMAP checked post-merge.
