package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The baseline allergen a whole food's own shelf (and, where the shelf mixes things, its name)
 * states with certainty — owner decision 2026-11-13 (mezo-r36n9.48), option 1 "kitöltjük, amit
 * biztosan tudunk".
 *
 * <p><b>Why this exists.</b> {@code pantry_catalog.allergens} was empty on all 448 live rows, so
 * {@link io.mrkuhne.mezo.feature.recipe.service.RecipeAllergenRollup} rolled a cod or egg recipe up
 * to no allergens at all. The code was right — {@code UNKNOWN} is never read as free-of — but the
 * data said nothing rather than "unknown", and nothing rolls up to nothing. This class is the
 * missing voice of the data.
 *
 * <p><b>What it will and will not claim.</b> It only ever writes {@link AllergenState#CONTAINS},
 * and only for a key the row's category or name settles beyond doubt. It never writes "free of"
 * anything: every key it does not name stays absent, which every reader treats as unknown. So a
 * derived row is strictly more informative than the empty map it replaces and can never make the
 * app claim a food is safe.
 *
 * <p><b>The two shelves that mix things</b> (the trap this class exists to avoid):
 * <ul>
 *   <li>{@code dairy} also holds the plant drinks — almond, soy and coconut. Deriving "milk" from
 *       the shelf alone would mark almond milk as a milk product and miss that it is a nut
 *       product. Those are matched by name first and get their own allergen (coconut is not an
 *       EU-14 allergen, so coconut milk derives nothing at all).</li>
 *   <li>{@code nuts_seeds} holds three different EU-14 keys: peanut butter is {@code peanuts},
 *       sesame is {@code sesame}, and only the tree nuts are {@code nuts}. Seed mixes and chia
 *       match nothing and stay unknown — "mag" on a label does not say which.</li>
 * </ul>
 *
 * <p><b>Lactose-free.</b> A lactose-free dairy product still contains the EU-14 allergen "milk"
 * (that key is milk protein, not lactose), so it is derived like any other dairy row. What the
 * owner needs is that his own lactose-free products do not warn him: {@link #isLactoseFree(String)}
 * recognises them from the name ("Laktózmentes …", the "LM" shorthand), and
 * {@link io.mrkuhne.mezo.feature.nutrition.service.SensitivityService} uses that to hold back an
 * intolerance-level milk warning. Reading the flag off a scanned product's own label is the
 * remaining half of that story (mezo-6ebdi).
 */
public final class CatalogAllergenDefaults {

    /** EU-14 keys this class may derive. */
    private static final String MILK = "milk";
    private static final String EGGS = "eggs";
    private static final String FISH = "fish";
    private static final String NUTS = "nuts";
    private static final String PEANUTS = "peanuts";
    private static final String SESAME = "sesame";
    private static final String SOYBEANS = "soybeans";

    /** No EU-14 key applies, but the name is settled — stop looking, do not fall through. */
    private static final String NONE = "";

    /** First match wins, so the narrower name goes above the wider one. */
    private record NameRule(Pattern pattern, String key) {
        static NameRule of(String key, String... alternatives) {
            return new NameRule(
                Pattern.compile(String.join("|", alternatives), Pattern.CASE_INSENSITIVE), key);
        }
    }

    /**
     * The plant drinks sitting on the {@code dairy} shelf. Checked before the milk default, so a
     * soy drink is a soy product and never a milk one.
     */
    private static final List<NameRule> PLANT_DRINKS = List.of(
        NameRule.of(NUTS, "mandulaital", "mandula ital", "almond milk", "almond drink"),
        NameRule.of(SOYBEANS, "szojaital", "szójaital", "szoja ital", "szója ital", "soy milk",
            "soy drink", "soya"),
        // Coconut is not one of the EU-14 allergens: the row is settled and derives nothing.
        NameRule.of(NONE, "kokusztej", "kókusztej", "kokuszital", "kókuszital", "coconut milk",
            "coconut drink"));

    /**
     * The {@code nuts_seeds} shelf, narrowest first: peanut before nut (Hungarian "mogyoróvaj" is
     * peanut butter), and the cashew rule before any bare "dió" so "kesudió" cannot be read as a
     * walnut. Anything unmatched — seed mixes, chia, poppy — stays unknown on purpose.
     */
    private static final List<NameRule> NUTS_AND_SEEDS = List.of(
        NameRule.of(PEANUTS, "mogyorovaj", "mogyoróvaj", "mogyoro vaj", "mogyoró vaj", "peanut",
            "foldimogyoro", "földimogyoró", "mogyoropor", "mogyoró por", "mogyoro por"),
        NameRule.of(SESAME, "szezam", "szezám", "sesame", "tahini"),
        NameRule.of(NUTS, "kesu", "cashew", "pekan", "pekán", "pecan", "mandula", "almond",
            "pisztacia", "pisztácia", "pistachio", "walnut", "makadam", "makadám", "macadamia",
            "hazelnut", "\\bdio\\b", "\\bdió\\b", "pisztáciá"));

    /** "Laktózmentes …", and the shorthand "LM" the owner's own Lidl rows carry. */
    private static final Pattern LACTOSE_FREE = Pattern.compile(
        "laktozmentes|laktózmentes|lactose[ -]?free|no[ -]lactose|\\blm\\b", Pattern.CASE_INSENSITIVE);

    private CatalogAllergenDefaults() {
    }

    /**
     * What this row's shelf and name state with certainty, as an allergen map to store, or an empty
     * map when nothing is certain. Never asserts the absence of anything.
     *
     * @param category one of {@code pantry_catalog.category}, or null
     * @param name     the row's name, or null
     */
    public static Map<String, AllergenState> derive(String category, String name) {
        String key = deriveKey(category, name);
        if (key == null || NONE.equals(key)) {
            return Map.of();
        }
        Map<String, AllergenState> out = new LinkedHashMap<>();
        out.put(key, AllergenState.CONTAINS);
        return out;
    }

    private static String deriveKey(String category, String name) {
        if (category == null) {
            return null;
        }
        String safeName = name == null ? "" : name;
        return switch (category.toLowerCase(Locale.ROOT)) {
            case "fish" -> FISH;
            case "eggs" -> EGGS;
            // The plant drinks are the exception on this shelf; everything else on it is milk.
            case "dairy", "cheese" -> firstMatch(PLANT_DRINKS, safeName, MILK);
            case "nuts_seeds" -> firstMatch(NUTS_AND_SEEDS, safeName, null);
            default -> null;
        };
    }

    private static String firstMatch(List<NameRule> rules, String name, String fallback) {
        for (NameRule rule : rules) {
            if (rule.pattern().matcher(name).find()) {
                return rule.key();
            }
        }
        return fallback;
    }

    /**
     * Whether the name marks the product as lactose-free. Only a positive marking counts: false
     * means "not recognised as lactose-free", never "contains lactose".
     */
    public static boolean isLactoseFree(String name) {
        return name != null && LACTOSE_FREE.matcher(name).find();
    }
}
