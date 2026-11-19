package io.mrkuhne.mezo.feature.recipe.repository;

import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

// No 'date' base field => extend JpaRepository directly (cf. PantryItemRepository), not OwnedRepository.
public interface RecipeRepository extends JpaRepository<RecipeEntity, UUID> {

    List<RecipeEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    Optional<RecipeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /**
     * The owner's live recipes that have at least one line on the given shelf row (mezo-r36n9.63) — the
     * recipes whose frozen line snapshots follow when that food's numbers are replaced.
     */
    @Query("select distinct r from RecipeEntity r join r.lines l "
        + "where r.createdBy = :createdBy and r.deleted = false and l.pantryItemId = :pantryItemId")
    List<RecipeEntity> findOwnedUsingPantryItem(@Param("createdBy") UUID createdBy,
                                                @Param("pantryItemId") UUID pantryItemId);
}
