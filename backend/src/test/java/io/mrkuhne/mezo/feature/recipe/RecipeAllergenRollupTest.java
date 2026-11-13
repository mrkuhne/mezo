package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.recipe.service.RecipeAllergenRollup;
import io.mrkuhne.mezo.feature.recipe.service.RecipeAllergenRollup.LineFacts;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RecipeAllergenRollupTest {

    @Test
    void rollupUnionsIngredientStates() {
        Map<String, AllergenState> rolled = RecipeAllergenRollup.rollup(List.of(
            line(Map.of("milk", AllergenState.TRACES, "gluten", AllergenState.UNKNOWN, "eggs", AllergenState.UNKNOWN)),
            line(Map.of("milk", AllergenState.CONTAINS, "gluten", AllergenState.TRACES)),
            line(Map.of("milk", AllergenState.UNKNOWN, "fish", AllergenState.CONTAINS))));

        assertThat(rolled)
            .containsEntry("milk", AllergenState.CONTAINS)
            .containsEntry("gluten", AllergenState.TRACES)
            .containsEntry("eggs", AllergenState.UNKNOWN)
            .containsEntry("fish", AllergenState.CONTAINS);
    }

    @Test
    void unknownPropagatesUpward() {
        Map<String, AllergenState> rolled = RecipeAllergenRollup.rollup(List.of(
            line(Map.of("milk", AllergenState.CONTAINS)),
            line(Map.of("sesame", AllergenState.UNKNOWN))));

        assertThat(rolled).containsEntry("sesame", AllergenState.UNKNOWN);
    }

    @Test
    void noIngredientsRollsUpToEmpty() {
        assertThat(RecipeAllergenRollup.rollup(List.of())).isEmpty();
    }

    // --- lactose-free rollup (mezo-r36n9.48) ------------------------------------------------

    @Test
    void lactoseFreeOnlyWhenEveryMilkBearingLineIsLactoseFree() {
        assertThat(RecipeAllergenRollup.lactoseFree(List.of(
            new LineFacts(Map.of("milk", AllergenState.CONTAINS), true),
            new LineFacts(Map.of("eggs", AllergenState.CONTAINS), false)))).isTrue();
    }

    @Test
    void oneUnrecognisedMilkLineMakesTheDishNotLactoseFree() {
        assertThat(RecipeAllergenRollup.lactoseFree(List.of(
            new LineFacts(Map.of("milk", AllergenState.CONTAINS), true),
            new LineFacts(Map.of("milk", AllergenState.CONTAINS), false)))).isFalse();
    }

    @Test
    void tracesOfMilkCountAsMilkBearing() {
        assertThat(RecipeAllergenRollup.lactoseFree(List.of(
            new LineFacts(Map.of("milk", AllergenState.TRACES), false)))).isFalse();
    }

    @Test
    void noMilkAtAllSaysNothingAboutLactose() {
        assertThat(RecipeAllergenRollup.lactoseFree(List.of(
            new LineFacts(Map.of("fish", AllergenState.CONTAINS), false),
            new LineFacts(Map.of("milk", AllergenState.UNKNOWN), false)))).isNull();
        assertThat(RecipeAllergenRollup.lactoseFree(List.of())).isNull();
    }

    private static LineFacts line(Map<String, AllergenState> allergens) {
        return new LineFacts(allergens, false);
    }
}
