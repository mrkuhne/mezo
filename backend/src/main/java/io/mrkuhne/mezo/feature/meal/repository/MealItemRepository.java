package io.mrkuhne.mezo.feature.meal.repository;

import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MealItemRepository extends JpaRepository<MealItemEntity, UUID> {

    /**
     * Bulk soft-delete of a meal's lines. @SQLDelete does NOT cascade through @OneToMany on a
     * parent soft-delete (a soft-delete is an UPDATE, so no Hibernate remove-cascade runs), so the
     * service triggers this explicitly before soft-deleting the parent. Set-based UPDATE -> JPQL
     * @Modifying (no derived form exists). Mirrors RecipeIngredientRepository.softDeleteByRecipeId.
     */
    @Modifying
    @Query("update MealItemEntity mi set mi.deleted = true "
        + "where mi.meal.id = :mealId and mi.deleted = false")
    int softDeleteByMealId(@Param("mealId") UUID mealId);
}
