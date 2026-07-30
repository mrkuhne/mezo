package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Medal collection (bd mezo-wp6n): contract IT for the derived-medal surface. Task 2 covers only
 * the persistence seam — the Progresszió-prescribed target snapshotted onto the logged set at
 * {@code logSet} time. {@code GET /api/train/medals} itself is still the Task 1 placeholder
 * (empty list) until Task 4 replaces it.
 */
class MedalApiIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseSetRepository exerciseSetRepository;
    @Autowired private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testLogSet_shouldPersistTheTargetSnapshot_whenTheRequestCarriesOne() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "active");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);

        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(bench.getId()).setIndex(0)
            .weightKg(new BigDecimal("100.00")).reps(8).rir(2).kind("working")
            .targetWeightKg(new BigDecimal("100.00")).targetReps(8)
            .build();
        ExerciseSetResponse body = postForBody(
            "/api/train/workouts/" + instance.getId() + "/sets", req,
            ownerAuthHeaders(), HttpStatus.CREATED, ExerciseSetResponse.class);

        ExerciseSetEntity reloaded = exerciseSetRepository.findById(body.getId()).orElseThrow();
        assertThat(reloaded.getTargetWeightKg()).isEqualByComparingTo("100.00");
        assertThat(reloaded.getTargetReps()).isEqualTo(8);
    }
}
