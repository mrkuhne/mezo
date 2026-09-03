package io.mrkuhne.mezo.feature.companion.service;

/**
 * The day-review prose seam (mezo-jcpt.4, plan 2/2) — a consumer-owned port in the shape of
 * {@code MealCoachLlm}: {@link DayReviewService} declares exactly the two-string completion it
 * needs and never imports an adapter, a provider or {@code CompanionLlm} itself.
 *
 * <p>The only implementation is {@code DayReviewLlmAdapter} (companion/llm), which bridges to the
 * cheap {@code CompanionLlm} tier and is gated on the day-review + companion switches. When that
 * bean is absent — either switch off — the service's {@code ObjectProvider<DayReviewLlm>} is empty
 * and the day still answers 200 with its full deterministic evaluation and no prose. Prose is a
 * bonus over numbers that are already complete; it can never be the reason a read fails.
 */
public interface DayReviewLlm {

    /** One cheap-tier completion: the day-review system prompt + the assembled day payload. */
    String complete(String systemPrompt, String userMessage);
}
