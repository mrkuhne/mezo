# OpenAI Migration S2 — OpenAI adapter, key, pricing keys, call-kind routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Driving issue:** `mezo-ozri.2` (epic `mezo-ozri`) · **Spec:** [`2026-09-06-openai-migration-design.md`](../specs/2026-09-06-openai-migration-design.md) · **Depends on:** `mezo-ozri.1` (merged, PR #545)

**Goal:** Put a real OpenAI chat adapter into the build alongside the Gemini one — `gpt-5.6-luna` cheap tier, `gpt-5.6-terra` smart tier, correct token/cost accounting including streamed and multi-round tool calls — while audio and vision keep going to Gemini and the shipped default behaviour stays 100 % Gemini.

**Architecture:** `spring-ai-starter-model-openai` joins `spring-ai-starter-model-google-genai` (the Google starter **stays**: it is what defines the `com.google.genai.Client` bean the `GeminiEmbeddingAdapter` injects — verified in `GoogleGenAiChatAutoConfiguration`). The ~250 lines of recording/usage machinery in `GeminiCompanionLlm` are lifted into a provider-neutral abstract base `SpringAiCompanionLlm`; `GeminiCompanionLlm` and the new `OpenAiCompanionLlm` become thin subclasses that differ only in which `ChatModel`, which `LlmUsageExtractor` and which `ChatOptions` they hand the base. A new `mezo.companion.llm.provider` switch decides which adapter is `@Primary`; the Gemini adapter is **always** a bean, because it is both the fallback and the delegate for the two media call kinds.

**Tech Stack:** Java 21, Spring Boot 4.0.0, Spring AI 2.0.1 (bumped from 2.0.0 in this slice), openai-java-core 4.49.0 (transitive), Maven, JUnit 5 + AssertJ, Testcontainers Postgres.

## Global Constraints

Copied verbatim from the spec / house rules — every task's requirements implicitly include these.

- **The Google starter stays in the build.** `GeminiEmbeddingAdapter:55` injects the `com.google.genai.Client` bean, which is defined by `GoogleGenAiChatAutoConfiguration#googleGenAiClient`. Removing the starter kills embedding too. (spec §8.2)
- **`GEMINI_API_KEY` stays** (embedding, audio, fallback). `OPENAI_API_KEY` is added **beside** it, never instead of it. (spec §8.10)
- **The OpenAI adapter MUST override `completeSmart`.** The `CompanionLlm` interface default falls back to `complete(...)`, so an unoverridden adapter silently routes all 19 smart-tier call sites to the cheap tier. (spec §8.3)
- **Never invent a number.** Anything the provider did not report is `null`, never `0` — a zero cost is indistinguishable from a genuinely free call. (`LlmUsageExtractor` javadoc contract)
- **Pricing keys are bracket-quoted** in `application.yml`: `"[gpt-5.6-luna]"`, `"[gpt-5.6-terra]"` — an unbracketed key is split on the dots by the binder and the entry silently disappears. Guarded by `LlmPricingPropertiesBindingTest`.
- **Every tunable goes to `application.yml` via a `@ConfigurationProperties` record.** `@Value` is forbidden by the ArchUnit rule `no_spring_value_annotation` (`ArchitectureTest.java:93`).
- **Prompt text is load-bearing.** `FakeCompanionLlm` dispatches on prompt prefixes duplicated verbatim from `CompanionMessageGenerator:75,100,114,139`. This slice must not reorder or reword a single prompt. (spec §8.9)
- **Reasoning-token semantics:** OpenAI reports `reasoning_tokens` **inside** `completion_tokens`, so its price rows carry `reasoning-billing: INCLUDED_IN_OUTPUT` (the `ReasoningBilling` enum from S1). Gemini rows stay `SEPARATE`. (spec §8.5)
- **Commit convention:** conventional subject carrying the bd id, e.g. `feat(companion): add the OpenAI chat adapter (mezo-ozri.2)`, and every commit ends with the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.
- **Local test discipline:** run only focused tests locally (the 16 GB machine OOMs on the full IT suite); the self-PR's CI run is the authoritative full-suite gate. Focused ITs **skip ArchUnit and the CODEMAP gate** — this slice adds files under `feature/companion/llm`, so `node scripts/gen-codemap.mjs` must run in the same change.

---

## Design decisions locked before Task 1

These were verified against the actual 2.0.1 / 4.49.0 jars, not from memory. Where a decision differs from the spec, it says so.

**D1 — Per-provider tier blocks + a `provider` switch.** `mezo.companion.llm` gains `provider: gemini|openai`, a `gemini: {chat-model, smart-model}` block and an `openai: {chat-model, smart-model}` block, replacing the two flat `chat-model`/`smart-model` keys.
*Why:* the flat keys mean "the active provider's tiers". Under `provider: openai` the Gemini adapter — which must keep serving audio/vision and remain the fallback — would read `gpt-5.6-luna` as its own model id and fail. Two tiers per provider is the minimum honest shape.
**Divergence from spec §7:** the spec's config *sketch* (explicitly labelled „Vázlat") keeps flat `chat-model`/`smart-model` and makes `per-call-kind` map a `CallKind` to a **model id**. This plan maps `CallKind` → **provider** instead (see D6). Neither change touches a decision-table row (P1/A1/R1 are all satisfied), and S4 owns the final router config surface.

**D2 — Bean selection.** `GeminiCompanionLlm` keeps its current annotations and is **always** a bean under `!companion-fake` + the companion switch. `OpenAiCompanionLlm` carries the same two conditions **plus** `@ConditionalOnProperty("mezo.companion.llm.provider", havingValue = "openai")` and `@Primary`. `@ConditionalOnProperty` is `@Repeatable` in Boot 4.0 (verified in `spring-boot-autoconfigure-4.0.0.jar`), so both conditions sit on the class directly. Default `provider: gemini` ⇒ the OpenAI bean does not exist ⇒ **zero behaviour change on main**, including all ~178 fake-profile ITs.

**D3 — Extract `SpringAiCompanionLlm`.** The recording machinery (`CallSpec`, `recorded`, `usageRecord`, `baseRecord`, `failureRecord`, `successRecord`, `cancelRecord`, `stream`, `request`, `toMessages`, the static helpers) is provider-neutral already. It moves to an abstract base in the same package; the two subclasses supply only the constructor arguments. The alternative — copying ~250 lines into the OpenAI adapter — would duplicate every future audit-log fix.

**D4 — The OpenAI starter contributes ONLY a `ChatModel`.** Its `.imports` registers six autoconfigurations (chat, embedding, image, audio-speech, audio-transcription, moderation), each `@ConditionalOnProperty(..., matchIfMissing = true)`. Left alone, `OpenAiEmbeddingModel` would join the Google `TextEmbeddingModel` as a second `EmbeddingModel` bean. Nothing in this codebase injects `EmbeddingModel` today (verified by grep — `GeminiEmbeddingAdapter` goes through `com.google.genai.Client`), but an unused second bean is a boot-time ambiguity waiting for the first consumer. So `application.yml` pins the five non-chat ones to `none`. **`spring.ai.model.chat` is deliberately NOT set** — both chat autoconfigs are `matchIfMissing = true`, so leaving it unset is what keeps *both* `ChatModel` beans alive.

**D5 — Streaming usage lives in the adapter, not in yml.** The bd note says `spring.ai.openai.chat.stream-usage=true`; **that property does not exist in 2.0.1**. The real one is `spring.ai.openai.chat.stream-options.include-usage`. Rather than depend on option-merge semantics between the ChatClient's default options and the model's, `OpenAiCompanionLlm` builds its own `OpenAiChatOptions` carrying `streamOptions(includeUsage = true)` explicitly. Single source of truth, unit-testable, and it cannot be silently regressed by a yml edit. Without it every streamed row would be written with null tokens and null cost — silently.

**D6 — `per-call-kind: {TRANSCRIBE: gemini, VISION: gemini}`** maps a `CallKind` to an `LlmProvider`. In S2 only `TRANSCRIBE` and `VISION` are honoured, and only by `OpenAiCompanionLlm`, which delegates those two overloads to the injected `GeminiCompanionLlm` bean. Everything else — recording, usage extraction, served-model id — is then already correct, because it is the Gemini adapter's own code path. Rationale (spec §A1): `TranscriptionService:51-53` sends inline audio through the **chat** port, and no GPT-5.6 model has an audio endpoint.

