package io.mrkuhne.mezo.feature.train.entity.json;

import java.util.List;

/**
 * Lifestyle/wellbeing context correlated to a closed mesocycle's window, persisted verbatim in
 * {@code mesocycle_report.context} — mirrors the contract's {@code MesoContext} schema
 * field-for-field. Populated starting in a later slice; the column stays nullable until then so
 * the contract shape does not change when it lands.
 */
public record MesoContextJson(List<Week> weeks, Totals totals) {

    /** Mirrors the contract's {@code MesoContextWeek} schema field-for-field. */
    public record Week(
        Integer week,
        Double sleepAvgH,
        Double sleepQualityAvg,
        Double kcalAvg,
        Double kcalTargetAvg,
        Double mealCoverageDays,
        Double waterAvgMl,
        Double energyAvg,
        Double stressAvg,
        Double weightDeltaKg,
        Double sportMinutes,
        Double sportSessions,
        Double runSessions,
        Double gymRpeAvg
    ) {}

    /** Mirrors the contract's {@code MesoContextTotals} schema field-for-field. */
    public record Totals(
        Integer daysTotal,
        Double sleepAvgH,
        Double kcalAvg,
        Double energyAvg,
        Double stressAvg,
        Double weightChangeKg,
        Double sportMinutes,
        Double sportSessions,
        Double runSessions,
        Double mealCoverageDays
    ) {}
}
