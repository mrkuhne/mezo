package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * The switch-off twin of {@link WeekProposalLoadLinesIT} (the gate bean's presence is fixed per Spring
 * context): with the Hypertrophy Drive off nothing is prescribed, so the weekly proposal carries no
 * weight / rep lines — only its set lines.
 */
@TestPropertySource(properties = "mezo.feature.hypertrophy-drive.enabled=false")
class WeekProposalLoadLinesSwitchOffIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesoWeekProposalRepository proposalRepository;

    @Test
    void driveOffHasNoLoadLines() {
        UUID owner = databasePopulator.populateUser("week-proposal-load-off@test.local");
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 1, 6,
            List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        String label = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity day = train.createWorkoutSession(owner, meso.getId(), label, "gym", 0, "active");
        ExerciseEntity row = train.createExercise(owner, day.getId(), "Evezés", "back-mid", "compound");
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, meso.getStartDate(), "completed");
        for (int s = 0; s < row.getWorkingSets(); s++) {
            train.createLoggedSet(owner, row.getId(), instance.getId(), s, "60", 8, 2); // a weight move, were it on
        }

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = proposalRepository.findWeekly(owner, meso.getId(), 2).orElseThrow();
        assertThat(p.getLines()).allSatisfy(l -> assertThat(l.kind()).isEqualTo("sets"));
    }
}
