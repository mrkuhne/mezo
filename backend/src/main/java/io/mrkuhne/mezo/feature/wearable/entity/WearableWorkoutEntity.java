package io.mrkuhne.mezo.feature.wearable.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** A workout recorded by a wearable via Apple Health (Boop S2, mezo-r36n9.2) — display + AI context
 *  only, never moves a calorie target. */
@Getter
@Setter
@Entity
@Table(name = "wearable_workout")
public class WearableWorkoutEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "external_id", nullable = false, length = 64)
    private String externalId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "activity_type", nullable = false, length = 40)
    private String activityType;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    private Integer kcal;

    @Column(name = "avg_hr")
    private Integer avgHr;

    @Column(name = "source_name", length = 80)
    private String sourceName;

    @Column(name = "distance_m")
    private Integer distanceM;

    @Column(name = "max_hr")
    private Integer maxHr;

    @Column(name = "source_bundle", length = 120)
    private String sourceBundle;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private Instant updatedAt;
}
