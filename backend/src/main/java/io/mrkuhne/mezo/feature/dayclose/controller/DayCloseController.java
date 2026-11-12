package io.mrkuhne.mezo.feature.dayclose.controller;

import io.mrkuhne.mezo.api.controller.DayCloseApi;
import io.mrkuhne.mezo.api.dto.CheckInLineRequest;
import io.mrkuhne.mezo.api.dto.DayCloseLineResponse;
import io.mrkuhne.mezo.api.dto.DayCloseRequest;
import io.mrkuhne.mezo.api.dto.DayCloseResponse;
import io.mrkuhne.mezo.feature.dayclose.service.DayCloseService;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;

/** /api/day-close (Boop B3, mezo-r36n9.13) — thin delegation, ownership from the principal. */
@RestController
@RequiredArgsConstructor
public class DayCloseController implements DayCloseApi {

    private final DayCloseService service;
    private final CurrentUserId currentUserId;

    @Override
    public DayCloseResponse putDayClose(LocalDate date, DayCloseRequest request) {
        return service.put(currentUserId.get(), date, request);
    }

    @Override
    public DayCloseResponse getDayClose(LocalDate date) {
        return service.get(currentUserId.get(), date).orElseThrow(() -> new SystemRuntimeErrorException(
            SystemMessage.error("DAY_CLOSE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    @Override
    public List<DayCloseResponse> listDayCloses(LocalDate from, LocalDate to) {
        return service.list(currentUserId.get(), from, to);
    }

    @Override
    public DayCloseLineResponse generateDayCloseLine(LocalDate date) {
        return new DayCloseLineResponse().line(service.dayLine(currentUserId.get(), date));
    }

    @Override
    public DayCloseLineResponse generateCheckInLine(LocalDate date, CheckInLineRequest request) {
        return new DayCloseLineResponse().line(service.checkInLine(currentUserId.get(), date, request.getSlot()));
    }
}
