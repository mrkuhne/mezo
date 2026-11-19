package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.GymProfileEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton config row (no 'date' base field) => extend JpaRepository directly, not OwnedRepository.
public interface GymProfileRepository extends JpaRepository<GymProfileEntity, UUID> {

    Optional<GymProfileEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
