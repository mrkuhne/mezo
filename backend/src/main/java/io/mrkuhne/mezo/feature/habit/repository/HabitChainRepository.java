package io.mrkuhne.mezo.feature.habit.repository;

import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitChainRepository extends JpaRepository<HabitChainEntity, UUID> {

    List<HabitChainEntity> findByCreatedByAndDeletedFalseOrderByPositionAsc(UUID createdBy);

    Optional<HabitChainEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<HabitChainEntity> findByCreatedByAndChainKeyAndDeletedFalse(UUID createdBy, String chainKey);
}
