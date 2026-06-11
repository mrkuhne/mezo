package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
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

    @Column
    private String note;

    @Column
    private LocalDate date;

    @NotNull
    @Column(nullable = false)
    private String status = "planned"; // planned|active|completed|skipped (DB CHECK)

    @Column(name = "duration_est")
    private Integer durationEst;

    @NotNull
    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;
}
