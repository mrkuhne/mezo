package io.mrkuhne.mezo.feature.goal.entity;

import java.time.LocalDate;

/**
 * One intake day excluded from a week's {@link ExpenditureEstimateEntity} learning input —
 * either flagged {@code suspicious} (heuristic outlier) or {@code marked} (owner-flagged
 * non-representative day). Part of the {@code excludedDays} jsonb list (spec
 * 2026-09-26-learned-expenditure-design §5.5).
 */
public record ExcludedIntakeDayJson(LocalDate date, int kcal, String reason) {
}
