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
}
