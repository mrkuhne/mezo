package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminUserResponse;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.ResetPasswordResponse;
import io.mrkuhne.mezo.api.dto.SetUserStatusRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** /api/admin/users (mezo-qw37.3): owner-only list, temp-password reset, enable/disable. */
class AdminUserIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/users";

    @Autowired private AppUserRepository appUserRepository;

    private UUID ownerId() {
        return appUserRepository.findByEmail("owner@mezo.local").orElseThrow().getId();
    }

    @Test
    void testUsers_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
        assertHasRequestError(postForBody(URI + "/" + anna.id() + "/reset-password", null, anna.headers(),
            HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
        assertHasRequestError(postForBody(URI + "/" + anna.id() + "/status", new SetUserStatusRequest("DISABLED"),
            anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
    }

    @Test
    void testListUsers_shouldListOwnerFirstThenRegistered_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        List<AdminUserResponse> users = getForList(URI, ownerAuthHeaders(), HttpStatus.OK, AdminUserResponse.class);

        assertThat(users.getFirst().getRole()).isEqualTo("OWNER");
        AdminUserResponse annaRow = users.stream().filter(u -> u.getId().equals(anna.id())).findFirst().orElseThrow();
        assertThat(annaRow.getName()).isEqualTo("Anna");
        assertThat(annaRow.getStatus()).isEqualTo("ACTIVE");
        assertThat(annaRow.getOnboardedAt()).isNull();
        assertThat(annaRow.getLastSeenAt()).isNull(); // registration mints a token but makes no protected call
    }

    @Test
    void testResetPassword_shouldInvalidateOldAndForceChange_whenOwner() throws InterruptedException {
        RegisteredUser anna = registerUser("Anna");
        // Same guard as AuthMeIT's changePassword revocation test: tokensValidFrom is truncated
        // to the second, so anna's pre-reset token must land in a strictly earlier UTC second
        // than the reset, or it would (correctly) survive as if it were the performing token.
        Thread.sleep(1100);
        ResetPasswordResponse reset = postForBody(URI + "/" + anna.id() + "/reset-password", null, ownerAuthHeaders(),
            HttpStatus.OK, ResetPasswordResponse.class);
        assertThat(reset.getTemporaryPassword()).hasSize(12).matches("[A-HJ-NP-Za-hj-km-np-z2-9]+");

        // registerUser's password is "teszt-jelszo-1" (S1 helper) — it must no longer log in
        assertHasRequestError(postForBody("/api/auth/login", new LoginRequest(anna.email(), "teszt-jelszo-1"), null,
            HttpStatus.UNAUTHORIZED, String.class), "AUTH_LOGIN_INVALID_CREDENTIALS");

        // Finding 1 (mezo-qw37.3 review): a stolen pre-reset token must not survive the reset —
        // otherwise the whole point of resetting a compromised account's password is defeated.
        String staleBody = getForBody("/api/auth/me", anna.headers(), HttpStatus.UNAUTHORIZED, String.class);
        assertHasRequestError(staleBody, "AUTH_TOKEN_MISSING");

        TokenResponse token = postForBody("/api/auth/login", new LoginRequest(anna.email(), reset.getTemporaryPassword()),
            null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.getToken());
        MeResponse me = getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class);
        assertThat(me.getMustChangePassword()).isTrue();
    }

    @Test
    void testResetPassword_shouldReturn404_whenUnknownUser() {
        assertHasRequestError(postForBody(URI + "/" + UUID.randomUUID() + "/reset-password", null, ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class), "ADMIN_USER_NOT_FOUND");
    }

    @Test
    void testSetStatus_shouldDisableAndReenable_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        postForBody(URI + "/" + anna.id() + "/status", new SetUserStatusRequest("DISABLED"), ownerAuthHeaders(),
            HttpStatus.NO_CONTENT, Void.class);
        assertThat(appUserRepository.findById(anna.id()).orElseThrow().getStatus()).isEqualTo(AppUserEntity.UserStatus.DISABLED);
        // the disabled account's still-valid JWT is rejected by CurrentUser on its next request (S1)
        assertHasRequestError(getForBody("/api/auth/me", anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_ACCOUNT_DISABLED");

        postForBody(URI + "/" + anna.id() + "/status", new SetUserStatusRequest("ACTIVE"), ownerAuthHeaders(),
            HttpStatus.NO_CONTENT, Void.class);
        getForBody("/api/auth/me", anna.headers(), HttpStatus.OK, MeResponse.class);
    }

    @Test
    void testSetStatus_shouldReturn409_whenOwnerTargetsSelf() {
        String body = postForBody(URI + "/" + ownerId() + "/status", new SetUserStatusRequest("DISABLED"), ownerAuthHeaders(),
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "ADMIN_SELF_STATUS");
        assertThat(appUserRepository.findById(ownerId()).orElseThrow().getStatus()).isEqualTo(AppUserEntity.UserStatus.ACTIVE);
    }

    @Test
    void testSetStatus_shouldReturn400_whenStatusUnknown() {
        RegisteredUser anna = registerUser("Anna");
        String body = postForBody(URI + "/" + anna.id() + "/status", new SetUserStatusRequest("BANNED"), ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "status", "VALIDATION_INVALID_VALUE");
    }
}
