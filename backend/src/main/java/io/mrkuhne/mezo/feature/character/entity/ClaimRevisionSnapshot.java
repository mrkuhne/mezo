package io.mrkuhne.mezo.feature.character.entity;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Complete mutable claim state; immutable typed JSON protects undo from partial restoration. */
public record ClaimRevisionSnapshot(UUID dimensionId, String text, BigDecimal confidence, String status,
        ClaimEvidenceEnvelope evidence, ClaimFeedbackEnvelope userFeedback,
        ClaimConfidenceHistoryEnvelope confidenceHistory, Boolean sensitive, Instant updatedAt,
        LocalDate observedFrom, LocalDate observedTo, LocalDate validFrom, LocalDate validTo) {
    public ClaimRevisionSnapshot {
        // PostgreSQL numeric(3,2) normalizes 0.6 to 0.60. The snapshot is captured before
        // reloading the row, so normalize here (also when reading older JSON snapshots).
        confidence = confidence == null ? null : confidence.setScale(2, RoundingMode.HALF_UP);
    }

    public static ClaimRevisionSnapshot of(CharacterClaimEntity claim) {
        return new ClaimRevisionSnapshot(claim.getDimensionId(), claim.getText(), claim.getConfidence(),
                claim.getStatus(), claim.getEvidence(), claim.getUserFeedback(), claim.getConfidenceHistory(),
                claim.getSensitive(), claim.getUpdatedAt(), claim.getObservedFrom(), claim.getObservedTo(),
                claim.getValidFrom(), claim.getValidTo());
    }

    public void restore(CharacterClaimEntity claim) {
        claim.setDimensionId(dimensionId);
        claim.setText(text);
        claim.setConfidence(confidence);
        claim.setStatus(status);
        claim.setEvidence(evidence);
        claim.setUserFeedback(userFeedback);
        claim.setConfidenceHistory(confidenceHistory);
        claim.setSensitive(sensitive);
        claim.setObservedFrom(observedFrom);
        claim.setObservedTo(observedTo);
        claim.setValidFrom(validFrom);
        claim.setValidTo(validTo);
    }
}
