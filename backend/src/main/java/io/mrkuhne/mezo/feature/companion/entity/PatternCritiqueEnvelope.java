package io.mrkuhne.mezo.feature.companion.entity;

/**
 * Typed jsonb envelope for the V3.2 4-factor critique (0..1 each, arch §4.7 weights:
 * 0.35 statistical · 0.25 confounders · 0.20 fact-alignment · 0.20 actionability) + the
 * critic's prose {@code reasoning} (surfaced as the card's "AI gondolatmenete"). Null on
 * V3.1 statistical rows; {@code reasoning} absent on pre-V3.2 jsonb is simply null.
 */
public record PatternCritiqueEnvelope(
        Double statistical, Double confounders, Double l3align, Double actionability, String reasoning) {
}
