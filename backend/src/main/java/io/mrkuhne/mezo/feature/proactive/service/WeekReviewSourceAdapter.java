package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.WeekReviewSource;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Proactive side of {@code WeekContextRenderer}'s "heti elemzés" section — see
 * {@link WeekReviewSource}. Deliberately a plain repository read + mapping, not
 * {@code WeeklyReviewGenerator}, to keep the companion → proactive dependency out of the graph
 * entirely (companion consumes ONLY this port).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class WeekReviewSourceAdapter implements WeekReviewSource {

    private final WeeklyReviewRepository weeklyReviewRepository;

    @Override
    public Optional<ReviewText> find(UUID userId, LocalDate weekStart) {
        return weeklyReviewRepository.findByCreatedByAndWeekStart(userId, weekStart)
                .map(WeekReviewSourceAdapter::toReviewText);
    }

    private static ReviewText toReviewText(WeeklyReviewEntity entity) {
        return new ReviewText(entity.getSummary(), entity.getDayNotes().notes().stream()
                .map(n -> new ReviewText.DayNote(n.date(), n.note()))
                .toList());
    }
}
