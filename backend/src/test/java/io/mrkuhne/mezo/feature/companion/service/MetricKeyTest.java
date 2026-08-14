package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** V3.4 UI-mezők: minden metrika hordoz forrást + domént (mezo-18bx). */
class MetricKeyTest {

    @Test
    void testMetricKey_shouldCarrySourceAndDomain_forEveryMetric() {
        for (MetricKey metric : MetricKey.values()) {
            assertThat(metric.sourceHu()).as(metric.name()).isNotBlank();
            assertThat(metric.domain()).as(metric.name()).isNotNull();
        }
        assertThat(MetricKey.SLEEP_QUALITY.domain()).isEqualTo(MetricDomain.SLEEP);
        assertThat(MetricKey.GYM_WORKLOAD.domain()).isEqualTo(MetricDomain.TRAIN);
        assertThat(MetricKey.WEEKEND.domain()).isEqualTo(MetricDomain.OTHER);
        assertThat(MetricKey.CHECKIN_BODY.domain()).isEqualTo(MetricDomain.BODY);
        assertThat(MetricDomain.SLEEP.wireKey()).isEqualTo("sleep");
    }
}
