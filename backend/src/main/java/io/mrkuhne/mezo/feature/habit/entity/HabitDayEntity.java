package io.mrkuhne.mezo.feature.habit.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** One habit × day row. Chain/position/title/xp live in the static catalog, not here. */
@Getter
@Setter
@Entity
@Table(name = "habit_day")
@SQLDelete(sql = "update habit_day set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class HabitDayEntity extends OwnedEntity {

    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_DONE = "done";
    public static final String STATUS_MISSED = "missed";
    public static final String SOURCE_DERIVED = "DERIVED";
    public static final String SOURCE_MANUAL = "MANUAL";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "habit_date", nullable = false)
    private LocalDate habitDate;

    @Column(name = "habit_key", nullable = false, length = 40)
    private String habitKey;

    @Column(nullable = false, length = 8)
    private String status = STATUS_PENDING;

    @Column(name = "done_at")
    private Instant doneAt;

    @Column(name = "xp_awarded", nullable = false)
    private Integer xpAwarded = 0;

    @Column(length = 7)
    private String source;
}
