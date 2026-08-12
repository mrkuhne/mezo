package io.mrkuhne.mezo.feature.llmlog.entity;

/**
 * What SHAPE of LLM call was made — the axis that decides which optional column block on
 * {@code llm_log_history} is populated (token counts vs. embedding counters vs. image counters).
 *
 * <p>Stored as text ({@code @Enumerated(STRING)}), so adding a kind is an append-only code change
 * with no migration.
 */
public enum CallKind {

    /** A single-shot generation turn. */
    CHAT,

    /** A streamed generation turn (SSE) — same billing, different latency semantics. */
    CHAT_STREAM,

    /** A generation turn carrying image parts (the image_* columns are filled). */
    VISION,

    /** A generation turn routed to the "smart"/thinking tier (thoughts_tokens is filled). */
    SMART,

    /** A generation turn that ran one or more tool rounds (tool_rounds is filled). */
    TOOL,

    /** A speech-to-text turn carrying one audio part (the media columns are filled). */
    TRANSCRIBE,

    /** Document-side embedding (indexing write path). */
    EMBED_DOC,

    /** Query-side embedding (recall read path). */
    EMBED_QUERY
}
