package io.mrkuhne.mezo.feature.companion.feedback.repository;

import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedbackRollupRepository extends JpaRepository<FeedbackRollupEntity, UUID> {

    Optional<FeedbackRollupEntity> findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(
        UUID createdBy, String scope, int windowDays);

    /** W4.3 (mezo-b3pp.17): every scope for one user in a single read — the ProfileAssembler needs
     *  all 11 rollups at once, and 11 point lookups would be 11 round trips for the same page. */
    List<FeedbackRollupEntity> findByCreatedByAndDeletedFalseOrderByScopeAsc(UUID createdBy);
}
