package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySkipPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySleepPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort.Session;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.PlannedSession;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.SportSlot;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Reads one Monday–Sunday {@link WeekPicture} for the proposal generator and the cross-effect calculator (Boop B7 K3,
 * mezo-r36n9.17): the load model's week, the train windows (ledger applied) split into gym sessions and sport slots,
 * the calendar, the started days, the kímélő days, the raw plan + live moves the accept rules check, and the bedtime
 * in effect per night (the ledger's, else his usual). Read-only; never calls a model.
 */
@Slf4j
@Service
public class WeekPictureService {

    private static final List<String> LIVE = List.of(AdjustmentState.ACTIVE.wire(), AdjustmentState.WAITING.wire());

    private final CapacityDayService days;
    private final CapacityTrainPort train;
    private final CapacityCalendarPort calendar;
    private final CapacitySkipPort skips;
    private final CapacitySleepPort sleep;
    private final LedgerReadAdapter ledger;
    private final DayAdjustmentRepository rows;
    private final WearableProperties wearable;
    private final ObjectProvider<Clock> clock;

    public WeekPictureService(CapacityDayService days, CapacityTrainPort train, CapacityCalendarPort calendar,
                              CapacitySkipPort skips, CapacitySleepPort sleep, LedgerReadAdapter ledger,
                              DayAdjustmentRepository rows, WearableProperties wearable, ObjectProvider<Clock> clock) {
        this.days = days;
        this.train = train;
        this.calendar = calendar;
        this.skips = skips;
        this.sleep = sleep;
        this.ledger = ledger;
        this.rows = rows;
        this.wearable = wearable;
        this.clock = clock;
    }

    /** The week starting {@code monday} (a non-Monday → 400 from {@link CapacityDayService#week}). */
    public WeekPicture picture(UUID owner, LocalDate monday) {
        ZoneId zone = ZoneId.of(wearable.zone());
        LocalDate today = LocalDate.now(clock.getIfAvailable(Clock::systemUTC).withZone(zone));
        LocalDate sunday = monday.plusDays(6);
        List<CapacityDay> week = days.week(owner, monday);

        Map<LocalDate, List<Session>> windows = train.sessions(owner, monday, sunday);
        List<PlannedSession> sessions = new ArrayList<>();
        List<SportSlot> sport = new ArrayList<>();
        Set<LocalDate> rawGym = new HashSet<>();
        Set<LocalDate> skipped = new HashSet<>();
        Set<LocalDate> started = new HashSet<>();
        for (LocalDate d = monday; !d.isAfter(sunday); d = d.plusDays(1)) {
            Optional<UUID> template = train.plannedTemplate(owner, d);
            boolean planned = train.gymPlanned(owner, d);
            if (planned) {
                rawGym.add(d);
                if (skips.gymSkipped(owner, d)) {
                    skipped.add(d);
                }
            }
            boolean running = template.isPresent() && train.workoutRunning(owner, template.get());
            boolean doneToday = false;
            for (Session s : windows.getOrDefault(d, List.of())) {
                if ("gym".equals(s.kind())) {
                    sessions.add(new PlannedSession(planned ? template.orElse(null) : null, d, s.start(),
                        s.durationMin(), s.label(), s.done(), running && !s.done(),
                        CapacityDayService.heavyLabel(s.label())));
                    doneToday |= s.done();
                } else if ("sport".equals(s.kind()) && !s.done()) {
                    sport.add(new SportSlot(d, s.start(), s.durationMin(), s.label()));
                }
            }
            if (d.isBefore(today) || (d.equals(today) && (running || doneToday))) {
                started.add(d);
            }
        }

        Set<LocalDate> claimed = new HashSet<>();
        Set<LocalDate> movedFrom = new HashSet<>();
        for (DayAdjustmentEntity e : rows.findByCreatedByAndStateInAndDeletedFalse(owner, LIVE)) {
            try {
                if (DayAdjustmentService.view(e).payload() instanceof MoveSessionDay m) {
                    claimed.add(m.toDate());
                    movedFrom.add(m.fromDate());
                }
            } catch (RuntimeException ex) { // a malformed row never breaks the week read
                log.warn("Skipping unreadable day adjustment {}: {}", e.getId(), ex.getMessage());
            }
        }

        int need = need(owner);
        LocalTime usual = sleep.usualBedtime(owner);
        Map<LocalDate, LocalTime> bedtimes = new LinkedHashMap<>();
        for (LocalDate d = monday; !d.isAfter(sunday); d = d.plusDays(1)) {
            bedtimes.put(d, ledger.bedtime(owner, d).orElse(usual));
        }

        return new WeekPicture(monday, today, zone, week, List.copyOf(sessions), List.copyOf(sport),
            calendar.events(owner, monday, sunday), Set.copyOf(started),
            !train.recoveryDays(owner, monday, sunday).isEmpty(),
            new WeekPicture.PlanFacts(Set.copyOf(rawGym), Set.copyOf(claimed), Set.copyOf(movedFrom),
                Set.copyOf(skipped)),
            new WeekPicture.Sleep(need, bedtimes));
    }

    private int need(UUID owner) {
        CapacityTrainPort.SlotCounts slots = train.weeklySlots(owner);
        return sleep.needMinutes(owner, slots.gym(), slots.sport());
    }
}
