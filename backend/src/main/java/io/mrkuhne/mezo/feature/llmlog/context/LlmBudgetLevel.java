package io.mrkuhne.mezo.feature.llmlog.context;

/**
 * How much of an account's rolling USD ceiling is gone, expressed as the graded service level that
 * follows from it (mezo-ozri.6, spec §C1).
 *
 * <p>Declaration order IS severity order — {@link #atLeast} compares ordinals — so a new state has
 * to be INSERTED at its severity, never appended.
 */
public enum LlmBudgetLevel {

    /** Below every threshold, or not measurable at all: full service. */
    OK,

    /** Past degrade-at-percent: every call routes onto the provider's cheap tier. */
    DEGRADED,

    /** Past throttle-cron-at-percent: the configured expensive generators are suspended as well. */
    THROTTLED,

    /** Past stop-at-percent: every capped call is refused until the rolling window moves on. */
    STOPPED;

    /** True when this level is {@code other} or worse — the severity comparison, spelled out. */
    public boolean atLeast(LlmBudgetLevel other) {
        return ordinal() >= other.ordinal();
    }
}
