package io.mrkuhne.mezo.feature.penz.service.portfolio;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Sleeves, shares, coverage, moves (build notes calls 2 and 5). Every figure is invented. */
class PenzPortfolioEngineTest {

    private static final LocalDate DATE = LocalDate.of(2026, 11, 20);

    private static PositionInput quoted(Sleeve sleeve, long value, long cost, long priceMove, long fxMove,
                                        long previousValue, LocalDate asOf) {
        return new PositionInput(UUID.randomUUID(), sleeve, new HoldingValue(ValuationKind.QUOTE, true, value, cost,
            priceMove, fxMove, previousValue, new BigDecimal("1.00"), asOf, BigDecimal.ONE));
    }

    private static PositionInput atCost(Sleeve sleeve, long cost) {
        return new PositionInput(UUID.randomUUID(), sleeve, new HoldingValue(ValuationKind.COST, false, cost, cost,
            0, 0, 0, null, null, null));
    }

    private static PositionInput accrued(Sleeve sleeve, long value, long cost) {
        return new PositionInput(UUID.randomUUID(), sleeve, new HoldingValue(ValuationKind.ACCRUAL, true, value, cost,
            0, 0, 0, null, null, null));
    }

    @Test
    void anEmptyPortfolioStillHasThreeSleeves() {
        PortfolioResult r = PortfolioEngine.build(DATE, List.of(), 30_000_000L, false);
        assertThat(r.sleeves()).extracting(SleeveResult::sleeve).containsExactly(Sleeve.SHORT, Sleeve.MID, Sleeve.LONG);
        assertThat(r.totalHufMinor()).isZero();
        assertThat(r.sleeves()).allSatisfy(s -> assertThat(s.sharePct()).isEqualByComparingTo("0"));
        assertThat(r.sleeves().get(2).coverageMonths()).isZero();
        assertThat(r.priceMovePct()).isNull();
        assertThat(r.pricesAsOf()).isNull();
        assertThat(r.stale()).isFalse();
        assertThat(r.unpricedCount()).isZero();
    }

    @Test
    void sleevesSumTheirHoldingsAndShareTheTotal() {
        PositionInput bond = accrued(Sleeve.SHORT, 1_050_000_00L, 1_000_000_00L);
        PositionInput etf = quoted(Sleeve.LONG, 1_800_000_00L, 1_600_000_00L, 30_000_00L, 6_000_00L,
            1_764_000_00L, DATE);
        PositionInput stock = quoted(Sleeve.LONG, 200_000_00L, 150_000_00L, -4_000_00L, 0, 204_000_00L,
            DATE.minusDays(1));
        PositionInput fund = atCost(Sleeve.MID, 250_000_00L);
        PortfolioResult r = PortfolioEngine.build(DATE, List.of(bond, etf, stock, fund), 3_000_000_00L / 10, false);

        assertThat(r.totalHufMinor()).isEqualTo(3_300_000_00L);
        assertThat(r.costHufMinor()).isEqualTo(3_000_000_00L);
        assertThat(r.priceMoveHufMinor()).isEqualTo(26_000_00L);
        assertThat(r.fxMoveHufMinor()).isEqualTo(6_000_00L);
        // over the quoted holdings' previous value 1 968 000: 26 000 → 1.3 %, 6 000 → 0.3 %
        assertThat(r.priceMovePct()).isEqualByComparingTo("1.3");
        assertThat(r.fxMovePct()).isEqualByComparingTo("0.3");
        assertThat(r.pricesAsOf()).isEqualTo(DATE.minusDays(1));
        assertThat(r.stale()).isFalse();
        assertThat(r.unpricedCount()).isEqualTo(1);

        SleeveResult shortS = r.sleeves().get(0);
        SleeveResult mid = r.sleeves().get(1);
        SleeveResult longS = r.sleeves().get(2);
        assertThat(shortS.valueHufMinor()).isEqualTo(1_050_000_00L);
        assertThat(shortS.sharePct()).isEqualByComparingTo("31.8");   // 1 050 / 3 300
        assertThat(mid.sharePct()).isEqualByComparingTo("7.6");       // 250 / 3 300 = 7.58
        assertThat(longS.valueHufMinor()).isEqualTo(2_000_000_00L);
        assertThat(longS.sharePct()).isEqualByComparingTo("60.6");
        assertThat(longS.priceMoveHufMinor()).isEqualTo(26_000_00L);
        assertThat(longS.costHufMinor()).isEqualTo(1_750_000_00L);
        assertThat(longS.positions()).extracting(PositionResult::sharePct)
            .usingElementComparator(BigDecimal::compareTo)
            .containsExactly(new BigDecimal("90.0"), new BigDecimal("10.0"));
        // floor(2 000 000 / 300 000) = 6 months
        assertThat(longS.coverageMonths()).isEqualTo(6);
        assertThat(shortS.coverageMonths()).isNull();
        assertThat(mid.coverageMonths()).isNull();
    }

    @Test
    void coverageIsNullWithoutFixedCosts() {
        PositionInput etf = quoted(Sleeve.LONG, 100_00L, 100_00L, 0, 0, 100_00L, DATE);
        assertThat(PortfolioEngine.build(DATE, List.of(etf), null, false).sleeves().get(2).coverageMonths()).isNull();
        assertThat(PortfolioEngine.build(DATE, List.of(etf), 0L, false).sleeves().get(2).coverageMonths()).isNull();
    }

    @Test
    void pricesOlderThanThreeDaysAreStale() {
        PositionInput threeDays = quoted(Sleeve.MID, 100_00L, 100_00L, 0, 0, 100_00L, DATE.minusDays(3));
        assertThat(PortfolioEngine.build(DATE, List.of(threeDays), null, false).stale()).isFalse();
        PositionInput fourDays = quoted(Sleeve.MID, 100_00L, 100_00L, 0, 0, 100_00L, DATE.minusDays(4));
        assertThat(PortfolioEngine.build(DATE, List.of(threeDays, fourDays), null, false).stale()).isTrue();
    }

    @Test
    void aFailingQuoteSourceIsStale() {
        PositionInput fresh = quoted(Sleeve.MID, 100_00L, 100_00L, 0, 0, 100_00L, DATE);
        assertThat(PortfolioEngine.build(DATE, List.of(fresh), null, true).stale()).isTrue();
    }

    @Test
    void anEmptyHoldingAtCostIsNotCountedAsUnpriced() {
        assertThat(PortfolioEngine.build(DATE, List.of(atCost(Sleeve.SHORT, 0)), null, false).unpricedCount())
            .isZero();
    }
}
