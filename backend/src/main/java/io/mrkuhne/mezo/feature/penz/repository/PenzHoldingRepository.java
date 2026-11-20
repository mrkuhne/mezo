package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Holdings carry no {@code date}: bespoke owner-scoped finders. */
public interface PenzHoldingRepository extends JpaRepository<PenzHoldingEntity, UUID> {

    List<PenzHoldingEntity> findByCreatedByAndDeletedFalseOrderByPositionAscCreatedAtAsc(UUID createdBy);

    Optional<PenzHoldingEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<PenzHoldingEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    /** The next free position at the end of the owner's live holdings (0 for the first). */
    @Query(value = """
        select coalesce(max(position) + 1, 0) from penz_holding
        where created_by = :createdBy and is_deleted = false
        """, nativeQuery = true)
    int nextPosition(@Param("createdBy") UUID createdBy);

    /** Every live, non-archived holding of anyone — the news poll's search terms (no owner data leaves the run). */
    @Query(value = "select * from penz_holding where is_deleted = false and archived = false", nativeQuery = true)
    List<PenzHoldingEntity> findAllLive();

    /** Every quote symbol held (live, not archived) by anyone — what the daily refresh fetches. */
    @Query(value = """
        select distinct symbol from penz_holding
        where is_deleted = false and archived = false and symbol is not null
        """, nativeQuery = true)
    List<String> findAllHeldSymbols();

    /** Every non-HUF currency held (live, not archived) by anyone — its {@code CURHUF=X} pair is refreshed. */
    @Query(value = """
        select distinct currency from penz_holding
        where is_deleted = false and archived = false and currency <> 'HUF'
        """, nativeQuery = true)
    List<String> findAllHeldForeignCurrencies();

    /**
     * The idempotent phone write: inserts unless the owner already has a live holding with this {@code clientRef}.
     * {@code newsTerms} is a JSON array text. The caller reads it back by client ref.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_holding (created_by, name, asset_type, symbol, platform, platform_name, sleeve, currency,
                                  bond_rate_pct, news_terms, note, position, archived, client_ref)
        values (:createdBy, :name, :assetType, :symbol, :platform, :platformName, :sleeve, :currency,
                :bondRatePct, cast(:newsTerms as jsonb), :note, :position, :archived, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("name") String name,
                       @Param("assetType") String assetType, @Param("symbol") String symbol,
                       @Param("platform") String platform, @Param("platformName") String platformName,
                       @Param("sleeve") String sleeve, @Param("currency") String currency,
                       @Param("bondRatePct") BigDecimal bondRatePct, @Param("newsTerms") String newsTerms,
                       @Param("note") String note, @Param("position") int position,
                       @Param("archived") boolean archived, @Param("clientRef") UUID clientRef);
}
