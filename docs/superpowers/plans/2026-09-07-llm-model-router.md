# S4 — Config-driven LlmModelRouter (mezo-ozri.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A feature's or a call-kind's model becomes a YAML edit — no recompile, no code change — and the reasoning effort of each tier becomes a config key instead of a provider default.

**Architecture:** Today both tiers are frozen at wiring time: `SpringAiCompanionLlm`'s constructor builds two `ChatClient`s with `.defaultOptions(chatOptions/smartOptions)`, so the model is decided once per boot. This slice moves the model decision to CALL time. A new `LlmModelRouter` bean resolves a model id from keys that already exist at every call site — `LlmCallContextHolder.get().feature()` (the first constructor argument of all 56 tagged calls) and the `CallKind` the base class already computes — against the ACTIVE provider's config block. The base class keeps ONE `ChatClient` (the model no longer belongs in its defaults) and states the resolved options per request via `spec.options(builder)`; each adapter turns "model id + tier + does-it-carry-tools" into its own provider options through a single hook. Spec §R1 (router INSIDE the adapter, on the existing keys) is preserved exactly; no call site changes.

**Tech Stack:** Java 21, Spring Boot 3.x, Spring AI 2.0.1 (`ChatClient`, `ChatOptions.Builder`, `OpenAiChatOptions`), `@ConfigurationProperties` records + jakarta validation, JUnit 5 + AssertJ, Testcontainers-backed ITs.

## Global Constraints

- **`@Value` is ArchUnit-forbidden** (`no_spring_value_annotation`). Every tunable goes to `application.yml` and binds onto a `@ConfigurationProperties` record.
- **The Gemini adapter stays a bean** under `provider: openai` — it is the fallback and the ONLY audio route. Its tiers must never be handed a GPT model id (spec §8.2, §A1).
- **`completeSmart` must stay overridden** in `SpringAiCompanionLlm` (spec §8.3): the interface default silently routes all 19 smart-tier call sites to the cheap tier.
- **`streamOptions.includeUsage(true)` is a correctness invariant on every OpenAI request**, not a tunable (spec §8.6) — without it every streamed row is persisted with null tokens and null cost, silently.
- **A GPT-5.6 request may not carry both function tools and a reasoning effort** on `/v1/chat/completions` (measured, mezo-ozri.3): tools ⇒ `reasoning_effort=none`. This survives the refactor unchanged.
- **Prompt text must not be reordered** — `FakeCompanionLlm` dispatches on prompt prefixes (`CompanionMessageGenerator:75,100,114,139`). This slice touches no prompt.
- **Map keys with dots or underscores need bracket quoting in YAML** (`"[companion_chat]"`), like the pricing keys — the binder treats a dot as a map-key separator and relaxed binding mangles the rest.
- **Unknown config keys never fail a call**: an absent/blank/unmatched override falls back to the tier default.
- New/renamed files under `feature/companion/llm` ⇒ regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) in the SAME change; focused ITs skip that gate.

## Deviation from the spec's config sketch (§7)

