package io.mrkuhne.mezo.techcore.message;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** The language-pinned renderer domain services and their unit tests use (mezo-n4wf5.5). */
class UserMessagesTest {

    @Test
    void testFixed_shouldRenderInTheGivenLanguage() {
        assertThat(UserMessages.fixed("hu").text("FUEL_PLACEMENT_REASON_MANUAL")).isEqualTo("Kézzel ide helyezve.");
        assertThat(UserMessages.fixed("en").text("FUEL_PLACEMENT_REASON_MANUAL")).isEqualTo("Placed here by hand.");
        assertThat(UserMessages.fixed("hu").language()).isEqualTo("hu");
        assertThat(UserMessages.fixed("en").language()).isEqualTo("en");
    }

    @Test
    void testFixed_shouldFallBackToHungarian_whenLanguageIsUnknown() {
        assertThat(UserMessages.fixed("de").language()).isEqualTo("hu");
        assertThat(UserMessages.fixed(null).text("FUEL_SCORE_ROW_FIBER")).isEqualTo("Rost");
    }

    @Test
    void testText_shouldKeepNumbersAsWritten_whenTheyArriveAsStrings() {
        // A Number argument would be grouped by MessageFormat ("3 100" / "3,100") — callers pass strings.
        assertThat(UserMessages.fixed("hu").text("FUEL_SCORE_MACRO_ORIGIN_GOAL", "220", "380", "95", "3100"))
            .isEqualTo("az aktív célod napi előírása · 220 g fehérje / 380 g szénhidrát / 95 g zsír egy 3100 kcal-s napra");
        assertThat(UserMessages.fixed("en").text("FUEL_SCORE_MACRO_ORIGIN_GOAL", "220", "380", "95", "3100"))
            .isEqualTo("The daily targets of your active goal · 220 g protein / 380 g carbs / 95 g fat for a 3100 kcal day");
    }

    @Test
    void testPinned_shouldKeepTheLanguageItWasTakenIn() {
        UserMessages english = UserMessages.fixed("en").pinned();
        assertThat(english.text("RECIPE_WORKSHOP_DEFAULT_NAME")).isEqualTo("New recipe");
        assertThat(english.pinned()).isSameAs(english);
    }

    @Test
    void testText_shouldReturnTheKey_whenTheBundleHasNoSuchMessage() {
        assertThat(UserMessages.fixed("en").text("NO_SUCH_KEY")).isEqualTo("NO_SUCH_KEY");
    }
}
