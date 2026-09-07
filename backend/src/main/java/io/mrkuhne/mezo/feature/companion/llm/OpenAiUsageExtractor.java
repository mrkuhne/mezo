package io.mrkuhne.mezo.feature.companion.llm;

import com.openai.models.completions.CompletionUsage;
import io.mrkuhne.mezo.feature.llmlog.service.TokenUsage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Component;

/**
 * The ONE place that reads OpenAI's response metadata (mezo-ozri.2) — the twin of
 * {@link GoogleGenAiUsageExtractor}, and the only file besides {@code OpenAiCompanionLlm} that is
 * allowed to know OpenAI types.
 *
 * <p>Where the numbers live (verified against spring-ai-openai 2.0.1 + openai-java-core 4.49.0):
 * {@code OpenAiChatModel#getDefaultUsage} builds a {@code DefaultUsage(prompt, completion, total,
 * nativeUsage, cachedTokens, null)}, so the CACHED count is reachable portably through
 * {@link Usage#getCacheReadInputTokens()}, while the REASONING count only exists on the native
 * {@link CompletionUsage} payload.
 *
 * <p><b>Reasoning is INSIDE the completion count</b> ({@code reasoning_tokens ⊂ completion_tokens}),
 * unlike Gemini's {@code thoughtsTokenCount}, which sits BESIDE {@code candidatesTokenCount}. The
 * count is still reported here because it is real and worth seeing; the double-billing it would
 * otherwise cause is prevented one level down, by the {@code INCLUDED_IN_OUTPUT} reasoning-billing
 * semantics frozen onto every OpenAI price row (mezo-ozri.1, spec §8.5).
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

    /**
     * mezo-8z79: the FINAL generation's finish reason. It lives on the per-generation metadata, not
     * on the response metadata the rest of this class reads — but it is still provider metadata, so
     * it is unwrapped HERE like everything else. Blank normalises to null, same rule as the model
     * id: "not reported" must never look like a value.
     */
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

    /**
     * Only on the native payload. A legitimate 0 (a non-reasoning model, or reasoning effort
     * {@code none}) is kept AS 0 — that is a report, not an absence.
     */
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
