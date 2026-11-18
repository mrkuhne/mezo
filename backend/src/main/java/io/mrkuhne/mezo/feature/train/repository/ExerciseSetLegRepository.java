package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Repository for {@link ExerciseSetLegEntity} (technique-set legs, mezo-r36n9.80). */
public interface ExerciseSetLegRepository extends JpaRepository<ExerciseSetLegEntity, UUID> {

    /** One batched read of the legs of many sets, ordered by set then leg. */
    List<ExerciseSetLegEntity> findByExerciseSetIdInOrderByExerciseSetIdAscLegIndexAsc(
        Collection<UUID> exerciseSetIds);

    default List<ExerciseSetLegEntity> findByExerciseSetIdIn(Collection<UUID> exerciseSetIds) {
        return exerciseSetIds.isEmpty()
            ? List.of() : findByExerciseSetIdInOrderByExerciseSetIdAscLegIndexAsc(exerciseSetIds);
    }

    /** Bulk delete of one set's legs (a bulk statement so a following re-insert never trips the unique leg index). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM ExerciseSetLegEntity l WHERE l.exerciseSetId = :setId")
    void deleteByExerciseSetId(@Param("setId") UUID setId);

    /** Best partials reps at one parent weight. */
    interface PartialsRow {
        BigDecimal getWeightKg();

        Integer getReps();
    }

    /**
     * Best partials-leg reps per parent weight for one exercise identity (key as
     * {@code ExerciseHistoryResolver.identityKey}), over LIVE, non-skipped parent working sets of COMPLETED, live workouts only — a soft-deleted
     * parent leaves its legs behind, so the parent's flag is the gate; an open workout never counts. Derived, never stored (ADR 0016).
     */
    @Query(value = """
        SELECT s.weight_kg AS "weightKg", MAX(l.reps) AS "reps"
        FROM exercise_set_leg l
        JOIN exercise_set s ON s.id = l.exercise_set_id
        JOIN exercise e ON e.id = s.exercise_id
        JOIN workout_session w ON w.id = s.workout_session_id
          AND w.status = 'completed' AND w.is_deleted = false
        WHERE s.created_by = :createdBy
          AND s.is_deleted = false
          AND s.skipped = false
          AND s.kind = 'working'
          AND l.kind = 'partials'
          AND l.reps IS NOT NULL
          AND s.weight_kg IS NOT NULL
          AND (CASE WHEN e.catalog_id IS NOT NULL THEN 'c:' || CAST(e.catalog_id AS text)
                    ELSE 'n:' || e.name END) = :identityKey
        GROUP BY s.weight_kg
        ORDER BY s.weight_kg
        """, nativeQuery = true)
    List<PartialsRow> bestPartialsPerWeight(
        @Param("createdBy") UUID createdBy,
        @Param("identityKey") String identityKey);
}
