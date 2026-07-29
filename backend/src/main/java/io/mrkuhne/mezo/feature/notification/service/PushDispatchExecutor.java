package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.domain.DueItem;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * The async send handoff for {@link NotificationDispatchJob} (N2, bd mezo-h4wp.6.2).
 *
 * <p>Deliberately a SEPARATE bean, not a private method on the job: {@code @Async} only takes
 * effect through Spring's proxy, so a same-bean {@code this.dispatch(...)} call from
 * {@code NotificationDispatchJob} would run synchronously on the caller's thread — exactly the
 * scheduler's single-threaded pool this class exists to keep free. {@link
 * io.mrkuhne.mezo.techcore.configuration.AsyncConfiguration}'s {@code @EnableAsync} routes this
 * call onto Boot's auto-configured {@code applicationTaskExecutor}; no second executor is
 * defined here, and the scheduler pool size is untouched.
 *
 * <p>{@code NotificationDispatchJobIT} proves the offload genuinely happens: it asserts
 * {@code applicationTaskExecutor}'s own completed-task counter increases after {@code runOnce()}
 * returns — a count that would never move if the self-invocation trap above had been hit.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class PushDispatchExecutor {

    private final PushSender pushSender;

    /**
     * Fire-and-forget: the caller (the dispatch job) must return without waiting on this. {@link
     * PushSender#sendToAllDevices} never throws by contract, but a fire-and-forget {@code @Async}
     * void method's exception would otherwise vanish into Spring's default
     * {@code AsyncUncaughtExceptionHandler} — caught and logged explicitly instead, matching every
     * other per-unit failure in this slice (never abort, always log and move on).
     */
    @Async
    public void dispatch(UUID owner, DueItem item) {
        try {
            pushSender.sendToAllDevices(owner, item.title(), item.body(), item.url());
        } catch (Exception e) {
            log.warn("Async push dispatch failed unexpectedly for category {}", item.category(), e);
        }
    }
}
