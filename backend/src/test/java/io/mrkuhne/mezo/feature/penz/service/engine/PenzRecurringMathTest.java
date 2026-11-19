package io.mrkuhne.mezo.feature.penz.service.engine;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Ported from the old app's {@code src/features/recurring/recurringMath.test.ts} (Boop Pénz L4, mezo-r36n9.102):
 * "normalizes to monthly". The four "rule edits never rewrite or backfill history" cases are server behaviour and
 * live in {@code PenzAllowanceApiIT#ruleEditsKeepTheMaterializedDateAndResumingSkipsThePause}; "labels frequency"
 * is display text (iOS, L5) and is not ported.
 */
class PenzRecurringMathTest {

    @Test
    void normalizesToMonthly() {
        assertThat(Recurrence.monthlyHufMinor(Frequency.MONTHLY, 1200)).isEqualTo(1200);
        assertThat(Recurrence.monthlyHufMinor(Frequency.WEEKLY, 1200)).isEqualTo(5200);
        assertThat(Recurrence.monthlyHufMinor(Frequency.YEARLY, 1200)).isEqualTo(100);
    }
}
