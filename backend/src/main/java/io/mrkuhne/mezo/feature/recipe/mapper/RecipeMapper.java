package io.mrkuhne.mezo.feature.recipe.mapper;

import io.mrkuhne.mezo.api.dto.RecipeContribution;
import io.mrkuhne.mezo.api.dto.RecipeIngredientResponse;
import io.mrkuhne.mezo.api.dto.RecipeMacros;
import io.mrkuhne.mezo.api.dto.RecipeMezoFit;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface RecipeMapper {

    /**
     * Copies the scalar (non-line) request fields onto an existing entity. The service owns
     * line rebuild, snapshot capture, server-side {@code created_by}, and {@code nova_dominant}
     * derivation — this method MUST NOT touch the line collection.
     */
    default void applyScalars(RecipeEntity e, RecipeRequest r) {
        e.setName(r.getName());
        e.setSlot(r.getSlot());
        e.setCategory(r.getCategory()); // plain String (pattern, not enum)
        e.setServings(r.getServings() == null ? 1 : r.getServings());
        e.setPrepMins(r.getPrepMins());
        e.setCookMins(r.getCookMins());
        e.setTags(r.getTags() == null ? List.of() : r.getTags());
        e.setStarred(Boolean.TRUE.equals(r.getStarred()));
    }

    default RecipeResponse toResponse(RecipeEntity e) {
        List<RecipeIngredientResponse> lines = e.getLines() == null ? List.of()
            : e.getLines().stream().map(this::toLineResponse).toList();
        return RecipeResponse.builder()
            .id(e.getId())
            .name(e.getName())
            .slot(e.getSlot())
            .category(e.getCategory())
            .servings(e.getServings())
            .prepMins(e.getPrepMins())
            .cookMins(e.getCookMins())
            .tags(e.getTags() == null ? List.of() : e.getTags())
            .starred(e.isStarred())
            .createdDate(e.getCreatedAt() == null ? "" : e.getCreatedAt().toString())
            .novaDominant(e.getNovaDominant() == null ? null : new BigDecimal(e.getNovaDominant().intValue()))
            .macros(rollup(lines))
            .mezoFit(RecipeMezoFit.builder()
                .score(e.getFitScore())                       // null -> pending sparkle on FE
                .fitsFor(e.getFitsFor() == null ? List.of() : e.getFitsFor())
                .build())
            .timesLogged(0)        // derived from logging — out of scope this slice
            .avgScore(BigDecimal.ZERO)
            .lastLogged("—")
            .ingredients(lines)
            .build();
    }

    default RecipeIngredientResponse toLineResponse(RecipeIngredientEntity l) {
        return RecipeIngredientResponse.builder()
            .pantryItemId(l.getPantryItemId())
            .amount(l.getAmount())
            .unit(l.getUnit())
            .note(l.getNote())
            .lineOrder(l.getLineOrder())
            .name(l.getSnapshotName())
            .contribution(contribution(l))
            .build();
    }

    /** Per-line contribution: factor = amount / snapshotPer; round(snapshot.{…} * factor). */
    default RecipeContribution contribution(RecipeIngredientEntity l) {
        BigDecimal per = l.getSnapshotPer() == null || l.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : l.getSnapshotPer();
        BigDecimal factor = l.getAmount().divide(per, 6, RoundingMode.HALF_UP);
        return RecipeContribution.builder()
            .kcal(scaled(l.getSnapshotKcal(), factor))
            .p(scaled(l.getSnapshotProteinG(), factor))
            .c(scaled(l.getSnapshotCarbsG(), factor))
            .f(scaled(l.getSnapshotFatG(), factor))
            .build();
    }

    /** Whole-recipe macros = Σ line contributions. */
    private RecipeMacros rollup(List<RecipeIngredientResponse> lines) {
        BigDecimal kcal = BigDecimal.ZERO, p = BigDecimal.ZERO, c = BigDecimal.ZERO, f = BigDecimal.ZERO;
        List<RecipeContribution> contribs = new ArrayList<>();
        for (RecipeIngredientResponse l : lines) contribs.add(l.getContribution());
        for (RecipeContribution x : contribs) {
            kcal = kcal.add(x.getKcal());
            p = p.add(x.getP());
            c = c.add(x.getC());
            f = f.add(x.getF());
        }
        return RecipeMacros.builder().kcal(kcal).p(p).c(c).f(f).build();
    }

    private static BigDecimal scaled(BigDecimal base, BigDecimal factor) {
        BigDecimal v = base == null ? BigDecimal.ZERO : base;
        return v.multiply(factor).setScale(0, RoundingMode.HALF_UP);
    }
}
