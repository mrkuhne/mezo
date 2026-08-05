package io.mrkuhne.mezo.feature.fuel.repository;

import io.mrkuhne.mezo.feature.fuel.entity.MealSlotTemplateEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton-per-(user, dayType) rows (no 'date' base field) => extend JpaRepository directly,
// the same FuelSettingsRepository note applies.
public interface MealSlotTemplateRepository extends JpaRepository<MealSlotTemplateEntity, UUID> {

    List<MealSlotTemplateEntity> findAllByCreatedByAndDeletedFalse(UUID createdBy);

    Optional<MealSlotTemplateEntity> findByCreatedByAndDayTypeAndDeletedFalse(UUID createdBy, String dayType);
}
