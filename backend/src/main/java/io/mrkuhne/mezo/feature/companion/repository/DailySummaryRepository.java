package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DailySummaryRepository extends JpaRepository<DailySummaryEntity, UUID> {

    /** The nightly job's idempotence probe — soft-deleted rows don't count (regenerable). */
    boolean existsByCreatedByAndSummaryDate(UUID createdBy, LocalDate summaryDate);

    Optional<DailySummaryEntity> findByCreatedByAndSummaryDate(UUID createdBy, LocalDate summaryDate);

    /** The weekly hypothesis pipeline's context window (V3.2) — the last 7 narratives. */
    List<DailySummaryEntity> findTop7ByCreatedByOrderBySummaryDateDesc(UUID createdBy);

    /** The proactive briefing's past-narrative window (B1.1) — newest first. */
    List<DailySummaryEntity> findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
            UUID createdBy, LocalDate from);
}
