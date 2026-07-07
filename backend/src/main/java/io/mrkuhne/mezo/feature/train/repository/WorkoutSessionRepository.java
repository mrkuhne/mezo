package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Repository for {@link WorkoutSessionEntity}. Extends {@link JpaRepository} directly rather than
 * the house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a {@code date} field
 * sessions only optionally carry; sessions are ordered within a mesocycle by {@code orderIndex}.
 */
public interface WorkoutSessionRepository extends JpaRepository<WorkoutSessionEntity, UUID> {

    List<WorkoutSessionEntity> findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(
        UUID createdBy, Collection<UUID> mesocycleIds);

    Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
        UUID createdBy, UUID templateSessionId, String status);

    /**
     * The owner's latest INSTANCE (templateSessionId set) of a given template session on a given
     * day — the challenge gather step's anchor for "did this session happen today". Status-agnostic;
     * newest wins on {@code createdAt} when a day carries more than one instance of the template.
     */
    Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc(
        UUID createdBy, UUID templateSessionId, LocalDate date);

    /**
     * Distinct dates of the owner's gym workout INSTANCES (templateSessionId not null) within
     * [from, to] that carry at least one logged set — the "gym done that day" signal driving the
     * Mai done-state. Status-agnostic on purpose (any logged set counts, finished or not).
     * Skip markers (es.skipped = true) are NOT logged sets, so a skip-only instance stays not-done.
     */
    @Query("""
        SELECT DISTINCT s.date FROM WorkoutSessionEntity s
        WHERE s.createdBy = :createdBy
          AND s.templateSessionId IS NOT NULL
          AND s.date BETWEEN :from AND :to
          AND EXISTS (SELECT 1 FROM ExerciseSetEntity es
                      WHERE es.workoutSessionId = s.id AND es.skipped = false)
        """)
    List<LocalDate> findDoneInstanceDates(
        @Param("createdBy") UUID createdBy, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * The owner's gym workout INSTANCES (templateSessionId not null) within [from, to] that carry
     * at least one logged set — {@link #findDoneInstanceDates} returning the entities instead of
     * dates, for the companion get_recent_workouts tool (V0.5). Plain finder, no companion
     * dependency; same status-agnostic + skip-marker semantics.
     */
    @Query("""
        SELECT s FROM WorkoutSessionEntity s
        WHERE s.createdBy = :createdBy
          AND s.templateSessionId IS NOT NULL
          AND s.date BETWEEN :from AND :to
          AND EXISTS (SELECT 1 FROM ExerciseSetEntity es
                      WHERE es.workoutSessionId = s.id AND es.skipped = false)
        ORDER BY s.date ASC
        """)
    List<WorkoutSessionEntity> findDoneInstancesBetween(
        @Param("createdBy") UUID createdBy, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * Dates of the owner's gym workout INSTANCES (templateSessionId not null) that carry a date,
     * unbounded. Feeds the progression robustness streak (any logged gym instance counts as a
     * training day in its ISO week). Status-agnostic, like {@link #findDoneInstanceDates}.
     */
    @Query("""
        SELECT s.date FROM WorkoutSessionEntity s
        WHERE s.createdBy = :createdBy
          AND s.templateSessionId IS NOT NULL
          AND s.date IS NOT NULL
        """)
    List<LocalDate> findInstanceDates(@Param("createdBy") UUID createdBy);
}
