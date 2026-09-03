package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A single workout session within a mesocycle (or unscheduled, when {@code mesocycleId} is null and
 * the parent meso is removed via {@code ON DELETE SET NULL}). Sessions are ordered within a meso by
 * {@code orderIndex}; the {@code status} lifecycle is {@code planned|active|completed|skipped}
 * (DB CHECK).
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "workout_session")
@SQLDelete(sql = "update workout_session set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WorkoutSessionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "mesocycle_id")
    private UUID mesocycleId;

    /** Instance discriminator: NULL on template rows; on instance rows the template's id. */
    @Column(name = "template_session_id")
    private UUID templateSessionId;

    @NotNull
    @Column(name = "day_label", nullable = false)
    private String dayLabel;

    @NotNull
    @Column(nullable = false)
    private String type;

    @NotNull
    @Column(nullable = false)
    private String muscle = "";

    @NotNull
    @Column(name = "muscle_accent", nullable = false)
    private boolean muscleAccent;

    /** The TEMPLATE day's plan note (template rows only) — published as MesoDay.note. */
    @Column
    private String note;

    /**
     * The workout-level closing note on an INSTANCE row (mezo-d20.8.2.2) — "Hogy ment?", written
     * at finish and editable afterwards from the review page. Deliberately separate from {@link
     * #note}, which carries the template day's plan note and reaches a different response.
     */
    @Column(name = "closing_note")
    private String closingNote;

    @Column
    private LocalDate date;

    @NotNull
    @Column(nullable = false)
    private String status = "planned"; // planned|active|completed|skipped (DB CHECK)

    @Column(name = "duration_est")
    private Integer durationEst;

    /**
     * Wall-clock start of an INSTANCE row, stamped once when the instance is created and never
     * rewritten — POST /workouts resumes an open instance, and a resume must not restart the clock.
     * NULL on template rows and on instances created before mezo-1jm8.
     */
    @Column(name = "started_at")
    private Instant startedAt;

    /**
     * Wall-clock finish, stamped by finishWorkout. Deliberately NOT stamped by
     * WorkoutAutoCloseService: `status='completed' AND finished_at IS NULL` is exactly
     * "abandoned, its timing is not trustworthy" — excluded from display and from learning.
     */
    @Column(name = "finished_at")
    private Instant finishedAt;

    /** Derived work time: consecutive done_at deltas, each clipped at the gap cap. NULL = unknown. */
    @Column(name = "active_seconds")
    private Integer activeSeconds;

    @NotNull
    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;

    /** Template/instance origin: mesocycle plan day vs custom (saját) workout (DB CHECK, mezo-ws2x). */
    @NotNull
    @Column(nullable = false)
    private String origin = "meso"; // meso|custom
}
