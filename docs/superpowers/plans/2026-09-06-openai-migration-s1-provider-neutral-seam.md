# OpenAI migráció S1 — provider-semleges LLM-varrat (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Driving issue:** `mezo-ozri.1` (parent epic `mezo-ozri`)
**Spec:** [`docs/superpowers/specs/2026-09-06-openai-migration-design.md`](../specs/2026-09-06-openai-migration-design.md) — §2 (L1), §5, §6, §8.1/§8.5/§8.7/§8.8
**Date:** 2026-09-06

**Goal:** Behavior-preserving preparation of the LLM seam for a second provider — still on Gemini, no OpenAI dependency added yet — so that S2 can drop an OpenAI starter in without breaking any of the ~178 fake-profile integration contexts.

**Architecture:** Four independent, mechanically small changes to the existing seam.
(1) The `ChatModel` injection point becomes explicitly qualified, so a second autoconfigured `ChatModel` bean can never make the context ambiguous.
(2) The Gemini-typed usage unwrapper gets a port (`LlmUsageExtractor`) and a Google-named implementation, so S2's `OpenAiUsageExtractor` is a sibling rather than a rewrite; the round-usage advisor/tally are renamed to provider-neutral names because both adapters will construct them.
(3) The cost formula learns that "reasoning tokens" are billed differently per model — Gemini reports `thoughts` *alongside* `candidates`, OpenAI includes reasoning *inside* completion — expressed as a per-model config value frozen onto the pricing snapshot.
(4) The two LLM call sites that bypass `LlmCallContextHolder.runWith` get tagged, so the S4 router and the S6 cap can see them.
Plus the L1 decision: `mezo.feature.llm-log.enabled` default flips `false` → `true`.

**Tech Stack:** Java 21, Spring Boot 4.x, Spring AI 2.0.0 (`spring-ai-starter-model-google-genai`), Maven, JUnit 5 + AssertJ, Testcontainers/compose Postgres.

## Global Constraints

- **No behavior change and no new provider dependency in this slice.** `pom.xml` is untouched; the model ids in `application.yml` stay `gemini-2.5-flash` / `gemini-2.5-pro`.
- **The `spring-ai-starter-model-google-genai` starter stays in the build forever** — `GeminiEmbeddingAdapter:55` injects the `com.google.genai.Client` bean it provides (spec §8.2).
- **Prompt text is untouchable.** `FakeCompanionLlm` dispatches on prompt prefixes duplicated verbatim from `CompanionMessageGenerator:75,100,114,139`; any reordering breaks the entire IT surface (spec §8.9).
- **Every tunable value goes to `application.yml` behind a `@ConfigurationProperties` record.** ArchUnit rule `no_spring_value_annotation` bans `@Value` (`ArchitectureTest.java:92`).
- **Pricing map keys are bracket-quoted** in `application.yml` (`"[gemini-2.5-flash]"`) — the binder splits an unbracketed dotted key and the entry silently disappears (`LlmPricingPropertiesBindingTest` guards this).
- **Constructor injection only, `@Transactional` method-level only, AssertJ only, no mocks/`@MockBean` in integration tests** (`docs/references/spring_patterns.md`, `testing_standards.md`).
- **Files added/renamed under `feature/companion/llm` ⇒ regenerate `docs/CODEMAP.md`** in the same change (`node scripts/gen-codemap.mjs`); the focused ITs do NOT run the CODEMAP gate, CI does.
- **Test naming:** `test{Method}_should{Result}_when{Condition}`.
- Local runs are **focused tests only**; the authoritative full-suite gate is the self-PR CI run (`AGENTS.md` §Git Workflow).

## File Structure

**Modified — production:**

| File | Responsibility after this slice |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java` | unchanged behavior; the `ChatModel` ctor param is `@Qualifier("googleGenAiChatModel")`, and it depends on the extractor **port** + the renamed round-usage types |
| `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmPricingService.java` | cost math branches on the snapshot's reasoning-billing semantics |
| `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/config/ModelPrice.java` | + `ReasoningBilling reasoningBilling` (nullable ⇒ `SEPARATE`) |
| `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/entity/PricingSnapshot.java` | + the frozen `reasoningBilling` |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryQueryRewriter.java` | wraps its `complete` in `runWith(companion_recall/query_rewrite)` |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryReranker.java` | wraps its `completeSmart` in `runWith(companion_recall/rerank)` **inside the submitted task** |
| `backend/src/main/resources/application.yml` | `mezo.feature.llm-log.enabled: true`; explicit `reasoning-billing` on the two Gemini generation price rows; stale comments corrected |

**Created — production:**

| File | Responsibility |
|---|---|
| `.../feature/companion/llm/LlmUsageExtractor.java` | the port: `UsageInfo extract(ChatResponse)` + `String finishReason(ChatResponse)`, owner of the `UsageInfo` record |
| `.../feature/llmlog/entity/ReasoningBilling.java` | enum `SEPARATE` / `INCLUDED_IN_OUTPUT` — the billing semantics of a model's reasoning tokens |

**Renamed — production (git mv, content edited):**

| From | To |
|---|---|
| `.../llm/GeminiUsageExtractor.java` | `.../llm/GoogleGenAiUsageExtractor.java` (`implements LlmUsageExtractor`) |
| `.../llm/GeminiRoundUsageAdvisor.java` | `.../llm/LlmRoundUsageAdvisor.java` |
| `.../llm/GeminiRoundUsage.java` | `.../llm/LlmRoundUsage.java` |

**Tests:**

| File | Status |
|---|---|
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/ChatModelQualifierIT.java` | **new** — boots a context with a SECOND `ChatModel` bean; red without the qualifier |
| `.../feature/llmlog/service/LlmPricingServiceTest.java` | + two cases (both reasoning semantics) |
| `.../feature/llmlog/config/LlmPricingPropertiesBindingTest.java` | + asserts the yml `reasoning-billing` binds |
| `.../feature/llmlog/context/LlmCallContextTaggingIT.java` | + the two memory-platform sites |
| `.../feature/companion/CompanionMemoryLlmUsageDisabledIT.java` | + explicit `mezo.feature.llm-log.enabled=false` |
| `.../feature/companion/llm/GeminiUsageExtractorTest.java` (if present), `GeminiCompanionLlmRecordingTest`, `GeminiCompanionLlmPromptOrderTest`, `GeminiEmbeddingAdapterRecordingTest` | rename-follow only |

