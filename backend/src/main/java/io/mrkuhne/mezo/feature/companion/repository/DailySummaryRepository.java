package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface DailySummaryRepository extends JpaRepository<DailySummaryEntity, UUID> {

    /** The nightly job's idempotence probe — soft-deleted rows don't count (regenerable). */
    boolean existsByCreatedByAndSummaryDate(UUID createdBy, LocalDate summaryDate);

    Optional<DailySummaryEntity> findByCreatedByAndSummaryDate(UUID createdBy, LocalDate summaryDate);
}
