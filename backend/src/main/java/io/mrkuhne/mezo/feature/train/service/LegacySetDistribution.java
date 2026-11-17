package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The retired per-muscle weekly-target distribution (DA6, mezo-gbo7), parked verbatim: before
 * volume engine v2 {@code getToday} prescribed this instead of the row's own {@code working_sets}.
 * It survives only so the one-time data migration can fold what the owner was actually being
 * prescribed into the plan rows.
 *
 * <p>One-time migration helper: delete this class and {@code VolumeAmountMigrationRunner} once no run
 * with {@code volume_model = 1} and status active/planned remains in production.
 */
public final class LegacySetDistribution {
    private LegacySetDistribution() {}

    /**
     * Each exercise's effective working-set count (DA6, the retired distribution): a muscle group's volume-log
     * {@code currentSets} distributed across the MESO WEEK's counting exercises of that group
     * (mezo-gbo7 — distributing it per day multiplied weekly volume by training frequency),
     * proportional to each exercise's template {@code workingSets}. Base-1 + largest-remainder:
     * every counting exercise gets a floor of 1 set, then the rest of the target is handed out
     * proportionally, so {@code sum(effective) == currentSets} exactly whenever {@code currentSets
     * >= the week's counting-exercise count}. Below that every exercise still gets its floor of
     * 1, so the weekly sum can only exceed the target, never fall short. Exempt exercises and
     * groups with no log row are absent from the returned map — the caller falls back to the
     * template {@code workingSets}.
     */
    public static Map<UUID, Integer> effective(
            List<ExerciseEntity> exercises, List<MuscleGroupVolumeLogEntity> logs) {
        Map<String, Integer> targetSetsByGroup = logs.stream()
            .collect(Collectors.toMap(MuscleGroupVolumeLogEntity::getMuscle,
                MuscleGroupVolumeLogEntity::getCurrentSets, (a, b) -> a));
        Map<String, List<ExerciseEntity>> byGroup = exercises.stream()
            .filter(ExerciseEntity::isCountsTowardVolume) // mezo-gbo7: posture/plyo work is not volume
            .collect(Collectors.groupingBy(e -> MuscleGroup.of(e.getMuscle())));
        Map<UUID, Integer> out = new java.util.HashMap<>();
        for (Map.Entry<String, List<ExerciseEntity>> entry : byGroup.entrySet()) {
            Integer targetSets = targetSetsByGroup.get(entry.getKey());
            if (targetSets == null) {
                continue; // no log row for this group — caller keeps the template count
            }
            List<ExerciseEntity> groupExercises = entry.getValue();
            int exerciseCount = groupExercises.size();
            if (exerciseCount == 0) {
                continue;
            }
            if (targetSets <= exerciseCount) {
                // Can't sum below exerciseCount with a >=1 floor per exercise (degenerate).
                groupExercises.forEach(e -> out.put(e.getId(), 1));
                continue;
            }
            int templateSum = groupExercises.stream().mapToInt(ExerciseEntity::getWorkingSets).sum();
            int remaining = targetSets - exerciseCount; // reserve 1 set/exercise up front
            Map<UUID, Integer> extra = new java.util.HashMap<>();
            Map<UUID, Double> fraction = new java.util.HashMap<>();
            if (templateSum <= 0) {
                // No template signal to weigh by — split the remainder as evenly as possible.
                int base = remaining / exerciseCount;
                int evenRemainder = remaining % exerciseCount;
                int idx = 0;
                for (ExerciseEntity e : groupExercises) {
                    extra.put(e.getId(), base + (idx < evenRemainder ? 1 : 0));
                    idx++;
                }
            } else {
                int distributedExtra = 0;
                for (ExerciseEntity e : groupExercises) {
                    double exact = remaining * (double) e.getWorkingSets() / templateSum;
                    int floor = (int) Math.floor(exact);
                    extra.put(e.getId(), floor);
                    fraction.put(e.getId(), exact - floor);
                    distributedExtra += floor;
                }
                // Largest-remainder: hand out what floor-rounding left on the table, one set at a
                // time, to the biggest fractional share (ties -> bigger template workingSets, then
                // stable list order).
                int leftover = remaining - distributedExtra;
                List<ExerciseEntity> byFractionDesc = groupExercises.stream()
                    .sorted(Comparator.<ExerciseEntity>comparingDouble(e -> fraction.get(e.getId()))
                        .reversed()
                        .thenComparing(Comparator.comparingInt(ExerciseEntity::getWorkingSets).reversed()))
                    .toList();
                for (int i = 0; i < leftover; i++) {
                    extra.merge(byFractionDesc.get(i).getId(), 1, Integer::sum);
                }
            }
            groupExercises.forEach(e -> out.put(e.getId(), 1 + extra.get(e.getId())));
        }
        return out;
    }
}
