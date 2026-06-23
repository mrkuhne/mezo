package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.service.RecipeService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeServiceIT extends AbstractIntegrationTest {

    @Autowired private RecipeService service;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID owner;
    private UUID other;

    @BeforeEach
    void setUpOwners() {
        owner = databasePopulator.populateUser("a@test.local");
        other = databasePopulator.populateUser("b@test.local");
    }

    /** A food at 100 g basis: 110 kcal / 23 P / 0 C / 1.5 F per 100 g (cf. PantryItemPopulator.createFood). */
    private PantryItemEntity food(String name) {
        return pantryPopulator.createFood(owner, name, LocalDate.of(2026, 5, 25));
    }

    private RecipeIngredientRequest line(UUID pantryItemId, String amount, String unit) {
        RecipeIngredientRequest l = new RecipeIngredientRequest();
        l.setPantryItemId(pantryItemId);
        l.setAmount(new BigDecimal(amount));
        l.setUnit(unit);
        return l;
    }

    private RecipeRequest req(String name, RecipeIngredientRequest... lines) {
        RecipeRequest r = new RecipeRequest();
        r.setName(name);
        r.setCategory("lunch");
        r.setServings(2);
        r.setIngredients(List.of(lines));
        return r;
    }

    @Test
    void testCreate_shouldSnapshotAndRollUpMacros_whenValidLines() {
        PantryItemEntity chicken = food("Csirkemell"); // 110 kcal/100g, 23 P, 0 C, 1.5 F, NOVA 1

        RecipeResponse created = service.create(owner, req("Ebéd", line(chicken.getId(), "200", "g")));

        assertThat(created.getId()).isNotNull();
        // factor = 200 / 100 = 2 -> whole-recipe macros = snapshot * 2
        assertThat(created.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(220));
        assertThat(created.getMacros().getP()).isEqualByComparingTo(BigDecimal.valueOf(46));
        assertThat(created.getMacros().getC()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(created.getMacros().getF()).isEqualByComparingTo(BigDecimal.valueOf(3));
        assertThat(created.getNovaDominant()).isEqualByComparingTo(BigDecimal.valueOf(1));
        assertThat(created.getIngredients()).singleElement()
            .satisfies(i -> {
                assertThat(i.getName()).isEqualTo("Csirkemell"); // snapshot name
                assertThat(i.getLineOrder()).isEqualTo(0);
                assertThat(i.getContribution().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(220));
            });
    }

    @Test
    void testCreate_shouldOrderLinesByRequestIndex_whenMultipleLines() {
        PantryItemEntity a = food("Alpha");
        PantryItemEntity b = food("Bravo");

        RecipeResponse created = service.create(owner,
            req("Multi", line(a.getId(), "100", "g"), line(b.getId(), "100", "g")));

        assertThat(created.getIngredients()).extracting("lineOrder").containsExactly(0, 1);
        assertThat(created.getIngredients()).extracting("name").containsExactly("Alpha", "Bravo");
    }

    @Test
    void testCreate_shouldReject_whenPantryItemMissing() {
        assertThatThrownBy(() -> service.create(owner, req("Bad", line(UUID.randomUUID(), "100", "g"))))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testCreate_shouldReject_whenPantryItemForeign() {
        PantryItemEntity otherFood = pantryPopulator.createFood(other, "Idegen", LocalDate.of(2026, 5, 25));

        assertThatThrownBy(() -> service.create(owner, req("Bad", line(otherFood.getId(), "100", "g"))))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testGet_shouldReturnRecipe_whenOwned() {
        PantryItemEntity chicken = food("Csirkemell");
        RecipeResponse created = service.create(owner, req("Ebéd", line(chicken.getId(), "100", "g")));

        RecipeResponse fetched = service.get(owner, created.getId());

        assertThat(fetched.getName()).isEqualTo("Ebéd");
        assertThat(fetched.getIngredients()).hasSize(1);
    }

    @Test
    void testGet_shouldReturn404_whenForeignRecipe() {
        PantryItemEntity chicken = food("Csirkemell");
        RecipeResponse created = service.create(owner, req("Ebéd", line(chicken.getId(), "100", "g")));

        assertThatThrownBy(() -> service.get(other, created.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
