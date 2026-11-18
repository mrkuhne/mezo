package io.mrkuhne.mezo.feature.train.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/**
 * One leg of a technique set (a drop, a myo mini-set or a partials burst) hanging off an
 * {@link ExerciseSetEntity} (FK {@code exercise_set_id}, {@code ON DELETE CASCADE}), ordered by
 * {@code legIndex}. Deliberately not an owned entity: a leg has no owner or soft-delete of its own —
 * every reader reaches it through a live parent set (mezo-r36n9.80).
 */
@Getter
@Setter
@Entity
@Table(name = "exercise_set_leg")
public class ExerciseSetLegEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "exercise_set_id", nullable = false, updatable = false)
    private UUID exerciseSetId;

    @NotNull
    @Column(name = "leg_index", nullable = false)
    private Integer legIndex;

    @NotNull
    @Column(nullable = false)
    private String kind; // drop|mini|partials (DB CHECK)

    @Column(name = "weight_kg", precision = 6, scale = 2)
    private BigDecimal weightKg;

    @Column
    private Integer reps;

    @Column(name = "rest_sec")
    private Integer restSec;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
