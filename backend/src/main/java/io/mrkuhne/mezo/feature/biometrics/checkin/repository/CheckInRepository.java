package io.mrkuhne.mezo.feature.biometrics.checkin.repository;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CheckInRepository extends OwnedRepository<CheckInEntity> {
    List<CheckInEntity> findByCreatedByAndDateOrderBySlotTime(UUID createdBy, LocalDate date);

    Optional<CheckInEntity> findByCreatedByAndDateAndSlotTime(UUID createdBy, LocalDate date, String slotTime);
}
