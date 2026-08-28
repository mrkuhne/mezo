package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.WeeklyReviewResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly review read/regenerate surface (Én/Heti, spec 2026-08-27 §5, bd mezo-p2tr): find
 * returns the row AS-IS (no lazy generation — the WeeklyReviewJob owns that); {@code stale} is a
 * best-effort probe over the OTHER aggregates a review draws from; regenerate soft-deletes the
 * live row (if any) and re-runs {@link WeeklyReviewGenerator}, which then sees no existing row
 * and does its normal gather-and-call.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class WeeklyReviewService {

    private final WeeklyReviewRepository weeklyReviewRepository;
    private final WeeklyReviewGenerator generator;
    private final ProactiveMapper mapper;
    private final WeightLogRepository weightLogRepository;
    private final SleepLogRepository sleepLogRepository;
    private final CheckInRepository checkInRepository;
    private final MealRepository mealRepository;

    public Optional<WeeklyReviewEntity> find(UUID userId, LocalDate weekStart) {
        return weeklyReviewRepository.findByCreatedByAndWeekStart(userId, weekStart);
    }

    @Transactional
    public WeeklyReviewResponse getResponse(UUID userId, LocalDate weekStart) {
        WeeklyReviewEntity review = find(userId, weekStart).orElseThrow(WeeklyReviewService::notFound);
        WeeklyReviewResponse response = mapper.toWeeklyReviewResponse(review);
        response.setStale(isStale(userId, weekStart, review.getGeneratedAt()));
        return response;
    }

    @Transactional
    public WeeklyReviewResponse regenerate(UUID userId, LocalDate weekStart) {
        if (weekStart.plusDays(7).isAfter(LocalDate.now())) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("WEEKLY_REVIEW_WEEK_NOT_COMPLETE").build(), HttpStatus.CONFLICT);
        }
        find(userId, weekStart).ifPresent(weeklyReviewRepository::delete);
        WeeklyReviewEntity fresh = generator.generate(userId, weekStart);
        if (fresh == null) {
            throw notFound();
        }
        WeeklyReviewResponse response = mapper.toWeeklyReviewResponse(fresh);
        response.setStale(isStale(userId, weekStart, fresh.getGeneratedAt()));
        return response;
    }

    /** Best-effort: false on ANY probe failure — staleness is a nice-to-have hint, never a
     *  reason to fail the read. Probes weight/sleep/check-in/meal logs (workout logs skipped —
     *  {@code WorkoutSessionEntity.date} is nullable on template rows, so a clean date-window
     *  read isn't as direct as the other four). */
    private boolean isStale(UUID userId, LocalDate weekStart, Instant generatedAt) {
        try {
            LocalDate weekEnd = weekStart.plusDays(6);
            return newerThan(weightLogRepository
                            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(
                                    userId, weekStart, weekEnd)
                            .map(e -> e.getCreatedAt()), generatedAt)
                    || newerThan(sleepLogRepository
                            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(
                                    userId, weekStart, weekEnd)
                            .map(e -> e.getCreatedAt()), generatedAt)
                    || newerThan(checkInRepository
                            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(
                                    userId, weekStart, weekEnd)
                            .map(e -> e.getCreatedAt()), generatedAt)
                    || newerThan(mealRepository
                            .findFirstByCreatedByAndDeletedFalseAndMealDateBetweenOrderByCreatedAtDesc(
                                    userId, weekStart, weekEnd)
                            .map(e -> e.getCreatedAt()), generatedAt);
        } catch (Exception e) {
            log.warn("Weekly review stale probe failed for {} week {}: {}", userId, weekStart, e.getMessage());
            return false;
        }
    }

    private static boolean newerThan(Optional<Instant> candidate, Instant generatedAt) {
        return candidate.map(createdAt -> createdAt.isAfter(generatedAt)).orElse(false);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
