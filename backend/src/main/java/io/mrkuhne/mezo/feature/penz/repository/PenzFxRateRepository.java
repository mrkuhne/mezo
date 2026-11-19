package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzFxRateEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** The global rate cache — not owned, no soft delete. */
public interface PenzFxRateRepository extends JpaRepository<PenzFxRateEntity, UUID> {

    Optional<PenzFxRateEntity> findByBaseAndQuoteAndRateDate(String base, String quote, LocalDate rateDate);

    /** The newest cached rate asked for a date in {@code from … to} — the provider-down fallback. */
    Optional<PenzFxRateEntity> findFirstByBaseAndQuoteAndRateDateBetweenOrderByRateDateDesc(
        String base, String quote, LocalDate from, LocalDate to);

    /** Caches one fetched rate; a concurrent fetch of the same (base, quote, date) is a no-op. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_fx_rate (base, quote, rate_date, published_date, rate)
        values (:base, :quote, :rateDate, :publishedDate, :rate)
        on conflict (base, quote, rate_date) do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("base") String base, @Param("quote") String quote, @Param("rateDate") LocalDate rateDate,
                       @Param("publishedDate") LocalDate publishedDate, @Param("rate") BigDecimal rate);
}
