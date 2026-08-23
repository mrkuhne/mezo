package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W3.2 (mezo-b3pp.13): the ladder's knobs bind from yml — schedules and backfill windows. */
class ConsolidationPropertiesIT extends AbstractIntegrationTest {

    @Autowired private CompanionProperties properties;

    @Test
    void testConfig_shouldBindConsolidationBlock_whenContextStarts() {
        assertThat(properties.consolidation().weeklyCron()).isEqualTo("0 30 3 * * MON");
        assertThat(properties.consolidation().monthlyCron()).isEqualTo("0 50 3 1 * *");
        assertThat(properties.consolidation().backfillWeeks()).isEqualTo(8);
        assertThat(properties.consolidation().backfillMonths()).isEqualTo(3);
    }

    @Test
    void testConfig_shouldBindShadowingKnobs_whenContextStarts() {
        assertThat(properties.ambientRecall().capPeriodSummary()).isEqualTo(2);
        assertThat(properties.ambientRecall().weeklyShadowDays()).isEqualTo(30);
    }
}
