package io.mrkuhne.mezo.feature.penz.service.engine;

/**
 * An account balance in the account's currency (minor units). {@code skippedCount} counts the
 * transactions left out because their currency differs from a non-HUF account's.
 */
public record AccountBalance(long balanceMinor, int skippedCount) {
}
