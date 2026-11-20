package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * What the valuation needs to know about a holding.
 *
 * @param symbol      the quote symbol, null = not quoted
 * @param bondRatePct the simple-interest rate of an unquoted bond, percent; null = none
 */
public record HoldingSpec(UUID id, String assetType, String currency, String symbol, BigDecimal bondRatePct) {
}
