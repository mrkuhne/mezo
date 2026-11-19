package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The monthly and weekly allowance, a port of the old app's {@code src/domain/allowance.ts}
 * extended with the Gyakorlás line ({@code practice}, deducted like a fixed cost). All amounts are
 * HUF minor units (the stored twins). With {@code practice = 0} it reproduces the old engine.
 */
public final class AllowanceEngine {

    private AllowanceEngine() {
    }

    /** Day-to-day spending: an expense not linked to a recurring rule. */
    public static boolean isSpend(TxnInput t) {
        return t.kind() == TxnKind.EXPENSE && t.recurringRuleId() == null;
    }

    /** Investment movement: a recorded buy or sell. Never day-to-day spend, income or a recurring total. */
    public static boolean isInvest(TxnInput t) {
        return t.kind() == TxnKind.INVEST_BUY || t.kind() == TxnKind.INVEST_SELL;
    }

    public static long savingsTargetFor(AllowanceSettings settings, YearMonth month) {
        Long override = settings.savingsTargetOverrides().get(month);
        return override != null ? override : settings.savingsTargetMinor();
    }

    /**
     * The allowance of {@code month}. {@code previousDeficitMinor} is the deficit the previous
     * month's close carried into this one (see {@link MonthCloseRules#previousDeficit}).
     */
    public static MonthlyAllowance monthly(
        YearMonth month, List<RecurringRuleInput> rules, List<TxnInput> txns, AllowanceSettings settings,
        long previousDeficitMinor) {
        List<TxnInput> inMonth = txns.stream().filter(t -> YearMonth.from(t.date()).equals(month)).toList();
        long recurringIncome = recurringTotal(rules, inMonth, RuleKind.INCOME, month);
        long fixedCosts = recurringTotal(rules, inMonth, RuleKind.EXPENSE, month);
        long oneOffIncome = sumHuf(inMonth.stream()
            .filter(t -> t.kind() == TxnKind.INCOME && t.recurringRuleId() == null).toList());
        long savingsTarget = savingsTargetFor(settings, month);
        long practice = settings.practiceMinor();
        long invested = sumHuf(inMonth.stream().filter(t -> t.kind() == TxnKind.INVEST_BUY).toList());
        long free = recurringIncome + oneOffIncome - fixedCosts - savingsTarget - practice - invested
            - previousDeficitMinor;
        long spent = sumHuf(inMonth.stream().filter(AllowanceEngine::isSpend).toList());
        return new MonthlyAllowance(month, recurringIncome, oneOffIncome, fixedCosts, savingsTarget, practice,
            invested, previousDeficitMinor, free, spent, free - spent);
    }

    /**
     * The allowance of the Monday-start week containing {@code today}. Days before today's month
     * belong to a month that closes to savings: excluded from budget and spent. A week reaching
     * into the next month takes a portion of each month. {@code previousDeficitMinor} is the
     * deficit carried into today's month; a later touched month uses 0.
     */
    public static WeeklyAllowance weekly(
        LocalDate today, List<RecurringRuleInput> rules, List<TxnInput> txns, AllowanceSettings settings,
        long previousDeficitMinor) {
        LocalDate ws = PenzDates.weekStart(today);
        LocalDate we = ws.plusDays(6);
        YearMonth todayMonth = YearMonth.from(today);
        LocalDate counted = PenzDates.max(ws, todayMonth.atDay(1));
        List<YearMonth> months = new ArrayList<>(List.of(todayMonth));
        if (!YearMonth.from(we).equals(todayMonth)) {
            months.add(todayMonth.plusMonths(1));
        }

        List<WeekPortion> portions = months.stream().map(m -> {
            LocalDate from = PenzDates.max(counted, m.atDay(1));
            LocalDate weekEndInM = PenzDates.min(we, m.atEndOfMonth());
            int daysInWeek = PenzDates.daysBetweenInclusive(from, weekEndInM);
            int daysToMonthEnd = PenzDates.daysBetweenInclusive(from, m.atEndOfMonth());
            MonthlyAllowance a = monthly(m, rules, txns, settings, m.equals(todayMonth) ? previousDeficitMinor : 0);
            long spentBefore = sumHuf(txns.stream()
                .filter(t -> YearMonth.from(t.date()).equals(m) && isSpend(t) && t.date().isBefore(from)).toList());
            long remainingAtFrom = a.freeMinor() - spentBefore;
            long portion = Math.max(0, Math.floorDiv(Math.multiplyExact(remainingAtFrom, daysInWeek), daysToMonthEnd));
            return new WeekPortion(m, from, daysInWeek, daysToMonthEnd, remainingAtFrom, portion);
        }).toList();

        long budget = portions.stream().mapToLong(WeekPortion::portionMinor).sum();
        long spent = sumHuf(txns.stream()
            .filter(t -> isSpend(t) && !t.date().isBefore(counted) && !t.date().isAfter(we)).toList());
        return new WeeklyAllowance(ws, we, counted, portions, budget, spent, budget - spent);
    }

    /**
     * Recurring income/expense of {@code month}, without rewriting the past:
     * <ul>
     *   <li>every rule-linked txn dated in the month counts at its own amount, whatever the rule's
     *       current state (paused, deleted, re-priced);</li>
     *   <li>plus the CURRENT amount of each occurrence of an ACTIVE rule in the month that is not
     *       yet materialized: after {@code lastMaterializedDate} and without a linked txn on that
     *       date. Occurrences on or before {@code lastMaterializedDate} with no txn were
     *       deliberately skipped (schedule edit, re-activation after a pause, or a deleted entry)
     *       and never will be written.</li>
     * </ul>
     */
    private static long recurringTotal(List<RecurringRuleInput> rules, List<TxnInput> inMonth, RuleKind kind,
        YearMonth month) {
        TxnKind txnKind = kind.txnKind();
        List<TxnInput> linked = inMonth.stream()
            .filter(t -> t.kind() == txnKind && t.recurringRuleId() != null).toList();
        Set<String> have = new HashSet<>();
        linked.forEach(t -> have.add(t.recurringRuleId() + "|" + t.date()));
        long projected = 0;
        for (RecurringRuleInput r : rules) {
            if (!r.active() || r.kind() != kind) {
                continue;
            }
            for (LocalDate d : Recurrence.occurrencesInRange(r, month.atDay(1), month.atEndOfMonth())) {
                boolean afterMaterialized = r.lastMaterializedDate() == null || d.isAfter(r.lastMaterializedDate());
                if (afterMaterialized && !have.contains(r.id() + "|" + d)) {
                    projected += r.amountHufMinor();
                }
            }
        }
        return sumHuf(linked) + projected;
    }

    private static long sumHuf(List<TxnInput> txns) {
        return txns.stream().mapToLong(TxnInput::amountHufMinor).sum();
    }
}
