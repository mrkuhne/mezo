package io.mrkuhne.mezo.feature.needs.repository;

import io.mrkuhne.mezo.feature.needs.entity.NeedsDayEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NeedsDayRepository extends JpaRepository<NeedsDayEntity, UUID> {

    Optional<NeedsDayEntity> findByCreatedByAndNeedsDateAndDeletedFalse(UUID createdBy, LocalDate needsDate);

    Optional<NeedsDayEntity> findFirstByCreatedByAndDeletedFalseOrderByNeedsDateDesc(UUID createdBy);

    List<NeedsDayEntity> findByCreatedByAndNeedsDateBetweenAndDeletedFalseOrderByNeedsDateAsc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** Feature-abandonment usage reads (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §(17)): how
     *  much of this surface the user has EVER written, and whether anything landed inside the idle
     *  window. {@code @SQLRestriction} on the entity already excludes soft-deleted rows, which is
     *  why neither name carries an {@code AndDeletedFalse}. */
    long countByCreatedBy(UUID createdBy);

    boolean existsByCreatedByAndCreatedAtAfter(UUID createdBy, Instant createdAt);
}
