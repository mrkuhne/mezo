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
import io.mrkuhne.mezo.feature.train.service.ActivityEnergyModel;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
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
    private final LearnedBaseResolver learnedBase;

    public Calculation calculate(UUID userId, GoalEntity goal) {
        return calculate(userId, goal, null);
    }

    /**
     * The same read-only calculation against an UNSAVED diet draft: {@code draftPreferences}, when
     * non-null, replaces what {@link DietPreferencesPort#resolve} would return, so a caller can
     * project what a settings change WOULD prescribe without writing the preference row or the
     * goal. Nothing else differs — one calculation path, so a preview can never drift from what
     * the save actually produces.
     *
     * @param draftPreferences the draft to project with, or {@code null} for the owner's saved/ghost ones
     */
    public Calculation calculate(UUID userId, GoalEntity goal, DietPreferences draftPreferences) {
        Function<BigDecimal, BigDecimal> draftEat = DRAFT_EAT.get(); // non-null only inside the draft overload
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        GuardStatus guards = guardService.evaluate(goal, linkedMesoIds(goal, userId), trend);
        BiometricProfileEntity profile =
            profileRepository.findByCreatedByAndDeletedFalse(userId).orElse(null);
        if (profile == null) {
            return new Calculation(null, evaluationService.missingProfile(guards));
        }

        BigDecimal currentWeightKg = currentWeightKg(userId, goal);
        BigDecimal rest = ActivityEnergyModel.restKcalPerHour(bootstrapService.bmr(profile, currentWeightKg), currentWeightKg)
            .orElse(null);
        BigDecimal weeklyEat = weeklyActivity.totalWeeklyEatKcalPerDay(userId, rest);
        if (draftEat != null) { // total = scheduled + running → swap only the scheduled part for the draft's
            weeklyEat = weeklyEat.subtract(weeklyActivity.scheduledWeeklyEatKcalPerDay(userId, rest)).add(draftEat.apply(rest));
        }
        DietPreferences preferences =
            draftPreferences != null ? draftPreferences : dietPreferences.resolve(userId);
        // Resolved first so a draft with the learning switch flipped projects what the save would serve.
        TdeeBootstrapJson bootstrap = learnedBase.apply(userId,
            bootstrapService.compute(profile, currentWeightKg, weeklyEat), preferences.learningEnabled());
        List<ProjectionSegment> segments = projectionService.project(goal, userId, bootstrap, trend, draftEat);
        BigDecimal sleepTargetH = sleepTargetPort.targetHours(userId);
        GoalPrescriptionJson prescription = evaluationService.assemble(
            goal, currentWeightKg, profile.getBodyFatPct(), segments, guards,
            preferences, sleepTargetH,
            bootstrap != null && LearnedBaseResolver.SOURCE_LEARNED.equals(bootstrap.baseSource()));
        return new Calculation(bootstrap, prescription);
    }

    /**
     * The same read-only calculation against an UNSAVED weekly gym + sport schedule (Boop B6 Évad, mezo-r36n9.16):
     * when {@code draftEat} is non-null it replaces the repository-backed SCHEDULED (gym + sport) weekly EAT — in the
     * bootstrap and in every projected segment — receiving the rest energy (kcal/hour, possibly {@code null}) and
     * returning the draft's kcal/day; the owner's active running block is still added as today. {@code goal} may be
     * a detached, never-saved entity (a season draft's goal, with its {@code createdBy} set); nothing is saved.
     *
     * <p>Why a thread-local instead of a parameter: the 3-arg method above is the one pipeline body, and the frozen
     * biometrics↔goal ArchUnit cycle (archunit-store) records its biometrics reads by signature and source order,
     * so the body must stay where and as it is. {@link #DRAFT_EAT} is set only for the duration of this call.
     *
     * @param draftPreferences the diet draft, or {@code null} for the owner's saved/ghost preferences
     * @param draftEat         rest kcal/hour → the draft gym + sport EAT (kcal/day), or {@code null} for the scheduled one
     */
    public Calculation calculate(UUID userId, GoalEntity goal, DietPreferences draftPreferences,
                                 Function<BigDecimal, BigDecimal> draftEat) {
        if (draftEat == null) {
            return calculate(userId, goal, draftPreferences);
        }
        DRAFT_EAT.set(draftEat);
        try {
            return calculate(userId, goal, draftPreferences);
        } finally {
            DRAFT_EAT.remove();
        }
    }

    /** The draft gym + sport EAT of an in-flight draft {@code calculate} call on this thread; null otherwise. */
    private static final ThreadLocal<Function<BigDecimal, BigDecimal>> DRAFT_EAT = new ThreadLocal<>();

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
