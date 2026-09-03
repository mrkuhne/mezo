package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.goal.engine.port.IntakeAdherencePort;
import io.mrkuhne.mezo.feature.goal.engine.port.IntakeAdherencePort.IntakeAdherence;
import io.mrkuhne.mezo.feature.goal.engine.port.SleepAdequacyPort;
import io.mrkuhne.mezo.feature.goal.engine.service.AdaptiveCorrectionService.Correction;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Monday adaptive review (diet-plan slice 5): for the owner's active goal, compare the
 * observed EWMA rate to the target rate and propose a smoothed {@code weekly_correction}
 * suggestion (suggest + approve — this NEVER writes a target itself). Gates: an active evaluated
 * goal, trend sufficiency (inside {@link AdaptiveCorrectionService}), dead-band, and per-week
 * idempotency via the (goal_id, dedup_key) unique index — {@code propose} returns null on a dedup
 * hit, decided rows included, so a dismissed week is never re-proposed.
 */
@Service
@RequiredArgsConstructor
public class AdaptiveReviewService {

    private static final String STATUS_ACTIVE = "active";

    private final GoalRepository goalRepository;
    private final WeightTrendService weightTrendService;
    private final AdaptiveCorrectionService correctionService;
    private final SleepAdequacyPort sleepAdequacy;
    private final IntakeAdherencePort intakeAdherence;
    private final GoalSuggestionService suggestionService;

    /** Review one user's active goal for the week starting {@code weekStart}; true = proposed. */
    @Transactional
    public boolean reviewUser(UUID userId, LocalDate weekStart) {
        GoalEntity goal = goalRepository
            .findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE)
            .stream().findFirst().orElse(null);
        if (goal == null || goal.getPrescription() == null) {
            return false; // nothing to correct without an evaluated active goal
        }

        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        boolean sleepDebted = sleepAdequacy.sleepDebted(userId, weekStart);
        Optional<Correction> correction = correctionService.compute(goal, trend, sleepDebted);
        if (correction.isEmpty()) {
            return false;
        }

        Correction c = correction.get();
        IntakeAdherence adherence = intakeAdherence.weekAdherence(userId, weekStart.minusDays(7));

        // Weekly-correction payload: phase_change-only components null, reason carries the
        // Hungarian rationale, prescriptionGeneratedAt is the accept-time race-guard snapshot.
        GoalSuggestionPayloadJson payload = new GoalSuggestionPayloadJson(
            c.rationaleHu(), null, null, null, null, null, null, null,
            weekStart.toString(), c.deltaKcal(), c.observedRateKgPerWk(), c.targetRateKgPerWk(),
            c.dampedBySleep(), adherence.loggedDays(), adherence.avgIntakeKcal(),
            adherence.avgTargetKcal(), goal.getPrescription().generatedAt());

        return suggestionService.propose(userId, goal.getId(),
            GoalSuggestionService.KIND_WEEKLY_CORRECTION, "weekly:" + weekStart, payload) != null;
    }
}
