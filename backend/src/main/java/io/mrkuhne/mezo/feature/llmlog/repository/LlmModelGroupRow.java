package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;

/**
 * One served-model rollup bucket over {@code llm_log_history} (mezo-pfdv) — the breakdown's model-mix
 * table, which unlike the feature/user rollups also reports token sums.
 *
 * @param key the served model id; {@code null} for calls that never reached one (ERROR rows)
 * @param costUsd summed cost of the PRICED rows only, {@code null} when none is priced — kept null
 *     on purpose: "unknown" is not "free" (ADR 0014)
 * @param promptTokens summed raw prompt tokens over the group's rows; a row with no reported tokens
 *     contributes 0
 * @param totalTokens summed total tokens over the group's rows; a row with no reported tokens
 *     contributes 0
 */
public record LlmModelGroupRow(String key, long callCount, BigDecimal costUsd,
                               long promptTokens, long totalTokens) {}
