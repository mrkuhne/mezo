package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.feature.train.entity.json.MesoContextJson;
import io.mrkuhne.mezo.feature.train.entity.json.MesoReportJson;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * The frozen end-of-mesocycle close report (mezo-meyc.2) — one row per closed {@code mesocycle}
 * ({@code uq_mesocycle_report_mesocycle}), generated when the owner closes a run. {@link #report}
 * and {@link #context} are typed jsonb snapshots (same idiom as {@code MesoTemplateEntity.days})
 * so a historical report never drifts when later data (logs, catalog edits) changes.
 * {@link #selfEval} is the owner's free-text close-time note; {@link #aiEval} is the optional
 * AI-generated narrative, gated by {@link #aiEvalStatus} since it is generated asynchronously.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "mesocycle_report")
@SQLDelete(sql = "update mesocycle_report set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MesocycleReportEntity extends OwnedEntity {

    public static final String AI_EVAL_STATUS_PENDING = "pending";
    public static final String AI_EVAL_STATUS_READY = "ready";
    public static final String AI_EVAL_STATUS_FAILED = "failed";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "mesocycle_id", nullable = false)
    private UUID mesocycleId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private MesoReportJson report;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private MesoContextJson context;

    @Column(name = "self_eval")
    private String selfEval;

    @Column(name = "ai_eval")
    private String aiEval;

    @NotNull
    @Column(name = "ai_eval_status", nullable = false)
    private String aiEvalStatus = AI_EVAL_STATUS_PENDING;

    @Column(name = "ai_eval_generated_at")
    private Instant aiEvalGeneratedAt;
}
