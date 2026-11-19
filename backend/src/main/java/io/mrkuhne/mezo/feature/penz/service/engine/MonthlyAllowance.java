package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.YearMonth;
import java.util.List;

/**
 * A month's allowance (old {@code MonthlyAllowance}, plus {@code practiceMinor}), HUF minor units.
 * {@code fixedCostsMinor} is the old {@code recurringExpensesMinor}; {@code investedMinor} the
 * old {@code investmentMinor}.
 */
public record MonthlyAllowance(
    YearMonth month,
    long recurringIncomeMinor,
    long oneOffIncomeMinor,
    long fixedCostsMinor,
    long savingsTargetMinor,
    long practiceMinor,
    long investedMinor,
    long previousDeficitMinor,
    long freeMinor,
    long spentMinor,
    long remainingMinor) {

    /** The derivation as lines with the brief's keys, in {@link AllowanceLineKey} order. */
    public List<AllowanceLine> lines() {
        return java.util.Arrays.stream(AllowanceLineKey.values())
            .map(k -> new AllowanceLine(k, line(k)))
            .toList();
    }

    public long line(AllowanceLineKey key) {
        return switch (key) {
            case RECURRING_INCOME -> recurringIncomeMinor;
            case ONE_OFF_INCOME -> oneOffIncomeMinor;
            case FIXED_COSTS -> fixedCostsMinor;
            case SAVINGS_TARGET -> savingsTargetMinor;
            case PRACTICE -> practiceMinor;
            case INVESTED -> investedMinor;
            case PREVIOUS_DEFICIT -> previousDeficitMinor;
            case FREE -> freeMinor;
            case SPENT -> spentMinor;
            case REMAINING -> remainingMinor;
        };
    }
}
