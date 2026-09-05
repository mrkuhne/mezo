package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.entity.SportEventEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
    private final SportSlotSkipService sportSlotSkipService;
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
     * Batched form of {@link #windowsFor(UUID, LocalDate)} for a whole {@code [from, to]} range
     * (mezo-jcpt.6, filed against {@code DayScoreService#rhythmFreeInputs}): every query the
     * single-date method above fires PER DAY runs ONCE for the whole range here instead — the two
     * USER-GLOBAL lookups the issue named (gym slots, the active running block) plus the sport
     * slots, the active meso's planned sessions, and the three genuinely date-scoped reads (done
     * gym instances, sport events, sport sessions, slot skips), each batched with its own
     * {@code Between}/range finder and grouped in memory per date. Same days, same windows, same
     * {@code done} signal as calling {@link #windowsFor(UUID, LocalDate)} once per date — only the
     * query count changes (a week read: ~14 single-date calls, ~90 statements, down to ~8 total).
     */
    @Transactional(readOnly = true)
    public Map<LocalDate, List<Window>> windowsFor(UUID userId, LocalDate from, LocalDate to) {
        List<GymScheduleSlotEntity> gymSlots =
            gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId);
        Map<LocalDate, Long> gymDoneCounts = workoutSessionRepository
            .findDoneInstancesBetween(userId, from, to).stream()
            .collect(Collectors.groupingBy(WorkoutSessionEntity::getDate, Collectors.counting()));
        List<WorkoutSessionEntity> mesoSessions = workoutService.activeMesoSessions(userId);
        List<SportScheduleSlotEntity> sportSlots =
            sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId);
        Map<LocalDate, List<SportEventEntity>> sportEventsByDate = sportEventRepo
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscTimeAsc(userId, from, to).stream()
            .collect(Collectors.groupingBy(SportEventEntity::getDate));
        Map<LocalDate, List<SportSessionEntity>> sportSessionsByDate = sportSessionRepository
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(userId, from, to).stream()
            .collect(Collectors.groupingBy(SportSessionEntity::getDate));
        Set<SportSlotSkipService.SkipKey> skips = sportSlotSkipService.skipsBetween(userId, from, to);
        RunningBlockEntity activeBlock = runningBlockRepository
            .findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream().findFirst().orElse(null);

        Map<LocalDate, List<Window>> result = new LinkedHashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            result.put(day, windowsForDay(day, gymSlots, gymDoneCounts, mesoSessions, sportSlots,
                sportEventsByDate.getOrDefault(day, List.of()),
                sportSessionsByDate.getOrDefault(day, List.of()), skips, activeBlock));
        }
        return result;
    }

    /** One day's windows built entirely from pre-fetched, range-batched data — no query inside
     *  this method or anything it calls; the shared per-day resolution both {@link #windowsFor(UUID,
     *  LocalDate, LocalDate)} and (via its own fetches) {@link #windowsFor(UUID, LocalDate)} apply. */
    private List<Window> windowsForDay(LocalDate date, List<GymScheduleSlotEntity> gymSlots,
            Map<LocalDate, Long> gymDoneCounts, List<WorkoutSessionEntity> mesoSessions,
            List<SportScheduleSlotEntity> sportSlots, List<SportEventEntity> dayEvents,
            List<SportSessionEntity> daySessions, Set<SportSlotSkipService.SkipKey> skips,
            RunningBlockEntity activeBlock) {
        int dow = date.getDayOfWeek().getValue() - 1;
        List<Window> windows = new ArrayList<>();

        List<GymScheduleSlotEntity> todaysGymSlots =
            gymSlots.stream().filter(s -> s.getDayOfWeek() == dow).toList();
        boolean gymDone = !todaysGymSlots.isEmpty()
            && gymDoneCounts.getOrDefault(date, 0L) >= todaysGymSlots.size();
        String gymLabel = workoutService.findPlannedTemplateForDate(mesoSessions, date)
            .map(WorkoutSessionEntity::getType)
            .orElse(null);
        todaysGymSlots.forEach(s -> {
            LocalTime start = LocalTime.parse(s.getTime());
            windows.add(new Window(start, start.plusMinutes(props.gymDefaultMinutes()),
                "gym", gymDone, gymLabel));
        });

        addSportWindowsForDay(date, dow, sportSlots, dayEvents, daySessions, skips, windows);

        if (activeBlock != null) {
            addRunWindows(activeBlock, date, windows);
        }
        return windows;
    }

    /** Ranged sibling of {@link #addSportWindows}: same nearest-match resolution, sourced from a
     *  range fetch's already-grouped-by-date data instead of a per-date query. {@code daySessions}
     *  is sorted here by clock time — {@code findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc}
     *  only orders by date, not by time within a date, unlike the single-date finder. */
    private void addSportWindowsForDay(LocalDate date, int dow, List<SportScheduleSlotEntity> sportSlots,
            List<SportEventEntity> dayEvents, List<SportSessionEntity> daySessions,
            Set<SportSlotSkipService.SkipKey> skips, List<Window> windows) {
        List<PlannedSport> unmatched = new ArrayList<>();
        sportSlots.stream()
            .filter(s -> s.getDayOfWeek() == dow)
            .filter(s -> !skips.contains(new SportSlotSkipService.SkipKey(dow, s.getTime(), date)))
            .forEach(s -> unmatched.add(new PlannedSport(s.getTime(), s.getDurationMin(), s.getSport())));
        dayEvents.forEach(e -> unmatched.add(new PlannedSport(e.getTime(), e.getDurationMin(), e.getSport())));

        List<SportSessionEntity> sessions = daySessions.stream()
            .sorted(Comparator.comparing(SportSessionEntity::getTime,
                Comparator.nullsFirst(Comparator.naturalOrder())))
            .toList();
        for (SportSessionEntity session : sessions) {
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
            .filter(s -> s.getDayOfWeek() == dow)
            .anyMatch(s -> !sportSlotSkipService.isSkipped(userId, dow, s.getTime(), date));
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
            .filter(s -> !sportSlotSkipService.isSkipped(userId, dow, s.getTime(), date))
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
