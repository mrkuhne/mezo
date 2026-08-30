package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * The persisted weekly score (Én/Heti, bd mezo-d20.7.5, handoff 2026-08-28 §6.3) — one live row
 * per user + ISO-Monday week, carrying the week's overall score and the four subscore averages.
 *
 * <p><b>This is a cache, not a truth.</b> The score is a deterministic function of the week's
 * logs ({@code DayScoreService}), and a retroactive log changes it — so the row is stamped with
 * {@link #computedAt} and refreshed by {@code WeeklyScoreService} whenever the week saw a write
 * after that stamp. Deliberately NOT columns on {@code weekly_review}: the score exists for weeks
 * that never produced a review (empty week, unusable LLM answer), because the score does not
 * depend on the analysis.
 *
 * <p>A week whose score is null (fewer than 2 scored days — the "tanulom" gate) has NO row: an
 * absent score is absent, never a stored 0.
 */
@Getter
@Setter
@Entity
@Table(name = "weekly_score")
@SQLDelete(sql = "update weekly_score set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WeeklyScoreEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The ISO Monday of the scored week. */
    @NotNull
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    /** 0–100 — round(mean of the week's non-null day scores). Never stored when null. */
    @NotNull
    @Min(0)
    @Max(100)
    @Column(nullable = false)
    private Integer score;

    /** Mean of the week's non-null sleep subscores; null when the week had none. */
    @Column(name = "sleep_avg", precision = 5, scale = 2)
    private BigDecimal sleepAvg;

    @Column(name = "fuel_avg", precision = 5, scale = 2)
    private BigDecimal fuelAvg;

    @Column(name = "checkin_avg", precision = 5, scale = 2)
    private BigDecimal checkinAvg;

    @Column(name = "activity_avg", precision = 5, scale = 2)
    private BigDecimal activityAvg;

    /** When this value was last computed from the week's data — the staleness reference point. */
    @NotNull
    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;
}
