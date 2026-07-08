package io.mrkuhne.mezo.feature.proactive.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One workout challenge (proactive P2, bd mezo-hbwi): the companion proposes a per-exercise
 * PR/Depth/Volume micro-challenge, Daniel accepts/dismisses (L2), and the outcome path evaluates
 * it deterministically from logged sets (hit | miss | inconclusive). Identity is
 * (created_by, template_session_id, workout_date); {@code exerciseId} is the TEMPLATE exercise.
 * {@code outcomeGood} is null until evaluated (and stays null when there are no logged sets —
 * honest "inconclusive"); {@code confidence} is null while the model is still learning.
 */
@Getter
@Setter
@Entity
@Table(name = "challenge")
@SQLDelete(sql = "update challenge set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ChallengeEntity extends OwnedEntity {

    public static final String TYPE_PR = "PR";
    public static final String TYPE_DEPTH = "Depth";
    public static final String TYPE_VOLUME = "Volume";
    public static final String STATUS_PROPOSED = "proposed";
    public static final String STATUS_ACCEPTED = "accepted";
    public static final String STATUS_DISMISSED = "dismissed";
    public static final String STATUS_HIT = "hit";
    public static final String STATUS_MISS = "miss";
    public static final String STATUS_INCONCLUSIVE = "inconclusive";
    public static final String RISK_LOW = "low";
    public static final String RISK_MID = "mid";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "template_session_id", nullable = false)
    private UUID templateSessionId;

    @NotNull
    @Column(name = "workout_date", nullable = false)
    private LocalDate workoutDate;

    @NotNull
    @Column(name = "exercise_id", nullable = false)
    private UUID exerciseId;

    @NotNull
    @Column(name = "exercise_name", nullable = false)
    private String exerciseName;

    @NotNull
    @Column(nullable = false)
    private String type;

    @NotNull
    @Column(nullable = false)
    private String status = STATUS_PROPOSED;

    @NotNull
    @Column(nullable = false)
    private String risk = RISK_LOW;

    @NotNull
    @Column(nullable = false)
    private String title;

    @NotNull
    @Column(nullable = false)
    private String why;

    @NotNull
    @Column(nullable = false)
    private String glory;

    @Column(name = "target_weight_kg", precision = 6, scale = 2)
    private BigDecimal targetWeightKg;

    @Column(name = "target_reps")
    private Integer targetReps;

    @Column(name = "target_sets")
    private Integer targetSets;

    @Column(name = "target_rir")
    private Integer targetRir;

    @Column(precision = 4, scale = 3)
    private BigDecimal confidence;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private ChallengeRefsEnvelope refs = new ChallengeRefsEnvelope(List.of());

    @Column
    private String outcome;

    @Column(name = "outcome_good")
    private Boolean outcomeGood;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