**D7 — `spring-ai` 2.0.0 → 2.0.1** (`pom.xml:32`), per the bd note. Re-verify after the bump: `LlmRoundUsageAdvisor.ORDER = 0` still sits strictly between `ToolCallingAdvisor.DEFAULT_ORDER` and `ChatModelCallAdvisor`, and the existing Gemini streaming tests still pass. The OpenAI stream-path round-counting assumption is **out of scope** here — it is already filed as `mezo-ozri.9`.

## File Structure

| File | Responsibility |
|---|---|
| `backend/pom.xml` | spring-ai 2.0.0 → 2.0.1; add `spring-ai-starter-model-openai` |
| `backend/src/main/resources/application.yml` | `spring.ai.openai.api-key`, the five `spring.ai.model.*: none` pins, the restructured `mezo.companion.llm` block, the two GPT price rows |
| `…/feature/companion/config/LlmProvider.java` | **new** — the `GEMINI` / `OPENAI` enum the config and the router speak |
| `…/feature/companion/config/CompanionProperties.java` | `Llm` record restructured: `provider`, `gemini`, `openai`, `perCallKind` |
| `…/feature/companion/llm/SpringAiCompanionLlm.java` | **new** — provider-neutral base: the ChatClients, `CallSpec`, and every record/stream path |
| `…/feature/companion/llm/GeminiCompanionLlm.java` | shrinks to a constructor + the two Gemini qualifiers |
| `…/feature/companion/llm/OpenAiCompanionLlm.java` | **new** — `@Primary` under `provider: openai`; mandatory `completeSmart`; media overloads delegate to Gemini |
| `…/feature/companion/llm/OpenAiUsageExtractor.java` | **new** — the ONE place that reads OpenAI response metadata |
| `k8s/backend/deployment.yaml`, `secret.example.yaml` | `OPENAI_API_KEY` env + template entry |
| `docs/features/companion.md`, `docs/decisions/0008-*.md`, `docs/CODEMAP.md` | living docs + ADR amendment + regenerated codemap |

---

### Task 1: Spring AI 2.0.1 + the OpenAI starter on the classpath

The riskiest step in the slice and the one with no code in it: two Spring AI starters in one context. It ships alone so that a boot failure here is unambiguous.

**Files:**
- Modify: `backend/pom.xml:32` (version property), `backend/pom.xml:122` (dependency block)
- Modify: `backend/src/main/resources/application.yml:47-54` (the `spring.ai` block)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/ChatModelQualifierIT.java`

**Interfaces:**
- Consumes: nothing.
- Produces: the bean `openAiChatModel` (type `org.springframework.ai.openai.OpenAiChatModel`) and the property `spring.ai.openai.api-key`. Task 5 injects that bean via `@Qualifier("openAiChatModel")`.

- [ ] **Step 1: Rewrite `ChatModelQualifierIT` to assert the REAL second ChatModel**

S1 planted a hand-rolled stand-in bean. Replace it with the genuine one, so the test now proves what it claims. Full new file content:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

/**
 * The seam that lets a SECOND provider into the build (mezo-ozri.1 §8.1, realised in mezo-ozri.2).
 * Spring AI's starters each contribute their own {@code ChatModel}; S2 adds a second
 * {@code LlmUsageExtractor} too. An unqualified injection point makes EVERY context ambiguous —
 * including the ~178 fake-profile ones — so both qualifiers are asserted here against the real
 * beans, not against a stand-in.
 */
class ChatModelQualifierIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private GeminiCompanionLlm geminiCompanionLlm;

    @Test
    void testContext_shouldHoldBothProviderChatModels_whenBothStartersAreOnTheClasspath() {
        assertThat(context.getBeansOfType(ChatModel.class)).hasSizeGreaterThanOrEqualTo(2);
        assertThat(context.getBean("googleGenAiChatModel")).isInstanceOf(GoogleGenAiChatModel.class);
        assertThat(context.getBean("openAiChatModel")).isInstanceOf(OpenAiChatModel.class);
    }

    @Test
    void testContext_shouldHoldBothUsageExtractors_whenBothProvidersAreOnTheClasspath() {
        assertThat(context.getBeansOfType(LlmUsageExtractor.class))
            .containsKeys("googleGenAiUsageExtractor", "openAiUsageExtractor");
    }

    @Test
    void testContext_shouldWireTheGoogleChatModel_whenASecondChatModelBeanExists() {
        assertThat(geminiCompanionLlm).isNotNull();
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw clean test -Dtest=ChatModelQualifierIT -Dmezo.test.use-testcontainers=true
```

Expected: **compile failure** — `package org.springframework.ai.openai does not exist`.

- [ ] **Step 3: Bump the Spring AI version and add the starter**

In `backend/pom.xml`, change line 32:

```xml
		<spring-ai.version>2.0.1</spring-ai.version>
```

and add, immediately after the existing google-genai starter dependency (around line 122–124):

```xml
		<!--
			mezo-ozri.2: the OpenAI chat provider joins google-genai, it does NOT replace it.
			The google starter is what defines the com.google.genai.Client bean that
			GeminiEmbeddingAdapter injects, and Gemini keeps serving audio + vision + fallback.
			Only the chat autoconfiguration of this starter is wanted — the other five are
			pinned off in application.yml (spring.ai.model.*: none).
		-->
		<dependency>
			<groupId>org.springframework.ai</groupId>
			<artifactId>spring-ai-starter-model-openai</artifactId>
		</dependency>
```

- [ ] **Step 4: Add the key and the autoconfiguration pins to `application.yml`**

Replace the `spring.ai` block (currently `application.yml:47-54`) with:

```yaml
  ai:
    model:
      # mezo-ozri.2: the OpenAI starter registers six autoconfigurations, each
      # @ConditionalOnProperty(..., matchIfMissing = true). Only its CHAT model is wanted here;
      # the rest would add a second EmbeddingModel/ImageModel/… bean for no consumer.
      # spring.ai.model.chat is deliberately NOT set: leaving it unset is exactly what keeps
      # BOTH provider chat models alive (google-genai and openai are both matchIfMissing).
      embedding: none
      image: none
      moderation: none
      audio:
        speech: none
        transcription: none
    google:
      genai:
        # Gemini API key (Google AI Studio) — ADR 0008. Real value comes from the environment
        # (local shell / k3s mezo-app secret); the dummy default keeps every context bootable
        # key-less (tests, CI, k3s before rollout) since the starter builds its ChatModel bean
        # regardless of the mezo.feature.companion switch. Real calls fail without a real key.
        # STAYS after the OpenAI migration: embedding, audio-transcribe and the chat fallback
        # all still ride this key (mezo-ozri spec §8.10).
        api-key: ${GEMINI_API_KEY:dummy-key-set-GEMINI_API_KEY}
    openai:
      # OpenAI API key (mezo-ozri.2) — same dummy-default contract as the Gemini one above:
      # the starter builds its ChatModel bean regardless of any mezo switch, so a key-less
      # context (tests, CI, k3s before rollout) must still boot. Real calls fail without a real key.
      api-key: ${OPENAI_API_KEY:dummy-key-set-OPENAI_API_KEY}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd backend && ./mvnw clean test -Dtest=ChatModelQualifierIT -Dmezo.test.use-testcontainers=true
```

Expected: the first and third tests PASS. The second test **still fails** (`openAiUsageExtractor` does not exist yet) — that is Task 2's job. If the first test fails with `NoUniqueBeanDefinitionException` anywhere in the context startup, stop: an unqualified injection point survived S1 and must be found before continuing.

- [ ] **Step 6: Prove the fake-profile contexts still boot**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionApiIT,ChatServiceIT,CompanionRealWiringIT,CompanionPropertiesIT' -Dmezo.test.use-testcontainers=true
```

Expected: all PASS. This is the spec §8.1 canary — two starters must not make the 178 fake-profile contexts ambiguous.

- [ ] **Step 7: Commit**

```bash
git add backend/pom.xml backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/ChatModelQualifierIT.java
git commit -m "$(cat <<'EOF'
build(companion): add the OpenAI starter beside google-genai, spring-ai 2.0.1 (mezo-ozri.2)

