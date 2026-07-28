package io.mrkuhne.mezo.feature.llmlog.service;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * The unit prices FROZEN onto one logged LLM call (jsonb value object).
 *
 * <p>Costs are computed from this snapshot, not from the live config: a later rate change (or a
 * model dropped from the price list) must never rewrite what a historical call cost. {@code pricedOn}
 * records the day the rates were read.
 */
public record PricingSnapshot(String sourceModel, String currency,
                              BigDecimal inputPerMillion, BigDecimal outputPerMillion,
                              BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion,
                              BigDecimal embedPerMillionChars, LocalDate pricedOn) {}
