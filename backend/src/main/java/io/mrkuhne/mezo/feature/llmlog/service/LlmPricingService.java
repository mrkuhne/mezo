package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.config.LlmPricingProperties;
import io.mrkuhne.mezo.feature.llmlog.config.ModelPrice;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Freezes the configured unit prices onto a call ({@link #snapshot}) and derives its cost from that
 * frozen snapshot — never from the live config, so historical costs stay stable across rate changes.
 *
 * <p>An unknown model yields a null snapshot (and null costs): honest "unpriced" beats a wrong number.
 */
@Service
@RequiredArgsConstructor
public class LlmPricingService {

    private static final BigDecimal MILLION = new BigDecimal("1000000");

    private final LlmPricingProperties pricing;

    /** Frozen unit prices for {@code servedModel} as of {@code on}; null when the model is unpriced. */
    public PricingSnapshot snapshot(String servedModel, LocalDate on) {
        ModelPrice p = servedModel == null ? null : pricing.models().get(servedModel);
        if (p == null) {
            return null;
        }
        return new PricingSnapshot(servedModel, pricing.currency(),
            p.inputPerMillion(), p.outputPerMillion(), p.thinkingPerMillion(), p.cachedPerMillion(),
            p.embedPerMillionChars(), on);
    }

    /**
     * Per-category token cost sum (prompt + candidates + thoughts + cached); null when unpriced.
     *
     * <p>{@code prompt} MUST already EXCLUDE {@code cached} (callers pass
     * {@code promptTokenCount - cachedContentTokenCount}); Gemini reports cached as a subset of
     * prompt, so charging prompt-full + cached-rate would 5x-overcharge the cached slice.
     */
    public BigDecimal computeGenerationCost(PricingSnapshot s, Integer prompt, Integer candidates,
                                            Integer thoughts, Integer cached) {
        if (s == null) {
            return null;
        }
        return perMillion(s.inputPerMillion(), prompt)
            .add(perMillion(s.outputPerMillion(), candidates))
            .add(perMillion(s.thinkingPerMillion(), thoughts))
            .add(perMillion(s.cachedPerMillion(), cached));
    }

    /** Embedding cost from billable characters; null when unpriced or the char count is unknown. */
    public BigDecimal computeEmbeddingCost(PricingSnapshot s, Integer billableChars) {
        if (s == null || billableChars == null) {
            return null;
        }
        return perMillion(s.embedPerMillionChars(), billableChars);
    }

    /**
     * unit * count / 1M. The divisor is a power of ten, so the quotient always terminates —
     * no rounding mode needed. A missing unit price or count contributes zero, not a failure.
     */
    private static BigDecimal perMillion(BigDecimal unit, Integer count) {
        if (unit == null || count == null) {
            return BigDecimal.ZERO;
        }
        return unit.multiply(BigDecimal.valueOf(count)).divide(MILLION);
    }
}
