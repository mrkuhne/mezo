package io.mrkuhne.mezo.feature.goal.repository;

import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalPlanLinkRepository extends JpaRepository<GoalPlanLinkEntity, UUID> {

    List<GoalPlanLinkEntity> findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(
        UUID goalId, UUID createdBy);

    Optional<GoalPlanLinkEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
