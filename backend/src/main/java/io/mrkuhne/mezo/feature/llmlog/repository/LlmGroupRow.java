package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;

/**
 * One rollup bucket over {@code llm_log_history} (mezo-uakh) — a feature slug or a served model.
 *
 * @param key the grouping value; {@code null} for calls that never reached a model (ERROR rows)
 * @param costUsd summed cost of the PRICED rows only, {@code null} when none is priced — kept null
 *     on purpose: "unknown" is not "free" (ADR 0014)
 */
public record LlmGroupRow(String key, long callCount, BigDecimal costUsd) {}
