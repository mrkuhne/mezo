package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import org.junit.jupiter.api.Test;

/** S8 (mezo-d6ivw.12): the prompt-ready sentence of a confirmed observation. */
class FactTextComposerTest {

    private static final String TITLE = "Rövid alvás → gyengébb edzés";

    @Test
    void compose_shouldKeepTheTitle_whenMechanismIsNullOrBlank() {
        assertThat(FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, null)).isEqualTo(TITLE);
        assertThat(FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, "   ")).isEqualTo(TITLE);
    }

    @Test
    void compose_shouldKeepTheTitle_forStatisticalBoilerplate() {
        assertThat(FactTextComposer.compose(PatternEntity.KIND_STATISTICAL, TITLE,
                "r = 0,41, n = 23 nap: az alvás és az edzés-RPE együtt mozog.")).isEqualTo(TITLE);
    }

    @Test
    void compose_shouldTakeTheFirstTwoSentences_whenTheyStayShort() {
        String mechanism = "Ha 6 óra alatt alszol, másnap nehezebbnek érzed az edzést.  Ilyenkor a súlyok "
                + "is lassabban mennek. Harmadik mondat, ami már nem kell.";
        assertThat(FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, mechanism))
                .isEqualTo("Ha 6 óra alatt alszol, másnap nehezebbnek érzed az edzést. Ilyenkor a súlyok is lassabban mennek.");
    }

    @Test
    void compose_shouldTakeOnlyTheFirstSentence_whenThePairIsLong() {
        String first = "Első mondat " + "nagyon ".repeat(30) + "hosszú.";
        String mechanism = first + " Második mondat " + "szintén ".repeat(20) + "hosszú.";
        assertThat(FactTextComposer.compose(PatternEntity.KIND_AI_HYPOTHESIS, TITLE, mechanism)).isEqualTo(first);
    }

    @Test
    void compose_shouldCapAt500_onAWordBoundaryWithEllipsis() {
        String mechanism = "szó ".repeat(200).strip() + ".";
        String composed = FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, mechanism);
        assertThat(composed).hasSizeLessThanOrEqualTo(500).endsWith("…").doesNotContain("  ");
        assertThat(composed.substring(0, composed.length() - 1)).endsWith("szó");
    }

    @Test
    void compose_shouldNotSplitAtAnAbbreviation_plRövidítés() {
        String mechanism = "Az étkezési rutin szorosan kötődik az edzőtermi napokhoz. Amikor ez a rutin "
                + "megszakad (pl. pihenőnap, hétvégi verseny), a bevitel drasztikusan csökken.";
        assertThat(FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, mechanism)).isEqualTo(mechanism);
    }

    @Test
    void compose_shouldNotSplitAtAnAbbreviation_kbRövidítés() {
        String mechanism = "Első mondat kb. két órával később. Második mondat.";
        assertThat(FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, mechanism)).isEqualTo(mechanism);
    }

    @Test
    void compose_shouldFallBackToTitle_whenComposedTextLeavesAnUnbalancedOpenParenthesis() {
        String mechanism = "Kezdés (nyitva marad. Zárás nélkül folytatódik.";
        assertThat(FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, mechanism)).isEqualTo(TITLE);
    }
}
