package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PredictionRepository extends JpaRepository<PredictionEntity, UUID> {

    /** The weekly generation's idempotence probe (n rows per week — existence, not uniqueness). */
    boolean existsByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);

    /** The GET's read: all live predictions, newest validity window first. */
    List<PredictionEntity> findByCreatedByOrderByValidFromDescGeneratedAtDesc(UUID createdBy);

    /** The validation run's read: pending rows whose window has closed. */
    List<PredictionEntity> findByCreatedByAndStatusAndValidToBefore(
            UUID createdBy, String status, LocalDate validTo);
}
