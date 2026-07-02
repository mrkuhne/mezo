package io.mrkuhne.mezo.feature.fuel.controller;

import io.mrkuhne.mezo.api.controller.FuelApi;
import io.mrkuhne.mezo.api.dto.IntakeListResponse;
import io.mrkuhne.mezo.api.dto.IntakeRequest;
import io.mrkuhne.mezo.api.dto.IntakeResponse;
import io.mrkuhne.mezo.api.dto.ProtocolActivateRequest;
import io.mrkuhne.mezo.api.dto.ProtocolViewResponse;
import io.mrkuhne.mezo.feature.fuel.service.IntakeService;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class FuelController implements FuelApi {

    private final ProtocolService protocolService;
    private final IntakeService intakeService;
    private final CurrentUserId currentUserId;

    @Override
    public ProtocolViewResponse getProtocol() {
        return protocolService.getView(currentUserId.get());
    }

    @Override
    public ProtocolViewResponse activateProtocol(ProtocolActivateRequest protocolActivateRequest) {
        return protocolService.activate(currentUserId.get(), protocolActivateRequest);
    }

    @Override
    public IntakeListResponse listIntakes(LocalDate date) {
        return intakeService.listForDay(currentUserId.get(), date);
    }

    @Override
    public IntakeResponse logIntake(IntakeRequest intakeRequest) {
        return intakeService.logIntake(currentUserId.get(), intakeRequest);
    }

    @Override
    public void deleteIntake(UUID id) {
        intakeService.deleteIntake(currentUserId.get(), id);
    }
}
