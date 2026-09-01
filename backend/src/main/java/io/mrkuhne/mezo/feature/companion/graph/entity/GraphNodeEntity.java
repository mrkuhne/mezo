package io.mrkuhne.mezo.feature.companion.graph.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * One knowledge-graph node (Phase 5 W2.1, bd mezo-b3pp.6, spec §4.2/§6.1, ADR 0031) — a durable
 * fact about Daniel: a pattern, preference, goal, life event, season, or insight (the W4.3
 * companion profile is a singleton {@code INSIGHT} node, not a separate table). {@code status}
 * carries the L2 candidate→active→archived lifecycle independently of {@code is_deleted}
 * (inherited soft-delete); archiving a node keeps the row, just out of active listing/traversal.
 *
 * <p>{@code sourceKind}/{@code sourceId} + {@link #KIND_PATTERN} etc. back the idempotent
 * promotion anchor {@code uq_knowledge_node_source} — later slices (W2.2/W2.3) UPSERT by this pair
 * so re-promoting the same source row never duplicates a node.
 */
@Getter
@Setter
@Entity
@Table(name = "knowledge_node")
@SQLDelete(sql = "update knowledge_node set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GraphNodeEntity extends OwnedEntity {

    public static final String KIND_PATTERN = "PATTERN";
    public static final String KIND_PREFERENCE = "PREFERENCE";
    public static final String KIND_GOAL = "GOAL";
    public static final String KIND_LIFE_EVENT = "LIFE_EVENT";
    public static final String KIND_SEASON = "SEASON";
    public static final String KIND_INSIGHT = "INSIGHT";
    /** Emberek S5 (mezo-06o0.4): egy aktív személy tükre a gráfban. */
    public static final String KIND_PERSON = "PERSON";

    public static final String STATUS_CANDIDATE = "candidate";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_ARCHIVED = "archived";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** Mirrors ck_knowledge_node_kind. */
    @NotNull
    @Size(max = 12)
    @Pattern(regexp = "PATTERN|PREFERENCE|GOAL|LIFE_EVENT|SEASON|INSIGHT|PERSON")
    @Column(nullable = false, length = 12)
    private String kind;

    @NotNull
    @Size(max = 120)
    @Column(nullable = false, length = 120)
    private String title;

    @Column(columnDefinition = "text")
    private String summary;

    /** Mirrors ck_knowledge_node_status. */
    @NotNull
    @Size(max = 10)
    @Pattern(regexp = "candidate|active|archived")
    @Column(nullable = false, length = 10)
    private String status = STATUS_ACTIVE;

    @Size(max = 20)
    @Column(name = "source_kind", length = 20)
    private String sourceKind;

    @Column(name = "source_id", columnDefinition = "uuid")
    private UUID sourceId;

    @Column(name = "occurred_on")
    private LocalDate occurredOn;

    /** Kind-specific payload — typed envelopes per kind arrive with the slices that write them
     *  (W2.2 PATTERN meta, W2.3 LIFE_EVENT meta); a generic map until then. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> meta;
}
