package io.mrkuhne.mezo.feature.goal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.goal.engine.port.DailyIntakePort;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureLearningService;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.IntakeDayMarkRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * mezo-3n2so final review: two concurrent marks on the same day both miss the existing row and
 * both INSERT — the loser hits the (created_by, day) unique index. That is a conflict, not a 500.
 */
class IntakeDayMarkServiceTest {

    private final IntakeDayMarkRepository marks = mock(IntakeDayMarkRepository.class);
    private final DailyIntakePort dailyIntake = mock(DailyIntakePort.class);
    private final ExpenditureLearningService learning = mock(ExpenditureLearningService.class);
    private final IntakeDayMarkService service = new IntakeDayMarkService(
        marks, mock(ExpenditureEstimateRepository.class), dailyIntake, learning);

    @Test
    void concurrentMarkOnTheSameDayIsAConflict() {
        UUID user = UUID.randomUUID();
        LocalDate day = LocalDate.now().minusDays(3);
        when(dailyIntake.between(user, day, day)).thenReturn(List.of(new DailyIntakePort.DayIntake(day, 2000, 200)));
        when(marks.findByCreatedByAndDayAndDeletedFalse(user, day)).thenReturn(Optional.empty());
        when(marks.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uq_intake_day_mark"));

        assertThatThrownBy(() -> service.mark(user, day, "COMPLETE"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verifyNoInteractions(learning);
    }
}
