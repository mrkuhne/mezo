package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.feature.train.entity.json.RestoreEntryJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalGroupJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * The weekly change to a run's set counts as a first-class record (volume engine v2, spec §6.4):
 * one {@link WeekProposalLineJson} per changed exercise. {@code planAfter} maps an exercise row id
 * (string) to its sets; {@code restore} lists what a deload halved ({@link RestoreEntryJson});
 * {@code groups} holds one {@link WeekProposalGroupJson} per trained counting group (null on rows
 * stored before S3).
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "meso_week_proposal")
@SQLDelete(sql = "update meso_week_proposal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MesoWeekProposalEntity extends OwnedEntity {

    /** {@code kind} values (DB CHECK). */
    public static final String KIND_WEEKLY = "weekly";
    public static final String KIND_TIER_CHANGE = "tier_change";

    /** {@code status} values (DB CHECK). */
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_APPLIED = "applied";
    public static final String STATUS_AUTO_APPLIED = "auto_applied";
    public static final String STATUS_EXPIRED = "expired";
    public static final String STATUS_SUPERSEDED = "superseded";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "mesocycle_id", nullable = false)
    private UUID mesocycleId;

    @NotNull
    @Column(nullable = false)
    private Integer week;

    @NotNull
    @Column(nullable = false)
    private String kind; // weekly|tier_change (DB CHECK)

    @NotNull
    @Column(nullable = false)
    private String status; // pending|applied|auto_applied|expired|superseded (DB CHECK)

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<WeekProposalLineJson> lines;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "plan_after", columnDefinition = "jsonb")
    private Map<String, Integer> planAfter;

    /** What a deload week gave up, to be given back the week after; emptied once that happened. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<RestoreEntryJson> restore;

    /** Per-muscle outcomes of the week (S3); null on proposals stored before it. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<WeekProposalGroupJson> groups;

    @Column(name = "decided_at")
    private Instant decidedAt;
}
