package io.mrkuhne.mezo.feature.train.signal;

import io.mrkuhne.mezo.feature.progression.gym.GymSignal;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository.ExerciseIdentityRow;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Computes a GymSignal from a finished instance's logged sets (Epley + per-muscle Σ volume). */
@Component
@RequiredArgsConstructor
public class GymSignalCalculator {

    private static final BigDecimal THIRTY = new BigDecimal("30");
    private static final String OTHER_MUSCLE = "other";

    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;

    public GymSignal compute(UUID createdBy, UUID instanceId) {
        List<ExerciseSetEntity> sets = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instanceId);

        // set → exercise → muscle resolution (catalog when linked, else the exercise's own muscle)
        Map<UUID, ExerciseIdentityRow> exercises = new HashMap<>();
        exerciseRepository.findIdentityRowsIncludingDeleted(createdBy)
            .forEach(r -> exercises.put(r.getId(), r));
        Map<UUID, ExerciseCatalogEntity> catalog = new HashMap<>();
        exerciseCatalogRepository.findAll().forEach(c -> catalog.put(c.getId(), c));

        Map<String, Long> volumeByMuscle = new HashMap<>();
        BigDecimal bestE1rm = null;
        int workSetCount = 0;
        int bodyweightRepCount = 0;

        for (ExerciseSetEntity s : sets) {
            if (s.isSkipped() || s.getReps() == null) {
                continue; // skip markers + no-rep rows carry no work
            }
            workSetCount++;
            if (s.getWeightKg() == null) {
                bodyweightRepCount += s.getReps();
                continue; // bodyweight/plyo: no e1RM, no volume
            }
            String muscle = muscleOf(s.getExerciseId(), exercises, catalog);
            long vol = s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps()))
                .setScale(0, RoundingMode.HALF_UP).longValueExact();
            volumeByMuscle.merge(muscle, vol, Long::sum);
            BigDecimal e1rm = epley(s.getWeightKg(), s.getReps());
            if (bestE1rm == null || e1rm.compareTo(bestE1rm) > 0) {
                bestE1rm = e1rm;
            }
        }
        return new GymSignal(instanceId, volumeByMuscle, bestE1rm, workSetCount, bodyweightRepCount);
    }

    private String muscleOf(UUID exerciseId, Map<UUID, ExerciseIdentityRow> exercises,
        Map<UUID, ExerciseCatalogEntity> catalog) {
        ExerciseIdentityRow row = exercises.get(exerciseId);
        if (row == null) {
            return OTHER_MUSCLE;
        }
        String muscle = row.getCatalogId() != null && catalog.containsKey(row.getCatalogId())
            ? catalog.get(row.getCatalogId()).getMuscle()
            : row.getMuscle();
        return (muscle == null || muscle.isBlank()) ? OTHER_MUSCLE : muscle;
    }

    /** Epley e1RM: weight × (30 + reps) / 30, scale 4 HALF_UP (matches ExerciseRecordService). */
    private BigDecimal epley(BigDecimal weightKg, int reps) {
        return weightKg.multiply(BigDecimal.valueOf(30L + reps)).divide(THIRTY, 4, RoundingMode.HALF_UP);
    }
}
