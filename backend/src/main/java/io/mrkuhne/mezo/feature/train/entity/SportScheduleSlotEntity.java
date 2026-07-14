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
 * One recurring weekly sport schedule slot (volleyball | cross | trx) — the user's fixed training/match
 * rhythm, independent of the gym mesocycle. {@code dayOfWeek} is 0=Hét..6=Vas (the FE
 * DAY_ORDER index; DB CHECK enforces the range). The whole week is maintained via
 * full-replace ({@code PUT /api/train/sport-schedule}), so rows are short-lived:
 * soft-deleted and re-inserted on every save.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "sport_schedule_slot")
@SQLDelete(sql = "update sport_schedule_slot set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SportScheduleSlotEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "day_of_week", nullable = false)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private Integer dayOfWeek; // 0=Hét .. 6=Vas (DB CHECK)

    @NotNull
    @Column(nullable = false, length = 5)
    private String time;

    @NotNull
    @Column(name = "duration_min", nullable = false)
    private Integer durationMin;

    @NotNull
    @Column(nullable = false)
    private String kind; // 'training' | 'match' (DB CHECK)

    @NotNull
    @Column(nullable = false)
    private String sport = "volleyball"; // 'volleyball' | 'cross' | 'trx' (DB CHECK)

    @Column
    private String location;

    @Column(name = "intensity_label")
    private String intensityLabel;
}
