package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** mezo-gbo7: the per-exercise hypertrophy-volume exemption flag persists and defaults to true. */
class ExerciseVolumeFlagIT extends AbstractIntegrationTest {

    @Autowired TrainPopulator train;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    @Test
    void testExercise_shouldDefaultToCountingTowardVolume_whenFlagNotSet() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Hét");

        ExerciseEntity saved = train.createExercise(owner, day.getId(), "Pull-Up", "back-wide", "compound");

        assertThat(saved.isCountsTowardVolume()).isTrue();
    }

    @Test
    void testExercise_shouldPersistFalse_whenExplicitlyExempted() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity exercise = train.createExercise(owner, day.getId(), "Dead Hang", "back-wide", "plyo");

        exercise.setCountsTowardVolume(false);
        train.save(exercise);

        assertThat(exerciseRepository.findById(exercise.getId()).orElseThrow().isCountsTowardVolume()).isFalse();
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }
}
