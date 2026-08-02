package io.mrkuhne.mezo.feature.companion.llm;

import com.google.genai.types.GenerateContentResponseUsageMetadata;
import io.mrkuhne.mezo.feature.llmlog.service.TokenUsage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.google.genai.metadata.GoogleGenAiUsage;
import org.springframework.stereotype.Component;

/**
 * The ONE place that reads Gemini's response metadata (mezo-2zyu) — a pure mapper, so the adapter
 * stays about calling and the audit log stays about recording.
 *
 * <p>Spring AI's portable {@link Usage} carries only prompt/completion/total. The thinking and
 * cached counts live on the Google-specific {@link GoogleGenAiUsage} (typed getters — the shape the
 * real adapter returns) or, failing that, on the raw provider payload reachable through
 * {@link Usage#getNativeUsage()}. Both are unwrapped here and NOWHERE else.
 *
 * <p><b>Never invents a number.</b> Every "absent" shape Spring AI can hand us is normalised to
 * {@code null} rather than {@code 0}, because a zero cost is indistinguishable from a genuinely free
 * call: an absent model arrives as {@code ""}, and an absent usage block arrives either as the
 * generic {@code EmptyUsage} or — on the real Google adapter — as {@code GoogleGenAiUsage.from(null)},
 * i.e. a fully-populated {@code 0/0/0}. Hence the all-zero guard rather than a type check: if prompt,
 * candidates AND total are all null-or-0, nothing was reported (a real generation always has
 * prompt &gt; 0; Spring AI's own {@code UsageCalculator.isEmpty} uses the same total==0 heuristic).
 *
 * <p><b>Tool rounds (bd mezo-58ig).</b> Spring AI 2.0's tool loop (ToolCallingAdvisor) hands the
 * caller the LAST round's response as the final one, so extracting from it alone under-reports a
 * multi-round turn (and the cumulative {@code DefaultUsage} shapes it sometimes builds carry
 * {@code nativeUsage = null}, dropping thoughts/cached entirely). The fix lives one level up:
 * {@link GeminiRoundUsageAdvisor} calls this extractor once per round and
 * {@link GeminiRoundUsage} sums the per-round reports — the adapter prefers that tally over this
 * final-response read whenever a round was observed.
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
        if (usage == null) {
            return null;
        }
        Integer prompt = usage.getPromptTokens();
        Integer candidates = usage.getCompletionTokens();
        Integer total = usage.getTotalTokens();
        if (nothingReported(prompt) && nothingReported(candidates) && nothingReported(total)) {
            return null;
        }

        Integer thoughts = null;
        Integer cached = null;
        if (usage instanceof GoogleGenAiUsage google) {
            // The real adapter's shape on a single-round call — a legitimate 0 (thinking off, nothing
            // cached) is kept AS 0; only a wholly absent usage block (above) becomes null.
            thoughts = google.getThoughtsTokenCount();
            cached = google.getCachedContentTokenCount();
        } else if (usage.getNativeUsage() instanceof GenerateContentResponseUsageMetadata nativeUsage) {
            thoughts = nativeUsage.thoughtsTokenCount().orElse(null);
            cached = nativeUsage.cachedContentTokenCount().orElse(null);
        }
        return new TokenUsage(prompt, candidates, thoughts, cached, total);
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
