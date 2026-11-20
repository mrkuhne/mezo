package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Pénzem's arithmetic (Boop Pénz L6, build notes calls 2 and 5) — pure, no Spring. Groups valued holdings into the
 * three sleeves (always all three, in order), sums values, costs and moves, computes shares (percent, 1 decimal,
 * HALF_UP; 0 when the whole is 0), the long sleeve's coverage {@code floor(value / fixedCostsMonthly)} months
 * (null when fixed costs are missing or ≤ 0), the move percentages over the quoted holdings' previous value, the
 * prices' date, staleness and the unpriced count.
 */
public final class PortfolioEngine {

    /** Prices older than this many days are stale. */
    public static final int STALE_AFTER_DAYS = 3;

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private PortfolioEngine() {
    }

    /**
     * @param positions         valued holdings in display order (the order is kept within a sleeve)
     * @param fixedCostsMonthly the allowance engine's fixedCosts line of the month, HUF minor; null = unknown
     * @param quotesFailing     the quote source's last fetch failed
     */
    public static PortfolioResult build(LocalDate date, List<PositionInput> positions, Long fixedCostsMonthly,
                                        boolean quotesFailing) {
        long total = positions.stream().mapToLong(p -> p.value().valueHufMinor()).sum();
        long cost = positions.stream().mapToLong(p -> p.value().costHufMinor()).sum();
        long priceMove = positions.stream().mapToLong(p -> p.value().priceMoveHufMinor()).sum();
        long fxMove = positions.stream().mapToLong(p -> p.value().fxMoveHufMinor()).sum();
        long quotedPrevious = positions.stream().filter(p -> p.value().kind() == ValuationKind.QUOTE)
            .mapToLong(p -> p.value().previousValueHufMinor()).sum();
        LocalDate pricesAsOf = positions.stream().filter(p -> p.value().kind() == ValuationKind.QUOTE)
            .map(p -> p.value().priceAsOf()).min(LocalDate::compareTo).orElse(null);
        boolean stale = quotesFailing
            || (pricesAsOf != null && pricesAsOf.isBefore(date.minusDays(STALE_AFTER_DAYS)));
        int unpriced = (int) positions.stream()
            .filter(p -> !p.value().priced() && p.value().costHufMinor() > 0).count();

        List<SleeveResult> sleeves = new ArrayList<>();
        for (Sleeve s : Sleeve.values()) {
            List<PositionInput> in = positions.stream().filter(p -> p.sleeve() == s).toList();
            long value = in.stream().mapToLong(p -> p.value().valueHufMinor()).sum();
            List<PositionResult> rows = in.stream()
                .map(p -> new PositionResult(p.holdingId(), p.value(), pct(p.value().valueHufMinor(), value)))
                .toList();
            Integer coverage = s == Sleeve.LONG && fixedCostsMonthly != null && fixedCostsMonthly > 0
                ? Math.toIntExact(Math.floorDiv(value, fixedCostsMonthly)) : null;
            sleeves.add(new SleeveResult(s, value, in.stream().mapToLong(p -> p.value().costHufMinor()).sum(),
                pct(value, total), in.stream().mapToLong(p -> p.value().priceMoveHufMinor()).sum(),
                in.stream().mapToLong(p -> p.value().fxMoveHufMinor()).sum(), coverage, rows));
        }
        return new PortfolioResult(date, total, cost, priceMove, fxMove,
            quotedPrevious == 0 ? null : pct(priceMove, quotedPrevious),
            quotedPrevious == 0 ? null : pct(fxMove, quotedPrevious),
            pricesAsOf, stale, unpriced, fixedCostsMonthly, sleeves);
    }

    /** {@code part / whole} in percent, 1 decimal HALF_UP; 0 when the whole is 0. */
    static BigDecimal pct(long part, long whole) {
        if (whole == 0) {
            return BigDecimal.ZERO.setScale(1);
        }
        return BigDecimal.valueOf(part).multiply(HUNDRED).divide(BigDecimal.valueOf(whole), 1, RoundingMode.HALF_UP);
    }
}
