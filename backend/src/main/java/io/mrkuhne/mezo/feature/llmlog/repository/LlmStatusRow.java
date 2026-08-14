package io.mrkuhne.mezo.feature.llmlog.repository;

import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import java.math.BigDecimal;

/**
 * Per-status slice of a period (mezo-uakh). The service folds these into the response totals, so
 * ONE grouped query yields the call count, the status split, the cost sum and the unpriced count.
 *
 * @param unpricedCount rows in this status whose {@code cost_usd} is null
 */
public record LlmStatusRow(CallStatus status, long callCount, BigDecimal costUsd, long unpricedCount) {}