The spec sketched ONE flat `mezo.companion.llm.per-feature` map. It is written provider-NESTED here
(`llm.openai.feature-models`, `llm.gemini.feature-models`), for a reason the sketch predates: a model
id is only meaningful to the provider that can serve it, and `GeminiCompanionLlm` also answers the
audio/vision calls delegated from the OpenAI adapter. A flat map would let a per-feature entry hand a
`gpt-5.6-*` id to the Gemini client on that feature's transcribe call — a runtime 404 that config
review could not catch. Nesting makes that mistake unrepresentable. Decision §R1 (the routing keys and
the router's home) is untouched; spec §7 is amended in the same commit.

## File Structure

- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/ModelTier.java` **(new)** — `CHEAP | SMART`, the vocabulary the router and the option hook share.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` **(modify)** — `Llm.Tier` grows `featureModels`, `callKindModels`, `reasoningEffort`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LlmModelRouter.java` **(new)** — the only place that knows the precedence order; reads the feature slug off `LlmCallContextHolder` itself.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/SpringAiCompanionLlm.java` **(modify)** — one ChatClient, per-request options, routed model on the audit row.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java` / `OpenAiCompanionLlm.java` **(modify)** — each implements the `optionsFor` hook.
- Tests: `LlmModelRouterTest` (new, unit), `GeminiCompanionLlmRecordingTest` + `GeminiCompanionLlmPromptOrderTest` + `OpenAiCompanionLlmOptionsTest` (modify), `LlmModelRoutingIT` (new, boots the real binder).
- Docs: `backend/src/main/resources/application.yml`, `docs/features/companion.md`, `docs/superpowers/specs/2026-09-06-openai-migration-design.md` §7, `docs/CODEMAP.md` (generated).

---

### Task 1: The config surface + the router

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/ModelTier.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LlmModelRouter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` (record `Llm.Tier`)
- Modify: `backend/src/main/resources/application.yml` (the `mezo.companion.llm` block)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmRecordingTest.java:346`, `GeminiCompanionLlmPromptOrderTest.java:94` (the two `Llm.Tier(...)` constructions — compile-only fix)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/LlmModelRouterTest.java`

**Interfaces:**
- Produces: `ModelTier { CHEAP, SMART }`; `LlmModelRouter#modelFor(LlmProvider provider, ModelTier tier, CallKind kind) -> String` (never null/blank) and `LlmModelRouter#reasoningEffortFor(LlmProvider provider, ModelTier tier) -> String` (nullable = the provider's own default); `CompanionProperties.Llm.Tier(String chatModel, String smartModel, Map<String,String> featureModels, Map<CallKind,String> callKindModels, Tier.ReasoningEffort reasoningEffort)` with `ReasoningEffort(String chat, String smart)`.
- Consumes: `LlmCallContextHolder#get()` (existing), `CallKind` (existing), `LlmProvider` (existing).

- [ ] **Step 1: Write the failing test** — `LlmModelRouterTest`, covering precedence, fall-through, provider scoping and effort:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Llm.Tier;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The routing table's whole contract (mezo-ozri.4). Pure unit: the router never calls a provider,
 * it answers "which model id" from config plus the ambient feature slug.
 */
class LlmModelRouterTest {

    private final LlmCallContextHolder contextHolder = new LlmCallContextHolder();

    @Test
    void testModelFor_shouldReturnTheTierDefault_whenNothingIsOverridden() {
        LlmModelRouter router = router(tier(Map.of(), Map.of()));

        assertThat(router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT)).isEqualTo("luna");
        assertThat(router.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART)).isEqualTo("terra");
    }

    @Test
    void testModelFor_shouldUseTheFeatureOverride_whenTheAmbientFeatureMatches() {
        LlmModelRouter router = router(tier(Map.of("companion_weekly_review", "terra"), Map.of()));

        String model = contextHolder.runWith(new LlmCallContext("companion_weekly_review", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("terra");
    }

    @Test
    void testModelFor_shouldFallBackToTheTierDefault_whenTheFeatureIsUnknownOrUntagged() {
        LlmModelRouter router = router(tier(Map.of("companion_weekly_review", "terra"), Map.of()));

        assertThat(router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT)).isEqualTo("luna");
        assertThat(contextHolder.runWith(new LlmCallContext("fuel_meal_ai", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT))).isEqualTo("luna");
    }

    @Test
    void testModelFor_shouldLetTheCallKindWin_whenBothOverridesMatch() {
        // A call-kind entry states a capability the model must HAVE; a feature entry states a
        // preference. Capability beats preference, or a feature override could send a vision turn
        // to a text-only model.
        LlmModelRouter router = router(tier(Map.of("companion_chat", "terra"), Map.of(CallKind.VISION, "luna-vision")));

        String model = contextHolder.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.VISION));

        assertThat(model).isEqualTo("luna-vision");
    }

    @Test
    void testModelFor_shouldNeverCrossProviders_soAGeminiCallCannotAskForAGptModel() {
        LlmModelRouter router = router(tier(Map.of("companion_chat", "terra"), Map.of()));

        String model = contextHolder.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.GEMINI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("flash");
    }

    @Test
    void testModelFor_shouldIgnoreABlankOverride_becauseConfigMayNeverFailACall() {
        LlmModelRouter router = router(tier(Map.of("companion_chat", "  "), Map.of()));

        String model = contextHolder.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("luna");
    }

    @Test
    void testReasoningEffortFor_shouldReturnThePerTierValue_orNullWhenUnset() {
        LlmModelRouter router = router(tier(Map.of(), Map.of()));

        assertThat(router.reasoningEffortFor(LlmProvider.OPENAI, ModelTier.CHEAP)).isEqualTo("low");
        assertThat(router.reasoningEffortFor(LlmProvider.OPENAI, ModelTier.SMART)).isEqualTo("medium");
        assertThat(router.reasoningEffortFor(LlmProvider.GEMINI, ModelTier.CHEAP)).isNull();
    }

    private LlmModelRouter router(Tier openai) {
        Tier gemini = new Tier("flash", "pro", Map.of(), Map.of(), new Tier.ReasoningEffort(null, null));
        return new LlmModelRouter(gemini, openai, contextHolder);
    }

    private static Tier tier(Map<String, String> featureModels, Map<CallKind, String> callKindModels) {
        return new Tier("luna", "terra", featureModels, callKindModels,
            new Tier.ReasoningEffort("low", "medium"));
    }
}
```

- [ ] **Step 2: Run it and watch it fail to compile**

```bash
cd backend && ./mvnw -q -o test -Dtest=LlmModelRouterTest
```
Expected: compile error — `ModelTier` and `LlmModelRouter` do not exist, `Tier` takes 2 args.

- [ ] **Step 3: Add `ModelTier`**

```java
package io.mrkuhne.mezo.feature.companion.config;

