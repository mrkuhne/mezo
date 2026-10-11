package io.mrkuhne.mezo.feature.llmlog.context;

import java.util.UUID;

/**
 * WHY a call happened — the grouping axes of every cost report (mezo-2zyu). The LLM adapter knows
 * the model and the token counts but nothing about the caller; this is the ambient breadcrumb the
 * call site leaves behind (see {@link LlmCallContextHolder}).
 *
 * @param feature    call-site slug, the primary grouping axis (e.g. {@code companion_chat})
 * @param operation  finer-grained operation inside the feature (optional)
 * @param entityKind domain object the call was about (e.g. {@code meal}) — free-form, no FK
 * @param entityId   that object's id, when there is one
 */
public record LlmCallContext(String feature, String operation, String entityKind, UUID entityId) {

    /** The honest fallback when a call site left no breadcrumb — never a null feature (NOT NULL column). */
    public static final LlmCallContext UNKNOWN = new LlmCallContext("unknown", null, null, null);

    /**
     * The admin explorer's dry-run replay (mezo-4qyt). Lives HERE, in llmlog, on purpose: both
     * {@code feature/admin} (which binds it) and {@code feature/companion} (whose rewrite and
     * rerank helpers check for it) need the same string, and llmlog is the slice both already
     * depend on — putting it in {@code feature/admin} would create a {@code companion → admin}
     * edge and break {@code feature_slices_are_cycle_free}.
     */
    public static final String FEATURE_ADMIN_REPLAY = "admin_replay";

    /**
     * Memory recall's internal helper calls: the query embedding, the query rewriter and the
     * reranker. Shared for the same reason as {@link #FEATURE_ADMIN_REPLAY}: the call sites tag
     * with it and the output-language directive exempts it, so one renamed copy would silently
     * drop the exemption (mezo-n4wf5.11).
     */
    public static final String FEATURE_COMPANION_RECALL = "companion_recall";

    /** Document embedding for the memory store — vectors, never read by a person. */
    public static final String FEATURE_EMBED_MEMORY = "embed_memory";

    /** True when this context is the admin explorer's dry-run replay. */
    public boolean isAdminReplay() {
        return FEATURE_ADMIN_REPLAY.equals(feature);
    }
}
