package io.mrkuhne.mezo.feature.companion.flags.config;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * W5.1 composite-flag tuning (bd mezo-b3pp.18, spec §9.1) — EVERY threshold, window and cooldown
 * is config, never code. The {@code FeedbackLearningProperties}/{@code ProfileProperties}
 * precedent: a feature-scoped {@code @ConfigurationProperties} record rather than another field on
 * the already-large shared {@code CompanionProperties}.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.flags")
public record FlagProperties(

    /** Hourly sweep schedule — the windows that are crossed by time alone, with no write. */
    @NotBlank String sweepCron,

    @NotNull @Valid SustainedStress sustainedStress,
    @NotNull @Valid SleepDebt sleepDebt,
    @NotNull @Valid Momentum momentum,
    @NotNull @Valid Recovery recovery,
    @NotNull @Valid AllHealthy allHealthy,
    @NotNull @Valid LoggingGap loggingGap,
    @NotNull @Valid MissedWorkouts missedWorkouts,
    @NotNull @Valid CooldownHours cooldownHours
) {

    /** Check-in stress is a 1–10 scale (the contract's SaveCheckInRequest bounds). */
    public record SustainedStress(
        @DecimalMin("1.0") @DecimalMax("10.0") double threshold,
        @Min(2) @Max(30) int windowDays,
        @Min(1) @Max(30) int minDays
    ) {
    }

    public record SleepDebt(
        /** How many nights back (ending TODAY — sleep_log.date is the wake morning, so today's
         *  row is last night) the deficit is accumulated over. */
        @Min(1) @Max(30) int nights,
        /** Honest small-n gate: fewer logged nights than this inside the window ⇒ no flag. */
        @Min(1) @Max(30) int minNights,
        /** Cumulative deficit (hours) at or above which the flag raises. */
        @DecimalMin("0.5") @DecimalMax("40.0") double deficitHours,
        /** Used only when the user has no sleep_goal row at all. */
        @DecimalMin("4.0") @DecimalMax("12.0") double defaultGoalHours
    ) {
    }

    public record Momentum(
        /** Recent window (days, ending yesterday) whose habit-completion average is compared. */
        @Min(1) @Max(30) int windowDays,
        /** Baseline window (days) immediately preceding the recent window. */
        @Min(3) @Max(120) int baselineDays,
        /** Fraction of the baseline the recent average must fall by (0.5 = halved). */
        @DecimalMin("0.05") @DecimalMax("1.0") double dropRatio,
        /** Honest floor: below this baseline average there is no momentum to lose. */
        @DecimalMin("0.0") @DecimalMax("20.0") double minBaseline
    ) {
    }

    public record Recovery(
        /** The "same 48h" window as whole days, today included (2 = today + yesterday). */
        @Min(1) @Max(7) int windowDays,
        @DecimalMin("0.0") @DecimalMax("12.0") double sleepFloorHours,
        @DecimalMin("1.0") @DecimalMax("10.0") double rpeThreshold,
        @DecimalMin("1.0") @DecimalMax("10.0") double stressThreshold
    ) {
    }

    public record AllHealthy(
        /** No other flag raised for this many days ⇒ the quiet state is itself worth recording. */
        @Min(1) @Max(90) int quietDays
    ) {
    }

    public record LoggingGap(
        /** Hours since the last meal row (its {@code logged_at}) at or above which meals count
         *  as stale. */
        @Min(6) @Max(336) int mealStaleHours,
        /** Hours since the last check-in row (its {@code saved_at}) at or above which check-ins
         *  count as stale. */
        @Min(6) @Max(336) int checkinStaleHours,
        /** Consecutive missing wake-mornings (sleep_log.date) at or above which sleep counts as
         *  stale. Mornings, not hours: sleep_log has no clock field, only the wake date. */
        @Min(1) @Max(14) int sleepStaleMornings,
        /** How many domains must be stale at once for the flag to raise. */
        @Min(1) @Max(3) int minStaleDomains,
        /** Sleep-debt suspicion (spec §4 row 5): when the window has too few logged nights for
         *  sleep_debt to speak, but the nights that ARE logged average at least this deficit,
         *  the payload carries the suspicion instead of staying silent. */
        @DecimalMin("0.25") @DecimalMax("6.0") double sleepSuspicionDeficitHours
    ) {
    }

    public record MissedWorkouts(
        /** How far back (days, ending YESTERDAY — today is still in progress) planned gym days
         *  are scanned, clamped to never start before the current schedule's oldest slot was
         *  created (review fix, bd mezo-d58h.2). */
        @Min(2) @Max(60) int windowDays,
        /** Consecutive PLANNED gym days with no completed instance needed to raise. Consecutive
         *  in the sequence of planned days, not in calendar days. */
        @Min(2) @Max(14) int minConsecutiveMissed
    ) {
    }

    /** Per-flag re-raise cooldown; a flag re-raises only once its own window has passed. */
    public record CooldownHours(
        @Min(1) @Max(8760) int sustainedStress,
        @Min(1) @Max(8760) int sleepDebt,
        @Min(1) @Max(8760) int momentumAtRisk,
        @Min(1) @Max(8760) int recoveryNeeded,
        @Min(1) @Max(8760) int allHealthy,
        @Min(1) @Max(8760) int loggingGap,
        @Min(1) @Max(8760) int missedWorkouts,
        @Min(1) @Max(8760) int acuteBadDay,
        @Min(1) @Max(8760) int loadFuelMismatch,
        @Min(1) @Max(8760) int rapidWeightLoss,
        @Min(1) @Max(8760) int jointOveruse,
        @Min(1) @Max(8760) int ignoredNudge,
        @Min(1) @Max(8760) int lateEating
    ) {

        /** The cooldown for {@code flagKey} — keeps the switch out of the service. */
        public int forFlag(String flagKey) {
            return switch (flagKey) {
                case "sustained_stress" -> sustainedStress;
                case "sleep_debt" -> sleepDebt;
                case "momentum_at_risk" -> momentumAtRisk;
                case "recovery_needed" -> recoveryNeeded;
                case "all_healthy" -> allHealthy;
                case "logging_gap" -> loggingGap;
                case "missed_workouts" -> missedWorkouts;
                case "acute_bad_day" -> acuteBadDay;
                case "load_fuel_mismatch" -> loadFuelMismatch;
                case "rapid_weight_loss" -> rapidWeightLoss;
                case "joint_overuse" -> jointOveruse;
                case "ignored_nudge" -> ignoredNudge;
                case "late_eating" -> lateEating;
                default -> throw new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_FLAG_UNKNOWN_KEY").params(List.of(flagKey)).build());
            };
        }
    }
}
