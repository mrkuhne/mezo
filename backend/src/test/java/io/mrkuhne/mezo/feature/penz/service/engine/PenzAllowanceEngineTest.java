package io.mrkuhne.mezo.feature.penz.service.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Mirrors the old app's {@code src/domain/allowance.test.ts} 1:1 (17 cases, same inputs, same
 * expected numbers — the vitest suite is the oracle). Every ported case runs with
 * {@code practice = 0}, which must reproduce the old engine exactly. The {@link PracticeAndLines}
 * group adds the L4 extension: the Gyakorlás monthly cap deducted like a fixed cost, and the
 * derivation lines with their wire keys.
 */
class PenzAllowanceEngineTest {

    private static final UUID A1 = id("a1");

    static UUID id(String s) {
        return UUID.nameUUIDFromBytes(s.getBytes());
    }

    static LocalDate d(String s) {
        return LocalDate.parse(s);
    }

    static YearMonth m(String s) {
        return YearMonth.parse(s);
    }

    static TxnInput mk(TxnKind kind, String date, long amount) {
        return new TxnInput(A1, kind, amount, "HUF", amount, d(date), null);
    }

    static TxnInput linkedTo(TxnKind kind, String date, long amount, String ruleId) {
        return new TxnInput(A1, kind, amount, "HUF", amount, d(date), id(ruleId));
    }

    static TxnInput expense(String date, long amount) {
        return mk(TxnKind.EXPENSE, date, amount);
    }

    static TxnInput income(String date, long amount) {
        return mk(TxnKind.INCOME, date, amount);
    }

    static RecurringRuleInput rule(String id, RuleKind kind, long amt, String start) {
        return new RecurringRuleInput(id(id), kind, amt, Frequency.MONTHLY, d(start), null, null, true);
    }

    static AllowanceSettings oldSettings(long savingsTargetMinor) {
        return new AllowanceSettings(savingsTargetMinor, 0, Map.of());
    }

    static final List<RecurringRuleInput> RULES = List.of(
        rule("salary", RuleKind.INCOME, 600_000_00, "2026-01-10"),
        rule("rent", RuleKind.EXPENSE, 200_000_00, "2026-01-01"),
        rule("netflix", RuleKind.EXPENSE, 5_000_00, "2026-01-15"));

    static final AllowanceSettings SETTINGS = oldSettings(100_000_00);

    static final List<TxnInput> TXNS = List.of(
        mk(TxnKind.INVEST_BUY, "2026-11-04", 30_000_00),
        mk(TxnKind.INVEST_BUY, "2026-12-04", 30_000_00),
        expense("2026-11-02", 15_000_00),
        expense("2026-11-03", 10_000_00),
        income("2026-11-20", 20_000_00),
        linkedTo(TxnKind.EXPENSE, "2026-11-01", 200_000_00, "rent"),
        mk(TxnKind.TRANSFER_OUT, "2026-11-05", 50_000_00),
        mk(TxnKind.TRANSFER_IN, "2026-11-05", 50_000_00),
        new TxnInput(A1, TxnKind.EXPENSE, 2_53, "EUR", 1_000_00, d("2026-11-06"), null));

    @Nested
    class InvestmentTxns {
        private final AllowanceSettings s = oldSettings(0);
        private final List<RecurringRuleInput> r = List.of(rule("salary", RuleKind.INCOME, 60_000_000, "2026-01-10"));

        private MonthlyAllowance run(List<TxnInput> t) {
            return AllowanceEngine.monthly(m("2026-11"), r, t, s, 0);
        }

        // allowance.test.ts > investment txns > investment comes from recorded buys, not the setting
        @Test
        void investmentComesFromRecordedBuysNotTheSetting() {
            MonthlyAllowance a = run(List.of(mk(TxnKind.INVEST_BUY, "2026-11-05", 2_000_000)));
            assertThat(a.investedMinor()).isEqualTo(2_000_000);
            assertThat(a.freeMinor()).isEqualTo(58_000_000);
        }

        // allowance.test.ts > investment txns > an invest_sell is not income
        @Test
        void anInvestSellIsNotIncome() {
            MonthlyAllowance a = run(List.of(mk(TxnKind.INVEST_SELL, "2026-11-05", 1_000_000)));
            assertThat(a.oneOffIncomeMinor()).isZero();
            assertThat(a.freeMinor()).isEqualTo(run(List.of()).freeMinor());
        }

