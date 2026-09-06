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
import java.time.temporal.ChronoUnit;
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
    /** S2 (mezo-eq85.2): a self-proposed, falsifiable hypothesis carrying a {@link TestPlanEnvelope}. */
    public static final String KIND_REFLECTION = "reflection";

    public static final String STATUS_PROPOSED = "proposed";
    public static final String STATUS_MONITORING = "monitoring";
    public static final String STATUS_CONFIRMED = "confirmed";
    public static final String STATUS_REJECTED = "rejected";
    /** S2: the ENGINE disproved it (miss streak or two negative replies) — terminal. */
    public static final String STATUS_REFUTED = "refuted";
    /** S2: no data for long enough that testing it is meaningless — parked, revives on data. */
    public static final String STATUS_DORMANT = "dormant";

    /** {@code origin} — where the row came from; display only, it never drives the lifecycle. */
    public static final String ORIGIN_PAIR_CATALOG = "pair_catalog";
    public static final String ORIGIN_WEEKLY_HYPOTHESIS = "weekly_hypothesis";
    public static final String ORIGIN_QUICK_NOTICE = "quick_notice";
    public static final String ORIGIN_NIGHTLY_REFLECTION = "nightly_reflection";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_pattern_kind. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "statistical|ai_hypothesis|reflection")
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
    @Pattern(regexp = "proposed|monitoring|confirmed|rejected|refuted|dormant")
    @Column(nullable = false, length = 16)
    private String status = STATUS_PROPOSED;

    /** S2 (mezo-eq85.2): stable hypothesis identity — {@code ref-<hash>} from the test plan,
     *  {@code pair:<key>} on catalog rows. Unique per user while the row lives. */
    @Size(max = 80)
    @Column(name = "hypothesis_key", length = 80)
    private String hypothesisKey;

    /** S2: the falsifiable test the nightly pass re-runs — null on rows that carry no test. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "test_plan", columnDefinition = "jsonb")
    private TestPlanEnvelope testPlan;

    /** S2: deterministic 0..1 certainty (gate + user replies + evidence streak) — spec §4.3.
     *  Code computes it; an LLM must never write this column. */
    @Column(precision = 4, scale = 3)
    private BigDecimal belief;

    /** S2: how many nightly evaluations confirmed the plan's prediction. */
    @NotNull
    @Column(name = "evidence_hits", nullable = false)
    private Integer evidenceHits = 0;

    /** S2: how many LIVE evaluations contradicted it (a no-data night counts as neither). */
    @NotNull
    @Column(name = "evidence_misses", nullable = false)
    private Integer evidenceMisses = 0;

    /** S2: provenance chip — mirrors ck_pattern_origin. */
    @Size(max = 24)
    @Pattern(regexp = "pair_catalog|weekly_hypothesis|quick_notice|nightly_reflection")
    @Column(length = 24)
    private String origin;

    /** V3.3: the knowledge fact a confirmed pattern was promoted into (loose ref, ON DELETE SET NULL). */
    @Column(name = "promoted_fact_id", columnDefinition = "uuid")
    private UUID promotedFactId;

    /** When the nightly job last computed/refreshed the stats. Truncated to micros on every
     *  write (here and in {@code PatternDetectionService}/{@code HypothesisPipelineService}):
     *  {@code timestamptz} stores microseconds and ROUNDS a nanosecond value, while readers that
     *  compare against the in-memory instant truncate — on linux, where {@code Instant.now()} has
     *  nanosecond resolution, the two drift by 1 us and the row re-read from Postgres no longer
     *  equals the one that was persisted (mezo-mfmb). The {@code RitualService.close} precedent. */
    @NotNull
    @Column(name = "last_detected_at", nullable = false)
    private Instant lastDetectedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);

    /**
     * S2: has the USER judged this row? {@code confirmed}/{@code rejected} are Daniel's verdicts —
     * the engine's nightly pass reads them and stops, whatever the statistics say.
     */
    public boolean isUserFrozen() {
        return isUserFrozen(status);
    }

    /** The same question about a bare status string — the pure {@code HypothesisLifecycle} asks it
     *  that way, and "what counts as the user's verdict" must have exactly one definition. */
    public static boolean isUserFrozen(String status) {
        return STATUS_CONFIRMED.equals(status) || STATUS_REJECTED.equals(status);
    }
}
