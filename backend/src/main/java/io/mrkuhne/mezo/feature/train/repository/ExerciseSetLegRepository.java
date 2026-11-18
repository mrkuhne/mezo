package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link ExerciseSetLegEntity} (technique-set legs, mezo-r36n9.80). */
public interface ExerciseSetLegRepository extends JpaRepository<ExerciseSetLegEntity, UUID> {

    /** One batched read of the legs of many sets, ordered by set then leg. */
    List<ExerciseSetLegEntity> findByExerciseSetIdInOrderByExerciseSetIdAscLegIndexAsc(
        Collection<UUID> exerciseSetIds);

    default List<ExerciseSetLegEntity> findByExerciseSetIdIn(Collection<UUID> exerciseSetIds) {
        return exerciseSetIds.isEmpty()
            ? List.of() : findByExerciseSetIdInOrderByExerciseSetIdAscLegIndexAsc(exerciseSetIds);
    }
}
