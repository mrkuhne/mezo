package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

/** No security context in a plain unit test — exactly the cron thread's situation. */
class LlmActorResolverTest {

    private final LlmActorResolver resolver = new LlmActorResolver();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void testCurrentActor_shouldBeNull_whenNoPrincipalAndNoContext() {
        assertThat(resolver.currentActor()).isNull();
    }

    @Test
    void testCurrentActor_shouldReadLlmActorContext_whenNoPrincipal() {
        UUID id = UUID.randomUUID();
        AtomicReference<UUID> seen = new AtomicReference<>();
        LlmActorContext.runAs(id, () -> seen.set(resolver.currentActor()));
        assertThat(seen.get()).isEqualTo(id);
        assertThat(resolver.currentActor()).isNull();
    }
}
