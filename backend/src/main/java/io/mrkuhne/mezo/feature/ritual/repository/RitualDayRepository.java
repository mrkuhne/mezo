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
}
