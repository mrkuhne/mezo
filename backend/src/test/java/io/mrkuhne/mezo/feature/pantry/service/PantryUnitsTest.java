package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * Pure unit test of "what was said -> the food's basis unit" (mezo-r36n9.63). The rule under test: a
 * saved line counts as {@code amount ÷ basis amount × facts} whatever its unit says, so an amount that
 * does not convert cleanly must come back FLAGGED — "2 ek" against a gram food must never be 2 g.
 */
class PantryUnitsTest {

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    @Test
    void testToBasis_shouldKeepSameUnitAsSaid() {
        var r = PantryUnits.toBasis(bd("500"), "g", "g");

        assertThat(r.amount()).isEqualByComparingTo("500");
        assertThat(r.unit()).isEqualTo("g");
        assertThat(r.doubt()).isFalse();
        assertThat(PantryUnits.toBasis(bd("2"), "darab", "db").doubt()).isFalse(); // synonyms agree
        assertThat(PantryUnits.toBasis(bd("150"), "gramm", "g").doubt()).isFalse();
    }

    @Test
    void testToBasis_shouldConvertDekaExactly() {
        var r = PantryUnits.toBasis(bd("30"), "dkg", "g");

        assertThat(r.amount()).isEqualByComparingTo("300");
        assertThat(r.unit()).isEqualTo("g");
        assertThat(r.doubt()).isFalse();
    }

    @Test
    void testToBasis_shouldConvertMassAndVolumeFamiliesExactly() {
        assertThat(PantryUnits.toBasis(bd("0.5"), "kg", "g").amount()).isEqualByComparingTo("500");
        assertThat(PantryUnits.toBasis(bd("1.5"), "l", "ml").amount()).isEqualByComparingTo("1500");
        assertThat(PantryUnits.toBasis(bd("2"), "dl", "ml").amount()).isEqualByComparingTo("200");
        assertThat(PantryUnits.toBasis(bd("5"), "cl", "ml").amount()).isEqualByComparingTo("50");
        assertThat(PantryUnits.toBasis(bd("2"), "dl", "ml").doubt()).isFalse();
    }

    @Test
    void testToBasis_shouldConvertSpoonsExactlyAgainstMillilitreFood() {
        var tbsp = PantryUnits.toBasis(bd("2"), "ek", "ml");
        var tsp = PantryUnits.toBasis(bd("1"), "tk", "ml");

        assertThat(tbsp.amount()).isEqualByComparingTo("30");
        assertThat(tbsp.doubt()).isFalse();
        assertThat(tsp.amount()).isEqualByComparingTo("5");
        assertThat(tsp.doubt()).isFalse();
    }

    @Test
    void testToBasis_shouldFlagSpoonsAgainstGramFood() {
        var r = PantryUnits.toBasis(bd("2"), "ek", "g");

        assertThat(r.amount()).isEqualByComparingTo("30");
        assertThat(r.unit()).isEqualTo("g");
        assertThat(r.doubt()).isTrue();
    }

    @Test
    void testToBasis_shouldFlagVolumeAgainstMassAndBack() {
        var mlToG = PantryUnits.toBasis(bd("2"), "dl", "g");
        var gToMl = PantryUnits.toBasis(bd("10"), "dkg", "ml");

        assertThat(mlToG.amount()).isEqualByComparingTo("200");
        assertThat(mlToG.unit()).isEqualTo("g");
        assertThat(mlToG.doubt()).isTrue();
        assertThat(gToMl.amount()).isEqualByComparingTo("100");
        assertThat(gToMl.unit()).isEqualTo("ml");
        assertThat(gToMl.doubt()).isTrue();
    }

    @Test
    void testToBasis_shouldKeepPieceAndFlag() {
        var r = PantryUnits.toBasis(bd("1"), "db", "g");

        assertThat(r.amount()).isEqualByComparingTo("1"); // never trusted: 1 db is not 1 g
        assertThat(r.unit()).isEqualTo("g");
        assertThat(r.doubt()).isTrue();
        assertThat(PantryUnits.toBasis(bd("1"), "fej", "g").doubt()).isTrue();
        assertThat(PantryUnits.toBasis(bd("2"), "doboz", "ml").doubt()).isTrue();
    }

    @Test
    void testToBasis_shouldFlagMassAgainstPieceFood() {
        var r = PantryUnits.toBasis(bd("120"), "g", "db");

        assertThat(r.amount()).isEqualByComparingTo("120");
        assertThat(r.unit()).isEqualTo("db");
        assertThat(r.doubt()).isTrue();
    }

    @Test
    void testToBasis_shouldFlagMissingAmount() {
        var r = PantryUnits.toBasis(null, "g", "g");

        assertThat(r.amount()).isEqualByComparingTo("0");
        assertThat(r.unit()).isEqualTo("g");
        assertThat(r.doubt()).isTrue();
    }

    @Test
    void testToBasis_shouldTreatBlankBasisAsGramsAndBlankSaidUnitAsDoubt() {
        assertThat(PantryUnits.toBasis(bd("100"), "g", null).unit()).isEqualTo("g");
        assertThat(PantryUnits.toBasis(bd("100"), "g", " ").doubt()).isFalse();
        assertThat(PantryUnits.toBasis(bd("100"), null, "g").doubt()).isTrue();
    }
}
