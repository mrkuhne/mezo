package io.mrkuhne.mezo.feature.companion.flags.service;

import java.util.UUID;

/**
 * Published by {@link FlagService} for every raise that actually got WRITTEN (post-cooldown) —
 * W5.2's (bd mezo-b3pp.19) delivery trigger. Published inside the logging transaction, so an
 * AFTER_COMMIT listener only ever reacts to raises that persisted (the ChatTurnCompleted
 * precedent); a rolled-back raise delivers nothing.
 */
public record FlagRaisedEvent(UUID userId, String flagKey, String source) {
}
