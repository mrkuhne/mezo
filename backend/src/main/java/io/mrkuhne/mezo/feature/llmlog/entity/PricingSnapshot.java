package io.mrkuhne.mezo.feature.llmlog.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * The unit prices FROZEN onto one logged LLM call — the typed jsonb value object stored in
 * {@link LlmLogEntity#getPricingSnapshot() llm_log_history.pricing_snapshot}.
 *
 * <p>It lives in the {@code entity} package (with every other jsonb-embedded value object in this
 * codebase) so the entity never has to reach into {@code service}; {@code LlmPricingService} is the
 * one that depends downward onto it.
 *
 * <p>Costs are computed from this snapshot, not from the live config: a later rate change (or a
 * model dropped from the price list) must never rewrite what a historical call cost. {@code pricedOn}
 * records the day the rates were read.
 */
public record PricingSnapshot(String sourceModel, String currency,
                              BigDecimal inputPerMillion, BigDecimal outputPerMillion,
                              BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion,
                              BigDecimal embedPerMillionChars, LocalDate pricedOn) {}
