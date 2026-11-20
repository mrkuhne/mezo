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
 * One buy or sell of a holding (Boop Pénz L6, mezo-r36n9.104). {@code amountMinor} is the total paid / received in
 * the holding's currency; {@code amountHufMinor} its HUF twin booked once at the transaction's date (L4 FX policy).
 */
@Getter
@Setter
@Entity
@Table(name = "penz_invest_txn")
@SQLDelete(sql = "update penz_invest_txn set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzInvestTxnEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "holding_id", nullable = false)
    private UUID holdingId;

    /** buy | sell. */
    @Column(name = "side", nullable = false, length = 4)
    private String side;

    @Column(name = "quantity", precision = 24, scale = 8)
    private BigDecimal quantity;

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

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "client_ref")
    private UUID clientRef;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
