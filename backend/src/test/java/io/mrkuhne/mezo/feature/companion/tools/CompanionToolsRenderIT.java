package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0.5 tool batch — deterministic, LLM-free render tests (the ContextSnapshotAssemblerIT idiom).
 * Tools are called directly with a hand-built ToolContext; the audit assertions prove the refs
 * each tool contributes.
 */
@Transactional
@ActiveProfiles("companion-fake")
class CompanionToolsRenderIT extends AbstractIntegrationTest {

    @Autowired private BiometricsTools biometricsTools;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    private ToolCallAudit audit;

    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void testGetWeightTrend_shouldRenderNincsAdat_whenNoWeighIns() {
        UUID owner = userPopulator.createUser().getId();
        String out = biometricsTools.getWeightTrend(4, ctx(owner));
        assertThat(out).isEqualTo("Súlytrend (4 hét): nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testGetWeightTrend_shouldRenderTrendAndWeeklyPoints_whenHistoryExists() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 0; i < 21; i++) {
            weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(20 - i),
                    BigDecimal.valueOf(88.0 - i * 0.1));
        }
        String out = biometricsTools.getWeightTrend(2, ctx(owner));
        assertThat(out).startsWith("Súlytrend (2 hét): trendsúly ").contains(" kg")
                .contains("Heti trendpontok: ");
        assertThat(audit.toRefsEnvelope().refs())
                .extracting(r -> r.kind()).containsExactly("WeightTrend");
    }

    @Test
    void testGetSleep_shouldListWindowedRowsNewestFirst_andClampDays() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("7.5"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(40), new BigDecimal("6.0"), 2);
        String out = biometricsTools.getSleep(90, ctx(owner)); // clamps to max-window-days=30
        assertThat(out).startsWith("Alvás (utolsó 30 nap):")
                .contains(LocalDate.now().minusDays(1) + ": 7.5 h, minőség 4/5")
                .doesNotContain(LocalDate.now().minusDays(40).toString());
        assertThat(audit.toRefsEnvelope().refs()).extracting(r -> r.kind()).containsExactly("Sleep");
    }

    @Test
    void testGetSleep_shouldRenderNincsAdat_whenEmpty() {
        String out = biometricsTools.getSleep(null, ctx(userPopulator.createUser().getId()));
        assertThat(out).isEqualTo("Alvás (utolsó 7 nap): nincs adat");
    }
}
