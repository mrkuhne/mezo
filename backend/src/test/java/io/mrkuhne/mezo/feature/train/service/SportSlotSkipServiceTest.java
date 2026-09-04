package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.SportSlotSkipResponse;
import io.mrkuhne.mezo.feature.train.entity.SportSlotSkipEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSlotSkipRepository;
import io.mrkuhne.mezo.feature.train.service.SportSlotSkipService.SkipKey;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Pure Mockito unit test for {@link SportSlotSkipService} — the ONE predicate every read path
 * (Tasks 9-12) will call. Pins the three axes that make the identity key correct: a different
 * date, a different clock time, and a different user must each fail to match (mezo-d58h.5).
 */
class SportSlotSkipServiceTest {

    private final SportSlotSkipRepository repository = mock(SportSlotSkipRepository.class);
    private final SportSlotSkipService service = new SportSlotSkipService(repository);

    private static final UUID USER = UUID.randomUUID();
    private static final LocalDate DATE = LocalDate.parse("2026-09-11"); // Friday

    private static SportSlotSkipEntity skip(UUID user, int dayOfWeek, String time, LocalDate date) {
        SportSlotSkipEntity e = new SportSlotSkipEntity();
        e.setCreatedBy(user);
        e.setDayOfWeek(dayOfWeek);
        e.setTime(time);
        e.setDate(date);
        return e;
    }

    @Test
    void testIsSkipped_shouldReturnTrue_whenRepositoryHasAMatchingRow() {
        when(repository.existsByCreatedByAndDayOfWeekAndTimeAndDateAndDeletedFalse(USER, 4, "18:00", DATE))
            .thenReturn(true);

        assertThat(service.isSkipped(USER, 4, "18:00", DATE)).isTrue();
    }

    @Test
    void testIsSkipped_shouldReturnFalse_whenDateDiffers() {
        when(repository.existsByCreatedByAndDayOfWeekAndTimeAndDateAndDeletedFalse(
            any(), anyInt(), anyString(), any())).thenReturn(false);

        assertThat(service.isSkipped(USER, 4, "18:00", DATE.plusDays(7))).isFalse();
    }

    @Test
    void testIsSkipped_shouldReturnFalse_whenTimeDiffers() {
        when(repository.existsByCreatedByAndDayOfWeekAndTimeAndDateAndDeletedFalse(USER, 4, "18:00", DATE))
            .thenReturn(true);

        // A different clock time on the same weekday/date is a different slot identity entirely.
        assertThat(service.isSkipped(USER, 4, "19:30", DATE)).isFalse();
    }

    @Test
    void testIsSkipped_shouldReturnFalse_whenUserDiffers() {
        when(repository.existsByCreatedByAndDayOfWeekAndTimeAndDateAndDeletedFalse(USER, 4, "18:00", DATE))
            .thenReturn(true);

        assertThat(service.isSkipped(UUID.randomUUID(), 4, "18:00", DATE)).isFalse();
    }

    @Test
    void testSkipsBetween_shouldReturnKeysForEveryRowInRange() {
        LocalDate from = DATE;
        LocalDate to = DATE.plusDays(7);
        when(repository.findByCreatedByAndDateBetweenAndDeletedFalse(USER, from, to))
            .thenReturn(List.of(
                skip(USER, 4, "18:00", DATE),
                skip(USER, 1, "07:00", DATE.plusDays(3))));

        Set<SkipKey> result = service.skipsBetween(USER, from, to);

        assertThat(result).containsExactlyInAnyOrder(
            new SkipKey(4, "18:00", DATE),
            new SkipKey(1, "07:00", DATE.plusDays(3)));
    }

    @Test
    void testSkipsBetween_shouldReturnEmptySet_whenNoSkipsInRange() {
        when(repository.findByCreatedByAndDateBetweenAndDeletedFalse(any(), any(), any()))
            .thenReturn(List.of());

        assertThat(service.skipsBetween(USER, DATE, DATE.plusDays(7))).isEmpty();
    }

    @Test
    void testSkip_shouldInsertRow_whenNotAlreadySkipped() {
        when(repository.existsByCreatedByAndDayOfWeekAndTimeAndDateAndDeletedFalse(USER, 4, "18:00", DATE))
            .thenReturn(false);

        service.skip(USER, 4, "18:00", DATE);

        verify(repository, times(1)).saveAndFlush(any(SportSlotSkipEntity.class));
    }

    @Test
    void testSkip_shouldNoOp_whenAlreadySkipped() {
        when(repository.existsByCreatedByAndDayOfWeekAndTimeAndDateAndDeletedFalse(USER, 4, "18:00", DATE))
            .thenReturn(true);

        service.skip(USER, 4, "18:00", DATE);

        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void testListResponses_shouldMapEveryRowDateThenTimeAscending() {
        when(repository.findByCreatedByAndDateBetweenAndDeletedFalse(USER, DATE, DATE.plusDays(7)))
            .thenReturn(List.of(
                skip(USER, 1, "20:00", DATE.plusDays(3)),
                skip(USER, 4, "18:00", DATE)));

        List<SportSlotSkipResponse> result = service.listResponses(USER, DATE, DATE.plusDays(7));

        assertThat(result).extracting(SportSlotSkipResponse::getDayOfWeek, SportSlotSkipResponse::getTime,
            SportSlotSkipResponse::getDate)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(4, "18:00", DATE),
                org.assertj.core.groups.Tuple.tuple(1, "20:00", DATE.plusDays(3)));
    }

    @Test
    void testListResponses_shouldReturnEmptyList_whenNoSkipsInRange() {
        when(repository.findByCreatedByAndDateBetweenAndDeletedFalse(any(), any(), any()))
            .thenReturn(List.of());

        assertThat(service.listResponses(USER, DATE, DATE.plusDays(7))).isEmpty();
    }

    @Test
    void testListResponses_shouldReject_whenFromIsAfterTo() {
        assertThatThrownBy(() -> service.listResponses(USER, DATE, DATE.minusDays(1)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getMessages())
                .extracting(m -> m.getCode())
                .containsExactly("TRAIN_INVALID_DATE_RANGE"));
    }
}
