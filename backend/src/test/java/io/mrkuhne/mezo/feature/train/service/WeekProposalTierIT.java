package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The weekly proposal per tier and per signal (volume engine v2, spec §6.4) — the re-created
 * intent of the retired {@code VolumeProgressionServiceIT} / {@code VolumeProgressionTierIT}
 * rollover cases under "the plan is the amount": the step moves exercise sets, the ledger follows.
 * Every run here is in week 3, so week 2 is "last week".
 */
class WeekProposalTierIT extends AbstractIntegrationTest {

    private static final List<String> CURVE = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;

    private UUID owner;
    private MesocycleEntity meso;
    private WorkoutSessionEntity mon;
    private WorkoutSessionEntity wed;
    private WorkoutSessionEntity fri;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("week-tier@test.local");
    }

    private void run(Map<String, String> priorities) {
        meso = train.activeMesoStartedWeeksAgo(owner, 2, 6, CURVE);
        meso.setMusclePriorities(priorities);
        meso = mesocycleRepository.saveAndFlush(meso);
        mon = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "gym", 0, "active");
        wed = train.createWorkoutSession(owner, meso.getId(), "Szerda", "gym", 2, "active");
        fri = train.createWorkoutSession(owner, meso.getId(), "Péntek", "gym", 4, "active");
    }

    /** Emphasize +2, grow +1, maintain 0 — and never past the tier band's top. */
    @Test
    void tiersStepDifferently() {
        run(Map.of("back", "emphasize", "shoulder", "emphasize", "glute", "maintain"));
        // back, emphasize (band 14–22), 16 → 18
        ExerciseEntity[] back = {
            ex(mon, "back-mid", 3), ex(mon, "back-wide", 3), ex(wed, "back-mid", 3),
            ex(wed, "back-wide", 2), ex(fri, "back-mid", 3), ex(fri, "back-wide", 2)};
        // shoulder, emphasize (band 10–18), 17 → 18: the +2 is capped at the band's top
        ExerciseEntity[] shoulder = {
            ex(mon, "shoulder-front", 5), ex(wed, "shoulder-side", 4), ex(wed, "shoulder-rear", 4),
            ex(fri, "shoulder-side", 4)};
        // biceps, grow (band 6–10), 6 → 7
        ExerciseEntity[] biceps = {ex(mon, "biceps", 3), ex(wed, "biceps", 3)};
        // chest, grow (band 8–14), already at the top: 14 holds
        ExerciseEntity[] chest = {ex(mon, "chest-mid", 5), ex(wed, "chest-upper", 5), ex(fri, "chest-mid", 4)};
        // glute, maintain: 8 holds, never steps
        ExerciseEntity[] glute = {ex(mon, "glute", 4), ex(fri, "glute", 4)};
        logAll(0, back, shoulder, biceps, chest, glute);

        workoutService.getToday(owner, null);

        assertThat(ledger("back")).isEqualTo(18);
        assertThat(ledger("shoulder")).isEqualTo(18);
        assertThat(ledger("biceps")).isEqualTo(7);
        assertThat(ledger("chest")).isEqualTo(14);
        assertThat(ledger("glute")).isEqualTo(8);
        List<VolumeRecomputeJson.Change> changes = audit().changes();
        assertThat(changes).anyMatch(c -> c.muscle().equals("back") && c.change().equals("+2 (16 → 18)"));
        assertThat(changes).anyMatch(c -> c.muscle().equals("shoulder") && c.change().equals("+1 (17 → 18)"));
        assertThat(changes).anyMatch(c -> c.muscle().equals("biceps") && c.change().equals("+1 (6 → 7)"));
        assertThat(changes).anyMatch(c -> c.muscle().equals("chest") && c.change().equals("tart (14)"));
        assertThat(changes).anyMatch(c -> c.muscle().equals("glute") && c.change().equals("tart (8)"));
    }

    /** Re-creates VolumeProgressionServiceIT's grind case: every set done, but grinding → hold. */
    @Test
    void aGrindHolds() {
        run(Map.of());
        ExerciseEntity[] chest = {
            ex(mon, "chest-mid", 3, 3), ex(mon, "chest-upper", 2, 3), ex(fri, "chest-mid", 3, 3),
            ex(fri, "chest-lower", 2, 3)};
        logAll(0, chest); // RIR 0 against a target of 3: 0 <= 3 − 2 → grind

        workoutService.getToday(owner, null);

        assertThat(ledger("chest")).isEqualTo(10);
        assertThat(audit().changes()).anyMatch(c -> c.muscle().equals("chest") && c.change().equals("tart (10)"));
    }

    /** Re-creates the exempt-grind case: a grinding exempt hang does not hold a cleanly done group. */
    @Test
    void anExemptExercisesGrindDoesNotHoldACountingGroup() {
        run(Map.of());
        ExerciseEntity[] back = {
            ex(mon, "back-mid", 3, 1), ex(mon, "back-wide", 2, 1), ex(fri, "back-mid", 3, 1),
            ex(fri, "back-wide", 2, 1)};
        ExerciseEntity hang = exempt(mon, 5, 3);
        logAll(1, back);   // RIR equals the target: no grind of their own
        logAll(0, hang);   // deep grind, but exempt

        workoutService.getToday(owner, null);

        assertThat(ledger("back")).isEqualTo(11);
    }

    /** Re-creates the exempt-volume case: an exempt exercise's logged sets are not done volume. */
    @Test
    void exemptSetsDoNotCountAsDoneVolume() {
        run(Map.of());
        ex(mon, "back-mid", 3);
        ex(mon, "back-wide", 2);
        ex(fri, "back-mid", 3);
        ex(fri, "back-wide", 2);
        ExerciseEntity hang = exempt(mon, 10, 0);
        logAll(0, hang); // ten logged sets — none of them counting

        workoutService.getToday(owner, null);

        assertThat(ledger("back")).isEqualTo(10);
        assertThat(audit().changes()).anyMatch(c -> c.muscle().equals("back") && c.change().equals("tart (10)"));
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    private ExerciseEntity ex(WorkoutSessionEntity day, String muscle, int sets) {
        return ex(day, muscle, sets, 0);
    }

    private ExerciseEntity ex(WorkoutSessionEntity day, String muscle, int sets, int targetRir) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), muscle + " gyakorlat", muscle, "compound");
        e.setWorkingSets(sets);
        e.setTargetRir(targetRir);
        return train.save(e);
    }

    private ExerciseEntity exempt(WorkoutSessionEntity day, int sets, int targetRir) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");
        e.setWorkingSets(sets);
        e.setTargetRir(targetRir);
        e.setCountsTowardVolume(false);
        return train.save(e);
    }

    /** One completed week-2 instance per template day; every planned set of each exercise logged at {@code rir}. */
    private void logAll(int rir, Object... exercises) {
        Map<UUID, WorkoutSessionEntity> instances = new java.util.HashMap<>();
        for (Object o : exercises) {
            ExerciseEntity[] group = o instanceof ExerciseEntity e ? new ExerciseEntity[] {e} : (ExerciseEntity[]) o;
            for (ExerciseEntity e : group) {
                WorkoutSessionEntity day = List.of(mon, wed, fri).stream()
                    .filter(d -> d.getId().equals(e.getWorkoutSessionId())).findFirst().orElseThrow();
                WorkoutSessionEntity instance = instances.computeIfAbsent(day.getId(), k -> train.createWorkoutInstance(
                    owner, day, meso.getStartDate().plusDays(7L + day.getOrderIndex()), "completed"));
                for (int s = 0; s < e.getWorkingSets(); s++) {
                    train.createLoggedSet(owner, e.getId(), instance.getId(), s, "60", 8, rir);
                }
            }
        }
    }

    private int ledger(String group) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(meso.getId())).stream()
            .filter(r -> r.getMuscle().equals(group)).findFirst()
            .map(MuscleGroupVolumeLogEntity::getCurrentSets).orElseThrow();
    }

    private VolumeRecomputeJson audit() {
        return mesocycleRepository.findById(meso.getId()).orElseThrow().getVolumeRecompute();
    }
}
