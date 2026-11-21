package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Warm-up sets only before a muscle's first, heavy exercise of the day (owner decision 2026-11-21; Iversen et al.
 * 2021: a specific warm-up matters mainly for heavy loads). Within one day only the first compound of each coarse
 * muscle group keeps {@code compoundWarmup}; later compounds of the group and every isolation get 0.
 * A null / blank muscle is treated as its own group. Pure; mutates the given inputs.
 */
final class WarmupRule {
    private WarmupRule() {}

    static void apply(List<GymExerciseInput> dayExercises, int compoundWarmup, int isolationWarmup) {
        Set<String> warm = new HashSet<>();
        for (GymExerciseInput e : dayExercises) {
            boolean compound = e.getType() == GymExerciseInput.TypeEnum.COMPOUND;
            boolean first = compound && warm.add(String.valueOf(MuscleGroup.of(e.getMuscle())));
            e.setWarmupSets(first ? compoundWarmup : 0);
        }
    }
}
