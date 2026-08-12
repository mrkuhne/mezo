package io.mrkuhne.mezo.feature.recipe.mapper;

import io.mrkuhne.mezo.api.dto.Nutrients;
import io.mrkuhne.mezo.api.dto.RecipeContribution;
import io.mrkuhne.mezo.api.dto.RecipeIngredientResponse;
import io.mrkuhne.mezo.api.dto.RecipeMacros;
import io.mrkuhne.mezo.api.dto.RecipeMezoFit;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
        e.setRole(fromWireRole(r.getRole()));
    }

    /** Wire (snake_case) -> MealRole. Null/blank means the client omitted it: STANDARD.
     *  The contract pattern rejects anything else before it reaches here. */
    default MealRole fromWireRole(String wire) {
        return wire == null || wire.isBlank()
            ? MealRole.STANDARD
            : MealRole.valueOf(wire.trim().toUpperCase(Locale.ROOT));
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
            .role(e.getRole() == null ? "standard" : e.getRole().name().toLowerCase(Locale.ROOT))
            .createdDate(e.getCreatedAt() == null ? "" : e.getCreatedAt().toString())
            .novaDominant(e.getNovaDominant() == null ? null : e.getNovaDominant().intValue()) // integer since mezo-2dy
            .macros(rollup(lines))
            .nutrients(rollupNutrients(lines))
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
            .nutrients(nutrients(l))
            .build();
    }

    /** Per-line contribution at the line's own stored amount. */
    default RecipeContribution contribution(RecipeIngredientEntity l) {
        return contributionWithAmount(l, l.getAmount());
    }

    /** Per-line nutrition-quality facts at the line's own stored amount. */
    default Nutrients nutrients(RecipeIngredientEntity l) {
        return nutrientsWithAmount(l, l.getAmount());
    }

    /** THE per-line scale factor — {@code amount / snapshotPer}, six decimals. Both the macro
     *  contribution and the nutrient facts go through this, so the arithmetic exists once. */
    default BigDecimal lineFactor(RecipeIngredientEntity l, BigDecimal amount) {
        BigDecimal per = l.getSnapshotPer() == null || l.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : l.getSnapshotPer();
        BigDecimal effective = amount == null ? BigDecimal.ZERO : amount;
        return effective.divide(per, 6, RoundingMode.HALF_UP);
    }

    /** One line's nutrition-quality facts at a given amount. Null in → null out (mezo-m6uv). */
    default Nutrients nutrientsWithAmount(RecipeIngredientEntity l, BigDecimal amount) {
        BigDecimal factor = lineFactor(l, amount);
        return Nutrients.builder()
            .fiberG(scaledGram(l.getSnapshotFiberG(), factor))
            .sugarG(scaledGram(l.getSnapshotSugarG(), factor))
            .saltG(scaledGram(l.getSnapshotSaltG(), factor))
            .saturatedFatG(scaledGram(l.getSnapshotSaturatedFatG(), factor))
            .build();
    }

    /**
     * THE per-line macro formula — {@code factor = amount / snapshotPer}; {@code round(snapshot × factor)}
     * whole-number HALF_UP. Every caller (stored rollup, meal-log override rollup) goes through here so
     * the arithmetic exists exactly once (mezo-8xy single-round rule).
     */
    default RecipeContribution contributionWithAmount(RecipeIngredientEntity l, BigDecimal amount) {
        BigDecimal factor = lineFactor(l, amount);
        return RecipeContribution.builder()
            .kcal(scaled(l.getSnapshotKcal(), factor))
            .p(scaled(l.getSnapshotProteinG(), factor))
            .c(scaled(l.getSnapshotCarbsG(), factor))
            .f(scaled(l.getSnapshotFatG(), factor))
            .build();
    }

    /**
     * Whole-recipe rollup with per-line amount substitutions ({@code lineOrder → amount}, mezo-ormb).
     * An EMPTY map reproduces the stored rollup exactly — that identity is the regression guard for
     * every un-overridden meal.
     */
    default RecipeMacros rollupWithOverrides(RecipeEntity e, Map<Integer, BigDecimal> overrides) {
        BigDecimal kcal = BigDecimal.ZERO, p = BigDecimal.ZERO, c = BigDecimal.ZERO, f = BigDecimal.ZERO;
        for (RecipeIngredientEntity l : e.getLines()) {
            BigDecimal amount = overrides.getOrDefault(l.getLineOrder(), l.getAmount());
            RecipeContribution x = contributionWithAmount(l, amount);
            kcal = kcal.add(x.getKcal());
            p = p.add(x.getP());
            c = c.add(x.getC());
            f = f.add(x.getF());
        }
        return RecipeMacros.builder().kcal(kcal).p(p).c(c).f(f).build();
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

    /** Whole-recipe nutrient rollup with per-line amount substitutions ({@code lineOrder → amount}).
     *  An EMPTY map reproduces the stored rollup exactly — the same regression guard the macros have. */
    default Nutrients rollupNutrientsWithOverrides(RecipeEntity e, Map<Integer, BigDecimal> overrides) {
        BigDecimal fiber = null;
        BigDecimal sugar = null;
        BigDecimal salt = null;
        BigDecimal satFat = null;
        for (RecipeIngredientEntity l : e.getLines()) {
            Nutrients x = nutrientsWithAmount(l, overrides.getOrDefault(l.getLineOrder(), l.getAmount()));
            fiber = addNullable(fiber, x.getFiberG());
            sugar = addNullable(sugar, x.getSugarG());
            salt = addNullable(salt, x.getSaltG());
            satFat = addNullable(satFat, x.getSaturatedFatG());
        }
        return Nutrients.builder().fiberG(fiber).sugarG(sugar).saltG(salt).saturatedFatG(satFat).build();
    }

    /** Whole-recipe nutrient rollup from already-mapped line responses. */
    private Nutrients rollupNutrients(List<RecipeIngredientResponse> lines) {
        BigDecimal fiber = null;
        BigDecimal sugar = null;
        BigDecimal salt = null;
        BigDecimal satFat = null;
        for (RecipeIngredientResponse l : lines) {
            Nutrients x = l.getNutrients();
            fiber = addNullable(fiber, x.getFiberG());
            sugar = addNullable(sugar, x.getSugarG());
            salt = addNullable(salt, x.getSaltG());
            satFat = addNullable(satFat, x.getSaturatedFatG());
        }
        return Nutrients.builder().fiberG(fiber).sugarG(sugar).saltG(salt).saturatedFatG(satFat).build();
    }

    private static BigDecimal scaled(BigDecimal base, BigDecimal factor) {
        BigDecimal v = base == null ? BigDecimal.ZERO : base;
        return v.multiply(factor).setScale(0, RoundingMode.HALF_UP);
    }

    /**
     * Grams at THREE decimals, HALF_UP. The macros' whole-number rule is unusable here: salt is
     * typically 0.4–1.8 g, so rounding to an integer would throw away most of the signal — and one
     * decimal is not enough either, because these values are ROUNDED-THEN-SUMMED per line and then
     * divided by servings, so a per-line 1-decimal quantum compounds (a 20 g line of a 0.4 g/100 g
     * source is truly 0.08 g, which 1 decimal inflates to 0.1 g). Storage and accumulation happen at
     * three decimals; the ONE-decimal rounding is a DISPLAY concern and belongs to the frontend
     * formatter, so the wire carries the precise value. Matches the migrations' `round(…, 3)`
     * backfill. A null base stays null — the rollup must be able to say "no data" (mezo-m6uv).
     */
    private static BigDecimal scaledGram(BigDecimal base, BigDecimal factor) {
        return base == null ? null : base.multiply(factor).setScale(3, RoundingMode.HALF_UP);
    }

    /** Null-preserving Σ: the accumulator stays null until a line actually carries a value, so a
     *  rollup is null only when EVERY line was null. */
    private static BigDecimal addNullable(BigDecimal acc, BigDecimal v) {
        if (v == null) {
            return acc;
        }
        return acc == null ? v : acc.add(v);
    }
}
