package io.mrkuhne.mezo.feature.boop.controller;

import io.mrkuhne.mezo.api.controller.BoopApi;
import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.api.dto.SessionTime;
import io.mrkuhne.mezo.api.dto.SessionTimeRequest;
import io.mrkuhne.mezo.feature.boop.service.BoopBriefService;
import io.mrkuhne.mezo.feature.boop.service.SessionTimeService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** /api/boop surface (Boop S3, mezo-r36n9.7) — thin delegation, ownership from the principal. The
 *  {@code date} is the client's local day, already pattern-validated by the generated interface. */
@RestController
@RequiredArgsConstructor
public class BoopController implements BoopApi {

    private final BoopBriefService briefService;
    private final SessionTimeService sessionTimeService;
    private final CurrentUserId currentUserId;

    @Override
    public BoopBrief getBoopBrief(String date) {
        return briefService.get(currentUserId.get(), day(date));
    }

    @Override
    public BoopBrief regenerateBoopBrief(String date) {
        return briefService.regenerate(currentUserId.get(), day(date));
    }

    /** The pattern lets 2026-02-30 through; an impossible date is a 400, not a 500. */
    private static LocalDate day(String date) {
        try {
            return LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            throw BoopBriefService.invalidDate();
        }
    }

    @Override
    public SessionTime setSessionTime(SessionTimeRequest request) {
        return sessionTimeService.set(currentUserId.get(), day(request.getDate()), request.getTime());
    }

    @Override
    public void clearSessionTime(String date) {
        sessionTimeService.clear(currentUserId.get(), day(date));
    }
}
