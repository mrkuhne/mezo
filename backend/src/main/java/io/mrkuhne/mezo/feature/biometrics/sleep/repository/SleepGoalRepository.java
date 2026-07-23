package io.mrkuhne.mezo.feature.biometrics.sleep.repository;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton config row (no 'date' base field) => extend JpaRepository directly, not OwnedRepository.
public interface SleepGoalRepository extends JpaRepository<SleepGoalEntity, UUID> {

    Optional<SleepGoalEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
