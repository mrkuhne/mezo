package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Pure unit test of the coach prompt assembly (mezo-mr4n) — the reason {@link MealCoachPrompt}
 * exists as its own unit: the prompt's CONTENT is the contract with the model, so it deserves
 * assertions that need neither Spring nor a scripted LLM.
 */
class MealCoachPromptTest {

    private static final LocalDate DATE = LocalDate.of(2026, 6, 24);
    private static final NutritionTargetsProperties TARGETS =
        new NutritionTargetsProperties(3100, 220, 380, 95, 4000);

    private static MealBreakdownJson breakdown() {
        return new MealBreakdownJson(new BigDecimal("0.62"), new BigDecimal("0.80"), null, null,
            List.of(new MealBreakdownJson.Dimension("macro", "Kcal & makró", new BigDecimal("0.22"),
                new BigDecimal("0.50"), "P/C/F 17/71/11 vs 27/47/26", null, null, null, null, null)),
            List.of(), List.of());
    }

    private static MealCoachPrompt.MealBlock block(UUID id, String name, int indexInDay,
        BigDecimal kcalBefore) {
        return new MealCoachPrompt.MealBlock(id, name, "breakfast", LocalTime.of(6, 15), indexInDay,
            breakdown(), MealRole.PRE_WORKOUT, kcalBefore, BigDecimal.ZERO, BigDecimal.ZERO,
            BigDecimal.ZERO);
    }

    private static MealCoachPrompt.MealBlock block(String name, int indexInDay, BigDecimal kcalBefore) {
        return block(UUID.randomUUID(), name, indexInDay, kcalBefore);
    }

    @Test
    void testUserMessage_shouldNameTheWorkout_whenTheDayHasAGymWindow() {
        String msg = MealCoachPrompt.userMessage(DATE, TARGETS,
            List.of(new WorkoutWindowQueryService.Window(
                LocalTime.of(18, 0), LocalTime.of(19, 0), "gym", false, "Pull")),
            List.of(block("Zabkása", 1, BigDecimal.ZERO)));

        assertThat(msg).contains("Pull").contains("18:00");
    }

    @Test
    void testUserMessage_shouldCarryTheUpToThatPointDayState_perMeal() {
        String msg = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Reggeli", 1, BigDecimal.ZERO),
                    block("Ebéd", 2, new BigDecimal("700"))));

        assertThat(msg).contains("Reggeli").contains("Ebéd").contains("700");
    }

    @Test
    void testUserMessage_shouldCarryEveryMealId_soEveryMealCanBeAnswered() {
        UUID id = UUID.randomUUID();

        String msg = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block(id, "Zabkása", 1, BigDecimal.ZERO)));

        assertThat(msg).contains(id.toString());
    }

    @Test
    void testUserMessage_shouldCarryTheDeterministicDimensionScores_soTheProseCanExplainThem() {
        String msg = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Zabkása", 1, BigDecimal.ZERO)));

        assertThat(msg).contains("macro").contains("0.50")           // the dimension and its score
            .contains("P/C/F 17/71/11 vs 27/47/26")                  // its deterministic detail
            .contains("pre_workout");                                // and the role it was scored under
    }

    @Test
    void testUserMessage_shouldStateTheDailyTargets_soRemainingBudgetIsDerivable() {
        String msg = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Zabkása", 1, BigDecimal.ZERO)));

        assertThat(msg).contains("3100").contains("220");
    }
}
