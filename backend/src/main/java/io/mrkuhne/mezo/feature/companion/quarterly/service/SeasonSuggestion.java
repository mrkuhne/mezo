package io.mrkuhne.mezo.feature.companion.quarterly.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * One SEASON the quarterly model proposes (W5.3, bd mezo-b3pp.20) — the {@code
 * LifeEventSuggestion} shape, minus edges: a season is a period reading, not a causal claim, so
 * this slice proposes no graph edges at all (the L2 accept path materialises none).
 *
 * <p>Unknown properties are ignored: a chatty model adding a field must not fail the whole parse.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SeasonSuggestion(String title, String summary) {
}
