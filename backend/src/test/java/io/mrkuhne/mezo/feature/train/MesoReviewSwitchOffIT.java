package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleReportResponse;
import io.mrkuhne.mezo.feature.companion.service.MesoReviewGenerator;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleReportEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleReportRepository;
import io.mrkuhne.mezo.feature.train.service.MesocycleReportService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Meso-review switch OFF (mezo-meyc.3): with {@code mezo.feature.meso-review.enabled=false} the
 * {@code MesoReviewGate} bean is absent, so {@code getReport} must report {@code aiEvalEnabled}
 * false regardless of the deterministic report's state, and the companion generator must stop after
 * the context write instead of calling a model. Separate class because a
 * {@code @ConditionalOnProperty} bean's presence is fixed per Spring context (mirrors
 * {@code ClosingBlockSwitchOffIT}).
 *
 * <p>The COMPANION switch stays ON here — that is the whole point: the generator bean exists (it is
 * gated on the companion switch, not on this one) and is exercised, only its narrative half is
 * expected to be skipped. Since no model is supposed to be reached, this class deliberately does
 * NOT activate the {@code companion-fake} profile: a generator that ignored the missing gate would
 * hit the real Gemini adapter, fail, and persist {@code failed} — which the {@code pending}
 * assertion below catches.
 */
@TestPropertySource(properties = "mezo.feature.meso-review.enabled=false")
class MesoReviewSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private TrainService trainService;
    @Autowired private MesocycleReportService reportService;
    @Autowired private MesoReviewGenerator generator;
    @Autowired private MesocycleReportRepository reportRepository;
    @Autowired private TrainPopulator train;
    @Autowired private SleepLogPopulator sleepLogs;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testGetReport_shouldReportAiEvalDisabled_whenSwitchOff() {
        UUID owner = databasePopulator.populateUser("meso-review-off-a@test.local");
        MesocycleEntity run = train.activeMesoStartedWeeksAgo(owner, 1, 2, 1, List.of("MEV", "MAV"));

        trainService.closeMesocycle(owner, run.getId(), null);

        MesocycleReportResponse report = reportService.getReport(owner, run.getId());
        assertThat(report.getAiEvalEnabled()).isFalse();
    }

    /**
     * The context half is unconditional: the FE's lifestyle block must still be populated with the
     * switch off, and the row simply stays {@code pending} forever (harmless — the FE hides the AI
     * section on {@code aiEvalEnabled=false} instead of polling it).
     *
     * <p>Drives {@code computeAndStore} rather than {@code closeMesocycle}: it is the one
     * report-writing entry point that publishes NO {@code MesocycleClosed}, so the explicit
     * {@code generate()} under test cannot race the async listener doing the same work.
     */
    @Test
    void testGenerate_shouldStoreContextAndLeavePending_whenSwitchOff() {
        UUID owner = databasePopulator.populateUser("meso-review-off-b@test.local");
        MesocycleEntity run = train.activeMesoStartedWeeksAgo(owner, 1, 2, 2, List.of("MEV", "MAV"));
        sleepLogs.createSleepLog(owner, run.getStartDate().plusDays(1), new BigDecimal("7.5"), 4);
        reportService.computeAndStore(run);

        generator.generate(owner, run.getId());

        MesocycleReportEntity row = reportRepository
            .findByMesocycleIdAndCreatedByAndDeletedFalse(run.getId(), owner).orElseThrow();
        assertThat(row.getContext()).isNotNull();
        assertThat(row.getContext().weeks()).isNotEmpty();
        assertThat(row.getContext().weeks().get(0).sleepAvgH()).isEqualTo(7.5);
        assertThat(row.getAiEvalStatus()).isEqualTo(MesocycleReportEntity.AI_EVAL_STATUS_PENDING);
        assertThat(row.getAiEval()).isNull();
        assertThat(row.getAiEvalGeneratedAt()).isNull();
    }
}
