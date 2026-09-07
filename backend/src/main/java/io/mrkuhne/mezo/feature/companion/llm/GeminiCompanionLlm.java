package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * The Gemini {@link CompanionLlm} adapter over the autoconfigured google-genai {@link ChatModel}
 * (spring-ai-starter-model-google-genai, ADR 0008). Absent under the {@code companion-fake} profile
 * so integration tests never construct a network-bound client path. Everything it actually DOES
 * lives in {@link SpringAiCompanionLlm} — none of it was ever Gemini-specific.
 *
 * <p><b>Always a bean, even when OpenAI is the primary adapter (mezo-ozri.2).</b> It is the chat
 * fallback, and — via {@code mezo.companion.llm.per-call-kind} — the ONLY route for audio and the
 * current route for vision, both of which {@code OpenAiCompanionLlm} delegates straight to this
 * bean. Its models therefore come from the {@code llm.gemini} block, never from "the active
 * provider": under {@code provider: openai} that would hand it a GPT model id it cannot serve. That
 * scoping is what {@link LlmModelRouter} enforces — this adapter always asks it as
 * {@link LlmProvider#GEMINI}, whatever the provider switch says.
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
     * @param llmUsageExtractor the GOOGLE usage extractor, qualified by bean name for the same
     *                  reason: since mezo-ozri.2 {@code OpenAiUsageExtractor} is the port's second
     *                  implementation. Guarded by the same {@code ChatModelQualifierIT}.
     * @param llmModelRouter which model each call gets, out of the {@code llm.gemini} block only.
     */
    public GeminiCompanionLlm(@Qualifier("googleGenAiChatModel") ChatModel chatModel,
                              LlmModelRouter llmModelRouter,
                              LlmCallRecorder llmCallRecorder, LlmCallContextHolder llmCallContextHolder,
                              @Qualifier("googleGenAiUsageExtractor") LlmUsageExtractor llmUsageExtractor) {
        super(chatModel, llmUsageExtractor, llmModelRouter, LlmProvider.GEMINI,
            llmCallRecorder, llmCallContextHolder);
    }

    /**
     * Nothing about a Gemini request varies with the tier or with tools — the resolved model id is
     * the whole option set. The reasoning effort is deliberately NOT read here: it is an OpenAI
     * concept, and honouring it would put a key with no meaning into the gemini block's contract.
     */
    @Override
    protected ChatOptions.Builder<?> optionsFor(String model, ModelTier tier, boolean carriesTools) {
        return ChatOptions.builder().model(model);
    }
}
