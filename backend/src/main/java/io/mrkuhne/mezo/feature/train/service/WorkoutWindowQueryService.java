package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.SportEventRepository;
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
import java.util.stream.Stream;
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
    private final SportEventRepository sportEventRepo;
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
     * True when {@code date} carries a SCHEDULE-derived training source (mezo-sxlj Finding 1): a
     * gym schedule slot whose weekday matches, a sport schedule slot likewise, a dated sport EVENT
     * on that date, or a prescribed run session in the active running block's week containing that
     * date — the exact set the FE's {@code deriveBlocks} (buildProtocol.ts) reads to build today's
     * training blocks. Deliberately EXCLUDES logged sessions ({@code WorkoutSessionRepository} done
     * instances, ad-hoc {@link SportSessionRepository} rows with no matching plan) — an ad-hoc
     * logged sport session on an otherwise schedule-free day must NOT flip
     * {@link io.mrkuhne.mezo.feature.meal.service.FuelDayService}'s day-type kcal pick, only a
     * planned/dated training source may. {@link #windowsFor} is untouched and keeps counting logged
     * sessions — that is a different concern (pre/post-workout meal-role scoring).
     */
    @Transactional(readOnly = true)
    public boolean hasScheduledTrainingOn(UUID userId, LocalDate date) {
        int dow = date.getDayOfWeek().getValue() - 1;   // slot tables use 0=Mon..6=Sun
        boolean gymScheduled = gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .anyMatch(s -> s.getDayOfWeek() == dow);
        boolean sportScheduled = sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .anyMatch(s -> s.getDayOfWeek() == dow);
        boolean sportEvent = !sportEventRepo
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscTimeAsc(userId, date, date).isEmpty();
        boolean prescribedRun = runningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
            .stream().findFirst()
            .map(block -> prescribedRunSessionsOn(block, date).findAny().isPresent())
            .orElse(false);
        return gymScheduled || sportScheduled || sportEvent || prescribedRun;
    }

    /** One planned sport occurrence on the date — a weekday-matched recurring slot OR a dated one-off event. */
    private record PlannedSport(String time, Integer durationMin, String sport) {
    }

    /**
     * The date's sport windows. A LOGGED session is the primary source (spec §3.1): it carries the
     * clock time the sport was actually played plus its duration, and its existence IS the done
     * signal. The plan pool holds the weekday-matched recurring slots AND the date's one-off
     * events (mezo-e1sp) alike; each session consumes the planned occurrence nearest to it in
     * time, so on a multi-slot day only the one that was actually played reads done; the ones
     * left over still yield windows (pre-workout fuel looks forward at a plan) but not-done. A
     * session with no time and no matchable plan has no resolvable clock time → no window at
     * all, never a fabricated one.
     */
    private void addSportWindows(UUID userId, LocalDate date, int dow, List<Window> windows) {
        List<PlannedSport> unmatched = new ArrayList<>();
        sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .filter(s -> s.getDayOfWeek() == dow)
            .forEach(s -> unmatched.add(new PlannedSport(s.getTime(), s.getDurationMin(), s.getSport())));
        sportEventRepo.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscTimeAsc(userId, date, date)
            .forEach(e -> unmatched.add(new PlannedSport(e.getTime(), e.getDurationMin(), e.getSport())));

        for (SportSessionEntity session : sportSessionRepository
            .findByCreatedByAndDeletedFalseAndDateOrderByTimeAsc(userId, date)) {
            PlannedSport plan = nearestPlan(unmatched, session.getTime());
            unmatched.remove(plan);
            String time = session.getTime() != null ? session.getTime()
                : (plan == null ? null : plan.time());
            if (time == null) {
                continue;
            }
            LocalTime start = LocalTime.parse(time);
            windows.add(new Window(start, start.plusMinutes(durationOf(session, plan)),
                "sport", true, session.getSport()));
        }

        unmatched.forEach(s -> {
            LocalTime start = LocalTime.parse(s.time());
            windows.add(new Window(start, start.plusMinutes(s.durationMin()), "sport", false,
                s.sport()));
        });
    }

    /** The planned occurrence closest in time to {@code time} (the first when the session carries no time). */
    private static PlannedSport nearestPlan(List<PlannedSport> plans, String time) {
        if (plans.isEmpty()) {
            return null;
        }
        if (time == null) {
            return plans.getFirst();
        }
        LocalTime at = LocalTime.parse(time);
        return plans.stream()
            .min(Comparator.comparingLong(
                s -> Math.abs(Duration.between(at, LocalTime.parse(s.time())).toMinutes())))
            .orElseThrow();
    }

    /** Played duration, falling back to the planned one, then the configured default. */
    private int durationOf(SportSessionEntity session, PlannedSport plan) {
        if (session.getDurationMin() != null) {
            return session.getDurationMin();
        }
        if (plan != null && plan.durationMin() != null) {
            return plan.durationMin();
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
        prescribedRunSessionsOn(block, date).forEach(s -> {
            LocalTime start = LocalTime.parse(s.timeOfDay());
            windows.add(new Window(start, start.plusMinutes(props.runDefaultMinutes()),
                "run", false, s.label()));
        });
    }

    /**
     * The block's prescribed run session(s) matching {@code date}'s weekday, in the block-week
     * CONTAINING that date (see {@link #addRunWindows}'s javadoc for the week-derivation rationale).
     * Shared by {@link #addRunWindows} (builds windows) and {@link #hasScheduledTrainingOn}
     * (existence check only) — one filter, two callers, so they can never disagree on what counts
     * as "today's prescribed run".
     */
    private Stream<RunningBlockStructure.RunPrescribedSession> prescribedRunSessionsOn(
            RunningBlockEntity block, LocalDate date) {
        RunningBlockStructure structure = block.getStructure();
        if (structure == null || structure.weeks() == null) {
            return Stream.empty();
        }
        int dow = date.getDayOfWeek().getValue() - 1;
        int week = MesoWeeks.weekOf(block.getStartDate(), date, block.getWeeks());
        return structure.weeks().stream()
            .filter(w -> w.weekNumber() != null && w.weekNumber() == week && w.sessions() != null)
            .flatMap(w -> w.sessions().stream())
            .filter(s -> s.dayOfWeek() != null && s.dayOfWeek() == dow && s.timeOfDay() != null);
    }
}
