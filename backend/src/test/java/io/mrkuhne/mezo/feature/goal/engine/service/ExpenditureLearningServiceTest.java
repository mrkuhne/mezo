package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.port.DailyIntakePort;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.techcore.query.WeightTrendQuery;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** The global switch (mezo-zz91i): disabled → not a learning user, nothing read or written. */
@ExtendWith(MockitoExtension.class)
class ExpenditureLearningServiceTest {

    @Mock private GoalEngineProperties props;
    @Mock private GoalEngineProperties.Expenditure expenditure;
    @Mock private GoalRepository goalRepository;
    @Mock private WeightTrendQuery weightQuery;
    @Mock private DailyIntakePort dailyIntake;
    @Mock private WorkoutWindowQueryService workoutWindows;
    @Mock private ExpenditureEstimateRepository estimates;
    @Mock private GoalEngineService goalEngineService;
    @Mock private GoalSuggestionService suggestionService;
    @InjectMocks private ExpenditureLearningService service;

    @Test
    void disabledMeansNotEligibleAndNoRow() {
        when(props.expenditure()).thenReturn(expenditure);
        when(expenditure.enabled()).thenReturn(false);

        assertThat(service.reviewWeek(UUID.randomUUID(), LocalDate.of(2026, 9, 14))).isEmpty();

        verifyNoInteractions(goalRepository, estimates, dailyIntake, weightQuery, workoutWindows,
            goalEngineService, suggestionService);
    }
}
