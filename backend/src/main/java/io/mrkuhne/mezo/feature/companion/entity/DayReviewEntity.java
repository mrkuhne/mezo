package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * The persisted day-review cache row (mezo-jcpt.4, daily evaluation slice 2/2) — one live row
 * per user + day, carrying the LLM prose layer over that day's deterministic 6-dimension score.
 *
 * <p><b>This is a cache, not a truth.</b> The score itself is a deterministic function of the
 * day's logs ({@code DayEvaluationEngine} via {@code DayScoreService}); this row exists only to
 * avoid re-asking the LLM for prose the numbers already justify. {@link #inputsHash} is the
 * fingerprint of the deterministic inputs the cached {@link #envelope} was generated from —
 * {@code DayReviewService} (task 8) recomputes it on every read and regenerates the envelope on
 * a mismatch, exactly like {@code WeeklyScoreEntity#computedAt} gates the weekly score cache.
 *
 * <p>A day whose review was never generated (not yet asked for, LLM disabled, LLM failed) has NO
 * row: an absent review is absent, never a stored empty envelope. In that case the day still has
 * a full deterministic score — the score does not depend on this table.
 */
@Getter
@Setter
@Entity
@Table(name = "day_review")
@SQLDelete(sql = "update day_review set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DayReviewEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The reviewed calendar day. */
    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    /** The cached LLM prose layer — see {@link DayReviewJson}. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private DayReviewJson envelope;

    /** Fingerprint of the deterministic day inputs the cached {@link #envelope} was built from. */
    @NotNull
    @Column(name = "inputs_hash", nullable = false, length = 64)
    private String inputsHash;

    /** When this envelope was last generated — the staleness reference point. */
    @NotNull
    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;
}
