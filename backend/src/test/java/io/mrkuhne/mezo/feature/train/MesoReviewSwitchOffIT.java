package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleReportResponse;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.service.MesocycleReportService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Meso-review switch OFF (mezo-meyc.3): with {@code mezo.feature.meso-review.enabled=false} the
 * {@code MesoReviewGate} bean is absent, so {@code getReport} must report {@code aiEvalEnabled}
 * false regardless of the deterministic report's state. Separate class because a
 * {@code @ConditionalOnProperty} bean's presence is fixed per Spring context (mirrors
 * {@code ClosingBlockSwitchOffIT}).
 */
@TestPropertySource(properties = "mezo.feature.meso-review.enabled=false")
class MesoReviewSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private TrainService trainService;
    @Autowired private MesocycleReportService reportService;
    @Autowired private TrainPopulator train;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testGetReport_shouldReportAiEvalDisabled_whenSwitchOff() {
        UUID owner = databasePopulator.populateUser("meso-review-off-a@test.local");
        MesocycleEntity run = train.activeMesoStartedWeeksAgo(owner, 1, 2, 1, List.of("MEV", "MAV"));

        trainService.closeMesocycle(owner, run.getId(), null);

        MesocycleReportResponse report = reportService.getReport(owner, run.getId());
        assertThat(report.getAiEvalEnabled()).isFalse();
    }
}
