package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** A failing stall read is audit-only: it must not abort the week's proposal (mezo-r36n9.79). */
class WeekProposalStallFailureIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @MockitoSpyBean ExerciseSetRepository setRepository;

    @Test
    void aFailingStallReadStillYieldsAnAppliedProposal() {
        UUID owner = databasePopulator.populateUser("stall-fail@test.local");
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 3, 6,
            List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        meso.setMusclePriorities(Map.of("back", "emphasize"));
        meso.setTrainingStyle("balanced");
        mesocycleRepository.saveAndFlush(meso);
        var day = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "gym", 0, "active");
        ExerciseEntity row = train.createExercise(owner, day.getId(), "Evezés", "back-mid", "compound");
        row.setWorkingSets(3);
        train.save(row);
        var inst = train.createWorkoutInstance(owner, day, meso.getStartDate().plusDays(8), "completed");
        train.createLoggedSet(owner, row.getId(), inst.getId(), 0, "60", 8, 1);
        // a real exception from inside the read (not a stub on the proxy), as a data fault would be
        doThrow(new IllegalStateException("boom")).when(setRepository).findWorkingSetsInSessions(any(), any());

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = proposalRepository.findWeekly(owner, meso.getId(), 4).orElseThrow();
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
    }
}
