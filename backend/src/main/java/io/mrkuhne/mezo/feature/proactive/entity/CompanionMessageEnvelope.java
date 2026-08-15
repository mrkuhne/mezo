package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for companion_message.content (ADR 0006 / ProvenanceEnvelope precedent,
 * mirrors {@link BriefingContentEnvelope}). Refs are code-collected candidates the model
 * selected by index (never invented).
 */
public record CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs) {

    public record Ref(String kind, String label) {
    }
}
