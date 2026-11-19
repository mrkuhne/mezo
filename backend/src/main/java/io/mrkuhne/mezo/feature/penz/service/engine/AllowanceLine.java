package io.mrkuhne.mezo.feature.penz.service.engine;

/** One line of the allowance derivation, in HUF minor units. */
public record AllowanceLine(AllowanceLineKey key, long amountMinor) {
}
