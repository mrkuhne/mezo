package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ChangePasswordRequest;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.service.InviteService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class AuthMeIT extends ApiIntegrationTest {

    @Autowired private InviteService inviteService;
    @Autowired private AppUserRepository appUserRepository;

    private HttpHeaders registerFresh(String email) {
        UUID ownerId = appUserRepository.findByEmail("owner@mezo.local").orElseThrow().getId();
        String code = inviteService.create(ownerId, null, null).getCode();
        TokenResponse token = postForBody("/api/auth/register",
            new RegisterRequest(code, email, "titkos-jelszo-1", "Teszt"), null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.getToken());
        return headers;
    }

    @Test
    void testMe_shouldReturnOwnerShape_whenOwnerToken() {
        MeResponse me = getForBody("/api/auth/me", ownerAuthHeaders(), HttpStatus.OK, MeResponse.class);
        assertThat(me.getEmail()).isEqualTo("owner@mezo.local");
        assertThat(me.getRole()).isEqualTo("OWNER");
        assertThat(me.getOnboarded()).isTrue();
        assertThat(me.getMustChangePassword()).isFalse();
        assertThat(me.getTimezone()).isEqualTo("Europe/Budapest");
    }

    @Test
    void testMe_shouldReturn401_whenNoToken() {
        getForBody("/api/auth/me", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testChangePassword_shouldSwapCredentialAndClearFlag_whenCurrentCorrect() {
        HttpHeaders headers = registerFresh("pw@test.local");
        AppUserEntity user = appUserRepository.findByEmail("pw@test.local").orElseThrow();
        user.setMustChangePassword(true);
        appUserRepository.saveAndFlush(user);
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getMustChangePassword()).isTrue();

        postForBody("/api/auth/change-password", new ChangePasswordRequest("titkos-jelszo-1", "uj-jelszo-2026"),
            headers, HttpStatus.NO_CONTENT, Void.class);

        postForBody("/api/auth/login", new LoginRequest("pw@test.local", "titkos-jelszo-1"), null, HttpStatus.UNAUTHORIZED, String.class);
        postForBody("/api/auth/login", new LoginRequest("pw@test.local", "uj-jelszo-2026"), null, HttpStatus.OK, TokenResponse.class);
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getMustChangePassword()).isFalse();
    }

    @Test
    void testChangePassword_shouldReturn401_whenCurrentWrong() {
        HttpHeaders headers = registerFresh("pw2@test.local");
        String body = postForBody("/api/auth/change-password", new ChangePasswordRequest("rossz", "uj-jelszo-2026"),
            headers, HttpStatus.UNAUTHORIZED, String.class);
        assertHasRequestError(body, "AUTH_LOGIN_INVALID_CREDENTIALS");
    }

    @Test
    void testCompleteOnboarding_shouldFlipOnboarded_whenCalled() {
        HttpHeaders headers = registerFresh("ob@test.local");
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getOnboarded()).isFalse();
        postForBody("/api/auth/onboarding-complete", null, headers, HttpStatus.NO_CONTENT, Void.class);
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getOnboarded()).isTrue();
    }
}
