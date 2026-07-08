package io.mrkuhne.mezo.feature.proactive.entity;

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

/**
 * One pattern-grounded weekly prediction (proactive P1). The validity window is CODE-set to the
 * generation week; {@code confidence} is COPIED from the grounding pattern (null = „tanulom" —
 * the no-fabricated-numbers rule); the daily validation run flips pending → validated|missed
 * deterministically and writes the code-formatted {@code actual}.
 */
@Getter
@Setter
@Entity
@Table(name = "prediction")
@SQLDelete(sql = "update prediction set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PredictionEntity extends OwnedEntity {

    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_VALIDATED = "validated";
    public static final String STATUS_MISSED = "missed";

    public static final String DIRECTION_UP = "up";
    public static final String DIRECTION_DOWN = "down";
    public static final String DIRECTION_STABLE = "stable";

    public static final String METRIC_WEIGHT_TREND = "weight_trend";
    public static final String METRIC_SLEEP_AVG = "sleep_avg";
    public static final String METRIC_TRAINING_VOLUME = "training_volume";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @NotNull
    @Column(nullable = false, length = 200)
    private String title;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String basis;

    @Column(precision = 4, scale = 3)
    private BigDecimal confidence;

    @NotNull
    @Column(name = "metric_key", nullable = false, length = 40)
    private String metricKey;

    @NotNull
    @Column(name = "expected_direction", nullable = false, length = 8)
    private String expectedDirection;

    @NotNull
    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @NotNull
    @Column(name = "valid_to", nullable = false)
    private LocalDate validTo;

    @NotNull
    @Column(nullable = false, length = 10)
    private String status = STATUS_PENDING;

    @Column(columnDefinition = "text")
    private String actual;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
