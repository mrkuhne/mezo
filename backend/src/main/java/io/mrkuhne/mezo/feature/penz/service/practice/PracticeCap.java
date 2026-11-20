package io.mrkuhne.mezo.feature.penz.service.practice;

import java.util.Collection;

/**
 * The Gyakorlás cap of one month (Boop Pénz L7, mezo-r36n9.105, build notes call 6), HUF minor units. {@code cap}
 * is {@code penz_settings.practice_monthly_minor} — the same field as the allowance's {@code practice} line.
 * used = Σ cost of the open trades + max(0, −Σ P/L of the trades closed this month); left = max(0, cap − used).
 * Gains never raise the cap; nothing here reads another sleeve, the allowance or a holding.
 */
public record PracticeCap(long capHufMinor, long usedHufMinor, long leftHufMinor) {

    public static PracticeCap of(long capHufMinor, Collection<Long> openCostsHufMinor,
                                 Collection<Long> closedThisMonthPnlHufMinor) {
        long open = openCostsHufMinor.stream().mapToLong(Long::longValue).sum();
        long closedPnl = closedThisMonthPnlHufMinor.stream().mapToLong(Long::longValue).sum();
        long used = open + Math.max(0, -closedPnl);
        return new PracticeCap(capHufMinor, used, Math.max(0, capHufMinor - used));
    }

    /** Whether a trade costing {@code costHufMinor} may open. */
    public boolean allows(long costHufMinor) {
        return costHufMinor <= leftHufMinor;
    }
}
