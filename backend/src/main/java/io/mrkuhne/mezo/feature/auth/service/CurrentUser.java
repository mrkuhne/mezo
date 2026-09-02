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
 * check is the revocation mechanism (spec M1). The loaded entity is cached as a request
 * attribute; on non-request threads (cron) no caching happens.
 */
@Component
@RequiredArgsConstructor
public class CurrentUser {

    static final String REQUEST_ATTR = "mezo.currentUser";
    static final Duration LAST_SEEN_STAMP_INTERVAL = Duration.ofMinutes(5);

    private final AppUserRepository appUserRepository;

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

    private UUID subjectFromContext() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_TOKEN_MISSING").build(), HttpStatus.UNAUTHORIZED);
        }
        return UUID.fromString(jwt.getSubject());
    }

    private AppUserEntity load(UUID id) {
        AppUserEntity user = appUserRepository.findById(id)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_TOKEN_MISSING").build(), HttpStatus.UNAUTHORIZED));
        if (user.getStatus() == AppUserEntity.UserStatus.DISABLED) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_ACCOUNT_DISABLED").build(), HttpStatus.FORBIDDEN);
        }
        Instant now = Instant.now();
        if (user.getLastSeenAt() == null || user.getLastSeenAt().plus(LAST_SEEN_STAMP_INTERVAL).isBefore(now)) {
            appUserRepository.touchLastSeen(user.getId(), now);
            user.setLastSeenAt(now);
        }
        return user;
    }
}
