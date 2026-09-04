package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.train.repository.SportSlotSkipRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link SportSlotSkipAdapter} (S5, bd mezo-d58h.5) — the write side of the skip predicate {@code
 * SportSlotSkipService} already exposes to every read path. As with {@link
 * SleepAnchorShiftAdapter}, the loose {@code Map<String, Object>} params are this adapter's own
 * validation contract, not the service's.
 */
@Transactional
class SportSlotSkipAdapterIT extends AbstractIntegrationTest {

    @Autowired private SportSlotSkipAdapter adapter;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SportSlotSkipRepository repository;

    private static final LocalDate TOMORROW = LocalDate.now().plusDays(1);

    private static Map<String, Object> params(Object dayOfWeek, Object time, Object date) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("dayOfWeek", dayOfWeek);
        m.put("time", time);
        m.put("date", date);
        return m;
    }

    @Test
    void testActionKey_shouldBeSkipSportSlot() {
        assertThat(adapter.actionKey()).isEqualTo(AdviceActionKey.SKIP_SPORT_SLOT);
    }

    @Test
    void testApply_shouldInsertSkip_whenParamsValid() {
        UUID userId = databasePopulator.populateUser("adapter-valid@test.local");

        adapter.apply(userId, params(4, "18:00", TOMORROW.toString()));

        assertThat(repository.findByCreatedByAndDateBetweenAndDeletedFalse(userId, TOMORROW, TOMORROW))
            .hasSize(1)
            .first()
            .satisfies(e -> {
                assertThat(e.getDayOfWeek()).isEqualTo(4);
                assertThat(e.getTime()).isEqualTo("18:00");
                assertThat(e.getDate()).isEqualTo(TOMORROW);
            });
    }

    @Test
    void testApply_shouldNotDuplicateRow_whenAppliedTwice() {
        UUID userId = databasePopulator.populateUser("adapter-idempotent@test.local");

        adapter.apply(userId, params(4, "18:00", TOMORROW.toString()));
        adapter.apply(userId, params(4, "18:00", TOMORROW.toString()));

        assertThat(repository.findByCreatedByAndDateBetweenAndDeletedFalse(userId, TOMORROW, TOMORROW))
            .hasSize(1); // row COUNT, not just "no exception"
    }

    @Test
    void testApply_shouldReject_whenDayOfWeekMissing() {
        UUID userId = databasePopulator.populateUser("adapter-missing-day@test.local");

        assertThatThrownBy(() -> adapter.apply(userId, params(null, "18:00", TOMORROW.toString())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenDayOfWeekOutOfRange() {
        UUID userId = databasePopulator.populateUser("adapter-day-oor@test.local");

        assertThatThrownBy(() -> adapter.apply(userId, params(7, "18:00", TOMORROW.toString())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenDayOfWeekNegative() {
        UUID userId = databasePopulator.populateUser("adapter-day-negative@test.local");

        assertThatThrownBy(() -> adapter.apply(userId, params(-1, "18:00", TOMORROW.toString())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenTimeMissing() {
        UUID userId = databasePopulator.populateUser("adapter-missing-time@test.local");

        assertThatThrownBy(() -> adapter.apply(userId, params(4, null, TOMORROW.toString())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenTimeMalformed() {
        UUID userId = databasePopulator.populateUser("adapter-time-malformed@test.local");

        assertThatThrownBy(() -> adapter.apply(userId, params(4, "9:00", TOMORROW.toString())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenTimeHourOutOfRange() {
        UUID userId = databasePopulator.populateUser("adapter-time-hour-oor@test.local");

        assertThatThrownBy(() -> adapter.apply(userId, params(4, "24:00", TOMORROW.toString())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenDateMissing() {
        UUID userId = databasePopulator.populateUser("adapter-missing-date@test.local");

        assertThatThrownBy(() -> adapter.apply(userId, params(4, "18:00", null)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenDateMalformed() {
        UUID userId = databasePopulator.populateUser("adapter-date-malformed@test.local");

        assertThatThrownBy(() -> adapter.apply(userId, params(4, "18:00", "2026/09/11")))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenDateInThePast() {
        UUID userId = databasePopulator.populateUser("adapter-date-past@test.local");

        assertThatThrownBy(() -> adapter.apply(userId, params(4, "18:00", LocalDate.now().minusDays(1).toString())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldAccept_whenDateIsToday() {
        UUID userId = databasePopulator.populateUser("adapter-date-today@test.local");
        LocalDate today = LocalDate.now();

        adapter.apply(userId, params(4, "18:00", today.toString()));

        assertThat(repository.findByCreatedByAndDateBetweenAndDeletedFalse(userId, today, today)).hasSize(1);
    }
}
