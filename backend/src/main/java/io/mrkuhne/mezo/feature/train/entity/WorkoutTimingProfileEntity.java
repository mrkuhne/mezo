package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A per-user learned timing component (RFC 6298 SRTT/RTTVAR pair) — one row per {@link
 * #component}: {@code set_cycle_compound | set_cycle_isolation | transition | lead_in} (DB
 * CHECK). Seeds live in config (mezo.train.timing.seed-*), not here: a user with no row yet
 * gets the static frontend constants.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "workout_timing_profile")
@SQLDelete(sql = "update workout_timing_profile set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WorkoutTimingProfileEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** set_cycle_compound | set_cycle_isolation | transition | lead_in (DB CHECK). */
    @NotNull
    @Column(nullable = false)
    private String component;

    /** The smoothed estimate, in seconds (RFC 6298 SRTT). */
    @NotNull
    @Column(name = "value_num", nullable = false)
    private Double valueNum;

    /** The smoothed absolute deviation, in seconds (RFC 6298 RTTVAR) — the outlier gate's width. */
    @NotNull
    @Column(name = "deviation_num", nullable = false)
    private Double deviationNum;

    /** Accepted observations so far. The outlier gate stays open below minSamples. */
    @NotNull
    @Column(nullable = false)
    private Integer samples = 0;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
