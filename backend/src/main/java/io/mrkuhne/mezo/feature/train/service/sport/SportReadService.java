package io.mrkuhne.mezo.feature.train.service.sport;

import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.SportBlock;
import io.mrkuhne.mezo.api.dto.SportBodyResponse;
import io.mrkuhne.mezo.api.dto.SportGapDay;
import io.mrkuhne.mezo.api.dto.SportGapsResponse;
import io.mrkuhne.mezo.api.dto.SportHealthWorkout;
import io.mrkuhne.mezo.api.dto.SportHint;
import io.mrkuhne.mezo.api.dto.SportItemState;
import io.mrkuhne.mezo.api.dto.SportLaneItem;
import io.mrkuhne.mezo.api.dto.SportLoadResponse;
import io.mrkuhne.mezo.api.dto.SportLoadWeek;
import io.mrkuhne.mezo.api.dto.SportLoggedSession;
import io.mrkuhne.mezo.api.dto.SportMuscleHeat;
import io.mrkuhne.mezo.api.dto.SportOverviewResponse;
import io.mrkuhne.mezo.api.dto.SportShoulderResponse;
import io.mrkuhne.mezo.api.dto.SportShoulderWeek;
import io.mrkuhne.mezo.api.dto.SportSkipInfo;
import io.mrkuhne.mezo.api.dto.SportTonight;
import io.mrkuhne.mezo.api.dto.SportWeekCount;
import io.mrkuhne.mezo.api.dto.SportWeekDay;
import io.mrkuhne.mezo.api.dto.SportWeekTotals;
import io.mrkuhne.mezo.feature.train.config.TrainOwnerZoneProperties;
import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.SportEventEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.port.SportHealthPort;
import io.mrkuhne.mezo.feature.train.port.SportHealthPort.HealthWorkout;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.SportEventRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.MuscleGroup;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.Window;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Sport area's read models (Boop Sport S2, mezo-r36n9.202, spec §5.7): the week's two lanes and tonight's
 * moment, 6-week load, body heat, the shoulder line and the gaps between the gym and the sport with Boop's hints.
 * Read-only. The day's sport always comes from {@link WorkoutWindowQueryService#windowsFor(UUID, LocalDate, LocalDate)}
 * — the one resolver (slots + events − skips, a logged session = done); this service never resolves a plan itself.
 * Numbers: {@link SportMath}; interference: {@link SportInterference}; Health workouts: {@link SportHealthPort}.
 */
@Service
@RequiredArgsConstructor
public class SportReadService {

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");
    /** A Health workout pairs with a sport occurrence when it overlaps the window widened by 2 h each side … */
    private static final Duration MATCH_SLACK = Duration.ofHours(2);
    /** … and lasts at least 20 minutes — the same rule as Boop's day (BoopDayAssembler). */
    private static final int MIN_MATCH_MINUTES = 20;
    private static final int DEFAULT_SPORT_MINUTES = 60;
    private static final Set<String> LOWER_BODY = Set.of("quad", "ham", "glute", "calf");
    private static final LocalTime LEG_MORNING_BEFORE = LocalTime.NOON;
    private static final int DECLINE_WINDOW_DAYS = 14;

    private final WorkoutWindowQueryService windows;
    private final WorkoutService workoutService;
    private final PlannedSkipService plannedSkipService;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final SportSessionRepository sportSessionRepository;
    private final SportScheduleSlotRepository sportSlotRepository;
    private final SportEventRepository sportEventRepository;
    private final SportHealthPort health;
    private final TrainProperties trainProperties;
    private final TrainOwnerZoneProperties zoneProperties;
    private final ObjectProvider<Clock> clock;

    // ------------------------------------------------------------------ endpoints

