package io.mrkuhne.mezo.feature.meal.entity;

import java.math.BigDecimal;

/**
 * Typed envelope for the {@code meal.breakdown} jsonb column — the Phase-3 meal-score record.
 * Deliberately minimal: in v1 {@code breakdown} is always NULL (the score is deferred, guarded by
 * the FE pending-sparkle), so this record only exists to give the jsonb column a typed mapping
 * target via {@code @JdbcTypeCode(SqlTypes.JSON)} instead of a raw String. The full 4-dimension
 * (Macro/Micro/NOVA/Context) weighted structure lands with Phase-3 scoring.
 */
public record MealBreakdownJson(BigDecimal value, String summary) {
}
