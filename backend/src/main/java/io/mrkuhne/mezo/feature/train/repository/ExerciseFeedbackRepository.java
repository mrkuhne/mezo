package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Repository for {@link ExerciseFeedbackEntity}. Extends {@link JpaRepository} directly (no
 * {@code date} field for the house {@code OwnedRepository} ordering); rows are unique per
 * (workout instance, exercise) and looked up exactly that way for the upsert.
 */
public interface ExerciseFeedbackRepository extends JpaRepository<ExerciseFeedbackEntity, UUID> {

    List<ExerciseFeedbackEntity> findByCreatedByAndWorkoutSessionId(UUID createdBy, UUID workoutSessionId);

    /** Batch feedback lookup across many instances — {@code CharacterSignalReads}' gym-day read. */
    List<ExerciseFeedbackEntity> findByCreatedByAndWorkoutSessionIdIn(
        UUID createdBy, Collection<UUID> workoutSessionIds);

    /** Flat-feedback detection (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §(18)): the newest
     *  debrief rows first, capped by the caller. The rows carry no workout date of their own —
     *  {@code created_at} IS when the debrief was tapped, which is exactly the ordering the
     *  question is about. */
    List<ExerciseFeedbackEntity> findByCreatedByOrderByCreatedAtDesc(UUID createdBy, Limit limit);

    /** One debrief answer with the identity of the exercise row it was given on. */
    interface FeedbackIdentityRow {
        Integer getJointPain();
        UUID getCatalogId();
        String getName();
        Instant getCreatedAt();
    }

    /**
     * Every live debrief of the user, newest first, joined to its exercise row INCLUDING soft-deleted rows
     * (a day edit soft-deletes template rows while their feedback stays live — mezo-eq4w), so the caller can
     * fold per exercise IDENTITY (mezo-r36n9.66, the discomfort level).
     */
    @Query(value = "SELECT f.joint_pain AS \"jointPain\", e.catalog_id AS \"catalogId\", e.name AS \"name\", "
        + "f.created_at AS \"createdAt\" FROM exercise_feedback f JOIN exercise e ON e.id = f.exercise_id "
        + "WHERE f.created_by = :createdBy AND f.is_deleted = false ORDER BY f.created_at DESC",
        nativeQuery = true)
    List<FeedbackIdentityRow> findIdentityFeedbackNewestFirst(@Param("createdBy") UUID createdBy);
}
