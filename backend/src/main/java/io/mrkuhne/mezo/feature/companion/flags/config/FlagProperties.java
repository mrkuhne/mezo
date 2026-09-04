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
    @NotNull @Valid CooldownHours cooldownHours,

    @NotNull @Valid AcuteBadDay acuteBadDay,
    @NotNull @Valid LoadFuelMismatch loadFuelMismatch,
    @NotNull @Valid RapidWeightLoss rapidWeightLoss,
    @NotNull @Valid JointOveruse jointOveruse,
    @NotNull @Valid IgnoredNudge ignoredNudge,
    @NotNull @Valid LateEating lateEating
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

    /** Spec 2026-09-03 §4 row 6 (rank 1, the most urgent card). Reads today's check-ins directly
     *  (a day average would destroy the signal), never the sweep's metric series. */
    public record AcuteBadDay(
        /** Fewer than this many check-ins logged today ⇒ honest silence — one bad check-in is a
         *  moment, not a day. */
        @Min(1) @Max(20) int minCheckIns,
        /** body/energy (1–10 scale, nullable — a null is "not answered", not a low score) at or
         *  below this counts as a "bad" check-in. */
        @Min(1) @Max(10) int bodyOrEnergyAtMost
    ) {
    }

    /** Spec 2026-09-03 §4 row 2 (rank 2): 7-day training load vs. fuel/sleep conjunction. */
    public record LoadFuelMismatch(
        @Min(2) @Max(30) int windowDays,
        /** {@code COMBINED_LOAD_MIN} 7-day average (minute-equivalents/day: sport minutes + gym
         *  kg-volume ÷ {@code mezo.companion.patterns.load-gym-kg-per-min}) at or above which the
         *  week counts as high-load. Derived from spec §0's live evidence week (2026-08-25 →
         *  08-31): 3 gym days (~40 min-equiv each from a typical hypertrophy-block tonnage of
         *  ~4000 kg ÷ 100 kg/min ⇒ 120 min-equiv) + volleyball 120′+240′+120′ = 480 min ⇒
         *  600 min-equiv / 7 days ≈ 85.7 min-equiv/day average. 50.0 sits well below that (the
         *  documented week would have raised) and well above a rest week's average (one 60′
         *  session ÷ 7 ≈ 8.6 min-equiv/day would not). */
        @DecimalMin("0.0") @DecimalMax("300.0") double loadThreshold,
        /** 7-day kcal average below this fraction of the user's target counts as under-fuelled. */
        @DecimalMin("0.1") @DecimalMax("1.0") double kcalFractionOfTarget,
        /** 7-day sleep average below this (hours) counts as under-recovered. */
        @DecimalMin("0.0") @DecimalMax("12.0") double sleepFloorHours,
        /** Honest small-n gate, checked independently on EACH side (kcal, sleep) since the load
         *  series' zeros are real and cannot supply a "was it logged" count — below this many
         *  logged days on either side, {@code logging_gap} owns the story instead. */
        @Min(1) @Max(30) int minLoggedDaysPerSide
    ) {
    }

    /** Spec 2026-09-03 §4 row 10 (rank 3). */
    public record RapidWeightLoss(
        /** WEIGHT_TREND_PCT_WK at or below this (more negative — a % per week, so the bound is
         *  negative) raises the flag. */
        @DecimalMin("-20.0") @DecimalMax("-0.1") double pctPerWeekAtMost,
        /** Honest small-n gate on the weigh-in count backing the trend. */
        @Min(2) @Max(30) int minWeighIns
    ) {
    }

    /** Spec 2026-09-03 §4 row 16 (rank 4, offers {@code lighten_tomorrow}). */
    public record JointOveruse(
        @Min(2) @Max(30) int windowDays,
        @DecimalMin("1.0") @DecimalMax("10.0") double strainAvgAtLeast,
        /** Substring matched against tomorrow's planned session's {@code MuscleGroup}, e.g.
         *  {@code "shoulder"}. */
        @NotBlank String muscleNeedle
    ) {
    }

    /** Spec 2026-09-03 §4 (rank 8, offers {@code shift_sleep_anchor}): a push sent on N
     *  consecutive nights with observed bedtime never within tolerance of the anchor. */
    public record IgnoredNudge(
        /** {@code NotificationCategory} wire value of the ignored push, e.g. {@code "lights_out"}. */
        @NotBlank String category,
        @Min(2) @Max(30) int minConsecutiveDays,
        /** Observed bedtime within this many minutes of the anchor counts as compliant. */
        @Min(1) @Max(1440) int nonComplianceMinutes
    ) {
    }

    /** Spec 2026-09-03 §4 (rank 9): last meal too close to bedtime, or too late outright, on
     *  enough of the last 3 days. */
    public record LateEating(
        /** Last meal within this many minutes of the bedtime anchor counts as "late". */
        @Min(1) @Max(600) int minutesBeforeBed,
        /** FRACTIONAL hour — {@code MetricKey.LATE_MEAL_HOUR}'s own unit, e.g. 22.5 == 22:30.
         *  Never "fix" this into a clock string; the metric series is a double. */
        @DecimalMin("0.0") @DecimalMax("30.0") double absoluteHour,
        /** Of the last {@code windowDays} days, at least this many must qualify (either
         *  condition) to raise. */
        @Min(1) @Max(30) int minDaysOfLastThree,
        @Min(1) @Max(30) int windowDays
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
