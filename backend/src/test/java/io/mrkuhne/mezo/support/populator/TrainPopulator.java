package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
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
    private final ExerciseFeedbackRepository exerciseFeedbackRepository;
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final SportSessionRepository sportSessionRepository;
    private final SportScheduleSlotRepository sportScheduleSlotRepository;

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
        m.setPhaseCurve(List.of("MEV", "MAV", "Deload"));
        m.setVolumeRecompute(new VolumeRecomputeJson("Vasárnap", "Vasárnap", "batch",
            List.of(new VolumeRecomputeJson.Change("back", "MRV +2", "stabil", null))));
        return mesocycleRepository.saveAndFlush(m);
    }

    /**
     * Meso with a uniform single-phase curve of length {@code weeks} — keeps the projection's
     * segmentation driven solely by running on/off (no meso-phase boundaries), so the worked TDEE
     * step numbers stay clean.
     */
    public MesocycleEntity createMesocycleWithPhase(
        UUID createdBy, String title, String status, int weeks, String phase) {
        MesocycleEntity m = new MesocycleEntity();
        m.setCreatedBy(createdBy);
        m.setTitle(title);
        m.setShortTitle(title);
        m.setStatus(status);
        m.setStartDate(LocalDate.parse("2026-06-01"));
        m.setEndDate(LocalDate.parse("2026-06-01").plusWeeks(weeks).minusDays(1));
        m.setWeeks(weeks);
        m.setCurrentWeek(1);
        m.setSplit("Pull / Push / Legs · 5×/hét");
        m.setStyle("RP · " + weeks + " hét");
        List<String> curve = new java.util.ArrayList<>();
        for (int i = 0; i < weeks; i++) {
            curve.add(phase);
        }
        m.setPhaseCurve(curve);
        m.setVolumeRecompute(new VolumeRecomputeJson("Vasárnap", "Vasárnap", "batch",
            List.of(new VolumeRecomputeJson.Change("back", "MRV +2", "stabil", null))));
        return mesocycleRepository.saveAndFlush(m);
    }

    public MuscleGroupVolumeLogEntity createVolumeLog(UUID createdBy, UUID mesocycleId, String muscle) {
        return createVolumeLog(createdBy, mesocycleId, muscle, 14);
    }

    /** Volume log with an explicit prescribed weekly hard-set count (muscle-guard tests). */
    public MuscleGroupVolumeLogEntity createVolumeLog(
        UUID createdBy, UUID mesocycleId, String muscle, int currentSets) {
        MuscleGroupVolumeLogEntity v = new MuscleGroupVolumeLogEntity();
        v.setCreatedBy(createdBy);
        v.setMesocycleId(mesocycleId);
        v.setMuscle(muscle);
        v.setMev(8);
        v.setMav(14);
        v.setMrv(20);
        v.setCurrentSets(currentSets);
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

    /** An active mesocycle — high-level scenario builder for the prescribed-sets round-trip. */
    public MesocycleEntity createActiveMeso(UUID createdBy) {
        return createMesocycle(createdBy, "P1 meso", "active");
    }

    /** A template day (templateSessionId null) hanging off a meso — logSet's exercise chain root. */
    public WorkoutSessionEntity createTemplateDay(UUID createdBy, UUID mesocycleId, String dayLabel) {
        return createWorkoutSession(createdBy, mesocycleId, dayLabel, "gym", 0, "active");
    }

    /** Start an active instance from a template day (copies the day fields, links templateSessionId). */
    public WorkoutSessionEntity startInstance(UUID createdBy, UUID templateDayId) {
        WorkoutSessionEntity template = workoutSessionRepository.findById(templateDayId).orElseThrow();
        return createWorkoutInstance(createdBy, template, LocalDate.now(), "active");
    }

    public ExerciseEntity createExercise(UUID createdBy, UUID workoutSessionId, String name,
        int orderIndex) {
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(createdBy);
        e.setWorkoutSessionId(workoutSessionId);
        e.setName(name);
        e.setMuscle("hát");
        e.setWarmupSets(2);
        e.setWorkingSets(3);
        e.setRepMin(6);
        e.setRepMax(8);
        e.setTargetRir(1);
        e.setType("compound");
        e.setOrderIndex(orderIndex);
        return exerciseRepository.saveAndFlush(e);
    }

    /** Recipe-shaped exercise with explicit muscle/type (P1 prescribed-sets round-trip tests). */
    public ExerciseEntity createExercise(UUID createdBy, UUID workoutSessionId, String name,
        String muscle, String type) {
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(createdBy);
        e.setWorkoutSessionId(workoutSessionId);
        e.setName(name);
        e.setMuscle(muscle);
        e.setWarmupSets(2);
        e.setWorkingSets(3);
        e.setRepMin(6);
        e.setRepMax(8);
        e.setTargetRir(0);
        e.setType(type);
        e.setOrderIndex(0);
        return exerciseRepository.saveAndFlush(e);
    }

    /** Catalog-linked exercise with explicit muscle/type — record-aggregation tests. */
    public ExerciseEntity createExercise(UUID createdBy, UUID workoutSessionId, String name,
        int orderIndex, String muscle, String type, UUID catalogId) {
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(createdBy);
        e.setWorkoutSessionId(workoutSessionId);
        e.setName(name);
        e.setMuscle(muscle);
        e.setWarmupSets(2);
        e.setWorkingSets(3);
        e.setRepMin(6);
        e.setRepMax(8);
        e.setTargetRir(1);
        e.setType(type);
        e.setCatalogId(catalogId);
        e.setOrderIndex(orderIndex);
        return exerciseRepository.saveAndFlush(e);
    }

    /** Logged set with explicit doneAt (record date/ordering tests); weightKg null = bodyweight. */
    public ExerciseSetEntity createLoggedSet(UUID createdBy, UUID exerciseId, UUID workoutSessionId,
        int setIndex, String weightKg, int reps, int rir, Instant doneAt) {
        ExerciseSetEntity set = new ExerciseSetEntity();
        set.setCreatedBy(createdBy);
        set.setExerciseId(exerciseId);
        set.setWorkoutSessionId(workoutSessionId);
        set.setSetIndex(setIndex);
        set.setWeightKg(weightKg != null ? new BigDecimal(weightKg) : null);
        set.setReps(reps);
        set.setRir(rir);
        set.setDoneAt(doneAt);
        return exerciseSetRepository.saveAndFlush(set);
    }

    /** Fully-specified set (explicit weight/reps/skip) — GymSignal aggregation tests. */
    public ExerciseSetEntity createExerciseSetFull(UUID createdBy, UUID exerciseId,
        UUID workoutSessionId, int setIndex, BigDecimal weightKg, Integer reps, boolean skipped) {
        ExerciseSetEntity s = new ExerciseSetEntity();
        s.setCreatedBy(createdBy);
        s.setExerciseId(exerciseId);
        s.setWorkoutSessionId(workoutSessionId);
        s.setSetIndex(setIndex);
        s.setWeightKg(weightKg);
        s.setReps(reps);
        s.setSkipped(skipped);
        return exerciseSetRepository.saveAndFlush(s);
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

    /** Instance row: copies the template's day fields, links back via templateSessionId. */
    public WorkoutSessionEntity createWorkoutInstance(UUID createdBy, WorkoutSessionEntity template,
        LocalDate date, String status) {
        WorkoutSessionEntity s = new WorkoutSessionEntity();
        s.setCreatedBy(createdBy);
        s.setMesocycleId(template.getMesocycleId());
        s.setTemplateSessionId(template.getId());
        s.setDayLabel(template.getDayLabel());
        s.setType(template.getType());
        s.setMuscle(template.getMuscle());
        s.setMuscleAccent(template.isMuscleAccent());
        s.setOrderIndex(template.getOrderIndex());
        s.setDate(date);
        s.setStatus(status);
        return workoutSessionRepository.saveAndFlush(s);
    }

    /** Logged set inside an instance (T2 path — workoutSessionId set, side/note carried). */
    public ExerciseSetEntity createLoggedSet(UUID createdBy, UUID exerciseId, UUID workoutSessionId,
        int setIndex, String weightKg, int reps, int rir) {
        ExerciseSetEntity set = new ExerciseSetEntity();
        set.setCreatedBy(createdBy);
        set.setExerciseId(exerciseId);
        set.setWorkoutSessionId(workoutSessionId);
        set.setSetIndex(setIndex);
        set.setWeightKg(new BigDecimal(weightKg));
        set.setReps(reps);
        set.setRir(rir);
        return exerciseSetRepository.saveAndFlush(set);
    }

    /** Persist an exercise (e.g. after mutating anchor/targetRir on a factory-returned entity). */
    public ExerciseEntity save(ExerciseEntity exercise) {
        return exerciseRepository.saveAndFlush(exercise);
    }

    /**
     * A detached set carrying only kind + performance (weight/reps/rir) — the building block for
     * {@link #completedInstanceWithSets}, which fills in owner/exercise/instance/index before saving.
     */
    public ExerciseSetEntity set(String kind, BigDecimal weightKg, int reps, int rir) {
        ExerciseSetEntity s = new ExerciseSetEntity();
        s.setKind(kind);
        s.setWeightKg(weightKg);
        s.setReps(reps);
        s.setRir(rir);
        return s;
    }

    /**
     * A completed instance of {@code templateDayId} carrying one working set — the double-progression
     * reference the recommendation engine reads back.
     */
    public WorkoutSessionEntity completedInstanceWithWorkingSet(UUID createdBy, UUID templateDayId,
        UUID exerciseId, BigDecimal weightKg, int reps, int rir) {
        return completedInstanceWithSets(createdBy, templateDayId, exerciseId,
            sets -> sets.add(set("working", weightKg, reps, rir)));
    }

    /**
     * A completed instance of {@code templateDayId} with caller-built sets. The {@code builder} adds
     * {@link #set} rows (kind/weight/reps/rir); each is persisted against this instance and exercise
     * with an incrementing {@code setIndex} and {@code doneAt = now}.
     */
    public WorkoutSessionEntity completedInstanceWithSets(UUID createdBy, UUID templateDayId,
        UUID exerciseId, Consumer<List<ExerciseSetEntity>> builder) {
        WorkoutSessionEntity template = workoutSessionRepository.findById(templateDayId).orElseThrow();
        WorkoutSessionEntity instance = createWorkoutInstance(createdBy, template, LocalDate.now(), "completed");
        List<ExerciseSetEntity> sets = new ArrayList<>();
        builder.accept(sets);
        int setIndex = 0;
        for (ExerciseSetEntity s : sets) {
            s.setCreatedBy(createdBy);
            s.setExerciseId(exerciseId);
            s.setWorkoutSessionId(instance.getId());
            s.setSetIndex(setIndex++);
            s.setDoneAt(Instant.now());
            exerciseSetRepository.saveAndFlush(s);
        }
        return instance;
    }

    public ExerciseFeedbackEntity createFeedback(UUID createdBy, UUID workoutSessionId, UUID exerciseId) {
        ExerciseFeedbackEntity f = new ExerciseFeedbackEntity();
        f.setCreatedBy(createdBy);
        f.setWorkoutSessionId(workoutSessionId);
        f.setExerciseId(exerciseId);
        f.setPump(3);
        f.setJointPain(1);
        f.setWorkload(2);
        return exerciseFeedbackRepository.saveAndFlush(f);
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

    /** A sport session of any modality — volleyball|cross|trx — with kind-appropriate effort. */
    public SportSessionEntity createSportSession(UUID createdBy, LocalDate date, String sport,
        Integer setsPlayed, Integer rounds, String rpe) {
        SportSessionEntity s = new SportSessionEntity();
        s.setCreatedBy(createdBy);
        s.setSport(sport);
        s.setDate(date);
        s.setTime("18:00");
        s.setDurationMin(60);
        s.setSetsPlayed(setsPlayed);
        s.setRounds(rounds);
        s.setRpe(new BigDecimal(rpe));
        return sportSessionRepository.saveAndFlush(s);
    }

    public GymScheduleSlotEntity createGymSlot(UUID createdBy, int dayOfWeek, String time) {
        GymScheduleSlotEntity s = new GymScheduleSlotEntity();
        s.setCreatedBy(createdBy);
        s.setDayOfWeek(dayOfWeek);
        s.setTime(time);
        return gymScheduleSlotRepository.saveAndFlush(s);
    }

    public SportScheduleSlotEntity createScheduleSlot(UUID createdBy, int dayOfWeek, String time,
        int durationMin, String kind) {
        SportScheduleSlotEntity s = new SportScheduleSlotEntity();
        s.setCreatedBy(createdBy);
        s.setDayOfWeek(dayOfWeek);
        s.setTime(time);
        s.setDurationMin(durationMin);
        s.setKind(kind);
        s.setLocation("BVSC csarnok");
        s.setIntensityLabel("közepes");
        return sportScheduleSlotRepository.saveAndFlush(s);
    }
}