    @Transactional(readOnly = true)
    public SportOverviewResponse overview(UUID user, LocalDate weekParam) {
        Instant now = now();
        ZoneId zone = zoneProperties.zoneId();
        LocalDate today = SportWeek.today(now, zone);
        SportWeek week = SportWeek.resolve(weekParam, today);
        WeekData d = load(user, week, today);

        List<SportWeekDay> days = new ArrayList<>();
        for (LocalDate day = week.start(); !day.isAfter(week.end()); day = day.plusDays(1)) {
            days.add(new SportWeekDay().date(day).gym(gymLane(d, day)).sport(sportLane(d, day)));
        }

        int gymMinutes = d.gym.stream().mapToInt(SportMath.GymSession::minutes).sum();
        int sportMinutes = d.sessions.stream().mapToInt(s -> s.getDurationMin() == null ? 0 : s.getDurationMin()).sum();
        SportWeekTotals totals = new SportWeekTotals().gymMinutes(gymMinutes).sportMinutes(sportMinutes)
            .movementMinutes(gymMinutes + sportMinutes).gymSessions(d.gym.size()).sportSessions(d.sessions.size());

        int planned = d.slots.size() + d.events.size();
        SportWeekCount count = planned == 0 && d.sessions.isEmpty() ? null
            : new SportWeekCount().done(d.sessions.size()).planned(planned);

        return new SportOverviewResponse().weekStart(week.start()).weekEnd(week.end()).today(today)
            .days(days).totals(totals).weekCount(count)
            .tonight(week.contains(today) ? tonight(d, today, now, zone) : null)
            .hints(hints(user, d, week, today));
    }

    @Transactional(readOnly = true)
    public SportLoadResponse load(UUID user, int weeks) {
        LocalDate today = SportWeek.today(now(), zoneProperties.zoneId());
        SportWeek current = SportWeek.of(today);
        SportWeek oldest = current.minusWeeks(weeks - 1);
        List<SportMath.GymSession> gym = gymSessions(user, oldest.start(), current.end());
        List<SportMath.SportSession> sport = sportFacts(sportSessions(user, oldest.start(), current.end()));
        List<SportLoadWeek> out = new ArrayList<>();
        for (int i = weeks - 1; i >= 0; i--) {
            SportWeek w = current.minusWeeks(i);
            SportMath.LoadWeek lw = SportMath.loadWeek(w.start(),
                gym.stream().filter(g -> w.contains(g.date())).toList(),
                sport.stream().filter(s -> w.contains(s.date())).toList());
            out.add(new SportLoadWeek().weekStart(lw.weekStart()).sportLoad(lw.sportLoad()).gymLoad(lw.gymLoad())
                .sportSessions(lw.sportSessions()).gymSessions(lw.gymSessions())
                .sportUnknown(lw.sportUnknown()).gymUnknown(lw.gymUnknown()));
        }
        return new SportLoadResponse().weeks(out);
    }

    @Transactional(readOnly = true)
    public SportBodyResponse body(UUID user, LocalDate weekParam) {
        SportWeek week = SportWeek.resolve(weekParam, SportWeek.today(now(), zoneProperties.zoneId()));
        List<SportMath.GymSession> gym = gymSessions(user, week.start(), week.end());
        List<SportMath.SportSession> sport = sportFacts(sportSessions(user, week.start(), week.end()));
        List<SportMath.MuscleHeat> heat = SportMath.body(gym, sport);
        return new SportBodyResponse().weekStart(week.start())
            .muscles(heat.stream().map(h -> new SportMuscleHeat().muscle(h.muscle()).gymLoad(h.gymLoad())
                .sportLoad(h.sportLoad()).gym(BigDecimal.valueOf(h.gym())).sport(BigDecimal.valueOf(h.sport()))
                .together(BigDecimal.valueOf(h.together()))).toList())
            .sharedMuscles((int) heat.stream().filter(h -> h.gymLoad() > 0 && h.sportLoad() > 0).count())
            .shoulderAverage(SportMath.shoulderAverage(sport))
            .sportUnknown(SportMath.sportWithoutHeat(sport));
    }

    @Transactional(readOnly = true)
    public SportShoulderResponse shoulder(UUID user, int weeks) {
        SportWeek current = SportWeek.of(SportWeek.today(now(), zoneProperties.zoneId()));
        SportWeek oldest = current.minusWeeks(weeks - 1);
        List<SportMath.SportSession> sport = sportFacts(sportSessions(user, oldest.start(), current.end()));
        List<SportShoulderWeek> out = new ArrayList<>();
        for (int i = weeks - 1; i >= 0; i--) {
            SportWeek w = current.minusWeeks(i);
            List<SportMath.SportSession> inWeek = sport.stream().filter(s -> w.contains(s.date())).toList();
            out.add(new SportShoulderWeek().weekStart(w.start()).average(SportMath.shoulderAverage(inWeek))
                .sessions((int) inWeek.stream().filter(s -> s.shoulderStrain() != null).count()));
        }
        return new SportShoulderResponse().weeks(out);
    }

