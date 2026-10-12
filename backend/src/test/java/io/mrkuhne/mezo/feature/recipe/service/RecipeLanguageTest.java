package io.mrkuhne.mezo.feature.recipe.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.recipe.config.RecipeWorkshopProperties;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawDraft;
import io.mrkuhne.mezo.techcore.message.UserMessages;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** Recipe workshop + recipe evaluation: server words and LLM prompts per account language (mezo-n4wf5.5). */
class RecipeLanguageTest {

    private static String defaultName(String language) {
        return new RecipeWorkshopValidator(new RecipeWorkshopProperties(30, 20, 20), UserMessages.fixed(language))
            .sanitize(new RawDraft(" ", "dinner", 1, List.of(), List.of()), id -> Optional.empty())
            .getName();
    }

    @Test
    void testSanitize_shouldNameAnUnnamedDraftInTheAccountLanguage() {
        assertThat(defaultName("hu")).isEqualTo("Új recept");
        assertThat(defaultName("en")).isEqualTo("New recipe");
    }

    @Test
    void testWorkshopReplyFallback_shouldExistInBothLanguages() {
        assertThat(UserMessages.fixed("hu").text("RECIPE_WORKSHOP_REPLY_FALLBACK")).isEqualTo("Frissítettem a vázlatot.");
        assertThat(UserMessages.fixed("en").text("RECIPE_WORKSHOP_REPLY_FALLBACK")).isEqualTo("I updated the draft.");
    }

    @Test
    void testWorkshopPrompt_shouldNotDemandHungarian_whenAccountIsEnglish() {
        assertThat(RecipeWorkshopService.SYSTEM_PROMPT_HEAD).contains("magyar nyelvű", "rövid magyar indoklás");
        assertThat(RecipeWorkshopService.SYSTEM_PROMPT_HEAD_NEUTRAL)
            .startsWith("Te a Receptműhely vagy: iteratív recept-tervező társ.")
            .doesNotContainIgnoringCase("magyar")
            .contains("{\"reply\":string,\"draft\":{\"name\":string"); // the JSON contract is intact
    }

    @Test
    void testBreakdownProsePrompt_shouldNotDemandHungarian_whenAccountIsEnglish() {
        assertThat(RecipeBreakdownProseService.SYSTEM_PROMPT).contains("- Write Hungarian, tegeződve, tömören.");
        assertThat(RecipeBreakdownProseService.SYSTEM_PROMPT_NEUTRAL)
            .doesNotContain("Write Hungarian")
            .contains("- Tegeződve, tömören.")
            .startsWith("You evaluate ONE saved recipe TEMPLATE");
    }
}
