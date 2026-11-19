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
 * The GLOBAL exchange-rate cache (not owned): {@code rate} = {@code quote} per one {@code base} as asked for
 * {@code rateDate}; {@code publishedDate} is the ECB publication date the provider answered with (≤ rateDate).
 * Written only through the native ON CONFLICT insert of {@code PenzFxRateRepository}.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_fx_rate")
public class PenzFxRateEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "base", nullable = false, length = 3)
    private String base;

    @Column(name = "quote", nullable = false, length = 3)
    private String quote;

    @Column(name = "rate_date", nullable = false)
    private LocalDate rateDate;

    @Column(name = "published_date", nullable = false)
    private LocalDate publishedDate;

    @Column(name = "rate", nullable = false, precision = 18, scale = 8)
    private BigDecimal rate;
}
