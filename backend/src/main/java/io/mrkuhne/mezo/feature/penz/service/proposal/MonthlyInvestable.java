package io.mrkuhne.mezo.feature.penz.service.proposal;

import io.mrkuhne.mezo.feature.penz.service.engine.AllowanceEngine;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthlyAllowance;
import io.mrkuhne.mezo.feature.penz.service.engine.TxnInput;
import io.mrkuhne.mezo.feature.penz.service.engine.TxnKind;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

/**
 * The monthly strategy figure (Boop Pénz L7, mezo-r36n9.105, build notes call 14; spec decision 5, §10.1.1) — a port
 * of the old Finance Tracker app's monthly-investable computation: {@code domain/invest.ts} {@code suggestInvestment},
 * {@code base44/shared/brief.ts} {@code pullForwardRoomMinor} / {@code daysLeftInMonth}, the averages of
 * {@code domain/planning.ts} ({@code completeMonthTotals}, {@code typicalMonthlySpendMinor},
 * {@code averageMonthly{Expenses,Income}Minor}, {@code dailySpendMinor}) and {@code investModel.ts}
 * {@code freeBeforeInvestMinor}. Pure; every amount HUF minor units.
 *
 * <h2>The rule</h2>
 * {@code available = min(avgIncome − avgExpenses − savingsTarget, freeBeforeInvest)}; ≤ 0 → nothing spare. The share
 * is {@value #SHARE_BEFORE_EMERGENCY_PCT} % before the emergency fund is full and {@value #SHARE_AFTER_EMERGENCY_PCT} %
 * after. Last month's buys above last month's figure trim it, by at most half ({@code OVERSPEND_CAP_SHARE}); the
 * result rounds down to 1 000 Ft. No tracked complete month → no data. A manual setting wins (Mezo has none yet —
 * the parameter is kept so the port stays whole). The pull-forward room (what could be invested ahead of next month)
 * is a separate figure: half the month's figure at most, never more than what stays free after the expected spend,
 * 0 before the emergency fund is done.
 *
 * <h2>Port differences</h2>
 * The old arithmetic was floating point; here the share is an exact fraction and every floor is integer. The old
 * "no complete month" fallbacks called the allowance engine; here they take its {@link MonthlyAllowance} for the
 * current month. The old {@code source = 'recurring'} (back-fill) test reads {@code recurringRuleId != null}.
 */
public final class MonthlyInvestable {

    public static final int SHARE_BEFORE_EMERGENCY_PCT = 25;
    public static final int SHARE_AFTER_EMERGENCY_PCT = 60;
    /** Suggestions round down to 1 000 Ft. */
    public static final long ROUND_TO_MINOR = 100_000L;
    private static final int RECENT_MONTHS = 3;

    private MonthlyInvestable() {
    }

    public enum Kind { NO_DATA, NOTHING_SPARE, AMOUNT }

    public enum Source { COMPUTED, SETTING }

    /** The old {@code Suggestion}; {@code amountMinor} is 0 unless {@code kind} is AMOUNT. */
    public record Suggestion(Kind kind, long amountMinor, Source source, boolean emergencyDone) {

        static Suggestion of(Kind kind) {
            return new Suggestion(kind, 0, null, false);
        }
    }

