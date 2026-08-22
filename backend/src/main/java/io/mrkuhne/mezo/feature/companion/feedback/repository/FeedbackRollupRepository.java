package io.mrkuhne.mezo.feature.companion.feedback.repository;

import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedbackRollupRepository extends JpaRepository<FeedbackRollupEntity, UUID> {

    Optional<FeedbackRollupEntity> findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(
        UUID createdBy, String scope, int windowDays);
}
