package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepGoalService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link SleepGoalService#shiftAnchor} (S5, bd mezo-d58h.5) — the guarded mutation behind the
 * {@code shift_sleep_anchor} advice action. Kept beside {@link SleepGoalApiIT}/{@code
 * SleepGoalSwitchOffApiIT} (same package, same fixtures) rather than in a parallel class, since
 * this exercises the same service and entity those already cover.
 */
@Transactional
class SleepGoalShiftIT extends AbstractIntegrationTest {

    @Autowired private SleepGoalService service;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private SleepGoalRepository sleepGoalRepository;

    @Test
    void testShiftAnchor_shouldMoveEarlier_whenMinutesNegative() {
        UUID userId = databasePopulator.populateUser("shift-earlier@test.local");
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15);

        SleepGoalResponse shifted = service.shiftAnchor(userId, -30);

        assertThat(shifted.getAnchorTime()).isEqualTo("06:15");
    }

    @Test
    void testShiftAnchor_shouldMoveLater_whenMinutesPositive() {
        UUID userId = databasePopulator.populateUser("shift-later@test.local");
        sleepGoalPopulator.goal(userId, 480, "WAKE", "06:45", 15);

        SleepGoalResponse shifted = service.shiftAnchor(userId, 30);

        assertThat(shifted.getAnchorTime()).isEqualTo("07:15");
    }

    @Test
    void testShiftAnchor_shouldWrapAcrossMidnight_whenShiftedEarlierThanZero() {
        UUID userId = databasePopulator.populateUser("shift-midnight@test.local");
        sleepGoalPopulator.goal(userId, 480, "BED", "00:15", 15);

        SleepGoalResponse shifted = service.shiftAnchor(userId, -30);

        assertThat(shifted.getAnchorTime()).isEqualTo("23:45");
    }

    /** The sharpest test in the task: {@link SleepGoalService#setGoal} upserts, so calling THAT
     *  for a user with no row would silently invent a goal. {@code shiftAnchor} must refuse
     *  instead — asserted both by the thrown status AND by the repository staying empty, so a
     *  regression that swaps this back to an upsert-based implementation fails here even if it
     *  happens to also throw for some unrelated reason. */
    @Test
    void testShiftAnchor_shouldRefuseAndCreateNoRow_whenNoGoalExists() {
        UUID userId = databasePopulator.populateUser("shift-no-goal@test.local");

        assertThatThrownBy(() -> service.shiftAnchor(userId, -30))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.CONFLICT));

        assertThat(sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)).isEmpty();
    }
}
