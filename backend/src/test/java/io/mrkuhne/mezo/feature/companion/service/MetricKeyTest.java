package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
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

    /**
     * bd mezo-dqzm: két kulcs felelt ugyanarra a kérdésre („társas volt-e ez a nap"), és mindkettő
     * önálló bemenetként állt a korrelációs motor rendelkezésére — a köztük mért „összefüggés"
     * közel tautologikus lett volna. A determinisztikus, kurált {@code SOCIAL_MENTIONS} marad a
     * katalógus-sor; a {@code TEXT_SOCIAL_CONTACT} belső jel, amit a sorozat-kiszolgáló továbbra
     * is kiad, de a motor és a Motor tab nem lát.
     */
    @Test
    void testCorrelatable_shouldExcludeExactlyTheDemotedSocialDaySeries() {
        assertThat(MetricKey.SOCIAL_MENTIONS.correlatable()).isTrue();
        assertThat(MetricKey.TEXT_SOCIAL_CONTACT.correlatable()).isFalse();
        assertThat(Arrays.stream(MetricKey.values()).filter(m -> !m.correlatable()).toList())
                .containsExactly(MetricKey.TEXT_SOCIAL_CONTACT);
    }
}
