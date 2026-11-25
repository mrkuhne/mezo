package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.GymScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotInput;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RecoveryPeriodRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.service.BlockDayArrangeService;
import io.mrkuhne.mezo.feature.train.service.BlockDayArrangement;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService.DraftSlot;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link SeasonTrainPort} over the train feature. Season-side for the same reason as {@link SeasonGoalAdapter}:
 * the season implements train's {@code SeasonGatePort}, so a train-side adapter would close a cycle.
 */
@Component
@RequiredArgsConstructor
public class SeasonTrainAdapter implements SeasonTrainPort {

    private static final String KIND_GYM = "gym";
    /** Only used when he has no gym slot of his own and the draft names no time. */
    private static final String FALLBACK_GYM_TIME = "18:00";

    private final GymScheduleSlotRepository gymRepo;
    private final SportScheduleSlotRepository sportRepo;
    private final GymScheduleService gymScheduleService;
    private final SportService sportService;
    private final WeeklyScheduledActivityService weeklyActivity;
    private final MesocycleRepository mesocycleRepository;
    private final MesoTemplateService mesoTemplateService;
    private final WorkoutWindowQueryService workoutWindows;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final PlannedSkipService plannedSkipService;
    private final RecoveryPeriodRepository recoveryPeriodRepository;
    private final BlockDayArrangeService blockDayArrangeService;

    @Override
    public Optional<BlockWeek> blockRearrangement(UUID owner, UUID mesocycleId, List<Integer> gymDays,
                                                  Set<Integer> sportDays) {
        BlockDayArrangement.Plan plan = blockDayArrangeService.plan(owner, mesocycleId, gymDays, sportDays);
        if (!plan.changed()) {
            return Optional.empty();
        }
        String title = mesocycleRepository.findById(mesocycleId).map(MesocycleEntity::getTitle).orElse("");
        List<BlockDay> days = plan.slots().stream().map(s -> new BlockDay(s.weekday(), s.title(),
            s.change().name().toLowerCase(java.util.Locale.ROOT), s.change() == BlockDayArrangement.Change.KEEP
                ? null : s.fromWeekday())).toList();
        List<BlockDay> dropped = plan.dropped().stream()
            .map(d -> new BlockDay(d.weekday(), d.title(), "drop", null)).toList();
        return Optional.of(new BlockWeek(mesocycleId, title, days, dropped));
    }

    @Override
    public void rearrangeBlock(UUID owner, UUID mesocycleId, List<Integer> gymDays, Set<Integer> sportDays) {
        blockDayArrangeService.apply(owner, mesocycleId, gymDays, sportDays);
    }

    @Override
    public String blockState(UUID owner, UUID mesocycleId) {
        return blockDayArrangeService.state(owner, mesocycleId);
    }

