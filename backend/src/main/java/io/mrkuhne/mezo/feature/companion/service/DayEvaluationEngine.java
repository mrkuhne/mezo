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
 * <p>This task builds the engine skeleton ({@link #evaluate}, the weight-renormalisation
 * mechanism) plus ONLY the {@code nutrition} dimension. Tasks 3-4 add {@code quality, training,
 * sleep, logging, rhythm} to the same private-method + one-list-entry seam in {@link #evaluate} —
 * deliberately not a plugin framework (YAGNI).
 *
 * <p>Honesty rules (binding, constraints.md): a NO_DATA/IN_PROGRESS dimension drops out with
 * weight 0; the {@code weight} each surviving DONE dimension reports is RENORMALISED so the DONE
 * dimensions' weights sum to 1.0. {@code base} is the rounded weighted sum of the DONE dimensions,
 * and is {@code null} when fewer than 2 dimensions are DONE, or when the day is not yet
 * {@code closed} (open/future day → no overall score, only the per-dimension progress).
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

    /** A dimension before weight renormalisation — carries the raw config weight. */
    private record RawDim(String id, String label, double configWeight, Integer score,
                          String status, List<DimFact> facts) { }

    public DayEvaluation evaluate(DayInputs in) {
        List<RawDim> raw = List.of(nutritionDim(in));

        double doneWeightSum = raw.stream().filter(d -> DONE.equals(d.status()))
            .mapToDouble(RawDim::configWeight).sum();
        long doneCount = raw.stream().filter(d -> DONE.equals(d.status())).count();

        List<DayDimension> dimensions = raw.stream()
            .map(d -> renormalized(d, doneWeightSum))
            .toList();

        Integer base = null;
        if (in.closed() && doneCount >= 2) {
            double weighted = raw.stream().filter(d -> DONE.equals(d.status()))
                .mapToDouble(d -> (d.configWeight() / doneWeightSum) * d.score())
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
        if (in.kcal() == null || in.kcalTarget() == null
            || in.proteinG() == null || in.proteinTargetG() == null) {
            return new RawDim(id, label, configWeight, null, NO_DATA, List.of());
        }

        double kcalFit = kcalFit(in.kcal(), in.kcalTarget(), in.workoutDay());
        double proteinFit = proteinFit(in.proteinG(), in.proteinTargetG());
        double carbFatFit = carbFatFit(in.carbsG(), in.fatG(), in.carbsTargetG(), in.fatTargetG());
        double value = 0.5 * kcalFit + 0.3 * proteinFit + 0.2 * carbFatFit;
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

    private double carbFatFit(Double c, Double f, Double ct, Double ft) {
        if (c == null || f == null || ct == null || ft == null) {
            return 1.0; // nincs C/F cél/adat → nem büntetünk
        }
        double dev = (Math.max(0, Math.abs(c / ct - 1) - props.nutrition().carbFatBand())
                    + Math.max(0, Math.abs(f / ft - 1) - props.nutrition().carbFatBand())) / 2;
        return Math.max(0, 1 - dev * props.nutrition().carbFatSlope());
    }

    private List<DimFact> nutritionFacts(DayInputs in) {
        List<DimFact> facts = new ArrayList<>();
        facts.add(new DimFact("kcal", fmtPair(in.kcal(), in.kcalTarget())));
        facts.add(new DimFact("fehérje", fmtPair(in.proteinG(), in.proteinTargetG()) + " g"));
        facts.add(new DimFact("c · f", fmtInt(in.carbsG()) + " g · " + fmtInt(in.fatG()) + " g"));
        if (in.workoutDay()) {
            facts.add(new DimFact("sáv", "edzésnapi +" + props.workoutDayKcalWiden() + " kcal"));
        }
        return facts;
    }

    private static String fmtPair(Double a, Double b) {
        return fmtInt(a) + " / " + fmtInt(b);
    }

    private static String fmtInt(Double v) {
        return v == null ? "–" : String.valueOf(Math.round(v));
    }
}
