package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * The meal coach and the AI meal log send an English account a prompt that does not ask for
 * Hungarian, so nothing fights the appended output-language directive (mezo-n4wf5.5). Hungarian
 * accounts keep the original prompts.
 */
class MealPromptLanguageTest {

    @Test
    void testCoachPrompt_shouldNotDemandHungarian_whenAccountIsEnglish() {
        assertThat(MealCoachService.SYSTEM_PROMPT).contains("- Magyarul, tegeződve, tömören.");
        assertThat(MealCoachService.SYSTEM_PROMPT_NEUTRAL)
            .doesNotContain("Magyarul")
            .contains("- Tegeződve, tömören.")
            .hasSize(MealCoachService.SYSTEM_PROMPT.length() - "Magyarul, t".length() + "T".length());
    }

    @Test
    void testDraftPrompt_shouldNotDemandHungarian_whenAccountIsEnglish() {
        assertThat(MealAiDraftService.SYSTEM_PROMPT_HEAD)
            .contains("from Hungarian free text", "short Hungarian meal title");
        assertThat(MealAiDraftService.SYSTEM_PROMPT_HEAD_NEUTRAL)
            .startsWith("You extract ONE meal log from free text and/or a food photo.")
            .doesNotContainIgnoringCase("hungarian")
            .contains("- title: short meal title;");
    }
}
