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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * RP-style post-exercise debrief for one (workout instance, exercise) pair — UNIQUE per pair,
 * upserted by {@code WorkoutService}. Scales (DB CHECKs): pump 1–4, jointPain 1–3, workload 1–3.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "exercise_feedback")
@SQLDelete(sql = "update exercise_feedback set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExerciseFeedbackEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "workout_session_id", nullable = false)
    private UUID workoutSessionId;

    @NotNull
    @Column(name = "exercise_id", nullable = false)
    private UUID exerciseId;

    @NotNull
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(nullable = false)
    private Integer pump; // 1–4 (DB CHECK)

    @NotNull
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "joint_pain", nullable = false)
    private Integer jointPain; // 1–3 (DB CHECK)

    @NotNull
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(nullable = false)
    private Integer workload; // 1–3 (DB CHECK)
}
