package io.mrkuhne.mezo.feature.meal.mapper;

import io.mrkuhne.mezo.api.dto.Macros;
import io.mrkuhne.mezo.api.dto.MealIngredientOverrideResponse;
import io.mrkuhne.mezo.api.dto.MealItemResponse;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.MealScore;
import io.mrkuhne.mezo.api.dto.Nutrients;
import io.mrkuhne.mezo.feature.nutrition.mapper.BreakdownDtoMapper;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemRecipeOverrideJson;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.mapstruct.Mapper;

/**
 * READ-ONLY projection of the meal aggregate to its contract response. Mirrors {@code RecipeMapper}:
 * {@code meal_item} maps 1:1 onto {@code recipe_ingredient} and the per-item {@code contribution}
 * formula (factor = amount / snapshotPer; round HALF_UP whole-number) + the {@code rollup}
 * (Σ contributions) are IDENTICAL.
 *
 * <p>This mapper owns NO writes: it never sets scalars on the entity, rebuilds items, resolves
 * recipe/pantry snapshots, or derives {@code meal_date} — the service owns all of that.
 * {@link #toScore(MealEntity)} projects the persisted score/breakdown 1:1; pre-scoring rows
 * (both NULL, mezo-yta) keep the FE pending sparkle.
 */
@Mapper(componentModel = "spring")
public interface MealMapper {

    default MealResponse toResponse(MealEntity e) {
        List<MealItemResponse> items = e.getItems() == null ? List.of()
            : e.getItems().stream().map(this::toItemResponse).toList();
        return MealResponse.builder()
            .id(e.getId())
            .slot(e.getSlot())
            .loggedAt(toOffset(e.getLoggedAt()))
            .mealDate(e.getMealDate())
            .title(e.getTitle())
            .macros(rollup(items))
            .nutrients(rollupNutrients(items))
            .score(toScore(e))                // real since mezo-yta; NULL rows stay pending on FE
            .items(items)
            .build();
    }

    default MealItemResponse toItemResponse(MealItemEntity i) {
        return MealItemResponse.builder()
            .source(i.getSource())
            .recipeId(i.getRecipeId())
            .pantryItemId(i.getPantryItemId())
            .amount(i.getAmount())
            .unit(i.getUnit())
            .lineOrder(i.getLineOrder())
            .name(i.getSnapshotName())
            .nova(i.getSnapshotNova() == null ? null : i.getSnapshotNova().intValue())
            .contribution(contribution(i))
            .nutrients(nutrients(i))
            .ingredientOverrides(i.getRecipeOverrides() == null ? null
                : i.getRecipeOverrides().stream().map(MealMapper::toOverrideResponse).toList())
            .build();
    }

    /** Per-item nutrition-quality facts: factor = amount / snapshotPer (cf. RecipeMapper's
     *  {@code nutrientsWithAmount}); null in -> null out (mezo-m6uv). */
    default Nutrients nutrients(MealItemEntity i) {
        BigDecimal per = i.getSnapshotPer() == null || i.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : i.getSnapshotPer();
        BigDecimal factor = i.getAmount().divide(per, 6, RoundingMode.HALF_UP);
        return Nutrients.builder()
            .fiberG(scaledGram(i.getSnapshotFiberG(), factor))
            .sugarG(scaledGram(i.getSnapshotSugarG(), factor))
            .saltG(scaledGram(i.getSnapshotSaltG(), factor))
            .saturatedFatG(scaledGram(i.getSnapshotSaturatedFatG(), factor))
            .build();
    }

    /** Meal nutrients = null-preserving Σ of item nutrients (cf. {@link #rollup}). */
    default Nutrients rollupNutrients(List<MealItemResponse> items) {
        BigDecimal fiber = null;
        BigDecimal sugar = null;
        BigDecimal salt = null;
        BigDecimal satFat = null;
        for (MealItemResponse i : items) {
            Nutrients x = i.getNutrients();
            fiber = addNullable(fiber, x.getFiberG());
            sugar = addNullable(sugar, x.getSugarG());
            salt = addNullable(salt, x.getSaltG());
            satFat = addNullable(satFat, x.getSaturatedFatG());
        }
        return Nutrients.builder().fiberG(fiber).sugarG(sugar).saltG(salt).saturatedFatG(satFat).build();
    }

