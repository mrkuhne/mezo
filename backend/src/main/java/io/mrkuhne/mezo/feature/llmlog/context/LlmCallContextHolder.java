package io.mrkuhne.mezo.feature.llmlog.context;

import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * Carries the ambient {@link LlmCallContext} from a call site down to the LLM adapter without
 * threading it through every port signature (mezo-2zyu). Thread-bound: the adapter reads it on the
 * SAME thread that made the call, before the record is handed to the async writer.
 *
 * <p>Always prefer {@link #runWith} — it guarantees the unbind that keeps a pooled request thread
 * from leaking one feature's context into the next call.
 */
@Component
public class LlmCallContextHolder {

    private static final ThreadLocal<LlmCallContext> CONTEXT = new ThreadLocal<>();

    public void set(LlmCallContext context) {
        CONTEXT.set(context);
    }

    /** Never null: an unset thread reports {@link LlmCallContext#UNKNOWN}. */
    public LlmCallContext get() {
        LlmCallContext context = CONTEXT.get();
        return context != null ? context : LlmCallContext.UNKNOWN;
    }

    public void clear() {
        CONTEXT.remove();
    }

    /**
     * Runs {@code body} with {@code context} bound to this thread, restoring the PREVIOUS binding on
     * the way out (even on failure).
     *
     * <p>Save+restore, not blanket clear: a nested {@code runWith} (an outer tagged operation calling
     * into an inner one on the same thread) would otherwise unbind the outer context when the inner
     * returns, and every subsequent call in the outer scope would silently record under the wrong
     * feature. Restoring null degrades to a clear, so the top-level scope still leaves the pooled
     * thread clean.
     */
    public <T> T runWith(LlmCallContext context, Supplier<T> body) {
        LlmCallContext previous = CONTEXT.get();
        set(context);
        try {
            return body.get();
        } finally {
            if (previous != null) {
                set(previous);
            } else {
                clear();
            }
        }
    }
}
