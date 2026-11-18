package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.VolumeLedger;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/** Switch off: the gate bean is absent, so the ledger writes no rows. Separate class because a
 *  conditional bean's presence is fixed per Spring context. */
@TestPropertySource(properties = "mezo.feature.volume-progression.enabled=false")
class VolumeLedgerSwitchOffIT extends AbstractIntegrationTest {

    @Autowired VolumeLedger ledger;
    @Autowired TrainPopulator train;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired DatabasePopulator databasePopulator;

    @Test
    void gateOffHasNoRows() {
        UUID user = databasePopulator.populateUser("ledger-off@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        WorkoutSessionEntity day = train.createTemplateDay(user, meso.getId(), "Hét");
        train.createExercise(user, day.getId(), "Bench", "chest-mid", "compound");

        ledger.sync(user, meso.getId());

        assertThat(volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(user, List.of(meso.getId())))
            .isEmpty();
    }
}
