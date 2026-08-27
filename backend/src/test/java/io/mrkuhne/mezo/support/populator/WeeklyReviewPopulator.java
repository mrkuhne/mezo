package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewDayNotesEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewHighlightsEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code weekly_review} rows (proactive, mezo-p2tr). */
@TestComponent
@RequiredArgsConstructor
public class WeeklyReviewPopulator {

    private final WeeklyReviewRepository weeklyReviewRepository;

    public WeeklyReviewEntity weeklyReview(UUID createdBy, LocalDate weekStart) {
        WeeklyReviewEntity entity = new WeeklyReviewEntity();
        entity.setCreatedBy(createdBy);
        entity.setWeekStart(weekStart);
        entity.setSummary("Teszt heti elemzés.");
        entity.setDayNotes(new WeeklyReviewDayNotesEnvelope(List.of()));
        entity.setHighlights(new WeeklyReviewHighlightsEnvelope(
                List.of(new WeeklyReviewHighlightsEnvelope.Highlight("Memory", weekStart.toString()))));
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return weeklyReviewRepository.saveAndFlush(entity);
    }
}
