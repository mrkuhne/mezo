package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklyReviewRepository extends JpaRepository<WeeklyReviewEntity, UUID> {

    Optional<WeeklyReviewEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);

    /** The trailing window behind {@code HighlightCitationSourceAdapter} — live rows only
     *  ({@code @SQLRestriction}), one per week (partial unique), so the row count IS the week
     *  count. */
    List<WeeklyReviewEntity> findByCreatedByAndWeekStartGreaterThanEqual(UUID createdBy, LocalDate from);

    /** {@code CharacterHistoryReads}' bootstrap-corpus read (mezo-1gim.7): newest-first so the
     *  caller can cap at the newest N without an extra sort. */
    List<WeeklyReviewEntity> findByCreatedByAndWeekStartGreaterThanEqualOrderByWeekStartDesc(
        UUID createdBy, LocalDate from);
}
