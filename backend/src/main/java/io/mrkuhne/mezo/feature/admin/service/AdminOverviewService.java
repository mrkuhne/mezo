package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminDayAmount;
import io.mrkuhne.mezo.api.dto.AdminDayCount;
import io.mrkuhne.mezo.api.dto.AdminDaySeries;
import io.mrkuhne.mezo.api.dto.AdminOverviewResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery.DayCountRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Installation-wide counters and the 30-day series behind /admin (mezo-d5iy). */
@Service
@RequiredArgsConstructor
public class AdminOverviewService {

    private static final int WINDOW_DAYS = 30;

    private final AdminProperties properties;
    private final AdminTableCatalog catalog;
    private final AdminInsightsQuery query;
    private final LlmLogRepository llmLogRepository;

    @Transactional(readOnly = true)
    public AdminOverviewResponse overview() {
        LocalDate today = LocalDate.now(properties.reportZone());
        LocalDate from = today.minusDays(WINDOW_DAYS - 1L);
        List<LocalDate> days = days(from, today);

        var response = new AdminOverviewResponse();
        response.setUserCount(query.totalRowCount(catalog.require("app_user")));
        response.setActiveToday(query.activeUsersSince(today, properties.reportZone()));
        response.setActive7d(query.activeUsersSince(today.minusDays(6), properties.reportZone()));
        response.setActive30d(query.activeUsersSince(from, properties.reportZone()));
        response.setActiveUserSeries(dense(days, query.activeUsersByDay(from, properties.reportZone())));

        Map<String, Long> loggedToday = new LinkedHashMap<>();
        List<AdminDaySeries> domainSeries = new ArrayList<>();
        properties.featureMap().forEach((key, source) -> {
            var table = catalog.require(source.table());
            var column = catalog.requireColumn(table, source.timestampColumn());
            loggedToday.put(key, query.countSince(table, column, today, properties.reportZone()));
            var series = new AdminDaySeries();
            series.setKey(key);
            series.setDays(dense(days, query.countByDay(table, column, from, properties.reportZone())));
            domainSeries.add(series);
        });
        response.setLoggedToday(loggedToday);
        response.setDomainSeries(domainSeries);

        response.setMemoryItemCount(query.totalRowCount(catalog.require("memory_item")));
        response.setVectorCount(query.totalRowCount(catalog.require("memory_vector")));

        Instant since = from.atStartOfDay(properties.reportZone()).toInstant();
        Map<LocalDate, BigDecimal> costByDay = llmLogRepository
                .aggregatePerDaySince(since, properties.reportZone().getId()).stream()
                .collect(Collectors.toMap(
                        row -> row.getDay(),
                        row -> row.getCostUsd() == null ? BigDecimal.ZERO : row.getCostUsd(),
                        BigDecimal::add, LinkedHashMap::new));
        response.setCostSeries(days.stream().map(day -> {
            var amount = new AdminDayAmount();
            amount.setDay(day);
            amount.setAmountUsd(costByDay.getOrDefault(day, BigDecimal.ZERO).doubleValue());
            return amount;
        }).toList());
        response.setCostTodayUsd(costByDay.getOrDefault(today, BigDecimal.ZERO).doubleValue());
        return response;
    }

    private static List<LocalDate> days(LocalDate from, LocalDate to) {
        return from.datesUntil(to.plusDays(1)).toList();
    }

    /** Every day in the window gets a bucket, so the frontend can draw without gap logic. */
    private static List<AdminDayCount> dense(List<LocalDate> days, List<DayCountRow> rows) {
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
