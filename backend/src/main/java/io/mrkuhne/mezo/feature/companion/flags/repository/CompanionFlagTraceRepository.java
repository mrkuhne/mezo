package io.mrkuhne.mezo.feature.companion.flags.repository;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanionFlagTraceRepository extends JpaRepository<CompanionFlagTraceEntity, UUID> {

    /** The rule's most recent verdict — what a new evaluation is compared against. */
    Optional<CompanionFlagTraceEntity> findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(
        UUID createdBy, String flagKey);

    /** Everything that changed inside a window — the observer's day timeline. */
    List<CompanionFlagTraceEntity> findByCreatedByAndOccurredAtBetweenOrderByOccurredAtAsc(
        UUID createdBy, Instant from, Instant to);

    /**
     * A day's CLOSING state for one rule (spec 2026-09-05 §4.3): the last row at or before the end
     * of that day. The row may PREDATE the day — that is what "unchanged since" means, and is why
     * this is a cutoff read rather than a between-read.
     */
    Optional<CompanionFlagTraceEntity> findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
        UUID createdBy, String flagKey, Instant cutoff);

    /** The oldest traced moment for this user — the day pager's floor. Null when nothing is traced. */
    @Query("SELECT min(t.occurredAt) FROM CompanionFlagTraceEntity t WHERE t.createdBy = :createdBy")
    Instant earliestOccurredAt(@Param("createdBy") UUID createdBy);
}
