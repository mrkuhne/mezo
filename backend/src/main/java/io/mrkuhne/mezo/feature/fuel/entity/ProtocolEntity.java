package io.mrkuhne.mezo.feature.fuel.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A versioned supplement Stack/Protocol (Fuel). Persists ONLY the selection + version metadata —
 * timing slots are recomputed by the FE {@code buildProtocol}, so there is no slot snapshot here.
 * Single active protocol per user (partial unique index {@code uq_protocol_active_per_user});
 * superseding bumps {@code version} and flips the prior row's {@code status} to {@code superseded}.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 * There is no {@code updated_at} column, hence no {@code @UpdateTimestamp} field.
 */
@Getter
@Setter
@Entity
@Table(name = "protocol")
@SQLDelete(sql = "update protocol set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ProtocolEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private Integer version;

    @NotNull
    @Column(name = "built_at", nullable = false)
    private Instant builtAt;

    @NotNull
    @Column(nullable = false)
    private String status;

    @Column
    private BigDecimal confidence;

    @Column(name = "last_replan_reason")
    private String lastReplanReason;
}
