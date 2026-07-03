package io.mrkuhne.mezo.feature.companion.advisor;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure-logic unit test — the check is deterministic regex, no Spring context needed. */
class ClinicalOutputCheckTest {

    private final ClinicalOutputCheck check = new ClinicalOutputCheck(
            List.of("retatrutid", "reta", "tirzepatid", "mounjaro", "szemaglutid", "ozempic", "wegovy"));

    @Test
    void testCheck_shouldViolate_whenDoseChangeVerbAndRxTermShareASentence() {
        assertThat(check.check("Emeljük a retatrutid adagot 4 mg-ra a jövő héttől.")).isPresent();
    }

    @Test
    void testCheck_shouldViolate_whenRxTermIsAccentedInflection() {
        assertThat(check.check("Szerintem hagyd el a Retát erre a hétre.")).isPresent();
    }

    @Test
    void testCheck_shouldPass_whenRxTermWithoutDoseChangeVerb() {
        assertThat(check.check("A Reta D3 ablakban az étvágy leesik — tervezz 30g fehérjét délutánra.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenDoseChangeVerbWithoutRxTerm() {
        assertThat(check.check("Emeljük a fehérjebevitelt 180 g-ra.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenVerbAndTermInDifferentSentences() {
        assertThat(check.check("Emeljük a tempót az edzésen. A retatrutid mellett ez belefér.")).isEmpty();
    }
}
