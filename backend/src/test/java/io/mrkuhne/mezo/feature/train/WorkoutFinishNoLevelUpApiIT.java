package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Contract IT for the gym finish after the XP world left the server (mezo-r36n9.97.5): finishing a
 * gym instance that has logged sets still completes it, and the optional {@code levelUp} — kept in
 * the contract only because the iPhone's contract copy still lists it — is never populated. Drives
 * the GENERATED contract over HTTP (the iPhone's finishWorkout path).
 */
class WorkoutFinishNoLevelUpApiIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testFinishWorkout_shouldCompleteWithoutLevelUp_whenActiveInstanceHasLoggedSets() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        // finishWorkout's ownedInstanceOrThrow only accepts INSTANCE rows (templateSessionId != null),
        // so the gym session under test must be an instance of a template, not a bare template row.
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "active");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        bench.setMuscle("chest");
        exerciseRepository.saveAndFlush(bench);
        trainPopulator.createExerciseSetFull(owner, bench.getId(), instance.getId(), 0,
            new BigDecimal("100.00"), 10, false);

        WorkoutInstanceResponse body = postForBody(
            "/api/train/workouts/" + instance.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(body.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        assertThat(body.getSets()).hasSize(1);
        assertThat(body.getLevelUp()).isNull();
    }
}