/**
 * Which of a provider's two model tiers a call belongs to (mezo-ozri.4). The tier is decided by the
 * CALL PATH — {@code completeSmart} is the smart tier, everything else the cheap one — and is the
 * router's fallback when no override matches, plus the key of the per-tier reasoning effort.
 */
public enum ModelTier {

    /** The cheap/fast tier: every conversational turn, vision, transcribe, structured output. */
    CHEAP,

    /** The smart tier: the 19 {@code completeSmart} call sites (weekly/quarterly review, critique). */
    SMART
}
```

- [ ] **Step 4: Grow `Llm.Tier` in `CompanionProperties`** (replace the existing `Tier` record; keep the surrounding javadoc style)

```java
        /**
         * One provider's model routing (mezo-ozri.4): the two tier defaults plus the overrides that
         * make a single feature's or a single call-kind's model a YAML edit. Held PER PROVIDER on
         * purpose — a model id only means anything to the provider that can serve it, and the Gemini
         * block stays load-bearing under {@code provider: openai} (audio, vision, fallback), so a
         * flat table could hand the Gemini client a GPT id on a delegated call.
         */
        public record Tier(
            @NotBlank String chatModel,   // cheap/fast — every conversational turn
            @NotBlank String smartModel,  // smart tier — the 19 completeSmart call sites
            /**
             * {@code LlmCallContext.feature()} -> model id. Bracket-quote the key in YAML
             * ({@code "[companion_chat]"}): the binder splits on dots and relaxed-binds the rest.
             * An unmatched or blank value means the tier default — config never fails a call.
             */
            @NotNull Map<String, String> featureModels,
            /** {@code CallKind} -> model id. Wins over {@code featureModels}: a kind states a
             *  capability the model must have, a feature only states a preference. */
            @NotNull Map<CallKind, String> callKindModels,
            /** Per-tier reasoning effort. OpenAI-only today; the Gemini adapter ignores it. */
            @NotNull @Valid ReasoningEffort reasoningEffort
        ) {
            /**
             * The cheapest quality lever there is (spec §Q1) — same token price, more thinking.
             * {@code null} on a tier means "send nothing", i.e. the provider's own default stands;
             * that is the shipped state until mezo-641c measures what each tier should carry. NOT
             * honoured on a tool-carrying request: {@code /v1/chat/completions} rejects tools +
             * effort outright (mezo-ozri.3), so that path pins {@code none} regardless.
             */
            public record ReasoningEffort(
                @Pattern(regexp = "none|minimal|low|medium|high|xhigh|max") String chat,
                @Pattern(regexp = "none|minimal|low|medium|high|xhigh|max") String smart
            ) {}
        }
```

- [ ] **Step 5: Add `LlmModelRouter`**

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Which model id serves THIS call (mezo-ozri.4, spec §R1). Until this bean existed the answer was
 * frozen at wiring time — {@code SpringAiCompanionLlm} built one ChatClient per tier — so moving a
 * single feature to a different model meant a code change and a deploy.
 *
 * <p>It needs no new plumbing at any call site: the feature slug is already ambient in
 * {@link LlmCallContextHolder} (the first constructor argument of all 56 tagged calls) and the
 * {@link CallKind} is already computed on the adapter's method heads. The router reads the slug
 * itself so no adapter has to remember to pass it.
 *
 * <p><b>Precedence:</b> call-kind override, then feature override, then the tier default. A kind
 * states a capability the model must HAVE (an audio route, an image input); a feature only states a
 * preference, so capability wins — otherwise "run this feature on the text model" would silently
 * break that feature's vision turn. Anything unmatched, unknown or blank falls through to the tier
 * default: configuration may never be the reason a user's call fails.
 *
 * <p><b>Provider-scoped by construction.</b> Overrides live inside a provider's own block, so a
 * Gemini call can never resolve a GPT id — which matters because {@code OpenAiCompanionLlm}
 * delegates audio and vision to the Gemini adapter (spec §A1).
 */
@Component
public class LlmModelRouter {

    private final CompanionProperties.Llm.Tier gemini;
    private final CompanionProperties.Llm.Tier openai;
    private final LlmCallContextHolder llmCallContextHolder;

    public LlmModelRouter(CompanionProperties companionProperties, LlmCallContextHolder llmCallContextHolder) {
        this(companionProperties.llm().gemini(), companionProperties.llm().openai(), llmCallContextHolder);
    }

    LlmModelRouter(CompanionProperties.Llm.Tier gemini, CompanionProperties.Llm.Tier openai,
                   LlmCallContextHolder llmCallContextHolder) {
        this.gemini = gemini;
        this.openai = openai;
        this.llmCallContextHolder = llmCallContextHolder;
    }

    /** Never null and never blank: the tier default is the floor. */
    public String modelFor(LlmProvider provider, ModelTier tier, CallKind kind) {
        CompanionProperties.Llm.Tier config = configOf(provider);
        String byKind = config.callKindModels().get(kind);
        if (StringUtils.hasText(byKind)) {
            return byKind.trim();
        }
        String byFeature = config.featureModels().get(llmCallContextHolder.get().feature());
        if (StringUtils.hasText(byFeature)) {
            return byFeature.trim();
        }
        return tier == ModelTier.SMART ? config.smartModel() : config.chatModel();
    }

    /** {@code null} = send no reasoning effort at all, leaving the provider's own default in place. */
    public String reasoningEffortFor(LlmProvider provider, ModelTier tier) {
        CompanionProperties.Llm.Tier.ReasoningEffort effort = configOf(provider).reasoningEffort();
        String value = tier == ModelTier.SMART ? effort.smart() : effort.chat();
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private CompanionProperties.Llm.Tier configOf(LlmProvider provider) {
        return provider == LlmProvider.OPENAI ? openai : gemini;
    }
}
```

