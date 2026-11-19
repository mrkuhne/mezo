package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The engine's view of one transaction (old {@code Txn}, only the fields the engine reads).
 * {@code amountMinor} is in {@code currency}; {@code amountHufMinor} is the stored HUF twin the
 * allowance works with. {@code recurringRuleId} is null for a non-recurring transaction (a rule
 * that was since deleted keeps its id here — the txn still counts as recurring).
 */
public record TxnInput(
    UUID accountId,
    TxnKind kind,
    long amountMinor,
    String currency,
    long amountHufMinor,
    LocalDate date,
    UUID recurringRuleId) {
}
