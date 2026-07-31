package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealIngredientOverrideRequest;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * The mezo score must reflect the meal AS EATEN, not the recipe as written (mezo-ormb).
 *
 * <p>Isolation trick: the overridden line is a pure salt source — 0 kcal / 0 p / 0 c / 0 f, 40 g
 * salt per 100 g. Zeroing it therefore leaves the macro snapshot BYTE-IDENTICAL, so the only way
 * the two meals can score differently is if {@code recipeFacts()} consumed the override. If the
 * facts path ignores overrides, both scores come out exactly equal and this test fails.
 */
class MealOverridesScoringIT extends ApiIntegrationTest {

    private static final OffsetDateTime LOGGED_AT =
        OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC);

    private UUID createMacroFood(HttpHeaders auth) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Túró");
        r.setCategory(PantryItemRequest.CategoryEnum.DAIRY);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("110"));
        r.setProteinG(new BigDecimal("13"));
        r.setCarbsG(new BigDecimal("4"));
        r.setFatG(new BigDecimal("4.5"));
        r.setNova(1);
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    /** Macro-neutral, fact-rich: zero macros, heavy salt. */
    private UUID createSalt(HttpHeaders auth) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Só");
        r.setCategory(PantryItemRequest.CategoryEnum.CONDIMENTS);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(BigDecimal.ZERO);
        r.setProteinG(BigDecimal.ZERO);
        r.setCarbsG(BigDecimal.ZERO);
        r.setFatG(BigDecimal.ZERO);
        r.setSaltG(new BigDecimal("40"));
        r.setSugarG(BigDecimal.ZERO);
        r.setFiberG(BigDecimal.ZERO);
        r.setSaturatedFatG(BigDecimal.ZERO);
        r.setNova(1);
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    private RecipeIngredientRequest ingredient(UUID foodId, String amount) {
        RecipeIngredientRequest line = new RecipeIngredientRequest();
        line.setPantryItemId(foodId);
        line.setAmount(new BigDecimal(amount));
        line.setUnit("g");
        return line;
    }

    private MealResponse log(HttpHeaders auth, UUID recipeId, List<MealIngredientOverrideRequest> ov) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("recipe");
        i.setRecipeId(recipeId);
        i.setAmount(BigDecimal.ONE);
        i.setUnit("adag");
        i.setIngredientOverrides(ov);
        MealRequest r = new MealRequest();
        r.setSlot("lunch");
        r.setLoggedAt(LOGGED_AT);
        r.setTitle("Ebéd");
        r.setItems(List.of(i));
        return postForBody("/api/meal", r, auth, HttpStatus.CREATED, MealResponse.class);
    }

    @Test
    void testScore_shouldReflectTheOverriddenSet_whenAMacroNeutralFactRichLineIsZeroed() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID turo = createMacroFood(auth);
        UUID salt = createSalt(auth);

        RecipeRequest rr = new RecipeRequest();
        rr.setName("Sós túró");
        rr.setCategory("lunch");
        rr.setServings(2);
        rr.setStarred(false);
        rr.setTags(List.of());
        rr.setIngredients(List.of(ingredient(turo, "250"), ingredient(salt, "20")));
        RecipeResponse recipe = postForBody("/api/recipe", rr, auth, HttpStatus.CREATED, RecipeResponse.class);

        MealIngredientOverrideRequest zeroSalt = new MealIngredientOverrideRequest();
        zeroSalt.setLineOrder(1);
        zeroSalt.setPantryItemId(salt);
        zeroSalt.setAmount(BigDecimal.ZERO);

        MealResponse asWritten = log(auth, recipe.getId(), null);
        MealResponse withoutSalt = log(auth, recipe.getId(), List.of(zeroSalt));

        // the salt line is macro-neutral: the frozen macros MUST be identical
        assertThat(withoutSalt.getMacros().getKcal())
            .isEqualByComparingTo(asWritten.getMacros().getKcal());
        assertThat(withoutSalt.getMacros().getP()).isEqualByComparingTo(asWritten.getMacros().getP());
        assertThat(withoutSalt.getMacros().getC()).isEqualByComparingTo(asWritten.getMacros().getC());
        assertThat(withoutSalt.getMacros().getF()).isEqualByComparingTo(asWritten.getMacros().getF());

        // …so any score difference can ONLY come from recipeFacts() honouring the override
        assertThat(asWritten.getScore().getValue()).isNotNull();
        assertThat(withoutSalt.getScore().getValue()).isNotNull();
        assertThat(withoutSalt.getScore().getValue())
            .isNotEqualByComparingTo(asWritten.getScore().getValue());
        // and removing salt can only help
        assertThat(withoutSalt.getScore().getValue().doubleValue())
            .isGreaterThan(asWritten.getScore().getValue().doubleValue());
    }
}
