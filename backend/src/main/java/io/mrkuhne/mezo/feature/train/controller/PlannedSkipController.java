package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.TrainSkipApi;
import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.api.dto.PlannedSkipResponse;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Kihagyás S1 (mezo-q4xt2.1) — mappings come from {@link TrainSkipApi}. */
@RestController
@RequiredArgsConstructor
public class PlannedSkipController implements TrainSkipApi {

    private final PlannedSkipService plannedSkipService;
    private final CurrentUserId currentUserId;

    @Override
    public List<PlannedSkipResponse> listPlannedSkips(LocalDate from, LocalDate to) {
        return plannedSkipService.list(currentUserId.get(), from, to);
    }

    @Override
    public PlannedSkipResponse upsertPlannedSkip(PlannedSkipRequest plannedSkipRequest) {
        return plannedSkipService.upsert(currentUserId.get(), plannedSkipRequest);
    }

    @Override
    public void undoPlannedSkip(UUID id) {
        plannedSkipService.undo(currentUserId.get(), id);
    }
}