    /** The old {@code suggestInvestment} input. {@code settingMinor} null = no manual figure. */
    public record Inputs(int trackedMonths, long avgIncomeMinor, long avgExpensesMinor, long savingsTargetMinor,
                         long freeBeforeInvestMinor, boolean emergencyDone, Long settingMinor, long prevExcessMinor) {

        public Inputs withTrackedMonths(int v) {
            return new Inputs(v, avgIncomeMinor, avgExpensesMinor, savingsTargetMinor, freeBeforeInvestMinor,
                emergencyDone, settingMinor, prevExcessMinor);
        }

        public Inputs withAvgIncome(long v) {
            return new Inputs(trackedMonths, v, avgExpensesMinor, savingsTargetMinor, freeBeforeInvestMinor,
                emergencyDone, settingMinor, prevExcessMinor);
        }

        public Inputs withAvgExpenses(long v) {
            return new Inputs(trackedMonths, avgIncomeMinor, v, savingsTargetMinor, freeBeforeInvestMinor,
                emergencyDone, settingMinor, prevExcessMinor);
        }

        public Inputs withFree(long v) {
            return new Inputs(trackedMonths, avgIncomeMinor, avgExpensesMinor, savingsTargetMinor, v, emergencyDone,
                settingMinor, prevExcessMinor);
        }

        public Inputs withEmergencyDone(boolean v) {
            return new Inputs(trackedMonths, avgIncomeMinor, avgExpensesMinor, savingsTargetMinor,
                freeBeforeInvestMinor, v, settingMinor, prevExcessMinor);
        }

        public Inputs withSetting(Long v) {
            return new Inputs(trackedMonths, avgIncomeMinor, avgExpensesMinor, savingsTargetMinor,
                freeBeforeInvestMinor, emergencyDone, v, prevExcessMinor);
        }

        public Inputs withPrevExcess(long v) {
            return new Inputs(trackedMonths, avgIncomeMinor, avgExpensesMinor, savingsTargetMinor,
                freeBeforeInvestMinor, emergencyDone, settingMinor, v);
        }
    }

    /** One complete month's totals (old {@code MonthTotals}). */
    public record MonthTotals(YearMonth month, long spendMinor, long expensesMinor, long incomeMinor) {
    }

    /** The old {@code suggestInvestment}. */
    public static Suggestion suggest(Inputs i) {
        if (i.settingMinor() != null && i.settingMinor() > 0) {
            return new Suggestion(Kind.AMOUNT, i.settingMinor(), Source.SETTING, i.emergencyDone());
        }
        if (i.trackedMonths() <= 0) {
            return Suggestion.of(Kind.NO_DATA);
        }
        long available = Math.min(i.avgIncomeMinor() - i.avgExpensesMinor() - i.savingsTargetMinor(),
            i.freeBeforeInvestMinor());
        if (available <= 0) {
            return Suggestion.of(Kind.NOTHING_SPARE);
        }
        long pct = sharePct(i.emergencyDone());
        // raw = available × pct / 100 (exact fraction); trim = min(excess, floor(raw / 2))
        long rawTimes100 = Math.multiplyExact(available, pct);
        long excess = Math.max(0, i.prevExcessMinor());
        long trim = Math.min(excess, Math.floorDiv(rawTimes100, 200));
        long amount = Math.floorDiv(rawTimes100 - Math.multiplyExact(trim, 100L), 100L * ROUND_TO_MINOR)
            * ROUND_TO_MINOR;
        if (amount <= 0) {
            return Suggestion.of(Kind.NOTHING_SPARE);
        }
        return new Suggestion(Kind.AMOUNT, amount, Source.COMPUTED, i.emergencyDone());
    }

    /** 25 before the emergency fund is full, 60 after. */
    public static int sharePct(boolean emergencyDone) {
        return emergencyDone ? SHARE_AFTER_EMERGENCY_PCT : SHARE_BEFORE_EMERGENCY_PCT;
    }

    /** The old {@code freeBeforeInvestMinor}: the month's free money plus what was already invested. */
    public static long freeBeforeInvest(long freeMinor, long investedMinor) {
        return freeMinor + investedMinor;
    }

    /** The old {@code pullForwardRoomMinor}. */
    public static long pullForwardRoom(boolean emergencyDone, long suggestedMinor, long investedMinor,
                                       long remainingMinor, long dailySpendMinor, int daysLeft) {
        if (!emergencyDone) {
            return 0;
        }
        long freeAfterSpend = remainingMinor - dailySpendMinor * daysLeft;
        long excess = Math.max(0, investedMinor - suggestedMinor);
        return Math.max(0, Math.min(Math.floorDiv(suggestedMinor, 2) - excess, freeAfterSpend));
    }

    /** Days left in the month of {@code today}, today included (30 Nov → 1, 1 Nov → 30). */
    public static int daysLeftInMonth(LocalDate today) {
        return today.lengthOfMonth() - today.getDayOfMonth() + 1;
    }

