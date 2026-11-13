package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The recipe's derived allergen state (spec §7.1): per key, the strongest state any ingredient
 * declares — CONTAINS beats TRACES beats UNKNOWN. A key one line marks UNKNOWN survives into the
 * rollup even when the other lines say nothing about it, so unknown propagates upward instead of
 * being read as free-of. A key no line mentions is simply absent (also unknown to every reader).
 */
public final class RecipeAllergenRollup {

    private RecipeAllergenRollup() {
    }

    /** One allergen map per ingredient line (a catalog row's {@code allergens}). */
    public static Map<String, AllergenState> rollup(Collection<Map<String, AllergenState>> lineAllergens) {
        Map<String, AllergenState> rolled = new LinkedHashMap<>();
        for (Map<String, AllergenState> line : lineAllergens) {
            if (line == null) {
                continue;
            }
            line.forEach((key, state) -> rolled.merge(key, state, (a, b) -> b.outranks(a) ? b : a));
        }
        return rolled;
    }
}
