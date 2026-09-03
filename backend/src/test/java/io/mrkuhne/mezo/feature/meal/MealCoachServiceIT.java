package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealCoachVerdict;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.MealCoachService;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Meal-coach generation against the deterministic {@code FakeCompanionLlm} (mezo-mr4n): the
 * {@code [fake-meal-coach:{json}]} sentinel planted in a MEAL TITLE is echoed back as the LLM
 * answer (the title reaches the prompt), so the batch/cache/today-only rules are assertable with
 * no network and no mocks.
 */
@ActiveProfiles("companion-fake")
class MealCoachServiceIT extends AbstractIntegrationTest {

    @Autowired private MealCoachService service;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private OwnerProperties ownerProperties;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private static String canned(UUID mealId) {
        return """
            {"meals":[{"mealId":"%s","tagline":"Remek pre-workout üzemanyag",\
            "summary":"Gyors szénhidrát a Pull nap előtt — pont jó itt.",\
            "improve":[{"text":"Tegyél mellé 20g fehérjét","impact":"+fehérje"}]}]}"""
            .formatted(mealId);
    }

    private static String cannedWithDimensionNotes(UUID mealId) {
        return """
            {"meals":[{"mealId":"%s","tagline":"Jó ebéd","summary":"Rendben volt.",\
            "improve":[],"dimensionNotes":{"macro":"A fehérje erős ehhez az adaghoz.",\
            "bogus":"eldobandó"}}]}"""
            .formatted(mealId);
    }

    /** A scored meal on {@code date} whose title carries the scripted answer for its own id. */
    private MealEntity scriptedMeal(UUID owner, LocalDate date, String name) {
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Zabpehely", LocalDate.now().plusMonths(6));
        MealEntity meal = mealPopulator.createScoredMeal(owner, item, date, name,
            date.atTime(6, 15).toInstant(ZoneOffset.UTC));
        meal.setTitle(name + " [fake-meal-coach:" + canned(meal.getId()) + "]");
        return mealRepository.saveAndFlush(meal);
    }

    @Test
    void testGenerateForDay_shouldPersistTheVerdictIntoTheBreakdown_whenTheLlmAnswers() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        MealEntity meal = scriptedMeal(owner, today, "Zabkása");

        List<MealCoachVerdict> verdicts = service.generateForDay(owner, today, true);

