package io.mrkuhne.mezo.feature.nutrition.repository;

import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton config row (no 'date' base field) => extend JpaRepository directly, not OwnedRepository.
public interface DietSettingsRepository extends JpaRepository<DietSettingsEntity, UUID> {

    Optional<DietSettingsEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
