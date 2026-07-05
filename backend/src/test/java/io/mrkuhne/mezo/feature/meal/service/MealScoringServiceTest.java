package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.meal.config.MealScoringProperties;
import io.mrkuhne.mezo.feature.meal.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.meal.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.meal.service.MealScoringService.ScoredLine;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Pure-math unit test (no Spring): the engine's inputs are already-scaled {@link ScoredLine}
 * carriers + directly-constructed config records (testing_standards.md "pure utility" rule).
 * The amount/per scaling that BUILDS the lines is the callers' job — covered by the meal/recipe ITs.
 */
class MealScoringServiceTest {

    private final NutritionTargetsProperties targets =
        new NutritionTargetsProperties(3100, 220, 380, 95, 4000);

    private final MealScoringProperties props = new MealScoringProperties(
        new MealScoringProperties.Weights(0.30, 0.25, 0.25, 0.20),
        new MealScoringProperties.NovaGroupScores(1.0, 0.85, 0.55, 0.20),
        2.0,
        new MealScoringProperties.MicroRefs(38, 78, 6, 34),
        new MealScoringProperties.SlotShares(0.25, 0.35, 0.30, 0.10),
        new MealScoringProperties.SlotWindows(5, 10, 11, 15, 17, 22),
        0.4);

    private final MealScoringService service = new MealScoringService(props, targets);

    /** Target-proportional lunch, 800 kcal NOVA-1 line + 285 kcal NOVA-4 line, facts on line 1 only. */
    private List<ScoredLine> lunchLines() {
        return List.of(
            new ScoredLine("Zabkása", "300g",
                bd(800), bd(41), bd(70), bd(18), (short) 1,
                bd(10), bd(5), bd(1), bd(3), true),
            new ScoredLine("Whey shake", "1 adag",
                bd(285), bd(14), bd(25), bd(6), (short) 4,
                null, null, null, null, false));
    }

    @Test
    void testScoreMeal_shouldEmitFourWeightedDimensions_whenAllCovered() {
        MealBreakdownJson b = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        assertThat(b.dimensions()).extracting(MealBreakdownJson.Dimension::id)
            .containsExactly("macro", "micro", "nova", "context");
        assertThat(b.dimensions()).extracting(d -> d.weight().doubleValue())
            .containsExactly(0.30, 0.25, 0.25, 0.20);
        // total = Σ w·s / Σ w recomputed from the emitted dimensions (self-consistency)
        double expected = b.dimensions().stream()
            .mapToDouble(d -> d.weight().doubleValue() * d.score().doubleValue()).sum();
        assertThat(b.value().doubleValue()).isCloseTo(expected, within(0.02));
        assertThat(b.value().doubleValue()).isBetween(0.0, 1.0);
        // P8 prose stays honest-empty; tools list the deterministic provenance
        assertThat(b.summary()).isNull();
        assertThat(b.improve()).isEmpty();
        assertThat(b.tools()).isNotEmpty();
    }

    @Test
    void testScoreMeal_shouldScoreMacroNearPerfect_whenSharesMatchTargets() {
        MealBreakdownJson b = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        MealBreakdownJson.Dimension macro = b.dimensions().getFirst();
        // 55p/95c/24f on 1085 kcal ≈ the 220/380/95 target shares → deviation ~0 → score 1.00
        assertThat(macro.score()).isEqualByComparingTo("1.00");
        assertThat(macro.macro().kcalShareOfDay().doubleValue()).isCloseTo(35.0, within(0.5));
        assertThat(macro.macro().notes()).isNull();
    }

