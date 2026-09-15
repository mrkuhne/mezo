package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Expands a {@code source='recipe'} meal item into per-ingredient {@link ScoredLine}s (mezo-tm3sb).
 *
 * <p>Why this exists: a recipe-logged meal item is ONE composite row — the recipe's name, its
 * per-serving macro rollup, its single {@code novaDominant} stamp and a {@code "adag"} basis that
 * carries no gram mass. Handing that row to the scorer made every recipe-logged meal read as 100%
 * of one NOVA group, count zero plant categories and degrade energy-density for want of a mass —
 * while the SAME recipe's own template breakdown, built per ingredient by
 * {@code RecipeService.fitLines}, got all three right. This helper is the missing half of that
 * asymmetry, kept as pure static arithmetic over the entities so it is testable without Spring.
 *
 * <p>The arithmetic, mirroring {@code RecipeService.fitLines} with the logged amount folded in:
 * a line's macro factor is {@code effectiveAmount / snapshotPer / servings × loggedAmount}, and the
 * gram factor is {@code gramAmount(effectiveAmount, unit) / servings × loggedAmount} —
 * <b>grams are an ABSOLUTE mass and must NOT carry the {@code amount/per} term</b>, or
 * energy-density's kcal/100g comes out skewed by exactly that factor (the trap
 * {@code RecipeService.fitLines} already documents). The persisted {@code MealItemEntity} is not
 * touched: this is a scoring-input expansion only, so the frozen snapshot stays the single source
 * of the meal's macros.
 */
final class MealCompositeLines {

    private MealCompositeLines() {
    }

    /**
     * One {@link ScoredLine} per ingredient that ACTUALLY went in, scaled to the logged servings.
     *
     * @param recipe the live recipe the item was logged from (its lines carry the frozen snapshots)
     * @param overrides {@code lineOrder → amount} from {@code meal_item.recipe_overrides}; the same
     *     {@code getOrDefault(lineOrder, line.getAmount())} idiom as
     *     {@code RecipeMapper.rollupWithOverrides}, so an EMPTY map reproduces the recipe as written
     * @param loggedAmount the meal item's amount, in servings ("adag")
     * @param pantryById live pantry rows for NOVA + category, batch-read by the caller — a missing
     *     row leaves both null (lowering coverage) rather than dropping what was eaten
     */
    static List<ScoredLine> expandRecipeItem(
            RecipeEntity recipe,
            Map<Integer, BigDecimal> overrides,
            BigDecimal loggedAmount,
            Map<UUID, PantryItemEntity> pantryById) {
        BigDecimal servings = BigDecimal.valueOf(
            recipe.getServings() == null || recipe.getServings() < 1 ? 1 : recipe.getServings());
        BigDecimal logged = loggedAmount == null ? BigDecimal.ONE : loggedAmount;
        // Grams are an ABSOLUTE mass — per-logged-portion = amount ÷ servings × loggedAmount ONLY.
        // Unlike the macros (whose snapshots are per-`per`-basis, needing the amount/per term), the
        // gram amount must NOT carry amount/per, or the energy-density kcal/100g would be off by
        // that factor (cf. RecipeService.fitLines).
        BigDecimal servingScale =
            BigDecimal.ONE.divide(servings, 6, RoundingMode.HALF_UP).multiply(logged);

        List<ScoredLine> lines = new ArrayList<>(recipe.getLines().size());
        for (RecipeIngredientEntity line : recipe.getLines()) {
            BigDecimal amount = overrides.getOrDefault(line.getLineOrder(), line.getAmount());
            if (amount == null || amount.signum() <= 0) {
                continue; // the line was left out — it contributes nothing at all, not a zero row
            }
            BigDecimal per = line.getSnapshotPer() == null || line.getSnapshotPer().signum() == 0
                ? BigDecimal.ONE : line.getSnapshotPer();
            BigDecimal factor = amount
                .divide(per, 6, RoundingMode.HALF_UP)
                .divide(servings, 6, RoundingMode.HALF_UP)
                .multiply(logged);
            PantryItemEntity p = pantryById.get(line.getPantryItemId());
            // NOVA + category stay LIVE pantry reads, exactly as the recipe fit pass does — the
            // frozen facts below ride the macro factor, and a null fact stays null all the way into
            // the scorer so each dimension derives its own coverage from its own fact (mezo-1f7b).
            lines.add(new ScoredLine(
                line.getSnapshotName(),
                amountLabel(amount.multiply(servingScale), line.getUnit()),
                mul(line.getSnapshotKcal(), factor), mul(line.getSnapshotProteinG(), factor),
                mul(line.getSnapshotCarbsG(), factor), mul(line.getSnapshotFatG(), factor),
                p == null ? null : p.getCatalog().getNova(),
                mulOrNull(line.getSnapshotFiberG(), factor),
                mulOrNull(line.getSnapshotSugarG(), factor),
                mulOrNull(line.getSnapshotSaltG(), factor),
                mulOrNull(line.getSnapshotSaturatedFatG(), factor),
                p == null ? null : p.getCatalog().getCategory(),
                mulOrNull(gramAmount(amount, line.getUnit()), servingScale)));
        }
        return lines;
    }

    /**
     * „Zabpehely 35g" — the SCALED amount, because the NOVA item receipt describes THIS meal, not
     * the template it came from. Two decimals then stripped, so a clean half serving prints "35"
     * rather than the scale-6 "35.000000" the division leaves behind.
     */
    private static String amountLabel(BigDecimal scaledAmount, String unit) {
        return scaledAmount.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()
            + (unit == null ? "" : unit);
    }

    private static BigDecimal mul(BigDecimal v, BigDecimal factor) {
        return v == null ? BigDecimal.ZERO : v.multiply(factor);
    }

    private static BigDecimal mulOrNull(BigDecimal v, BigDecimal factor) {
        return v == null ? null : v.multiply(factor);
    }

    /** Line amount in grams for mass units (ml≈g); null for discrete units (db etc.). */
    private static BigDecimal gramAmount(BigDecimal amount, String unit) {
        if (amount == null || unit == null) {
            return null;
        }
        return switch (unit.trim().toLowerCase()) {
            case "g", "ml" -> amount;
            case "kg", "l" -> amount.multiply(BigDecimal.valueOf(1000));
            default -> null;
        };
    }
}
