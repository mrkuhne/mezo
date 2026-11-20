package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzQuoteEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** The global quote cache, one row per symbol. */
public interface PenzQuoteRepository extends JpaRepository<PenzQuoteEntity, UUID> {

    Optional<PenzQuoteEntity> findBySymbol(String symbol);

    List<PenzQuoteEntity> findBySymbolIn(Collection<String> symbols);

    /** Writes the latest quote of a symbol (insert, or overwrite the cached row). */
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
        insert into penz_quote (symbol, currency, price, previous_close, market_time, as_of, fetched_at)
        values (:symbol, :currency, :price, :previousClose, :marketTime, :asOf, :fetchedAt)
        on conflict (symbol) do update set currency = excluded.currency, price = excluded.price,
            previous_close = excluded.previous_close, market_time = excluded.market_time, as_of = excluded.as_of,
            fetched_at = excluded.fetched_at, updated_at = now()
        """, nativeQuery = true)
    int upsert(@Param("symbol") String symbol, @Param("currency") String currency, @Param("price") BigDecimal price,
               @Param("previousClose") BigDecimal previousClose, @Param("marketTime") Instant marketTime,
               @Param("asOf") LocalDate asOf, @Param("fetchedAt") Instant fetchedAt);

    /** A failed or symbol-less fetch: the cached price stays, only the attempt time moves (the refetch throttle). */
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "update penz_quote set fetched_at = :fetchedAt, updated_at = now() where symbol = :symbol",
        nativeQuery = true)
    int touch(@Param("symbol") String symbol, @Param("fetchedAt") Instant fetchedAt);
}
