package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.service.DayFigures;
import io.mrkuhne.mezo.feature.companion.service.OwnerToday;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Boop B3 (mezo-r36n9.13, spec §7.6): the two day reads the conversation planner can call — the watch's
 * day metrics and today's calendar. "Today" is the owner's day ({@link OwnerToday}); the calendar is
 * times and durations only, its titles are never read out (B3; B7 decides).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DayTools {

    private static final int WEEK = 7;

    private final DailyMetricRepository dailyMetrics;
    private final CalendarEventRepository calendarEvents;
    private final OwnerToday ownerToday;

    @Tool(name = "get_wearable", description = "Az óra (Apple Health) napi adatai: lépés, nyugalmi pulzus, "
            + "HRV, aktív kalória, a 14 napos szokott értékhez mérve. scope=today (alapértelmezés): a mai nap "
            + "eddig; week: az utolsó 7 nap naponként. Használd, amikor a mai/heti mozgás, pulzus vagy HRV kell.")
    public String wearable(@ToolParam(required = false, description = "today (alapértelmezés) vagy week")
            String scope, ToolContext ctx) {
        UUID user = ToolContexts.userId(ctx);
        LocalDate today = ownerToday.today();
        Map<LocalDate, DailyMetricEntity> byDate = dailyMetrics
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDate(user, today.minusDays(DayFigures.BASELINE_DAYS), today).stream()
            .collect(Collectors.toMap(DailyMetricEntity::getDate, Function.identity(), (a, b) -> b));
        if ("week".equals(scope)) {
            List<String> lines = new ArrayList<>();
            for (int i = WEEK - 1; i >= 0; i--) {
                LocalDate d = today.minusDays(i);
                lines.add(d + ": " + dayLine(byDate.get(d)));
            }
            return "Óra, utolsó 7 nap:\n" + String.join("\n", lines);
        }
        if (scope != null && !"today".equals(scope)) {
            return "Ismeretlen scope. Használható: today, week.";
        }
        DailyMetricEntity m = byDate.get(today);
        if (m == null) {
            return "Óra, ma (" + today + "): " + ToolText.NO_DATA;
        }
        Double restingUsual = DayFigures.usual(today, byDate, DailyMetricEntity::getRestingHr);
        Double hrvUsual = DayFigures.usual(today, byDate, DayFigures::hrv);
        List<String> parts = new ArrayList<>();
        parts.add(m.getSteps() == null ? "lépés: " + ToolText.NO_DATA : m.getSteps() + " lépés eddig");
        if (m.getRestingHr() != null) {
            parts.add("nyugalmi pulzus " + m.getRestingHr() + DayFigures.usualSuffix(restingUsual));
        }
        if (m.getHrvMs() != null) {
            parts.add("HRV " + DayFigures.hrv(m) + " ms" + DayFigures.usualSuffix(hrvUsual));
        }
        if (m.getActiveKcal() != null) {
            parts.add("aktív " + m.getActiveKcal() + " kcal");
        }
        return "Óra, ma (" + today + "): " + String.join(", ", parts);
    }

    @Tool(name = "get_calendar", description = "A mai naptár: események kezdete, vége és hossza (címek nélkül), "
            + "jelölve, ami már elmúlt. scope=today. Használd, amikor a nap beosztása, szabad idő vagy a "
            + "hátralévő elfoglaltság számít.")
    public String calendar(@ToolParam(required = false, description = "today (alapértelmezés)") String scope,
            ToolContext ctx) {
        if (scope != null && !"today".equals(scope)) {
            return "Ismeretlen scope. Használható: today.";
        }
        UUID user = ToolContexts.userId(ctx);
        LocalDate today = ownerToday.today();
        ZoneId zone = ownerToday.zone();
        var now = ownerToday.now();
        List<CalendarEventEntity> events = calendarEvents.findByCreatedByAndDeletedFalseAndDateOrderByStartAt(user, today);
        if (events.isEmpty()) {
            return "Naptár, ma (" + today + "): nincs esemény.";
        }
        List<String> lines = new ArrayList<>();
        for (CalendarEventEntity e : events) {
            if (e.isAllDay() || e.getStartAt() == null || e.getEndAt() == null) {
                lines.add("egész napos esemény");
                continue;
            }
            LocalTime start = LocalTime.ofInstant(e.getStartAt(), zone);
            LocalTime end = LocalTime.ofInstant(e.getEndAt(), zone);
            lines.add(DayFigures.hhmm(start) + "–" + DayFigures.hhmm(end) + " (" + Duration.between(e.getStartAt(), e.getEndAt()).toMinutes()
                + " perc)" + (e.getEndAt().isAfter(now) ? "" : " — elmúlt"));
        }
        return "Naptár, ma (" + today + "), címek nélkül:\n" + String.join("\n", lines);
    }

    private static String dayLine(DailyMetricEntity m) {
        if (m == null) {
            return ToolText.NO_DATA;
        }
        List<String> parts = new ArrayList<>();
        if (m.getSteps() != null) {
            parts.add(m.getSteps() + " lépés");
        }
        if (m.getRestingHr() != null) {
            parts.add("nyugalmi pulzus " + m.getRestingHr());
        }
        if (m.getHrvMs() != null) {
            parts.add("HRV " + DayFigures.hrv(m) + " ms");
        }
        if (m.getActiveKcal() != null) {
            parts.add("aktív " + m.getActiveKcal() + " kcal");
        }
        return parts.isEmpty() ? ToolText.NO_DATA : String.join(", ", parts);
    }
}
