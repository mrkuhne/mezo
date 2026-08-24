package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * get_recovery(scope=sleep) detail mode — on-demand full sleep-log rows (mezo-ohce). Spec:
 * docs/superpowers/specs/2026-08-24-sleep-log-detail-tool-design.md §3/§4/§6. Same package and
 * framework as CompanionToolsRenderIT; kept separate because that file is already 1.4k lines.
 * Detail rows are null-guarded: absent fields are omitted, never a fabricated value.
 */
class SleepLogDetailRenderIT extends AbstractIntegrationTest {

    @Autowired private BiometricsTools biometricsTools;
    @Autowired private SleepLogRepository sleepLogRepository;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private ToolCallAudit audit;

    // Verbatim mirror of CompanionToolsRenderIT's ctx helper (that file:106-112).
    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void testSleepLogRepository_shouldReturnInclusiveNewestFirst_whenDateBetween() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(2), new BigDecimal("7.0"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(5), new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(9), new BigDecimal("5.0"), 2);

        List<SleepLogEntity> rows = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
                        owner, LocalDate.now().minusDays(7), LocalDate.now());

        assertThat(rows).extracting(SleepLogEntity::getDate)
                .containsExactly(LocalDate.now().minusDays(2), LocalDate.now().minusDays(5));
    }
}
