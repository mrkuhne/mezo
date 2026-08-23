package io.mrkuhne.mezo.feature.companion.profile.entity;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * W4.3 (mezo-b3pp.17): the profile node's typed {@code meta} payload — what the synthesis was
 * built from, so a surprising profile can be explained without re-running the job. {@link
 * #toMeta()} writes it as a plain map keyed by {@link #META_KEY} (the {@code GraphProposedEdge}
 * idiom: the envelope owns its own meta key inside the node's {@code meta} JSON). There is no
 * read-back method — nothing in production or tests reads {@code meta.profile} back out yet; a
 * caller that needs it decodes the map by hand at the {@link #META_KEY} entry.
 */
public record ProfileMetaEnvelope(
        Instant generatedAt, int feedbackSignals, int reviewedDecisions, int graphNodes) {

    public static final String META_KEY = "profile";

    public Map<String, Object> toMeta() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("generatedAt", generatedAt.toString());
        payload.put("feedbackSignals", feedbackSignals);
        payload.put("reviewedDecisions", reviewedDecisions);
        payload.put("graphNodes", graphNodes);
        return Map.of(META_KEY, payload);
    }
}
