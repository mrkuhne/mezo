package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.service.LlmActorResolver;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The OpenAI {@link CompanionLlm} adapter (mezo-ozri.2, spec §M1): {@code gpt-5.6-luna} on the
 * cheap tier, {@code gpt-5.6-terra} on the smart one. Exists only while
 * {@code mezo.companion.llm.provider} says {@code openai}, and is then {@link Primary} — the Gemini
 * adapter stays a bean beside it as the fallback and the media route. Everything it DOES lives in
 * {@link SpringAiCompanionLlm}; what is OpenAI-specific is the wiring below.
 *
 * <p><b>Audio and vision are NOT served here (spec §A1).</b> No GPT-5.6 model has an audio endpoint
 * at all, and {@code TranscriptionService} sends its inline audio through the CHAT port, so
 * feature-level routing could never catch it; the vision A/B is unmeasured (spec §10.3). Both
 * overloads therefore consult {@code mezo.companion.llm.per-call-kind} and hand the call to the
 * Gemini adapter, whose own recording and usage-extraction paths are then already correct — the row
 * lands with a {@code gemini-*} served model, as it should.
 *
 * <p><b>{@code completeSmart} comes from {@link SpringAiCompanionLlm}, never from the port
 * (spec §8.3).</b> The {@code CompanionLlm} interface default routes it to the cheap tier, so an
 * adapter that leaves it alone sends all 19 smart-tier call sites to the wrong model in silence.
 * {@code OpenAiProviderWiringIT} asserts the override structurally, because nothing else would.
 */
@Component
@Primary
@Profile("!companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@ConditionalOnProperty(name = "mezo.companion.llm.provider", havingValue = "openai")
public class OpenAiCompanionLlm extends SpringAiCompanionLlm {

    private final GeminiCompanionLlm geminiCompanionLlm;
    private final Map<CallKind, LlmProvider> perCallKind;
    /** Read again HERE (the base class keeps its own copy private) for the prompt-cache key. */
    private final LlmCallContextHolder llmCallContextHolder;
    private final LlmActorResolver llmActorResolver;

    /**
     * @param chatModel the OPENAI ChatModel, qualified by bean name (mezo-ozri.1): google-genai
     *                  contributes {@code googleGenAiChatModel} in the same context, so an
     *                  unqualified injection point would be ambiguous.
     * @param llmUsageExtractor the OPENAI usage extractor, qualified for the same reason.
     * @param llmModelRouter which model each call gets, out of the {@code llm.openai} block only.
     * @param geminiCompanionLlm the media delegate — see the class javadoc. Injected by CONCRETE
     *                  type on purpose: a {@code CompanionLlm} parameter would resolve to
     *                  {@code this}, since this bean is the primary one.
     * @param llmActorResolver whose spend this is — the account half of the prompt-cache routing
     *                  key (mezo-ozri.5). The same resolver the audit row's {@code created_by}
     *                  comes from, so the two can never disagree about who made a call.
     */
    public OpenAiCompanionLlm(@Qualifier("openAiChatModel") ChatModel chatModel,
                              CompanionProperties companionProperties, LlmModelRouter llmModelRouter,
                              LlmCallRecorder llmCallRecorder, LlmCallContextHolder llmCallContextHolder,
                              @Qualifier("openAiUsageExtractor") LlmUsageExtractor llmUsageExtractor,
                              GeminiCompanionLlm geminiCompanionLlm,
                              LlmActorResolver llmActorResolver) {
        super(chatModel, llmUsageExtractor, llmModelRouter, LlmProvider.OPENAI,
            llmCallRecorder, llmCallContextHolder);
        this.geminiCompanionLlm = geminiCompanionLlm;
        this.perCallKind = companionProperties.llm().perCallKind();
        this.llmCallContextHolder = llmCallContextHolder;
        this.llmActorResolver = llmActorResolver;
    }

    /**
     * One call's options. {@code streamOptions.includeUsage} is a CORRECTNESS invariant, not a
     * tunable (spec §8.6): without it OpenAI sends no usage block on a streamed response, and every
     * streamed row is persisted with null tokens and null cost — silently, because nothing fails. It
     * is stated HERE rather than in {@code spring.ai.openai.chat.stream-options.include-usage} so it
     * cannot depend on option-merge order or be lost to a YAML edit;
     * {@code OpenAiCompanionLlmOptionsTest} keeps it stated.
     *
     * <p>The reasoning effort comes from the tier's config (mezo-ozri.4, spec §Q1) EXCEPT on a
     * tool-carrying request, where it is pinned to {@code none}. Measured against the live API, not
     * inferred: {@code /v1/chat/completions} answers a GPT-5.6 request carrying BOTH tools and a
     * reasoning effort with {@code 400: Function tools with reasoning_effort are not supported for
     * gpt-5.6-luna … To use function tools, use /v1/responses or set reasoning_effort to 'none'} —
     * all 42 eval cases failed on it, which is every chat turn the companion has, and Spring AI 2.0
     * speaks Chat Completions only (the Responses API is a 2.1.x issue). An unset tier effort sends no
     * effort key at all, leaving the provider's own default in place (mezo-641c).
     */
    @Override
    protected OpenAiChatOptions.Builder optionsFor(String model, ModelTier tier, boolean carriesTools) {
        OpenAiChatOptions.Builder builder = OpenAiChatOptions.builder()
            .model(model)
            .streamOptions(OpenAiChatOptions.StreamOptions.builder().includeUsage(true).build());
        String cacheKey = promptCacheKey();
        if (cacheKey != null) {
            builder.promptCacheKey(cacheKey);
        }
        String effort = carriesTools ? "none" : llmModelRouter.reasoningEffortFor(LlmProvider.OPENAI, tier);
        return effort == null ? builder : builder.reasoningEffort(effort);
    }

    /**
     * The provider's ROUTING hint for prompt caching (mezo-ozri.5). Verified 2026-09-07 against
     * developers.openai.com/api/docs/guides/prompt-caching: the key "influence[s] routing; [it does]
     * not pin requests to a machine or guarantee a cache read hit" — requests carrying the same key
     * are steered at the same cache, which is what makes one account's stable chat prefix (the voice
     * plus the 46 tool schemas, ~30 minutes of reuse eligibility) worth caching at all.
     *
     * <p>Feature slug + account id, and nothing else: the id is the UUID the audit row already
     * stores, no prompt text and nothing identifying goes near this value. A cron thread has no
     * principal, and then the feature slug alone is the honest key.
     */
    private String promptCacheKey() {
        LlmCallContext context = llmCallContextHolder.get();
        String feature = context == null ? null : context.feature();
        if (feature == null || feature.isBlank()) {
            return null;
        }
        UUID actor = llmActorResolver.currentActor();
        return actor == null ? feature : feature + ":" + actor;
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
