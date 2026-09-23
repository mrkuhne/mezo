package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import java.util.List;
import java.util.UUID;

/** Rendered context and the actual sources that survived selection. */
public record FeedContext(String text, List<UUID> priorMessageIds,
                          List<UUID> retrievalRunIds, List<RefsEnvelope.Ref> refs) {
    public static final FeedContext EMPTY = new FeedContext("", List.of(), List.of(), List.of());
    public FeedContext {
        priorMessageIds = List.copyOf(priorMessageIds);
        retrievalRunIds = List.copyOf(retrievalRunIds);
        refs = List.copyOf(refs);
    }
}
