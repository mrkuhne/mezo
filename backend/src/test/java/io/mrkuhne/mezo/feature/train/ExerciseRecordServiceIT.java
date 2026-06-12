package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.api.dto.RecordSetRef;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aggregation rules for per-exercise records: identity (catalog_id, name fallback,
 * soft-deleted template rows), best-set/e1RM tie-breaks, session volume grouping,
 * bodyweight handling, rep records, recent-top-sets ordering, owner isolation.
 */
@Transactional
class ExerciseRecordServiceIT extends AbstractIntegrationTest {

    @Autowired private ExerciseRecordService service;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private static Instant day(int offset) {
        return Instant.parse("2026-06-01T10:00:00Z").plusSeconds(offset * 86_400L);
    }

    /** meso + template day + instance; returns the instance for set linkage. */
    private WorkoutSessionEntity instanceFor(UUID by, String title) {
        MesocycleEntity meso = trainPopulator.createMesocycle(by, title, "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(by, meso.getId(), "Hét", "Push", 0, "planned");
        return trainPopulator.createWorkoutInstance(by, template, LocalDate.parse("2026-06-01"), "completed");
    }

    @Test
    void testList_shouldComputeBestSetAndE1rm_whenTieBreaksApply() {
        UUID by = databasePopulator.populateUser("rec1@test.local");
        WorkoutSessionEntity w = instanceFor(by, "R1");
        UUID catalogId = catalogRepository.findBySlug("barbell-bench-press").orElseThrow().getId();
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Barbell Bench Press", 0,
            "chest", "compound", catalogId);
        // same weight, fewer reps, earlier — must lose both tie-breaks
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, "110", 4, 1, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 1, "110", 5, 1, day(1));
        // lighter but high-rep set wins e1RM: 100×(1+12/30)=140 > 110×(1+5/30)=128.3
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 2, "100", 12, 1, day(2));

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).hasSize(1);
        ExerciseRecordResponse r = records.get(0);
        assertThat(r.getCatalogId()).isEqualTo(catalogId);
        assertThat(r.getName()).isEqualTo("Barbell Bench Press");
        assertThat(r.getMuscle()).isEqualTo("chest"); // catalog-sourced display
        assertThat(r.getBestSet().getWeightKg()).isEqualByComparingTo("110");
        assertThat(r.getBestSet().getReps()).isEqualTo(5);
        assertThat(r.getBestE1rm().getValue()).isEqualByComparingTo("140.0");
        assertThat(r.getBestE1rm().getSet().getWeightKg()).isEqualByComparingTo("100");
    }

    @Test
    void testList_shouldAggregateAcrossMesos_whenSameCatalogId() {
        UUID by = databasePopulator.populateUser("rec2@test.local");
        UUID catalogId = catalogRepository.findBySlug("barbell-squat").orElseThrow().getId();
        WorkoutSessionEntity w1 = instanceFor(by, "Old meso");
        WorkoutSessionEntity w2 = instanceFor(by, "New meso");
        ExerciseEntity e1 = trainPopulator.createExercise(by, w1.getId(), "Barbell Squat", 0, "quad", "compound", catalogId);
        ExerciseEntity e2 = trainPopulator.createExercise(by, w2.getId(), "Barbell Squat", 0, "quad", "compound", catalogId);
        trainPopulator.createLoggedSet(by, e1.getId(), w1.getId(), 0, "140", 3, 1, day(0));
        trainPopulator.createLoggedSet(by, e2.getId(), w2.getId(), 0, "150", 3, 1, day(7));

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).hasSize(1); // ONE identity across two mesos
        assertThat(records.get(0).getSessionCount()).isEqualTo(2);
        assertThat(records.get(0).getBestSet().getWeightKg()).isEqualByComparingTo("150");
    }

    @Test
    void testList_shouldKeepHistory_whenTemplateExerciseSoftDeleted() {
        UUID by = databasePopulator.populateUser("rec3@test.local");
        UUID catalogId = catalogRepository.findBySlug("romanian-deadlift").orElseThrow().getId();
        WorkoutSessionEntity w = instanceFor(by, "R3");
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Romanian Deadlift", 0, "ham", "compound", catalogId);
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, "120", 8, 1, day(0));
        exerciseRepository.delete(ex); // @SQLDelete -> is_deleted=true, the set survives
        exerciseRepository.flush();

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).hasSize(1);
        assertThat(records.get(0).getBestSet().getWeightKg()).isEqualByComparingTo("120");
    }

    @Test
    void testList_shouldGroupByName_whenNoCatalogLink() {
        UUID by = databasePopulator.populateUser("rec4@test.local");
        WorkoutSessionEntity w1 = instanceFor(by, "R4a");
        WorkoutSessionEntity w2 = instanceFor(by, "R4b");
        // legacy rows: no catalogId — same name must merge into one identity
        ExerciseEntity e1 = trainPopulator.createExercise(by, w1.getId(), "Mystery Row", 0);
        ExerciseEntity e2 = trainPopulator.createExercise(by, w2.getId(), "Mystery Row", 0);
        trainPopulator.createLoggedSet(by, e1.getId(), w1.getId(), 0, "80", 10, 1, day(0));
        trainPopulator.createLoggedSet(by, e2.getId(), w2.getId(), 0, "85", 10, 1, day(1));

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).hasSize(1);
        assertThat(records.get(0).getCatalogId()).isNull();
        assertThat(records.get(0).getName()).isEqualTo("Mystery Row");
        assertThat(records.get(0).getSessionCount()).isEqualTo(2);
    }

    @Test
    void testList_shouldComputeSessionVolumeAndTotals_whenMultipleSessions() {
        UUID by = databasePopulator.populateUser("rec5@test.local");
        UUID catalogId = catalogRepository.findBySlug("leg-press").orElseThrow().getId();
        WorkoutSessionEntity w1 = instanceFor(by, "R5a");
        WorkoutSessionEntity w2 = instanceFor(by, "R5b");
        ExerciseEntity e1 = trainPopulator.createExercise(by, w1.getId(), "Leg Press", 0, "quad", "compound", catalogId);
        ExerciseEntity e2 = trainPopulator.createExercise(by, w2.getId(), "Leg Press", 0, "quad", "compound", catalogId);
        trainPopulator.createLoggedSet(by, e1.getId(), w1.getId(), 0, "200", 10, 1, day(0)); // 2000
        trainPopulator.createLoggedSet(by, e1.getId(), w1.getId(), 1, "200", 8, 1, day(0));  // 1600 -> 3600
        trainPopulator.createLoggedSet(by, e2.getId(), w2.getId(), 0, "210", 9, 1, day(7));  // 1890

        ExerciseRecordResponse r = service.list(by).get(0);

        assertThat(r.getBestSessionVolume().getVolumeKg()).isEqualByComparingTo("3600");
        assertThat(r.getTotalVolume()).isEqualByComparingTo("5490");
        assertThat(r.getTotalSets()).isEqualTo(3);
        assertThat(r.getTotalReps()).isEqualTo(27);
        assertThat(r.getSessionCount()).isEqualTo(2);
    }

    @Test
    void testList_shouldServeCountersWithoutWeightPrs_whenBodyweightOnly() {
        UUID by = databasePopulator.populateUser("rec6@test.local");
        UUID catalogId = catalogRepository.findBySlug("box-jump").orElseThrow().getId();
        WorkoutSessionEntity w = instanceFor(by, "R6");
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Box Jump", 0, "quad", "plyo", catalogId);
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, null, 10, 2, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 1, null, 12, 2, day(0));

        ExerciseRecordResponse r = service.list(by).get(0);

        assertThat(r.getType().getValue()).isEqualTo("plyo");
        assertThat(r.getBestSet()).isNull();
        assertThat(r.getBestE1rm()).isNull();
        assertThat(r.getBestSessionVolume()).isNull();
        assertThat(r.getTotalVolume()).isEqualByComparingTo("0");
        assertThat(r.getTotalReps()).isEqualTo(22);
        assertThat(r.getRepRecords()).isEmpty();
        assertThat(r.getRecentTopSets()).hasSize(1); // one session -> its top set (12 reps)
        assertThat(r.getRecentTopSets().get(0).getReps()).isEqualTo(12);
    }

    @Test
    void testList_shouldRankRepRecords_whenManyWeightsUsed() {
        UUID by = databasePopulator.populateUser("rec7@test.local");
        UUID catalogId = catalogRepository.findBySlug("overhead-press").orElseThrow().getId();
        WorkoutSessionEntity w = instanceFor(by, "R7");
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Overhead Press", 0, "shoulder", "compound", catalogId);
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, "60", 6, 1, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 1, "60", 8, 1, day(1)); // better at 60
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 2, "55", 10, 1, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 3, "50", 12, 1, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 4, "45", 15, 1, day(0)); // 4th weight -> cut

        List<RecordSetRef> reps = service.list(by).get(0).getRepRecords();

        assertThat(reps).hasSize(3);
        assertThat(reps.get(0).getWeightKg()).isEqualByComparingTo("60");
        assertThat(reps.get(0).getReps()).isEqualTo(8);
        assertThat(reps.get(1).getWeightKg()).isEqualByComparingTo("55");
        assertThat(reps.get(2).getWeightKg()).isEqualByComparingTo("50");
    }

    @Test
    void testList_shouldReturnLastFiveSessionsOldestFirst_whenSixSessionsExist() {
        UUID by = databasePopulator.populateUser("rec8@test.local");
        UUID catalogId = catalogRepository.findBySlug("hip-thrust").orElseThrow().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(by, "R8", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(by, meso.getId(), "Hét", "Push", 0, "planned");
        for (int i = 0; i < 6; i++) {
            WorkoutSessionEntity w = trainPopulator.createWorkoutInstance(
                by, template, LocalDate.parse("2026-06-01").plusDays(i), "completed");
            ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Hip Thrust", 0, "glute", "compound", catalogId);
            trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, String.valueOf(100 + i), 8, 1, day(i));
        }

        List<RecordSetRef> recent = service.list(by).get(0).getRecentTopSets();

        assertThat(recent).hasSize(5);
        // session 0 (100kg) dropped; oldest-first: 101..105
        assertThat(recent.get(0).getWeightKg()).isEqualByComparingTo("101");
        assertThat(recent.get(4).getWeightKg()).isEqualByComparingTo("105");
    }

    @Test
    void testList_shouldIsolateOwners_whenOtherUserHasRecords() {
        UUID owner = databasePopulator.populateUser("rec9a@test.local");
        UUID other = databasePopulator.populateUser("rec9b@test.local");
        WorkoutSessionEntity w = instanceFor(other, "R9");
        ExerciseEntity ex = trainPopulator.createExercise(other, w.getId(), "Barbell Curl", 0);
        trainPopulator.createLoggedSet(other, ex.getId(), w.getId(), 0, "40", 10, 1, day(0));

        assertThat(service.list(owner)).isEmpty();
        assertThat(service.list(other)).hasSize(1);
    }

    @Test
    void testList_shouldSortBySessionCountThenName_whenMultipleExercises() {
        UUID by = databasePopulator.populateUser("rec10@test.local");
        WorkoutSessionEntity w1 = instanceFor(by, "R10a");
        WorkoutSessionEntity w2 = instanceFor(by, "R10b");
        // "B Exercise": 2 sessions; "A Exercise" + "C Exercise": 1 session each
        ExerciseEntity b1 = trainPopulator.createExercise(by, w1.getId(), "B Exercise", 0);
        ExerciseEntity b2 = trainPopulator.createExercise(by, w2.getId(), "B Exercise", 0);
        ExerciseEntity a = trainPopulator.createExercise(by, w1.getId(), "A Exercise", 1);
        ExerciseEntity c = trainPopulator.createExercise(by, w1.getId(), "C Exercise", 2);
        trainPopulator.createLoggedSet(by, b1.getId(), w1.getId(), 0, "50", 8, 1, day(0));
        trainPopulator.createLoggedSet(by, b2.getId(), w2.getId(), 0, "50", 8, 1, day(1));
        trainPopulator.createLoggedSet(by, a.getId(), w1.getId(), 0, "50", 8, 1, day(0));
        trainPopulator.createLoggedSet(by, c.getId(), w1.getId(), 0, "50", 8, 1, day(0));

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).extracting(ExerciseRecordResponse::getName)
            .containsExactly("B Exercise", "A Exercise", "C Exercise");
    }
}
