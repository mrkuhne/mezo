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
        /** How many nights back (ending yesterday) the deficit is accumulated over. */
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

    /** Per-flag re-raise cooldown; a flag re-raises only once its own window has passed. */
    public record CooldownHours(
        @Min(1) @Max(8760) int sustainedStress,
        @Min(1) @Max(8760) int sleepDebt,
        @Min(1) @Max(8760) int momentumAtRisk,
        @Min(1) @Max(8760) int recoveryNeeded,
        @Min(1) @Max(8760) int allHealthy
    ) {

        /** The cooldown for {@code flagKey} — keeps the switch out of the service. */
        public int forFlag(String flagKey) {
            return switch (flagKey) {
                case "sustained_stress" -> sustainedStress;
                case "sleep_debt" -> sleepDebt;
                case "momentum_at_risk" -> momentumAtRisk;
                case "recovery_needed" -> recoveryNeeded;
                case "all_healthy" -> allHealthy;
                default -> throw new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_FLAG_UNKNOWN_KEY").params(List.of(flagKey)).build());
            };
        }
    }
}
