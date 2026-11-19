package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Month-close rules, a port of the old app's {@code src/domain/monthClose.ts}. */
public final class MonthCloseRules {

    private MonthCloseRules() {
    }

    /**
     * Past months (before today's month) from {@code earliestDataMonth} that have no close yet,
     * oldest first. {@code earliestDataMonth} null (no data at all) → empty.
     */
    public static List<YearMonth> monthsToClose(LocalDate today, YearMonth earliestDataMonth,
        List<MonthCloseInput> closes) {
        if (earliestDataMonth == null) {
            return List.of();
        }
        YearMonth current = YearMonth.from(today);
        Set<YearMonth> closed = closes.stream().map(MonthCloseInput::month).collect(Collectors.toSet());
        List<YearMonth> out = new ArrayList<>();
        for (YearMonth m = earliestDataMonth; m.isBefore(current); m = m.plusMonths(1)) {
            if (!closed.contains(m)) {
                out.add(m);
            }
        }
        return out;
    }

    /** A positive remaining is the leftover, a negative one the deficit carried into next month. */
    public static CloseOutcome closeOutcome(MonthlyAllowance a) {
        return closeOutcome(a.remainingMinor());
    }

    public static CloseOutcome closeOutcome(long remainingMinor) {
        return new CloseOutcome(Math.max(0, remainingMinor), Math.max(0, -remainingMinor));
    }

    /** The deficit the previous month's close carried into {@code month}; 0 without a close. */
    public static long previousDeficit(YearMonth month, List<MonthCloseInput> closes) {
        YearMonth prev = month.minusMonths(1);
        return closes.stream().filter(c -> c.month().equals(prev)).findFirst()
            .map(MonthCloseInput::deficitMinor).orElse(0L);
    }
}
