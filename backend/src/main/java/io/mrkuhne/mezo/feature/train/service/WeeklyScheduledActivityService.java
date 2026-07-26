package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Weekly SCHEDULED training energy (kcal/day) from the owner's recurring gym + sport slots, MET×kg×óra
 * based. The train domain owns the schedule + the MET model (a drift-guard test binds the MET table to
 * the FE fuelConfig). Running is goal-linked + segment-dependent, so it is exposed as a per-session
 * primitive for the projection to weight per segment. Weight is a parameter (biometrics owns it).
 */
@Service
@RequiredArgsConstructor
public class WeeklyScheduledActivityService {

    private static final String KIND_GYM = "gym";
    private static final String KIND_SPORT = "sport";
    private static final String KIND_RUN = "run";
    private static final int DAYS_PER_WEEK = 7;
    private static final int SCALE = 2;

    private final GymScheduleSlotRepository gymRepo;
    private final SportScheduleSlotRepository sportRepo;
    private final TrainProperties props;

    /** Gym + sport recurring weekly schedule energy ÷ 7 (kcal/day). Segment-independent. */
    @Transactional(readOnly = true)
    public BigDecimal scheduledWeeklyEatKcalPerDay(UUID userId, BigDecimal weightKg) {
        BigDecimal weekly = BigDecimal.ZERO;
        for (GymScheduleSlotEntity g : gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)) {
            weekly = weekly.add(blockKcal(KIND_GYM, props.gymDefaultMinutes(), weightKg));
        }
        for (SportScheduleSlotEntity s : sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)) {
            weekly = weekly.add(blockKcal(KIND_SPORT, s.getDurationMin(), weightKg));
        }
        return weekly.divide(BigDecimal.valueOf(DAYS_PER_WEEK), SCALE, RoundingMode.HALF_UP);
    }

    /** One running kind × sessionsPerWeek ÷ 7 (kcal/day). The projection weights this per segment. */
    public BigDecimal runWeeklyEatKcalPerDay(int sessionsPerWeek, BigDecimal weightKg) {
        if (sessionsPerWeek <= 0) {
            return BigDecimal.ZERO;
        }
        return blockKcal(KIND_RUN, props.runDefaultMinutes(), weightKg)
            .multiply(BigDecimal.valueOf(sessionsPerWeek))
            .divide(BigDecimal.valueOf(DAYS_PER_WEEK), SCALE, RoundingMode.HALF_UP);
    }

    /** MET × kg × (durationMin / 60). The shared MET×kg×óra primitive. */
    public BigDecimal blockKcal(String kind, int durationMin, BigDecimal weightKg) {
        double met = switch (kind) {
            case KIND_GYM -> props.met().gym();
            case KIND_SPORT -> props.met().sport();
            case KIND_RUN -> props.met().run();
            default -> props.met().defaultKind();
        };
        return BigDecimal.valueOf(met)
            .multiply(weightKg)
            .multiply(BigDecimal.valueOf(durationMin))
            .divide(BigDecimal.valueOf(60), SCALE, RoundingMode.HALF_UP);
    }
}
