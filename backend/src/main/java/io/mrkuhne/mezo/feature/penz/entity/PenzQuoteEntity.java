package io.mrkuhne.mezo.feature.penz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/**
 * The GLOBAL quote cache (not owned), one row per symbol — a security or an FX pair like {@code EURHUF=X}. A
 * per-unit market price in major units of {@code currency}, not ledger money. {@code asOf} is the Europe/Budapest
 * date of {@code marketTime}. Written only through the native upsert of {@code PenzQuoteRepository}.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_quote")
public class PenzQuoteEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "price", nullable = false, precision = 24, scale = 8)
    private BigDecimal price;

    @Column(name = "previous_close", precision = 24, scale = 8)
    private BigDecimal previousClose;

    @Column(name = "market_time", nullable = false)
    private Instant marketTime;

    @Column(name = "as_of", nullable = false)
    private LocalDate asOf;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;
}
