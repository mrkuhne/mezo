package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

/**
 * Pure Mockito unit test — no Spring context. Covers the {@code register} race the
 * {@code existsByEmail} pre-check cannot: two inserts racing past that pre-check, where the
 * uq_app_user_email constraint fires only at the DB level as a {@link
 * DataIntegrityViolationException} on the save. Deterministic (no threads needed) by mocking
 * {@code existsByEmail} to say "free" while {@code saveAndFlush} throws anyway — exactly what a
 * concurrent second registration for the same email looks like from {@code AuthService}'s point
 * of view. See {@code AuthRegisterIT.testRegister_shouldReturn409_whenEmailRowInsertedDirectly}
 * for the common (pre-check-catches-it) path over real HTTP.
 */
class AuthServiceTest {

    private final AppUserRepository appUserRepository = mock(AppUserRepository.class);
    private final InviteService inviteService = mock(InviteService.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final JwtEncoder jwtEncoder = mock(JwtEncoder.class);

    private final AuthService authService =
        new AuthService(appUserRepository, inviteService, passwordEncoder, jwtEncoder);

    @Test
    void testRegister_shouldReturn409_whenSaveRacesPastPreCheck() {
        RegisterRequest req = new RegisterRequest("MEZO-AAAA-AAAA", "race@test.local", "titkos-jelszo-1", "Race");
        when(appUserRepository.existsByEmail("race@test.local")).thenReturn(false);
        when(passwordEncoder.encode("titkos-jelszo-1")).thenReturn("hashed");
        when(appUserRepository.saveAndFlush(any(AppUserEntity.class)))
            .thenThrow(new DataIntegrityViolationException("uq_app_user_email"));

        assertThatThrownBy(() -> authService.register(req))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> {
                SystemRuntimeErrorException sysEx = (SystemRuntimeErrorException) ex;
                assertThat(sysEx.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(sysEx.getMessages()).hasSize(1);
                assertThat(sysEx.getMessages().get(0).getCode()).isEqualTo("AUTH_EMAIL_TAKEN");
            });

        // The invite must NOT be consumed when the account insert itself failed.
        verify(inviteService, never()).consume(anyString(), any(UUID.class));
    }
}
