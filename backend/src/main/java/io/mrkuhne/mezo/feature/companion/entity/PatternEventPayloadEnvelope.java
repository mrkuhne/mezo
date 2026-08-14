package io.mrkuhne.mezo.feature.companion.entity;

import java.util.UUID;

/**
 * Typed jsonb payload of one {@link PatternEventEntity} (S1, spec 2026-08-14). All fields
 * nullable — each kind fills only its own: snapshot → r/n/p; reinforced → reinforcementCount;
 * promoted → factId; the three decision kinds carry an empty payload.
 */
public record PatternEventPayloadEnvelope(Double r, Integer n, Double p,
                                          Integer reinforcementCount, UUID factId) {

    public static PatternEventPayloadEnvelope empty() {
        return new PatternEventPayloadEnvelope(null, null, null, null, null);
    }

    public static PatternEventPayloadEnvelope snapshot(double r, int n, double p) {
        return new PatternEventPayloadEnvelope(r, n, p, null, null);
    }

    public static PatternEventPayloadEnvelope reinforced(int reinforcementCount) {
        return new PatternEventPayloadEnvelope(null, null, null, reinforcementCount, null);
    }

    public static PatternEventPayloadEnvelope promoted(UUID factId) {
        return new PatternEventPayloadEnvelope(null, null, null, null, factId);
    }
}
