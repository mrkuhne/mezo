package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.service.CalendarDaysReplacedEvent;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Runs the model scoring of the owner's coming days — today..today+{@link #AHEAD_DAYS} in his zone — in the
 * background, never on a request thread (Boop B7 K1, mezo-r36n9.17). Triggers:
 * <ul>
 *   <li>a calendar-days PUT ({@link CalendarDaysReplacedEvent}, AFTER_COMMIT + {@code @Async}: the PUT has landed
 *       and this thread carries no transaction);</li>
 *   <li>a day read that met an upcoming timed event with no model score yet (e.g. a PUT from before the deploy):
 *       fire-and-forget, at most once per {@link #DAY_TRIGGER_MIN_INTERVAL} per owner, the read never waits.</li>
 * </ul>
 * Single-flight per owner: a trigger that finds a run in progress does not start a second one; it asks the running
 * one for one more pass (which finds the cached scores and calls the model only for what changed meanwhile).
 */
@Slf4j
@Component
public class EventScoringRunner {

    static final int AHEAD_DAYS = 8;
    static final Duration DAY_TRIGGER_MIN_INTERVAL = Duration.ofMinutes(10);

    private final EventScoringService scoring;
    private final CapacityProperties props;
    private final WearableProperties wearable;
    private final AsyncTaskExecutor executor;
    private final ObjectProvider<Clock> clock;
    /** Present = a run for that owner is in progress; {@code true} = one more pass was asked for. */
    private final Map<UUID, Boolean> running = new ConcurrentHashMap<>();
    private final Map<UUID, Instant> lastDayTrigger = new ConcurrentHashMap<>();

    public EventScoringRunner(EventScoringService scoring, CapacityProperties props, WearableProperties wearable,
                              @Qualifier("applicationTaskExecutor") AsyncTaskExecutor executor,
                              ObjectProvider<Clock> clock) {
        this.scoring = scoring;
        this.props = props;
        this.wearable = wearable;
        this.executor = executor;
        this.clock = clock;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCalendarDaysReplaced(CalendarDaysReplacedEvent event) {
        if (props.enabled()) {
            scoreAhead(event.owner());
        }
    }

    /**
     * The day read's hook: when an event of today..today+{@link #AHEAD_DAYS} among {@code scores} still waits for a
     * model score, start a background run (throttled, single-flight) and return at once.
     */
    public void requestIfUnscored(UUID owner, List<CalendarEventView> events, Map<UUID, EventScore> scores) {
        if (!props.enabled()) {
            return;
        }
        LocalDate today = today();
        LocalDate until = today.plusDays(AHEAD_DAYS);
        boolean waiting = events.stream()
            .filter(e -> !e.date().isBefore(today) && !e.date().isAfter(until))
            .anyMatch(e -> EventScoringService.needsModel(e, scores.get(e.id())));
        if (!waiting) {
            return;
        }
        Instant now = clock().instant();
        Instant last = lastDayTrigger.get(owner);
        if (last != null && last.plus(DAY_TRIGGER_MIN_INTERVAL).isAfter(now)) {
            return;
        }
        lastDayTrigger.put(owner, now);
        try {
            executor.execute(() -> scoreAhead(owner));
        } catch (RuntimeException e) { // the pool refused the task: the next trigger tries again
            lastDayTrigger.remove(owner);
            log.warn("Capacity background scoring could not start: {}", e.getMessage());
        }
    }

    /**
     * Scores today..today+{@link #AHEAD_DAYS} on the calling thread, single-flight per owner: returns at once when a
     * run for this owner is already in progress (that run makes one more pass). Never call it on a request thread.
     */
    public void scoreAhead(UUID owner) {
        boolean[] starter = {false};
        running.compute(owner, (k, v) -> {
            if (v == null) {
                starter[0] = true;
                return Boolean.FALSE;
            }
            return Boolean.TRUE;
        });
        if (!starter[0]) {
            return;
        }
        boolean again;
        do {
            try {
                LocalDate today = today();
                LlmActorContext.runAs(owner, () -> scoring.scoresFor(owner, today, today.plusDays(AHEAD_DAYS)));
            } catch (RuntimeException e) {
                log.warn("Capacity background scoring failed, the rule scores stand: {}", e.getMessage());
            }
            again = running.compute(owner, (k, v) -> Boolean.TRUE.equals(v) ? Boolean.FALSE : null) != null;
        } while (again);
    }

    private LocalDate today() {
        return LocalDate.now(clock().withZone(ZoneId.of(wearable.zone())));
    }

    private Clock clock() {
        return clock.getIfAvailable(Clock::systemUTC);
    }
}
