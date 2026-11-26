package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInSavedEvent;
import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityLiveStateEntity;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort.Session;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityLiveStateRepository;
import io.mrkuhne.mezo.feature.capacity.service.ProposalService.Stored;
import io.mrkuhne.mezo.feature.meal.service.MealSavedEvent;
import io.mrkuhne.mezo.feature.train.service.SportSessionLoggedEvent;
import io.mrkuhne.mezo.feature.train.service.WorkoutFinishedEvent;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.service.CalendarDaysReplacedEvent;
import io.mrkuhne.mezo.feature.wearable.service.DailyMetricsIngestedEvent;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
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
 * The live re-plan loop (Boop B7 K3, mezo-r36n9.17, spec §5.5 "élő"): when the day gets worse, Boop proposes a
 * today-change. Triggered after commit ({@code @Async}, never on the request thread) by everything that can change
 * today's load or capacity — a check-in, a finished workout, a logged sport session, a calendar PUT, a logged meal and
 * an Apple Health day-totals batch (only one that carries today or yesterday — a backfill of older days is skipped).
 *
 * <p>On a trigger it re-reads TODAY (his zone, the injected clock) through the model-free day path
 * ({@link CapacityDayService#history}: stored or rule scores, never a model call) and whether today's gym session now
 * collides with a timed calendar event. Then, in its own transaction under the owner's {@link CapacityLock}, against
 * the last stored state for today ({@code capacity_live_state}):
 * <ul>
 *   <li>a new day (or no state yet) compares against an implicit "rendben, no collision" reading, so a day already
 *       szoros / túl sok or colliding at its first trigger is treated as worse;</li>
 *   <li>the verdict is worse by at least one step, or the session started colliding → a today-proposal
 *       ({@link ProposalService#proposeToday}, template words; the model rephrase runs in the background after
 *       commit) — at most one per {@code mezo.capacity.live.min-interval};</li>
 *   <li>otherwise the reading replaces the stored one (a better day lowers the bar for the next worsening).</li>
 * </ul>
 * A worsening held back by the interval leaves the stored reading as it was, so the next trigger after the interval
 * still sees the day as worse. Never throws out of the listener.
 */
@Slf4j
@Component
public class LiveReplanListener {

    private static final Map<String, Integer> STEP = Map.of("laza", 0, "rendben", 1, "szoros", 2, "túl sok", 3);

    private final CapacityDayService days;
    private final CapacityTrainPort train;
    private final CapacityCalendarPort calendar;
    private final CapacityLiveStateRepository states;
    private final ProposalService proposals;
    private final CapacityLock lock;
    private final CapacityProperties props;
    private final WearableProperties wearable;
    private final ObjectProvider<Clock> clock;
    private final TransactionTemplate tx;

    public LiveReplanListener(CapacityDayService days, CapacityTrainPort train, CapacityCalendarPort calendar,
                              CapacityLiveStateRepository states, ProposalService proposals, CapacityLock lock,
                              CapacityProperties props, WearableProperties wearable, ObjectProvider<Clock> clock,
                              PlatformTransactionManager txManager) {
        this.days = days;
        this.train = train;
        this.calendar = calendar;
        this.states = states;
        this.proposals = proposals;
        this.lock = lock;
        this.props = props;
        this.wearable = wearable;
        this.clock = clock;
        this.tx = new TransactionTemplate(txManager);
    }

    // ── triggers ──────────────────────────────────────────────────────────────

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCheckIn(CheckInSavedEvent event) {
        replan(event.userId());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onWorkoutFinished(WorkoutFinishedEvent event) {
        replan(event.createdBy());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSportSession(SportSessionLoggedEvent event) {
        replan(event.userId());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCalendar(CalendarDaysReplacedEvent event) {
        replan(event.owner());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMeal(MealSavedEvent event) {
        replan(event.userId());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDailyMetrics(DailyMetricsIngestedEvent event) {
        // a Health backfill batch (old days only) cannot change today: no pass
        LocalDate today = today();
        if (event.dates().contains(today) || event.dates().contains(today.minusDays(1))) {
            replan(event.owner());
        }
    }

    private LocalDate today() {
        return LocalDate.now(clock.getIfAvailable(Clock::systemUTC).withZone(ZoneId.of(wearable.zone())));
    }

    // ── the loop ──────────────────────────────────────────────────────────────

    /** One pass for {@code owner}; never throws (a failed pass leaves the stored state and the proposals as they were). */
    void replan(UUID owner) {
        if (!props.enabled() || owner == null) {
            return;
        }
        try {
            ZoneId zone = ZoneId.of(wearable.zone());
            Clock c = clock.getIfAvailable(Clock::systemUTC);
            LocalDate today = LocalDate.now(c.withZone(zone));
            String verdict = days.history(owner, today, today).get(0).day().verdict();
            boolean collides = sessionCollides(owner, today);
            List<Stored> stored = tx.execute(s -> decide(owner, today, verdict, collides, c.instant()));
            if (stored != null && !stored.isEmpty()) {
                proposals.rephraseLater(owner, stored);
            }
        } catch (RuntimeException e) {
            log.warn("Live re-plan failed, today stays as it was: {}", e.getMessage());
        }
    }

    /** Inside the transaction, the owner's lock first: compare, maybe propose, remember. */
    private List<Stored> decide(UUID owner, LocalDate today, String verdict, boolean collides, Instant now) {
        lock.lock(owner);
        CapacityLiveStateEntity state = states.findByCreatedByAndDeletedFalse(owner).orElseGet(() -> {
            CapacityLiveStateEntity fresh = new CapacityLiveStateEntity();
            fresh.setCreatedBy(owner);
            return fresh;
        });
        // a new day (or the first ever reading) compares against an implicit "rendben, no collision": a day already
        // szoros / túl sok or colliding at its first trigger still gets its today-change
        boolean newDay = state.getId() == null || !today.equals(state.getDay());
        int before = newDay ? STEP.get("rendben") : step(state.getVerdict());
        boolean worse = step(verdict) > before;
        boolean broke = collides && (newDay || !state.isCollides());
        List<Stored> stored = List.of();
        if (worse || broke) {
            if (limited(state, now)) {
                return List.of(); // held back: the stored reading stays, so the next trigger after the interval sees it
            }
            stored = proposals.proposeToday(owner, today);
            if (stored.stream().anyMatch(x -> today.equals(x.built().day()))) {
                state.setProposedAt(now);
            }
        }
        state.setDay(today);
        state.setVerdict(verdict);
        state.setCollides(collides);
        state.setUpdatedAt(now);
        states.save(state);
        return stored;
    }

    private boolean limited(CapacityLiveStateEntity state, Instant now) {
        return state.getProposedAt() != null
            && state.getProposedAt().plus(props.live().minInterval()).isAfter(now);
    }

    /** Whether a still-planned gym session of today overlaps a timed calendar event of today. */
    private boolean sessionCollides(UUID owner, LocalDate today) {
        List<Session> gym = train.sessions(owner, today, today).getOrDefault(today, List.of()).stream()
            .filter(s -> "gym".equals(s.kind()) && !s.done() && s.start() != null)
            .toList();
        if (gym.isEmpty()) {
            return false;
        }
        ZoneId zone = ZoneId.of(wearable.zone());
        List<CalendarEventView> events = calendar.events(owner, today, today).stream()
            .filter(e -> !e.allDay() && e.start() != null && e.end() != null)
            .toList();
        return gym.stream().anyMatch(s -> {
            Instant a = today.atTime(s.start()).atZone(zone).toInstant();
            Instant b = a.plusSeconds(60L * s.durationMin());
            return events.stream().anyMatch(e -> e.start().isBefore(b) && e.end().isAfter(a));
        });
    }

    static int step(String verdict) {
        return verdict == null ? -1 : STEP.getOrDefault(verdict, -1);
    }
}
