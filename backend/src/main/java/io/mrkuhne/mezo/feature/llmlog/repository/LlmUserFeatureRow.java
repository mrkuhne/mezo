package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One user's feature rollup over {@code llm_log_history} (mezo-d5iy). Used both for a single
 * account's 30-day feature breakdown ({@link LlmLogRepository#aggregateByFeatureSinceForUser})
 * and as one cell of the admin cost matrix
 * ({@link LlmLogRepository#aggregateByUserAndFeatureSince}), where every distinct
 * {@code (userId, feature)} pair in the window becomes one row.
 *
 * <p>{@code userId} is {@code null} for background/cron calls (no {@code created_by}) — the
 * "Háttér" bucket in the cost matrix. ERROR-status calls are excluded entirely (failed calls are
 * not cost); a priced NULL among the remaining rows is counted into {@code unknownCalls} rather
 * than folded into {@code costUsd} as zero.
 *
 * @param userId the calling account, {@code null} for background/cron traffic
 * @param feature the feature slug
 * @param calls non-ERROR calls for this user and feature in the window
 * @param costUsd summed cost of the PRICED rows only, {@code null} when none is priced
 * @param unknownCalls non-ERROR calls whose {@code cost_usd} is null
 */
public record LlmUserFeatureRow(UUID userId, String feature, long calls, BigDecimal costUsd, long unknownCalls) {}
