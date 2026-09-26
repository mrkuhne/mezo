package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The eager coach trigger (owner, 2026-09-26): a saved meal is narrated right away, and a failure
 * there never escapes — the lazy score-sheet path remains the fallback.
 */
class MealCoachEagerListenerTest {

    private final MealCoachService coach = mock(MealCoachService.class);
    private final MealCoachEagerListener listener = new MealCoachEagerListener(coach);

    @Test
    void onMealSaved_shouldNarrateThatMeal() {
        UUID user = UUID.randomUUID();
        UUID meal = UUID.randomUUID();

        listener.onMealSaved(new MealSavedEvent(user, meal));

        verify(coach).generateForMeal(user, meal);
    }

    @Test
    void onMealSaved_shouldSwallowAFailure_soTheLazyPathCanRetry() {
        UUID user = UUID.randomUUID();
        UUID meal = UUID.randomUUID();
        when(coach.generateForMeal(user, meal)).thenThrow(new IllegalStateException("deleted meanwhile"));

        assertThatCode(() -> listener.onMealSaved(new MealSavedEvent(user, meal))).doesNotThrowAnyException();
    }
}
