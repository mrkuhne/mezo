package io.mrkuhne.mezo.feature.llmlog.context;

/**
 * The pre-flight budget question, asked by {@link LlmCallContextHolder#runWith} once per tagged
 * operation (mezo-ozri.6, spec §C2).
 *
 * <p>A port rather than a direct dependency for two reasons: it keeps {@code llmlog.context} free of
 * a repository edge, and it lets the holder's nineteen unit-test construction sites keep saying
 * {@code new LlmCallContextHolder()} without dragging in a database.
 */
public interface LlmBudgetGate {

    /** The gate that never says no — the no-arg holder constructor's default, for unit tests. */
    LlmBudgetGate OPEN = new LlmBudgetGate() {};

    /**
     * The level THIS call has to live with. Never null: an unmeasurable call — no actor, cap
     * disabled, audit log off — is {@link LlmBudgetLevel#OK}, because a ceiling that cannot see
     * spend must not invent it.
     */
    default LlmBudgetLevel levelFor(String feature) {
        return LlmBudgetLevel.OK;
    }

    /** True when {@code feature} is one of the expensive generators the throttle step suspends. */
    default boolean isThrottled(String feature) {
        return false;
    }
}
