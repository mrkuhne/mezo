package io.mrkuhne.mezo.feature.lifegoal.repository;

import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LifeGoalRepository extends JpaRepository<LifeGoalEntity, UUID> {
    Optional<LifeGoalEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
    List<LifeGoalEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);
    List<LifeGoalEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);
}
