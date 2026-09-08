package io.mrkuhne.mezo.techcore.security;

import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * The acting account on a thread that has NO request principal (mezo-qw37.3).
 *
 * <p>Cron jobs fan out over accounts and make LLM calls on the scheduler thread, where
 * {@code SecurityContextHolder} is empty; the audit log's {@code created_by} would stay null and
 * every per-account cost report would lump that traffic into the background bucket. The fan-out
 * (S6, {@code UserFanOut}) wraps each per-account iteration in {@link #runAs}, and
 * {@code LlmActorResolver} reads {@link #current()} when the JWT principal is absent.
 *
 * <p>Plain ThreadLocal, on purpose: the recorder resolves the actor on the thread that reaches the
 * adapter. Where that thread is a POOL thread — the memory platform's three
 * {@code applicationTaskExecutor} hops — the submitter captures the actor with {@link #capture()}
 * and the task re-binds it with {@link #runAsCaptured} (mezo-ozri.7); nothing propagates
 * implicitly. Nesting restores the previous value; a throwing body still restores.
 */
public final class LlmActorContext {

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private static final ThreadLocal<UUID> OVERRIDE = new ThreadLocal<>();

    private LlmActorContext() {}

    /**
     * The account that OUTRANKS the request principal (mezo-4qyt) — null when nothing set it.
     *
     * <p>{@link #runAs} deliberately loses to a JWT principal: a cron thread has no principal, so
     * "principal wins" is right there. The admin explorer's dry-run replay is the opposite case:
     * the principal is the OWNER, but the embedding / rewrite / rerank calls are made ON BEHALF OF
     * the inspected user, and billing them to the owner would make the per-user cost matrix lie.
     * <p>Two callers bind this tier, and only two: the admin explorer's dry-run replay (above) and
     * {@link #runAsCaptured}, which re-binds an actor already resolved on a submitting thread. A
     * third one is a design smell, not a reuse opportunity.
     */
    public static UUID override() {
        return OVERRIDE.get();
    }

    /** Runs {@code body} with {@code userId} outranking any request principal, then restores. */
    public static <T> T runAsOverride(UUID userId, Supplier<T> body) {
        UUID previous = OVERRIDE.get();
        OVERRIDE.set(userId);
        try {
            return body.get();
        } finally {
            if (previous == null) {
                OVERRIDE.remove();
            } else {
                OVERRIDE.set(previous);
            }
        }
    }

    /**
     * The effective actor of THIS thread, for re-binding on a pool thread (mezo-ozri.7).
     *
     * <p>Same precedence as the audit recorder's own resolution — {@link #override()}, then the JWT
     * principal, then {@link #current()} — because it IS that resolution: {@code LlmActorResolver}
     * delegates here so the two can never drift apart. Returns null when the thread has no actor,
     * which is a legitimate state (an unauthenticated background thread) and never an error.
     *
     * <p>Why this exists: {@code applicationTaskExecutor} propagates neither the security context
     * nor these ThreadLocals, so an LLM call submitted to it resolves a null actor and its
     * {@code llm_log_history} row books against nobody. Capture on the submitting thread, re-bind
     * with {@link #runAsCaptured} inside the task.
     */
    public static UUID capture() {
        UUID override = OVERRIDE.get();
        if (override != null) {
            return override;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
            || !authentication.isAuthenticated()
            || !(authentication.getPrincipal() instanceof Jwt jwt)
            || jwt.getSubject() == null) {
            return CURRENT.get();
        }
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException ex) {
            return CURRENT.get(); // a non-UUID subject is not ours to reject here — the caller is already running
        }
    }

    /**
     * Re-binds a {@link #capture()}d actor for {@code body} on another thread, then restores.
     *
     * <p>Binds the OVERRIDE tier on purpose: a captured actor is a decision already made on the
     * submitting thread, so it must outrank anything the pool thread happens to carry (today:
     * nothing). A null capture is a plain call — the unauthenticated path stays allocation-free and
     * byte-identical to before.
     */
    public static <T> T runAsCaptured(UUID captured, Supplier<T> body) {
        return captured == null ? body.get() : runAsOverride(captured, body);
    }

    /** {@link #runAsCaptured(UUID, Supplier)} for a body with no return value. */
    public static void runAsCaptured(UUID captured, Runnable body) {
        runAsCaptured(captured, () -> {
            body.run();
            return null;
        });
    }

    /** The account the current thread acts for, or null when nothing set it. */
    public static UUID current() {
        return CURRENT.get();
    }

    /** Runs {@code body} with {@code userId} as the acting account, then restores the previous value. */
    public static void runAs(UUID userId, Runnable body) {
        UUID previous = CURRENT.get();
        CURRENT.set(userId);
        try {
            body.run();
        } finally {
            if (previous == null) {
                CURRENT.remove();
            } else {
                CURRENT.set(previous);
            }
        }
    }
}
