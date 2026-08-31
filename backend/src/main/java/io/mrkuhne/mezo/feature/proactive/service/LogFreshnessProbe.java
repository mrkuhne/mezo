package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * "Has anything been logged in [from, to] since {@code since}?" — the shared basis of every
 * generated artifact's {@code stale} flag (mezo-hqfi.1). Extracted verbatim from
 * {@code WeeklyReviewService#isStale} and generalised from an ISO week to an arbitrary window,
 * because the diagnosis probes a rolling 14 days.
 *
 * <p>Probes weight / sleep / check-in / meal logs. Workout logs are deliberately NOT probed:
 * {@code WorkoutSessionEntity.date} is nullable on template rows, so a clean date-window read
 * is not available (the rationale the original carried).
 *
 * <p>Only {@code createdAt} is observable — {@code OwnedEntity} has no {@code updatedAt}, so an
 * EDITED log cannot mark anything stale. Making edits observable is bd mezo-hszs.
 *
 * <p>Best-effort: false on ANY probe failure. Staleness is a hint, never a reason to fail a read.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class LogFreshnessProbe {

    private final WeightLogRepository weightLogRepository;
    private final SleepLogRepository sleepLogRepository;
    private final CheckInRepository checkInRepository;
    private final MealRepository mealRepository;

    public boolean anyLoggedAfter(UUID userId, LocalDate from, LocalDate to, Instant since) {
        try {
            return newerThan(weightLogRepository
                            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(userId, from, to)
                            .map(e -> e.getCreatedAt()), since)
                    || newerThan(sleepLogRepository
                            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(userId, from, to)
                            .map(e -> e.getCreatedAt()), since)
                    || newerThan(checkInRepository
                            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(userId, from, to)
                            .map(e -> e.getCreatedAt()), since)
                    || newerThan(mealRepository
                            .findFirstByCreatedByAndDeletedFalseAndMealDateBetweenOrderByCreatedAtDesc(userId, from, to)
                            .map(e -> e.getCreatedAt()), since);
        } catch (Exception e) {
            log.warn("Log freshness probe failed for {} [{}..{}]: {}", userId, from, to, e.getMessage());
            return false;
        }
    }

    private static boolean newerThan(Optional<Instant> candidate, Instant since) {
        return candidate.map(createdAt -> createdAt.isAfter(since)).orElse(false);
    }
}
