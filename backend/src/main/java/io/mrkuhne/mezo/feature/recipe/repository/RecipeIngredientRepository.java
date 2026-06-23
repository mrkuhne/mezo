package io.mrkuhne.mezo.feature.recipe.repository;

import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecipeIngredientRepository extends JpaRepository<RecipeIngredientEntity, UUID> {

    /**
     * Bulk soft-delete of a recipe's lines. @SQLDelete does NOT cascade through @OneToMany on a
     * parent soft-delete (a soft-delete is an UPDATE, so no Hibernate remove-cascade runs), so the
     * service triggers this explicitly. Set-based UPDATE -> JPQL @Modifying (no derived form exists).
     */
    @Modifying
    @Query("update RecipeIngredientEntity ri set ri.deleted = true "
        + "where ri.recipe.id = :recipeId and ri.deleted = false")
    int softDeleteByRecipeId(@Param("recipeId") UUID recipeId);
}
