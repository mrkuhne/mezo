package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.MeWeekApi;
import io.mrkuhne.mezo.api.dto.DayEvaluationResponse;
import io.mrkuhne.mezo.api.dto.MeWeekResponse;
import io.mrkuhne.mezo.api.dto.MeWeekTrendResponse;
import io.mrkuhne.mezo.feature.companion.service.DayReviewService;
import io.mrkuhne.mezo.feature.companion.service.MeWeekService;
import io.mrkuhne.mezo.feature.companion.service.WeeklyScoreService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.DayOfWeek;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;

/** Weekly review (mezo-p2tr) — {@code GET /api/me/week/{start}}, the data-layer read behind the
 *  future generator/renderer tasks, plus {@code GET /api/me/week/{start}/trend} (mezo-d20.7.5),
 *  the Heti hero's persisted N-week score trend, plus {@code GET /api/me/day/{date}/evaluation}
 *  (mezo-jcpt.4) — the day page's 6-dimension evaluation. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MeWeekController implements MeWeekApi {

    /** Mirrors the contract's {@code weeks} default — the Heti hero's 8-week trend. */
    private static final int DEFAULT_TREND_WEEKS = 8;

    private final MeWeekService meWeekService;
    private final WeeklyScoreService weeklyScoreService;
    private final DayReviewService dayReviewService;
    private final CurrentUserId currentUserId;

    @Override
    public MeWeekResponse getMeWeek(LocalDate start) {
        requireMonday(start);
        return meWeekService.week(currentUserId.get(), start);
    }

    /** The {@code weeks} window ENDS at {@code start} (inclusive), so the hero's trend follows the
     *  browsed week rather than always ending at today — the design highlights the viewed week
     *  inside its own 8-week history. Range validation lives in the contract ({@code minimum: 1},
     *  {@code maximum: 26}); the default is applied here too, since a generated nullable query
     *  parameter arrives as null when the client omits it. */
    @Override
    public MeWeekTrendResponse getMeWeekTrend(LocalDate start, Integer weeks) {
        requireMonday(start);
        return weeklyScoreService.trend(currentUserId.get(), start, weeks == null ? DEFAULT_TREND_WEEKS : weeks);
    }

    /** The day page's own read (mezo-jcpt.4): the day's deterministic 6-dimension evaluation plus,
     *  for a closed and scored day, the lazily-cached Mezo prose. Thin delegation on purpose — the
     *  state decision, the cache and the never-5xx discipline all live in {@link DayReviewService}.
     *  No date validation here: an unparseable path date is already a 400 from the binder, and
     *  every real calendar date (past, today, future) is a legitimate question with an honest
     *  answer. */
    @Override
    public DayEvaluationResponse getDayEvaluation(LocalDate date) {
        return dayReviewService.assemble(currentUserId.get(), date);
    }

    private static void requireMonday(LocalDate start) {
        if (start.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ME_WEEK_START_NOT_MONDAY").build(), HttpStatus.BAD_REQUEST);
        }
    }
}
