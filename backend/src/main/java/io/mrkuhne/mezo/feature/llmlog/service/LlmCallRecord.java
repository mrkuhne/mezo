package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import lombok.Builder;

/**
 * Everything the LLM adapter OBSERVED about one call (mezo-2zyu) — immutable, transport-only, and
 * deliberately free of any persistence or cost concern: the adapter reports, {@code LlmLogWriter}
 * interprets. The row's {@code feature}/{@code operation}/entity grouping comes from {@link #context},
 * not from a second copy on this record, so there is exactly one source for it.
 *
 * <p>The usage blocks are mutually exclusive by {@link CallKind}: a generation call fills
 * {@link #tokens}, an embedding call fills {@link #embed}, a vision call adds the image counters.
 * An ERROR record legitimately carries none of them.
 */
@Builder
public record LlmCallRecord(
    CallKind callKind,
    String requestedModel,
    String servedModel,
    CallStatus status,
    String errorCode,
    String errorClass,
    long latencyMs,
    boolean streamed,
    Integer toolRounds,
    String serviceTier,
    TokenUsage tokens,
    EmbedUsage embed,
    String systemPrompt,
    String userMessage,
    String responseText,
    Integer imageCount,
    Long imageBytesTotal,
    String imageMime,
    LlmCallContext context) {}
