package io.mrkuhne.mezo.feature.goal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A Cél: a goal-rooted timeline. {@code trajectory} (cut|bulk|maintain) + {@code guards}
 * (strength|muscle, typed text[]) + a window (start..target). Lifecycle status
 * planned|active|archived; at most one active per owner (enforced in {@code GoalService}).
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "goal")
@SQLDelete(sql = "update goal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GoalEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(nullable = false) private String title;
    @NotNull @Column(nullable = false) private String trajectory; // cut|bulk|maintain (DB CHECK)

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> guards = new ArrayList<>(); // strength|muscle

    @NotNull @Column(nullable = false) private String status; // planned|active|archived (DB CHECK)
    @NotNull @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @NotNull @Column(name = "target_date", nullable = false) private LocalDate targetDate;
    @NotNull @Column(name = "start_weight_kg", nullable = false) private BigDecimal startWeightKg;
    @Column(name = "target_weight_kg") private BigDecimal targetWeightKg;
    @NotNull @Column(name = "rate_target_pct_per_week", nullable = false) private BigDecimal rateTargetPctPerWeek;
    @Column(name = "identity_frame") private String identityFrame;

    // Fuel P5 day-planner settings (mezo-9ys): eating-occasion count + wake/bed anchors (HH:mm).
    // Column is smallint (3..6, DB CHECK); SMALLINT jdbc type so schema-validation matches int2.
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "meals_per_day") private Integer mealsPerDay;
    @Column(name = "wake_time") private String wakeTime;
    @Column(name = "bed_time") private String bedTime;

    // Engine outputs — null until the first evaluate (G5). Typed jsonb, app-ObjectMapper serialized.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tdee_bootstrap", columnDefinition = "jsonb")
    private TdeeBootstrapJson tdeeBootstrap;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "prescription", columnDefinition = "jsonb")
    private GoalPrescriptionJson prescription;
}
