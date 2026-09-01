package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Protein × training mismatch (round 2, spec §5): the protein target is missed specifically on
 * GYM days at a materially higher rate than on NON-GYM days — protein missing exactly when it
 * matters most. Gym days come from {@code trend().gymEightWeeks()} (round 1 gathered that field
 * but never read it; this detector and {@code stack-skip-pattern} are its first consumers), which
 * is what lets the state be recomputed as of {@code day - 1} too.
 *
 * <p>The contrast group is "every day without a completed GYM session", which is not the same as
 * a rest day — a run or a sport session lands there too. The copy says so rather than calling
 * those days "pihenőnap", which would claim a rest the data never established.
 *
 * <p>The STATE is a bare presence marker (spec §6). It deliberately carries no counts: the group
 * sizes shift every night as the 14-day window slides, which re-announced an unchanged pattern.
 * The exact counts still reach the user in the summary, which is not the gate.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class ProteinTrainingMismatchDetector implements CharacterDetector {

    private static final int MIN_DAYS_PER_GROUP = 3;
    private static final double MISS_FRACTION = 0.90; // below 90% of target = a miss
    private static final double MIN_RATE_GAP = 0.30;

    @Override
    public String key() {
        return "protein-training-mismatch";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newMealData(in) && !DetectorGates.newGymData(in)) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || today.state().equals(yesterday == null ? "" : yesterday.state())) {
            return List.of();
        }
        String summary = "A fehérje-cél az edzésnapokon marad el: " + today.gymMisses() + "/"
                + today.gymDays() + " edzésnapon, szemben az edzés nélküli napok "
                + today.nonGymMisses() + "/" + today.nonGymDays() + " arányával (14 nap).";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 3));
    }

    private record Finding(String state, int gymMisses, int gymDays,
                           int nonGymMisses, int nonGymDays) {}

    private static Finding finding(DetectorInput in, LocalDate asOf) {
        Set<LocalDate> gymDates = new HashSet<>();
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            if (TrailingWindow.inWindow(g.date(), asOf)) {
                gymDates.add(g.date());
            }
        }
        List<DetectorInput.MealDayPoint> window = new ArrayList<>();
        for (DetectorInput.MealDayPoint m : in.trend().mealDays()) {
            if (TrailingWindow.inWindow(m.date(), asOf) && m.kcal().signum() > 0
                    && m.proteinTarget() != null && m.proteinTarget().signum() > 0) {
                window.add(m);
            }
        }
        int gymDays = 0;
        int gymMisses = 0;
        int nonGymDays = 0;
        int nonGymMisses = 0;
        for (DetectorInput.MealDayPoint m : window) {
            boolean miss = m.proteinG().doubleValue()
                    < m.proteinTarget().doubleValue() * MISS_FRACTION;
            if (gymDates.contains(m.date())) {
                gymDays++;
                if (miss) {
                    gymMisses++;
                }
            } else {
                nonGymDays++;
                if (miss) {
                    nonGymMisses++;
                }
            }
        }
        if (gymDays < MIN_DAYS_PER_GROUP || nonGymDays < MIN_DAYS_PER_GROUP) {
            return null;
        }
        double gymRate = (double) gymMisses / gymDays;
        double nonGymRate = (double) nonGymMisses / nonGymDays;
        if (gymRate - nonGymRate < MIN_RATE_GAP) {
            return null;
        }
        // state = presence + direction only; counts move with the sliding window, so they would
        // defeat the state-change gate (spec §6)
        return new Finding("gap:gym-worse", gymMisses, gymDays, nonGymMisses, nonGymDays);
    }
}
