package io.mrkuhne.mezo.feature.llmlog.context;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * The thread-bound context binding (mezo-2zyu). Pure ThreadLocal mechanics — no Spring needed.
 *
 * <p>Since mezo-ozri.6 it is also the per-user USD cap's enforcement point, so the same nesting
 * discipline now has to hold for the resolved budget level as well.
 *
 * <p>The interesting case is NESTING: {@link LlmCallContextHolder#runWith} must SAVE and RESTORE the
 * previous binding, not blanket-clear it, or an inner tagged call would strip the outer feature and
 * every later call in the outer scope would record under {@code unknown}.
 */
class LlmCallContextHolderTest {

    private static final LlmCallContext OUTER = new LlmCallContext("outer_feature", "outer_op", null, null);
    private static final LlmCallContext INNER = new LlmCallContext("inner_feature", "inner_op", null, null);

    private final LlmCallContextHolder holder = new LlmCallContextHolder();

    @AfterEach
    void clearBinding() {
        holder.clear();
    }

    @Test
    void testGet_shouldReportUnknown_whenNothingBound() {
        assertThat(holder.get()).isEqualTo(LlmCallContext.UNKNOWN);
    }

    @Test
    void testRunWith_shouldRestoreOuterContext_whenNested() {
        LlmCallContext duringInner = holder.runWith(OUTER, () -> {
            assertThat(holder.get()).isEqualTo(OUTER);

            LlmCallContext seen = holder.runWith(INNER, holder::get);

            assertThat(holder.get()).isEqualTo(OUTER);
            return seen;
        });

        assertThat(duringInner).isEqualTo(INNER);
        assertThat(holder.get()).isEqualTo(LlmCallContext.UNKNOWN);
    }

    @Test
    void testRunWith_shouldRestoreOuterContext_whenInnerThrows() {
        holder.runWith(OUTER, () -> {
            assertThatThrownBy(() -> holder.runWith(INNER, () -> {
                throw new IllegalStateException("boom");
            })).isInstanceOf(IllegalStateException.class);

            assertThat(holder.get()).isEqualTo(OUTER);
            return null;
        });

        assertThat(holder.get()).isEqualTo(LlmCallContext.UNKNOWN);
    }

    @Test
    void testRunWith_shouldUnbindThread_whenTopLevelScopeEnds() {
        holder.runWith(OUTER, () -> null);

        assertThat(holder.get()).isEqualTo(LlmCallContext.UNKNOWN);
    }

    /**
     * The cap's whole enforcement contract sits in runWith (mezo-ozri.6, spec §C2): the one place
     * where the feature slug is known and the provider has NOT been called yet.
     */
    @Test
    void testRunWith_shouldRefuseTheCall_whenTheBudgetIsExhausted() {
        LlmCallContextHolder stopped = new LlmCallContextHolder(new LlmBudgetGate() {
            @Override
            public LlmBudgetLevel levelFor(String feature) {
                return LlmBudgetLevel.STOPPED;
            }
        });
        AtomicInteger bodyRuns = new AtomicInteger();

        assertThatThrownBy(() -> stopped.runWith(OUTER, () -> {
            bodyRuns.incrementAndGet();
            return "answer";
        })).isInstanceOf(SystemRuntimeErrorException.class);

        assertThat(bodyRuns.get()).isZero();                        // pre-flight: nothing was sent
        assertThat(stopped.get()).isEqualTo(LlmCallContext.UNKNOWN); // and the thread is left clean
    }

    /** The throttle step suspends only the features config names — the user's own turn goes on. */
    @Test
    void testRunWith_shouldRefuseOnlyThrottledFeatures_whenThrottled() {
        LlmCallContextHolder throttled = new LlmCallContextHolder(new LlmBudgetGate() {
            @Override
            public LlmBudgetLevel levelFor(String feature) {
                return LlmBudgetLevel.THROTTLED;
            }

            @Override
            public boolean isThrottled(String feature) {
                return "inner_feature".equals(feature);
            }
        });

        assertThatThrownBy(() -> throttled.runWith(INNER, () -> "generated"))
            .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(throttled.runWith(OUTER, () -> "answered")).isEqualTo("answered");
    }

    /** DEGRADED is a ROUTING decision, not a refusal — the call still goes out, on a cheaper model. */
    @Test
    void testRunWith_shouldRunTheBodyAndBindTheLevel_whenDegraded() {
        LlmCallContextHolder degraded = new LlmCallContextHolder(new LlmBudgetGate() {
            @Override
            public LlmBudgetLevel levelFor(String feature) {
                return LlmBudgetLevel.DEGRADED;
            }
        });

        LlmBudgetLevel seen = degraded.runWith(OUTER, degraded::budgetLevel);

        assertThat(seen).isEqualTo(LlmBudgetLevel.DEGRADED);
        assertThat(degraded.budgetLevel()).isEqualTo(LlmBudgetLevel.OK); // unbound again
    }

    /**
     * The bound level must nest exactly like the context does, or an inner scope's level would leak
     * into the outer one and the model router would silently route the rest of the outer operation
     * on the wrong tier.
     */
    @Test
    void testRunWith_shouldRestoreTheOuterLevel_whenNested() {
        LlmCallContextHolder nesting = new LlmCallContextHolder(new LlmBudgetGate() {
            @Override
            public LlmBudgetLevel levelFor(String feature) {
                return "inner_feature".equals(feature) ? LlmBudgetLevel.OK : LlmBudgetLevel.DEGRADED;
            }
        });

        nesting.runWith(OUTER, () -> {
            assertThat(nesting.budgetLevel()).isEqualTo(LlmBudgetLevel.DEGRADED);
            assertThat(nesting.runWith(INNER, nesting::budgetLevel)).isEqualTo(LlmBudgetLevel.OK);
            assertThat(nesting.budgetLevel()).isEqualTo(LlmBudgetLevel.DEGRADED);
            return null;
        });

        assertThat(nesting.budgetLevel()).isEqualTo(LlmBudgetLevel.OK);
    }

    /** An untagged thread has no level either — budgetLevel() must never be null. */
    @Test
    void testBudgetLevel_shouldReportOk_whenNothingIsBound() {
        assertThat(holder.budgetLevel()).isEqualTo(LlmBudgetLevel.OK);
    }
}
