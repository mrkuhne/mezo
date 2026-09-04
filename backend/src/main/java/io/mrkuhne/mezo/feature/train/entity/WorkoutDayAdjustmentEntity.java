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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A read-time per-date overlay that lowers one user's gym targets for one day (proactive coaching
 * S5, mezo-d58h.5, spec 2026-09-03 §6 item 1). One row per (user, date) pair; undo is a delete.
 *
 * <p><b>Why a table and not a template edit:</b> Gym exercises hang off the weekday TEMPLATE row
 * ({@code workout_session} with {@code templateSessionId == null}), so writing the template would
 * lighten every future occurrence of that weekday, not tomorrow. Worse, the only existing write
 * path ({@code TrainService.replaceDayExercises}) soft-deletes and re-inserts every exercise row
 * with NEW UUIDs, which orphans any already-logged {@code exercise_set} rows. So the lighten is a
 * read-time overlay keyed by date — the template is never touched, exercise identities never
 * change, and undo is a row delete.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "workout_day_adjustment")
@SQLDelete(sql = "update workout_day_adjustment set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WorkoutDayAdjustmentEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @NotNull
    @Column(nullable = false)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private Short setDelta; // CHECK: between -3 and 0; negative means lighten
}
