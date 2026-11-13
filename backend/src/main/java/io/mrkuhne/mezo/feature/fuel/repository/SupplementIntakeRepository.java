package io.mrkuhne.mezo.feature.fuel.repository;

import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * The append-only supplement-intake ledger. Per-day reads are owner-scoped on the denormalized
 * {@code takenDate} and ordered by {@code takenAt}; {@link #findByIdAndCreatedByAndDeletedFalse}
 * resolves a single owned row (e.g. for delete). Soft-delete is respected.
 */
public interface SupplementIntakeRepository extends JpaRepository<SupplementIntakeEntity, UUID> {

    List<SupplementIntakeEntity> findByCreatedByAndTakenDateAndDeletedFalseOrderByTakenAtAsc(
        UUID createdBy, LocalDate takenDate);

    Optional<SupplementIntakeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Intakes since a date for the companion get_protocol (scope=adherence) tool (V0.5) — plain finder. */
    List<SupplementIntakeEntity> findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(
        UUID createdBy, LocalDate from);

    Optional<SupplementIntakeEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    /** Race-safe insert for a Boop retry (see {@code MealRepository#insertIfClientRefAbsent}); 1 = created. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into supplement_intake (created_by, pantry_item_id, taken_at, taken_date, slot_key, dose, note, client_ref)
        values (:createdBy, :pantryItemId, :takenAt, :takenDate, :slotKey, :dose, :note, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfClientRefAbsent(@Param("createdBy") UUID createdBy, @Param("pantryItemId") UUID pantryItemId,
                                @Param("takenAt") Instant takenAt, @Param("takenDate") LocalDate takenDate,
                                @Param("slotKey") String slotKey, @Param("dose") String dose,
                                @Param("note") String note, @Param("clientRef") UUID clientRef);
}
