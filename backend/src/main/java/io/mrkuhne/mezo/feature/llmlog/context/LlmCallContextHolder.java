package io.mrkuhne.mezo.feature.llmlog.context;

import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * Carries the ambient {@link LlmCallContext} from a call site down to the LLM adapter without
 * threading it through every port signature (mezo-2zyu). Thread-bound: the adapter reads it on the
 * SAME thread that made the call, before the record is handed to the async writer.
 *
 * <p>Always prefer {@link #runWith} — it guarantees the {@link #clear()} that keeps a pooled request
 * thread from leaking one feature's context into the next call.
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

    /** Runs {@code body} with {@code context} bound to this thread, clearing it even on failure. */
    public <T> T runWith(LlmCallContext context, Supplier<T> body) {
        set(context);
        try {
            return body.get();
        } finally {
            clear();
        }
    }
}
