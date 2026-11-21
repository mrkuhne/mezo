package io.mrkuhne.mezo.feature.mail.service;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.repository.MailMailboxRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * The health of the owner's mirror mailbox as two Micrometer gauges (exported as
 * {@code mezo_mail_zero_run_streak} and {@code mezo_mail_auth_failed}, alerted by {@code MailMailboxSilent} /
 * {@code MailMailboxAuthFailed} in {@code k8s/monitoring/vmrule-mezo.yaml}). Both are recomputed from the
 * {@code mail_mailbox} table at startup and after every run, so they survive restarts.
 */
@Service
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailHealth {

    public static final String ZERO_RUN_STREAK = "mezo.mail.zero.run.streak";
    public static final String AUTH_FAILED = "mezo.mail.auth.failed";

    private final MailMailboxRepository mailboxes;
    private final AtomicInteger zeroRunStreak = new AtomicInteger();
    private final AtomicInteger authFailed = new AtomicInteger();

    public MailHealth(MailMailboxRepository mailboxes, MeterRegistry registry) {
        this.mailboxes = mailboxes;
        Gauge.builder(ZERO_RUN_STREAK, zeroRunStreak, AtomicInteger::get)
            .description("Consecutive Boop Levél runs that fetched no new mail (max over live mailboxes)")
            .register(registry);
        Gauge.builder(AUTH_FAILED, authFailed, AtomicInteger::get)
            .description("1 when a live Boop Levél mailbox refuses its app password, else 0")
            .register(registry);
    }

    /** Loads the stored state into the gauges. */
    @EventListener(ApplicationReadyEvent.class)
    public void loadGauges() {
        refresh();
    }

    /** Recomputes both gauges from the table. */
    public void refresh() {
        List<MailMailboxEntity> live = mailboxes.findAll().stream()
            .filter(m -> !MailIntakeStore.STATE_DISCONNECTED.equals(m.getState())).toList();
        zeroRunStreak.set(live.stream().mapToInt(MailMailboxEntity::getZeroRunStreak).max().orElse(0));
        authFailed.set(live.stream().anyMatch(m -> MailIntakeStore.STATE_AUTH_FAILED.equals(m.getState())) ? 1 : 0);
    }
}
