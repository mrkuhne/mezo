package io.mrkuhne.mezo.feature.penz.service.engine;

/** What closing a month leaves: a leftover (to move to savings) or a deficit (carried over). */
public record CloseOutcome(long leftoverMinor, long deficitMinor) {
}
