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
    BigDecimal neatBaselineKcal,   // the served Alap: bmr × neat, or the learned base (mezo-zz91i)
    BigDecimal weeklyEatKcalPerDay,// scheduled training energy ÷ 7
    BigDecimal tdee,               // neatBaselineKcal + weeklyEatKcalPerDay
    String formula, // MSJ | KATCH
    OffsetDateTime computedAt,
    Integer activityModel, // ActivityEnergyModel.VERSION the weekly EAT was computed with; null = pre-mezo-32m82 (gross MET)
    String baseSource,                 // "formula" | "learned"; null = formula (pre-mezo-zz91i rows)
    BigDecimal formulaNeatBaselineKcal,// bmr × neat, kept when the base is learned
    Integer learnedSdKcal,
    String learnedConfidence           // LOW | MEDIUM | HIGH
) {
    /** The pre-mezo-zz91i shape: a formula-sourced bootstrap (the 4 learned-base fields null). */
    public TdeeBootstrapJson(BigDecimal bmr, BigDecimal neat, BigDecimal neatBaselineKcal, BigDecimal weeklyEatKcalPerDay,
                             BigDecimal tdee, String formula, OffsetDateTime computedAt, Integer activityModel) {
        this(bmr, neat, neatBaselineKcal, weeklyEatKcalPerDay, tdee, formula, computedAt, activityModel, null, null, null, null);
    }

    public boolean learned() {
        return "learned".equals(baseSource);
    }
}
