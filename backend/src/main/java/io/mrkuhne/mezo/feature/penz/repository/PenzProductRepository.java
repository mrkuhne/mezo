package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzProductEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The owner's catalog products (mezo-r36n9.105). */
public interface PenzProductRepository extends JpaRepository<PenzProductEntity, UUID> {

    List<PenzProductEntity> findByCreatedByAndDeletedFalseOrderByNameAsc(UUID createdBy);

    Optional<PenzProductEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /**
     * Inserts one research seed row unless this owner already had it (deleted rows count — the unique index
     * {@code uq_penz_product_created_by_seed_key} has no is_deleted filter). The sleeves come as a JSON array text.
     */
    @Modifying
    @Query(value = """
        insert into penz_product (created_by, seed_key, name, kind, currency, sleeves, what_it_is, ter_pct,
            entry_fee_pct, fee_note, distribution, isin, symbol, source_name, source_url, reviewed_at, status,
            suggested_by)
        values (:createdBy, :seedKey, :name, :kind, :currency, cast(:sleeves as jsonb), :whatItIs, :terPct,
            :entryFeePct, :feeNote, :distribution, :isin, :symbol, :sourceName, :sourceUrl, :reviewedAt, 'suggested',
            'research')
        on conflict (created_by, seed_key) where seed_key is not null do nothing
        """, nativeQuery = true)
    int insertSeed(@Param("createdBy") UUID createdBy, @Param("seedKey") String seedKey, @Param("name") String name,
                   @Param("kind") String kind, @Param("currency") String currency, @Param("sleeves") String sleeves,
                   @Param("whatItIs") String whatItIs, @Param("terPct") BigDecimal terPct,
                   @Param("entryFeePct") BigDecimal entryFeePct, @Param("feeNote") String feeNote,
                   @Param("distribution") String distribution, @Param("isin") String isin,
                   @Param("symbol") String symbol, @Param("sourceName") String sourceName,
                   @Param("sourceUrl") String sourceUrl, @Param("reviewedAt") LocalDate reviewedAt);
}
