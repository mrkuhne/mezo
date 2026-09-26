package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Weekly SCHEDULED training energy (kcal/day) from the owner's recurring gym + sport slots, via the
 * net activity-energy model ({@link ActivityEnergyModel}), moderate band; the weekly plan is a base
 * the served target spreads evenly (spec D2). Running is goal-linked + segment-dependent, so it is
 * exposed as a per-session primitive for the projection to weight per segment. Rest energy
 * (kcal/hour) is a parameter (biometrics/the activity model owns its derivation).
 */
@Service
@RequiredArgsConstructor
public class WeeklyScheduledActivityService {

    private static final String KIND_GYM = "gym";
    private static final String KIND_RUN = "run";
    private static final int DAYS_PER_WEEK = 7;
    private static final int SCALE = 2;

    private final GymScheduleSlotRepository gymRepo;
    private final SportScheduleSlotRepository sportRepo;
    private final RunningBlockRepository runningBlockRepository;
    private final TrainProperties props;
    private final ActivityEnergyModel activityEnergyModel;

    /** Total current scheduled EAT (kcal/day): gym+sport + the owner's currently-active running block. The bootstrap snapshot. */
    @Transactional(readOnly = true)
    public BigDecimal totalWeeklyEatKcalPerDay(UUID userId, BigDecimal restKcalPerHour) {
        return scheduledWeeklyEatKcalPerDay(userId, restKcalPerHour)
            .add(runWeeklyEatKcalPerDay(currentActiveRunningSessions(userId), restKcalPerHour));
    }

    /** Sessions/week of the owner's currently active running block (0 when none / no structure). */
    private int currentActiveRunningSessions(UUID userId) {
        return runningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream()
            .findFirst()
            .map(b -> b.getStructure() == null || b.getStructure().weeks() == null || b.getStructure().weeks().isEmpty()
                ? 0
                : (b.getStructure().weeks().get(0).sessions() == null ? 0 : b.getStructure().weeks().get(0).sessions().size()))
            .orElse(0);
    }

    /** Gym + sport recurring weekly schedule energy ÷ 7 (kcal/day). Segment-independent. */
    @Transactional(readOnly = true)
    public BigDecimal scheduledWeeklyEatKcalPerDay(UUID userId, BigDecimal restKcalPerHour) {
        BigDecimal weekly = BigDecimal.ZERO;
        for (GymScheduleSlotEntity g : gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)) {
            weekly = weekly.add(blockKcal(KIND_GYM, props.gymDefaultMinutes(), restKcalPerHour));
        }
        for (SportScheduleSlotEntity s : sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)) {
            weekly = weekly.add(blockKcal(s.getSport(), s.getDurationMin(), restKcalPerHour));
        }
        return weekly.divide(BigDecimal.valueOf(DAYS_PER_WEEK), SCALE, RoundingMode.HALF_UP);
    }

    /** Distinct scheduled training weekdays (0=Mon..6=Sun): gym ∪ sport recurring slots. Running is
     *  goal-linked/per-segment, so the projection unions its days itself (slice 3 day-type split). */
    @Transactional(readOnly = true)
    public Set<Integer> scheduledTrainingDayOfWeeks(UUID userId) {
        Set<Integer> days = new TreeSet<>();
        gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)
            .forEach(g -> days.add(g.getDayOfWeek()));
        sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)
            .forEach(s -> days.add(s.getDayOfWeek()));
        return days;
    }

    /** One running kind × sessionsPerWeek ÷ 7 (kcal/day). The projection weights this per segment. */
    public BigDecimal runWeeklyEatKcalPerDay(int sessionsPerWeek, BigDecimal restKcalPerHour) {
        if (sessionsPerWeek <= 0) {
            return BigDecimal.ZERO;
        }
        return blockKcal(KIND_RUN, props.runDefaultMinutes(), restKcalPerHour)
            .multiply(BigDecimal.valueOf(sessionsPerWeek))
            .divide(BigDecimal.valueOf(DAYS_PER_WEEK), SCALE, RoundingMode.HALF_UP);
    }

    /** Net kcal of one planned block at the moderate band (a plan carries no felt effort). 0 when rest energy is unknown. */
    public BigDecimal blockKcal(String kind, int durationMin, BigDecimal restKcalPerHour) {
        return BigDecimal.valueOf(activityEnergyModel.netKcal(kind, null, durationMin, restKcalPerHour).orElse(0));
    }
}
