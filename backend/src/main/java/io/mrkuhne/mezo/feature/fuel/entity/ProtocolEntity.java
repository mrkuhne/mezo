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
 * A single living supplement Stack/Protocol (Fuel) — one row per user, holding only version/build
 * metadata; the timing/zone occurrences live on {@code protocol_item} rows, not here (no slot
 * snapshot on this entity). Single active protocol per user (partial unique index
 * {@code uq_protocol_active_per_user}); {@code version} bumps IN PLACE on every occurrence mutation
 * (add/patch/delete an item) — there is no whole-selection (re)activate step anymore, so
 * {@code status} stays {@code active} for the life of the row. Any {@code superseded} row in the
 * table is legacy history from the pre-mezo-vx9v activate model, never written going forward.
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
