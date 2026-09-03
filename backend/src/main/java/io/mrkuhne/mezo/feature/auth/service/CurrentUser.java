package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

/**
 * The authenticated account behind the JWT subject, loaded once per request.
 *
 * <p>Every protected request crosses {@link #get()} (via {@code CurrentUserId}), which is where
 * a DISABLED account is rejected — the JWT itself stays valid for 30 days, so this per-request
 * check is the revocation mechanism (spec M1). Since Finding 4 (mezo-qw37.1 review, second pass)
 * it also rejects a token whose {@code iat} is strictly before {@code
 * AppUserEntity.tokensValidFrom}. That column is stamped by {@code AuthService.changePassword} to
 * the {@code iat} of the token that PERFORMED the change (via {@link #tokenIssuedAt()}) — never
 * to {@code Instant.now()} — so the comparison is JWT-iat vs JWT-iat, same clock, same
 * granularity: the performing token's own {@code iat} equals the watermark exactly, so {@code
 * isBefore} is false and it survives; every strictly older token dies. (An earlier version of
 * this fix stamped {@code Instant.now()} at commit time and needed a grace window to paper over
 * the gap between a token's mint and the password-change transaction's commit — that gap is
 * seconds to minutes in practice [three form fields, two BCrypt operations], not a rounding
 * error, so the grace window silently signed the user themselves out right after a successful
 * change. Anchoring to the performing token's own {@code iat} removes the need for a grace window
 * entirely.) The loaded entity is cached as a request attribute; on non-request threads (cron) no
 * caching happens.
 *
 * <p><b>Usage contract:</b> call {@link #get()} / {@link #id()} from the controller layer only —
 * as a method argument, or at the very top of the handler before any service call — never from
 * inside an already-open {@code @Transactional} method (in particular a read-only one). {@link
 * #load(Claims)} issues a bulk {@code UPDATE} to stamp {@code last_seen_at}; nesting that write
 * inside a transaction Spring opened as {@code readOnly = true} can fail at the JDBC/database
 * level. Nothing in the type system enforces this — it is a caller discipline, not a guarantee.
 */
@Component
@RequiredArgsConstructor
public class CurrentUser {

    static final String REQUEST_ATTR = "mezo.currentUser";
    static final Duration LAST_SEEN_STAMP_INTERVAL = Duration.ofMinutes(5);

    private final AppUserRepository appUserRepository;

    /**
     * The {@code iat} of the JWT authenticating the CURRENT request (Finding 4, mezo-qw37.1
     * review). {@code AuthService.changePassword} stamps {@code AppUserEntity.tokensValidFrom} to
     * this — the performing token's own mint time, not {@code Instant.now()} — so every token
     * issued strictly before it (including the performing token's own future re-reads of {@link
     * #get()} within the same request) is revoked, while the performing token itself, whose
     * {@code iat} equals the watermark, is not.
     */
    public Instant tokenIssuedAt() {
        return subjectFromContext().issuedAt();
    }

    public AppUserEntity get() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            Object cached = attrs.getAttribute(REQUEST_ATTR, RequestAttributes.SCOPE_REQUEST);
            if (cached instanceof AppUserEntity user) return user;
        }
        AppUserEntity user = load(subjectFromContext());
        if (attrs != null) attrs.setAttribute(REQUEST_ATTR, user, RequestAttributes.SCOPE_REQUEST);
        return user;
    }

    public UUID id() { return get().getId(); }

    public AppUserEntity requireOwner() {
        AppUserEntity user = get();
        if (!user.isOwner()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_FORBIDDEN").build(), HttpStatus.FORBIDDEN);
        }
        return user;
    }

    /** The JWT subject + iat, kept together so {@link #load} can apply the revocation check. */
    private record Claims(UUID subject, Instant issuedAt) { }

    private Claims subjectFromContext() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_TOKEN_MISSING").build(), HttpStatus.UNAUTHORIZED);
        }
        return new Claims(UUID.fromString(jwt.getSubject()), jwt.getIssuedAt());
    }

    private AppUserEntity load(Claims claims) {
        AppUserEntity user = appUserRepository.findById(claims.subject())
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_TOKEN_MISSING").build(), HttpStatus.UNAUTHORIZED));
        if (user.getStatus() == AppUserEntity.UserStatus.DISABLED) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_ACCOUNT_DISABLED").build(), HttpStatus.FORBIDDEN);
        }
        Instant validFrom = user.getTokensValidFrom();
        if (validFrom != null && claims.issuedAt() != null && claims.issuedAt().isBefore(validFrom)) {
            // tokensValidFrom is the iat of the token that performed the last password change —
            // strictly-before means THIS token predates it, i.e. was minted before that change.
            // No grace window: both sides are JWT iat values (same clock, same granularity), so
            // the performing token itself (iat == validFrom) is never caught by isBefore.
            // Same "dead session" as a missing token, so the same code/status the frontend
            // already treats as sign-out.
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_TOKEN_MISSING").build(), HttpStatus.UNAUTHORIZED);
        }
        Instant now = Instant.now();
        if (user.getLastSeenAt() == null || user.getLastSeenAt().plus(LAST_SEEN_STAMP_INTERVAL).isBefore(now)) {
            // @implNote: bulk UPDATE — see the class-level usage contract. Must not run inside a
            // transaction the caller already opened (esp. readOnly = true).
            appUserRepository.touchLastSeen(user.getId(), now);
            user.setLastSeenAt(now);
        }
        return user;
    }
}
