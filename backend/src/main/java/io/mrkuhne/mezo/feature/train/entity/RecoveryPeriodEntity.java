package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A user-declared multi-day recovery state ("kímélő mód", Kihagyás S2, mezo-q4xt2.2, spec
 * 2026-09-28 §9) opened by a serious skip reason. Every planned gym/sport/run occurrence on a
 * protected date reads as skipped + excused at read time (see {@code PlannedSkipService}). It
 * never ends by itself: {@code endedOn} is set only by the user's "Jobban". The {@code shift*} /
 * {@code prev*} columns snapshot the meso calendar change applied at "Jobban", so "Mégsem vagyok
 * jól" / "Tévedés volt" revert it exactly.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "recovery_period")
@SQLDelete(sql = "update recovery_period set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RecoveryPeriodEntity extends OwnedEntity {

    public enum Estimate { TODAY, FEW_DAYS, WEEK, UNKNOWN }

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PlannedSkipEntity.Reason category;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Estimate estimate;

    @NotNull
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "expected_end")
    private LocalDate expectedEnd;

    @Column(name = "ended_on")
    private LocalDate endedOn;

    @Column(name = "last_check_date")
    private LocalDate lastCheckDate;

    @Column(name = "comeback_waived", nullable = false)
    private boolean comebackWaived = false;

    @Column(name = "shift_meso_id")
    private UUID shiftMesoId;

    @Column(name = "shift_days", nullable = false)
    private int shiftDays = 0;

    @Column(name = "prev_start")
    private LocalDate prevStart;

    @Column(name = "prev_end")
    private LocalDate prevEnd;

    @Column(name = "prev_current_week")
    private Integer prevCurrentWeek;

    @Column(name = "prev_last_run", length = 8)
    private String prevLastRun;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "prev_sets", columnDefinition = "jsonb")
    private Map<String, Integer> prevSets;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
