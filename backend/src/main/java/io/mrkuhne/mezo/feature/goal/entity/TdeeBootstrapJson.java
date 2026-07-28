package io.mrkuhne.mezo.feature.goal.entity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Formula-TDEE bootstrap snapshot, computed at first {@code evaluate} and persisted as the
 * {@code goal.tdee_bootstrap} jsonb column. Models a <b>NEAT baseline + weekly scheduled EAT</b>:
 * {@code neatBaselineKcal = bmr × neat} (non-exercise lifestyle energy) and
 * {@code tdee = neatBaselineKcal + weeklyEatKcalPerDay} (scheduled training energy, averaged per
 * day). {@code formula} stays a plain {@code String} — MSJ|KATCH — projected to the DTO enum by
 * {@code GoalMapper}. Plain record, no Jackson/Hibernate annotations (the
 * {@code @JdbcTypeCode(SqlTypes.JSON)} on the field serializes it via the app {@code ObjectMapper}).
 */
public record TdeeBootstrapJson(
    BigDecimal bmr,
    BigDecimal neat,               // NEAT multiplier (was pal)
    BigDecimal neatBaselineKcal,   // bmr × neat
    BigDecimal weeklyEatKcalPerDay,// scheduled training energy ÷ 7
    BigDecimal tdee,               // neatBaselineKcal + weeklyEatKcalPerDay
    String formula, // MSJ | KATCH
    OffsetDateTime computedAt
) {
}
