package io.mrkuhne.mezo.feature.capacity.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** One applied change to a day, stored beside the plan (the plan itself is never rewritten) (Boop B7 K1, mezo-r36n9.17). */
@Getter
@Setter
@Entity
@Table(name = "day_adjustment")
@SQLDelete(sql = "update day_adjustment set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DayAdjustmentEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false)
    private LocalDate date;

    /** {@link AdjustmentKind} name. */
    @Column(nullable = false, length = 24)
    private String kind;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @Column(name = "bundle_id", nullable = false)
    private UUID bundleId;

    @Column(name = "proposal_id")
    private UUID proposalId;

    /** active | undone | waiting | done | expired. */
    @Column(nullable = false, length = 8)
    private String state;

    private String reason;

    /** Idempotency key of the accepting request (unique per owner). */
    @Column(name = "client_ref", nullable = false)
    private UUID clientRef;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