    @Transactional(readOnly = true)
    public SportGapsResponse gaps(UUID user, LocalDate weekParam) {
        LocalDate today = SportWeek.today(now(), zoneProperties.zoneId());
        SportWeek week = SportWeek.resolve(weekParam, today);
        WeekData d = load(user, week, today);
        List<SportGapDay> days = new ArrayList<>();
        for (LocalDate day = week.start(); !day.isAfter(week.end()); day = day.plusDays(1)) {
            List<Window> ws = d.windowsOn(day);
            List<SportBlock> blocks = ws.stream()
                .filter(w -> w.start() != null && w.end() != null && isLayer(w))
                .sorted(Comparator.comparing(Window::start))
                .map(w -> new SportBlock().layer("gym".equals(w.kind()) ? SportBlock.LayerEnum.GYM
                        : SportBlock.LayerEnum.SPORT)
                    .sport("sport".equals(w.kind()) ? sportOf(w) : null)
                    .start(w.start().format(HHMM)).end(w.end().format(HHMM)).done(w.done()))
                .toList();
            Double gap = gapHours(ws);
            days.add(new SportGapDay().date(day).blocks(blocks).gapHours(gap == null ? null : hours(gap)));
        }
        return new SportGapsResponse().weekStart(week.start()).days(days).hints(hints(user, d, week, today));
    }

    // ------------------------------------------------------------------ the week's data

    /** Everything one week's lanes, moment and hints need — every query once for the range. */
    private final class WeekData {
        final SportWeek week;
        final LocalDate today;
        final Map<LocalDate, List<Window>> windows;     // week + the Monday after (leg morning)
        final List<PlannedSkipPolicy.Verdict> skips;
        final List<SportSessionEntity> sessions;        // logged sport of the week
        final List<SportMath.GymSession> gym;           // done gym of the week
        final Map<LocalDate, List<WorkoutSessionEntity>> gymInstances;
        final List<SportScheduleSlotEntity> slots;
        final List<SportEventEntity> events;
        final List<HealthWorkout> todayWorkouts;

        WeekData(SportWeek week, LocalDate today, Map<LocalDate, List<Window>> windows,
                 List<PlannedSkipPolicy.Verdict> skips, List<SportSessionEntity> sessions,
                 List<SportMath.GymSession> gym, Map<LocalDate, List<WorkoutSessionEntity>> gymInstances,
                 List<SportScheduleSlotEntity> slots, List<SportEventEntity> events, List<HealthWorkout> todayWorkouts) {
            this.week = week;
            this.today = today;
            this.windows = windows;
            this.skips = skips;
            this.sessions = sessions;
            this.gym = gym;
            this.gymInstances = gymInstances;
            this.slots = slots;
            this.events = events;
            this.todayWorkouts = todayWorkouts;
        }

        List<Window> windowsOn(LocalDate day) {
            return windows.getOrDefault(day, List.of());
        }
    }

    private WeekData load(UUID user, SportWeek week, LocalDate today) {
        Map<LocalDate, List<Window>> ws = windows.windowsFor(user, week.start(), week.end().plusDays(1));
        List<WorkoutSessionEntity> instances = workoutSessionRepository
            .findDoneInstancesBetween(user, week.start(), week.end());
        return new WeekData(week, today, ws,
            plannedSkipService.verdictsBetween(user, week.start(), week.end()),
            sportSessions(user, week.start(), week.end()),
            gymSessions(user, instances),
            instances.stream().collect(Collectors.groupingBy(WorkoutSessionEntity::getDate)),
            sportSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(user),
            sportEventRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscTimeAsc(
                user, week.start(), week.end()),
            week.contains(today) ? health.workouts(user, today, today) : List.of());
    }

