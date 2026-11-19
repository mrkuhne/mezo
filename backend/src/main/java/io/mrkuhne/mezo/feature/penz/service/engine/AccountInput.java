package io.mrkuhne.mezo.feature.penz.service.engine;

import java.util.UUID;

/** The engine's view of an account (old {@code Account}, only what the balance reads). */
public record AccountInput(UUID id, String currency, long openingBalanceMinor) {
}
