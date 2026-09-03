package io.mrkuhne.mezo.feature.lifegoal.engine;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/** A forrás-ablak: napi értékek; targets CSAK a weight_goal forrásnál nem null (expected ütemvonal). */
public record SignalWindow(Map<LocalDate, BigDecimal> values, Map<LocalDate, BigDecimal> targets) {
    public static SignalWindow of(Map<LocalDate, BigDecimal> values) {
        return new SignalWindow(values, null);
    }
}
