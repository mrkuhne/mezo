package io.mrkuhne.mezo.feature.companion.graph.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * One life event the W2.3 extractor proposed for a day, with the edges it wants from that event
 * to existing nodes. {@code index} points into the numbered candidate list the prompt handed the
 * model — an index, not a title, so nothing depends on the model echoing Hungarian back verbatim
 * (the {@code GraphEdgeSuggestion} idiom).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LifeEventSuggestion(String title, String summary, List<EdgeSuggestion> edges) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EdgeSuggestion(Integer index, String kind, Double confidence) {
    }
}
