package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/** Switch off: the gate bean is absent, so the weekly proposal is never generated — not even when
 *  the service is called directly. Separate class because a conditional bean's presence is fixed
 *  per Spring context. */
@TestPropertySource(properties = "mezo.feature.volume-progression.enabled=false")
class WeekProposalAutoSwitchOffIT extends AbstractIntegrationTest {

    @Autowired WeekProposalService proposals;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;

    @Test
    void gateOffNeverGenerates() {
        UUID owner = databasePopulator.populateUser("week-proposal-off@test.local");
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(
            owner, 1, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        meso.setMusclePriorities(Map.of("back", "emphasize"));
        meso = mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "gym", 0, "active");
        ExerciseEntity row = train.createExercise(owner, mon.getId(), "Evezés", "back-mid", "compound");
        row.setWorkingSets(2);
        train.save(row);
        WorkoutSessionEntity done = train.createWorkoutInstance(owner, mon, meso.getStartDate(), "completed");
        train.createLoggedSet(owner, row.getId(), done.getId(), 0, "60", 8, 0);
        train.createLoggedSet(owner, row.getId(), done.getId(), 1, "60", 8, 0);

        proposals.generateIfDue(owner, meso);

        assertThat(proposalRepository.findAll()).isEmpty();
        assertThat(exerciseRepository.findById(row.getId()).orElseThrow().getWorkingSets()).isEqualTo(2);
        assertThat(mesocycleRepository.findById(meso.getId()).orElseThrow().getVolumeRecompute()).isNull();
    }
}
