package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * One Monday–Sunday week as the proposal generator sees it (Boop B7 K3, mezo-r36n9.17): the load model's seven days
 * ({@link CapacityDayService#week}), the gym sessions and sport slots as the train windows resolve them (ledger
 * already applied), the calendar, the days that have started, whether a kímélő period touches the week, the raw-plan
 * facts the accept rules need ({@link PlanFacts}) and the sleep side (need + the bedtime in effect per night).
 * Built by {@link WeekPictureService}; tests build it by hand.
 *
 * @param today his today ({@code mezo.wearable.zone})
 * @param zone  his zone (session clock times → instants)
 */
public record WeekPicture(LocalDate monday, LocalDate today, ZoneId zone, List<CapacityDay> days,
                          List<PlannedSession> sessions, List<SportSlot> sport, List<CalendarEventView> events,
                          Set<LocalDate> startedDays, boolean recovery, PlanFacts plan, Sleep sleep) {

    /**
     * One gym session of the week. {@code templateId} = the RAW plan's meso template of that date (null when the date
     * has no meso day — such a session can be shortened or skipped but not moved). {@code heavy} = a heavy lower-body
     * day ({@link CapacityDayService#heavyLabel}).
     */
    public record PlannedSession(UUID templateId, LocalDate date, LocalTime start, int minutes, String label,
                                 boolean done, boolean running, boolean heavy) {
    }

    /** One still-planned sport occurrence. */
    public record SportSlot(LocalDate date, LocalTime start, int minutes, String label) {
    }

    /**
     * The raw-plan facts of {@link AdjustmentRules}: weekdays the plan puts a gym session on, days already the target
     * / the origin of a live move, and days whose gym session is skipped.
     */
    public record PlanFacts(Set<LocalDate> rawGymDays, Set<LocalDate> claimedTargets, Set<LocalDate> movedFrom,
                            Set<LocalDate> skippedDays) {
    }

    /** His nightly need ({@code SleepNeedRule}) and the bedtime in effect per night (the ledger's, else his usual). */
    public record Sleep(int needMin, Map<LocalDate, LocalTime> bedtimes) {
    }

    public LocalDate sunday() {
        return monday.plusDays(6);
    }

    public Optional<CapacityDay> day(LocalDate date) {
        return days.stream().filter(d -> d.date().equals(date)).findFirst();
    }

    public List<PlannedSession> sessionsOn(LocalDate date) {
        return sessions.stream().filter(s -> s.date().equals(date)).toList();
    }

    /** A day the generator may still change: in this week, today or later, and not started. */
    public boolean open(LocalDate date) {
        return !date.isBefore(today) && !date.isBefore(monday) && !date.isAfter(sunday())
            && !startedDays.contains(date);
    }

    /** The accept rules' view of this picture — the same answers the raw-plan ports give on accept. */
    public AdjustmentRules.PlanView planView() {
        return new AdjustmentRules.PlanView() {
            @Override public boolean gymPlanned(LocalDate date) { return plan.rawGymDays().contains(date); }
            @Override public boolean gymDoneOn(LocalDate date) {
                return sessionsOn(date).stream().anyMatch(PlannedSession::done);
            }
            @Override public Optional<UUID> plannedTemplate(LocalDate date) {
                return sessionsOn(date).stream().map(PlannedSession::templateId).filter(java.util.Objects::nonNull)
                    .findFirst();
            }
            @Override public boolean ownsTemplate(UUID id) {
                return sessions.stream().anyMatch(s -> id.equals(s.templateId()));
            }
            @Override public boolean workoutRunning(UUID id) {
                return sessions.stream().anyMatch(s -> id.equals(s.templateId()) && s.running());
            }
            @Override public boolean gymSkipped(LocalDate date) { return plan.skippedDays().contains(date); }
        };
    }
}
