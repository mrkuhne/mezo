package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.WeeklyReviewResponse;
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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly review read/regenerate surface (Én/Heti, spec 2026-08-27 §5, bd mezo-p2tr): find
 * returns the row AS-IS (no lazy generation — the WeeklyReviewJob owns that); {@code stale}
 * delegates to the shared {@link LogFreshnessProbe} over the OTHER aggregates a review draws
 * from (mezo-hqfi.1); regenerate soft-deletes the live row (if any) and re-runs
 * {@link WeeklyReviewGenerator}, which then sees no existing row and does its normal
 * gather-and-call.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class WeeklyReviewService {

    private final WeeklyReviewRepository weeklyReviewRepository;
    private final WeeklyReviewGenerator generator;
    private final ProactiveMapper mapper;
    private final LogFreshnessProbe logFreshnessProbe;

    public Optional<WeeklyReviewEntity> find(UUID userId, LocalDate weekStart) {
        return weeklyReviewRepository.findByCreatedByAndWeekStart(userId, weekStart);
    }

    @Transactional
    public WeeklyReviewResponse getResponse(UUID userId, LocalDate weekStart) {
        WeeklyReviewEntity review = find(userId, weekStart).orElseThrow(WeeklyReviewService::notFound);
        WeeklyReviewResponse response = mapper.toWeeklyReviewResponse(review);
        response.setStale(staleSince(userId, weekStart, review.getGeneratedAt()));
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
        response.setStale(staleSince(userId, weekStart, fresh.getGeneratedAt()));
        return response;
    }

    /** Delegates to the shared {@link LogFreshnessProbe} (mezo-hqfi.1) with this review's ISO
     *  week as the window — same four log sources, same best-effort contract as before. */
    private boolean staleSince(UUID userId, LocalDate weekStart, Instant generatedAt) {
        return logFreshnessProbe.anyLoggedAfter(userId, weekStart, weekStart.plusDays(6), generatedAt);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
