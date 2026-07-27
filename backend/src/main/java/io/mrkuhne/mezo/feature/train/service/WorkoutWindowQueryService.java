package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the workout windows for a user's given date (mezo-ta8p): the weekly schedule-slot
 * time matched by the date's weekday, its derived end, and a done signal for post-workout gating.
 * Mirrors {@link WeeklyScheduledActivityService}'s repo wiring but groups by weekday. Consumed by
 * the meal scorer (via MealService) to classify a logged meal's pre/post-workout role.
 */
@Service
@RequiredArgsConstructor
public class WorkoutWindowQueryService {

    private final GymScheduleSlotRepository gymRepo;
    private final SportScheduleSlotRepository sportRepo;
    private final RunningBlockRepository runningBlockRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final WorkoutService workoutService;
    private final TrainProperties props;

    /**
     * One workout on a date: schedule start, derived end, kind, whether it was actually done, and
     * a human {@code label} naming it for prose consumers (mezo-mr4n) — the planned meso day's type
     * ("Pull") for gym, the sport for sport, the prescribed session's label for run. Null whenever
     * nothing names it; never invented.
     */
    public record Window(LocalTime start, LocalTime end, String kind, boolean done, String label) {
    }

    @Transactional(readOnly = true)
    public List<Window> windowsFor(UUID userId, LocalDate date) {
        int dow = date.getDayOfWeek().getValue() - 1;   // slot tables use 0=Mon..6=Sun
        List<Window> windows = new ArrayList<>();

        // A gym instance carries a date but no clock time, so a done signal cannot be pinned to a
        // particular slot on a multi-slot day. Only claim done when the completed instances COVER
        // every slot; a partial day leaves them all not-done — a missed recovery bonus beats a
        // fabricated one on the slot that did not actually happen (spec §3.2, mezo-tm76).
        List<GymScheduleSlotEntity> gymSlots = gymRepo
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .filter(s -> s.getDayOfWeek() == dow)
            .toList();
        boolean gymDone = !gymSlots.isEmpty() && workoutSessionRepository
            .findDoneInstancesBetween(userId, date, date).size() >= gymSlots.size();
        // The day's planned meso template names the session ("Pull") — the same resolution the
        // Mai view and quest generation use; absent (no active meso / rest day) leaves it unnamed.
        String gymLabel = workoutService.findPlannedTemplateForDate(userId, date)
            .map(WorkoutSessionEntity::getType)
            .orElse(null);
        gymSlots.forEach(s -> {
            LocalTime start = LocalTime.parse(s.getTime());
            windows.add(new Window(start, start.plusMinutes(props.gymDefaultMinutes()),
                "gym", gymDone, gymLabel));
        });

        addSportWindows(userId, date, dow, windows);

        runningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream()
            .findFirst()
            .ifPresent(block -> addRunWindows(block, date, windows));

        return windows;
    }

    /**
     * The date's sport windows. A LOGGED session is the primary source (spec §3.1): it carries the
     * clock time the sport was actually played plus its duration, and its existence IS the done
     * signal. Each session consumes the recurring slot nearest to it in time, so on a multi-slot day
     * only the slot that was actually played reads done; the slots left over still yield windows
     * (pre-workout fuel looks forward at a plan) but not-done. A session with no time and no
     * matchable slot has no resolvable clock time → no window at all, never a fabricated one.
     */
    private void addSportWindows(UUID userId, LocalDate date, int dow, List<Window> windows) {
        List<SportScheduleSlotEntity> unmatched = new ArrayList<>(
            sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
                .filter(s -> s.getDayOfWeek() == dow)
                .toList());

        for (SportSessionEntity session : sportSessionRepository
            .findByCreatedByAndDeletedFalseAndDateOrderByTimeAsc(userId, date)) {
            SportScheduleSlotEntity slot = nearestSlot(unmatched, session.getTime());
            unmatched.remove(slot);
            String time = session.getTime() != null ? session.getTime()
                : (slot == null ? null : slot.getTime());
            if (time == null) {
                continue;
            }
            LocalTime start = LocalTime.parse(time);
            windows.add(new Window(start, start.plusMinutes(durationOf(session, slot)),
                "sport", true, session.getSport()));
        }

        unmatched.forEach(s -> {
            LocalTime start = LocalTime.parse(s.getTime());
            windows.add(new Window(start, start.plusMinutes(s.getDurationMin()), "sport", false,
                s.getSport()));
        });
    }

    /** The slot closest in time to {@code time} (the first one when the session carries no time). */
    private static SportScheduleSlotEntity nearestSlot(List<SportScheduleSlotEntity> slots, String time) {
        if (slots.isEmpty()) {
            return null;
        }
        if (time == null) {
            return slots.getFirst();
        }
        LocalTime at = LocalTime.parse(time);
        return slots.stream()
            .min(Comparator.comparingLong(
                s -> Math.abs(Duration.between(at, LocalTime.parse(s.getTime())).toMinutes())))
            .orElseThrow();
    }

    /** Played duration, falling back to the slot's planned one, then the configured default. */
    private int durationOf(SportSessionEntity session, SportScheduleSlotEntity slot) {
        if (session.getDurationMin() != null) {
            return session.getDurationMin();
        }
        if (slot != null && slot.getDurationMin() != null) {
            return slot.getDurationMin();
        }
        return props.gymDefaultMinutes();
    }

    /**
     * The date's prescribed run(s) in the block week CONTAINING that date (run windows are pre-only
     * in v1). The week is re-derived from {@code startDate} ({@link MesoWeeks#weekOf}) rather than
     * read off the denormalized {@code currentWeek} column, which lags (default 0 vs the 1-based
     * {@code weekNumber}) and is keyed on today, not on the queried date — the
     * {@code RunningService}/{@code GoalProjectionService} idiom (mezo-tm76).
     */
    private void addRunWindows(RunningBlockEntity block, LocalDate date, List<Window> windows) {
        RunningBlockStructure structure = block.getStructure();
        if (structure == null || structure.weeks() == null) {
            return;
        }
        int dow = date.getDayOfWeek().getValue() - 1;
        int week = MesoWeeks.weekOf(block.getStartDate(), date, block.getWeeks());
        structure.weeks().stream()
            .filter(w -> w.weekNumber() != null && w.weekNumber() == week && w.sessions() != null)
            .flatMap(w -> w.sessions().stream())
            .filter(s -> s.dayOfWeek() != null && s.dayOfWeek() == dow && s.timeOfDay() != null)
            .forEach(s -> {
                LocalTime start = LocalTime.parse(s.timeOfDay());
                windows.add(new Window(start, start.plusMinutes(props.runDefaultMinutes()),
                    "run", false, s.label()));
            });
    }
}
