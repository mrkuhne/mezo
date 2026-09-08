package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Llm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Llm.Tier;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.service.LlmActorResolver;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatOptions;

/**
 * What the OpenAI adapter puts on the wire for ONE resolved call. Two invariants live here and
 * nowhere else, both of which fail SILENTLY in production if they are lost.
 *
 * <p>mezo-ozri.2, spec §8.6: without streaming usage every streamed row is persisted with NULL
 * tokens and NULL cost. The 2.0.1 property is
 * {@code spring.ai.openai.chat.stream-options.include-usage} (not the "stream-usage" the bd note
 * names); rather than depend on that — or on option-merge order between the ChatClient's defaults
 * and the model's — the adapter states it in the options of every request it builds.
 *
 * <p>mezo-ozri.4: since the model is chosen per call, the options are built per call too, so this
 * exercises the {@code optionsFor} hook directly — no network, no Spring context.
 */
class OpenAiCompanionLlmOptionsTest {

    private final LlmCallContextHolder contextHolder = new LlmCallContextHolder();

    @Test
    void testOptionsFor_shouldRequestStreamingUsage_always() {
        OpenAiChatOptions options = optionsFor("gpt-5.6-luna", ModelTier.CHEAP, false);

        assertThat(options.getStreamOptions()).isNotNull();
        assertThat(options.getStreamOptions().includeUsage()).isTrue();
    }

    @Test
    void testOptionsFor_shouldCarryTheResolvedModel_soTheRequestAndTheAuditRowAgree() {
        assertThat(optionsFor("gpt-5.6-terra", ModelTier.SMART, false).getModel()).isEqualTo("gpt-5.6-terra");
    }

    @Test
    void testOptionsFor_shouldCarryTheTiersConfiguredReasoningEffort_onANonToolCall() {
        assertThat(optionsFor("gpt-5.6-luna", ModelTier.CHEAP, false).getReasoningEffort()).isEqualTo("low");
        assertThat(optionsFor("gpt-5.6-terra", ModelTier.SMART, false).getReasoningEffort()).isEqualTo("medium");
    }

    /**
     * mezo-ozri.3, measured against the live API: GPT-5.6 on {@code /v1/chat/completions} rejects a
     * request that carries BOTH function tools and a reasoning effort —
     * {@code 400: Function tools with reasoning_effort are not supported for gpt-5.6-luna … set
     * reasoning_effort to 'none'}. Every single one of the 42 eval cases failed on it, i.e. every
     * chat turn the companion has.
     */
    @Test
    void testOptionsFor_shouldPinEffortToNone_whenTheRequestCarriesFunctionTools() {
        assertThat(optionsFor("gpt-5.6-luna", ModelTier.CHEAP, true).getReasoningEffort()).isEqualTo("none");
    }

    /** Unset in yml = send no effort key at all, leaving the provider's own default (mezo-641c). */
    @Test
    void testOptionsFor_shouldSendNoEffortAtAll_whenTheTierLeavesItUnset() {
        OpenAiCompanionLlm llm = adapter(tier(new Tier.ReasoningEffort(null, null)));

        OpenAiChatOptions options = (OpenAiChatOptions) llm.optionsFor("gpt-5.6-luna", ModelTier.CHEAP, false).build();

        assertThat(options.getReasoningEffort()).isNull();
        assertThat(options.getStreamOptions().includeUsage()).isTrue();
    }

    /**
     * mezo-ozri.5: the prompt-cache ROUTING hint. Verified 2026-09-07 against
     * developers.openai.com/api/docs/guides/prompt-caching — the key "influence[s] routing; [it
     * does] not pin requests to a machine or guarantee a cache read hit", so requests that share a
     * stable prefix are worth steering at the same cache. Feature slug + account id, never a name
     * or anything else identifying.
     */
    @Test
    void testOptionsFor_shouldSetPromptCacheKeyFromFeatureAndActor_whenAnActorIsResolved() {
        UUID actor = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
        OpenAiCompanionLlm llm = adapter(tier(new Tier.ReasoningEffort("low", "medium")), actor);

        OpenAiChatOptions options = contextHolder.runWith(
            new LlmCallContext("companion_chat", "send", "conversation", UUID.randomUUID()),
            () -> (OpenAiChatOptions) llm.optionsFor("gpt-5.6-luna", ModelTier.CHEAP, true).build());

        assertThat(options.getPromptCacheKey()).isEqualTo("companion_chat:" + actor);
    }

    /** A cron thread has no principal — the feature slug alone is then the honest key. */
    @Test
    void testOptionsFor_shouldFallBackToTheFeatureAlone_whenNoActorIsResolved() {
        OpenAiCompanionLlm llm = adapter(tier(new Tier.ReasoningEffort("low", "medium")), null);

        OpenAiChatOptions options = contextHolder.runWith(
            new LlmCallContext("companion_chat", "send", null, null),
            () -> (OpenAiChatOptions) llm.optionsFor("gpt-5.6-luna", ModelTier.CHEAP, true).build());

        assertThat(options.getPromptCacheKey()).isEqualTo("companion_chat");
    }

    private OpenAiChatOptions optionsFor(String model, ModelTier tier, boolean carriesTools) {
        OpenAiCompanionLlm llm = adapter(tier(new Tier.ReasoningEffort("low", "medium")));
        return (OpenAiChatOptions) llm.optionsFor(model, tier, carriesTools).build();
    }

    private OpenAiCompanionLlm adapter(Tier openai) {
        return adapter(openai, null);
    }

    private OpenAiCompanionLlm adapter(Tier openai, UUID actor) {
        Tier gemini = new Tier("gemini-2.5-flash", "gemini-2.5-pro", null, Map.of(), Map.of(),
            new Tier.ReasoningEffort(null, null));
        LlmModelRouter router = new LlmModelRouter(gemini, openai, contextHolder);
        // Neither the ChatModel nor the recorder is ever reached: only the options hook is exercised.
        ChatModel chatModel = new ChatModel() {
            @Override
            public ChatResponse call(Prompt prompt) {
                throw new UnsupportedOperationException("no call is made in this test");
            }
        };
        // Only per-call-kind is read off the properties (the media delegation map); the rest of the
        // adapter's config now comes through the router.
        CompanionProperties properties = new CompanionProperties(
            new Llm(LlmProvider.OPENAI, gemini, openai, Map.of()),
            null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
            null, null, null);
        LlmActorResolver actorResolver = new LlmActorResolver() {
            @Override
            public UUID currentActor() {
                return actor;
            }
        };
        return new OpenAiCompanionLlm(chatModel, properties, router, record -> { }, contextHolder,
            new OpenAiUsageExtractor(), null, actorResolver);
    }

    private static Tier tier(Tier.ReasoningEffort reasoningEffort) {
        return new Tier("gpt-5.6-luna", "gpt-5.6-terra", null, Map.of(), Map.of(), reasoningEffort);
    }
}
