package io.mrkuhne.mezo.feature.goal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A positioned coupling of an owned plan ({@code mesocycle|running_block}) to a {@code goal}'s
 * timeline. {@code startWeek}/{@code endWeek} place the plan inside the goal window (1-based,
 * end &gt;= start — enforced by the {@code ck_goal_plan_link_weeks} DB CHECK).
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "goal_plan_link")
@SQLDelete(sql = "update goal_plan_link set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GoalPlanLinkEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(name = "goal_id", nullable = false, columnDefinition = "uuid") private UUID goalId;
    @NotNull @Column(name = "plan_type", nullable = false) private String planType; // mesocycle|running_block (DB CHECK)
    @NotNull @Column(name = "plan_id", nullable = false, columnDefinition = "uuid") private UUID planId;
    @NotNull @Column(name = "start_week", nullable = false) private Integer startWeek;
    @NotNull @Column(name = "end_week", nullable = false) private Integer endWeek;
}
