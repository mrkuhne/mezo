package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for memoir.anchors (the BriefingContentEnvelope precedent): refs the
 * model SELECTED by index from code-collected candidates — never invented (spec §6).
 */
public record MemoirAnchorsEnvelope(List<Anchor> anchors) {

    public record Anchor(String kind, String label) {
    }
}