**Docs:** `docs/features/companion.md` (LLM seam section), `docs/CODEMAP.md` (regenerated).

---

### Task 1: Qualify the Gemini `ChatModel` injection

Spec §8.1. Today `GeminiCompanionLlm:66` takes a bare `ChatModel`. The moment S2 adds `spring-ai-starter-model-openai`, Spring sees two `ChatModel` beans and **every** context that instantiates this adapter dies at boot with `NoUniqueBeanDefinitionException`. The Google autoconfiguration's bean is named `googleGenAiChatModel` (verified: `GoogleGenAiChatAutoConfiguration.googleGenAiChatModel(...)` in `spring-ai-autoconfigure-model-google-genai-2.0.0.jar`).

`GeminiEmbeddingAdapter` needs no change: its field is already named `googleGenAiClient`, which resolves by name.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java:66`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/ChatModelQualifierIT.java` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: the guarantee that a second `ChatModel` bean is harmless. S2 relies on it and will add `@Qualifier("openAiChatModel")` to its own adapter.

- [ ] **Step 1: Write the failing test**

Note why this is an IT and not a unit test: constructor-argument ambiguity only exists inside a Spring context. `AbstractIntegrationTest` does **not** activate `companion-fake`, so a plain `@SpringBootTest` really does build `GeminiCompanionLlm` (with the dummy API key — no network traffic at boot).

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/ChatModelQualifierIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

/**
 * The seam that lets a SECOND provider into the build (mezo-ozri.1, spec §8.1). Spring AI's
 * starters each contribute their own {@code ChatModel} bean; an unqualified injection point makes
 * every context ambiguous the moment the second starter lands — including the ~178 fake-profile
 * ones. This IT plants a second {@code ChatModel} bean NOW, so the qualifier is proven before the
 * OpenAI starter exists, and can never be dropped unnoticed.
 */
@Import(ChatModelQualifierIT.SecondChatModelConfiguration.class)
class ChatModelQualifierIT extends AbstractIntegrationTest {

    @TestConfiguration
    static class SecondChatModelConfiguration {

        /** Stands in for S2's OpenAI ChatModel: never called, only present. */
        @Bean
        ChatModel secondaryChatModel() {
            return (Prompt prompt) -> new ChatResponse(java.util.List.of());
        }
    }

    @Autowired private GeminiCompanionLlm geminiCompanionLlm;

