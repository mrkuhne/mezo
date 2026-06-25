package io.mrkuhne.mezo.feature.progression.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Progression tuning (mezo.progression). P1: level curve. P2: gym + run XP weights. */
@Validated
@ConfigurationProperties(prefix = "mezo.progression")
public record ProgressionProperties(
    @NotNull @Valid Curve curve,
    @NotNull @Valid Gym gym,
    @NotNull @Valid Run run
) {
    /** Level threshold curve: xpThreshold(n) = round(base * (n-1)^exp), xpThreshold(1)=0. */
    public record Curve(
        @NotNull @Positive Integer base,  // 100
        @NotNull @Positive Double exp     // 1.6
    ) {}

    /** Gym-path XP weights (volume → muscle levels; e1RM → max_strength; sets → strength_endurance). */
    public record Gym(
        @NotNull @Positive Integer volumeUnit,                // 100 (kg·reps per XP unit)
        @NotNull @Positive Integer volumeXpPerUnit,           // 10 (muscle XP per volume unit)
        @NotNull @PositiveOrZero Integer e1rmXpPerKg,         // 2 (max_strength XP per best-e1RM kg)
        @NotNull @PositiveOrZero Integer prBonusXp,           // 40 (bonus when e1RM beats prior best)
        @NotNull @PositiveOrZero Integer strengthEnduranceXpPerSet, // 8 (per logged work set)
        @NotNull @PositiveOrZero Integer bodyweightXpPerRep,  // 1 (flat XP per bodyweight rep)
        @NotNull @Valid Robustness robustness
    ) {}

    /** Streak-only robustness (v1): perWeekXp × consecutive training weeks. */
    public record Robustness(
        @NotNull @Positive Integer perWeekXp  // 25
    ) {}

    /** Run-path XP weights (sprint: rounds/RPE/landmark; steady: minutes + HR-recovery). */
    public record Run(
        @NotNull @PositiveOrZero Integer sprintXpPerRound,    // 25 (sprint_speed per completed round)
        @NotNull @PositiveOrZero Integer anaerobicXpPerRound, // 15 (anaerobic_capacity per round)
        @NotNull @PositiveOrZero Integer steadyXpPerMin,      // 4 (strength_endurance per minute)
        @NotNull @PositiveOrZero Integer aerobicXpPerMin,     // 5 (aerobic_capacity per minute)
        @NotNull @PositiveOrZero Integer rpeXpPerPoint,       // 6 (explosiveness/effort per RPE point)
        @NotNull @PositiveOrZero Integer hrRecoveryBonusXp    // 30 (aerobic bonus when HR-recovery logged)
    ) {}
}
