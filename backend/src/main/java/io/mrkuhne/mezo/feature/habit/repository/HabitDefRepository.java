package io.mrkuhne.mezo.feature.habit.repository;

import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitDefRepository extends JpaRepository<HabitDefEntity, UUID> {

    List<HabitDefEntity> findByCreatedByAndDeletedFalseOrderByPositionAsc(UUID createdBy);

    Optional<HabitDefEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<HabitDefEntity> findByCreatedByAndHabitKeyAndDeletedFalse(UUID createdBy, String habitKey);

    List<HabitDefEntity> findByChainIdAndDeletedFalse(UUID chainId);
}
