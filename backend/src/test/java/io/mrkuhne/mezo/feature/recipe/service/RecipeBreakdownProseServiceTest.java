package io.mrkuhne.mezo.feature.recipe.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Pure prompt-assembly test (no Spring, no LLM): the role must reach the model. Lives in the
 * service package (the {@code MealCoachPromptTest} precedent) because {@code userMessage} is
 * package-private for exactly this test; constructing with all-null collaborators is safe because
 * {@code userMessage} touches neither the LLM port, the ObjectMapper nor the call-context holder.
 */
class RecipeBreakdownProseServiceTest {

    private final RecipeBreakdownProseService service =
        new RecipeBreakdownProseService(null, null, null);

    private RecipeEntity recipe(MealRole role) {
        RecipeEntity e = new RecipeEntity();
        e.setName("PB Banana Toast");
        e.setCategory("breakfast");
        e.setServings(1);
        e.setRole(role);
        e.setLines(List.of());
        return e;
    }

    private MealBreakdownJson envelope() {
        return new MealBreakdownJson(new BigDecimal("0.60"), new BigDecimal("0.80"), null, null,
            List.of(), List.of(), List.of(), MealScoringService.FORMULA_VERSION);
    }

    @Test
    void testUserMessage_shouldNameTheFuelRole_whenRecipeIsPreWorkout() {
        String msg = service.userMessage(recipe(MealRole.PRE_WORKOUT), envelope());

        assertThat(msg).contains("edzés előtti");
    }

    @Test
    void testUserMessage_shouldNameTheRecoveryRole_whenRecipeIsPostWorkout() {
        assertThat(service.userMessage(recipe(MealRole.POST_WORKOUT), envelope()))
            .contains("edzés utáni");
    }

    @Test
    void testUserMessage_shouldNotClaimATrainingRole_whenRecipeIsStandard() {
        String msg = service.userMessage(recipe(MealRole.STANDARD), envelope());

        assertThat(msg).doesNotContain("edzés előtti").doesNotContain("edzés utáni");
    }
}
