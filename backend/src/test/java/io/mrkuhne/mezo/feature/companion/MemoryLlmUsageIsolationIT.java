package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemoryLlmUsageResponse;
import io.mrkuhne.mezo.feature.companion.service.MemoryObservatoryService;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cross-account leak regression (mezo-qw37.7): the Memória/Audit panel's LLM-usage rollup must see
 * only the CALLER's own rows. Before the fix, {@code MemoryObservatoryService.llmUsage(days)} rolled
 * up the whole {@code llm_log_history} table with no {@code created_by} predicate at all, so every
 * account saw every account's calls, tokens and cost. Rows with {@code created_by = null} (pre-S6
 * cron traffic, stream writes) belong to nobody and must stay excluded from either user's rollup.
 */
@Transactional
@TestPropertySource(properties = "mezo.feature.llm-log.enabled=true")
class MemoryLlmUsageIsolationIT extends AbstractIntegrationTest {

    @Autowired private MemoryObservatoryService memoryObservatoryService;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private LlmLogProperties llmLogProperties;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testLlmUsage_shouldSeeOnlyOwnRows_whenMultipleAccountsAndNullOwnerRowsExist() {
        UUID userA = databasePopulator.populateUser("llm-usage-a@test.local");
        UUID userB = databasePopulator.populateUser("llm-usage-b@test.local");
        ZoneId zone = llmLogProperties.reportZone();
        LocalDate today = LocalDate.now(zone);

        llmLogPopulator.logAt(today.atTime(10, 0).atZone(zone).toInstant(), userA, CallKind.CHAT,
                "companion", "gemini-2.5-flash", 100, 40, null, new BigDecimal("0.010000"));
        llmLogPopulator.logAt(today.atTime(11, 0).atZone(zone).toInstant(), userB, CallKind.CHAT,
                "companion", "gemini-2.5-flash", 500, 200, null, new BigDecimal("0.050000"));
        llmLogPopulator.logAt(today.atTime(12, 0).atZone(zone).toInstant(), null, CallKind.SMART,
                "companion", "gemini-2.5-pro", 9999, 9999, null, new BigDecimal("9.000000"));

        MemoryLlmUsageResponse aResponse = memoryObservatoryService.llmUsage(userA, 30);
        MemoryLlmUsageResponse bResponse = memoryObservatoryService.llmUsage(userB, 30);

        assertThat(aResponse.getTotals().getCalls()).isEqualTo(1L);
        assertThat(aResponse.getTotals().getInputTokens()).isEqualTo(100L);
        assertThat(aResponse.getTotals().getOutputTokens()).isEqualTo(40L);
        assertThat(aResponse.getTotals().getCostUsd()).isEqualTo(0.01);

        assertThat(bResponse.getTotals().getCalls()).isEqualTo(1L);
        assertThat(bResponse.getTotals().getInputTokens()).isEqualTo(500L);
        assertThat(bResponse.getTotals().getOutputTokens()).isEqualTo(200L);
        assertThat(bResponse.getTotals().getCostUsd()).isEqualTo(0.05);
    }
}
