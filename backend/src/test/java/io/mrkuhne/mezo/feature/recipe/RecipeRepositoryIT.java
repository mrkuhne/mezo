package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeRepositoryIT extends AbstractIntegrationTest {

    @Autowired private RecipeRepository repository;
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext private EntityManager entityManager;

    // created_by + pantry_item_id both have FKs — owners and pantry rows MUST be real (populated first).
    @Test
    void testFindByOwner_shouldPersistAggregateAndOrderLines_whenSaved() {
        UUID owner = databasePopulator.populateUser("owner@test.local");
        PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
        recipePopulator.createRecipe(owner, food.getId());
        // Drop the populator's managed instances so the finder loads the aggregate fresh from the DB,
        // where @OrderBy("lineOrder") actually applies (an already-initialized collection keeps insert order).
        entityManager.clear();

        var recipes = repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner);

        assertThat(recipes).hasSize(1);
        RecipeEntity r = recipes.get(0);
        assertThat(r.getCategory()).isEqualTo("breakfast");
        assertThat(r.getServings()).isEqualTo(2);
        assertThat(r.getTags()).containsExactly("magas-fehérje", "gyors");
        assertThat(r.getNovaDominant()).isEqualTo((short) 1);
        // cascade persisted BOTH lines; @OrderBy("lineOrder") returns them 0 -> 1 despite reverse insert.
        assertThat(r.getLines()).hasSize(2);
        assertThat(r.getLines()).extracting(l -> l.getLineOrder()).containsExactly(0, 1);
        assertThat(r.getLines().get(0).getSnapshotName()).isEqualTo("Túró");
        assertThat(r.getLines().get(0).getPantryItemId()).isEqualTo(food.getId());
    }

    @Test
    void testFindByOwner_shouldHideRow_whenSoftDeleted() {
        UUID owner = databasePopulator.populateUser("owner@test.local");
        PantryItemEntity food = pantryItemPopulator.createFood(owner, "Túró", LocalDate.of(2026, 7, 1));
        RecipeEntity r = recipePopulator.createRecipe(owner, food.getId());

        repository.delete(r); // @SQLDelete soft-deletes the recipe row

        assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner)).isEmpty();
        assertThat(repository.findByIdAndCreatedByAndDeletedFalse(r.getId(), owner)).isEmpty();
    }
}
