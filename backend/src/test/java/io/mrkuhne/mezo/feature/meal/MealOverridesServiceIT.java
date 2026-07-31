package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.MealIngredientOverrideRequest;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service-level guards of the ingredient-override write path (mezo-ormb) that the HTTP layer
 * PRE-EMPTS. The generated {@code MealIngredientOverrideRequest} carries {@code @NotNull} on
 * {@code lineOrder}/{@code amount} and {@code @DecimalMin("0")} on {@code amount}, and {@code @Valid}
 * cascades from {@code MealRequest} — so over HTTP Spring rejects those with a
 * {@code MethodArgumentNotValidException} before {@code MealService} runs. Calling the service
 * DIRECTLY bypasses bean validation and is the only way to prove the service's own guards hold
 * (defence in depth: the service is also reachable from {@code MealAiDraftService} and future
 * internal callers, which do not go through the controller's validation).
 *
 * <p>Deliberately a separate class from {@code MealServiceIT}, which must stay untouched as the
 * un-overridden-path regression proof.
 */
@Transactional
class MealOverridesServiceIT extends AbstractIntegrationTest {

    @Autowired private MealService service;
    @Autowired private MealRepository repository;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** JPA-managed shared EntityManager — reads the frozen snapshot back fresh from the DB. */
    @PersistenceContext private EntityManager entityManager;

    private UUID owner;

    @BeforeEach
    void setUpOwner() {
        owner = databasePopulator.populateUser("a@test.local");
    }

    // RecipePopulator: 2 servings, two lines over the SAME pantry item, snapshot-per 100 g
    // (110/13/4/4.5), amounts 250 (lineOrder 0, "Túró") + 20 (lineOrder 1, "Méz").
    private RecipeEntity recipe(UUID who) {
        PantryItemEntity src = pantryPopulator.createFood(who, "Túró forrás", LocalDate.of(2026, 5, 25));
        return recipePopulator.createRecipe(who, src.getId());
    }

    /** The pantry item BOTH recipe lines point at — the override's consistency-check id. */
    private UUID sourceOf(RecipeEntity r) {
        return r.getLines().get(0).getPantryItemId();
    }

    private MealIngredientOverrideRequest override(Integer lineOrder, UUID pantryItemId, BigDecimal amount) {
        MealIngredientOverrideRequest o = new MealIngredientOverrideRequest();
        o.setLineOrder(lineOrder);
        o.setPantryItemId(pantryItemId);
        o.setAmount(amount);
        return o;
    }

    private MealRequest req(RecipeEntity r, MealIngredientOverrideRequest... overrides) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("recipe");
        i.setRecipeId(r.getId());
        i.setAmount(new BigDecimal("1"));
        i.setUnit("adag");
        i.setIngredientOverrides(List.of(overrides));

        MealRequest m = new MealRequest();
        m.setSlot("breakfast");
        m.setLoggedAt(OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC));
        m.setTitle("Reggeli");
        m.setItems(List.of(i));
        return m;
    }

    @Test
    void testCreate_shouldReject_whenOverrideAmountIsNegative() {
        RecipeEntity r = recipe(owner);

        // amount 0 is LEGAL ("left out"); only a negative amount is an anomaly.
        assertThatThrownBy(() ->
            service.create(owner, req(r, override(0, sourceOf(r), new BigDecimal("-1")))))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(ex.getMessages()).singleElement().satisfies(m -> {
                    assertThat(m.getCode()).isEqualTo("VALIDATION_INVALID_VALUE");
                    assertThat(m.getFieldName()).isEqualTo("items");
                });
            });
    }

    @Test
    void testCreate_shouldReject_whenLineOrderIsNull() {
        RecipeEntity r = recipe(owner);

        assertThatThrownBy(() ->
            service.create(owner, req(r, override(null, sourceOf(r), new BigDecimal("10")))))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(ex.getMessages()).singleElement().satisfies(m -> {
                    assertThat(m.getCode()).isEqualTo("VALIDATION_INVALID_VALUE");
                    assertThat(m.getFieldName()).isEqualTo("items");
                });
            });
    }

    @Test
    void testCreate_shouldReturnNullNova_whenEveryLineIsZeroed() {
        RecipeEntity r = recipe(owner);
        UUID src = sourceOf(r);

        // Both lines left out entirely: nothing went in, so there is no dominant NOVA to freeze.
        MealResponse created = service.create(owner, req(r,
            override(0, src, BigDecimal.ZERO), override(1, src, BigDecimal.ZERO)));

        assertThat(created.getItems()).singleElement().satisfies(i -> {
            assertThat(i.getNova()).isNull();
            assertThat(i.getContribution().getKcal()).isEqualByComparingTo(BigDecimal.ZERO);
        });
        // ...and the nullable snapshot_nova column really holds NULL, read back fresh from the DB.
        entityManager.flush();
        entityManager.clear();
        assertThat(repository.findById(created.getId()).orElseThrow().getItems())
            .singleElement()
            .satisfies(i -> assertThat(i.getSnapshotNova()).isNull());
    }
}
