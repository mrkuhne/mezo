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
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService.DraftSlot;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
