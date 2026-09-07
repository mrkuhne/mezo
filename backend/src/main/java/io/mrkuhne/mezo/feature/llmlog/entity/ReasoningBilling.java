package io.mrkuhne.mezo.feature.llmlog.entity;

/**
 * How ONE model's reasoning ("thinking") tokens relate to its output tokens for billing
 * (mezo-ozri.1, spec §8.5) — a property of the model, not a provider name, so a future model that
 * changes its reporting is a config edit.
 *
 * <p>It is FROZEN onto every {@link PricingSnapshot}: a row priced under one semantics must keep
 * costing what it cost, exactly like the unit rates.
 */
public enum ReasoningBilling {

    /**
     * The provider reports reasoning tokens BESIDE the output tokens (Gemini's
     * {@code thoughtsTokenCount} next to {@code candidatesTokenCount}), so they are their own
     * billable category. The default for every price row that does not say otherwise.
     */
    SEPARATE,

    /**
     * The provider reports reasoning tokens INSIDE the output tokens (OpenAI's
     * {@code reasoning_tokens} ⊂ {@code completion_tokens}). Billing them again would charge the
     * same tokens twice, so the reasoning category contributes nothing — the count is still stored,
     * because it is real and worth reporting on.
     */
    INCLUDED_IN_OUTPUT
}