        assertThat(verdicts).hasSize(1);
        assertThat(verdicts.getFirst().getTagline()).isEqualTo("Remek pre-workout üzemanyag");
        assertThat(verdicts.getFirst().getImprove()).hasSize(1);
        MealEntity reloaded = mealRepository.findById(meal.getId()).orElseThrow();
        assertThat(reloaded.getBreakdown().tagline()).isEqualTo("Remek pre-workout üzemanyag");
        assertThat(reloaded.getBreakdown().summary()).isNotBlank();
        // numbers untouched — the coach writes prose only
        assertThat(reloaded.getBreakdown().value()).isEqualByComparingTo("0.62");
        assertThat(reloaded.getBreakdown().dimensions()).hasSize(1);
    }

    @Test
    void testGenerateForDay_shouldServeTheCachedVerdict_withoutCallingTheLlmAgain() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        MealEntity meal = scriptedMeal(owner, today, "Zabkása");
        service.generateForDay(owner, today, true);

        // strip the sentinel: a second LLM call would now echo the prompt and parse to nothing
        MealEntity stripped = mealRepository.findById(meal.getId()).orElseThrow();
        stripped.setTitle("Zabkása");
        mealRepository.saveAndFlush(stripped);

        List<MealCoachVerdict> second = service.generateForDay(owner, today, true);

        assertThat(second).hasSize(1);
        assertThat(second.getFirst().getTagline()).isEqualTo("Remek pre-workout üzemanyag");
    }

    @Test
    void testGenerateForDay_shouldNotGenerate_whenGenerationIsNotAllowed() {
        UUID owner = owner();
        LocalDate past = LocalDate.now().minusDays(3);
        MealEntity meal = scriptedMeal(owner, past, "Zabkása");

        assertThat(service.generateForDay(owner, past, false)).isEmpty();
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isNull();
    }

    @Test
    void testGenerateForMeal_shouldGenerate_evenForAnOlderDay() {
        UUID owner = owner();
        LocalDate past = LocalDate.now().minusDays(5);
        MealEntity meal = scriptedMeal(owner, past, "Zabkása");

        List<MealCoachVerdict> verdicts = service.generateForMeal(owner, meal.getId());

        assertThat(verdicts).hasSize(1);
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isEqualTo("Remek pre-workout üzemanyag");
    }

    @Test
    void testGenerateForDay_shouldDropTheProse_whenTheMealIsEdited() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        MealEntity meal = scriptedMeal(owner, today, "Zabkása");
        service.generateForDay(owner, today, true);
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isNotNull();

        // Editing re-runs MealService.applyScore, which rewrites the envelope with null prose —
        // the verdict cannot outlive the numbers it explained (spec §7: invalidation is free).
        MealEntity edited = mealRepository.findById(meal.getId()).orElseThrow();
        MealBreakdownJson det = edited.getBreakdown();
        edited.setBreakdown(new MealBreakdownJson(det.value(), det.confidence(), null, null,
            det.dimensions(), List.of(), det.tools()));
        mealRepository.saveAndFlush(edited);

        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().summary()).isNull();
        assertThat(service.generateForDay(owner, today, false)).isEmpty();   // looks verdictless again
    }

    @Test
    void testGenerateForDay_shouldDegradeToEmpty_whenTheAnswerCarriesAnUnknownMealId() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Zabpehely", LocalDate.now().plusMonths(6));
        MealEntity meal = mealPopulator.createScoredMeal(owner, item, today, "Zabkása",
            Instant.now());
        meal.setTitle("Zabkása [fake-meal-coach:" + canned(UUID.randomUUID()) + "]");
        mealRepository.saveAndFlush(meal);

        assertThat(service.generateForDay(owner, today, true)).isEmpty();
        assertThat(mealRepository.findById(meal.getId()).orElseThrow()
            .getBreakdown().tagline()).isNull();
    }

    @Test
    void testGenerateForMeal_shouldWriteDimensionNotesIntoTheEnvelope_andDropUnknownIds() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Zabpehely", LocalDate.now().plusMonths(6));
        MealEntity meal = mealPopulator.createScoredMeal(owner, item, today, "Zabkása",
            today.atTime(6, 15).toInstant(ZoneOffset.UTC));
        meal.setTitle("Zabkása [fake-meal-coach:" + cannedWithDimensionNotes(meal.getId()) + "]");
        mealRepository.saveAndFlush(meal);

        List<MealCoachVerdict> verdicts = service.generateForMeal(owner, meal.getId());

        assertThat(verdicts).hasSize(1);
        assertThat(verdicts.getFirst().getDimensionNotes())
            .containsEntry("macro", "A fehérje erős ehhez az adaghoz.")
            .doesNotContainKey("bogus");
        MealBreakdownJson stored = mealRepository.findById(meal.getId()).orElseThrow().getBreakdown();
        assertThat(stored.dimensions()).extracting(MealBreakdownJson.Dimension::id,
                MealBreakdownJson.Dimension::note)
            .containsExactly(org.assertj.core.groups.Tuple.tuple("macro",
                "A fehérje erős ehhez az adaghoz."));
        assertThat(stored.dimensions().stream().map(MealBreakdownJson.Dimension::note)
            .filter(n -> "eldobandó".equals(n))).isEmpty();
    }

    @Test
    void testGenerateForDay_shouldDegradeToEmpty_whenTheAnswerIsNotParseable() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Zabpehely", LocalDate.now().plusMonths(6));
        MealEntity meal = mealPopulator.createScoredMeal(owner, item, today, "Zabkása",
            Instant.now());   // no sentinel -> the fake echoes the prompt -> not JSON

        assertThat(service.generateForDay(owner, today, true)).isEmpty();
        MealEntity reloaded = mealRepository.findById(meal.getId()).orElseThrow();
        assertThat(reloaded.getBreakdown().tagline()).isNull();
        assertThat(reloaded.getBreakdown().value()).isNotNull();   // deterministic score intact
    }
}
