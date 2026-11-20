package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzInvestTxnEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Investment transactions — owner-scoped finders, always by holding or by owner (creation order for the lots). */
public interface PenzInvestTxnRepository extends JpaRepository<PenzInvestTxnEntity, UUID> {

    List<PenzInvestTxnEntity> findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(UUID createdBy,
                                                                                          UUID holdingId);

    List<PenzInvestTxnEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtAsc(UUID createdBy);

    Optional<PenzInvestTxnEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<PenzInvestTxnEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    boolean existsByCreatedByAndHoldingIdAndDeletedFalse(UUID createdBy, UUID holdingId);

    /** Whether a live investment transaction holds this money row as its link (mezo-r36n9.119). */
    boolean existsByCreatedByAndTransactionIdAndDeletedFalse(UUID createdBy, UUID transactionId);

    /** The live investment transactions linked to any of these money rows. */
    List<PenzInvestTxnEntity> findByCreatedByAndTransactionIdInAndDeletedFalse(UUID createdBy,
                                                                             Collection<UUID> transactionIds);

    /** Soft-deletes every live transaction of a holding (the holding is being deleted). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
        update penz_invest_txn set is_deleted = true, updated_at = now()
        where created_by = :createdBy and holding_id = :holdingId and is_deleted = false
        """, nativeQuery = true)
    int softDeleteByHolding(@Param("createdBy") UUID createdBy, @Param("holdingId") UUID holdingId);

    /** The idempotent phone write; the caller reads it back by client ref. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_invest_txn (created_by, holding_id, side, quantity, amount_minor, currency, amount_huf_minor,
                                     fx_rate, fx_rate_date, date, note, client_ref)
        values (:createdBy, :holdingId, :side, :quantity, :amountMinor, :currency, :amountHufMinor,
                :fxRate, :fxRateDate, :date, :note, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("holdingId") UUID holdingId,
                       @Param("side") String side, @Param("quantity") BigDecimal quantity,
                       @Param("amountMinor") long amountMinor, @Param("currency") String currency,
                       @Param("amountHufMinor") long amountHufMinor, @Param("fxRate") BigDecimal fxRate,
                       @Param("fxRateDate") LocalDate fxRateDate, @Param("date") LocalDate date,
                       @Param("note") String note, @Param("clientRef") UUID clientRef);
}