- [ ] **Step 6: Fix the two compile-broken test constructions**

In `GeminiCompanionLlmRecordingTest:346` and `GeminiCompanionLlmPromptOrderTest:94`, extend each
`Llm.Tier(...)` with the three new arguments, e.g.:

```java
                new CompanionProperties.Llm.Tier(CHAT_MODEL, SMART_MODEL, Map.of(), Map.of(),
                    new CompanionProperties.Llm.Tier.ReasoningEffort(null, null)),
```

- [ ] **Step 7: Add the YAML surface** — in `backend/src/main/resources/application.yml`, inside each provider block under `mezo.companion.llm` (keep the existing comment voice):

```yaml
      gemini:
        chat-model: gemini-2.5-flash   # cheap/fast tier: every conversational turn
        smart-model: gemini-2.5-pro    # smart tier: heavy pipelines (V3.2 critique)
        # mezo-ozri.4 — per-call model overrides, resolved by LlmModelRouter at CALL time. Both maps
        # are scoped to THIS provider: a model id only means something to the vendor that serves it,
        # and this block still answers the audio/vision calls the OpenAI adapter delegates here.
        # Precedence: call-kind-models, then feature-models, then the tier defaults above; anything
        # unmatched or blank falls through, so config can never be why a call fails.
        # Keys MUST be bracket-quoted ("[companion_chat]") — the binder splits map keys on dots.
        feature-models: {}             # LlmCallContext.feature() -> model id
        call-kind-models: {}           # CallKind -> model id
        reasoning-effort:              # empty = send none, the provider's own default stands
          chat:
          smart:
      openai:
        chat-model: gpt-5.6-luna       # cheap/fast tier (spec §4: Terra as the default is -19% margin)
        smart-model: gpt-5.6-terra     # smart tier: the 19 completeSmart call sites
        feature-models: {}
        call-kind-models: {}
        # The quality lever of spec §Q1 — same token price, more thinking. Left EMPTY until
        # mezo-641c measures what each tier should carry; a tool-carrying request pins `none`
        # regardless, because /v1/chat/completions rejects tools + effort outright (mezo-ozri.3).
        reasoning-effort:
          chat:
          smart:
```

- [ ] **Step 8: Run the router test — it must pass**

```bash
cd backend && ./mvnw -q -o test -Dtest='LlmModelRouterTest+GeminiCompanionLlmRecordingTest+GeminiCompanionLlmPromptOrderTest'
```
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm
git commit -m "feat(companion): config-driven LLM model routing table (mezo-ozri.4)"
```

---

### Task 2: Route at call time inside the adapters

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/SpringAiCompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmRecordingTest.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiCompanionLlmOptionsTest.java`

**Interfaces:**
- Consumes: `LlmModelRouter#modelFor`, `#reasoningEffortFor`, `ModelTier` (Task 1).
- Produces: `SpringAiCompanionLlm(ChatModel, LlmUsageExtractor, LlmModelRouter, LlmProvider, LlmCallRecorder, LlmCallContextHolder)` and the abstract hook `protected abstract ChatOptions.Builder<?> optionsFor(String model, ModelTier tier, boolean carriesTools)`. The old `toolCallOptions()` hook and the two `ChatOptions` constructor parameters are GONE — `optionsFor` subsumes both.

- [ ] **Step 1: Write the failing tests.** In `GeminiCompanionLlmRecordingTest`, the adapter factory now needs a router; add the routing assertions:

```java
    @Test
    void testComplete_shouldRecordTheROUTEDModel_whenTheFeatureIsOverridden() {
        // The audit row must name what was actually requested, or every cost report lies.
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")),
            tier(Map.of("companion_weekly_review", "gemini-2.5-pro"), Map.of()));

        contextHolder.runWith(new LlmCallContext("companion_weekly_review", null, null, null),
            () -> llm.complete("sys", "hi"));

        assertThat(recorder.last().requestedModel()).isEqualTo("gemini-2.5-pro");
    }

    @Test
    void testComplete_shouldKeepTheTierDefault_whenNothingIsOverridden() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.complete("sys", "hi");

        assertThat(recorder.last().requestedModel()).isEqualTo(CHAT_MODEL);
    }

    @Test
    void testCompleteSmart_shouldStillUseTheSmartTier_afterTheRouterRefactor() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.completeSmart("sys", "hi");

        assertThat(recorder.last().requestedModel()).isEqualTo(SMART_MODEL);
        assertThat(recorder.last().callKind()).isEqualTo(CallKind.SMART);
    }
```

