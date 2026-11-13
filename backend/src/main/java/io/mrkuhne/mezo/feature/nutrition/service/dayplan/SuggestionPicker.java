package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityService;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Chooses what Boop offers for one open window — the server-side port of {@code pickRecipe}
 * ({@code frontend/src/features/fuel/logic/buildDayPlan.ts} :324) with the B4 sensitivity filter
 * in front of it (spec §7.1) and owner decision 16's ingredient fallback behind it.
 *
 * <p><b>Order.</b> (1) the window's own category, (2) per-serving kcal within
 * {@value #FIT_TOLERANCE_PCT}% of the window's budget, (3) nothing the profile blocks — an allergy
 * blocks on {@code contains}, on {@code traces} AND on "no information", the NOVA rule blocks
 * anything above the owner's maximum level. What survives is ranked by |Δkcal|, then starred, then
 * |Δprotein|.
 *
 * <p><b>Never an empty row (decision 16).</b> The owner has about a dozen recipes, so a window
 * nothing passes is normal, not exceptional. It then gets an ingredient-level tip built from the
 * window's own budget — and if even the staples are ruled out, the plain macro room. This method
 * never returns {@code null}.
 */
public final class SuggestionPicker {

    /** Per-serving kcal may miss the window budget by this much and still fit. */
    static final int FIT_TOLERANCE_PCT = 20;

    /** Grams of protein per 100 g of the fallback protein staple. */
    private static final double PROTEIN_STAPLE_P_PER_100G = 31;
    /** Grams of carbohydrate per 100 g of the fallback carbohydrate staple (cooked). */
    private static final double CARB_STAPLE_C_PER_100G = 28;
    private static final String PROTEIN_STAPLE = "csirkemell";
    private static final String CARB_STAPLE = "rizs";
    private static final int STAPLE_ROUNDING_G = 10;
    /** Below this a free-text key matches a staple only as a whole word, never as a fragment. */
    private static final int MIN_NAME_MATCH_LEN = 3;

    private SuggestionPicker() {
    }

    public static Suggestion pick(
            SlotKey category, Macros4 budget, List<RecipeCandidate> recipes, SensitivityProfile profile) {
        double tolerance = FIT_TOLERANCE_PCT / 100.0 * budget.kcal();
        RecipeCandidate best = recipes.stream()
            .filter(r -> r.category() == category)
            .filter(r -> Math.abs(r.perServing().kcal() - budget.kcal()) <= tolerance)
            .filter(r -> !SensitivityService.verdict(profile, r.allergens(), r.nova()).blocksSuggestion())
            .min(Comparator
                .comparingInt((RecipeCandidate r) -> Math.abs(r.perServing().kcal() - budget.kcal()))
                .thenComparing(r -> r.starred() ? 0 : 1)
                .thenComparingInt(r -> Math.abs(r.perServing().p() - budget.p())))
            .orElse(null);
        if (best != null) {
            return new Suggestion(Suggestion.Kind.RECIPE, best.id(),
                best.name() + " — " + best.perServing().kcal() + " kcal, " + best.perServing().p() + " g fehérje.",
                "beleillik az ablak keretébe, és megfelel a szabályaidnak");
        }
        return ingredientTip(budget, profile);
    }

    /**
     * Decision 16's fallback: the window's budget said in everyday staples. A staple whose name
     * the owner listed as a sensitivity is left out; with both gone the tip states the macro room
     * alone, which is still an offer and still true.
     */
    private static Suggestion ingredientTip(Macros4 budget, SensitivityProfile profile) {
        String reason = "nincs olyan recepted, ami ide beleférne — ez viszont igen";
        boolean protein = allowed(PROTEIN_STAPLE, profile) && budget.p() > 0;
        boolean carbs = allowed(CARB_STAPLE, profile) && budget.c() > 0;
        if (protein && carbs) {
            return new Suggestion(Suggestion.Kind.INGREDIENTS, null,
                "Kb. " + grams(budget.p(), PROTEIN_STAPLE_P_PER_100G) + " g " + PROTEIN_STAPLE + " és "
                    + grams(budget.c(), CARB_STAPLE_C_PER_100G) + " g " + CARB_STAPLE + " belefér.", reason);
        }
        if (protein) {
            return new Suggestion(Suggestion.Kind.INGREDIENTS, null,
                "Kb. " + grams(budget.p(), PROTEIN_STAPLE_P_PER_100G) + " g " + PROTEIN_STAPLE + " belefér.", reason);
        }
        if (carbs) {
            return new Suggestion(Suggestion.Kind.INGREDIENTS, null,
                "Kb. " + grams(budget.c(), CARB_STAPLE_C_PER_100G) + " g " + CARB_STAPLE + " belefér.", reason);
        }
        return new Suggestion(Suggestion.Kind.INGREDIENTS, null,
            "Kb. " + budget.kcal() + " kcal és " + budget.p() + " g fehérje fér bele ebbe az ablakba.", reason);
    }

    /**
     * A free-text sensitivity naming the staple rules it out ("csirke" rules out "csirkemell", and
     * so does "csirkemell-filé"). The staples carry no EU-14 allergen of their own, so the
     * structured keys cannot touch them. A key shorter than {@value #MIN_NAME_MATCH_LEN}
     * characters only matches whole, never as a fragment — "s" must not rule out "rizs".
     */
    private static boolean allowed(String staple, SensitivityProfile profile) {
        return profile.items().stream()
            .map(s -> s.key() == null ? "" : s.key().strip().toLowerCase(Locale.ROOT))
            .filter(key -> !key.isEmpty())
            .noneMatch(key -> key.equals(staple)
                || (key.length() >= MIN_NAME_MATCH_LEN && (key.contains(staple) || staple.contains(key))));
    }

    private static int grams(int macroGrams, double per100g) {
        int raw = (int) Math.round(macroGrams / per100g * 100);
        return Math.max(STAPLE_ROUNDING_G, Math.round((float) raw / STAPLE_ROUNDING_G) * STAPLE_ROUNDING_G);
    }
}
