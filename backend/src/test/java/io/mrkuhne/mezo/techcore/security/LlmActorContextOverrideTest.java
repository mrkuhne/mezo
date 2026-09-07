package io.mrkuhne.mezo.techcore.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.llmlog.service.LlmActorResolver;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** mezo-4qyt: the override outranks a request principal; nesting and throwing both restore. */
class LlmActorContextOverrideTest {

    private final LlmActorResolver resolver = new LlmActorResolver();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void testOverride_shouldWinOverJwtPrincipal_whenSet() {
        UUID principalId = UUID.randomUUID();
        UUID inspectedId = UUID.randomUUID();
        authenticateAs(principalId);

        UUID seen = LlmActorContext.runAsOverride(inspectedId, resolver::currentActor);

        assertThat(seen).isEqualTo(inspectedId);
        // Outside the scope the owner is the actor again — the override never leaks.
        assertThat(resolver.currentActor()).isEqualTo(principalId);
    }

    @Test
    void testOverride_shouldOutrankRunAs_whenBothSet() {
        UUID cronActor = UUID.randomUUID();
        UUID inspectedId = UUID.randomUUID();

        UUID[] seen = new UUID[1];
        LlmActorContext.runAs(cronActor, () ->
                seen[0] = LlmActorContext.runAsOverride(inspectedId, resolver::currentActor));

        assertThat(seen[0]).isEqualTo(inspectedId);
    }

    @Test
    void testOverride_shouldRestorePrevious_whenNested() {
        UUID outer = UUID.randomUUID();
        UUID inner = UUID.randomUUID();

        UUID afterInner = LlmActorContext.runAsOverride(outer, () -> {
            LlmActorContext.runAsOverride(inner, LlmActorContext::override);
            return LlmActorContext.override();
        });

        assertThat(afterInner).isEqualTo(outer);
        assertThat(LlmActorContext.override()).isNull();
    }

    @Test
    void testOverride_shouldRestorePrevious_whenBodyThrows() {
        UUID inspectedId = UUID.randomUUID();

        assertThatThrownBy(() -> LlmActorContext.runAsOverride(inspectedId, () -> {
            throw new IllegalStateException("boom");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(LlmActorContext.override()).isNull();
    }

    @Test
    void testOverride_shouldBeNull_whenNothingSetIt() {
        assertThat(LlmActorContext.override()).isNull();
        // With no override the pre-existing precedence is untouched: runAs, then the principal.
        UUID cronActor = UUID.randomUUID();
        UUID[] seen = new UUID[1];
        LlmActorContext.runAs(cronActor, () -> seen[0] = resolver.currentActor());
        assertThat(seen[0]).isEqualTo(cronActor);
    }

    private static void authenticateAs(UUID userId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject(userId.toString())
                .issuedAt(Instant.now().minusSeconds(60))
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }
}
