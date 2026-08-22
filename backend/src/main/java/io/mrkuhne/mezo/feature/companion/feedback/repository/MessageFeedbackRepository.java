package io.mrkuhne.mezo.feature.companion.feedback.repository;

import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageFeedbackRepository extends JpaRepository<MessageFeedbackEntity, UUID> {

    Optional<MessageFeedbackEntity> findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
        UUID createdBy, String artifactKind, UUID artifactId);

    List<MessageFeedbackEntity> findByCreatedByAndArtifactKindAndArtifactIdInAndDeletedFalse(
        UUID createdBy, String artifactKind, Collection<UUID> artifactIds);

    /** The trailing-window read for {@code FeedbackLearningService} (W4.2, mezo-b3pp.16). */
    List<MessageFeedbackEntity> findByCreatedByAndCreatedAtAfterAndDeletedFalse(
        UUID createdBy, Instant since);

    /** The single write path for a verdict (spec §4.4: ONE updatable verdict per artifact).
     *
     * <p>Native ON CONFLICT rather than find-then-save because {@code uq_message_feedback_artifact}
     * spans soft-deleted rows too: after a retraction the ghost row still owns the slot, and JPA's
     * {@code @SQLRestriction} hides it from every derived finder. The upsert resurrects it
     * ({@code is_deleted = false}) instead of colliding with it. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        insert into message_feedback (created_by, artifact_kind, artifact_id, verdict, reason, is_deleted, created_at, updated_at)
        values (:createdBy, :artifactKind, :artifactId, :verdict, :reason, false, now(), now())
        on conflict on constraint uq_message_feedback_artifact
        do update set verdict = excluded.verdict, reason = excluded.reason,
                      is_deleted = false, updated_at = now()
        """, nativeQuery = true)
    void upsertVerdict(@Param("createdBy") UUID createdBy, @Param("artifactKind") String artifactKind,
                       @Param("artifactId") UUID artifactId, @Param("verdict") String verdict,
                       @Param("reason") String reason);
}
