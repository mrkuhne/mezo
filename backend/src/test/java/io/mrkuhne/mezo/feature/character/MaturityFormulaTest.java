package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.service.MaturityFormula;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class MaturityFormulaTest {

    private static CharacterClaimEntity claim(String confidence) {
        var e = new CharacterClaimEntity();
        e.setConfidence(new BigDecimal(confidence));
        return e;
    }

    @Test
    void empty_isZero() {
        assertThat(MaturityFormula.compute(List.of())).isZero();
    }

    @Test
    void twoClaims_coveragePlusMeanConfidence() { // 20*2 + 40*0.65 = 66
        assertThat(MaturityFormula.compute(List.of(claim("0.50"), claim("0.80")))).isEqualTo((short) 66);
    }

    @Test
    void capsAt100() {
        assertThat(MaturityFormula.compute(List.of(claim("0.9"), claim("0.9"), claim("0.9"), claim("0.9"))))
                .isEqualTo((short) 100);
    }

    @Test
    void roundsHalfUp() { // 20 + 40*0.51 = 40.4 -> 40 ; 20 + 40*0.52 = 40.8 -> 41
        assertThat(MaturityFormula.compute(List.of(claim("0.51")))).isEqualTo((short) 40);
        assertThat(MaturityFormula.compute(List.of(claim("0.52")))).isEqualTo((short) 41);
    }

    @Test
    void meanConfidence_nullWhenEmpty_scale3() {
        assertThat(MaturityFormula.meanConfidence(List.of())).isNull();
        assertThat(MaturityFormula.meanConfidence(List.of(claim("0.50"), claim("0.81")))).isEqualByComparingTo("0.655");
    }
}
