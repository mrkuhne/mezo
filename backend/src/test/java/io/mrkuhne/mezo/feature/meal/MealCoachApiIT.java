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
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Coach endpoints e2e (mezo-mr4n) against the deterministic {@code FakeCompanionLlm}: the
 * {@code [fake-meal-coach:{json}]} sentinel in a meal title is echoed back as the answer, so the
 * day-batch/single-meal split and the today-only generation rule are assertable over real HTTP.
 */
@ActiveProfiles("companion-fake")
class MealCoachApiIT extends ApiIntegrationTest {

    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private static String canned(UUID mealId) {
        return """
            {"meals":[{"mealId":"%s","tagline":"Remek pre-workout üzemanyag",\
            "summary":"Gyors szénhidrát a Pull nap előtt — pont jó itt.","improve":[]}]}"""
            .formatted(mealId);
    }

    private MealEntity scriptedMeal(UUID owner, LocalDate date) {
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Zabpehely",
            LocalDate.now().plusMonths(6));
        MealEntity meal = mealPopulator.createScoredMeal(owner, item, date, "Zabkása",
            date.atTime(6, 15).toInstant(ZoneOffset.UTC));
        meal.setTitle("Zabkása [fake-meal-coach:" + canned(meal.getId()) + "]");
        return mealRepository.saveAndFlush(meal);
    }

    @Test
    void testGetMealCoachForDay_shouldReturnTheVerdicts_whenTheDayIsToday() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        MealEntity meal = scriptedMeal(owner, today);

        MealCoachResponse res = getForBody("/api/meal/coach?date=" + today, ownerAuthHeaders(),
            HttpStatus.OK, MealCoachResponse.class);

        assertThat(res.getVerdicts()).hasSize(1);
        assertThat(res.getVerdicts().getFirst().getMealId()).isEqualTo(meal.getId());
        assertThat(res.getVerdicts().getFirst().getTagline()).isEqualTo("Remek pre-workout üzemanyag");
    }

    @Test
    void testGetMealCoachForDay_shouldNotGenerate_whenTheDayIsInThePast() {
        UUID owner = ownerId();
        LocalDate past = LocalDate.now().minusDays(3);
        MealEntity meal = scriptedMeal(owner, past);

        MealCoachResponse res = getForBody("/api/meal/coach?date=" + past, ownerAuthHeaders(),
            HttpStatus.OK, MealCoachResponse.class);

        assertThat(res.getVerdicts()).isEmpty();
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isNull();
    }

    @Test
    void testGetMealCoach_shouldGenerateForASingleMeal_evenOnAPastDate() {
        UUID owner = ownerId();
        MealEntity meal = scriptedMeal(owner, LocalDate.now().minusDays(5));

        MealCoachResponse res = getForBody("/api/meal/" + meal.getId() + "/coach",
            ownerAuthHeaders(), HttpStatus.OK, MealCoachResponse.class);

        assertThat(res.getVerdicts()).hasSize(1);
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isEqualTo("Remek pre-workout üzemanyag");
    }

    @Test
    void testGetMealCoach_shouldAnswer404_whenTheMealBelongsToSomeoneElse() {
        UUID stranger = databasePopulator.populateUser("stranger@example.com");
        MealEntity foreign = scriptedMeal(stranger, LocalDate.now());

        getForBody("/api/meal/" + foreign.getId() + "/coach", ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, Object.class);
    }
}
