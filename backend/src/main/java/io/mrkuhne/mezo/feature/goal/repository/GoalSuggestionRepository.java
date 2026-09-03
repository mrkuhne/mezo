package io.mrkuhne.mezo.feature.goal.repository;

import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalSuggestionRepository extends JpaRepository<GoalSuggestionEntity, UUID> {

    Optional<GoalSuggestionEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<GoalSuggestionEntity> findByGoalIdAndCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
        UUID goalId, UUID createdBy, String status);

    Optional<GoalSuggestionEntity> findByGoalIdAndKindAndStatusAndDeletedFalse(
        UUID goalId, String kind, String status);

    boolean existsByGoalIdAndDedupKeyAndStatusInAndDeletedFalse(
        UUID goalId, String dedupKey, List<String> statuses);
}
