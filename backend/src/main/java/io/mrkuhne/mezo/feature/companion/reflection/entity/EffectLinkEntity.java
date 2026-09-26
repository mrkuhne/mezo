package io.mrkuhne.mezo.feature.companion.reflection.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One computed effect link between a subject (a person or a named event) and a mood/energy/stress
 * metric (Emlékezet S4, bd mezo-d6ivw.4). Upserted per {@code (created_by, subject_kind,
 * subject_key, metric)} whenever {@code EffectLinkCalculator} recomputes it — never accumulated
 * as history, exactly like {@code person_fact}'s {@code active} row.
 */
@Getter
@Setter
@Entity
@Table(name = "effect_link")
@SQLDelete(sql = "update effect_link set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class EffectLinkEntity extends OwnedEntity {

    /** Mirrors ck_effect_link_subject_kind. */
    public static final String SUBJECT_PERSON = "person";
    public static final String SUBJECT_EVENT = "event";

    /** Mirrors ck_effect_link_metric. */
    public static final String METRIC_MENTAL = "mental";
    public static final String METRIC_ENERGY = "energy";
    public static final String METRIC_STRESS = "stress";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Size(max = 8)
    @Pattern(regexp = "person|event")
    @Column(name = "subject_kind", nullable = false, length = 8)
    private String subjectKind;

    @NotNull
    @Size(max = 64)
    @Column(name = "subject_key", nullable = false, length = 64)
    private String subjectKey;

    @NotNull
    @Size(max = 8)
    @Pattern(regexp = "mental|energy|stress")
    @Column(nullable = false, length = 8)
    private String metric;

    @NotNull
    @Column(name = "cliffs_delta", nullable = false, precision = 5, scale = 3)
    private BigDecimal cliffsDelta;

    @NotNull
    @Column(name = "mean_diff", nullable = false, precision = 5, scale = 2)
    private BigDecimal meanDiff;

    @NotNull
    @Column(name = "subject_days", nullable = false)
    private Integer subjectDays;

    @NotNull
    @Column(name = "complement_days", nullable = false)
    private Integer complementDays;

    @NotNull
    @Size(max = 8)
    @Pattern(regexp = "enyhe|kozepes|eros")
    @Column(name = "strength_band", nullable = false, length = 8)
    private String strengthBand;

    @NotNull
    @Size(max = 8)
    @Pattern(regexp = "gyenge|kozepes|eros")
    @Column(name = "confidence_tier", nullable = false, length = 8)
    private String confidenceTier;

    @NotNull
    @Column(name = "window_days", nullable = false)
    private Integer windowDays;

    @NotNull
    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;
}