        // allowance.test.ts > investment txns > an invest_buy is not day-to-day spend
        @Test
        void anInvestBuyIsNotDayToDaySpend() {
            assertThat(run(List.of(mk(TxnKind.INVEST_BUY, "2026-11-05", 2_000_000))).spentMinor()).isZero();
        }
    }

    // allowance.test.ts > allowance > monthly
    @Test
    void monthly() {
        MonthlyAllowance nov = AllowanceEngine.monthly(m("2026-11"), RULES, TXNS, SETTINGS, 0);
        assertThat(nov.freeMinor()).isEqualTo(285_000_00);
        assertThat(nov.spentMinor()).isEqualTo(26_000_00);
        assertThat(nov.remainingMinor()).isEqualTo(259_000_00);
        assertThat(AllowanceEngine.monthly(m("2026-11"), RULES, TXNS, SETTINGS, 40_000_00).freeMinor())
            .isEqualTo(245_000_00);
    }

    // allowance.test.ts > allowance > weekly
    @Test
    void weekly() {
        WeeklyAllowance wk = AllowanceEngine.weekly(d("2026-11-04"), RULES, TXNS, SETTINGS, 0);
        assertThat(wk.weekStart()).isEqualTo(d("2026-11-02"));
        assertThat(wk.weekEnd()).isEqualTo(d("2026-11-08"));
        assertThat(wk.countedFrom()).isEqualTo(d("2026-11-02"));
        assertThat(wk.budgetMinor()).isEqualTo(6_879_310);
        assertThat(wk.spentMinor()).isEqualTo(26_000_00);
        assertThat(wk.remainingMinor()).isEqualTo(6_879_310 - 26_000_00);
        assertThat(wk.portions()).hasSize(1);
    }

    // allowance.test.ts > allowance > cross-month week
    @Test
    void crossMonthWeek() {
        WeeklyAllowance cross = AllowanceEngine.weekly(d("2026-11-30"), RULES, TXNS, SETTINGS, 0);
        assertThat(cross.budgetMinor()).isEqualTo(25_900_000 + 5_129_032);
    }

    // allowance.test.ts > allowance > deficit belongs to the month containing today
    @Test
    void deficitBelongsToTheMonthContainingToday() {
        WeeklyAllowance dec = AllowanceEngine.weekly(d("2026-12-02"), RULES, TXNS, SETTINGS, 40_000_00);
        assertThat(dec.weekStart()).isEqualTo(d("2026-11-30"));
        assertThat(dec.budgetMinor()).isEqualTo(4_354_838);
        assertThat(dec.countedFrom()).isEqualTo(d("2026-12-01"));
        assertThat(dec.spentMinor()).isZero();
        assertThat(dec.portions()).extracting(WeekPortion::month).containsExactly(m("2026-12"));
    }

    // allowance.test.ts > allowance > excludes days before the current month (closes to Savings)
    @Test
    void excludesDaysBeforeTheCurrentMonth() {
        List<RecurringRuleInput> r = List.of(rule("salary", RuleKind.INCOME, 650_000_00, "2026-09-10"));
        AllowanceSettings s2 = oldSettings(20_000_00);
        List<TxnInput> t = List.of(expense("2026-11-01", 2_400_00), expense("2026-10-28", 5_000_00));
        WeeklyAllowance wk = AllowanceEngine.weekly(d("2026-11-01"), r, t, s2, 0);
        assertThat(wk.weekStart()).isEqualTo(d("2026-10-26"));
        assertThat(wk.budgetMinor()).isEqualTo(21_000_00);
        assertThat(wk.spentMinor()).isEqualTo(2_400_00);
        assertThat(wk.remainingMinor()).isEqualTo(18_600_00);
    }

    // allowance.test.ts > allowance > overspent clamps
    @Test
    void overspentClamps() {
        List<TxnInput> broke = new ArrayList<>(TXNS);
        broke.add(expense("2026-11-10", 400_000_00));
        assertThat(AllowanceEngine.monthly(m("2026-11"), RULES, broke, SETTINGS, 0).remainingMinor())
            .isEqualTo(-141_000_00);
        assertThat(AllowanceEngine.weekly(d("2026-11-16"), RULES, broke, SETTINGS, 0).budgetMinor()).isZero();
    }

    /** allowance.test.ts > allowance > recurring totals do not rewrite the past (7 cases). */
    @Nested
    class RecurringTotalsDoNotRewriteThePast {
        private final AllowanceSettings noSettings = oldSettings(0);

