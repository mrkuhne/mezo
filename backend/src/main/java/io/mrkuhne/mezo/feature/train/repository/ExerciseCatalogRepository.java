package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for the {@link ExerciseCatalogEntity} master-data table. No ownership scoping —
 * the catalog is content shared by every environment (the GET endpoint still sits behind auth).
 */
public interface ExerciseCatalogRepository extends JpaRepository<ExerciseCatalogEntity, UUID> {

    Optional<ExerciseCatalogEntity> findBySlug(String slug);

    List<ExerciseCatalogEntity> findAllByOrderByMuscleAscNameAsc();

    /**
     * Exact-slug existence against the PHYSICAL table — native so it bypasses the entity's
     * {@code @SQLRestriction} soft-delete filter and still sees slugs occupied by soft-deleted rows
     * (which continue to hold the {@code UNIQUE(slug)} constraint). Drives unique-slug generation.
     */
    @org.springframework.data.jpa.repository.Query(
        value = "SELECT count(*) FROM exercise_catalog WHERE slug = :slug", nativeQuery = true)
    long countAllBySlugIncludingDeleted(@org.springframework.data.repository.query.Param("slug") String slug);
}
