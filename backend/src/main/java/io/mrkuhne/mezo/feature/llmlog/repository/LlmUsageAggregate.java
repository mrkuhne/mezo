package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;

/**
 * One rollup row over {@code llm_log_history} (mezo-h3gb) — the result of
 * {@link LlmLogRepository#aggregateSince(java.time.Instant)}.
 *
 * @param callCount every audited call in the period, regardless of {@code status} — an ERROR call
 *     was still a call that happened.
 * @param costUsd the summed {@code cost_usd} of the PRICED rows only, or {@code null} when the
 *     period holds no priced row at all. Null is kept as null on purpose: "cost unknown" is not
 *     "cost zero" — unpriced/failed/no-usage rows carry no cost, so the sum is always an estimate
 *     and must never be coalesced into a confident 0.
 */
public record LlmUsageAggregate(long callCount, BigDecimal costUsd) {}
