package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
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
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A single logged set of an {@link ExerciseEntity} (FK {@code exercise_id},
 * {@code ON DELETE CASCADE}). Sets are ordered within an exercise by {@code setIndex}; the optional
 * {@code side} is {@code L|B|R} (DB CHECK) and the performance fields stay null until logged.
 *
 * <p>{@code skipped} marks a whole-exercise skip marker row (F3 skip flow).
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "exercise_set")
@SQLDelete(sql = "update exercise_set set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExerciseSetEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "exercise_id", nullable = false)
    private UUID exerciseId;

    /** The concrete workout instance this set was logged in (NULL on legacy/template-less rows). */
    @Column(name = "workout_session_id")
    private UUID workoutSessionId;

    @NotNull
    @Column(name = "set_index", nullable = false)
    private Integer setIndex;

    @Column(name = "weight_kg", precision = 6, scale = 2)
    private BigDecimal weightKg;

    @Column
    private Integer reps;

    @Column
    private Integer rir;

    @Column
    private String side; // null|L|B|R (DB CHECK)

    @Column
    private String note;

    @Column(nullable = false)
    private boolean skipped = false;

    @Column(name = "done_at")
    private Instant doneAt;
}
