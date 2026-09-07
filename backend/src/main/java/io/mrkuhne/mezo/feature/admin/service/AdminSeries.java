package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminDayCount;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery.DayCountRow;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Zero-fills a day window so the frontend can draw without gap logic (mezo-d5iy). Shared between
 * {@link AdminOverviewService} (30-day window) and {@link AdminUserService} (90-day window).
 */
final class AdminSeries {

    private AdminSeries() {}

    static List<AdminDayCount> dense(List<LocalDate> days, List<DayCountRow> rows) {
        Map<LocalDate, Long> byDay = rows.stream()
                .collect(Collectors.toMap(DayCountRow::day, DayCountRow::count, Long::sum));
        return days.stream().map(day -> {
            var count = new AdminDayCount();
            count.setDay(day);
            count.setCount(byDay.getOrDefault(day, 0L));
            return count;
        }).toList();
    }
}
