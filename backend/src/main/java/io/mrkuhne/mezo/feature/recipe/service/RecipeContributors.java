package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Contributor;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * „Honnan jön" (mezo-r36n9.199): the top ingredients behind each nutrient-backed dimension of a
 * recipe template, from the SAME per-serving lines the scorer read ({@code RecipeService.fitLines}).
 * Deterministic and cheap, so it is overlaid on every read (cached, enriched or deterministic
 * envelope alike) and never persisted — a pantry drift can't leave stale rows behind. Never the LLM's.
 */
final class RecipeContributors {

    static final int TOP = 3;

    private RecipeContributors() {
    }

    private record Source(String nutrient, String unit, int scale, Function<ScoredLine, BigDecimal> amount,
                          Predicate<ScoredLine> eligible) {
    }

    private static Source source(String nutrient, Function<ScoredLine, BigDecimal> amount) {
        return new Source(nutrient, "g", 1, amount, l -> true);
    }

    /** The envelope with contributor rows on who / fat_quality / micro / nova; everything else untouched. */
    static MealBreakdownJson attach(MealBreakdownJson env, List<ScoredLine> lines) {
        if (env == null || env.dimensions() == null || lines == null) {
            return env;
        }
        return env.withDimensions(env.dimensions().stream().map(d -> {
            if (d.weight() == null || d.weight().signum() == 0) {
                return d;
            }
            List<Source> sources = switch (d.id()) {
                case "who" -> List.of(source("salt", ScoredLine::saltG), source("sugar", ScoredLine::sugarG));
                case "fat_quality" -> List.of(source("saturated_fat", ScoredLine::saturatedFatG));
                case "micro" -> List.of(source("fiber", ScoredLine::fiberG));
                case "nova" -> List.of(new Source("kcal", "kcal", 0, ScoredLine::kcal,
                    l -> l.nova() != null && l.nova() >= 3));
                default -> List.<Source>of();
            };
            List<Contributor> rows = new ArrayList<>();
            sources.forEach(s -> rows.addAll(top(lines, s)));
            return rows.isEmpty() ? d : d.withContributors(List.copyOf(rows));
        }).toList());
    }

    private static List<Contributor> top(List<ScoredLine> lines, Source s) {
        // share is of the WHOLE recipe's total (nova: all kcal, not only the processed lines)
        BigDecimal total = lines.stream().map(s.amount()).filter(a -> a != null && a.signum() > 0)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.signum() == 0) {
            return List.of();
        }
        return lines.stream()
            .filter(l -> s.eligible().test(l) && s.amount().apply(l) != null && s.amount().apply(l).signum() > 0)
            .sorted(Comparator.comparing((ScoredLine l) -> s.amount().apply(l)).reversed())
            .limit(TOP)
            .map(l -> new Contributor(l.name(), s.nutrient(),
                s.amount().apply(l).setScale(s.scale(), RoundingMode.HALF_UP), s.unit(),
                s.amount().apply(l).divide(total, 4, RoundingMode.HALF_UP)))
            .toList();
    }
}
