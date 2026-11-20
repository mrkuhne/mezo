package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One buy or sell as the lot book reads it.
 *
 * @param quantity       units, or null for a holding kept by value (a bond, cash)
 * @param amountHufMinor the stored HUF twin of the amount paid / received
 */
public record LotTxn(UUID id, LocalDate date, Side side, BigDecimal quantity, long amountHufMinor) {
}
