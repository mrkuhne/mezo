package io.mrkuhne.mezo.feature.fuel.repository;

import io.mrkuhne.mezo.feature.fuel.entity.FuelSettingsEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton config row (no 'date' base field) => extend JpaRepository directly, not OwnedRepository.
public interface FuelSettingsRepository extends JpaRepository<FuelSettingsEntity, UUID> {

    Optional<FuelSettingsEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
