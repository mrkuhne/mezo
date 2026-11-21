package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Warm-up sets only before a muscle's first exercise of the day (owner decision 2026-11-21; Iversen et al. 2021:
 * a specific warm-up matters before the first heavy work for a muscle). Within one day the first exercise of each
 * coarse muscle group keeps its warm-ups (compound / isolation count), every later one of the same group gets 0.
 * A null / blank muscle is treated as its own group. Pure; mutates the given inputs.
 */
final class WarmupRule {
    private WarmupRule() {}

    static void apply(List<GymExerciseInput> dayExercises, int compoundWarmup, int isolationWarmup) {
        Set<String> warm = new HashSet<>();
        for (GymExerciseInput e : dayExercises) {
            String group = String.valueOf(MuscleGroup.of(e.getMuscle()));
            if (warm.add(group)) {
                boolean compound = e.getType() == GymExerciseInput.TypeEnum.COMPOUND;
                e.setWarmupSets(compound ? compoundWarmup : isolationWarmup);
            } else {
                e.setWarmupSets(0);
            }
        }
    }
}
