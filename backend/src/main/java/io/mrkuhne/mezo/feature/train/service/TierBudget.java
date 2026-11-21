package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The weekly set budget the priority tiers spend (mezo-r36n9.113): how many working sets the training days fit
 * in the session-minutes target, how many the plan's peak loading week uses, and what raising each muscle one
 * tier would add. Pure, no Spring/DB.
 */
public final class TierBudget {
    private TierBudget() {}

    private static final String DELOAD = "Deload";

    /**
     * {@code capacitySets} null without a session-minutes target; {@code raiseCost} = muscle → extra peak weekly
     * sets with only that muscle one tier higher (emphasized muscles are absent).
     */
    public record Result(Integer capacitySets, int usedSets, int emphasizeCount, int emphasizeMax,
                         Map<String, Integer> raiseCost) {}

    /** Null when the plan has no counting exercises. */
    public static Result of(PlanEvaluator.Input in, PlanEvaluator.Result r) {
        if (!PlanEvaluator.hasCountingExercises(in)) {
            return null;
        }
        VolumeProperties p = in.props();
        int used = peak(r.path());

        Map<String, VolumePath.Group> judged = new LinkedHashMap<>();
        r.muscles().forEach(m -> judged.put(m.muscle(), new VolumePath.Group(m.tier(), m.band())));
        Map<String, Integer> raiseCost = new LinkedHashMap<>();
        for (PlanEvaluator.MuscleResult m : r.muscles()) {
            if (m.tier() == PriorityTier.EMPHASIZE) continue;
            PriorityTier raised = m.tier() == PriorityTier.MAINTAIN ? PriorityTier.GROW : PriorityTier.EMPHASIZE;
            Map<String, VolumePath.Group> what = new LinkedHashMap<>(judged);
            what.put(m.muscle(), new VolumePath.Group(raised, VolumeBands.band(p.baselines().get(m.muscle()), raised,
                m.band().sportAdjusted(), p.bands())));
            raiseCost.put(m.muscle(), Math.max(0, peak(PlanEvaluator.project(in, what)) - used));
        }
        int emphasized = (int) r.muscles().stream().filter(m -> m.tier() == PriorityTier.EMPHASIZE).count();
        return new Result(capacity(in), used, emphasized, p.bands().emphasizeMax(), raiseCost);
    }

    /** Peak weekly total over the non-deload weeks. */
    private static int peak(List<VolumePath.Week> path) {
        return path.stream().filter(w -> !DELOAD.equalsIgnoreCase(w.phase()))
            .mapToInt(VolumePath.Week::total).max().orElse(0);
    }

    /**
     * Σ over training days of floor((target − overhead − warm-up minutes) / (mean set minutes + transition / 3)).
     * A training day carries ≥ 1 counting row of a landmark group; the warm-up minutes are the real warm-up sets of
     * those days × the per-warm-up figure, averaged per day. Mean set minutes = mean of (setSeconds + rest) / 60 over
     * the counting exercises (styled; a row without a rest uses the flat per-set figure); an unstyled plan uses the
     * flat per-set figure with no transition (as the evaluator's unstyled minutes).
     */
    private static Integer capacity(PlanEvaluator.Input in) {
        if (in.sessionMinutesTarget() == null) {
            return null;
        }
        VolumeProperties.Evaluator ev = in.props().evaluator();
        double flat = ev.minutesPerWorkingSet().doubleValue();
        List<PlanEvaluator.PlanDay> training = in.days().stream()
            .filter(d -> d.exercises().stream().anyMatch(x -> counting(in, x))).toList();
        if (training.isEmpty()) {
            return 0;
        }
        List<PlanEvaluator.PlanExercise> counting = training.stream().flatMap(d -> d.exercises().stream())
            .filter(x -> counting(in, x)).toList();
        // unstyled minutes have no per-exercise transition (the evaluator's v1 model)
        double perSet = !in.styled() ? flat : counting.stream()
            .mapToDouble(x -> x.restSeconds() == null ? flat : (ev.setSeconds() + x.restSeconds()) / 60.0)
            .average().orElse(flat) + ev.transitionMinutes().doubleValue() / 3.0;
        double warmupMinutes = training.stream().flatMap(d -> d.exercises().stream())
            .mapToInt(PlanEvaluator.PlanExercise::warmupSets).sum() * ev.minutesPerWarmupSet().doubleValue()
            / training.size();
        double room = in.sessionMinutesTarget() - ev.sessionOverheadMinutes() - warmupMinutes;
        int perDay = Math.max(0, (int) Math.floor(room / perSet + 1e-9));   // guard an exact quotient against float drift
        return training.size() * perDay;
    }

    /**
     * The new-block intake's capacity (mezo-r36n9.113, week-1 based): Σ over the plan's training days (≥ 1 counting
     * row) of that day's counting working sets + floor((target − the day's minutes estimate) / marginal set minutes),
     * floored at 0. The day's estimate is the evaluator's own (minutes model v2, the day's real warm-ups), so a day
     * within the target never gets fewer sets than it has — an offered candidate always has used ≤ capacity — and a
     * day over it shows the overrun. Marginal set minutes = the set-weighted mean of (setSeconds + rest) / 60 over the
     * day's counting rows + transition / 3 (styled), the flat per-set figure (unstyled). Null without a target.
     */
    public static Integer intakeCapacity(PlanEvaluator.Input in, PlanEvaluator.Result r) {
        if (in.sessionMinutesTarget() == null) {
            return null;
        }
        VolumeProperties.Evaluator ev = in.props().evaluator();
        double flat = ev.minutesPerWorkingSet().doubleValue();
        int total = 0;
        for (int d = 0; d < in.days().size(); d++) {
            List<PlanEvaluator.PlanExercise> rows = in.days().get(d).exercises().stream()
                .filter(x -> counting(in, x)).toList();
            if (rows.isEmpty()) continue;
            int sets = rows.stream().mapToInt(PlanEvaluator.PlanExercise::workingSets).sum();
            double perSet = flat;
            if (in.styled()) {
                double weighted = rows.stream().mapToDouble(x -> x.workingSets()
                    * (x.restSeconds() == null ? flat : (ev.setSeconds() + x.restSeconds()) / 60.0)).sum();
                perSet = (sets > 0 ? weighted / sets : flat) + ev.transitionMinutes().doubleValue() / 3.0;
            }
            int slack = in.sessionMinutesTarget() - r.days().get(d).minutesEstimate();
            total += Math.max(0, sets + (int) Math.floor(slack / perSet + 1e-9));
        }
        return total;
    }

    /** Week-1 total: the plan's counting working sets of landmark groups. */
    public static int weekOneSets(PlanEvaluator.Result r) {
        return r.muscles().stream().mapToInt(PlanEvaluator.MuscleResult::weeklySets).sum();
    }

    private static boolean counting(PlanEvaluator.Input in, PlanEvaluator.PlanExercise x) {
        return x.counts() && x.group() != null && in.props().baselines().containsKey(x.group());
    }
}
