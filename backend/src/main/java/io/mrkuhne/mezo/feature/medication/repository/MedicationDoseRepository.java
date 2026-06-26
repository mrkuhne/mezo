package io.mrkuhne.mezo.feature.medication.repository;

import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The append-only intake ledger for a {@link MedicationDoseEntity}. {@code medicationId} is a plain
 * UUID column (not a JPA association), so derived finders work directly. All finders are owner-scoped
 * and respect the soft-delete flag. Mirrors the {@code MealItemRepository} derived-query style.
 */
public interface MedicationDoseRepository extends JpaRepository<MedicationDoseEntity, UUID> {

    List<MedicationDoseEntity>
        findTop10ByCreatedByAndMedicationIdAndDeletedFalseOrderByAdministeredAtDesc(
            UUID createdBy, UUID medicationId);

    Optional<MedicationDoseEntity>
        findFirstByCreatedByAndMedicationIdAndDeletedFalseAndAdministeredDateLessThanEqualOrderByAdministeredDateDesc(
            UUID createdBy, UUID medicationId, LocalDate administeredDate);

    Optional<MedicationDoseEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
