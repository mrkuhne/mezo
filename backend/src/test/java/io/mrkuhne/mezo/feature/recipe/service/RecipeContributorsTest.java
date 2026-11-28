package io.mrkuhne.mezo.feature.recipe.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Contributor;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Pure unit test of the per-ingredient "honnan jön" rows (mezo-r36n9.199). */
class RecipeContributorsTest {

    private static Dimension dim(String id, String weight) {
        return new Dimension(id, id, new BigDecimal(weight), new BigDecimal("0.5"), null, "d",
            null, null, null, null, null, null);
    }

    private static MealBreakdownJson envelope(String whoWeight) {
        return new MealBreakdownJson(new BigDecimal("0.6"), new BigDecimal("0.8"), null, null,
            List.of(dim("macro", "0.25"), dim("micro", "0.1"), dim("who", whoWeight),
                dim("fat_quality", "0.1"), dim("nova", "0.1")),
            List.of(), List.of(), 3);
    }

    private static ScoredLine line(String name, String kcal, Integer nova, String salt) {
        return new ScoredLine(name, "100g", new BigDecimal(kcal), BigDecimal.ONE, BigDecimal.ONE,
            BigDecimal.ONE, nova == null ? null : nova.shortValue(), null, null,
            salt == null ? null : new BigDecimal(salt), null, null, new BigDecimal("100"));
    }

    private static Dimension find(MealBreakdownJson env, String id) {
        return env.dimensions().stream().filter(d -> d.id().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void testAttach_shouldRankTopThreeSaltSources_whenFourLinesCarrySalt() {
        MealBreakdownJson out = RecipeContributors.attach(envelope("0.2"), List.of(
            line("Kenyér", "100", 3, "0.4"), line("Feta", "100", 3, "1.2"),
            line("Sonka", "100", 4, "0.2"), line("Paradicsom", "20", 1, "0.1")));

        List<Contributor> salt = find(out, "who").contributors().stream()
            .filter(c -> c.nutrient().equals("salt")).toList();
        assertThat(salt).extracting(Contributor::name).containsExactly("Feta", "Kenyér", "Sonka");
        assertThat(salt.getFirst().share()).isEqualByComparingTo("0.6316");
        assertThat(salt.getFirst().amount()).isEqualByComparingTo("1.2");
        assertThat(salt.getFirst().unit()).isEqualTo("g");
    }

    @Test
    void testAttach_shouldSkipLinesWithoutFacts_whenSaltIsNull() {
        MealBreakdownJson out = RecipeContributors.attach(envelope("0.2"), List.of(
            line("Túró", "100", 1, null), line("Zab", "100", 1, null)));

        assertThat(find(out, "who").contributors()).isNullOrEmpty();
    }

    @Test
    void testAttach_shouldListOnlyProcessedLines_whenNovaDimensionLive() {
        MealBreakdownJson out = RecipeContributors.attach(envelope("0.2"), List.of(
            line("Alma", "50", 1, null), line("Kenyér", "200", 3, null), line("Kolbász", "300", 4, null)));

        List<Contributor> nova = find(out, "nova").contributors();
        assertThat(nova).extracting(Contributor::name).containsExactly("Kolbász", "Kenyér");
        assertThat(nova).allSatisfy(c -> assertThat(c.nutrient()).isEqualTo("kcal"));
        assertThat(nova.getFirst().share()).isEqualByComparingTo("0.5455"); // 300 / 550 kcal
    }

    @Test
    void testAttach_shouldLeaveDegradedDimensionEmpty_whenWeightZero() {
        MealBreakdownJson out = RecipeContributors.attach(envelope("0"), List.of(
            line("Feta", "100", 3, "1.2")));

        assertThat(find(out, "who").contributors()).isNull();
        assertThat(find(out, "macro").contributors()).isNull();
    }

    @Test
    void testAttach_shouldDropTraceRows_whenAmountRoundsToZero() {
        MealBreakdownJson out = RecipeContributors.attach(envelope("0.2"), List.of(
            line("Tej", "100", 1, "0.12"), line("Zabpehely", "100", 1, "0.03")));

        List<Contributor> salt = find(out, "who").contributors();
        assertThat(salt).extracting(Contributor::name).containsExactly("Tej");
        assertThat(salt).allSatisfy(c -> assertThat(c.amount().signum()).isPositive());
    }

    @Test
    void testAttach_shouldClearStoredRows_whenFreshLinesCarryNone() {
        Contributor stale = new Contributor("Feta", "salt", new BigDecimal("1.2"), "g", BigDecimal.ONE);
        MealBreakdownJson stored = envelope("0.2").withDimensions(envelope("0.2").dimensions().stream()
            .map(d -> d.id().equals("who") ? d.withContributors(List.of(stale)) : d).toList());

        MealBreakdownJson out = RecipeContributors.attach(stored, List.of(line("Túró", "100", 1, null)));

        assertThat(find(out, "who").contributors()).isNull();
    }
}
