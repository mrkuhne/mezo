package io.mrkuhne.mezo.feature.companion.memory.dto;

/** Consumer-specific retrieval policy selected at the memory-platform boundary. */
public enum ConsumerPolicy {
    CHAT_AMBIENT,
    MORNING_BRIEFING,
    WEEKLY_MEMOIR,
    PREDICTION_EVIDENCE,
    /** Reflexió S3 (bd mezo-eq85.3): the OFFLINE nightly reflection — deeper candidate pool, its
     *  own token budget, reranker allowed. No latency gate: nobody is waiting for the answer. */
    REFLECTION
}