    @Test
    void testScoreMeal_shouldEmitKcalWeightedNova_whenLinesCarryNova() {
        MealBreakdownJson b = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        MealBreakdownJson.Dimension nova = b.dimensions().get(2);
        // 0.7373·1.0 + 0.2627·0.20 = 0.79
        assertThat(nova.score()).isEqualByComparingTo("0.79");
        assertThat(nova.nova().dominant()).isEqualTo(1);
        assertThat(nova.nova().stack()).hasSize(4);
        assertThat(nova.nova().stack().getFirst().pct()).isEqualTo(74);
        assertThat(nova.nova().items()).hasSize(2);
        assertThat(nova.nova().items().get(1).warning()).isTrue(); // the NOVA-4 line
    }

    @Test
    void testScoreMeal_shouldBuildMicroRowsFromAllotments_whenFactsPresent() {
        MealBreakdownJson b = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        MealBreakdownJson.Dimension micro = b.dimensions().get(1);
        assertThat(micro.micros()).hasSize(4);
        MealBreakdownJson.MicroRow fiber = micro.micros().getFirst();
        // 10 g fiber vs 38·0.35 = 13.3 g allotment → 75% · ok
        assertThat(fiber.name()).isEqualTo("Rost");
        assertThat(fiber.pct()).isEqualTo(75);
        assertThat(fiber.status()).isEqualTo("ok");
        // sugar 5 g vs 27.3 g allotment → 18% used · good
        MealBreakdownJson.MicroRow sugar = micro.micros().get(1);
        assertThat(sugar.pct()).isEqualTo(18);
        assertThat(sugar.status()).isEqualTo("good");
        // confidence = .30 + .25·(800/1085) + .25·1 + .20 = 0.93
        assertThat(b.confidence()).isEqualByComparingTo("0.93");
    }

    @Test
    void testScoreMeal_shouldRenormalizeTotal_whenNovaCoverageZero() {
        List<ScoredLine> noNova = List.of(
            new ScoredLine("Házi étel", "400g", bd(800), bd(41), bd(70), bd(18), null,
                bd(10), bd(5), bd(1), bd(3), true));

        MealBreakdownJson b = service.scoreMeal("lunch", noNova, LocalTime.of(13, 0));

        MealBreakdownJson.Dimension nova = b.dimensions().get(2);
        assertThat(nova.weight()).isEqualByComparingTo("0");
        assertThat(nova.score()).isEqualByComparingTo("0");
        assertThat(nova.detail()).contains("Nincs");
        // total renormalizes over macro+micro+context only
        double expected = b.dimensions().stream()
            .mapToDouble(d -> d.weight().doubleValue() * d.score().doubleValue()).sum() / 0.75;
        assertThat(b.value().doubleValue()).isCloseTo(expected, within(0.02));
    }

    @Test
    void testScoreMeal_shouldPenalizeTiming_whenLoggedOutsideSlotWindow() {
        MealBreakdownJson inWindow = service.scoreMeal("breakfast", lunchLines(), LocalTime.of(7, 30));
        MealBreakdownJson late = service.scoreMeal("breakfast", lunchLines(), LocalTime.of(14, 0));

        double inScore = inWindow.dimensions().get(3).score().doubleValue();
        double lateScore = late.dimensions().get(3).score().doubleValue();
        assertThat(lateScore).isLessThan(inScore);
        assertThat(late.dimensions().get(3).context()).isNotEmpty();
    }

    @Test
    void testRecipeFit_shouldScoreWithoutContext_andRenormalize() {
        BigDecimal fit = service.recipeFit(lunchLines());

        assertThat(fit).isNotNull();
        assertThat(fit.doubleValue()).isBetween(0.0, 1.0);
        // context excluded: fit reflects macro/micro/nova only — the lunch profile scores high
        assertThat(fit.doubleValue()).isGreaterThan(0.7);
    }

    @Test
    void testRecipeFit_shouldReturnNull_whenNoLineHasKcal() {
        BigDecimal fit = service.recipeFit(List.of(
            new ScoredLine("Fűszer", "5g", bd(0), bd(0), bd(0), bd(0), null,
                null, null, null, null, false)));

        assertThat(fit).isNull(); // honest: nothing to score → pending, never a fabricated number
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v);
    }
}
