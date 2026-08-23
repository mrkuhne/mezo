package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** W3.2 consolidation ladder (mezo-b3pp.13) — one row per finished week / month. */
public interface PeriodSummaryRepository extends JpaRepository<PeriodSummaryEntity, UUID> {

    /** The generator's idempotence probe — an existing period is returned, never regenerated. */
    Optional<PeriodSummaryEntity> findByCreatedByAndGranularityAndPeriodStart(
            UUID createdBy, String granularity, LocalDate periodStart);

    /** The monthly rung's source rows: every {@code week} row starting inside the month. */
    List<PeriodSummaryEntity> findByCreatedByAndGranularityAndPeriodStartBetweenOrderByPeriodStartAsc(
            UUID createdBy, String granularity, LocalDate from, LocalDate to);
}
