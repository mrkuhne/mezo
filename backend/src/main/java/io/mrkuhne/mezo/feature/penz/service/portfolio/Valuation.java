package io.mrkuhne.mezo.feature.penz.service.portfolio;

import io.mrkuhne.mezo.feature.penz.service.engine.PenzDates;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * THE valuation policy of Boop Pénz (L6 build notes calls 2 and 3) — distinct from the L4 booking policy, pure.
 *
 * <ul>
 *   <li><b>Quote</b> (a symbol, a cached quote, quantities, and a cached rate unless HUF): value = qty × price × fx.
 *       The move since the previous close splits into <b>price</b> = qty × (price − prev) × fxPrev and
 *       <b>currency</b> = qty × price × (fx − fxPrev); a missing previous close means no move. HUF: fx = 1.</li>
 *   <li><b>Accrual</b> (an unquoted bond with a rate): per open lot {@code cost × (1 + rate × days / 365)},
 *       {@code days = max(0, daysBetweenInclusive(lot date, today) − 1)}.</li>
 *   <li><b>Cost</b> otherwise: the FIFO cost of the open lots, not priced — except forint cash, whose cost IS its
 *       exact value.</li>
 * </ul>
 * Prices are per unit in major units; every result is HUF minor, rounded HALF_UP once per figure.
 */
public final class Valuation {

    private static final String HUF = "HUF";
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal DAYS_PER_YEAR = BigDecimal.valueOf(365);

    private Valuation() {
    }

    /**
     * @param quote the cached quote of the holding's symbol (null = none, or not in the holding's currency)
     * @param fx    the cached {@code CURHUF=X} quote; ignored for a HUF holding
     */
    public static HoldingValue value(HoldingSpec h, LotBook book, QuotePoint quote, QuotePoint fx, LocalDate today) {
        long cost = book.openCostHufMinor();
        boolean huf = HUF.equals(h.currency());
        QuotePoint rate = huf ? new QuotePoint(BigDecimal.ONE, BigDecimal.ONE, null) : fx;
        if (h.symbol() != null && quote != null && book.quantityMode() && rate != null) {
            return quoted(book.openQuantity(), cost, quote, rate);
        }
        if (h.bondRatePct() != null && "bond".equals(h.assetType())) {
            return new HoldingValue(ValuationKind.ACCRUAL, true, accrue(book, h.bondRatePct(), today), cost, 0, 0, 0,
                null, null, book.openQuantity());
        }
        boolean exact = huf && "cash".equals(h.assetType());
        return new HoldingValue(ValuationKind.COST, exact, cost, cost, 0, 0, 0, null, null, book.openQuantity());
    }

    private static HoldingValue quoted(BigDecimal qty, long cost, QuotePoint quote, QuotePoint rate) {
        BigDecimal price = quote.price();
        BigDecimal prev = quote.previousClose() == null ? price : quote.previousClose();
        BigDecimal fx = rate.price();
        BigDecimal fxPrev = rate.previousClose() == null ? fx : rate.previousClose();
        long value = minor(qty.multiply(price).multiply(fx));
        long priceMove = minor(qty.multiply(price.subtract(prev)).multiply(fxPrev));
        long fxMove = minor(qty.multiply(price).multiply(fx.subtract(fxPrev)));
        long previousValue = minor(qty.multiply(prev).multiply(fxPrev));
        BigDecimal changePct = quote.previousClose() == null ? null
            : price.subtract(prev).multiply(HUNDRED).divide(prev, 2, RoundingMode.HALF_UP);
        LocalDate asOf = rate.asOf() == null || quote.asOf().isBefore(rate.asOf()) ? quote.asOf() : rate.asOf();
        return new HoldingValue(ValuationKind.QUOTE, true, value, cost, priceMove, fxMove, previousValue, changePct,
            asOf, qty);
    }

    private static long accrue(LotBook book, BigDecimal ratePct, LocalDate today) {
        BigDecimal rate = ratePct.divide(HUNDRED, MathContext.DECIMAL64);
        long total = 0;
        for (OpenLot lot : book.openLots()) {
            int days = Math.max(0, PenzDates.daysBetweenInclusive(lot.date(), today) - 1);
            BigDecimal factor = BigDecimal.ONE.add(rate.multiply(BigDecimal.valueOf(days))
                .divide(DAYS_PER_YEAR, MathContext.DECIMAL64));
            total += BigDecimal.valueOf(lot.costHufMinor()).multiply(factor).setScale(0, RoundingMode.HALF_UP)
                .longValueExact();
        }
        return total;
    }

    /** Major-unit HUF to minor, HALF_UP. */
    private static long minor(BigDecimal hufMajor) {
        return hufMajor.multiply(HUNDRED).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }
}
