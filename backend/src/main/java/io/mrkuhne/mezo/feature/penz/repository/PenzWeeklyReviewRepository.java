package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklyReviewEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * The owner's weekly long-horizon reviews (mezo-r36n9.120): one live row per owner and week. A rebuild (only after a
 * {@code failed} build) hard-deletes the week's row with {@link #purgeWeek} and saves the new one in the same
 * transaction, like {@link PenzDigestRepository#purgeDay}.
 */
public interface PenzWeeklyReviewRepository extends JpaRepository<PenzWeeklyReviewEntity, UUID> {

    Optional<PenzWeeklyReviewEntity> findByCreatedByAndWeekStartAndDeletedFalse(UUID createdBy, LocalDate weekStart);

    Optional<PenzWeeklyReviewEntity> findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(UUID createdBy);

    /** Removes the owner's review rows for {@code weekStart} (live or soft-deleted); returns how many went. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from penz_weekly_review where created_by = :createdBy and week_start = :weekStart",
        nativeQuery = true)
    int purgeWeek(@Param("createdBy") UUID createdBy, @Param("weekStart") LocalDate weekStart);
}
