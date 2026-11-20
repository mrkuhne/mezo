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
     * Σ over training days of floor((target − overhead − 2 warm-up sets) / (mean set minutes + transition / 3)).
     * Mean set minutes = mean of (setSeconds + rest) / 60 over the counting exercises (styled; a row without a
     * rest uses the flat per-set figure), the flat per-set figure for an unstyled plan.
     */
    private static Integer capacity(PlanEvaluator.Input in) {
        if (in.sessionMinutesTarget() == null) {
            return null;
        }
        VolumeProperties.Evaluator ev = in.props().evaluator();
        double flat = ev.minutesPerWorkingSet().doubleValue();
        List<PlanEvaluator.PlanExercise> counting = in.days().stream().flatMap(d -> d.exercises().stream())
            .filter(x -> x.counts() && x.group() != null && in.props().baselines().containsKey(x.group())).toList();
        double avgSet = !in.styled() ? flat : counting.stream()
            .mapToDouble(x -> x.restSeconds() == null ? flat : (ev.setSeconds() + x.restSeconds()) / 60.0)
            .average().orElse(flat);
        double perSet = avgSet + ev.transitionMinutes().doubleValue() / 3.0;
        double room = in.sessionMinutesTarget() - ev.sessionOverheadMinutes() - 2 * ev.minutesPerWarmupSet().doubleValue();
        int perDay = Math.max(0, (int) Math.floor(room / perSet + 1e-9));   // guard an exact quotient against float drift
        long trainingDays = in.days().stream().filter(d -> !d.exercises().isEmpty()).count();
        return (int) (trainingDays * perDay);
    }
}
