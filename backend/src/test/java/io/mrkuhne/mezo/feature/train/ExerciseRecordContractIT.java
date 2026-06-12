package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** HTTP-level contract for GET /api/train/exercise-records. */
class ExerciseRecordContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testGetExerciseRecords_shouldReturn401_whenNoToken() {
        getForBody("/api/train/exercise-records", null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testGetExerciseRecords_shouldReturnEmptyList_whenNothingLogged() {
        List<ExerciseRecordResponse> records = getForList(
            "/api/train/exercise-records", ownerAuthHeaders(), HttpStatus.OK, ExerciseRecordResponse.class);
        assertThat(records).isEmpty();
    }

    @Test
    void testGetExerciseRecords_shouldServeComputedRecords_whenOwnerHasHistory() {
        UUID by = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
        ExerciseCatalogEntity cat = catalogRepository.findBySlug("barbell-bench-press").orElseThrow();
        MesocycleEntity meso = trainPopulator.createMesocycle(by, "Records meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(by, meso.getId(), "Hét", "Push", 0, "planned");
        WorkoutSessionEntity w = trainPopulator.createWorkoutInstance(
            by, template, LocalDate.parse("2026-06-01"), "completed");
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Barbell Bench Press", 0,
            "chest", "compound", cat.getId());
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, "110", 5, 1,
            Instant.parse("2026-06-01T10:00:00Z"));

        List<ExerciseRecordResponse> records = getForList(
            "/api/train/exercise-records", ownerAuthHeaders(), HttpStatus.OK, ExerciseRecordResponse.class);

        assertThat(records).hasSize(1);
        ExerciseRecordResponse r = records.get(0);
        assertThat(r.getCatalogId()).isEqualTo(cat.getId());
        assertThat(r.getBestSet().getWeightKg()).isEqualByComparingTo("110");
        assertThat(r.getBestE1rm().getValue()).isEqualByComparingTo("128.3");
        assertThat(r.getSessionCount()).isEqualTo(1);
        assertThat(r.getRecentTopSets()).hasSize(1);
    }

    @Test
    void testGetExerciseRecords_shouldIsolateOwners_whenAnotherUserLogged() {
        UUID other = databasePopulator.populateUser("stranger@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(other, "Foreign", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(other, meso.getId(), "Hét", "Push", 0, "planned");
        WorkoutSessionEntity w = trainPopulator.createWorkoutInstance(
            other, template, LocalDate.parse("2026-06-01"), "completed");
        ExerciseEntity ex = trainPopulator.createExercise(other, w.getId(), "Foreign Press", 0);
        trainPopulator.createLoggedSet(other, ex.getId(), w.getId(), 0, "100", 5, 1,
            Instant.parse("2026-06-01T10:00:00Z"));

        List<ExerciseRecordResponse> records = getForList(
            "/api/train/exercise-records", ownerAuthHeaders(), HttpStatus.OK, ExerciseRecordResponse.class);

        assertThat(records).isEmpty();
    }
}
