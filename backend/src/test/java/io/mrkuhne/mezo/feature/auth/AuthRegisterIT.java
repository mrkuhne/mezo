package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.entity.InviteEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.repository.InviteRepository;
import io.mrkuhne.mezo.feature.auth.service.InviteService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class AuthRegisterIT extends ApiIntegrationTest {

    @Autowired private InviteService inviteService;
    @Autowired private InviteRepository inviteRepository;
    @Autowired private AppUserRepository appUserRepository;

    private UUID ownerId() {
        return appUserRepository.findByEmail("owner@mezo.local").orElseThrow().getId();
    }

    private RegisterRequest req(String code, String email) {
        return new RegisterRequest(code, email, "titkos-jelszo-1", "Béla");
    }

    @Test
    void testRegister_shouldCreateUserAndConsumeInvite_whenCodeValid() {
        InviteEntity invite = inviteService.create(ownerId(), "Béla", null);
        TokenResponse token = postForBody("/api/auth/register", req(invite.getCode(), "bela@test.local"),
            null, HttpStatus.OK, TokenResponse.class);
        assertThat(token.getToken()).isNotBlank();

        AppUserEntity user = appUserRepository.findByEmail("bela@test.local").orElseThrow();
        assertThat(user.getRole()).isEqualTo(AppUserEntity.UserRole.USER);
        assertThat(user.getStatus()).isEqualTo(AppUserEntity.UserStatus.ACTIVE);
        assertThat(user.isOnboarded()).isFalse();
        InviteEntity used = inviteRepository.findById(invite.getId()).orElseThrow();
        assertThat(used.getUsedBy()).isEqualTo(user.getId());
        assertThat(used.getUsedAt()).isNotNull();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.getToken());
        MeResponse me = getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class);
        assertThat(me.getEmail()).isEqualTo("bela@test.local");
        assertThat(me.getRole()).isEqualTo("USER");
        assertThat(me.getOnboarded()).isFalse();
    }

    @Test
    void testRegister_shouldLowercaseAndTrimCode_whenTyped() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        postForBody("/api/auth/register", req("  " + invite.getCode().toLowerCase() + " ", "kis@test.local"),
            null, HttpStatus.OK, TokenResponse.class);
    }

    @Test
    void testRegister_shouldReturn409_whenCodeUnknown() {
        String body = postForBody("/api/auth/register", req("MEZO-XXXX-XXXX", "x@test.local"),
            null, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "AUTH_INVITE_INVALID");
    }

    @Test
    void testRegister_shouldReturn409_whenCodeAlreadyUsed() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        postForBody("/api/auth/register", req(invite.getCode(), "first@test.local"), null, HttpStatus.OK, TokenResponse.class);
        String body = postForBody("/api/auth/register", req(invite.getCode(), "second@test.local"),
            null, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "AUTH_INVITE_INVALID");
        assertThat(appUserRepository.existsByEmail("second@test.local")).isFalse();
    }

    @Test
    void testRegister_shouldReturn409_whenCodeExpired() {
        InviteEntity invite = inviteService.create(ownerId(), null, Instant.now().minusSeconds(1));
        String body = postForBody("/api/auth/register", req(invite.getCode(), "late@test.local"),
            null, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "AUTH_INVITE_INVALID");
    }

    @Test
    void testRegister_shouldReturn409AndKeepInvite_whenEmailTaken() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        String body = postForBody("/api/auth/register", req(invite.getCode(), "owner@mezo.local"),
            null, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "AUTH_EMAIL_TAKEN");
        assertThat(inviteRepository.findById(invite.getId()).orElseThrow().isUsed()).isFalse();
    }

    @Test
    void testRegister_shouldReturn400_whenPasswordTooShort() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        String body = postForBody("/api/auth/register",
            new RegisterRequest(invite.getCode(), "short@test.local", "1234567", "Rövid"),
            null, HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "password", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testLogin_shouldReturn403_whenAccountDisabled() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        postForBody("/api/auth/register", req(invite.getCode(), "off@test.local"), null, HttpStatus.OK, TokenResponse.class);
        AppUserEntity user = appUserRepository.findByEmail("off@test.local").orElseThrow();
        user.setStatus(AppUserEntity.UserStatus.DISABLED);
        appUserRepository.saveAndFlush(user);
        String body = postForBody("/api/auth/login", new LoginRequest("off@test.local", "titkos-jelszo-1"),
            null, HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "AUTH_ACCOUNT_DISABLED");
    }
}
