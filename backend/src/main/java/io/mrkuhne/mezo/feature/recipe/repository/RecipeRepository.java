package io.mrkuhne.mezo.feature.recipe.repository;

import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// No 'date' base field => extend JpaRepository directly (cf. PantryItemRepository), not OwnedRepository.
public interface RecipeRepository extends JpaRepository<RecipeEntity, UUID> {

    List<RecipeEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    Optional<RecipeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
