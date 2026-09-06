package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic (non-LLM) daily "overload" challenge (Plan 3, bd mezo-gj42): ONE challenge per
 * (user, template day, today) targeting the day's biggest recommended jump — the largest +kg
 * (weight lever), else the largest meaningful +rep (rep lever). Reads the already-computed
 * per-exercise {@link ProgressionSignal} from {@link WorkoutService#getToday} (no duplication of the
 * deload/effective-set/intensity logic; getToday is the idempotent lazy-settle entry point). Deload
 * and no-jump days emit none (honest). Guaranteed +1: generated alongside the LLM ChallengeGenerator
 * in {@link ProactiveChallengeService}, INDEPENDENT of its max-per-workout cap.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class OverloadChallengeGenerator {

    private final ChallengeRepository challengeRepository;
    private final WorkoutService workoutService;

    @Transactional
    public List<ChallengeEntity> generate(UUID userId, UUID templateSessionId, LocalDate date) {
        if (!date.equals(LocalDate.now(MedicationCycleService.MEDICATION_ZONE))) {
            // mezo-ned9: owner-local, mirroring ChallengeGenerator's gate — the two must accept the
            // SAME set of days or one challenge kind silently vanishes between the two midnights.
            return List.of();   // past/future never generate (mirror ChallengeGenerator)
        }
        List<ChallengeEntity> existing = challengeRepository
                .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(userId, templateSessionId, date)
                .stream().filter(c -> ChallengeEntity.TYPE_OVERLOAD.equals(c.getType())).toList();
        if (!existing.isEmpty()) {
            return existing;    // idempotent, no recompute
        }
        WorkoutTodayResponse today = workoutService.getToday(userId, templateSessionId);
        if (today.getTemplateSessionId() == null
                || !today.getTemplateSessionId().equals(templateSessionId)
                || today.getExercises() == null) {
            return List.of();   // getToday resolved a different day (open instance) or no exercises
        }
        Optional<TodayExercise> pick = pickBiggestJump(today.getExercises());
        if (pick.isEmpty()) {
            return List.of();   // deload / no meaningful jump → honest empty
        }
        TodayExercise ex = pick.get();
        ChallengeEntity e = build(userId, templateSessionId, date, ex, ex.getProgression());
        log.debug("Overload challenge for {} / {} on exercise {}", userId, templateSessionId, ex.getId());
        return List.of(challengeRepository.saveAndFlush(e));
    }

    /** Largest +kg (weight lever, >0), else the largest meaningful +rep (rep lever, >=1). */
    private Optional<TodayExercise> pickBiggestJump(List<TodayExercise> exercises) {
        Optional<TodayExercise> weight = exercises.stream()
                .filter(t -> t.getProgression() != null
                        && t.getProgression().getLever() == ProgressionSignal.LeverEnum.WEIGHT
                        && t.getProgression().getDeltaKg() != null
                        && t.getProgression().getDeltaKg().compareTo(BigDecimal.ZERO) > 0)
                .max(Comparator.comparing(t -> t.getProgression().getDeltaKg()));
        if (weight.isPresent()) {
            return weight;
        }
        return exercises.stream()
                .filter(t -> t.getProgression() != null
                        && t.getProgression().getLever() == ProgressionSignal.LeverEnum.REP
                        && t.getProgression().getDeltaReps() != null
                        && t.getProgression().getDeltaReps() >= 1)
                .max(Comparator.comparing(t -> t.getProgression().getDeltaReps()));
    }

    private ChallengeEntity build(UUID userId, UUID templateSessionId, LocalDate date,
                                  TodayExercise ex, ProgressionSignal sig) {
        ChallengeEntity e = new ChallengeEntity();
        e.setCreatedBy(userId);
        e.setTemplateSessionId(templateSessionId);
        e.setWorkoutDate(date);
        e.setExerciseId(ex.getId());              // TodayExercise.id == the TEMPLATE exercise id
        e.setExerciseName(ex.getName());
        e.setType(ChallengeEntity.TYPE_OVERLOAD);
        e.setStatus(ChallengeEntity.STATUS_PROPOSED);
        e.setRisk(ChallengeEntity.RISK_LOW);
        e.setTitle("⚡ Túlterhelés · " + ex.getName());
        e.setWhy(sig.getRationale());             // the engine's HU rationale (grounded)
        e.setGlory("Teljesítsd a mai ajánlott terhelést.");
        e.setTargetWeightKg(sig.getTargetWeightKg());   // both BigDecimal — direct (null-safe: null on rep lever)
        e.setTargetReps(sig.getTargetReps());
        e.setConfidence(null);                    // DC8: deterministic, no learned confidence
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return e;
    }
}
