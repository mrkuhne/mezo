package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
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
    private final TrainProperties props;

    /** One workout on a date: schedule start, derived end, kind, and whether it was actually done. */
    public record Window(LocalTime start, LocalTime end, String kind, boolean done) {
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
        gymSlots.forEach(s -> {
            LocalTime start = LocalTime.parse(s.getTime());
            windows.add(new Window(start, start.plusMinutes(props.gymDefaultMinutes()),
                "gym", gymDone));
        });

        boolean sportDone = sportSessionRepository
            .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
            .stream().anyMatch(ss -> date.equals(ss.getDate()));
        sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .filter(s -> s.getDayOfWeek() == dow)
            .forEach(s -> {
                LocalTime start = LocalTime.parse(s.getTime());
                windows.add(new Window(start, start.plusMinutes(s.getDurationMin()),
                    "sport", sportDone));
            });

        runningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream()
            .findFirst()
            .ifPresent(block -> addRunWindows(block, date, windows));

        return windows;
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
                    "run", false));
            });
    }
}
