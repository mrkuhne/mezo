package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
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
    public record MailboxView(String address, String state, Instant lastRunAt, Integer lastFetched) {
    }

    private final MailReader reader;
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
        MailMailboxEntity m = store.connect(owner, address, cipher.seal(password));
        health.refresh();
        return view(owner, Optional.of(m));
    }

    public MailboxView disconnect(UUID owner) {
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

    private MailboxView view(UUID owner, Optional<MailMailboxEntity> mailbox) {
        if (mailbox.isEmpty()) {
            return new MailboxView(null, "none", null, null);
        }
        MailMailboxEntity m = mailbox.get();
        Integer fetched = store.latestRun(owner).map(MailRunEntity::getFetched).orElse(null);
        return new MailboxView(m.getAddress(), m.getState(), m.getLastRunAt(), fetched);
    }
}
