package io.mrkuhne.mezo.feature.companion.memory.dto;

/** Consumer-specific retrieval policy selected at the memory-platform boundary. */
public enum ConsumerPolicy {
    CHAT_AMBIENT(null),
    MORNING_BRIEFING(null),
    WEEKLY_MEMOIR(null),
    PREDICTION_EVIDENCE(null),
    /** Reflexió S3 (bd mezo-eq85.3): the OFFLINE nightly reflection — deeper candidate pool, its
     *  own token budget, reranker allowed. No latency gate: nobody is waiting for the answer. */
    REFLECTION(null),
    /** Memória mindenhol S7 (bd mezo-eq85.7): "find similar past days" style episodic recall.
     *  The ONLY kind-scoped policy: "hasonló NAPOK" means nightly summaries and nothing else. */
    SIMILAR_DAYS("daily_summary"),
    /** Memória mindenhol S7: character-evidence retrieval backing a proposal/observation. */
    CHARACTER_EVIDENCE(null),
    /** Memória mindenhol S7: post-turn fact-extraction's own retrieval, kept lean and cheap. */
    EXTRACTION(null),
    /** Memória mindenhol S7: personal-context retrieval for a non-chat, non-reflection surface. */
    PERSONAL_CONTEXT(null);

    /** {@code memory_item.source_kind} of a nightly summary — the literal used platform-wide
     *  (MemoryCandidateFusion, MemorySourceRepairQuery). Repeated verbatim on SIMILAR_DAYS above
     *  because an enum constant may not textually forward-reference a static field. */
    public static final String SOURCE_KIND_DAILY_SUMMARY = "daily_summary";

    private final String scopedSourceKind;

    ConsumerPolicy(String scopedSourceKind) {
        this.scopedSourceKind = scopedSourceKind;
    }

    /**
     * The single {@code memory_item.source_kind} this policy is allowed to retrieve, or
     * {@code null} for an unscoped policy (mezo-eq85.10 fix round 1, FIX 1).
     *
     * <p>Scoping the RETRIEVAL, not just the mapping, is the whole point: the fused rank is
     * truncated to the policy's token budget by {@code MemoryContextSelector} long before a
     * caller-side filter runs, so non-day hits — in production overwhelmingly {@code chat_turn} —
     * would spend the budget and the search would honestly-looking return nothing while the
     * matching day sat in the store. Derived from the policy rather than passed on
     * {@code MemoryRequest} so a call site cannot forget it or misuse it.
     */
    public String scopedSourceKind() {
        return scopedSourceKind;
    }
}
