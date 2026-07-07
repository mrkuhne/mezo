package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/** Typed jsonb envelope for a challenge's code-collected, model-selected refs. */
public record ChallengeRefsEnvelope(List<Ref> refs) {
    public record Ref(String kind, String label) {
    }
}
