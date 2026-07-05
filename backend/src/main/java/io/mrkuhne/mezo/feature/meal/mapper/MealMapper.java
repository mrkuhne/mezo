package io.mrkuhne.mezo.feature.meal.mapper;

import io.mrkuhne.mezo.api.dto.Macros;
import io.mrkuhne.mezo.api.dto.MealBreakdown;
import io.mrkuhne.mezo.api.dto.MealContextRow;
import io.mrkuhne.mezo.api.dto.MealImproveRow;
import io.mrkuhne.mezo.api.dto.MealItemResponse;
import io.mrkuhne.mezo.api.dto.MealMacroDetail;
import io.mrkuhne.mezo.api.dto.MealMicroRow;
import io.mrkuhne.mezo.api.dto.MealNovaDetail;
import io.mrkuhne.mezo.api.dto.MealNovaItemRow;
import io.mrkuhne.mezo.api.dto.MealNovaStackRow;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.MealScore;
import io.mrkuhne.mezo.api.dto.MealScoreDimension;
import io.mrkuhne.mezo.api.dto.MealToolRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
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

    /**
     * The deterministic score (mezo-yta): the denormalized scalar + the typed jsonb envelope
     * projected onto the contract. Pre-scoring rows (both NULL) keep the FE pending sparkle.
     */
    default MealScore toScore(MealEntity e) {
        return MealScore.builder()
            .value(e.getScore())
            .breakdown(e.getBreakdown() == null ? null : toBreakdown(e.getBreakdown()))
            .build();
    }

    /** Entity jsonb envelope -> contract DTO, 1:1 (the FE injects presentation-only colors). */
    default MealBreakdown toBreakdown(MealBreakdownJson b) {
        return MealBreakdown.builder()
            .value(b.value())
            .confidence(b.confidence())
            .summary(b.summary())
            .dimensions(b.dimensions() == null ? List.of()
                : b.dimensions().stream().map(this::toDimension).toList())
            .improve(b.improve() == null ? List.of()
                : b.improve().stream()
                    .map(i -> MealImproveRow.builder().text(i.text()).impact(i.impact()).build())
                    .toList())
            .tools(b.tools() == null ? List.of()
                : b.tools().stream()
                    .map(t -> MealToolRow.builder().type(t.type()).name(t.name()).build())
                    .toList())
            .build();
    }

    default MealScoreDimension toDimension(MealBreakdownJson.Dimension d) {
        return MealScoreDimension.builder()
            .id(d.id())
            .label(d.label())
            .weight(d.weight())
            .score(d.score())
            .detail(d.detail())
            .macro(d.macro() == null ? null : MealMacroDetail.builder()
                .ratioP(d.macro().ratioP()).ratioC(d.macro().ratioC()).ratioF(d.macro().ratioF())
                .targetP(d.macro().targetP()).targetC(d.macro().targetC()).targetF(d.macro().targetF())
                .kcalShareOfDay(d.macro().kcalShareOfDay())
                .notes(d.macro().notes())
                .build())
            .micros(d.micros() == null ? null : d.micros().stream()
                .map(m -> MealMicroRow.builder()
                    .name(m.name()).value(m.value()).pct(m.pct()).status(m.status()).build())
                .toList())
            .nova(d.nova() == null ? null : MealNovaDetail.builder()
                .dominant(d.nova().dominant())
                .stack(d.nova().stack().stream()
                    .map(s -> MealNovaStackRow.builder()
                        .nova(s.nova()).pct(s.pct()).label(s.label()).build())
                    .toList())
                .items(d.nova().items().stream()
                    .map(i -> MealNovaItemRow.builder()
                        .name(i.name()).nova(i.nova()).warning(i.warning()).build())
                    .toList())
                .build())
            .context(d.context() == null ? null : d.context().stream()
                .map(c -> MealContextRow.builder().label(c.label()).value(c.value()).build())
                .toList())
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
}