with the factory overloads (the two-arg one takes the openai/gemini tier config):

```java
    private GeminiCompanionLlm adapter(ChatModel chatModel) {
        return adapter(chatModel, tier(Map.of(), Map.of()));
    }

    private GeminiCompanionLlm adapter(ChatModel chatModel, CompanionProperties.Llm.Tier geminiTier) {
        LlmModelRouter router = new LlmModelRouter(geminiTier, geminiTier, contextHolder);
        return new GeminiCompanionLlm(chatModel, router, recorder, contextHolder, new GoogleGenAiUsageExtractor());
    }

    private static CompanionProperties.Llm.Tier tier(Map<String, String> featureModels,
                                                     Map<CallKind, String> callKindModels) {
        return new CompanionProperties.Llm.Tier(CHAT_MODEL, SMART_MODEL, featureModels, callKindModels,
            new CompanionProperties.Llm.Tier.ReasoningEffort(null, null));
    }
```

(The old `companionProperties()` helper and its `CompanionProperties` import go away if nothing else
in the file uses them; keep whatever the existing tests still need.)

In `OpenAiCompanionLlmOptionsTest`, replace the two static-factory tests with the hook's contract:

```java
    @Test
    void testOptionsFor_shouldRequestStreamingUsage_always() {
        OpenAiChatOptions options = optionsFor("gpt-5.6-luna", ModelTier.CHEAP, false);

        assertThat(options.getStreamOptions()).isNotNull();
        assertThat(options.getStreamOptions().includeUsage()).isTrue();
        assertThat(options.getModel()).isEqualTo("gpt-5.6-luna");
    }

    @Test
    void testOptionsFor_shouldCarryTheConfiguredReasoningEffort_onANonToolCall() {
        assertThat(optionsFor("gpt-5.6-terra", ModelTier.SMART, false).getReasoningEffort())
            .isEqualTo("medium");
    }

    @Test
    void testOptionsFor_shouldPinEffortToNone_whenTheRequestCarriesFunctionTools() {
        // Measured, mezo-ozri.3: /v1/chat/completions answers tools + effort with a 400 — all 42
        // eval cases failed on it, i.e. every chat turn the companion has.
        assertThat(optionsFor("gpt-5.6-luna", ModelTier.CHEAP, true).getReasoningEffort()).isEqualTo("none");
    }

    @Test
    void testOptionsFor_shouldSendNoEffortAtAll_whenTheTierLeavesItUnset() {
        OpenAiCompanionLlm llm = adapter(new Tier("gpt-5.6-luna", "gpt-5.6-terra", Map.of(), Map.of(),
            new Tier.ReasoningEffort(null, null)));

        assertThat(((OpenAiChatOptions) llm.optionsFor("gpt-5.6-luna", ModelTier.CHEAP, false).build())
            .getReasoningEffort()).isNull();
    }
```

with a local helper that builds the adapter over a stub `ChatModel` (no network, no context):

```java
    private OpenAiChatOptions optionsFor(String model, ModelTier tier, boolean carriesTools) {
        OpenAiCompanionLlm llm = adapter(new Tier("gpt-5.6-luna", "gpt-5.6-terra", Map.of(), Map.of(),
            new Tier.ReasoningEffort("low", "medium")));
        return (OpenAiChatOptions) llm.optionsFor(model, tier, carriesTools).build();
    }

    private OpenAiCompanionLlm adapter(Tier openai) {
        LlmCallContextHolder holder = new LlmCallContextHolder();
        Tier gemini = new Tier("gemini-2.5-flash", "gemini-2.5-pro", Map.of(), Map.of(),
            new Tier.ReasoningEffort(null, null));
        LlmModelRouter router = new LlmModelRouter(gemini, openai, holder);
        return new OpenAiCompanionLlm(prompt -> { throw new UnsupportedOperationException(); },
            router, Map.of(), record -> { }, holder, new OpenAiUsageExtractor(), null);
    }
```

(If `ChatModel` cannot be a lambda in this Spring AI version, use the same anonymous-class stub the
recording test already has; and if `OpenAiUsageExtractor`/`LlmCallRecorder` need arguments, mirror the
recording test's construction. `optionsFor` is package-private-visible to the test because both live
in `io.mrkuhne.mezo.feature.companion.llm`.)

- [ ] **Step 2: Run them and watch them fail**

