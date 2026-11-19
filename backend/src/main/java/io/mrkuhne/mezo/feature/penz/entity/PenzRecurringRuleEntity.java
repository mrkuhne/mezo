package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
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
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A recurring income or fixed cost (the old app's RecurringRule). The HUF twin is booked once, at the rate of
 * {@code min(startDate, today)}, and stored like a transaction's.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_recurring_rule")
@SQLDelete(sql = "update penz_recurring_rule set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzRecurringRuleEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "name", nullable = false, length = 80)
    private String name;

    /** expense | income. */
    @Column(name = "kind", nullable = false, length = 8)
    private String kind;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "amount_huf_minor", nullable = false)
    private long amountHufMinor;

    @Column(name = "fx_rate", precision = 18, scale = 8)
    private BigDecimal fxRate;

    @Column(name = "fx_rate_date")
    private LocalDate fxRateDate;

    @Column(name = "category_id")
    private UUID categoryId;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    /** weekly | monthly | yearly. */
    @Column(name = "frequency", nullable = false, length = 8)
    private String frequency;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "last_materialized_date")
    private LocalDate lastMaterializedDate;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
