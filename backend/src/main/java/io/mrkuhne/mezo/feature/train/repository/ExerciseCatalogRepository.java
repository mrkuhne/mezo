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
}
