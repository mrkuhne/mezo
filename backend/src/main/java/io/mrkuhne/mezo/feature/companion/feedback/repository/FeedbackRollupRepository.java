package io.mrkuhne.mezo.feature.companion.feedback.repository;

import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedbackRollupRepository extends JpaRepository<FeedbackRollupEntity, UUID> {

    Optional<FeedbackRollupEntity> findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(
        UUID createdBy, String scope, int windowDays);

    /** W4.3 (mezo-b3pp.17): every scope for one user in a single read, unfiltered by window — 11
     *  point lookups would be 11 round trips for the same page. {@code ProfileAssembler} no longer
     *  calls this (mezo-b3pp.35, item 3, moved it to the window-scoped finder below); its only
     *  remaining production caller is {@code QuarterlyReviewService.appendFeedback}, which reads
     *  every window on purpose and labels each row with its own {@code windowDays}. */
    List<FeedbackRollupEntity> findByCreatedByAndDeletedFalseOrderByScopeAsc(UUID createdBy);

    /** Same as above, scoped to ONE window (mezo-b3pp.35, item 3) — nothing deletes a rollup row
     *  when {@code feedback-learning.window-days} changes, so retired-window rows outlive the
     *  config that produced them. {@code ProfileAssembler} must read only the window the nightly
     *  job currently WRITES, or it renders one contradictory line per scope for every window that
     *  ever existed. */
    List<FeedbackRollupEntity> findByCreatedByAndWindowDaysAndDeletedFalseOrderByScopeAsc(
        UUID createdBy, int windowDays);
}
