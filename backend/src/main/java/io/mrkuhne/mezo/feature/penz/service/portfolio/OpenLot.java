package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * What is left of one buy after the sells consumed the older lots.
 *
 * @param quantity     units left, null in cost mode
 * @param costHufMinor the HUF cost of what is left (FIFO cost basis)
 */
public record OpenLot(LocalDate date, BigDecimal quantity, long costHufMinor) {
}
