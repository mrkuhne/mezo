package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for briefing.content (ADR 0006 / ProvenanceEnvelope precedent).
 * Mirrors the FE Briefing shape MINUS confidence and tone — decided at B1.1: an LLM's
 * self-reported confidence is a fabricated number (spec §6), and tone is dead FE data.
 * Refs are code-collected candidates the model selected by index (never invented).
 */
public record BriefingContentEnvelope(String eyebrow, List<String> body, List<Ref> refs) {

    public record Ref(String kind, String label) {
    }
}
