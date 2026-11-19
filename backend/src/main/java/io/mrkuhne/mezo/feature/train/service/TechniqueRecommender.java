package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * The per-exercise technique recommendation (mezo-r36n9.98, owner 2026-11-19). Pure and rule-based: for every
 * exercise that may carry a technique at all (a {@code stable} one, {@link TechniqueRules}) it names one technique
 * and a short reason code the phone words in Hungarian, plus whether the exercise suits the day's half-rep challenge.
 *
 * <p>It reuses the planner's own pick ({@link TechniquePlanner#defaultTechnique}: myo for a high-rep isolation,
 * rest-drop for a machine / cable exercise) and only adds what the planner leaves open: a stable exercise that is
 * safe in the stretched position gets {@code partials}; anything else stable gets {@code none}. The planner's
 * placement rules (allowance, tiers, last exercise of the group, weeks) are NOT applied — this is advice about the
 * exercise itself, not the week's plan.
 */
public final class TechniqueRecommender {

    /** A stable isolation whose rep range reaches the myo threshold → {@code myo}. */
    public static final String REASON_ISOLATION_PUMP = "isolation_pump";
    /** A stable machine or cable exercise → {@code rest_drop}. */
    public static final String REASON_STABLE_MACHINE = "stable_machine";
    /** Stable and lengthened-friendly, neither of the above → {@code partials}. */
    public static final String REASON_LENGTHENED_SAFE = "lengthened_safe";
    /** The exercise's effective style is all-out: it already ends at failure → {@code none}. */
    public static final String REASON_ALL_OUT = "all_out";
    /** Stable, but no technique fits (e.g. a stable dumbbell compound not safe when stretched) → {@code none}. */
    public static final String REASON_NO_SAFE_TECHNIQUE = "no_safe_technique";

    private TechniqueRecommender() {}

    /** One exercise's recommendation; positions as the evaluator's ({@code dayIndex}, {@code exerciseIndex}). */
    public record Recommendation(int dayIndex, int exerciseIndex, Technique technique, String reason,
                                 boolean challengeFit) {}

    /** The recommendation for one row; empty when the exercise may not carry a technique (not stable). */
    public static Optional<Recommendation> recommend(TechniquePlanner.PlanRow row,
                                                     TrainTechniqueProperties.Planner cfg) {
        if (!row.attrs().stable()) {
            return Optional.empty();
        }
        boolean challengeFit = TechniqueRules.check(Technique.NONE, true, row.attrs()).isEmpty();
        Technique technique;
        String reason;
        if (row.effectiveStyle() == TrainingStyle.ALLOUT) {
            technique = Technique.NONE;
            reason = REASON_ALL_OUT;
        } else {
            Optional<Technique> planned = TechniquePlanner.defaultTechnique(row, cfg);
            if (planned.isPresent()) {
                technique = planned.get();
                reason = technique == Technique.MYO ? REASON_ISOLATION_PUMP : REASON_STABLE_MACHINE;
            } else if (TechniqueRules.check(Technique.PARTIALS, false, row.attrs()).isEmpty()) {
                technique = Technique.PARTIALS;
                reason = REASON_LENGTHENED_SAFE;
            } else {
                technique = Technique.NONE;
                reason = REASON_NO_SAFE_TECHNIQUE;
            }
        }
        return Optional.of(new Recommendation(row.dayIndex(), row.exerciseIndex(), technique, reason, challengeFit));
    }

    /** Every recommendation of a block week, by day then exercise position. */
    public static List<Recommendation> recommend(List<TechniquePlanner.PlanDay> days,
                                                 TrainTechniqueProperties.Planner cfg) {
        List<Recommendation> out = new ArrayList<>();
        for (TechniquePlanner.PlanDay day : days) {
            for (TechniquePlanner.PlanRow row : day.rows()) {
                recommend(row, cfg).ifPresent(out::add);
            }
        }
        out.sort(Comparator.comparingInt(Recommendation::dayIndex).thenComparingInt(Recommendation::exerciseIndex));
        return List.copyOf(out);
    }
}
