package io.mrkuhne.mezo.feature.people.service;

import java.util.UUID;

/**
 * mezo-d6ivw.13: a person fact was undone ({@code active=false}) by the user. Consumers that keep
 * a derived copy — the companion's „Rólam is" knowledge fact — remove it on this signal; people
 * never imports companion (ArchUnit), so the cascade travels as an event.
 */
public record PersonFactUndoneEvent(UUID userId, UUID personId, UUID factId) {
}