The google starter stays: GeminiEmbeddingAdapter injects the com.google.genai.Client
bean it defines. Only the OpenAI chat autoconfiguration is wanted, so the other five
are pinned to none; spring.ai.model.chat is deliberately left unset so both provider
chat models stay alive. ChatModelQualifierIT now asserts the real second bean instead
of a hand-rolled stand-in.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `OpenAiUsageExtractor`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiUsageExtractor.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiUsageExtractorTest.java`

**Interfaces:**
- Consumes: `LlmUsageExtractor` (port, S1), `TokenUsage(Integer prompt, Integer candidates, Integer thoughts, Integer cached, Integer total)`.
- Produces: bean `openAiUsageExtractor` implementing `LlmUsageExtractor`. Task 5 injects it as `@Qualifier("openAiUsageExtractor")`.

**Provider facts verified against `spring-ai-openai-2.0.1.jar` + `openai-java-core-4.49.0.jar`:**
`OpenAiChatModel#getDefaultUsage` builds `new DefaultUsage(promptTokens, completionTokens, totalTokens, usage, cachedTokens, null)` where `usage` is `com.openai.models.completions.CompletionUsage` and `cachedTokens` = `usage.promptTokensDetails().flatMap(PromptTokensDetails::cachedTokens)`. So:
- cached tokens are reachable **portably** via `Usage#getCacheReadInputTokens()` (a `Long`);
- reasoning tokens are only on the native payload: `CompletionUsage#completionTokensDetails()` → `Optional<CompletionTokensDetails>` → `reasoningTokens()` → `Optional<Long>`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiUsageExtractorTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.LlmUsageExtractor.UsageInfo;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatGenerationMetadata;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

/**
 * The OpenAI twin of {@code GoogleGenAiUsageExtractorTest} (mezo-ozri.2). The contract under test
 * is the port's: never invent a number — anything the provider did not report stays null.
 */
class OpenAiUsageExtractorTest {

    private final OpenAiUsageExtractor extractor = new OpenAiUsageExtractor();

    @Test
    void testExtract_shouldReturnNothing_whenResponseIsNull() {
        assertThat(extractor.extract(null)).isEqualTo(UsageInfo.NOTHING);
    }

    @Test
    void testExtract_shouldReportPromptAndCompletionAndCached_whenUsageIsPresent() {
        ChatResponse response = responseWith(new DefaultUsage(1200, 340, 1540, null, 800L, null),
            "gpt-5.6-luna", "STOP");

        UsageInfo info = extractor.extract(response);

        assertThat(info.servedModel()).isEqualTo("gpt-5.6-luna");
        assertThat(info.tokens().prompt()).isEqualTo(1200);
        assertThat(info.tokens().candidates()).isEqualTo(340);
        assertThat(info.tokens().cached()).isEqualTo(800);
        assertThat(info.tokens().total()).isEqualTo(1540);
    }

    @Test
    void testExtract_shouldLeaveReasoningNull_whenNoNativeUsageIsAttached() {
        ChatResponse response = responseWith(new DefaultUsage(10, 5, 15, null, null, null), "gpt-5.6-luna", "STOP");

        assertThat(extractor.extract(response).tokens().thoughts()).isNull();
    }

    @Test
    void testExtract_shouldReturnNothing_whenEveryCounterIsZero() {
        ChatResponse response = responseWith(new DefaultUsage(0, 0, 0, null, null, null), "gpt-5.6-luna", "STOP");

        assertThat(extractor.extract(response).tokens()).isNull();
    }

    @Test
    void testExtract_shouldNormaliseBlankModelToNull_whenProviderReportsNoModel() {
        ChatResponse response = responseWith(new DefaultUsage(10, 5, 15, null, null, null), "", "STOP");

        assertThat(extractor.extract(response).servedModel()).isNull();
    }

    @Test
    void testFinishReason_shouldReturnNull_whenBlank() {
        ChatResponse response = responseWith(new DefaultUsage(10, 5, 15, null, null, null), "gpt-5.6-luna", "  ");

        assertThat(extractor.finishReason(response)).isNull();
    }

    @Test
    void testFinishReason_shouldReturnTheFinalGenerationsReason_whenReported() {
        ChatResponse response = responseWith(new DefaultUsage(10, 5, 15, null, null, null), "gpt-5.6-luna", "TOOL_CALLS");

        assertThat(extractor.finishReason(response)).isEqualTo("TOOL_CALLS");
    }

