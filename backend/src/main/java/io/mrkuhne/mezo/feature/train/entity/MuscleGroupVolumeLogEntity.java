package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * Per-muscle volume landmarks (MEV/MAV/MRV) for a mesocycle, carrying the full
 * {@link ProvenanceEnvelope} of how the numbers were derived. The {@code source} column is the
 * project's first typed jsonb persistence (Slice B risk item) — see {@code ProvenanceRoundTripIT}.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "muscle_group_volume_log")
@SQLDelete(sql = "update muscle_group_volume_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MuscleGroupVolumeLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "mesocycle_id", nullable = false)
    private UUID mesocycleId;

    @NotNull
    @Column(nullable = false)
    private String muscle;

    @NotNull
    @Column(nullable = false)
    private Integer mev;

    @NotNull
    @Column(nullable = false)
    private Integer mav;

    @NotNull
    @Column(nullable = false)
    private Integer mrv;

    @NotNull
    @Column(name = "current_sets", nullable = false)
    private Integer currentSets;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private ProvenanceEnvelope source;

    @CreationTimestamp
    @Column(name = "computed_at", nullable = false, updatable = false)
    private Instant computedAt;
}
