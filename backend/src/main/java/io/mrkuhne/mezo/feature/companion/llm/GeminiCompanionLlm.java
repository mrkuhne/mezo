package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
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
 * bean. Its tiers therefore come from the {@code llm.gemini} block, never from "the active
 * provider": under {@code provider: openai} that would hand it a GPT model id it cannot serve.
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
     */
    public GeminiCompanionLlm(@Qualifier("googleGenAiChatModel") ChatModel chatModel,
                              CompanionProperties companionProperties,
                              LlmCallRecorder llmCallRecorder, LlmCallContextHolder llmCallContextHolder,
                              @Qualifier("googleGenAiUsageExtractor") LlmUsageExtractor llmUsageExtractor) {
        super(chatModel, llmUsageExtractor,
            // the cheap/fast tier (llm.gemini.chat-model): every conversational turn
            ChatOptions.builder().model(companionProperties.llm().gemini().chatModel()).build(),
            // V3.2: the smart tier (llm.gemini.smart-model) — weekly pipelines only, never chat turns
            ChatOptions.builder().model(companionProperties.llm().gemini().smartModel()).build(),
            llmCallRecorder, llmCallContextHolder);
    }
}
