package io.mrkuhne.mezo.feature.nutrition.repository;

import io.mrkuhne.mezo.feature.nutrition.entity.SensitivityProfileEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton config row (no 'date' base field) => extend JpaRepository directly, not OwnedRepository.
public interface SensitivityProfileRepository extends JpaRepository<SensitivityProfileEntity, UUID> {

    Optional<SensitivityProfileEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
