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

    /**
     * Review finding 2: same 72-BYTE BCrypt limit as registration, on the {@code newPassword}
     * field this time — 40 Hungarian accented characters (80 UTF-8 bytes) is contract-valid
     * ({@code maxLength: 72} CHARACTERS) but must be rejected as 400, not blow up the encoder.
     */
    @Test
    void testChangePassword_shouldReturn400_whenNewPasswordExceeds72Bytes() {
        HttpHeaders headers = registerFresh("pw3@test.local");
        String oversizedPassword = "á".repeat(40); // 40 chars (<= 72), 80 UTF-8 bytes (> 72)
        String body = postForBody("/api/auth/change-password",
            new ChangePasswordRequest("titkos-jelszo-1", oversizedPassword),
            headers, HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "newPassword", "VALIDATION_INVALID_VALUE");
        postForBody("/api/auth/login", new LoginRequest("pw3@test.local", "titkos-jelszo-1"),
            null, HttpStatus.OK, TokenResponse.class);
    }

    /**
     * Finding 4 (mezo-qw37.1 review, SECOND pass — the first pass regressed this exact case).
     * {@code tokensValidFrom} used to be stamped to {@code Instant.now()} at the moment the
     * change-password transaction committed. But a JWT's {@code iat} is fixed at LOGIN time and
     * never refreshed, and everything between login and this call — typing three password
     * fields, two deliberately slow BCrypt operations — is seconds to minutes, not the
     * sub-second gap a naive fix might assume. So the wall-clock stamp landed measurably AFTER
     * the performing token's own {@code iat}, and the very next request that token made (exactly
     * what {@code AuthGate.onAuthenticated}'s post-success {@code me()} call is) got 401'd
     * straight back to the login screen — the first thing a user seeing the forced-change screen
     * would experience.
     *
     * <p>The {@code sleep} below is deliberate and makes the test STRICTER, not flaky: it widens
     * the login-to-change-password gap to well over a second, which is exactly the gap that used
     * to break this under the {@code Instant.now()} stamp. Verified against the pre-fix
     * implementation (anchoring {@code tokensValidFrom} to {@code Instant.now()} instead of the
     * performing token's {@code iat}): this test fails there (401 instead of 200) — see the
     * mezo-qw37.1 fix-wave report for the run.
     */
    @Test
    void testChangePassword_shouldNotInvalidateTheTokenThatPerformedTheChange() throws InterruptedException {
        HttpHeaders headers = registerFresh("selfsurvive@test.local");
        Thread.sleep(1100); // widens the login-to-change gap well past what broke this under Instant.now()

        postForBody("/api/auth/change-password", new ChangePasswordRequest("titkos-jelszo-1", "uj-jelszo-2026"),
            headers, HttpStatus.NO_CONTENT, Void.class);

        getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class);
    }

    /**
     * Finding 4 (mezo-qw37.1 review): a token minted BEFORE a password change must not survive
     * it, while a token from a fresh post-change login works. {@code changePassword} is
     * performed with a SECOND, later-minted token (not the original registration token) so the
     * watermark ({@code tokensValidFrom} = the performing token's {@code iat}) lands strictly
     * after the original token's {@code iat} without any direct DB manipulation — the sleep
     * between mints is what guarantees the two tokens land in different UTC seconds.
     */
    @Test
    void testProtectedCall_shouldReturn401_whenTokenIssuedBeforeChange() throws InterruptedException {
        HttpHeaders originalHeaders = registerFresh("beforechange@test.local");
        Thread.sleep(1100); // guarantees the login below mints a token with a strictly later iat
        TokenResponse performing = postForBody("/api/auth/login",
            new LoginRequest("beforechange@test.local", "titkos-jelszo-1"), null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders performingHeaders = new HttpHeaders();
        performingHeaders.setBearerAuth(performing.getToken());

        postForBody("/api/auth/change-password", new ChangePasswordRequest("titkos-jelszo-1", "uj-jelszo-2026"),
            performingHeaders, HttpStatus.NO_CONTENT, Void.class);

        String body = getForBody("/api/auth/me", originalHeaders, HttpStatus.UNAUTHORIZED, String.class);
        assertHasRequestError(body, "AUTH_TOKEN_MISSING");

        TokenResponse fresh = postForBody("/api/auth/login", new LoginRequest("beforechange@test.local", "uj-jelszo-2026"),
            null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders freshHeaders = new HttpHeaders();
        freshHeaders.setBearerAuth(fresh.getToken());
        getForBody("/api/auth/me", freshHeaders, HttpStatus.OK, MeResponse.class);
    }

    /**
     * Finding 4 (mezo-qw37.1 review) — the actual security property, isolated from any
     * subsequent login: mint token A, then log in again to mint token B, then change the
     * password USING B. A must die (it predates the watermark); B must live (it IS the
     * watermark) — this is the "old sessions die, the acting session doesn't" guarantee that
     * makes password-change a real compromise-recovery lever.
     */
    @Test
    void testChangePassword_shouldInvalidateOlderTokenButNotThePerformingToken() throws InterruptedException {
        HttpHeaders tokenA = registerFresh("olderdies@test.local");
        Thread.sleep(1100); // guarantees B's iat lands in a strictly later UTC second than A's
        TokenResponse b = postForBody("/api/auth/login",
            new LoginRequest("olderdies@test.local", "titkos-jelszo-1"), null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders tokenB = new HttpHeaders();
        tokenB.setBearerAuth(b.getToken());

        postForBody("/api/auth/change-password", new ChangePasswordRequest("titkos-jelszo-1", "uj-jelszo-2026"),
            tokenB, HttpStatus.NO_CONTENT, Void.class);

        String body = getForBody("/api/auth/me", tokenA, HttpStatus.UNAUTHORIZED, String.class);
        assertHasRequestError(body, "AUTH_TOKEN_MISSING");
        getForBody("/api/auth/me", tokenB, HttpStatus.OK, MeResponse.class);
    }

    @Test
    void testCompleteOnboarding_shouldFlipOnboarded_whenCalled() {
        HttpHeaders headers = registerFresh("ob@test.local");
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getOnboarded()).isFalse();
        postForBody("/api/auth/onboarding-complete", null, headers, HttpStatus.NO_CONTENT, Void.class);
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getOnboarded()).isTrue();
    }
}
