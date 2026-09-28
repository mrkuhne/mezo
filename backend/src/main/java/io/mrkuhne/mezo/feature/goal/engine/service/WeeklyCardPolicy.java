package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;

/**
 * Card worthiness (mezo-3n2so, spec §5.1): a reviewed week only earns the weekly-summary dot/sheet
 * (or a bell item) when it actually says something — the base moved, a day was excluded, or the
 * week is holding (too little data to anchor on). Shared, pure, so the read side and the bell agree.
 */
public final class WeeklyCardPolicy {

    private WeeklyCardPolicy() {
    }

    public static boolean worthSaying(ExpenditureEstimateEntity row) {
        return row.getStepKcal() != 0 || !row.getExcludedDays().isEmpty() || "HOLDING".equals(row.getStatus());
    }
}
