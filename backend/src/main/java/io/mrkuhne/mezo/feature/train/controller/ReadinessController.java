package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.TrainReadinessApi;
import io.mrkuhne.mezo.api.dto.ReadinessChoiceRequest;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse;
import io.mrkuhne.mezo.feature.train.service.ReadinessService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Check-in 2.0 training readiness (mezo-ck2) — mappings come from {@link TrainReadinessApi}. */
@RestController
@RequiredArgsConstructor
public class ReadinessController implements TrainReadinessApi {

    private final ReadinessService readinessService;
    private final CurrentUserId currentUserId;

    @Override
    public ReadinessTodayResponse getTodayReadiness() {
        return readinessService.today(currentUserId.get());
    }

    @Override
    public ReadinessTodayResponse chooseTodayReadiness(ReadinessChoiceRequest readinessChoiceRequest) {
        return readinessService.choose(currentUserId.get(), readinessChoiceRequest);
    }

    @Override
    public ReadinessTodayResponse undoTodayReadiness() {
        return readinessService.undo(currentUserId.get());
    }
}
