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
 * One dated occurrence of a recurring {@link SportScheduleSlotEntity}, hidden (proactive coaching
 * S5, mezo-d58h.5, spec 2026-09-03 §6). Deliberately keyed on the slot's IDENTITY —
 * {@code dayOfWeek} + {@code time} — and NOT on {@code sport_schedule_slot.id}:
 * {@link SportScheduleSlotEntity} is FULL-REPLACED on every schedule save (soft-delete + re-insert
 * of the whole week, see its own javadoc), so an id-keyed skip would point at a dead row after the
 * user's first schedule edit and silently stop working, with no error. Moving a slot to another
 * time therefore does not carry its skip along — that is a deliberately accepted consequence, not
 * a bug: it is a different session.
 *
 * <p><b>Trap:</b> {@code dayOfWeek} is 0=Hét..6=Vas (the legacy slot-table convention, NOT ISO —
 * see {@code AnchorResolver}'s "Trap #1" comment, which this exact confusion has bitten before).
 * Every call site converts a {@link LocalDate} with {@code date.getDayOfWeek().getValue() - 1}.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "sport_slot_skip")
@SQLDelete(sql = "update sport_slot_skip set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SportSlotSkipEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "day_of_week", nullable = false)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private Integer dayOfWeek; // 0=Hét .. 6=Vas (DB CHECK) — NOT ISO, see class javadoc

    @NotNull
    @Column(nullable = false, length = 5)
    private String time;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;
}
