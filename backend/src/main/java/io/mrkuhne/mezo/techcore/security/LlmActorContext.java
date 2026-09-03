package io.mrkuhne.mezo.techcore.security;

import java.util.UUID;

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

    private LlmActorContext() {}

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
