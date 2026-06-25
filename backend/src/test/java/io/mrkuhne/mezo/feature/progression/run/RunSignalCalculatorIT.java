package io.mrkuhne.mezo.feature.progression.run;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RunSignalCalculatorIT extends AbstractIntegrationTest {

    @Autowired private RunSignalCalculator calculator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private RunSessionLogRepository logRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCompute_shouldResolveSprintKindAndFields_whenLoggedAgainstASprintSession() {
        UUID user = databasePopulator.populateUser("run@test.local");
        // RunningPopulator builds a block whose structure has a session keyed "w1-sprint" of kind "sprint".
        RunningBlockEntity block = runningPopulator.createSprintBlock(user);
        RunSessionLogEntity log = runningPopulator.createRunLog(
            user, block.getId(), 1, "w1-sprint", LocalDate.parse("2026-06-22"),
            6, 8, 75, "200m", 32); // completedRounds=6, rpe=8, hrRecovery=75, landmark=200m, durationMin=32

        RunSignal signal = calculator.compute(user, log.getId());

        assertThat(signal.logId()).isEqualTo(log.getId());
        assertThat(signal.kind()).isEqualTo("sprint");
        assertThat(signal.completedRounds()).isEqualTo(6);
        assertThat(signal.rpeActual()).isEqualTo(8);
        assertThat(signal.durationMin()).isEqualTo(32);
        assertThat(signal.sprintLandmark()).isEqualTo("200m");
    }

    @Test
    void testCompute_shouldDefaultToSteady_whenPrescribedSessionKindMissing() {
        UUID user = databasePopulator.populateUser("steady@test.local");
        RunningBlockEntity block = runningPopulator.createSprintBlock(user);
        RunSessionLogEntity log = runningPopulator.createRunLog(
            user, block.getId(), 1, "no-such-key", LocalDate.parse("2026-06-22"),
            null, 5, null, null, 45);

        RunSignal signal = calculator.compute(user, log.getId());

        assertThat(signal.kind()).isEqualTo("steady"); // unknown sessionKey → default steady
        assertThat(signal.durationMin()).isEqualTo(45);
    }
}
