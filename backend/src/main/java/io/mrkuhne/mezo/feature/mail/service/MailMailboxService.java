package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import io.mrkuhne.mezo.feature.mail.service.google.GoogleOAuthClient;
import io.mrkuhne.mezo.feature.mail.service.imap.MailReader;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The mirror mailbox of the caller: connect (verified against the mail server BEFORE anything is stored), read,
 * disconnect, and the manual run with its restart-safe cooldown. The IMAP check runs outside any transaction; the
 * app password lives only in a local variable and is never logged or put in an exception.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailMailboxService {

    /** The mailbox as the API shows it; {@code state} is {@code none} when there is no row. */
    public record MailboxView(String address, String state, Instant lastRunAt, Integer lastFetched, String kind,
                              String googleClientId) {
    }

    private final MailReader reader;
    private final GoogleOAuthClient google;
    private final MailCredentialCipher cipher;
    private final MailMailboxStore store;
    private final MailRunner runner;
    private final MailHealth health;
    private final MailProperties properties;
    private final ObjectProvider<Clock> clock;

    public MailboxView get(UUID owner) {
        return view(owner, store.find(owner));
    }

    public MailboxView connect(UUID owner, String address, String appPassword) {
        String password = appPassword.replaceAll("\\s+", "");
        try {
            reader.verify(address, password);
        } catch (SystemRuntimeErrorException e) {
            if (MailErrors.AUTH_FAILED.equals(e.getMessage())) {
                throw MailErrors.authFailed();
            }
            throw e;
        }
        String oldGoogleToken = googleToken(store.find(owner)); // Google to IMAP: the old grant goes
        MailMailboxEntity m = store.connect(owner, address, cipher.seal(password));
        revokeQuietly(oldGoogleToken);
        health.refresh();
        return view(owner, Optional.of(m));
    }

    /**
     * Sign in with Google (spec §12): the phone's one-time code is exchanged HERE (no secret, PKCE), the refresh
     * token is sealed into the secret columns and never returned; the address is the verified ID-token email.
     * 409 when no client id is set up, 400 when the redirect is not the iOS client's, 422 when Google refuses.
     */
    public MailboxView connectGoogle(UUID owner, String code, String codeVerifier, String redirectUri) {
        MailProperties.Google cfg = properties.google();
        if (!cfg.configured()) {
            throw MailErrors.googleNotConfigured();
        }
        String expected = cfg.expectedRedirectUri();
        if (expected == null || !expected.equals(redirectUri)) {
            throw MailErrors.googleRedirectInvalid();
        }
        GoogleOAuthClient.Tokens tokens = google.exchange(code, codeVerifier, redirectUri);
        Optional<MailMailboxEntity> before = store.find(owner);
        String oldToken = googleToken(before);
        String oldAddress = before.map(MailMailboxEntity::getAddress).orElse("");
        MailMailboxEntity m = store.connect(owner, MailIntakeStore.KIND_GOOGLE, tokens.email(),
            cipher.seal(tokens.refreshToken()));
        // another Google account replaces the old grant: revoke it. The SAME account is only re-consented: Google may
        // treat the old and new refresh tokens as one grant, so revoking the old one could kill the new one.
        if (!tokens.email().equalsIgnoreCase(oldAddress)) {
            revokeQuietly(oldToken);
        }
        health.refresh();
        return view(owner, Optional.of(m));
    }

    public MailboxView disconnect(UUID owner) {
        revokeQuietly(googleToken(store.find(owner)));
        Optional<MailMailboxEntity> m = store.disconnect(owner);
        health.refresh();
        return view(owner, m);
    }

    /**
     * Accepts a manual run: 409 without a connected mailbox, 429 inside the cooldown of the last run (read from the
     * database, so a restart does not reset it), else the pipeline runs for this user on the mail executor.
     */
    public void requestRun(UUID owner) {
        MailMailboxEntity m = store.find(owner).filter(MailRunner::isConnected)
            .orElseThrow(MailErrors::notConnected);
        Instant now = Instant.now(clock.getIfAvailable(Clock::systemUTC));
        Instant last = m.getLastRunAt() != null ? m.getLastRunAt()
            : store.latestRun(owner).map(MailRunEntity::getStartedAt).orElse(null);
        if (last != null && now.isBefore(last.plus(Duration.ofMinutes(properties.manualRunCooldownMinutes())))) {
            throw MailErrors.runCooldown();
        }
        try {
            runner.runManualAsync(owner);
        } catch (RejectedExecutionException e) {
            log.warn("Mail manual run for owner {} rejected: the mail executor is full", owner);
            throw MailErrors.runCooldown();
        }
    }

    /** The opened refresh token of a Google mailbox with a stored secret; null for anything else or if unreadable. */
    private String googleToken(Optional<MailMailboxEntity> mailbox) {
        return mailbox.filter(m -> MailIntakeStore.KIND_GOOGLE.equals(m.getKind()) && m.getSecretCipher() != null
            && m.getSecretNonce() != null).map(m -> {
                try {
                    return cipher.open(new MailCredentialCipher.Sealed(m.getSecretCipher(), m.getSecretNonce()));
                } catch (RuntimeException e) {
                    log.warn("Google token unreadable for owner {}: {}", m.getCreatedBy(), e.getClass().getSimpleName());
                    return null;
                }
            }).orElse(null);
    }

    /** Revokes a grant at Google; best effort, a failure never blocks (null = nothing to revoke). */
    private void revokeQuietly(String token) {
        if (token == null) {
            return;
        }
        try {
            google.revoke(token);
        } catch (RuntimeException e) {
            log.warn("Google revoke skipped: {}", e.getClass().getSimpleName());
        }
    }

    private MailboxView view(UUID owner, Optional<MailMailboxEntity> mailbox) {
        String clientId = properties.google().clientId();
        if (mailbox.isEmpty()) {
            return new MailboxView(null, "none", null, null, null, clientId);
        }
        MailMailboxEntity m = mailbox.get();
        Integer fetched = store.latestRun(owner).map(MailRunEntity::getFetched).orElse(null);
        return new MailboxView(m.getAddress(), m.getState(), m.getLastRunAt(), fetched, m.getKind(), clientId);
    }
}
