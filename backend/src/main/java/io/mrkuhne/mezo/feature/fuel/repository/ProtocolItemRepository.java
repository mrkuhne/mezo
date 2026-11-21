package io.mrkuhne.mezo.feature.fuel.repository;

import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * The normalized selection rows of a {@link ProtocolItemEntity protocol}. Reads are protocol-scoped
 * and ordered by {@code itemOrder} to reconstruct the built stack in position order; soft-delete is
 * respected.
 */
public interface ProtocolItemRepository extends JpaRepository<ProtocolItemEntity, UUID> {

    List<ProtocolItemEntity> findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(UUID protocolId);

    Optional<ProtocolItemEntity> findByProtocolIdAndPantryItemIdAndSlotKeyAndDeletedFalse(
        UUID protocolId, UUID pantryItemId, String slotKey);

    /**
     * Pantry items newly in the live stack (Boop B6 Évad S4 experiment proposals, mezo-r36n9.16): a live item of
     * the active protocol added on or after {@code since} whose pantry item was never in the stack before — removed
     * (soft-deleted) rows count as "was in the stack", hence native.
     */
    @Query(value = """
        select distinct pi.pantry_item_id from protocol_item pi
        join protocol p on p.id = pi.protocol_id and p.status = 'active' and p.is_deleted = false
        where pi.created_by = :owner and pi.is_deleted = false and pi.created_at >= :since
          and not exists (select 1 from protocol_item o
                          where o.created_by = :owner and o.pantry_item_id = pi.pantry_item_id
                            and o.created_at < :since)
        """, nativeQuery = true)
    List<UUID> findNewInStackSince(@Param("owner") UUID owner, @Param("since") Instant since);

    /** The owner's live stack items added on or after {@code since} (their add days). */
    List<ProtocolItemEntity> findByCreatedByAndDeletedFalseAndCreatedAtGreaterThanEqual(UUID owner, Instant since);
}
