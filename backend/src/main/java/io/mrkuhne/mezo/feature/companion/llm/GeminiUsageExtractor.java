package io.mrkuhne.mezo.feature.companion.llm;

import com.google.genai.types.GenerateContentResponseUsageMetadata;
import io.mrkuhne.mezo.feature.llmlog.service.TokenUsage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.EmptyUsage;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Component;

/**
 * The ONE place that reads Gemini's response metadata (mezo-2zyu) — a pure mapper, so the adapter
 * stays about calling and the audit log stays about recording.
 *
 * <p>Spring AI's portable {@link Usage} carries only prompt/completion/total; the thinking and
 * cached counts exist solely on the provider-native payload, which is why the Google type is
 * unwrapped here and NOWHERE else.
 *
 * <p><b>Never invents a number.</b> Spring AI's defaults are lies for our purposes — an absent usage
 * block arrives as {@link EmptyUsage} (0/0) and an absent model as {@code ""}. Both are normalised to
 * {@code null} so a row can honestly say "the provider reported nothing" instead of "it reported
 * zero" (see {@link TokenUsage}).
 */
@Component
public class GeminiUsageExtractor {

    /** Present on some provider responses as a plain metadata key — no typed getter exists for it. */
    private static final String SERVICE_TIER_KEY = "serviceTier";

    /** What one response revealed about itself; every component is nullable by design. */
    public record UsageInfo(String servedModel, String serviceTier, TokenUsage tokens) {

        static final UsageInfo NOTHING = new UsageInfo(null, null, null);
    }

    /** Null-safe end to end: a null response, metadata or usage block yields nulls, never zeros. */
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

    private static TokenUsage tokens(Usage usage) {
        if (usage == null || usage instanceof EmptyUsage) {
            return null;
        }
        Integer thoughts = null;
        Integer cached = null;
        if (usage.getNativeUsage() instanceof GenerateContentResponseUsageMetadata google) {
            thoughts = google.thoughtsTokenCount().orElse(null);
            cached = google.cachedContentTokenCount().orElse(null);
        }
        return new TokenUsage(
            usage.getPromptTokens(), usage.getCompletionTokens(), thoughts, cached, usage.getTotalTokens());
    }

    private static String serviceTier(ChatResponseMetadata metadata) {
        Object value = metadata.get(SERVICE_TIER_KEY);
        return value == null ? null : blankToNull(value.toString());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
