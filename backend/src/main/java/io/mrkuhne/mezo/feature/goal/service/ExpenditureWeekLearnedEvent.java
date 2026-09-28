package io.mrkuhne.mezo.feature.goal.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * A worth-saying weekly learned-expenditure row (mezo-3n2so Task 6, spec §5.2), published by
 * {@code AdaptiveReviewJob} itself right after a present, worth-saying row with the owner's
 * learning switch on — never by {@code ExpenditureLearningService.reviewWeek} directly, so the
 * rollout runner and {@code IntakeDayMarkService} never ring this bell.
 */
public record ExpenditureWeekLearnedEvent(
    UUID userId,
    UUID estimateId,
    LocalDate weekStart,
    String status,
    int stepKcal,
    int excludedCount
) {
}
