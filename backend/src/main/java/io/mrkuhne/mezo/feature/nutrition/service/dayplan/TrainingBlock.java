package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.time.LocalTime;

/**
 * One of the day's REAL training blocks as the planner sees it: start and duration in minutes
 * since midnight plus a human label. Built from {@code WorkoutWindowQueryService.Window}, whose
 * end is always known, so — unlike the web planner's {@code PlannerBlock} — the duration is never
 * null and no per-kind default duration is needed.
 */
public record TrainingBlock(int startMin, int durationMin, String label) {

    public static TrainingBlock of(LocalTime start, LocalTime end, String label) {
        int startMin = start.getHour() * 60 + start.getMinute();
        int endMin = end.getHour() * 60 + end.getMinute();
        return new TrainingBlock(startMin, Math.max(0, endMin - startMin), label);
    }

    public int endMin() {
        return startMin + durationMin;
    }
}
