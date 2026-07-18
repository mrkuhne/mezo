package io.mrkuhne.mezo.feature.meal.service;

import java.math.BigDecimal;
import org.springframework.stereotype.Component;

/**
 * Deterministic confidence score for AI-estimated meal lines (mezo-78rn, mirror of
 * {@link io.mrkuhne.mezo.feature.pantry.service.ScrapeDraftValidator}). Starts at 1.0:
 * missing macro -0.3; Atwater (4P+4C+9F) off by &gt;30% vs kcal -0.4; per-portion kcal outside
 * [0, 3000] -0.2. Clamped at 0. The LLM never supplies confidence — it is derived here, testably.
 */
@Component
public class MealAiDraftValidator {

    public double confidence(BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG) {
        // Accumulate the penalty and subtract ONCE — subtracting inline (1.0-0.3-0.2) compounds
        // IEEE754 rounding into 0.49999999999999994, whereas 1.0-(0.3+0.2) is exactly 0.5.
        double penalty = 0.0;
        if (proteinG == null || carbsG == null || fatG == null) {
            penalty += 0.3;
        } else if (kcal != null && kcal.doubleValue() > 0) {
            double atwater = 4 * proteinG.doubleValue() + 4 * carbsG.doubleValue() + 9 * fatG.doubleValue();
            if (Math.abs(kcal.doubleValue() - atwater) / kcal.doubleValue() > 0.30) {
                penalty += 0.4;
            }
        }
        if (kcal != null && (kcal.doubleValue() < 0 || kcal.doubleValue() > 3000)) {
            penalty += 0.2;
        }
        return Math.max(0.0, 1.0 - penalty);
    }
}
