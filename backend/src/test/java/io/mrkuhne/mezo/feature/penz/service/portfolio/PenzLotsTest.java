package io.mrkuhne.mezo.feature.penz.service.portfolio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** FIFO lots (build notes call 4). Amounts are invented HUF minor units. */
class PenzLotsTest {

    private static final LocalDate D1 = LocalDate.of(2026, 3, 2);
    private static final LocalDate D2 = LocalDate.of(2026, 4, 1);
    private static final LocalDate D3 = LocalDate.of(2026, 5, 4);

    private static LotTxn buy(LocalDate d, String qty, long huf) {
        return new LotTxn(UUID.randomUUID(), d, Side.BUY, qty == null ? null : new BigDecimal(qty), huf);
    }

    private static LotTxn sell(LocalDate d, String qty, long huf) {
        return new LotTxn(UUID.randomUUID(), d, Side.SELL, qty == null ? null : new BigDecimal(qty), huf);
    }

    @Test
    void noTransactionsIsAnEmptyCostModeBook() {
        LotBook book = Lots.build(List.of());
        assertThat(book.quantityMode()).isFalse();
        assertThat(book.openQuantity()).isNull();
        assertThat(book.openCostHufMinor()).isZero();
        assertThat(book.realizedHufMinor()).isEmpty();
    }

    @Test
    void buysAreLotsAndASellConsumesTheOldestFirst() {
        LotTxn b1 = buy(D1, "10", 100_000_00L);   // 10 000 Ft / unit
        LotTxn b2 = buy(D2, "10", 120_000_00L);   // 12 000 Ft / unit
        LotTxn s = sell(D3, "15", 195_000_00L);    // 13 000 Ft / unit
        LotBook book = Lots.build(List.of(b1, b2, s));

        assertThat(book.quantityMode()).isTrue();
        assertThat(book.openQuantity()).isEqualByComparingTo("5");
        assertThat(book.openLots()).singleElement().satisfies(lot -> {
            assertThat(lot.date()).isEqualTo(D2);
            assertThat(lot.quantity()).isEqualByComparingTo("5");
            assertThat(lot.costHufMinor()).isEqualTo(60_000_00L);
        });
        assertThat(book.openCostHufMinor()).isEqualTo(60_000_00L);
        // cost consumed = all of lot 1 (100 000) + half of lot 2 (60 000) = 160 000; proceeds 195 000
        assertThat(book.realizedHufMinor()).containsEntry(s.id(), 35_000_00L);
    }

    @Test
    void inputOrderDoesNotMatterAndBuysComeBeforeSellsOnTheSameDay() {
        LotTxn s = sell(D1, "4", 50_000_00L);
        LotTxn b = buy(D1, "4", 40_000_00L);
        LotBook book = Lots.build(List.of(s, b));
        assertThat(book.openQuantity()).isEqualByComparingTo("0");
        assertThat(book.openLots()).isEmpty();
        assertThat(book.realizedHufMinor()).containsEntry(s.id(), 10_000_00L);
    }

    @Test
    void aLossIsNegative() {
        LotTxn b = buy(D1, "2", 30_000_00L);
        LotTxn s = sell(D2, "1", 10_000_00L);
        LotBook book = Lots.build(List.of(b, s));
        assertThat(book.realizedHufMinor()).containsEntry(s.id(), -5_000_00L);
        assertThat(book.openCostHufMinor()).isEqualTo(15_000_00L);
    }

    @Test
    void partialConsumptionRoundsHalfUpAndKeepsTheRemainderExact() {
        LotTxn b = buy(D1, "3", 100L);             // 1.00 Ft over 3 units
        LotTxn s = sell(D2, "1", 50L);
        LotBook book = Lots.build(List.of(b, s));
        // 100 × 1/3 = 33.33 → 33 consumed, 67 left; realized 50 − 33 = 17
        assertThat(book.realizedHufMinor()).containsEntry(s.id(), 17L);
        assertThat(book.openCostHufMinor()).isEqualTo(67L);
    }

    @Test
    void aSellAboveTheOpenQuantityIsRefused() {
        LotTxn b = buy(D1, "2", 20_000_00L);
        LotTxn s = sell(D2, "2.5", 30_000_00L);
        assertThatThrownBy(() -> Lots.build(List.of(b, s)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("PENZ_SELL_EXCEEDS_POSITION");
    }

    @Test
    void aSellBeforeAnyBuyIsRefused() {
        LotTxn s = sell(D1, "1", 1_000_00L);
        LotTxn b = buy(D2, "1", 1_000_00L);
        assertThatThrownBy(() -> Lots.build(List.of(b, s))).hasMessage("PENZ_SELL_EXCEEDS_POSITION");
    }

    @Test
    void withoutQuantitiesSellsConsumeHufCostOldestFirst() {
        LotTxn b1 = buy(D1, null, 500_000_00L);
        LotTxn b2 = buy(D2, null, 300_000_00L);
        LotTxn s = sell(D3, null, 600_000_00L);
        LotBook book = Lots.build(List.of(b1, b2, s));
        assertThat(book.quantityMode()).isFalse();
        assertThat(book.openQuantity()).isNull();
        assertThat(book.openLots()).singleElement().satisfies(lot -> {
            assertThat(lot.date()).isEqualTo(D2);
            assertThat(lot.quantity()).isNull();
            assertThat(lot.costHufMinor()).isEqualTo(200_000_00L);
        });
        assertThat(book.realizedHufMinor()).containsEntry(s.id(), 0L);
    }

    @Test
    void withoutQuantitiesASellAboveTheOpenCostIsRefused() {
        LotTxn b = buy(D1, null, 100_000_00L);
        LotTxn s = sell(D2, null, 100_000_01L);
        assertThatThrownBy(() -> Lots.build(List.of(b, s))).hasMessage("PENZ_SELL_EXCEEDS_POSITION");
    }

    @Test
    void aMixOfQuantityAndValueRowsFallsBackToCostMode() {
        LotTxn b1 = buy(D1, "5", 50_000_00L);
        LotTxn b2 = buy(D2, null, 20_000_00L);
        LotBook book = Lots.build(List.of(b1, b2));
        assertThat(book.quantityMode()).isFalse();
        assertThat(book.openCostHufMinor()).isEqualTo(70_000_00L);
    }
}
