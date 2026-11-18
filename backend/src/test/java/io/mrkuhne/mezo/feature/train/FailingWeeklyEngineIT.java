package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.service.WeekProposalService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** The morning workout never depends on the weekly engine: a failure there is logged, not thrown. */
class FailingWeeklyEngineIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @MockitoSpyBean WeekProposalService weekProposalService;

    @Test
    void aFailingWeeklyEngineDoesNotBlockToday() {
        UUID owner = databasePopulator.populateUser("failing-engine@test.local");
        MesocycleEntity meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(),
            WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1));
        ExerciseEntity legPress = train.createExercise(owner, day.getId(), "Leg Press", "quad", "compound");
        legPress.setWorkingSets(3);
        train.save(legPress);
        doThrow(new IllegalStateException("boom")).when(weekProposalService).generateIfDue(any(), any());

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(res.getExercises()).filteredOn(e -> legPress.getId().equals(e.getId()))
            .singleElement().satisfies(e -> assertThat(e.getWorkingSets()).isEqualTo(3));
    }
}
