package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the Train aggregate (mesocycle + per-muscle volume log) — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB constraints fire.
 */
@TestComponent
@RequiredArgsConstructor
public class TrainPopulator {

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final SportSessionRepository sportSessionRepository;

    public MesocycleEntity createMesocycle(UUID createdBy, String title, String status) {
        MesocycleEntity m = new MesocycleEntity();
        m.setCreatedBy(createdBy);
        m.setTitle(title);
        m.setShortTitle(title);
        m.setStatus(status);
        m.setStartDate(LocalDate.parse("2026-05-01"));
        m.setEndDate(LocalDate.parse("2026-06-12"));
        m.setWeeks(6);
        m.setCurrentWeek(3);
        m.setSplit("Pull / Push / Legs · 5×/hét");
        m.setStyle("RP · 6 hét");
        m.setPhaseCurve(new String[] {"MEV", "MAV", "Deload"});
        m.setVolumeRecompute(new VolumeRecomputeJson("Vasárnap", "Vasárnap", "batch",
            List.of(new VolumeRecomputeJson.Change("back", "MRV +2", "stabil", null))));
        return mesocycleRepository.saveAndFlush(m);
    }

    public MuscleGroupVolumeLogEntity createVolumeLog(UUID createdBy, UUID mesocycleId, String muscle) {
        MuscleGroupVolumeLogEntity v = new MuscleGroupVolumeLogEntity();
        v.setCreatedBy(createdBy);
        v.setMesocycleId(mesocycleId);
        v.setMuscle(muscle);
        v.setMev(8);
        v.setMav(14);
        v.setMrv(20);
        v.setCurrentSets(14);
        v.setSource(new ProvenanceEnvelope(
            new ProvenanceEnvelope.Baseline("RP guidelines · intermediate", 8, 12, 18),
            List.of(new ProvenanceEnvelope.Adjustment("pattern", "test", Map.of("mrv", 2), null)),
            0.78, null, null));
        return volumeLogRepository.saveAndFlush(v);
    }

    public WorkoutSessionEntity createWorkoutSession(UUID createdBy, UUID mesocycleId,
        String dayLabel, String type, int orderIndex, String status) {
        return createWorkoutSession(createdBy, mesocycleId, dayLabel, type, orderIndex, status, false);
    }

    public WorkoutSessionEntity createWorkoutSession(UUID createdBy, UUID mesocycleId,
        String dayLabel, String type, int orderIndex, String status, boolean muscleAccent) {
        WorkoutSessionEntity s = new WorkoutSessionEntity();
        s.setCreatedBy(createdBy);
        s.setMesocycleId(mesocycleId);
        s.setDayLabel(dayLabel);
        s.setType(type);
        s.setMuscle("hát");
        s.setMuscleAccent(muscleAccent);
        s.setOrderIndex(orderIndex);
        s.setStatus(status);
        return workoutSessionRepository.saveAndFlush(s);
    }

    public ExerciseEntity createExercise(UUID createdBy, UUID workoutSessionId, String name,
        int orderIndex) {
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(createdBy);
        e.setWorkoutSessionId(workoutSessionId);
        e.setName(name);
        e.setMuscle("hát");
        e.setSets(3);
        e.setTargetReps("8-10");
        e.setTargetRir(1);
        e.setType("compound");
        e.setOrderIndex(orderIndex);
        return exerciseRepository.saveAndFlush(e);
    }

    public ExerciseSetEntity createExerciseSet(UUID createdBy, UUID exerciseId, int setIndex) {
        ExerciseSetEntity set = new ExerciseSetEntity();
        set.setCreatedBy(createdBy);
        set.setExerciseId(exerciseId);
        set.setSetIndex(setIndex);
        set.setWeightKg(new BigDecimal("82.50"));
        set.setReps(8);
        set.setRir(1);
        return exerciseSetRepository.saveAndFlush(set);
    }

    public SportSessionEntity createSportSession(UUID createdBy, LocalDate date) {
        SportSessionEntity s = new SportSessionEntity();
        s.setCreatedBy(createdBy);
        s.setDate(date);
        // sport stays the entity default "volleyball".
        s.setTime("18:15");
        s.setDurationMin(90);
        s.setSetsPlayed(5);
        s.setIntensity(7);
        s.setRpe(new BigDecimal("6.8"));
        s.setShoulderStrain(6);
        s.setJumpCount(38);
        return sportSessionRepository.saveAndFlush(s);
    }
}
