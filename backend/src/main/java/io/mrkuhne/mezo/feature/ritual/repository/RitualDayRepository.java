package io.mrkuhne.mezo.feature.ritual.repository;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RitualDayRepository extends JpaRepository<RitualDayEntity, UUID> {
    Optional<RitualDayEntity> findByCreatedByAndRitualDate(UUID createdBy, LocalDate ritualDate);
}
