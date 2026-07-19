package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeBreakdownResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Recipe-ai-score on, companion off (mezo-bw3y): no {@code CompanionLlm} bean → no
 * {@code RecipeBreakdownLlmAdapter} bean → the prose service's {@code ObjectProvider} is empty.
 * Unlike scrape/ai-draft (whose whole feature IS the LLM → 503), the breakdown endpoint's core is
 * deterministic, so it SILENTLY degrades: 200 with the un-enriched envelope, nothing persisted.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class RecipeBreakdownFallbackApiIT extends ApiIntegrationTest {

    @Autowired
    private RecipeRepository recipeRepository;

    @Test
    void testGetBreakdown_shouldServeDeterministicUnpersisted_whenCompanionOff() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemRequest food = new PantryItemRequest();
        food.setKind(PantryItemRequest.KindEnum.FOOD);
        food.setName("Túró");
        food.setPer(new BigDecimal("100"));
        food.setUnit("g");
        food.setKcal(new BigDecimal("110"));
        food.setProteinG(new BigDecimal("13"));
        food.setCarbsG(new BigDecimal("4"));
        food.setFatG(new BigDecimal("4.5"));
        UUID foodId = postForBody("/api/pantry", food, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();

        RecipeIngredientRequest l = new RecipeIngredientRequest();
        l.setPantryItemId(foodId);
        l.setAmount(new BigDecimal("250"));
        l.setUnit("g");
        RecipeRequest r = new RecipeRequest();
        r.setName("Túrós tál");
        r.setCategory("breakfast");
        r.setServings(2);
        r.setIngredients(List.of(l));
        UUID recipe = postForBody("/api/recipe", r, auth, HttpStatus.CREATED, RecipeResponse.class).getId();

        RecipeBreakdownResponse res = getForBody("/api/recipe/" + recipe + "/breakdown", auth,
            HttpStatus.OK, RecipeBreakdownResponse.class);

        assertThat(res.getBreakdown()).isNotNull();
        assertThat(res.getBreakdown().getValue()).isNotNull();
        assertThat(res.getBreakdown().getSummary()).isNull(); // no prose without the LLM
        assertThat(res.getBreakdown().getImprove()).isEmpty();
        assertThat(res.getBreakdown().getDimensions()).hasSize(4); // 3 live + degraded context
        assertThat(res.getFitsFor()).isEmpty();
        // prose-less envelopes are never persisted — prose self-heals when the LLM returns
        assertThat(recipeRepository.findById(recipe).orElseThrow().getBreakdown()).isNull();
    }
}
