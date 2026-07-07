package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.feature.proactive.service.PredictionValidationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic window-close validation over a FIXED past week so "today" is always after the
 * window (a closed window), and the weight logs sit in known windows.
 */
@Transactional
class PredictionValidationIT extends AbstractIntegrationTest {

    // week Mon 2026-06-22 .. Sun 2026-06-28; baseline = 2026-06-15 .. 2026-06-21
    private static final LocalDate WEEK = LocalDate.of(2026, 6, 22);
    private static final LocalDate AFTER = LocalDate.of(2026, 7, 1);   // window already closed

    @Autowired
    private PredictionValidationService service;

    @Autowired
    private PredictionRepository repository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private PredictionPopulator predictionPopulator;

    @Autowired
    private WeightLogPopulator weightLogPopulator;

    @Test
    void testValidate_shouldMarkValidated_whenWeightDroppedAsPredicted() {
        UUID user = userPopulator.createUser("pv-ok@test.local").getId();
        predictionPopulator.prediction(user, WEEK, PredictionEntity.METRIC_WEIGHT_TREND,
                PredictionEntity.DIRECTION_DOWN, PredictionEntity.STATUS_PENDING);
        // baseline ~79.0, window ~78.0 → down by ~1.0 kg (> epsilon 0.1)
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 16), new BigDecimal("79.0"));
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 24), new BigDecimal("78.0"));

        int closed = service.validateClosedWindows(user, AFTER);

        assertThat(closed).isEqualTo(1);
        assertThat(repository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(user).getFirst())
                .satisfies(p -> {
                    assertThat(p.getStatus()).isEqualTo(PredictionEntity.STATUS_VALIDATED);
                    assertThat(p.getActual()).contains("kg");
                });
    }

    @Test
    void testValidate_shouldMarkMissed_whenDirectionWrong() {
        UUID user = userPopulator.createUser("pv-miss@test.local").getId();
        predictionPopulator.prediction(user, WEEK, PredictionEntity.METRIC_WEIGHT_TREND,
                PredictionEntity.DIRECTION_UP, PredictionEntity.STATUS_PENDING);
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 16), new BigDecimal("79.0"));
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 24), new BigDecimal("78.0"));

        service.validateClosedWindows(user, AFTER);

        assertThat(repository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(user).getFirst().getStatus())
                .isEqualTo(PredictionEntity.STATUS_MISSED);
    }

    @Test
    void testValidate_shouldStayPending_whenNoWindowData() {
        UUID user = userPopulator.createUser("pv-nodata@test.local").getId();
        predictionPopulator.prediction(user, WEEK, PredictionEntity.METRIC_WEIGHT_TREND,
                PredictionEntity.DIRECTION_DOWN, PredictionEntity.STATUS_PENDING);

        int closed = service.validateClosedWindows(user, AFTER);

        assertThat(closed).isZero();
        assertThat(repository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(user).getFirst().getStatus())
                .isEqualTo(PredictionEntity.STATUS_PENDING);
    }

    @Test
    void testValidate_shouldSkipOpenWindow_whenValidToNotBeforeToday() {
        UUID user = userPopulator.createUser("pv-open@test.local").getId();
        predictionPopulator.prediction(user, WEEK, PredictionEntity.METRIC_WEIGHT_TREND,
                PredictionEntity.DIRECTION_DOWN, PredictionEntity.STATUS_PENDING);
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 16), new BigDecimal("79.0"));
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 24), new BigDecimal("78.0"));

        // "today" == the window's last day → valid_to (06-28) is NOT before today → untouched
        int closed = service.validateClosedWindows(user, LocalDate.of(2026, 6, 28));

        assertThat(closed).isZero();
        assertThat(repository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(user).getFirst().getStatus())
                .isEqualTo(PredictionEntity.STATUS_PENDING);
    }
}
