package io.mrkuhne.mezo.feature.biometrics.checkin.controller;

import io.mrkuhne.mezo.api.controller.CheckInApi;
import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/validation come from {@link CheckInApi}. */
@RestController
@RequiredArgsConstructor
public class CheckInController implements CheckInApi {

    private final CheckInService service;
    private final CurrentUserId currentUserId;

    @Override
    public List<CheckInResponse> listCheckInsForDay(LocalDate date) {
        return service.listForDay(currentUserId.get(), date);
    }

    @Override
    public CheckInResponse saveCheckIn(SaveCheckInRequest saveCheckInRequest) {
        // 200 OK per contract: this is an upsert, not a pure create.
        return service.save(currentUserId.get(), saveCheckInRequest);
    }
}
