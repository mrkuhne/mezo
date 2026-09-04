package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionTriggerService;
import io.mrkuhne.mezo.feature.goal.service.GoalInvariantValidator;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
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

    private static final String STATUS_ACTIVE = "active";

    private final GoalRepository goalRepository;
    private final GoalInvariantValidator goalInvariantValidator;
    private final GoalPrescriptionCalculator calculator;
    private final GoalSuggestionTriggerService triggerService;

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

        if (!goalInvariantValidator.isCoherent(goal)) {
            goal.setPrescription(null);
            goal.setTdeeBootstrap(null);
            return null;
        }

        GoalPrescriptionCalculator.Calculation calculation = calculator.calculate(userId, goal);
        goal.setTdeeBootstrap(calculation.bootstrap());
        goal.setPrescription(calculation.prescription());
        triggerService.checkPhaseSuggestions(userId, goalId); // slice-4 probe — idempotent, deduped
        return calculation.prescription();
    }

    /**
     * Recompute the owner's single ACTIVE goal (if any) — graceful no-op when none is active.
     * The shared body of every "an engine input moved" trigger (weigh-in, profile, schedule edits);
     * extracted from WeightLogService so the trigger set can grow without copy-paste (mezo-3g5w).
     */
    @Transactional
    public void recomputeActiveGoal(UUID userId) {
        List<GoalEntity> active =
            goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE);
        if (active.isEmpty()) {
            return;
        }
        evaluate(userId, active.get(0).getId());
    }

}
