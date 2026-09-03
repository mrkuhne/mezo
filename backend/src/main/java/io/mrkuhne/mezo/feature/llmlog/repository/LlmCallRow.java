package io.mrkuhne.mezo.feature.llmlog.repository;

import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One audit row as the LIST needs it (mezo-uakh) — metadata only. The payload columns
 * ({@code system_prompt}, {@code user_message}, {@code response_text}) are deliberately absent:
 * each can hold 64 000 characters, so they must not leave the database for a list of 50 rows.
 *
 * <p>The component order IS the {@code select new} order in
 * {@link LlmLogRepository#findCalls} — changing one without the other is a runtime failure.
 *
 * <p>{@code createdBy} (mezo-qw37.3) — the calling account, null for background rows.
 */
public record LlmCallRow(
    UUID id,
    UUID createdBy,
    Instant createdAt,
    String feature,
    String operation,
    CallKind callKind,
    CallStatus status,
    String requestedModel,
    String servedModel,
    int latencyMs,
    boolean streamed,
    Integer toolRounds,
    Integer totalTokens,
    Integer imageCount,
    Integer embedInputCount,
    Integer embedDimensions,
    BigDecimal costUsd,
    String errorClass,
    String errorCode) {}
