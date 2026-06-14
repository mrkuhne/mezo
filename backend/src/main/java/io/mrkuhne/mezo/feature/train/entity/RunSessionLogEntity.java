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
 * Logged actuals for one run session, recorded against a prescribed session in a
 * {@link RunningBlockEntity} (the {@code WorkoutSessionEntity} analog). Named *Log to avoid
 * clashing with the prescribed {@code RunPrescribedSession} record inside the block jsonb.
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "run_session_log")
@SQLDelete(sql = "update run_session_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RunSessionLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "block_id", nullable = false, columnDefinition = "uuid")
    private UUID blockId;

    @NotNull
    @Column(name = "week_number", nullable = false)
    private Integer weekNumber;

    @NotNull
    @Column(name = "session_key", nullable = false)
    private String sessionKey;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "completed_rounds")
    private Integer completedRounds;

    @Column(name = "rpe_actual")
    private Integer rpeActual; // null or 1..10 (DB CHECK)

    @Column(name = "hr_recovery_sec")
    private Integer hrRecoverySec;

    @Column(name = "sprint_landmark")
    private String sprintLandmark;

    @Column(name = "duration_min")
    private Integer durationMin;

    @Column
    private String notes;
}
