package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.service.CalendarDaysReplacedEvent;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Watches the calendar sync for the owner's accepted calendar to-dos (Boop B7 K3, mezo-r36n9.17, decision #68 — Boop
 * never writes his calendar, it only notices that he did the thing). After a calendar PUT
 * ({@link CalendarDaysReplacedEvent}, AFTER_COMMIT + {@code @Async}, its own transaction under the owner's
 * {@link CapacityLock} so it cannot race an undo or an accept) every {@code waiting} to-do is checked against the
 * synced events:
 * <ul>
 *   <li>{@code move} → {@code done} when a live event with the same key now starts at the agreed time
 *       (±{@link #TOLERANCE}, client rounding) and no other occurrence of it is left on the original day;</li>
 *   <li>{@code cancel} → {@code done} when no live event with that key remains on that day (only judged when the PUT
 *       carried that day — a missing sync is not a cancellation).</li>
 * </ul>
 * Then the stale sweep runs, so a to-do whose day passed expires. Only {@code waiting} rows are touched: an expired,
 * undone or done row is never resurrected. Never throws out of the listener.
 */
@Slf4j
@Component
public class CalendarTodoWatcher {

    static final Duration TOLERANCE = Duration.ofMinutes(5);

    private final DayAdjustmentRepository rows;
    private final CapacityCalendarPort calendar;
    private final DayAdjustmentService ledger;
    private final CapacityLock lock;
    private final WearableProperties wearable;
    private final ObjectProvider<Clock> clock;
    private final TransactionTemplate tx;

    public CalendarTodoWatcher(DayAdjustmentRepository rows, CapacityCalendarPort calendar, DayAdjustmentService ledger,
                               CapacityLock lock, WearableProperties wearable, ObjectProvider<Clock> clock,
                               PlatformTransactionManager txManager) {
        this.rows = rows;
        this.calendar = calendar;
        this.ledger = ledger;
        this.lock = lock;
        this.wearable = wearable;
        this.clock = clock;
        this.tx = new TransactionTemplate(txManager);
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCalendarDaysReplaced(CalendarDaysReplacedEvent event) {
        try {
            tx.executeWithoutResult(status -> watch(event.owner(), Set.copyOf(event.dates())));
        } catch (RuntimeException e) {
            log.warn("Calendar to-do watch failed, the to-dos stay as they were: {}", e.getMessage());
        }
    }

    void watch(UUID owner, Set<LocalDate> synced) {
        lock.lock(owner);
        ZoneId zone = ZoneId.of(wearable.zone());
        Instant now = clock.getIfAvailable(Clock::systemUTC).instant();
        List<DayAdjustmentEntity> changed = new ArrayList<>();
        for (DayAdjustmentEntity row : rows.findByCreatedByAndStateInAndDeletedFalse(owner,
            List.of(AdjustmentState.WAITING.wire()))) {
            if (!(DayAdjustmentService.view(row).payload() instanceof AdjustmentPayload.CalendarTodo todo)) {
                continue;
            }
            if (resolved(owner, todo, synced, zone)) {
                row.setState(AdjustmentState.DONE.wire());
                row.setUpdatedAt(now);
                changed.add(row);
            }
        }
        rows.saveAll(changed);
        ledger.expireStale(owner, LocalDate.now(clock.getIfAvailable(Clock::systemUTC).withZone(zone)));
    }

    private boolean resolved(UUID owner, AdjustmentPayload.CalendarTodo todo, Set<LocalDate> synced, ZoneId zone) {
        if ("cancel".equals(todo.action())) {
            return synced.contains(todo.date()) && keyed(owner, todo, todo.date(), todo.date()).isEmpty();
        }
        LocalDate toDay = todo.toStart().atZone(zone).toLocalDate();
        if (!synced.contains(toDay) && !synced.contains(todo.date())) {
            return false;
        }
        LocalDate from = todo.date().isBefore(toDay) ? todo.date() : toDay;
        LocalDate to = todo.date().isAfter(toDay) ? todo.date() : toDay;
        List<CalendarEventView> live = keyed(owner, todo, from, to);
        boolean atNewTime = live.stream().anyMatch(e -> near(e.start(), todo.toStart()));
        boolean originalLeft = live.stream()
            .anyMatch(e -> e.date().equals(todo.date()) && !near(e.start(), todo.toStart()));
        return atNewTime && !originalLeft;
    }

    private List<CalendarEventView> keyed(UUID owner, AdjustmentPayload.CalendarTodo todo, LocalDate from,
                                          LocalDate to) {
        return calendar.events(owner, from, to).stream()
            .filter(e -> todo.eventKey().equals(EventScoringService.eventKey(e.externalId())))
            .toList();
    }

    private static boolean near(Instant start, Instant agreed) {
        return start != null && Duration.between(start, agreed).abs().compareTo(TOLERANCE) <= 0;
    }
}
