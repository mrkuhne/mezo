package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MeWeekAggregates;
import io.mrkuhne.mezo.api.dto.MeWeekDay;
import io.mrkuhne.mezo.api.dto.MeWeekResponse;
import io.mrkuhne.mezo.feature.companion.WeekReviewSource;
import io.mrkuhne.mezo.feature.companion.WeekReviewSource.ReviewText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Anchored conversations (mezo-p2tr, Task 9): renders the {@code [Heti adatok]} system-prompt
 * block for a conversation pinned to one ISO-Monday week ({@code kind='week'}) or one day inside
 * it ({@code kind='day'}) — the {@link MeWeekService#week(UUID, LocalDate)} day rows (rendered
 * with the SAME {@link MeWeekService#renderDayLine} formatter the weekly-review generator uses,
 * so the two never drift), the weekly aggregates, and the week's own review summary/day-notes
 * when the {@link WeekReviewSource} port (implemented in {@code feature/proactive}) has found one.
 * {@code kind='day'} additionally calls out the anchored day with its own expanded line.
 *
 * <p>Failure honesty (the {@code GraphPromptAssembler} precedent, IDENT-3): never throws — any
 * failure (bad date, missing data source, …) logs a warn and degrades to {@code ""}, so a broken
 * anchor never breaks the whole chat turn.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class WeekContextRenderer {

    static final String HEADER = "\n\n[Heti adatok]\n";

    private final MeWeekService meWeekService;
    /** Present only when the proactive switch is also on — absent renders no review section. */
    private final ObjectProvider<WeekReviewSource> weekReviewSource;

    /** The block for one anchored conversation's turn. Never throws — degrades to {@code ""}. */
    public String render(UUID userId, String contextKind, LocalDate contextDate) {
        try {
            boolean day = "day".equals(contextKind);
            LocalDate weekStart = day
                    ? contextDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    : contextDate;
            MeWeekResponse week = meWeekService.week(userId, weekStart);

            StringBuilder b = new StringBuilder(HEADER);
            for (MeWeekDay weekDay : week.getDays()) {
                b.append(MeWeekService.renderDayLine(weekDay)).append('\n');
            }
            b.append(renderAggregates(week.getWeekly()));

            weekReview(userId, weekStart).ifPresent(review -> b.append(renderReview(review)));

            if (day) {
                b.append("\nA KIJELÖLT NAP: ").append(contextDate).append(" — erről beszélgetünk.\n");
                week.getDays().stream()
                        .filter(weekDay -> contextDate.equals(weekDay.getDate()))
                        .findFirst()
                        .ifPresent(weekDay -> b.append(MeWeekService.renderDayLine(weekDay)).append('\n'));
            }
            return b.toString();
        } catch (RuntimeException e) {
            log.warn("Week context skipped for user {} (kind={}, date={}) — the turn continues"
                    + " without [Heti adatok]", userId, contextKind, contextDate, e);
            return "";
        }
    }

    private static String renderAggregates(MeWeekAggregates weekly) {
        StringBuilder b = new StringBuilder("Heti összesítés: score ")
                .append(orDash(weekly.getScore())).append(" (előző hét ")
                .append(orDash(weekly.getPrevWeekScore())).append(')')
                .append(", átlag kcal ").append(orDashDecimal(weekly.getAvgKcal()))
                .append(", átlag fehérje ").append(orDashDecimal(weekly.getAvgProteinG())).append('g')
                .append(", átlag alvás ").append(orDashDecimal(weekly.getAvgSleepMin())).append(" perc")
                .append(", átlag check-in energia ").append(orDashDecimal(weekly.getAvgCheckinEnergy()))
                .append(", check-in arány ").append(orDashDecimal(weekly.getCheckinRatio()))
                .append(", legutóbbi súly ").append(orDashDecimal(weekly.getLatestWeightKg())).append(" kg")
                .append(", súlytrend ").append(orDashDecimal(weekly.getWeightWeeklyRateKg())).append(" kg/hét")
                .append(", heti XP ").append(orDash(weekly.getTotalXp()))
                .append('\n');
        return b.toString();
    }

    private Optional<ReviewText> weekReview(UUID userId, LocalDate weekStart) {
        WeekReviewSource source = weekReviewSource.getIfAvailable();
        return source == null ? Optional.empty() : source.find(userId, weekStart);
    }

    private static String renderReview(ReviewText review) {
        StringBuilder b = new StringBuilder("\nHeti elemzés: ").append(review.summary()).append('\n');
        for (ReviewText.DayNote note : review.dayNotes()) {
            b.append("- ").append(note.date()).append(": ").append(note.note()).append('\n');
        }
        return b.toString();
    }

    private static String orDash(Object v) {
        return v != null ? v.toString() : "–";
    }

    private static String orDashDecimal(java.math.BigDecimal v) {
        return v != null ? v.stripTrailingZeros().toPlainString() : "–";
    }
}