        private RecurringRuleInput weekly(long amount, String start, String end, String lastMat, boolean active) {
            return new RecurringRuleInput(id("gym"), RuleKind.EXPENSE, amount, Frequency.WEEKLY, d(start),
                end == null ? null : d(end), lastMat == null ? null : d(lastMat), active);
        }

        private RecurringRuleInput weekly(String lastMat) {
            return weekly(10_000_00, "2026-11-02", null, lastMat, true);
        }

        private TxnInput linked(String date, long amount) {
            return linkedTo(TxnKind.EXPENSE, date, amount, "gym");
        }

        private MonthlyAllowance month(List<RecurringRuleInput> r, List<TxnInput> t) {
            return AllowanceEngine.monthly(m("2026-11"), r, t, noSettings, 0);
        }

        // ... > counts the materialized txn instead of its occurrence
        @Test
        void countsTheMaterializedTxnInsteadOfItsOccurrence() {
            // Occurrences: 11-02, 09, 16, 23, 30. One materialized at a different (old) amount.
            List<RecurringRuleInput> r = List.of(weekly("2026-11-02"));
            assertThat(month(r, List.of(linked("2026-11-02", 9_000_00))).fixedCostsMinor())
                .isEqualTo(9_000_00 + 4 * 10_000_00);
        }

        // ... > paused after its charge: charge still counted, later occurrences not
        @Test
        void pausedAfterItsCharge() {
            List<RecurringRuleInput> r = List.of(weekly(10_000_00, "2026-11-02", null, "2026-11-09", false));
            List<TxnInput> t = List.of(linked("2026-11-02", 10_000_00), linked("2026-11-09", 10_000_00));
            assertThat(month(r, t).fixedCostsMinor()).isEqualTo(20_000_00);
        }

        // ... > deleted rule's txns still counted
        @Test
        void deletedRulesTxnsStillCounted() {
            assertThat(month(List.of(), List.of(linked("2026-11-02", 10_000_00))).fixedCostsMinor()).isEqualTo(10_000_00);
            assertThat(month(List.of(), List.of(linked("2026-11-02", 10_000_00))).spentMinor()).isZero();
        }

        // ... > re-priced rule: past at the old amount, future at the new
        @Test
        void repricedRule() {
            List<RecurringRuleInput> r = List.of(weekly(12_000_00, "2026-11-02", null, "2026-11-09", true));
            List<TxnInput> t = List.of(linked("2026-11-02", 10_000_00), linked("2026-11-09", 10_000_00));
            assertThat(month(r, t).fixedCostsMinor()).isEqualTo(2 * 10_000_00 + 3 * 12_000_00);
        }

        // ... > rule with end_date before the month counts 0
        @Test
        void ruleWithEndDateBeforeTheMonthCountsZero() {
            assertThat(month(List.of(weekly(10_000_00, "2026-09-07", "2026-10-31", null, true)), List.of())
                .fixedCostsMinor()).isZero();
        }

        // ... > rule-linked income txn is recurring income, not one-off
        @Test
        void ruleLinkedIncomeTxnIsRecurringIncome() {
            List<TxnInput> t = List.of(linkedTo(TxnKind.INCOME, "2026-11-10", 600_000_00, "gone"),
                income("2026-11-12", 5_000_00));
            MonthlyAllowance a = month(List.of(), t);
            assertThat(a.recurringIncomeMinor()).isEqualTo(600_000_00);
            assertThat(a.oneOffIncomeMinor()).isEqualTo(5_000_00);
        }

        // ... > does not count occurrences up to last_materialized_date that were never written
        @Test
        void doesNotCountSkippedOccurrencesUpToLastMaterializedDate() {
            List<RecurringRuleInput> r = List.of(weekly("2026-11-15"));
            assertThat(month(r, List.of()).fixedCostsMinor()).isEqualTo(3 * 10_000_00); // 16, 23, 30
        }
    }

    // allowance.test.ts > allowance > month override replaces the savings target for that month only
    @Test
    void monthOverrideReplacesTheSavingsTargetForThatMonthOnly() {
        AllowanceSettings s = new AllowanceSettings(10_000_000, 0, Map.of(m("2026-12"), 5_000_000L));
        assertThat(AllowanceEngine.savingsTargetFor(s, m("2026-12"))).isEqualTo(5_000_000);
        assertThat(AllowanceEngine.savingsTargetFor(s, m("2026-11"))).isEqualTo(10_000_000);
        assertThat(AllowanceEngine.savingsTargetFor(s, m("2027-01"))).isEqualTo(10_000_000);
        assertThat(AllowanceEngine.monthly(m("2026-12"), List.of(), List.of(), s, 0).savingsTargetMinor())
            .isEqualTo(5_000_000);
        assertThat(AllowanceEngine.monthly(m("2027-01"), List.of(), List.of(), s, 0).savingsTargetMinor())
            .isEqualTo(10_000_000);
    }

