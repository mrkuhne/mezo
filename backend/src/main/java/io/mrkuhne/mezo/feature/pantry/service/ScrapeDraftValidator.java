package io.mrkuhne.mezo.feature.pantry.service;

import java.math.BigDecimal;
import org.springframework.stereotype.Component;

/**
 * Deterministic plausibility scoring for an extracted draft (mezo-8vum): starts at 1.0,
 * subtracts for missing macros and Atwater inconsistency (kcal vs 4P+4C+9F beyond 30%).
 * No LLM self-assessment — testable, explainable.
 */
@Component
public class ScrapeDraftValidator {

    public double confidence(ScrapeExtractionService.ExtractedDraft d) {
        double score = 1.0;
        if (d.proteinG() == null || d.carbsG() == null || d.fatG() == null) {
            score -= 0.3;
        } else if (d.kcal() != null) {
            double atwater = d.proteinG().doubleValue() * 4
                + d.carbsG().doubleValue() * 4 + d.fatG().doubleValue() * 9;
            double kcal = d.kcal().doubleValue();
            if (kcal > 0 && Math.abs(kcal - atwater) / kcal > 0.30) {
                score -= 0.4;
            }
        }
        if (d.nova() != null && (d.nova() < 1 || d.nova() > 4)) score -= 0.2;
        if (outOfRange(d.kcal(), 0, 900)) score -= 0.2;
        return Math.max(0.0, score);
    }

    private boolean outOfRange(BigDecimal v, double lo, double hi) {
        return v != null && (v.doubleValue() < lo || v.doubleValue() > hi);
    }
}
