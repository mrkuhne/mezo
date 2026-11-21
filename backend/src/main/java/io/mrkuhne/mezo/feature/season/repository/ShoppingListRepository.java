package io.mrkuhne.mezo.feature.season.repository;

import io.mrkuhne.mezo.feature.season.entity.ShoppingListEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShoppingListRepository extends JpaRepository<ShoppingListEntity, UUID> {

    Optional<ShoppingListEntity> findByWeekId(UUID weekId);

    Optional<ShoppingListEntity> findByCreatedByAndWeekStart(UUID owner, LocalDate weekStart);

    Optional<ShoppingListEntity> findByIdAndCreatedBy(UUID id, UUID owner);

    List<ShoppingListEntity> findByCreatedByOrderByWeekStartDesc(UUID owner);
}
