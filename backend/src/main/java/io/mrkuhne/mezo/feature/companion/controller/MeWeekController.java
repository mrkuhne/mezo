package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.MeWeekApi;
import io.mrkuhne.mezo.api.dto.MeWeekResponse;
import io.mrkuhne.mezo.api.dto.MeWeekTrendResponse;
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
 *  the Heti hero's persisted N-week score trend. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MeWeekController implements MeWeekApi {

    /** Mirrors the contract's {@code weeks} default — the Heti hero's 8-week trend. */
    private static final int DEFAULT_TREND_WEEKS = 8;

    private final MeWeekService meWeekService;
    private final WeeklyScoreService weeklyScoreService;
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

    private static void requireMonday(LocalDate start) {
        if (start.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ME_WEEK_START_NOT_MONDAY").build(), HttpStatus.BAD_REQUEST);
        }
    }
}
