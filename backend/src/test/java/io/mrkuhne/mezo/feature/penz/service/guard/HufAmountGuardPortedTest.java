package io.mrkuhne.mezo.feature.penz.service.guard;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 1:1 port of the amount-guard cases of the old Finance Tracker app (mezo-r36n9.102). Sources:
 * {@code base44/functions/morningBrief/brief.test.ts} ({@code hufAmountsMinor}, the amount part of
 * {@code normalizeBrief} = {@code withinLimits}) and {@code base44/functions/morningBrief/analysis.test.ts}
 * (the amount part of {@code normalizeAnalysis}). Each test names the old test it ports. Cases that test
 * only non-money behaviour (sentence cutting, news ids, product lists, verdict enums, JS non-integers like
 * {@code 10.5} / {@code null} which the Java {@code long} signature cannot express) are not ported.
 */
class HufAmountGuardPortedTest {

    private static final Long LIM = 1_500_000L;

    // ---- brief.test.ts › normalizeBrief ----

    @Test
    void brief_dropsTextNamingAnAmountAboveTheLimit() {
        // 'drops this_month / notification naming an amount above the limit; what_happened is untouched'
        assertThat(HufAmountGuard.withinLimits("Markets calm. Put 50 000 Ft into ETFs.", LIM, false)).isNull();
        assertThat(HufAmountGuard.withinLimits("Put the 15 000 Ft left into ETFs.", LIM, false))
            .isEqualTo("Put the 15 000 Ft left into ETFs.");
        assertThat(HufAmountGuard.withinLimits("Invest 15 001 HUF.", LIM, false)).isNull();
    }

    @Test
    void brief_staleOrNoLimit_anyAmountNullsTheField_textWithoutAmountsStays() {
        // 'stale or no limit: any amount nulls the field; text without amounts stays'
        String notification = "EUR/HUF 364.4. Portfolio +0.8% this week.";
        String thisMonth = "You could invest 1 000 Ft.";
        assertThat(HufAmountGuard.withinLimits(thisMonth, LIM, true)).isNull();
        assertThat(HufAmountGuard.withinLimits(notification, LIM, true)).isEqualTo(notification); // a rate is not an amount
        assertThat(HufAmountGuard.withinLimits(thisMonth, null, false)).isNull();
        assertThat(HufAmountGuard.withinLimits("Open the app to update.", null, true)).isEqualTo("Open the app to update.");
    }

    @Test
    void brief_nullTextStaysNull() {
        // withinLimits(null, …) === null (the 'missing or blank fields -> null' path)
        assertThat(HufAmountGuard.withinLimits(null, LIM, false)).isNull();
    }

    @Test
    void brief_hufAmountsMinorReadsTheCommonForintSpellings() {
        // 'hufAmountsMinor reads the common forint spellings'
        assertThat(HufAmountGuard.hufAmountsMinor("15 000 Ft, 15 000 HUF, 15 000 Ft, 15.000 Ft, 15,000 forints"))
            .isEqualTo(Collections.nCopies(5, 1_500_000L));
        assertThat(HufAmountGuard.hufAmountsMinor("HUF 20 000 and 1.5 million Ft and 99,50 Ft"))
            .containsExactly(2_000_000L, 150_000_000L, 9_950L);
        assertThat(HufAmountGuard.hufAmountsMinor("EUR/HUF 364.4, +0.8%, 2026")).isEmpty();
    }

    // ---- brief.test.ts › Hungarian amounts and copy ----

    @Test
    void brief_hungarianAmountFormsAreDetected() {
        // 'Hungarian amount forms are detected'
        assertThat(HufAmountGuard.hufAmountsMinor("1,5 millió Ft")).containsExactly(150_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("10 ezer Ft")).containsExactly(1_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("10e Ft")).containsExactly(1_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("2 M Ft")).containsExactly(200_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("10 000 forint")).containsExactly(1_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("10 000 forintot")).containsExactly(1_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("15 000 Ft-ot")).containsExactly(1_500_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("2 milliárd Ft")).containsExactly(200_000_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("2 Mrd Ft")).containsExactly(200_000_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("3 mill. Ft")).containsExactly(300_000_000L);
        assertThat(HufAmountGuard.hufAmountsMinor("4,25%-on hagyta")).isEmpty();
        assertThat(HufAmountGuard.hufAmountsMinor("2026-ban 10 ezerből")).isEmpty();
    }