```bash
cd backend && ./mvnw -q -o test -Dtest='GeminiCompanionLlmRecordingTest+OpenAiCompanionLlmOptionsTest'
```
Expected: compile failure — the constructors and `optionsFor` do not exist yet.

- [ ] **Step 3: Refactor `SpringAiCompanionLlm` to route per call.** Replace the fields, the constructor and the client construction:

```java
    private final ChatClient chatClient;
    private final LlmModelRouter llmModelRouter;
    private final LlmProvider provider;
    private final LlmCallRecorder llmCallRecorder;
    private final LlmCallContextHolder llmCallContextHolder;
    private final LlmUsageExtractor llmUsageExtractor;

    /**
     * @param chatModel      the provider's ChatModel — inject with a {@code @Qualifier} (mezo-ozri.1).
     * @param llmModelRouter resolves WHICH model serves each call (mezo-ozri.4). The model is no
     *                       longer a wiring-time constant, so there is one ChatClient, not one per
     *                       tier, and every request states its own options.
     * @param provider       which config block the router reads for this adapter — a Gemini call may
     *                       never resolve an OpenAI id (spec §A1).
     */
    protected SpringAiCompanionLlm(ChatModel chatModel, LlmUsageExtractor llmUsageExtractor,
                                   LlmModelRouter llmModelRouter, LlmProvider provider,
                                   LlmCallRecorder llmCallRecorder,
                                   LlmCallContextHolder llmCallContextHolder) {
        this.llmCallRecorder = llmCallRecorder;
        this.llmCallContextHolder = llmCallContextHolder;
        this.llmUsageExtractor = llmUsageExtractor;
        this.llmModelRouter = llmModelRouter;
        this.provider = provider;
        // mezo-58ig: the per-round usage observer — stateless; the per-call state is the
        // LlmRoundUsage tally each call plants in the request context.
        this.chatClient = ChatClient.builder(chatModel)
            .defaultAdvisors(new LlmRoundUsageAdvisor(llmUsageExtractor))
            .build();
    }

    /**
     * The provider's options for ONE resolved call. Replaces both the tier options that used to be
     * constructor arguments and the old {@code toolCallOptions()} hook: since mezo-ozri.4 the model
     * is per call, so the options must be built per call too, and the only two things that vary
     * besides the id are the tier (which reasoning effort applies) and whether the request carries
     * function tools (on OpenAI that forces the effort to {@code none} — mezo-ozri.3).
     *
     * <p>A BUILDER, because that is what the 2.0 request spec's {@code options(..)} takes.
     */
    protected abstract ChatOptions.Builder<?> optionsFor(String model, ModelTier tier, boolean carriesTools);

    /** The model this call resolves to — the id sent to the provider AND recorded on the audit row. */
    private String route(ModelTier tier, CallKind kind) {
        return llmModelRouter.modelFor(provider, tier, kind);
    }
```

Then each call path resolves once and states its options. `completeSmart`:

```java
    @Override
    public String completeSmart(String systemPrompt, String userMessage) {
        String model = route(ModelTier.SMART, CallKind.SMART);
        CallSpec spec = CallSpec.of(CallKind.SMART, model, systemPrompt, userMessage);
        LlmRoundUsage tally = new LlmRoundUsage();
        return recorded(spec, tally,
            () -> smartChatClientPrompt(systemPrompt, userMessage, model, tally).call().chatResponse());
    }

    private ChatClient.ChatClientRequestSpec smartChatClientPrompt(String systemPrompt, String userMessage,
                                                                  String model, LlmRoundUsage tally) {
        return chatClient.prompt().system(systemPrompt).user(userMessage)
            .options(optionsFor(model, ModelTier.SMART, false))
            .advisors(a -> a.param(LlmRoundUsage.CONTEXT_KEY, tally));
    }
```

`complete(system, history, user, tools, toolContext)`, the VISION overload, the TRANSCRIBE overload
and `stream(..)` follow the same two-line change each: compute `String model = route(ModelTier.CHEAP,
kind)` BEFORE building the `CallSpec`, pass `model` as the spec's `requestedModel`, and add
`.options(optionsFor(model, ModelTier.CHEAP, <carriesTools>))` to the request spec —
`carriesTools` is `!tools.isEmpty()` on the two tool-capable paths and `false` on vision/transcribe.
`request(..)` takes the resolved model as a parameter and drops the old `toolCallOptions()` branch:

```java
    private ChatClient.ChatClientRequestSpec request(String systemPrompt, List<Turn> history,
                                                     String userMessage, List<ToolCallback> tools,
                                                     Map<String, Object> toolContext, String model,
                                                     LlmRoundUsage tally) {
        ChatClient.ChatClientRequestSpec spec = chatClient.prompt()
            .system(systemPrompt)
            .messages(toMessages(history))
            .user(userMessage)
            .options(optionsFor(model, ModelTier.CHEAP, !tools.isEmpty()))
            .advisors(a -> a.param(LlmRoundUsage.CONTEXT_KEY, tally));
        if (!tools.isEmpty()) {
            // tools(Object...) is the unified 2.0 registration API (toolCallbacks(..) is deprecated)
            spec = spec.tools((Object[]) tools.toArray(ToolCallback[]::new)).toolContext(toolContext);
        }
        return spec;
    }
```

