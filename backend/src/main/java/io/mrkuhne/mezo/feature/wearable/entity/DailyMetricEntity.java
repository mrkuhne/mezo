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

/** Apple Health totals of one day (Boop S2, mezo-r36n9.2) — written by the native upsert only. */
@Getter
@Setter
@Entity
@Table(name = "daily_metric")
public class DailyMetricEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false)
    private LocalDate date;

    private Integer steps;

    @Column(name = "resting_hr")
    private Integer restingHr;

    @Column(name = "avg_hr")
    private Integer avgHr;

    @Column(name = "min_hr")
    private Integer minHr;

    @Column(name = "max_hr")
    private Integer maxHr;

    @Column(name = "active_kcal")
    private Integer activeKcal;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
