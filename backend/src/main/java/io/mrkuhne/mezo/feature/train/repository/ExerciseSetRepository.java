package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link ExerciseSetEntity}. Extends {@link JpaRepository} directly rather than the
 * house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a {@code date} field
 * this entity does not carry; sets are ordered within an exercise by {@code setIndex}.
 */
public interface ExerciseSetRepository extends JpaRepository<ExerciseSetEntity, UUID> {

    List<ExerciseSetEntity> findByCreatedByAndExerciseIdOrderBySetIndexAsc(
        UUID createdBy, UUID exerciseId);

    List<ExerciseSetEntity> findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(
        UUID createdBy, UUID workoutSessionId);

    /**
     * The owner's logged sets of one exercise inside one workout instance, in set order — the
     * set-level challenge outcome evaluator's input (compare the instance's actuals against a target).
     */
    List<ExerciseSetEntity> findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(
        UUID createdBy, UUID workoutSessionId, UUID exerciseId);

    /** Every logged (reps present) set of the owner — record aggregation input. */
    List<ExerciseSetEntity> findByCreatedByAndRepsNotNull(UUID createdBy);

    /**
     * WORKING-set history across a set of exercise rows, restricted to COMPLETED instances,
     * newest instance first — the identity-based history read (mezo-eq4w): callers pass every
     * row id sharing an exercise identity (soft-deleted day-edit rows included) so a day edit
     * never severs the double-progression / "múlt hét" base.
     */
    @org.springframework.data.jpa.repository.Query("""
        SELECT s FROM ExerciseSetEntity s, WorkoutSessionEntity w
        WHERE s.createdBy = :createdBy
          AND s.exerciseId IN :exerciseIds
          AND s.workoutSessionId = w.id
          AND w.status = 'completed'
          AND s.skipped = false
          AND s.kind = 'working'
          AND s.reps IS NOT NULL
        ORDER BY w.date DESC, w.createdAt DESC, s.setIndex ASC
        """)
    List<ExerciseSetEntity> findCompletedWorkingHistory(
        @org.springframework.data.repository.query.Param("createdBy") UUID createdBy,
        @org.springframework.data.repository.query.Param("exerciseIds") List<UUID> exerciseIds);

    /** Working sets only (record aggregation input — warmups excluded). */
    List<ExerciseSetEntity> findByCreatedByAndRepsNotNullAndKind(UUID createdBy, String kind);

    /**
     * The countable WORKING sets logged inside a given set of workout instances (mezo-meyc.2) —
     * the close report's strength-delta input. Same eligibility rule the records/medal replay
     * uses: working, non-skipped, reps present. Instance status is filtered by the CALLER (it
     * hands in the run's completed instances), so this stays a plain set-scoped read.
     */
    @org.springframework.data.jpa.repository.Query("""
        SELECT s FROM ExerciseSetEntity s
        WHERE s.createdBy = :createdBy
          AND s.workoutSessionId IN :sessionIds
          AND s.kind = 'working'
          AND s.skipped = false
          AND s.reps IS NOT NULL
        """)
    List<ExerciseSetEntity> findWorkingSetsInSessions(
        @org.springframework.data.repository.query.Param("createdBy") UUID createdBy,
        @org.springframework.data.repository.query.Param("sessionIds") List<UUID> sessionIds);

    /** One row per (21-zone muscle, instance date) — the volume-arc aggregation projection. */
    interface MuscleWeekSetCount {
        String getMuscle();
        java.time.LocalDate getDate();
        long getSets();
    }

    /**
     * Working-set counts for one mesocycle's COMPLETED instances, grouped by the exercise's raw
     * (21-token) muscle zone and the instance date — the volume-arc read (mezo-hi9m). The service
     * collapses each zone to its coarse {@link io.mrkuhne.mezo.feature.train.service.MuscleGroup}
     * and buckets the date into a meso-week; this query only counts + groups.
     */
    @org.springframework.data.jpa.repository.Query("""
        SELECT e.muscle AS muscle, w.date AS date, COUNT(s) AS sets
        FROM ExerciseSetEntity s, ExerciseEntity e, WorkoutSessionEntity w
        WHERE s.createdBy = :createdBy
          AND s.exerciseId = e.id
          AND s.workoutSessionId = w.id
          AND w.mesocycleId = :mesoId
          AND w.status = 'completed'
          AND s.kind = 'working'
          AND s.skipped = false
          AND s.reps IS NOT NULL
        GROUP BY e.muscle, w.date
        """)
    List<MuscleWeekSetCount> aggregateWorkingSetsByMuscleAndDate(
        @org.springframework.data.repository.query.Param("createdBy") UUID createdBy,
        @org.springframework.data.repository.query.Param("mesoId") UUID mesoId);
}
