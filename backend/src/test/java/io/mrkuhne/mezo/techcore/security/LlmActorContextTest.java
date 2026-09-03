package io.mrkuhne.mezo.techcore.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class LlmActorContextTest {

    @Test
    void testCurrent_shouldBeNull_whenOutsideRunAs() {
        assertThat(LlmActorContext.current()).isNull();
    }

    @Test
    void testRunAs_shouldExposeActorInsideAndRestoreAfter_whenNested() {
        UUID outer = UUID.randomUUID();
        UUID inner = UUID.randomUUID();
        AtomicReference<UUID> seenInner = new AtomicReference<>();
        AtomicReference<UUID> seenAfterInner = new AtomicReference<>();

        LlmActorContext.runAs(outer, () -> {
            LlmActorContext.runAs(inner, () -> seenInner.set(LlmActorContext.current()));
            seenAfterInner.set(LlmActorContext.current());
        });

        assertThat(seenInner.get()).isEqualTo(inner);
        assertThat(seenAfterInner.get()).isEqualTo(outer);
        assertThat(LlmActorContext.current()).isNull();
    }

    @Test
    void testRunAs_shouldClear_whenBodyThrows() {
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> LlmActorContext.runAs(id, () -> { throw new IllegalStateException("boom"); }))
            .isInstanceOf(IllegalStateException.class);
        assertThat(LlmActorContext.current()).isNull();
    }

    @Test
    void testRunAs_shouldNotLeakAcrossThreads_whenSet() throws InterruptedException {
        UUID id = UUID.randomUUID();
        AtomicReference<UUID> seenOnOtherThread = new AtomicReference<>(id);
        LlmActorContext.runAs(id, () -> {
            Thread t = new Thread(() -> seenOnOtherThread.set(LlmActorContext.current()));
            t.start();
            try { t.join(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
        assertThat(seenOnOtherThread.get()).isNull();
    }
}
