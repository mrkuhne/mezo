package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzPaperTradeEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Paper trades — owner-scoped, paper rows only (phase 1 holds nothing else). */
public interface PenzPaperTradeRepository extends JpaRepository<PenzPaperTradeEntity, UUID> {

    List<PenzPaperTradeEntity> findByCreatedByAndPaperTrueAndDeletedFalseOrderByCreatedAtAsc(UUID createdBy);

    Optional<PenzPaperTradeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<PenzPaperTradeEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    /**
     * The per-owner practice lock (L7 review I2, the {@code TeamChatThreadRepository.lockPushBudget} idiom): a
     * transaction-scoped advisory lock that serializes one owner's opens, so two concurrent opens can never both read
     * the same "left" of the cap. Released on commit / rollback; a hash collision only costs a brief wait.
     */
    @Query(value = "select pg_advisory_xact_lock(hashtext('penz_practice:' || cast(:owner as text)))",
        nativeQuery = true)
    void lockOwner(@Param("owner") UUID owner);

    /** The idempotent phone write of a plan; the caller reads it back by client ref. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_paper_trade (created_by, paper, status, instrument, direction, why, currency, quantity,
                                      planned_entry_minor, stop_minor, target_minor, fx_rate, fx_rate_date, client_ref)
        values (:createdBy, true, 'planned', :instrument, :direction, :why, :currency, :quantity,
                :plannedEntryMinor, :stopMinor, :targetMinor, :fxRate, :fxRateDate, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("instrument") String instrument,
                       @Param("direction") String direction, @Param("why") String why,
                       @Param("currency") String currency, @Param("quantity") BigDecimal quantity,
                       @Param("plannedEntryMinor") Long plannedEntryMinor, @Param("stopMinor") long stopMinor,
                       @Param("targetMinor") Long targetMinor, @Param("fxRate") BigDecimal fxRate,
                       @Param("fxRateDate") LocalDate fxRateDate, @Param("clientRef") UUID clientRef);
}
