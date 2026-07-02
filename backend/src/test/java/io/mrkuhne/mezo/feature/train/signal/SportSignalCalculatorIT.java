package io.mrkuhne.mezo.feature.train.signal;

import io.mrkuhne.mezo.feature.progression.sport.SportSignal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class SportSignalCalculatorIT extends AbstractIntegrationTest {

    @Autowired private SportSignalCalculator calculator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCompute_shouldResolveCrossMetricsAndRoundRpe_whenCrossSession() {
        UUID user = databasePopulator.populateUser("sigcross@test.local");
        SportSessionEntity s = trainPopulator.createSportSession(user, LocalDate.parse("2026-06-20"),
            "cross", null, 8, "7.6");

        SportSignal signal = calculator.compute(user, s.getId());

        assertThat(signal.kind()).isEqualTo("cross");
        assertThat(signal.rounds()).isEqualTo(8);
        assertThat(signal.setsPlayed()).isNull();
        assertThat(signal.rpe()).isEqualTo(8); // 7.6 rounds HALF_UP to 8
        assertThat(signal.durationMin()).isEqualTo(60);
        assertThat(signal.sessionId()).isEqualTo(s.getId());
    }

    @Test
    void testCompute_shouldScopeByOwner_whenSessionBelongsToAnotherUser() {
        UUID owner = databasePopulator.populateUser("sigown@test.local");
        UUID other = databasePopulator.populateUser("sigother@test.local");
        SportSessionEntity s = trainPopulator.createSportSession(owner, LocalDate.parse("2026-06-20"),
            "volleyball", 5, null, "7");

        assertThatThrownBy(() -> calculator.compute(other, s.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