    /** L4 extension (owner decision): Gyakorlás monthly cap + the derivation lines. */
    @Nested
    class PracticeAndLines {

        private AllowanceSettings withPractice(long practice) {
            return new AllowanceSettings(100_000_00, practice, Map.of());
        }

        @Test
        void defaultPracticeIsTwentyThousandForint() {
            assertThat(AllowanceSettings.DEFAULT_PRACTICE_MINOR).isEqualTo(2_000_000L);
            assertThat(AllowanceSettings.withDefaults(100_000_00).practiceMinor()).isEqualTo(2_000_000L);
        }

        @Test
        void practiceIsDeductedLikeAFixedCost() {
            MonthlyAllowance nov = AllowanceEngine.monthly(m("2026-11"), RULES, TXNS, withPractice(2_000_000), 0);
            assertThat(nov.practiceMinor()).isEqualTo(2_000_000);
            assertThat(nov.fixedCostsMinor()).isEqualTo(205_000_00); // unchanged: practice is its own line
            assertThat(nov.freeMinor()).isEqualTo(285_000_00 - 2_000_000);
            assertThat(nov.spentMinor()).isEqualTo(26_000_00);
            assertThat(nov.remainingMinor()).isEqualTo(259_000_00 - 2_000_000);
        }

        @Test
        void practiceShrinksTheWeeklyPortion() {
            // (28 500 000 − 2 000 000) × 7 / 29 = 6 396 551.7… → 6 396 551
            WeeklyAllowance wk = AllowanceEngine.weekly(d("2026-11-04"), RULES, TXNS, withPractice(2_000_000), 0);
            assertThat(wk.budgetMinor()).isEqualTo(6_396_551);
        }

        @Test
        void practiceAppliesToEveryTouchedMonthOfACrossMonthWeek() {
            // Nov portion: 25 900 000 − 2 000 000 (1 day of 1). Dec portion: (26 500 000 − 2 000 000) × 6 / 31 = 4 741 935.4… → 4 741 935.
            WeeklyAllowance cross = AllowanceEngine.weekly(d("2026-11-30"), RULES, TXNS, withPractice(2_000_000), 0);
            assertThat(cross.portions()).extracting(WeekPortion::portionMinor)
                .containsExactly(23_900_000L, 4_741_935L);
        }

        @Test
        void linesCarryTheBriefsKeysInOrderAndAddUp() {
            MonthlyAllowance nov = AllowanceEngine.monthly(m("2026-11"), RULES, TXNS, withPractice(2_000_000), 40_000_00);
            assertThat(nov.lines()).extracting(l -> l.key().wireKey()).containsExactly(
                "recurringIncome", "oneOffIncome", "fixedCosts", "savingsTarget", "practice", "invested",
                "previousDeficit", "free", "spent", "remaining");
            assertThat(nov.lines()).extracting(AllowanceLine::amountMinor).containsExactly(
                600_000_00L, 20_000_00L, 205_000_00L, 100_000_00L, 2_000_000L, 30_000_00L,
                40_000_00L, 225_000_00L, 26_000_00L, 199_000_00L);
            assertThat(nov.line(AllowanceLineKey.FREE)).isEqualTo(nov.freeMinor());
            long derived = nov.recurringIncomeMinor() + nov.oneOffIncomeMinor() - nov.fixedCostsMinor()
                - nov.savingsTargetMinor() - nov.practiceMinor() - nov.investedMinor() - nov.previousDeficitMinor();
            assertThat(nov.freeMinor()).isEqualTo(derived);
            assertThat(nov.remainingMinor()).isEqualTo(nov.freeMinor() - nov.spentMinor());
        }

        @Test
        void zeroPracticeIsStillAListedLine() {
            MonthlyAllowance nov = AllowanceEngine.monthly(m("2026-11"), RULES, TXNS, SETTINGS, 0);
            assertThat(nov.line(AllowanceLineKey.PRACTICE)).isZero();
            assertThat(nov.lines()).hasSize(10);
        }
    }
}