    private static ChatResponse responseWith(DefaultUsage usage, String model, String finishReason) {
        ChatResponseMetadata metadata = ChatResponseMetadata.builder().model(model).usage(usage).build();
        Generation generation =
            new Generation(new AssistantMessage("ok"), ChatGenerationMetadata.builder().finishReason(finishReason).build());
        return new ChatResponse(List.of(generation), metadata);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest=OpenAiUsageExtractorTest
```

Expected: FAIL — `cannot find symbol: class OpenAiUsageExtractor`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiUsageExtractor.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import com.openai.models.completions.CompletionUsage;
import io.mrkuhne.mezo.feature.llmlog.service.TokenUsage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Component;

/**
 * The ONE place that reads OpenAI's response metadata (mezo-ozri.2) — the twin of
 * {@link GoogleGenAiUsageExtractor}, and the only file besides {@link OpenAiCompanionLlm} that is
 * allowed to know OpenAI types.
 *
 * <p>Where the numbers live (verified against spring-ai-openai 2.0.1 + openai-java-core 4.49.0):
 * {@code OpenAiChatModel#getDefaultUsage} builds a {@code DefaultUsage(prompt, completion, total,
 * nativeUsage, cachedTokens, null)}, so the CACHED count is reachable portably through
 * {@link Usage#getCacheReadInputTokens()}, while the REASONING count only exists on the native
 * {@link CompletionUsage} payload.
 *
 * <p><b>Reasoning is INSIDE the completion count</b> ({@code reasoning_tokens ⊂ completion_tokens}),
 * unlike Gemini's {@code thoughtsTokenCount}, which sits beside {@code candidatesTokenCount}. The
 * count is still reported here because it is real and worth seeing; the double-billing is prevented
 * one level down by the {@code INCLUDED_IN_OUTPUT} reasoning-billing semantics frozen onto each
 * OpenAI price row (spec §8.5).
 *
 * <p><b>Never invents a number.</b> Same rule as the Google extractor: an absent model arrives as
 * {@code ""} and an absent usage block as an all-zero shape, and both become {@code null} rather
 * than a value — a zero cost is indistinguishable from a genuinely free call.
 */
@Component
public class OpenAiUsageExtractor implements LlmUsageExtractor {

    /** Present on some provider responses as a plain metadata key — no typed getter exists for it. */
    private static final String SERVICE_TIER_KEY = "serviceTier";

    /** Null-safe end to end: a null response, metadata or usage block yields nulls, never zeros. */
    @Override
    public UsageInfo extract(ChatResponse response) {
        if (response == null) {
            return UsageInfo.NOTHING;
        }
        ChatResponseMetadata metadata = response.getMetadata();
        if (metadata == null) {
            return UsageInfo.NOTHING;
        }
        return new UsageInfo(blankToNull(metadata.getModel()), serviceTier(metadata), tokens(metadata.getUsage()));
    }

    /** The FINAL generation's finish reason; blank and absent both normalise to null. */
    @Override
    public String finishReason(ChatResponse response) {
        if (response == null || response.getResult() == null || response.getResult().getMetadata() == null) {
            return null;
        }
        return blankToNull(response.getResult().getMetadata().getFinishReason());
    }

    private static TokenUsage tokens(Usage usage) {
        if (usage == null) {
            return null;
        }
        Integer prompt = usage.getPromptTokens();
        Integer completion = usage.getCompletionTokens();
        Integer total = usage.getTotalTokens();
        if (nothingReported(prompt) && nothingReported(completion) && nothingReported(total)) {
            return null;
        }
        return new TokenUsage(prompt, completion, reasoning(usage), toInt(usage.getCacheReadInputTokens()), total);
    }

    /** Only on the native payload — a legitimate 0 (a non-reasoning model) is kept AS 0. */
    private static Integer reasoning(Usage usage) {
        if (!(usage.getNativeUsage() instanceof CompletionUsage nativeUsage)) {
            return null;
        }
        return nativeUsage.completionTokensDetails()
            .flatMap(CompletionUsage.CompletionTokensDetails::reasoningTokens)
            .map(Math::toIntExact)
            .orElse(null);
    }

    private static Integer toInt(Long value) {
        return value == null ? null : Math.toIntExact(value);
    }

    /** Null and 0 are the same statement here: "the provider told us nothing about this counter". */
    private static boolean nothingReported(Integer count) {
        return count == null || count == 0;
    }

    private static String serviceTier(ChatResponseMetadata metadata) {
        Object value = metadata.get(SERVICE_TIER_KEY);
        return value == null ? null : blankToNull(value.toString());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dtest='OpenAiUsageExtractorTest,ChatModelQualifierIT' -Dmezo.test.use-testcontainers=true
```

Expected: both PASS — including `ChatModelQualifierIT`'s second test, which was left red at the end of Task 1.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiUsageExtractor.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiUsageExtractorTest.java
git commit -m "$(cat <<'EOF'
feat(companion): add OpenAiUsageExtractor behind the LlmUsageExtractor port (mezo-ozri.2)

Cached tokens come portably off Usage#getCacheReadInputTokens; reasoning tokens only
exist on the native CompletionUsage payload and are reported, not re-billed — the
INCLUDED_IN_OUTPUT price rows handle that. Same never-invent-a-number contract as the
Google extractor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Per-provider tier config + the GPT-5.6 price rows

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/LlmProvider.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java:42-46`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java:90-100,338-344`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.llm-log.pricing.models` map and the `mezo.companion.llm` block)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java:18-19`, `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/LlmPricingPropertiesBindingTest.java`

**Interfaces:**
- Consumes: `CallKind` (`io.mrkuhne.mezo.feature.llmlog.entity.CallKind`).
- Produces:
  - `enum LlmProvider { GEMINI, OPENAI }`
  - `CompanionProperties.Llm(LlmProvider provider, Tier gemini, Tier openai, Map<CallKind, LlmProvider> perCallKind)` with `record Tier(String chatModel, String smartModel)`.
  - Config keys `mezo.companion.llm.provider`, `.gemini.chat-model`, `.gemini.smart-model`, `.openai.chat-model`, `.openai.smart-model`, `.per-call-kind.<CALL_KIND>`.
  - Price rows `"[gpt-5.6-luna]"` and `"[gpt-5.6-terra]"`.

- [ ] **Step 1: Write the failing property tests**

Replace the two assertions at `CompanionPropertiesIT.java:18-19` with:

```java
        assertThat(properties.llm().provider()).isEqualTo(LlmProvider.GEMINI);
        assertThat(properties.llm().gemini().chatModel()).isEqualTo("gemini-2.5-flash");
        assertThat(properties.llm().gemini().smartModel()).isEqualTo("gemini-2.5-pro");
        assertThat(properties.llm().openai().chatModel()).isEqualTo("gpt-5.6-luna");
        assertThat(properties.llm().openai().smartModel()).isEqualTo("gpt-5.6-terra");
        assertThat(properties.llm().perCallKind())
            .containsEntry(CallKind.TRANSCRIBE, LlmProvider.GEMINI)
            .containsEntry(CallKind.VISION, LlmProvider.GEMINI);
```

Add the imports `io.mrkuhne.mezo.feature.companion.config.LlmProvider` and `io.mrkuhne.mezo.feature.llmlog.entity.CallKind` to that file.

Then add to `LlmPricingPropertiesBindingTest` (the class that guards the bracket-quoting) a case in the same style as the existing Gemini ones:

```java
    @Test
    void testPricing_shouldBindTheGptRowsWithIncludedInOutputReasoning_whenKeysAreBracketQuoted() {
        assertThat(pricing.models()).containsKeys("gpt-5.6-luna", "gpt-5.6-terra");
        assertThat(pricing.models().get("gpt-5.6-luna").inputPerMillion())
            .isEqualByComparingTo(new java.math.BigDecimal("0.20"));
        assertThat(pricing.models().get("gpt-5.6-luna").cachedPerMillion())
            .isEqualByComparingTo(new java.math.BigDecimal("0.02"));
        assertThat(pricing.models().get("gpt-5.6-luna").reasoningBilling())
            .isEqualTo(ReasoningBilling.INCLUDED_IN_OUTPUT);
        assertThat(pricing.models().get("gpt-5.6-terra").outputPerMillion())
            .isEqualByComparingTo(new java.math.BigDecimal("12.0"));
        assertThat(pricing.models().get("gpt-5.6-terra").reasoningBilling())
            .isEqualTo(ReasoningBilling.INCLUDED_IN_OUTPUT);
    }
```

Match that test's existing field name for the bound properties object and its import style — read the file before editing rather than assuming `pricing`.

- [ ] **Step 2: Run them to verify they fail**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionPropertiesIT,LlmPricingPropertiesBindingTest' -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — `cannot find symbol: method provider()` / `gemini()`.

- [ ] **Step 3: Add the `LlmProvider` enum**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/LlmProvider.java`:

```java
package io.mrkuhne.mezo.feature.companion.config;

/**
 * Which LLM vendor serves a chat call (mezo-ozri.2). Two providers run side by side by design
 * (spec §P1): OpenAI for text reasoning and tool use, Google for embedding, audio and the fallback.
 *
 * <p>This is the vocabulary of {@code mezo.companion.llm.provider} (the active chat adapter) and of
 * {@code mezo.companion.llm.per-call-kind} (the per-CallKind exceptions to it — audio and vision,
 * which have no GPT-5.6 route at all).
 */
public enum LlmProvider {

    /** google-genai: chat fallback, the ONLY audio route, and the embedding provider. */
    GEMINI,

    /** openai: the GPT-5.6 chat tiers. */
    OPENAI
}
```

- [ ] **Step 4: Restructure the `Llm` record**

In `CompanionProperties.java`, replace lines 42-46 with:

```java
    /**
     * Provider model tiers (spec §M1) — config, never code; a swap or a rate change is a YAML edit.
     *
     * <p>Tiers are held PER PROVIDER rather than as one flat pair, because both providers are live
     * at once (spec §P1): {@code provider} only decides which adapter answers a chat turn, while
     * the Gemini tiers stay load-bearing for audio, vision and the fallback no matter what it says.
     */
    public record Llm(
        /** Which adapter is the primary CompanionLlm. GEMINI = the shipped default (ADR 0008). */
        @NotNull LlmProvider provider,
        /** google-genai tiers — also what serves every per-call-kind GEMINI exception. */
        @NotNull @Valid Tier gemini,
        /** openai tiers — inert while provider is GEMINI, but always bound so a switch is a YAML edit. */
        @NotNull @Valid Tier openai,
        /**
         * Per-CallKind exceptions to {@code provider} (spec §A1). Only TRANSCRIBE and VISION are
         * honoured today, and only by {@code OpenAiCompanionLlm}, which delegates those two
         * overloads to the Gemini adapter: no GPT-5.6 model has an audio endpoint at all, and
         * {@code TranscriptionService} sends its inline audio through the CHAT port. An absent or
         * unknown key simply means "the active provider" — never a boot failure.
         */
        @NotNull Map<CallKind, LlmProvider> perCallKind
    ) {
        /** One provider's two tiers: the cheap/fast chat model and the smart model. */
        public record Tier(
            @NotBlank String chatModel,   // cheap/fast — every conversational turn
            @NotBlank String smartModel   // smart tier — the 19 completeSmart call sites
        ) {}
    }
```

Add the imports `io.mrkuhne.mezo.feature.llmlog.entity.CallKind` and `java.util.Map` to `CompanionProperties.java`.

- [ ] **Step 5: Point `GeminiCompanionLlm` at its own tier block**

Four call sites. Lines 90-100 become:

```java
        this.chatClient = ChatClient.builder(chatModel)
            .defaultOptions(ChatOptions.builder()
                .model(companionProperties.llm().gemini().chatModel()))
            .defaultAdvisors(roundUsageAdvisor)
            .build();
        // V3.2: the smart tier (llm.gemini.smart-model) — weekly pipelines only, never chat turns
        this.smartChatClient = ChatClient.builder(chatModel)
            .defaultOptions(ChatOptions.builder()
                .model(companionProperties.llm().gemini().smartModel()))
            .defaultAdvisors(roundUsageAdvisor)
            .build();
```

and lines 338-344 become:

```java
    private String chatModel() {
        return companionProperties.llm().gemini().chatModel();
    }

    private String smartModel() {
        return companionProperties.llm().gemini().smartModel();
    }
```

- [ ] **Step 6: Write the YAML**

Replace the `mezo.companion.llm` block with:

```yaml
  companion:
    # Companion LLM providers and model tiers (ADR 0008 + mezo-ozri spec §M1/§A1) — config, never
    # code. Binds onto CompanionProperties.Llm.
    llm:
      # Which adapter answers a chat turn: gemini | openai. GEMINI is the shipped default; the
      # OpenAI adapter bean does not even exist while this says gemini. Flipping it makes
      # OpenAiCompanionLlm the @Primary CompanionLlm — the Gemini adapter stays a bean either way,
      # because it is both the fallback and the only audio route.
      provider: gemini
      gemini:
        chat-model: gemini-2.5-flash   # cheap/fast tier: every conversational turn
        smart-model: gemini-2.5-pro    # smart tier: heavy pipelines (V3.2 critique)
      openai:
        chat-model: gpt-5.6-luna       # cheap/fast tier (spec §4: Terra as default is -19% margin)
        smart-model: gpt-5.6-terra     # smart tier: the 19 completeSmart call sites
      # Per-CallKind exceptions to `provider`. Only honoured while provider is openai, and only for
      # these two kinds: no GPT-5.6 model has an audio endpoint, and the vision A/B has not been
      # measured yet (spec §10.3), so both stay on Gemini. An absent key = the active provider.
      per-call-kind:
        TRANSCRIBE: gemini
        VISION: gemini
```

And extend the `mezo.llm-log.pricing.models` map with the two GPT rows (bracket-quoted, right below the Gemini ones):

```yaml
        # GPT-5.6 (mezo-ozri.2). reasoning-billing INCLUDED_IN_OUTPUT: OpenAI reports
        # reasoning_tokens INSIDE completion_tokens, so there is no separate thinking-per-million —
        # billing one would charge the same tokens twice. WARNING (spec §8.13): these rates are
        # PROMOTIONAL, guaranteed only to 2026-11-21; re-run the cost model then.
        "[gpt-5.6-luna]":         { input-per-million: 0.20, output-per-million: 1.20, cached-per-million: 0.02, reasoning-billing: INCLUDED_IN_OUTPUT }
        "[gpt-5.6-terra]":        { input-per-million: 2.00, output-per-million: 12.0, cached-per-million: 0.20, reasoning-billing: INCLUDED_IN_OUTPUT }
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionPropertiesIT,LlmPricingPropertiesBindingTest,CompanionRealWiringIT,ChatModelQualifierIT' -Dmezo.test.use-testcontainers=true
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/LlmPricingPropertiesBindingTest.java
git commit -m "$(cat <<'EOF'
feat(companion): per-provider LLM tier config + GPT-5.6 price rows (mezo-ozri.2)

mezo.companion.llm gains provider/gemini/openai/per-call-kind. Tiers are per provider
because both run at once: the Gemini pair stays load-bearing for audio, vision and the
fallback regardless of which adapter answers a chat turn. The two GPT price rows carry
reasoning-billing INCLUDED_IN_OUTPUT so reasoning is never billed twice.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Extract the provider-neutral `SpringAiCompanionLlm` base

A pure refactor: **no behaviour change, no new test**. The existing companion suite is the test.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/SpringAiCompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java` (shrinks to ~45 lines)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LlmRoundUsage.java:7` (javadoc `{@link GeminiCompanionLlm}` → `{@link SpringAiCompanionLlm}`)

**Interfaces:**
- Consumes: `CompanionLlm`, `LlmUsageExtractor`, `LlmCallRecorder`, `LlmCallContextHolder`, `LlmRoundUsage`, `LlmRoundUsageAdvisor`.
- Produces, for Task 5:
  - `abstract class SpringAiCompanionLlm implements CompanionLlm`
  - constructor `SpringAiCompanionLlm(ChatModel chatModel, LlmUsageExtractor usageExtractor, ChatOptions chatOptions, ChatOptions smartOptions, LlmCallRecorder llmCallRecorder, LlmCallContextHolder llmCallContextHolder)` — the model ids are read back off the options via `ChatOptions#getModel()`, so they are stated exactly once
  - non-final, overridable: `complete(String, String, List<InlineImage>)`, `complete(String, String, InlineAudio)`, `completeSmart(String, String)`

- [ ] **Step 1: Create the base class**

Create `SpringAiCompanionLlm.java` containing, verbatim from `GeminiCompanionLlm`, everything from `completeSmart` (line 103) down to the `CallSpec` record (line 386) — every method body unchanged — plus this head. Note `completeSmart` is a real override here (constraint: the interface default must never be what an adapter ships).

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.ChatHistory;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.LlmUsageExtractor.UsageInfo;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
// … the remaining imports move over unchanged from GeminiCompanionLlm

/**
 * Everything a Spring AI {@link CompanionLlm} adapter does that is NOT provider-specific
 * (mezo-ozri.2): the two tier-bound {@link ChatClient}s, the tool-loop round tally, and the audit
 * record emitted on every terminal — success, failure, and a mid-stream cancel.
 *
 * <p>A subclass supplies four things and nothing else: the provider's {@code ChatModel}, the
 * provider's {@link LlmUsageExtractor}, and the two tiers' {@link ChatOptions} (whose
 * {@code model} is also the requested-model id recorded on every row). Anything a provider must
 * do differently — OpenAI routing audio and vision back to Gemini, for instance — is an override
 * of the matching {@code complete} overload.
 *
 * <p><b>Audit logging (mezo-2zyu).</b> Every call path here is the LAST place that still sees the
 * provider's raw metadata, so every path reports one {@link LlmCallRecord} — SUCCESS with the token
 * breakdown, or ERROR with the exception's identity, always rethrowing unchanged. The adapter never
 * checks whether logging is on: with the switch off the injected {@link LlmCallRecorder} is the
 * no-op, so the audit trail can never fail (or slow) a user's call.
 */
public abstract class SpringAiCompanionLlm implements CompanionLlm {

    private final ChatClient chatClient;
    private final ChatClient smartChatClient;
    private final String chatModelId;
    private final String smartModelId;
    private final LlmCallRecorder llmCallRecorder;
    private final LlmCallContextHolder llmCallContextHolder;
    private final LlmUsageExtractor llmUsageExtractor;

    protected SpringAiCompanionLlm(ChatModel chatModel, LlmUsageExtractor llmUsageExtractor,
                                   ChatOptions chatOptions, ChatOptions smartOptions,
                                   LlmCallRecorder llmCallRecorder,
                                   LlmCallContextHolder llmCallContextHolder) {
        this.llmCallRecorder = llmCallRecorder;
        this.llmCallContextHolder = llmCallContextHolder;
        this.llmUsageExtractor = llmUsageExtractor;
        this.chatModelId = chatOptions.getModel();
        this.smartModelId = smartOptions.getModel();
        // mezo-58ig: the per-round usage observer — stateless, so one instance serves both clients;
        // the per-call state is the LlmRoundUsage tally each call plants in the request context.
        LlmRoundUsageAdvisor roundUsageAdvisor = new LlmRoundUsageAdvisor(llmUsageExtractor);
        this.chatClient = ChatClient.builder(chatModel)
            .defaultOptions(chatOptions)
            .defaultAdvisors(roundUsageAdvisor)
            .build();
        // V3.2: the smart tier — weekly pipelines only, never chat turns
        this.smartChatClient = ChatClient.builder(chatModel)
            .defaultOptions(smartOptions)
            .defaultAdvisors(roundUsageAdvisor)
            .build();
    }

    // … completeSmart / complete×3 / stream / recorded / successRecord / cancelRecord /
    // … usageRecord / failureRecord / baseRecord / request / toMessages / errorCodeOf /
    // … textOf / elapsedMillis / totalBytes / firstMimeType / record CallSpec
    // … all moved here verbatim, with these two replacements:

    private String chatModel() {
        return chatModelId;
    }

    private String smartModel() {
        return smartModelId;
    }
}
```

Mechanical notes while moving: `chatClient` and `smartChatClient` are used by `completeSmart`, both media overloads, `stream` and `request` — all of which move with them. The `CompanionProperties` field does **not** move (the base has no opinion about config). `recorded`, `usageRecord`, `baseRecord`, `successRecord`, `cancelRecord`, `failureRecord` and `request` must become `private` on the base — no subclass calls them.

- [ ] **Step 2: Shrink `GeminiCompanionLlm` to the subclass**

Replace the whole file with:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;

/**
 * The Gemini {@link CompanionLlm} adapter over the autoconfigured google-genai {@link ChatModel}
 * (ADR 0008). Absent under the {@code companion-fake} profile so integration tests never construct
 * a network-bound client path.
 *
 * <p><b>Always a bean, even when OpenAI is the primary adapter (mezo-ozri.2).</b> It is the chat
 * fallback, and — via {@code mezo.companion.llm.per-call-kind} — the ONLY route for audio and the
 * current route for vision, which {@code OpenAiCompanionLlm} delegates straight to this bean. Its
 * tiers therefore come from the {@code gemini} block, never from "the active provider".
 */
@Component
@Profile("!companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class GeminiCompanionLlm extends SpringAiCompanionLlm {

    /**
     * @param chatModel the GOOGLE ChatModel, qualified by bean name on purpose (mezo-ozri.1):
     *                  each Spring AI starter contributes its own {@code ChatModel}, so an
     *                  unqualified injection point turns every context ambiguous — and since
     *                  mezo-ozri.2 the OpenAI starter really is on the classpath. Guarded by
     *                  {@code ChatModelQualifierIT}.
     * @param llmUsageExtractor the GOOGLE usage extractor, qualified for the same reason: since
     *                  mezo-ozri.2 {@code OpenAiUsageExtractor} is the second implementation of
     *                  the port. Guarded by the same {@code ChatModelQualifierIT}.
     */
    public GeminiCompanionLlm(@Qualifier("googleGenAiChatModel") ChatModel chatModel,
                              CompanionProperties companionProperties,
                              LlmCallRecorder llmCallRecorder, LlmCallContextHolder llmCallContextHolder,
                              @Qualifier("googleGenAiUsageExtractor") LlmUsageExtractor llmUsageExtractor) {
        super(chatModel, llmUsageExtractor,
            ChatOptions.builder().model(companionProperties.llm().gemini().chatModel()).build(),
            ChatOptions.builder().model(companionProperties.llm().gemini().smartModel()).build(),
            llmCallRecorder, llmCallContextHolder);
    }
}
```

- [ ] **Step 3: Fix the one stale javadoc link**

In `LlmRoundUsage.java:7`, change `{@link GeminiCompanionLlm} call` to `{@link SpringAiCompanionLlm} call`.

- [ ] **Step 4: Run the companion suite to prove nothing changed**

```bash
cd backend && ./mvnw clean test -Dtest='ChatServiceIT,ChatStreamServiceIT,CompanionApiIT,CompanionStreamApiIT,CompanionRealWiringIT,ChatModelQualifierIT,CompanionTranscribeApiIT,CompanionMemoryLlmUsageApiIT' -Dmezo.test.use-testcontainers=true
```

Expected: all PASS. A refactor that changes a single assertion is not a refactor — investigate rather than adjusting the test.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm
git commit -m "$(cat <<'EOF'
refactor(companion): extract the provider-neutral SpringAiCompanionLlm base (mezo-ozri.2)

The ChatClients, the round tally and every audit-record path were never Gemini-specific.
GeminiCompanionLlm keeps only its two qualifiers and its tier block; the OpenAI adapter
lands on the same base next, so future audit-log fixes are made once, not twice.
No behaviour change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `OpenAiCompanionLlm`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiCompanionLlmOptionsTest.java` (unit)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiProviderWiringIT.java` (integration)

**Interfaces:**
- Consumes: `SpringAiCompanionLlm` (Task 4), `OpenAiUsageExtractor` bean (Task 2), `CompanionProperties.Llm` (Task 3), the `openAiChatModel` bean (Task 1), `GeminiCompanionLlm`.
- Produces: `@Primary CompanionLlm` when `mezo.companion.llm.provider=openai`; the package-private static factory `static OpenAiChatOptions options(String model)` that the unit test drives.

- [ ] **Step 1: Write the failing tests**

Create `OpenAiCompanionLlmOptionsTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.ai.openai.OpenAiChatOptions;

/**
 * mezo-ozri.2, spec §8.6: without stream-usage every streamed row is written with NULL tokens and
 * NULL cost — silently. The 2.0.1 property is spring.ai.openai.chat.stream-options.include-usage,
 * not the "stream-usage" the bd note names; rather than depend on that (or on option-merge order),
 * the adapter states it in its OWN default options, and this test is what keeps it stated.
 */
class OpenAiCompanionLlmOptionsTest {

    @Test
    void testOptions_shouldRequestStreamingUsage_always() {
        OpenAiChatOptions options = OpenAiCompanionLlm.options("gpt-5.6-luna");

        assertThat(options.getStreamOptions()).isNotNull();
        assertThat(options.getStreamOptions().includeUsage()).isTrue();
    }

    @Test
    void testOptions_shouldCarryTheRequestedModel_soTheAuditRowNamesIt() {
        assertThat(OpenAiCompanionLlm.options("gpt-5.6-terra").getModel()).isEqualTo("gpt-5.6-terra");
    }
}
```

Create `OpenAiProviderWiringIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * The provider switch, proven end to end (mezo-ozri.2). No network is touched: the context is only
 * built, never called. The dummy OPENAI_API_KEY default is what makes that possible.
 */
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.companion.llm.provider=openai"
})
class OpenAiProviderWiringIT extends AbstractIntegrationTest {

    @Autowired private CompanionLlm companionLlm;
    @Autowired private GeminiCompanionLlm geminiCompanionLlm;

    @Test
    void testWiring_shouldPickTheOpenAiAdapter_whenProviderIsOpenai() {
        assertThat(companionLlm).isInstanceOf(OpenAiCompanionLlm.class);
    }

    @Test
    void testWiring_shouldKeepTheGeminiAdapter_whenProviderIsOpenai() {
        // The fallback AND the only audio route — it must survive the switch, not be replaced by it.
        assertThat(geminiCompanionLlm).isNotNull();
    }

    /**
     * Spec §8.3: the CompanionLlm interface DEFAULTS completeSmart to the cheap tier, so an adapter
     * that forgets to override it sends all 19 smart-tier call sites to the wrong model with no
     * error anywhere. Asserted structurally because the failure mode is silence.
     */
    @Test
    void testAdapter_shouldOverrideCompleteSmart_soTheSmartTierIsNotSilentlyLost() throws Exception {
        Method declared = OpenAiCompanionLlm.class.getMethod("completeSmart", String.class, String.class);

        assertThat(declared.getDeclaringClass()).isNotEqualTo(CompanionLlm.class);
    }
}
```

Note: `completeSmart` is declared on `SpringAiCompanionLlm` (Task 4), so `getDeclaringClass()` returns that base — the assertion is that it is **not** the interface, which is exactly the bug being guarded.

- [ ] **Step 2: Run them to verify they fail**

```bash
cd backend && ./mvnw clean test -Dtest='OpenAiCompanionLlmOptionsTest,OpenAiProviderWiringIT' -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — `cannot find symbol: class OpenAiCompanionLlm`.

- [ ] **Step 3: Write the adapter**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiCompanionLlm.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Map;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * The OpenAI {@link CompanionLlm} adapter (mezo-ozri.2, spec §M1): {@code gpt-5.6-luna} on the
 * cheap tier, {@code gpt-5.6-terra} on the smart one. Exists only while
 * {@code mezo.companion.llm.provider} says {@code openai}, and is then {@link Primary} — the Gemini
 * adapter stays a bean beside it as the fallback and the media route.
 *
 * <p><b>Audio and vision are NOT served here (spec §A1).</b> No GPT-5.6 model has an audio endpoint
 * at all, and {@code TranscriptionService:51-53} sends its inline audio through the CHAT port, so
 * feature-level routing could never catch it; the vision A/B is unmeasured (spec §10.3). Both
 * overloads therefore consult {@code mezo.companion.llm.per-call-kind} and hand the call to the
 * Gemini adapter, whose own recording and usage-extraction paths are then already correct.
 *
 * <p><b>{@code completeSmart} is inherited from {@link SpringAiCompanionLlm}, not from the port
 * (spec §8.3).</b> The {@code CompanionLlm} interface default routes it to the cheap tier, so an
 * adapter that leaves it alone sends all 19 smart-tier call sites to the wrong model in silence.
 * {@code OpenAiProviderWiringIT} asserts the override structurally.
 */
@Component
@Primary
@Profile("!companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@ConditionalOnProperty(name = "mezo.companion.llm.provider", havingValue = "openai")
public class OpenAiCompanionLlm extends SpringAiCompanionLlm {

    private final GeminiCompanionLlm geminiCompanionLlm;
    private final Map<CallKind, LlmProvider> perCallKind;

    /**
     * @param chatModel the OPENAI ChatModel, qualified by bean name (mezo-ozri.1): google-genai
     *                  contributes {@code googleGenAiChatModel} in the same context.
     * @param llmUsageExtractor the OPENAI usage extractor, qualified for the same reason.
     * @param geminiCompanionLlm the media delegate — see the class javadoc. Injected by concrete
     *                  type on purpose: {@code CompanionLlm} would resolve to {@code this}.
     */
    public OpenAiCompanionLlm(@Qualifier("openAiChatModel") ChatModel chatModel,
                              CompanionProperties companionProperties,
                              LlmCallRecorder llmCallRecorder, LlmCallContextHolder llmCallContextHolder,
                              @Qualifier("openAiUsageExtractor") LlmUsageExtractor llmUsageExtractor,
                              GeminiCompanionLlm geminiCompanionLlm) {
        super(chatModel, llmUsageExtractor,
            options(companionProperties.llm().openai().chatModel()),
            options(companionProperties.llm().openai().smartModel()),
            llmCallRecorder, llmCallContextHolder);
        this.geminiCompanionLlm = geminiCompanionLlm;
        this.perCallKind = companionProperties.llm().perCallKind();
    }

    /**
     * One tier's default options. {@code streamOptions.includeUsage} is a CORRECTNESS invariant,
     * not a tunable (spec §8.6): without it OpenAI sends no usage block on a streamed response and
     * every streamed row is persisted with null tokens and null cost — silently. It is stated here
     * rather than in {@code spring.ai.openai.chat.stream-options.include-usage} so that it cannot
     * depend on option-merge order or be lost to a YAML edit; {@code OpenAiCompanionLlmOptionsTest}
     * keeps it stated.
     */
    static OpenAiChatOptions options(String model) {
        return OpenAiChatOptions.builder()
            .model(model)
            .streamOptions(OpenAiChatOptions.StreamOptions.builder().includeUsage(true).build())
            .build();
    }

    /** Vision rides Gemini until the A/B decides otherwise (spec §10.3). */
    @Override
    public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
        return routedToGemini(CallKind.VISION)
            ? geminiCompanionLlm.complete(systemPrompt, userMessage, images)
            : super.complete(systemPrompt, userMessage, images);
    }

    /** Audio rides Gemini because GPT-5.6 has no audio endpoint at all (spec §A1). */
    @Override
    public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
        return routedToGemini(CallKind.TRANSCRIBE)
            ? geminiCompanionLlm.complete(systemPrompt, userMessage, audio)
            : super.complete(systemPrompt, userMessage, audio);
    }

    /** An absent or unknown key means "the active provider" — config can never fail a call here. */
    private boolean routedToGemini(CallKind kind) {
        return perCallKind.get(kind) == LlmProvider.GEMINI;
    }
}
```

If `OpenAiChatOptions.StreamOptions` has no `builder()` in 2.0.1, use its canonical record constructor instead — it is `StreamOptions(Boolean includeObfuscation, Boolean includeUsage, Map<String, Object> additionalProperties)`, so `new OpenAiChatOptions.StreamOptions(null, true, Map.of())`. Verify with the compiler; do not guess in the committed code.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dtest='OpenAiCompanionLlmOptionsTest,OpenAiProviderWiringIT,CompanionRealWiringIT,ChatModelQualifierIT' -Dmezo.test.use-testcontainers=true
```

Expected: all PASS. `CompanionRealWiringIT` must still see `GeminiCompanionLlm` as the primary — it does not set the provider property, so the default `gemini` applies.

- [ ] **Step 5: Run the wider companion suite**

```bash
cd backend && ./mvnw clean test -Dtest='ChatServiceIT,ChatStreamServiceIT,CompanionApiIT,CompanionStreamApiIT,CompanionTranscribeApiIT,CompanionMemoryLlmUsageApiIT,CompanionMemoryLlmUsageDisabledIT,MemoryLlmUsageIsolationIT' -Dmezo.test.use-testcontainers=true
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiCompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiCompanionLlmOptionsTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiProviderWiringIT.java
git commit -m "$(cat <<'EOF'
feat(companion): add the OpenAI chat adapter behind mezo.companion.llm.provider (mezo-ozri.2)

@Primary only while provider=openai, so main's behaviour is unchanged. completeSmart is
a real override (the interface default would send all 19 smart-tier call sites to the
cheap tier in silence). Audio and vision delegate to the Gemini adapter per
per-call-kind: GPT-5.6 has no audio endpoint and the vision A/B is unmeasured.
streamOptions.includeUsage lives in the adapter, not in yml — without it every streamed
row would be written with null tokens and null cost.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `OPENAI_API_KEY` on the deployment surfaces

`application.yml` already got the key in Task 1. This task covers the three delivery surfaces. **The SealedSecret re-seal is not something this task can do** — it needs the cluster's sealing certificate; it is handed to the operator, explicitly.

**Files:**
- Modify: `k8s/backend/deployment.yaml:80-84` (the env block)
- Modify: `k8s/backend/secret.example.yaml:17`
- Modify: `docs/infrastructure/deployment-k3s-argocd.md:111` (the secrets row)

**Interfaces:**
- Consumes: `spring.ai.openai.api-key: ${OPENAI_API_KEY:…}` (Task 1).
- Produces: the `OPENAI_API_KEY` key on the `mezo-app` Secret.

- [ ] **Step 1: Add the env var to the Deployment**

In `k8s/backend/deployment.yaml`, directly after the existing `GEMINI_API_KEY` entry (lines 80-84), add — matching that entry's indentation and `secretKeyRef` shape exactly:

```yaml
            # mezo-ozri.2: the OpenAI chat provider. Rides the SAME mezo-app secret as
            # GEMINI_API_KEY, which STAYS — embedding, audio-transcribe and the chat fallback
            # are all still Gemini. optional: true so the pod keeps booting on the dummy
            # application.yml default until the key is actually sealed in.
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: mezo-app
                  key: OPENAI_API_KEY
                  optional: true
```

- [ ] **Step 2: Add the template entry**

In `k8s/backend/secret.example.yaml`, below line 17:

```yaml
  OPENAI_API_KEY: "CHANGE_ME"                # mezo-ozri companion chat (GPT-5.6); Gemini key stays
```

- [ ] **Step 3: Record the operator step in the infra doc**

In `docs/infrastructure/deployment-k3s-argocd.md`, extend the Secrets row (line 111) with a sentence in the surrounding style:

> **`OPENAI_API_KEY` joins `mezo-app` (`mezo-ozri.2`).** `GEMINI_API_KEY` is **not** replaced — embedding, audio transcription and the chat fallback still ride it. Re-sealing is **all-or-nothing and cluster-specific**: re-run `kubeseal` over the full `mezo-app` Secret (never hand-edit `sealedsecret.yaml`) and commit the result. Until that lands the backend boots on the dummy `application.yml` default and `mezo.companion.llm.provider` must stay `gemini`, because a real OpenAI call would fail on the dummy key.

- [ ] **Step 4: Verify the manifest still parses**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89 && node -e "const y=require('js-yaml');const fs=require('fs');for(const f of ['k8s/backend/deployment.yaml','k8s/backend/secret.example.yaml']){y.loadAll(fs.readFileSync(f,'utf8'));console.log('ok',f)}" 2>/dev/null || python3 -c "
import yaml,sys
for f in ['k8s/backend/deployment.yaml','k8s/backend/secret.example.yaml']:
    list(yaml.safe_load_all(open(f)))
    print('ok', f)
"
```

Expected: `ok` for both files.

- [ ] **Step 5: Commit**

```bash
git add k8s/backend/deployment.yaml k8s/backend/secret.example.yaml docs/infrastructure/deployment-k3s-argocd.md
git commit -m "$(cat <<'EOF'
chore(infra): wire OPENAI_API_KEY into the backend deployment surfaces (mezo-ozri.2)

Beside GEMINI_API_KEY, not instead of it — embedding, audio and the fallback still ride
the Gemini key. secretKeyRef is optional:true so the pod keeps booting on the dummy
default until the operator re-seals mezo-app; that step is recorded in the infra doc
because it needs the cluster sealing cert.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Docs, CODEMAP, ADR amendment, and the local gate

**Files:**
- Modify: `docs/features/companion.md` (§ on the LLM adapter/port + the config table)
- Modify: `docs/decisions/0008-companion-llm-spring-ai-2-gemini.md` (amendment section)
- Regenerate: `docs/CODEMAP.md`
- Modify: `docs/milestones/roadmap.md` (one milestone-log row)

- [ ] **Step 1: Amend ADR 0008**

Append to `docs/decisions/0008-companion-llm-spring-ai-2-gemini.md` (do not rewrite the original decision — an ADR is a dated artifact):

```markdown
## Amendment — 2026-09-07 (`mezo-ozri.2`)

Gemini is no longer the only chat provider. `spring-ai-starter-model-openai` joins
`spring-ai-starter-model-google-genai` (spring-ai 2.0.1); `mezo.companion.llm.provider`
selects which adapter is the primary `CompanionLlm`, and each provider carries its own
`{chat-model, smart-model}` tier pair.

**What did NOT change.** The google-genai starter stays in the build — it is what defines the
`com.google.genai.Client` bean `GeminiEmbeddingAdapter` injects, so removing it would kill
embedding too. `GEMINI_API_KEY` stays and gains `OPENAI_API_KEY` beside it. Embedding remains
`gemini-embedding-001` @768 (spec §E1), audio transcription remains Gemini because no GPT-5.6
model has an audio endpoint, and vision stays Gemini until the A/B measures it — both via
`mezo.companion.llm.per-call-kind`. The shipped default is still `provider: gemini`; which model
becomes the default is decided by the eval re-baseline in `mezo-ozri.3`, not by this slice.

Full reasoning: [`2026-09-06-openai-migration-design.md`](../superpowers/specs/2026-09-06-openai-migration-design.md).
```

- [ ] **Step 2: Update `docs/features/companion.md`**

Per the docs mandate, edit **only** the sections this change touches — the LLM-port/adapter section and the companion config table. Overwrite in place; no changelog, no dated snapshot. Cover: the `SpringAiCompanionLlm` base plus its two subclasses; the `provider` / `gemini` / `openai` / `per-call-kind` keys; that `completeSmart` is overridden on the base and why the interface default is a trap; that audio and vision delegate to Gemini; that OpenAI reasoning tokens are inside the completion count so its price rows are `INCLUDED_IN_OUTPUT`; and the `stream-options.include-usage` invariant. Update the stale `GEMINI_API_KEY` sentences at `companion.md:1682` and `:6553` to say the key stays **and** that `OPENAI_API_KEY` sits beside it.

- [ ] **Step 3: Regenerate the CODEMAP and lint the docs**

Focused ITs skip both gates, so run them by hand:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezo-ozri-openai-migration-d2cc89 && node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs
```

Expected: `docs/CODEMAP.md` picks up `SpringAiCompanionLlm`, `OpenAiCompanionLlm`, `OpenAiUsageExtractor`, `LlmProvider`; the doc lint reports no new orphans, broken links or staleness for `companion.md`.

- [ ] **Step 4: Add the roadmap milestone row**

One row in `docs/milestones/roadmap.md`'s milestone log, in the existing voice and level of detail: what shipped, the gates that proved it, and what it unblocks (`mezo-ozri.3`, `.4`, `.5`).

- [ ] **Step 5: Run the ArchUnit + convention gate**

```bash
cd backend && ./mvnw clean test -Dtest='ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Expected: PASS — in particular `no_spring_value_annotation` (nothing added uses `@Value`) and `feature_slices_are_cycle_free` (`companion.config` now imports `llmlog.entity.CallKind`; `llmlog` imports nothing from `companion`, verified by grep, so no cycle is introduced).

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "$(cat <<'EOF'
docs(companion): record the two-provider LLM seam + amend ADR 0008 (mezo-ozri.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Ship it

- [ ] **Step 1: Local gate — the focused suites one more time, together**

```bash
cd backend && ./mvnw clean test -Dtest='ArchitectureTest,OpenAiUsageExtractorTest,OpenAiCompanionLlmOptionsTest,OpenAiProviderWiringIT,ChatModelQualifierIT,CompanionRealWiringIT,CompanionPropertiesIT,LlmPricingPropertiesBindingTest,ChatServiceIT,ChatStreamServiceIT,CompanionApiIT,CompanionStreamApiIT,CompanionTranscribeApiIT,CompanionMemoryLlmUsageApiIT' -Dmezo.test.use-testcontainers=true
```

Do **not** attempt the full backend suite locally — that is what the PR's CI run is for.

- [ ] **Step 2: Push and open the self-PR (the CI gate)**

```bash
git push -u origin feat/openai-migration-s2-openai-adapter
gh pr create --fill
```

Wait for `ci.yml` green: `test-backend` (the full IT suite — the real proof that two starters did not break the 178 fake-profile contexts), `test-frontend` both modes, `lint`, `contract-drift`.

- [ ] **Step 3: Re-check the merge result against the CURRENT main**

```bash
gh workflow run premerge.yml -f pr=<number>
```

- [ ] **Step 4: Merge locally with `--no-ff`, push main, delete the branch**

In this worktree the merge goes through a detached HEAD (`git checkout main` is blocked by the primary checkout): `git fetch origin`, `git checkout --detach origin/main`, `git merge --no-ff <branch>`, `git push origin HEAD:main`.

- [ ] **Step 5: Refresh the tracker backup and close the issue**

```bash
node scripts/check-beads-backup.mjs --fix
```

Commit the result, then `bd close mezo-ozri.2` with a note stating what landed, and that the **acceptance criteria are only half met in CI**: the `companion-smoke` run against a real `OPENAI_API_KEY` (`served_model=gpt-5.6-luna`, non-null tokens and cost on a streamed row, transcribe/vision still `gemini`) is a **manual step requiring a real key**. Run it if a key is available:

```bash
cd backend && OPENAI_API_KEY=<real> ./mvnw spring-boot:run \
  -Dspring-boot.run.profiles=demodata,companion-smoke \
  -Dspring-boot.run.arguments=--mezo.companion.llm.provider=openai
```

then inspect `llm_log_history` for `served_model`, `prompt_tokens`, `cost_usd`. If no key is available, file a bd follow-up rather than closing the criterion silently.

---

## Self-review

**Spec coverage** (`mezo-ozri.2` description, item by item):

| Requirement | Task |
|---|---|
| `spring-ai-starter-model-openai` beside google-genai | 1 |
| spring-ai 2.0.0 → 2.0.1, re-check `LlmRoundUsageAdvisor.ORDER` | 1 (bump) + 4/5 (the Gemini stream ITs are the calibration check) |
| `OpenAiCompanionLlm` with `@Profile("!companion-fake")` + `COMPANION_SWITCH` guards | 5 |
| **mandatory** `completeSmart` override | 5 (inherited from the base, asserted structurally in `OpenAiProviderWiringIT`) |
| `OpenAiUsageExtractor` | 2 |
| multi-round tool-loop usage summing | 4 — `LlmRoundUsageAdvisor` is already provider-neutral and the base wires it for both adapters; the OpenAI **stream**-path round-counting assumption is out of scope by design (`mezo-ozri.9`) |
| streaming usage on | 5 (D5 — and the bd note's property name is corrected) |
| bracket-quoted `[gpt-5.6-luna]` / `[gpt-5.6-terra]` price rows | 3 |
| `OPENAI_API_KEY`: application.yml + deployment.yaml + secret.example.yaml + re-seal | 1 + 6 (the re-seal is explicitly handed to the operator) |
| `GEMINI_API_KEY` stays | 1, 6, 7 |
| per-call-kind: TRANSCRIBE + VISION on Gemini | 3 (config) + 5 (delegation) |

**Known gaps, stated rather than hidden:**
1. **The SealedSecret is not re-sealed by this plan.** It needs the cluster sealing certificate. Task 6 records the operator step; `optional: true` on the `secretKeyRef` means the pod keeps booting until it happens.
2. **The real-key smoke is manual.** CI has no OpenAI key, so `served_model=gpt-5.6-luna` with non-null cost on a streamed row cannot be proven by the pipeline. Step 5 of *Ship it* makes this explicit instead of letting the acceptance criterion pass by omission.
3. **`docs/features/companion.md` §2 is prose, not code.** The plan says which sections to edit and what they must say, but the exact wording is the implementer's — a copy-paste block would be worse than a written instruction there.

**Type consistency check:** `LlmProvider` (enum, `feature.companion.config`) · `CompanionProperties.Llm.Tier(String chatModel, String smartModel)` · `Llm(LlmProvider provider, Tier gemini, Tier openai, Map<CallKind, LlmProvider> perCallKind)` · `SpringAiCompanionLlm(ChatModel, LlmUsageExtractor, ChatOptions, ChatOptions, LlmCallRecorder, LlmCallContextHolder)` · `OpenAiCompanionLlm.options(String) → OpenAiChatOptions` — used identically in Tasks 3, 4 and 5.
