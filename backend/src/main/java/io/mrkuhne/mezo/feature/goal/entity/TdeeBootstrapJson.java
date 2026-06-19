package io.mrkuhne.mezo.feature.goal.entity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Formula-TDEE bootstrap snapshot, computed at first {@code evaluate} and persisted as the
 * {@code goal.tdee_bootstrap} jsonb column. Mirrors the contract {@code TdeeBootstrap} schema
 * 1:1 ({@code formula} stays a plain {@code String} — MSJ|KATCH — projected to the DTO enum by
 * {@code GoalMapper}). Plain record, no Jackson/Hibernate annotations (the
 * {@code @JdbcTypeCode(SqlTypes.JSON)} on the field serializes it via the app {@code ObjectMapper}).
 */
public record TdeeBootstrapJson(
    BigDecimal bmr,
    BigDecimal tdee,
    BigDecimal pal,
    String formula, // MSJ | KATCH
    OffsetDateTime computedAt
) {
}
