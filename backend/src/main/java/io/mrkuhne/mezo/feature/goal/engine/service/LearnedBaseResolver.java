package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Serves the learned base as Alap (mezo-zz91i, spec §5.6): when the user has an
 * {@code expenditure_estimate} row, its applied base replaces the formula's
 * {@code neatBaselineKcal} (re-railed against TODAY's formula, which can have moved since the row
 * was written, e.g. after a weigh-in) and {@code tdee} follows. The formula base is kept in
 * {@code formulaNeatBaselineKcal} — the learning run reads its prior from there, so the learned
 * base never compounds on itself. This is the ONE served-target rule: nothing else changes.
 */
@Service
@RequiredArgsConstructor
public class LearnedBaseResolver {

    static final String SOURCE_LEARNED = "learned";

    private final GoalEngineProperties props;
    private final ExpenditureEstimateRepository estimates;

    /**
     * @param formula the freshly computed formula bootstrap
     * @return the formula unchanged (disabled, no row, or an incomplete bootstrap), else the learned-base bootstrap
     */
    public TdeeBootstrapJson apply(UUID userId, TdeeBootstrapJson formula) {
        GoalEngineProperties.Expenditure e = props.expenditure();
        if (formula == null || formula.bmr() == null || formula.neatBaselineKcal() == null
            || e == null || !Boolean.TRUE.equals(e.enabled())) {
            return formula;
        }
        Optional<ExpenditureEstimateEntity> latest = estimates.findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(userId);
        if (latest.isEmpty() || latest.get().getAppliedBaseKcal() == null) {
            return formula;
        }
        ExpenditureEstimateEntity row = latest.get();
        int formulaBase = formula.neatBaselineKcal().setScale(0, RoundingMode.HALF_UP).intValueExact();
        int applied = ExpenditureStepPolicy.rails(row.getAppliedBaseKcal(), formulaBase, formula.bmr().doubleValue(), e);
        BigDecimal base = BigDecimal.valueOf(applied).setScale(formula.neatBaselineKcal().scale(), RoundingMode.HALF_UP);
        BigDecimal eat = formula.weeklyEatKcalPerDay() == null ? BigDecimal.ZERO : formula.weeklyEatKcalPerDay();
        return new TdeeBootstrapJson(
            formula.bmr(), formula.neat(), base, formula.weeklyEatKcalPerDay(), base.add(eat),
            formula.formula(), formula.computedAt(), formula.activityModel(),
            SOURCE_LEARNED, formula.neatBaselineKcal(), row.getPosteriorSdKcal(), row.getConfidence());
    }
}
