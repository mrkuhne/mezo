package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

/**
 * The spec §4 severity order (2026-09-03 design, bottom of §4) as an integer rank — S4's
 * replacement for the two independent first-wins gates S1–S3 shipped. Lower rank wins.
 *
 * <p>Pure static lookup, deliberately NOT config: this is the spec's editorial ranking of which
 * problem deserves the day's single card, not a threshold. Thresholds stay in
 * {@code FlagProperties} / {@code SetupCheckProperties}.
 *
 * <p>An unknown key ranks LAST and logs a warning rather than throwing — an unmapped key must
 * never blow up delivery inside {@code InterventionEventListener}'s catch, which is exactly the
 * failure mode {@code FlagProperties.CooldownHours.forFlag}'s throwing default produces.
 * {@code AdvicePriorityTest} asserts every live {@link FlagKey} constant is present, so the
 * warning path is a genuine last resort rather than the normal way a new key behaves.
 *
 * <p>Round 2 S1 (bd mezo-d58h.7.1): {@link FlagKey#PROTOCOL_LAPSE} sits at the very tail of the
 * flag block — it is the gentlest signal in the system (grace-window copy, never blame), so it
 * must never displace a health card ranked ahead of it.
 */
@Slf4j
public final class AdvicePriority {

    /**
     * Highest severity first. The six S6 keys are {@link FlagKey} constants (bd mezo-d58h.6):
     * the constants, the {@code ck_companion_flag_log_flag_key} CHECK and the two mirroring
     * {@code @Pattern} regexes all widened in the same change (bd memory:
     * adding-a-flagkey-needs-five-mirrored-changes).
     *
     * <p>The round-0 tail order (recovery → stress → momentum → all_healthy) is a plan decision:
     * the spec only ranks them collectively, below the setup cards.
     */
    public static final List<String> ORDER = List.of(
        FlagKey.ACUTE_BAD_DAY,
        FlagKey.LOAD_FUEL_MISMATCH,
        FlagKey.RAPID_WEIGHT_LOSS,
        FlagKey.JOINT_OVERUSE,
        FlagKey.MISSED_WORKOUTS,
        FlagKey.SLEEP_DEBT,
        FlagKey.LOGGING_GAP,
        FlagKey.IGNORED_NUDGE,
        FlagKey.LATE_EATING,
        FlagKey.PROTOCOL_LAPSE,
        SetupCheckService.CHECK_MISSING_SLEEP_GOAL,
        SetupCheckService.CHECK_PLAN_FEASIBILITY,
        FlagKey.RECOVERY_NEEDED,
        FlagKey.SUSTAINED_STRESS,
        FlagKey.MOMENTUM_AT_RISK,
        FlagKey.ALL_HEALTHY);

    private AdvicePriority() {
    }

    /** Lower is more severe; an unknown (or null) key ranks one past the end of the table. */
    public static int rankOf(String adviceKey) {
        int index = adviceKey == null ? -1 : ORDER.indexOf(adviceKey);
        if (index < 0) {
            log.warn("Advice key {} has no severity rank — ranking it last. Add it to "
                + "AdvicePriority.ORDER (spec 2026-09-03 §4).", adviceKey);
            return ORDER.size();
        }
        return index;
    }

    /** STRICT: an equal-ranked candidate does not displace the incumbent, so a re-raise of the
     *  same flag leaves the day's card (and its „Segített?" votes) alone. */
    public static boolean outranks(String candidateKey, String incumbentKey) {
        return rankOf(candidateKey) < rankOf(incumbentKey);
    }
}
