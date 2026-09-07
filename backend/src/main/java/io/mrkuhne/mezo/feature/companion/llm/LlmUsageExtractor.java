package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.llmlog.service.TokenUsage;
import org.springframework.ai.chat.model.ChatResponse;

/**
 * Unwraps ONE provider's response metadata into the audit log's provider-neutral vocabulary
 * (mezo-ozri.1). Spring AI's portable {@code Usage} carries only prompt/completion/total; the
 * reasoning and cached counters live on provider-specific subtypes, and reading them is the ONE
 * place per provider that is allowed to know the provider's types.
 *
 * <p>Contract for every implementation: <b>never invent a number</b>. Anything the provider did not
 * report is {@code null}, never {@code 0} — a zero cost is indistinguishable from a genuinely free
 * call. A null response, null metadata or an all-zero usage block yields {@link UsageInfo#NOTHING}.
 */
public interface LlmUsageExtractor {

    /** What one response revealed about itself; every component is nullable by design. */
    record UsageInfo(String servedModel, String serviceTier, TokenUsage tokens) {

        public static final UsageInfo NOTHING = new UsageInfo(null, null, null);
    }

    /** Null-safe end to end: a null response, metadata or usage block yields nulls, never zeros. */
    UsageInfo extract(ChatResponse response);

    /** The FINAL generation's finish reason; blank and absent both normalise to {@code null}. */
    String finishReason(ChatResponse response);
}
