package io.mrkuhne.mezo.feature.companion;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port for {@code WeekContextRenderer}'s "heti elemzés" section (mezo-p2tr): companion only needs
 * the review's prose summary + short per-day notes; the {@code weekly_review} row itself belongs
 * to {@code feature/proactive}, which implements this ({@code proactive/service/WeekReviewSourceAdapter}).
 * The dependency stays proactive → companion, never back — proactive already depends on companion
 * ({@code WeeklyReviewGenerator} calling {@code MeWeekService}, {@code CompanionLlm}, …), so a
 * direct {@code companion.service → proactive.repository.WeeklyReviewRepository} import would
 * close a NEW slice cycle ({@code ArchitectureTest#feature_slices_are_cycle_free}); this port keeps
 * it one-directional, the {@code TodayQuestSource}/{@code TodayActivitySource} precedent. Bean
 * exists only when both the companion and proactive switches are on; consume via
 * {@code ObjectProvider} — an absent bean renders the block WITHOUT the review section, never a
 * fabricated one.
 */
public interface WeekReviewSource {

    record ReviewText(String summary, List<DayNote> dayNotes) {
        public record DayNote(LocalDate date, String note) {}
    }

    /** The live weekly-review row for this ISO-Monday week, if one has been generated. */
    Optional<ReviewText> find(UUID userId, LocalDate weekStart);
}
