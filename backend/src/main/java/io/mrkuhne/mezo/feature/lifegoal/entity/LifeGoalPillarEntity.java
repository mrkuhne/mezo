package io.mrkuhne.mezo.feature.lifegoal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** A contributing pillar of a life goal — a catalog signal + a kind-specific rule + the skill it feeds. */
@Getter
@Setter
@Entity
@Table(name = "life_goal_pillar")
@SQLDelete(sql = "update life_goal_pillar set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class LifeGoalPillarEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Column(name = "goal_id", nullable = false, columnDefinition = "uuid") private UUID goalId;
    @NotNull @Column(nullable = false) private String label;
    @NotNull @Column(name = "skill_key", nullable = false) private String skillKey;
    @NotNull @Column(nullable = false) private String kind;                    // habit|average|target|baseline|linked
    @Min(1) @Max(3) @JdbcTypeCode(SqlTypes.SMALLINT) @Column(nullable = false) private int weight = 1;
    @JdbcTypeCode(SqlTypes.SMALLINT) @Column(nullable = false) private int position;
    @Column(name = "is_active", nullable = false) private boolean active = true;

    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private PillarSourceJson source;

    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private PillarRuleJson rule = new PillarRuleJson(null, null, null, null, null, null, null, null, null, null);
}
