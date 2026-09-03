package io.mrkuhne.mezo.feature.lifegoal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
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

/** One life goal (spec §4). Status lifecycle draft→active→parked/done/archived; NO active cap (D7). */
@Getter
@Setter
@Entity
@Table(name = "life_goal")
@SQLDelete(sql = "update life_goal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class LifeGoalEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Column(nullable = false) private String title;
    @Column(name = "why_text") private String whyText;
    @NotNull @Column(nullable = false) private String frame = "unset";           // intrinsic|extrinsic|unset (CHECK)
    @NotNull @Column(nullable = false) private String dimension;                // PERMAH key (CHECK)
    @Column(name = "secondary_dimension") private String secondaryDimension;
    @NotNull @Column(nullable = false) private String status = "draft";         // draft|active|parked|done|archived (CHECK)
    @NotNull @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @Column(name = "target_date") private LocalDate targetDate;
    @Column(name = "activated_at") private Instant activatedAt;
    @Column(name = "closed_at") private Instant closedAt;
    @Column(name = "obstacle_text") private String obstacleText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "if_then_plans", columnDefinition = "jsonb", nullable = false)
    private List<IfThenPlanJson> ifThenPlans = new ArrayList<>();
}
