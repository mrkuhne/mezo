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

    /** The one EU-14 key the lactose-free rollup is about. */
    private static final String MILK = "milk";

    /**
     * What one ingredient line's catalog row says: its allergen map (null or empty = it says
     * nothing) and whether that product is recognised as lactose-free.
     */
    public record LineFacts(Map<String, AllergenState> allergens, boolean lactoseFree) {
    }

    private RecipeAllergenRollup() {
    }

    /** One allergen map per ingredient line (a catalog row's {@code allergens}). */
    public static Map<String, AllergenState> rollup(Collection<LineFacts> lines) {
        Map<String, AllergenState> rolled = new LinkedHashMap<>();
        for (LineFacts line : lines) {
            if (line == null || line.allergens() == null) {
                continue;
            }
            line.allergens().forEach((key, state) -> rolled.merge(key, state, (a, b) -> b.outranks(a) ? b : a));
        }
        return rolled;
    }

    /**
     * Whether the finished dish is lactose-free (mezo-r36n9.48). A conjunction, never a guess:
     * <ul>
     *   <li>{@code TRUE} — at least one ingredient carries milk and EVERY such ingredient is
     *       recognised as lactose-free. Only then may an intolerance-level milk rule stay quiet.</li>
     *   <li>{@code FALSE} — some milk-bearing ingredient is not recognised as lactose-free. One
     *       unrecognised ingredient is enough: the dish is not known to be lactose-free.</li>
     *   <li>{@code null} — no ingredient carries milk at all, so there is nothing to say.</li>
     * </ul>
     * A line that only says "milk: unknown" is not milk-bearing here — it carries no claim either
     * way, and the allergen rollup above already passes that unknown on to every reader.
     */
    public static Boolean lactoseFree(Collection<LineFacts> lines) {
        boolean anyMilk = false;
        boolean allFree = true;
        for (LineFacts line : lines) {
            if (line == null || line.allergens() == null) {
                continue;
            }
            AllergenState milk = line.allergens().get(MILK);
            if (milk != AllergenState.CONTAINS && milk != AllergenState.TRACES) {
                continue;
            }
            anyMilk = true;
            allFree &= line.lactoseFree();
        }
        return anyMilk ? allFree : null;
    }
}
