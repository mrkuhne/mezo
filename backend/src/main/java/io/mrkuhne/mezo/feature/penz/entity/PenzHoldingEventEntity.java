package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * An owner-entered date on the forward timeline (Boop Pénz L6, mezo-r36n9.104): maturity, coupon, dividend,
 * earnings or other. The optional amount is in the holding's currency.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_holding_event")
@SQLDelete(sql = "update penz_holding_event set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzHoldingEventEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "holding_id", nullable = false)
    private UUID holdingId;

    /** maturity | coupon | dividend | earnings | other. */
    @Column(name = "kind", nullable = false, length = 9)
    private String kind;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "amount_minor")
    private Long amountMinor;

    @Column(name = "currency", length = 3)
    private String currency;

    @Column(name = "note", length = 200)
    private String note;

    @Column(name = "client_ref")
    private UUID clientRef;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
