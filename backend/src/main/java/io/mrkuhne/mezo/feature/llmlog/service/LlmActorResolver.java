package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * WHO made the LLM call — the audit log's {@code created_by} (mezo-2zyu).
 *
 * <p>Deliberately NOT {@code CurrentUserId}: that accessor throws {@code AUTH_TOKEN_MISSING} when
 * there is no principal, which is the right behavior for a user endpoint and the wrong one here.
 * Cron threads legitimately make LLM calls with no security context, and audit logging must never
 * be the thing that fails a call — so this reads the context defensively and returns null instead.
 * {@code llm_log_history.created_by} is nullable precisely for that case (single-user app, ADR 0008).
 * Unless the thread runs inside {@link LlmActorContext#runAs} (mezo-qw37.3), in which case that
 * account is the actor; a request principal always wins over the context.
 *
 * <p>Precedence, highest first (mezo-4qyt): {@link LlmActorContext#override()}, then the JWT
 * principal, then {@link LlmActorContext#current()}. The override tier carries the admin explorer's
 * dry-run replay (the caller is the owner, but the spend belongs to the inspected user) and, since
 * mezo-ozri.7, an actor captured on a submitting thread and re-bound inside a pooled task.
 *
 * <p>The rules themselves live in {@link LlmActorContext#capture()} and this class delegates to
 * them, so the memory platform's cross-thread capture and the recorder's own resolution are by
 * construction the same decision.
 */
@Component
public class LlmActorResolver {

    /** The authenticated user's id, or null on an unauthenticated/anonymous (cron) thread. */
    public UUID currentActor() {
        // mezo-ozri.7: the precedence rules moved to LlmActorContext so the cross-thread capture
        // used by the memory platform's pool hops cannot drift from what the recorder resolves.
        return LlmActorContext.capture();
    }
}
