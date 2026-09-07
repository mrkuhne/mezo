package io.mrkuhne.mezo.techcore.security;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * The acting account on a thread that has NO request principal (mezo-qw37.3).
 *
 * <p>Cron jobs fan out over accounts and make LLM calls on the scheduler thread, where
 * {@code SecurityContextHolder} is empty; the audit log's {@code created_by} would stay null and
 * every per-account cost report would lump that traffic into the background bucket. The fan-out
 * (S6, {@code UserFanOut}) wraps each per-account iteration in {@link #runAs}, and
 * {@code LlmActorResolver} reads {@link #current()} when the JWT principal is absent.
 *
 * <p>Plain ThreadLocal, on purpose: the recorder resolves the actor on the CALLING thread before
 * the async audit hop, so no propagation into executors is needed. Nesting restores the previous
 * value; a throwing body still restores. Never leaks across threads.
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
     * This is the ONLY intended caller; keep it that way — a second one is a design smell, not a
     * reuse opportunity.
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
