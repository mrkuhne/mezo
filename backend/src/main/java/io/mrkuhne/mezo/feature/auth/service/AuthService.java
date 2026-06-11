package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    public TokenResponse login(LoginRequest req) {
        AppUserEntity user = appUserRepository.findByEmail(req.getEmail())
            .filter(u -> passwordEncoder.matches(req.getPassword(), u.getPasswordHash()))
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_LOGIN_INVALID_CREDENTIALS").build(), HttpStatus.UNAUTHORIZED));

        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .subject(user.getId().toString())
            .issuedAt(now)
            .expiresAt(now.plus(30, ChronoUnit.DAYS))
            .claim("email", user.getEmail())
            .build();
        // NimbusJwtEncoder cannot infer the JWS algorithm from a symmetric ImmutableSecret,
        // so the HS256 header must be set explicitly (else "Failed to select a JWK signing key").
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new TokenResponse(token);
    }
}
