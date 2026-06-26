package io.mrkuhne.mezo.feature.medication.repository;

import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The medication catalog (Fuel "Gyógyszer"). Single-user, so the slice tracks ONE active medication
 * at a time: {@link #findFirstByCreatedByAndActiveTrueAndDeletedFalse} resolves the current entry.
 * Mirrors the {@code MealRepository} derived-query style; all finders are owner-scoped and respect
 * the soft-delete flag.
 */
public interface MedicationRepository extends JpaRepository<MedicationEntity, UUID> {

    Optional<MedicationEntity> findFirstByCreatedByAndActiveTrueAndDeletedFalse(UUID createdBy);

    Optional<MedicationEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