Delete the now-dead `chatModel()`, `smartModel()`, `chatModelId`, `smartModelId` and
`toolCallOptions()` members. On the streaming path the model must be resolved OUTSIDE the
`Flux.defer` (with the context, on the caller's thread), exactly like `LlmCallContext` already is —
a re-subscription on another thread would otherwise route on an empty feature slug.

- [ ] **Step 4: Implement the hook in `GeminiCompanionLlm`**

```java
    public GeminiCompanionLlm(@Qualifier("googleGenAiChatModel") ChatModel chatModel,
                              LlmModelRouter llmModelRouter,
                              LlmCallRecorder llmCallRecorder, LlmCallContextHolder llmCallContextHolder,
                              @Qualifier("googleGenAiUsageExtractor") LlmUsageExtractor llmUsageExtractor) {
        super(chatModel, llmUsageExtractor, llmModelRouter, LlmProvider.GEMINI,
            llmCallRecorder, llmCallContextHolder);
    }

    /**
     * Nothing about a Gemini request varies with the tier or with tools — the model id is the whole
     * option set. The reasoning effort is deliberately NOT read here: it is an OpenAI concept, and
     * pretending otherwise would put a meaningless key in the gemini block's contract.
     */
    @Override
    protected ChatOptions.Builder<?> optionsFor(String model, ModelTier tier, boolean carriesTools) {
        return ChatOptions.builder().model(model);
    }
```

- [ ] **Step 5: Implement the hook in `OpenAiCompanionLlm`** (replacing `options`, `toolOptions` and `toolCallOptions`)

```java
    /**
     * One call's options. {@code streamOptions.includeUsage} is a CORRECTNESS invariant, not a
     * tunable (spec §8.6): without it OpenAI sends no usage block on a streamed response and every
     * streamed row is persisted with null tokens and null cost — silently. It is stated HERE rather
     * than in {@code spring.ai.openai.chat.stream-options.include-usage} so it cannot depend on
     * option-merge order or be lost to a YAML edit.
     *
     * <p>The reasoning effort comes from the tier's config (mezo-ozri.4) EXCEPT on a tool-carrying
     * request, where it is pinned to {@code none}: measured against the live API,
     * {@code /v1/chat/completions} answers a GPT-5.6 request carrying both function tools and an
     * effort with {@code 400: Function tools with reasoning_effort are not supported … set
     * reasoning_effort to 'none'} (mezo-ozri.3 — all 42 eval cases failed on it). An unset tier
     * effort sends nothing at all, leaving the provider's own default in place (mezo-641c).
     */
    @Override
    protected OpenAiChatOptions.Builder optionsFor(String model, ModelTier tier, boolean carriesTools) {
        OpenAiChatOptions.Builder builder = OpenAiChatOptions.builder()
            .model(model)
            .streamOptions(OpenAiChatOptions.StreamOptions.builder().includeUsage(true).build());
        String effort = carriesTools ? "none" : llmModelRouter.reasoningEffortFor(LlmProvider.OPENAI, tier);
        return effort == null ? builder : builder.reasoningEffort(effort);
    }
```

The constructor keeps `CompanionProperties` only for `perCallKind` (the provider delegation map);
it gains the `LlmModelRouter` and passes `LlmProvider.OPENAI` to `super`. Store the router in a
`protected final` field on the base (or keep a private copy in the OpenAI adapter) so the hook can
reach it.

- [ ] **Step 6: Run the focused suite**

```bash
cd backend && ./mvnw -q -o test -Dtest='LlmModelRouterTest+GeminiCompanionLlmRecordingTest+GeminiCompanionLlmPromptOrderTest+OpenAiCompanionLlmOptionsTest+GoogleGenAiUsageExtractorTest+OpenAiUsageExtractorTest'
```
Expected: all green — in particular the streamed, cancelled and tool-round recording tests, which are
the paths this refactor moves.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm
git commit -m "feat(companion): resolve the model per call instead of per boot (mezo-ozri.4)"
```

---

### Task 3: Prove it from YAML, then document it

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/LlmModelRoutingIT.java`
- Modify: `docs/features/companion.md` (the `mezo.companion.llm` config list ~`:4503` and the file inventory ~`:7385`)
- Modify: `docs/superpowers/specs/2026-09-06-openai-migration-design.md` (§7 — the nesting amendment)
- Modify: `docs/CODEMAP.md` (generated)

**Interfaces:**
- Consumes: everything from Tasks 1-2.

- [ ] **Step 1: Write the failing IT** — the acceptance criterion is "a YAML edit, no recompile", so the binder itself is what must be proven, including the bracket-quoted key shape:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-ozri.4 acceptance: moving one feature or one call kind to another model is a YAML edit and
 * nothing else. Proven through the REAL binder, because the failure mode this guards is a binding
 * one — a feature slug carries underscores, and an unbracketed map key gets relaxed-bound into
 * something that never matches, silently leaving every call on the tier default.
 */
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.companion.llm.openai.feature-models.[companion_weekly_review]=gpt-5.6-terra",
    "mezo.companion.llm.openai.call-kind-models.VISION=gpt-5.6-luna-vision",
    "mezo.companion.llm.openai.reasoning-effort.smart=high"
})
class LlmModelRoutingIT extends AbstractIntegrationTest {

