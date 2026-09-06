package io.mrkuhne.mezo.feature.journal.repository;

import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GratitudeEntryRepository extends JpaRepository<GratitudeEntryEntity, UUID> {

    Optional<GratitudeEntryEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<GratitudeEntryEntity> findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** Feature-abandonment usage reads (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §(17)): how
     *  much of this surface the user has EVER written, and whether anything landed inside the idle
     *  window. {@code @SQLRestriction} on the entity already excludes soft-deleted rows, which is
     *  why neither name carries an {@code AndDeletedFalse}. */
    long countByCreatedBy(UUID createdBy);

    boolean existsByCreatedByAndCreatedAtAfter(UUID createdBy, Instant createdAt);
}
