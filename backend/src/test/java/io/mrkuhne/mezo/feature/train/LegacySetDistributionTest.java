package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.service.LegacySetDistribution;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Pins the parked distribution that the one-time amount migration will call (mezo-r36n9.65). */
class LegacySetDistributionTest {

    @Test
    void oneExerciseForAGroupGetsTheWholeTarget() {
        ExerciseEntity press = exercise("chest", 3);

        Map<UUID, Integer> out = LegacySetDistribution.effective(List.of(press), List.of(log("chest", 10)));

        assertThat(out.get(press.getId())).isEqualTo(10);
    }

    @Test
    void twoExercisesSplitProportionallyWithLargestRemainder() {
        ExerciseEntity bench = exercise("chest", 3);
        ExerciseEntity flye = exercise("chest", 2);

        Map<UUID, Integer> out = LegacySetDistribution.effective(List.of(bench, flye), List.of(log("chest", 14)));

        // base 1/1 (remaining 12): 7.2 / 4.8 -> floors 7/4, leftover to flye (0.8) -> 8 / 6
        assertThat(out.get(bench.getId())).isEqualTo(8);
        assertThat(out.get(flye.getId())).isEqualTo(6);
    }

    private static ExerciseEntity exercise(String muscle, int sets) {
        ExerciseEntity e = new ExerciseEntity();
        e.setId(UUID.randomUUID());
        e.setMuscle(muscle);
        e.setWorkingSets(sets);
        e.setCountsTowardVolume(true);
        return e;
    }

    private static MuscleGroupVolumeLogEntity log(String muscle, int currentSets) {
        MuscleGroupVolumeLogEntity l = new MuscleGroupVolumeLogEntity();
        l.setMuscle(muscle);
        l.setCurrentSets(currentSets);
        return l;
    }
}
