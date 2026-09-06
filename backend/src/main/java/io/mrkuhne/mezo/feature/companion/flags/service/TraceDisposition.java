package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * What {@code FlagService} did with a RAISED verdict (spec §4.2). Null for a verdict that never
 * reached the cooldown gate, because the rule did not fire.
 */
public enum TraceDisposition {
    /** Written to {@code companion_flag_log} and published as a raise. */
    LOGGED,
    /** True, but the same flag spoke inside its cooldown window — so it stayed quiet. */
    SUPPRESSED_BY_COOLDOWN
}
