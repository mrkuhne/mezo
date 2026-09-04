package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepTargetPort;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalProjectionService.ProjectionSegment;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson.GuardStatus;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Shared read-only goal prescription calculation used by persisted evaluation and suggestion
 * previews. It may read domain inputs, but it never saves entities, publishes events, or emits
 * suggestions; callers decide whether its result belongs on a managed goal.
 */
@Service
@RequiredArgsConstructor
public class GoalPrescriptionCalculator {

    private static final String PLAN_MESOCYCLE = "mesocycle";

    private final GoalPlanLinkRepository linkRepository;
    private final BiometricProfileRepository profileRepository;
    private final WeightLogRepository weightLogRepository;
    private final TdeeBootstrapService bootstrapService;
    private final WeightTrendService weightTrendService;
    private final GoalProjectionService projectionService;
    private final GuardEvaluationService guardService;
    private final GoalEvaluationService evaluationService;
    private final WeeklyScheduledActivityService weeklyActivity;
    private final DietPreferencesPort dietPreferences;
    private final SleepTargetPort sleepTargetPort;

    public Calculation calculate(UUID userId, GoalEntity goal) {
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        GuardStatus guards = guardService.evaluate(goal, linkedMesoIds(goal, userId), trend);
        BiometricProfileEntity profile =
            profileRepository.findByCreatedByAndDeletedFalse(userId).orElse(null);
        if (profile == null) {
            return new Calculation(null, evaluationService.missingProfile(guards));
        }

        BigDecimal currentWeightKg = currentWeightKg(userId, goal);
        BigDecimal weeklyEat = weeklyActivity.totalWeeklyEatKcalPerDay(userId, currentWeightKg);
        TdeeBootstrapJson bootstrap = bootstrapService.compute(profile, currentWeightKg, weeklyEat);
        DietPreferences preferences = dietPreferences.resolve(userId);
        List<ProjectionSegment> segments = projectionService.project(
            goal, userId, bootstrap, trend, preferences.dayTypeShiftKcal());
        BigDecimal sleepTargetH = sleepTargetPort.targetHours(userId);
        GoalPrescriptionJson prescription = evaluationService.assemble(
            goal, currentWeightKg, profile.getBodyFatPct(), segments, guards,
            preferences, sleepTargetH);
        return new Calculation(bootstrap, prescription);
    }

    private Set<UUID> linkedMesoIds(GoalEntity goal, UUID userId) {
        List<GoalPlanLinkEntity> links = linkRepository
            .findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goal.getId(), userId);
        Set<UUID> ids = new LinkedHashSet<>();
        for (GoalPlanLinkEntity link : links) {
            if (PLAN_MESOCYCLE.equals(link.getPlanType())) {
                ids.add(link.getPlanId());
            }
        }
        return ids;
    }

    private BigDecimal currentWeightKg(UUID userId, GoalEntity goal) {
        List<WeightLogEntity> logs = weightLogRepository.findAllOwned(userId);
        return logs.isEmpty() ? goal.getStartWeightKg() : logs.get(logs.size() - 1).getWeightKg();
    }

    public record Calculation(
        TdeeBootstrapJson bootstrap,
        GoalPrescriptionJson prescription
    ) {}
}
