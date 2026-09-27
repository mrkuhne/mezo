package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * The goal snapshot's resting side of the equation: the BMR floor and the served Alap
 * ({@code neatBaselineKcal}: BMR × NEAT, or the learned base, mezo-zz91i) with its provenance —
 * {@code baseSource} ({@code "formula"}|{@code "learned"}), {@code formulaBaseKcal} (BMR × NEAT,
 * shown next to a learned base), and the learned base's ±1 SD and confidence (null for formula).
 */
public record EnergyBase(BigDecimal bmr, BigDecimal neatBaselineKcal, String baseSource, Integer formulaBaseKcal,
                         Integer sdKcal, String confidence) {

    public static final String SOURCE_FORMULA = "formula";
    public static final String SOURCE_LEARNED = "learned";

    /** A formula-sourced base (BMR × NEAT is the Alap). */
    public EnergyBase(BigDecimal bmr, BigDecimal neatBaselineKcal) {
        this(bmr, neatBaselineKcal, SOURCE_FORMULA, round(neatBaselineKcal), null, null);
    }

    public static EnergyBase of(TdeeBootstrapJson b) {
        if (b == null || b.bmr() == null || b.neatBaselineKcal() == null) {
            return null;
        }
        if (!b.learned()) {
            return new EnergyBase(b.bmr(), b.neatBaselineKcal());
        }
        BigDecimal formula = b.formulaNeatBaselineKcal() != null ? b.formulaNeatBaselineKcal() : b.neatBaselineKcal();
        return new EnergyBase(b.bmr(), b.neatBaselineKcal(), SOURCE_LEARNED, round(formula),
            b.learnedSdKcal(), b.learnedConfidence());
    }

    private static Integer round(BigDecimal v) {
        return v == null ? null : v.setScale(0, RoundingMode.HALF_UP).intValueExact();
    }
}
