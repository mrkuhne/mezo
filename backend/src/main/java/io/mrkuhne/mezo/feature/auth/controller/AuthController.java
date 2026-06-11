package io.mrkuhne.mezo.feature.auth.controller;

import io.mrkuhne.mezo.api.controller.AuthApi;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
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
}
