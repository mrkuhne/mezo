package io.mrkuhne.mezo.feature.ritual.repository;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RitualDayRepository extends JpaRepository<RitualDayEntity, UUID> {
    Optional<RitualDayEntity> findByCreatedByAndRitualDate(UUID createdBy, LocalDate ritualDate);

    List<RitualDayEntity> findByCreatedByAndRitualDateBetween(UUID createdBy, LocalDate from, LocalDate to);

    Optional<RitualDayEntity> findFirstByCreatedByOrderByRitualDateAsc(UUID createdBy);

    /** Closed-only reads (mezo-b3pp.2): a row may now exist for a reflection alone, so
     *  "the day was closed" is `closed_at is not null`, never mere row existence. */
    Optional<RitualDayEntity> findByCreatedByAndRitualDateAndClosedAtIsNotNull(UUID createdBy, LocalDate ritualDate);

    List<RitualDayEntity> findByCreatedByAndRitualDateBetweenAndClosedAtIsNotNull(
        UUID createdBy, LocalDate from, LocalDate to);

    Optional<RitualDayEntity> findFirstByCreatedByAndClosedAtIsNotNullOrderByRitualDateAsc(UUID createdBy);
}
