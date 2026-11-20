package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * The whole portfolio on a date (HUF minor units).
 *
 * @param priceMovePct the price move over the quoted holdings' previous value, percent, 1 decimal; null when that
 *                     base is 0
 * @param pricesAsOf   the oldest quote date among the quote-valued holdings; null without any
 * @param stale        prices older than 3 days, or the quote source failing
 * @param unpricedCount holdings with an open cost valued at cost (no quote, no rate)
 * @param sleeves      always three: short, mid, long
 */
public record PortfolioResult(LocalDate date, long totalHufMinor, long costHufMinor, long priceMoveHufMinor,
                              long fxMoveHufMinor, BigDecimal priceMovePct, BigDecimal fxMovePct,
                              LocalDate pricesAsOf, boolean stale, int unpricedCount, Long fixedCostsMonthlyHufMinor,
                              List<SleeveResult> sleeves) {
}
