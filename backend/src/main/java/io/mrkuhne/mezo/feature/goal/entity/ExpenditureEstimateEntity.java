package io.mrkuhne.mezo.feature.goal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One reviewed week's learned-expenditure estimate (bd mezo-zz91i, spec
 * 2026-09-26-learned-expenditure-design §5.5): the formula-based baseline, the Kalman-filtered
 * posterior, and {@code appliedBaseKcal} — the value the goal actually serves as "Alap" after the
 * weekly learned-base step policy clamps the posterior's movement. One row per user per
 * calendar week ({@code week_start}, the Monday), enforced by {@code uq_expenditure_estimate_user_week}.
 */
@Getter
@Setter
@Entity
@Table(name = "expenditure_estimate")
@SQLDelete(sql = "update expenditure_estimate set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExpenditureEstimateEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(name = "week_start", nullable = false) private LocalDate weekStart;
    @NotNull @Column(nullable = false) private String status; // LEARNING|UPDATED|STABLE|HOLDING (DB CHECK)

    @NotNull @Column(name = "formula_base_kcal", nullable = false) private Integer formulaBaseKcal;
    @NotNull @Column(name = "posterior_base_kcal", nullable = false) private Integer posteriorBaseKcal;
    @NotNull @Column(name = "posterior_sd_kcal", nullable = false) private Integer posteriorSdKcal;
    @NotNull @Column(name = "applied_base_kcal", nullable = false) private Integer appliedBaseKcal;
    @NotNull @Column(name = "step_kcal", nullable = false) private Integer stepKcal;

    @NotNull
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "direction", nullable = false, columnDefinition = "smallint")
    private Integer direction;

    @NotNull @Column(nullable = false) private String confidence; // LOW|MEDIUM|HIGH (DB CHECK)

    @NotNull @Column(name = "usable_days", nullable = false) private Integer usableDays;
    @NotNull @Column(name = "weigh_in_days", nullable = false) private Integer weighInDays;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "excluded_days", nullable = false, columnDefinition = "jsonb")
    private List<ExcludedIntakeDayJson> excludedDays;

    /** How this week was learned — the "Hogy tanultam?" explainer (mezo-y72o3); {@code null} on rows written before it. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "explanation", columnDefinition = "jsonb")
    private ExpenditureExplanationJson explanation;

    /** When the owner dismissed this week's summary (mezo-3n2so) — cross-device, null until dismissed. */
    @Column(name = "dismissed_at")
    private OffsetDateTime dismissedAt;
}
