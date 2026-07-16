package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic, LLM-free set-level outcome evaluation for accepted workout challenges. hit/miss from
 * the logged sets of the target exercise in the day's instance; inconclusive (outcome_good=null) when
 * the instance is completed (or the day passed) with no logged sets — never a fabricated miss. A today
 * challenge whose instance is still in progress (or not started) is left untouched (still accepted).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH}, havingValue = "true")
public class ChallengeOutcomeEvaluator {

    private final ChallengeRepository challengeRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;

    /** Backstop over all accepted challenges of the user. Returns the count resolved. */
    @Transactional
    public int evaluateDue(UUID userId, LocalDate today) {
        int resolved = 0;
        for (ChallengeEntity c : challengeRepository.findByCreatedByAndStatus(userId, ChallengeEntity.STATUS_ACCEPTED)) {
            if (evaluate(c, today)) { resolved++; }
        }
        return resolved;
    }

    /** Evaluate one accepted challenge; returns true if it left the accepted state. */
    @Transactional
    public boolean evaluate(ChallengeEntity c, LocalDate today) {
        if (!ChallengeEntity.STATUS_ACCEPTED.equals(c.getStatus())) { return false; }
        Optional<WorkoutSessionEntity> instance = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc(
                c.getCreatedBy(), c.getTemplateSessionId(), c.getWorkoutDate());
        // Completion gate: an in-progress instance today ("not yet done", spec §5) must be left
        // untouched — otherwise a mid-workout GET/refetch would resolve it against PARTIAL sets and
        // the sticky miss would block a later real PR. Only resolve when the instance is completed
        // OR the workout day is already over.
        boolean instanceDone = instance.map(w -> "completed".equals(w.getStatus())).orElse(false);
        boolean dayPassed = c.getWorkoutDate().isBefore(today);
        if (!instanceDone && !dayPassed) {
            return false; // in-progress today OR not started — leave accepted, do not resolve
        }
        List<ExerciseSetEntity> logged = instance
            .map(w -> exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(c.getCreatedBy(), w.getId(), c.getExerciseId())
                .stream().filter(s -> !s.isSkipped() && s.getReps() != null).toList())
            .orElse(List.of());
        if (logged.isEmpty()) {
            // Reachable only when instanceDone || dayPassed (earlier gate). A completed instance with
            // no logged sets resolves inconclusive NOW — it never waits out the day (spec 2026-07-15).
            c.setStatus(ChallengeEntity.STATUS_INCONCLUSIVE);
            c.setOutcome("Nem értékelhető — nem lett logolva.");
            c.setOutcomeGood(null);
            challengeRepository.saveAndFlush(c);
            return true;
        }
        boolean hit = switch (c.getType()) {
            case ChallengeEntity.TYPE_PR -> logged.stream().anyMatch(s ->
                s.getWeightKg() != null && c.getTargetWeightKg() != null
                    && s.getWeightKg().compareTo(c.getTargetWeightKg()) >= 0
                    && s.getReps() != null && c.getTargetReps() != null && s.getReps() >= c.getTargetReps());
            case ChallengeEntity.TYPE_DEPTH -> {
                ExerciseSetEntity last = logged.get(logged.size() - 1);
                yield last.getRir() != null && c.getTargetRir() != null && last.getRir() <= c.getTargetRir();
            }
            case ChallengeEntity.TYPE_VOLUME -> c.getTargetSets() != null && logged.size() >= c.getTargetSets();
            default -> false;
        };
        c.setStatus(hit ? ChallengeEntity.STATUS_HIT : ChallengeEntity.STATUS_MISS);
        c.setOutcomeGood(hit);
        c.setOutcome((hit ? "Sikerült · " : "Nem sikerült most · ") + describe(c, logged));
        challengeRepository.saveAndFlush(c);
        return true;
    }

    private String describe(ChallengeEntity c, List<ExerciseSetEntity> logged) {
        return switch (c.getType()) {
            case ChallengeEntity.TYPE_PR -> {
                BigDecimal best = logged.stream().map(ExerciseSetEntity::getWeightKg)
                    .filter(w -> w != null).reduce(BigDecimal.ZERO, (a, b) -> a.compareTo(b) >= 0 ? a : b);
                yield "legjobb szett " + best.stripTrailingZeros().toPlainString() + " kg";
            }
            case ChallengeEntity.TYPE_DEPTH -> "utolsó szet RIR " + logged.get(logged.size() - 1).getRir();
            case ChallengeEntity.TYPE_VOLUME -> logged.size() + " logolt szett";
            default -> "";
        };
    }
}
