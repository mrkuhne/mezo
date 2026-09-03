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
        return weeklyReview(createdBy, weekStart, List.of(new WeeklyReviewHighlightsEnvelope.Highlight(
                WeeklyReviewHighlightsEnvelope.Highlight.KIND_MEMORY, weekStart.toString(), null)));
    }

    /** mezo-d20.7.7: a review with EXPLICIT highlights — the citation signal counts their refIds. */
    public WeeklyReviewEntity weeklyReview(UUID createdBy, LocalDate weekStart,
            List<WeeklyReviewHighlightsEnvelope.Highlight> highlights) {
        WeeklyReviewEntity entity = new WeeklyReviewEntity();
        entity.setCreatedBy(createdBy);
        entity.setWeekStart(weekStart);
        entity.setSummary("Teszt heti elemzés.");
        entity.setDayNotes(new WeeklyReviewDayNotesEnvelope(List.of()));
        entity.setHighlights(new WeeklyReviewHighlightsEnvelope(highlights));
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return weeklyReviewRepository.saveAndFlush(entity);
    }
}
