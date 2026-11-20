package io.mrkuhne.mezo.feature.penz.service.proposal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.engine.MonthlyAllowance;
import io.mrkuhne.mezo.feature.penz.service.engine.TxnInput;
import io.mrkuhne.mezo.feature.penz.service.engine.TxnKind;
import io.mrkuhne.mezo.feature.penz.service.proposal.MonthlyInvestable.Inputs;
import io.mrkuhne.mezo.feature.penz.service.proposal.MonthlyInvestable.Kind;
import io.mrkuhne.mezo.feature.penz.service.proposal.MonthlyInvestable.MonthTotals;
import io.mrkuhne.mezo.feature.penz.service.proposal.MonthlyInvestable.Source;
import io.mrkuhne.mezo.feature.penz.service.proposal.MonthlyInvestable.Suggestion;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * The monthly-investable port (mezo-r36n9.105, build notes call 14). Oracle: the old Finance Tracker app's vitest
 * cases, same vectors — {@code domain/invest.test.ts} {@code suggestInvestment} (9), {@code base44/shared/brief.test.ts}
 * {@code pullForwardRoomMinor} + {@code daysLeftInMonth} (7), {@code domain/planning.test.ts} averages / complete
 * months / daily spend (15) and {@code features/invest/investModel.test.ts} (free before invest + the buildInvestCore
 * suggestion vector). The old "no complete month" fallbacks read the allowance engine; here they take its
 * {@link MonthlyAllowance} directly. The old {@code source = 'recurring'} back-fill test reads
 * {@code recurringRuleId != null} (Mezo's materialized rows carry their rule).
 */
class PenzMonthlyInvestableTest {

    private static final UUID ACCOUNT = UUID.randomUUID();
    private static final UUID R1 = UUID.randomUUID();

    private static TxnInput txn(String date, TxnKind kind, long amount) {
        return txn(date, kind, amount, null);
    }

    private static TxnInput txn(String date, TxnKind kind, long amount, UUID rule) {
        return new TxnInput(ACCOUNT, kind, amount, "HUF", amount, LocalDate.parse(date), rule);
    }

    private static MonthlyAllowance allowance(long recurringIncome, long oneOffIncome, long fixedCosts) {
        return new MonthlyAllowance(YearMonth.of(2026, 11), recurringIncome, oneOffIncome, fixedCosts, 0, 0, 0, 0, 0, 0,
            0);
    }

    private static final Inputs BASE = new Inputs(3, 60_000_000, 40_000_000, 5_000_000, 30_000_000, false, null, 0);

    @Nested
    class SuggestInvestment {

        @Test
        void testSuggest_shouldBeNoData_whenNoTrackedMonthAndNoSetting() {
            assertThat(MonthlyInvestable.suggest(BASE.withTrackedMonths(0)).kind()).isEqualTo(Kind.NO_DATA);
        }

        @Test
        void testSuggest_shouldUseTheSetting_whenNoDataButASetting() {
            assertThat(MonthlyInvestable.suggest(BASE.withTrackedMonths(0).withSetting(4_000_000L)))
                .isEqualTo(new Suggestion(Kind.AMOUNT, 4_000_000, Source.SETTING, false));
        }

        @Test
        void testSuggest_shouldTake25PercentRoundedDown_whenBeforeTheEmergencyFund() {
            assertThat(MonthlyInvestable.suggest(BASE))
                .isEqualTo(new Suggestion(Kind.AMOUNT, 3_700_000, Source.COMPUTED, false));
        }

        @Test
        void testSuggest_shouldTake60Percent_whenAfterTheEmergencyFund() {
            assertThat(MonthlyInvestable.suggest(BASE.withEmergencyDone(true)))
                .isEqualTo(new Suggestion(Kind.AMOUNT, 9_000_000, Source.COMPUTED, true));
        }

        @Test
        void testSuggest_shouldBeCappedByTheFreeMoney_whenFreeIsBelowTheSurplus() {
            assertThat(MonthlyInvestable.suggest(BASE.withEmergencyDone(true).withFree(8_000_000)).amountMinor())
                .isEqualTo(4_800_000);
        }

        @Test
        void testSuggest_shouldPreferTheSetting_whenDataExists() {
            assertThat(MonthlyInvestable.suggest(BASE.withSetting(2_000_000L)))
                .isEqualTo(new Suggestion(Kind.AMOUNT, 2_000_000, Source.SETTING, false));
        }

        @Test
        void testSuggest_shouldBeNothingSpare_whenTheSurplusIsNotPositive() {
            assertThat(MonthlyInvestable.suggest(BASE.withAvgExpenses(56_000_000)).kind()).isEqualTo(Kind.NOTHING_SPARE);
        }

        @Test
        void testSuggest_shouldBeNothingSpare_whenThereIsNoFreeMoney() {
            assertThat(MonthlyInvestable.suggest(BASE.withFree(-5)).kind()).isEqualTo(Kind.NOTHING_SPARE);
        }

        @Test
        void testSuggest_shouldBeNothingSpare_whenTheAmountRoundsToZero() {
            assertThat(MonthlyInvestable.suggest(BASE.withAvgIncome(45_200_000)).kind()).isEqualTo(Kind.NOTHING_SPARE);
        }

        @Test
        void testSuggest_shouldTrimByLastMonthsExcess_upToHalfTheRawAmount() {
            // raw 3 750 000 → trim min(1 000 000, 1 875 000) → 2 750 000 → 2 700 000
            assertThat(MonthlyInvestable.suggest(BASE.withPrevExcess(1_000_000)).amountMinor()).isEqualTo(2_700_000);
            // trim capped at half: 3 750 000 − 1 875 000 = 1 875 000 → 1 800 000
            assertThat(MonthlyInvestable.suggest(BASE.withPrevExcess(9_000_000)).amountMinor()).isEqualTo(1_800_000);
        }

        @Test
        void testSuggest_shouldMatchTheBuildInvestCoreVector_whenNoHoldings() {
            // investModel.test: min(50M − 30M − 5M = 15M, 25M) × 0.25 = 3.75M → 3 700 000
            Inputs in = new Inputs(2, 50_000_000, 30_000_000, 5_000_000,
                MonthlyInvestable.freeBeforeInvest(23_000_000, 2_000_000), false, null, 0);
            assertThat(MonthlyInvestable.suggest(in))
                .isEqualTo(new Suggestion(Kind.AMOUNT, 3_700_000, Source.COMPUTED, false));
        }

        @Test
        void testFreeBeforeInvest_shouldAddBackWhatWasInvestedThisMonth() {
            assertThat(MonthlyInvestable.freeBeforeInvest(23_000_000, 2_000_000)).isEqualTo(25_000_000);
        }
    }

    @Nested
    class PullForward {

        private long room(boolean done, long suggested, long invested, long remaining, long daily, int daysLeft) {
            return MonthlyInvestable.pullForwardRoom(done, suggested, invested, remaining, daily, daysLeft);
        }

        @Test
        void testPullForwardRoom_shouldBeZero_whenBeforeTheEmergencyFund() {
            assertThat(room(false, 4_000_000, 4_000_000, 10_000_000, 200_000, 20)).isZero();
        }

        @Test
        void testPullForwardRoom_shouldTakeHalfTheFreeMoney_whenAfterExpectedSpend() {
            assertThat(room(true, 4_000_000, 4_000_000, 10_000_000, 200_000, 20)).isEqualTo(2_000_000);
        }

        @Test
        void testPullForwardRoom_shouldBeCappedByTheRemaining_whenItIsLow() {
            assertThat(room(true, 4_000_000, 4_000_000, 5_000_000, 200_000, 20)).isEqualTo(1_000_000);
        }

        @Test
        void testPullForwardRoom_shouldShrink_whenInvestedAboveTheSuggestionAndRemainingIsLow() {
            assertThat(room(true, 4_000_000, 5_000_000, 5_000_000, 200_000, 20)).isEqualTo(1_000_000);
        }

        @Test
        void testPullForwardRoom_shouldShrinkByTheExcess_whenInvestedAboveTheSuggestion() {
            assertThat(room(true, 4_000_000, 5_000_000, 10_000_000, 200_000, 20)).isEqualTo(1_000_000);
        }

        @Test
        void testPullForwardRoom_shouldNeverBeNegative() {
            assertThat(room(true, 4_000_000, 4_000_000, -1, 200_000, 20)).isZero();
            assertThat(room(true, 4_000_000, 4_000_000, 10_000_000, 9_000_000, 20)).isZero();
        }

        @Test
        void testDaysLeftInMonth_shouldCountToday() {
            assertThat(MonthlyInvestable.daysLeftInMonth(LocalDate.parse("2026-11-30"))).isEqualTo(1);
            assertThat(MonthlyInvestable.daysLeftInMonth(LocalDate.parse("2026-11-01"))).isEqualTo(30);
            assertThat(MonthlyInvestable.daysLeftInMonth(LocalDate.parse("2026-02-01"))).isEqualTo(28);
        }
    }

    @Nested
    class Averages {

        private final List<TxnInput> hist = List.of(
            txn("2026-09-01", TxnKind.EXPENSE, 30_000_000), txn("2026-09-05", TxnKind.EXPENSE, 20_000_000, R1),
            txn("2026-10-03", TxnKind.EXPENSE, 36_000_000), txn("2026-10-05", TxnKind.EXPENSE, 20_000_000, R1),
            txn("2026-10-01", TxnKind.INCOME, 65_000_000, UUID.randomUUID()),
            txn("2026-10-09", TxnKind.TRANSFER_OUT, 9_000_000));
        private final LocalDate nov15 = LocalDate.parse("2026-11-15");
        private final MonthlyAllowance none = allowance(0, 0, 0);

        @Test
        void testTypicalSpend_shouldAverageCompleteMonths_excludingRecurringAndTransfers() {
            assertThat(MonthlyInvestable.typicalMonthlySpend(hist, nov15)).isEqualTo(33_000_000);
        }

        @Test
        void testAverageExpenses_shouldIncludeRecurringLinkedExpenses() {
            assertThat(MonthlyInvestable.averageMonthlyExpenses(hist, nov15, none)).isEqualTo(53_000_000);
        }

        @Test
        void testAverageIncome_shouldAverageCompleteMonths() {
            assertThat(MonthlyInvestable.averageMonthlyIncome(hist, nov15, none)).isEqualTo(32_500_000);
        }

        @Test
        void testCompleteMonthTotals_shouldCountCompleteMonths() {
            assertThat(MonthlyInvestable.completeMonthTotals(hist, nov15)).extracting(MonthTotals::month)
                .containsExactly(YearMonth.of(2026, 9), YearMonth.of(2026, 10));
        }

        @Test
        void testTypicalSpend_shouldCountOnlyTheLastThreeCompleteMonths() {
            List<TxnInput> t = new ArrayList<>(List.of(txn("2026-06-01", TxnKind.EXPENSE, 90_000_000)));
            for (String m : List.of("2026-07", "2026-08", "2026-09", "2026-10")) {
                t.add(txn(m + "-10", TxnKind.EXPENSE, 30_000_000));
            }
            assertThat(MonthlyInvestable.typicalMonthlySpend(t, nov15)).isEqualTo(30_000_000);
        }

        @Test
        void testTypicalSpend_shouldExtrapolateThisMonth_whenNoCompleteMonth() {
            assertThat(MonthlyInvestable.typicalMonthlySpend(List.of(txn("2026-11-02", TxnKind.EXPENSE, 10_000_000)),
                LocalDate.parse("2026-11-10"))).isEqualTo(30_000_000);
        }

        @Test
        void testAverageExpenses_shouldBeFixedCostsPlusTypicalSpend_whenNoCompleteMonth() {
            assertThat(MonthlyInvestable.averageMonthlyExpenses(
                List.of(txn("2026-11-02", TxnKind.EXPENSE, 10_000_000)), LocalDate.parse("2026-11-10"),
                allowance(0, 0, 20_000_000))).isEqualTo(50_000_000);
        }

        @Test
        void testAverageIncome_shouldBeRecurringPlusOneOff_whenNoCompleteMonth() {
            assertThat(MonthlyInvestable.averageMonthlyIncome(List.of(txn("2026-11-02", TxnKind.INCOME, 5_000_000)),
                LocalDate.parse("2026-11-10"), allowance(60_000_000, 5_000_000, 0))).isEqualTo(65_000_000);
        }

        @Test
        void testAverages_shouldBeZeroNotNaN_whenNoDataAtAll() {
            LocalDate d = LocalDate.parse("2026-11-10");
            assertThat(MonthlyInvestable.typicalMonthlySpend(List.of(), d)).isZero();
            assertThat(MonthlyInvestable.averageMonthlyExpenses(List.of(), d, none)).isZero();
        }

        @Test
        void testCompleteMonthTotals_shouldIgnoreInvestmentTxns() {
            List<MonthTotals> m = MonthlyInvestable.completeMonthTotals(List.of(
                txn("2026-10-01", TxnKind.EXPENSE, 100), txn("2026-10-05", TxnKind.INVEST_BUY, 500),
                txn("2026-10-06", TxnKind.INVEST_SELL, 700)), nov15);
            assertThat(m).hasSize(1);
            assertThat(m.getFirst().expensesMinor()).isEqualTo(100);
            assertThat(m.getFirst().incomeMinor()).isZero();
        }

        @Test
        void testCompleteMonthTotals_shouldBeEmpty_whenOnlyRecurringBackFill() {
            assertThat(MonthlyInvestable.completeMonthTotals(List.of(txn("2026-08-05", TxnKind.EXPENSE, 1, R1),
                txn("2026-09-05", TxnKind.EXPENSE, 1, R1), txn("2026-10-05", TxnKind.INCOME, 1, R1)), nov15)).isEmpty();
        }

        @Test
        void testCompleteMonthTotals_shouldExcludeTheFirstMonth_whenTheFirstManualTxnIsMidMonth() {
            assertThat(MonthlyInvestable.completeMonthTotals(List.of(txn("2026-09-05", TxnKind.EXPENSE, 1, R1),
                txn("2026-10-28", TxnKind.EXPENSE, 5), txn("2026-11-03", TxnKind.EXPENSE, 7)),
                LocalDate.parse("2026-12-10"))).extracting(MonthTotals::month).containsExactly(YearMonth.of(2026, 11));
        }

        @Test
        void testCompleteMonthTotals_shouldIncludeTheFirstMonth_whenTheFirstManualTxnIsOnThe1st() {
            assertThat(MonthlyInvestable.completeMonthTotals(List.of(txn("2026-09-05", TxnKind.EXPENSE, 1, R1),
                txn("2026-10-01", TxnKind.EXPENSE, 5)), LocalDate.parse("2026-12-10")))
                .extracting(MonthTotals::month).containsExactly(YearMonth.of(2026, 10), YearMonth.of(2026, 11));
        }

        @Test
        void testTypicalSpend_shouldNotReadZero_whenOnlyBackFillBeforeThisMonth() {
            assertThat(MonthlyInvestable.typicalMonthlySpend(List.of(txn("2026-09-05", TxnKind.EXPENSE, 1, R1),
                txn("2026-11-02", TxnKind.EXPENSE, 10_000_000)), LocalDate.parse("2026-11-10"))).isEqualTo(30_000_000);
        }
    }

    @Nested
    class DailySpend {

        @Test
        void testDailySpend_shouldBeZero_whenNoData() {
            assertThat(MonthlyInvestable.dailySpend(List.of(), LocalDate.parse("2026-11-03"))).isZero();
        }

        @Test
        void testDailySpend_shouldTakeTheLargerOfThisMonthsPaceAndTheHistory() {
            List<TxnInput> t = List.of(txn("2026-10-02", TxnKind.EXPENSE, 6_000_000),
                txn("2026-11-01", TxnKind.EXPENSE, 100_000), txn("2026-11-02", TxnKind.EXPENSE, 500_000));
            List<TxnInput> heavy = new ArrayList<>(t);
            heavy.add(txn("2026-11-03", TxnKind.EXPENSE, 600_000));
            assertThat(MonthlyInvestable.dailySpend(t, LocalDate.parse("2026-11-03"))).isEqualTo(200_000);
            assertThat(MonthlyInvestable.dailySpend(heavy, LocalDate.parse("2026-11-03"))).isEqualTo(400_000);
        }

        @Test
        void testDailySpend_shouldIgnoreRecurringLinkedExpenses() {
            assertThat(MonthlyInvestable.dailySpend(List.of(txn("2026-11-01", TxnKind.EXPENSE, 9_000_000, R1)),
                LocalDate.parse("2026-11-03"))).isZero();
        }
    }
}
