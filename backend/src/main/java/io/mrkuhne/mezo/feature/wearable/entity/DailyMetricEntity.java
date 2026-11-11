package io.mrkuhne.mezo.feature.wearable.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
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

    @Column(name = "distance_m")
    private Integer distanceM;

    @Column(name = "basal_kcal")
    private Integer basalKcal;

    @Column(name = "exercise_min")
    private Integer exerciseMin;

    @Column(name = "mindful_min")
    private Integer mindfulMin;

    @Column(name = "daylight_min")
    private Integer daylightMin;

    @Column(name = "walking_hr")
    private Integer walkingHr;

    @Column(name = "hrv_ms", precision = 6, scale = 1)
    private BigDecimal hrvMs;

    @Column(name = "resp_rate", precision = 4, scale = 1)
    private BigDecimal respRate;

    @Column(name = "spo2_pct", precision = 4, scale = 1)
    private BigDecimal spo2Pct;

    @Column(precision = 4, scale = 1)
    private BigDecimal vo2max;

    @Column(name = "wrist_temp_c", precision = 4, scale = 2)
    private BigDecimal wristTempC;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
