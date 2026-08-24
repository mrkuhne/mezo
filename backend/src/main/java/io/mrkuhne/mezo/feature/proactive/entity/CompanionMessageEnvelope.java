package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for companion_message.content (ADR 0006 / ProvenanceEnvelope precedent).
 * Refs are code-collected candidates the model selected by index (never invented).
 * {@code interventionKey} (W5.2, bd mezo-b3pp.19) is set ONLY on {@code kind=intervention} rows —
 * it names the library entry (`mezo.companion.interventions[].key`) so the „Segített?" verdict can
 * be rolled up per-intervention; null on every other kind (old rows deserialize to null).
 */
public record CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                       String interventionKey) {

    /** The pre-W5.2 shape — every non-intervention writer stays on this. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs) {
        this(eyebrow, body, refs, null);
    }

    public record Ref(String kind, String label) {
    }
}
