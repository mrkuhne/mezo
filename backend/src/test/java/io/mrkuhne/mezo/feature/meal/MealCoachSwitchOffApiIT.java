package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealCoachResponse;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The meal-coach switch OFF state (configuration_conventions.md: both switch states tested).
 * Unlike the ai-draft switch — whose whole endpoint disappears — the coach endpoints stay MAPPED
 * and answer 200 with an empty verdict list: the contract models "no verdict" as a normal state
 * (the deterministic score is the feature's core and is served regardless), so the frontend needs
 * no special case and nothing is ever written to the envelope.
 */
@TestPropertySource(properties = "mezo.feature.meal-coach.enabled=false")
class MealCoachSwitchOffApiIT extends ApiIntegrationTest {

    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    private MealEntity scoredMeal() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Zabpehely",
            LocalDate.now().plusMonths(6));
        return mealPopulator.createScoredMeal(owner, item, LocalDate.now(), "Zabkása", Instant.now());
    }

    @Test
    void testGetMealCoachForDay_shouldReturnEmptyVerdicts_whenFeatureSwitchOff() {
        MealEntity meal = scoredMeal();

        MealCoachResponse res = getForBody("/api/meal/coach?date=" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, MealCoachResponse.class);

        assertThat(res.getVerdicts()).isEmpty();
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isNull();
    }

    @Test
    void testGetMealCoach_shouldReturnEmptyVerdicts_whenFeatureSwitchOff() {
        MealEntity meal = scoredMeal();

        MealCoachResponse res = getForBody("/api/meal/" + meal.getId() + "/coach",
            ownerAuthHeaders(), HttpStatus.OK, MealCoachResponse.class);

        assertThat(res.getVerdicts()).isEmpty();
        // the deterministic score is untouched — only the prose layer is off
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().value()).isNotNull();
    }
}
