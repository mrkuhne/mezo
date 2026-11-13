package io.mrkuhne.mezo.feature.nutrition.dayplan;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.nutrition.service.NovaRule;
import io.mrkuhne.mezo.feature.nutrition.service.Sensitivity;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityLevel;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.RecipeCandidate;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Suggestion;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SuggestionPicker;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Recipe fit ported from {@code buildDayPlan.ts} ({@code pickRecipe} :324) plus the B4 sensitivity
 * filter (spec §7.1) and owner decision 16's ingredient fallback.
 */
class SuggestionPickerTest {

    private static final Macros4 BUDGET = new Macros4(600, 40, 60, 20);
    private static final SensitivityProfile NO_RULES =
        new SensitivityProfile(List.of(), new NovaRule(false, 2));

    private static RecipeCandidate recipe(String name, int kcal, int protein, Integer nova,
            Map<String, AllergenState> allergens) {
        return new RecipeCandidate(UUID.nameUUIDFromBytes(name.getBytes()), name, SlotKey.BREAKFAST,
            new Macros4(kcal, protein, 60, 20), false, nova, allergens);
    }

    /** Category match + per-serving kcal within ±20% of the window budget; nearest kcal wins. */
    @Test
    void picksARecipeThatPassesTheRules() {
        List<RecipeCandidate> recipes = List.of(
            recipe("Túrós tál", 700, 45, 1, Map.of()),
            recipe("Zabkása", 610, 30, 1, Map.of()),
            recipe("Reggeli bomba", 1200, 60, 1, Map.of())); // outside the ±20% tolerance

        Suggestion s = SuggestionPicker.pick(SlotKey.BREAKFAST, BUDGET, recipes, NO_RULES);

        assertThat(s.kind()).isEqualTo(Suggestion.Kind.RECIPE);
        assertThat(s.text()).contains("Zabkása");
        assertThat(s.recipeId()).isEqualTo(recipes.get(1).id());
    }

    /** An allergy blocks on contains, on traces AND on "no information" — never suggested. */
    @Test
    void skipsRecipesBlockedBySensitivity() {
        SensitivityProfile allergic = new SensitivityProfile(
            List.of(new Sensitivity("milk", SensitivityLevel.ALLERGY, null)), new NovaRule(false, 2));
        List<RecipeCandidate> recipes = List.of(
            recipe("Tejbegríz", 605, 20, 1, Map.of("milk", AllergenState.CONTAINS)),
            recipe("Mandulás müzli", 590, 18, 1, Map.of("milk", AllergenState.TRACES)),
            recipe("Rántotta", 640, 35, 1, Map.of("milk", AllergenState.UNKNOWN)),
            recipe("Gyümölcstál", 660, 10, 1, Map.of("milk", AllergenState.UNKNOWN, "eggs", AllergenState.CONTAINS)));

        Suggestion s = SuggestionPicker.pick(SlotKey.BREAKFAST, BUDGET, recipes, allergic);

        assertThat(s.kind()).isEqualTo(Suggestion.Kind.INGREDIENTS); // every candidate is blocked
        assertThat(s.text()).doesNotContain("Tejbegríz").doesNotContain("Rántotta");
    }

    /**
     * Owner decision 16 — the library is small, so a window whose rules nothing passes shows an
     * ingredient-level tip instead of an empty row. Review Focus 4 of the plan.
     */
    @Test
    void fallsBackToIngredientTipWhenNoRecipePasses() {
        Suggestion s = SuggestionPicker.pick(SlotKey.LUNCH, new Macros4(620, 45, 60, 20), List.of(), NO_RULES);

        assertThat(s).isNotNull();
        assertThat(s.kind()).isEqualTo(Suggestion.Kind.INGREDIENTS);
        assertThat(s.recipeId()).isNull();
        assertThat(s.text()).isNotBlank();
        assertThat(s.text()).contains("csirkemell").contains("rizs").contains("g ");
        assertThat(s.reason()).isNotBlank();
    }

    /** The NOVA rule behaves like "kerülöm": nothing above the owner's max level is ever offered. */
    @Test
    void neverSuggestsNovaThreeOrFour() {
        SensitivityProfile novaOn = new SensitivityProfile(List.of(), NovaRule.defaults()); // maxLevel 2
        List<RecipeCandidate> recipes = List.of(
            recipe("Fehérjeszelet", 605, 30, 4, Map.of()),
            recipe("Instant kása", 598, 12, 3, Map.of()),
            recipe("Rántotta", 660, 35, 2, Map.of()));

        Suggestion s = SuggestionPicker.pick(SlotKey.BREAKFAST, BUDGET, recipes, novaOn);

        assertThat(s.kind()).isEqualTo(Suggestion.Kind.RECIPE);
        assertThat(s.text()).contains("Rántotta");
    }

    /** An unclassified recipe (no NOVA level) is not silently treated as processed. */
    @Test
    void suggestsAnUnclassifiedRecipeWhenTheNovaRuleIsOn() {
        List<RecipeCandidate> recipes = List.of(recipe("Házi müzli", 605, 20, null, Map.of()));

        Suggestion s = SuggestionPicker.pick(SlotKey.BREAKFAST, BUDGET, recipes,
            new SensitivityProfile(List.of(), NovaRule.defaults()));

        assertThat(s.kind()).isEqualTo(Suggestion.Kind.RECIPE);
        assertThat(s.text()).contains("Házi müzli");
    }
}
