package io.mrkuhne.mezo.feature.goal.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * How a week's learned base came about — the "Hogy tanultam?" explainer (bd mezo-y72o3), built in
 * the weekly run and persisted as {@code expenditure_estimate.explanation} jsonb so the request path
 * never replays the filter. Every field is a real per-user number; a nullable one is absent when the
 * window had nothing to compute it from (the UI hides that line).
 *
 * @param windowStart          first day of the replayed window
 * @param windowEnd            last day (the reviewed week's Sunday)
 * @param usableDays           usable intake days in the whole window
 * @param weighInDays          days with at least one weigh-in in the window
 * @param unloggedDays         days with no logged intake in the window
 * @param historyWeeks         ceil(days from the first weigh-in in the window to its end / 7)
 * @param avgIntakeKcal        mean usable intake; {@code null} with no usable day
 * @param avgMovementKcal      mean movement input over the window (plan average + unplanned extra)
 * @param tissueRateKgPerWeek  the filter's tissue change over the traced span, per week
 * @param tissueKcalPerDay     that rate as kcal/day ({@code rate / 7 × kcalPerKg})
 * @param simpleBaseKcal       {@code avgIntake − tissueKcalPerDay − avgMovement}; {@code null} when either is missing
 * @param startBaseKcal        the base this week's step started from (the previous applied base)
 * @param excludedDays         suspicious / marked days in the whole window, date-ascending
 * @param waterEvents          glycogen-water jumps (≥ the configured kg over 7 days), one per run of days
 * @param series               the last 56 days of the window — the explainer chart
 */
public record ExpenditureExplanationJson(
    LocalDate windowStart,
    LocalDate windowEnd,
    int usableDays,
    int weighInDays,
    int unloggedDays,
    int historyWeeks,
    Integer avgIntakeKcal,
    int avgMovementKcal,
    BigDecimal tissueRateKgPerWeek,
    Integer tissueKcalPerDay,
    Integer simpleBaseKcal,
    int startBaseKcal,
    List<ExcludedIntakeDayJson> excludedDays,
    List<WaterEvent> waterEvents,
    List<SeriesPoint> series) {

    /** A glycogen-water jump: the first day of the run and the largest 7-day rise in it. */
    public record WaterEvent(LocalDate date, BigDecimal kg) {
    }

    /**
     * One chart day. {@code status}: {@code usable|suspicious|marked|unlogged}; {@code intakeKcal} is the
     * logged total (also for an excluded day), {@code null} when unlogged; {@code weightKg} the day's mean
     * weigh-in or {@code null}; {@code trendKg = tissue + water + glycogen} and {@code tissueKg} from the
     * filter trace, {@code null} before the first weigh-in.
     */
    public record SeriesPoint(LocalDate date, Integer intakeKcal, String status, BigDecimal weightKg,
                              BigDecimal trendKg, BigDecimal tissueKg) {
    }
}
