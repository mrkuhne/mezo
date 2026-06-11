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
 * A training mesocycle: the planning block that groups workout sessions and per-muscle volume
 * landmarks. {@code phaseCurve} is the project's first typed Postgres {@code text[]} mapping and
 * {@code volumeRecompute} the weekly recompute audit as typed jsonb — both proven in
 * {@code TrainServiceIT}.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "mesocycle")
@SQLDelete(sql = "update mesocycle set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MesocycleEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private String title;

    @NotNull
    @Column(name = "short_title", nullable = false)
    private String shortTitle;

    @NotNull
    @Column(nullable = false)
    private String status; // active|planned|archived (DB CHECK)

    @Column
    private String goal;

    @NotNull
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @NotNull
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @NotNull
    @Column(nullable = false)
    private Integer weeks;

    @NotNull
    @Column(name = "current_week", nullable = false)
    private Integer currentWeek = 0;

    @NotNull
    @Column(nullable = false)
    private String split;

    @NotNull
    @Column(nullable = false)
    private String style;

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "phase_curve", nullable = false, columnDefinition = "text[]")
    private String[] phaseCurve;

    @Column
    private String notes;

    @Column
    private String summary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "volume_recompute", columnDefinition = "jsonb")
    private VolumeRecomputeJson volumeRecompute;
}
