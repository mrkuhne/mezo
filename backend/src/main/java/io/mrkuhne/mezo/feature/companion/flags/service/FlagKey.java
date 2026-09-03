package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * The composite state flags (Phase 5 W5.1, bd mezo-b3pp.18, spec §9.1; `logging_gap` /
 * `missed_workouts` added by the round-1 coaching spec 2026-09-03 §4) and the two raise
 * sources — string constants, mirroring {@code ck_companion_flag_log_flag_key} /
 * {@code ck_companion_flag_log_source} exactly. Constants, not an enum: the column is a varchar
 * with a DB CHECK (the {@code MessageFeedbackEntity} verdict/reason precedent), and W5.2's
 * intervention config keys flags by these very strings.
 */
public final class FlagKey {

    public static final String SUSTAINED_STRESS = "sustained_stress";
    public static final String SLEEP_DEBT = "sleep_debt";
    public static final String MOMENTUM_AT_RISK = "momentum_at_risk";
    public static final String RECOVERY_NEEDED = "recovery_needed";
    public static final String ALL_HEALTHY = "all_healthy";
    public static final String LOGGING_GAP = "logging_gap";
    public static final String MISSED_WORKOUTS = "missed_workouts";

    public static final String SOURCE_WRITE = "write";
    public static final String SOURCE_SWEEP = "sweep";

    private FlagKey() {
    }
}
