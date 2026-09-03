package io.mrkuhne.mezo.feature.tutorial.repository;

import io.mrkuhne.mezo.feature.tutorial.entity.TutorialProgressEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton row per owner (no 'date' base field) => JpaRepository directly, like FuelSettingsRepository.
public interface TutorialProgressRepository extends JpaRepository<TutorialProgressEntity, UUID> {

    Optional<TutorialProgressEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