    private List<SportSessionEntity> sportSessions(UUID user, LocalDate from, LocalDate to) {
        return sportSessionRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(user, from, to)
            .stream()
            .sorted(Comparator.comparing(SportSessionEntity::getDate)
                .thenComparing(SportSessionEntity::getTime, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    }

    private static List<SportMath.SportSession> sportFacts(List<SportSessionEntity> sessions) {
        return sessions.stream().map(SportReadService::fact).toList();
    }

    private static SportMath.SportSession fact(SportSessionEntity s) {
        return new SportMath.SportSession(s.getDate(), s.getSport(), s.getRpe(), s.getIntensity(), s.getDurationMin(),
            s.getShoulderStrain());
    }

    private List<SportMath.GymSession> gymSessions(UUID user, LocalDate from, LocalDate to) {
        return gymSessions(user, workoutSessionRepository.findDoneInstancesBetween(user, from, to));
    }

    /** Done gym instances as facts: each done working set with its muscle and RIR (logged, else target). */
    private List<SportMath.GymSession> gymSessions(UUID user, List<WorkoutSessionEntity> instances) {
        if (instances.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = instances.stream().map(WorkoutSessionEntity::getId).toList();
        List<ExerciseSetEntity> working = exerciseSetRepository.findWorkingSetsInSessions(user, ids);
        // A logged set points at the TEMPLATE day's exercise row (an instance has no exercise rows of its own), and a
        // swapped-out row may be soft-deleted while its sets stay — so look the rows up by the sets' ids.
        Set<UUID> exerciseIds = working.stream().map(ExerciseSetEntity::getExerciseId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, ExerciseEntity> exercises = exerciseIds.isEmpty() ? Map.of()
            : exerciseRepository.findOwnedByIdIncludingDeleted(user, exerciseIds).stream()
                .collect(Collectors.toMap(ExerciseEntity::getId, e -> e, (a, b) -> a));
        Map<UUID, List<ExerciseSetEntity>> setsBySession = working.stream()
            .collect(Collectors.groupingBy(ExerciseSetEntity::getWorkoutSessionId));
        List<SportMath.GymSession> out = new ArrayList<>();
        for (WorkoutSessionEntity i : instances) {
            List<SportMath.GymSet> sets = setsBySession.getOrDefault(i.getId(), List.of()).stream()
                .map(s -> {
                    ExerciseEntity e = exercises.get(s.getExerciseId());
                    Integer rir = s.getRir() != null ? s.getRir() : (e == null ? null : e.getTargetRir());
                    return new SportMath.GymSet(e == null ? null : e.getMuscle(), rir);
                })
                .toList();
            out.add(new SportMath.GymSession(i.getDate(),
                WorkoutWindowQueryService.gymMinutes(i, trainProperties.gymDefaultMinutes()), sets));
        }
        return out;
    }

    // ------------------------------------------------------------------ lanes

    private List<SportLaneItem> gymLane(WeekData d, LocalDate day) {
        List<SportLaneItem> out = new ArrayList<>();
        List<SportMath.GymSession> doneFacts = d.gym.stream().filter(g -> g.date().equals(day)).toList();
        Integer doneLoad = sumKnown(doneFacts.stream().map(SportMath::gymLoad).toList());
        boolean loadUsed = false;
        for (Window w : d.windowsOn(day)) {
            if (!"gym".equals(w.kind())) {
                continue;
            }
            SportLaneItem item = new SportLaneItem().layer(SportLaneItem.LayerEnum.GYM).label(w.label())
                .time(w.start() == null ? null : w.start().format(HHMM))
                .durationMin(span(w)).state(state(w.done(), day, d.today));
            if (w.done() && !loadUsed) {
                item.load(doneLoad);
                loadUsed = true;
            }
            out.add(item);
        }
        // A gym session done on a day with no gym slot (an extra or moved session) still shows as done.
        if (out.stream().noneMatch(i -> i.getState() == SportItemState.DONE)) {
            for (WorkoutSessionEntity i : d.gymInstances.getOrDefault(day, List.of())) {
                out.add(new SportLaneItem().layer(SportLaneItem.LayerEnum.GYM).label(i.getType())
                    .time(i.getStartedAt() == null ? null
                        : i.getStartedAt().atZone(zoneProperties.zoneId()).toLocalTime().format(HHMM))
                    .durationMin(WorkoutWindowQueryService.gymMinutes(i, trainProperties.gymDefaultMinutes()))
                    .state(SportItemState.DONE).load(loadUsed ? null : doneLoad));
                loadUsed = true;
            }
        }
        for (PlannedSkipPolicy.Verdict v : skipsOn(d, day, PlannedSkipEntity.Kind.GYM)) {
            if (out.stream().noneMatch(i -> i.getState() == SportItemState.DONE)) {
                out.add(new SportLaneItem().layer(SportLaneItem.LayerEnum.GYM).state(SportItemState.SKIPPED)
                    .skipId(v.row().id()));
            }
        }
        return out;
    }

    private List<SportLaneItem> sportLane(WeekData d, LocalDate day) {
        List<SportLaneItem> out = new ArrayList<>();
        Set<SportSessionEntity> used = new HashSet<>();
        for (Window w : d.windowsOn(day)) {
            if (!"sport".equals(w.kind())) {
                continue;
            }
            SportLaneItem item = new SportLaneItem().layer(SportLaneItem.LayerEnum.SPORT).sport(sportOf(w))
                .time(w.start() == null ? null : w.start().format(HHMM)).durationMin(span(w))
                .state(state(w.done(), day, d.today));
            if (w.done()) {
                loggedFor(d, day, w, used).ifPresent(s -> item.load(SportMath.sportLoad(fact(s))));
            }
            out.add(item);
        }
        for (PlannedSkipPolicy.Verdict v : skipsOn(d, day, PlannedSkipEntity.Kind.SPORT)) {
            Optional<SportScheduleSlotEntity> slot = slotAt(d, v.row().dayOfWeek(), v.row().time());
            out.add(new SportLaneItem().layer(SportLaneItem.LayerEnum.SPORT)
                .sport(slot.map(SportScheduleSlotEntity::getSport).orElse(null)).time(v.row().time())
                .durationMin(slot.map(SportScheduleSlotEntity::getDurationMin).orElse(null))
                .state(SportItemState.SKIPPED).skipId(v.row().id()));
        }
        out.sort(Comparator.comparing(SportLaneItem::getTime, Comparator.nullsLast(Comparator.naturalOrder())));
        return out;
    }

    private static SportItemState state(boolean done, LocalDate day, LocalDate today) {
        if (done) {
            return SportItemState.DONE;
        }
        return day.isBefore(today) ? SportItemState.MISSED : SportItemState.PLANNED;
    }

    private static List<PlannedSkipPolicy.Verdict> skipsOn(WeekData d, LocalDate day, PlannedSkipEntity.Kind kind) {
        return d.skips.stream().filter(v -> v.row().kind() == kind && day.equals(v.row().date())).toList();
    }

    /** The logged session behind a done sport window: same sport, the closest clock time, each used once. */
    private static Optional<SportSessionEntity> loggedFor(WeekData d, LocalDate day, Window w,
                                                          Set<SportSessionEntity> used) {
        String kind = sportOf(w);
        Optional<SportSessionEntity> hit = d.sessions.stream()
            .filter(s -> day.equals(s.getDate()) && !used.contains(s) && kind.equals(s.getSport()))
            .min(Comparator.comparingLong(s -> s.getTime() == null || w.start() == null ? Long.MAX_VALUE
                : Math.abs(Duration.between(LocalTime.parse(s.getTime()), w.start()).toMinutes())));
        hit.ifPresent(used::add);
        return hit;
    }

    // ------------------------------------------------------------------ tonight

    private SportTonight tonight(WeekData d, LocalDate today, Instant now, ZoneId zone) {
        List<Window> sport = d.windowsOn(today).stream()
            .filter(w -> "sport".equals(w.kind()) && w.start() != null)
            .sorted(Comparator.comparing(Window::start))
            .toList();
        Set<HealthWorkout> claimed = new HashSet<>();
        // Health workouts already explained by a logged session are not a pre-fill.
        for (SportSessionEntity s : d.sessions) {
            if (today.equals(s.getDate()) && s.getTime() != null) {
                match(d.todayWorkouts, today, LocalTime.parse(s.getTime()), s.getDurationMin(), s.getSport(), zone,
                    claimed).ifPresent(claimed::add);
            }
        }
        Optional<Window> pending = sport.stream().filter(w -> !w.done()).findFirst();
        if (pending.isPresent()) {
            Window w = pending.get();
            SportTonight t = planned(d, today, w);
            Optional<HealthWorkout> recorded = match(d.todayWorkouts, today, w.start(), span(w), sportOf(w), zone,
                claimed);
            if (recorded.isPresent()) {
                return t.moment(SportTonight.MomentEnum.RECORDED).health(healthDto(recorded.get()));
            }
            return t.moment(SportTonight.MomentEnum.BEFORE).startsInMinutes((int) Duration.between(now,
                today.atTime(w.start()).atZone(zone).toInstant()).toMinutes());
        }
        // An unplanned Watch workout of a named sport, not yet logged — still a pre-fill.
        Optional<HealthWorkout> unplanned = d.todayWorkouts.stream()
            .filter(h -> !claimed.contains(h) && h.minutes() >= MIN_MATCH_MINUTES
                && SportWorkoutKinds.sportOf(h.activityType()) != null)
            .max(Comparator.comparing(HealthWorkout::start, Comparator.nullsFirst(Comparator.naturalOrder())));
        if (unplanned.isPresent() && sport.stream().noneMatch(w -> w.done()
                && SportWorkoutKinds.fitsSport(unplanned.get().activityType(), sportOf(w)))) {
            HealthWorkout h = unplanned.get();
            return new SportTonight().sport(SportWorkoutKinds.sportOf(h.activityType()))
                .time(h.start().atZone(zone).toLocalTime().format(HHMM)).durationMin(h.minutes())
                .moment(SportTonight.MomentEnum.RECORDED).health(healthDto(h));
        }
        Optional<Window> done = sport.stream().filter(Window::done).reduce((a, b) -> b);
        if (done.isPresent()) {
            Window w = done.get();
            SportTonight t = planned(d, today, w).moment(SportTonight.MomentEnum.DONE);
            Optional<SportSessionEntity> log = loggedFor(d, today, w, new HashSet<>());
            log.ifPresent(s -> {
                t.session(sessionDto(s));
                if (s.getTime() != null) {
                    match(d.todayWorkouts, today, LocalTime.parse(s.getTime()), s.getDurationMin(), s.getSport(),
                        zone, Set.of()).ifPresent(h -> t.health(healthDto(h)));
                }
            });
            return t;
        }
        Optional<PlannedSkipPolicy.Verdict> skip = skipsOn(d, today, PlannedSkipEntity.Kind.SPORT).stream()
            .findFirst();
        if (skip.isPresent()) {
            PlannedSkipPolicy.Verdict v = skip.get();
            Optional<SportScheduleSlotEntity> slot = slotAt(d, v.row().dayOfWeek(), v.row().time());
            SportTonight t = new SportTonight().sport(slot.map(SportScheduleSlotEntity::getSport).orElse("volleyball"))
                .time(v.row().time()).durationMin(slot.map(SportScheduleSlotEntity::getDurationMin).orElse(null))
                .kind(slot.map(s -> kindOf(s.getKind())).orElse(null))
                .location(slot.map(SportScheduleSlotEntity::getLocation).orElse(null))
                .moment(SportTonight.MomentEnum.SKIPPED);
            if (v.row().id() != null) {
                t.skip(new SportSkipInfo().id(v.row().id())
                    .reason(PlannedSkipReason.fromValue(v.row().reason().name()))
                    .reasonText(v.row().reasonText()).freePass(v.freePass()).serious(v.serious()));
            }
            return t;
        }
        return null;
    }

    /** Tonight's card from a planned window, with the slot / event's kind and place when one sits at that time. */
    private SportTonight planned(WeekData d, LocalDate today, Window w) {
        String time = w.start().format(HHMM);
        SportTonight t = new SportTonight().sport(sportOf(w)).time(time).durationMin(span(w));
        Optional<SportEventEntity> event = d.events.stream()
            .filter(e -> today.equals(e.getDate()) && time.equals(e.getTime())).findFirst();
        if (event.isPresent()) {
            return t.kind(kindOf(event.get().getKind())).location(event.get().getLocation());
        }
        slotAt(d, today.getDayOfWeek().getValue() - 1, time)
            .ifPresent(s -> t.kind(kindOf(s.getKind())).location(s.getLocation()));
        return t;
    }

    private static SportTonight.KindEnum kindOf(String kind) {
        if ("match".equals(kind)) {
            return SportTonight.KindEnum.MATCH;
        }
        return "training".equals(kind) ? SportTonight.KindEnum.TRAINING : null;
    }

    private static Optional<SportScheduleSlotEntity> slotAt(WeekData d, Integer dow, String time) {
        if (dow == null || time == null) {
            return Optional.empty();
        }
        return d.slots.stream().filter(s -> dow.equals(s.getDayOfWeek()) && time.equals(s.getTime())).findFirst();
    }

    /** The longest Health workout of {@code sport} overlapping {@code start … start + minutes} ± 2 h, ≥ 20 min. */
    private static Optional<HealthWorkout> match(List<HealthWorkout> workouts, LocalDate date, LocalTime start,
                                                 Integer minutes, String sport, ZoneId zone, Set<HealthWorkout> taken) {
        Instant from = date.atTime(start).atZone(zone).toInstant().minus(MATCH_SLACK);
        int span = minutes == null || minutes <= 0 ? DEFAULT_SPORT_MINUTES : minutes;
        Instant to = date.atTime(start).atZone(zone).toInstant().plus(Duration.ofMinutes(span)).plus(MATCH_SLACK);
        return workouts.stream()
            .filter(h -> !taken.contains(h) && SportWorkoutKinds.fitsSport(h.activityType(), sport)
                && h.minutes() >= MIN_MATCH_MINUTES && h.start().isBefore(to) && h.end().isAfter(from))
            .max(Comparator.comparingInt(HealthWorkout::minutes));
    }

    private static SportHealthWorkout healthDto(HealthWorkout h) {
        return new SportHealthWorkout().activityType(h.activityType()).start(h.start().atOffset(java.time.ZoneOffset.UTC))
            .minutes(h.minutes()).kcal(h.kcal()).avgHr(h.avgHr());
    }

    private static SportLoggedSession sessionDto(SportSessionEntity s) {
        return new SportLoggedSession().id(s.getId()).sport(s.getSport()).durationMin(s.getDurationMin())
            .rpe(s.getRpe()).load(SportMath.sportLoad(fact(s))).kcal(s.getKcal()).setsPlayed(s.getSetsPlayed())
            .shoulderStrain(s.getShoulderStrain());
    }

    // ------------------------------------------------------------------ hints

    private List<SportHint> hints(UUID user, WeekData d, SportWeek week, LocalDate today) {
        List<SportHint> out = new ArrayList<>();
        for (LocalDate day = week.start(); !day.isAfter(week.end()); day = day.plusDays(1)) {
            List<Window> ws = d.windowsOn(day);
            Double gap = gapHours(ws);
            String verdict = SportInterference.gapVerdict(gap);
            if (verdict != null) {
                out.add(new SportHint().key("TIGHT".equals(verdict) ? SportHint.KeyEnum.GAP_TIGHT
                        : SportHint.KeyEnum.GAP_SHORT)
                    .date(day).severity("TIGHT".equals(verdict) ? SportHint.SeverityEnum.WATCH
                        : SportHint.SeverityEnum.INFO)
                    .sport(ws.stream().filter(w -> "sport".equals(w.kind())).map(SportReadService::sportOf)
                        .findFirst().orElse(null))
                    .gapHours(hours(gap)));
            }
            legMorning(user, d, day).ifPresent(out::add);
        }
        decline(user, week, today).ifPresent(out::add);
        return out;
    }

    /** Sport on {@code day}, then a lower-body gym session before noon the next day. */
    private Optional<SportHint> legMorning(UUID user, WeekData d, LocalDate day) {
        Optional<Window> sport = d.windowsOn(day).stream().filter(w -> "sport".equals(w.kind())).reduce((a, b) -> b);
        LocalDate next = day.plusDays(1);
        Optional<Window> gym = d.windowsOn(next).stream()
            .filter(w -> "gym".equals(w.kind()) && w.start() != null && w.start().isBefore(LEG_MORNING_BEFORE))
            .findFirst();
        if (sport.isEmpty() || gym.isEmpty()) {
            return Optional.empty();
        }
        Set<String> groups = workoutService.plannedMuscleGroups(user, next);
        if (groups.stream().noneMatch(LOWER_BODY::contains)) {
            return Optional.empty();
        }
        Window s = sport.get();
        Boolean heavy = s.done()
            ? loggedFor(d, day, s, new HashSet<>()).map(x -> SportInterference.heavy(x.getShoulderStrain(), x.getRpe()))
                .orElse(null)
            : null;
        return Optional.of(new SportHint().key(SportHint.KeyEnum.SPORT_BEFORE_LEG_MORNING).date(next)
            .severity(Boolean.TRUE.equals(heavy) ? SportHint.SeverityEnum.WATCH : SportHint.SeverityEnum.INFO)
            .sport(sportOf(s)).heavy(heavy));
    }

    /** ≥ 2 heavy sport → next-day rep-decline pairs in the 14 days up to the week's end (or today). */
    private Optional<SportHint> decline(UUID user, SportWeek week, LocalDate today) {
        LocalDate end = week.end().isAfter(today) ? today : week.end();
        LocalDate from = end.minusDays(DECLINE_WINDOW_DAYS - 1L);
        List<SportInterference.SportDay> sport = sportSessions(user, from, end).stream()
            .map(s -> new SportInterference.SportDay(s.getDate(), s.getShoulderStrain(), s.getRpe())).toList();
        if (sport.stream().noneMatch(s -> SportInterference.heavy(s.shoulderStrain(), s.rpe()))) {
            return Optional.empty();
        }
        List<WorkoutSessionEntity> instances = workoutSessionRepository.findDoneInstancesBetween(user, from,
            end.plusDays(1));
        Map<LocalDate, Double> deltas = new HashMap<>();
        if (!instances.isEmpty()) {
            Map<UUID, LocalDate> dateOf = instances.stream()
                .collect(Collectors.toMap(WorkoutSessionEntity::getId, WorkoutSessionEntity::getDate));
            Map<LocalDate, int[]> acc = new HashMap<>();
            for (ExerciseSetEntity s : exerciseSetRepository.findWorkingSetsInSessions(user,
                    new ArrayList<>(dateOf.keySet()))) {
                if (s.getTargetReps() == null) {
                    continue;
                }
                int[] a = acc.computeIfAbsent(dateOf.get(s.getWorkoutSessionId()), k -> new int[2]);
                a[0] += s.getReps() - s.getTargetReps();
                a[1]++;
            }
            acc.forEach((date, a) -> deltas.put(date, (double) a[0] / a[1]));
        }
        int pairs = SportInterference.declinePairs(sport, deltas);
        if (pairs < SportInterference.MIN_DECLINE_PAIRS) {
            return Optional.empty();
        }
        return Optional.of(new SportHint().key(SportHint.KeyEnum.SPORT_LOAD_DECLINE).date(end)
            .severity(SportHint.SeverityEnum.WATCH).pairs(pairs));
    }

    // ------------------------------------------------------------------ small helpers

    private static boolean isLayer(Window w) {
        return "gym".equals(w.kind()) || "sport".equals(w.kind());
    }

    private static String sportOf(Window w) {
        return w.label() == null ? "volleyball" : w.label();
    }

    private static Integer span(Window w) {
        if (w.start() == null || w.end() == null) {
            return null;
        }
        long m = Duration.between(w.start(), w.end()).toMinutes();
        return (int) (m < 0 ? m + 24 * 60 : m);
    }

    /** Shortest rest in hours between a gym and a sport block of the day (0 when they overlap); null unless both. */
    static Double gapHours(List<Window> ws) {
        List<Window> gym = ws.stream().filter(w -> "gym".equals(w.kind()) && w.start() != null && w.end() != null)
            .toList();
        List<Window> sport = ws.stream().filter(w -> "sport".equals(w.kind()) && w.start() != null && w.end() != null)
            .toList();
        Double best = null;
        for (Window g : gym) {
            for (Window s : sport) {
                long minutes;
                if (!g.end().isAfter(s.start())) {
                    minutes = Duration.between(g.end(), s.start()).toMinutes();
                } else if (!s.end().isAfter(g.start())) {
                    minutes = Duration.between(s.end(), g.start()).toMinutes();
                } else {
                    minutes = 0;
                }
                double h = minutes / 60.0;
                best = best == null ? h : Math.min(best, h);
            }
        }
        return best;
    }

    private static BigDecimal hours(double h) {
        return BigDecimal.valueOf(h).setScale(1, RoundingMode.HALF_UP);
    }

    private static Integer sumKnown(List<Integer> loads) {
        List<Integer> known = loads.stream().filter(Objects::nonNull).toList();
        return known.isEmpty() ? null : known.stream().mapToInt(Integer::intValue).sum();
    }

    private Instant now() {
        return clock.getIfAvailable(Clock::systemUTC).instant();
    }
}
