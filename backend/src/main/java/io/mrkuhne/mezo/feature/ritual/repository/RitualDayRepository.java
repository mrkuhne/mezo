package io.mrkuhne.mezo.feature.ritual.repository;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RitualDayRepository extends JpaRepository<RitualDayEntity, UUID> {
    Optional<RitualDayEntity> findByCreatedByAndRitualDate(UUID createdBy, LocalDate ritualDate);

    /** Closed-only reads (mezo-b3pp.2): a row may now exist for a reflection alone, so
     *  "the day was closed" is `closed_at is not null`, never mere row existence. */
    Optional<RitualDayEntity> findByCreatedByAndRitualDateAndClosedAtIsNotNull(UUID createdBy, LocalDate ritualDate);

    List<RitualDayEntity> findByCreatedByAndRitualDateBetweenAndClosedAtIsNotNull(
        UUID createdBy, LocalDate from, LocalDate to);

    Optional<RitualDayEntity> findFirstByCreatedByAndClosedAtIsNotNullOrderByRitualDateAsc(UUID createdBy);

    /** Feature-abandonment usage reads (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §(17)): how
     *  much of this surface the user has EVER written, and whether anything landed inside the idle
     *  window. {@code @SQLRestriction} on the entity already excludes soft-deleted rows, which is
     *  why neither name carries an {@code AndDeletedFalse}. */
    long countByCreatedBy(UUID createdBy);

    boolean existsByCreatedByAndCreatedAtAfter(UUID createdBy, Instant createdAt);
}
