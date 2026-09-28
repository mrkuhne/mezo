package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** S8 (mezo-d6ivw.12): the narrow Hungarian forget phrase set — positives AND the traps. */
class ForgetIntentTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "Ezt ne jegyezd meg.",
            "Az Annásat inkább ne jegyezd meg.",
            "NE JEGYEZD MEG",
            "kérlek ne jegyezd meg ezt",
            "felejtsd el ezt",
            "Felejtsd el, amit mondtam.",
            "felejtsd el amit írtam Annáról",
            "Felejtsd el az előzőt!",
            "Kérlek, felejtsd el!",
            "felejtsd el",
            "ezt ne mentsd",
            "Ezt inkább ne tárold.",
            "ne tárold el",
            "felejtsd el mindent erről"
    })
    void testMatches_shouldBeTrue_forAForgetRequest(String text) {
        assertThat(ForgetIntent.matches(text)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Felejtsd el a tervet, csináljunk újat.",
            "Felejtsd el ezt a tervet",
            "Ne felejtsd el, hogy holnap edzés.",
            "Ne felejtsd el, amit mondtam.",
            "Jegyezd meg, hogy szeretem a kávét.",
            "Elfelejtettem bevenni a vitamint.",
            "Mentsd el ezt a receptet.",
            "Nem baj, ha nem jegyzed meg.",
            "",
            "   "
    })
    void testMatches_shouldBeFalse_forEverythingElse(String text) {
        assertThat(ForgetIntent.matches(text)).isFalse();
    }

    @org.junit.jupiter.api.Test
    void testMatches_shouldBeFalse_forNull() {
        assertThat(ForgetIntent.matches(null)).isFalse();
    }
}
