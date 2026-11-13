package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.recipe.service.RecipeAllergenRollup;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RecipeAllergenRollupTest {

    @Test
    void rollupUnionsIngredientStates() {
        Map<String, AllergenState> rolled = RecipeAllergenRollup.rollup(List.of(
            Map.of("milk", AllergenState.TRACES, "gluten", AllergenState.UNKNOWN, "eggs", AllergenState.UNKNOWN),
            Map.of("milk", AllergenState.CONTAINS, "gluten", AllergenState.TRACES),
            Map.of("milk", AllergenState.UNKNOWN, "fish", AllergenState.CONTAINS)));

        assertThat(rolled)
            .containsEntry("milk", AllergenState.CONTAINS)
            .containsEntry("gluten", AllergenState.TRACES)
            .containsEntry("eggs", AllergenState.UNKNOWN)
            .containsEntry("fish", AllergenState.CONTAINS);
    }

    @Test
    void unknownPropagatesUpward() {
        Map<String, AllergenState> rolled = RecipeAllergenRollup.rollup(List.of(
            Map.of("milk", AllergenState.CONTAINS),
            Map.of("sesame", AllergenState.UNKNOWN)));

        assertThat(rolled).containsEntry("sesame", AllergenState.UNKNOWN);
    }

    @Test
    void noIngredientsRollsUpToEmpty() {
        assertThat(RecipeAllergenRollup.rollup(List.of())).isEmpty();
    }
}