    @Test
    void testContext_shouldWireTheGoogleChatModel_whenASecondChatModelBeanExists() {
        assertThat(geminiCompanionLlm).isNotNull();
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=ChatModelQualifierIT -DfailIfNoTests=false
```

Expected: FAIL at context startup — `NoUniqueBeanDefinitionException: expected single matching bean but found 2: googleGenAiChatModel, secondaryChatModel`. **If it passes instead, stop** — the qualifier already exists or the adapter did not get constructed; investigate before continuing.

- [ ] **Step 3: Add the qualifier**

In `GeminiCompanionLlm.java`, add the import `org.springframework.beans.factory.annotation.Qualifier` and change the constructor's first parameter:

```java
    /**
     * @param chatModel the GOOGLE ChatModel, qualified by bean name on purpose (mezo-ozri.1):
     *                  each Spring AI starter contributes its own {@code ChatModel}, so an
     *                  unqualified injection point turns every context ambiguous as soon as a
     *                  second provider is on the classpath. Guarded by {@code ChatModelQualifierIT}.
     */
    public GeminiCompanionLlm(@Qualifier("googleGenAiChatModel") ChatModel chatModel,
                              CompanionProperties companionProperties,
                              LlmCallRecorder llmCallRecorder, LlmCallContextHolder llmCallContextHolder,
                              GeminiUsageExtractor geminiUsageExtractor) {
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=ChatModelQualifierIT -DfailIfNoTests=false
```

Expected: PASS, 1 test.

- [ ] **Step 5: Prove no other unqualified provider-bean injection is left**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
grep -rn "ChatModel \|ChatClient.Builder\|EmbeddingModel " backend/src/main/java | grep -v "^.*import "
```

Expected: only the now-qualified `GeminiCompanionLlm:66` line. If anything else appears, qualify it the same way and note it in the commit body.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/ChatModelQualifierIT.java
git commit -m "$(cat <<'EOF'
refactor(companion): qualify the Google ChatModel injection point (mezo-ozri.1)

A second Spring AI starter would otherwise make every context ambiguous at
boot. ChatModelQualifierIT plants a second ChatModel bean so the guarantee is
proven before the OpenAI starter lands.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extract the `LlmUsageExtractor` port + provider-neutral round-usage names

Spec §5 (`GeminiUsageExtractor` is "the ONLY Gemini-typed chat file") and §8.4 (the round-usage advisor exists because Spring AI's cumulative usage drops `thoughts`/`cached` in the tool loop — the OpenAI adapter needs the same machinery, so its types must not be Gemini-named).

Pure rename + interface extraction. No behavior change, no new logic.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LlmUsageExtractor.java`
- Rename: `GeminiUsageExtractor.java` → `GoogleGenAiUsageExtractor.java`
- Rename: `GeminiRoundUsageAdvisor.java` → `LlmRoundUsageAdvisor.java`
- Rename: `GeminiRoundUsage.java` → `LlmRoundUsage.java`
- Modify: `GeminiCompanionLlm.java` (field/param types + local variables)
- Modify (follow the renames): `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/*`
- Modify: `docs/CODEMAP.md` (regenerated)

**Interfaces:**
- Consumes: Task 1's qualified adapter.
- Produces — the exact shapes S2's `OpenAiUsageExtractor` implements:
  - `public interface LlmUsageExtractor { UsageInfo extract(ChatResponse response); String finishReason(ChatResponse response); }`
  - `record UsageInfo(String servedModel, String serviceTier, TokenUsage tokens)` — nested in `LlmUsageExtractor`, with `static final UsageInfo NOTHING`.
  - `final class LlmRoundUsageAdvisor implements CallAdvisor, StreamAdvisor` — package-private, constructor `LlmRoundUsageAdvisor(LlmUsageExtractor)`.
  - `LlmRoundUsage` — unchanged API (`CONTEXT_KEY`, `addRound(TokenUsage)`, `hasRounds()`, `rounds()`, `toTokenUsage()`).

- [ ] **Step 1: Create the port**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LlmUsageExtractor.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.llmlog.service.TokenUsage;
import org.springframework.ai.chat.model.ChatResponse;

/**
 * Unwraps ONE provider's response metadata into the audit log's provider-neutral vocabulary
 * (mezo-ozri.1). Spring AI's portable {@code Usage} carries only prompt/completion/total; the
 * reasoning and cached counters live on provider-specific subtypes, and reading them is the ONE
 * place per provider that is allowed to know the provider's types.
 *
 * <p>Contract for every implementation: <b>never invent a number</b>. Anything the provider did not
 * report is {@code null}, never {@code 0} — a zero cost is indistinguishable from a genuinely free
 * call. A null response, null metadata or an all-zero usage block yields {@link UsageInfo#NOTHING}.
 */
public interface LlmUsageExtractor {

    /** What one response revealed about itself; every component is nullable by design. */
    record UsageInfo(String servedModel, String serviceTier, TokenUsage tokens) {

        public static final UsageInfo NOTHING = new UsageInfo(null, null, null);
    }

    /** Null-safe end to end: a null response, metadata or usage block yields nulls, never zeros. */
    UsageInfo extract(ChatResponse response);

    /** The FINAL generation's finish reason; blank and absent both normalise to {@code null}. */
    String finishReason(ChatResponse response);
}
```

- [ ] **Step 2: Rename the Gemini extractor onto the port**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm
git mv GeminiUsageExtractor.java GoogleGenAiUsageExtractor.java
git mv GeminiRoundUsageAdvisor.java LlmRoundUsageAdvisor.java
git mv GeminiRoundUsage.java LlmRoundUsage.java
```

Then edit `GoogleGenAiUsageExtractor.java`:
- class declaration → `public class GoogleGenAiUsageExtractor implements LlmUsageExtractor {`
- **delete** the nested `UsageInfo` record (it now lives on the port) and add `import io.mrkuhne.mezo.feature.companion.llm.LlmUsageExtractor.UsageInfo;` — or simply reference `UsageInfo` directly, since the class implements the interface that nests it.
- add `@Override` to `extract` and `finishReason`.
- keep every existing javadoc paragraph; update the one sentence naming `GeminiRoundUsageAdvisor` to `LlmRoundUsageAdvisor` and the class-name references in `GeminiRoundUsage` → `LlmRoundUsage`.
- keep `@Component`.

In `LlmRoundUsageAdvisor.java` and `LlmRoundUsage.java`: rename the class and every self-reference; change the advisor's field/param type from `GeminiUsageExtractor` to `LlmUsageExtractor`. In the advisor javadoc, replace "the Google-native usage block" with "the provider-native usage block" — the mechanism is provider-neutral. **Do not touch `ORDER = 0`** (spec §8.12 re-verifies its calibration in S2).

- [ ] **Step 3: Point the adapter at the port**

In `GeminiCompanionLlm.java`:
- imports: `GeminiUsageExtractor.UsageInfo` → `LlmUsageExtractor.UsageInfo`.
- field + constructor param: `GeminiUsageExtractor geminiUsageExtractor` → `LlmUsageExtractor llmUsageExtractor` (rename the field and all four usages: the advisor construction, `usageRecord`'s `extract`, and `finishReason`).
- every `GeminiRoundUsage` → `LlmRoundUsage`, `GeminiRoundUsageAdvisor` → `LlmRoundUsageAdvisor`.

Note: with exactly one implementation on the classpath the by-type injection still resolves. S2 will add `@Qualifier` here too when the OpenAI sibling appears — that is S2's job, not this task's.

- [ ] **Step 4: Follow the renames through the tests**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
grep -rln "GeminiUsageExtractor\|GeminiRoundUsage" backend/src/test/java
```

For each hit, rename the type references (and `git mv` the test file if its NAME contains `GeminiUsageExtractor`). Assertions and test bodies stay byte-identical otherwise — this task must not change a single expectation.

- [ ] **Step 5: Compile and run the touched unit tests**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend
./mvnw clean test -Dtest='Gemini*Test,GoogleGenAi*Test' -DfailIfNoTests=false
```

Expected: PASS, same test count as before the rename. Record the count.

- [ ] **Step 6: Regenerate the CODEMAP**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
node scripts/gen-codemap.mjs
git diff --stat docs/CODEMAP.md
```

Expected: `docs/CODEMAP.md` shows the three renamed files and the new port. A non-empty diff here is REQUIRED — the CI codemap gate fails otherwise.

- [ ] **Step 7: Commit**

```bash
git add -A backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm docs/CODEMAP.md
git commit -m "$(cat <<'EOF'
refactor(companion): LlmUsageExtractor port + provider-neutral round usage (mezo-ozri.1)

GeminiUsageExtractor -> GoogleGenAiUsageExtractor implements LlmUsageExtractor;
GeminiRoundUsage(Advisor) -> LlmRoundUsage(Advisor). Pure rename + interface
extraction so S2's OpenAiUsageExtractor is a sibling, not a rewrite.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Provider-aware reasoning-token cost semantics

Spec §8.5 — the live bug. `LlmLogWriter.applyCost` bills `thoughts` at `thinkingPerMillion` **in addition to** `candidates` at `outputPerMillion`. That is correct for Gemini (`thoughtsTokenCount` is reported *next to* `candidatesTokenCount`) and **wrong for OpenAI**, where `reasoning_tokens` is a subset of `completion_tokens` — the same tokens would be billed twice.

The semantics belong to the *model*, not to a hard-coded provider check, so it is a per-model config value, frozen onto the pricing snapshot exactly like the rates (a historical row must keep the semantics it was priced under).

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/entity/ReasoningBilling.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/config/ModelPrice.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/entity/PricingSnapshot.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmPricingService.java`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.llm-log.pricing.models` block, ~line 513)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmPricingServiceTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/config/LlmPricingPropertiesBindingTest.java`

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces — what S2's price rows and S6's cap arithmetic rely on:
  - `public enum ReasoningBilling { SEPARATE, INCLUDED_IN_OUTPUT }` in `io.mrkuhne.mezo.feature.llmlog.entity`.
  - `ModelPrice(BigDecimal inputPerMillion, BigDecimal outputPerMillion, BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion, BigDecimal embedPerMillionChars, ReasoningBilling reasoningBilling)` — the new component is **last**, nullable, `null ⇒ SEPARATE`.
  - `PricingSnapshot(String sourceModel, String currency, BigDecimal inputPerMillion, BigDecimal outputPerMillion, BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion, BigDecimal embedPerMillionChars, ReasoningBilling reasoningBilling, LocalDate pricedOn)` — the new component sits **before** `pricedOn`.
  - `LlmPricingService.computeGenerationCost(PricingSnapshot, Integer prompt, Integer candidates, Integer thoughts, Integer cached)` — signature unchanged; only the arithmetic branches.

- [ ] **Step 1: Write the failing tests**

Append to `LlmPricingServiceTest.java` (and update the existing `service()` helper's two `ModelPrice` literals with a trailing `ReasoningBilling.SEPARATE` / `null` — the compiler will point at them):

```java
    private LlmPricingService openAiStyleService() {
        // Same unit prices as the Gemini row above, so the ONLY difference under test is the
        // reasoning-billing semantics — not the rates.
        Map<String, ModelPrice> models = Map.of(
            "reasoning-included-model", new ModelPrice(
                new BigDecimal("0.30"), new BigDecimal("2.50"),
                new BigDecimal("2.50"), new BigDecimal("0.075"),
                null, ReasoningBilling.INCLUDED_IN_OUTPUT));
        return new LlmPricingService(new LlmPricingProperties("USD", models));
    }

    @Test
    void testComputeGenerationCost_shouldBillThoughtsSeparately_whenProviderReportsThemBesideOutput() {
        // Gemini semantics: thoughtsTokenCount sits NEXT TO candidatesTokenCount, so it is its own
        // billable category. 10_000 in @0.30/M + 1_000 out @2.50/M + 500 thoughts @2.50/M
        PricingSnapshot snap = service().snapshot("gemini-2.5-flash", LocalDate.of(2026, 9, 6));

        assertThat(snap.reasoningBilling()).isEqualTo(ReasoningBilling.SEPARATE);
        assertThat(service().computeGenerationCost(snap, 10_000, 1_000, 500, 0))
            .isEqualByComparingTo("0.00675");
    }

    @Test
    void testComputeGenerationCost_shouldNotBillThoughtsTwice_whenReasoningIsIncludedInOutput() {
        // OpenAI semantics: reasoning_tokens is a SUBSET of completion_tokens, which is what
        // `candidates` already holds — charging the thoughts again would bill the same tokens twice.
        // 10_000 in @0.30/M + 1_000 out @2.50/M + 0 for the 500 reasoning tokens = 0.0055
        PricingSnapshot snap = openAiStyleService().snapshot("reasoning-included-model", LocalDate.of(2026, 9, 6));

        assertThat(snap.reasoningBilling()).isEqualTo(ReasoningBilling.INCLUDED_IN_OUTPUT);
        assertThat(openAiStyleService().computeGenerationCost(snap, 10_000, 1_000, 500, 0))
            .isEqualByComparingTo("0.0055");
    }

    @Test
    void testSnapshot_shouldDefaultToSeparateReasoningBilling_whenTheModelDoesNotDeclareIt() {
        // The Gemini-shaped default: an existing price row without the new key keeps today's math.
        LlmPricingService legacy = new LlmPricingService(new LlmPricingProperties("USD", Map.of(
            "legacy-model", new ModelPrice(new BigDecimal("1.00"), new BigDecimal("2.00"),
                new BigDecimal("2.00"), null, null, null))));

        assertThat(legacy.snapshot("legacy-model", LocalDate.of(2026, 9, 6)).reasoningBilling())
            .isEqualTo(ReasoningBilling.SEPARATE);
    }
```

Add the imports `io.mrkuhne.mezo.feature.llmlog.entity.ReasoningBilling`.

- [ ] **Step 2: Run and watch it fail**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend
./mvnw clean test -Dtest=LlmPricingServiceTest -DfailIfNoTests=false
```

Expected: compilation failure — `ReasoningBilling` does not exist, `ModelPrice` takes 5 arguments.

- [ ] **Step 3: Create the enum**

`backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/entity/ReasoningBilling.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.entity;

/**
 * How ONE model's reasoning ("thinking") tokens relate to its output tokens for billing
 * (mezo-ozri.1, spec §8.5) — a property of the model, not a provider name, so a future model that
 * changes its reporting is a config edit.
 *
 * <p>It is FROZEN onto every {@link PricingSnapshot}: a row priced under one semantics must keep
 * costing what it cost, exactly like the unit rates.
 */
public enum ReasoningBilling {

    /**
     * The provider reports reasoning tokens BESIDE the output tokens (Gemini's
     * {@code thoughtsTokenCount} next to {@code candidatesTokenCount}), so they are their own
     * billable category. The default for every price row that does not say otherwise.
     */
    SEPARATE,

    /**
     * The provider reports reasoning tokens INSIDE the output tokens (OpenAI's
     * {@code reasoning_tokens} ⊂ {@code completion_tokens}). Billing them again would charge the
     * same tokens twice, so the reasoning category contributes nothing — the count is still stored,
     * because it is real and worth reporting on.
     */
    INCLUDED_IN_OUTPUT
}
```

- [ ] **Step 4: Widen `ModelPrice` and `PricingSnapshot`**

`ModelPrice.java` — add the component and one javadoc sentence:

```java
/**
 * ...existing javadoc...
 *
 * <p>{@code reasoningBilling} is the model's reasoning-token semantics (mezo-ozri.1); absent means
 * {@link ReasoningBilling#SEPARATE}, i.e. today's Gemini-shaped math.
 */
public record ModelPrice(BigDecimal inputPerMillion, BigDecimal outputPerMillion,
                         BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion,
                         BigDecimal embedPerMillionChars, ReasoningBilling reasoningBilling) {}
```

`PricingSnapshot.java` — add the component before `pricedOn` (jsonb: an older stored row simply has no such key and deserialises to `null`, which the service reads as `SEPARATE`):

```java
public record PricingSnapshot(String sourceModel, String currency,
                              BigDecimal inputPerMillion, BigDecimal outputPerMillion,
                              BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion,
                              BigDecimal embedPerMillionChars, ReasoningBilling reasoningBilling,
                              LocalDate pricedOn) {}
```

- [ ] **Step 5: Branch the arithmetic**

In `LlmPricingService.java` — the snapshot gains the defaulted value, and the cost skips the reasoning category when it is already inside output:

```java
    public PricingSnapshot snapshot(String servedModel, LocalDate on) {
        ModelPrice p = servedModel == null ? null : pricing.models().get(servedModel);
        if (p == null) {
            return null;
        }
        return new PricingSnapshot(servedModel, pricing.currency(),
            p.inputPerMillion(), p.outputPerMillion(), p.thinkingPerMillion(), p.cachedPerMillion(),
            p.embedPerMillionChars(), reasoningBillingOf(p), on);
    }

    /** Absent ⇒ SEPARATE: every price row written before mezo-ozri.1 was Gemini-shaped. */
    private static ReasoningBilling reasoningBillingOf(ModelPrice price) {
        return price.reasoningBilling() != null ? price.reasoningBilling() : ReasoningBilling.SEPARATE;
    }
```

and, in `computeGenerationCost`, replace the unconditional thinking term:

```java
    /**
     * ...existing javadoc...
     *
     * <p>{@code thoughts} is billed as its OWN category only under
     * {@link ReasoningBilling#SEPARATE} (Gemini reports it beside the output). Under
     * {@link ReasoningBilling#INCLUDED_IN_OUTPUT} the reasoning tokens are already inside
     * {@code candidates}, so charging them again would bill the same tokens twice (spec §8.5).
     */
    public BigDecimal computeGenerationCost(PricingSnapshot s, Integer prompt, Integer candidates,
                                            Integer thoughts, Integer cached) {
        if (s == null) {
            return null;
        }
        Integer billableThoughts = s.reasoningBilling() == ReasoningBilling.INCLUDED_IN_OUTPUT ? null : thoughts;
        return perMillion(s.inputPerMillion(), prompt)
            .add(perMillion(s.outputPerMillion(), candidates))
            .add(perMillion(s.thinkingPerMillion(), billableThoughts))
            .add(perMillion(s.cachedPerMillion(), cached));
    }
```

(`perMillion` already returns `ZERO` for a null count — no new null-handling needed.)

Fix the compilation fallout: every other `new PricingSnapshot(...)` / `new ModelPrice(...)` call site.

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
grep -rn "new PricingSnapshot(\|new ModelPrice(" backend/src
```

- [ ] **Step 6: Run and watch it pass**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend
./mvnw clean test -Dtest=LlmPricingServiceTest -DfailIfNoTests=false
```

Expected: PASS, all cases including the three new ones.

- [ ] **Step 7: Declare the semantics in `application.yml` and assert the binding**

In `backend/src/main/resources/application.yml`, inside `mezo.llm-log.pricing.models`, make the Gemini generation rows explicit (the embedding row has no reasoning tokens, so it stays as is) and add the explaining comment above the map:

```yaml
      # reasoning-billing (mezo-ozri.1): SEPARATE = the provider reports reasoning tokens BESIDE the
      # output tokens (Gemini's thoughtsTokenCount) and they are billed as their own category;
      # INCLUDED_IN_OUTPUT = they are already inside the completion count (OpenAI), so billing them
      # again would charge the same tokens twice. Absent = SEPARATE.
      models:
        "[gemini-2.5-flash]":     { input-per-million: 0.30, output-per-million: 2.50, thinking-per-million: 2.50, cached-per-million: 0.075, reasoning-billing: SEPARATE }
        "[gemini-2.5-pro]":       { input-per-million: 1.25, output-per-million: 10.0, thinking-per-million: 10.0, cached-per-million: 0.31, reasoning-billing: SEPARATE }
        "[gemini-embedding-001]": { embed-per-million-chars: 0.15 }
```

Add to `LlmPricingPropertiesBindingTest.java` (keep the file's existing binder helper and style):

```java
    @Test
    void testBinding_shouldCarryReasoningBilling_whenTheYamlDeclaresIt() {
        LlmPricingProperties pricing =
            applicationYmlBinder().bind("mezo.llm-log.pricing", LlmPricingProperties.class).get();

        assertThat(pricing.models().get("gemini-2.5-flash").reasoningBilling())
            .isEqualTo(ReasoningBilling.SEPARATE);
        assertThat(pricing.models().get("gemini-embedding-001").reasoningBilling()).isNull();
    }
```

- [ ] **Step 8: Run the binding test and the writer IT**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend
./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LlmPricingPropertiesBindingTest,LlmPricingServiceTest,LlmLogWriterIT' -DfailIfNoTests=false
```

Expected: PASS. `LlmLogWriterIT` is the row-mapping guard — it must stay green untouched, proving the Gemini cost is byte-identical to before.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/llmlog backend/src/test/java/io/mrkuhne/mezo/feature/llmlog backend/src/main/resources/application.yml
git commit -m "$(cat <<'EOF'
fix(llmlog): bill reasoning tokens per the model's own semantics (mezo-ozri.1)

Gemini reports thoughts BESIDE candidates; OpenAI reports reasoning INSIDE
completion. The unconditional thinking term would double-bill the latter.
Per-model reasoning-billing, frozen onto the pricing snapshot; absent =
SEPARATE, so every existing row keeps its cost.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Tag the two untagged LLM call sites

Spec §8.8. `LlmMemoryQueryRewriter:28` (`complete`) and `LlmMemoryReranker:83` (`completeSmart` — the **smart tier**) call the port without an ambient `LlmCallContext`, so they book as feature `unknown` and are invisible to the S4 router and the S6 cap.

**The reranker's trap:** `LlmCallContextHolder` is a `ThreadLocal`, and the reranker submits its call to `applicationTaskExecutor`. Wrapping the `submit(...)` call would bind the context on the *caller's* thread, where the LLM call never runs. The `runWith` must be **inside** the submitted lambda.

Feature slug: `companion_recall` (already in use for `recall_embed`), operations `query_rewrite` and `rerank` — so all recall-path cost groups under one feature in the reports.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryQueryRewriter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryReranker.java:83`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmCallContextTaggingIT.java`

**Interfaces:**
- Consumes: `LlmCallContextHolder.runWith(LlmCallContext, Supplier<T>)` (existing).
- Produces: two more `LlmCallContext` feature/operation pairs — `("companion_recall", "query_rewrite")` and `("companion_recall", "rerank")` — that S4's router keys on and S6's cap counts.

- [ ] **Step 1: Write the failing tests**

Append to `LlmCallContextTaggingIT.java` (the class already owns a `@Primary` capturing `CompanionLlm`, so both services hit it). Add the autowires and the two tests:

```java
    @Autowired private io.mrkuhne.mezo.feature.companion.memory.service.MemoryQueryRewriter memoryQueryRewriter;
    @Autowired private io.mrkuhne.mezo.feature.companion.memory.service.LlmMemoryReranker llmMemoryReranker;
```

```java
    @Test
    void testRewrite_shouldTagTheCallWithTheRecallContext_whenTheQueryIsRewritten() {
        capturingCompanionLlm.answerWith("Mennyit aludtam a héten?");

        memoryQueryRewriter.rewrite("és azelőtt?", List.of(
            new CompanionLlm.Turn(CompanionLlm.Role.USER, "Mennyit aludtam tegnap?")));

        LlmCallContext captured = capturingCompanionLlm.captured();
        assertThat(captured).isNotNull().isNotEqualTo(LlmCallContext.UNKNOWN);
        assertThat(captured.feature()).isEqualTo("companion_recall");
        assertThat(captured.operation()).isEqualTo("query_rewrite");
        assertThat(captured.entityKind()).isNull();
        assertThat(captured.entityId()).isNull();
    }
```

For the reranker, the call goes through `applicationTaskExecutor` and returns via a `Future.get(timeout)`, so `rerank(...)` has already joined by the time it returns — no `await()` needed. Build the two-element input it requires (fewer than 2 candidates short-circuits without calling the LLM):

```java
    @Test
    void testRerank_shouldTagTheCallWithTheRecallContext_evenThoughItRunsOnAPooledThread() {
        // The context holder is thread-bound and the reranker submits to applicationTaskExecutor:
        // this asserts the runWith sits INSIDE the submitted task, where the call actually happens.
        FusedCandidate first = fusedCandidate(UUID.randomUUID());
        FusedCandidate second = fusedCandidate(UUID.randomUUID());
        capturingCompanionLlm.answerWith(
            "[\"%s\",\"%s\"]".formatted(second.candidate().stableId(), first.candidate().stableId()));

        llmMemoryReranker.rerank(List.of(first, second));

        LlmCallContext captured = capturingCompanionLlm.captured();
        assertThat(captured).isNotNull().isNotEqualTo(LlmCallContext.UNKNOWN);
        assertThat(captured.feature()).isEqualTo("companion_recall");
        assertThat(captured.operation()).isEqualTo("rerank");
    }
```

**Before writing `fusedCandidate(...)`, read the real shapes** — `MemoryCandidateFusion.FusedCandidate`, `MemoryCandidate` and the score record in `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/` — and build the helper from their actual constructors, or reuse an existing test factory if one exists:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
grep -rn "record FusedCandidate\|record MemoryCandidate" backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory
grep -rln "FusedCandidate" backend/src/test/java
```

If an existing test already builds `FusedCandidate` instances, copy that construction verbatim into a private helper in this IT rather than inventing one.

Note: `capturingCompanionLlm` does not override `completeSmart`, so the interface default routes it to a captured `complete` — the ambient context is still read at the port, which is exactly what is under test.

- [ ] **Step 2: Run and watch both fail**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend
./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=LlmCallContextTaggingIT -DfailIfNoTests=false
```

Expected: both new tests FAIL with the captured context equal to `LlmCallContext.UNKNOWN` (feature `"unknown"`). The two pre-existing tests stay green.

- [ ] **Step 3: Tag the rewriter**

`LlmMemoryQueryRewriter.java` — add the two imports, the holder to the constructor-injected fields (the class is `@RequiredArgsConstructor`, so a `private final` field is enough), and wrap:

```java
    private static final LlmCallContext CALL_CONTEXT =
            new LlmCallContext("companion_recall", "query_rewrite", null, null);

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;

    @Override
    public String rewrite(String currentQuery, List<CompanionLlm.Turn> boundedHistory) {
        return llmCallContextHolder.runWith(CALL_CONTEXT, () -> companionLlm.complete(
                SYSTEM_PROMPT,
                boundedHistory,
                currentQuery,
                List.of(),
                Map.of()));
    }
```

- [ ] **Step 4: Tag the reranker — inside the submitted task**

`LlmMemoryReranker.java` — add the imports, the `private final LlmCallContextHolder llmCallContextHolder;` field, the constant, and change line 83 only:

```java
    private static final LlmCallContext CALL_CONTEXT =
            new LlmCallContext("companion_recall", "rerank", null, null);
```

```java
            // The holder is thread-bound and this runs on applicationTaskExecutor, so the context
            // is bound INSIDE the task — binding it around submit() would tag the caller's thread,
            // not the one that reaches the adapter (mezo-ozri.1).
            call = applicationTaskExecutor.submit(() -> llmCallContextHolder.runWith(
                    CALL_CONTEXT, () -> llm.completeSmart(SYSTEM_PROMPT, render(exposed))));
```

Everything else in the method — the timeout, the cancel, the fail-back to fused order — is untouched.

- [ ] **Step 5: Run and watch them pass**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend
./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=LlmCallContextTaggingIT -DfailIfNoTests=false
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Prove no untagged site is left**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
grep -rn "companionLlm\.\|llm\.complete\|llm\.stream" backend/src/main/java --include=*.java \
  | grep -v "feature/companion/llm/" | grep -v "runWith"
```

Read every remaining hit and confirm its `runWith` is on an enclosing line (the wrapper is often a few lines above). Record the count of tagged sites in the commit body; the spec's baseline is 56, so it should now be 58.

- [ ] **Step 7: File the follow-up that this task deliberately does NOT fix**

Both memory-platform calls also lose the **actor** (`created_by`): `applicationTaskExecutor` propagates neither the `SecurityContext` nor `LlmActorContext`, so `LlmActorResolver.currentActor()` returns null on that thread and these rows book against no user. That is out of S1's scope (the bd issue asks for the call *context*), but S6's per-user cap needs it.

```bash
bd create --title="Actor propagation into the memory-platform executors (llm_log created_by)" \
  --type=bug --priority=2 --parent=mezo-ozri \
  --description="LlmMemoryReranker and MemoryContextService/MemoryShadowRunner submit LLM work to applicationTaskExecutor, which propagates neither SecurityContext nor LlmActorContext. LlmActorResolver therefore resolves null on those threads and the rows book against no user. mezo-ozri.1 tagged the LlmCallContext (feature/operation) on these sites but deliberately left the actor alone. S6's per-user USD cap cannot see this traffic until the actor is propagated (capture it on the submitting thread and re-bind inside the task, or wrap the executor)." \
  --acceptance="A memory rerank triggered by an authenticated request writes an llm_log_history row whose created_by is that user, proven by an IT."
bd dep add mezo-ozri.6 <the-new-id>
```

Record the new id in this plan's execution notes and in the commit body.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmCallContextTaggingIT.java
git commit -m "$(cat <<'EOF'
feat(companion): tag the two untagged memory-platform LLM calls (mezo-ozri.1)

The query rewriter and the smart-tier reranker bypassed runWith, so both
booked as feature "unknown" and were invisible to the router (S4) and the cap
(S6). The reranker's binding sits inside the submitted task — the holder is
thread-bound and the call runs on applicationTaskExecutor.

Follow-up filed for actor propagation on those pooled threads.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Flip `mezo.feature.llm-log.enabled` to `true` (decision L1)

Spec §2 L1 + §8.7. The router and the cap are both built on measurement; with the audit log off they are blind. The adapters have been instrumented for a long time (56 → 58 tagged call sites) and `deployment.yaml:96` turns it on in production anyway, so the shipped default is simply stale.

Exactly one test depends on the *implicit* default: `CompanionMemoryLlmUsageDisabledIT` ("a teszt-default"). The other three references are explicit and unaffected.

**Files:**
- Modify: `backend/src/main/resources/application.yml:327-331`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemoryLlmUsageDisabledIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRecorderWiringIT.java:21` (stale javadoc only)

**Interfaces:**
- Consumes: nothing.
- Produces: the guarantee S6 depends on — a booted context records LLM cost unless someone explicitly turns it off.

- [ ] **Step 1: Make the one implicit-default test explicit (before flipping)**

In `CompanionMemoryLlmUsageDisabledIT.java`, add the import `org.springframework.test.context.TestPropertySource` and the annotation, and correct the class javadoc:

```java
/**
 * llm-log switch OFF ⇒ enabled:false + üres sorok, akkor is, ha a tábla nem üres.
 *
 * <p>A kapcsoló EXPLICIT: a mezo-ozri.1 (L1 döntés) óta a szállított alapértelmezés {@code true},
 * tehát ez a teszt a kikapcsolt állapotot maga állítja be, nem a hallgatólagos defaultra épül.
 */
@TestPropertySource(properties = "mezo.feature.llm-log.enabled=false")
class CompanionMemoryLlmUsageDisabledIT extends ApiIntegrationTest {
```

- [ ] **Step 2: Run it — still green on the OLD default**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend
./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=CompanionMemoryLlmUsageDisabledIT -DfailIfNoTests=false
```

Expected: PASS. This proves the explicit property is correct *before* the default moves under it.

- [ ] **Step 3: Flip the default and correct the stale comment**

`application.yml`, replacing lines 327-331:

```yaml
    # LLM call audit log (bd mezo-2zyu) — ON by default (mezo-ozri.1, spec §2 L1): the model router
    # and the per-user USD cap are both built on this measurement, so with it off they are blind.
    # Off ⇒ the no-op recorder is injected, so nothing is ever published or written — and the cap
    # is off with it. The read API (/api/llm-usage) is deliberately NOT behind this switch.
    llm-log:
      enabled: true
```

- [ ] **Step 4: Correct the other stale javadoc**

`LlmLogRecorderWiringIT.java:21` — replace `{@code mezo.feature.llm-log.enabled=false} (the shipped default)` with `{@code mezo.feature.llm-log.enabled=false} (an explicit opt-out; the shipped default is {@code true} since mezo-ozri.1)`.

- [ ] **Step 5: Run every test that touches the switch**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend
./mvnw clean test -Dmezo.test.use-testcontainers=true \
  -Dtest='LlmLogRecorderWiringIT,LlmLogRetentionJobWriteSwitchOffIT,CompanionMemoryLlmUsageApiIT,CompanionMemoryLlmUsageDisabledIT,MemoryLlmUsageIsolationIT,LlmUsageIT,LlmLogWriterIT' \
  -DfailIfNoTests=false
```

Expected: all PASS.

- [ ] **Step 6: Sanity-check the blast radius on a fake-profile IT**

The `companion-fake` profile's `FakeCompanionLlm` never touches `LlmCallRecorder` (verified: no reference in the file), so flipping the default writes no rows in fake-profile contexts. Confirm it, then run one representative fake-profile IT to be sure nothing else woke up:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
grep -n "LlmCallRecorder" backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java   # expect: no output
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=LlmCallContextTaggingIT -DfailIfNoTests=false
```

Expected: no grep output; the IT PASSES. **The authoritative check is the CI full-suite run on the PR** — if the flip wakes an async writer that races a `ResetDatabase` TRUNCATE anywhere, that is where it surfaces, and the fix is an explicit `=false` on the victim class, not a revert of L1.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/application.yml \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionMemoryLlmUsageDisabledIT.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRecorderWiringIT.java
git commit -m "$(cat <<'EOF'
feat(llmlog): ship the LLM audit log ON by default (mezo-ozri.1, L1)

The router (S4) and the per-user USD cap (S6) are built on this measurement;
off, they are blind. The adapters have been instrumented since mezo-2zyu and
production turns it on anyway. The one test that relied on the implicit
default now sets the property explicitly.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Documentation + slice gate

The docs mandate (`AGENTS.md` §Documentation): a behavior/contract change updates its living feature doc **in the same change**. This slice changed the LLM seam's structure (port + renames), the cost semantics, two call-site attributions and a shipped default.

**Files:**
- Modify: `docs/features/companion.md` (the LLM adapter / audit-log sections and the §10 file map)
- Modify: `docs/CODEMAP.md` (already regenerated in Task 2 — re-run to pick up anything since)
- Modify: `.beads/issues.jsonl` (tracker backup)

- [ ] **Step 1: Read the doc's current LLM sections**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
grep -n "GeminiUsageExtractor\|GeminiRoundUsage\|GeminiCompanionLlm\|llm-log.enabled\|thinking-per-million\|pricing" docs/features/companion.md
```

- [ ] **Step 2: Update only what changed**

Edit in place (no changelog, no dated snapshot — git is the history):
- every `GeminiUsageExtractor` → `GoogleGenAiUsageExtractor` (behind the `LlmUsageExtractor` port), `GeminiRoundUsage*` → `LlmRoundUsage*`;
- a sentence that the `ChatModel` injection is qualified by bean name so a second provider can coexist;
- a sentence on `reasoning-billing` (per-model, frozen onto the pricing snapshot, `SEPARATE` = Gemini's beside-output reporting, `INCLUDED_IN_OUTPUT` = reasoning inside completion);
- the audit-log default is now `true`;
- `companion_recall/query_rewrite` and `companion_recall/rerank` are now tagged features.

Do **not** rewrite the spec (`docs/superpowers/specs/2026-09-06-openai-migration-design.md`) — a spec is a frozen artifact.

- [ ] **Step 3: Run the doc lint and the codemap gate**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs
git status --short docs/
```

Expected: lint clean (no orphan/broken-link/staleness error for `companion.md`); `docs/CODEMAP.md` either already current from Task 2 or updated now.

- [ ] **Step 4: Run the focused suite for everything this slice touched**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89/backend
./mvnw clean test -Dmezo.test.use-testcontainers=true \
  -Dtest='ChatModelQualifierIT,LlmPricingServiceTest,LlmPricingPropertiesBindingTest,LlmLogWriterIT,LlmCallContextTaggingIT,LlmLogRecorderWiringIT,CompanionMemoryLlmUsageDisabledIT,CompanionMemoryLlmUsageApiIT,MemoryLlmUsageIsolationIT,LlmUsageIT,GeminiCompanionLlmRecordingTest,GeminiCompanionLlmPromptOrderTest,GeminiEmbeddingAdapterRecordingTest,ArchitectureTest' \
  -DfailIfNoTests=false
```

Expected: all PASS. `ArchitectureTest` is in the list on purpose — the focused ITs do not otherwise run it, and this slice added a class and an enum (`no_spring_value_annotation`, the frozen `feature_slices_are_cycle_free` rule).

- [ ] **Step 5: Refresh the off-machine tracker backup and commit the docs**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
node scripts/check-beads-backup.mjs --fix
git add docs/features/companion.md docs/CODEMAP.md .beads/issues.jsonl
git commit -m "$(cat <<'EOF'
docs(companion): provider-neutral LLM seam, reasoning-billing, tagged recall calls (mezo-ozri.1)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push, open the self-PR, and wait for CI**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89
git push -u origin feat/openai-migration-s1-provider-neutral-seam
gh pr create --title "feat: provider-neutral LLM seam (mezo-ozri.1)" --body "$(cat <<'EOF'
S1 of the OpenAI migration epic (`mezo-ozri`), per
`docs/superpowers/specs/2026-09-06-openai-migration-design.md`. **No behavior change, still on Gemini,
no new provider dependency** — this is the preparation that makes S2's starter safe to add.

- `@Qualifier("googleGenAiChatModel")` on the `ChatModel` injection point, guarded by a new
  `ChatModelQualifierIT` that plants a second `ChatModel` bean (spec §8.1).
- `LlmUsageExtractor` port + `GoogleGenAiUsageExtractor`; `GeminiRoundUsage(Advisor)` →
  `LlmRoundUsage(Advisor)` (spec §5, §8.4).
- Reasoning tokens are billed by the model's own semantics — `SEPARATE` (Gemini, beside output) vs
  `INCLUDED_IN_OUTPUT` (OpenAI, inside completion) — frozen onto the pricing snapshot (spec §8.5).
- The query rewriter and the smart-tier reranker are now tagged (`companion_recall/query_rewrite`,
  `companion_recall/rerank`); the reranker binds the context INSIDE the submitted task (spec §8.8).
- `mezo.feature.llm-log.enabled` ships `true` (decision L1).

CI is the authoritative full-suite gate; locally only the focused tests above were run.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then: wait for CI green → `gh workflow run premerge.yml -f pr=<number>` → `git pull --rebase` main → `--no-ff` merge → push main → delete the branch. **In this worktree the merge goes through a detached HEAD** (`git checkout main` is blocked by the primary checkout): check out the main commit detached, merge `--no-ff`, then `git push origin HEAD:main`.

- [ ] **Step 7: Close the bd issue**

```bash
bd close mezo-ozri.1 --reason="S1 merged: qualifier, LlmUsageExtractor port, provider-aware reasoning cost, 2 call sites tagged, llm-log default ON"
bd dolt push
```

---

## Self-Review

**Spec coverage.** `mezo-ozri.1`'s four numbered items map to Tasks 1–4; the NOTES block's L1 decision (including the `CompanionMemoryLlmUsageDisabledIT` fix and both stale javadocs) maps to Task 5; spec §5's "round usage advisor: provider-neutral, rename" rides in Task 2; the docs mandate and the CODEMAP/ArchUnit gates are Task 6. Deliberately **not** in this slice, per the spec's slice map: the OpenAI starter, key and pricing rows (S2), the model router (S4), the cap (S6), the ADR 0008/0035 amendments (S2/S6).

**Acceptance criteria (bd).** "Minden meglévő teszt zöld" → Task 6 Step 4 + the CI gate. "A két memory-platform hívás megjelenik a tagolt hívások közt" → Task 4 Steps 5–6. "A cost-képlet provider szerint ágazik el, unit teszttel mindkét szemantikára" → Task 3 Step 1's two paired tests over identical rates.

**Known gap, filed not fixed:** actor (`created_by`) propagation into `applicationTaskExecutor` (Task 4 Step 7) — a genuine prerequisite for S6, out of S1's stated scope.

**One place where the plan says "read first" rather than giving code:** the `FusedCandidate` fixture in Task 4 Step 1. That is deliberate — the record's real constructor was not read while writing this plan, and inventing a signature would be worse than an explicit instruction to copy the existing one.
