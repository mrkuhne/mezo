package io.mrkuhne.mezo.feature.companion.memory.dto;

/** Consumer-specific retrieval policy selected at the memory-platform boundary. */
public enum ConsumerPolicy {
    CHAT_AMBIENT,
    MORNING_BRIEFING,
    WEEKLY_MEMOIR,
    PREDICTION_EVIDENCE,
    /** Reflexió S3 (bd mezo-eq85.3): the OFFLINE nightly reflection — deeper candidate pool, its
     *  own token budget, reranker allowed. No latency gate: nobody is waiting for the answer. */
    REFLECTION,
    /** Memória mindenhol S7 (bd mezo-eq85.7): "find similar past days" style episodic recall. */
    SIMILAR_DAYS,
    /** Memória mindenhol S7: character-evidence retrieval backing a proposal/observation. */
    CHARACTER_EVIDENCE,
    /** Memória mindenhol S7: post-turn fact-extraction's own retrieval, kept lean and cheap. */
    EXTRACTION,
    /** Memória mindenhol S7: personal-context retrieval for a non-chat, non-reflection surface. */
    PERSONAL_CONTEXT
}
