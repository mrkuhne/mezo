package io.mrkuhne.mezo.feature.llmlog.context;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * The thread-bound context binding (mezo-2zyu). Pure ThreadLocal mechanics — no Spring needed.
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
}
