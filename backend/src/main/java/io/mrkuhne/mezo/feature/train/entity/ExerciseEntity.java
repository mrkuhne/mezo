package io.mrkuhne.mezo.feature.train.entity;

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
 * A planned exercise within a {@link WorkoutSessionEntity} (FK {@code workout_session_id},
 * {@code ON DELETE CASCADE}). Exercises are ordered within a session by {@code orderIndex}; the
 * {@code type} is {@code compound|isolation} (DB CHECK).
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "exercise")
@SQLDelete(sql = "update exercise set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExerciseEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "workout_session_id", nullable = false)
    private UUID workoutSessionId;

    @NotNull
    @Column(nullable = false)
    private String name;

    @NotNull
    @Column(nullable = false)
    private String muscle = "";

    @NotNull
    @Column(name = "warmup_sets", nullable = false)
    private Integer warmupSets = 0;

    @NotNull
    @Column(name = "working_sets", nullable = false)
    private Integer workingSets;

    @NotNull
    @Column(name = "rep_min", nullable = false)
    private Integer repMin;

    @NotNull
    @Column(name = "rep_max", nullable = false)
    private Integer repMax;

    @NotNull
    @Column(name = "target_rir", nullable = false)
    private Integer targetRir;

    /** Optional first-session seed weight (kg); null → engine leaves the first working set blank. */
    @Column(name = "anchor_weight_kg", precision = 6, scale = 2)
    private java.math.BigDecimal anchorWeightKg;

    @NotNull
    @Column(nullable = false)
    private String type; // compound|isolation|plyo (DB CHECK)

    @Column
    private String warning;

    /** Durable per-exercise note, F4 — preloaded next session. */
    @Column
    private String note;

    /** Optional reference to the exercise_catalog row this exercise was picked from. */
    @Column(name = "catalog_id")
    private UUID catalogId;

    @NotNull
    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;
}
