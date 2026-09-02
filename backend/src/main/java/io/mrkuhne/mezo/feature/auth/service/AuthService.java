package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.api.dto.ChangePasswordRequest;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final InviteService inviteService;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    public TokenResponse login(LoginRequest req) {
        AppUserEntity user = appUserRepository.findByEmail(normalizeEmail(req.getEmail()))
            .filter(u -> passwordEncoder.matches(req.getPassword(), u.getPasswordHash()))
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_LOGIN_INVALID_CREDENTIALS").build(), HttpStatus.UNAUTHORIZED));
        if (user.getStatus() == AppUserEntity.UserStatus.DISABLED) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_ACCOUNT_DISABLED").build(), HttpStatus.FORBIDDEN);
        }
        return issueToken(user);
    }

    /**
     * Invite-gated registration, one transaction: the invite row is locked first (so a racing
     * second registration with the same code waits, then sees it used), the email uniqueness is
     * checked, the account is inserted, the invite is marked used.
     */
    @Transactional
    public TokenResponse register(RegisterRequest req) {
        String email = normalizeEmail(req.getEmail());
        if (appUserRepository.existsByEmail(email)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_EMAIL_TAKEN").build(), HttpStatus.CONFLICT);
        }
        AppUserEntity user = new AppUserEntity();
        user.setEmail(email);
        user.setName(req.getName().trim());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setRole(AppUserEntity.UserRole.USER);
        user = appUserRepository.save(user);
        inviteService.consume(req.getInviteCode(), user.getId());
        return issueToken(user);
    }

    public MeResponse me(AppUserEntity user) {
        return new MeResponse(user.getId(), user.getEmail(), user.getName(), user.getRole().name(),
            user.isOnboarded(), user.isMustChangePassword(), user.getTimezone());
    }

    /**
     * Deviation from the brief: re-reads the account by id inside this transaction instead of
     * mutating the {@code user} argument directly. {@code CurrentUser.get()} hands back a
     * detached entity cached at the very start of the request; {@code AppUserEntity} carries no
     * {@code @Version} column, so saving that stale snapshot would let JPA merge() silently
     * overwrite any concurrent write made to other columns between request start and this call.
     * The passed-in entity is used only for its id.
     */
    @Transactional
    public void changePassword(AppUserEntity user, ChangePasswordRequest req) {
        AppUserEntity current = appUserRepository.findById(user.getId())
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_TOKEN_MISSING").build(), HttpStatus.UNAUTHORIZED));
        if (!passwordEncoder.matches(req.getCurrentPassword(), current.getPasswordHash())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_LOGIN_INVALID_CREDENTIALS").build(), HttpStatus.UNAUTHORIZED);
        }
        current.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        current.setMustChangePassword(false);
        appUserRepository.save(current);
    }

    /**
     * Deviation from the brief: same re-read-by-id pattern as {@link #changePassword} and for the
     * same reason — avoid merging a stale detached snapshot over a concurrent write.
     */
    @Transactional
    public void completeOnboarding(AppUserEntity user) {
        AppUserEntity current = appUserRepository.findById(user.getId())
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_TOKEN_MISSING").build(), HttpStatus.UNAUTHORIZED));
        if (current.getOnboardedAt() == null) {
            current.setOnboardedAt(Instant.now());
            appUserRepository.save(current);
        }
    }

    public TokenResponse issueToken(AppUserEntity user) {
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

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
