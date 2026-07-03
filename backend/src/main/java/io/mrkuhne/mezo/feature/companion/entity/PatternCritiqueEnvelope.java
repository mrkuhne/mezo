package io.mrkuhne.mezo.feature.companion.entity;

/**
 * Typed jsonb envelope for the V3.2 4-factor critique (0..1 each, arch §4.7 weights:
 * 0.35 statistical · 0.25 confounders · 0.20 fact-alignment · 0.20 actionability).
 * Null on V3.1 statistical rows.
 */
public record PatternCritiqueEnvelope(
        Double statistical, Double confounders, Double l3align, Double actionability) {
}
