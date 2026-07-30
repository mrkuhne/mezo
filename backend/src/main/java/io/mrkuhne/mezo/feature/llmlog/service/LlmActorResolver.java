package io.mrkuhne.mezo.feature.llmlog.service;

import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * WHO made the LLM call — the audit log's {@code created_by} (mezo-2zyu).
 *
 * <p>Deliberately NOT {@code CurrentUserId}: that accessor throws {@code AUTH_TOKEN_MISSING} when
 * there is no principal, which is the right behavior for a user endpoint and the wrong one here.
 * Cron threads legitimately make LLM calls with no security context, and audit logging must never
 * be the thing that fails a call — so this reads the context defensively and returns null instead.
 * {@code llm_log_history.created_by} is nullable precisely for that case (single-user app, ADR 0008).
 */
@Component
public class LlmActorResolver {

    /** The authenticated user's id, or null on an unauthenticated/anonymous (cron) thread. */
    public UUID currentActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
            || !authentication.isAuthenticated()
            || !(authentication.getPrincipal() instanceof Jwt jwt)
            || jwt.getSubject() == null) {
            return null;
        }
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException ex) {
            return null; // a non-UUID subject is not ours to reject here — the caller is already running
        }
    }
}
