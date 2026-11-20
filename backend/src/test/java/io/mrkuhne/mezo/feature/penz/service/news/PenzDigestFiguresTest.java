package io.mrkuhne.mezo.feature.penz.service.news;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** The figures' one Hungarian spelling and the allowed-number set (mezo-r36n9.104). */
class PenzDigestFiguresTest {

    @Test
    void testHuf_shouldPrintWholeSignedForintsWithSpaceGrouping() {
        assertThat(DigestFigures.huf(-1_840_000L)).isEqualTo("−18 400 Ft");
        assertThat(DigestFigures.huf(720_000L)).isEqualTo("+7 200 Ft");
        assertThat(DigestFigures.huf(0L)).isEqualTo("0 Ft");
        assertThat(DigestFigures.huf(-49L)).isEqualTo("0 Ft");
        assertThat(DigestFigures.huf(-150L)).isEqualTo("−2 Ft");
        assertThat(DigestFigures.hufMagnitude(124_000_000L)).isEqualTo("1 240 000 Ft");
        assertThat(DigestFigures.hufMagnitude(-99_999_900L)).isEqualTo("999 999 Ft");
    }

    @Test
    void testPct_shouldPrintMagnitudeOneDecimalDecimalComma() {
        assertThat(DigestFigures.pct(new BigDecimal("-1.12"))).isEqualTo("1,1%");
        assertThat(DigestFigures.pct(new BigDecimal("0.05"))).isEqualTo("0,1%");
        assertThat(DigestFigures.pct(new BigDecimal("2"))).isEqualTo("2,0%");
    }

    @Test
    void testAllowedNumbers_shouldHoldEffectPctValueAndSleeveNumbers() {
        assertThat(DigestFixtures.WORLD_FIGURES.allowedNumbers()).containsExactlyInAnyOrder("18400", "1.1", "1240000",
            "10");
        assertThat(DigestFixtures.WORLD_FIGURES.allowedHufMinor()).containsExactlyInAnyOrder(1_840_000L, 124_000_000L);
        assertThat(new DigestFigures(DigestKind.HOLDING, "short", 0, null, null).allowedNumbers())
            .containsExactlyInAnyOrder("0", "1", "3");
        assertThat(new DigestFigures(DigestKind.HOLDING, "mid", 0, new BigDecimal("2"), null).allowedNumbers())
            .containsExactlyInAnyOrder("0", "2", "5", "10");
    }

    @Test
    void testNormalizeNumber_shouldReadHungarianAndEnglishFormats() {
        assertThat(DigestFigures.numbersIn("18 400 Ft, 18 400, 18.400, 1,1%, 1,10 és 2026. 5–10"))
            .containsExactly("18400", "18400", "18400", "1.1", "1.1", "2026", "5", "10");
        assertThat(DigestFigures.normalizeNumber("1 240 000")).isEqualTo("1240000");
        assertThat(DigestFigures.normalizeNumber("1.5")).isEqualTo("1.5");
    }

    @Test
    void testFigureLines_shouldCarryEffectDirectionMoveValueAndHorizon() {
        assertThat(DigestFixtures.WORLD_FIGURES.figureLines()).containsExactly(
            "Hatás: −18 400 Ft (a te részeden)",
            "Irány: csökkenés",
            "Elmozdulás: −1,1%",
            "A tételed értéke: 1 240 000 Ft",
            "Horizont: 10+ év");
        assertThat(DigestFixtures.RATES_FIGURES.figureLines()).containsExactly("Hatás: 0 Ft (változatlan hozam)");
        assertThat(DigestFixtures.WORLD_FIGURES.changePctRounded()).isEqualByComparingTo("-1.1");
    }
}
