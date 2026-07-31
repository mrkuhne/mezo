package io.mrkuhne.mezo.feature.meal.entity;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One overridden recipe ingredient inside {@code meal_item.recipe_overrides} (jsonb) — ADR 0006
 * typed-envelope idiom, mirroring {@link MealProvenanceJson}.
 *
 * <p>Keyed by {@code lineOrder}; {@code pantryItemId} is a CONSISTENCY CHECK, not the key:
 * {@code recipe_ingredient} has no unique {@code (recipe_id, pantry_item_id)} — a recipe may list
 * the same pantry item twice — so {@code pantryItemId} alone is ambiguous, while {@code lineOrder}
 * alone would silently land on the wrong ingredient after a reorder.
 *
 * <p>{@code name}, {@code unit} and {@code originalAmount} are denormalised on purpose: they make
 * the row self-describing, so "Banán 1 db → 0,5 db" renders even after the recipe drops that line.
 * {@code amount} may be {@code 0} — the line was left out.
 */
public record MealItemRecipeOverrideJson(Integer lineOrder, UUID pantryItemId, String name,
                                         String unit, BigDecimal originalAmount, BigDecimal amount) {
}
