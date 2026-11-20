package io.mrkuhne.mezo.feature.penz.service.portfolio;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The valuation policy (build notes calls 2 and 3). Every figure is invented. */
class PenzValuationTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 20);

    private static LotBook qtyBook(String qty, long costHuf) {
        return Lots.build(List.of(new LotTxn(UUID.randomUUID(), LocalDate.of(2026, 1, 5), Side.BUY,
            new BigDecimal(qty), costHuf)));
    }

    private static HoldingSpec spec(String assetType, String currency, String symbol, String bondRatePct) {
        return new HoldingSpec(UUID.randomUUID(), assetType, currency, symbol,
            bondRatePct == null ? null : new BigDecimal(bondRatePct));
    }

    private static QuotePoint q(String price, String prev, LocalDate asOf) {
        return new QuotePoint(new BigDecimal(price), prev == null ? null : new BigDecimal(prev), asOf);
    }

    @Test
    void aHufStockIsQuantityTimesPriceWithNoCurrencyMove() {
        HoldingValue v = Valuation.value(spec("stock", "HUF", "AAA.BD", null), qtyBook("10", 200_000_00L),
            q("21000", "20000", TODAY), null, TODAY);
        assertThat(v.kind()).isEqualTo(ValuationKind.QUOTE);
        assertThat(v.priced()).isTrue();
        assertThat(v.valueHufMinor()).isEqualTo(210_000_00L);
        assertThat(v.costHufMinor()).isEqualTo(200_000_00L);
        assertThat(v.priceMoveHufMinor()).isEqualTo(10_000_00L);
        assertThat(v.fxMoveHufMinor()).isZero();
        assertThat(v.previousValueHufMinor()).isEqualTo(200_000_00L);
        assertThat(v.changePct()).isEqualByComparingTo("5.00");
        assertThat(v.priceAsOf()).isEqualTo(TODAY);
        assertThat(v.quantity()).isEqualByComparingTo("10");
    }

    @Test
    void aEuroEtfSplitsTheMoveIntoPriceAndCurrency() {
        // 4 units; price 100 → 110 EUR; EURHUF 400 → 410
        HoldingValue v = Valuation.value(spec("etf", "EUR", "BBB.DE", null), qtyBook("4", 160_000_00L),
            q("110", "100", TODAY), q("410", "400", TODAY.minusDays(1)), TODAY);
        assertThat(v.valueHufMinor()).isEqualTo(180_400_00L);                 // 4 × 110 × 410
        assertThat(v.priceMoveHufMinor()).isEqualTo(16_000_00L);              // 4 × 10 × 400
        assertThat(v.fxMoveHufMinor()).isEqualTo(4_400_00L);                  // 4 × 110 × 10
        assertThat(v.previousValueHufMinor()).isEqualTo(160_000_00L);         // 4 × 100 × 400
        assertThat(v.changePct()).isEqualByComparingTo("10.00");
        assertThat(v.priceAsOf()).isEqualTo(TODAY.minusDays(1));             // the older of quote and rate
    }

    @Test
    void withoutAPreviousCloseThereIsNoMove() {
        HoldingValue v = Valuation.value(spec("stock", "HUF", "AAA.BD", null), qtyBook("2", 10_000_00L),
            q("6000", null, TODAY), null, TODAY);
        assertThat(v.valueHufMinor()).isEqualTo(12_000_00L);
        assertThat(v.priceMoveHufMinor()).isZero();
        assertThat(v.changePct()).isNull();
    }

    @Test
    void aForeignHoldingWithoutARateIsValuedAtCost() {
        HoldingValue v = Valuation.value(spec("etf", "EUR", "BBB.DE", null), qtyBook("4", 160_000_00L),
            q("110", "100", TODAY), null, TODAY);
        assertThat(v.kind()).isEqualTo(ValuationKind.COST);
        assertThat(v.priced()).isFalse();
        assertThat(v.valueHufMinor()).isEqualTo(160_000_00L);
        assertThat(v.priceAsOf()).isNull();
    }

    @Test
    void aQuotedHoldingWithoutQuantitiesIsValuedAtCost() {
        LotBook book = Lots.build(List.of(new LotTxn(UUID.randomUUID(), TODAY.minusDays(10), Side.BUY, null,
            50_000_00L)));
        HoldingValue v = Valuation.value(spec("fund", "HUF", "CCC.BD", null), book, q("10", "9", TODAY), null,
            TODAY);
        assertThat(v.kind()).isEqualTo(ValuationKind.COST);
        assertThat(v.priced()).isFalse();
    }

    @Test
    void aBondAccruesSimpleInterestPerLot() {
        // 1 000 000 Ft bought 2026-01-01 at 6.5 %: days = 324 inclusive − 1 = 323 → × (1 + 0.065 × 323/365)
        LotBook book = Lots.build(List.of(
            new LotTxn(UUID.randomUUID(), LocalDate.of(2026, 1, 1), Side.BUY, null, 1_000_000_00L),
            new LotTxn(UUID.randomUUID(), TODAY, Side.BUY, null, 200_000_00L)));
        HoldingValue v = Valuation.value(spec("bond", "HUF", null, "6.5"), book, null, null, TODAY);
        assertThat(v.kind()).isEqualTo(ValuationKind.ACCRUAL);
        assertThat(v.priced()).isTrue();
        // lot 1: 100 000 000 × (1 + 0.065 × 323 / 365) = 105 752 054.79 → 105 752 055; lot 2 bought today: no interest
        assertThat(v.valueHufMinor()).isEqualTo(105_752_055L + 200_000_00L);
        assertThat(v.costHufMinor()).isEqualTo(1_200_000_00L);
        assertThat(v.priceMoveHufMinor()).isZero();
    }

    @Test
    void accrualNeverGoesBelowCostForAFutureDatedLot() {
        LotBook book = Lots.build(List.of(new LotTxn(UUID.randomUUID(), TODAY.plusDays(5), Side.BUY, null,
            100_00L)));
        assertThat(Valuation.value(spec("bond", "HUF", null, "5"), book, null, null, TODAY).valueHufMinor())
            .isEqualTo(100_00L);
    }

    @Test
    void anUnquotedHoldingIsValuedAtCostAndCountsAsUnpriced() {
        HoldingValue v = Valuation.value(spec("fund", "HUF", null, null), qtyBook("3", 30_000_00L), null, null,
            TODAY);
        assertThat(v.kind()).isEqualTo(ValuationKind.COST);
        assertThat(v.priced()).isFalse();
        assertThat(v.valueHufMinor()).isEqualTo(30_000_00L);
    }

    @Test
    void forintCashIsItsOwnExactValue() {
        LotBook book = Lots.build(List.of(new LotTxn(UUID.randomUUID(), TODAY, Side.BUY, null, 90_000_00L)));
        HoldingValue v = Valuation.value(spec("cash", "HUF", null, null), book, null, null, TODAY);
        assertThat(v.kind()).isEqualTo(ValuationKind.COST);
        assertThat(v.priced()).isTrue();
        assertThat(v.valueHufMinor()).isEqualTo(90_000_00L);
    }
}
