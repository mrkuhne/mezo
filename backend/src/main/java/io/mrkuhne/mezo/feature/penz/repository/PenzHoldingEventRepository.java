package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEventEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Portfolio events — owner-scoped, soonest first. */
public interface PenzHoldingEventRepository extends JpaRepository<PenzHoldingEventEntity, UUID> {

    List<PenzHoldingEventEntity> findByCreatedByAndDateGreaterThanEqualAndDeletedFalseOrderByDateAscCreatedAtAsc(
        UUID createdBy, LocalDate from);

    List<PenzHoldingEventEntity> findByCreatedByAndDateBetweenAndDeletedFalseOrderByDateAscCreatedAtAsc(
        UUID createdBy, LocalDate from, LocalDate to);

    Optional<PenzHoldingEventEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<PenzHoldingEventEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    /** Soft-deletes every live event of a holding (the holding is being deleted). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
        update penz_holding_event set is_deleted = true, updated_at = now()
        where created_by = :createdBy and holding_id = :holdingId and is_deleted = false
        """, nativeQuery = true)
    int softDeleteByHolding(@Param("createdBy") UUID createdBy, @Param("holdingId") UUID holdingId);

    /** The idempotent phone write; the caller reads it back by client ref. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_holding_event (created_by, holding_id, kind, date, amount_minor, currency, note, client_ref)
        values (:createdBy, :holdingId, :kind, :date, :amountMinor, :currency, :note, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("holdingId") UUID holdingId,
                       @Param("kind") String kind, @Param("date") LocalDate date,
                       @Param("amountMinor") Long amountMinor, @Param("currency") String currency,
                       @Param("note") String note, @Param("clientRef") UUID clientRef);
}
