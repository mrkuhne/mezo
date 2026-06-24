package io.mrkuhne.mezo.feature.meal.mapper;

import io.mrkuhne.mezo.api.dto.Macros;
import io.mrkuhne.mezo.api.dto.MealItemResponse;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.MealScore;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
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
 * recipe/pantry snapshots, or derives {@code meal_date} — the service owns all of that. The
 * {@code meal.breakdown} score is NULL in v1, so {@link #toScore()} always emits the pending
 * {@code MealScore{value:null, breakdown:null}} (FE renders the pending sparkle).
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
            .score(toScore())                 // value+breakdown NULL -> pending sparkle on FE
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
            .build();
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

    /** Pending score envelope — Phase-3 fills value+breakdown; NULL in v1. */
    default MealScore toScore() {
        return MealScore.builder().value(null).breakdown(null).build();
    }

    /** Entity {@code Instant} -> contract {@code OffsetDateTime} (UTC). */
    default OffsetDateTime toOffset(java.time.Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    private static BigDecimal scaled(BigDecimal base, BigDecimal factor) {
        BigDecimal v = base == null ? BigDecimal.ZERO : base;
        return v.multiply(factor).setScale(0, RoundingMode.HALF_UP);
    }
}
