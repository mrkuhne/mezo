package io.mrkuhne.mezo.feature.llmlog.context;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Carries the ambient {@link LlmCallContext} from a call site down to the LLM adapter without
 * threading it through every port signature (mezo-2zyu) and — since mezo-ozri.6 — enforces the
 * per-user USD cap. Thread-bound: the adapter reads it on the SAME thread that made the call,
 * before the record is handed to the async writer.
 *
 * <p>Always prefer {@link #runWith} — it guarantees the unbind that keeps a pooled request thread
 * from leaking one feature's context into the next call, and it is the ONLY place the budget is
 * checked (spec §C2). That is not a convenience: it is the single point every one of the 56 tagged
 * calls passes through with the feature slug already known and the provider not yet called, so a
 * refusal costs nothing and a degradation can still change which model answers.
 */
@Component
public class LlmCallContextHolder {

    private static final ThreadLocal<LlmCallContext> CONTEXT = new ThreadLocal<>();

    /** The budget level resolved for the innermost tagged scope — read by the model router. */
    private static final ThreadLocal<LlmBudgetLevel> BUDGET = new ThreadLocal<>();

    private final LlmBudgetGate llmBudgetGate;

    @Autowired
    public LlmCallContextHolder(LlmBudgetGate llmBudgetGate) {
        this.llmBudgetGate = llmBudgetGate;
    }

    /** The uncapped holder — for the unit tests that exercise TAGGING rather than spend. */
    public LlmCallContextHolder() {
        this(LlmBudgetGate.OPEN);
    }

    public void set(LlmCallContext context) {
        CONTEXT.set(context);
    }

    /** Never null: an unset thread reports {@link LlmCallContext#UNKNOWN}. */
    public LlmCallContext get() {
        LlmCallContext context = CONTEXT.get();
        return context != null ? context : LlmCallContext.UNKNOWN;
    }

    /**
     * The budget level of the enclosing tagged scope — never null, {@link LlmBudgetLevel#OK} off
     * one. Resolved ONCE in {@link #runWith} so the model router can degrade a call's model without
     * a second spend read (mezo-ozri.6).
     */
    public LlmBudgetLevel budgetLevel() {
        LlmBudgetLevel level = BUDGET.get();
        return level != null ? level : LlmBudgetLevel.OK;
    }

    public void clear() {
        CONTEXT.remove();
        BUDGET.remove();
    }

    /**
     * Runs {@code body} with {@code context} bound to this thread, restoring the PREVIOUS binding on
     * the way out (even on failure) — and refusing to run it at all when {@code context}'s feature
     * has spent through this account's ceiling (mezo-ozri.6).
     *
     * <p>Save+restore, not blanket clear: a nested {@code runWith} (an outer tagged operation calling
     * into an inner one on the same thread) would otherwise unbind the outer context when the inner
     * returns, and every subsequent call in the outer scope would silently record under the wrong
     * feature. Restoring null degrades to a clear, so the top-level scope still leaves the pooled
     * thread clean. The budget level is bound and restored in exact lockstep, for the same reason.
     *
     * <p>The refusal is thrown BEFORE the binding is installed: nothing was tagged, nothing was sent
     * and nothing is logged, because there is no call to attribute. Cron callers are unaffected by
     * the throw ({@code UserFanOut} isolates every user and every job keeps its own try/catch); a
     * request caller gets 429.
     */
    public <T> T runWith(LlmCallContext context, Supplier<T> body) {
        LlmBudgetLevel level = llmBudgetGate.levelFor(context.feature());
        refuseIfOverBudget(context.feature(), level);

        LlmCallContext previousContext = CONTEXT.get();
        LlmBudgetLevel previousLevel = BUDGET.get();
        set(context);
        BUDGET.set(level);
        try {
            return body.get();
        } finally {
            if (previousContext != null) {
                set(previousContext);
            } else {
                CONTEXT.remove();
            }
            if (previousLevel != null) {
                BUDGET.set(previousLevel);
            } else {
                BUDGET.remove();
            }
        }
    }

    /**
     * 429, not 402 or 503: the account is over its allowance for THIS window and the very same
     * request works again once the window rolls — which is what Too Many Requests means. The two
     * codes stay distinct on purpose; "your AI budget is spent" and "this background feature is
     * paused to protect what is left of it" are different things to tell a person.
     */
    private void refuseIfOverBudget(String feature, LlmBudgetLevel level) {
        if (level.atLeast(LlmBudgetLevel.STOPPED)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("LLM_BUDGET_EXHAUSTED").build(), HttpStatus.TOO_MANY_REQUESTS);
        }
        if (level.atLeast(LlmBudgetLevel.THROTTLED) && llmBudgetGate.isThrottled(feature)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("LLM_BUDGET_THROTTLED").build(), HttpStatus.TOO_MANY_REQUESTS);
        }
    }
}