    /**
     * The old {@code completeMonthTotals}: every complete month before today's, oldest first. Tracking starts at the
     * earliest transaction that is not recurring back-fill; that month counts only if it is on its 1st.
     */
    public static List<MonthTotals> completeMonthTotals(List<TxnInput> txns, LocalDate today) {
        LocalDate earliest = txns.stream().filter(t -> t.recurringRuleId() == null).map(TxnInput::date)
            .min(LocalDate::compareTo).orElse(null);
        if (earliest == null) {
            return List.of();
        }
        YearMonth current = YearMonth.from(today);
        YearMonth first = earliest.getDayOfMonth() == 1 ? YearMonth.from(earliest) : YearMonth.from(earliest).plusMonths(1);
        List<MonthTotals> out = new ArrayList<>();
        for (YearMonth m = first; m.isBefore(current); m = m.plusMonths(1)) {
            YearMonth month = m;
            List<TxnInput> in = txns.stream().filter(t -> YearMonth.from(t.date()).equals(month)).toList();
            out.add(new MonthTotals(month,
                sum(in.stream().filter(AllowanceEngine::isSpend).toList()),
                sum(in.stream().filter(t -> t.kind() == TxnKind.EXPENSE).toList()),
                sum(in.stream().filter(t -> t.kind() == TxnKind.INCOME).toList())));
        }
        return out;
    }

    /** The old {@code typicalMonthlySpendMinor}. */
    public static long typicalMonthlySpend(List<TxnInput> txns, LocalDate today) {
        return typicalMonthlySpend(txns, today, completeMonthTotals(txns, today));
    }

    private static long typicalMonthlySpend(List<TxnInput> txns, LocalDate today, List<MonthTotals> months) {
        if (!months.isEmpty()) {
            return recentAverage(months, MonthTotals::spendMinor);
        }
        long soFar = spendSoFar(txns, today);
        return Math.floorDiv(soFar * today.lengthOfMonth(), today.getDayOfMonth());
    }

    /** The old {@code averageMonthlyExpensesMinor}; without a complete month: fixed costs + typical spend. */
    public static long averageMonthlyExpenses(List<TxnInput> txns, LocalDate today, MonthlyAllowance current) {
        List<MonthTotals> months = completeMonthTotals(txns, today);
        if (!months.isEmpty()) {
            return recentAverage(months, MonthTotals::expensesMinor);
        }
        return current.fixedCostsMinor() + typicalMonthlySpend(txns, today, months);
    }

    /** The old {@code averageMonthlyIncomeMinor}; without a complete month: recurring + one-off income. */
    public static long averageMonthlyIncome(List<TxnInput> txns, LocalDate today, MonthlyAllowance current) {
        List<MonthTotals> months = completeMonthTotals(txns, today);
        if (!months.isEmpty()) {
            return recentAverage(months, MonthTotals::incomeMinor);
        }
        return current.recurringIncomeMinor() + current.oneOffIncomeMinor();
    }

    /** The old {@code dailySpendMinor}: the larger of this month's pace and the complete-month average per 30 days. */
    public static long dailySpend(List<TxnInput> txns, LocalDate today) {
        long paceNow = Math.ceilDiv(spendSoFar(txns, today), today.getDayOfMonth());
        List<MonthTotals> months = completeMonthTotals(txns, today);
        long paceHistory = months.isEmpty() ? 0
            : (long) Math.ceil((double) months.stream().mapToLong(MonthTotals::spendMinor).sum() / months.size() / 30);
        return Math.max(paceNow, paceHistory);
    }

    private static long spendSoFar(List<TxnInput> txns, LocalDate today) {
        YearMonth month = YearMonth.from(today);
        return sum(txns.stream().filter(t -> YearMonth.from(t.date()).equals(month) && AllowanceEngine.isSpend(t))
            .toList());
    }

    private static long recentAverage(List<MonthTotals> months, java.util.function.ToLongFunction<MonthTotals> pick) {
        List<MonthTotals> recent = months.subList(Math.max(0, months.size() - RECENT_MONTHS), months.size());
        return Math.floorDiv(recent.stream().mapToLong(pick).sum(), recent.size());
    }

    private static long sum(List<TxnInput> txns) {
        return txns.stream().mapToLong(TxnInput::amountHufMinor).sum();
    }
}
