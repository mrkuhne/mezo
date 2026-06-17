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
     * Distinct dates of the owner's gym workout INSTANCES (templateSessionId not null) within
     * [from, to] that carry at least one logged set — the "gym done that day" signal driving the
     * Mai done-state. Status-agnostic on purpose (any logged set counts, finished or not).
     */
    @Query("""
        SELECT DISTINCT s.date FROM WorkoutSessionEntity s
        WHERE s.createdBy = :createdBy
          AND s.templateSessionId IS NOT NULL
          AND s.date BETWEEN :from AND :to
          AND EXISTS (SELECT 1 FROM ExerciseSetEntity es WHERE es.workoutSessionId = s.id)
        """)
    List<LocalDate> findDoneInstanceDates(
        @Param("createdBy") UUID createdBy, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
