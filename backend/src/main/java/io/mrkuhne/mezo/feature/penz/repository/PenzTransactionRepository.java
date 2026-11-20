package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Transactions carry {@code date}, so {@code findAllOwned} works; every other finder is owner-scoped too. */
public interface PenzTransactionRepository extends OwnedRepository<PenzTransactionEntity> {

    List<PenzTransactionEntity> findByCreatedByAndDateBetweenAndDeletedFalseOrderByDateDescCreatedAtDesc(
        UUID createdBy, LocalDate from, LocalDate to);

    Optional<PenzTransactionEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Whether the account carries any live transaction (its currency is then locked, mezo-r36n9.108). */
    boolean existsByAccountIdAndDeletedFalse(UUID accountId);

    Optional<PenzTransactionEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    List<PenzTransactionEntity> findByCreatedByAndTransferPairIdAndDeletedFalse(UUID createdBy, UUID transferPairId);

    /** 'YYYY-MM' of every month before {@code before} in which the owner has a live transaction, oldest first. */
    @Query(value = """
        select distinct to_char(date, 'YYYY-MM') from penz_transaction
        where created_by = :createdBy and is_deleted = false and date < :before
        order by 1
        """, nativeQuery = true)
    List<String> findMonthsWithTransactionsBefore(@Param("createdBy") UUID createdBy, @Param("before") LocalDate before);

    /**
     * The idempotent phone write: inserts the row unless the owner already has a live one with this
     * {@code clientRef} (a retry, or a concurrent duplicate). The caller reads it back by client ref.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_transaction (created_by, account_id, kind, amount_minor, currency, amount_huf_minor,
                                      fx_rate, fx_rate_date, category_id, date, note, source, needs_review,
                                      transfer_pair_id, client_ref)
        values (:createdBy, :accountId, :kind, :amountMinor, :currency, :amountHufMinor,
                :fxRate, :fxRateDate, :categoryId, :date, :note, :source, :needsReview,
                :transferPairId, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("accountId") UUID accountId,
                       @Param("kind") String kind, @Param("amountMinor") long amountMinor,
                       @Param("currency") String currency, @Param("amountHufMinor") long amountHufMinor,
                       @Param("fxRate") BigDecimal fxRate, @Param("fxRateDate") LocalDate fxRateDate,
                       @Param("categoryId") UUID categoryId, @Param("date") LocalDate date,
                       @Param("note") String note, @Param("source") String source,
                       @Param("needsReview") boolean needsReview, @Param("transferPairId") UUID transferPairId,
                       @Param("clientRef") UUID clientRef);

    /**
     * Materializes one occurrence of a recurring rule (source {@code recurring}, {@code needs_review} false) unless
     * the rule already has a live row on that date — the partial unique index
     * {@code uq_penz_transaction_recurring_rule_id_date}. Returns 1 when written, 0 when it was already there.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_transaction (created_by, account_id, kind, amount_minor, currency, amount_huf_minor,
                                      fx_rate, fx_rate_date, category_id, date, source, needs_review,
                                      recurring_rule_id)
        values (:createdBy, :accountId, :kind, :amountMinor, :currency, :amountHufMinor,
                :fxRate, :fxRateDate, :categoryId, :date, 'recurring', false, :recurringRuleId)
        on conflict (recurring_rule_id, date) where recurring_rule_id is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertRecurringIfAbsent(@Param("createdBy") UUID createdBy, @Param("accountId") UUID accountId,
                                @Param("kind") String kind, @Param("amountMinor") long amountMinor,
                                @Param("currency") String currency, @Param("amountHufMinor") long amountHufMinor,
                                @Param("fxRate") BigDecimal fxRate, @Param("fxRateDate") LocalDate fxRateDate,
                                @Param("categoryId") UUID categoryId, @Param("date") LocalDate date,
                                @Param("recurringRuleId") UUID recurringRuleId);
}
