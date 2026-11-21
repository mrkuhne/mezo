package io.mrkuhne.mezo.feature.season.repository;

import io.mrkuhne.mezo.feature.season.entity.ShoppingItemEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShoppingItemRepository extends JpaRepository<ShoppingItemEntity, UUID> {

    List<ShoppingItemEntity> findByListId(UUID listId);

    Optional<ShoppingItemEntity> findByIdAndCreatedBy(UUID id, UUID owner);
}
