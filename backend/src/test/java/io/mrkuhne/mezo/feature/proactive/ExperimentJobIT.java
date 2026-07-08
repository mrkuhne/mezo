package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.feature.proactive.service.ExperimentJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class ExperimentJobIT extends AbstractIntegrationTest {

    @Autowired
    private ExperimentJob job;

    @Autowired
    private ExperimentRepository repository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private PatternPopulator patternPopulator;

    @Autowired
    private ExperimentPopulator experimentPopulator;

    @Autowired
    private SleepLogPopulator sleepLogPopulator;

    @Test
    void testRunPropose_shouldCreateProposal_whenUserHasConfirmedPattern() {
        UUID user = userPopulator.createUser("ej-prop@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        job.runPropose();
        assertThat(repository.findByCreatedByAndStatusOrderByGeneratedAtDesc(user, ExperimentEntity.STATUS_PROPOSED))
                .isNotEmpty();
    }

    @Test
    void testRunOutcome_shouldCompleteDueExperiment_whenWindowClosed() {
        UUID user = userPopulator.createUser("ej-out@test.local").getId();
        LocalDate start = LocalDate.now().minusDays(30);
        experimentPopulator.active(user, PredictionEntity.METRIC_SLEEP_AVG,
                PredictionEntity.DIRECTION_UP, start, 7);
        sleepLogPopulator.createSleepLog(user, start.minusDays(3), new BigDecimal("7.0"), 3);
        sleepLogPopulator.createSleepLog(user, start.plusDays(2), new BigDecimal("7.8"), 4);

        job.runOutcome();

        assertThat(repository.findByCreatedByAndStatusInOrderByGeneratedAtDesc(user,
                List.of(ExperimentEntity.STATUS_COMPLETED)))
                .hasSize(1)
                .allSatisfy(e -> assertThat(e.getOutcomeGood()).isTrue());
    }
}
