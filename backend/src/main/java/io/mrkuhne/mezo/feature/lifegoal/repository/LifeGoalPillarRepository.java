package io.mrkuhne.mezo.feature.lifegoal.repository;

import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LifeGoalPillarRepository extends JpaRepository<LifeGoalPillarEntity, UUID> {
    List<LifeGoalPillarEntity> findByGoalIdAndDeletedFalseOrderByPositionAsc(UUID goalId);
    List<LifeGoalPillarEntity> findByGoalIdInAndDeletedFalseOrderByPositionAsc(List<UUID> goalIds);
}
