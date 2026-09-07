package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;

/**
 * One feature's rollup over {@code llm_log_history} for a single user (mezo-d5iy.5) — the
 * per-user counterpart of {@link LlmGroupRow}, scoped to one account and one 30-day window.
 * ERROR-status calls are excluded entirely (failed calls are not cost); a priced NULL among the
 * remaining rows is counted separately rather than folded into {@code costUsd} as zero.
 *
 * @param feature the feature slug
 * @param callCount non-ERROR calls for this user and feature in the window
 * @param costUsd summed cost of the PRICED rows only, {@code null} when none is priced
 * @param unknownCalls non-ERROR calls whose {@code cost_usd} is null
 */
public record LlmUserFeatureRow(String feature, long callCount, BigDecimal costUsd, long unknownCalls) {}
