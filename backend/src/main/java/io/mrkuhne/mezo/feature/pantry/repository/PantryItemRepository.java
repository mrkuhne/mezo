package io.mrkuhne.mezo.feature.pantry.repository;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// No 'date' base field => extend JpaRepository directly (cf. GoalRepository), not OwnedRepository.
public interface PantryItemRepository extends JpaRepository<PantryItemEntity, UUID> {

    List<PantryItemEntity> findByCreatedByAndDeletedFalseOrderByNameAsc(UUID createdBy);

    Optional<PantryItemEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
