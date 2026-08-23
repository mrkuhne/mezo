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
 * to answer. A CANCELLED record (mezo-1rz9) sits between the two: usage is whatever the stream
 * revealed before the client disconnected — typically null, but a completed tool round's tally IS
 * kept, because the provider billed it. Usage/cost aggregates therefore filter on
 * {@code status <> 'ERROR'} semantics: an ERROR row never carries provider usage, a CANCELLED row
 * may.
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
    /** mezo-8z79: the provider's finish reason for the final generation (STOP / MAX_TOKENS /
     *  SAFETY / ...). Null when none was reported or the call never produced a generation. */
    String finishReason,
    TokenUsage tokens,
    EmbedUsage embed,
    String systemPrompt,
    /** mezo-q71s: rendered prior chat turns (see {@code ChatHistory.render}) for the CHAT/TOOL/
     *  CHAT_STREAM call kinds. A history-less generation call of one of those kinds — a one-shot
     *  pipeline (fact extraction, daily summary, activity classification, ...) or the first turn
     *  of a conversation — still renders to {@code ""} (empty string), NOT null: the port
     *  deliberately collapses "no history argument" into "empty history" at every one of those
     *  call sites. Null is reserved for the call kinds that never carry a conversation at all
     *  (SMART, VISION, TRANSCRIBE). So {@code conversationHistory IS NULL} does NOT mean "this was
     *  a non-chat call" — it means the call kind has no concept of conversation history. */
    String conversationHistory,
    String userMessage,
    String responseText,
    Integer imageCount,
    Long imageBytesTotal,
    String imageMime,
    LlmCallContext context) {}
