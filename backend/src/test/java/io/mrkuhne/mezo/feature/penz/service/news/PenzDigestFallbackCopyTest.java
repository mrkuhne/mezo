package io.mrkuhne.mezo.feature.penz.service.news;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** The fixed copy (mezo-r36n9.104): per-item noAction, honest fallback, and it passes its own validator. */
class PenzDigestFallbackCopyTest {

    @Test
    void testNoAction_shouldDifferPerKindAndSleeve() {
        Set<String> all = Stream.of(
                DigestFallbackCopy.noAction(DigestKind.HOLDING, "long"),
                DigestFallbackCopy.noAction(DigestKind.HOLDING, "mid"),
                DigestFallbackCopy.noAction(DigestKind.HOLDING, "short"),
                DigestFallbackCopy.noAction(DigestKind.HOLDING, null),
                DigestFallbackCopy.noAction(DigestKind.FX, null),
                DigestFallbackCopy.noAction(DigestKind.RATES, null))
            .collect(Collectors.toSet());

        assertThat(all).hasSize(6);
    }

    @Test
    void testEffectNote_shouldBeTheFixedCopyPerKind() {
        assertThat(DigestFallbackCopy.effectNote(DigestKind.HOLDING, -5)).isEqualTo("a te részeden");
        assertThat(DigestFallbackCopy.effectNote(DigestKind.FX, -5)).isEqualTo("forintban mérve");
        assertThat(DigestFallbackCopy.effectNote(DigestKind.RATES, 0)).isEqualTo("változatlan hozam");
    }

    @Test
    void testTitleAndBody_shouldNameTheLedgerHoldingAndTheSourceCountInWords() {
        assertThat(DigestFallbackCopy.title(DigestKind.HOLDING, "Mintavilág ETF")).isEqualTo("Mintavilág ETF: friss hír");
        assertThat(DigestFallbackCopy.title(DigestKind.FX, null)).isEqualTo("Forintárfolyam: friss hír");
        assertThat(DigestFallbackCopy.body(1)).startsWith("Egy forrás írt róla");
        assertThat(DigestFallbackCopy.body(3)).startsWith("Három forrás írt róla");
        assertThat(DigestFallbackCopy.verdict()).contains("nem tudtam megbízhatóan összefoglalni");
    }

    @Test
    void testFallback_shouldPassTheValidator_forEveryKind() {
        for (DigestStory s : List.of(DigestFixtures.worldStory(null), DigestFixtures.fxStory(),
            DigestFixtures.ratesStory())) {
            var item = DigestAssembler.fallback(s);
            DigestModelItem asModel = new DigestModelItem(s.id(), true, item.title(), item.verdict(), item.body(), 0,
                item.uncertainty(), item.noAction());

            assertThat(DigestValidator.validate(asModel, s, DigestFixtures.HOLDINGS)).as(s.id()).isEmpty();
        }
    }
}
