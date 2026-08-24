package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;

/**
 * One flag the evaluator says is TRUE right now, with the inputs that made it true (W5.1, bd
 * mezo-b3pp.18). Not yet a log row: {@code FlagService} still applies the per-flag cooldown.
 */
public record FlagRaise(String flagKey, FlagPayloadEnvelope payload) {
}
