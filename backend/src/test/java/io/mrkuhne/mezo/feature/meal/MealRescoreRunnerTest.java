package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Plain-mock unit test (no Spring context — {@link MealRescoreRunner} is trivially
 * constructible): proves the mezo-jcpt.2 fix that a single throwing row is caught and skipped
 * instead of aborting the whole {@code CommandLineRunner} batch (which would otherwise abort
 * application startup — see the finding this test guards against).
 */
@ExtendWith(MockitoExtension.class)
class MealRescoreRunnerTest {

    @Mock private MealRepository mealRepository;
    @Mock private MealService mealService;

    @Test
    void run_shouldSkipARowThatThrowsAndStillHealTheRest() {
        UUID badId = UUID.randomUUID();
        UUID goodId = UUID.randomUUID();
        MealEntity bad = mealEntityWithId(badId);
        MealEntity good = mealEntityWithId(goodId);
        when(mealRepository.findStaleEnvelopes(eq(MealScoringService.FORMULA_VERSION)))
            .thenReturn(List.of(bad, good));
        when(mealService.rescore(badId)).thenThrow(new IllegalStateException("boom"));
        when(mealService.rescore(goodId)).thenReturn(true);

        MealRescoreRunner runner = new MealRescoreRunner(mealRepository, mealService);

        // A dobó sor NEM szivároghat ki a run()-ból — az egy CommandLineRunner-en keresztül az
        // egész alkalmazásindítást megállítaná.
        int healed = runner.run();

        assertThat(healed).isEqualTo(1);
    }

    private MealEntity mealEntityWithId(UUID id) {
        MealEntity entity = new MealEntity();
        entity.setId(id);
        return entity;
    }
}
