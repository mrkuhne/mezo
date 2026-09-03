package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.CategoryPref;
import io.mrkuhne.mezo.feature.notification.domain.DueItem;
import io.mrkuhne.mezo.feature.notification.entity.PushLogEntity;
import io.mrkuhne.mezo.feature.notification.repository.PushLogRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The per-minute push dispatch cron (N2, bd mezo-h4wp.6.2) — the top of the notification chain:
 * for every user, resolves the day's anchors, evaluates what is due this minute, and fires
 * whatever has not already been sent today.
 *
 * <p><b>The scheduler pool is shared</b> ({@code SchedulingConfiguration} defines no
 * {@code TaskScheduler}; {@code spring.task.scheduling.pool.size} sizes it) — every one of the
 * app's {@code @Scheduled} methods, this one included, draws from it. So this class only ever
 * does DB-only, in-process work on the scheduler thread; the actual outbound push (a 5 s-timeout
 * HTTP call per device) is handed to {@link PushDispatchExecutor}'s {@code @Async} method, which
 * runs on Boot's separate {@code applicationTaskExecutor} pool instead. Sending inline here would
 * let one slow push service starve the nightly summary, the dawn briefing, the habit close —
 * every other cron in the app. The reverse starvation is why the pool is no longer Boot's default
 * of 1: this tick is the only latency-sensitive job in the app, and a minute spent queued behind
 * an LLM-heavy generation cron is a minute of pushes lost to the catch-up window (mezo-y33b).
 *
 * <p><b>Write the {@code push_log} row FIRST, then hand off the send</b> (never the other way
 * around): a failed send must not re-fire the same notification on the next minute — a lost
 * notification is strictly better than a duplicated one. {@link PushLogRepository#saveAndFlush}
 * runs with no ambient transaction on this class (see below), so it commits synchronously, before
 * {@link PushDispatchExecutor#dispatch} is even called.
 *
 * <p><b>Deliberately carries no {@code @Transactional}</b> (the {@code ChallengeJob} idiom): one
 * user's broken data must never abort the loop, but wrapping the whole run (or even one user's
 * whole due-list) in a single transaction would defeat that — {@link AnchorResolver#resolve} is
 * itself a separate {@code @Transactional(readOnly = true)} bean method, so a `RuntimeException`
 * escaping it would mark ANY enclosing transaction rollback-only, silently discarding an earlier
 * user's already-"successful" {@code push_log} writes too (Spring's classic
 * {@code UnexpectedRollbackException} trap). Left unannotated, each collaborator call gets its own
 * naturally-scoped transaction instead, and the try/catch below is the only isolation this needs.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.NOTIFICATION_SWITCH, FeaturesConfiguration.NOTIFICATION_DISPATCH_JOB_SWITCH},
        havingValue = "true")
public class NotificationDispatchJob {

    private final UserFanOut userFanOut;
    private final AnchorResolver anchorResolver;
    private final NotificationPrefService notificationPrefService;
    private final DueEvaluator dueEvaluator;
    private final PushLogRepository pushLogRepository;
    private final PushDispatchExecutor pushDispatchExecutor;
    private final NotificationProperties notificationProperties;

    @Scheduled(cron = "${mezo.notification.dispatch-cron}")
    public void run() {
        // ONE clock read, both values derived from it: two separate now() calls could tear across
        // midnight (date from before, minute from after), logging a 00:00 anchor under the previous
        // log_date — the only theoretical way this job double-sends an anchor.
        LocalDateTime now = LocalDateTime.now();
        runOnce(now.toLocalDate(), now.getHour() * 60 + now.getMinute());
    }

    /**
     * Testable seam: the whole run for one {@code (date, minute)} pair, without touching a real
     * clock or waiting for a cron to fire. Per-user failures are isolated (logged at {@code warn},
     * the loop continues) — the {@code ChallengeJob} idiom.
     *
     * @return how many notifications were newly dispatched (persisted + handed to the async
     *     sender) across every user this run
     */
    public int runOnce(LocalDate date, int nowMinuteOfDay) {
        AtomicInteger users = new AtomicInteger();
        AtomicInteger dispatched = new AtomicInteger();
        userFanOut.forEachActiveUser("Notification dispatch", user -> {
            users.incrementAndGet();
            try {
                dispatched.addAndGet(dispatchForUser(user.getId(), date, nowMinuteOfDay));
            } catch (Exception e) {
                log.warn("Notification dispatch failed for user {} on {}", user.getId(), date, e);
            }
        });
        // Only when something actually went out: this runs 1440x/day, so an unconditional summary
        // would add 1440 lines/day forever and bury the lines that matter. Counts only — never a
        // push endpoint (a capability URL) or key material in this line.
        if (dispatched.get() > 0) {
            log.info("Notification dispatch run {} min={}: {} user(s), {} dispatched", date, nowMinuteOfDay,
                    users.get(), dispatched.get());
        }
        return dispatched.get();
    }

    private int dispatchForUser(UUID owner, LocalDate date, int nowMinuteOfDay) {
        AnchorSet anchors = anchorResolver.resolve(owner, date);
        List<CategoryPref> prefs = notificationPrefService.effectiveFor(owner);
        List<DueItem> due = dueEvaluator.due(nowMinuteOfDay, prefs, anchors, notificationProperties.catchUpMinutes());

        int dispatched = 0;
        for (DueItem item : due) {
            if (pushLogRepository.existsByCreatedByAndLogDateAndDedupKey(owner, date, item.dedupKey())) {
                continue; // already sent today for this anchor — the dedup ledger wins
            }
            writeLog(owner, date, item);
            pushDispatchExecutor.dispatch(owner, item);
            dispatched++;
        }
        return dispatched;
    }

    /** Persists the dedup-ledger row. Must happen before {@link PushDispatchExecutor#dispatch}. */
    private void writeLog(UUID owner, LocalDate date, DueItem item) {
        PushLogEntity entity = new PushLogEntity();
        entity.setCreatedBy(owner);
        entity.setLogDate(date);
        entity.setDedupKey(item.dedupKey());
        entity.setCategory(item.category().key());
        pushLogRepository.saveAndFlush(entity);
    }
}
