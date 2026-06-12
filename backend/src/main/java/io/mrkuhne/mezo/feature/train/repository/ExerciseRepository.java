package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Repository for {@link ExerciseEntity}. Extends {@link JpaRepository} directly rather than the
 * house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a {@code date} field
 * this entity does not carry; exercises are ordered within a session by {@code orderIndex}.
 */
public interface ExerciseRepository extends JpaRepository<ExerciseEntity, UUID> {

    List<ExerciseEntity> findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
        UUID createdBy, Collection<UUID> workoutSessionIds);

    /**
     * Identity projection over ALL exercise rows of the owner — including soft-deleted ones.
     * Day-edit full-replace soft-deletes template rows while their logged sets stay live, so
     * record aggregation must resolve identity past {@code @SQLRestriction}; hence native SQL.
     */
    interface ExerciseIdentityRow {
        UUID getId();
        String getName();
        String getMuscle();
        String getType();
        UUID getCatalogId();
        Instant getCreatedAt();
    }

    @Query(value = "SELECT id, name, muscle, type, catalog_id AS \"catalogId\", created_at AS \"createdAt\" "
        + "FROM exercise WHERE created_by = :createdBy", nativeQuery = true)
    List<ExerciseIdentityRow> findIdentityRowsIncludingDeleted(@Param("createdBy") UUID createdBy);
}