    /** Per-item contribution: factor = amount / snapshotPer (per null/0 -> ONE); round HALF_UP. */
    default Macros contribution(MealItemEntity i) {
        BigDecimal per = i.getSnapshotPer() == null || i.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : i.getSnapshotPer();
        BigDecimal factor = i.getAmount().divide(per, 6, RoundingMode.HALF_UP);
        return Macros.builder()
            .kcal(scaled(i.getSnapshotKcal(), factor))
            .p(scaled(i.getSnapshotProteinG(), factor))
            .c(scaled(i.getSnapshotCarbsG(), factor))
            .f(scaled(i.getSnapshotFatG(), factor))
            .build();
    }

    /** Meal macros = Σ item contributions. */
    default Macros rollup(List<MealItemResponse> items) {
        BigDecimal kcal = BigDecimal.ZERO, p = BigDecimal.ZERO, c = BigDecimal.ZERO, f = BigDecimal.ZERO;
        for (MealItemResponse i : items) {
            Macros x = i.getContribution();
            kcal = kcal.add(x.getKcal());
            p = p.add(x.getP());
            c = c.add(x.getC());
            f = f.add(x.getF());
        }
        return Macros.builder().kcal(kcal).p(p).c(c).f(f).build();
    }

    /**
     * The deterministic score (mezo-yta): the denormalized scalar + the typed jsonb envelope
     * projected onto the contract. Pre-scoring rows (both NULL) keep the FE pending sparkle.
     */
    default MealScore toScore(MealEntity e) {
        return MealScore.builder()
            .value(e.getScore())
            // envelope→DTO projection relocated to the nutrition-owned BreakdownDtoMapper
            // (mezo-bw3y) — shared with the recipe template breakdown, no recipe→meal edge.
            .breakdown(e.getBreakdown() == null ? null : BreakdownDtoMapper.toDto(e.getBreakdown()))
            .build();
    }

    /** Entity {@code Instant} -> contract {@code OffsetDateTime} (UTC). */
    default OffsetDateTime toOffset(java.time.Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    private static BigDecimal scaled(BigDecimal base, BigDecimal factor) {
        BigDecimal v = base == null ? BigDecimal.ZERO : base;
        return v.multiply(factor).setScale(0, RoundingMode.HALF_UP);
    }

    /** Grams at ONE decimal, HALF_UP — the nutrient sibling of {@link #scaled} (cf. RecipeMapper's
     *  {@code scaledGram}). A null base stays null — "no data" is not "0 g" (mezo-m6uv). */
    private static BigDecimal scaledGram(BigDecimal base, BigDecimal factor) {
        return base == null ? null : base.multiply(factor).setScale(1, RoundingMode.HALF_UP);
    }

    /** Null-preserving Σ: the accumulator stays null until a line actually carries a value, so a
     *  rollup is null only when EVERY line was null (cf. RecipeMapper's {@code addNullable}). */
    private static BigDecimal addNullable(BigDecimal acc, BigDecimal v) {
        if (v == null) {
            return acc;
        }
        return acc == null ? v : acc.add(v);
    }

    /** Persisted override envelope → contract response (1:1, already self-describing). */
    private static MealIngredientOverrideResponse toOverrideResponse(MealItemRecipeOverrideJson o) {
        return MealIngredientOverrideResponse.builder()
            .lineOrder(o.lineOrder())
            .pantryItemId(o.pantryItemId())
            .name(o.name())
            .unit(o.unit())
            .originalAmount(o.originalAmount())
            .amount(o.amount())
            .build();
    }
}
