package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.entity.SportEventEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.SportEventRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.math.BigDecimal;
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
import java.util.function.Supplier;
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
    private final RunSessionLogRepository runSessionLogRepository;
    private final WorkoutService workoutService;
    private final SportSlotSkipService sportSlotSkipService;
    private final TrainProperties props;
    private final ActivityEnergyModel activityEnergyModel;
    private final AthleteBodyPort athleteBodyPort;

    /**
     * One workout on a date: schedule start, derived end, kind, whether it was actually done, and
     * a human {@code label} naming it for prose consumers (mezo-mr4n) — the planned meso day's type
     * ("Pull") for gym, the sport for sport, the prescribed session's label for run. Null whenever
     * nothing names it; never invented.
     */
    public record Window(LocalTime start, LocalTime end, String kind, boolean done, String label) {
    }

    /**
     * One date's windows — delegates to the ranged {@link #windowsFor(UUID, LocalDate, LocalDate)}
     * with a one-day range (mezo-jcpt.6 F1: a hand-duplicated per-day implementation was how the
     * F2 sort-order parity bug happened — a single resolution path makes that drift structurally
     * impossible). {@code MealCoachService} and {@code MealService} are the real per-date callers;
     * they now pay one range-shaped query set sized for a single day, same as before.
     */
    @Transactional(readOnly = true)
    public List<Window> windowsFor(UUID userId, LocalDate date) {
        return windowsFor(userId, date, date).get(date);
    }

    /**
     * Batched form of {@link #windowsFor(UUID, LocalDate)} — now the ONLY resolution path (mezo-
     * jcpt.6 F1) — for a whole {@code [from, to]} range: every query fires ONCE for the whole
     * range instead of once per date — the two USER-GLOBAL lookups the issue named (gym slots, the
     * active running block) plus the sport slots, the active meso's planned sessions, and the
     * three genuinely date-scoped reads (done gym instances, sport events, sport sessions, slot
     * skips), each batched with its own {@code Between}/range finder and grouped in memory per
     * date. Same days, same windows, same {@code done} signal as the single-date overload used to
     * produce calling it once per date — only the query count changes (a week read: ~14 single-date
     * calls, ~90 statements, down to ~8 total).
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
     *  this method or anything it calls; the ONE resolution path {@link #windowsFor(UUID,
     *  LocalDate, LocalDate)} applies per date in its range ({@link #windowsFor(UUID, LocalDate)}
     *  is a one-day-range call into the same method, mezo-jcpt.6 F1). */
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

    /**
     * The date's sport windows. A LOGGED session is the primary source (spec §3.1): it carries the
     * clock time the sport was actually played plus its duration, and its existence IS the done
     * signal. The plan pool holds the weekday-matched recurring slots AND the date's one-off
     * events (mezo-e1sp) alike; each session consumes the planned occurrence nearest to it in
     * time, so on a multi-slot day only the one that was actually played reads done; the ones
     * left over still yield windows (pre-workout fuel looks forward at a plan) but not-done. A
     * session with no time and no matchable plan has no resolvable clock time → no window at
     * all, never a fabricated one.
     *
     * <p>Sourced from a range fetch's already-grouped-by-date data instead of a per-date query;
     * {@code daySessions} is sorted here by clock time — {@code
     * findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc} only orders by date, not by
     * time within a date, unlike the single-date finder it replaced. That sort order is
     * load-bearing (mezo-jcpt.6 F2): it decides which session {@link #nearestPlan} hands the
     * unmatched plan to, which in turn decides {@code done}/label per window. A null clock time
     * (nullable column; no writer sets it today, but nothing stops a legacy/seeded row) must sort
     * LAST, matching Postgres's default {@code ORDER BY time ASC} = {@code NULLS LAST} that the
     * single-date finder relied on — {@code nullsFirst} here would silently reorder which session
     * wins the match for exactly that row.
     */
    private void addSportWindowsForDay(LocalDate date, int dow, List<SportScheduleSlotEntity> sportSlots,
            List<SportEventEntity> dayEvents, List<SportSessionEntity> daySessions,
            Set<SportSlotSkipService.SkipKey> skips, List<Window> windows) {
        List<PlannedSport> unmatched = plannedSportPool(date, dow, sportSlots, dayEvents, skips);
        List<SportSessionEntity> sessions = byTimeNullsLast(daySessions);
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
     * The date's planned-sport pool (mezo-jcpt.6 / mezo-32m82): the weekday-matched recurring
     * slots NOT skipped on this date, plus the date's one-off events — the single builder both
     * {@link #addSportWindowsForDay} and {@link #movementOn} consume, so the two can never drift
     * apart the way the F2 nulls-order parity bug happened from a hand-duplicated per-day path.
     */
    private List<PlannedSport> plannedSportPool(LocalDate date, int dow, List<SportScheduleSlotEntity> slots,
            List<SportEventEntity> events, Set<SportSlotSkipService.SkipKey> skips) {
        List<PlannedSport> pool = new ArrayList<>();
        slots.stream()
            .filter(s -> s.getDayOfWeek() == dow)
            .filter(s -> !skips.contains(new SportSlotSkipService.SkipKey(dow, s.getTime(), date)))
            .forEach(s -> pool.add(new PlannedSport(s.getTime(), s.getDurationMin(), s.getSport())));
        events.forEach(e -> pool.add(new PlannedSport(e.getTime(), e.getDurationMin(), e.getSport())));
        return pool;
    }

    /** {@code sessions} sorted by clock time, a null time sorting LAST — matching Postgres's
     *  default {@code ORDER BY time ASC} (mezo-jcpt.6 F2; see {@link #addSportWindowsForDay}'s
     *  javadoc for why nulls-first would silently reorder which session wins a plan match). */
    private static List<SportSessionEntity> byTimeNullsLast(List<SportSessionEntity> sessions) {
        return sessions.stream()
            .sorted(Comparator.comparing(SportSessionEntity::getTime,
                Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    }

    /**
     * One date's movement (mezo-32m82, spec §5): was the day's PLANNED training done, and how many
     * kcal of UNPLANNED ("extra") movement it held. {@code NONE} is the all-false/all-zero case.
     * Replaces {@code hasLoggedTrainingOn} (mezo-u13jv) — see {@link #movementOn}'s javadoc for the
     * owner decisions behind the split.
     */
    public record DayMovement(boolean plannedDone, int extraKcal) {
        public static final DayMovement NONE = new DayMovement(false, 0);
    }

    /**
     * Was the day's PLANNED training done, and how many kcal of UNPLANNED movement did it hold
     * (mezo-32m82, spec §5, replacing {@code hasLoggedTrainingOn} from mezo-u13jv). Owner decisions
     * D2–D4: a planned session's energy is already priced into the weekly base (the weekly
     * schedule-derived EAT), so only PLANNED adherence is allowed to flip the day-type kcal pick —
     * a logged session that fulfils no plan is credited separately as EXTRA kcal, and a planned
     * session that was never done is not deducted (no negative credit for a miss).
     *
     * <p>Gym: a completed instance is PLANNED when it is meso-origin AND the weekday has a gym
     * slot AND fewer meso instances than slots have already been counted planned that day; every
     * other completed instance (custom origin, no slot that weekday, or beyond the slot count) is
     * EXTRA, estimated via {@link ActivityEnergyModel#netKcal}. Sport: the planned pool is built
     * exactly as {@link #addSportWindowsForDay} does (weekday slots minus skips, plus the date's
     * one-off events); each session consumes the {@link #nearestPlan}, a match is planned, a miss
     * is extra at its own persisted (never invented) kcal. Run: the active block's prescribed
     * sessions on the date are filled by the date's logged runs first; any logged run beyond that
     * count is extra at its persisted kcal. {@code plannedDone} is true when ANY of the three kinds
     * matched a plan; {@code extraKcal} sums every kind's extras. The athlete's rest-kcal/hour is
     * looked up at most once, lazily, only when an extra gym instance actually exists — an unknown
     * body contributes 0, never a fabricated estimate.
     */
    @Transactional(readOnly = true)
    public DayMovement movementOn(UUID userId, LocalDate date) {
        return movementBetween(userId, date, date).get(date);
    }

    /**
     * Batched form of {@link #movementOn} — the ONLY resolution path (the mezo-jcpt.6 F1 lesson
     * applied to movement): every source is fetched ONCE for {@code [from, to]} (gym slots, done
     * gym instances, sport slots, sport events, sport sessions, slot skips, the active running
     * block, run logs), grouped per date in memory, and each date is resolved by
     * {@link #movementForDay} with exactly the per-day rules {@link #movementOn}'s javadoc states.
     * The athlete body (rest-kcal/hour) is looked up at most once for the whole range — as of
     * {@code to}, lazily, only when an extra gym instance exists; over a multi-week range that is a
     * deliberate approximation (one body for the range, a few kcal on an extra gym day at most). Every date in the range is present in the result
     * ({@link DayMovement#NONE} when nothing moved). Callers: the Fuel week rollup and the
     * character meal-day reads (mezo-32m82 — 8 trend weeks would otherwise be ~56 single-date
     * query sets).
     */
    @Transactional(readOnly = true)
    public Map<LocalDate, DayMovement> movementBetween(UUID userId, LocalDate from, LocalDate to) {
        List<GymScheduleSlotEntity> gymSlots =
            gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId);
        Map<LocalDate, List<WorkoutSessionEntity>> doneByDate = workoutSessionRepository
            .findDoneInstancesBetween(userId, from, to).stream()
            .collect(Collectors.groupingBy(WorkoutSessionEntity::getDate));
        List<SportScheduleSlotEntity> sportSlots =
            sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId);
        Map<LocalDate, List<SportEventEntity>> eventsByDate = sportEventRepo
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscTimeAsc(userId, from, to).stream()
            .collect(Collectors.groupingBy(SportEventEntity::getDate));
        Map<LocalDate, List<SportSessionEntity>> sportSessionsByDate = sportSessionRepository
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(userId, from, to).stream()
            .collect(Collectors.groupingBy(SportSessionEntity::getDate));
        Set<SportSlotSkipService.SkipKey> skips = sportSlotSkipService.skipsBetween(userId, from, to);
        RunningBlockEntity activeBlock = runningBlockRepository
            .findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream().findFirst().orElse(null);
        Map<LocalDate, List<RunSessionLogEntity>> runsByDate = runSessionLogRepository
            .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(userId, from, to).stream()
            .collect(Collectors.groupingBy(RunSessionLogEntity::getDate));

        // Looked up at most once for the whole range, and only if an extra gym instance needs it.
        Supplier<BigDecimal> restKcalPerHour = new Supplier<>() {
            private boolean loaded;
            private BigDecimal value;

            @Override
            public BigDecimal get() {
                if (!loaded) {
                    value = athleteBodyPort.bodyAt(userId, to)
                        .flatMap(b -> ActivityEnergyModel.restKcalPerHour(b.bmrKcal(), b.weightKg()))
                        .orElse(null);
                    loaded = true;
                }
                return value;
            }
        };

        Map<LocalDate, DayMovement> result = new LinkedHashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            result.put(day, movementForDay(day, gymSlots, doneByDate.getOrDefault(day, List.of()),
                sportSlots, eventsByDate.getOrDefault(day, List.of()),
                sportSessionsByDate.getOrDefault(day, List.of()), skips, activeBlock,
                runsByDate.getOrDefault(day, List.of()), restKcalPerHour));
        }
        return result;
    }

    /** One date's movement from pre-fetched, range-batched data — no query in here except the lazy,
     *  range-memoized body lookup; the per-day rules are documented on {@link #movementOn}. */
    private DayMovement movementForDay(LocalDate date, List<GymScheduleSlotEntity> gymSlots,
            List<WorkoutSessionEntity> doneInstances, List<SportScheduleSlotEntity> sportSlots,
            List<SportEventEntity> dayEvents, List<SportSessionEntity> daySessions,
            Set<SportSlotSkipService.SkipKey> skips, RunningBlockEntity activeBlock,
            List<RunSessionLogEntity> dayRuns, Supplier<BigDecimal> restKcalPerHour) {
        int dow = date.getDayOfWeek().getValue() - 1;
        boolean plannedDone = false;
        int extraKcal = 0;

        // Gym.
        long gymSlotCount = gymSlots.stream().filter(s -> s.getDayOfWeek() == dow).count();
        long plannedGymCount = 0;
        for (WorkoutSessionEntity instance : doneInstances) {
            boolean planned = "meso".equals(instance.getOrigin()) && plannedGymCount < gymSlotCount;
            if (planned) {
                plannedGymCount++;
                plannedDone = true;
                continue;
            }
            extraKcal += activityEnergyModel
                .netKcal("gym", null, gymMinutes(instance), restKcalPerHour.get()).orElse(0);
        }

        // Sport — the same planned pool + nearest-match consumption as addSportWindowsForDay.
        List<PlannedSport> unmatchedSport = plannedSportPool(date, dow, sportSlots, dayEvents, skips);
        for (SportSessionEntity session : byTimeNullsLast(daySessions)) {
            PlannedSport plan = nearestPlan(unmatchedSport, session.getTime());
            if (plan != null) {
                unmatchedSport.remove(plan);
                plannedDone = true;
            } else {
                extraKcal += session.getKcal() != null ? session.getKcal() : 0;
            }
        }

        // Run — the block's prescribed sessions on the date, filled by the date's logged runs first.
        long prescribedRunCount = activeBlock == null ? 0 : prescribedRunSessionsOn(activeBlock, date).count();
        long plannedRunCount = 0;
        for (RunSessionLogEntity run : dayRuns) {
            if (plannedRunCount < prescribedRunCount) {
                plannedRunCount++;
                plannedDone = true;
            } else {
                extraKcal += run.getKcal() != null ? run.getKcal() : 0;
            }
        }

        return new DayMovement(plannedDone, extraKcal); // a record: value-equal to NONE when both are false/0
    }

    /** Minutes for an EXTRA gym instance's net-kcal estimate: derived work time when known, else
     *  the wall-clock span clamped to a sane [0, 150], else the configured default (spec §5.2). */
    private int gymMinutes(WorkoutSessionEntity instance) {
        if (instance.getActiveSeconds() != null) {
            return instance.getActiveSeconds() / 60;
        }
        if (instance.getStartedAt() != null && instance.getFinishedAt() != null) {
            long minutes = Duration.between(instance.getStartedAt(), instance.getFinishedAt()).toMinutes();
            return (int) Math.max(0, Math.min(150, minutes));
        }
        return props.gymDefaultMinutes();
    }

    /** One planned sport occurrence on the date — a weekday-matched recurring slot OR a dated one-off event. */
    private record PlannedSport(String time, Integer durationMin, String sport) {
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
     * Used by {@link #addRunWindows} to build the day's run windows.
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
