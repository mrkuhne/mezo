package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
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
    private static final DailyTargets TARGETS = new DailyTargets(1500, 150, 150, 50, "goal");

    private static MealBreakdownJson breakdown() {
        return new MealBreakdownJson(new BigDecimal("0.62"), new BigDecimal("0.80"), null, null,
            List.of(new MealBreakdownJson.Dimension("macro", "Kcal & makró", new BigDecimal("0.22"),
                new BigDecimal("0.50"), BigDecimal.ONE, "P/C/F 17/71/11 vs 27/47/26", null, null, null, null, null,
                null)),
            List.of(), List.of(), MealScoringService.FORMULA_VERSION);
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

        assertThat(msg).contains("1500").contains("150");
    }

    @Test
    void thePromptQuotesTheResolvedGoalTargets_notTheStaticConfig() {
        String prompt = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Vacsora", 1, BigDecimal.ZERO)));
        assertThat(prompt).contains("NAPI CÉLOK: 1500 kcal");
        assertThat(prompt).doesNotContain("3100");
    }

    @Test
    void theRemainingLine_isComputedFromTheResolvedTargets() {
        String prompt = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Vacsora", 2, new BigDecimal("400"))));
        assertThat(prompt).contains("marad: 1100 kcal");
    }

    @Test
    void testUserMessage_shouldListThePlatesOwnItems_withUnknownSugarAsQuestionMark() {
        MealCoachPrompt.MealBlock withItems = new MealCoachPrompt.MealBlock(UUID.randomUUID(), "Tízórai",
            "snack", LocalTime.of(10, 45), 1, breakdown(), MealRole.STANDARD, BigDecimal.ZERO,
            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, List.of(
                new MealCoachStore.ItemLine("Méz", new BigDecimal("20"), "g", new BigDecimal("16"),
                    new BigDecimal("16.4"), BigDecimal.ZERO, BigDecimal.ZERO),
                new MealCoachStore.ItemLine("Rozskenyér", new BigDecimal("80"), "g", new BigDecimal("38"),
                    null, null, new BigDecimal("6"))));

        String msg = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(), List.of(withItems));

        assertThat(msg).contains("TÉTELEK")
            .contains("- Méz 20 g · C 16g · ebből cukor 16g · rost 0g")
            .contains("- Rozskenyér 80 g · C 38g · ebből cukor ? · rost ?");
    }

    @Test
    void testUserMessage_shouldOmitTheItemsBlock_whenNoLinesAreKnown() {
        String msg = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Zabkása", 1, BigDecimal.ZERO)));

        assertThat(msg).doesNotContain("TÉTELEK");
    }

    private static MealCoachStore.ItemLine line(String c, String sugar, String fiber, String p, String f) {
        return new MealCoachStore.ItemLine("x", BigDecimal.ONE, "g", new BigDecimal(c),
            sugar == null ? null : new BigDecimal(sugar), new BigDecimal(fiber), new BigDecimal(p),
            new BigDecimal(f), null, null, null, null);
    }

    /** The FE `glycemicBand.test.ts` boundary cases — the twin must agree with the box. */
    @Test
    void testGlucoseBand_shouldMatchTheFrontendDerivation() {
        // 100 g sugar-free carbs: load 60; fiber 24.05 → 11.9 low, 24 → 12 mid, 18 → 24 high
        assertThat(MealCoachPrompt.glucoseBand(List.of(line("100", "0", "24.05", "0", "0")))).isEqualTo("alacsony");
        assertThat(MealCoachPrompt.glucoseBand(List.of(line("100", "0", "24", "0", "0")))).isEqualTo("közepes");
        assertThat(MealCoachPrompt.glucoseBand(List.of(line("100", "0", "18", "0", "0")))).isEqualTo("magas");
        // the owner's tízórai (110 C / 48 sugar / 12 fiber / 21 P / 6 F) is high
        assertThat(MealCoachPrompt.glucoseBand(List.of(line("110", "48", "12", "21", "6")))).isEqualTo("magas");
        // unknown sugar → the 30% assumption, and the prompt says it was estimated
        assertThat(MealCoachPrompt.glucoseBand(List.of(line("100", null, "18", "0", "0"))))
            .isEqualTo("magas (a cukor becsült)");
    }

    @Test
    void testUserMessage_shouldCarryThePerson_andOnlyTheCheckInsUpToTheMeal() {
        var person = new MealCoachContextReader.PersonContext("M", 34, new BigDecimal("182"),
            new BigDecimal("84.5"), new BigDecimal("18"), "DESK", "cut", List.of("muscle"),
            new MealCoachContextReader.Sleep(DATE, new BigDecimal("5.5"), 4, 3), "Metformin (metformin)",
            List.of(new MealCoachContextReader.CheckIn("05:30", 3, 8, 5, 4),
                    new MealCoachContextReader.CheckIn("20:00", 9, 1, 9, 9)));

        String msg = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Zabkása", 1, BigDecimal.ZERO)), person);

        assertThat(msg).contains("A FELHASZNÁLÓ").contains("férfi").contains("34 év").contains("84.5 kg")
            .contains("ülőmunka").contains("fogyás").contains("muscle")
            .contains("5.5 óra").contains("minőség 4/10").contains("Metformin")
            // the 06:15 meal sees the 05:30 check-in, never the evening one
            .contains("05:30 · energia 3/10 · stressz 8/10").doesNotContain("20:00");
    }

    @Test
    void testUserMessage_shouldSayNincsAdat_forAnUnknownPerson() {
        String msg = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Zabkása", 1, BigDecimal.ZERO)), MealCoachContextReader.PersonContext.empty());

        assertThat(msg).contains("nem nincs adat").contains("legutóbbi alvás: nincs adat")
            .contains("aktív gyógyszer: nincs rögzítve").contains("nincs check-in");
    }
}
