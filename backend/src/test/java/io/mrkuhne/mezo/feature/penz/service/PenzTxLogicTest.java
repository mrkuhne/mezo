package io.mrkuhne.mezo.feature.penz.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * Ported from the old app's {@code src/features/transactions/txLogic.test.ts} (Boop Pénz L4, mezo-r36n9.102): the
 * two {@code needsHufRecompute} cases — the server re-books the HUF twin on update only when they say so. The
 * other 12 cases (keypad {@code applyKey} ×5, {@code normalizeAmountFor}, {@code recentCategoryIds} ×3,
 * {@code signedHuf}, {@code groupByDay}, {@code dayLabel}) are input/display logic of the phone (iOS, L5).
 */
class PenzTxLogicTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 1);

    @Test
    void isTrueWhenAmountCurrencyOrDateChange() {
        assertThat(PenzTransactionService.needsHufRecompute(1000, "EUR", DAY, 2000, "EUR", DAY)).isTrue();
        assertThat(PenzTransactionService.needsHufRecompute(1000, "EUR", DAY, 1000, "USD", DAY)).isTrue();
        assertThat(PenzTransactionService.needsHufRecompute(1000, "EUR", DAY, 1000, "EUR", DAY.plusDays(1))).isTrue();
    }

    @Test
    void isFalseOtherwise() {
        assertThat(PenzTransactionService.needsHufRecompute(1000, "EUR", DAY, 1000, "EUR", DAY)).isFalse();
    }
}
