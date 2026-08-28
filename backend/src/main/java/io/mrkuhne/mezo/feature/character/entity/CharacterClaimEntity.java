package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A single character claim on a dimension (Karakter spec §4): confidence-scored, expert- or
 * user-originated, with typed jsonb evidence/feedback/confidence-history envelopes.
 */
@Getter
@Setter
@Entity
@Table(name = "character_claim")
@SQLDelete(sql = "update character_claim set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterClaimEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "dimension_id", nullable = false, columnDefinition = "uuid")
    private UUID dimensionId;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String text;

    /** 0.00–1.00 — surfaced to the FE only as human words (Minták precedent). */
    @NotNull
    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal confidence;

    /** ACTIVE | RETIRED — a Mezo-rejected proposal never becomes a row (spec §4). */
    @NotNull
    @Column(nullable = false, length = 10)
    private String status;

    @Column(name = "origin_conference_id", columnDefinition = "uuid")
    private UUID originConferenceId;

    /** Expert persona key that proposed it (or "user" for feedback-born claims later). */
    @NotNull
    @Column(name = "proposed_by", nullable = false, length = 40)
    private String proposedBy;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private ClaimEvidenceEnvelope evidence;

    /** The §3 mirror-tone class (self-calibration, rejection-pattern, med-cycle). */
    @NotNull
    @Column(nullable = false)
    private Boolean sensitive = false;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "user_feedback", nullable = false, columnDefinition = "jsonb")
    private ClaimFeedbackEnvelope userFeedback;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "confidence_history", nullable = false, columnDefinition = "jsonb")
    private ClaimConfidenceHistoryEnvelope confidenceHistory;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
