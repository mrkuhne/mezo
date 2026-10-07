package io.mrkuhne.mezo.feature.auth.entity;

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
import org.hibernate.annotations.SQLRestriction;

/**
 * One "Most ne tanulj" interval (mezo-rrjxe, spec 2026-10-07). In effect on
 * {@code [startedAt, coalesce(endedAt, plannedEndAt, +infinity))}; never deleted, because every
 * look-back window must keep excluding it.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "learning_pause")
@SQLRestriction("is_deleted = false")
public class LearningPauseEntity extends OwnedEntity {

    public static final String TONIGHT = "tonight";
    public static final String TOMORROW_MORNING = "tomorrow_morning";
    public static final String OPEN = "open";
    public static final String END_USER = "user";
    public static final String END_EXPIRED = "expired";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "planned_end_at")
    private Instant plannedEndAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "duration_choice", nullable = false, length = 20)
    private String durationChoice;

    @Column(name = "end_reason", length = 8)
    private String endReason;

    @Column(name = "reminded_at")
    private Instant remindedAt;

    /** The instant this interval stops applying; null = still open-ended. */
    public Instant effectiveEnd() {
        return endedAt != null ? endedAt : plannedEndAt;
    }
}
