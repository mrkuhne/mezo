package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.mail.config.MailAsyncConfig;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Executor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * One run of the morning post (mezo-r36n9.39): intake, then the digest pass, then the raw-body purge. The twice-daily
 * job hands off to {@link #runAsync}; a manual run goes through {@link #runManualAsync}. Both run on the dedicated
 * single-thread {@code mailExecutor}, so runs never overlap. Each step has its own try/catch: a failed intake still
 * lets the digest pass sort what was stored, a failed pass never blocks the purge, and one user never stops another.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailRunner {

    private final MailIntakeService intake;
    private final MailDigestService digest;
    private final MailPurgeService purge;
    private final MailMailboxStore mailboxes;
    private final UserFanOut users;
    private final Executor executor;
    private final ObjectProvider<Clock> clock;

    public MailRunner(MailIntakeService intake, MailDigestService digest, MailPurgeService purge,
                      MailMailboxStore mailboxes, UserFanOut users,
                      @Qualifier(MailAsyncConfig.EXECUTOR) Executor executor, ObjectProvider<Clock> clock) {
        this.intake = intake;
        this.digest = digest;
        this.purge = purge;
        this.mailboxes = mailboxes;
        this.users = users;
        this.executor = executor;
        this.clock = clock;
    }

    /** The job's entry: the whole fan-out on the mail executor. */
    @Async(MailAsyncConfig.EXECUTOR)
    public void runAsync() {
        run();
    }

    /** The cron body: every active user with a connected mailbox, then one purge. */
    void run() {
        users.forEachActiveUser("Mail run", user -> {
            if (connected(user.getId())) {
                runFor(user.getId(), "cron");
            }
        });
        purge();
    }

    /** The caller's manual run on the mail executor; throws {@code RejectedExecutionException} when it is full. */
    public void runManualAsync(UUID owner) {
        executor.execute(() -> {
            runFor(owner, "manual");
            purge();
        });
    }

    /** One user's pipeline — package-visible so ITs can run it synchronously. */
    void runFor(UUID owner, String trigger) {
        MailIntakeService.IntakeResult result = null;
        try {
            result = intake.intake(owner, trigger);
        } catch (RuntimeException e) {
            log.warn("Mail intake failed for owner {}: {}", owner, e.getClass().getSimpleName());
        }
        if (result == null || result.runId() == null) {
            return;
        }
        try {
            digest.process(owner, result);
        } catch (RuntimeException e) {
            log.warn("Mail digest pass failed for owner {}: {}", owner, e.getClass().getSimpleName());
        }
    }

    private void purge() {
        try {
            purge.purge(Instant.now(clock.getIfAvailable(Clock::systemUTC)));
        } catch (RuntimeException e) {
            log.warn("Mail purge failed: {}", e.getClass().getSimpleName());
        }
    }

    private boolean connected(UUID owner) {
        return mailboxes.find(owner).filter(MailRunner::isConnected).isPresent();
    }

    /** A mailbox the run may read: not disconnected and still holding its sealed secret. */
    static boolean isConnected(MailMailboxEntity m) {
        return !MailIntakeStore.STATE_DISCONNECTED.equals(m.getState()) && m.getSecretCipher() != null
            && m.getSecretNonce() != null;
    }
}
