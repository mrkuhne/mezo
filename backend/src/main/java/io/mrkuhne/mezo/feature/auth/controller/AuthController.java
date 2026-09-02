package io.mrkuhne.mezo.feature.auth.controller;

import io.mrkuhne.mezo.api.controller.AuthApi;
import io.mrkuhne.mezo.api.dto.ChangePasswordRequest;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.service.AuthService;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/validation come from {@link AuthApi}. */
@RestController
@RequiredArgsConstructor
public class AuthController implements AuthApi {

    private final AuthService authService;

    @Override
    public TokenResponse login(LoginRequest loginRequest) {
        return authService.login(loginRequest);
    }

    // TODO(mezo-qw37.5): implemented in Task 5 — temporary stubs so the module compiles
    // and Task 2's ITs can run against the new AuthApi contract methods.

    @Override
    public TokenResponse register(RegisterRequest registerRequest) {
        throw new SystemRuntimeErrorException(
            SystemMessage.error("INTERNAL_ERROR").build(), HttpStatus.NOT_IMPLEMENTED);
    }

    @Override
    public MeResponse me() {
        throw new SystemRuntimeErrorException(
            SystemMessage.error("INTERNAL_ERROR").build(), HttpStatus.NOT_IMPLEMENTED);
    }

    @Override
    public void changePassword(ChangePasswordRequest changePasswordRequest) {
        throw new SystemRuntimeErrorException(
            SystemMessage.error("INTERNAL_ERROR").build(), HttpStatus.NOT_IMPLEMENTED);
    }

    @Override
    public void completeOnboarding() {
        throw new SystemRuntimeErrorException(
            SystemMessage.error("INTERNAL_ERROR").build(), HttpStatus.NOT_IMPLEMENTED);
    }
}
