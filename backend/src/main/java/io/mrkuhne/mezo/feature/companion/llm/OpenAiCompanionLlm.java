package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
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

    /**
     * @param chatModel the OPENAI ChatModel, qualified by bean name (mezo-ozri.1): google-genai
     *                  contributes {@code googleGenAiChatModel} in the same context, so an
     *                  unqualified injection point would be ambiguous.
     * @param llmUsageExtractor the OPENAI usage extractor, qualified for the same reason.
     * @param geminiCompanionLlm the media delegate — see the class javadoc. Injected by CONCRETE
     *                  type on purpose: a {@code CompanionLlm} parameter would resolve to
     *                  {@code this}, since this bean is the primary one.
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
     * One tier's default options. {@code streamOptions.includeUsage} is a CORRECTNESS invariant, not
     * a tunable (spec §8.6): without it OpenAI sends no usage block on a streamed response, and every
     * streamed row is persisted with null tokens and null cost — silently, because nothing fails. It
     * is stated HERE rather than in {@code spring.ai.openai.chat.stream-options.include-usage} so it
     * cannot depend on option-merge order or be lost to a YAML edit;
     * {@code OpenAiCompanionLlmOptionsTest} keeps it stated.
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
