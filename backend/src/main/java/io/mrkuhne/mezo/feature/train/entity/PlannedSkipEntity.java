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
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One user-declared skip of a planned occurrence (Kihagyás S1, mezo-q4xt2.1, spec 2026-09-28 §8).
 * MEAL (S3, mezo-q4xt2.3) keys on the slot as {@code <slotKind>#<n>} in {@code session_key}.
 * GYM keys on the date alone; SPORT on the slot IDENTITY (dayOfWeek 0=Hét..6=Vas + time — NOT ISO,
 * see {@link SportSlotSkipEntity}); RUN on the running block's session key. Whether the skip
 * counts as missed is decided at read time by {@code PlannedSkipPolicy}. Undo = soft delete.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "planned_skip")
@SQLDelete(sql = "update planned_skip set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PlannedSkipEntity extends OwnedEntity {

    public enum Kind { GYM, SPORT, RUN, MEAL }

    public enum Reason { ILLNESS, STOMACH, INJURY, TRAVEL, TIRED, NO_TIME, NO_MOOD, NOT_HUNGRY, OTHER, NONE }

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Kind kind;

    @Column(name = "day_of_week")
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private Integer dayOfWeek; // 0=Hét .. 6=Vas (DB CHECK) — NOT ISO, see SportSlotSkipEntity

    @Column(length = 5)
    private String time;

    @Column(name = "session_key", length = 64)
    private String sessionKey;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "reason_category", nullable = false, length = 16)
    private Reason reasonCategory = Reason.NONE;

    @Column(name = "reason_text", length = 500)
    private String reasonText;

    /** MEAL only: the skipped slot's kcal budget at skip time (a snapshot — windows exist only in the FE). */
    @Column(name = "planned_kcal")
    private Integer plannedKcal;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
