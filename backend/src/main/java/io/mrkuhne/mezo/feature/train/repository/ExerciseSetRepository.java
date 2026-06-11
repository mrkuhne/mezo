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
}
