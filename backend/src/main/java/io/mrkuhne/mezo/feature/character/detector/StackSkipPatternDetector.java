package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Supplement-stack skip pattern (round 2, spec §4.3, §5). There is NO skip row in the domain — a
 * skip is derived, and the derivation must respect the product's own rest-day rule: an item placed
 * in a peri-workout zone on a day with no training is not a miss, it is either displaced to its
 * {@code restDayFallback} zone or deliberately dropped (FE precedent:
 * {@code features/fuel/logic/projectStackDay.ts}). Training days come from
 * {@code trend().gymEightWeeks()}.
 *
 * <p>Overfiring: the state is the offending item plus its miss count, so an unchanged pattern is
 * silent. ONE documented widening, mirroring {@code MesoAdherenceDetector}'s shape: the detector
 * also fires when the observed day itself carries a miss for that item, so a second consecutive
 * skipped day is not swallowed by an unchanged state string.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class StackSkipPatternDetector implements CharacterDetector {

    private static final int MIN_MISSED_DAYS = 3;
    private static final Set<String> PERI_WORKOUT_ZONES = Set.of("pre_workout", "post_workout");

    @Override
    public String key() {
        return "stack-skip-pattern";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().stack() == null) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        if (today == null) {
            return List.of();
        }
        Finding yesterday = finding(in, in.day().minusDays(1));
        boolean changed = yesterday == null || !today.state().equals(yesterday.state());
        if (!changed && !today.missedOnDayItself()) {
            return List.of();
        }
        String summary = "Kiegészítő-kihagyás: a(z) " + today.name() + " " + today.missedDays()
                + " napon maradt ki a tervezett " + today.expectedDays() + " napból (14 nap).";
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }

    private record Finding(String state, String name, int missedDays, int expectedDays,
                           boolean missedOnDayItself) {}

    private static Finding finding(DetectorInput in, LocalDate asOf) {
        DetectorInput.StackContext stack = in.trend().stack();
        Set<LocalDate> gymDates = new HashSet<>();
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            gymDates.add(g.date());
        }
        Map<LocalDate, Set<UUID>> takenByDate = new HashMap<>();
        for (DetectorInput.StackDayPoint d : stack.days()) {
            takenByDate.put(d.date(), d.takenPantryItemIds());
        }

        Finding best = null;
        for (DetectorInput.StackItem item : stack.items()) {
            int expected = 0;
            int missed = 0;
            boolean missedToday = false;
            for (LocalDate d = asOf.minusDays(RoundTwoWindow.WINDOW_DAYS - 1L); !d.isAfter(asOf);
                    d = d.plusDays(1)) {
                if (!expectedOn(item, d, gymDates)) {
                    continue;
                }
                expected++;
                if (!takenByDate.getOrDefault(d, Set.of()).contains(item.pantryItemId())) {
                    missed++;
                    if (d.equals(asOf)) {
                        missedToday = true;
                    }
                }
            }
            if (missed < MIN_MISSED_DAYS) {
                continue;
            }
            if (best == null || missed > best.missedDays()) {
                best = new Finding(item.pantryItemId() + ":" + missed + "/" + expected,
                        item.name(), missed, expected, missedToday);
            }
        }
        return best;
    }

    /**
     * A peri-workout item is expected only on a day with a completed gym session; on a rest day it
     * either displaces to its {@code restDayFallback} zone or is deliberately dropped — either way
     * it is not a compliance miss. Every other item is expected daily.
     */
    private static boolean expectedOn(DetectorInput.StackItem item, LocalDate date,
                                      Set<LocalDate> gymDates) {
        if (item.slotKey() != null && PERI_WORKOUT_ZONES.contains(item.slotKey())) {
            return gymDates.contains(date);
        }
        return true;
    }
}
