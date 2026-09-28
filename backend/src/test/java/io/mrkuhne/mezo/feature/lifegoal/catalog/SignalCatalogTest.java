package io.mrkuhne.mezo.feature.lifegoal.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import org.junit.jupiter.api.Test;

/** Check-in 2.0 (mezo-ck2, spec §3.8b/§3.9): the check-in signals the life-goal catalog offers. */
class SignalCatalogTest {

    private final SignalCatalog catalog = new SignalCatalog();

    @Test
    void testById_shouldOfferTheNewCheckinSignals_whenCatalogBuilt() {
        assertEntry("checkin_mood", "CHECKIN_MOOD", "Check-in hangulat", "Elme");
        assertEntry("checkin_motivation", "CHECKIN_MOTIVATION", "Motiváció", "Elme");
        assertEntry("checkin_rested", "CHECKIN_RESTED", "Kipihentség", "Test");
        assertEntry("checkin_connection", "CHECKIN_CONNECTION", "Kapcsolódás", "Emberek");
    }

    @Test
    void testById_shouldLabelMentalAsClarity_whenMoodIsItsOwnItem() {
        assertThat(catalog.byId("checkin_mental")).get()
            .extracting(SignalCatalogEntry::label).isEqualTo("Check-in fejtisztaság");
    }

    /** The metric dispatcher resolves every metric source with {@code MetricKey.valueOf} — a typo
     *  here would only surface at evaluation time. */
    @Test
    void testEntries_shouldPointEveryMetricSourceAtARealMetricKey_whenCatalogBuilt() {
        catalog.entries().stream()
            .filter(e -> "metric".equals(e.source().type()))
            .forEach(e -> assertThat(MetricKey.valueOf(e.source().key())).as(e.id()).isNotNull());
        assertThat(catalog.ids()).hasSize(catalog.entries().size());
    }

    private void assertEntry(String id, String metricKey, String label, String group) {
        SignalCatalogEntry entry = catalog.byId(id).orElseThrow();
        assertThat(entry.source().type()).as(id).isEqualTo("metric");
        assertThat(entry.source().key()).as(id).isEqualTo(metricKey);
        assertThat(entry.label()).as(id).isEqualTo(label);
        assertThat(entry.group()).as(id).isEqualTo(group);
        assertThat(entry.kinds()).as(id).containsExactly("average", "baseline");
        assertThat(entry.unit()).as(id).isEqualTo("1–10");
    }
}
