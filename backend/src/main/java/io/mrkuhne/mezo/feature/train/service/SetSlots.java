package io.mrkuhne.mezo.feature.train.service;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Which exercise of one muscle group takes one more set, or gives one up. Pure function: the caps
 * arrive as parameters; {@code group} is the counting exercises of one muscle group across the week.
 */
public final class SetSlots {
    private SetSlots() {}

    /**
     * One exercise of the group: the day it sits on, its current working sets and its {@code capWeight} — what it
     * weighs against the exercise and session caps (a technique/challenge row's technique set weighs 2, mezo-r36n9.80,
     * spec §6.4). The band (weekly set count) and {@link #pickDown} read plain {@code sets}.
     */
    public record Slot(UUID exerciseId, int dayIndex, int sets, int capWeight) {
        /** A plain row: it weighs its sets. */
        public Slot(UUID exerciseId, int dayIndex, int sets) {
            this(exerciseId, dayIndex, sets, sets);
        }

        /** A row whose technique set adds {@code capExtra} set-equivalents ({@link TechniqueRules#capExtra}). */
        public static Slot of(UUID exerciseId, int dayIndex, int sets, int capExtra) {
            return new Slot(exerciseId, dayIndex, sets, sets > 0 ? sets + capExtra : 0);
        }
    }

    /**
     * The slot that takes one more set: below the exercise cap on a day below the session cap (both by cap
     * weight), fewest sets first, then the lighter day (group total by cap weight), then list order.
     */
    public static Optional<UUID> pickUp(List<Slot> group, int exerciseCap, int sessionCap) {
        return group.stream()
                .filter(s -> s.capWeight() < exerciseCap && dayTotal(group, s.dayIndex()) < sessionCap)
                .min(Comparator.<Slot>comparingInt(Slot::sets)
                        .thenComparingInt(s -> dayTotal(group, s.dayIndex())))   // min() keeps the first of equals
                .map(Slot::exerciseId);
    }

    /** The slot that gives one set up: the most sets (never one with a single set), then list order. */
    public static Optional<UUID> pickDown(List<Slot> group) {
        return group.stream()
                .filter(s -> s.sets() > 1)
                .min(Comparator.<Slot>comparingInt(s -> -s.sets()))
                .map(Slot::exerciseId);
    }

    private static int dayTotal(List<Slot> group, int dayIndex) {
        return group.stream().filter(s -> s.dayIndex() == dayIndex).mapToInt(Slot::capWeight).sum();
    }
}
