package io.mrkuhne.mezo.feature.needs.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** One live row per user+date — the day's Életjel-ring snapshot at Napzárás (mezo-dhzk). */
@Getter
@Setter
@Entity
@Table(name = "needs_day")
@SQLDelete(sql = "update needs_day set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class NeedsDayEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "needs_date", nullable = false)
    private LocalDate needsDate;

    @Min(0)
    @Max(100)
    @Column(nullable = false)
    private int energia;

    @Min(0)
    @Max(100)
    @Column(nullable = false)
    private int hidratacio;

    @Min(0)
    @Max(100)
    @Column(nullable = false)
    private int pihenes;

    @Min(0)
    @Max(100)
    @Column(nullable = false)
    private int mozgas;

    @Min(0)
    @Max(100)
    @Column(nullable = false)
    private int lelek;

    @Min(0)
    @Max(100)
    @Column(nullable = false)
    private int rend;

    @Column(name = "green_count", nullable = false)
    private int greenCount;

    @Column(name = "all_green", nullable = false)
    private boolean allGreen;

    @Column(name = "xp_awarded", nullable = false)
    private int xpAwarded;

    @Column(name = "streak_days", nullable = false)
    private int streakDays;
}
