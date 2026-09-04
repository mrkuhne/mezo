package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link SleepAnchorShiftAdapter} (S5, bd mezo-d58h.5) — the adapter, not {@link
 * io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepGoalService}, owns the contract on the
 * {@code minutes} VALUE, since {@code params} is a loose {@code Map<String, Object>} a client can
 * populate with anything the apply endpoint accepts (Task 6).
 */
@Transactional
class SleepAnchorShiftAdapterIT extends AbstractIntegrationTest {

    @Autowired private SleepAnchorShiftAdapter adapter;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private SleepGoalRepository sleepGoalRepository;

    @Test
    void testActionKey_shouldBeShiftSleepAnchor() {
        assertThat(adapter.actionKey()).isEqualTo(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
    }

    @Test
    void testApply_shouldReject_whenMinutesOutOfRange() {
        UUID userId = databasePopulator.populateUser("adapter-out-of-range@test.local");
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15);

        assertThatThrownBy(() -> adapter.apply(userId, Map.of("minutes", 121)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenMinutesBelowNegativeRange() {
        UUID userId = databasePopulator.populateUser("adapter-below-range@test.local");
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15);

        assertThatThrownBy(() -> adapter.apply(userId, Map.of("minutes", -121)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenMinutesMissing() {
        UUID userId = databasePopulator.populateUser("adapter-missing@test.local");
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15);

        assertThatThrownBy(() -> adapter.apply(userId, Map.of()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldReject_whenMinutesNonNumeric() {
        UUID userId = databasePopulator.populateUser("adapter-non-numeric@test.local");
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15);

        assertThatThrownBy(() -> adapter.apply(userId, Map.of("minutes", "thirty")))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void testApply_shouldShiftTheGoal_whenMinutesInRange() {
        UUID userId = databasePopulator.populateUser("adapter-in-range@test.local");
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15);

        adapter.apply(userId, Map.of("minutes", -30));

        assertThat(sleepGoalRepository.findByCreatedByAndDeletedFalse(userId).orElseThrow().getAnchorTime())
            .isEqualTo("06:15");
    }
}
