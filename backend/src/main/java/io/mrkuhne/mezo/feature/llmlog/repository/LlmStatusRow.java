package io.mrkuhne.mezo.feature.llmlog.repository;

import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import java.math.BigDecimal;

/**
 * Per-status slice of a period (mezo-uakh). The service folds these into the response totals, so
 * ONE grouped query yields the call count, the status split, the cost sum and the unpriced count.
 *
 * @param unpricedCount rows in this status whose {@code cost_usd} is null
 * @param promptTokens summed RAW prompt tokens — the cached slice is INSIDE this number, exactly as
 *     the providers report it
 * @param cachedTokens summed cache-read prompt tokens (mezo-ozri.5); a SUBSET of
 *     {@code promptTokens}, so the prompt-cache hit ratio is the quotient of the two. Unlike the
 *     cost these coalesce to 0: "no tokens reported" and "zero tokens" price the same, whereas a
 *     null cost is a genuine unknown.
 */
public record LlmStatusRow(CallStatus status, long callCount, BigDecimal costUsd, long unpricedCount,
                           long promptTokens, long cachedTokens) {}
