package io.mrkuhne.mezo.feature.companion.feedback.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One nightly-recomputed rollup row (Phase 5 W4.2, bd mezo-b3pp.16, spec §4.4/§8.2): per-surface
 * effectiveness ({@code surface:<artifact_kind>}), per-feed-kind effectiveness
 * ({@code feed:<companion_message.kind>}), or the single style histogram ({@code style}). The
 * job find-or-creates by {@code (created_by, scope, window_days)} and overwrites {@code stats}/
 * {@code computed_at} in place every run — this table has no history, only the latest snapshot.
 */
@Getter
@Setter
@Entity
@Table(name = "feedback_rollup", uniqueConstraints =
    @UniqueConstraint(name = "uq_feedback_rollup_scope", columnNames = {"created_by", "scope", "window_days"}))
@SQLDelete(sql = "update feedback_rollup set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class FeedbackRollupEntity extends OwnedEntity {

    public static final String SCOPE_STYLE = "style";
    public static final String SCOPE_SURFACE_PREFIX = "surface:";
    public static final String SCOPE_FEED_PREFIX = "feed:";
    /** W5.2 (bd mezo-b3pp.19): per-intervention-key effectiveness — the selection weight
     *  {@code InterventionService} reads back. Task 7 builds the writer side. */
    public static final String SCOPE_INTERVENTION_PREFIX = "intervention:";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_feedback_rollup_scope: {@code style} | {@code surface:<artifact_kind>} |
     *  {@code feed:<kind>} | {@code intervention:<key>} (W5.2, bd mezo-b3pp.19). */
    @NotNull
    @Size(max = 40)
    @Pattern(regexp = "style|surface:.+|feed:.+|intervention:.+")
    @Column(nullable = false, length = 40)
    private String scope;

    @NotNull
    @Column(name = "window_days", nullable = false)
    private Integer windowDays;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private FeedbackRollupStatsEnvelope stats;

    @NotNull
    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;
}
