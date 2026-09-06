package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.DerivedSeriesService;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.companion.service.MetricValueKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TextSignalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reflexió S1 (mezo-eq85.1): the four TEXT_* metric series and the derived {@code people:} /
 * {@code topic:} presence series read off {@code text_signal}.
 */
@ActiveProfiles("companion-fake")
class TextSignalSeriesIT extends AbstractIntegrationTest {

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private DerivedSeriesService derivedSeriesService;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testTextMood_shouldAverageSureSignalsPerDay_andSkipUnsure() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(2);
        textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, UUID.randomUUID(), day,
                4, 3, 2, List.of("Anna"), List.of("sport"));
        textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_GRATITUDE, UUID.randomUUID(), day,
                2, null, null, List.of(), List.of());
        TextSignalEntity unsure = textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL,
                UUID.randomUUID(), day, 5, 5, 5, List.of(), List.of());
        unsure.setConfidence(TextSignalEntity.CONFIDENCE_UNSURE);
        textSignalPopulator.save(unsure);

        // (4 + 2) / 2 — the unsure 5 never enters the average
        assertThat(metricSeriesService.series(owner, MetricKey.TEXT_MOOD, day, day))
                .containsEntry(day, 3.0);
        // only the journal row carries energy/stress, so its own value is the day's mean
        assertThat(metricSeriesService.series(owner, MetricKey.TEXT_ENERGY, day, day))
                .containsEntry(day, 3.0);
        assertThat(metricSeriesService.series(owner, MetricKey.TEXT_STRESS, day, day))
                .containsEntry(day, 2.0);
        assertThat(metricSeriesService.series(owner, MetricKey.TEXT_SOCIAL_CONTACT, day, day))
                .containsEntry(day, 1.0);
    }

    @Test
    void testTextSeries_shouldBeEmpty_whenNoSignalsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(2);
        assertThat(metricSeriesService.series(owner, MetricKey.TEXT_MOOD, day, day)).isEmpty();
        assertThat(metricSeriesService.series(owner, MetricKey.TEXT_SOCIAL_CONTACT, day, day)).isEmpty();
    }

    @Test
    void testDerivedPeopleSeries_shouldBeBinaryOnDaysWithAnySignal() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate a = LocalDate.now().minusDays(3);
        LocalDate b = LocalDate.now().minusDays(2);
        textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, UUID.randomUUID(), a,
                3, 3, 3, List.of("Anna"), List.of());
        textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, UUID.randomUUID(), b,
                3, 3, 3, List.of(), List.of("munka"));

        Map<LocalDate, Double> anna = derivedSeriesService.series(owner, "people:anna", a, b);
        assertThat(anna).containsEntry(a, 1.0).containsEntry(b, 0.0);
        assertThat(derivedSeriesService.series(owner, "topic:munka", a, b))
                .containsEntry(a, 0.0).containsEntry(b, 1.0);
        // a plain MetricKey wire key delegates to MetricSeriesService — no sleep seeded ⇒ empty
        assertThat(derivedSeriesService.series(owner, "sleep-duration-h", a, b)).isEmpty();
        // an unknown key is not a crash, it is simply no series
        assertThat(derivedSeriesService.series(owner, "nincs-ilyen", a, b)).isEmpty();

        assertThat(derivedSeriesService.valueKindOf("people:anna")).isEqualTo(MetricValueKind.BINARY);
        assertThat(derivedSeriesService.valueKindOf("topic:munka")).isEqualTo(MetricValueKind.BINARY);
        assertThat(derivedSeriesService.valueKindOf("sleep-duration-h")).isEqualTo(MetricValueKind.NUMBER);
        assertThat(derivedSeriesService.labelOf("people:anna")).isEqualTo("„anna” a szövegeidben");
        assertThat(derivedSeriesService.labelOf("topic:munka")).isEqualTo("munka téma");
        assertThat(derivedSeriesService.labelOf("sleep-duration-h"))
                .isEqualTo(MetricKey.SLEEP_DURATION_H.labelHu());
        assertThat(derivedSeriesService.labelOf("nincs-ilyen")).isEqualTo("nincs-ilyen");

        assertThat(derivedSeriesService.isKnown(owner, "people:anna")).isTrue();
        assertThat(derivedSeriesService.isKnown(owner, "topic:munka")).isTrue();
        assertThat(derivedSeriesService.isKnown(owner, "people:senki")).isFalse();
        assertThat(derivedSeriesService.isKnown(owner, "sleep-duration-h")).isTrue();
        assertThat(derivedSeriesService.isKnown(owner, "nincs-ilyen")).isFalse();
    }

    /** bd mezo-xih1: a kulcs és a tárolt név ÉKEZETE nem hasíthatja szét ugyanazt az embert. */
    @Test
    void testDerivedPeopleSeries_shouldMatchNameFolded_ignoringAccentAndCase() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(2);
        textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, UUID.randomUUID(), day,
                3, 3, 3, List.of("Réka"), List.of());

        assertThat(derivedSeriesService.series(owner, "people:Reka", day, day)).containsEntry(day, 1.0);
        assertThat(derivedSeriesService.series(owner, "people:réka", day, day)).containsEntry(day, 1.0);
        assertThat(derivedSeriesService.isKnown(owner, "people:reka")).isTrue();
        // a ragozott alak viszont NEM ugyanaz a kulcs — az írási idejű normalizálás dolga, hogy
        // ilyen név ne is kerüljön a tömbbe (TextSignalNameNormalizationIT)
        assertThat(derivedSeriesService.series(owner, "people:Rékának", day, day))
                .containsEntry(day, 0.0);
    }

    @Test
    void testNewerVersion_shouldWinPerSource() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(2);
        UUID sourceId = UUID.randomUUID();
        textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, sourceId, day,
                2, 2, 2, List.of("Anna"), List.of(), 1);
        textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, sourceId, day,
                4, 4, 4, List.of(), List.of(), 2);

        // one source ⇒ one value: the newest version's, not the mean of the two
        assertThat(metricSeriesService.series(owner, MetricKey.TEXT_MOOD, day, day))
                .containsEntry(day, 4.0);
        // v2 dropped Anna, so the derived people series must follow the newest version too
        assertThat(derivedSeriesService.series(owner, "people:anna", day, day))
                .containsEntry(day, 0.0);
        assertThat(metricSeriesService.series(owner, MetricKey.TEXT_SOCIAL_CONTACT, day, day))
                .containsEntry(day, 0.0);
    }
}
