package io.mrkuhne.mezo.feature.lifegoal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** The nightly evaluation row (slice 2 writes it): one per pillar+day, status hit|partial|miss|no_data. */
@Getter
@Setter
@Entity
@Table(name = "life_goal_pillar_day")
@SQLDelete(sql = "update life_goal_pillar_day set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class LifeGoalPillarDayEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Column(name = "pillar_id", nullable = false, columnDefinition = "uuid") private UUID pillarId;
    @NotNull @Column(nullable = false) private LocalDate day;
    @Column(precision = 12, scale = 3) private BigDecimal value;
    @Column(precision = 12, scale = 3) private BigDecimal target;
    @Column(precision = 12, scale = 3) private BigDecimal baseline;
    @NotNull @Column(nullable = false) private String status;
    @NotNull @Column(name = "computed_at", nullable = false) private Instant computedAt = Instant.now();
}
