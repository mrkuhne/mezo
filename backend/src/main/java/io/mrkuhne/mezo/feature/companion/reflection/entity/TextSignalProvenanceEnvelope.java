package io.mrkuhne.mezo.feature.companion.reflection.entity;

/**
 * Typed origin metadata for one extracted text signal (Reflexió S1, bd mezo-eq85.1) — the
 * {@code MemoryProvenanceEnvelope} idiom: WHICH model produced the numbers, WHEN, and how long
 * the source text was. Audit only; nothing downstream reads it to make a decision.
 */
public record TextSignalProvenanceEnvelope(String model, String extractedAt, Integer textLength) {

    public static TextSignalProvenanceEnvelope empty() {
        return new TextSignalProvenanceEnvelope(null, null, null);
    }
}
