package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.MealAiDraftItem;
import io.mrkuhne.mezo.api.dto.MealAiDraftResponse;
import io.mrkuhne.mezo.feature.meal.service.MealAiDraftService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Full AI meal-draft pipeline against the deterministic {@code FakeCompanionLlm} (mezo-78rn).
 * The {@code [fake-meal:{json}]} sentinel in the user text is echoed verbatim by the fake, so
 * these ITs drive canned LLM answers through the real parse → catalog-match → demotion →
 * confidence path. {@code @ActiveProfiles("companion-fake")} merges with the base {@code demodata}.
 */
@ActiveProfiles("companion-fake")
class MealAiDraftServiceIT extends AbstractIntegrationTest {

    private static final String OWNER_EMAIL = "meal-ai-owner@test.local";

    @Autowired
    private MealAiDraftService service;

    @Autowired
    private PantryItemPopulator pantryItemPopulator;

    @Autowired
    private RecipePopulator recipePopulator;

    @Autowired
    private RecipeMapper recipeMapper;

    @Autowired
    private DatabasePopulator databasePopulator;

    @Test
    void testDraft_shouldMatchPantryAndEstimate_whenSentinelCarriesBoth() {
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        PantryItemEntity pantry = pantryItemPopulator.createFood(owner, "Zabpehely", LocalDate.now().plusDays(30));

        String json = """
            {"slot":"breakfast","title":"Reggeli","note":null,"items":[
              {"pantryItemId":"%s","recipeId":null,"name":"Zabpehely","amount":60,"unit":"g",
               "kcal":220,"proteinG":8,"carbsG":38,"fatG":4},
              {"pantryItemId":null,"recipeId":null,"name":"Latte","amount":1,"unit":"db",
               "kcal":120,"proteinG":6,"carbsG":10,"fatG":6}
            ]}""".formatted(pantry.getId());

        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "zabpehely és latte [fake-meal:" + json + "]", null);

        assertThat(res.getSlot()).isEqualTo("breakfast");
        assertThat(res.getItems()).hasSize(2);

        MealAiDraftItem matched = res.getItems().getFirst();
        assertThat(matched.getSource()).isEqualTo("pantry");
        assertThat(matched.getPantryItemId()).isEqualTo(pantry.getId());
        // macros come from the DB row, NOT the LLM numbers above (kcal 220 vs the row's 110):
        assertThat(matched.getKcal()).isEqualByComparingTo(pantry.getKcal());
        assertThat(matched.getConfidence()).isEqualByComparingTo("1.0");
        assertThat(matched.getNeedsReview()).isFalse();

        MealAiDraftItem estimate = res.getItems().get(1);
        assertThat(estimate.getSource()).isEqualTo("estimate");
        assertThat(estimate.getKcal()).isEqualByComparingTo("120");
        assertThat(estimate.getPer()).isEqualByComparingTo("1"); // per = amount for estimates
    }

    @Test
    void testDraft_shouldMatchRecipe_whenSentinelCarriesRealRecipeId() {
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        // The recipe's lines FK-reference a real pantry item (RESTRICT); seed it first.
        PantryItemEntity ingredient = pantryItemPopulator.createFood(owner, "Túró", LocalDate.now().plusDays(10));
        RecipeEntity recipe = recipePopulator.createRecipe(owner, ingredient.getId());

        // Expected per-serving kcal is derived from the DB-seeded recipe the SAME way MealService's
        // recipe arm does (whole rollup ÷ servings, scale 6 HALF_UP) — NOT from the sentinel's 999.
        BigDecimal wholeKcal = recipeMapper.toResponse(recipe).getMacros().getKcal();
        BigDecimal expectedPerServing =
                wholeKcal.divide(BigDecimal.valueOf(recipe.getServings()), 6, RoundingMode.HALF_UP);

        String json = """
            {"slot":"lunch","title":"Ebéd","note":null,"items":[
              {"pantryItemId":null,"recipeId":"%s","name":"Túrós tál KAMU","amount":1,"unit":"tál",
               "kcal":999,"proteinG":1,"carbsG":1,"fatG":1}
            ]}""".formatted(recipe.getId());

        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "túrós tál [fake-meal:" + json + "]", null);

        assertThat(res.getItems()).hasSize(1);
        MealAiDraftItem line = res.getItems().getFirst();
        assertThat(line.getSource()).isEqualTo("recipe");
        assertThat(line.getRecipeId()).isEqualTo(recipe.getId());
        assertThat(line.getPantryItemId()).isNull();
        assertThat(line.getName()).isEqualTo(recipe.getName()); // from the DB row, not the sentinel's "KAMU"
        assertThat(line.getPer()).isEqualByComparingTo("1");
        assertThat(line.getBasisUnit()).isEqualTo("adag");
        assertThat(line.getUnit()).isEqualTo("adag");
        // macros come from the recipe's per-serving rollup (DB), NOT the sentinel's kcal 999:
        assertThat(line.getKcal()).isEqualByComparingTo(expectedPerServing);
        assertThat(line.getKcal()).isEqualByComparingTo("148.5"); // 297 whole ÷ 2 servings
        assertThat(line.getConfidence()).isEqualByComparingTo("1.0");
        assertThat(line.getNeedsReview()).isFalse();
    }

    @Test
    void testDraft_shouldDemoteToEstimate_whenPantryIdHallucinated() {
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        String json = """
            {"slot":"lunch","title":null,"note":null,"items":[
              {"pantryItemId":"%s","recipeId":null,"name":"Kamu wrap","amount":1,"unit":"db",
               "kcal":450,"proteinG":28,"carbsG":40,"fatG":18}
            ]}""".formatted(UUID.randomUUID());

        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "[fake-meal:" + json + "]", null);

        MealAiDraftItem line = res.getItems().getFirst();
        assertThat(line.getSource()).isEqualTo("estimate");
        assertThat(line.getPantryItemId()).isNull();
        assertThat(line.getNeedsReview()).isTrue(); // demotion always forces review
    }

    @Test
    void testDraft_shouldReturnEmptyItems_whenNothingRecognized() {
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        MealAiDraftResponse res = service.draft(owner, LocalDate.now(),
                "[fake-meal:{\"slot\":\"snack\",\"title\":null,\"note\":null,\"items\":[]}]", null);
        assertThat(res.getItems()).isEmpty();
    }

    @Test
    void testDraft_should502_whenAnswerUnparseable() {
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        // no sentinel -> fake echoes the prompt -> unparseable
        assertThatThrownBy(() -> service.draft(owner, LocalDate.now(), "csak szöveg", null))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void testDraft_shouldFlagNeedsReview_whenAtwaterInconsistent() {
        UUID owner = databasePopulator.populateUser(OWNER_EMAIL);
        String json = """
            {"slot":"dinner","title":null,"note":null,"items":[
              {"pantryItemId":null,"recipeId":null,"name":"Gyanús kaja","amount":1,"unit":"db",
               "kcal":900,"proteinG":28,"carbsG":40,"fatG":18}
            ]}""";
        MealAiDraftResponse res = service.draft(owner, LocalDate.now(), "[fake-meal:" + json + "]", null);
        assertThat(res.getItems().getFirst().getConfidence()).isEqualByComparingTo("0.6");
        assertThat(res.getItems().getFirst().getNeedsReview()).isTrue(); // <= threshold, boundary-INCLUSIVE
    }
}
