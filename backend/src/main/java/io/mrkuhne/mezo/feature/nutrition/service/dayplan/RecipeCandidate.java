package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import java.util.Map;
import java.util.UUID;

/**
 * One of the owner's recipes as the suggester sees it: per-serving macros, its category, whether
 * it is starred, its NOVA level and its allergen rollup. An absent allergen key means "no
 * information" ({@link AllergenState#UNKNOWN}) and is never read as free-of.
 */
public record RecipeCandidate(
        UUID id,
        String name,
        SlotKey category,
        Macros4 perServing,
        boolean starred,
        /** NOVA 1..4, or null when the recipe is unclassified. */
        Integer nova,
        Map<String, AllergenState> allergens,
        /**
         * The lactose-free rollup (mezo-r36n9.48): TRUE when every milk-bearing ingredient is
         * lactose-free, FALSE when one is not, null when no ingredient carries milk.
         */
        Boolean lactoseFree) {
}
