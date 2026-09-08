package io.mrkuhne.mezo.techcore.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * mezo-ozri.7: a pooled task has neither a security context nor the caller's ThreadLocals, so the
 * actor must be resolved on the SUBMITTING thread and re-bound inside the task. These are the
 * precedence and restore guarantees the three memory-platform hops rely on.
 */
class LlmActorContextCaptureTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private static void authenticateAs(UUID principalId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
            .header("alg", "none")
            .subject(principalId.toString())
            .issuedAt(Instant.now().minusSeconds(60))
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
        SecurityContextHolder.getContext()
            .setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }

    @Test
    void testCapture_shouldReturnNull_whenTheThreadHasNoActorAtAll() {
        assertThat(LlmActorContext.capture()).isNull();
    }

    @Test
    void testCapture_shouldReturnTheJwtSubject_whenARequestPrincipalIsPresent() {
        UUID principal = UUID.randomUUID();
        authenticateAs(principal);

        assertThat(LlmActorContext.capture()).isEqualTo(principal);
    }

    @Test
    void testCapture_shouldPreferTheOverride_whenBothAnOverrideAndAPrincipalArePresent() {
        UUID principal = UUID.randomUUID();
        UUID inspected = UUID.randomUUID();
        authenticateAs(principal);

        UUID captured = LlmActorContext.runAsOverride(inspected, LlmActorContext::capture);

        assertThat(captured).isEqualTo(inspected);
    }

    @Test
    void testCapture_shouldFallBackToTheThreadBoundActor_whenThereIsNoPrincipal() {
        UUID cronUser = UUID.randomUUID();
        AtomicReference<UUID> seen = new AtomicReference<>();

        LlmActorContext.runAs(cronUser, () -> seen.set(LlmActorContext.capture()));

        assertThat(seen.get()).isEqualTo(cronUser);
    }

    @Test
    void testRunAsCaptured_shouldMakeTheCapturedActorVisibleToCapture_whenReBoundOnAnotherThread()
            throws Exception {
        UUID principal = UUID.randomUUID();
        authenticateAs(principal);
        UUID captured = LlmActorContext.capture();
        AtomicReference<UUID> seenOnWorker = new AtomicReference<>();

        Thread worker = new Thread(() ->
            LlmActorContext.runAsCaptured(captured, () -> seenOnWorker.set(LlmActorContext.capture())));
        worker.start();
        worker.join();

        assertThat(seenOnWorker.get()).isEqualTo(principal);
    }

    @Test
    void testRunAsCaptured_shouldRunTheBodyUnbound_whenTheCaptureIsNull() {
        UUID result = LlmActorContext.runAsCaptured(null, LlmActorContext::capture);

        assertThat(result).isNull();
    }

    @Test
    void testRunAsCaptured_shouldRestoreThePreviousBinding_whenTheBodyThrows() {
        UUID outer = UUID.randomUUID();

        UUID observed = LlmActorContext.runAsCaptured(outer, () -> {
            try {
                LlmActorContext.runAsCaptured(UUID.randomUUID(), () -> {
                    throw new IllegalStateException("boom");
                });
            } catch (IllegalStateException expected) {
                // the finally in runAsCaptured must have restored the outer binding
            }
            return LlmActorContext.capture();
        });

        assertThat(observed).isEqualTo(outer);
    }
}
