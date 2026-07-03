package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * L2 pattern memory (V3.1, spec §8): one row per detected correlation. {@code kind=statistical}
 * rows come from the nightly Pearson job and are UPSERTED by {@code (created_by, kind, pair_key)}
 * (partial unique index) — stats refresh while the row is {@code proposed}/{@code monitoring};
 * a user-judged {@code confirmed}/{@code rejected} row is never auto-touched (V3.3 adds
 * confirmed-recurrence reinforcement). {@code confidence} stays NULL for statistical rows —
 * honest small-n, the FE renders "tanulom" (spec §6); V3.2 hypotheses fill it from the critique.
 */
@Getter
@Setter
@Entity
@Table(name = "pattern")
@SQLDelete(sql = "update pattern set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PatternEntity extends OwnedEntity {

    public static final String KIND_STATISTICAL = "statistical";
    public static final String KIND_AI_HYPOTHESIS = "ai_hypothesis";

    public static final String STATUS_PROPOSED = "proposed";
    public static final String STATUS_MONITORING = "monitoring";
    public static final String STATUS_CONFIRMED = "confirmed";
    public static final String STATUS_REJECTED = "rejected";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_pattern_kind. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "statistical|ai_hypothesis")
    @Column(nullable = false, length = 16)
    private String kind;

    /** The catalog pair's stable key (e.g. {@code sleep-quality~next-day-training-rpe}) — upsert identity. */
    @NotNull
    @Size(max = 64)
    @Column(name = "pair_key", nullable = false, length = 64)
    private String pairKey;

    /** Mirrors ck_pattern_category — the FE PatternCategory. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "physiology|trigger|response")
    @Column(nullable = false, length = 16)
    private String category;

    /** Hungarian category chip label (from the catalog). */
    @NotNull
    @Size(max = 40)
    @Column(name = "category_label", nullable = false, length = 40)
    private String categoryLabel;

    @NotNull
    @Size(max = 200)
    @Column(nullable = false, length = 200)
    private String title;

    /** Deterministic HU description for statistical rows; the LLM mechanism for V3.2 hypotheses. */
    @Column(columnDefinition = "text")
    private String mechanism;

    /** Deterministic evidence chips (r=…, n=… nap, p=…, window). */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private PatternEvidenceEnvelope evidence;

    /** Pearson r (−1..1) — null on V3.2 hypothesis rows without a paired statistic. */
    @Column(precision = 6, scale = 4)
    private BigDecimal r;

    /** Sample size (aligned days). */
    @Column
    private Integer n;

    /** Two-sided p-value of the correlation. */
    @Column(precision = 7, scale = 6)
    private BigDecimal p;

    /** NULL for statistical rows (honest small-n); the 4-factor critique score for hypotheses (V3.2). */
    @Column(precision = 4, scale = 3)
    private BigDecimal confidence;

    /** The V3.2 4-factor critique — null until the hypothesis loop lands. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private PatternCritiqueEnvelope critique;

    /** Mirrors ck_pattern_status — proposed until Daniel judges it (L2 surface). */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "proposed|monitoring|confirmed|rejected")
    @Column(nullable = false, length = 16)
    private String status = STATUS_PROPOSED;

    /** V3.3: the knowledge fact a confirmed pattern was promoted into (loose ref, ON DELETE SET NULL). */
    @Column(name = "promoted_fact_id", columnDefinition = "uuid")
    private UUID promotedFactId;

    /** When the nightly job last computed/refreshed the stats. */
    @NotNull
    @Column(name = "last_detected_at", nullable = false)
    private Instant lastDetectedAt = Instant.now();
}
