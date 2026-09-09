package io.mrkuhne.mezo.feature.llmlog.repository;

import io.mrkuhne.mezo.feature.llmlog.entity.AiDraftOutcomeEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AiDraftOutcomeRepository extends JpaRepository<AiDraftOutcomeEntity, UUID> {

    Optional<AiDraftOutcomeEntity> findByCreatedByAndDraftIdAndDeletedFalse(UUID createdBy, UUID draftId);

    /** The single write path (plan Rulings: "last signal wins per (owner, draft_id)").
     *
     * <p>Native ON CONFLICT rather than find-then-save because
     * {@code uq_ai_draft_outcome_owner_draft} spans soft-deleted rows too: after a retraction the
     * ghost row still owns the slot, and JPA's {@code @SQLRestriction} hides it from every derived
     * finder. The upsert resurrects it ({@code is_deleted = false}) instead of colliding with it —
     * mirrors {@code MessageFeedbackRepository#upsertVerdict}. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        insert into ai_draft_outcome (created_by, feature, draft_id, outcome, is_deleted, created_at)
        values (:createdBy, :feature, :draftId, :outcome, false, now())
        on conflict on constraint uq_ai_draft_outcome_owner_draft
        do update set feature = excluded.feature, outcome = excluded.outcome, is_deleted = false
        """, nativeQuery = true)
    void upsertOutcome(@Param("createdBy") UUID createdBy, @Param("feature") String feature,
                       @Param("draftId") UUID draftId, @Param("outcome") String outcome);
}
