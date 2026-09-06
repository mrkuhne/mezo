package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * What a rule concluded this evaluation (spec 2026-09-05 §4.1). {@code CLEAR} is the point of the
 * whole trace: the rule ran, read its inputs, and found them below its threshold — information
 * the engine used to compute and throw away.
 */
public enum FlagOutcome {
    /** The rule is true right now; {@code payload} carries the frozen inputs. */
    RAISED,
    /** The rule ran and is not true; {@code clear} carries the observed value and the threshold. */
    CLEAR,
    /** An honesty gate stopped the rule before it could judge; {@code reason} says which. */
    UNAVAILABLE
}
