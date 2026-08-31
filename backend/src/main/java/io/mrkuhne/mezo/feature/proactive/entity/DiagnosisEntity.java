package io.mrkuhne.mezo.feature.proactive.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One on-demand diagnosis (mezo-hqfi, spec 2026-08-31) — the {@code WeeklyReviewEntity} idiom
 * applied to a rolling window. Many rows per user accumulate: the list of past diagnoses and what
 * their experiments concluded is the feature's longitudinal value, so there is no unique index.
 */
@Getter
@Setter
@Entity
@Table(name = "diagnosis")
@SQLDelete(sql = "update diagnosis set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DiagnosisEntity extends OwnedEntity {

    public static final String PHENOMENON_FATIGUE = "fatigue";
    public static final String PHENOMENON_SLEEP = "sleep";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Pattern(regexp = "fatigue|sleep")
    @Column(nullable = false, length = 30)
    private String phenomenon = PHENOMENON_FATIGUE;

    @NotNull
    @Column(name = "window_days", nullable = false)
    private Integer windowDays;

    /** The 1-2 sentence Hungarian answer. */
    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String verdict;

    @NotNull
    @Pattern(regexp = "strong|moderate|weak")
    @Column(nullable = false, length = 10)
    private String confidence;

    /** The code-collected candidate list, frozen at generation time. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private DiagnosisEvidenceEnvelope evidence;

    /** Validated, model-selected suspects — indexes into {@link #evidence}, never invented. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private DiagnosisSuspectsEnvelope suspects;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
