package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.MeWeekApi;
import io.mrkuhne.mezo.api.dto.MeWeekResponse;
import io.mrkuhne.mezo.feature.companion.service.MeWeekService;
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
 *  future generator/renderer tasks. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MeWeekController implements MeWeekApi {

    private final MeWeekService meWeekService;
    private final CurrentUserId currentUserId;

    @Override
    public MeWeekResponse getMeWeek(LocalDate start) {
        if (start.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ME_WEEK_START_NOT_MONDAY").build(), HttpStatus.BAD_REQUEST);
        }
        return meWeekService.week(currentUserId.get(), start);
    }
}
