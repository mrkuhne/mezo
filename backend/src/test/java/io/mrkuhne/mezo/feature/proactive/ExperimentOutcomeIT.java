package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.feature.proactive.service.ExperimentOutcomeService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic outcome evaluation over a FIXED past window so "today" is always after the
 * experiment's end. The active window is [start, start+total-1]; the baseline is the equal-length
 * span before start.
 */
@Transactional
class ExperimentOutcomeIT extends AbstractIntegrationTest {

    // experiment ran 2026-06-15 .. 2026-06-21 (7 days); baseline 2026-06-08 .. 2026-06-14
    private static final LocalDate START = LocalDate.of(2026, 6, 15);
    private static final LocalDate AFTER = LocalDate.of(2026, 6, 25);   // window closed

    @Autowired
    private ExperimentOutcomeService service;

    @Autowired
    private ExperimentRepository repository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private ExperimentPopulator experimentPopulator;

    @Autowired
    private SleepLogPopulator sleepLogPopulator;

    private ExperimentEntity own(UUID user) {
        return repository.findByCreatedByAndStatusInOrderByGeneratedAtDesc(user,
                List.of(ExperimentEntity.STATUS_ACTIVE, ExperimentEntity.STATUS_COMPLETED)).getFirst();
    }

    @Test
    void testEvaluate_shouldCompleteGood_whenSleepRoseAsExpected() {
        UUID user = userPopulator.createUser("eo-good@test.local").getId();
        experimentPopulator.active(user, PredictionEntity.METRIC_SLEEP_AVG,
                PredictionEntity.DIRECTION_UP, START, 7);
        sleepLogPopulator.createSleepLog(user, LocalDate.of(2026, 6, 10), new BigDecimal("7.0"), 3);
        sleepLogPopulator.createSleepLog(user, LocalDate.of(2026, 6, 17), new BigDecimal("7.8"), 4);

        int closed = service.evaluateClosed(user, AFTER);

        assertThat(closed).isEqualTo(1);
        ExperimentEntity e = own(user);
        assertThat(e.getStatus()).isEqualTo(ExperimentEntity.STATUS_COMPLETED);
        assertThat(e.getOutcomeGood()).isTrue();
        assertThat(e.getOutcome()).startsWith("Beigazolódott");
    }

    @Test
    void testEvaluate_shouldCompleteNotGood_whenDirectionWrong() {
        UUID user = userPopulator.createUser("eo-bad@test.local").getId();
        experimentPopulator.active(user, PredictionEntity.METRIC_SLEEP_AVG,
                PredictionEntity.DIRECTION_DOWN, START, 7);
        sleepLogPopulator.createSleepLog(user, LocalDate.of(2026, 6, 10), new BigDecimal("7.0"), 3);
        sleepLogPopulator.createSleepLog(user, LocalDate.of(2026, 6, 17), new BigDecimal("7.8"), 4);

        service.evaluateClosed(user, AFTER);

        ExperimentEntity e = own(user);
        assertThat(e.getStatus()).isEqualTo(ExperimentEntity.STATUS_COMPLETED);
        assertThat(e.getOutcomeGood()).isFalse();
        assertThat(e.getOutcome()).startsWith("Nem igazolódott");
    }

    @Test
    void testEvaluate_shouldCompleteInconclusive_whenNoData() {
        UUID user = userPopulator.createUser("eo-nodata@test.local").getId();
        experimentPopulator.active(user, PredictionEntity.METRIC_SLEEP_AVG,
                PredictionEntity.DIRECTION_UP, START, 7);

        service.evaluateClosed(user, AFTER);

        ExperimentEntity e = own(user);
        assertThat(e.getStatus()).isEqualTo(ExperimentEntity.STATUS_COMPLETED);
        assertThat(e.getOutcomeGood()).isNull();   // honest inconclusive
        assertThat(e.getOutcome()).contains("Nem értékelhető");
    }

    @Test
    void testEvaluate_shouldSkipOpenWindow_whenNotClosedYet() {
        UUID user = userPopulator.createUser("eo-open@test.local").getId();
        experimentPopulator.active(user, PredictionEntity.METRIC_SLEEP_AVG,
                PredictionEntity.DIRECTION_UP, START, 7);

        // "today" == the window's last day (06-21) → not yet closed → untouched
        int closed = service.evaluateClosed(user, LocalDate.of(2026, 6, 21));

        assertThat(closed).isZero();
        assertThat(own(user).getStatus()).isEqualTo(ExperimentEntity.STATUS_ACTIVE);
    }
}
