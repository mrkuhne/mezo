package io.mrkuhne.mezo.feature.goal.engine;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.Map;
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

    /** NEAT lifestyle multipliers (BMR → TDEE baseline), looked up by activity level in Task 5. */
    @NotNull @Valid Neat neat,

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

    /** Diet-split tunables (slice 1): preset fat energy-shares + the fat g/kg floor. */
    @NotNull @Valid Diet diet,

    /**
     * Adaptive-thermogenesis haircut applied to the daily target (kcal/day). Default 0 (off);
     * optional research band 100–200 once metabolic adaptation is observed.
     */
    @NotNull @Min(0) @Max(200) Integer thermogenesisHaircutKcalPerDay,

    /** ± uncertainty band (kcal/day) around a bootstrapped TDEE before real intake data lands. */
    @NotNull @Positive Integer bootstrapUncertaintyKcal,

    /** Suggest+approve trigger tunables (slice 4). */
    @NotNull @Valid Suggestion suggestion
) {

    /**
     * NEAT (non-exercise activity thermogenesis) multipliers per lifestyle band. The lifestyle band
     * is the NON-exercise daily life; training energy is added explicitly (weekly scheduled EAT), never
     * baked into this multiplier. {@code mixed} is the engine default when the band is unknown.
     */
    public record Neat(
        @NotNull @Positive Double desk,      // 1.20 — desk job, few steps
        @NotNull @Positive Double mixed,     // 1.35 — on feet a fair bit — DEFAULT
        @NotNull @Positive Double physical   // 1.50 — physical job, on feet all day
    ) {
        /** Maps a {@code BiometricProfile.activityLevel} (DESK|MIXED|PHYSICAL, case-insensitive) to its
         *  NEAT multiplier; {@code mixed} (1.35) for null/unknown. */
        public Double forLevel(String activityLevel) {
            if (activityLevel == null) {
                return mixed;
            }
            return switch (activityLevel.trim().toUpperCase()) {
                case "DESK" -> desk;
                case "PHYSICAL" -> physical;
                default -> mixed; // MIXED + any legacy/unknown value
            };
        }
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

    /** Diet-split tunables. Fat share = fraction of segment kcal; floor per ISSN (~0.5 g/kg). */
    public record Diet(
        @NotNull @Positive Double fatShareBalanced, // 0.275 — reproduces the pre-slice-1 FE constant
        @NotNull @Positive Double fatShareLowFat,   // 0.20
        @NotNull @Positive Double fatShareLowCarb,  // 0.40
        @NotNull @Positive Double fatShareHighCarb, // 0.22
        @NotNull @Positive Double fatFloorGPerKg    // 0.5 — hormonal-health fat minimum
    ) {
        /** Fat energy-share for a preset; custom reads the request's tenths-of-percent; unknown → balanced. */
        public double fatShareFor(String preset, Integer fatPctX10) {
            if (preset == null) {
                return fatShareBalanced;
            }
            return switch (preset) {
                case "low_fat" -> fatShareLowFat;
                case "low_carb" -> fatShareLowCarb;
                case "high_carb" -> fatShareHighCarb;
                case "custom" -> fatPctX10 == null ? fatShareBalanced : fatPctX10 / 1000.0;
                default -> fatShareBalanced;
            };
        }
    }

    /**
     * Meso goalPreset → suggested goal trajectory. The preset vocabulary is FE-OWNED strings
     * (frontend/src/data/train/train.ts GOAL_PRESETS ids; backend only stores/echoes them —
     * mezo-dq60), so the mapping is config, not an enum: an unknown/new preset simply has no
     * opinion. Absent key = no suggestion (strength/sport are trajectory-neutral).
     */
    public record Suggestion(
        @NotNull Map<String, String> presetTrajectory
    ) {
    }
}
