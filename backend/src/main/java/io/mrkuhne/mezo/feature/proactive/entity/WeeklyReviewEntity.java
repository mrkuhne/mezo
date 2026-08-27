package io.mrkuhne.mezo.feature.proactive.entity;

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
 * The companion's weekly review narrative (Én/Heti, spec 2026-08-27 §5, bd mezo-p2tr) — one live
 * row per user + ISO-Monday week; partial unique so a soft-deleted row can be regenerated.
 * {@code highlights} is a typed jsonb envelope of code-collected, model-selected refs (the
 * {@code MemoirEntity.anchors} precedent); {@code dayNotes} carries the short per-day comments
 * the answer chose to write.
 */
@Getter
@Setter
@Entity
@Table(name = "weekly_review")
@SQLDelete(sql = "update weekly_review set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WeeklyReviewEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The ISO Monday of the review's week. */
    @NotNull
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    /** The review prose — what went well, what broke, what pattern showed up across the days. */
    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String summary;

    /** Short per-day companion notes, filtered to dates inside this week. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "day_notes", nullable = false, columnDefinition = "jsonb")
    private WeeklyReviewDayNotesEnvelope dayNotes;

    /** Code-collected, model-selected refs — never invented. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private WeeklyReviewHighlightsEnvelope highlights;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
