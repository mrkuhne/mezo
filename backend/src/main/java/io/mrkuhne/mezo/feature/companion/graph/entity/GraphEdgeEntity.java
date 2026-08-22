package io.mrkuhne.mezo.feature.companion.graph.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One typed, weighted relationship between two {@link GraphNodeEntity} rows (Phase 5 W2.1, bd
 * mezo-b3pp.6, spec §4.2/§6.1, ADR 0031). {@code weight} starts humble (edges are created at
 * {@code confidence × 0.5} in W2.2) and moves via nightly decay/reinforcement (W2.5).
 *
 * <p>{@code fromNodeId}/{@code toNodeId} are flat UUID columns (the {@code GoalPlanLinkEntity}
 * idiom), not JPA relations — this codebase's dominant FK style.
 */
@Getter
@Setter
@Entity
@Table(name = "knowledge_edge")
@SQLDelete(sql = "update knowledge_edge set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GraphEdgeEntity extends OwnedEntity {

    public static final String KIND_TRIGGERS = "TRIGGERS";
    public static final String KIND_PRECEDED_BY = "PRECEDED_BY";
    public static final String KIND_SUPPORTS = "SUPPORTS";
    public static final String KIND_CONFLICTS = "CONFLICTS";
    public static final String KIND_RELATES_TO = "RELATES_TO";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "from_node_id", nullable = false, columnDefinition = "uuid")
    private UUID fromNodeId;

    @NotNull
    @Column(name = "to_node_id", nullable = false, columnDefinition = "uuid")
    private UUID toNodeId;

    /** Mirrors ck_knowledge_edge_kind. */
    @NotNull
    @Size(max = 12)
    @Pattern(regexp = "TRIGGERS|PRECEDED_BY|SUPPORTS|CONFLICTS|RELATES_TO")
    @Column(nullable = false, length = 12)
    private String kind;

    /** Mirrors ck_knowledge_edge_weight (0..1). */
    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("1.0")
    @Column(nullable = false, precision = 4, scale = 3)
    private BigDecimal weight = new BigDecimal("0.500");

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<GraphEdgeEvidence> evidence;

    @Column(name = "last_reinforced_at")
    private Instant lastReinforcedAt;
}
