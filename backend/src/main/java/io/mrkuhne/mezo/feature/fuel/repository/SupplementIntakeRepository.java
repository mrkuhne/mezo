package io.mrkuhne.mezo.feature.fuel.repository;

import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The append-only supplement-intake ledger. Per-day reads are owner-scoped on the denormalized
 * {@code takenDate} and ordered by {@code takenAt}; {@link #findByIdAndCreatedByAndDeletedFalse}
 * resolves a single owned row (e.g. for delete). Soft-delete is respected.
 */
public interface SupplementIntakeRepository extends JpaRepository<SupplementIntakeEntity, UUID> {

    List<SupplementIntakeEntity> findByCreatedByAndTakenDateAndDeletedFalseOrderByTakenAtAsc(
        UUID createdBy, LocalDate takenDate);

    Optional<SupplementIntakeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Intakes since a date for the companion get_protocol_adherence tool (V0.5) — plain finder. */
    List<SupplementIntakeEntity> findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(
        UUID createdBy, LocalDate from);
}
