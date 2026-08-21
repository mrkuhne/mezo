package io.mrkuhne.mezo.feature.activity.repository;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityLogRepository extends JpaRepository<ActivityLogEntity, UUID> {

    /** Day read (newest first) — also the cap-computation input (xpAwarded sums in code). */
    List<ActivityLogEntity> findByCreatedByAndOccurredOnOrderByCreatedAtDesc(UUID createdBy, LocalDate occurredOn);

    /** Owned lookup for the categorize path. */
    Optional<ActivityLogEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    /** Window read for growth aggregates (entry count + financial amount sums in code). */
    List<ActivityLogEntity> findByCreatedByAndOccurredOnBetween(UUID createdBy, LocalDate from, LocalDate to);

    /**
     * W1.5 note-embedding candidates (mezo-b3pp.5): live entries up to and including {@code through},
     * long enough to carry retrieval value, oldest first — the nightly sweep embeds history in the
     * order it was lived. {@code @SQLRestriction} keeps soft-deleted rows out.
     */
    @Query("""
        select a from ActivityLogEntity a
        where a.createdBy = :createdBy and a.occurredOn <= :through and length(a.text) >= :minChars
        order by a.occurredOn asc, a.createdAt asc
        """)
    List<ActivityLogEntity> findNoteCandidates(@Param("createdBy") UUID createdBy,
                                               @Param("through") LocalDate through,
                                               @Param("minChars") int minChars);
}
