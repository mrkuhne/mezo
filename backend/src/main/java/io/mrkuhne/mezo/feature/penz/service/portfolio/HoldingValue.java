package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One holding valued. Money in HUF minor units.
 *
 * @param priced                false = valued at cost because no quote / no rate exists for it
 * @param previousValueHufMinor quote valuation only: quantity × previous close × previous rate (the base of the
 *                              portfolio's move percentages); 0 otherwise
 * @param changePct             the instrument's own price change since the previous close, percent, 2 decimals;
 *                              null without a quote or a previous close
 * @param priceAsOf             quote valuation only: the older of the quote's and the rate's date
 * @param quantity              units held; null in cost mode
 */
public record HoldingValue(ValuationKind kind, boolean priced, long valueHufMinor, long costHufMinor,
                           long priceMoveHufMinor, long fxMoveHufMinor, long previousValueHufMinor,
                           BigDecimal changePct, LocalDate priceAsOf, BigDecimal quantity) {
}
