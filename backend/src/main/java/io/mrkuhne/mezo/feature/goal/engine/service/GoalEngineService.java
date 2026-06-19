package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
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
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The G5 engine's <b>orchestrator façade</b> (spec §5). {@code evaluate(userId, goalId)} assembles the
 * full segmented {@link GoalPrescriptionJson} by chaining the upstream engine services and persists
 * the result onto the goal ({@code tdeeBootstrap} + {@code prescription} jsonb columns):
 *
 * <ol>
 *   <li>Load the goal (ownership-gated — foreign/missing → 404) + the owner's biometric profile + the
 *       latest weigh-in.</li>
 *   <li><b>No biometric profile</b> → a graceful prescription carrying a "profile required" note (no
 *       throw, no bootstrap) so the recompute triggers (Task 9) never break; persisted as-is.</li>
 *   <li>{@link TdeeBootstrapService#compute} → persist {@code goal.tdeeBootstrap};
 *       {@link WeightTrendService#computeTrend} (the EWMA spine);
 *       {@link GoalProjectionService#project} → the segments;
 *       {@link GuardEvaluationService#evaluate} (passing the goal's mesocycle-link planIds) → the
 *       soft-guard status.</li>
 *   <li>{@link GoalEvaluationService#assemble} grades feasibility + folds segments + guards into the
 *       artifact; persist {@code goal.prescription}.</li>
 * </ol>
 *
 * <p>{@code @Transactional} because it writes the goal (dirty-checking flushes the two jsonb columns).
 * The decision + assembly logic lives in {@link GoalEvaluationService} (pure); this class only does the
 * I/O orchestration. Recompute triggers (Task 9) and the HTTP {@code evaluate} endpoint (Task 10) call
 * this same method.
 */
@Service
@RequiredArgsConstructor
public class GoalEngineService {

    private static final String PLAN_MESOCYCLE = "mesocycle";

    private final GoalRepository goalRepository;
    private final GoalPlanLinkRepository linkRepository;
    private final BiometricProfileRepository profileRepository;
    private final WeightLogRepository weightLogRepository;
    private final TdeeBootstrapService bootstrapService;
    private final WeightTrendService weightTrendService;
    private final GoalProjectionService projectionService;
    private final GuardEvaluationService guardService;
    private final GoalEvaluationService evaluationService;

    /**
     * Evaluate a goal: assemble + persist its segmented prescription (and TDEE bootstrap).
     *
     * @param userId the owner principal — every read is ownership-checked
     * @param goalId the goal to evaluate
     * @return the freshly assembled {@link GoalPrescriptionJson} (also persisted on the goal)
     */
    @Transactional
    public GoalPrescriptionJson evaluate(UUID userId, UUID goalId) {
        GoalEntity goal = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

        // Guards never depend on the profile — evaluate them regardless so the graceful path still
        // carries the (inactive/empty) guard status.
        GuardStatus guards = guardService.evaluate(goal, linkedMesoIds(goal, userId),
            weightTrendService.computeTrend(userId));

        BiometricProfileEntity profile =
            profileRepository.findByCreatedByAndDeletedFalse(userId).orElse(null);
        if (profile == null) {
            // Graceful: no profile → no bootstrap, a feasibility note, never throw (Task 9 relies on it).
            GoalPrescriptionJson rx = evaluationService.missingProfile(guards);
            goal.setPrescription(rx);
            return rx;
        }

        BigDecimal currentWeightKg = currentWeightKg(userId, goal);

        TdeeBootstrapJson bootstrap = bootstrapService.compute(profile, currentWeightKg);
        goal.setTdeeBootstrap(bootstrap);

        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        List<ProjectionSegment> segments = projectionService.project(goal, userId, bootstrap, trend);

        GoalPrescriptionJson rx = evaluationService.assemble(
            goal, currentWeightKg, profile.getBodyFatPct(), segments, guards);
        goal.setPrescription(rx);
        return rx;
    }

    /** The goal's linked mesocycle planIds — the muscle-volume guard scope (Task 7). */
    private Set<UUID> linkedMesoIds(GoalEntity goal, UUID userId) {
        List<GoalPlanLinkEntity> links =
            linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goal.getId(), userId);
        Set<UUID> ids = new LinkedHashSet<>();
        for (GoalPlanLinkEntity l : links) {
            if (PLAN_MESOCYCLE.equals(l.getPlanType())) {
                ids.add(l.getPlanId());
            }
        }
        return ids;
    }

    /**
     * The current body weight (kg): the latest weigh-in ({@code findAllOwned} is date-ascending, so the
     * last row), falling back to the goal's {@code startWeightKg} when no weigh-in exists yet.
     */
    private BigDecimal currentWeightKg(UUID userId, GoalEntity goal) {
        List<WeightLogEntity> logs = weightLogRepository.findAllOwned(userId);
        if (logs.isEmpty()) {
            return goal.getStartWeightKg();
        }
        return logs.get(logs.size() - 1).getWeightKg();
    }
}
