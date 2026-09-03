package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

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

    @Test
    void testCurrentActor_shouldPreferPrincipal_whenBothPrincipalAndContextSet() {
        UUID principalId = UUID.randomUUID();
        UUID contextId = UUID.randomUUID();
        Jwt jwt = Jwt.withTokenValue("test-token")
            .header("alg", "none")
            .subject(principalId.toString())
            .issuedAt(Instant.now().minusSeconds(60))
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
        // Two-arg ctor: the one-arg JwtAuthenticationToken(Jwt) leaves isAuthenticated() false,
        // which is not what a real oauth2ResourceServer-authenticated request looks like.
        SecurityContextHolder.getContext()
            .setAuthentication(new JwtAuthenticationToken(jwt, java.util.List.of()));

        AtomicReference<UUID> seen = new AtomicReference<>();
        LlmActorContext.runAs(contextId, () -> seen.set(resolver.currentActor()));

        assertThat(seen.get()).isEqualTo(principalId);
    }
}
