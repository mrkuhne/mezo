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
     * Today's most recent instance of a template day in a given status — drives
     * {@code WorkoutTodayResponse.completedWorkout} (status 'completed', date = today), the Mai
     * "Kész + Megnézem" hero state. Newest wins on {@code createdAt} on a repeated day.
     */
    Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndStatusAndDateOrderByCreatedAtDesc(
        UUID createdBy, UUID templateSessionId, String status, LocalDate date);

    /**
     * The owner's latest INSTANCE (templateSessionId set) of a given template session on a given
     * day — the challenge gather step's anchor for "did this session happen today". Status-agnostic;
     * newest wins on {@code createdAt} when a day carries more than one instance of the template.
     */
    Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc(
        UUID createdBy, UUID templateSessionId, LocalDate date);

    /**
     * Distinct dates of the owner's gym workout INSTANCES (templateSessionId not null) within
     * [from, to] with status 'completed' — the "gym done that day" signal driving the Mai
     * done-state. Done = EXPLICITLY FINISHED (spec 2026-07-15): a started-but-unclosed
     * instance (any number of logged sets) is NOT done; the lazy auto-close settles stale ones.
     */
    @Query("""
        SELECT DISTINCT s.date FROM WorkoutSessionEntity s
        WHERE s.createdBy = :createdBy
          AND s.templateSessionId IS NOT NULL
          AND s.date BETWEEN :from AND :to
          AND s.status = 'completed'
        """)
    List<LocalDate> findDoneInstanceDates(
        @Param("createdBy") UUID createdBy, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * The owner's COMPLETED gym workout instances within [from, to] —
     * {@link #findDoneInstanceDates} returning the entities instead of dates (companion
     * get_recent_workouts + Insights listWorkouts). Same completed-only semantics.
     */
    @Query("""
        SELECT s FROM WorkoutSessionEntity s
        WHERE s.createdBy = :createdBy
          AND s.templateSessionId IS NOT NULL
          AND s.date BETWEEN :from AND :to
          AND s.status = 'completed'
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

    /** The owner's ACTIVE instances dated strictly before a day — the lazy auto-close scan set. */
    List<WorkoutSessionEntity> findByCreatedByAndStatusAndDateBeforeAndTemplateSessionIdIsNotNull(
        UUID createdBy, String status, LocalDate date);

    /**
     * The owner's open instance regardless of template day (cross-day start, mezo-p7rp) — day
     * resolution's first branch: an open workout always wins, so a deep link to another day
     * while one runs resumes the running one. After the lazy auto-close only a today-dated
     * instance can be 'active', and D6 allows at most one; newest wins defensively.
     */
    Optional<WorkoutSessionEntity> findFirstByCreatedByAndStatusAndTemplateSessionIdIsNotNullOrderByDateDescCreatedAtDesc(
        UUID createdBy, String status);

    /**
     * A template day's most recent instance in a given status within [from, to] — the week-scoped
     * {@code completedWorkout} (cross-day start, mezo-p7rp): a template day completed ANY day of
     * the current Mon–Sun week reviews instead of restarting (D5).
     */
    Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndStatusAndDateBetweenOrderByDateDescCreatedAtDesc(
        UUID createdBy, UUID templateSessionId, String status, LocalDate from, LocalDate to);

    /** The owner's CUSTOM (saját) workout templates, oldest first (mezo-ws2x). */
    List<WorkoutSessionEntity> findByCreatedByAndOriginAndTemplateSessionIdIsNullOrderByCreatedAtAsc(
        UUID createdBy, String origin);
}