    @Test
    void brief_guardRejectsAHungarianAmountAboveTheLimit() {
        // 'guard rejects a Hungarian amount above the limit'
        assertThat(HufAmountGuard.withinLimits("Tegyél be 1,5 millió Ft-ot.", LIM, false)).isNull();
    }

    // ---- analysis.test.ts › normalizeAnalysis (amount part) ----

    @Test
    void analysis_validBuyIsKept() {
        // 'valid buy is kept' — amount_huf 10000 under a 1_500_000 limit
        assertThat(HufAmountGuard.amountAllowed(1_000_000L, LIM, false)).isTrue();
    }

    @Test
    void analysis_amountAboveTheLimitBecomesWait() {
        // 'amount above the limit becomes wait' — amount_huf 20000
        assertThat(HufAmountGuard.amountAllowed(2_000_000L, LIM, false)).isFalse();
    }

    @Test
    void analysis_nonPositiveAmountBecomesWait() {
        // 'non-integer or non-positive amount becomes wait' — the amount_huf: 0 case
        assertThat(HufAmountGuard.amountAllowed(0L, LIM, false)).isFalse();
        assertThat(HufAmountGuard.amountAllowed(-100L, LIM, false)).isFalse();
    }

    @Test
    void analysis_staleLimitsNeverAllowAnAmount() {
        // 'stale limits never allow an amount'
        assertThat(HufAmountGuard.amountAllowed(1_000_000L, LIM, true)).isFalse();
    }

    @Test
    void analysis_reasonNamingATooLargeAmountIsDowngraded() {
        // 'reason naming a too-large amount is downgraded'
        assertThat(HufAmountGuard.namesAmountAbove("Tegyél be 1,5 millió Ft-ot.", LIM, false)).isTrue();
        assertThat(HufAmountGuard.namesAmountAbove("Nyugodt a piac.", LIM, false)).isFalse();
    }

    @Test
    void analysis_buyAboveLeftIsDowngradedEvenWhenPullForwardRoomIsLarger() {
        // 'buy above left is downgraded even when pull-forward room is larger' — cap = left = 1_000_000
        assertThat(HufAmountGuard.amountAllowed(1_500_000L, 1_000_000L, false)).isFalse();
        assertThat(HufAmountGuard.amountAllowed(1_000_000L, 1_000_000L, false)).isTrue();
    }

    @Test
    void analysis_unknownLimitKeepsAReasonNamingForints() {
        // 'unknown limit keeps wait/none verdict and reason naming forints'
        assertThat(HufAmountGuard.namesAmountAbove("Az EUR/HUF 410 forint körül jár.", null, false)).isFalse();
        assertThat(HufAmountGuard.namesAmountAbove("410 forint.", LIM, true)).isFalse();
    }

    @Test
    void analysis_buyWithUnknownLimitBecomesWait() {
        // 'buy with unknown limit becomes wait with the no-budget reason'
        assertThat(HufAmountGuard.amountAllowed(1_000_000L, null, false)).isFalse();
    }

    @Test
    void analysis_staleDisplayReplacesAReasonNamingForintAmounts() {
        // 'stale display replaces a reason naming forint amounts' — forDisplay keys on hufAmountsMinor(reason).length > 0
        assertThat(HufAmountGuard.hufAmountsMinor("Tegyél be 10 000 Ft-ot.")).isEqualTo(List.of(1_000_000L));
        assertThat(HufAmountGuard.hufAmountsMinor("Nyugodt a piac.")).isEmpty();
    }
}