    @Autowired private LlmModelRouter llmModelRouter;
    @Autowired private LlmCallContextHolder llmCallContextHolder;

    @Test
    void testRouting_shouldHonourAFeatureOverrideFromConfig_withoutARecompile() {
        String model = llmCallContextHolder.runWith(
            new LlmCallContext("companion_weekly_review", null, null, null),
            () -> llmModelRouter.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("gpt-5.6-terra");
    }

    @Test
    void testRouting_shouldHonourACallKindOverride_evenInsideAnOverriddenFeature() {
        String model = llmCallContextHolder.runWith(
            new LlmCallContext("companion_weekly_review", null, null, null),
            () -> llmModelRouter.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.VISION));

        assertThat(model).isEqualTo("gpt-5.6-luna-vision");
    }

    @Test
    void testRouting_shouldFallBackToTheTierDefault_forEveryUnconfiguredFeature() {
        String model = llmCallContextHolder.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> llmModelRouter.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("gpt-5.6-luna");
    }

    @Test
    void testRouting_shouldNotLeakOverridesAcrossProviders_soDelegatedMediaStaysOnGemini() {
        String model = llmCallContextHolder.runWith(
            new LlmCallContext("companion_weekly_review", null, null, null),
            () -> llmModelRouter.modelFor(LlmProvider.GEMINI, ModelTier.CHEAP, CallKind.TRANSCRIBE));

        assertThat(model).isEqualTo("gemini-2.5-flash");
    }

    @Test
    void testReasoningEffort_shouldBindPerTier_andStayUnsetWhereTheYamlLeavesItEmpty() {
        assertThat(llmModelRouter.reasoningEffortFor(LlmProvider.OPENAI, ModelTier.SMART)).isEqualTo("high");
        assertThat(llmModelRouter.reasoningEffortFor(LlmProvider.OPENAI, ModelTier.CHEAP)).isNull();
    }
}
```

- [ ] **Step 2: Run it**

```bash
cd backend && ./mvnw -q -o test -Dtest=LlmModelRoutingIT -Dmezo.test.use-testcontainers=true
```
Expected: green. If the feature-models assertion fails while the call-kind one passes, the map key
shape is the cause — that is exactly the trap this test exists for; fix the documented key form
rather than the assertion.

- [ ] **Step 3: Update `docs/features/companion.md`** — extend the `mezo.companion.llm` config list with the three new per-provider keys (values, types, precedence, the bracket-quoting rule, and the "unset effort = provider default, tools always none" note), and add `LlmModelRouter.java` + `ModelTier.java` to the file inventory with one line each on what they decide. Correct the `OpenAiCompanionLlm` inventory line: `options(String)`/`toolOptions(String)` no longer exist; it is `optionsFor(model, tier, carriesTools)` now.

- [ ] **Step 4: Amend the spec** — in `docs/superpowers/specs/2026-09-06-openai-migration-design.md` §7, replace the flat `per-feature` / `per-call-kind` model sketch with the provider-nested block that shipped, plus one sentence of WHY (a model id is provider-specific, and the Gemini block still answers delegated audio/vision). Leave §R1 and the decision table untouched — the decision did not change, only its YAML shape.

- [ ] **Step 5: Regenerate the codemap**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/LlmModelRoutingIT.java docs
git commit -m "test(companion): prove the model router binds from yaml + document it (mezo-ozri.4)"
```

---

## Verification before completion

- [ ] `cd backend && ./mvnw -q -o test -Dtest='LlmModelRouterTest+GeminiCompanionLlmRecordingTest+GeminiCompanionLlmPromptOrderTest+OpenAiCompanionLlmOptionsTest'` — green.
- [ ] `cd backend && ./mvnw -q -o test -Dtest='LlmModelRoutingIT+OpenAiProviderWiringIT+ChatModelQualifierIT' -Dmezo.test.use-testcontainers=true` — green (the wiring ITs are the ones a constructor-signature change breaks).
- [ ] `git diff --stat` shows no prompt-text file touched (the `FakeCompanionLlm` prefix dispatch).
- [ ] `docs/CODEMAP.md` regenerated in the same commit as the new files.
- [ ] Self-PR opened, `ci.yml` green, `premerge.yml` re-run against current main, then `--no-ff` merge.
