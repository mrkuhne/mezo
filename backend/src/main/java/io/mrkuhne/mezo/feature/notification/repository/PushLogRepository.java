package io.mrkuhne.mezo.feature.notification.repository;

import io.mrkuhne.mezo.feature.notification.entity.PushLogEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Owner-scoped dedup-ledger lookups. Not OwnedRepository — this entity's date field is `logDate`, not `date`. */
public interface PushLogRepository extends JpaRepository<PushLogEntity, UUID> {

    List<PushLogEntity> findByCreatedByAndLogDate(UUID createdBy, LocalDate logDate);

    boolean existsByCreatedByAndLogDateAndDedupKey(UUID createdBy, LocalDate logDate, String dedupKey);

    /** S6 (bd mezo-d58h.6, {@code ignored_nudge}): bounded date-range read for one category —
     *  the sibling to {@link #findByCreatedByAndLogDate}, ranged instead of single-day. */
    List<PushLogEntity> findByCreatedByAndCategoryAndLogDateBetween(
            UUID createdBy, String category, LocalDate from, LocalDate to);
}
