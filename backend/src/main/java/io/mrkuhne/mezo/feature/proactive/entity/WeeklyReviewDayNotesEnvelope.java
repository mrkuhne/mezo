package io.mrkuhne.mezo.feature.proactive.entity;

import java.time.LocalDate;
import java.util.List;

/**
 * Typed jsonb envelope for {@code weekly_review.day_notes} (spec §5, mezo-p2tr): one short
 * companion note per day the answer chose to comment on — dates outside the review's own week
 * are filtered at parse time, never persisted here.
 */
public record WeeklyReviewDayNotesEnvelope(List<DayNote> notes) {

    public record DayNote(LocalDate date, String note) {
    }
}
