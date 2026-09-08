package io.mrkuhne.mezo.feature.llmlog.repository;

import java.time.Instant;
import java.util.UUID;

/**
 * One (feature, user) usage rollup over {@code llm_log_history} in a window (Funkciók scorecard
 * + detail, mezo-l096.3/.4) — the primitive behind the "who tried this feature" funnel questions.
 * ERROR-status calls are excluded entirely: uses = non-ERROR calls (same rule as everywhere else
 * cost/usage is summed).
 *
 * @param feature the feature slug
 * @param createdBy the calling account; {@code null} for background/cron traffic (never counted
 *     toward adoption/user funnels, per the admin ruling that cron traffic is not a user)
 * @param calls non-ERROR calls for this user and feature in the window
 * @param firstAt the earliest non-ERROR call in the window
 * @param lastAt the latest non-ERROR call in the window
 */
public record LlmFeatureUserRow(String feature, UUID createdBy, long calls, Instant firstAt, Instant lastAt) {}
