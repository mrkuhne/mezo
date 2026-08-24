package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.service.ClosingBlockService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** mezo-gbo7: fix-zárás rows are posture work — they must never enter the volume model. */
class ClosingBlockVolumeFlagIT extends AbstractIntegrationTest {

    @Autowired ClosingBlockService closingBlockService;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired TrainPopulator train;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    @Test
    void testEnsureClosingExercises_shouldExemptAppendedRowsFromVolume() {
        UUID owner = ownerId();
        MesocycleEntity meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Hét");
        train.createExercise(owner, day.getId(), "Pull-Up", "back-wide", "compound");

        closingBlockService.ensureClosingExercises(owner, meso.getId());

        List<ExerciseEntity> appended = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, List.of(day.getId()))
            .stream().filter(e -> !"Pull-Up".equals(e.getName())).toList();
        assertThat(appended).isNotEmpty();
        assertThat(appended).allSatisfy(e -> assertThat(e.isCountsTowardVolume()).isFalse());
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }
}
