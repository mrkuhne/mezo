package io.mrkuhne.mezo.feature.penz.service.engine;

import java.util.OptionalDouble;
import java.util.OptionalLong;

/**
 * Emergency-fund figures, a port of the emergency part of the old app's
 * {@code src/domain/savings.ts} ({@code emergencyTargetMinor}, {@code monthsCovered},
 * {@code monthsToReach}). Goal allocation ({@code allocateGoals}) is out of L4.
 */
public final class EmergencyFund {

    private EmergencyFund() {
    }

    /** Target for an emergency fund: months of average expenses to cover. */
    public static long targetMinor(int months, long avgExpensesMinor) {
        return Math.multiplyExact(months, avgExpensesMinor);
    }

    /** Months of expenses the saved amount covers, to 1 decimal; empty when there are no expenses. */
    public static OptionalDouble monthsCovered(long savedMinor, long avgExpensesMinor) {
        if (avgExpensesMinor <= 0) {
            return OptionalDouble.empty();
        }
        return OptionalDouble.of(Math.round(((double) savedMinor / avgExpensesMinor) * 10) / 10.0);
    }

    /** Whole months of saving at the monthly rate needed to close the gap; empty when not saving. */
    public static OptionalLong monthsToReach(long remainingMinor, long monthlyMinor) {
        if (remainingMinor <= 0) {
            return OptionalLong.of(0);
        }
        if (monthlyMinor <= 0) {
            return OptionalLong.empty();
        }
        return OptionalLong.of(Math.ceilDiv(remainingMinor, monthlyMinor));
    }
}
