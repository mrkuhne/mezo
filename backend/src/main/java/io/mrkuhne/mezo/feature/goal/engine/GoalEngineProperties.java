package io.mrkuhne.mezo.feature.goal.engine;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.goal.*} — the grounded-research tunables for the G5 goal engine (TDEE
 * bootstrap + projection + eval gate + prescription). See
 * docs/references/configuration_conventions.md.
 *
 * <p>Every magic number the engine services (G5 Tasks 5–8) consume lives here so there are no
 * hardcoded constants or {@code @Value} usages downstream. Each field documents its research
 * range as a {@code //} comment; the default sits inside (or at the recommended end of) that band.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.goal")
public record GoalEngineProperties(

    /** Physical-activity-level multipliers (BMR → TDEE), looked up by activity level in Task 5. */
    @NotNull @Valid Pal pal,

    /** Energy density of body mass (kcal per kg). Default 7700; research band 6000–7700. */
    @NotNull @Min(6000) @Max(7700) Integer kcalPerKg,

    /** Protein-target tunables (g per kg of body weight / lean body mass). */
    @NotNull @Valid Protein protein,

    /** Weight-change rate tunables (% of body weight per week). */
    @NotNull @Valid Rate rate,

    /** Training-volume guard tunables (weekly sets per muscle). */
    @NotNull @Valid Volume volume,

    /** Strength-guard tunables (estimated 1RM breach gate). */
    @NotNull @Valid Strength strength,

    /** EWMA smoothing tunables for the weight-trend engine. */
    @NotNull @Valid Ewma ewma,

    /** Per-session activity energy deltas (84 kg basis), used by the projection model. */
    @NotNull @Valid Met met,

    /**
     * Adaptive-thermogenesis haircut applied to the daily target (kcal/day). Default 0 (off);
     * optional research band 100–200 once metabolic adaptation is observed.
     */
    @NotNull @Min(0) @Max(200) Integer thermogenesisHaircutKcalPerDay,

    /** ± uncertainty band (kcal/day) around a bootstrapped TDEE before real intake data lands. */
    @NotNull @Positive Integer bootstrapUncertaintyKcal
) {

    /**
     * PAL multipliers per activity level. Five named bands rather than a Map so the lookup is
     * type-safe; the TDEE service (Task 5) maps the profile's activity-level value to one of these.
     * {@code moderate} is the engine default when activity level is unknown.
     */
    public record Pal(
        @NotNull @Positive Double sedentary, // 1.2
        @NotNull @Positive Double light,     // 1.375
        @NotNull @Positive Double moderate,  // 1.55 — DEFAULT
        @NotNull @Positive Double very,      // 1.725
        @NotNull @Positive Double extra      // 1.9
    ) {
    }

    /** Protein-target tunables — body-weight (BW) and lean-body-mass (LBM) bases. */
    public record Protein(
        @NotNull @Positive Double gPerKgBwDefault, // 2.0 — BW-based default
        @NotNull @Positive Double gPerKgBwFloor,   // 1.6 — BW-based lower bound
        @NotNull @Positive Double gPerKgBwCeil,    // 2.2 — BW-based upper bound
        @NotNull @Positive Double gPerKgLbmLow,    // 2.3 — LBM-based lower bound
        @NotNull @Positive Double gPerKgLbmHigh,   // 3.1 — LBM-based upper bound
        @NotNull @Positive Double gPerKgBwCap      // 2.6 — absolute BW-based cap
    ) {
    }

    /** Weight-change rate tunables, expressed as % of body weight per week. */
    public record Rate(
        @NotNull @Positive Double targetPctPerWeek, // 0.7 — recommended target
        @NotNull @Positive Double capPctPerWeek,    // 1.0 — hard cap
        @NotNull @Positive Double bandLow,          // 0.5 — sustainable band lower bound
        @NotNull @Positive Double bandHigh          // 1.0 — sustainable band upper bound
    ) {
    }

    /** Training-volume guard tunables (weekly hard sets per muscle group). */
    public record Volume(
        @NotNull @Positive Integer maintenanceSets, // 8 — maintenance volume floor
        @NotNull @Positive Integer warnBelow        // 6 — warn when weekly sets drop below this
    ) {
    }

    /** Strength-guard tunables. */
    public record Strength(
        // -5.0 — flag a strength regression when estimated 1RM drops by this % or more.
        @NotNull Double e1rmBreachPct
    ) {
    }

    /** EWMA smoothing tunables for the weight-trend engine. */
    public record Ewma(
        @NotNull @Min(10) @Max(14) Integer halfLifeDays // 10 — research band 10–14
    ) {
    }

    /** Per-session activity energy deltas (kcal), calibrated to an 84 kg athlete. */
    public record Met(
        @NotNull @Positive Integer hypertrophyKcal,   // 325 — hypertrophy lifting session
        @NotNull @Positive Integer intervalRunKcal,   // 500 — interval run
        @NotNull @Positive Integer volleyballRecKcal, // 500 — recreational volleyball
        @NotNull @Positive Integer volleyballCompKcal // 1150 — competitive volleyball
    ) {
    }
}
