package io.mrkuhne.mezo.feature.companion.flags.repository;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanionFlagTraceRepository extends JpaRepository<CompanionFlagTraceEntity, UUID> {

    /** The rule's most recent verdict — what a new evaluation is compared against. */
    Optional<CompanionFlagTraceEntity> findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(
        UUID createdBy, String flagKey);

    /** Everything that changed inside a window — the observer's day timeline. */
    List<CompanionFlagTraceEntity> findByCreatedByAndOccurredAtBetweenOrderByOccurredAtAsc(
        UUID createdBy, Instant from, Instant to);
}
