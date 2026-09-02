package io.mrkuhne.mezo.feature.auth.controller;

import io.mrkuhne.mezo.api.controller.AuthApi;
import io.mrkuhne.mezo.api.dto.ChangePasswordRequest;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.service.AuthService;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/validation come from {@link AuthApi}. */
@RestController
@RequiredArgsConstructor
public class AuthController implements AuthApi {

    private final AuthService authService;
    private final CurrentUser currentUser;

    @Override
    public TokenResponse login(LoginRequest loginRequest) {
        return authService.login(loginRequest);
    }

    @Override
    public TokenResponse register(RegisterRequest registerRequest) {
        return authService.register(registerRequest);
    }

    @Override
    public MeResponse me() {
        return authService.me(currentUser.get());
    }

    @Override
    public void changePassword(ChangePasswordRequest changePasswordRequest) {
        authService.changePassword(currentUser.get(), changePasswordRequest);
    }

    @Override
    public void completeOnboarding() {
        authService.completeOnboarding(currentUser.get());
    }
}
