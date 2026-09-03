package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.DayEvaluationProperties;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Pure day-evaluation engine (mezo-jcpt.4, plan 2/2): a deterministic 6-dimension score over an
 * already-resolved {@link DayInputs} carrier — no repository/data access, same house style as
 * {@code MealScoringService} (pure math over pre-scaled inputs + config, fully unit-testable).
 * {@code DayScoreService} (Task 5) resolves and fills {@link DayInputs}; this engine never reads
 * anything else.
 *
 * <p>Task 2 built the engine skeleton ({@link #evaluate}, the weight-renormalisation mechanism)
 * plus the {@code nutrition} dimension. This task (3) adds {@code quality} and {@code training}
 * to the same private-method + one-list-entry seam in {@link #evaluate}; Task 4 adds {@code
 * sleep, logging, rhythm} the same way — deliberately not a plugin framework (YAGNI).
 *
 * <p>Honesty rules (binding, constraints.md): a NO_DATA/IN_PROGRESS dimension drops out with
 * weight 0; the {@code weight} each surviving DONE dimension reports is RENORMALISED so the DONE
 * dimensions' weights sum to 1.0. {@code base} is the rounded weighted sum of the DONE dimensions,
 * and is {@code null} when fewer than 2 dimensions are DONE, or when the day is not yet
 * {@code closed} (open/future day → no overall score, only the per-dimension progress). No
 * component is ever awarded an invented neutral/full score for data that was never measured
 * (mezo-jcpt review round 1): a missing TARGET means we never set an expectation (full credit,
 * doesn't penalize); missing DATA against a real target means the component drops out and the
 * remaining components renormalize — same policy as the dimension-level renormalization above,
 * applied one level down inside the nutrition dimension's own kcal/protein/carb-fat split.
 */
@Service
@RequiredArgsConstructor
public class DayEvaluationEngine {

    private final DayEvaluationProperties props;

    /** Minden, amit egy nap értékeléséhez tudni kell — a hívó ({@code DayScoreService}) tölti. */
    public record DayInputs(
        LocalDate date, boolean closed,               // closed = date < today (v1 napzárás)
        Double kcal, Double proteinG, Double carbsG, Double fatG,          // consumed (null = nincs log)
        Double kcalTarget, Double proteinTargetG, Double carbsTargetG, Double fatTargetG,
        boolean workoutDay,                            // volt-e AZNAPRA tervezett/végzett edzés
        Integer plannedWorkouts, Integer doneWorkouts, // train terv vs tény (null/0 planned = pihenőnap)
        Double sleepH, Integer sleepQuality1to10,      // null = nincs alvás-log
        List<MealLogFact> meals,                       // logolási dimenzióhoz
        boolean waterLogged, int checkinCount,
        List<Integer> priorBaseScores                  // az előző rhythmWindowDays nap base-scoreja (ami van)
    ) { }

    public record MealLogFact(String slot, LocalTime loggedAt, LocalTime eatenAt,
                              Double novaDimScore, Double microDimScore, double kcal) { }

    public record DimFact(String label, String value) { }

    /** status: DONE (pont van) | IN_PROGRESS (nyitott nap, még gyűlik) | NO_DATA (degraded). */
    public record DayDimension(String id, String label, double weight, Integer score,
                               String status, List<DimFact> facts) { }

    public record DayEvaluation(LocalDate date, Integer base, List<DayDimension> dimensions) { }

    private static final String DONE = "DONE";
    private static final String IN_PROGRESS = "IN_PROGRESS";
    private static final String NO_DATA = "NO_DATA";
    private static final String NO_CARB_FAT_DATA = "nincs adat";

    /** A dimension before weight renormalisation — carries the raw config weight. */
    private record RawDim(String id, String label, double configWeight, Integer score,
                          String status, List<DimFact> facts) { }

    public DayEvaluation evaluate(DayInputs in) {
        List<RawDim> raw = List.of(nutritionDim(in), qualityDim(in), trainingDim(in));

        double doneWeightSum = raw.stream().filter(d -> DONE.equals(d.status()))
            .mapToDouble(RawDim::configWeight).sum();
        long doneCount = raw.stream().filter(d -> DONE.equals(d.status())).count();

        List<DayDimension> dimensions = raw.stream()
            .map(d -> renormalized(d, doneWeightSum))
            .toList();

        Integer base = null;
        if (in.closed() && doneCount >= 2) {
            // Folded over the already-renormalized `dimensions` list, not re-derived from `raw`:
            // one weight computation, reused everywhere — the per-dimension weight and the base
            // total can never drift apart (review round 1, Minor).
            double weighted = dimensions.stream().filter(d -> DONE.equals(d.status()))
                .mapToDouble(d -> d.weight() * d.score())
                .sum();
            base = (int) Math.round(weighted);
        }
        return new DayEvaluation(in.date(), base, dimensions);
    }

    private DayDimension renormalized(RawDim d, double doneWeightSum) {
        double weight = DONE.equals(d.status()) && doneWeightSum > 0
            ? d.configWeight() / doneWeightSum : 0.0;
        return new DayDimension(d.id(), d.label(), weight, d.score(), d.status(), d.facts());
    }

    // --- Nutrition (.30 default): kcal (.5) + protein (.3) + carb/fat (.2) fit vs the day's targets

    private RawDim nutritionDim(DayInputs in) {
        String id = "nutrition";
        String label = "Táplálkozás";
        double configWeight = props.weights().nutrition();

        if (!in.closed()) {
            return new RawDim(id, label, configWeight, null, IN_PROGRESS, nutritionFacts(in));
        }
        // A non-positive target is not a real target (review round 1, Important 2) — treated the
        // same as a null one: the dimension has nothing to score against, so it degrades to
        // NO_DATA rather than dividing by (or against) a bogus zero/negative denominator.
        if (in.kcal() == null || in.kcalTarget() == null || in.kcalTarget() <= 0
            || in.proteinG() == null || in.proteinTargetG() == null || in.proteinTargetG() <= 0) {
            return new RawDim(id, label, configWeight, null, NO_DATA, List.of());
        }

        double kcalFit = kcalFit(in.kcal(), in.kcalTarget(), in.workoutDay());
        double proteinFit = proteinFit(in.proteinG(), in.proteinTargetG());
        // null = no carb/fat DATA against a real target → the component drops out and kcal/protein
        // renormalize over their combined 0.8 share (0.5/0.8, 0.3/0.8) instead of the component
        // silently getting an invented full score (review round 1, Important 1).
        Double carbFatFit = carbFatFit(in.carbsG(), in.fatG(), in.carbsTargetG(), in.fatTargetG());
        double value = carbFatFit == null
            ? (0.5 * kcalFit + 0.3 * proteinFit) / 0.8
            : 0.5 * kcalFit + 0.3 * proteinFit + 0.2 * carbFatFit;
        int score = (int) Math.round(value * 100);

        return new RawDim(id, label, configWeight, score, DONE, nutritionFacts(in));
    }

    private double kcalFit(double kcal, double target, boolean workoutDay) {
        double top = target + (workoutDay ? props.workoutDayKcalWiden() : 0);
        double relOver = Math.max(0, kcal / top - 1);          // a tágított felső célhoz
        double relUnder = Math.max(0, 1 - kcal / target);
        double over = Math.max(0, relOver - props.nutrition().kcalOverBand());
        double under = Math.max(0, relUnder - props.nutrition().kcalUnderBand());
        return Math.max(0, 1 - (over + under) * props.nutrition().kcalSlope());
    }

    private double proteinFit(double p, double target) {
        double relUnder = Math.max(0, 1 - p / target);
        double under = Math.max(0, relUnder - props.nutrition().proteinUnderBand());
        return Math.max(0, 1 - under * props.nutrition().proteinSlope()); // surplus: teljes pont
    }

    /**
     * {@code null} means "the component has no measurement and drops out" (missing DATA against a
     * real, positive target) — the caller renormalizes kcal/protein over it. A missing or
     * non-positive TARGET is a different case: we never set an expectation, so it returns full
     * credit (1.0) rather than dropping out — same as the brief's original {@code ct == null ||
     * ft == null} policy, extended to non-positive targets (review round 1, Important 2).
     */
    private Double carbFatFit(Double c, Double f, Double ct, Double ft) {
        if (ct == null || ft == null || ct <= 0 || ft <= 0) {
            return 1.0;
        }
        if (c == null || f == null) {
            return null;
        }
        double dev = (Math.max(0, Math.abs(c / ct - 1) - props.nutrition().carbFatBand())
                    + Math.max(0, Math.abs(f / ft - 1) - props.nutrition().carbFatBand())) / 2;
        return Math.max(0, 1 - dev * props.nutrition().carbFatSlope());
    }

    private List<DimFact> nutritionFacts(DayInputs in) {
        List<DimFact> facts = new ArrayList<>();
        facts.add(new DimFact("kcal", fmtPair(in.kcal(), in.kcalTarget())));
        facts.add(new DimFact("fehérje", fmtPair(in.proteinG(), in.proteinTargetG()) + " g"));
        facts.add(new DimFact("c · f", carbFatFactValue(in)));
        if (in.workoutDay()) {
            facts.add(new DimFact("sáv", "edzésnapi +" + props.workoutDayKcalWiden() + " kcal"));
        }
        return facts;
    }

    /** "nincs adat" when carbs/fat weren't logged at all, so the tile never implies a measured
     *  value for an unmeasured component (review round 1, chosen resolution for Important 1). */
    private static String carbFatFactValue(DayInputs in) {
        if (in.carbsG() == null || in.fatG() == null) {
            return NO_CARB_FAT_DATA;
        }
        return fmtInt(in.carbsG()) + " g · " + fmtInt(in.fatG()) + " g";
    }

    private static String fmtPair(Double a, Double b) {
        return fmtInt(a) + " / " + fmtInt(b);
    }

    private static String fmtInt(Double v) {
        return v == null ? "–" : String.valueOf(Math.round(v));
    }

    // --- Quality (.15 default): kcal-weighted mean of the day's meal NOVA scores, blended with
    // the mean meal MICRO score (0.75 nova / 0.25 micro). Both fields come from the meal envelope
    // (already-scored, 1/2 plan) — this dimension only aggregates across the day's meals.

    private RawDim qualityDim(DayInputs in) {
        String id = "quality";
        String label = "Minőség";
        double configWeight = props.weights().quality();
        List<MealLogFact> meals = in.meals() == null ? List.of() : in.meals();
        Double novaPart = novaKcalWeightedAvg(meals);
        Double microAvg = microAvg(meals);
        List<DimFact> facts = qualityFacts(novaPart, microAvg);

        if (!in.closed()) {
            return new RawDim(id, label, configWeight, null, IN_PROGRESS, facts);
        }
        // No meal carries a usable nova score (or their combined kcal is non-positive, same
        // no-divide-by-nothing guard as nutrition) -> nothing to aggregate, degrade honestly
        // rather than inventing a neutral quality score.
        if (novaPart == null) {
            return new RawDim(id, label, configWeight, null, NO_DATA, List.of());
        }
        // Without any micro data the nova part stands alone at weight 1.0 (brief, explicit) --
        // not renormalized against an invented micro value.
        double value = microAvg == null ? novaPart : 0.75 * novaPart + 0.25 * microAvg;
        int score = (int) Math.round(value * 100);
        return new RawDim(id, label, configWeight, score, DONE, facts);
    }

    /** {@code null} when no meal carries a nova score, or their combined kcal is non-positive
     *  (nothing to weight by) -- the caller degrades the whole dimension to NO_DATA rather than
     *  dividing by zero or inventing a value. */
    private static Double novaKcalWeightedAvg(List<MealLogFact> meals) {
        List<MealLogFact> withNova = meals.stream().filter(m -> m.novaDimScore() != null).toList();
        double kcalSum = withNova.stream().mapToDouble(MealLogFact::kcal).sum();
        if (withNova.isEmpty() || kcalSum <= 0) {
            return null;
        }
        return withNova.stream().mapToDouble(m -> m.novaDimScore() * m.kcal()).sum() / kcalSum;
    }

    /** Simple (non kcal-weighted) mean of the meals carrying a micro score; {@code null} when
     *  none do. */
    private static Double microAvg(List<MealLogFact> meals) {
        List<MealLogFact> withMicro = meals.stream().filter(m -> m.microDimScore() != null).toList();
        if (withMicro.isEmpty()) {
            return null;
        }
        return withMicro.stream().mapToDouble(MealLogFact::microDimScore).average().orElseThrow();
    }

    private static List<DimFact> qualityFacts(Double novaPart, Double microAvg) {
        List<DimFact> facts = new ArrayList<>();
        facts.add(new DimFact("nova", novaPart == null ? "–" : Math.round(novaPart * 100) + "%"));
        facts.add(new DimFact("mikro", microAvg == null ? "–" : Math.round(microAvg * 100) + "%"));
        return facts;
    }

    // --- Training (.20 default): done/planned workouts, linear between 0.3 (0 done) and 1.0
    // (all done). plannedWorkouts of 0 (or null) is a rest day -- NO_DATA, never a penalty.

    private RawDim trainingDim(DayInputs in) {
        String id = "training";
        String label = "Edzés";
        double configWeight = props.weights().training();
        Integer planned = in.plannedWorkouts();

        // Rest day: no plan means nothing to measure against, not a missed workout -- the day
        // must not take a training penalty for resting (product decision, binding).
        if (planned == null || planned <= 0) {
            return new RawDim(id, label, configWeight, null, NO_DATA,
                List.of(new DimFact("terv", "Pihenőnap · nem számít")));
        }

        int done = in.doneWorkouts() == null ? 0 : in.doneWorkouts();
        List<DimFact> facts = List.of(new DimFact("edzés", done + " / " + planned));

        // Open day, not yet all done -> still gathering, IN_PROGRESS; a closed day is always
        // DONE regardless of the done/planned ratio (the day is over, the ratio is final).
        if (!in.closed() && done < planned) {
            return new RawDim(id, label, configWeight, null, IN_PROGRESS, facts);
        }

        double ratio = Math.min(1.0, (double) done / planned);
        double value = 0.3 + 0.7 * ratio;
        int score = (int) Math.round(value * 100);
        return new RawDim(id, label, configWeight, score, DONE, facts);
    }
}
