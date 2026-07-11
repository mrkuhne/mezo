package io.mrkuhne.mezo.feature.activity.repository;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityLogRepository extends JpaRepository<ActivityLogEntity, UUID> {

    /** Day read (newest first) — also the cap-computation input (xpAwarded sums in code). */
    List<ActivityLogEntity> findByCreatedByAndOccurredOnOrderByCreatedAtDesc(UUID createdBy, LocalDate occurredOn);

    /** Owned lookup for the categorize path. */
    Optional<ActivityLogEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    /** Window read for growth aggregates (entry count + financial amount sums in code). */
    List<ActivityLogEntity> findByCreatedByAndOccurredOnBetween(UUID createdBy, LocalDate from, LocalDate to);
}
