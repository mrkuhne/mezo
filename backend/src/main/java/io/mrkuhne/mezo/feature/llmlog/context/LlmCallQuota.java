package io.mrkuhne.mezo.feature.llmlog.context;

import java.util.function.Supplier;

/** Optional bounded-work hook; llmlog knows no feature-specific counters or storage. */
public final class LlmCallQuota {
    public interface Scope {
        void charge(boolean smart);
        boolean canRun(boolean smart, int reserve);
        void verify();
        void refuse();
    }
    private static final ThreadLocal<Scope> CURRENT = new ThreadLocal<>();
    private LlmCallQuota() {}
    public static Scope capture() { return CURRENT.get(); }
    public static boolean canRun(boolean smart, int reserve) {
        return CURRENT.get() == null || CURRENT.get().canRun(smart, reserve);
    }
    public static void charge(boolean smart) {
        if (CURRENT.get() != null) CURRENT.get().charge(smart);
    }
    public static <T> T run(Scope scope, Supplier<T> body) {
        Scope previous = CURRENT.get();
        if (previous != null) return body.get();
        CURRENT.set(scope);
        try {
            T value = body.get();
            scope.verify();
            return value;
        } finally {
            CURRENT.remove();
        }
    }
}
