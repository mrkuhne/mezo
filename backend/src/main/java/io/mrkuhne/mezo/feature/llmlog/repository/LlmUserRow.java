package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Per-account rollup over {@code llm_log_history} (mezo-qw37.3). {@code userId == null} is the
 * background bucket (cron/stream rows with no principal); {@code name} is null there and for a
 * deleted account ({@code created_by} is {@code on delete set null}).
 */
public record LlmUserRow(UUID userId, String name, long callCount, long totalTokens, BigDecimal costUsd) {}
