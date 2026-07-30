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
 * On an ERROR record, PROVIDER-reported usage and cost are absent (null) — {@link #tokens} and the
 * billable char count in particular — but REQUEST-side counters (image counts, embedding batch size
 * and dimensions) DO survive, because they are facts of the attempt, not something the provider had
 * to answer. Usage/cost aggregates must therefore filter {@code status = SUCCESS}.
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