    @Override
    public Schedule currentSchedule(UUID owner) {
        List<GymScheduleSlotEntity> gym = gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner);
        TreeSet<Integer> days = new TreeSet<>();
        gym.forEach(g -> days.add(g.getDayOfWeek()));
        List<SeasonDraftJson.SportSlot> sport = sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner)
            .stream()
            .map(s -> new SeasonDraftJson.SportSlot(s.getDayOfWeek(), s.getTime(), s.getDurationMin(), s.getSport()))
            .toList();
        return new Schedule(List.copyOf(days), commonTime(gym), sport);
    }

    @Override
    public BigDecimal draftEat(SeasonDraftJson draft, BigDecimal restKcalPerHour) {
        return weeklyActivity.draftWeeklyEatKcalPerDay(slots(draft), restKcalPerHour);
    }

    @Override
    public int trainDayMovementKcal(SeasonDraftJson draft, BigDecimal restKcalPerHour) {
        if (!draft.gymDaysOrEmpty().isEmpty()) {
            return weeklyActivity.draftSlotKcal(new DraftSlot(KIND_GYM, 0), restKcalPerHour).intValue();
        }
        List<SeasonDraftJson.SportSlot> sport = draft.sportOrEmpty();
        if (sport.isEmpty()) {
            return 0;
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (SeasonDraftJson.SportSlot s : sport) {
            sum = sum.add(weeklyActivity.draftSlotKcal(new DraftSlot(s.sport(), s.durationMin()), restKcalPerHour));
        }
        return sum.divide(BigDecimal.valueOf(sport.size()), 0, RoundingMode.HALF_UP).intValue();
    }

    @Override
    public List<Integer> weekdayMovementKcal(SeasonDraftJson draft, BigDecimal restKcalPerHour) {
        // Each slot at whole kcal, the way trainDayMovementKcal prices a gym day, so a gym-only weekday projects to
        // exactly the training-day target.
        int gym = weeklyActivity.draftSlotKcal(new DraftSlot(KIND_GYM, 0), restKcalPerHour).intValue();
        Set<Integer> gymDays = new HashSet<>(draft.gymDaysOrEmpty());
        List<Integer> out = new ArrayList<>(7);
        for (int dow = 0; dow < 7; dow++) {
            int sum = gymDays.contains(dow) ? gym : 0;
            for (SeasonDraftJson.SportSlot s : draft.sportOrEmpty()) {
                if (s.dayOfWeek() == dow) {
                    sum += weeklyActivity.draftSlotKcal(new DraftSlot(s.sport(), s.durationMin()), restKcalPerHour)
                        .intValue();
                }
            }
            out.add(sum);
        }
        return out;
    }

    @Override
    public Optional<Integer> trainSportDayMovementKcal(SeasonDraftJson draft, BigDecimal restKcalPerHour) {
        Set<Integer> gymDays = new HashSet<>(draft.gymDaysOrEmpty());
        Set<Integer> sportDays = new HashSet<>();
        draft.sportOrEmpty().forEach(s -> sportDays.add(s.dayOfWeek()));
        List<Integer> movement = weekdayMovementKcal(draft, restKcalPerHour);
        Optional<Integer> max = Optional.empty();
        for (int dow = 0; dow < 7; dow++) {
            if (gymDays.contains(dow) && sportDays.contains(dow)) {
                int m = movement.get(dow);
                max = Optional.of(max.map(x -> Math.max(x, m)).orElse(m));
            }
        }
        return max;
    }

    @Override
    public void replaceSlots(UUID owner, SeasonDraftJson draft) {
        List<GymScheduleSlotEntity> gymNow = gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner);
        List<SportScheduleSlotEntity> sportNow = sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner);
        List<GymScheduleSlotInput> gym = new ArrayList<>();
        // A draft time that differs from today's single shared time is an explicit change and moves every day;
        // otherwise a weekday that already has a slot keeps its own time, and a new weekday takes the draft's
        // time, else the first existing slot's.
        String shared = commonTime(gymNow);
        boolean timeChanged = draft.gymTime() != null && !draft.gymTime().equals(shared);
        for (Integer day : new TreeSet<>(draft.gymDaysOrEmpty())) {
            Optional<String> own = gymNow.stream().filter(g -> g.getDayOfWeek().equals(day))
                .map(GymScheduleSlotEntity::getTime).findFirst();
            String time = timeChanged ? draft.gymTime()
                : own.orElse(draft.gymTime() != null ? draft.gymTime()
                    : gymNow.isEmpty() ? FALLBACK_GYM_TIME : gymNow.get(0).getTime());
            gym.add(GymScheduleSlotInput.builder().dayOfWeek(day).time(time).build());
        }
        List<SportScheduleSlotInput> sport = new ArrayList<>();
        for (SeasonDraftJson.SportSlot s : draft.sportOrEmpty()) {
            Optional<SportScheduleSlotEntity> same = sportNow.stream()
                .filter(e -> e.getDayOfWeek().equals(s.dayOfWeek()) && s.sport().equals(e.getSport())).findFirst();
            sport.add(SportScheduleSlotInput.builder()
                .dayOfWeek(s.dayOfWeek()).time(s.time()).durationMin(s.durationMin()).sport(s.sport())
                .kind(same.map(SportScheduleSlotEntity::getKind).orElse("training"))
                .location(same.map(SportScheduleSlotEntity::getLocation).orElse(null))
                .intensityLabel(same.map(SportScheduleSlotEntity::getIntensityLabel).orElse(null))
                .build());
        }
        gymScheduleService.replaceSchedule(owner, gym);
        sportService.replaceSchedule(owner, sport);
    }

    @Override
    public Optional<Block> activeMesocycle(UUID owner) {
        return mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active").stream()
            .findFirst().map(SeasonTrainAdapter::block);
    }

    @Override
    public Optional<Block> mesocycle(UUID owner, UUID mesocycleId) {
        return mesocycleRepository.findByIdAndCreatedByAndDeletedFalse(mesocycleId, owner).map(SeasonTrainAdapter::block);
    }

    @Override
    public UUID startFromTemplate(UUID owner, UUID templateId, LocalDate startDate) {
        return mesoTemplateService.start(owner, templateId, MesoTemplateStartRequest.builder()
            .startDate(startDate).status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build()).getId();
    }

    @Override
    public UUID templateOf(UUID owner, UUID mesocycleId) {
        return mesoTemplateService.rerun(owner, mesocycleId).getTemplateId();
    }

    @Override
    public Map<LocalDate, Set<SessionKind>> plannedSessions(UUID owner, LocalDate from, LocalDate to) {
        Set<Integer> gymDays = new HashSet<>();
        Set<Integer> sportDays = new HashSet<>();
        gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner).forEach(g -> gymDays.add(g.getDayOfWeek()));
        sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner).forEach(x -> sportDays.add(x.getDayOfWeek()));
        Map<LocalDate, Set<SessionKind>> days = new HashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            int dow = d.getDayOfWeek().getValue() - 1;
            if (gymDays.contains(dow)) {
                add(days, d, SessionKind.GYM);
            }
            if (sportDays.contains(dow)) {
                add(days, d, SessionKind.SPORT);
            }
        }
        workoutWindows.windowsFor(owner, from, to).forEach((day, windows) -> {
            if (windows.stream().anyMatch(w -> "run".equals(w.kind()))) {
                add(days, day, SessionKind.RUN);
            }
        });
        return days;
    }

    @Override
    public Map<LocalDate, Set<SessionKind>> doneSessions(UUID owner, LocalDate from, LocalDate to) {
        Map<LocalDate, Set<SessionKind>> days = new HashMap<>();
        workoutSessionRepository.findDoneInstanceDates(owner, from, to).forEach(d -> add(days, d, SessionKind.GYM));
        sportSessionRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to)
            .forEach(x -> add(days, x.getDate(), SessionKind.SPORT));
        runSessionLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to)
            .forEach(x -> add(days, x.getDate(), SessionKind.RUN));
        return days;
    }

    @Override
    public Map<LocalDate, Set<SessionKind>> excusedSessions(UUID owner, LocalDate from, LocalDate to) {
        Map<LocalDate, Set<SessionKind>> days = new HashMap<>();
        Map<PlannedSkipEntity.Kind, SessionKind> kinds = Map.of(PlannedSkipEntity.Kind.GYM, SessionKind.GYM,
            PlannedSkipEntity.Kind.SPORT, SessionKind.SPORT, PlannedSkipEntity.Kind.RUN, SessionKind.RUN);
        kinds.forEach((skip, kind) -> plannedSkipService.excusedDates(owner, skip, from, to)
            .forEach(d -> add(days, d, kind)));
        return days;
    }

    @Override
    public List<TrainEvent> trainEvents(UUID owner, LocalDate from, LocalDate to) {
        List<TrainEvent> out = new ArrayList<>();
        for (MesocycleEntity m : mesocycleRepository.findByCreatedByAndDeletedFalseOrderByStartDateAsc(owner)) {
            LocalDate start = m.getStartDate();
            if (start == null) {
                continue;
            }
            if (!start.isBefore(from) && !start.isAfter(to)) {
                out.add(new TrainEvent(TrainEventKind.MESOCYCLE, start));
            }
            List<String> curve = m.getPhaseCurve() == null ? List.of() : m.getPhaseCurve();
            for (int i = 0; i < curve.size(); i++) {
                LocalDate week = start.plusWeeks(i);
                // the deload week [week, week+6] touching the window counts, even when it began before it
                if ("deload".equalsIgnoreCase(curve.get(i)) && !week.plusDays(6).isBefore(from) && !week.isAfter(to)) {
                    out.add(new TrainEvent(TrainEventKind.DELOAD, week.isBefore(from) ? from : week));
                }
            }
        }
        for (RecoveryPeriodEntity p : recoveryPeriodRepository.findByCreatedByAndStartDateLessThanEqualAndDeletedFalse(owner, to)) {
            LocalDate end = p.getEndedOn();
            if (p.getStartDate() != null && (end == null || !end.isBefore(from))) {
                out.add(new TrainEvent(TrainEventKind.KIMELO, p.getStartDate().isBefore(from) ? from : p.getStartDate()));
            }
        }
        out.sort(java.util.Comparator.comparing(TrainEvent::date));
        return out;
    }

    private static void add(Map<LocalDate, Set<SessionKind>> days, LocalDate day, SessionKind kind) {
        days.computeIfAbsent(day, k -> EnumSet.noneOf(SessionKind.class)).add(kind);
    }

    /** The one time every gym slot shares, or null when there is none or they differ. */
    private static String commonTime(List<GymScheduleSlotEntity> gym) {
        if (gym.isEmpty()) {
            return null;
        }
        String first = gym.get(0).getTime();
        return gym.stream().allMatch(g -> first.equals(g.getTime())) ? first : null;
    }

    private static List<DraftSlot> slots(SeasonDraftJson draft) {
        List<DraftSlot> out = new ArrayList<>();
        draft.gymDaysOrEmpty().forEach(d -> out.add(new DraftSlot(KIND_GYM, 0)));
        draft.sportOrEmpty().forEach(s -> out.add(new DraftSlot(s.sport(), s.durationMin())));
        return out;
    }

    private static Block block(MesocycleEntity m) {
        return new Block(m.getId(), m.getTitle(), m.getStatus(), m.getStartDate(), m.getEndDate(),
            m.getWeeks() == null ? 0 : m.getWeeks(), m.getPhaseCurve() == null ? List.of() : List.copyOf(m.getPhaseCurve()));
    }
}
