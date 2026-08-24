package io.mrkuhne.mezo.feature.companion.graph.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * One edge the W2.2 structurer proposes from a freshly promoted node to an existing one.
 * {@code index} points into the numbered candidate list the prompt handed the model — an index,
 * not a title, so nothing depends on the model echoing Hungarian text back verbatim.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GraphEdgeSuggestion(Integer index, String kind, Double confidence) {
}
