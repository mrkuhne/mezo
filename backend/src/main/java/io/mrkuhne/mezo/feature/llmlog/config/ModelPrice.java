package io.mrkuhne.mezo.feature.llmlog.config;

import java.math.BigDecimal;

/**
 * Unit prices for ONE served model — USD per 1M tokens (generation) / per 1M characters (embedding).
 *
 * <p>Every component is nullable on purpose: a generation model carries no
 * {@code embedPerMillionChars}, an embedding model carries none of the token prices. A missing
 * component prices that category at zero (see {@code LlmPricingService.perMillion}).
 */
public record ModelPrice(BigDecimal inputPerMillion, BigDecimal outputPerMillion,
                         BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion,
                         BigDecimal embedPerMillionChars) {}
