package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import java.math.BigDecimal;

/** The goal snapshot's resting side of the equation: the BMR floor and BMR × NEAT ("Alap"). */
public record EnergyBase(BigDecimal bmr, BigDecimal neatBaselineKcal) {
    public static EnergyBase of(TdeeBootstrapJson b) {
        return b == null || b.bmr() == null || b.neatBaselineKcal() == null ? null : new EnergyBase(b.bmr(), b.neatBaselineKcal());
    }
}
