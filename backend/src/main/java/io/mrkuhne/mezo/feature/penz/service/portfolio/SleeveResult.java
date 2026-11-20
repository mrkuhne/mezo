package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.util.List;

/**
 * One sleeve: sums of its holdings, its share of the total (percent, 1 decimal) and, for the long sleeve only,
 * the whole months of fixed costs it covers today with no growth assumed.
 */
public record SleeveResult(Sleeve sleeve, long valueHufMinor, long costHufMinor, BigDecimal sharePct,
                           long priceMoveHufMinor, long fxMoveHufMinor, Integer coverageMonths,
                           List<PositionResult> positions) {
}
