package io.mrkuhne.mezo.feature.biometrics.checkin.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * The biomarker snapshot frozen at a check-in's capture moment (Boop B3, mezo-r36n9.13, spec §7.3) — one
 * live row per check-in ({@code uq_check_in_snapshot_check_in_live}). Every reading is nullable and carries
 * its sample time; {@code computedBy} is {@code phone} (HealthKit at capture) or {@code server} (filled from
 * health_sample / daily_metric / sleep_log when the check-in arrived without one).
 */
@Getter
@Setter
@Entity
@Table(name = "check_in_snapshot")
@SQLDelete(sql = "update check_in_snapshot set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CheckInSnapshotEntity extends OwnedEntity {

    public static final String COMPUTED_BY_PHONE = "phone";
    public static final String COMPUTED_BY_SERVER = "server";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "check_in_id", nullable = false)
    private UUID checkInId;

    @Column(name = "hr_bpm")
    private Integer hrBpm;

    @Column(name = "hr_at")
    private Instant hrAt;

    @Column(name = "hrv_ms")
    private Double hrvMs;

    @Column(name = "hrv_at")
    private Instant hrvAt;

    /** 14-day median HRV ("szokott"). */
    @Column(name = "hrv_usual_ms")
    private Double hrvUsualMs;

    @Column
    private Integer steps;

    /** True when {@code steps} is the whole day's total (server fallback), not the count up to capture. */
    @Column(name = "steps_is_day_total")
    private Boolean stepsIsDayTotal;

    @Column(name = "sleep_minutes")
    private Integer sleepMinutes;

    /** Source bundle id of the readings. */
    @Column(length = 120)
    private String source;

    @Column(name = "computed_by", nullable = false, length = 8)
    private String computedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
